/**
 * Workflow Factory - Main entry point for the Project Workflow system
 * Provides a clean API for creating and configuring different workflow types
 * Handles dependency injection and component initialization
 */

import type { IWorkflowProcessor } from './interfaces.js'
import type {
  ReviewInput,
  ReviewResult,
  ReviewConfig,
  WorkflowInput,
  WorkflowResult,
  ADOCredentials,
  ShardingConfig,
  ProcessingConfig,
  AggregationConfig
} from '../types/index.js'
import { WorkflowType } from '../types/index.js'
import { ReviewWorkflowProcessor } from '../review/review-workflow-processor.js'
import { ValidationError, createLogger } from './utils.js'

/**
 * Configuration options for workflow creation
 */
export interface WorkflowFactoryConfig {
  /**
   * Base URL for the OpenCode server
   */
  baseUrl: string

  /**
   * ADO (Azure DevOps) credentials for content fetching
   */
  adoCredentials: ADOCredentials

  /**
   * Default configuration values
   */
  defaults?: {
    agent?: string
    outputFormat?: 'xml' | 'json'
    autoCleanup?: boolean
    saveVersions?: boolean
    maxParallelSessions?: number
    timeoutPerShard?: number
    optimalTokensPerShard?: number
    maxTokensPerShard?: number
    minTokensPerShard?: number
    includeFilePatterns?: string[]
    excludeFilePatterns?: string[]
    maxFileSize?: number
  }
}

/**
 * Workflow Factory
 * Factory class for creating different types of workflow processors
 */
export class WorkflowFactory {
  private readonly config: WorkflowFactoryConfig
  private readonly logger = createLogger('WorkflowFactory')

  constructor(config: WorkflowFactoryConfig) {
    this.config = config
    this.validateConfig()
    this.logger.info('Workflow Factory initialized')
  }

  /**
   * Create a review workflow processor
   */
  createReviewWorkflow(overrides?: Partial<ReviewConfig>): IWorkflowProcessor<ReviewInput, ReviewResult> {
    this.logger.info('Creating review workflow processor')

    // Create sub-configurations
    const shardingConfig: ShardingConfig = {
      strategy: 'file_boundary' as any,
      targetTokens: overrides?.optimalTokensPerShard ?? this.config.defaults?.optimalTokensPerShard ?? 8000,
      maxTokens: overrides?.maxTokensPerShard ?? this.config.defaults?.maxTokensPerShard ?? 12000,
      minTokens: overrides?.minTokensPerShard ?? this.config.defaults?.minTokensPerShard ?? 2000,
      preserveBoundaries: true
    }

    const processingConfig: ProcessingConfig = {
      batchSize: overrides?.maxParallelSessions ?? this.config.defaults?.maxParallelSessions ?? 3,
      retryAttempts: 3,
      retryDelay: 1000,
      timeout: overrides?.timeoutPerShard ?? this.config.defaults?.timeoutPerShard ?? 300000
    }

    const aggregationConfig: AggregationConfig = {
      outputFormat: (overrides?.outputFormat ?? this.config.defaults?.outputFormat ?? 'json') === 'json' ? 'json' as any : 'xml' as any,
      includeMetadata: true,
      includeStatistics: true,
      sortResults: true
    }

    const reviewConfig: ReviewConfig = {
      // Base WorkflowConfig fields
      baseUrl: this.config.baseUrl,
      maxParallelSessions: overrides?.maxParallelSessions ?? this.config.defaults?.maxParallelSessions ?? 3,
      timeoutPerShard: overrides?.timeoutPerShard ?? this.config.defaults?.timeoutPerShard ?? 300000,
      autoCleanup: overrides?.autoCleanup ?? this.config.defaults?.autoCleanup ?? true,

      // Sub-configurations
      sharding: shardingConfig,
      processing: processingConfig,
      aggregation: aggregationConfig,

      // Review-specific fields
      optimalTokensPerShard: overrides?.optimalTokensPerShard ?? this.config.defaults?.optimalTokensPerShard ?? 8000,
      maxTokensPerShard: overrides?.maxTokensPerShard ?? this.config.defaults?.maxTokensPerShard ?? 12000,
      minTokensPerShard: overrides?.minTokensPerShard ?? this.config.defaults?.minTokensPerShard ?? 2000,
      agent: overrides?.agent ?? this.config.defaults?.agent ?? 'code-reviewer',
      outputFormat: overrides?.outputFormat ?? this.config.defaults?.outputFormat ?? 'json',
      includeFilePatterns: overrides?.includeFilePatterns ?? this.config.defaults?.includeFilePatterns ?? [
        '**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx',
        '**/*.py', '**/*.java', '**/*.cs', '**/*.cpp',
        '**/*.c', '**/*.h', '**/*.go', '**/*.rs',
        '**/*.php', '**/*.rb', '**/*.swift', '**/*.kt'
      ],
      excludeFilePatterns: overrides?.excludeFilePatterns ?? this.config.defaults?.excludeFilePatterns ?? [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
        '**/coverage/**',
        '**/*.min.js',
        '**/*.bundle.js'
      ],
      maxFileSize: overrides?.maxFileSize ?? this.config.defaults?.maxFileSize ?? 1024 * 1024, // 1MB
      adoCredentials: this.config.adoCredentials,
      saveVersions: overrides?.saveVersions ?? this.config.defaults?.saveVersions ?? false
    }

    return new ReviewWorkflowProcessor(reviewConfig)
  }

  /**
   * Create a workflow processor for a specific type
   * Generic factory method that can be extended for other workflow types
   */
  createWorkflow<TInput extends WorkflowInput, TResult extends WorkflowResult>(
    type: WorkflowType,
    overrides?: any
  ): IWorkflowProcessor<TInput, TResult> {
    switch (type) {
      case WorkflowType.REVIEW:
        return this.createReviewWorkflow(overrides) as unknown as IWorkflowProcessor<TInput, TResult>

      default:
        throw new ValidationError(`Unsupported workflow type: ${type}`)
    }
  }

  /**
   * Create multiple workflow processors of the same type
   * Useful for parallel processing of multiple inputs
   */
  createWorkflowBatch<TInput extends WorkflowInput, TResult extends WorkflowResult>(
    type: WorkflowType,
    count: number,
    overrides?: any
  ): IWorkflowProcessor<TInput, TResult>[] {
    if (count <= 0) {
      throw new ValidationError('Batch count must be positive')
    }

    const workflows: IWorkflowProcessor<TInput, TResult>[] = []
    for (let i = 0; i < count; i++) {
      workflows.push(this.createWorkflow<TInput, TResult>(type, overrides))
    }

    this.logger.info(`Created batch of ${count} ${type} workflows`)
    return workflows
  }

  /**
   * Validate factory configuration
   */
  private validateConfig(): void {
    // Note: baseUrl is optional for local file system operation

    if (!this.config.adoCredentials) {
      throw new ValidationError('ADO credentials are required')
    }

    if (!this.config.adoCredentials.pat) {
      throw new ValidationError('ADO Personal Access Token is required')
    }

    if (this.config.defaults?.maxParallelSessions !== undefined && this.config.defaults.maxParallelSessions < 1) {
      throw new ValidationError('Max parallel sessions must be at least 1')
    }

    if (this.config.defaults?.timeoutPerShard && this.config.defaults.timeoutPerShard < 1000) {
      throw new ValidationError('Timeout per shard must be at least 1000ms')
    }

    if (this.config.defaults?.optimalTokensPerShard && this.config.defaults.optimalTokensPerShard < 1000) {
      throw new ValidationError('Optimal tokens per shard must be at least 1000')
    }

    if (this.config.defaults?.maxTokensPerShard && this.config.defaults?.optimalTokensPerShard) {
      if (this.config.defaults.maxTokensPerShard <= this.config.defaults.optimalTokensPerShard) {
        throw new ValidationError('Max tokens per shard must be greater than optimal tokens per shard')
      }
    }

    this.logger.debug('Factory configuration validated successfully')
  }

  /**
   * Get supported workflow types
   */
  getSupportedWorkflowTypes(): WorkflowType[] {
    return [WorkflowType.REVIEW]
  }

  /**
   * Get factory configuration (read-only)
   */
  getConfig(): Readonly<WorkflowFactoryConfig> {
    return Object.freeze({ ...this.config })
  }

  /**
   * Create a factory with environment-based configuration
   * Convenient method for common setup patterns
   */
  static createFromEnvironment(overrides?: Partial<WorkflowFactoryConfig>): WorkflowFactory {
    const envBaseUrl = process.env['OPENCODE_BASE_URL']
    const baseUrl = envBaseUrl !== undefined ? envBaseUrl : 'http://localhost:3000'
    console.log('🚨 WORKFLOWFACTORY: OPENCODE_BASE_URL env var:', envBaseUrl)
    console.log('🚨 WORKFLOWFACTORY: Using baseUrl:', baseUrl)
    const adoToken = process.env['ADO_PAT'] || process.env['AZURE_DEVOPS_PAT']

    if (!adoToken) {
      throw new Error('ADO_PAT or AZURE_DEVOPS_PAT environment variable is required')
    }

    const config: WorkflowFactoryConfig = {
      baseUrl,
      adoCredentials: {
        pat: adoToken,
        organization: 'skype' // Default organization from original script
      },
      defaults: {
        agent: 'code-reviewer',
        outputFormat: 'json',
        autoCleanup: true,
        saveVersions: false,
        maxParallelSessions: 3,
        timeoutPerShard: 300000, // 5 minutes
        optimalTokensPerShard: 8000,
        maxTokensPerShard: 12000,
        minTokensPerShard: 2000,
        includeFilePatterns: [
          '**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx',
          '**/*.py', '**/*.java', '**/*.cs', '**/*.cpp',
          '**/*.c', '**/*.h', '**/*.go', '**/*.rs',
          '**/*.php', '**/*.rb', '**/*.swift', '**/*.kt'
        ],
        excludeFilePatterns: [
          '**/node_modules/**',
          '**/dist/**',
          '**/build/**',
          '**/.git/**',
          '**/coverage/**',
          '**/*.min.js',
          '**/*.bundle.js'
        ],
        maxFileSize: 1024 * 1024 // 1MB
      },
      ...overrides
    }

    return new WorkflowFactory(config)
  }
}

/**
 * Convenience function to create a review workflow quickly
 * Uses environment-based configuration with sensible defaults
 */
export function createReviewWorkflow(overrides?: Partial<ReviewConfig>): IWorkflowProcessor<ReviewInput, ReviewResult> {
  const factory = WorkflowFactory.createFromEnvironment()
  return factory.createReviewWorkflow(overrides)
}

/**
 * Convenience function for processing a single review input
 * Handles workflow creation, processing, and cleanup automatically
 */
export async function processReview(
  input: ReviewInput,
  config?: Partial<ReviewConfig>
): Promise<ReviewResult> {
  const workflow = createReviewWorkflow(config)

  try {
    const result = await workflow.process(input, config)
    return result
  } catch (error) {
    createLogger('processReview').error(`Review processing failed: ${error}`)
    throw error
  }
}

/**
 * Convenience function for batch processing multiple review inputs
 * Processes multiple PRs in parallel with controlled concurrency
 */
export async function processReviewBatch(
  inputs: ReviewInput[],
  config?: Partial<ReviewConfig> & { maxConcurrency?: number }
): Promise<ReviewResult[]> {
  const logger = createLogger('processReviewBatch')
  const maxConcurrency = config?.maxConcurrency ?? 3

  logger.info(`Processing batch of ${inputs.length} reviews with max concurrency ${maxConcurrency}`)

  const results: ReviewResult[] = []
  const errors: Error[] = []

  // Process in batches to control concurrency
  for (let i = 0; i < inputs.length; i += maxConcurrency) {
    const batch = inputs.slice(i, i + maxConcurrency)

    const batchPromises = batch.map(async (input, index) => {
      try {
        const workflow = createReviewWorkflow(config)
        const result = await workflow.process(input, config)
        logger.debug(`Completed review ${i + index + 1}/${inputs.length}: ${input.identifier}`)
        return result
      } catch (error) {
        logger.error(`Failed review ${i + index + 1}/${inputs.length}: ${input.identifier} - ${error}`)
        errors.push(error as Error)
        throw error
      }
    })

    const batchResults = await Promise.allSettled(batchPromises)

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value)
      }
    }
  }

  if (errors.length > 0) {
    logger.warn(`Batch processing completed with ${errors.length} errors out of ${inputs.length} total`)
  } else {
    logger.info(`Batch processing completed successfully for all ${inputs.length} reviews`)
  }

  return results
}