/**
 * Tests for FileBoundaryShardingStrategy
 * Intelligent file-boundary-aware sharding with token optimization
 */

import { describe, it, expect, beforeEach } from 'bun:test'
import { FileBoundaryShardingStrategy } from '../../src/review/file-boundary-sharding-strategy.js'
import type { SourceContent, ShardingConfig, ContentFile } from '../../src/index.js'

describe('FileBoundaryShardingStrategy', () => {
  let strategy: FileBoundaryShardingStrategy
  let mockConfig: ShardingConfig

  beforeEach(() => {
    strategy = new FileBoundaryShardingStrategy()
    mockConfig = {
      strategy: 'file_boundary' as any,
      targetTokens: 8000,
      maxTokens: 12000,
      minTokens: 2000,
      preserveBoundaries: true
    }
  })

  describe('validateConfig', () => {
    it('should validate correct configuration', () => {
      expect(strategy.validateConfig(mockConfig)).toBe(true)
    })

    it('should reject negative target tokens', () => {
      const invalidConfig = { ...mockConfig, targetTokens: -100 }
      expect(strategy.validateConfig(invalidConfig)).toBe(false)
    })

    it('should reject zero target tokens', () => {
      const invalidConfig = { ...mockConfig, targetTokens: 0 }
      expect(strategy.validateConfig(invalidConfig)).toBe(false)
    })

    it('should reject negative min tokens', () => {
      const invalidConfig = { ...mockConfig, minTokens: -100 }
      expect(strategy.validateConfig(invalidConfig)).toBe(false)
    })

    it('should reject max tokens less than or equal to target tokens', () => {
      const invalidConfig = { ...mockConfig, maxTokens: 8000 }
      expect(strategy.validateConfig(invalidConfig)).toBe(false)
    })

    it('should reject min tokens greater than target tokens', () => {
      const invalidConfig = { ...mockConfig, minTokens: 10000 }
      expect(strategy.validateConfig(invalidConfig)).toBe(false)
    })
  })

  describe('createShards', () => {
    const createMockSourceContent = (files: ContentFile[]): SourceContent => ({
      content: {
        files,
        totalTokens: files.reduce((sum, f) => sum + f.tokens, 0)
      },
      metadata: {
        type: 'ado-pr',
        identifier: 'test-pr',
        source: 'test',
        generatedAt: new Date().toISOString(),
        fetchOptions: {}
      }
    })

    it('should create single shard for small content', async () => {
      const files: ContentFile[] = [
        {
          path: 'small-file.ts',
          content: 'console.log("hello world")',
          tokens: 100,
          size: 27,
          changeType: 'modify'
        }
      ]

      const sourceContent = createMockSourceContent(files)
      const shards = await strategy.createShards(sourceContent, mockConfig)

      expect(shards).toHaveLength(1)
      expect(shards[0].files).toHaveLength(1)
      expect(shards[0].tokens).toBeLessThanOrEqual(mockConfig.maxTokens)
      expect(shards[0].index).toBe(0)
    })

    it('should create multiple shards for large content', async () => {
      const files: ContentFile[] = [
        {
          path: 'large-file1.ts',
          content: 'x'.repeat(10000), // Large content
          tokens: 5000,
          size: 10000,
          changeType: 'modify'
        },
        {
          path: 'large-file2.ts',
          content: 'y'.repeat(10000),
          tokens: 5000,
          size: 10000,
          changeType: 'modify'
        },
        {
          path: 'large-file3.ts',
          content: 'z'.repeat(10000),
          tokens: 5000,
          size: 10000,
          changeType: 'modify'
        }
      ]

      const sourceContent = createMockSourceContent(files)
      const shards = await strategy.createShards(sourceContent, mockConfig)

      expect(shards.length).toBeGreaterThan(1)

      // Check that each shard respects token limits
      shards.forEach(shard => {
        expect(shard.tokens).toBeLessThanOrEqual(mockConfig.maxTokens * 1.2) // Allow 20% overage
        expect(shard.files.length).toBeGreaterThan(0)
      })

      // Check that all files are included
      const totalFiles = shards.reduce((sum, shard) => sum + shard.files.length, 0)
      expect(totalFiles).toBe(files.length)
    })

    it('should handle very large single file', async () => {
      const files: ContentFile[] = [
        {
          path: 'huge-file.ts',
          content: 'x'.repeat(50000), // Very large content
          tokens: 15000, // Exceeds target and max tokens
          size: 50000,
          changeType: 'modify'
        }
      ]

      const sourceContent = createMockSourceContent(files)
      const shards = await strategy.createShards(sourceContent, mockConfig)

      expect(shards).toHaveLength(1)
      expect(shards[0].files).toHaveLength(1)
      expect(shards[0].tokens).toBe(15000)
      // Should create shard even if it exceeds max tokens (file boundary preservation)
    })

    it('should optimize shard distribution', async () => {
      const files: ContentFile[] = [
        { path: 'small1.ts', content: 'small', tokens: 1000, size: 100, changeType: 'modify' },
        { path: 'small2.ts', content: 'small', tokens: 1000, size: 100, changeType: 'modify' },
        { path: 'medium.ts', content: 'medium', tokens: 4000, size: 1000, changeType: 'modify' },
        { path: 'large.ts', content: 'large', tokens: 6000, size: 2000, changeType: 'modify' }
      ]

      const sourceContent = createMockSourceContent(files)
      const shards = await strategy.createShards(sourceContent, mockConfig)

      // Should intelligently group files to optimize token usage
      expect(shards.length).toBeGreaterThan(0)

      // All shards should be within reasonable token limits
      shards.forEach(shard => {
        expect(shard.tokens).toBeGreaterThan(0)
        expect(shard.metadata.fileCount).toBeGreaterThan(0)
      })
    })

    it('should include file headers in shard content', async () => {
      const files: ContentFile[] = [
        {
          path: 'test-file.ts',
          content: 'const x = 1',
          tokens: 100,
          size: 11,
          changeType: 'modify'
        }
      ]

      const sourceContent = createMockSourceContent(files)
      const shards = await strategy.createShards(sourceContent, mockConfig)

      expect(shards).toHaveLength(1)
      expect(shards[0].content).toContain('=== FILE: test-file.ts ===')
      expect(shards[0].content).toContain('const x = 1')
    })

    it('should throw error for invalid configuration', async () => {
      const files: ContentFile[] = [
        { path: 'test.ts', content: 'test', tokens: 100, size: 4, changeType: 'modify' }
      ]

      const sourceContent = createMockSourceContent(files)
      const invalidConfig = { ...mockConfig, targetTokens: -100 }

      await expect(
        strategy.createShards(sourceContent, invalidConfig)
      ).rejects.toThrow('Invalid sharding configuration')
    })

    it('should throw error for empty content', async () => {
      const sourceContent = createMockSourceContent([])

      await expect(
        strategy.createShards(sourceContent, mockConfig)
      ).rejects.toThrow('No files to shard')
    })
  })

  describe('estimateShardCount', () => {
    const createMockContent = (totalTokens: number): SourceContent => ({
      content: {
        files: [],
        totalTokens
      },
      metadata: {
        type: 'ado-pr',
        identifier: 'test',
        source: 'test',
        generatedAt: new Date().toISOString(),
        fetchOptions: {}
      }
    })

    it('should estimate 1 shard for small content', () => {
      const content = createMockContent(5000)
      const estimate = strategy.estimateShardCount(content, mockConfig)
      expect(estimate).toBe(1)
    })

    it('should estimate multiple shards for large content', () => {
      const content = createMockContent(20000)
      const estimate = strategy.estimateShardCount(content, mockConfig)
      expect(estimate).toBeGreaterThan(1)
      // Should account for file boundary overhead
      expect(estimate).toBeGreaterThanOrEqual(Math.ceil(20000 / mockConfig.targetTokens))
    })

    it('should return at least 1 shard', () => {
      const content = createMockContent(0)
      const estimate = strategy.estimateShardCount(content, mockConfig)
      expect(estimate).toBe(1)
    })
  })

  describe('getMetadata', () => {
    it('should return strategy metadata', () => {
      const metadata = strategy.getMetadata()

      expect(metadata.type).toBe('file_boundary')
      expect(metadata.description).toContain('file-boundary-aware')
      expect(metadata.capabilities).toContain('File boundary preservation')
      expect(metadata.capabilities).toContain('Token optimization')
      expect(metadata.recommendedUse).toContain('Code review workflows')
    })
  })

  describe('getShardingStatistics', () => {
    it('should return statistics for empty shards', () => {
      const stats = strategy.getShardingStatistics([])

      expect(stats.totalShards).toBe(0)
      expect(stats.averageTokensPerShard).toBe(0)
      expect(stats.averageFilesPerShard).toBe(0)
      expect(stats.tokenDistribution.min).toBe(0)
      expect(stats.tokenDistribution.max).toBe(0)
      expect(stats.tokenDistribution.median).toBe(0)
    })

    it('should calculate statistics for multiple shards', () => {
      const mockShards = [
        {
          index: 0,
          files: [{ path: 'file1.ts', content: 'test', tokens: 100, size: 4, changeType: 'modify' as any }],
          content: 'test content 1',
          tokens: 5000,
          metadata: { fileCount: 1, strategy: 'file_boundary_aware', createdAt: new Date().toISOString(), estimatedProcessingTime: 5000 }
        },
        {
          index: 1,
          files: [
            { path: 'file2.ts', content: 'test', tokens: 150, size: 4, changeType: 'modify' as any },
            { path: 'file3.ts', content: 'test', tokens: 200, size: 4, changeType: 'modify' as any }
          ],
          content: 'test content 2',
          tokens: 8000,
          metadata: { fileCount: 2, strategy: 'file_boundary_aware', createdAt: new Date().toISOString(), estimatedProcessingTime: 8000 }
        },
        {
          index: 2,
          files: [{ path: 'file4.ts', content: 'test', tokens: 300, size: 4, changeType: 'modify' as any }],
          content: 'test content 3',
          tokens: 3000,
          metadata: { fileCount: 1, strategy: 'file_boundary_aware', createdAt: new Date().toISOString(), estimatedProcessingTime: 3000 }
        }
      ]

      const stats = strategy.getShardingStatistics(mockShards)

      expect(stats.totalShards).toBe(3)
      expect(stats.averageTokensPerShard).toBe(Math.round((5000 + 8000 + 3000) / 3))
      expect(stats.averageFilesPerShard).toBe(Math.round((1 + 2 + 1) / 3))
      expect(stats.tokenDistribution.min).toBe(3000)
      expect(stats.tokenDistribution.max).toBe(8000)
      expect(stats.tokenDistribution.median).toBe(5000)
      expect(stats.fileDistribution.min).toBe(1)
      expect(stats.fileDistribution.max).toBe(2)
      expect(stats.fileDistribution.median).toBe(1)
    })
  })
})