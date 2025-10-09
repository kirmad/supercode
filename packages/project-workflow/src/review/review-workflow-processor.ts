/**
 * Review Workflow Processor implementation
 * Main orchestrator using Template Method pattern
 * Coordinates all components to process review workflows
 */

import type { IWorkflowProcessor, IOperationSubscriber } from '../core/interfaces.js'
import type {
  ReviewInput,
  ReviewResult,
  ReviewConfig,
  WorkflowMetadata,
  ShardProcessor,
  Shard,
  ShardResult,
  ProcessingConfig,
  ShardingConfig,
  AggregationConfig,
  ReviewIndex,
  SourceContent,
  ExtractedTagData,
  NotificationMetadata,
  GitDiffConfig
} from '../types/index.js'
import type { IContentSource } from '../core/interfaces.js'
import { ADOContentSource } from '../sources/ado-content-source.js'
import { GitContentSource } from '../core/git-content-source.js'
import { FileBoundaryShardingStrategy } from './file-boundary-sharding-strategy.js'
import { SessionProcessingEngine } from './session-processing-engine.js'
import { ReviewResultAggregator } from './review-result-aggregator.js'
import { WorkspaceManager } from '../core/workspace-manager.js'
import { ValidationError, ProcessingError, createLogger, formatDuration, generateId } from '../core/utils.js'
import { FileOperationsClient } from '../services/file-operations-client.js'
import { ChangeType } from '../types/index.js'
import { OperationSubscriber } from '../core/operation-subscriber.js'

/**
 * Review Workflow Processor
 * Implements the Template Method pattern for review workflow orchestration
 */
export class ReviewWorkflowProcessor implements IWorkflowProcessor<ReviewInput, ReviewResult> {
  private readonly config: ReviewConfig
  private readonly logger = createLogger('ReviewWorkflowProcessor')

  // Component instances
  private readonly contentSource: IContentSource
  private readonly shardingStrategy: FileBoundaryShardingStrategy
  private processingEngine: SessionProcessingEngine
  private readonly resultAggregator: ReviewResultAggregator
  private readonly workspaceManager: WorkspaceManager
  private readonly fileOperationsClient?: FileOperationsClient
  private operationSubscriber?: IOperationSubscriber
  private subscriptionId?: string

  constructor(config: ReviewConfig, contentSourceOrGitConfig?: IContentSource | GitDiffConfig) {
    this.config = config
    this.logger.info('Initializing Review Workflow Processor')

    // Initialize FileOperationsClient if we have a base URL
    if (config.baseUrl) {
      this.fileOperationsClient = new FileOperationsClient({
        baseUrl: config.baseUrl,
        timeout: 30000
      })
    }

    // Initialize workspace manager with FileOperationsClient
    this.workspaceManager = new WorkspaceManager(this.fileOperationsClient)

    // Initialize content source - check if it's a GitDiffConfig, IContentSource, or default to ADO
    if (contentSourceOrGitConfig) {
      // Check if it's a GitDiffConfig (has repositoryPath property)
      if ('repositoryPath' in contentSourceOrGitConfig) {
        // It's a GitDiffConfig, create GitContentSource like ADO pattern
        const gitConfig = contentSourceOrGitConfig as GitDiffConfig
        this.contentSource = new GitContentSource({
          ...gitConfig,
          workspaceManager: this.workspaceManager,
          fileOperationsClient: this.fileOperationsClient
        }, config.baseUrl)
      } else {
        // It's an IContentSource
        this.contentSource = contentSourceOrGitConfig as IContentSource
      }
    } else {
      // Default to ADO
      this.contentSource = new ADOContentSource({
        baseUrl: config.baseUrl,
        credentials: config.adoCredentials,
        workspaceManager: this.workspaceManager,
        fileOperationsClient: this.fileOperationsClient
      })
    }

    this.shardingStrategy = new FileBoundaryShardingStrategy()

    this.processingEngine = new SessionProcessingEngine({
      baseUrl: config.baseUrl,
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      agent: config.agent,
      timeoutPerShard: config.timeoutPerShard,
      maxRetries: 3,
      retryDelay: 1000
    })

    this.resultAggregator = new ReviewResultAggregator()
  }

  /**
   * Process review workflow from input to result
   * Template Method implementation
   */
  async process(input: ReviewInput, config?: Partial<ReviewConfig>): Promise<ReviewResult> {
    const startTime = Date.now()
    const mergedConfig = { ...this.config, ...config }
    const workflowId = generateId('review-workflow')

    this.logger.info(`Starting review workflow for: ${input.identifier}`)

    try {
      // Step 1: Validate input
      if (!this.validateInput(input)) {
        throw new ValidationError(`Invalid review input: ${input.identifier}`)
      }

      // Step 2: Create workspace
      const workspace = await this.createWorkspace(mergedConfig)

      // Step 2.5: Set up operation subscription if enabled
      if (mergedConfig.operationSubscription?.enabled) {
        await this.setupOperationSubscription(workflowId, mergedConfig)
      }

      // Step 3: Fetch content
      const content = await this.fetchContent(input, mergedConfig)

      // Step 4: Create shards
      const shards = await this.createShards(content, mergedConfig)

      // Step 4.5: Generate and save review index
      this.logger.debug('About to generate review index...')
      const reviewIndex = await this.generateReviewIndex(input, content, shards, mergedConfig)
      await this.saveReviewIndex(reviewIndex)

      // Step 5: Process shards
      const shardResults = await this.processShards(shards, mergedConfig)

      // Step 6: Aggregate results
      const result = await this.aggregateResults(shardResults, content.metadata, mergedConfig, content.content.adoComments)

      // Step 7: Always include workspace path for version files
      const workspacePath = await this.workspaceManager.getWorkspacePath()
      result.workspace = workspacePath

      if (!mergedConfig.autoCleanup) {
        const stats = await this.workspaceManager.getStatistics()
        this.logger.info(`Workspace preserved: ${stats.workspaceId} at ${workspacePath}`)
      }

      // Step 8: Performance tracking
      const totalTime = Date.now() - startTime
      result.metadata.processingStats.totalProcessingTime = totalTime

      this.logger.info(`Review workflow completed in ${formatDuration(totalTime)}`)
      this.logger.info(`Results: ${result.insights.length} insights, ${result.hunks.length} hunks, ${result.comments.length} comments`)

      return result

    } catch (error) {
      this.logger.error(`Review workflow failed: ${error}`)
      throw error

    } finally {
      // Clean up operation subscription
      if (this.subscriptionId && this.operationSubscriber) {
        try {
          this.operationSubscriber.unsubscribe(this.subscriptionId)
          this.logger.debug('Operation subscription cleaned up', { subscriptionId: this.subscriptionId })
        } catch (subscriptionError) {
          this.logger.warn(`Operation subscription cleanup failed: ${subscriptionError}`)
        }
      }

      // Cleanup workspace if auto-cleanup is enabled
      if (mergedConfig.autoCleanup) {
        try {
          await this.workspaceManager.cleanup()
        } catch (cleanupError) {
          this.logger.warn(`Workspace cleanup failed: ${cleanupError}`)
        }
      }
    }
  }

  /**
   * Create workspace for the review workflow
   */
  private async createWorkspace(config: ReviewConfig): Promise<string> {
    this.logger.debug('Creating workspace')

    const workspaceConfig = {
      prefix: 'review-workflow',
      cleanup: config.autoCleanup ?? true,
      preserveVersions: config.saveVersions ?? false
    }

    const workspace = await this.workspaceManager.createWorkspace(workspaceConfig)
    this.logger.debug(`Created workspace: ${workspace}`)

    return workspace
  }

  /**
   * Fetch content from source
   */
  private async fetchContent(input: ReviewInput, config: ReviewConfig) {
    this.logger.debug('Fetching content from source')

    // Create versions directory if needed
    let saveDirectory: string | undefined = undefined
    if (config.saveVersions) {
      const workspacePath = await this.workspaceManager.getWorkspacePath()
      // The workspace manager will create the subdirectory when saving files
      saveDirectory = `${workspacePath}/versions`
    }

    const fetchOptions = {
      saveDirectory,
      filters: {
        includeFilePatterns: config.includeFilePatterns,
        excludeFilePatterns: config.excludeFilePatterns,
        maxFileSize: config.maxFileSize
      }
    }

    const content = await this.contentSource.fetchContent(input.identifier, fetchOptions)
    this.logger.info(`Fetched content: ${content.content.files.length} files, ${content.content.totalTokens} tokens`)

    return content
  }

  /**
   * Create shards from content
   */
  private async createShards(content: any, config: ReviewConfig) {
    this.logger.debug('Creating shards from content')

    const shardingConfig: ShardingConfig = {
      strategy: 'file_boundary' as any,
      targetTokens: config.optimalTokensPerShard,
      maxTokens: config.maxTokensPerShard,
      minTokens: config.minTokensPerShard,
      preserveBoundaries: true
    }

    const shards = await this.shardingStrategy.createShards(content, shardingConfig)
    this.logger.info(`Created ${shards.length} shards with file-boundary awareness`)

    // Save shards to workspace for processing
    await this.saveShards(shards)

    return shards
  }

  /**
   * Save shards to workspace
   */
  private async saveShards(shards: Shard[]): Promise<void> {
    for (const shard of shards) {
      const shardFileName = `shard-${shard.index}.diff`
      await this.workspaceManager.saveToSubdirectory('shards', shardFileName, shard.content)
    }
    this.logger.debug(`Saved ${shards.length} shard files to workspace`)
  }

  /**
   * Process shards in parallel
   */
  private async processShards(shards: Shard[], config: ReviewConfig): Promise<ShardResult[]> {
    this.logger.debug('Processing shards in parallel')

    const processingConfig: ProcessingConfig = {
      batchSize: config.maxParallelSessions,
      retryAttempts: 3,
      retryDelay: 1000,
      timeout: config.timeoutPerShard
    }

    // Create shard processor function
    const shardProcessor: ShardProcessor = async (shard: Shard) => {
      // The SessionProcessingEngine will handle the actual processing
      // This is a placeholder that gets replaced by the engine's internal processor
      return {
        shardIndex: shard.index,
        success: false,
        error: new Error('Processor should not be called directly'),
        processingTime: 0,
        metadata: {}
      }
    }

    const results = await this.processingEngine.processShards(shards, shardProcessor, processingConfig)

    // Save XML results to workspace
    await this.saveXMLResults(results)

    const successful = results.filter(r => r.success)
    this.logger.info(`Processed ${successful.length}/${results.length} shards successfully`)

    return results
  }

  /**
   * Save XML results to workspace
   */
  private async saveXMLResults(results: ShardResult[]): Promise<void> {
    for (const result of results) {
      if (result.success && typeof result.result === 'string') {
        const xmlFileName = `shard-${result.shardIndex}.xml`
        await this.workspaceManager.saveToSubdirectory('reviews', xmlFileName, result.result)
      }
    }
    this.logger.debug(`Saved XML results to workspace`)
  }

  /**
   * Generate review-index.json with comprehensive metadata
   */
  private async generateReviewIndex(
    input: ReviewInput,
    content: SourceContent,
    shards: Shard[],
    config: ReviewConfig
  ): Promise<ReviewIndex> {
    this.logger.debug('Generating review-index.json')

    const metadata = content.metadata
    const contentData = content.content

    // Extract PR information from metadata
    const prUrl = input.identifier
    const prId = metadata.identifier ? parseInt(metadata.identifier.replace('pr-', '')) : undefined

    // Calculate shard statistics
    const actualTokensPerShard = shards.map(shard => shard.tokens)
    const targetTokensPerShard = config.optimalTokensPerShard

    // Create file entries with metadata
    const files = contentData.files.map(file => ({
      path: file.path,
      changeType: file.changeType || ChangeType.MODIFY,
      size: file.size,
      tokens: file.tokens,
      localDiffFile: `shards/shard-${shards.findIndex(s => s.files.some(f => f.path === file.path))}.diff`
    }))

    // Create shard entries
    const shardEntries = shards.map(shard => ({
      index: shard.index,
      files: shard.files.map(f => f.path),
      tokenCount: shard.tokens,
      completed: true // Will be updated during processing
    }))

    const reviewIndex: ReviewIndex = {
      source: metadata.source || prUrl,
      prUrl: prUrl,
      prId: prId,
      organization: metadata.organization,
      project: metadata.project,
      repository: metadata.repository,
      title: metadata.title,
      description: metadata.description,
      author: metadata.author,
      createdDate: metadata.createdDate,
      sourceBranch: metadata.sourceBranch,
      targetBranch: metadata.targetBranch,
      totalFiles: files.length,
      skippedFiles: 0, // Could be calculated from filtering logic
      files: files,
      fullDiffFile: 'full-diff.patch', // Could be generated if needed
      totalTokens: contentData.totalTokens,
      shardStrategy: {
        algorithm: 'file_boundary',
        totalShards: shards.length,
        targetTokensPerShard: targetTokensPerShard,
        actualTokensPerShard: actualTokensPerShard,
        maxParallelSessions: config.maxParallelSessions
      },
      shards: shardEntries,
      adoComments: contentData.adoComments || [],
      createdAt: new Date().toISOString()
    }

    return reviewIndex
  }

  /**
   * Save review index to workspace
   */
  private async saveReviewIndex(reviewIndex: ReviewIndex): Promise<void> {
    const reviewIndexContent = JSON.stringify(reviewIndex, null, 2)
    await this.workspaceManager.saveContent('review-index.json', reviewIndexContent)
    this.logger.info(`Generated review-index.json with ${reviewIndex.totalFiles} files and ${reviewIndex.adoComments.length} ADO comments`)
  }

  /**
   * Aggregate results into final review result
   */
  private async aggregateResults(
    results: ShardResult[],
    metadata: any,
    config: ReviewConfig,
    adoComments?: any[]
  ): Promise<ReviewResult> {
    this.logger.debug('Aggregating shard results')

    const aggregationConfig: AggregationConfig = {
      outputFormat: config.outputFormat === 'json' ? 'json' as any : 'xml' as any,
      includeMetadata: true,
      includeStatistics: true,
      sortResults: true
    }

    const aggregatedResult = await this.resultAggregator.aggregateResults(
      results,
      metadata,
      aggregationConfig,
      adoComments
    )

    // Save final JSON result to workspace
    const jsonFileName = 'review-results.json'
    const jsonContent = JSON.stringify(aggregatedResult, null, 2)
    await this.workspaceManager.saveContent(jsonFileName, jsonContent)

    this.logger.debug('Results aggregated and saved to workspace')

    return aggregatedResult
  }

  /**
   * Validate review input
   */
  validateInput(input: ReviewInput): boolean {
    if (!input.identifier || typeof input.identifier !== 'string') {
      this.logger.error('Invalid identifier: must be a non-empty string')
      return false
    }

    if (!input.type) {
      this.logger.error('Invalid type: must be specified')
      return false
    }

    if (!this.contentSource.validateIdentifier(input.identifier)) {
      this.logger.error(`Invalid identifier format for source type: ${input.identifier}`)
      return false
    }

    return true
  }

  /**
   * Get workflow metadata
   */
  getMetadata(): WorkflowMetadata {
    return {
      type: 'review',
      version: '1.0.0',
      capabilities: [
        'ado-pr-processing',
        'file-boundary-sharding',
        'parallel-processing',
        'xml-to-json-conversion',
        'comment-threading',
        'workspace-management'
      ],
      generatedAt: new Date().toISOString(),
      processingStats: {
        totalShards: 0,
        successfulShards: 0,
        failedShards: 0,
        totalProcessingTime: 0,
        averageShardTime: 0,
        parallelProcessing: true
      }
    }
  }

  /**
   * Get current processing status
   */
  getProcessingStatus() {
    return {
      contentSource: this.contentSource.getSourceType(),
      shardingStrategy: this.shardingStrategy.getMetadata(),
      processingEngine: this.processingEngine.getStatus(),
      workspace: this.workspaceManager.getWorkspacePath()
    }
  }

  /**
   * Cancel ongoing processing
   */
  async cancel(): Promise<void> {
    this.logger.info('Cancelling review workflow')

    try {
      await this.processingEngine.cancel()
      await this.workspaceManager.cleanup()
    } catch (error) {
      this.logger.error(`Error during cancellation: ${error}`)
    }
  }

  /**
   * Get partial results if processing is ongoing
   */
  getPartialResults(): ShardResult[] {
    return this.processingEngine.getPartialResults()
  }

  /**
   * Set up operation subscription for real-time workflow monitoring
   */
  private async setupOperationSubscription(workflowId: string, config: ReviewConfig): Promise<void> {
    if (!config.operationSubscription?.enabled) {
      return
    }

    try {
      // Create operation subscriber if not already created
      if (!this.operationSubscriber) {
        // Get or create operation subscriber from base URL
        const factory = await import('../core/workflow-factory.js')
        const tempFactory = new factory.WorkflowFactory({
          baseUrl: config.baseUrl,
          adoCredentials: config.adoCredentials
        })
        this.operationSubscriber = tempFactory.createOperationSubscriber()
      }

      // Start listening for WebSocket events
      await this.operationSubscriber.startListening()

      // Subscribe to the workflow topic with review-specific tags
      const tags = config.operationSubscription.tags || ['review-insight', 'hunk', 'comment']
      const subscriptionId = this.operationSubscriber.subscribe(
        workflowId,
        tags,
        (data, metadata) => this.handleRealtimeUpdates(data, metadata)
      )

      // Store subscription ID for cleanup
      this.subscriptionId = subscriptionId

      // Update processing engine to include operation subscription support
      this.processingEngine = new SessionProcessingEngine({
        baseUrl: config.baseUrl,
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        agent: config.agent,
        timeoutPerShard: config.timeoutPerShard,
        maxRetries: 3,
        retryDelay: 1000,
        operationSubscriber: this.operationSubscriber,
        topicId: workflowId
      })

      this.logger.info(`Operation subscription setup completed for workflow ${workflowId}`)
    } catch (error) {
      this.logger.error(`Failed to setup operation subscription: ${error}`)
      throw error
    }
  }

  /**
   * Handle real-time updates from operation subscription
   */
  private handleRealtimeUpdates(data: ExtractedTagData, metadata: NotificationMetadata): void {
    this.logger.info('Received real-time update', {
      topicId: metadata.topicId,
      sessionId: metadata.sessionId,
      tags: Object.keys(data),
      timestamp: metadata.timestamp,
      hasNewData: metadata.hasNewData
    })

    // Log sample data for each tag type
    for (const [tag, values] of Object.entries(data)) {
      this.logger.info(`Real-time ${tag}: ${values.length} items`, {
        sampleData: values.slice(0, 2) // Show first 2 items
      })
    }
  }

  /**
   * Get workflow statistics
   */
  async getStatistics() {
    const processingStats = this.processingEngine.getProcessingStatistics()
    const workspaceStats = await this.workspaceManager.getStatistics()

    return {
      processing: processingStats,
      workspace: workspaceStats,
      components: {
        contentSource: this.contentSource.getSourceType(),
        shardingStrategy: this.shardingStrategy.getMetadata().type,
        processingEngine: this.processingEngine.getStatus(),
        resultAggregator: 'ReviewResultAggregator'
      }
    }
  }

  /**
   * Get workspace manager instance
   */
  getWorkspaceManager() {
    return this.workspaceManager
  }
}