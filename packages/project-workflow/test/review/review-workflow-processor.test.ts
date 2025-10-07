/**
 * Tests for ReviewWorkflowProcessor
 * Main orchestrator integration tests
 */

import { describe, it, expect, beforeEach, jest } from 'bun:test'
import { ReviewWorkflowProcessor } from '../../src/review/review-workflow-processor.js'
import type { ReviewInput, ReviewConfig } from '../../src/index.js'

describe('ReviewWorkflowProcessor', () => {
  let processor: ReviewWorkflowProcessor
  let mockConfig: ReviewConfig

  beforeEach(() => {
    mockConfig = {
      baseUrl: 'http://localhost:3001',
      maxParallelSessions: 2,
      timeoutPerShard: 30000,
      autoCleanup: true,

      sharding: {
        strategy: 'file_boundary' as any,
        targetTokens: 8000,
        maxTokens: 12000,
        minTokens: 2000,
        preserveBoundaries: true
      },

      processing: {
        batchSize: 2,
        retryAttempts: 3,
        retryDelay: 1000,
        timeout: 30000
      },

      aggregation: {
        outputFormat: 'json' as any,
        includeMetadata: true,
        includeStatistics: true,
        sortResults: true
      },

      optimalTokensPerShard: 8000,
      maxTokensPerShard: 12000,
      minTokensPerShard: 2000,
      agent: 'code-reviewer',
      outputFormat: 'json',
      includeFilePatterns: ['**/*.ts', '**/*.js'],
      excludeFilePatterns: ['**/node_modules/**'],
      maxFileSize: 1024 * 1024,
      adoCredentials: {
        pat: 'test-token',
        organization: 'TestOrg'
      },
      saveVersions: false
    }

    processor = new ReviewWorkflowProcessor(mockConfig)
  })

  describe('validateInput', () => {
    it('should validate correct ADO PR input', () => {
      const input: ReviewInput = {
        type: 'ado-pr',
        identifier: 'test-pr-123',
        source: 'https://dev.azure.com/TestOrg/TestProject/_git/testrepo/pullrequest/123'
      }

      expect(() => processor.validateInput(input)).not.toThrow()
    })

    it('should validate local directory input', () => {
      const input: ReviewInput = {
        type: 'local',
        identifier: 'local-review',
        source: '/path/to/local/directory'
      }

      expect(() => processor.validateInput(input)).not.toThrow()
    })

    it('should reject invalid source URLs', () => {
      const input: ReviewInput = {
        type: 'ado-pr',
        identifier: 'test-pr',
        source: 'invalid-url'
      }

      expect(() => processor.validateInput(input)).toThrow('Invalid ADO PR URL format')
    })

    it('should reject missing identifiers', () => {
      const input: ReviewInput = {
        type: 'ado-pr',
        identifier: '',
        source: 'https://dev.azure.com/TestOrg/TestProject/_git/testrepo/pullrequest/123'
      }

      expect(() => processor.validateInput(input)).toThrow('Identifier is required')
    })

    it('should reject unsupported source types', () => {
      const input: ReviewInput = {
        type: 'unsupported' as any,
        identifier: 'test',
        source: 'test'
      }

      expect(() => processor.validateInput(input)).toThrow('Unsupported source type')
    })
  })

  describe('getMetadata', () => {
    it('should return workflow metadata', () => {
      const metadata = processor.getMetadata()

      expect(metadata.type).toBe('review')
      expect(metadata.version).toBeDefined()
      expect(metadata.capabilities).toContain('ado-pr-processing')
      expect(metadata.capabilities).toContain('file-boundary-sharding')
      expect(metadata.capabilities).toContain('parallel-processing')
      expect(metadata.capabilities).toContain('xml-to-json-conversion')
    })
  })

  describe('process', () => {
    // Mock the dependencies for integration testing
    beforeEach(() => {
      // Mock the content source to avoid real ADO API calls
      const mockContentSource = {
        validateInput: jest.fn(() => true),
        validateIdentifier: jest.fn(() => true),
        isAvailable: jest.fn().mockResolvedValue(true),
        getSourceType: jest.fn(() => 'ado-pr'),
        fetchContent: jest.fn().mockResolvedValue({
          content: {
            files: [
              {
                path: 'test.ts',
                content: 'console.log("test")',
                tokens: 100,
                size: 20,
                changeType: 'modify'
              }
            ],
            totalTokens: 100
          },
          metadata: {
            type: 'ado-pr',
            identifier: 'test-pr',
            source: 'test-source',
            generatedAt: new Date().toISOString(),
            fetchOptions: {}
          }
        }),
        getStatistics: jest.fn().mockResolvedValue({
          filesProcessed: 1,
          totalFiles: 1,
          bytesProcessed: 20,
          processingTime: 100
        }),
        cleanup: jest.fn().mockResolvedValue(undefined)
      }

      // Mock the session processing engine to avoid real API calls
      const mockProcessingEngine = {
        validateConfig: jest.fn(() => true),
        processShards: jest.fn().mockResolvedValue([
          {
            shardIndex: 0,
            success: true,
            result: '<review-insight type="quality" severity="medium">Code looks good</review-insight>',
            processingTime: 1000,
            timestamp: new Date().toISOString()
          }
        ]),
        getStatistics: jest.fn(),
        getMetadata: jest.fn()
      }

      // Replace the processor's dependencies with mocks
      ;(processor as any).contentSource = mockContentSource
      ;(processor as any).processingEngine = mockProcessingEngine
    })

    it('should process a complete workflow successfully', async () => {
      const input: ReviewInput = {
        type: 'ado-pr',
        identifier: 'test-pr-123',
        source: 'https://dev.azure.com/TestOrg/TestProject/_git/testrepo/pullrequest/123'
      }

      const result = await processor.process(input, mockConfig)

      expect(result.success).toBe(true)
      expect(result.insights).toHaveLength(1)
      expect(result.insights[0]).toMatchObject({
        type: 'quality',
        severity: 'medium',
        content: 'Code looks good'
      })
      expect(result.metadata).toBeDefined()
      expect(result.statistics).toBeDefined()
    })

    it('should handle processing failures gracefully', async () => {
      const input: ReviewInput = {
        type: 'ado-pr',
        identifier: 'test-pr-456',
        source: 'https://dev.azure.com/TestOrg/TestProject/_git/testrepo/pullrequest/456'
      }

      // Mock content source to fail
      const mockContentSource = (processor as any).contentSource
      mockContentSource.fetchContent.mockRejectedValue(new Error('Failed to fetch content'))

      await expect(processor.process(input, mockConfig)).rejects.toThrow('Failed to fetch content')
    })

    it('should validate configuration before processing', async () => {
      const input: ReviewInput = {
        type: 'ado-pr',
        identifier: 'test-pr-789',
        source: 'https://dev.azure.com/TestOrg/TestProject/_git/testrepo/pullrequest/789'
      }

      const invalidConfig = {
        ...mockConfig,
        sharding: {
          ...mockConfig.sharding,
          targetTokens: -1000 // Invalid
        }
      }

      await expect(processor.process(input, invalidConfig)).rejects.toThrow()
    })

    it('should cleanup workspace after processing', async () => {
      const input: ReviewInput = {
        type: 'ado-pr',
        identifier: 'test-pr-cleanup',
        source: 'https://dev.azure.com/TestOrg/TestProject/_git/testrepo/pullrequest/999'
      }

      const mockWorkspaceManager = {
        createWorkspace: jest.fn().mockResolvedValue('test-workspace-id'),
        saveContent: jest.fn().mockResolvedValue(undefined),
        loadContent: jest.fn().mockResolvedValue({ files: [], totalTokens: 0 }),
        getStatistics: jest.fn().mockResolvedValue({
          workspaceId: 'test-workspace-id',
          filesStored: 0,
          totalSize: 0,
          createdAt: new Date().toISOString()
        }),
        cleanup: jest.fn().mockResolvedValue(undefined)
      }

      ;(processor as any).workspaceManager = mockWorkspaceManager

      await processor.process(input, mockConfig)

      expect(mockWorkspaceManager.cleanup).toHaveBeenCalledWith('test-workspace-id')
    })

    it('should include performance metrics in result', async () => {
      const input: ReviewInput = {
        type: 'ado-pr',
        identifier: 'test-pr-perf',
        source: 'https://dev.azure.com/TestOrg/TestProject/_git/testrepo/pullrequest/111'
      }

      const startTime = Date.now()
      const result = await processor.process(input, mockConfig)
      const endTime = Date.now()

      expect(result.metadata.processingStats).toBeDefined()
      expect(result.metadata.processingStats.totalProcessingTime).toBeGreaterThan(0)
      expect(result.metadata.processingStats.totalProcessingTime).toBeLessThan(endTime - startTime + 100)
    })
  })

  describe('error handling', () => {
    it('should handle content source failures', async () => {
      const input: ReviewInput = {
        type: 'ado-pr',
        identifier: 'test-pr-error',
        source: 'https://dev.azure.com/TestOrg/TestProject/_git/testrepo/pullrequest/error'
      }

      const mockContentSource = {
        validateInput: jest.fn(() => true),
        validateIdentifier: jest.fn(() => true),
        isAvailable: jest.fn().mockResolvedValue(true),
        getSourceType: jest.fn(() => 'ado-pr'),
        fetchContent: jest.fn().mockRejectedValue(new Error('Network error')),
        getStatistics: jest.fn(),
        cleanup: jest.fn()
      }

      ;(processor as any).contentSource = mockContentSource

      await expect(processor.process(input, mockConfig)).rejects.toThrow('Network error')
    })

    it('should handle sharding failures', async () => {
      const input: ReviewInput = {
        type: 'ado-pr',
        identifier: 'test-pr-shard-error',
        source: 'https://dev.azure.com/TestOrg/TestProject/_git/testrepo/pullrequest/shard-error'
      }

      const mockShardingStrategy = {
        validateConfig: jest.fn(() => false), // Invalid config
        createShards: jest.fn(),
        estimateShardCount: jest.fn(),
        getMetadata: jest.fn(),
        getShardingStatistics: jest.fn()
      }

      ;(processor as any).shardingStrategy = mockShardingStrategy

      await expect(processor.process(input, mockConfig)).rejects.toThrow()
    })

    it('should handle aggregation failures', async () => {
      const input: ReviewInput = {
        type: 'ado-pr',
        identifier: 'test-pr-agg-error',
        source: 'https://dev.azure.com/TestOrg/TestProject/_git/testrepo/pullrequest/agg-error'
      }

      const mockAggregator = {
        aggregateResults: jest.fn().mockRejectedValue(new Error('Aggregation failed')),
        validateShardResult: jest.fn(),
        getStatistics: jest.fn()
      }

      ;(processor as any).resultAggregator = mockAggregator

      await expect(processor.process(input, mockConfig)).rejects.toThrow('Aggregation failed')
    })
  })
})