/**
 * Core interfaces for the Project Workflow system
 * Based on interface-driven design with pluggable components
 */

import type {
  WorkflowInput,
  WorkflowResult,
  WorkflowConfig,
  WorkflowMetadata,
  SourceContent,
  ContentFetchOptions,
  SourceType,
  Shard,
  ShardingConfig,
  ShardingStrategyMetadata,
  ShardResult,
  ProcessingConfig,
  ProcessingStatus,
  AggregationConfig,
  AggregationStatistics,
  WorkspaceConfig,
  WorkspaceStatistics,
  SourceMetadata,
  ShardProcessor,
  OperationCallback,
  SubscriptionInfo,
  GitDiffConfig,
  GitWorkflowConfig,
  GitDiffType,
  GitReviewIndex
} from '../types/index.js'

/**
 * Main orchestrator interface for all workflow types
 */
export interface IWorkflowProcessor<TInput extends WorkflowInput, TResult extends WorkflowResult> {
  /**
   * Process workflow from input to result
   * @param input - Workflow input (commit hash, PR URL, etc.)
   * @param config - Optional workflow configuration overrides
   * @returns Promise resolving to workflow result
   */
  process(input: TInput, config?: Partial<WorkflowConfig>): Promise<TResult>

  /**
   * Validate input before processing
   * @param input - Input to validate
   * @returns true if valid, false otherwise
   */
  validateInput(input: TInput): boolean

  /**
   * Get workflow metadata
   * @returns Workflow type, version, and capabilities
   */
  getMetadata(): WorkflowMetadata

  /**
   * Get workspace manager instance
   * @returns Workspace manager for file operations
   */
  getWorkspaceManager(): IWorkspaceManager
}

/**
 * Abstraction for content retrieval from different sources
 */
export interface IContentSource {
  /**
   * Fetch content from source
   * @param identifier - Source identifier (URL, commit hash, etc.)
   * @param options - Fetch options
   * @returns Promise resolving to source content
   */
  fetchContent(identifier: string, options?: ContentFetchOptions): Promise<SourceContent>

  /**
   * Validate source identifier format
   * @param identifier - Identifier to validate
   * @returns true if valid format, false otherwise
   */
  validateIdentifier(identifier: string): boolean

  /**
   * Check if source is accessible
   * @param identifier - Source identifier
   * @returns Promise resolving to availability status
   */
  isAvailable(identifier: string): Promise<boolean>

  /**
   * Get source type
   * @returns Source type (git, ado, etc.)
   */
  getSourceType(): SourceType
}

/**
 * Content splitting strategy interface
 */
export interface IShardingStrategy {
  /**
   * Create shards from source content
   * @param content - Source content to shard
   * @param config - Sharding configuration
   * @returns Promise resolving to array of shards
   */
  createShards(content: SourceContent, config: ShardingConfig): Promise<Shard[]>

  /**
   * Estimate shard count for content
   * @param content - Source content
   * @param config - Sharding configuration
   * @returns Estimated number of shards
   */
  estimateShardCount(content: SourceContent, config: ShardingConfig): number

  /**
   * Validate sharding configuration
   * @param config - Configuration to validate
   * @returns true if valid, false otherwise
   */
  validateConfig(config: ShardingConfig): boolean

  /**
   * Get strategy metadata
   * @returns Strategy type and capabilities
   */
  getMetadata(): ShardingStrategyMetadata
}

/**
 * Parallel processing engine interface
 */
export interface IProcessingEngine {
  /**
   * Process shards in parallel
   * @param shards - Shards to process
   * @param processor - Shard processor function
   * @param config - Processing configuration
   * @returns Promise resolving to processing results
   */
  processShards(
    shards: Shard[],
    processor: ShardProcessor,
    config: ProcessingConfig
  ): Promise<ShardResult[]>

  /**
   * Get processing status
   * @returns Current processing status
   */
  getStatus(): ProcessingStatus

  /**
   * Cancel ongoing processing
   * @returns Promise resolving when cancellation complete
   */
  cancel(): Promise<void>

  /**
   * Get partial results from ongoing processing
   * @returns Available results so far
   */
  getPartialResults(): ShardResult[]
}

/**
 * Result transformation and aggregation interface
 */
export interface IResultAggregator<TResult extends WorkflowResult> {
  /**
   * Aggregate shard results into final result
   * @param results - Shard processing results
   * @param metadata - Source content metadata
   * @param config - Aggregation configuration
   * @returns Promise resolving to aggregated result
   */
  aggregateResults(
    results: ShardResult[],
    metadata: SourceMetadata,
    config: AggregationConfig
  ): Promise<TResult>

  /**
   * Validate individual shard result
   * @param result - Shard result to validate
   * @returns true if valid, false otherwise
   */
  validateShardResult(result: ShardResult): boolean

  /**
   * Get aggregation statistics
   * @param results - Results to analyze
   * @returns Aggregation statistics
   */
  getStatistics(results: ShardResult[]): AggregationStatistics
}

/**
 * File system and workspace management interface
 */
export interface IWorkspaceManager {
  /**
   * Create temporary workspace
   * @param config - Optional workspace configuration (defaults provided)
   * @returns Promise resolving to workspace path
   */
  createWorkspace(config?: WorkspaceConfig): Promise<string>

  /**
   * Save content to workspace
   * @param relativePath - File path relative to workspace
   * @param content - Content to save
   * @returns Promise resolving to absolute file path
   */
  saveContent(relativePath: string, content: string | Buffer): Promise<string>

  /**
   * Load content from workspace
   * @param relativePath - File path relative to workspace
   * @returns Promise resolving to file content
   */
  loadContent(relativePath: string): Promise<string>

  /**
   * Cleanup workspace
   * @returns Promise resolving when cleanup complete
   */
  cleanup(): Promise<void>

  /**
   * Get workspace statistics
   * @returns Workspace usage statistics
   */
  getStatistics(): Promise<WorkspaceStatistics>

  /**
   * Get the workspace directory for a given workspace ID
   * @param workspaceId - The workspace ID to get the directory for
   * @returns The workspace directory path
   */
  getWorkspaceDirectory?(workspaceId: string): string

  /**
   * Get the root directory where all workspaces are stored
   * @returns The workspace root directory path
   */
  getWorkspaceRootDirectory?(): string

  /**
   * Get the current workspace path
   * @returns The current workspace path or undefined if no workspace is active
   */
  getWorkspacePath(): string | undefined
}

/**
 * Operation subscription interface for real-time workflow monitoring
 */
export interface IOperationSubscriber {
  /**
   * Subscribe to workflow events for a specific topic
   * @param topicId - Topic identifier (typically workflow ID)
   * @param tags - XML tags to monitor
   * @param callback - Callback function for notifications
   * @returns Unique subscription ID
   */
  subscribe(topicId: string, tags: string[], callback: OperationCallback): string

  /**
   * Unsubscribe from a topic
   * @param subscriptionId - Subscription ID returned from subscribe()
   * @returns true if successfully unsubscribed, false if not found
   */
  unsubscribe(subscriptionId: string): boolean

  /**
   * Add a session to a topic for event filtering
   * @param topicId - Topic identifier
   * @param sessionId - Session ID to associate with topic
   */
  addSessionToTopic(topicId: string, sessionId: string): void

  /**
   * Remove a session from a topic
   * @param topicId - Topic identifier
   * @param sessionId - Session ID to remove from topic
   */
  removeSessionFromTopic(topicId: string, sessionId: string): void

  /**
   * Start listening for WebSocket events
   * @returns Promise resolving when connection is established
   */
  startListening(): Promise<void>

  /**
   * Stop listening and cleanup resources
   */
  stopListening(): void

  /**
   * Get information about active subscriptions
   * @returns Array of subscription information
   */
  getActiveSubscriptions(): SubscriptionInfo[]

  /**
   * Get session IDs associated with a topic
   * @param topicId - Topic identifier
   * @returns Array of session IDs
   */
  getTopicSessions(topicId: string): string[]

  /**
   * Check if the subscriber is actively listening
   * @returns true if listening, false otherwise
   */
  isListening(): boolean
}