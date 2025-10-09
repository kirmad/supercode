/**
 * Git Content Source implementation
 * Implements IContentSource interface to provide git diff content for all 5 scenarios
 */

import type {
  SourceContent,
  SourceMetadata,
  ContentFetchOptions,
  ContentData,
  ContentFile,
  DiffData,
  GitDiffConfig,
  GitReviewIndex
} from '../types/index.js'
import { GitError, GitRepositoryError, ChangeType, SourceType } from '../types/index.js'
import type { IContentSource, IWorkspaceManager } from './interfaces.js'
import { GitApiClient } from './git-client.js'
import { FileOperationsClient } from '../services/file-operations-client.js'
import { join } from '../utils/browser-path.js'
import { createLogger } from './utils.js'

/**
 * Git Content Source for fetching git diff content
 */
export class GitContentSource implements IContentSource {
  private config: GitDiffConfig
  private gitClient: GitApiClient
  private baseUrl: string
  private readonly logger = createLogger('GitContentSource')
  private readonly workspaceManager?: IWorkspaceManager
  private readonly fileOperationsClient?: FileOperationsClient

  constructor(config: GitDiffConfig, baseUrl: string) {
    this.config = config
    this.baseUrl = baseUrl
    this.gitClient = new GitApiClient(baseUrl, config.repositoryPath)
    this.workspaceManager = config.workspaceManager
    this.fileOperationsClient = config.fileOperationsClient || (baseUrl ? new FileOperationsClient({ baseUrl, timeout: 30000 }) : undefined)
  }

  /**
   * Fetch content from git diff based on configuration
   */
  async fetchContent(identifier: string, options?: ContentFetchOptions): Promise<SourceContent> {
    try {
      // Validate repository first
      await this.gitClient.validateRepository()

      // Validate configuration based on diff type
      await this.validateConfiguration()

      // Get the diff data
      const diffResponse = await this.gitClient.getDiff(this.config)

      // Parse diff into structured content
      const contentData = await this.parseDiffContent(diffResponse, options?.saveDirectory)

      // Get additional metadata
      const metadata = await this.buildMetadata(identifier, options)

      return {
        content: contentData,
        metadata
      }
    } catch (error) {
      if (error instanceof GitError || error instanceof GitRepositoryError) {
        throw error
      }
      throw new GitError(`Failed to fetch git content: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Validate git identifier (commit hash, branch name, etc.)
   */
  validateIdentifier(identifier: string): boolean {
    // Basic validation - check if identifier is non-empty
    if (!identifier || identifier.trim().length === 0) {
      return false
    }

    // For git, identifiers can be:
    // - Commit hashes (7-40 characters, hex)
    // - Branch names (various formats)
    // - Special values like 'staged', 'HEAD', etc.

    // Accept most reasonable identifiers, detailed validation happens in validateConfiguration
    return identifier.length >= 1 && identifier.length <= 255
  }

  /**
   * Check if git repository is accessible
   */
  async isAvailable(identifier: string): Promise<boolean> {
    try {
      await this.gitClient.validateRepository()
      return true
    } catch {
      return false
    }
  }

  /**
   * Get source type
   */
  getSourceType(): SourceType {
    return SourceType.GIT
  }

  /**
   * Validate configuration based on diff type
   */
  private async validateConfiguration(): Promise<void> {
    switch (this.config.type) {
      case 'staged':
        // Check if there are any staged changes
        const hasStaged = await this.gitClient.hasStaged()
        if (!hasStaged) {
          throw new GitError('No staged changes found')
        }
        break

      case 'unpushed':
        // Check if there are unpushed changes
        const hasUnpushed = await this.gitClient.hasUnpushed()
        if (!hasUnpushed) {
          throw new GitError('No unpushed changes found')
        }
        break

      case 'commit':
        if (!this.config.commit) {
          throw new GitError('Commit hash is required for commit diff type')
        }
        const commitExists = await this.gitClient.validateCommit(this.config.commit)
        if (!commitExists) {
          throw new GitError(`Commit ${this.config.commit} not found`)
        }
        break

      case 'commit-range':
        if (!this.config.fromCommit || !this.config.toCommit) {
          throw new GitError('Both fromCommit and toCommit are required for commit-range diff type')
        }
        const fromExists = await this.gitClient.validateCommit(this.config.fromCommit)
        const toExists = await this.gitClient.validateCommit(this.config.toCommit)
        if (!fromExists) {
          throw new GitError(`From commit ${this.config.fromCommit} not found`)
        }
        if (!toExists) {
          throw new GitError(`To commit ${this.config.toCommit} not found`)
        }
        break

      case 'branch-diff':
        if (!this.config.fromBranch || !this.config.toBranch) {
          throw new GitError('Both fromBranch and toBranch are required for branch-diff type')
        }
        const fromBranchExists = await this.gitClient.validateBranch(this.config.fromBranch)
        const toBranchExists = await this.gitClient.validateBranch(this.config.toBranch)
        if (!fromBranchExists) {
          throw new GitError(`From branch ${this.config.fromBranch} not found`)
        }
        if (!toBranchExists) {
          throw new GitError(`To branch ${this.config.toBranch} not found`)
        }
        break

      default:
        throw new GitError(`Unsupported git diff type: ${(this.config as any).type}`)
    }
  }

  /**
   * Parse git diff response into structured content data
   */
  private async parseDiffContent(
    diffResponse: { diff: string; files: Array<{ path: string; additions: number; deletions: number }> },
    saveDirectory?: string
  ): Promise<ContentData> {
    const files: ContentFile[] = []
    const diffs: DiffData[] = []
    let totalSize = 0
    let totalTokens = 0

    // Process each file from the diff
    for (const fileStat of diffResponse.files) {
      // Get file content for 'before' and 'after' states
      const { beforeContent, afterContent } = await this.getFileVersions(fileStat.path)

      // Determine change type
      const changeType = this.determineChangeType(beforeContent, afterContent, fileStat)

      // Calculate file size and tokens (rough estimate)
      const fileSize = afterContent.length || beforeContent.length
      const fileTokens = Math.ceil(fileSize / 4) // Rough token estimate

      // Create content file entry
      const contentFile: ContentFile = {
        path: fileStat.path,
        content: afterContent || beforeContent, // Use after content if available, else before
        size: fileSize,
        tokens: fileTokens,
        changeType
      }

      files.push(contentFile)

      // Create diff data entry
      const diffData: DiffData = {
        file: fileStat.path,
        diff: this.extractFileDiff(diffResponse.diff, fileStat.path),
        changeType,
        addedLines: fileStat.additions,
        removedLines: fileStat.deletions
      }

      diffs.push(diffData)

      totalSize += fileSize
      totalTokens += fileTokens

      // Save file versions if we have workspace manager
      // If saveDirectory is not provided, use workspace path + /versions
      if (this.workspaceManager) {
        const actualSaveDirectory = saveDirectory || (this.workspaceManager.getWorkspacePath() + '/versions')
        try {
          const safeFileName = fileStat.path.replace(/[\/\\:*?"<>|]/g, '_').replace(/^_+/, '')

          // Save old version (.local for "from" version) if we have content
          if (beforeContent !== null && beforeContent !== undefined) {
            const localPath = await this.workspaceManager.saveContent(`versions/${safeFileName}.local`, beforeContent)
            this.logger.info(`Saved old version: ${localPath}`)
          }

          // Save new version (.remote for "to" version) if we have content
          if (afterContent !== null && afterContent !== undefined) {
            const remotePath = await this.workspaceManager.saveContent(`versions/${safeFileName}.remote`, afterContent)
            this.logger.info(`Saved new version: ${remotePath}`)
          }

          // Always save the diff (even if it's a placeholder)
          const fileDiff = this.extractFileDiff(diffResponse.diff, fileStat.path)
          const diffPath = await this.workspaceManager.saveContent(`versions/${safeFileName}.diff`, fileDiff)
          this.logger.info(`Saved diff: ${diffPath}`)
        } catch (saveError) {
          this.logger.error(`Failed to save version files for ${fileStat.path}: ${saveError}`)
        }
      }
    }

    return {
      files,
      diffs,
      totalSize,
      totalTokens
    }
  }

  /**
   * Get file content for before and after states
   */
  private async getFileVersions(filePath: string): Promise<{ beforeContent: string; afterContent: string }> {
    let beforeContent = ''
    let afterContent = ''

    try {
      switch (this.config.type) {
        case 'staged':
          // Before: HEAD, After: staged content
          const headFile = await this.gitClient.getFileContent(filePath, 'HEAD')
          beforeContent = headFile.exists ? headFile.content : ''

          // For after content, we need the staged version - this is tricky with current API
          // For now, use HEAD content as placeholder
          const stagedFile = await this.gitClient.getFileContent(filePath, 'HEAD')
          afterContent = stagedFile.exists ? stagedFile.content : ''
          break

        case 'unpushed':
          // Before: remote branch, After: HEAD
          const remoteName = this.config.remoteName || 'origin'
          const baseBranch = this.config.baseBranch || 'main'
          const remoteFile = await this.gitClient.getFileContent(filePath, `${remoteName}/${baseBranch}`)
          beforeContent = remoteFile.exists ? remoteFile.content : ''

          const headUnpushed = await this.gitClient.getFileContent(filePath, 'HEAD')
          afterContent = headUnpushed.exists ? headUnpushed.content : ''
          break

        case 'commit':
          // Before: commit~1, After: commit
          const beforeCommit = await this.gitClient.getFileContent(filePath, `${this.config.commit}~1`)
          beforeContent = beforeCommit.exists ? beforeCommit.content : ''

          const afterCommit = await this.gitClient.getFileContent(filePath, this.config.commit!)
          afterContent = afterCommit.exists ? afterCommit.content : ''
          break

        case 'commit-range':
          // Before: fromCommit, After: toCommit
          const fromFile = await this.gitClient.getFileContent(filePath, this.config.fromCommit!)
          beforeContent = fromFile.exists ? fromFile.content : ''

          const toFile = await this.gitClient.getFileContent(filePath, this.config.toCommit!)
          afterContent = toFile.exists ? toFile.content : ''
          break

        case 'branch-diff':
          // Before: fromBranch, After: toBranch
          const fromBranchFile = await this.gitClient.getFileContent(filePath, this.config.fromBranch!)
          beforeContent = fromBranchFile.exists ? fromBranchFile.content : ''

          const toBranchFile = await this.gitClient.getFileContent(filePath, this.config.toBranch!)
          afterContent = toBranchFile.exists ? toBranchFile.content : ''
          break
      }
    } catch (error) {
      // If we can't get file content, use empty strings
      // This handles cases where files are new or deleted
    }

    return { beforeContent, afterContent }
  }

  /**
   * Determine change type based on file content
   */
  private determineChangeType(beforeContent: string, afterContent: string, fileStat: { path: string; additions: number; deletions: number }): ChangeType {
    if (!beforeContent && afterContent) {
      return ChangeType.ADD
    }
    if (beforeContent && !afterContent) {
      return ChangeType.DELETE
    }
    if (beforeContent && afterContent) {
      // Check if it's a rename by looking at the diff stats
      if (fileStat.additions === 0 && fileStat.deletions === 0) {
        return ChangeType.RENAME
      }
      return ChangeType.MODIFY
    }

    // Default to modify
    return ChangeType.MODIFY
  }

  /**
   * Extract diff content for a specific file from the full diff
   */
  private extractFileDiff(fullDiff: string, filePath: string): string {
    const lines = fullDiff.split('\n')
    const fileLines: string[] = []
    let inFile = false
    let foundFile = false

    for (const line of lines) {
      // Check for file header
      if (line.startsWith('diff --git') && line.includes(filePath)) {
        inFile = true
        foundFile = true
        fileLines.push(line)
        continue
      }

      // Check for next file (end current file)
      if (inFile && line.startsWith('diff --git') && !line.includes(filePath)) {
        break
      }

      // Collect lines for current file
      if (inFile) {
        fileLines.push(line)
      }
    }

    return foundFile ? fileLines.join('\n') : ''
  }

  /**
   * Build metadata for the git content
   */
  private async buildMetadata(identifier: string, options?: ContentFetchOptions): Promise<SourceMetadata> {
    const currentBranch = await this.gitClient.getCurrentBranch()
    const commits = await this.gitClient.getCommits(1, currentBranch)

    let author = ''
    let description = ''

    if (commits.commits.length > 0) {
      const latestCommit = commits.commits[0]
      author = latestCommit.author
      description = latestCommit.subject
    }

    return {
      type: 'git-diff',
      identifier,
      source: this.config.repositoryPath,
      generatedAt: new Date().toISOString(),
      fetchOptions: options || {},
      title: this.buildTitle(),
      description,
      author,
      createdDate: new Date().toISOString(),
      modifiedDate: new Date().toISOString(),
      sourceBranch: this.getSourceBranch(),
      targetBranch: this.getTargetBranch(),
      repository: this.config.repositoryPath
    }
  }

  /**
   * Build a descriptive title for the git diff
   */
  private buildTitle(): string {
    switch (this.config.type) {
      case 'staged':
        return 'Staged Changes Review'
      case 'unpushed':
        return `Unpushed Changes Review`
      case 'commit':
        return `Commit Review: ${this.config.commit}`
      case 'commit-range':
        return `Commit Range Review: ${this.config.fromCommit}..${this.config.toCommit}`
      case 'branch-diff':
        return `Branch Diff Review: ${this.config.fromBranch} → ${this.config.toBranch}`
      default:
        return 'Git Diff Review'
    }
  }

  /**
   * Get source branch for metadata
   */
  private getSourceBranch(): string | undefined {
    switch (this.config.type) {
      case 'branch-diff':
        return this.config.fromBranch
      case 'commit-range':
        return this.config.fromCommit
      case 'unpushed':
        return `${this.config.remoteName || 'origin'}/${this.config.baseBranch || 'main'}`
      default:
        return undefined
    }
  }

  /**
   * Get target branch for metadata
   */
  private getTargetBranch(): string | undefined {
    switch (this.config.type) {
      case 'branch-diff':
        return this.config.toBranch
      case 'commit-range':
        return this.config.toCommit
      case 'unpushed':
        return 'HEAD'
      default:
        return undefined
    }
  }
}

/**
 * Factory function to create GitContentSource instances
 */
export function createGitContentSource(config: GitDiffConfig, baseUrl: string): GitContentSource {
  return new GitContentSource(config, baseUrl)
}