/**
 * ProjectWorkflowService - Review service using project-workflow package
 *
 * This service provides review functionality using the project-workflow package
 * with types and interfaces optimized for UI compatibility.
 */

import { WorkflowFactory, type WorkflowFactoryConfig } from '../../../project-workflow/src/core/workflow-factory.js'
import { GitApiClient } from '../../../project-workflow/src/core/git-client.js'
import type { IOperationSubscriber } from '../../../project-workflow/src/core/interfaces.js'
import {
  SourceType,
  GitDiffType
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
  NotificationMetadata
} from '../../../project-workflow/src/types/index.js'
import { SuperCodeWebSocketClient } from "./SuperCodeWebSocketClient"
import { CommentThreadingService } from "./CommentThreadingService"
import { type CommentThreadInfo, type SavedComment } from "../types/CodeReview"

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
  private operationSubscriber?: IOperationSubscriber
  private currentProcessor?: any

  private insights: ReviewInsight[] = []
  private reviewResult: ReviewResult | null = null
  private isReviewing = false
  private currentFiles: DiffFile[] = []
  private currentWorkflowId: string | null = null

  // Callbacks for UI updates
  private onInsightReceived?: (insight: ReviewInsight) => void
  private onReviewComplete?: (result: ReviewResult, filesWithVersions: DiffFile[]) => void
  private onProgressUpdate?: (message: string) => void
  private onError?: (error: string) => void
  private onThreadCreated?: (threadInfo: CommentThreadInfo) => void
  private onResponseReceived?: (response: any, threadId: string) => void
  private onAIResponseChunk?: (chunk: string, threadId: string) => void
  private onAIResponseComplete?: (fullContent: string, threadId: string) => void

  constructor(wsClient: SuperCodeWebSocketClient) {
    this.wsClient = wsClient
    this.threadingService = new CommentThreadingService(wsClient)

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
    onReviewComplete?: (result: ReviewResult, filesWithVersions: DiffFile[]) => void
    onProgressUpdate?: (message: string) => void
    onError?: (error: string) => void
    onThreadCreated?: (threadInfo: CommentThreadInfo) => void
    onResponseReceived?: (response: any, threadId: string) => void
    onAIResponseChunk?: (chunk: string, threadId: string) => void
    onAIResponseComplete?: (fullContent: string, threadId: string) => void
  }) {
    this.onInsightReceived = callbacks.onInsightReceived
    this.onReviewComplete = callbacks.onReviewComplete
    this.onProgressUpdate = callbacks.onProgressUpdate
    this.onError = callbacks.onError
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
      this.reviewResult = null
      this.currentFiles = options.files || []

      // Generate workflow ID
      this.currentWorkflowId = `review-${Date.now()}-${Math.random().toString(36).substring(2)}`

      this.onProgressUpdate?.("Initializing project workflow...")

      // Set up operation subscription for real-time updates
      await this.setupOperationSubscription()

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

        processor = this.workflowFactory.createGitReviewWorkflow(gitConfig)
        reviewInput = {
          identifier: this.currentWorkflowId,
          type: SourceType.GIT,
          metadata: {
            saveVersions: true,
            includeComments: true
          }
        }
      } else if (options.commitHash) {
        // Commit review
        const gitConfig: GitDiffConfig = {
          type: GitDiffType.COMMIT,
          repositoryPath: this.getWorkspacePath(),
          commit: options.commitHash
        }

        processor = this.workflowFactory.createGitReviewWorkflow(gitConfig)
        reviewInput = {
          identifier: this.currentWorkflowId,
          type: SourceType.GIT,
          metadata: {
            saveVersions: true,
            includeComments: true
          }
        }
      } else if (options.pullRequestUrl) {
        // Pull request URL review
        this.onProgressUpdate?.("Fetching pull request data...")

        // For now, treat PR URL as a custom input until we implement PR API integration
        processor = this.workflowFactory.createReviewWorkflow()
        reviewInput = {
          identifier: this.currentWorkflowId,
          type: SourceType.ADO_PR,
          metadata: {
            saveVersions: true,
            includeComments: true,
            pullRequestUrl: options.pullRequestUrl
          }
        }

        // TODO: Add actual PR API integration to fetch diff data
        this.onError?.("Pull request URL support is coming soon! Please use other review types for now.")
        return null
      } else if (options.staged) {
        // Staged changes review
        const gitConfig: GitDiffConfig = {
          type: GitDiffType.STAGED,
          repositoryPath: this.getWorkspacePath()
        }

        processor = this.workflowFactory.createGitReviewWorkflow(gitConfig)
        reviewInput = {
          identifier: this.currentWorkflowId,
          type: SourceType.GIT,
          metadata: {
            saveVersions: true,
            includeComments: true
          }
        }
      } else {
        // Custom diff review - use regular review workflow with GIT type
        processor = this.workflowFactory.createReviewWorkflow()
        reviewInput = {
          identifier: this.currentWorkflowId,
          type: SourceType.GIT,
          metadata: {
            saveVersions: true,
            includeComments: true
          }
        }
      }

      this.onProgressUpdate?.("Processing review with project workflow...")

      // Configure review settings
      const reviewConfig: Partial<ReviewConfig> = {
        agent: 'code-reviewer',
        outputFormat: 'xml',
        autoCleanup: false,
        maxParallelSessions: 3,
        timeoutPerShard: 300000
      }

      // Store processor instance for workspace access
      this.currentProcessor = processor

      // Process the review workflow
      const pwResult = await processor.process(reviewInput, reviewConfig)

      // Transform project-workflow result to UI format
      this.reviewResult = this.transformReviewResult(pwResult)

      // Transform insights
      this.insights = this.transformInsights(pwResult.insights)

      // Fetch version files before cleanup
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
      // Create operation subscriber
      this.operationSubscriber = this.workflowFactory.createOperationSubscriber()
      await this.operationSubscriber.startListening()

      // Subscribe to review tags
      const subscriptionId = this.operationSubscriber.subscribe(
        this.currentWorkflowId,
        ['review-insight', 'hunk', 'comment'],
        this.handleRealtimeUpdates.bind(this)
      )

      console.log('[ProjectWorkflowService] Operation subscription set up:', subscriptionId)
    } catch (error) {
      console.error('[ProjectWorkflowService] Failed to set up operation subscription:', error)
      // Don't throw - subscription is optional enhancement
    }
  }

  /**
   * Handle real-time updates from operation subscription
   */
  private handleRealtimeUpdates(data: ExtractedTagData, metadata: NotificationMetadata): void {
    console.log('[ProjectWorkflowService] Real-time update received:', {
      topicId: metadata.topicId,
      hasNewData: metadata.hasNewData,
      tags: Object.keys(data)
    })

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

    // Process real-time hunks and comments
    if (data['hunk'] || data['comment']) {
      // For real-time updates, we could update individual hunks/comments
      // For now, we'll just log them
      console.log('[ProjectWorkflowService] Real-time hunks/comments:', {
        hunks: data['hunk']?.length || 0,
        comments: data['comment']?.length || 0
      })
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
      files: this.currentFiles
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
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 11)
    const fileHash = comment.file.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8)
    return `comment-${fileHash}-${comment.lines.start}-${timestamp}-${random}`
  }

  private generateCommentThreadId(comment: Comment): string {
    return `${comment.file}-${comment.lines.start}-${comment.lines.end}`
  }

  private generateHunkId(hunk: Hunk): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 11)
    const fileHash = hunk.file.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8)
    return `hunk-${fileHash}-${hunk.start}-${timestamp}-${random}`
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