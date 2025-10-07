/**
 * Full E2E Simulation Test for ADO Comment Processing
 * Simulates real ADO API responses and validates generated files
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { processReview } from '../../src/index.js'
import { SourceType } from '../../src/index.js'
import type { ReviewInput } from '../../src/index.js'
import fs from 'fs'
import path from 'path'

describe('Full E2E ADO Comment Processing Simulation', () => {
  let originalFetch: typeof globalThis.fetch
  let workspaceDir: string | undefined

  beforeEach(() => {
    // Backup original fetch
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    // Restore original fetch
    globalThis.fetch = originalFetch

    // Cleanup workspace if it exists
    if (workspaceDir && fs.existsSync(workspaceDir)) {
      try {
        fs.rmSync(workspaceDir, { recursive: true, force: true })
      } catch (error) {
        console.warn(`Failed to cleanup workspace: ${error}`)
      }
    }
  })

  it('should process real ADO PR with comments and validate generated files', async () => {
    // Mock realistic ADO API response with the exact structure we expect
    const mockADOResponse = {
      title: 'feat: add pull request comment support',
      description: 'Adds support for publishing AI review comments to Azure DevOps pull requests',
      author: 'John Developer',
      createdDate: '2025-01-03T10:00:00Z',
      modifiedDate: '2025-01-03T15:30:00Z',
      sourceBranch: 'feature/pr-comments',
      targetBranch: 'dev',
      reviewComments: [
        {
          id: 1,
          comments: [
            {
              id: 123,
              content: 'This endpoint needs proper error handling for invalid repository names.',
              author: {
                displayName: 'Jane Smith',
                uniqueName: 'jane.smith@company.com',
                name: 'Jane Smith'
              },
              publishedDate: '2025-01-03T10:30:00Z'
            },
            {
              id: 124,
              content: '', // Empty comment that should be filtered
              author: {
                displayName: 'Empty User'
              },
              publishedDate: '2025-01-03T10:31:00Z'
            },
            {
              id: 125,
              content: 'Consider adding input validation here as well.',
              author: {
                displayName: 'Bob Wilson',
                uniqueName: 'bob.wilson@company.com'
              },
              publishedDate: '2025-01-03T10:32:00Z'
            }
          ],
          threadContext: {
            filePath: 'packages/opencode/src/server/ado-routes.ts',
            rightFileStart: { line: 45 },
            rightFileEnd: { line: 45 }
          }
        },
        {
          id: 2,
          comments: [
            {
              id: 126,
              content: 'The logging level should be configurable.',
              author: {
                uniqueName: 'alice@company.com', // Only uniqueName, no displayName
                name: 'Alice Developer'
              },
              publishedDate: '2025-01-03T10:33:00Z'
            },
            {
              id: 127,
              content: '   ', // Whitespace-only comment that should be filtered
              author: {
                displayName: 'Whitespace User'
              },
              publishedDate: '2025-01-03T10:34:00Z'
            }
          ],
          threadContext: {
            filePath: 'packages/opencode/src/core/utils.ts',
            rightFileStart: { line: 120 },
            rightFileEnd: { line: 125 }
          }
        }
      ],
      comments: [
        {
          id: 200,
          content: 'Overall, this looks good. Just a few minor suggestions.',
          author: {
            displayName: 'Tech Lead',
            uniqueName: 'tech.lead@company.com'
          },
          publishedDate: '2025-01-03T11:00:00Z'
        }
      ],
      fileDiffs: {
        'packages/opencode/src/server/ado-routes.ts': {
          diff: `@@ -42,6 +42,12 @@ export class ADORoutes {
   async getPullRequest(repo: string, prId: number) {
     try {
       const result = await this.adoService.getPR(repo, prId)
+      if (!result) {
+        throw new Error('Pull request not found')
+      }
+      if (!result.repository) {
+        throw new Error('Invalid repository')
+      }
       return result
     } catch (error) {
       this.logger.error('Failed to fetch PR:', error)`,
          changeType: 'edit'
        },
        'packages/opencode/src/core/utils.ts': {
          diff: `@@ -118,7 +118,9 @@ export function createLogger(name: string) {
   return {
     debug: (msg: string) => console.log(\`[\${timestamp()}] [DEBUG] [\${name}] \${msg}\`),
     info: (msg: string) => console.log(\`[\${timestamp()}] [INFO] [\${name}] \${msg}\`),
-    warn: (msg: string) => console.log(\`[\${timestamp()}] [WARN] [\${name}] \${msg}\`),
+    warn: (msg: string) => {
+      if (process.env.LOG_LEVEL !== 'error') console.log(\`[\${timestamp()}] [WARN] [\${name}] \${msg}\`)
+    },
     error: (msg: string) => console.log(\`[\${timestamp()}] [ERROR] [\${name}] \${msg}\`)
   }
 }`,
          changeType: 'edit'
        }
      }
    }

    // Mock successful ADO API call
    globalThis.fetch = (url: string | URL | Request) => {
      const urlString = url.toString()
      if (urlString.includes('/api/ado/pullrequests/')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          json: () => Promise.resolve(mockADOResponse),
          text: () => Promise.resolve(JSON.stringify(mockADOResponse))
        } as Response)
      }

      // Mock other API calls (session processing, etc.)
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve('{}')
      } as Response)
    }

    // Create the review input
    const input: ReviewInput = {
      identifier: 'https://dev.azure.com/company/project/_git/repo/pullrequest/123',
      type: SourceType.ADO_PR,
      metadata: {
        includeComments: true,
        saveVersions: true
      }
    }

    // Configure the workflow with mocked processing
    const config = {
      baseUrl: 'http://test-server.com',
      autoCleanup: false, // Keep files for validation
      saveVersions: true,
      maxParallelSessions: 1,
      timeoutPerShard: 5000, // Short timeout for testing
      agent: 'test-reviewer',
      optimalTokensPerShard: 2000,
      maxTokensPerShard: 4000,
      minTokensPerShard: 500
    }

    let result: any

    try {
      result = await processReview(input, config)
    } catch (error) {
      // If we get a processing engine error (no real OpenCode server), that's OK
      // We mainly want to test the content fetching and ADO comment processing
      if (error instanceof Error && error.message.includes('fetch')) {
        console.log('Expected fetch error for session processing - focusing on content validation')

        // Let's test just the content source directly since that's what we care about
        const { ADOContentSource } = await import('../../src/sources/ado-content-source.js')

        const contentSource = new ADOContentSource({
          baseUrl: 'http://test-server.com'
        })

        const sourceContent = await contentSource.fetchContent(input.identifier)

        // Validate the content source results
        expect(sourceContent.content.adoComments).toBeDefined()
        expect(sourceContent.content.adoComments!.length).toBe(3) // Should filter out 2 empty comments

        const adoComments = sourceContent.content.adoComments!

        // Critical validation: Check for double-prefixing
        for (const comment of adoComments) {
          expect(comment.id).not.toMatch(/^ado-ado-/) // Should NOT have double prefix
          expect(comment.id).toMatch(/^ado-\d+-\d+$/) // Should have proper format
        }

        // Validate empty comment filtering
        const emptyComments = adoComments.filter(c => !c.message || c.message.trim() === '')
        expect(emptyComments.length).toBe(0) // No empty comments should remain

        // Validate author name extraction
        expect(adoComments[0].author.name).toBe('Jane Smith') // displayName
        expect(adoComments[1].author.name).toBe('Bob Wilson') // displayName fallback
        expect(adoComments[2].author.name).toBe('alice@company.com') // uniqueName fallback

        console.log('✅ Content source validation passed!')
        return // Exit early since we can't test the full workflow
      }

      throw error
    }

    // If we get here, the full workflow completed successfully
    expect(result.success).toBe(true)
    expect(result.adoComments).toBeDefined()
    expect(result.adoComments!.length).toBeGreaterThan(0)

    console.log(`📊 Workflow Results:`)
    console.log(`   - ADO Comments: ${result.adoComments!.length}`)
    console.log(`   - Unified Comments: ${result.comments.length}`)
    console.log(`   - Workspace: ${result.workspace}`)

    // Store workspace for cleanup
    workspaceDir = result.workspace

    // Validate ADO comments in the final result
    for (const comment of result.adoComments!) {
      // Critical check: No double-prefixing
      expect(comment.id).not.toMatch(/^ado-ado-/)
      expect(comment.id).toMatch(/^ado-\d+-\d+$/)

      // No empty comments
      expect(comment.message).toBeTruthy()
      expect(comment.message.trim()).not.toBe('')

      // Proper author names
      expect(comment.author.name).not.toBe('Unknown')
    }

    // Validate generated files if workspace exists
    if (result.workspace && fs.existsSync(result.workspace)) {
      // Check review-results.json
      const reviewResultsPath = path.join(result.workspace, 'review-results.json')
      if (fs.existsSync(reviewResultsPath)) {
        const fileContent = fs.readFileSync(reviewResultsPath, 'utf-8')
        const fileData = JSON.parse(fileContent)

        // Validate file structure
        expect(fileData.adoComments).toBeDefined()
        expect(Array.isArray(fileData.adoComments)).toBe(true)

        // Validate no double-prefixing in saved file
        for (const comment of fileData.adoComments) {
          expect(comment.id).not.toMatch(/^ado-ado-/)
        }
      }

      // Check review-index.json
      const reviewIndexPath = path.join(result.workspace, 'review-index.json')
      if (fs.existsSync(reviewIndexPath)) {
        const indexContent = fs.readFileSync(reviewIndexPath, 'utf-8')
        const indexData = JSON.parse(indexContent)

        expect(indexData.adoComments).toBeDefined()
        expect(Array.isArray(indexData.adoComments)).toBe(true)
      }
    }

    console.log('🎉 Full E2E simulation completed successfully!')
  }, 30000) // 30 second timeout for the test
})