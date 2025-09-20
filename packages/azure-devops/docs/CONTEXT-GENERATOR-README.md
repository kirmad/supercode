# Work Item Context Generator API

## Overview

The `WorkItemContextGenerator` is a powerful API that takes an Azure DevOps work item ID and generates a comprehensive context prompt by gathering all related information including:

- Work item details and metadata
- Comments and discussion history
- Parent, child, and related work items
- Linked pull requests with changes and comments
- Related pull requests from connected work items

This is perfect for generating AI prompts, creating implementation context, or building comprehensive documentation.

## Features

- **Comprehensive Context Gathering**: Collects all relevant information about a work item
- **Pull Request Integration**: Fetches linked PRs with file changes and comments
- **Relationship Mapping**: Discovers parent/child/related work items
- **Prompt Generation**: Formats context into a clean, readable prompt
- **Configurable Depth**: Control how much information to gather
- **HTML Cleaning**: Converts HTML descriptions to clean text

## Installation

```typescript
import { WorkItemContextGenerator } from '@your-org/azure-devops';
```

## Usage

### Basic Usage

```typescript
const generator = new WorkItemContextGenerator({
  organization: 'your-org',
  project: 'your-project',
  pat: 'your-personal-access-token'
});

// Generate a comprehensive prompt for a work item
const prompt = await generator.generatePrompt(12345);
console.log(prompt);
```

### Advanced Usage with Options

```typescript
// Get detailed context with all options
const context = await generator.generateContext(12345, {
  includePRChanges: true,      // Include changed files in PRs
  includePRComments: true,      // Include PR comment threads
  includeRelatedPRs: true,      // Include PRs from related work items
  maxRelatedItems: 10,          // Maximum related items to fetch
  maxPRsPerWorkItem: 5          // Maximum PRs per work item
});

// Access structured context data
console.log(`Work Item: ${context.workItem.fields['System.Title']}`);
console.log(`Comments: ${context.comments.length}`);
console.log(`Linked PRs: ${context.linkedPullRequests.length}`);

// Generate formatted prompt from context
const prompt = generator.formatContextAsPrompt(context);
```

## API Reference

### `WorkItemContextGenerator`

#### Constructor

```typescript
constructor(config: AzureDevOpsConfig)
```

- `config.organization`: Azure DevOps organization
- `config.project`: Azure DevOps project
- `config.pat`: Personal Access Token

#### Methods

##### `generateContext(workItemId, options?)`

Generates comprehensive context for a work item.

**Parameters:**
- `workItemId`: The work item ID to generate context for
- `options`: Optional configuration object
  - `includePRChanges`: Include changed files in PRs (default: true)
  - `includePRComments`: Include PR comment threads (default: true)
  - `includeRelatedPRs`: Include PRs from related work items (default: true)
  - `maxRelatedItems`: Maximum related items to fetch (default: 10)
  - `maxPRsPerWorkItem`: Maximum PRs per work item (default: 5)

**Returns:** `WorkItemContext` object containing all gathered information

##### `generatePrompt(workItemId, options?)`

Generates a formatted prompt string from work item context.

**Parameters:** Same as `generateContext()`

**Returns:** Formatted string prompt ready for use

## Context Structure

### WorkItemContext

```typescript
interface WorkItemContext {
  workItem: WorkItem;                        // Main work item details
  comments: WorkItemComment[];               // Discussion comments
  parentWorkItem?: WorkItem;                 // Parent work item if exists
  childWorkItems: WorkItem[];                // Child work items
  relatedWorkItems: WorkItem[];              // Related work items
  linkedPullRequests: PullRequestContext[];  // Directly linked PRs
  relatedPullRequests: PullRequestContext[]; // PRs from related items
}
```

### PullRequestContext

```typescript
interface PullRequestContext {
  pullRequest: PullRequest;              // PR details
  repository: { id: string; name: string }; // Repository info
  changedFiles?: string[];               // List of changed file paths
  comments?: GitPullRequestCommentThread[]; // Comment threads
  linkedWorkItems?: number[];            // Linked work item IDs
}
```

## Generated Prompt Format

The generated prompt includes:

1. **Work Item Information**
   - ID, Title, Type, State
   - Assigned To, Created Date, Tags
   - Priority and Severity (if set)

2. **Description and Acceptance Criteria**
   - Cleaned HTML content
   - Formatted for readability

3. **Discussion History**
   - All comments with authors and dates
   - Chronological order

4. **Related Work Items**
   - Parent work item details
   - Child work items list
   - Related work items

5. **Pull Request Information**
   - Directly linked PRs with details
   - Changed files list
   - Comment counts
   - Related PRs from other work items

6. **Implementation Context**
   - Guidance for implementation
   - Context about relationships
   - Next steps

## Example Output

```markdown
# Work Item Context

## Work Item #12345: Implement User Authentication

### Basic Information
- **Type**: User Story
- **State**: Active
- **Assigned To**: John Doe
- **Created**: 1/15/2024
- **Tags**: security, authentication
- **Priority**: 1

### Description
As a user, I want to be able to log in securely...

### Discussion History
**Jane Smith** (1/16/2024):
We should use OAuth2 for this implementation...

### Linked Pull Requests
#### PR #5678: Add authentication middleware
- **Repository**: backend-api
- **Status**: active
- **Changed Files** (15 files):
  - src/auth/middleware.ts
  - src/auth/oauth.ts
  ...

## Implementation Context
Based on the work item details and related information above...
```

## Use Cases

1. **AI-Assisted Development**: Generate prompts for AI coding assistants
2. **Documentation Generation**: Create comprehensive work item documentation
3. **Implementation Planning**: Gather all context before starting work
4. **Code Review Context**: Understand the full scope of changes
5. **Knowledge Transfer**: Share complete context with team members

## Error Handling

The generator handles errors gracefully:
- Missing permissions are logged as warnings
- Partial data is returned even if some requests fail
- HTML cleaning handles malformed content
- Network errors are caught and logged

## Performance Considerations

- Use `includeRelatedPRs: false` for faster generation
- Limit `maxRelatedItems` and `maxPRsPerWorkItem` for large work items
- Consider caching results for frequently accessed work items
- PRs are fetched in parallel when possible

## Security

- PAT token is never exposed in generated prompts
- Sensitive information should be reviewed before sharing prompts
- Only data accessible with the provided PAT is included

## Complete Example

```typescript
import { WorkItemContextGenerator } from '@your-org/azure-devops';
import fs from 'fs/promises';

async function generateImplementationContext(workItemId: number) {
  const generator = new WorkItemContextGenerator({
    organization: 'myorg',
    project: 'myproject',
    pat: process.env.AZURE_DEVOPS_PAT
  });

  try {
    // Generate comprehensive prompt
    const prompt = await generator.generatePrompt(workItemId, {
      includePRChanges: true,
      includePRComments: false, // Exclude to reduce size
      includeRelatedPRs: true,
      maxRelatedItems: 5
    });

    // Save to file
    await fs.writeFile(`workitem-${workItemId}-context.md`, prompt);

    // Use with AI assistant
    console.log('Context generated! Use this prompt with your AI assistant:');
    console.log(prompt.substring(0, 500) + '...');

    return prompt;
  } catch (error) {
    console.error('Failed to generate context:', error);
    throw error;
  }
}
```

## License

MIT