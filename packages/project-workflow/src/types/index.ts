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