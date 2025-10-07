/**
 * Tests for ADOContentSource
 * ADO API integration and content fetching
 */

import { describe, it, expect, beforeEach, jest } from 'bun:test'
import { ADOContentSource } from '../../src/sources/ado-content-source.js'
import type { ReviewInput, ADOCredentials } from '../../src/index.js'

// Mock fetch globally for testing
global.fetch = jest.fn()

describe('ADOContentSource', () => {
  let contentSource: ADOContentSource
  let mockCredentials: ADOCredentials

  beforeEach(() => {
    mockCredentials = {
      pat: 'test-pat-token',
      organization: 'TestOrg'
    }

    contentSource = new ADOContentSource(mockCredentials)

    // Clear all mocks
    jest.clearAllMocks()
  })

  describe('validateInput', () => {
    it('should validate correct ADO PR input', () => {
      const input: ReviewInput = {
        type: 'ado-pr',
        identifier: 'test-pr-123',
        source: 'https://dev.azure.com/TestOrg/TestProject/_git/testrepo/pullrequest/123'
      }

      expect(contentSource.validateInput(input)).toBe(true)
    })

    it('should reject non-ADO input types', () => {
      const input: ReviewInput = {
        type: 'github-pr',
        identifier: 'test-pr',
        source: 'https://github.com/user/repo/pull/123'
      }

      expect(contentSource.validateInput(input)).toBe(false)
    })

    it('should reject invalid ADO URLs', () => {
      const input: ReviewInput = {
        type: 'ado-pr',
        identifier: 'test-pr',
        source: 'https://github.com/user/repo/pull/123'
      }

      expect(contentSource.validateInput(input)).toBe(false)
    })

    it('should reject empty sources', () => {
      const input: ReviewInput = {
        type: 'ado-pr',
        identifier: 'test-pr',
        source: ''
      }

      expect(contentSource.validateInput(input)).toBe(false)
    })
  })

  describe('fetchContent', () => {
    const mockInput: ReviewInput = {
      type: 'ado-pr',
      identifier: 'test-pr-123',
      source: 'https://dev.azure.com/TestOrg/TestProject/_git/testrepo/pullrequest/123'
    }

    it('should fetch PR content successfully', async () => {
      const mockPRResponse = {
        pullRequestId: 123,
        title: 'Test PR',
        description: 'Test description',
        sourceRefName: 'refs/heads/feature-branch',
        targetRefName: 'refs/heads/main',
        status: 'active'
      }

      const mockIterationsResponse = {
        value: [
          {
            id: 1,
            description: 'Initial commit',
            changeList: [
              {
                item: {
                  path: '/test.ts',
                  gitObjectType: 'blob'
                },
                changeType: 'edit'
              }
            ]
          }
        ]
      }

      const mockFileContent = {
        content: 'Y29uc29sZS5sb2coInRlc3QiKQ==' // base64 encoded "console.log("test")"
      }

      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockPRResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockIterationsResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockFileContent)
        })

      const result = await contentSource.fetchContent(mockInput)

      expect(result.content.files).toHaveLength(1)
      expect(result.content.files[0]).toMatchObject({
        path: 'test.ts',
        content: 'console.log("test")',
        changeType: 'modify',
        tokens: expect.any(Number),
        size: expect.any(Number)
      })

      expect(result.metadata).toMatchObject({
        type: 'ado-pr',
        identifier: 'test-pr-123',
        source: mockInput.source
      })
    })

    it('should handle API errors gracefully', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      })

      await expect(contentSource.fetchContent(mockInput)).rejects.toThrow('ADO API request failed')
    })

    it('should handle network errors', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      await expect(contentSource.fetchContent(mockInput)).rejects.toThrow('Network error')
    })

    it('should filter files by included patterns', async () => {
      const mockPRResponse = {
        pullRequestId: 123,
        title: 'Test PR',
        status: 'active'
      }

      const mockIterationsResponse = {
        value: [
          {
            id: 1,
            changeList: [
              {
                item: {
                  path: '/src/test.ts',
                  gitObjectType: 'blob'
                },
                changeType: 'edit'
              },
              {
                item: {
                  path: '/node_modules/package.json',
                  gitObjectType: 'blob'
                },
                changeType: 'edit'
              },
              {
                item: {
                  path: '/README.md',
                  gitObjectType: 'blob'
                },
                changeType: 'edit'
              }
            ]
          }
        ]
      }

      const mockFileContent = {
        content: 'dGVzdCBjb250ZW50' // base64 encoded "test content"
      }

      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockPRResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockIterationsResponse)
        })
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockFileContent)
        })

      const inputWithPatterns = {
        ...mockInput,
        includePatterns: ['**/*.ts'],
        excludePatterns: ['**/node_modules/**']
      }

      const result = await contentSource.fetchContent(inputWithPatterns)

      // Should only include .ts files, excluding node_modules
      expect(result.content.files).toHaveLength(1)
      expect(result.content.files[0].path).toBe('src/test.ts')
    })

    it('should handle files exceeding size limit', async () => {
      const mockPRResponse = {
        pullRequestId: 123,
        title: 'Test PR',
        status: 'active'
      }

      const mockIterationsResponse = {
        value: [
          {
            id: 1,
            changeList: [
              {
                item: {
                  path: '/large-file.ts',
                  gitObjectType: 'blob'
                },
                changeType: 'edit'
              }
            ]
          }
        ]
      }

      const mockLargeFileContent = {
        content: Buffer.from('x'.repeat(2 * 1024 * 1024)).toString('base64') // 2MB content
      }

      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockPRResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockIterationsResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockLargeFileContent)
        })

      const inputWithSizeLimit = {
        ...mockInput,
        maxFileSize: 1024 * 1024 // 1MB limit
      }

      const result = await contentSource.fetchContent(inputWithSizeLimit)

      // Should skip files that exceed size limit
      expect(result.content.files).toHaveLength(0)
    })

    it('should handle various change types', async () => {
      const mockPRResponse = {
        pullRequestId: 123,
        title: 'Test PR',
        status: 'active'
      }

      const mockIterationsResponse = {
        value: [
          {
            id: 1,
            changeList: [
              {
                item: { path: '/added.ts', gitObjectType: 'blob' },
                changeType: 'add'
              },
              {
                item: { path: '/modified.ts', gitObjectType: 'blob' },
                changeType: 'edit'
              },
              {
                item: { path: '/deleted.ts', gitObjectType: 'blob' },
                changeType: 'delete'
              }
            ]
          }
        ]
      }

      const mockFileContent = {
        content: 'dGVzdA==' // base64 encoded "test"
      }

      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockPRResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockIterationsResponse)
        })
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockFileContent)
        })

      const result = await contentSource.fetchContent(mockInput)

      expect(result.content.files).toHaveLength(3)
      expect(result.content.files.find(f => f.path === 'added.ts')?.changeType).toBe('add')
      expect(result.content.files.find(f => f.path === 'modified.ts')?.changeType).toBe('modify')
      expect(result.content.files.find(f => f.path === 'deleted.ts')?.changeType).toBe('delete')
    })
  })

  describe('getStatistics', () => {
    it('should return processing statistics', async () => {
      const stats = await contentSource.getStatistics()

      expect(stats).toMatchObject({
        filesProcessed: expect.any(Number),
        totalFiles: expect.any(Number),
        bytesProcessed: expect.any(Number),
        processingTime: expect.any(Number)
      })
    })
  })

  describe('cleanup', () => {
    it('should cleanup resources', async () => {
      await expect(contentSource.cleanup()).resolves.toBeUndefined()
    })
  })

  describe('error handling', () => {
    it('should handle malformed PR URLs', async () => {
      const invalidInput: ReviewInput = {
        type: 'ado-pr',
        identifier: 'test-pr',
        source: 'https://invalid-ado-url.com/wrong/format'
      }

      await expect(contentSource.fetchContent(invalidInput)).rejects.toThrow()
    })

    it('should handle authentication failures', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      })

      await expect(contentSource.fetchContent(mockInput)).rejects.toThrow('ADO API request failed')
    })

    it('should handle rate limiting', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      })

      await expect(contentSource.fetchContent(mockInput)).rejects.toThrow('ADO API request failed')
    })
  })
})