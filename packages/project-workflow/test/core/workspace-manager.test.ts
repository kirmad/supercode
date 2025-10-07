/**
 * Tests for WorkspaceManager
 * File system operations and workspace management
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { WorkspaceManager } from '../../src/core/workspace-manager.js'
import type { SourceContent } from '../../src/index.js'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'

describe('WorkspaceManager', () => {
  let manager: WorkspaceManager
  let tempDir: string
  let testWorkspaceId: string

  beforeEach(async () => {
    manager = new WorkspaceManager()

    // Create a unique temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-manager-test-'))

    // Override the workspace directory for testing
    ;(manager as any).workspaceRoot = tempDir
  })

  afterEach(async () => {
    // Clean up all test workspaces
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('createWorkspace', () => {
    it('should create a new workspace directory', async () => {
      const workspaceId = await manager.createWorkspace()
      testWorkspaceId = workspaceId

      expect(workspaceId).toBeDefined()
      expect(typeof workspaceId).toBe('string')
      expect(workspaceId.length).toBeGreaterThan(0)

      // Check that directory was created
      const workspaceDir = path.join(tempDir, workspaceId)
      const stats = await fs.stat(workspaceDir)
      expect(stats.isDirectory()).toBe(true)
    })

    it('should create unique workspace IDs', async () => {
      const workspace1 = await manager.createWorkspace()
      const workspace2 = await manager.createWorkspace()

      expect(workspace1).not.toBe(workspace2)

      // Clean up
      await manager.cleanup(workspace1)
      await manager.cleanup(workspace2)
    })

    it('should create nested directory structure', async () => {
      const workspaceId = await manager.createWorkspace()
      testWorkspaceId = workspaceId

      const workspaceDir = path.join(tempDir, workspaceId)
      const sourceDir = path.join(workspaceDir, 'source')
      const shardsDir = path.join(workspaceDir, 'shards')

      const sourceStat = await fs.stat(sourceDir)
      const shardsStat = await fs.stat(shardsDir)

      expect(sourceStat.isDirectory()).toBe(true)
      expect(shardsStat.isDirectory()).toBe(true)
    })
  })

  describe('saveContent', () => {
    beforeEach(async () => {
      testWorkspaceId = await manager.createWorkspace()
    })

    it('should save source content to workspace', async () => {
      const sourceContent: SourceContent = {
        content: {
          files: [
            {
              path: 'test.ts',
              content: 'console.log("test")',
              tokens: 100,
              size: 20,
              changeType: 'modify'
            },
            {
              path: 'nested/file.js',
              content: 'alert("hello")',
              tokens: 80,
              size: 15,
              changeType: 'add'
            }
          ],
          totalTokens: 180
        },
        metadata: {
          type: 'ado-pr',
          identifier: 'test-pr',
          source: 'test-source',
          generatedAt: new Date().toISOString(),
          fetchOptions: {}
        }
      }

      await manager.saveContent(testWorkspaceId, sourceContent)

      // Check that files were saved
      const testFilePath = path.join(tempDir, testWorkspaceId, 'source', 'test.ts')
      const nestedFilePath = path.join(tempDir, testWorkspaceId, 'source', 'nested', 'file.js')

      const testContent = await fs.readFile(testFilePath, 'utf8')
      const nestedContent = await fs.readFile(nestedFilePath, 'utf8')

      expect(testContent).toBe('console.log("test")')
      expect(nestedContent).toBe('alert("hello")')

      // Check metadata file
      const metadataPath = path.join(tempDir, testWorkspaceId, 'metadata.json')
      const metadataContent = await fs.readFile(metadataPath, 'utf8')
      const metadata = JSON.parse(metadataContent)

      expect(metadata.type).toBe('ado-pr')
      expect(metadata.identifier).toBe('test-pr')
    })

    it('should handle empty file list', async () => {
      const sourceContent: SourceContent = {
        content: {
          files: [],
          totalTokens: 0
        },
        metadata: {
          type: 'local',
          identifier: 'empty-test',
          source: 'empty-source',
          generatedAt: new Date().toISOString(),
          fetchOptions: {}
        }
      }

      await expect(manager.saveContent(testWorkspaceId, sourceContent)).resolves.toBeUndefined()
    })

    it('should throw error for invalid workspace ID', async () => {
      const sourceContent: SourceContent = {
        content: { files: [], totalTokens: 0 },
        metadata: {
          type: 'local',
          identifier: 'test',
          source: 'test',
          generatedAt: new Date().toISOString(),
          fetchOptions: {}
        }
      }

      await expect(
        manager.saveContent('non-existent-workspace', sourceContent)
      ).rejects.toThrow()
    })

    it('should create nested directories as needed', async () => {
      const sourceContent: SourceContent = {
        content: {
          files: [
            {
              path: 'deeply/nested/path/file.ts',
              content: 'test content',
              tokens: 50,
              size: 12,
              changeType: 'add'
            }
          ],
          totalTokens: 50
        },
        metadata: {
          type: 'local',
          identifier: 'nested-test',
          source: 'test',
          generatedAt: new Date().toISOString(),
          fetchOptions: {}
        }
      }

      await manager.saveContent(testWorkspaceId, sourceContent)

      const filePath = path.join(tempDir, testWorkspaceId, 'source', 'deeply', 'nested', 'path', 'file.ts')
      const content = await fs.readFile(filePath, 'utf8')
      expect(content).toBe('test content')
    })
  })

  describe('loadContent', () => {
    beforeEach(async () => {
      testWorkspaceId = await manager.createWorkspace()
    })

    it('should load saved content from workspace', async () => {
      // First save some content
      const originalContent: SourceContent = {
        content: {
          files: [
            {
              path: 'test.ts',
              content: 'const x = 1',
              tokens: 60,
              size: 11,
              changeType: 'modify'
            }
          ],
          totalTokens: 60
        },
        metadata: {
          type: 'ado-pr',
          identifier: 'load-test',
          source: 'test-source',
          generatedAt: new Date().toISOString(),
          fetchOptions: {}
        }
      }

      await manager.saveContent(testWorkspaceId, originalContent)

      // Then load it back
      const loadedContent = await manager.loadContent(testWorkspaceId)

      expect(loadedContent.content.files).toHaveLength(1)
      expect(loadedContent.content.files[0]).toMatchObject({
        path: 'test.ts',
        content: 'const x = 1',
        tokens: expect.any(Number),
        size: expect.any(Number),
        changeType: 'modify'
      })

      expect(loadedContent.metadata).toMatchObject({
        type: 'ado-pr',
        identifier: 'load-test'
      })
    })

    it('should handle empty workspace', async () => {
      const content = await manager.loadContent(testWorkspaceId)

      expect(content.content.files).toHaveLength(0)
      expect(content.content.totalTokens).toBe(0)
      expect(content.metadata).toBeDefined()
    })

    it('should throw error for non-existent workspace', async () => {
      await expect(
        manager.loadContent('non-existent-workspace')
      ).rejects.toThrow()
    })

    it('should recalculate file statistics on load', async () => {
      // Save content with specific metrics
      const originalContent: SourceContent = {
        content: {
          files: [
            {
              path: 'test.ts',
              content: 'console.log("hello world")',
              tokens: 100, // Original value
              size: 50,   // Original value
              changeType: 'modify'
            }
          ],
          totalTokens: 100
        },
        metadata: {
          type: 'local',
          identifier: 'recalc-test',
          source: 'test',
          generatedAt: new Date().toISOString(),
          fetchOptions: {}
        }
      }

      await manager.saveContent(testWorkspaceId, originalContent)

      // Load and check that tokens/size are recalculated
      const loadedContent = await manager.loadContent(testWorkspaceId)

      expect(loadedContent.content.files[0].tokens).toBeGreaterThan(0)
      expect(loadedContent.content.files[0].size).toBe(26) // Actual length of the content
      expect(loadedContent.content.totalTokens).toBeGreaterThan(0)
    })
  })

  describe('getStatistics', () => {
    beforeEach(async () => {
      testWorkspaceId = await manager.createWorkspace()
    })

    it('should return workspace statistics', async () => {
      const sourceContent: SourceContent = {
        content: {
          files: [
            {
              path: 'file1.ts',
              content: 'test content 1',
              tokens: 50,
              size: 14,
              changeType: 'add'
            },
            {
              path: 'file2.js',
              content: 'test content 2',
              tokens: 60,
              size: 14,
              changeType: 'modify'
            }
          ],
          totalTokens: 110
        },
        metadata: {
          type: 'local',
          identifier: 'stats-test',
          source: 'test',
          generatedAt: new Date().toISOString(),
          fetchOptions: {}
        }
      }

      await manager.saveContent(testWorkspaceId, sourceContent)

      const stats = await manager.getStatistics(testWorkspaceId)

      expect(stats.workspaceId).toBe(testWorkspaceId)
      expect(stats.filesStored).toBe(2)
      expect(typeof stats.totalSize).toBe('number')
      expect(stats.totalSize).toBeGreaterThan(0)
      expect(new Date(stats.createdAt)).toBeInstanceOf(Date)
    })

    it('should return stats for empty workspace', async () => {
      const stats = await manager.getStatistics(testWorkspaceId)

      expect(stats).toMatchObject({
        workspaceId: testWorkspaceId,
        filesStored: 0,
        totalSize: 0,
        createdAt: expect.any(String)
      })
    })

    it('should throw error for non-existent workspace', async () => {
      await expect(
        manager.getStatistics('non-existent-workspace')
      ).rejects.toThrow()
    })
  })

  describe('cleanup', () => {
    it('should remove workspace directory', async () => {
      const workspaceId = await manager.createWorkspace()
      const workspaceDir = path.join(tempDir, workspaceId)

      // Verify workspace exists
      const statsBefore = await fs.stat(workspaceDir)
      expect(statsBefore.isDirectory()).toBe(true)

      // Clean up
      await manager.cleanup(workspaceId)

      // Verify workspace is removed
      await expect(fs.stat(workspaceDir)).rejects.toThrow()
    })

    it('should handle non-existent workspace gracefully', async () => {
      await expect(manager.cleanup('non-existent-workspace')).resolves.toBeUndefined()
    })

    it('should remove workspace with content', async () => {
      const workspaceId = await manager.createWorkspace()

      const sourceContent: SourceContent = {
        content: {
          files: [
            {
              path: 'test.ts',
              content: 'test content',
              tokens: 50,
              size: 12,
              changeType: 'add'
            }
          ],
          totalTokens: 50
        },
        metadata: {
          type: 'local',
          identifier: 'cleanup-test',
          source: 'test',
          generatedAt: new Date().toISOString(),
          fetchOptions: {}
        }
      }

      await manager.saveContent(workspaceId, sourceContent)

      // Cleanup should succeed even with content
      await expect(manager.cleanup(workspaceId)).resolves.toBeUndefined()

      // Verify directory is removed
      const workspaceDir = path.join(tempDir, workspaceId)
      await expect(fs.stat(workspaceDir)).rejects.toThrow()
    })
  })
})