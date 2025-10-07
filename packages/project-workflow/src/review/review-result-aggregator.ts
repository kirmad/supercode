/**
 * Review Result Aggregator implementation
 * Handles XML to JSON conversion and result aggregation
 * Extracted from scripts/sharded-review-parallel.js
 */

import type { IResultAggregator } from '../core/interfaces.js'
import type {
  ShardResult,
  SourceMetadata,
  AggregationConfig,
  AggregationStatistics,
  ReviewResult,
  ReviewInsight,
  ReviewHunk,
  ReviewComment,
  ADOComment,
  CommentAuthor,
  CommentResponse
} from '../types/index.js'
import {
  InsightType,
  SeverityLevel,
  RiskLevel,
  CommentType,
  HunkCategory
} from '../types/index.js'
import { generateId, createHash, createLogger } from '../core/utils.js'

/**
 * Parsed XML data from a single shard
 */
interface ParsedShardData {
  insights: ReviewInsight[]
  hunks: ReviewHunk[]
  comments: ReviewComment[]
}

/**
 * Review Result Aggregator
 * Converts XML results to JSON and merges with ADO comments
 */
export class ReviewResultAggregator implements IResultAggregator<ReviewResult> {
  private readonly logger = createLogger('ReviewResultAggregator')

  /**
   * Aggregate shard results into final review result
   */
  async aggregateResults(
    results: ShardResult[],
    metadata: SourceMetadata,
    config: AggregationConfig,
    adoComments?: ADOComment[]
  ): Promise<ReviewResult> {
    this.logger.info(`Aggregating ${results.length} shard results`)

    const successful = results.filter(r => r.success)
    if (successful.length === 0) {
      throw new Error('No successful shard results to aggregate')
    }

    // Parse XML from each successful result
    const parsedData: ParsedShardData[] = []
    for (const result of successful) {
      if (typeof result.result === 'string') {
        const parsed = this.parseXMLToJSON(result.result, result.shardIndex)
        parsedData.push(parsed)
        this.logger.debug(`Parsed shard ${result.shardIndex}: ${parsed.insights.length} insights, ${parsed.hunks.length} hunks, ${parsed.comments.length} comments`)
      }
    }

    // Aggregate all parsed data
    const allInsights: ReviewInsight[] = []
    const allHunks: ReviewHunk[] = []
    const allComments: ReviewComment[] = []

    for (const data of parsedData) {
      allInsights.push(...data.insights)
      allHunks.push(...data.hunks)
      allComments.push(...data.comments)
    }

    // Transform AI comments to unified format
    const transformedAIComments = this.transformAIComments(allComments)

    // Get existing ADO comments from parameter or metadata (if available)
    const processedAdoComments = this.processADOComments(adoComments || (metadata as any).adoComments || [])

    // Merge and thread comments
    const unifiedComments = this.mergeAndThreadComments(transformedAIComments, processedAdoComments)

    // Create review result
    const reviewResult: ReviewResult = {
      success: true,
      metadata: {
        type: 'review',
        version: '1.0.0',
        capabilities: ['xml-parsing', 'comment-threading', 'ado-integration'],
        generatedAt: new Date().toISOString(),
        processingStats: this.calculateProcessingStats(results)
      },
      statistics: this.calculateProcessingStats(results),
      insights: config.sortResults ? this.sortInsights(allInsights) : allInsights,
      hunks: config.sortResults ? this.sortHunks(allHunks) : allHunks,
      comments: unifiedComments,
      adoComments: processedAdoComments
    }

    this.logger.info(`Aggregation completed: ${allInsights.length} insights, ${allHunks.length} hunks, ${unifiedComments.length} comments`)

    return reviewResult
  }

  /**
   * Parse XML content to extract insights, hunks, and comments
   * Extracted from parseXMLToJSON function in original script
   */
  private parseXMLToJSON(xmlContent: string, shardIndex: number): ParsedShardData {
    const insights: ReviewInsight[] = []
    const hunks: ReviewHunk[] = []
    const comments: ReviewComment[] = []

    // Extract review insights
    const insightRegex = /<review-insight[^>]*type="([^"]*)"[^>]*severity="([^"]*)"[^>]*>([\s\S]*?)<\/review-insight>/g
    let match: RegExpExecArray | null

    while ((match = insightRegex.exec(xmlContent)) !== null) {
      insights.push({
        shard: shardIndex,
        type: this.mapInsightType(match[1]),
        severity: this.mapSeverityLevel(match[2]),
        content: match[3].trim()
      })
    }

    // Extract hunks
    const hunkRegex = /<hunk[^>]*file="([^"]*)"[^>]*start="([^"]*)"[^>]*end="([^"]*)"[^>]*>([\s\S]*?)<\/hunk>/g
    while ((match = hunkRegex.exec(xmlContent)) !== null) {
      const hunkContent = match[4]
      const categoryMatch = hunkContent.match(/<category>(.*?)<\/category>/)
      const riskMatch = hunkContent.match(/<risk>(.*?)<\/risk>/)
      const descMatch = hunkContent.match(/<description>(.*?)<\/description>/)
      const attentionMatch = hunkContent.match(/<needs-attention>(.*?)<\/needs-attention>/)

      hunks.push({
        shard: shardIndex,
        file: match[1],
        startLine: parseInt(match[2]) || 0,
        endLine: parseInt(match[3]) || 0,
        category: this.mapHunkCategory(categoryMatch ? categoryMatch[1] : 'unknown'),
        risk: this.mapRiskLevel(riskMatch ? riskMatch[1] : 'unknown'),
        description: descMatch ? descMatch[1] : '',
        needsAttention: attentionMatch ? attentionMatch[1] === 'yes' : false
      })
    }

    // Extract comments
    const commentRegex = /<comment>([\s\S]*?)<\/comment>/g
    while ((match = commentRegex.exec(xmlContent)) !== null) {
      const commentContent = match[1]
      const fileMatch = commentContent.match(/<file>(.*?)<\/file>/)
      const linesMatch = commentContent.match(/<lines[^>]*start="([^"]*)"[^>]*end="([^"]*)"[^>]*\/>/)
      const typeMatch = commentContent.match(/<type>(.*?)<\/type>/)
      const severityMatch = commentContent.match(/<severity>(.*?)<\/severity>/)
      const messageMatch = commentContent.match(/<message>(.*?)<\/message>/)
      const fixCodeMatch = commentContent.match(/<fix-code>([\s\S]*?)<\/fix-code>/)

      const file = fileMatch ? fileMatch[1] : ''
      const startLine = linesMatch ? parseInt(linesMatch[1]) || 0 : 0
      const endLine = linesMatch ? parseInt(linesMatch[2]) || 0 : 0

      comments.push({
        shard: shardIndex,
        file: file,
        startLine: startLine,
        endLine: endLine,
        type: this.mapCommentType(typeMatch ? typeMatch[1] : 'unknown'),
        severity: this.mapSeverityLevel(severityMatch ? severityMatch[1] : 'unknown'),
        message: messageMatch ? messageMatch[1] : '',
        fixCode: fixCodeMatch ? fixCodeMatch[1].trim() : '',
        threadId: `${file}-${startLine}-${endLine}`,
        id: generateId(`ai-${shardIndex}`),
        author: { type: 'ai', name: 'AI Assistant' },
        createdAt: new Date().toISOString()
      })
    }

    return { insights, hunks, comments }
  }

  /**
   * Transform AI comments to unified format
   */
  private transformAIComments(comments: ReviewComment[]): ReviewComment[] {
    return comments.map((comment, index) => ({
      ...comment,
      id: comment.shard !== undefined ? `ai-${comment.shard}-${index}` : `ai-${index}`,
      threadId: `${comment.file}-${comment.startLine}-${comment.endLine}`,
      author: { type: 'ai', name: 'AI Assistant' },
      createdAt: comment.createdAt || new Date().toISOString()
    }))
  }

  /**
   * Process ADO comments and generate stable IDs
   * Extracted from aggregateResults function in original script
   */
  private processADOComments(adoComments: any[]): ADOComment[] {
    return adoComments.map(comment => {
      // If comment already has a properly formatted stable ID (starts with "ado-"), use it as-is
      if (comment.id && typeof comment.id === 'string' && comment.id.startsWith('ado-')) {
        this.logger.debug(`Using existing stable ID for comment: ${comment.id}`)
        return { ...comment }
      }

      // Handle AI comments that have been published to ADO
      if (comment.publishedToADO && comment.adoThreadId) {
        return {
          ...comment,
          id: comment.id || `ado-${comment.adoThreadId}${comment.adoCommentId ? `-${comment.adoCommentId}` : ''}`,
          author: {
            type: 'ai',
            name: comment.author?.name || 'AI Review (Published to ADO)'
          },
          isPublishedToADO: true,
          adoProperties: {
            threadId: comment.adoThreadId,
            commentId: comment.adoCommentId,
            publishedDate: comment.publishedDate
          }
        }
      }

      // Generate stable ID for regular ADO comments (only if not already formatted)
      if (comment.id) {
        if (comment.createdAt || comment.publishedDate) {
          const timestamp = new Date(comment.createdAt || comment.publishedDate).getTime()
          return { ...comment, id: `ado-${comment.id}-${timestamp}` }
        }
        return { ...comment, id: `ado-${comment.id}` }
      } else if (comment.adoThreadId && comment.adoThreadId !== 1) {
        return { ...comment, id: `ado-${comment.adoThreadId}` }
      } else if (comment.threadId && comment.threadId !== 1) {
        return { ...comment, id: `ado-${comment.threadId}` }
      } else {
        // Fallback: create hash from content and timestamp
        const hashInput = `${comment.threadId || 1}-${comment.createdDate || comment.createdAt || ''}-${comment.message?.substring(0, 50) || ''}`
        const hash = createHash(hashInput)
        return { ...comment, id: `ado-hash-${hash}` }
      }
    })
  }

  /**
   * Merge AI and ADO comments with threading support
   * Extracted from aggregateResults function in original script
   */
  private mergeAndThreadComments(aiComments: ReviewComment[], adoComments: ADOComment[]): ReviewComment[] {
    // Merge all comments
    const allComments = [...aiComments, ...adoComments]
    const commentsByThread = new Map<string, any[]>()

    // Group comments by threadId
    allComments.forEach(comment => {
      const threadId = comment.threadId || 'default'
      if (!commentsByThread.has(threadId)) {
        commentsByThread.set(threadId, [])
      }
      commentsByThread.get(threadId)!.push(comment)
    })

    // Create unified comments with thread support
    const unifiedComments: ReviewComment[] = []

    for (const [threadId, threadComments] of commentsByThread) {
      // Sort by creation date, with AI comments first if same threadId
      threadComments.sort((a, b) => {
        const aTime = new Date(a.createdAt || '').getTime()
        const bTime = new Date(b.createdAt || '').getTime()
        if (aTime === bTime) {
          // If same time, prioritize AI comments
          return a.author?.type === 'ai' ? -1 : 1
        }
        return aTime - bTime
      })

      const primaryComment = threadComments[0]

      // Create the unified comment based on the primary comment
      const unifiedComment: ReviewComment = {
        ...primaryComment,
        threadId: threadId
      }

      // Add thread responses if there are multiple comments in the thread
      if (threadComments.length > 1) {
        unifiedComment.responses = threadComments.slice(1).map((comment, index): CommentResponse => ({
          id: comment.id || `response-${threadId}-${index + 1}`,
          author: comment.author || { type: 'user', name: 'Unknown' },
          content: comment.message || comment.content || '',
          createdAt: comment.createdAt || new Date().toISOString(),
          ...(comment.shard !== undefined && { shard: comment.shard })
        }))
      }

      unifiedComments.push(unifiedComment)
    }

    return unifiedComments
  }

  /**
   * Sort insights by severity and type
   */
  private sortInsights(insights: ReviewInsight[]): ReviewInsight[] {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    return insights.sort((a, b) => {
      const severityDiff = (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4)
      if (severityDiff !== 0) return severityDiff
      return a.type.localeCompare(b.type)
    })
  }

  /**
   * Sort hunks by file and line number
   */
  private sortHunks(hunks: ReviewHunk[]): ReviewHunk[] {
    return hunks.sort((a, b) => {
      const fileDiff = a.file.localeCompare(b.file)
      if (fileDiff !== 0) return fileDiff
      return a.startLine - b.startLine
    })
  }

  /**
   * Calculate processing statistics
   */
  private calculateProcessingStats(results: ShardResult[]) {
    const successful = results.filter(r => r.success)
    const failed = results.filter(r => !r.success)
    const totalTime = successful.reduce((sum, r) => sum + r.processingTime, 0)

    return {
      totalShards: results.length,
      successfulShards: successful.length,
      failedShards: failed.length,
      totalProcessingTime: totalTime,
      averageShardTime: successful.length > 0 ? Math.round(totalTime / successful.length) : 0,
      parallelProcessing: true
    }
  }

  /**
   * Map string to InsightType enum
   */
  private mapInsightType(type: string): InsightType {
    switch (type.toLowerCase()) {
      case 'security': return InsightType.SECURITY
      case 'performance': return InsightType.PERFORMANCE
      case 'quality': return InsightType.QUALITY
      case 'maintainability': return InsightType.MAINTAINABILITY
      default: return InsightType.QUALITY
    }
  }

  /**
   * Map string to SeverityLevel enum
   */
  private mapSeverityLevel(severity: string): SeverityLevel {
    switch (severity.toLowerCase()) {
      case 'critical': return SeverityLevel.CRITICAL
      case 'high': return SeverityLevel.HIGH
      case 'medium': return SeverityLevel.MEDIUM
      case 'low': return SeverityLevel.LOW
      default: return SeverityLevel.MEDIUM
    }
  }

  /**
   * Map string to RiskLevel enum
   */
  private mapRiskLevel(risk: string): RiskLevel {
    switch (risk.toLowerCase()) {
      case 'critical': return RiskLevel.CRITICAL
      case 'high': return RiskLevel.HIGH
      case 'medium': return RiskLevel.MEDIUM
      case 'low': return RiskLevel.LOW
      default: return RiskLevel.MEDIUM
    }
  }

  /**
   * Map string to CommentType enum
   */
  private mapCommentType(type: string): CommentType {
    switch (type.toLowerCase()) {
      case 'issue': return CommentType.ISSUE
      case 'suggestion': return CommentType.SUGGESTION
      case 'question': return CommentType.QUESTION
      case 'praise': return CommentType.PRAISE
      default: return CommentType.ISSUE
    }
  }

  /**
   * Map string to HunkCategory enum
   */
  private mapHunkCategory(category: string): HunkCategory {
    switch (category.toLowerCase()) {
      case 'security-fix': return HunkCategory.SECURITY_FIX
      case 'performance-improvement': return HunkCategory.PERFORMANCE_IMPROVEMENT
      case 'bug-fix': return HunkCategory.BUG_FIX
      case 'feature-addition': return HunkCategory.FEATURE_ADDITION
      case 'refactoring': return HunkCategory.REFACTORING
      case 'documentation': return HunkCategory.DOCUMENTATION
      default: return HunkCategory.BUG_FIX
    }
  }

  /**
   * Validate individual shard result
   */
  validateShardResult(result: ShardResult): boolean {
    if (!result.success) return true // Failed results are valid
    return typeof result.result === 'string' && result.result.length > 0
  }

  /**
   * Get aggregation statistics
   */
  getStatistics(results: ShardResult[]): AggregationStatistics {
    const successful = results.filter(r => r.success)
    const failed = results.filter(r => !r.success)
    const processingTimes = successful.map(r => r.processingTime)
    const avgTime = processingTimes.length > 0
      ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
      : 0

    return {
      totalResults: results.length,
      successfulResults: successful.length,
      failedResults: failed.length,
      averageProcessingTime: Math.round(avgTime),
      aggregationTime: 0 // Will be set by the caller
    }
  }
}