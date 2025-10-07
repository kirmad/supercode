/**
 * Tests for ReviewResultAggregator
 * XML to JSON conversion and result aggregation
 */

import { describe, it, expect, beforeEach } from 'bun:test'
import { ReviewResultAggregator } from '../../src/review/review-result-aggregator.js'
import type { ShardResult, SourceMetadata, AggregationConfig } from '../../src/index.js'

describe('ReviewResultAggregator', () => {
  let aggregator: ReviewResultAggregator
  let mockConfig: AggregationConfig
  let mockMetadata: SourceMetadata

  beforeEach(() => {
    aggregator = new ReviewResultAggregator()
    mockConfig = {
      outputFormat: 'json',
      includeMetadata: true,
      includeStatistics: true,
      sortResults: true
    }
    mockMetadata = {
      type: 'ado-pr',
      identifier: 'test-pr-123',
      source: 'test-source',
      generatedAt: new Date().toISOString(),
      fetchOptions: {}
    }
  })

  describe('aggregateResults', () => {
    it('should aggregate successful XML results', async () => {
      const xmlContent = `
        <review-insight type="security" severity="high">
          This endpoint lacks proper authentication validation
        </review-insight>
        <hunk file="auth.ts" start="10" end="20">
          <category>security-fix</category>
          <risk>high</risk>
          <description>Authentication vulnerability</description>
          <needs-attention>yes</needs-attention>
        </hunk>
        <comment>
          <file>auth.ts</file>
          <lines start="15" end="15"/>
          <type>issue</type>
          <severity>high</severity>
          <message>Missing input validation</message>
          <fix-code>
            if (!token || typeof token !== 'string') {
              throw new Error('Invalid token')
            }
          </fix-code>
        </comment>
      `

      const results: ShardResult[] = [
        {
          shardIndex: 0,
          success: true,
          result: xmlContent,
          processingTime: 1000,
          timestamp: new Date().toISOString()
        }
      ]

      const reviewResult = await aggregator.aggregateResults(results, mockMetadata, mockConfig)

      expect(reviewResult.success).toBe(true)
      expect(reviewResult.insights).toHaveLength(1)
      expect(reviewResult.insights[0]).toMatchObject({
        shard: 0,
        type: 'security',
        severity: 'high',
        content: 'This endpoint lacks proper authentication validation'
      })

      expect(reviewResult.hunks).toHaveLength(1)
      expect(reviewResult.hunks[0]).toMatchObject({
        shard: 0,
        file: 'auth.ts',
        startLine: 10,
        endLine: 20,
        category: 'security-fix',
        risk: 'high',
        description: 'Authentication vulnerability',
        needsAttention: true
      })

      expect(reviewResult.comments).toHaveLength(1)
      expect(reviewResult.comments[0]).toMatchObject({
        shard: 0,
        file: 'auth.ts',
        startLine: 15,
        endLine: 15,
        type: 'issue',
        severity: 'high',
        message: 'Missing input validation'
      })
    })

    it('should aggregate multiple shards with different content types', async () => {
      const xmlContent1 = `
        <review-insight type="performance" severity="medium">
          Consider optimizing this loop
        </review-insight>
      `

      const xmlContent2 = `
        <hunk file="performance.ts" start="5" end="15">
          <category>performance-improvement</category>
          <risk>medium</risk>
          <description>Loop optimization needed</description>
          <needs-attention>no</needs-attention>
        </hunk>
      `

      const results: ShardResult[] = [
        {
          shardIndex: 0,
          success: true,
          result: xmlContent1,
          processingTime: 800,
          timestamp: new Date().toISOString()
        },
        {
          shardIndex: 1,
          success: true,
          result: xmlContent2,
          processingTime: 1200,
          timestamp: new Date().toISOString()
        }
      ]

      const reviewResult = await aggregator.aggregateResults(results, mockMetadata, mockConfig)

      expect(reviewResult.insights).toHaveLength(1)
      expect(reviewResult.insights[0].shard).toBe(0)
      expect(reviewResult.insights[0].type).toBe('performance')

      expect(reviewResult.hunks).toHaveLength(1)
      expect(reviewResult.hunks[0].shard).toBe(1)
      expect(reviewResult.hunks[0].file).toBe('performance.ts')
    })

    it('should handle mixed success and failure results', async () => {
      const xmlContent = `
        <review-insight type="quality" severity="low">
          Code quality could be improved
        </review-insight>
      `

      const results: ShardResult[] = [
        {
          shardIndex: 0,
          success: true,
          result: xmlContent,
          processingTime: 1000,
          timestamp: new Date().toISOString()
        },
        {
          shardIndex: 1,
          success: false,
          error: 'Processing failed',
          processingTime: 500,
          timestamp: new Date().toISOString()
        }
      ]

      const reviewResult = await aggregator.aggregateResults(results, mockMetadata, mockConfig)

      expect(reviewResult.success).toBe(true)
      expect(reviewResult.insights).toHaveLength(1)
      expect(reviewResult.insights[0].type).toBe('quality')
      expect(reviewResult.statistics.totalShards).toBe(2)
      expect(reviewResult.statistics.successfulShards).toBe(1)
      expect(reviewResult.statistics.failedShards).toBe(1)
    })

    it('should throw error when no successful results', async () => {
      const results: ShardResult[] = [
        {
          shardIndex: 0,
          success: false,
          error: 'Failed',
          processingTime: 500,
          timestamp: new Date().toISOString()
        }
      ]

      await expect(
        aggregator.aggregateResults(results, mockMetadata, mockConfig)
      ).rejects.toThrow('No successful shard results to aggregate')
    })

    it('should sort results when configured', async () => {
      const xmlContent = `
        <review-insight type="quality" severity="low">Low priority insight</review-insight>
        <review-insight type="security" severity="critical">Critical security issue</review-insight>
        <review-insight type="performance" severity="high">High priority performance</review-insight>
        <hunk file="z-file.ts" start="30" end="40">
          <category>bug-fix</category>
          <risk>low</risk>
          <description>Bug fix in z-file</description>
          <needs-attention>no</needs-attention>
        </hunk>
        <hunk file="a-file.ts" start="10" end="20">
          <category>feature-addition</category>
          <risk>medium</risk>
          <description>Feature in a-file</description>
          <needs-attention>yes</needs-attention>
        </hunk>
      `

      const results: ShardResult[] = [
        {
          shardIndex: 0,
          success: true,
          result: xmlContent,
          processingTime: 1000,
          timestamp: new Date().toISOString()
        }
      ]

      const reviewResult = await aggregator.aggregateResults(results, mockMetadata, mockConfig)

      // Check that insights are sorted by severity (critical, high, low)
      expect(reviewResult.insights[0].severity).toBe('critical')
      expect(reviewResult.insights[1].severity).toBe('high')
      expect(reviewResult.insights[2].severity).toBe('low')

      // Check that hunks are sorted by file name (a-file.ts before z-file.ts)
      expect(reviewResult.hunks[0].file).toBe('a-file.ts')
      expect(reviewResult.hunks[1].file).toBe('z-file.ts')
    })

    it('should skip sorting when disabled', async () => {
      const noSortConfig = { ...mockConfig, sortResults: false }
      const xmlContent = `
        <review-insight type="quality" severity="low">Low first</review-insight>
        <review-insight type="security" severity="critical">Critical second</review-insight>
      `

      const results: ShardResult[] = [
        {
          shardIndex: 0,
          success: true,
          result: xmlContent,
          processingTime: 1000,
          timestamp: new Date().toISOString()
        }
      ]

      const reviewResult = await aggregator.aggregateResults(results, mockMetadata, noSortConfig)

      // Should maintain original order (low before critical)
      expect(reviewResult.insights[0].severity).toBe('low')
      expect(reviewResult.insights[1].severity).toBe('critical')
    })

    it('should handle malformed XML gracefully', async () => {
      const malformedXML = `
        <review-insight type="security" severity="high">
          Missing closing tag
        <comment>
          <file>test.ts</file>
          <message>Incomplete comment</message>
        </comment>
      `

      const results: ShardResult[] = [
        {
          shardIndex: 0,
          success: true,
          result: malformedXML,
          processingTime: 1000,
          timestamp: new Date().toISOString()
        }
      ]

      const reviewResult = await aggregator.aggregateResults(results, mockMetadata, mockConfig)

      // Should still process what it can parse
      expect(reviewResult.success).toBe(true)
      expect(reviewResult.insights).toHaveLength(0) // Malformed insight skipped
      expect(reviewResult.comments).toHaveLength(0) // Incomplete comment skipped
    })

    it('should include processing statistics', async () => {
      const xmlContent = `<review-insight type="quality" severity="medium">Test insight</review-insight>`

      const results: ShardResult[] = [
        {
          shardIndex: 0,
          success: true,
          result: xmlContent,
          processingTime: 1000,
          timestamp: new Date().toISOString()
        },
        {
          shardIndex: 1,
          success: false,
          error: 'Failed',
          processingTime: 500,
          timestamp: new Date().toISOString()
        }
      ]

      const reviewResult = await aggregator.aggregateResults(results, mockMetadata, mockConfig)

      expect(reviewResult.statistics).toMatchObject({
        totalShards: 2,
        successfulShards: 1,
        failedShards: 1,
        totalProcessingTime: 1500,
        averageShardTime: 1000,
        parallelProcessing: true
      })
    })
  })

  describe('validateShardResult', () => {
    it('should validate successful string results', () => {
      const result: ShardResult = {
        shardIndex: 0,
        success: true,
        result: 'valid xml content',
        processingTime: 1000,
        timestamp: new Date().toISOString()
      }

      expect(aggregator.validateShardResult(result)).toBe(true)
    })

    it('should validate failed results', () => {
      const result: ShardResult = {
        shardIndex: 0,
        success: false,
        error: 'Processing failed',
        processingTime: 500,
        timestamp: new Date().toISOString()
      }

      expect(aggregator.validateShardResult(result)).toBe(true)
    })

    it('should reject successful results with empty content', () => {
      const result: ShardResult = {
        shardIndex: 0,
        success: true,
        result: '',
        processingTime: 1000,
        timestamp: new Date().toISOString()
      }

      expect(aggregator.validateShardResult(result)).toBe(false)
    })

    it('should reject successful results with non-string content', () => {
      const result: ShardResult = {
        shardIndex: 0,
        success: true,
        result: { invalid: 'object' } as any,
        processingTime: 1000,
        timestamp: new Date().toISOString()
      }

      expect(aggregator.validateShardResult(result)).toBe(false)
    })
  })

  describe('processADOComments', () => {
    it('should not double-prefix IDs for comments with existing ado- prefix', async () => {
      // Create mock ADO comments with existing ado- prefixed IDs (from ADOContentSource)
      const adoComments = [
        {
          id: 'ado-1-1759531466290',
          threadId: '1',
          message: 'This is a test comment',
          author: { type: 'user', name: 'Test User' },
          createdAt: '2025-01-03T10:30:00Z',
          isPublishedToADO: true
        },
        {
          id: 'ado-2-1759531466291',
          threadId: '2',
          message: 'Another comment',
          author: { type: 'user', name: 'Another User' },
          createdAt: '2025-01-03T10:31:00Z',
          isPublishedToADO: true
        }
      ]

      // Mock results to test the aggregation with ADO comments
      const results: ShardResult[] = [
        {
          shardIndex: 0,
          success: true,
          result: '<review-insight type="quality" severity="low">Test insight</review-insight>',
          processingTime: 1000,
          timestamp: new Date().toISOString()
        }
      ]

      const reviewResult = await aggregator.aggregateResults(results, mockMetadata, mockConfig, adoComments)

      // Verify that the IDs are not double-prefixed
      expect(reviewResult.adoComments).toHaveLength(2)
      expect(reviewResult.adoComments![0].id).toBe('ado-1-1759531466290') // Should NOT be 'ado-ado-1-1759531466290-1759531466290'
      expect(reviewResult.adoComments![1].id).toBe('ado-2-1759531466291') // Should NOT be 'ado-ado-2-1759531466291-1759531466291'
    })

    it('should generate stable IDs for comments without ado- prefix', async () => {
      // Create mock ADO comments without ado- prefix (raw from API)
      const adoComments = [
        {
          id: '123',
          threadId: '1',
          message: 'Raw comment from API',
          author: { type: 'user', name: 'API User' },
          createdAt: '2025-01-03T10:30:00Z'
        }
      ]

      const results: ShardResult[] = [
        {
          shardIndex: 0,
          success: true,
          result: '<review-insight type="quality" severity="low">Test insight</review-insight>',
          processingTime: 1000,
          timestamp: new Date().toISOString()
        }
      ]

      const reviewResult = await aggregator.aggregateResults(results, mockMetadata, mockConfig, adoComments)

      // Should generate proper ado- prefixed ID
      expect(reviewResult.adoComments).toHaveLength(1)
      expect(reviewResult.adoComments![0].id).toMatch(/^ado-123-\d+$/) // ado-{id}-{timestamp} pattern
    })

    it('should filter out empty content comments when passed from ADOContentSource', async () => {
      // Simulate empty comments that should have been filtered by ADOContentSource
      // but test the aggregator's resilience
      const adoComments = [
        {
          id: 'ado-1-1759531466290',
          threadId: '1',
          message: 'Valid comment with content',
          author: { type: 'user', name: 'Test User' },
          createdAt: '2025-01-03T10:30:00Z'
        },
        {
          id: 'ado-2-1759531466291',
          threadId: '2',
          message: '', // Empty message
          author: { type: 'user', name: 'Empty User' },
          createdAt: '2025-01-03T10:31:00Z'
        }
      ]

      const results: ShardResult[] = [
        {
          shardIndex: 0,
          success: true,
          result: '<review-insight type="quality" severity="low">Test insight</review-insight>',
          processingTime: 1000,
          timestamp: new Date().toISOString()
        }
      ]

      const reviewResult = await aggregator.aggregateResults(results, mockMetadata, mockConfig, adoComments)

      // Should process both comments (aggregator doesn't filter, that's ADOContentSource's job)
      expect(reviewResult.adoComments).toHaveLength(2)
      expect(reviewResult.adoComments![0].message).toBe('Valid comment with content')
      expect(reviewResult.adoComments![1].message).toBe('')
    })
  })

  describe('getStatistics', () => {
    it('should return statistics for empty results', () => {
      const stats = aggregator.getStatistics([])

      expect(stats.totalResults).toBe(0)
      expect(stats.successfulResults).toBe(0)
      expect(stats.failedResults).toBe(0)
      expect(stats.averageProcessingTime).toBe(0)
      expect(stats.aggregationTime).toBe(0)
    })

    it('should calculate statistics for mixed results', () => {
      const results: ShardResult[] = [
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

      const stats = aggregator.getStatistics(results)

      expect(stats.totalResults).toBe(3)
      expect(stats.successfulResults).toBe(2)
      expect(stats.failedResults).toBe(1)
      expect(stats.averageProcessingTime).toBe(Math.round((1000 + 500 + 1500) / 3))
    })
  })
})