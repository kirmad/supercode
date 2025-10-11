/**
 * Session Processing Engine implementation
 * Handles parallel processing with session management and batching
 * Extracted from scripts/sharded-review-parallel.js
 */

import type { IProcessingEngine, IOperationSubscriber } from '../core/interfaces.js'
import type {
  Shard,
  ShardResult,
  ProcessingConfig,
  ShardProcessor
} from '../types/index.js'
import { ProcessingStatus } from '../types/index.js'
import { createLogger, sleep, retry } from '../core/utils.js'

/**
 * Session configuration for the processing engine
 */
export interface SessionConfig {
  baseUrl: string
  provider: string
  model: string
  agent: string
  timeoutPerShard: number
  maxRetries: number
  retryDelay: number
  // Optional operation subscription integration
  operationSubscriber?: IOperationSubscriber
  topicId?: string
}

/**
 * Session Processing Engine
 * Manages parallel processing with session lifecycle and batching
 * Supports automatic session registration with operation subscription topics
 */
export class SessionProcessingEngine implements IProcessingEngine {
  private readonly config: SessionConfig
  private readonly logger = createLogger('SessionProcessingEngine')
  private status: ProcessingStatus = ProcessingStatus.IDLE
  private partialResults: ShardResult[] = []
  private activeSessions = new Set<string>()
  private cancelled = false

  constructor(config: SessionConfig) {
    this.config = config

    // Validate operation subscription configuration
    if (config.operationSubscriber && !config.topicId) {
      this.logger.warn('Operation subscriber provided without topic ID - session registration disabled')
    } else if (!config.operationSubscriber && config.topicId) {
      this.logger.warn('Topic ID provided without operation subscriber - session registration disabled')
    }
  }

  /**
   * Validate processing configuration
   */
  validateConfig(config: ProcessingConfig): boolean {
    try {
      // Validate batch size
      if (config.batchSize <= 0) {
        return false
      }

      // Validate retry attempts (can be 0 for no retries)
      if (config.retryAttempts < 0) {
        return false
      }

      // Validate retry delay
      if (config.retryDelay < 0) {
        return false
      }

      // Validate timeout
      if (config.timeout < 0) {
        return false
      }

      return true
    } catch {
      return false
    }
  }

  /**
   * Process shards in parallel batches
   */
  async processShards(
    shards: Shard[],
    processor: ShardProcessor,
    config: ProcessingConfig
  ): Promise<ShardResult[]> {
    // Validate configuration first
    if (!this.validateConfig(config)) {
      throw new Error('Invalid processing configuration')
    }

    if (shards.length === 0) {
      return []
    }

    this.logger.info(`Processing ${shards.length} shards in batches of ${config.batchSize}`)
    this.status = ProcessingStatus.PROCESSING
    this.partialResults = []
    this.cancelled = false

    try {
      const results: ShardResult[] = []
      const batchSize = config.batchSize

      for (let i = 0; i < shards.length; i += batchSize) {
        if (this.cancelled) {
          this.logger.info('Processing cancelled')
          break
        }

        const batch = shards.slice(i, i + batchSize)
        const batchNumber = Math.floor(i / batchSize) + 1
        const totalBatches = Math.ceil(shards.length / batchSize)

        this.logger.info(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} shards)`)

        // Process batch in parallel using the provided processor
        const batchPromises = batch.map(shard =>
          this.processShardWithSession(shard, processor, config)
        )

        const batchResults = await Promise.all(batchPromises)
        results.push(...batchResults)
        this.partialResults = [...results]

        // Short delay between batches to avoid overwhelming the server
        if (i + batchSize < shards.length && !this.cancelled) {
          this.logger.debug('Brief pause before next batch')
          await sleep(1000)
        }
      }

      this.status = ProcessingStatus.COMPLETED
      this.logger.info(`Processing completed: ${results.filter(r => r.success).length}/${results.length} successful`)

      return results

    } catch (error) {
      this.status = ProcessingStatus.ERROR
      this.logger.error(`Processing failed: ${error}`)
      throw error
    }
  }

  /**
   * Process a single shard with dedicated session
   */
  private async processShardWithSession(
    shard: Shard,
    processor: ShardProcessor,
    config: ProcessingConfig
  ): Promise<ShardResult> {
    let sessionId: string | undefined

    try {
      // Create dedicated session for this shard
      sessionId = await this.createSession()
      this.activeSessions.add(sessionId)
      this.logger.debug(`[Shard ${shard.index}] Created session: ${sessionId}`)

      // Process shard with retry logic
      const result = await retry(
        () => this.processShardContent(shard, sessionId!, config),
        {
          attempts: config.retryAttempts,
          delay: config.retryDelay,
          shouldRetry: (error) => {
            // Retry on network errors, but not on content/validation errors
            return error.message.includes('HTTP') || error.message.includes('fetch')
          }
        }
      )

      this.logger.debug(`[Shard ${shard.index}] Processing completed successfully`)
      return result

    } catch (error) {
      this.logger.error(`[Shard ${shard.index}] Processing failed: ${error}`)
      return {
        shardIndex: shard.index,
        success: false,
        error: error as Error,
        processingTime: 0,
        metadata: { sessionId }
      }

    } finally {
      // Cleanup session
      if (sessionId) {
        this.logger.debug(`[Shard ${shard.index}] Cleaning up session: ${sessionId}`)
        await this.cleanupSession(sessionId)
        this.activeSessions.delete(sessionId)
      }
    }
  }

  /**
   * Process shard content using the API
   */
  private async processShardContent(
    shard: Shard,
    sessionId: string,
    config: ProcessingConfig
  ): Promise<ShardResult> {
    const startTime = Date.now()

    // Generate the review prompt with the exact XML format from the original script
    const prompt = this.generateReviewPrompt(shard.content)

    this.logger.debug(`[Shard ${shard.index}] Starting XML generation`)

    const response = await fetch(`${this.config.baseUrl}/session/${sessionId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parts: [{ type: 'text', text: prompt }],
        agent: this.config.agent
      }),
      signal: AbortSignal.timeout(config.timeout)
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const responseText = await response.text()
    const responseData = JSON.parse(responseText)

    // Extract XML content from response
    let xmlContent = ''
    if (responseData.parts) {
      for (const part of responseData.parts) {
        if (part.type === 'text' && part.text) {
          xmlContent += part.text
        }
      }
    }

    if (xmlContent.length === 0) {
      throw new Error('Empty XML content received')
    }

    const processingTime = Date.now() - startTime

    this.logger.debug(`[Shard ${shard.index}] Generated XML (${xmlContent.length} chars) in ${processingTime}ms`)

    return {
      shardIndex: shard.index,
      success: true,
      result: xmlContent,
      processingTime,
      metadata: {
        sessionId,
        contentLength: xmlContent.length,
        fileCount: shard.files.length,
        tokens: shard.tokens
      }
    }
  }

  /**
   * Generate review prompt (extracted from original script)
   */
  private generateReviewPrompt(shardContent: string): string {
    return `Please conduct a code review and follow the exact XML output format.

**CRITICAL**: Use this exact XML structure:

1. First output multiple <review-insight> tags as you read:

<review-insight type="security" severity="high">
[Your immediate security observation]
</review-insight>

<review-insight type="performance" severity="medium">
[Your performance observation]
</review-insight>

2. Then output ONE <review-result> containing both hunks and comments:

<review-result>

<hunks>
<hunk file="ACTUAL_FILE_PATH_FROM_DIFF" start="10" end="20">
<category>security-fix</category>
<risk>high</risk>
<description>Brief description of what this hunk does</description>
<needs-attention>yes</needs-attention>
</hunk>
</hunks>

<comments>
<comment>
<file>ACTUAL_FILE_PATH_FROM_DIFF</file>
<lines start="15" end="15"/>
<type>issue</type>
<severity>high</severity>
<message>Specific issue description</message>
<fix-code>
\`\`\`javascript
// Fixed code here
\`\`\`
</fix-code>
</comment>
</comments>

</review-result>

**IMPORTANT**: 
- Use the EXACT file paths as they appear in the diff headers (e.g., "b/SkypeCast/UserPolicy.cs")
- Use the EXACT line numbers from the diff
- Do NOT use placeholder paths like "path/to/file.ext"
- Comments should be clear and actionable. We should focus on critical and major issues. 

**Code diff to review:**
\`\`\`diff
${shardContent}
\`\`\`

Output ONLY the XML format above. Focus on security, performance, quality issues with specific line numbers from the actual files in the diff.`
  }

  /**
   * Create a new session
   * Automatically registers with operation subscription topic if configured
   */
  private async createSession(): Promise<string> {
    const response = await fetch(`${this.config.baseUrl}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: this.config.provider,
        model: this.config.model
      })
    })

    if (!response.ok) {
      throw new Error(`Session creation failed: ${response.statusText}`)
    }

    const session = await response.json()
    const sessionId = session.id

    // Register session with operation subscription topic if configured
    if (this.config.operationSubscriber && this.config.topicId) {
      try {
        this.config.operationSubscriber.addSessionToTopic(this.config.topicId, sessionId)
        this.logger.debug(`Session ${sessionId} registered with topic ${this.config.topicId}`)
      } catch (error) {
        this.logger.warn(`Failed to register session ${sessionId} with topic: ${error}`)
      }
    }

    return sessionId
  }

  /**
   * Cleanup a session
   * Automatically deregisters from operation subscription topic if configured
   */
  private async cleanupSession(sessionId: string): Promise<void> {
    // Deregister session from operation subscription topic if configured
    if (this.config.operationSubscriber && this.config.topicId) {
      try {
        this.config.operationSubscriber.removeSessionFromTopic(this.config.topicId, sessionId)
        this.logger.debug(`Session ${sessionId} deregistered from topic ${this.config.topicId}`)
      } catch (error) {
        this.logger.warn(`Failed to deregister session ${sessionId} from topic: ${error}`)
      }
    }

    try {
      await fetch(`${this.config.baseUrl}/session/${sessionId}`, {
        method: 'DELETE',
        signal: AbortSignal.timeout(5000) // 5 second timeout for cleanup
      })
    } catch (error) {
      // Ignore cleanup errors - sessions will be cleaned up by the server eventually
      this.logger.debug(`Session cleanup failed for ${sessionId}: ${error}`)
    }
  }

  /**
   * Get processing status
   */
  getStatus(): ProcessingStatus {
    return this.status
  }

  /**
   * Cancel ongoing processing
   */
  async cancel(): Promise<void> {
    this.logger.info('Cancelling processing')
    this.cancelled = true
    this.status = ProcessingStatus.CANCELLED

    // Cleanup all active sessions
    const cleanupPromises = Array.from(this.activeSessions).map(sessionId =>
      this.cleanupSession(sessionId)
    )

    await Promise.allSettled(cleanupPromises)
    this.activeSessions.clear()
  }

  /**
   * Get partial results from ongoing processing
   */
  getPartialResults(): ShardResult[] {
    return [...this.partialResults]
  }

  /**
   * Get processing statistics
   */
  getProcessingStatistics(): {
    totalProcessed: number
    successful: number
    failed: number
    averageProcessingTime: number
    activeSessions: number
  } {
    const results = this.partialResults
    const successful = results.filter(r => r.success)
    const failed = results.filter(r => !r.success)
    const avgTime = successful.length > 0
      ? successful.reduce((sum, r) => sum + r.processingTime, 0) / successful.length
      : 0

    return {
      totalProcessed: results.length,
      successful: successful.length,
      failed: failed.length,
      averageProcessingTime: Math.round(avgTime),
      activeSessions: this.activeSessions.size
    }
  }
}