/**
 * Project Workflow - Main API exports
 * Modular, object-oriented system for processing code reviews and other workflows
 * Extracted from scripts/sharded-review-parallel.js for reusability
 */

// Main factory and convenience functions
export {
  WorkflowFactory,
  createReviewWorkflow,
  processReview,
  processReviewBatch,
  type WorkflowFactoryConfig
} from './core/workflow-factory.js'

// Core interfaces for extensibility
export type {
  IWorkflowProcessor,
  IContentSource,
  IShardingStrategy,
  IProcessingEngine,
  IResultAggregator,
  IWorkspaceManager,
  IOperationSubscriber
} from './core/interfaces.js'

// Type definitions
export type {
  // Input/Output types
  WorkflowInput,
  WorkflowResult,
  ReviewInput,
  ReviewResult,

  // Configuration types
  WorkflowConfig,
  ReviewConfig,
  ProcessingConfig,
  ShardingConfig,
  AggregationConfig,
  WorkspaceConfig,

  // Content types
  SourceContent,
  ContentFile,
  SourceMetadata,

  // Processing types
  Shard,
  ShardResult,
  ShardProcessor,

  // Result types
  ReviewInsight,
  ReviewHunk,
  ReviewComment,
  ADOComment,
  CommentAuthor,
  CommentResponse,

  // Metadata types
  WorkflowMetadata,
  ShardingStrategyMetadata,
  AggregationStatistics,
  WorkspaceStatistics,

  // Credential types
  ADOCredentials,

  // Generic Event System types
  CustomEventType,
  CustomEventData,
  CustomEventCallback,
  GenericEventCallback,
  GenericEventData,

  // Event payload types
  FilesReadyPayload,
  ReviewStartedPayload,
  ReviewProgressPayload,
  ReviewCompletePayload,
  ReviewErrorPayload,

} from './types/index.js'

// Enum values (not types) for runtime usage
export {
  WorkflowType,
  SourceType,
  GitDiffType,
  ShardingStrategyType,
  ProcessingStatus,
  InsightType,
  SeverityLevel,
  RiskLevel,
  CommentType,
  HunkCategory,
  ChangeType,
  CustomEvents
} from './types/index.js'

// Concrete implementations for advanced usage
export { ReviewWorkflowProcessor } from './review/review-workflow-processor.js'
export { ADOContentSource } from './sources/ado-content-source.js'
export { AdoDiffHelper, generateAdoFileDiff } from './sources/ado-diff-helper.js'
export { FileBoundaryShardingStrategy } from './review/file-boundary-sharding-strategy.js'
export { SessionProcessingEngine } from './review/session-processing-engine.js'
export { ReviewResultAggregator } from './review/review-result-aggregator.js'
export { WorkspaceManager } from './core/workspace-manager.js'
export { XMLTagParser } from './core/xml-tag-parser.js'
export { OperationSubscriber } from './core/operation-subscriber.js'
export { GitApiClient } from './core/git-client.js'

// Utility functions
export {
  estimateTokens,
  detectSourceType,
  parseADOUrl,
  isADOUrl,
  sanitizeFileName,
  createLogger,
  formatDuration,
  retry,
  sleep,
  generateId,
  createHash,
  formatFileSize,

  // Error classes
  ValidationError,
  ProcessingError,
  ContentSourceError,
  ShardingError,
  AggregationError
} from './core/utils.js'

// Re-export common types for convenience
export type {
  SessionConfig
} from './review/session-processing-engine.js'

/**
 * Package version information
 */
export const VERSION = '1.0.0'

/**
 * Package metadata
 */
export const PACKAGE_INFO = {
  name: 'project-workflow',
  version: VERSION,
  description: 'Modular system for processing code reviews and other workflows',
  capabilities: [
    'ado-pr-processing',
    'file-boundary-sharding',
    'parallel-processing',
    'xml-to-json-conversion',
    'comment-threading',
    'workspace-management'
  ],
  extractedFrom: 'scripts/sharded-review-parallel.js',
  architecture: 'interface-driven-design'
} as const