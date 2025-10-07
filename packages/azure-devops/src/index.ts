/**
 * Azure DevOps Integration Package
 *
 * This package provides a comprehensive client library for interacting with
 * Azure DevOps REST APIs, specifically for work items and pull requests.
 */

// Export all interfaces
export * from './interfaces/index.js';

// Export all clients
export * from './clients/index.js';

// Export all services
export * from './services/index.js';

// Export context generator
export { WorkItemContextGenerator } from './work-item-context-generator.js';
export type { WorkItemContext, PullRequestContext, ContextGeneratorOptions } from './work-item-context-generator.js';

// Export utility functions
export {
  generateStableAdoId,
  extractSeverityFromContent,
  cleanCommentContent,
  processADOComment
} from './utils/comment-utils.js';
export type {
  CommentSeverity,
  ADOComment,
  ProcessedComment
} from './utils/comment-utils.js';

export {
  generateUnifiedDiff,
  generateDiffHunks,
  escapeRegExp,
  calculateDiffStats,
  normalizeFilePath,
  isBinaryContent,
  splitLinesWithEndings,
  generateDiffSummary
} from './utils/diff-utils.js';
export type {
  DiffHunk,
  DiffOptions
} from './utils/diff-utils.js';

// Default export
export { AzureDevOpsClient as default } from './clients/azure-devops-client.js';