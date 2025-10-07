/**
 * WorkspaceManager implementation for file system operations
 * Updated to match test expectations for workspace ID-based operations
 */

import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import type { IWorkspaceManager } from './interfaces.js'
import type { WorkspaceConfig, WorkspaceStatistics, SourceContent } from '../types/index.js'
import { ChangeType } from '../types/index.js'
import { createLogger, estimateTokens } from './utils.js'
import type { FileOperationsClient } from '../services/file-operations-client.js'

export class WorkspaceManager implements IWorkspaceManager {
  private readonly logger = createLogger('WorkspaceManager')
  private workspaceRoot: string
  private currentWorkspaceId?: string
  private currentWorkspacePath?: string
  private fileOperationsClient?: FileOperationsClient

  constructor(fileOperationsClient?: FileOperationsClient) {
    // When using FileOperationsClient, use relative paths from project root
    // Otherwise use absolute paths in temp directory
    if (fileOperationsClient) {
      // Use a relative workspace directory when working through the API
      this.workspaceRoot = '.supercode-workspaces/project-workflow'
    } else {
      // Use a base directory for all workspaces in temp directory for local fs
      this.workspaceRoot = path.join(os.tmpdir(), 'project-workflow')
    }
    this.fileOperationsClient = fileOperationsClient
  }

  /**
   * Create temporary workspace
   */
  async createWorkspace(config?: WorkspaceConfig): Promise<string> {
    try {
      // Use default config if none provided
      const defaultConfig: WorkspaceConfig = {
        prefix: 'workflow',
        preserveVersions: false,
        cleanup: true
      }
      const workspaceConfig = { ...defaultConfig, ...config }

      // Create workspace in temp directory with timestamp and random suffix
      const timestamp = Date.now()
      const randomSuffix = Math.random().toString(36).substring(2, 8)
      const workspaceId = `${workspaceConfig.prefix}-${timestamp}-${randomSuffix}`

      const workspacePath = path.join(this.workspaceRoot, workspaceId)

      // Create workspace directory structure
      await this.createDirectory(workspacePath, { recursive: true })
      await this.createDirectory(path.join(workspacePath, 'source'), { recursive: true })
      await this.createDirectory(path.join(workspacePath, 'shards'), { recursive: true })
      await this.createDirectory(path.join(workspacePath, 'versions'), { recursive: true })

      // Store current workspace for stateful operations
      this.currentWorkspaceId = workspaceId
      this.currentWorkspacePath = workspacePath

      this.logger.info(`Created workspace: ${workspacePath}`)
      return workspaceId

    } catch (error) {
      this.logger.error(`Failed to create workspace: ${error}`)
      throw new Error(`Failed to create workspace: ${error}`)
    }
  }

  /**
   * Save content to workspace (interface implementation with overloads)
   */
  async saveContent(relativePath: string, content: string | Buffer): Promise<string>
  async saveContent(workspaceId: string, sourceContent: SourceContent): Promise<void>
  async saveContent(pathOrId: string, contentOrSource: string | Buffer | SourceContent): Promise<string | void> {
    // Check if this is a SourceContent object (has content.files property)
    if (contentOrSource && typeof contentOrSource === 'object' && 'content' in contentOrSource && 'metadata' in contentOrSource) {
      // This is the saveSourceContent pattern
      await this.saveSourceContentImpl(pathOrId, contentOrSource as SourceContent)
      return
    } else {
      // This is the saveRawContent pattern
      return this.saveRawContent(pathOrId, contentOrSource as string | Buffer)
    }
  }

  /**
   * Load content from workspace (interface implementation with overloads)
   */
  async loadContent(relativePath: string): Promise<string>
  async loadContent(workspaceId: string): Promise<SourceContent>
  async loadContent(pathOrId: string): Promise<string | SourceContent> {
    // Check if this looks like a workspace ID (has the workspace directory structure)
    const workspacePath = path.join(this.workspaceRoot, pathOrId)

    try {
      // Check if this is a workspace directory by looking for the workspace structure
      if (this.fileOperationsClient) {
        const workspaceExists = await this.fileOperationsClient.exists(workspacePath)
        if (workspaceExists) {
          // This looks like a workspace ID, try to load as SourceContent
          return this.loadSourceContentImpl(pathOrId)
        }
      } else {
        try {
          await fs.access(workspacePath)
          // This looks like a workspace ID, try to load as SourceContent
          return this.loadSourceContentImpl(pathOrId)
        } catch {
          // Fall through to raw content loading
        }
      }

      // If not a workspace directory, treat as raw content loading
      return this.loadRawContent(pathOrId)
    } catch (error) {
      // If workspace doesn't exist or loading as SourceContent fails, try as raw content
      return this.loadRawContent(pathOrId)
    }
  }

  /**
   * Save SourceContent to workspace (workspace ID method for test compatibility)
   */
  async saveSourceContent(workspaceId: string, sourceContent: SourceContent): Promise<void> {
    return this.saveSourceContentImpl(workspaceId, sourceContent)
  }

  /**
   * Load SourceContent from workspace (workspace ID method for test compatibility)
   */
  async loadSourceContent(workspaceId: string): Promise<SourceContent> {
    return this.loadSourceContentImpl(workspaceId)
  }

  /**
   * Save SourceContent to workspace (private implementation)
   */
  private async saveSourceContentImpl(workspaceId: string, sourceContent: SourceContent): Promise<void> {
    const workspacePath = path.join(this.workspaceRoot, workspaceId)

    try {
      // Verify workspace exists
      await this.checkAccess(workspacePath)

      // Save each file in the source content
      for (const file of sourceContent.content.files) {
        const filePath = path.join(workspacePath, 'source', file.path)

        // Ensure directory exists
        const directory = path.dirname(filePath)
        await this.createDirectory(directory, { recursive: true })

        // Write file content
        await this.writeFile(filePath, file.content, { encoding: 'utf8', createDirs: true })
      }

      // Save metadata
      const metadataPath = path.join(workspacePath, 'metadata.json')
      await this.writeFile(metadataPath, JSON.stringify(sourceContent.metadata, null, 2), { encoding: 'utf8', createDirs: true })

      this.logger.debug(`Saved content to workspace: ${workspaceId}`)

    } catch (error) {
      this.logger.error(`Failed to save content to workspace ${workspaceId}: ${error}`)
      throw new Error(`Failed to save content: ${error}`)
    }
  }

  /**
   * Load SourceContent from workspace (private implementation)
   */
  private async loadSourceContentImpl(workspaceId: string): Promise<SourceContent> {
    const workspacePath = path.join(this.workspaceRoot, workspaceId)

    try {
      // Verify workspace exists
      await this.checkAccess(workspacePath)

      // Load metadata
      let metadata
      try {
        const metadataPath = path.join(workspacePath, 'metadata.json')
        const metadataContent = await this.readFile(metadataPath, { encoding: 'utf8' })
        metadata = JSON.parse(metadataContent)
      } catch {
        // If no metadata file, create default
        metadata = {
          type: 'unknown',
          identifier: workspaceId,
          source: 'workspace',
          generatedAt: new Date().toISOString(),
          fetchOptions: {}
        }
      }

      // Load files from source directory
      const files = []
      const sourcePath = path.join(workspacePath, 'source')

      try {
        await this.checkAccess(sourcePath)
        const fileList = await this.getAllFiles(sourcePath)

        for (const filePath of fileList) {
          const relativePath = path.relative(sourcePath, filePath)
          const content = await this.readFile(filePath, { encoding: 'utf8' })
          const stats = await this.getStats(filePath)

          files.push({
            path: relativePath,
            content,
            size: stats.size || 0,
            tokens: estimateTokens(content),
            changeType: ChangeType.MODIFY
          })
        }
      } catch {
        // If source directory doesn't exist, no files
      }

      const totalTokens = files.reduce((sum, file) => sum + file.tokens, 0)

      return {
        content: {
          files,
          totalTokens
        },
        metadata
      }

    } catch (error) {
      this.logger.error(`Failed to load content from workspace ${workspaceId}: ${error}`)
      throw new Error(`Failed to load content: ${error}`)
    }
  }

  /**
   * Save raw content to workspace (private implementation for interface compatibility)
   */
  private async saveRawContent(relativePath: string, content: string | Buffer): Promise<string> {
    if (!this.currentWorkspacePath) {
      throw new Error('No workspace initialized. Call createWorkspace first.')
    }

    try {
      const absolutePath = path.join(this.currentWorkspacePath, relativePath)

      // Ensure directory exists
      const directory = path.dirname(absolutePath)
      await this.createDirectory(directory, { recursive: true })

      // Write content
      await this.writeFile(absolutePath, content, { createDirs: true })

      this.logger.debug(`Saved raw content to: ${relativePath}`)
      return absolutePath

    } catch (error) {
      this.logger.error(`Failed to save raw content to ${relativePath}: ${error}`)
      throw new Error(`Failed to save raw content: ${error}`)
    }
  }

  /**
   * Load raw content from workspace (private implementation for interface compatibility)
   */
  private async loadRawContent(relativePath: string): Promise<string> {
    if (!this.currentWorkspacePath) {
      throw new Error('No workspace initialized. Call createWorkspace first.')
    }

    try {
      const absolutePath = path.join(this.currentWorkspacePath, relativePath)
      const content = await this.readFile(absolutePath, { encoding: 'utf8' })

      this.logger.debug(`Loaded raw content from: ${relativePath}`)
      return content

    } catch (error) {
      this.logger.error(`Failed to load raw content from ${relativePath}: ${error}`)
      throw new Error(`Failed to load raw content: ${error}`)
    }
  }

  /**
   * Get workspace statistics
   */
  async getStatistics(workspaceId?: string): Promise<WorkspaceStatistics> {
    if (workspaceId) {
      return this.getWorkspaceStatistics(workspaceId)
    } else if (this.currentWorkspaceId) {
      return this.getWorkspaceStatistics(this.currentWorkspaceId)
    } else {
      throw new Error('Workspace not initialized. Call createWorkspace first.')
    }
  }

  private async getWorkspaceStatistics(workspaceId: string): Promise<WorkspaceStatistics> {
    const workspacePath = path.join(this.workspaceRoot, workspaceId)

    try {
      // Verify workspace exists
      await this.checkAccess(workspacePath)

      // Count files and calculate total size
      let filesStored = 0
      let totalSize = 0
      let createdAt = new Date().toISOString()

      // Get workspace creation time
      try {
        const workspaceStats = await this.getStats(workspacePath)
        createdAt = workspaceStats.modified || new Date().toISOString()
      } catch {
        // Use current time if can't get creation time
      }

      // Count files in source directory
      const sourcePath = path.join(workspacePath, 'source')
      try {
        await this.checkAccess(sourcePath)
        const fileList = await this.getAllFiles(sourcePath)
        filesStored = fileList.length

        for (const filePath of fileList) {
          const stats = await this.getStats(filePath)
          totalSize += Number(stats.size || 0)
        }
      } catch {
        // If source directory doesn't exist, no files
      }

      return {
        workspaceId,
        filesStored,
        totalSize,
        createdAt
      }

    } catch (error) {
      this.logger.error(`Failed to get workspace statistics for ${workspaceId}: ${error}`)
      throw new Error(`Failed to get workspace statistics: ${error}`)
    }
  }

  /**
   * Cleanup workspace
   */
  async cleanup(workspaceId?: string): Promise<void> {
    const targetWorkspaceId = workspaceId || this.currentWorkspaceId

    if (!targetWorkspaceId) {
      this.logger.warn('No workspace to cleanup')
      return
    }

    const workspacePath = path.join(this.workspaceRoot, targetWorkspaceId)

    try {
      await this.deleteDirectory(workspacePath)
      this.logger.info(`Cleaned up workspace: ${workspacePath}`)

      // Reset current workspace if it's the one being cleaned up
      if (targetWorkspaceId === this.currentWorkspaceId) {
        this.currentWorkspaceId = undefined
        this.currentWorkspacePath = undefined
      }
    } catch (error) {
      // Ignore cleanup errors for non-existent workspaces
      this.logger.warn(`Cleanup warning for ${targetWorkspaceId}: ${error}`)
    }
  }

  /**
   * Save content to a specific subdirectory (helper method)
   */
  async saveToSubdirectory(subdirectory: string, fileName: string, content: string | Buffer): Promise<string> {
    if (!this.currentWorkspacePath) {
      throw new Error('No workspace initialized. Call createWorkspace first.')
    }

    try {
      const relativePath = path.join(subdirectory, fileName)
      const absolutePath = path.join(this.currentWorkspacePath, relativePath)

      // Ensure directory exists
      const directory = path.dirname(absolutePath)
      await this.createDirectory(directory, { recursive: true })

      // Write content
      await this.writeFile(absolutePath, content, { createDirs: true })

      this.logger.debug(`Saved content to: ${relativePath}`)
      return absolutePath

    } catch (error) {
      this.logger.error(`Failed to save content to ${subdirectory}/${fileName}: ${error}`)
      throw new Error(`Failed to save content: ${error}`)
    }
  }

  /**
   * Get workspace path
   */
  getWorkspacePath(): string | undefined {
    return this.currentWorkspacePath
  }

  /**
   * Get the workspace directory for a given workspace ID
   * This provides a consistent way to resolve workspace paths
   */
  getWorkspaceDirectory(workspaceId: string): string {
    return path.join(this.workspaceRoot, workspaceId)
  }

  /**
   * Get the root directory where all workspaces are stored
   * This allows other components to know where to look for workspaces
   */
  getWorkspaceRootDirectory(): string {
    return this.workspaceRoot
  }

  /**
   * Get all files recursively from a directory
   */
  private async getAllFiles(dir: string): Promise<string[]> {
    const files: string[] = []

    if (this.fileOperationsClient) {
      // Use the file operations client for remote file system
      const entries = await this.fileOperationsClient.listDirectory(dir, { recursive: true })

      for (const entry of entries) {
        if (entry.type === 'file') {
          files.push(path.join(dir, entry.name))
        }
      }
    } else {
      // Use local file system
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
          const subFiles = await this.getAllFiles(fullPath)
          files.push(...subFiles)
        } else {
          files.push(fullPath)
        }
      }
    }

    return files
  }

  /**
   * Create directory with fallback to local fs
   */
  private async createDirectory(dirPath: string, options: { recursive?: boolean } = {}): Promise<void> {
    if (this.fileOperationsClient) {
      await this.fileOperationsClient.createDirectory(dirPath, options)
    } else {
      await fs.mkdir(dirPath, options)
    }
  }

  /**
   * Write file with fallback to local fs
   */
  private async writeFile(filePath: string, content: string | Buffer, options: { encoding?: string; createDirs?: boolean } = {}): Promise<void> {
    if (this.fileOperationsClient) {
      const encoding = options.encoding || 'utf8'
      const stringContent = typeof content === 'string' ? content : content.toString(encoding as BufferEncoding)
      await this.fileOperationsClient.writeFile(filePath, stringContent, {
        encoding: encoding as 'utf8' | 'base64',
        createDirs: options.createDirs
      })
    } else {
      const encoding = (options.encoding as BufferEncoding) || 'utf8'
      await fs.writeFile(filePath, content, encoding)
    }
  }

  /**
   * Read file with fallback to local fs
   */
  private async readFile(filePath: string, options: { encoding?: string } = {}): Promise<string> {
    if (this.fileOperationsClient) {
      return await this.fileOperationsClient.readFile(filePath, {
        encoding: (options.encoding as 'utf8' | 'base64') || 'utf8'
      })
    } else {
      const encoding = (options.encoding as BufferEncoding) || 'utf8'
      return await fs.readFile(filePath, encoding)
    }
  }

  /**
   * Delete directory with fallback to local fs
   */
  private async deleteDirectory(dirPath: string): Promise<void> {
    if (this.fileOperationsClient) {
      await this.fileOperationsClient.deleteDirectory(dirPath)
    } else {
      await fs.rm(dirPath, { recursive: true, force: true })
    }
  }

  /**
   * Check file/directory access with fallback to local fs
   */
  private async checkAccess(targetPath: string): Promise<void> {
    if (this.fileOperationsClient) {
      const exists = await this.fileOperationsClient.exists(targetPath)
      if (!exists) {
        throw new Error(`Path does not exist: ${targetPath}`)
      }
    } else {
      await fs.access(targetPath)
    }
  }

  /**
   * Get file/directory stats with fallback to local fs
   */
  private async getStats(targetPath: string): Promise<{ size?: number; modified?: string; birthtime?: Date }> {
    if (this.fileOperationsClient) {
      const stats = await this.fileOperationsClient.stat(targetPath)
      return {
        size: stats.size,
        modified: stats.modified
      }
    } else {
      const stats = await fs.stat(targetPath)
      return {
        size: Number(stats.size),
        modified: stats.mtime.toISOString(),
        birthtime: stats.birthtime
      }
    }
  }
}