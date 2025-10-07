/**
 * File Boundary Sharding Strategy implementation
 * Intelligent sharding that respects file boundaries while optimizing token usage
 * Extracted from scripts/sharded-review-parallel.js
 */

import type { IShardingStrategy } from '../core/interfaces.js'
import type {
  SourceContent,
  ShardingConfig,
  Shard,
  ShardingStrategyMetadata,
  ContentFile,
  ShardMetadata
} from '../types/index.js'
import { ShardingStrategyType } from '../types/index.js'
import { estimateTokens, createLogger } from '../core/utils.js'

/**
 * File Boundary Sharding Strategy
 * Creates shards based on file boundaries while respecting token limits
 */
export class FileBoundaryShardingStrategy implements IShardingStrategy {
  private readonly logger = createLogger('FileBoundaryShardingStrategy')

  /**
   * Create shards from source content
   * Implements the smart sharding algorithm from the original script
   */
  async createShards(content: SourceContent, config: ShardingConfig): Promise<Shard[]> {
    if (!this.validateConfig(config)) {
      throw new Error('Invalid sharding configuration')
    }

    const files = content.content.files
    if (files.length === 0) {
      throw new Error('No files to shard')
    }

    this.logger.info(`Creating file-boundary shards for ${files.length} files with target ${config.targetTokens} tokens per shard`)

    const shards: Shard[] = []
    let currentShardFiles: ContentFile[] = []
    let currentShardTokens = 0
    let shardIndex = 0

    // Sort files by tokens to optimize distribution
    const sortedFiles = [...files].sort((a, b) => a.tokens - b.tokens)

    for (const file of sortedFiles) {
      // If adding this file would exceed the target AND we have files in current shard,
      // finalize the current shard and start a new one
      if (currentShardTokens > 0 && currentShardTokens + file.tokens > config.targetTokens) {
        const shard = this.createShard(shardIndex, currentShardFiles, config)
        shards.push(shard)

        this.logger.debug(`Created shard ${shardIndex}: ${currentShardFiles.length} files, ${currentShardTokens} tokens`)

        // Reset for next shard
        currentShardFiles = []
        currentShardTokens = 0
        shardIndex++
      }

      // Add file to current shard
      currentShardFiles.push(file)
      currentShardTokens += file.tokens

      // If this single file is larger than target tokens, put it in its own shard
      if (file.tokens > config.targetTokens) {
        const shard = this.createShard(shardIndex, currentShardFiles, config)
        shards.push(shard)

        this.logger.debug(`Created large file shard ${shardIndex}: ${file.path} (${file.tokens} tokens)`)

        // Reset for next shard
        currentShardFiles = []
        currentShardTokens = 0
        shardIndex++
      }
    }

    // Add remaining files to final shard
    if (currentShardFiles.length > 0) {
      const shard = this.createShard(shardIndex, currentShardFiles, config)
      shards.push(shard)
      this.logger.debug(`Created final shard ${shardIndex}: ${currentShardFiles.length} files, ${currentShardTokens} tokens`)
    }

    // Validate shard constraints
    this.validateShards(shards, config)

    this.logger.info(`Created ${shards.length} file-boundary shards with average ${Math.round(shards.reduce((sum, s) => sum + s.tokens, 0) / shards.length)} tokens per shard`)

    return shards
  }

  /**
   * Create a single shard from files
   */
  private createShard(index: number, files: ContentFile[], config: ShardingConfig): Shard {
    // Combine all file contents with separators
    const shardContent = files.map(file => {
      // Add file header for context
      const header = `\n=== FILE: ${file.path} ===\n`
      return header + file.content
    }).join('\n\n')

    // Calculate actual token count
    const actualTokens = estimateTokens(shardContent)

    const metadata: ShardMetadata = {
      fileCount: files.length,
      strategy: 'file_boundary_aware',
      createdAt: new Date().toISOString(),
      estimatedProcessingTime: this.estimateProcessingTime(actualTokens)
    }

    return {
      index,
      files: files,
      content: shardContent,
      tokens: actualTokens,
      metadata
    }
  }

  /**
   * Estimate processing time based on token count
   */
  private estimateProcessingTime(tokens: number): number {
    // Rough estimate: ~1 second per 1000 tokens based on experience
    return Math.max(5000, tokens * 1.2) // Minimum 5 seconds
  }

  /**
   * Validate shards meet configuration constraints
   */
  private validateShards(shards: Shard[], config: ShardingConfig): void {
    for (const shard of shards) {
      // Check minimum token constraint
      if (shard.tokens < config.minTokens && shards.length > 1) {
        this.logger.warn(`Shard ${shard.index} has ${shard.tokens} tokens, below minimum ${config.minTokens}`)
      }

      // Check maximum token constraint (allow some overage for file boundaries)
      if (shard.tokens > config.maxTokens * 1.2) { // 20% overage allowed
        this.logger.warn(`Shard ${shard.index} has ${shard.tokens} tokens, significantly above maximum ${config.maxTokens}`)
      }

      // Ensure shard has files
      if (shard.files.length === 0) {
        throw new Error(`Shard ${shard.index} has no files`)
      }
    }
  }

  /**
   * Estimate shard count for content
   */
  estimateShardCount(content: SourceContent, config: ShardingConfig): number {
    const totalTokens = content.content.totalTokens

    if (totalTokens <= config.targetTokens) {
      return 1
    }

    // Estimate based on target tokens, but account for file boundary overhead
    const baseEstimate = Math.ceil(totalTokens / config.targetTokens)

    // Add 10-20% overhead for file boundary preservation
    const overhead = Math.ceil(baseEstimate * 0.15)

    return Math.max(1, baseEstimate + overhead)
  }

  /**
   * Validate sharding configuration
   */
  validateConfig(config: ShardingConfig): boolean {
    if (config.targetTokens <= 0) {
      this.logger.error('Target tokens must be positive')
      return false
    }

    if (config.minTokens < 0) {
      this.logger.error('Minimum tokens cannot be negative')
      return false
    }

    if (config.maxTokens <= config.targetTokens) {
      this.logger.error('Maximum tokens must be greater than target tokens')
      return false
    }

    if (config.minTokens > config.targetTokens) {
      this.logger.error('Minimum tokens cannot be greater than target tokens')
      return false
    }

    return true
  }

  /**
   * Get strategy metadata
   */
  getMetadata(): ShardingStrategyMetadata {
    return {
      type: ShardingStrategyType.FILE_BOUNDARY,
      description: 'Intelligent file-boundary-aware sharding that respects file boundaries while optimizing token usage',
      capabilities: [
        'File boundary preservation',
        'Token optimization',
        'Large file handling',
        'Intelligent distribution',
        'Configurable constraints'
      ],
      recommendedUse: [
        'Code review workflows',
        'Multi-file analysis',
        'Content with natural boundaries',
        'Token-constrained processing'
      ]
    }
  }

  /**
   * Get sharding statistics for analysis
   */
  getShardingStatistics(shards: Shard[]): {
    totalShards: number
    averageTokensPerShard: number
    averageFilesPerShard: number
    tokenDistribution: { min: number; max: number; median: number }
    fileDistribution: { min: number; max: number; median: number }
  } {
    if (shards.length === 0) {
      return {
        totalShards: 0,
        averageTokensPerShard: 0,
        averageFilesPerShard: 0,
        tokenDistribution: { min: 0, max: 0, median: 0 },
        fileDistribution: { min: 0, max: 0, median: 0 }
      }
    }

    const tokens = shards.map(s => s.tokens).sort((a, b) => a - b)
    const fileCounts = shards.map(s => s.files.length).sort((a, b) => a - b)

    const getMedian = (arr: number[]) => {
      const mid = Math.floor(arr.length / 2)
      return arr.length % 2 === 0 ? (arr[mid - 1] + arr[mid]) / 2 : arr[mid]
    }

    return {
      totalShards: shards.length,
      averageTokensPerShard: Math.round(tokens.reduce((sum, t) => sum + t, 0) / tokens.length),
      averageFilesPerShard: Math.round(fileCounts.reduce((sum, c) => sum + c, 0) / fileCounts.length),
      tokenDistribution: {
        min: tokens[0],
        max: tokens[tokens.length - 1],
        median: Math.round(getMedian(tokens))
      },
      fileDistribution: {
        min: fileCounts[0],
        max: fileCounts[fileCounts.length - 1],
        median: Math.round(getMedian(fileCounts))
      }
    }
  }
}