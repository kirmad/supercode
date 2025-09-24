# Azure DevOps Integration Package

A comprehensive TypeScript library for integrating with Azure DevOps to generate AI-ready context from work items and pull requests. This package provides both low-level API clients and high-level context generation utilities.

## Features

This package provides complete functionality for:

### Work Items
1. ✅ Get work items assigned to a specific user
2. ✅ Get work items with specific tags
3. ✅ Get work item details including summary and discussion
4. ✅ Get work item type information
5. ✅ Get parent and related work items
6. ✅ Update work items
7. ✅ Add comments to work items

### Pull Requests
1. ✅ Get pull request details
2. ✅ Get pull requests linked to work items
3. ✅ Get changed files and changes in pull requests
4. ✅ Get pull request summary
5. ✅ Get comments on pull requests
6. ✅ Add and update PR comments
7. ✅ Update thread status

## Installation

```bash
# Using bun
bun add @supercode/azure-devops

# Using npm
npm install @supercode/azure-devops

# Using yarn
yarn add @supercode/azure-devops
```

## Quick Start

```typescript
import { AzureDevOpsClient } from '@supercode/azure-devops';

// Initialize the client
const client = new AzureDevOpsClient({
  organization: 'your-organization',
  project: 'your-project',
  pat: 'your-personal-access-token'
});

// Get work items assigned to current user
const myWorkItems = await client.workItems.getWorkItemsAssignedToUser();

// Get pull requests
const repos = await client.pullRequests.getRepositories();
const pullRequests = await client.pullRequests.searchPullRequests(repos[0].id, {
  status: 'active'
});
```

## Authentication

This package uses Personal Access Tokens (PAT) for authentication. To create a PAT:

1. Go to Azure DevOps → User Settings → Personal Access Tokens
2. Click "New Token"
3. Select the appropriate scopes:
   - Work Items (Read & Write)
   - Code (Read & Write)
   - Pull Request Contribute
4. Copy the generated token

## Usage Examples

### Work Items

```typescript
// Get work items assigned to me
const myWorkItems = await client.workItems.getWorkItemsAssignedToUser();

// Get work items with specific tag
const bugItems = await client.workItems.getWorkItemsWithTag('bug', true);

// Get work item details with comments
const details = await client.workItems.getWorkItemDetails(workItemId);
console.log(details.workItem); // Work item data
console.log(details.comments); // Discussion comments

// Get related work items
const relations = await client.workItems.getRelatedWorkItems(workItemId);
console.log(relations.parent);    // Parent work item
console.log(relations.children);  // Child work items
console.log(relations.related);   // Related work items
console.log(relations.linkedPRs); // Linked pull requests

// Update work item
await client.workItems.updateWorkItemFields(workItemId, {
  title: 'Updated Title',
  state: 'Active',
  tags: 'tag1, tag2',
  priority: 1
});

// Add comment to work item
await client.workItems.addWorkItemComment(workItemId, 'This is a comment');
```

### Pull Requests

```typescript
// Get repositories
const repos = await client.pullRequests.getRepositories();

// Search for pull requests
const pullRequests = await client.pullRequests.searchPullRequests(repoId, {
  status: 'active',
  creatorId: 'user-id',
  top: 10
});

// Get pull request details
const pr = await client.pullRequests.getPullRequest(repoId, pullRequestId);

// Get PR changes
const changes = await client.pullRequests.getPullRequestChanges(repoId, pullRequestId);
console.log(changes.changes);    // Changed files
console.log(changes.iterations); // PR iterations

// Get PR comments
const threads = await client.pullRequests.getPullRequestComments(repoId, pullRequestId);

// Add comment to PR
await client.pullRequests.addPullRequestComment(
  repoId,
  pullRequestId,
  'Great work!',
  'active'
);

// Add reply to existing thread
await client.pullRequests.addReplyToThread(
  repoId,
  pullRequestId,
  threadId,
  'Thanks for the feedback!'
);

// Update thread status
await client.pullRequests.updateThreadStatus(
  repoId,
  pullRequestId,
  threadId,
  'fixed'
);
```

### Combined Operations

```typescript
// Get complete work item information
const workItemInfo = await client.getCompleteWorkItemInfo(workItemId);
// Returns: work item, comments, parent, children, related items, linked PRs

// Get complete pull request information
const prInfo = await client.getCompletePullRequestInfo(repoId, pullRequestId);
// Returns: PR details, changes, comments, linked work items

// Get dashboard of my work items organized by status
const dashboard = await client.getMyWorkItemsDashboard();
console.log(dashboard.active);     // Active items
console.log(dashboard.inProgress); // In progress items
console.log(dashboard.new);        // New items
console.log(dashboard.resolved);   // Resolved items
```

## API Reference

### Main Client

#### `AzureDevOpsClient`
The main client that provides access to both work items and pull requests functionality.

- `workItems: WorkItemClient` - Access to work item operations
- `pullRequests: PullRequestClient` - Access to pull request operations
- `getCompleteWorkItemInfo(workItemId)` - Get all information about a work item
- `getCompletePullRequestInfo(repoId, prId)` - Get all information about a PR
- `getMyWorkItemsDashboard(email?)` - Get work items organized by status

### Work Item Client

#### `WorkItemClient`
Handles all work item related operations.

**Methods:**
- `getWorkItemsAssignedToUser(email?)` - Get work items assigned to user
- `getWorkItemsWithTag(tag, assignedToMe)` - Get work items with specific tag
- `getWorkItemDetails(id)` - Get work item with comments
- `getWorkItemType(typeName)` - Get work item type information
- `getRelatedWorkItems(id)` - Get parent, children, and related items
- `updateWorkItem(id, updates)` - Update work item with PATCH operations
- `updateWorkItemFields(id, fields)` - Update work item fields
- `addWorkItemComment(id, comment)` - Add comment to work item
- `addWorkItemRelation(id, relationType, targetUrl, comment?)` - Add relation

### Pull Request Client

#### `PullRequestClient`
Handles all pull request related operations.

**Methods:**
- `getRepositories()` - Get all repositories
- `getRepository(nameOrId)` - Get specific repository
- `getPullRequest(repoId, prId)` - Get pull request details
- `searchPullRequests(repoId, criteria)` - Search for pull requests
- `getPullRequestsLinkedToWorkItem(workItemId)` - Get PRs linked to work item
- `getWorkItemsLinkedToPullRequest(repoId, prId)` - Get work items linked to PR
- `getPullRequestChanges(repoId, prId, iterationId?)` - Get PR changes
- `getFileDiff(repoId, prId, iterationId, path)` - Get file diff
- `getPullRequestSummary(repoId, prId)` - Get PR summary
- `getPullRequestComments(repoId, prId)` - Get PR comment threads
- `addPullRequestComment(repoId, prId, content, status?, context?)` - Add comment
- `addReplyToThread(repoId, prId, threadId, content, parentId?)` - Add reply
- `updatePullRequestComment(repoId, prId, threadId, commentId, content)` - Update comment
- `updateThreadStatus(repoId, prId, threadId, status)` - Update thread status
- `deletePullRequestComment(repoId, prId, threadId, commentId)` - Delete comment

## TypeScript Support

This package is written in TypeScript and provides complete type definitions for all operations. All Azure DevOps data structures are fully typed.

## Testing

Run tests with:

```bash
bun test
```

See `test/azure-devops.test.ts` for comprehensive test examples.

## Examples

See `example.ts` for a complete working example demonstrating all functionality.

## Error Handling

The package includes custom error handling with the `AzureDevOpsError` class that provides:
- HTTP status code
- Error message
- Full error response from Azure DevOps API

```typescript
try {
  await client.workItems.getWorkItemDetails(999999);
} catch (error) {
  if (error instanceof AzureDevOpsError) {
    console.log('Status:', error.statusCode);
    console.log('Message:', error.message);
    console.log('Response:', error.response);
  }
}
```

## Requirements

- Bun 1.0+ or Node.js 18+
- Azure DevOps account with appropriate permissions
- Personal Access Token with required scopes

## License

MIT