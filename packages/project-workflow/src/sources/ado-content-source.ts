/**
 * ADO (Azure DevOps) Content Source implementation
 * Extracts logic from scripts/sharded-review-parallel.js
 */

import { join, isAbsolute } from '../utils/browser-path.js'
import type { IContentSource, IWorkspaceManager } from '../core/interfaces.js'
import { BrowserConfig } from '../utils/browser-config.js'
import { FileOperationsClient } from '../services/file-operations-client.js'
import type {
  SourceContent,
  ContentFetchOptions,
  ContentData,
  ContentFile,
  DiffData,
  SourceMetadata,
  ADOComment,
  CommentAuthor,
  PublishResult,
  ReplyResult,
  ReviewComment
} from '../types/index.js'
import { SourceType, ChangeType } from '../types/index.js'
import {
  parseADOUrl,
  isADOUrl,
  estimateTokens,
  sanitizeFileName,
  createLogger
} from '../core/utils.js'
import { ContentSourceError } from '../types/index.js'
import {
  PullRequestClient,
  CommentService,
  generateStableAdoId,
  generateUnifiedDiff,
  type AzureDevOpsConfig
} from '@supercode/azure-devops'
import { AdoDiffHelper } from './ado-diff-helper.js'

/**
 * ADO credentials interface
 */
export interface ADOCredentials {
  pat: string
  organization?: string
}

/**
 * ADO configuration interface
 */
export interface ADOConfig {
  baseUrl: string
  credentials?: ADOCredentials
  workspaceManager?: IWorkspaceManager
  fileOperationsClient?: FileOperationsClient
  organization?: string
  project?: string
}

/**
 * Default file patterns to skip during review
 */
const DEFAULT_SKIP_PATTERNS = [
  /\.xml$/i,           // XML documentation files
  /\.json$/i,          // JSON config files (usually auto-generated)
  /\.md$/i,            // Markdown documentation
  /\.txt$/i,           // Text files
  /\.gitignore$/i,     // Git ignore files
  /\/bin\//i,          // Binary directories
  /\/obj\//i,          // Object directories
  /\.dll$/i,           // Dynamic libraries
  /\.exe$/i,           // Executables
  /\.pdb$/i,           // Debug symbols
  /packages\.config$/i, // NuGet packages
  /\.min\./i,          // Minified files
  /\.generated\./i,    // Generated files
  /\.designer\./i      // Designer files
]

/**
 * Convert glob pattern to RegExp
 * Simple implementation for common patterns
 */
function globToRegex(pattern: string): RegExp {
  // Escape special regex characters except * and ?
  let regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape regex special chars
    .replace(/\*\*/g, '.*')                // ** matches any path
    .replace(/\*/g, '[^/]*')               // * matches any file/folder name
    .replace(/\?/g, '.')                   // ? matches single character

  // Ensure pattern matches full path
  if (!regexPattern.startsWith('^')) {
    regexPattern = '^.*' + regexPattern
  }
  if (!regexPattern.endsWith('$')) {
    regexPattern = regexPattern + '.*$'
  }

  return new RegExp(regexPattern, 'i')
}

/**
 * ADO Content Source for fetching pull request data
 */
export class ADOContentSource implements IContentSource {
  private readonly config: ADOConfig
  private readonly logger = createLogger('ADOContentSource')
  private readonly workspaceManager?: IWorkspaceManager
  private readonly fileOperationsClient?: FileOperationsClient
  private readonly pullRequestClient: PullRequestClient
  private readonly commentService: CommentService

  constructor(config: ADOConfig) {
    this.config = config
    this.workspaceManager = config.workspaceManager
    this.fileOperationsClient = config.fileOperationsClient || (config.baseUrl ? new FileOperationsClient({ baseUrl: config.baseUrl, timeout: 30000 }) : undefined)

    // Initialize Azure DevOps clients
    const credentials = this.getCredentials()
    const azureConfig: AzureDevOpsConfig = {
      organization: config.organization || this.extractOrgFromUrl(config.baseUrl),
      project: config.project || 'DefaultProject', // Will be overridden from URL parsing
      pat: credentials.pat
    }

    this.pullRequestClient = new PullRequestClient(azureConfig)
    this.commentService = new CommentService(azureConfig)

    this.logger.debug(`ADOContentSource initialized with baseUrl: ${config.baseUrl}`)
  }

  /**
   * Validate ADO PR URL format
   */
  validateIdentifier(identifier: string): boolean {
    return isADOUrl(identifier)
  }

  /**
   * Extract organization from base URL
   */
  private extractOrgFromUrl(baseUrl: string): string {
    // Extract organization from localhost URL patterns or ADO URLs
    if (baseUrl.includes('localhost')) {
      return 'localhost-org' // Default for local development
    }

    const match = baseUrl.match(/https:\/\/([^.]+)\.visualstudio\.com/) ||
                  baseUrl.match(/https:\/\/dev\.azure\.com\/([^\/]+)/)
    return match ? match[1] : 'default-org'
  }

  /**
   * Get ADO credentials from config or environment
   */
  private getCredentials(): ADOCredentials {
    // Use config credentials if available
    if (this.config.credentials?.pat) {
      return this.config.credentials
    }

    // Fall back to environment variables (same as original script)
    const pat = BrowserConfig.getAzureDevOpsPat()

    if (!pat) {
      throw new ContentSourceError('Azure DevOps PAT not configured. Please set AZURE_DEVOPS_PAT or ADO_PAT environment variable.')
    }

    return { pat }
  }

  /**
   * Fetch content from ADO PR
   */
  async fetchContent(identifier: string, options?: ContentFetchOptions): Promise<SourceContent> {
    if (!this.validateIdentifier(identifier)) {
      throw new ContentSourceError(`Invalid ADO PR URL: ${identifier}`)
    }

    const adoInfo = parseADOUrl(identifier)
    if (!adoInfo) {
      throw new ContentSourceError(`Invalid ADO PR URL format: ${identifier}`)
    }

    try {
      // Fetch PR data from ADO API
      const prData = await this.fetchADOPullRequest(
        adoInfo.organization,
        adoInfo.project,
        adoInfo.repository,
        parseInt(adoInfo.pullRequestId),
        options?.saveDirectory
      )

      // Process and filter files
      const processedData = await this.processADOData(prData, options)

      // Create source content
      const sourceContent: SourceContent = {
        content: processedData,
        metadata: this.extractMetadata(prData, { ...adoInfo, pullRequestId: parseInt(adoInfo.pullRequestId) })
      }

      this.logger.info(`Successfully fetched ADO PR: ${processedData.files.length} files, ${processedData.totalTokens} tokens`)
      return sourceContent

    } catch (error) {
      this.logger.error(`Failed to fetch ADO content: ${error}`)
      throw new ContentSourceError(`Failed to fetch ADO PR: ${error}`, { identifier, error })
    }
  }

  /**
   * Fetch PR data using Azure DevOps client
   */
  private async fetchADOPullRequest(
    organization: string,
    project: string,
    repository: string,
    pullRequestId: number,
    saveDirectory?: string
  ): Promise<any> {
    this.logger.info(`Fetching ADO PR ${pullRequestId} from ${organization}/${project}/${repository}`)

    try {
      // Update client configuration with actual organization and project
      const azureConfig: AzureDevOpsConfig = {
        organization,
        project,
        pat: this.getCredentials().pat
      }

      const client = new PullRequestClient(azureConfig)

      // Get complete pull request data including changes and comments
      const completeData = await client.getCompletePullRequestData(repository, pullRequestId, {
        includeCommits: true,
        includeChanges: true,
        includeComments: true,
        includeWorkItems: false
      })

      // Transform the data to match the expected format
      const prData = {
        ...completeData.pullRequest,
        changedFiles: completeData.changes?.changes || [],
        fileDiffs: await this.generateFileDiffs(completeData, client, repository, pullRequestId, saveDirectory),
        comments: completeData.comments || [],
        reviewComments: completeData.comments || []
      }

      this.logger.info(`Fetched ADO PR: ${prData.title} with ${Object.keys(prData.fileDiffs || {}).length} files`)
      return prData

    } catch (error) {
      this.logger.error(`Failed to fetch PR data: ${error}`)
      throw new Error(`ADO client error: ${error}`)
    }
  }

  /**
   * Generate file diffs from pull request changes
   */
  private async generateFileDiffs(
    completeData: any,
    client: PullRequestClient,
    repository: string,
    pullRequestId: number,
    saveDirectory?: string
  ): Promise<Record<string, any>> {
    const fileDiffs: Record<string, any> = {}

    if (!completeData.changes?.changes) {
      return fileDiffs
    }

    // Get commit information for generating proper diffs
    const commits = completeData.commits || []
    let baseCommit: string | undefined
    let targetCommit: string | undefined

    if (commits.length >= 2) {
      // Use the earliest and latest commits (reverse chronological order)
      baseCommit = commits[commits.length - 1].commitId  // Earliest commit
      targetCommit = commits[0].commitId  // Latest commit
    } else if (commits.length === 1) {
      // Single commit PR - use parent commit as base
      targetCommit = commits[0].commitId
      // For single commit, use the parent commit if available
      baseCommit = commits[0].parents?.[0] || commits[0].commitId
    }

    this.logger.info(`Using commits for diff generation - base: ${baseCommit?.substring(0, 8)}, target: ${targetCommit?.substring(0, 8)}`)

    // Limit to first 10 files for performance
    const changesToProcess = completeData.changes.changes.slice(0, 10)
    this.logger.info(`Generating diffs for ${changesToProcess.length} files`)

    // Process each changed file
    for (const change of changesToProcess) {
      if (!change.item?.path) continue

      let diff = ''
      let oldContent: string | null = null
      let newContent: string | null = null
      let diffGenerated = false

      // Try to get actual diff content using browser-friendly diff helper
      if (baseCommit && targetCommit) {
        try {
          const diffHelper = new AdoDiffHelper({
            client: client,
            workspaceManager: this.workspaceManager
          })

          const diffResult = await diffHelper.generateFileDiffWithContents(
            repository,
            baseCommit,
            targetCommit,
            change.item.path,
            change.changeType
          )
          diff = diffResult.diff
          oldContent = diffResult.oldContent
          newContent = diffResult.newContent
          diffGenerated = true
          this.logger.debug(`Generated diff for ${change.item.path}: ${diff.length} chars`)
        } catch (diffError) {
          this.logger.warn(`Failed to generate diff using helper for ${change.item.path}: ${diffError}`)
        }
      }

      // If we couldn't generate a real diff, use placeholder
      if (!diffGenerated) {
        this.logger.warn(`Using placeholder diff for ${change.item.path}`)
        if (change.changeType === 'add') {
          diff = `diff --git a${change.item.path} b${change.item.path}\nnew file mode 100644\n--- /dev/null\n+++ b${change.item.path}\n@@ File added @@\n`
        } else if (change.changeType === 'delete') {
          diff = `diff --git a${change.item.path} b${change.item.path}\ndeleted file mode 100644\n--- a${change.item.path}\n+++ /dev/null\n@@ File deleted @@\n`
        } else {
          diff = `diff --git a${change.item.path} b${change.item.path}\n--- a${change.item.path}\n+++ b${change.item.path}\n@@ File modified @@\n`
        }
      }

      // AdoDiffHelper handles version file saving when workspaceManager is provided
      // Only save manually for placeholder diffs when we have saveDirectory but no diff was generated
      if (saveDirectory && this.workspaceManager && !diffGenerated) {
        try {
          const safeFileName = change.item.path.replace(/[\/\\:*?"<>|]/g, '_').replace(/^_+/, '')

          // Save the placeholder diff
          const diffPath = await this.workspaceManager.saveContent(`versions/${safeFileName}.diff`, diff)
          this.logger.info(`Saved placeholder diff: ${diffPath}`)
        } catch (saveError) {
          this.logger.error(`Failed to save placeholder diff for ${change.item.path}: ${saveError}`)
        }
      }

      fileDiffs[change.item.path] = {
        diff,
        changeType: change.changeType,
        baseCommit,
        targetCommit
      }
    }

    return fileDiffs
  }

  /**
   * Get file content from a change object
   */
  private async getFileContentFromChange(change: any, version: 'old' | 'new'): Promise<string | null> {
    try {
      // Try to get content from the change object first
      if (version === 'new' && change.item?.content) {
        return change.item.content
      }

      // For more complex scenarios, we could make additional API calls
      // to get file content at specific commits, but for now we'll use a simplified approach
      // that generates a basic diff based on change type

      return null // Content not available in this simplified implementation
    } catch (error) {
      this.logger.warn(`Failed to get ${version} content for change: ${error}`)
      return null
    }
  }

  /**
   * Process ADO comments from PR data
   */
  private processAdoComments(prData: any): ADOComment[] {
    const adoComments: ADOComment[] = []

    // Process review comments (from PR threads)
    if (prData.reviewComments && Array.isArray(prData.reviewComments)) {
      for (const thread of prData.reviewComments) {
        if (thread.comments && Array.isArray(thread.comments)) {
          for (const comment of thread.comments) {
            // Skip comments with empty content
            const content = comment.content || comment.text || ''
            if (!content.trim()) {
              this.logger.debug(`Skipping empty comment ${comment.id} in review thread ${thread.id}`)
              continue
            }

            // Extract thread ID properly - prioritize actual threadId fields like the working script
            let threadId: string
            if (comment.adoThreadId && comment.adoThreadId !== 1) {
              threadId = comment.adoThreadId.toString()
            } else if (comment.threadId && comment.threadId !== 1) {
              threadId = comment.threadId.toString()
            } else if (thread.id && thread.id !== 1) {
              threadId = thread.id.toString()
            } else {
              // Fallback to '1' for main PR thread
              threadId = '1'
            }

            // Extract proper author name
            const authorName = comment.author?.displayName ||
                             comment.author?.uniqueName ||
                             comment.author?.name ||
                             'Unknown'

            const author: CommentAuthor = {
              type: 'user',
              name: authorName
            }

            const adoComment: ADOComment = {
              id: generateStableAdoId(comment, parseInt(threadId) || 0),
              threadId: threadId,
              message: content,
              author: author,
              createdAt: comment.publishedDate || new Date().toISOString(),
              file: thread.threadContext?.filePath,
              startLine: thread.threadContext?.rightFileStart?.line,
              endLine: thread.threadContext?.rightFileEnd?.line,
              isPublishedToADO: true,
              adoProperties: {
                threadId: threadId,
                commentId: comment.id?.toString(),
                publishedDate: comment.publishedDate
              }
            }

            adoComments.push(adoComment)
          }
        }
      }
    }

    // Process general comments if available (primary comment source from ADO API)
    if (prData.comments && Array.isArray(prData.comments)) {
      for (const comment of prData.comments) {
        // Skip comments with empty content
        const content = comment.content || comment.text || ''
        if (!content.trim()) {
          this.logger.debug(`Skipping empty general comment ${comment.id}`)
          continue
        }

        // Extract proper author name - ADO API returns author as string, not object
        const authorName = typeof comment.author === 'string' ? comment.author :
                         comment.author?.displayName ||
                         comment.author?.uniqueName ||
                         comment.author?.name ||
                         'Unknown'

        const author: CommentAuthor = {
          type: 'user',
          name: authorName
        }

        // Extract threadId directly from ADO API response - this is the actual thread ID
        const threadId = comment.threadId?.toString() || '1'

        const adoComment: ADOComment = {
          id: generateStableAdoId(comment, parseInt(threadId) || 0),
          threadId: threadId,
          message: content,
          author: author,
          createdAt: comment.publishedDate || new Date().toISOString(),
          file: comment.filePath,
          startLine: comment.lineStart,
          endLine: comment.lineEnd,
          isPublishedToADO: true,
          adoProperties: {
            threadId: threadId,
            commentId: comment.id?.toString(),
            publishedDate: comment.publishedDate
          }
        }

        adoComments.push(adoComment)
      }
    }

    this.logger.info(`Processed ${adoComments.length} ADO comments from PR (empty comments filtered out)`)
    return adoComments
  }

  /**
   * Process ADO data into standard format (extracted logic from original script)
   */
  private async processADOData(prData: any, options?: ContentFetchOptions): Promise<ContentData> {
    const processedFiles: ContentFile[] = []
    const diffs: DiffData[] = []
    let totalTokens = 0
    let totalSize = 0

    // Get skip patterns from options or use defaults
    const skipPatterns = options?.filters?.excludeFilePatterns
      ? options.filters.excludeFilePatterns.map(pattern => globToRegex(pattern))
      : DEFAULT_SKIP_PATTERNS

    const maxFileSize = options?.filters?.maxFileSize || 50000 // 50KB default

    this.logger.info(`Processing ${Object.keys(prData.fileDiffs || {}).length} files from ADO PR`)

    for (const [filePath, diffData] of Object.entries(prData.fileDiffs || {})) {
      const diff = (diffData as any)?.diff
      if (!diff || diff.trim().length === 0) {
        continue
      }

      const diffSize = diff.length
      const isSkipped = this.shouldSkipFile(filePath, skipPatterns)
      const isMassive = diffSize > maxFileSize

      if (isSkipped || isMassive) {
        this.logger.debug(`Skipping ${filePath}: ${isSkipped ? 'filtered file type' : 'massive diff'} (${diffSize} chars)`)
        continue
      }

      // Create content file
      const contentFile: ContentFile = {
        path: filePath,
        content: diff,
        size: diffSize,
        tokens: estimateTokens(diff),
        changeType: this.mapChangeType((diffData as any)?.changeType)
      }

      // Create diff data
      const diffEntry: DiffData = {
        file: filePath,
        diff: diff,
        changeType: contentFile.changeType || ChangeType.MODIFY,
        addedLines: this.countAddedLines(diff),
        removedLines: this.countRemovedLines(diff)
      }

      processedFiles.push(contentFile)
      diffs.push(diffEntry)
      totalTokens += contentFile.tokens
      totalSize += contentFile.size

      this.logger.debug(`Processed ${filePath}: ${diffSize} chars, ~${contentFile.tokens} tokens`)
    }

    if (processedFiles.length === 0) {
      throw new ContentSourceError('No reviewable files found after filtering')
    }

    // Process ADO comments
    const adoComments = this.processAdoComments(prData)

    return {
      files: processedFiles,
      diffs: diffs,
      adoComments: adoComments,
      totalSize: totalSize,
      totalTokens: totalTokens
    }
  }

  /**
   * Check if file should be skipped based on patterns
   */
  private shouldSkipFile(filePath: string, skipPatterns: RegExp[]): boolean {
    return skipPatterns.some(pattern => pattern.test(filePath))
  }

  /**
   * Map ADO change type to standard change type
   */
  private mapChangeType(adoChangeType: string): ChangeType {
    switch (adoChangeType?.toLowerCase()) {
      case 'add':
        return ChangeType.ADD
      case 'delete':
        return ChangeType.DELETE
      case 'rename':
        return ChangeType.RENAME
      case 'edit':
      case 'modify':
      default:
        return ChangeType.MODIFY
    }
  }

  /**
   * Count added lines in diff
   */
  private countAddedLines(diff: string): number {
    const lines = diff.split('\n')
    return lines.filter(line => line.startsWith('+')).length
  }

  /**
   * Count removed lines in diff
   */
  private countRemovedLines(diff: string): number {
    const lines = diff.split('\n')
    return lines.filter(line => line.startsWith('-')).length
  }

  /**
   * Extract metadata from ADO PR data
   */
  private extractMetadata(prData: any, adoInfo: { organization: string; project: string; repository: string; pullRequestId: number }): SourceMetadata {
    const identifier = `pr-${adoInfo.pullRequestId}`
    const source = `https://${adoInfo.organization}.visualstudio.com/${adoInfo.project}/_git/${adoInfo.repository}/pullrequest/${adoInfo.pullRequestId}`

    return {
      type: SourceType.ADO_PR,
      identifier,
      source,
      generatedAt: new Date().toISOString(),
      fetchOptions: {},
      title: prData.title,
      description: prData.description,
      author: prData.author,
      createdDate: prData.createdDate,
      modifiedDate: prData.modifiedDate || prData.createdDate,
      sourceBranch: prData.sourceBranch,
      targetBranch: prData.targetBranch,
      organization: adoInfo.organization,
      project: adoInfo.project,
      repository: adoInfo.repository
    }
  }


  /**
   * Check if ADO source is available
   */
  async isAvailable(identifier: string): Promise<boolean> {
    if (!this.validateIdentifier(identifier)) {
      return false
    }

    try {
      // Try to get credentials
      this.getCredentials()
      return true
    } catch {
      return false
    }
  }

  /**
   * Get source type
   */
  getSourceType(): SourceType {
    return SourceType.ADO_PR
  }

  /**
   * Publish a comment to ADO PR
   */
  async publishComment(
    adoUrl: string,
    commentId: string,
    workspaceDir?: string
  ): Promise<PublishResult> {
    try {
      if (!this.validateIdentifier(adoUrl)) {
        throw new ContentSourceError(`Invalid ADO PR URL: ${adoUrl}`)
      }

      const adoInfo = parseADOUrl(adoUrl)
      if (!adoInfo) {
        throw new ContentSourceError(`Invalid ADO PR URL format: ${adoUrl}`)
      }

      // Find the comment in workspace files
      const comment = await this.findCommentInWorkspace(commentId, workspaceDir)
      if (!comment) {
        throw new ContentSourceError(`Comment with ID ${commentId} not found in workspace`)
      }

      this.logger.info(`Publishing comment ${commentId} to ADO PR ${adoInfo.pullRequestId}`)

      // Update comment service configuration with actual organization and project
      const azureConfig: AzureDevOpsConfig = {
        organization: adoInfo.organization,
        project: adoInfo.project,
        pat: this.getCredentials().pat
      }

      const commentService = new CommentService(azureConfig)

      // Create thread context if the comment has file/line information
      let threadContext = undefined
      if (comment.file && comment.startLine) {
        // Ensure file path has leading slash for ADO
        const filePath = comment.file.startsWith('/') ? comment.file : `/${comment.file}`
        threadContext = commentService.createThreadContext({
          filePath: filePath,
          startLine: comment.startLine,
          endLine: comment.endLine || comment.startLine
        })
      }

      // Publish the comment using the CommentService
      const publishResult = await commentService.publishComment(
        adoInfo.repository,
        parseInt(adoInfo.pullRequestId),
        {
          content: comment.message || '',
          status: 'active',
          threadContext,
          stableId: commentId,
          isAIGenerated: true
        }
      )

      this.logger.info(`Successfully published comment ${commentId} to ADO, got threadId: ${publishResult.id}`)

      return {
        success: true,
        message: `Comment published successfully to ADO PR ${adoInfo.pullRequestId}`,
        adoCommentId: publishResult.comments?.[0]?.id?.toString(),
        adoThreadId: publishResult.id?.toString()
      }

    } catch (error) {
      this.logger.error(`Failed to publish comment to ADO: ${error}`)
      return {
        success: false,
        message: `Failed to publish comment: ${error}`
      }
    }
  }

  /**
   * Reply to an existing ADO comment thread
   */
  async replyToComment(
    adoUrl: string,
    threadId: string,
    replyContent: string,
    workspaceDir?: string
  ): Promise<ReplyResult> {
    try {
      if (!this.validateIdentifier(adoUrl)) {
        throw new ContentSourceError(`Invalid ADO PR URL: ${adoUrl}`)
      }

      const adoInfo = parseADOUrl(adoUrl)
      if (!adoInfo) {
        throw new ContentSourceError(`Invalid ADO PR URL format: ${adoUrl}`)
      }

      if (!replyContent.trim()) {
        throw new ContentSourceError(`Reply content cannot be empty`)
      }

      this.logger.info(`Replying to thread ${threadId} in ADO PR ${adoInfo.pullRequestId}`)

      // Update comment service configuration with actual organization and project
      const azureConfig: AzureDevOpsConfig = {
        organization: adoInfo.organization,
        project: adoInfo.project,
        pat: this.getCredentials().pat
      }

      const commentService = new CommentService(azureConfig)

      // Reply to the thread using CommentService
      const replyResult = await commentService.replyToThread(
        adoInfo.repository,
        parseInt(adoInfo.pullRequestId),
        parseInt(threadId),
        replyContent.trim()
      )

      this.logger.info(`Successfully replied to thread ${threadId}, got commentId: ${replyResult.id}`)

      return {
        success: true,
        message: `Reply posted successfully to thread ${threadId}`,
        adoCommentId: replyResult.id?.toString()
      }

    } catch (error) {
      this.logger.error(`Failed to reply to ADO thread: ${error}`)
      return {
        success: false,
        message: `Failed to reply to thread: ${error}`
      }
    }
  }

  /**
   * Find a comment in workspace files (review-results.json or review-index.json)
   */
  private async findCommentInWorkspace(
    commentId: string,
    workspaceDir?: string
  ): Promise<ReviewComment | null> {

    // Build search directories - handle both full paths and workspace names
    let searchDirs: string[] = []

    if (workspaceDir) {
      if (isAbsolute(workspaceDir)) {
        // Full absolute path provided
        searchDirs = [workspaceDir]
      } else if (this.workspaceManager) {
        // Use workspace manager to resolve workspace paths consistently
        const workspaceRoot = (this.workspaceManager as any).getWorkspaceRootDirectory?.()
        if (workspaceRoot) {
          // Try both the exact workspace ID and as a subdirectory
          searchDirs = [
            join(workspaceRoot, workspaceDir),
            (this.workspaceManager as any).getWorkspaceDirectory?.(workspaceDir) || workspaceDir
          ]
        } else {
          // Fallback to workspace name as-is
          searchDirs = [workspaceDir]
        }
      } else {
        // No workspace manager, try the workspace name as-is
        searchDirs = [workspaceDir]
      }
    } else if (this.workspaceManager) {
      // Use workspace manager's root directory
      const workspaceRoot = (this.workspaceManager as any).getWorkspaceRootDirectory?.()
      if (workspaceRoot) {
        searchDirs = [workspaceRoot]
      } else {
        // Fallback to common locations
        searchDirs = ['./workspace', './tmp']
      }
    } else {
      // No workspace manager, search common locations
      searchDirs = [
        './workspace',
        './tmp'
      ]
    }

    for (const dir of searchDirs) {
      try {
        // Try review-results.json first
        const resultsPath = join(dir, 'review-results.json')
        try {
          const resultsContent = await this.readFile(resultsPath)
          const resultsData = JSON.parse(resultsContent)

          if (resultsData.comments && Array.isArray(resultsData.comments)) {
            const comment = resultsData.comments.find((c: any) => c.id === commentId)
            if (comment) {
              this.logger.debug(`Found comment ${commentId} in ${resultsPath}`)
              return comment
            }
          }
        } catch {
          // File doesn't exist or invalid JSON, continue
        }

        // Try review-index.json
        const indexPath = join(dir, 'review-index.json')
        try {
          const indexContent = await this.readFile(indexPath)
          const indexData = JSON.parse(indexContent)

          if (indexData.comments && Array.isArray(indexData.comments)) {
            const comment = indexData.comments.find((c: any) => c.id === commentId)
            if (comment) {
              this.logger.debug(`Found comment ${commentId} in ${indexPath}`)
              return comment
            }
          }
        } catch {
          // File doesn't exist or invalid JSON, continue
        }

        // Try searching subdirectories for workspace patterns
        try {
          const entries = await this.listDirectory(dir)
          for (const entry of entries) {
            // Look for review-workflow- patterns OR any directory in reviews folder
            if (entry.startsWith('review-workflow-') || entry.startsWith('proof-test-') || entry.startsWith('ado-') || entry.startsWith('e2e-test-')) {
              const subDir = join(dir, entry)
              const comment = await this.findCommentInWorkspace(commentId, subDir)
              if (comment) {
                return comment
              }
            }
          }
        } catch {
          // Directory doesn't exist or permission denied, continue
        }

      } catch {
        // Directory doesn't exist, continue to next
      }
    }

    this.logger.warn(`Comment ${commentId} not found in any workspace files`)
    return null
  }

  /**
   * Publish a comment directly with message, file, and line information
   * This method publishes to ADO and updates the workspace JSON files
   */
  async publishDirectComment(
    adoUrl: string,
    message: string,
    file?: string,
    startLine?: number,
    endLine?: number,
    workspaceDir?: string
  ): Promise<PublishResult> {
    try {
      if (!this.validateIdentifier(adoUrl)) {
        throw new ContentSourceError(`Invalid ADO PR URL: ${adoUrl}`)
      }

      const adoInfo = parseADOUrl(adoUrl)
      if (!adoInfo) {
        throw new ContentSourceError(`Invalid ADO PR URL format: ${adoUrl}`)
      }

      if (!message.trim()) {
        throw new ContentSourceError(`Comment message cannot be empty`)
      }

      this.logger.info(`Publishing direct comment to ADO PR ${adoInfo.pullRequestId}`)

      // Update comment service configuration with actual organization and project
      const azureConfig: AzureDevOpsConfig = {
        organization: adoInfo.organization,
        project: adoInfo.project,
        pat: this.getCredentials().pat
      }

      const commentService = new CommentService(azureConfig)

      // Create thread context if file and line information is provided
      let threadContext = undefined
      if (file && startLine) {
        // Ensure file path has leading slash for ADO
        const filePath = file.startsWith('/') ? file : `/${file}`
        threadContext = commentService.createThreadContext({
          filePath: filePath,
          startLine: startLine,
          endLine: endLine || startLine
        })
      }

      // Generate a unique stable ID for this comment
      const stableId = `ai-direct-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      // Publish the comment using the CommentService
      const publishResult = await commentService.publishComment(
        adoInfo.repository,
        parseInt(adoInfo.pullRequestId),
        {
          content: message.trim(),
          status: 'active',
          threadContext,
          stableId,
          isAIGenerated: true
        }
      )

      this.logger.info(`Successfully published direct comment to ADO, got threadId: ${publishResult.id}`)

      // Now update the workspace JSON files with the published comment
      if (workspaceDir) {
        try {
          await this.updateWorkspaceWithPublishedComment(
            workspaceDir,
            {
              id: stableId,
              message,
              file,
              startLine,
              endLine,
              author: { type: 'ai', name: 'AI Assistant' },
              adoThreadId: publishResult.id?.toString(),
              adoCommentId: publishResult.comments?.[0]?.id?.toString(),
              publishedToADO: true,
              publishedAt: new Date().toISOString()
            }
          )
          this.logger.info(`Updated workspace JSON files with published comment`)
        } catch (updateError) {
          this.logger.warn(`Failed to update workspace files: ${updateError}`)
          // Don't fail the whole operation if JSON update fails
        }
      }

      // Fetch latest comments from ADO to ensure consistency
      try {
        const latestComments = await commentService.getAllComments(
          adoInfo.repository,
          parseInt(adoInfo.pullRequestId)
        )
        this.logger.info(`Fetched ${latestComments.length} threads from ADO after publishing`)
      } catch (fetchError) {
        this.logger.warn(`Failed to fetch latest comments: ${fetchError}`)
      }

      return {
        success: true,
        message: `Comment published successfully to ADO PR ${adoInfo.pullRequestId}`,
        adoCommentId: publishResult.comments?.[0]?.id?.toString(),
        adoThreadId: publishResult.id?.toString()
      }

    } catch (error) {
      this.logger.error(`Failed to publish direct comment to ADO: ${error}`)
      return {
        success: false,
        message: `Failed to publish comment: ${error}`
      }
    }
  }

  /**
   * Update workspace JSON files with published comment information
   */
  private async updateWorkspaceWithPublishedComment(
    workspaceDir: string,
    commentData: any
  ): Promise<void> {
    // Build search directories - handle both full paths and workspace names
    let searchDirs: string[] = []

    if (isAbsolute(workspaceDir)) {
      searchDirs = [workspaceDir]
    } else if (this.workspaceManager) {
      const workspaceRoot = (this.workspaceManager as any).getWorkspaceRootDirectory?.()
      if (workspaceRoot) {
        searchDirs = [
          join(workspaceRoot, workspaceDir),
          (this.workspaceManager as any).getWorkspaceDirectory?.(workspaceDir) || workspaceDir
        ]
      } else {
        searchDirs = [workspaceDir]
      }
    } else {
      searchDirs = [workspaceDir]
    }

    let updated = false

    for (const dir of searchDirs) {
      // Try to update review-index.json
      const indexPath = join(dir, 'review-index.json')
      try {
        const indexContent = await this.readFile(indexPath)
        const indexData = JSON.parse(indexContent)

        // Add to adoComments array
        if (!indexData.adoComments) {
          indexData.adoComments = []
        }
        indexData.adoComments.push(commentData)

        // Write back the updated JSON
        if (!this.fileOperationsClient) {
          throw new Error('FileOperationsClient is required for file operations')
        }
        await this.fileOperationsClient.writeFile(
          indexPath,
          JSON.stringify(indexData, null, 2),
          { encoding: 'utf8' }
        )
        this.logger.info(`Updated review-index.json with published comment`)
        updated = true
      } catch (error) {
        this.logger.debug(`Failed to update review-index.json: ${error}`)
      }

      // Also try to update review-results.json
      const resultsPath = join(dir, 'review-results.json')
      try {
        const resultsContent = await this.readFile(resultsPath)
        const resultsData = JSON.parse(resultsContent)

        // Mark the comment as published if it exists
        if (resultsData.comments && Array.isArray(resultsData.comments)) {
          const existingComment = resultsData.comments.find((c: any) =>
            c.message === commentData.message &&
            c.file === commentData.file &&
            c.startLine === commentData.startLine
          )

          if (existingComment) {
            existingComment.adoThreadId = commentData.adoThreadId
            existingComment.adoCommentId = commentData.adoCommentId
            existingComment.publishedToADO = true
            existingComment.publishedAt = commentData.publishedAt
          }
        }

        // Write back the updated JSON
        if (!this.fileOperationsClient) {
          throw new Error('FileOperationsClient is required for file operations')
        }
        await this.fileOperationsClient.writeFile(
          resultsPath,
          JSON.stringify(resultsData, null, 2),
          { encoding: 'utf8' }
        )
        this.logger.info(`Updated review-results.json with published comment`)
        updated = true
      } catch (error) {
        this.logger.debug(`Failed to update review-results.json: ${error}`)
      }

      if (updated) {
        break // Successfully updated at least one file
      }
    }

    if (!updated) {
      this.logger.warn(`Could not update any workspace JSON files`)
    }
  }

  /**
   * Find workspace file path for the reviewWorkspace parameter
   */
  private async findWorkspaceFile(workspaceDir?: string): Promise<string> {

    if (workspaceDir) {
      // Check if the provided directory has workspace files
      const reviewResultsPath = join(workspaceDir, 'review-results.json')
      const reviewIndexPath = join(workspaceDir, 'review-index.json')

      try {
        if (await this.fileExists(reviewResultsPath)) {
          return reviewResultsPath
        }
      } catch {
        // Try index file
      }

      try {
        if (await this.fileExists(reviewIndexPath)) {
          return reviewIndexPath
        }
      } catch {
        return workspaceDir
      }
    }

    // Search for workspace files using workspace manager or common locations
    let searchDirs: string[] = []

    if (this.workspaceManager) {
      // Use workspace manager's root directory
      const workspaceRoot = (this.workspaceManager as any).getWorkspaceRootDirectory?.()
      if (workspaceRoot) {
        searchDirs = [workspaceRoot]
      } else {
        // Fallback to common locations
        searchDirs = ['./workspace', './tmp']
      }
    } else {
      // No workspace manager, search common locations
      searchDirs = ['./workspace', './tmp']
    }

    for (const dir of searchDirs) {
      try {
        const entries = await this.listDirectory(dir)
        for (const entry of entries) {
          if (entry.startsWith('review-workflow-')) {
            const subDir = join(dir, entry)
            const reviewResultsPath = join(subDir, 'review-results.json')
            try {
              if (await this.fileExists(reviewResultsPath)) {
                return reviewResultsPath
              }
            } catch {
              // Continue searching
            }
          }
        }
      } catch {
        // Directory doesn't exist, continue
      }
    }

    // Fallback to current directory
    return './workspace'
  }

  /**
   * Helper method to read a file using FileOperationsClient or fs
   */
  private async readFile(filePath: string): Promise<string> {
    if (!this.fileOperationsClient) {
      throw new Error('FileOperationsClient is required for file operations')
    }
    return await this.fileOperationsClient.readFile(filePath, { encoding: 'utf8' })
  }

  /**
   * Helper method to check if a file exists using FileOperationsClient or fs
   */
  private async fileExists(filePath: string): Promise<boolean> {
    if (!this.fileOperationsClient) {
      throw new Error('FileOperationsClient is required for file operations')
    }
    return await this.fileOperationsClient.exists(filePath)
  }

  /**
   * Helper method to list directory contents using FileOperationsClient or fs
   */
  private async listDirectory(dirPath: string): Promise<string[]> {
    if (!this.fileOperationsClient) {
      throw new Error('FileOperationsClient is required for file operations')
    }
    const files = await this.fileOperationsClient.listDirectory(dirPath, { recursive: false })
    return files.map(f => f.name)
  }
}