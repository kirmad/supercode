/**
 * Integration test for ADO comment processing
 * Tests the complete flow from ADOContentSource through ReviewResultAggregator
 */

import { describe, it, expect } from 'bun:test'
import { ADOContentSource } from '../../src/sources/ado-content-source.js'
import { ReviewResultAggregator } from '../../src/review/review-result-aggregator.js'
import type { SourceMetadata, AggregationConfig, ShardResult } from '../../src/index.js'

describe('ADO Comment Processing Integration', () => {
  it('should process ADO comments without double-prefixing IDs', async () => {
    // Mock ADO API response that simulates real ADO data
    const mockADOResponse = {
      title: 'Test PR',
      description: 'Test PR description',
      author: 'Test Author',
      createdDate: '2025-01-03T10:00:00Z',
      sourceBranch: 'feature/test',
      targetBranch: 'main',
      reviewComments: [
        {
          id: 1,
          comments: [
            {
              id: 123,
              content: 'This is a test comment with content',
              author: {
                displayName: 'John Doe',
                uniqueName: 'john.doe@company.com'
              },
              publishedDate: '2025-01-03T10:30:00Z'
            },
            {
              id: 124,
              content: '', // Empty comment that should be filtered
              author: {
                displayName: 'Jane Smith'
              },
              publishedDate: '2025-01-03T10:31:00Z'
            },
            {
              id: 125,
              content: 'Another valid comment',
              author: {
                displayName: 'Bob Wilson'
              },
              publishedDate: '2025-01-03T10:32:00Z'
            }
          ],
          threadContext: {
            filePath: 'src/test.ts',
            rightFileStart: { line: 10 },
            rightFileEnd: { line: 10 }
          }
        },
        {
          id: 2,
          comments: [
            {
              id: 126,
              content: 'Comment in another thread',
              author: {
                uniqueName: 'alice@company.com' // Only uniqueName, no displayName
              },
              publishedDate: '2025-01-03T10:33:00Z'
            }
          ],
          threadContext: {
            filePath: 'src/another.ts',
            rightFileStart: { line: 25 },
            rightFileEnd: { line: 25 }
          }
        }
      ],
      fileDiffs: {
        'src/test.ts': {
          diff: '@@ -1,3 +1,3 @@\n function test() {\n-  return "old";\n+  return "new";\n }',
          changeType: 'edit'
        }
      }
    }

    // Mock fetch to return our test data
    const originalFetch = global.fetch
    global.fetch = () =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockADOResponse)
      } as Response)

    try {
      // Step 1: Create ADOContentSource and process the mock data
      const contentSource = new ADOContentSource({
        baseUrl: 'http://test-api.com'
      })

      const sourceContent = await contentSource.fetchContent(
        'https://dev.azure.com/testorg/testproject/_git/testrepo/pullrequest/123'
      )

      // Verify ADOContentSource filtered empty comments and generated proper IDs
      expect(sourceContent.content.adoComments).toBeDefined()
      expect(sourceContent.content.adoComments!.length).toBe(3) // Should filter out empty comment

      const adoComments = sourceContent.content.adoComments!

      // Check that ADOContentSource generated proper stable IDs
      expect(adoComments[0].id).toMatch(/^ado-123-\d+$/) // John Doe's comment
      expect(adoComments[1].id).toMatch(/^ado-125-\d+$/) // Bob Wilson's comment
      expect(adoComments[2].id).toMatch(/^ado-126-\d+$/) // Alice's comment

      // Check that empty comment was filtered out
      const emptyComment = adoComments.find(c => c.message === '')
      expect(emptyComment).toBeUndefined()

      // Check author names are properly extracted
      expect(adoComments[0].author.name).toBe('John Doe')
      expect(adoComments[1].author.name).toBe('Bob Wilson')
      expect(adoComments[2].author.name).toBe('alice@company.com') // Falls back to uniqueName

      // Step 2: Pass through ReviewResultAggregator (simulating full workflow)
      const aggregator = new ReviewResultAggregator()

      const mockResults: ShardResult[] = [
        {
          shardIndex: 0,
          success: true,
          result: '<review-insight type="quality" severity="medium">Test insight</review-insight>',
          processingTime: 1000,
          timestamp: new Date().toISOString()
        }
      ]

      const mockMetadata: SourceMetadata = {
        type: 'ado-pr',
        identifier: 'test-pr-123',
        source: 'test-source',
        generatedAt: new Date().toISOString(),
        fetchOptions: {}
      }

      const mockConfig: AggregationConfig = {
        outputFormat: 'json',
        includeMetadata: true,
        includeStatistics: true,
        sortResults: true
      }

      // This is the key test: pass ADO comments with existing stable IDs to aggregator
      const result = await aggregator.aggregateResults(
        mockResults,
        mockMetadata,
        mockConfig,
        adoComments // Comments already processed by ADOContentSource
      )

      // Step 3: Verify that aggregator preserved the stable IDs (no double-prefixing)
      expect(result.adoComments).toBeDefined()
      expect(result.adoComments!.length).toBe(3)

      // The key assertion: IDs should be unchanged (no double prefixing)
      expect(result.adoComments![0].id).toBe(adoComments[0].id) // Should NOT be ado-ado-123-...
      expect(result.adoComments![1].id).toBe(adoComments[1].id) // Should NOT be ado-ado-125-...
      expect(result.adoComments![2].id).toBe(adoComments[2].id) // Should NOT be ado-ado-126-...

      // Verify no double prefixing occurred
      for (const comment of result.adoComments!) {
        expect(comment.id).not.toMatch(/^ado-ado-/) // Should NOT start with ado-ado-
        expect(comment.id).toMatch(/^ado-\d+-\d+$/) // Should match ado-{id}-{timestamp}
      }

      // Verify threading structure is preserved
      expect(result.comments.length).toBeGreaterThan(0) // Should have unified comments

    } finally {
      // Restore original fetch
      global.fetch = originalFetch
    }
  })

  it('should handle mixed comment scenarios', async () => {
    // Test with a mix of processed and unprocessed comments
    const aggregator = new ReviewResultAggregator()

    const mixedComments = [
      {
        // Already processed by ADOContentSource (has stable ID)
        id: 'ado-100-1735900000000',
        threadId: '1',
        message: 'Processed comment',
        author: { type: 'user', name: 'Processed User' },
        createdAt: '2025-01-03T10:30:00Z'
      },
      {
        // Raw comment (needs processing)
        id: '200',
        threadId: '2',
        message: 'Raw comment',
        author: { type: 'user', name: 'Raw User' },
        createdAt: '2025-01-03T10:31:00Z'
      }
    ]

    const mockResults: ShardResult[] = [
      {
        shardIndex: 0,
        success: true,
        result: '<review-insight type="quality" severity="low">Test</review-insight>',
        processingTime: 1000,
        timestamp: new Date().toISOString()
      }
    ]

    const mockMetadata: SourceMetadata = {
      type: 'ado-pr',
      identifier: 'test-pr-mixed',
      source: 'test-source',
      generatedAt: new Date().toISOString(),
      fetchOptions: {}
    }

    const mockConfig: AggregationConfig = {
      outputFormat: 'json',
      includeMetadata: true,
      includeStatistics: true,
      sortResults: true
    }

    const result = await aggregator.aggregateResults(
      mockResults,
      mockMetadata,
      mockConfig,
      mixedComments
    )

    expect(result.adoComments!.length).toBe(2)

    // First comment should keep its stable ID
    expect(result.adoComments![0].id).toBe('ado-100-1735900000000')

    // Second comment should get a new stable ID (not double-prefixed)
    expect(result.adoComments![1].id).toMatch(/^ado-200-\d+$/)
    expect(result.adoComments![1].id).not.toMatch(/^ado-ado-/)
  })
})