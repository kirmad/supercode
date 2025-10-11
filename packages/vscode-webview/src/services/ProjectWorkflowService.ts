/**
 * ProjectWorkflowService - Review service using project-workflow package
 *
 * This service provides review functionality using the project-workflow package
 * with types and interfaces optimized for UI compatibility.
 */

import { WorkflowFactory, type WorkflowFactoryConfig } from '../../../project-workflow/src/core/workflow-factory.js'
import { GitApiClient } from '../../../project-workflow/src/core/git-client.js'
import { XMLTagParser } from '../../../project-workflow/src/core/xml-tag-parser.js'
import type { IOperationSubscriber } from '../../../project-workflow/src/core/interfaces.js'
import {
  SourceType,
  GitDiffType,
  CustomEvents,
  ChangeType
} from '../../../project-workflow/src/types/index.js'
import type {
  ReviewInput,
  ReviewResult as PWReviewResult,
  ReviewConfig,
  ReviewInsight as PWReviewInsight,
  ReviewHunk as PWReviewHunk,
  ReviewComment as PWReviewComment,
  GitDiffConfig,
  ExtractedTagData,
  NotificationMetadata,
  CustomEventType,
  CustomEventData,
  CustomEventCallback,
  FilesReadyPayload,
  ReviewStartedPayload,
  ReviewProgressPayload,
  ReviewErrorPayload,
  ReviewFileVersion,
  GenericEventData
} from '../../../project-workflow/src/types/index.js'
import { SuperCodeWebSocketClient } from "./SuperCodeWebSocketClient"
import { CommentThreadingService } from "./CommentThreadingService"
import { type CommentThreadInfo, type SavedComment } from "../types/CodeReview"

/**
 * Custom error for workspace not initialized state
 */
class WorkspaceNotInitializedError extends Error {
  constructor(message: string = 'Workspace manager not initialized') {
    super(message)
    this.name = 'WorkspaceNotInitializedError'
  }
}

/**
 * Types for UI compatibility - core review types and interfaces
 */
export interface ReviewInsight {
  type: 'security' | 'bug' | 'performance' | 'quality' | 'pattern'
  severity: 'high' | 'medium' | 'low'
  message: string
}

export interface Hunk {
  id?: string
  file: string
  start: number
  end: number
  category: 'feature' | 'bugfix' | 'refactor' | 'security-fix' | 'performance' | 'test'
  risk: 'high' | 'medium' | 'low'
  description: string
  needsAttention: boolean
  threadId?: string
  sessionId?: string
}

export interface Comment {
  id?: string
  file: string
  lines: {
    start: number
    end: number
  }
  type: 'issue' | 'suggestion' | 'praise'
  severity: 'high' | 'medium' | 'low'
  message: string
  fixCode?: string
  threadId?: string
  sessionId?: string
}

export interface ReviewResult {
  hunks: Hunk[]
  comments: Comment[]
}

export interface DiffFile {
  fileName: string
  path?: string  // For compatibility with DiffViewer
  oldFile?: string
  newFile?: string
  diff?: string
  patch?: string
  patches?: Array<{ 
    oldStart: number; 
    newStart: number; 
    lines: string[];
    newLines?: number; // For compatibility with getCodeContext
  }>  // For compatibility with DiffViewer
  additions?: number  // For compatibility with DiffViewer
  deletions?: number  // For compatibility with DiffViewer
  // Optional version file properties
  localContent?: string
  remoteContent?: string
  diffContent?: string
}

/**
 * ProjectWorkflowService - Main service class
 */
export class ProjectWorkflowService {
  private workflowFactory: WorkflowFactory
  private wsClient: SuperCodeWebSocketClient
  private threadingService: CommentThreadingService
  private xmlTagParser: XMLTagParser
  private operationSubscriber?: IOperationSubscriber
  private currentProcessor?: any

  private insights: ReviewInsight[] = []
  private receivedHunks: Hunk[] = []
  private receivedComments: Comment[] = []
  private reviewResult: ReviewResult | null = null
  private isReviewing = false
  private currentFiles: DiffFile[] = []
  private currentWorkflowId: string | null = null
  private processedHunkIds = new Set<string>()
  private processedCommentIds = new Set<string>()

  // Callbacks for UI updates
  private onInsightReceived?: (insight: ReviewInsight) => void
  private onHunkReceived?: (hunk: Hunk) => void
  private onCommentReceived?: (comment: Comment) => void
  private onReviewComplete?: (result: ReviewResult, filesWithVersions: DiffFile[]) => void
  private onProgressUpdate?: (message: string) => void
  private onError?: (error: string) => void
  private onFilesReady?: (files: DiffFile[]) => void
  private onThreadCreated?: (threadInfo: CommentThreadInfo) => void
  private onResponseReceived?: (response: any, threadId: string) => void
  private onAIResponseChunk?: (chunk: string, threadId: string) => void
  private onAIResponseComplete?: (fullContent: string, threadId: string) => void

  constructor(wsClient: SuperCodeWebSocketClient) {
    this.wsClient = wsClient
    this.threadingService = new CommentThreadingService(wsClient)
    this.xmlTagParser = new XMLTagParser()

    // Initialize WorkflowFactory with configuration from environment
    const factoryConfig: WorkflowFactoryConfig = {
      baseUrl: process.env.OPENCODE_BASE_URL || 'http://localhost:3000',
      adoCredentials: process.env.AZURE_DEVOPS_PAT ? {
        organization: process.env.ADO_ORGANIZATION || 'skype',
        pat: process.env.AZURE_DEVOPS_PAT
      } : undefined,
      defaults: {
        agent: 'build',
        outputFormat: 'xml',
        autoCleanup: true,
        maxParallelSessions: 3,
        timeoutPerShard: 300000,
        optimalTokensPerShard: 8000,
        maxTokensPerShard: 12000,
        minTokensPerShard: 2000
      }
    }

    this.workflowFactory = new WorkflowFactory(factoryConfig)

  }


  /**
   * Create a GitApiClient instance with current configuration
   */
  private createGitClient(): GitApiClient {
    // Get base URL from environment or use default
    const baseUrl = this.getBaseUrl()
    // In webview context, we need to get the workspace path differently
    const repositoryPath = this.getWorkspacePath()
    return new GitApiClient(baseUrl, repositoryPath)
  }

  /**
   * Get the base URL for the OpenCode API
   */
  private getBaseUrl(): string {
    // Try to get from environment variables if available
    if (typeof process !== 'undefined' && process.env?.OPENCODE_BASE_URL) {
      return process.env.OPENCODE_BASE_URL
    }

    // Try to get from window global if set by the extension
    if (typeof window !== 'undefined' && (window as any).OPENCODE_BASE_URL) {
      return (window as any).OPENCODE_BASE_URL
    }

    // Default fallback
    return 'http://localhost:3000'
  }

  /**
   * Get the current workspace path for the webview context
   */
  private getWorkspacePath(): string {
    // Try to get from VS Code workspace if available
    if (typeof window !== 'undefined' && (window as any).workspacePath) {
      return (window as any).workspacePath
    }

    // Fallback to current directory indicator for the API
    return '.'
  }

  /**
   * Set callback handlers for UI updates - maintain same interface
   */
  public setCallbacks(callbacks: {
    onInsightReceived?: (insight: ReviewInsight) => void
    onHunkReceived?: (hunk: Hunk) => void
    onCommentReceived?: (comment: Comment) => void
    onReviewComplete?: (result: ReviewResult, filesWithVersions: DiffFile[]) => void
    onProgressUpdate?: (message: string) => void
    onError?: (error: string) => void
    onFilesReady?: (files: DiffFile[]) => void
    onThreadCreated?: (threadInfo: CommentThreadInfo) => void
    onResponseReceived?: (response: any, threadId: string) => void
    onAIResponseChunk?: (chunk: string, threadId: string) => void
    onAIResponseComplete?: (fullContent: string, threadId: string) => void
  }) {
    this.onInsightReceived = callbacks.onInsightReceived
    this.onHunkReceived = callbacks.onHunkReceived
    this.onCommentReceived = callbacks.onCommentReceived
    this.onReviewComplete = callbacks.onReviewComplete
    this.onProgressUpdate = callbacks.onProgressUpdate
    this.onError = callbacks.onError
    this.onFilesReady = callbacks.onFilesReady
    this.onThreadCreated = callbacks.onThreadCreated
    this.onResponseReceived = callbacks.onResponseReceived
    this.onAIResponseChunk = callbacks.onAIResponseChunk
    this.onAIResponseComplete = callbacks.onAIResponseComplete
  }

  /**
   * Fetch git status - use project-workflow GitApiClient
   */
  public async fetchGitStatus(): Promise<{
    branch: string
    ahead: number
    behind: number
    modified: string[]
    staged: string[]
    untracked: string[]
  }> {
    try {
      // Create a GitApiClient instance
      const gitClient = this.createGitClient()

      // Get git status through the client
      const status = await gitClient.getStatus()

      return {
        branch: status.branch,
        ahead: status.ahead,
        behind: status.behind,
        modified: status.modified,
        staged: status.staged,
        untracked: status.untracked
      }
    } catch (error) {
      console.error('[ProjectWorkflowService] Failed to fetch git status:', error)
      throw error
    }
  }

  /**
   * Fetch git branches - use project-workflow GitApiClient
   */
  public async fetchGitBranches(): Promise<{ current: string; branches: string[] }> {
    try {
      // Create a GitApiClient instance
      const gitClient = this.createGitClient()

      // Get git branches through the client
      const branchesResponse = await gitClient.getBranches()

      return {
        current: branchesResponse.current,
        branches: branchesResponse.branches
      }
    } catch (error) {
      console.error('[ProjectWorkflowService] Failed to fetch git branches:', error)
      throw error
    }
  }

  /**
   * Fetch recent commits - use project-workflow GitApiClient
   */
  public async fetchRecentCommits(limit = 20, branch?: string): Promise<Array<{
    hash: string
    shortHash: string
    subject: string
    author: string
    date: string
  }>> {
    try {
      // Create a GitApiClient instance
      const gitClient = this.createGitClient()

      // Get commits through the client
      const commitsResponse = await gitClient.getCommits(limit, branch)

      return commitsResponse.commits.map(commit => ({
        hash: commit.hash,
        shortHash: commit.shortHash,
        subject: commit.subject,
        author: commit.author,
        date: commit.date
      }))
    } catch (error) {
      console.error('[ProjectWorkflowService] Failed to fetch commits:', error)
      return []
    }
  }

  /**
   * Fetch version files from workspace manager and map to DiffFile format
   */
  private async fetchVersionFilesFromWorkspace(processor: any): Promise<DiffFile[]> {
    try {
      const workspaceManager = processor.getWorkspaceManager()

      // Check if workspace manager is properly initialized
      if (!workspaceManager) {
        throw new WorkspaceNotInitializedError('Workspace manager is null or undefined')
      }

      const versionFiles = await workspaceManager.getAllVersionFiles()

      // If no version files are returned and this might be due to workspace not being ready
      if (!versionFiles || versionFiles.length === 0) {
        // Check if workspace manager has initialization methods/properties
        if (workspaceManager.isInitialized !== undefined && !workspaceManager.isInitialized) {
          throw new WorkspaceNotInitializedError('Workspace manager not yet initialized')
        }
        if (workspaceManager.workspaceReady !== undefined && !workspaceManager.workspaceReady) {
          throw new WorkspaceNotInitializedError('Workspace not ready')
        }
        // If getAllVersionFiles exists but returns empty, this might indicate initialization in progress
        if (typeof workspaceManager.getAllVersionFiles === 'function') {
          throw new WorkspaceNotInitializedError('Workspace manager returned no version files - may be initializing')
        }
      }

      return versionFiles.map((versionFile: { filePath: string; local: string | null; remote: string | null; diff: string | null }) => ({
        path: versionFile.filePath,
        fileName: versionFile.filePath.split('/').pop() || versionFile.filePath,
        localContent: versionFile.local,
        remoteContent: versionFile.remote,
        diffContent: versionFile.diff
      }))
    } catch (error) {
      // Re-throw WorkspaceNotInitializedError as-is
      if (error instanceof WorkspaceNotInitializedError) {
        throw error
      }

      // Check error messages for common workspace initialization issues
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('workspace') &&
          (errorMessage.includes('not initialized') ||
           errorMessage.includes('not ready') ||
           errorMessage.includes('initializing'))) {
        throw new WorkspaceNotInitializedError(`Workspace initialization error: ${errorMessage}`)
      }

      console.warn('[ProjectWorkflowService] Failed to fetch version files:', error)
      return []
    }
  }

  /**
   * Start a code review using project-workflow - main implementation
   */
  public async startReview(options: {
    diff?: string
    files?: DiffFile[]
    commitHash?: string
    sourceBranch?: string
    targetBranch?: string
    pullRequestUrl?: string
    staged?: boolean
  }): Promise<ReviewResult | null> {
    if (this.isReviewing) {
      this.onError?.("A review is already in progress")
      return null
    }

    try {
      this.isReviewing = true
      this.insights = []
      this.receivedHunks = []
      this.receivedComments = []
      this.reviewResult = null
      this.currentFiles = options.files || []
      this.processedHunkIds.clear()
      this.processedCommentIds.clear()

      // Generate workflow ID - for PRs, use the PR URL as the identifier
      // This ensures events are emitted and subscribed to the same topic
      if (options.pullRequestUrl) {
        this.currentWorkflowId = options.pullRequestUrl
      } else {
        this.currentWorkflowId = `review-${Date.now()}-${Math.random().toString(36).substring(2)}`
      }

      this.onProgressUpdate?.("Initializing project workflow...")

      // Set up operation subscription for real-time updates
      await this.setupOperationSubscription()

      // Emit REVIEW_STARTED event
      if (this.operationSubscriber && this.currentWorkflowId) {
        this.operationSubscriber.emitCustomEvent(
          this.currentWorkflowId,
          CustomEvents.REVIEW_STARTED,
          {
            reviewId: this.currentWorkflowId,
            reviewType: options.sourceBranch ? 'branch-diff' : 'commit',
            timestamp: new Date().toISOString()
          }
        )
      }


      // Determine review type and create appropriate workflow input
      let reviewInput: ReviewInput
      let processor: any

      if (options.sourceBranch && options.targetBranch) {
        // Branch comparison review
        const gitConfig: GitDiffConfig = {
          type: GitDiffType.BRANCH_DIFF,
          repositoryPath: this.getWorkspacePath(),
          fromBranch: options.sourceBranch,
          toBranch: options.targetBranch
        }

        processor = this.workflowFactory.createGitReviewWorkflow(gitConfig, {
          operationSubscriber: this.operationSubscriber
        })
        reviewInput = {
          identifier: this.currentWorkflowId,
          type: SourceType.GIT,
          metadata: {
            saveVersions: true,
            includeComments: true
          }
        }

        // Fetch version files early from workspace manager with retry
        this.onProgressUpdate?.("Loading files...")
        let earlyFiles: DiffFile[] = []
        try {
          for (let attempt = 1; attempt <= 5; attempt++) {
            console.log(`[ProjectWorkflowService] Version file loading attempt ${attempt}/5`)
            try {
              earlyFiles = await this.fetchVersionFilesFromWorkspace(processor)
              if (earlyFiles.length > 0) {
                console.log(`[ProjectWorkflowService] Version files loaded successfully on attempt ${attempt}`)
                this.currentFiles = earlyFiles
                this.onFilesReady?.(earlyFiles)

                // Emit FILES_READY event with type safety
                if (this.operationSubscriber && this.currentWorkflowId) {
                  this.operationSubscriber.emitCustomEvent(
                    this.currentWorkflowId,
                    CustomEvents.FILES_READY,
                    {
                      files: this.transformToReviewFileVersions(earlyFiles),
                      workspacePath: this.getWorkspacePath(),
                      reviewId: this.currentWorkflowId
                    }
                  )
                }
                break
              }
            } catch (fetchError) {
              if (fetchError instanceof WorkspaceNotInitializedError) {
                console.log(`[ProjectWorkflowService] Workspace not initialized on attempt ${attempt}, retrying...`)
                if (attempt < 5) {
                  await new Promise(resolve => setTimeout(resolve, 250))
                  continue
                }
              } else {
                // Non-workspace initialization error - don't retry
                console.warn('[ProjectWorkflowService] Non-retryable error fetching version files:', fetchError)
                break
              }
            }
            if (attempt < 5) {
              console.log(`[ProjectWorkflowService] No version files found, retrying in 250ms...`)
              await new Promise(resolve => setTimeout(resolve, 250))
            }
          }
          if (earlyFiles.length === 0) {
            console.warn('[ProjectWorkflowService] No version files found after 5 attempts')
          }
        } catch (error) {
          console.warn('[ProjectWorkflowService] Early version file loading failed:', error)
        }
      } else if (options.commitHash) {
        // Commit review
        const gitConfig: GitDiffConfig = {
          type: GitDiffType.COMMIT,
          repositoryPath: this.getWorkspacePath(),
          commit: options.commitHash
        }

        processor = this.workflowFactory.createGitReviewWorkflow(gitConfig, {
          operationSubscriber: this.operationSubscriber
        })
        reviewInput = {
          identifier: this.currentWorkflowId,
          type: SourceType.GIT,
          metadata: {
            saveVersions: true,
            includeComments: true
          }
        }

        // Fetch version files early from workspace manager with retry
        this.onProgressUpdate?.("Loading files...")
        let earlyFiles: DiffFile[] = []
        try {
          for (let attempt = 1; attempt <= 5; attempt++) {
            console.log(`[ProjectWorkflowService] Version file loading attempt ${attempt}/5`)
            try {
              earlyFiles = await this.fetchVersionFilesFromWorkspace(processor)
              if (earlyFiles.length > 0) {
                console.log(`[ProjectWorkflowService] Version files loaded successfully on attempt ${attempt}`)
                this.currentFiles = earlyFiles
                this.onFilesReady?.(earlyFiles)

                // Emit FILES_READY event with type safety
                if (this.operationSubscriber && this.currentWorkflowId) {
                  this.operationSubscriber.emitCustomEvent(
                    this.currentWorkflowId,
                    CustomEvents.FILES_READY,
                    {
                      files: this.transformToReviewFileVersions(earlyFiles),
                      workspacePath: this.getWorkspacePath(),
                      reviewId: this.currentWorkflowId
                    }
                  )
                }
                break
              }
            } catch (fetchError) {
              if (fetchError instanceof WorkspaceNotInitializedError) {
                console.log(`[ProjectWorkflowService] Workspace not initialized on attempt ${attempt}, retrying...`)
                if (attempt < 5) {
                  await new Promise(resolve => setTimeout(resolve, 250))
                  continue
                }
              } else {
                // Non-workspace initialization error - don't retry
                console.warn('[ProjectWorkflowService] Non-retryable error fetching version files:', fetchError)
                break
              }
            }
            if (attempt < 5) {
              console.log(`[ProjectWorkflowService] No version files found, retrying in 250ms...`)
              await new Promise(resolve => setTimeout(resolve, 250))
            }
          }
          if (earlyFiles.length === 0) {
            console.warn('[ProjectWorkflowService] No version files found after 5 attempts')
          }
        } catch (error) {
          console.warn('[ProjectWorkflowService] Early version file loading failed:', error)
        }
      } else if (options.pullRequestUrl) {
        // Pull request URL review
        this.onProgressUpdate?.("Fetching pull request data...")

        // Create review workflow with ADO PR support
        processor = this.workflowFactory.createReviewWorkflow({
          operationSubscriber: this.operationSubscriber
        })
        reviewInput = {
          identifier: options.pullRequestUrl,
          type: SourceType.ADO_PR,
          metadata: {
            saveVersions: true,
            includeComments: true
          }
        }

        // For ADO PRs, files will be available via FILES_READY event after content fetch
        // Don't try to fetch early - let the event system handle it
      } else if (options.staged) {
        // Staged changes review
        const gitConfig: GitDiffConfig = {
          type: GitDiffType.STAGED,
          repositoryPath: this.getWorkspacePath()
        }

        processor = this.workflowFactory.createGitReviewWorkflow(gitConfig, {
          operationSubscriber: this.operationSubscriber
        })
        reviewInput = {
          identifier: this.currentWorkflowId,
          type: SourceType.GIT,
          metadata: {
            saveVersions: true,
            includeComments: true
          }
        }

        // Fetch version files early from workspace manager with retry
        this.onProgressUpdate?.("Loading files...")
        let earlyFiles: DiffFile[] = []
        try {
          for (let attempt = 1; attempt <= 5; attempt++) {
            console.log(`[ProjectWorkflowService] Version file loading attempt ${attempt}/5`)
            try {
              earlyFiles = await this.fetchVersionFilesFromWorkspace(processor)
              if (earlyFiles.length > 0) {
                console.log(`[ProjectWorkflowService] Version files loaded successfully on attempt ${attempt}`)
                this.currentFiles = earlyFiles
                this.onFilesReady?.(earlyFiles)

                // Emit FILES_READY event with type safety
                if (this.operationSubscriber && this.currentWorkflowId) {
                  this.operationSubscriber.emitCustomEvent(
                    this.currentWorkflowId,
                    CustomEvents.FILES_READY,
                    {
                      files: this.transformToReviewFileVersions(earlyFiles),
                      workspacePath: this.getWorkspacePath(),
                      reviewId: this.currentWorkflowId
                    }
                  )
                }
                break
              }
            } catch (fetchError) {
              if (fetchError instanceof WorkspaceNotInitializedError) {
                console.log(`[ProjectWorkflowService] Workspace not initialized on attempt ${attempt}, retrying...`)
                if (attempt < 5) {
                  await new Promise(resolve => setTimeout(resolve, 250))
                  continue
                }
              } else {
                // Non-workspace initialization error - don't retry
                console.warn('[ProjectWorkflowService] Non-retryable error fetching version files:', fetchError)
                break
              }
            }
            if (attempt < 5) {
              console.log(`[ProjectWorkflowService] No version files found, retrying in 250ms...`)
              await new Promise(resolve => setTimeout(resolve, 250))
            }
          }
          if (earlyFiles.length === 0) {
            console.warn('[ProjectWorkflowService] No version files found after 5 attempts')
          }
        } catch (error) {
          console.warn('[ProjectWorkflowService] Early version file loading failed:', error)
        }
      } else {
        // Custom diff review - use regular review workflow with GIT type
        processor = this.workflowFactory.createReviewWorkflow({
          operationSubscriber: this.operationSubscriber
        })
        reviewInput = {
          identifier: this.currentWorkflowId,
          type: SourceType.GIT,
          metadata: {
            saveVersions: true,
            includeComments: true
          }
        }
      }

      this.onProgressUpdate?.("Processing review...")

      // Configure review settings
      const reviewConfig: Partial<ReviewConfig> = {
        agent: 'code-reviewer',
        outputFormat: 'xml',
        autoCleanup: false,
        saveVersions: true,  // Enable version file saving for FILES_READY event
        maxParallelSessions: 3,
        timeoutPerShard: 300000,
        operationSubscription: {
          enabled: true,
          tags: ['review-insight', 'hunk', 'comment']
        }
      }

      // Store processor instance for workspace access
      this.currentProcessor = processor

      // Process the review workflow
      const pwResult = await processor.process(reviewInput, reviewConfig)

      // Log topic sessions after processing to verify sessions were registered
      if (this.operationSubscriber && this.operationSubscriber.getTopicSessions) {
        const sessions = this.operationSubscriber.getTopicSessions(this.currentWorkflowId!)
        console.log(`[ProjectWorkflowService] Topic sessions after processing (${sessions.length} sessions):`, sessions)
      }

      // Transform project-workflow result to UI format
      this.reviewResult = this.transformReviewResult(pwResult)

      // Merge real-time items with final result
      this.reviewResult = this.mergeRealtimeItems(this.reviewResult)

      // Transform insights
      this.insights = this.transformInsights(pwResult.insights)

      // Refresh version files with any updates before completion
      let enrichedFiles: DiffFile[] = []
      try {
        const workspaceManager = processor.getWorkspaceManager()
        const versionFiles = await workspaceManager.getAllVersionFiles()
        
        // Create enriched files directly from version data (source of truth)
        enrichedFiles = versionFiles.map((versionFile: { filePath: string; local: string | null; remote: string | null; diff: string | null }) => ({
          path: versionFile.filePath,
          fileName: versionFile.filePath.split('/').pop() || versionFile.filePath,
          localContent: versionFile.local,
          remoteContent: versionFile.remote,
          diffContent: versionFile.diff
        }))
      } catch (error) {
        console.warn('[ProjectWorkflowService] Failed to fetch version files:', error)
        // If version fetching fails, we'll have no files to display
        // The UI will fall back to currentDiffFiles from the service
        enrichedFiles = []
      }

      // Notify UI of completion
      this.isReviewing = false
      this.onProgressUpdate?.("Review complete")
      this.onReviewComplete?.(this.reviewResult, enrichedFiles)

      return this.reviewResult

    } catch (error) {
      this.isReviewing = false
      this.onError?.(`Failed to start review: ${error}`)
      return null
    }
  }

  /**
   * Set up operation subscription for real-time updates
   */
  private async setupOperationSubscription(): Promise<void> {
    if (!this.currentWorkflowId) return

    try {
      // Create operation subscriber once from the factory and store it for sharing with processors
      this.operationSubscriber = this.workflowFactory.createOperationSubscriber()
      await this.operationSubscriber.startListening()

      // Subscribe to the current workflow topic with review tags
      const xmlSubscriptionId = this.operationSubscriber.subscribe(
        this.currentWorkflowId,
        ['review-insight', 'hunk', 'comment'],
        this.handleRealtimeUpdates.bind(this)
      )

      // Subscribe to FILES_READY event with type safety
      const filesReadySubscriptionId = this.operationSubscriber.subscribeToCustomEvents(
        this.currentWorkflowId,
        [CustomEvents.FILES_READY],
        async (eventData: GenericEventData<FilesReadyPayload>, metadata) => {
          console.log('[ProjectWorkflowService] 🔔 FILES_READY event received!', {
            eventType: eventData.type,
            topicId: metadata.topicId,
            currentWorkflowId: this.currentWorkflowId
          })
          if (eventData.type !== 'custom') return;
          try {
            // eventData.data.payload is automatically typed as FilesReadyPayload
            await this.handleFilesReadyEvent(eventData.data.payload)
          } catch (error) {
            console.error('[ProjectWorkflowService] Error handling FILES_READY event:', error)
          }
        }
      )

      // Subscribe to REVIEW_PROGRESS event with type safety
      const progressSubscriptionId = this.operationSubscriber.subscribeToCustomEvents(
        this.currentWorkflowId,
        [CustomEvents.REVIEW_PROGRESS],
        (eventData: GenericEventData<ReviewProgressPayload>, metadata) => {
          if (eventData.type !== 'custom') return;
          // eventData.data.payload is automatically typed as ReviewProgressPayload
          this.onProgressUpdate?.(eventData.data.payload.message)
        }
      )

      // Subscribe to REVIEW_ERROR event with type safety
      const errorSubscriptionId = this.operationSubscriber.subscribeToCustomEvents(
        this.currentWorkflowId,
        [CustomEvents.REVIEW_ERROR],
        (eventData: GenericEventData<ReviewErrorPayload>, metadata) => {
          if (eventData.type !== 'custom') return;
          // eventData.data.payload is automatically typed as ReviewErrorPayload
          this.onError?.(eventData.data.payload.error)
        }
      )

      console.log('[ProjectWorkflowService] Shared operation subscriptions set up:', {
        xmlSubscriptionId,
        filesReadySubscriptionId,
        progressSubscriptionId,
        errorSubscriptionId
      })

      // Log topic sessions for validation
      if (this.operationSubscriber.getTopicSessions) {
        console.log('[ProjectWorkflowService] Initial topic sessions:', this.operationSubscriber.getTopicSessions(this.currentWorkflowId))
      }
    } catch (error) {
      console.error('[ProjectWorkflowService] Failed to set up operation subscription:', error)
      // Don't throw - subscription is optional enhancement
    }
  }

  /**
   * Handle FILES_READY event with typed payload
   */
  private async handleFilesReadyEvent(payload: FilesReadyPayload): Promise<void> {
    console.log('[ProjectWorkflowService] ✅ FILES_READY event received:', {
      reviewId: payload.reviewId,
      fileCount: payload.files.length,
      workspacePath: payload.workspacePath
    })

    // Get enriched files with content from workspace manager
    let enrichedFiles: DiffFile[] = []
    try {
      if (!this.currentProcessor) {
        console.warn('[ProjectWorkflowService] No current processor available for fetching version files')
        return
      }

      const workspaceManager = this.currentProcessor.getWorkspaceManager()
      const versionFiles = await workspaceManager.getAllVersionFiles()

      // Create enriched files directly from version data (source of truth)
      enrichedFiles = versionFiles.map((versionFile: { filePath: string; local: string | null; remote: string | null; diff: string | null }) => ({
        path: versionFile.filePath,
        fileName: versionFile.filePath.split('/').pop() || versionFile.filePath,
        localContent: versionFile.local,
        remoteContent: versionFile.remote,
        diffContent: versionFile.diff
      }))

      console.log('[ProjectWorkflowService] Enriched files with content:', enrichedFiles.length)
    } catch (error) {
      console.warn('[ProjectWorkflowService] Failed to fetch version files from workspace manager:', error)
      return
    }

    // Update current files
    this.currentFiles = enrichedFiles

    // Notify UI with enriched files
    this.onFilesReady?.(enrichedFiles)

    console.log('[ProjectWorkflowService] Files ready event processed, UI notified with', enrichedFiles.length, 'files with content')
  }

  /**
   * Transform ReviewFileVersion[] to DiffFile[] format
   */
  private transformToDiffFiles(files: ReviewFileVersion[]): DiffFile[] {
    return files.map(file => ({
      fileName: file.filePath,
      path: file.filePath,
      oldFile: file.oldVersionPath,
      newFile: file.newVersionPath,
      diff: file.diffPath,
      additions: file.addedLines,
      deletions: file.removedLines
    }))
  }

  /**
   * Transform ReviewFileVersion[] to DiffFile[] format with content loading
   */
  private async transformToDiffFilesWithContent(files: ReviewFileVersion[], workspacePath: string): Promise<DiffFile[]> {
    const fs = await import('fs/promises')
    const path = await import('path')

    const diffFiles: DiffFile[] = []

    for (const file of files) {
      const diffFile: DiffFile = {
        fileName: file.filePath,
        path: file.filePath,
        oldFile: file.oldVersionPath,
        newFile: file.newVersionPath,
        diff: file.diffPath,
        additions: file.addedLines,
        deletions: file.removedLines
      }

      try {
        // Load file content from version paths
        if (file.oldVersionPath) {
          const oldPath = path.isAbsolute(file.oldVersionPath)
            ? file.oldVersionPath
            : path.join(workspacePath, file.oldVersionPath)
          try {
            diffFile.localContent = await fs.readFile(oldPath, 'utf-8')
          } catch (error) {
            console.warn(`[ProjectWorkflowService] Could not read old version: ${oldPath}`, error)
          }
        }

        if (file.newVersionPath) {
          const newPath = path.isAbsolute(file.newVersionPath)
            ? file.newVersionPath
            : path.join(workspacePath, file.newVersionPath)
          try {
            diffFile.remoteContent = await fs.readFile(newPath, 'utf-8')
          } catch (error) {
            console.warn(`[ProjectWorkflowService] Could not read new version: ${newPath}`, error)
          }
        }

        if (file.diffPath) {
          const diffPath = path.isAbsolute(file.diffPath)
            ? file.diffPath
            : path.join(workspacePath, file.diffPath)
          try {
            diffFile.diffContent = await fs.readFile(diffPath, 'utf-8')
          } catch (error) {
            console.warn(`[ProjectWorkflowService] Could not read diff: ${diffPath}`, error)
          }
        }

        console.log(`[ProjectWorkflowService] Loaded content for ${file.filePath}:`, {
          hasLocalContent: !!diffFile.localContent,
          hasRemoteContent: !!diffFile.remoteContent,
          hasDiffContent: !!diffFile.diffContent
        })

      } catch (error) {
        console.error(`[ProjectWorkflowService] Error loading content for ${file.filePath}:`, error)
      }

      diffFiles.push(diffFile)
    }

    return diffFiles
  }

  /**
   * Transform DiffFile[] to ReviewFileVersion[] format for event emission
   */
  private transformToReviewFileVersions(files: DiffFile[]): ReviewFileVersion[] {
    return files.map(file => ({
      filePath: file.fileName,
      safeFileName: file.fileName.replace(/[^a-zA-Z0-9._-]/g, '_'),
      oldVersionPath: file.oldFile,
      newVersionPath: file.newFile,
      diffPath: file.diff,
      changeType: 'modify' as ChangeType, // Default, could be enhanced
      addedLines: file.additions || 0,
      removedLines: file.deletions || 0,
      size: 0, // Not available in DiffFile
      tokens: 0 // Not available in DiffFile
    }))
  }

  /**
   * Handle real-time updates from operation subscription
   * Processes insights, hunks, and comments progressively as they stream in
   */
  private handleRealtimeUpdates(data: ExtractedTagData, metadata: NotificationMetadata): void {
    console.log('[ProjectWorkflowService] ✅ Real-time update received in CodeReviewTab UI:', {
      topicId: metadata.topicId,
      sessionId: metadata.sessionId,
      hasNewData: metadata.hasNewData,
      tags: Object.keys(data),
      insightCount: data['review-insight']?.length || 0,
      hunkCount: data['hunk']?.length || 0,
      commentCount: data['comment']?.length || 0,
      processedInsights: this.insights.length,
      processedHunks: this.receivedHunks.length,
      processedComments: this.receivedComments.length
    })

    // Optionally ensure session is registered to topic if not already present
    if (this.operationSubscriber && this.currentWorkflowId && metadata.sessionId) {
      try {
        this.operationSubscriber.addSessionToTopic(this.currentWorkflowId, metadata.sessionId)
      } catch (error) {
        console.debug('[ProjectWorkflowService] Session already registered or registration failed:', error)
      }
    }

    // Process real-time insights
    if (data['review-insight']) {
      for (const insightData of data['review-insight']) {
        try {
          const insight = this.parseRealtimeInsight(insightData)
          if (insight && !this.insights.some(i => i.message === insight.message)) {
            this.insights.push(insight)
            this.onInsightReceived?.(insight)
          }
        } catch (error) {
          console.error('[ProjectWorkflowService] Failed to parse real-time insight:', error)
        }
      }
    }

    // Process real-time hunks
    if (data['hunk'] && data['hunk'].length > 0) {
      try {
        for (const hunkXml of data['hunk']) {
          const hunk = this.parseRealtimeHunk(hunkXml)
          if (hunk) {
            const uniqueId = this.generateRealtimeHunkId(hunk.file, hunk.start, hunk.end)
            if (!this.processedHunkIds.has(uniqueId)) {
              this.processedHunkIds.add(uniqueId)
              this.receivedHunks.push(hunk)
              this.onHunkReceived?.(hunk)
              console.log('[ProjectWorkflowService] Processed real-time hunk:', {
                file: hunk.file,
                lines: `${hunk.start}-${hunk.end}`,
                category: hunk.category,
                risk: hunk.risk
              })
            }
          } else {
            console.error('[ProjectWorkflowService] Failed to parse hunk XML:', hunkXml)
          }
        }
      } catch (error) {
        console.error('[ProjectWorkflowService] Error processing real-time hunks:', error)
      }
    }

    // Process real-time comments
    if (data['comment'] && data['comment'].length > 0) {
      try {
        for (const commentXml of data['comment']) {
          const comment = this.parseRealtimeComment(commentXml)
          if (comment) {
            const uniqueKey = this.buildCommentKey(comment)
            if (!this.processedCommentIds.has(uniqueKey)) {
              this.processedCommentIds.add(uniqueKey)
              this.receivedComments.push(comment)
              this.onCommentReceived?.(comment)
              console.log('[ProjectWorkflowService] Processed real-time comment:', {
                file: comment.file,
                lines: `${comment.lines.start}-${comment.lines.end}`,
                type: comment.type,
                severity: comment.severity
              })
            }
          } else {
            console.error('[ProjectWorkflowService] Failed to parse comment XML:', commentXml)
          }
        }
      } catch (error) {
        console.error('[ProjectWorkflowService] Error processing real-time comments:', error)
      }
    }
  }

  /**
   * Parse real-time insight data
   */
  private parseRealtimeInsight(insightData: string): ReviewInsight | null {
    try {
      // Parse XML insight data to ReviewInsight format
      // XML parsing logic for real-time insight data
      return {
        type: 'quality',
        severity: 'medium',
        message: insightData
      }
    } catch (error) {
      console.error('[ProjectWorkflowService] Failed to parse insight:', error)
      return null
    }
  }

  /**
   * Parse real-time hunk XML data into Hunk object
   * Uses XMLTagParser for proper XML parsing with attributes
   */
  private parseRealtimeHunk(hunkXml: string): Hunk | null {
    try {
      // Extract hunk attributes from opening tag - using XMLTagParser for consistency
      const hunkMatch = hunkXml.match(/<hunk[^>]*file="([^"]*)"[^>]*start="([^"]*)"[^>]*end="([^"]*)"[^>]*>/)
      if (!hunkMatch) {
        console.warn('[ProjectWorkflowService] Failed to extract hunk attributes from XML:', hunkXml)
        return null
      }

      const [, file, startStr, endStr] = hunkMatch
      const start = parseInt(startStr, 10)
      const end = parseInt(endStr, 10)

      if (isNaN(start) || isNaN(end)) {
        console.warn('[ProjectWorkflowService] Invalid line numbers in hunk XML:', { start: startStr, end: endStr })
        return null
      }

      // Use XMLTagParser to extract nested tags properly
      const nestedTagsResult = this.xmlTagParser.extractTags(hunkXml, ['category', 'risk', 'description', 'needs-attention'])
      const tagData = nestedTagsResult.tagData

      const rawCategory = tagData.category?.[0] || ''
      const rawRisk = tagData.risk?.[0] || ''
      const description = tagData.description?.[0] || ''
      const needsAttention = (tagData['needs-attention']?.[0] || '').toLowerCase() === 'yes'

      // Transform using existing mapping methods
      const category = this.mapHunkCategory(rawCategory)
      const risk = this.mapRiskLevel(rawRisk)

      // Generate unique ID and thread ID
      const id = this.generateRealtimeHunkId(file, start, end)
      const threadId = `${file}-hunk-${start}-${end}`

      return {
        id,
        file,
        start,
        end,
        category,
        risk,
        description,
        needsAttention,
        threadId
      }
    } catch (error) {
      console.error('[ProjectWorkflowService] Failed to parse hunk XML:', error, hunkXml)
      return null
    }
  }

  /**
   * Parse real-time comment XML data into Comment object
   * Uses XMLTagParser for proper XML parsing with attributes
   */
  private parseRealtimeComment(commentXml: string): Comment | null {
    try {
      // Use XMLTagParser to extract nested tags properly
      const nestedTagsResult = this.xmlTagParser.extractTags(commentXml, ['file', 'lines', 'type', 'severity', 'message', 'fix-code'])
      const tagData = nestedTagsResult.tagData

      const file = tagData.file?.[0]?.trim() || ''
      if (!file) {
        console.warn('[ProjectWorkflowService] Missing file field in comment XML:', commentXml)
        return null
      }

      // Extract line numbers from lines tag attributes
      const linesMatch = commentXml.match(/<lines[^>]*start="([^"]*)"[^>]*end="([^"]*)"[^>]*\/>/)
      if (!linesMatch) {
        console.warn('[ProjectWorkflowService] Failed to extract line numbers from comment XML:', commentXml)
        return null
      }

      const startStr = linesMatch[1]
      const endStr = linesMatch[2]
      const start = parseInt(startStr, 10)
      const end = parseInt(endStr, 10)

      if (isNaN(start) || isNaN(end)) {
        console.warn('[ProjectWorkflowService] Invalid line numbers in comment XML:', { start: startStr, end: endStr })
        return null
      }

      const rawType = tagData.type?.[0]?.trim() || ''
      const rawSeverity = tagData.severity?.[0]?.trim() || ''
      const message = tagData.message?.[0]?.trim() || ''
      const fixCode = tagData['fix-code']?.[0]?.trim() || undefined

      // Transform using existing mapping methods
      const type = this.mapCommentType(rawType)
      const severity = this.mapSeverity(rawSeverity)

      // Generate unique ID and thread ID
      const id = this.generateRealtimeCommentId({ file, lines: { start, end } })
      const threadId = `${file}-${start}-${end}`

      return {
        id,
        file,
        lines: { start, end },
        type,
        severity,
        message,
        fixCode,
        threadId
      }
    } catch (error) {
      console.error('[ProjectWorkflowService] Failed to parse comment XML:', error, commentXml)
      return null
    }
  }

  /**
   * Generate unique identifier for hunks for real-time parsing
   */
  private generateRealtimeHunkId(file: string, start: number, end: number): string {
    return `${file}:${start}:${end}`
  }

  /**
   * Simple hash function for browser compatibility (replaces crypto.createHash)
   */
  private simpleHash(str: string): string {
    let hash = 0
    if (str.length === 0) return '0'
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).substring(0, 16)
  }

  /**
   * Build stable comment key for deduplication
   */
  private buildCommentKey(comment: Pick<Comment, 'file' | 'lines' | 'message'>): string {
    const normalizedMessage = comment.message?.replace(/\s+/g, ' ').trim() || ''
    const messageHash = this.simpleHash(normalizedMessage)
    return `${comment.file}:${comment.lines.start}:${comment.lines.end}:${messageHash}`
  }

  /**
   * Generate unique identifier for comments for real-time parsing
   */
  private generateRealtimeCommentId(comment: Pick<Comment, 'file' | 'lines'>): string {
    return `${comment.file}:${comment.lines.start}:${comment.lines.end}`
  }

  /**
   * Merge real-time received items with final review result
   * Ensures progressive items are not lost if they arrived before final aggregation
   */
  private mergeRealtimeItems(reviewResult: ReviewResult): ReviewResult {
    try {
      // Create sets of existing item IDs from final result for deduplication
      const existingHunkIds = new Set(
        reviewResult.hunks.map(hunk =>
          this.generateRealtimeHunkId(hunk.file, hunk.start, hunk.end)
        )
      )
      const existingCommentIds = new Set(
        reviewResult.comments.map(comment =>
          this.buildCommentKey(comment)
        )
      )

      // Filter real-time items to only include those not in final result
      const uniqueRealtimeHunks = this.receivedHunks.filter(hunk => {
        const id = this.generateRealtimeHunkId(hunk.file, hunk.start, hunk.end)
        return !existingHunkIds.has(id)
      })

      const uniqueRealtimeComments = this.receivedComments.filter(comment => {
        const key = this.buildCommentKey(comment)
        return !existingCommentIds.has(key)
      })

      // Merge unique real-time items with final result
      const mergedResult: ReviewResult = {
        hunks: [...reviewResult.hunks, ...uniqueRealtimeHunks],
        comments: [...reviewResult.comments, ...uniqueRealtimeComments]
      }

      console.log('[ProjectWorkflowService] Merged real-time items:', {
        finalHunks: reviewResult.hunks.length,
        finalComments: reviewResult.comments.length,
        realtimeHunks: this.receivedHunks.length,
        realtimeComments: this.receivedComments.length,
        uniqueRealtimeHunks: uniqueRealtimeHunks.length,
        uniqueRealtimeComments: uniqueRealtimeComments.length,
        totalHunks: mergedResult.hunks.length,
        totalComments: mergedResult.comments.length
      })

      return mergedResult
    } catch (error) {
      console.error('[ProjectWorkflowService] Error merging real-time items:', error)
      // Return original result if merge fails
      return reviewResult
    }
  }

  /**
   * Transform project-workflow ReviewResult to UI format
   */
  private transformReviewResult(pwResult: PWReviewResult): ReviewResult {
    return {
      hunks: this.transformHunks(pwResult.hunks),
      comments: this.transformComments(pwResult.comments)
    }
  }

  /**
   * Transform project-workflow insights to UI format
   */
  private transformInsights(pwInsights: PWReviewInsight[]): ReviewInsight[] {
    return pwInsights.map(pwInsight => ({
      type: this.mapInsightType(pwInsight.type),
      severity: this.mapSeverity(pwInsight.severity),
      message: pwInsight.content
    }))
  }

  /**
   * Transform project-workflow hunks to UI format
   */
  private transformHunks(pwHunks: PWReviewHunk[]): Hunk[] {
    return pwHunks.map(pwHunk => ({
      id: `hunk-${pwHunk.file}-${pwHunk.startLine}`,
      file: pwHunk.file,
      start: pwHunk.startLine,
      end: pwHunk.endLine,
      category: this.mapHunkCategory(pwHunk.category),
      risk: this.mapRiskLevel(pwHunk.risk),
      description: pwHunk.description,
      needsAttention: pwHunk.needsAttention,
      threadId: `${pwHunk.file}-hunk-${pwHunk.startLine}-${pwHunk.endLine}`
    }))
  }

  /**
   * Transform project-workflow comments to UI format
   */
  private transformComments(pwComments: PWReviewComment[]): Comment[] {
    return pwComments.map(pwComment => ({
      id: pwComment.id,
      file: pwComment.file,
      lines: {
        start: pwComment.startLine,
        end: pwComment.endLine
      },
      type: this.mapCommentType(pwComment.type),
      severity: this.mapSeverity(pwComment.severity),
      message: pwComment.message,
      fixCode: pwComment.fixCode,
      threadId: pwComment.threadId || `${pwComment.file}-${pwComment.startLine}-${pwComment.endLine}`
    }))
  }

  /**
   * Mapping functions for type conversions
   */
  private mapInsightType(pwType: any): ReviewInsight['type'] {
    const typeMap: Record<string, ReviewInsight['type']> = {
      'SECURITY': 'security',
      'PERFORMANCE': 'performance',
      'QUALITY': 'quality',
      'MAINTAINABILITY': 'quality'
    }
    return typeMap[pwType] || 'quality'
  }

  private mapSeverity(pwSeverity: any): 'high' | 'medium' | 'low' {
    const severityMap: Record<string, 'high' | 'medium' | 'low'> = {
      'CRITICAL': 'high',
      'HIGH': 'high',
      'MEDIUM': 'medium',
      'LOW': 'low'
    }
    return severityMap[pwSeverity] || 'medium'
  }

  private mapHunkCategory(pwCategory: any): Hunk['category'] {
    const categoryMap: Record<string, Hunk['category']> = {
      'SECURITY_FIX': 'security-fix',
      'PERFORMANCE_IMPROVEMENT': 'performance',
      'BUG_FIX': 'bugfix',
      'FEATURE_ADDITION': 'feature',
      'REFACTORING': 'refactor'
    }
    return categoryMap[pwCategory] || 'feature'
  }

  private mapRiskLevel(pwRisk: any): Hunk['risk'] {
    const riskMap: Record<string, Hunk['risk']> = {
      'CRITICAL': 'high',
      'HIGH': 'high',
      'MEDIUM': 'medium',
      'LOW': 'low'
    }
    return riskMap[pwRisk] || 'low'
  }

  private mapCommentType(pwType: any): Comment['type'] {
    const typeMap: Record<string, Comment['type']> = {
      'ISSUE': 'issue',
      'SUGGESTION': 'suggestion',
      'QUESTION': 'suggestion',
      'PRAISE': 'praise'
    }
    return typeMap[pwType] || 'suggestion'
  }

  /**
   * Cancel an ongoing review
   */
  public async cancelReview(): Promise<void> {
    if (this.isReviewing) {
      this.isReviewing = false

      // Clean up operation subscription
      if (this.operationSubscriber && this.currentWorkflowId) {
        try {
          // Find and unsubscribe from all subscriptions for this workflow
          const subscriptions = this.operationSubscriber.getActiveSubscriptions()
          for (const subscription of subscriptions) {
            if (subscription.topicId === this.currentWorkflowId) {
              this.operationSubscriber.unsubscribe(subscription.id)
            }
          }
          this.operationSubscriber.stopListening()
        } catch (error) {
          console.error('[ProjectWorkflowService] Error cleaning up subscription:', error)
        }
      }

      // Clean up real-time state
      this.receivedHunks = []
      this.receivedComments = []
      this.processedHunkIds.clear()
      this.processedCommentIds.clear()

      this.currentWorkflowId = null
      this.onProgressUpdate?.("Review cancelled")
    }
  }

  /**
   * Get current review state - maintain same interface
   */
  public getState() {
    return {
      isReviewing: this.isReviewing,
      insights: this.insights,
      reviewResult: this.reviewResult,
      files: this.currentFiles,
      hunks: this.receivedHunks,
      comments: this.receivedComments
    }
  }
  
  /**
   * Get current files
   */
  public getCurrentFiles(): DiffFile[] {
    return this.currentFiles
  }

  /**
   * Comment threading - delegate to threading service
   */
  public initializeCommentThreading(): void {
    this.threadingService.setCallbacks({
      onThreadCreated: (threadInfo: CommentThreadInfo) => {
        this.onThreadCreated?.(threadInfo)
      },
      onResponseReceived: (response, threadId) => {
        this.onResponseReceived?.(response, threadId)
      },
      onAIResponseChunk: (chunk, threadId) => {
        this.onAIResponseChunk?.(chunk, threadId)
      },
      onAIResponseComplete: (fullContent, threadId) => {
        this.onAIResponseComplete?.(fullContent, threadId)
      },
      onError: (error) => {
        this.onError?.(error)
      }
    })
  }

  public getCommentThreads() {
    return this.threadingService.getAllThreads()
  }

  public async addThreadResponse(threadId: string, content: string): Promise<void> {
    try {
      await this.threadingService.addUserResponseToThread(threadId, content, 'User')
    } catch (error) {
      this.onError?.(`Failed to add thread response: ${error}`)
    }
  }

  public async addCommentResponse(comment: Comment, content: string, userName: string = 'User'): Promise<void> {
    try {
      const savedComment: SavedComment = {
        ...comment,
        id: comment.id || this.generateCommentId(comment),
        threadId: comment.threadId || this.generateCommentThreadId(comment),
        status: 'open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        author: { type: 'ai', name: 'AI Assistant' },
        responses: []
      }

      const thread = await this.threadingService.findOrCreateThreadForComment(savedComment, content, userName)
      comment.threadId = thread.threadId
      if (thread.sessionId) {
        comment.sessionId = thread.sessionId
      }
    } catch (error) {
      this.onError?.(`Failed to add comment response: ${error}`)
    }
  }

  public async addHunkResponse(hunk: Hunk, content: string, userName: string = 'User'): Promise<void> {
    try {
      if (!hunk.id) {
        hunk.id = this.generateHunkId(hunk)
      }
      if (!hunk.threadId) {
        hunk.threadId = this.generateHunkThreadId(hunk)
      }

      const thread = await this.threadingService.findOrCreateHunkThread(hunk, content, userName)
      hunk.threadId = thread.threadId
      if (thread.sessionId) {
        hunk.sessionId = thread.sessionId
      }
    } catch (error) {
      this.onError?.(`Failed to add hunk response: ${error}`)
    }
  }

  public async updateThreadStatus(threadId: string, status: 'open' | 'resolved' | 'dismissed'): Promise<void> {
    try {
      const thread = this.threadingService.getAllThreads().find(t => t.threadId === threadId)
      if (thread) {
        console.log('Updating thread status:', threadId, status)
      }
    } catch (error) {
      this.onError?.(`Failed to update thread status: ${error}`)
    }
  }

  /**
   * Get current review metadata
   */
  public getCurrentReviewInfo() {
    return {
      id: this.currentWorkflowId,
      hasActiveReview: !!this.reviewResult
    }
  }

  /**
   * Utility methods for ID generation
   */
  private generateCommentId(comment: Comment): string {
    const random = Math.random().toString(36).substring(2, 11)
    const fileHash = comment.file.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8)
    return `comment-${fileHash}-${comment.lines.start}-${comment.lines.end}-${random}`
  }

  private generateCommentThreadId(comment: Comment): string {
    return `${comment.file}-${comment.lines.start}-${comment.lines.end}`
  }

  private generateHunkId(hunk: Hunk): string {
    const random = Math.random().toString(36).substring(2, 11)
    const fileHash = hunk.file.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8)
    return `hunk-${fileHash}-${hunk.start}-${hunk.end}-${random}`
  }

  private generateHunkThreadId(hunk: Hunk): string {
    return `${hunk.file}-hunk-${hunk.start}-${hunk.end}`
  }

  public getThreadingService(): CommentThreadingService {
    return this.threadingService
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    this.threadingService.cleanup()

    if (this.operationSubscriber) {
      this.operationSubscriber.stopListening()
    }
  }
}