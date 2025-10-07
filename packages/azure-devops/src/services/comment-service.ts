/**
 * Azure DevOps Comment Service
 *
 * High-level service for managing ADO pull request comments.
 * Provides operations for publishing, replying, polling, and processing comments
 * with stable ID generation and standardized formats.
 */

import { PullRequestClient } from '../clients/pull-request-client.js';
import {
  generateStableAdoId,
  extractSeverityFromContent,
  cleanCommentContent,
  processADOComment,
  type CommentSeverity,
  type ADOComment,
  type ProcessedComment
} from '../utils/comment-utils.js';
import type {
  AzureDevOpsConfig,
  GitPullRequestCommentThread,
  Comment,
  CommentThreadContext,
  CommentPosition
} from '../interfaces/index.js';

/**
 * Options for publishing a comment with stable ID tracking
 */
export interface PublishCommentOptions {
  /** The comment content to publish */
  content: string;
  /** Comment status (default: 'active') */
  status?: 'active' | 'pending' | 'closed';
  /** Thread context for code comments */
  threadContext?: CommentThreadContext;
  /** Stable ID for tracking/updating the comment */
  stableId?: string;
  /** Whether this is an AI-generated comment */
  isAIGenerated?: boolean;
}

/**
 * Options for polling comments
 */
export interface PollCommentsOptions {
  /** Only return comments after this date */
  since?: Date;
  /** Include AI-generated comments (default: true) */
  includeAIGenerated?: boolean;
  /** Include system comments (default: false) */
  includeSystemComments?: boolean;
  /** Maximum number of comments to return */
  maxComments?: number;
}

/**
 * Result from polling comments
 */
export interface PollCommentsResult {
  /** Newly found comments */
  newComments: ProcessedComment[];
  /** Total number of comments processed */
  totalProcessed: number;
  /** Latest comment timestamp */
  latestTimestamp?: Date;
}

/**
 * Options for creating thread context for code comments
 */
export interface CreateThreadContextOptions {
  /** File path relative to repository root */
  filePath: string;
  /** Starting line number for the comment */
  startLine: number;
  /** Ending line number for the comment (default: same as startLine) */
  endLine?: number;
  /** Column position within the line */
  column?: number;
}

/**
 * Azure DevOps Comment Service
 *
 * Provides high-level operations for managing pull request comments
 * including publishing, replying, polling, and processing with stable IDs.
 */
export class CommentService {
  private prClient: PullRequestClient;

  /**
   * Create a new CommentService instance
   *
   * @param config - Azure DevOps configuration
   */
  constructor(config: AzureDevOpsConfig) {
    this.prClient = new PullRequestClient(config);
  }

  /**
   * Publish a comment to a pull request with stable ID tracking
   *
   * This method allows publishing comments that can be tracked and updated
   * using stable IDs. If a stable ID is provided, the service can track
   * the comment across sessions.
   *
   * @param repositoryId - Repository ID
   * @param pullRequestId - Pull request ID
   * @param options - Comment publishing options
   * @returns The created comment thread with stable ID
   *
   * @example
   * ```typescript
   * const service = new CommentService(config);
   *
   * // Publish a general comment
   * const thread = await service.publishComment(repoId, prId, {
   *   content: 'This looks good to me!',
   *   status: 'active'
   * });
   *
   * // Publish a code comment
   * const codeThread = await service.publishComment(repoId, prId, {
   *   content: 'Consider using const instead of let here',
   *   threadContext: service.createThreadContext({
   *     filePath: '/src/utils/helper.ts',
   *     startLine: 42,
   *     column: 5
   *   })
   * });
   *
   * // Publish an AI-generated comment with stable ID
   * const aiThread = await service.publishComment(repoId, prId, {
   *   content: 'AI Review: This function could be optimized...',
   *   stableId: 'ai-review-security-001',
   *   isAIGenerated: true
   * });
   * ```
   */
  async publishComment(
    repositoryId: string,
    pullRequestId: number,
    options: PublishCommentOptions
  ): Promise<GitPullRequestCommentThread & { stableId?: string }> {
    const thread = await this.prClient.addPullRequestComment(
      repositoryId,
      pullRequestId,
      options.content,
      options.status || 'active',
      options.threadContext
    );

    // Add stable ID tracking if provided
    const result = thread as GitPullRequestCommentThread & { stableId?: string };
    if (options.stableId) {
      result.stableId = options.stableId;
    } else if (thread.comments?.length > 0) {
      // Generate stable ID from the first comment
      result.stableId = generateStableAdoId(thread.comments[0], thread.id);
    }

    return result;
  }

  /**
   * Reply to an existing comment thread
   *
   * @param repositoryId - Repository ID
   * @param pullRequestId - Pull request ID
   * @param threadId - Thread ID to reply to
   * @param content - Reply content
   * @param parentCommentId - Optional parent comment ID for nested replies
   * @returns The created reply comment
   *
   * @example
   * ```typescript
   * const service = new CommentService(config);
   *
   * // Reply to a thread
   * const reply = await service.replyToThread(
   *   repoId,
   *   prId,
   *   threadId,
   *   'Thanks for the feedback!'
   * );
   *
   * // Reply to a specific comment in the thread
   * const nestedReply = await service.replyToThread(
   *   repoId,
   *   prId,
   *   threadId,
   *   'I agree with this suggestion',
   *   parentCommentId
   * );
   * ```
   */
  async replyToThread(
    repositoryId: string,
    pullRequestId: number,
    threadId: number,
    content: string,
    parentCommentId?: number
  ): Promise<Comment> {
    return await this.prClient.addReplyToThread(
      repositoryId,
      pullRequestId,
      threadId,
      content,
      parentCommentId
    );
  }

  /**
   * Poll for new comments on a pull request
   *
   * This method retrieves and processes comments, filtering based on the
   * provided options. Useful for monitoring PR activity.
   *
   * @param repositoryId - Repository ID
   * @param pullRequestId - Pull request ID
   * @param options - Polling options
   * @returns Poll results with new comments
   *
   * @example
   * ```typescript
   * const service = new CommentService(config);
   *
   * // Poll for all new comments since last check
   * const result = await service.pollForNewComments(repoId, prId, {
   *   since: lastCheckTime,
   *   maxComments: 50
   * });
   *
   * console.log(`Found ${result.newComments.length} new comments`);
   * result.newComments.forEach(comment => {
   *   console.log(`${comment.author}: ${comment.cleanContent}`);
   * });
   * ```
   */
  async pollForNewComments(
    repositoryId: string,
    pullRequestId: number,
    options: PollCommentsOptions = {}
  ): Promise<PollCommentsResult> {
    const threads = await this.prClient.getPullRequestComments(repositoryId, pullRequestId);
    const newComments: ProcessedComment[] = [];
    let latestTimestamp: Date | undefined;
    let totalProcessed = 0;

    for (const thread of threads) {
      if (!thread.comments) continue;

      for (const comment of thread.comments) {
        totalProcessed++;

        // Apply time filter
        if (options.since) {
          const commentDate = new Date(comment.publishedDate);
          if (commentDate <= options.since) {
            continue;
          }
        }

        // Apply AI-generated filter
        if (options.includeAIGenerated === false && this.isAIGeneratedComment(comment)) {
          continue;
        }

        // Apply system comment filter
        if (options.includeSystemComments === false && comment.commentType === 'system') {
          continue;
        }

        // Process and add comment
        const processedComment = this.processComments([comment], thread.id)[0];
        if (processedComment) {
          newComments.push(processedComment);

          // Track latest timestamp
          const commentDate = new Date(comment.publishedDate);
          if (!latestTimestamp || commentDate > latestTimestamp) {
            latestTimestamp = commentDate;
          }
        }

        // Apply max comments limit
        if (options.maxComments && newComments.length >= options.maxComments) {
          break;
        }
      }

      if (options.maxComments && newComments.length >= options.maxComments) {
        break;
      }
    }

    return {
      newComments,
      totalProcessed,
      latestTimestamp
    };
  }

  /**
   * Process raw ADO comments into standardized format
   *
   * Converts ADO comment objects into a consistent, clean format with
   * stable IDs, extracted severity, and cleaned content.
   *
   * @param comments - Raw ADO comments to process
   * @param threadId - Thread ID these comments belong to
   * @returns Array of processed comments
   *
   * @example
   * ```typescript
   * const service = new CommentService(config);
   *
   * // Get raw comments from ADO
   * const threads = await prClient.getPullRequestComments(repoId, prId);
   * const rawComments = threads.flatMap(t => t.comments || []);
   *
   * // Process into standardized format
   * const processed = service.processComments(rawComments, threads[0].id);
   *
   * processed.forEach(comment => {
   *   console.log(`ID: ${comment.id}`);
   *   console.log(`Severity: ${comment.severity}`);
   *   console.log(`Content: ${comment.cleanContent}`);
   *   console.log(`Author: ${comment.author}`);
   * });
   * ```
   */
  processComments(comments: Comment[], threadId: number): ProcessedComment[] {
    return comments.map(comment => processADOComment(comment as ADOComment, threadId));
  }

  /**
   * Create thread context for code comments
   *
   * Helper method to create proper thread context objects for commenting
   * on specific lines of code in files.
   *
   * @param options - Thread context options
   * @returns Thread context object
   *
   * @example
   * ```typescript
   * const service = new CommentService(config);
   *
   * // Create context for a single line comment
   * const context = service.createThreadContext({
   *   filePath: '/src/components/Button.tsx',
   *   startLine: 25
   * });
   *
   * // Create context for a multi-line comment
   * const multiLineContext = service.createThreadContext({
   *   filePath: '/src/utils/validation.ts',
   *   startLine: 10,
   *   endLine: 15,
   *   column: 1
   * });
   * ```
   */
  createThreadContext(options: CreateThreadContextOptions): CommentThreadContext {
    // Azure DevOps requires offset (column) to be at least 1
    const position: CommentPosition = {
      line: options.startLine,
      offset: options.column || 1  // Default to 1 if not specified
    };

    const endPosition: CommentPosition = {
      line: options.endLine || options.startLine,
      offset: options.column || 1  // Default to 1 if not specified
    };

    return {
      filePath: options.filePath,
      rightFileStart: position,
      rightFileEnd: endPosition
    };
  }

  /**
   * Get all comments for a pull request in processed format
   *
   * Convenience method to retrieve and process all comments for a PR.
   *
   * @param repositoryId - Repository ID
   * @param pullRequestId - Pull request ID
   * @returns All processed comments grouped by thread
   *
   * @example
   * ```typescript
   * const service = new CommentService(config);
   *
   * const allComments = await service.getAllComments(repoId, prId);
   *
   * allComments.forEach(threadComments => {
   *   console.log(`Thread ${threadComments.threadId}:`);
   *   threadComments.comments.forEach(comment => {
   *     console.log(`  ${comment.author}: ${comment.cleanContent}`);
   *   });
   * });
   * ```
   */
  async getAllComments(
    repositoryId: string,
    pullRequestId: number
  ): Promise<Array<{ threadId: number; comments: ProcessedComment[] }>> {
    const threads = await this.prClient.getPullRequestComments(repositoryId, pullRequestId);

    return threads.map(thread => ({
      threadId: thread.id,
      comments: this.processComments(thread.comments || [], thread.id)
    }));
  }

  /**
   * Update thread status (e.g., mark as resolved)
   *
   * @param repositoryId - Repository ID
   * @param pullRequestId - Pull request ID
   * @param threadId - Thread ID to update
   * @param status - New thread status
   * @returns Updated thread
   *
   * @example
   * ```typescript
   * const service = new CommentService(config);
   *
   * // Mark thread as resolved
   * await service.updateThreadStatus(repoId, prId, threadId, 'fixed');
   *
   * // Reopen a thread
   * await service.updateThreadStatus(repoId, prId, threadId, 'active');
   * ```
   */
  async updateThreadStatus(
    repositoryId: string,
    pullRequestId: number,
    threadId: number,
    status: 'active' | 'fixed' | 'wontFix' | 'closed' | 'byDesign' | 'pending'
  ): Promise<GitPullRequestCommentThread> {
    return await this.prClient.updateThreadStatus(repositoryId, pullRequestId, threadId, status);
  }

  /**
   * Find comments by stable ID
   *
   * Search for comments that match a stable ID pattern. Useful for
   * tracking AI-generated comments across sessions.
   *
   * @param repositoryId - Repository ID
   * @param pullRequestId - Pull request ID
   * @param stableIdPattern - Stable ID or pattern to search for
   * @returns Matching processed comments
   *
   * @example
   * ```typescript
   * const service = new CommentService(config);
   *
   * // Find specific AI comment
   * const aiComments = await service.findCommentsByStableId(
   *   repoId,
   *   prId,
   *   'ai-review-security-001'
   * );
   *
   * // Find all AI security comments
   * const securityComments = await service.findCommentsByStableId(
   *   repoId,
   *   prId,
   *   'ai-review-security-'
   * );
   * ```
   */
  async findCommentsByStableId(
    repositoryId: string,
    pullRequestId: number,
    stableIdPattern: string
  ): Promise<ProcessedComment[]> {
    const allComments = await this.getAllComments(repositoryId, pullRequestId);
    const matchingComments: ProcessedComment[] = [];

    for (const threadComments of allComments) {
      for (const comment of threadComments.comments) {
        if (comment.id.includes(stableIdPattern)) {
          matchingComments.push(comment);
        }
      }
    }

    return matchingComments;
  }

  /**
   * Check if a comment is AI-generated
   *
   * @private
   * @param comment - Comment to check
   * @returns True if the comment appears to be AI-generated
   */
  private isAIGeneratedComment(comment: Comment): boolean {
    const content = comment.content?.toLowerCase() || '';
    return content.includes('ai-generated') ||
           content.includes('artificial intelligence') ||
           content.includes('automated review') ||
           comment.author?.displayName?.toLowerCase().includes('bot');
  }
}

/**
 * Export utility functions for convenience
 */
export {
  generateStableAdoId,
  extractSeverityFromContent,
  cleanCommentContent,
  processADOComment,
  type CommentSeverity,
  type ADOComment,
  type ProcessedComment
};