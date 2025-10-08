/**
 * Type definitions for the Project Workflow system
 */

// ========== Enums ==========

export enum SourceType {
  GIT = 'git',
  ADO_PR = 'ado-pr',
  GITHUB_PR = 'github-pr',
  LOCAL = 'local'
}

export enum ChangeType {
  ADD = 'add',
  MODIFY = 'modify',
  DELETE = 'delete',
  RENAME = 'rename'
}

export enum ShardingStrategyType {
  FILE_BOUNDARY = 'file_boundary',
  TOKEN_BASED = 'token_based',
  LINE_BASED = 'line_based'
}

export enum ProcessingStatus {
  IDLE = 'idle',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ERROR = 'error'
}

export enum SeverityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum InsightType {
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  QUALITY = 'quality',
  MAINTAINABILITY = 'maintainability'
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum CommentType {
  ISSUE = 'issue',
  SUGGESTION = 'suggestion',
  QUESTION = 'question',
  PRAISE = 'praise'
}

export enum HunkCategory {
  SECURITY_FIX = 'security-fix',
  PERFORMANCE_IMPROVEMENT = 'performance-improvement',
  BUG_FIX = 'bug-fix',
  FEATURE_ADDITION = 'feature-addition',
  REFACTORING = 'refactoring',
  DOCUMENTATION = 'documentation'
}

export enum OutputFormat {
  JSON = 'json',
  XML = 'xml',
  YAML = 'yaml'
}

export enum WorkflowType {
  REVIEW = 'review',
  ANALYSIS = 'analysis',
  REFACTOR = 'refactor'
}

export enum GitDiffType {
  STAGED = 'staged',
  UNPUSHED = 'unpushed',
  COMMIT = 'commit',
  COMMIT_RANGE = 'commit-range',
  BRANCH_DIFF = 'branch-diff'
}

// ========== Base Types ==========

/**
 * Base workflow input
 */
export interface WorkflowInput {
  identifier: string
  type: SourceType
  metadata?: Record<string, any>
}

/**
 * Base workflow result
 */
export interface WorkflowResult {
  success: boolean
  metadata: WorkflowMetadata
  statistics: ProcessingStatistics
  workspace?: string
}

/**
 * Workflow metadata
 */
export interface WorkflowMetadata {
  type: string
  version: string
  capabilities: string[]
  generatedAt: string
  processingStats: ProcessingStatistics
}

/**
 * Processing statistics
 */
export interface ProcessingStatistics {
  totalShards: number
  successfulShards: number
  failedShards: number
  totalProcessingTime: number
  averageShardTime: number
  parallelProcessing: boolean
}

// ========== Configuration Types ==========

/**
 * Base workflow configuration
 */
export interface WorkflowConfig {
  baseUrl: string
  maxParallelSessions: number
  timeoutPerShard: number
  workspace?: string
  autoCleanup?: boolean
  logging?: LoggingConfig

  // Sub-configurations
  sharding: ShardingConfig
  processing: ProcessingConfig
  aggregation: AggregationConfig
}

/**
 * Sharding configuration
 */
export interface ShardingConfig {
  strategy: ShardingStrategyType
  targetTokens: number
  maxTokens: number
  minTokens: number
  preserveBoundaries: boolean
}

/**
 * Processing configuration
 */
export interface ProcessingConfig {
  batchSize: number
  retryAttempts: number
  retryDelay: number
  timeout: number
}

/**
 * Aggregation configuration
 */
export interface AggregationConfig {
  outputFormat: OutputFormat
  includeMetadata: boolean
  includeStatistics: boolean
  sortResults: boolean
}

/**
 * Workspace configuration
 */
export interface WorkspaceConfig {
  prefix: string
  cleanup: boolean
  preserveVersions?: boolean
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error'
  format: 'text' | 'json'
  destination?: string
}

/**
 * Git diff configuration for different scenarios
 */
export interface GitDiffConfig {
  type: GitDiffType
  repositoryPath: string

  // Scenario-specific fields
  commit?: string              // For single commit
  fromCommit?: string          // For commit range
  toCommit?: string           // For commit range
  fromBranch?: string         // For branch diff
  toBranch?: string           // For branch diff
  remoteName?: string         // For unpushed changes (default: 'origin')
  baseBranch?: string         // For unpushed changes (default: 'main')
}

/**
 * Git workflow configuration extending base workflow config
 */
export interface GitWorkflowConfig extends WorkflowConfig {
  type: 'git-diff'
  diff: GitDiffConfig
}

// ========== Content Types ==========

/**
 * Source content structure
 */
export interface SourceContent {
  content: ContentData
  metadata: {
    type: string
    identifier: string
    source: string
    generatedAt: string
    fetchOptions: Record<string, any>
    title?: string
    description?: string
    author?: string
    createdDate?: string
    modifiedDate?: string
    sourceBranch?: string
    targetBranch?: string
    organization?: string
    project?: string
    repository?: string
  }
}

/**
 * Source metadata
 */
export interface SourceMetadata {
  type: string
  identifier: string
  source: string
  generatedAt: string
  fetchOptions: Record<string, any>
  title?: string
  description?: string
  author?: string
  createdDate?: string
  modifiedDate?: string
  sourceBranch?: string
  targetBranch?: string
  organization?: string
  project?: string
  repository?: string
}

/**
 * Content data
 */
export interface ContentData {
  files: ContentFile[]
  diffs?: DiffData[]
  adoComments?: ADOComment[]
  totalSize?: number
  totalTokens: number
}

/**
 * Individual content file
 */
export interface ContentFile {
  path: string
  content: string
  size: number
  tokens: number
  changeType?: ChangeType
}

/**
 * Diff data
 */
export interface DiffData {
  file: string
  diff: string
  changeType: ChangeType
  addedLines: number
  removedLines: number
}

/**
 * Content fetch options
 */
export interface ContentFetchOptions {
  includeVersions?: boolean
  saveDirectory?: string
  filters?: ContentFilters
}

/**
 * Content filters
 */
export interface ContentFilters {
  includeFilePatterns?: string[]
  excludeFilePatterns?: string[]
  maxFileSize?: number
}

// ========== Shard Types ==========

/**
 * Processing shard
 */
export interface Shard {
  index: number
  files: ContentFile[]
  content: string
  tokens: number
  metadata: ShardMetadata
}

/**
 * Shard metadata
 */
export interface ShardMetadata {
  fileCount: number
  strategy: string
  createdAt: string
  estimatedProcessingTime?: number
}

/**
 * Shard processing result
 */
export interface ShardResult {
  shardIndex: number
  success: boolean
  result?: any
  error?: Error
  processingTime: number
  metadata: Record<string, any>
}

/**
 * Sharding strategy metadata
 */
export interface ShardingStrategyMetadata {
  type: ShardingStrategyType
  description: string
  capabilities: string[]
  recommendedUse: string[]
}

/**
 * Aggregation statistics
 */
export interface AggregationStatistics {
  totalResults: number
  successfulResults: number
  failedResults: number
  averageProcessingTime: number
  aggregationTime: number
}

/**
 * Workspace statistics
 */
export interface WorkspaceStatistics {
  workspaceId: string
  filesStored: number
  totalSize: number
  createdAt: string
}

// ========== Function Types ==========

/**
 * Shard processor function type
 */
export type ShardProcessor = (shard: Shard, config: ProcessingConfig) => Promise<ShardResult>

// ========== Review-Specific Types ==========

/**
 * Review workflow input
 */
export interface ReviewInput extends WorkflowInput {
  type: SourceType.GIT | SourceType.ADO_PR
  metadata?: {
    saveVersions?: boolean
    includeComments?: boolean
    filters?: ReviewFilters
  }
}

/**
 * Review workflow result
 */
export interface ReviewResult extends WorkflowResult {
  insights: ReviewInsight[]
  hunks: ReviewHunk[]
  comments: ReviewComment[]
  adoComments?: ADOComment[]
}

/**
 * Review configuration
 */
export interface ReviewConfig extends WorkflowConfig {
  optimalTokensPerShard: number
  maxTokensPerShard: number
  minTokensPerShard: number
  agent: string
  outputFormat: 'xml' | 'json'
  includeFilePatterns?: string[]
  excludeFilePatterns?: string[]
  maxFileSize?: number
  adoCredentials?: ADOCredentials
  saveVersions?: boolean
  /** Operation subscription configuration */
  operationSubscription?: {
    /** Enable real-time operation subscription */
    enabled: boolean
    /** XML tags to monitor (defaults to ['review-insight', 'hunk', 'comment']) */
    tags?: string[]
    /** Enable real-time updates during processing */
    realtimeUpdates?: boolean
  }
}

/**
 * Review filters
 */
export interface ReviewFilters {
  includeFilePatterns?: string[]
  excludeFilePatterns?: string[]
  maxFileSize?: number
  changeTypesOnly?: ChangeType[]
}

/**
 * Review insight
 */
export interface ReviewInsight {
  shard: number
  type: InsightType
  severity: SeverityLevel
  content: string
}

/**
 * Review hunk
 */
export interface ReviewHunk {
  shard: number
  file: string
  startLine: number
  endLine: number
  category: HunkCategory
  risk: RiskLevel
  description: string
  needsAttention: boolean
}

/**
 * Review comment
 */
export interface ReviewComment {
  shard: number
  file: string
  startLine: number
  endLine: number
  type: CommentType
  severity: SeverityLevel
  message: string
  fixCode?: string
  threadId?: string

  // Metadata
  id: string
  author: CommentAuthor
  createdAt: string
  responses?: CommentResponse[]
}

/**
 * Comment author
 */
export interface CommentAuthor {
  type: 'ai' | 'user'
  name: string
}

/**
 * Comment response
 */
export interface CommentResponse {
  id: string
  author: CommentAuthor
  content: string
  createdAt: string
  shard?: number
}

/**
 * ADO comment (from existing PR)
 */
export interface ADOComment {
  id: string
  threadId: string
  message: string
  author: CommentAuthor
  createdAt: string
  file?: string
  startLine?: number
  endLine?: number
  isPublishedToADO?: boolean
  adoProperties?: {
    threadId: string
    commentId?: string
    publishedDate?: string
  }
}

/**
 * Result of publishing a comment to ADO
 */
export interface PublishResult {
  success: boolean
  message: string
  adoCommentId?: string
  adoThreadId?: string
}

/**
 * Result of replying to an ADO comment thread
 */
export interface ReplyResult {
  success: boolean
  message: string
  adoCommentId?: string
}

/**
 * ADO credentials
 */
export interface ADOCredentials {
  pat: string
  organization: string
}

/**
 * Review index metadata (for review-index.json)
 */
export interface ReviewIndex {
  source: string
  prUrl?: string
  prId?: number
  organization?: string
  project?: string
  repository?: string
  title?: string
  description?: string
  author?: string
  createdDate?: string
  sourceBranch?: string
  targetBranch?: string
  totalFiles: number
  skippedFiles?: number
  files: {
    path: string
    changeType: ChangeType
    size: number
    tokens: number
    localDiffFile?: string
  }[]
  fullDiffFile?: string
  totalTokens: number
  shardStrategy: {
    algorithm: string
    totalShards: number
    targetTokensPerShard: number
    actualTokensPerShard: number[]
    maxParallelSessions: number
  }
  shards: {
    index: number
    files: string[]
    tokenCount: number
    completed: boolean
  }[]
  adoComments: ADOComment[]
  createdAt: string
}

/**
 * Git review index metadata extending ReviewIndex
 */
export interface GitReviewIndex extends Omit<ReviewIndex, 'source'> {
  source: 'git-diff'
  diffType: GitDiffType
  repository: string
  gitMetadata: {
    commit?: string
    fromCommit?: string
    toCommit?: string
    fromBranch?: string
    toBranch?: string
    author?: string
    commitMessage?: string
    timestamp: string
  }
}

// ========== Error Types ==========

/**
 * Base workflow error
 */
export class WorkflowError extends Error {
  public readonly code: string
  public readonly context?: Record<string, any>

  constructor(message: string, code: string, context?: Record<string, any>) {
    super(message)
    this.name = 'WorkflowError'
    this.code = code
    this.context = context
  }
}

/**
 * Content source error
 */
export class ContentSourceError extends WorkflowError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'CONTENT_SOURCE_ERROR', context)
    this.name = 'ContentSourceError'
  }
}

/**
 * Processing error
 */
export class ProcessingError extends WorkflowError {
  public readonly partialResults?: ShardResult[]

  constructor(message: string, partialResults?: ShardResult[], context?: Record<string, any>) {
    super(message, 'PROCESSING_ERROR', context)
    this.name = 'ProcessingError'
    this.partialResults = partialResults
  }
}

/**
 * Validation error
 */
export class ValidationError extends WorkflowError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', context)
    this.name = 'ValidationError'
  }
}

/**
 * Git operation error
 */
export class GitError extends WorkflowError {
  public readonly gitCommand?: string

  constructor(message: string, gitCommand?: string, context?: Record<string, any>) {
    super(message, 'GIT_ERROR', context)
    this.name = 'GitError'
    this.gitCommand = gitCommand
  }
}

/**
 * Git repository error
 */
export class GitRepositoryError extends GitError {
  constructor(message: string, repositoryPath?: string, context?: Record<string, any>) {
    super(message, undefined, { ...context, repositoryPath })
    this.name = 'GitRepositoryError'
    // Set code through the parent constructor instead of direct assignment
    Object.defineProperty(this, 'code', {
      value: 'GIT_REPOSITORY_ERROR',
      writable: false,
      enumerable: true,
      configurable: false
    })
  }
}

// ============================================================================
// Operation Subscription Types
// ============================================================================

/**
 * Callback function for operation notifications
 */
export type OperationCallback = (data: ExtractedTagData, metadata: NotificationMetadata) => void

/**
 * Configuration for operation subscription
 */
export interface SubscriptionConfig {
  /** SuperCode server base URL */
  baseUrl: string
  /** WebSocket reconnect interval in milliseconds */
  reconnectInterval?: number
  /** Maximum reconnection attempts */
  maxRetries?: number
  /** Enable debug logging */
  enableLogging?: boolean
  /** WebSocket heartbeat interval in milliseconds */
  heartbeatInterval?: number
}

/**
 * Individual operation subscription
 */
export interface OperationSubscription {
  /** Unique subscription identifier */
  id: string
  /** Topic identifier (typically workflow ID) */
  topicId: string
  /** XML tags to monitor */
  tags: string[]
  /** Notification callback function */
  callback: OperationCallback
  /** Subscription creation timestamp */
  createdAt: string
  /** Whether subscription is active */
  isActive: boolean
}

/**
 * Topic registry for managing sessions and subscriptions
 */
export interface TopicRegistry {
  [topicId: string]: {
    /** Active session IDs for this topic */
    sessions: Set<string>
    /** Active subscriptions for this topic */
    subscriptions: Map<string, OperationSubscription>
    /** Current aggregated data */
    aggregatedData: ExtractedTagData
    /** Last update timestamp */
    lastUpdate: string
  }
}

/**
 * Extracted XML tag data
 */
export interface ExtractedTagData {
  [tagName: string]: string[]
}

/**
 * Subscription information for status reporting
 */
export interface SubscriptionInfo {
  /** Subscription ID */
  id: string
  /** Topic ID */
  topicId: string
  /** Monitored tags */
  tags: string[]
  /** Number of associated sessions */
  sessionCount: number
  /** Number of data items */
  dataCount: number
  /** Last update timestamp */
  lastUpdate: string
}

/**
 * Notification metadata
 */
export interface NotificationMetadata {
  /** Topic identifier */
  topicId: string
  /** Source session ID (if applicable) */
  sessionId?: string
  /** Event timestamp */
  timestamp: string
  /** Message source type */
  source: 'partial' | 'complete'
  /** Whether this notification contains new data */
  hasNewData: boolean
}

/**
 * WebSocket configuration for operation subscriber
 */
export interface WebSocketConfig {
  /** WebSocket URL */
  url: string
  /** Session ID for connection */
  sessionId?: string
  /** Working directory */
  directory?: string
  /** Enable automatic reconnection */
  autoReconnect?: boolean
  /** Reconnection delay in milliseconds */
  reconnectDelay?: number
  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number
  /** Heartbeat interval in milliseconds */
  heartbeatInterval?: number
}

/**
 * Processed message from WebSocket events
 */
export interface ProcessedMessage {
  /** Session identifier */
  sessionId: string
  /** Message role */
  role: 'assistant' | 'user' | 'system'
  /** Message content */
  content: string
  /** Whether this is a partial message */
  isPartial: boolean
  /** Message timestamp */
  timestamp: string
  /** Raw event data */
  rawEvent?: any
}

/**
 * WebSocket event structure based on SuperCode protocol
 */
export interface SuperCodeWebSocketEvent {
  /** Event type identifier */
  type: 'event'
  /** Event name */
  event: string
  /** Event payload */
  data: {
    /** Primary session identifier */
    sessionId?: string
    /** Alternative session identifier */
    sessionID?: string
    /** Legacy session identifiers */
    session_id?: string
    session?: string
    /** Message correlation ID */
    messageId?: string
    /** Message role */
    role?: 'assistant' | 'user' | 'system'
    /** Raw content */
    content?: string
    /** Raw text content */
    text?: string
    /** Info object for message.updated events */
    info?: {
      id: string
      role: 'assistant' | 'user' | 'system'
      sessionID: string
      sessionId?: string
      content?: string
      text?: string
      completed?: boolean
      [key: string]: any
    }
    /** Part object for message.part.updated events */
    part?: {
      sessionID?: string
      sessionId?: string
      text?: string
      content?: string
      completed?: boolean
      time?: {
        completed?: string
      }
      [key: string]: any
    }
    /** Structured message object */
    message?: {
      /** Message ID */
      id: string
      /** Session ID */
      sessionId: string
      /** Alternative session ID */
      sessionID?: string
      session_id?: string
      session?: string
      /** Message role */
      role?: 'assistant' | 'user' | 'system'
      /** Direct content */
      content?: string
      text?: string
      /** Message parts */
      parts: MessagePart[]
      /** Message info */
      info: MessageInfo
      /** Completion marker */
      completed?: boolean
      /** Timing information */
      time: {
        /** Creation timestamp */
        created: string
        /** Last update timestamp */
        updated: string
        /** Completion timestamp (indicates complete message) */
        completed?: string
      }
    }
    /** Message parts array (alternative location) */
    parts?: MessagePart[]
    /** Completion flags */
    completed?: boolean
    finished?: boolean
    /** Additional event-specific fields */
    [key: string]: any
  }
  /** Event timestamp */
  timestamp: number
  /** Optional event ID */
  id?: string
}

/**
 * Message part structure
 */
export interface MessagePart {
  /** Part type */
  type: 'text' | 'tool_use' | 'tool_result'
  /** Text content */
  text?: string
  /** Tool name for tool parts */
  tool?: string
  /** Tool output for tool results */
  output?: any
  /** Part identifier */
  id?: string
}

/**
 * Message info structure
 */
export interface MessageInfo {
  /** Message role */
  role: 'assistant' | 'user' | 'system'
  /** Message ID */
  id: string
  /** Token usage information */
  tokens?: {
    /** Input tokens */
    input: number
    /** Output tokens */
    output: number
    /** Cache tokens */
    cache?: {
      /** Cache read tokens */
      read: number
      /** Cache write tokens */
      write: number
    }
    /** Reasoning tokens */
    reasoning?: number
  }
  /** Whether this is a summary message */
  summary?: boolean
}

/**
 * Operation subscription error
 */
export class OperationSubscriptionError extends WorkflowError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'OPERATION_SUBSCRIPTION_ERROR', context)
    this.name = 'OperationSubscriptionError'
  }
}