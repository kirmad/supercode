/**
 * Azure DevOps Services
 *
 * High-level service layer for Azure DevOps operations
 */

export { CommentService } from './comment-service.js';
export type {
  PublishCommentOptions,
  PollCommentsOptions,
  PollCommentsResult,
  CreateThreadContextOptions
} from './comment-service.js';