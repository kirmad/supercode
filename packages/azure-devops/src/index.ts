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

// Export context generator
export { WorkItemContextGenerator } from './work-item-context-generator.js';
export type { WorkItemContext, PullRequestContext, ContextGeneratorOptions } from './work-item-context-generator.js';

// Default export
export { AzureDevOpsClient as default } from './clients/azure-devops-client.js';