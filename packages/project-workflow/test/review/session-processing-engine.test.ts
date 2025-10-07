/**
 * Tests for SessionProcessingEngine
 * Parallel processing with session lifecycle management
 */

import { describe, it, expect, beforeEach, jest } from 'bun:test'
import { SessionProcessingEngine } from '../../src/review/session-processing-engine.js'
import type { ShardContent, ProcessingConfig, ProcessingStatistics } from '../../src/index.js'

describe('SessionProcessingEngine', () => {
  let engine: SessionProcessingEngine
  let mockConfig: ProcessingConfig

  beforeEach(() => {
    engine = new SessionProcessingEngine()
    mockConfig = {
      batchSize: 2,
      retryAttempts: 3,
      retryDelay: 100,
      timeout: 5000
    }
  })

  describe('validateConfig', () => {
    it('should validate correct configuration', () => {
      expect(engine.validateConfig(mockConfig)).toBe(true)
    })

    it('should reject negative batch size', () => {
      const invalidConfig = { ...mockConfig, batchSize: -1 }
      expect(engine.validateConfig(invalidConfig)).toBe(false)
    })

    it('should reject zero batch size', () => {
      const invalidConfig = { ...mockConfig, batchSize: 0 }
      expect(engine.validateConfig(invalidConfig)).toBe(false)
    })

    it('should reject negative retry attempts', () => {
      const invalidConfig = { ...mockConfig, retryAttempts: -1 }
      expect(engine.validateConfig(invalidConfig)).toBe(false)
    })

    it('should reject negative retry delay', () => {
      const invalidConfig = { ...mockConfig, retryDelay: -100 }
      expect(engine.validateConfig(invalidConfig)).toBe(false)
    })

    it('should reject negative timeout', () => {
      const invalidConfig = { ...mockConfig, timeout: -1000 }
      expect(engine.validateConfig(invalidConfig)).toBe(false)
    })

    it('should accept zero retry attempts (no retries)', () => {
      const validConfig = { ...mockConfig, retryAttempts: 0 }
      expect(engine.validateConfig(validConfig)).toBe(true)
    })
  })

  describe('processShards', () => {
    const createMockShards = (count: number): ShardContent[] => {
      return Array.from({ length: count }, (_, i) => ({
        index: i,
        files: [
          {
            path: `file${i}.ts`,
            content: `content ${i}`,
            tokens: 100 + i * 10,
            size: 50 + i * 5,
            changeType: 'modify'
          }
        ],
        content: `shard content ${i}`,
        tokens: 100 + i * 10,
        metadata: {
          fileCount: 1,
          strategy: 'file_boundary_aware',
          createdAt: new Date().toISOString(),
          estimatedProcessingTime: (100 + i * 10) * 10
        }
      }))
    }

    it('should process single shard successfully', async () => {
      const shards = createMockShards(1)
      const mockProcessor = jest.fn().mockResolvedValue('mock result')

      const results = await engine.processShards(shards, mockProcessor, mockConfig)

      expect(results).toHaveLength(1)
      expect(results[0].success).toBe(true)
      expect(results[0].result).toBe('mock result')
      expect(results[0].shardIndex).toBe(0)
      expect(results[0].processingTime).toBeGreaterThan(0)
      expect(mockProcessor).toHaveBeenCalledTimes(1)
    })

    it('should process multiple shards in batches', async () => {
      const shards = createMockShards(5)
      const mockProcessor = jest.fn().mockResolvedValue('mock result')

      const results = await engine.processShards(shards, mockProcessor, mockConfig)

      expect(results).toHaveLength(5)
      expect(results.every(r => r.success)).toBe(true)
      expect(mockProcessor).toHaveBeenCalledTimes(5)

      // Check that all shards were processed
      const processedIndices = results.map(r => r.shardIndex).sort()
      expect(processedIndices).toEqual([0, 1, 2, 3, 4])
    })

    it('should handle processing failures gracefully', async () => {
      const shards = createMockShards(3)
      const mockProcessor = jest.fn()
        .mockResolvedValueOnce('success 1')
        .mockRejectedValueOnce(new Error('Processing failed'))
        .mockResolvedValueOnce('success 3')

      const results = await engine.processShards(shards, mockProcessor, mockConfig)

      expect(results).toHaveLength(3)
      expect(results[0].success).toBe(true)
      expect(results[0].result).toBe('success 1')
      expect(results[1].success).toBe(false)
      expect(results[1].error).toContain('Processing failed')
      expect(results[2].success).toBe(true)
      expect(results[2].result).toBe('success 3')
    })

    it('should retry failed operations', async () => {
      const shards = createMockShards(1)
      const mockProcessor = jest.fn()
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockRejectedValueOnce(new Error('Second attempt failed'))
        .mockResolvedValueOnce('Third attempt success')

      const results = await engine.processShards(shards, mockProcessor, mockConfig)

      expect(results).toHaveLength(1)
      expect(results[0].success).toBe(true)
      expect(results[0].result).toBe('Third attempt success')
      expect(mockProcessor).toHaveBeenCalledTimes(3)
    })

    it('should fail after max retry attempts', async () => {
      const shards = createMockShards(1)
      const mockProcessor = jest.fn().mockRejectedValue(new Error('Always fails'))

      const results = await engine.processShards(shards, mockProcessor, mockConfig)

      expect(results).toHaveLength(1)
      expect(results[0].success).toBe(false)
      expect(results[0].error).toContain('Always fails')
      expect(mockProcessor).toHaveBeenCalledTimes(mockConfig.retryAttempts + 1)
    })

    it('should respect timeout settings', async () => {
      const shards = createMockShards(1)
      const shortTimeoutConfig = { ...mockConfig, timeout: 50 }

      const mockProcessor = jest.fn().mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve('too slow'), 200))
      )

      const results = await engine.processShards(shards, mockProcessor, shortTimeoutConfig)

      expect(results).toHaveLength(1)
      expect(results[0].success).toBe(false)
      expect(results[0].error).toContain('timeout') // Should timeout
    })

    it('should handle empty shard array', async () => {
      const mockProcessor = jest.fn()

      const results = await engine.processShards([], mockProcessor, mockConfig)

      expect(results).toHaveLength(0)
      expect(mockProcessor).not.toHaveBeenCalled()
    })

    it('should throw error for invalid configuration', async () => {
      const shards = createMockShards(1)
      const invalidConfig = { ...mockConfig, batchSize: -1 }
      const mockProcessor = jest.fn()

      await expect(
        engine.processShards(shards, mockProcessor, invalidConfig)
      ).rejects.toThrow('Invalid processing configuration')
    })
  })

  describe('getStatistics', () => {
    it('should return statistics for empty results', () => {
      const stats = engine.getStatistics([])

      expect(stats.totalShards).toBe(0)
      expect(stats.successfulShards).toBe(0)
      expect(stats.failedShards).toBe(0)
      expect(stats.totalProcessingTime).toBe(0)
      expect(stats.averageShardTime).toBe(0)
      expect(stats.parallelProcessing).toBe(true)
    })

    it('should calculate statistics for mixed results', () => {
      const mockResults = [
        {
          shardIndex: 0,
          success: true,
          result: 'success',
          processingTime: 1000,
          timestamp: new Date().toISOString()
        },
        {
          shardIndex: 1,
          success: false,
          error: 'failed',
          processingTime: 500,
          timestamp: new Date().toISOString()
        },
        {
          shardIndex: 2,
          success: true,
          result: 'success',
          processingTime: 1500,
          timestamp: new Date().toISOString()
        }
      ]

      const stats = engine.getStatistics(mockResults)

      expect(stats.totalShards).toBe(3)
      expect(stats.successfulShards).toBe(2)
      expect(stats.failedShards).toBe(1)
      expect(stats.totalProcessingTime).toBe(3000)
      expect(stats.averageShardTime).toBe(Math.round(3000 / 3))
      expect(stats.parallelProcessing).toBe(true)
    })

    it('should handle all successful results', () => {
      const mockResults = [
        {
          shardIndex: 0,
          success: true,
          result: 'success 1',
          processingTime: 800,
          timestamp: new Date().toISOString()
        },
        {
          shardIndex: 1,
          success: true,
          result: 'success 2',
          processingTime: 1200,
          timestamp: new Date().toISOString()
        }
      ]

      const stats = engine.getStatistics(mockResults)

      expect(stats.totalShards).toBe(2)
      expect(stats.successfulShards).toBe(2)
      expect(stats.failedShards).toBe(0)
      expect(stats.totalProcessingTime).toBe(2000)
      expect(stats.averageShardTime).toBe(1000)
    })
  })

  describe('getMetadata', () => {
    it('should return engine metadata', () => {
      const metadata = engine.getMetadata()

      expect(metadata.type).toBe('parallel_processing')
      expect(metadata.description).toContain('parallel processing')
      expect(metadata.capabilities).toContain('Batch processing')
      expect(metadata.capabilities).toContain('Retry logic')
      expect(metadata.capabilities).toContain('Session lifecycle management')
      expect(metadata.recommendedUse).toContain('Large-scale processing')
    })
  })
})