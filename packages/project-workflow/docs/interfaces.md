# Core Interfaces and Design Patterns

## 🎯 Interface Design Philosophy

The Project Workflow Module uses interface-driven design to ensure:
- **Testability**: Each component can be mocked and tested in isolation
- **Flexibility**: Implementations can be swapped without affecting consumers
- **Extensibility**: New implementations can be added without modifying existing code
- **Type Safety**: TypeScript interfaces provide compile-time validation

## 🔧 Core Interfaces

### IWorkflowProcessor

Main orchestrator interface for all workflow types.

```typescript
interface IWorkflowProcessor<TInput extends WorkflowInput, TResult extends WorkflowResult> {
  /**
   * Process workflow from input to result
   * @param input - Workflow input (commit hash, PR URL, etc.)
   * @param config - Workflow configuration
   * @returns Promise resolving to workflow result
   */
  process(input: TInput, config: WorkflowConfig): Promise<TResult>

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
}
```

### IContentSource

Abstraction for content retrieval from different sources.

```typescript
interface IContentSource {
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
```

### IShardingStrategy

Content splitting strategy interface.

```typescript
interface IShardingStrategy {
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
```

### IProcessingEngine

Parallel processing engine interface.

```typescript
interface IProcessingEngine {
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
```

### IResultAggregator

Result transformation and aggregation interface.

```typescript
interface IResultAggregator<TResult extends WorkflowResult> {
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
```

### IWorkspaceManager

File system and workspace management interface.

```typescript
interface IWorkspaceManager {
  /**
   * Create temporary workspace
   * @param config - Workspace configuration
   * @returns Promise resolving to workspace path
   */
  createWorkspace(config: WorkspaceConfig): Promise<string>

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
  getStatistics(): WorkspaceStatistics
}
```

## 📝 Type Definitions

### Core Types

```typescript
// Base workflow input
interface WorkflowInput {
  identifier: string
  type: SourceType
  metadata?: Record<string, any>
}

// Base workflow result
interface WorkflowResult {
  success: boolean
  metadata: WorkflowMetadata
  statistics: ProcessingStatistics
  workspace?: string
}

// Source content structure
interface SourceContent {
  identifier: string
  type: SourceType
  metadata: SourceMetadata
  content: ContentData
}

// Content data
interface ContentData {
  files: ContentFile[]
  diffs: DiffData[]
  totalSize: number
  totalTokens: number
}

// Individual content file
interface ContentFile {
  path: string
  content: string
  size: number
  tokens: number
  changeType?: ChangeType
}

// Processing shard
interface Shard {
  index: number
  files: ContentFile[]
  content: string
  tokens: number
  metadata: ShardMetadata
}

// Shard processing result
interface ShardResult {
  shardIndex: number
  success: boolean
  result?: any
  error?: Error
  processingTime: number
  metadata: Record<string, any>
}
```

### Configuration Types

```typescript
// Base workflow configuration
interface WorkflowConfig {
  baseUrl: string
  maxParallelSessions: number
  timeoutPerShard: number
  workspace?: string
  logging?: LoggingConfig
}

// Sharding configuration
interface ShardingConfig {
  strategy: ShardingStrategyType
  targetTokens: number
  maxTokens: number
  minTokens: number
  preserveBoundaries: boolean
}

// Processing configuration
interface ProcessingConfig {
  batchSize: number
  retryAttempts: number
  retryDelay: number
  timeout: number
}

// Aggregation configuration
interface AggregationConfig {
  outputFormat: OutputFormat
  includeMetadata: boolean
  includeStatistics: boolean
  sortResults: boolean
}
```

### Review-Specific Types

```typescript
// Review workflow input
interface ReviewInput extends WorkflowInput {
  type: 'git' | 'ado-pr'
  filters?: ReviewFilters
}

// Review workflow result
interface ReviewResult extends WorkflowResult {
  insights: ReviewInsight[]
  hunks: ReviewHunk[]
  comments: ReviewComment[]
  adoComments?: ADOComment[]
}

// Review insight
interface ReviewInsight {
  shard: number
  type: InsightType
  severity: SeverityLevel
  content: string
}

// Review hunk
interface ReviewHunk {
  shard: number
  file: string
  startLine: number
  endLine: number
  category: HunkCategory
  risk: RiskLevel
  description: string
  needsAttention: boolean
}

// Review comment
interface ReviewComment {
  shard: number
  file: string
  startLine: number
  endLine: number
  type: CommentType
  severity: SeverityLevel
  message: string
  fixCode?: string
  threadId?: string
}
```

### Enums and Constants

```typescript
enum SourceType {
  GIT = 'git',
  ADO_PR = 'ado-pr',
  GITHUB_PR = 'github-pr',
  LOCAL = 'local'
}

enum ChangeType {
  ADD = 'add',
  MODIFY = 'modify',
  DELETE = 'delete',
  RENAME = 'rename'
}

enum ShardingStrategyType {
  FILE_BOUNDARY = 'file_boundary',
  TOKEN_BASED = 'token_based',
  LINE_BASED = 'line_based'
}

enum ProcessingStatus {
  IDLE = 'idle',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ERROR = 'error'
}

enum SeverityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

enum InsightType {
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  QUALITY = 'quality',
  MAINTAINABILITY = 'maintainability'
}
```

## 🏗️ Design Patterns Implementation

### Strategy Pattern Example

```typescript
// Strategy interface
interface IShardingStrategy {
  createShards(content: SourceContent, config: ShardingConfig): Promise<Shard[]>
}

// Concrete strategies
class FileBoundaryShardingStrategy implements IShardingStrategy {
  async createShards(content: SourceContent, config: ShardingConfig): Promise<Shard[]> {
    // File-boundary-aware sharding implementation
    const shards: Shard[] = []
    let currentShard: ContentFile[] = []
    let currentTokens = 0

    for (const file of content.content.files) {
      if (currentTokens + file.tokens > config.targetTokens && currentShard.length > 0) {
        shards.push(this.createShard(shards.length, currentShard))
        currentShard = []
        currentTokens = 0
      }

      currentShard.push(file)
      currentTokens += file.tokens
    }

    if (currentShard.length > 0) {
      shards.push(this.createShard(shards.length, currentShard))
    }

    return shards
  }

  private createShard(index: number, files: ContentFile[]): Shard {
    return {
      index,
      files,
      content: files.map(f => f.content).join('\n\n'),
      tokens: files.reduce((sum, f) => sum + f.tokens, 0),
      metadata: {
        fileCount: files.length,
        strategy: 'file_boundary'
      }
    }
  }
}

class TokenBasedShardingStrategy implements IShardingStrategy {
  async createShards(content: SourceContent, config: ShardingConfig): Promise<Shard[]> {
    // Token-based sharding implementation
    // Split content based purely on token count without file boundaries
  }
}
```

### Factory Pattern Example

```typescript
class ContentSourceFactory {
  static createSource(identifier: string): IContentSource {
    if (this.isGitCommit(identifier)) {
      return new GitContentSource()
    } else if (this.isADOPR(identifier)) {
      return new ADOContentSource()
    } else if (this.isGitHubPR(identifier)) {
      return new GitHubContentSource()
    } else {
      throw new Error(`Unsupported source type for identifier: ${identifier}`)
    }
  }

  private static isGitCommit(identifier: string): boolean {
    return /^[a-f0-9]{7,40}$/i.test(identifier) || identifier.startsWith('HEAD')
  }

  private static isADOPR(identifier: string): boolean {
    return identifier.includes('visualstudio.com') && identifier.includes('pullrequest')
  }

  private static isGitHubPR(identifier: string): boolean {
    return identifier.includes('github.com') && identifier.includes('/pull/')
  }
}
```

### Template Method Pattern Example

```typescript
abstract class WorkflowProcessor<TInput extends WorkflowInput, TResult extends WorkflowResult>
  implements IWorkflowProcessor<TInput, TResult> {

  constructor(
    protected contentSource: IContentSource,
    protected shardingStrategy: IShardingStrategy,
    protected processingEngine: IProcessingEngine,
    protected resultAggregator: IResultAggregator<TResult>,
    protected workspaceManager: IWorkspaceManager
  ) {}

  async process(input: TInput, config: WorkflowConfig): Promise<TResult> {
    // Template method defining the workflow
    try {
      // Step 1: Validate input
      if (!this.validateInput(input)) {
        throw new Error('Invalid input provided')
      }

      // Step 2: Create workspace
      const workspace = await this.workspaceManager.createWorkspace({
        prefix: this.getWorkspacePrefix(),
        cleanup: config.autoCleanup ?? true
      })

      // Step 3: Fetch content
      const content = await this.contentSource.fetchContent(input.identifier)

      // Step 4: Create shards
      const shards = await this.shardingStrategy.createShards(content, config.sharding)

      // Step 5: Process shards (workflow-specific)
      const processor = this.createShardProcessor(config)
      const results = await this.processingEngine.processShards(shards, processor, config.processing)

      // Step 6: Aggregate results
      const aggregated = await this.resultAggregator.aggregateResults(
        results,
        content.metadata,
        config.aggregation
      )

      return aggregated
    } finally {
      // Always cleanup
      await this.workspaceManager.cleanup()
    }
  }

  // Abstract methods for subclasses to implement
  protected abstract createShardProcessor(config: WorkflowConfig): ShardProcessor
  protected abstract getWorkspacePrefix(): string

  // Default implementations that can be overridden
  validateInput(input: TInput): boolean {
    return input && input.identifier && input.type
  }

  getMetadata(): WorkflowMetadata {
    return {
      type: this.constructor.name,
      version: '1.0.0',
      capabilities: this.getCapabilities()
    }
  }

  protected abstract getCapabilities(): string[]
}
```

## 🔄 Interface Evolution Strategy

### Version Compatibility
- **Semantic Versioning**: Use semantic versioning for interface changes
- **Backward Compatibility**: Maintain backward compatibility for minor versions
- **Deprecation Strategy**: Provide clear deprecation notices and migration paths
- **Extension Points**: Use optional properties and extension interfaces for new features

### Interface Extensions
```typescript
// Base interface
interface IWorkflowProcessor<TInput, TResult> {
  process(input: TInput, config: WorkflowConfig): Promise<TResult>
}

// Extended interface for new capabilities
interface IAdvancedWorkflowProcessor<TInput, TResult> extends IWorkflowProcessor<TInput, TResult> {
  processWithCallbacks?(
    input: TInput,
    config: WorkflowConfig,
    callbacks: ProcessingCallbacks
  ): Promise<TResult>

  getProcessingMetrics?(): ProcessingMetrics
}

// Optional extension interface
interface IWorkflowProcessorExtensions {
  pause?(): Promise<void>
  resume?(): Promise<void>
  getEstimatedCompletion?(): Date
}
```

This interface design provides a solid foundation for the extensible workflow system while maintaining type safety, testability, and clear contracts between components.