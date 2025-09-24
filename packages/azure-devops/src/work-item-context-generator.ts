/**
 * Work Item Context Generator
 *
 * Generates comprehensive context prompts for work items by gathering
 * all related information including related work items, pull requests,
 * comments, and discussions.
 */

import type {
  AzureDevOpsConfig,
  WorkItem,
  WorkItemComment,
  PullRequest,
  GitPullRequestCommentThread,
  GitCommitRef
} from './interfaces/index.js';
import { WorkItemClient } from './clients/work-item-client.js';
import { PullRequestClient } from './clients/pull-request-client.js';

export interface WorkItemContext {
  workItem: WorkItem;
  comments: WorkItemComment[];
  parentWorkItem?: WorkItem;
  childWorkItems: WorkItem[];
  relatedWorkItems: WorkItem[];
  linkedPullRequests: PullRequestContext[];
  relatedPullRequests: PullRequestContext[];
}

export interface PullRequestContext {
  pullRequest: PullRequest;
  repository: { id: string; name: string };
  sourceBranch?: string;
  targetBranch?: string;
  commits?: GitCommitRef[];
  changedFiles?: FileChangeInfo[];
  diffs?: { [path: string]: string };
  comments?: GitPullRequestCommentThread[];
  linkedWorkItems?: number[];
}

export interface FileChangeInfo {
  path: string;
  changeType: string;
  additions?: number;
  deletions?: number;
}

export interface ContextGeneratorOptions {
  includePRChanges?: boolean;
  includePRComments?: boolean;
  includePRCommits?: boolean;
  includePRDiffs?: boolean;
  includeRelatedPRs?: boolean;
  maxRelatedItems?: number;
  maxPRsPerWorkItem?: number;
}

export class WorkItemContextGenerator {
  private workItemClient: WorkItemClient;
  private pullRequestClient: PullRequestClient;

  constructor(config: AzureDevOpsConfig) {
    this.workItemClient = new WorkItemClient(config);
    this.pullRequestClient = new PullRequestClient(config);
  }

  /**
   * Generate comprehensive context for a work item
   */
  async generateContext(
    workItemId: number,
    options: ContextGeneratorOptions = {}
  ): Promise<WorkItemContext> {
    const {
      includePRChanges = true,
      includePRComments = true,
      includePRCommits = true,
      includePRDiffs = true,
      includeRelatedPRs = true,
      maxRelatedItems = 10,
      maxPRsPerWorkItem = 5
    } = options;

    // Get the main work item with all details
    const workItemDetails = await this.workItemClient.getWorkItemDetails(workItemId);
    const { workItem, comments } = workItemDetails;

    // Get related work items
    const relatedItems = await this.workItemClient.getRelatedWorkItems(workItemId);

    // Get linked pull requests
    const linkedPRs = await this.getLinkedPullRequests(workItem, {
      includePRChanges,
      includePRComments,
      includePRCommits,
      includePRDiffs,
      maxPRs: maxPRsPerWorkItem
    });

    // Get related pull requests (from related work items)
    let relatedPRs: PullRequestContext[] = [];
    if (includeRelatedPRs) {
      relatedPRs = await this.getRelatedPullRequests(
        [...relatedItems.children, ...relatedItems.related].slice(0, maxRelatedItems),
        {
          includePRChanges,
          includePRComments,
          includePRCommits,
          includePRDiffs,
          maxPRs: 2 // Limit PRs per related work item
        }
      );
    }

    return {
      workItem,
      comments,
      parentWorkItem: relatedItems.parent,
      childWorkItems: relatedItems.children,
      relatedWorkItems: relatedItems.related,
      linkedPullRequests: linkedPRs,
      relatedPullRequests: relatedPRs
    };
  }

  /**
   * Get pull requests directly linked to a work item
   */
  private async getLinkedPullRequests(
    workItem: WorkItem,
    options: {
      includePRChanges?: boolean;
      includePRComments?: boolean;
      includePRCommits?: boolean;
      includePRDiffs?: boolean;
      maxPRs?: number;
    }
  ): Promise<PullRequestContext[]> {
    const pullRequests: PullRequestContext[] = [];

    // Find PR links in work item relations
    const prLinks = (workItem.relations || [])
      .filter(r => r.rel === 'ArtifactLink' && r.url?.includes('PullRequestId'))
      .slice(0, options.maxPRs || 5);

    for (const prLink of prLinks) {
      try {
        const prInfo = this.parsePullRequestLink(prLink.url);
        if (!prInfo) continue;

        const pr = await this.pullRequestClient.getPullRequest(
          prInfo.repositoryId,
          prInfo.pullRequestId
        );

        const prContext: PullRequestContext = {
          pullRequest: pr,
          repository: { id: prInfo.repositoryId, name: pr.repository?.name || 'Unknown' },
          sourceBranch: pr.sourceRefName,
          targetBranch: pr.targetRefName
        };

        // Get commits if requested
        if (options.includePRCommits) {
          try {
            prContext.commits = await this.pullRequestClient.getPullRequestCommits(
              prInfo.repositoryId,
              prInfo.pullRequestId
            );
          } catch (error) {
            console.warn(`Failed to get commits for PR ${prInfo.pullRequestId}:`, error);
          }
        }

        // Get changed files if requested
        if (options.includePRChanges) {
          try {
            const changes = await this.pullRequestClient.getPullRequestChanges(
              prInfo.repositoryId,
              prInfo.pullRequestId
            );
            prContext.changedFiles = changes.changes.map(c => ({
              path: c.item.path,
              changeType: c.changeType,
              additions: c.changeTrackingId, // This is a placeholder - actual diff stats would need additional API calls
              deletions: 0
            }));

            // Get diffs for changed files if requested
            if (options.includePRDiffs && prContext.changedFiles?.length) {
              // For completed PRs, use merge commits if available (branches might be deleted)
              // Otherwise fall back to using commit IDs from the PR's commit list
              let baseCommit: string;
              let targetCommit: string;

              if (pr.status === 'completed' && pr.lastMergeTargetCommit && pr.lastMergeCommit) {
                // Use merge commits for completed PRs (more reliable when branches are deleted)
                baseCommit = pr.lastMergeTargetCommit.commitId;
                targetCommit = pr.lastMergeCommit.commitId;
              } else if (prContext.commits?.length) {
                // Fall back to using first and last commit from the PR
                baseCommit = prContext.commits[0].commitId;
                targetCommit = prContext.commits[prContext.commits.length - 1].commitId;
              } else if (pr.lastMergeSourceCommit && pr.lastMergeTargetCommit) {
                // Another fallback: use the last known source and target commits
                baseCommit = pr.lastMergeTargetCommit.commitId;
                targetCommit = pr.lastMergeSourceCommit.commitId;
              } else {
                // No commits available to diff
                console.warn(`No commit information available for PR ${prInfo.pullRequestId} to generate diffs`);
                continue;
              }

              prContext.diffs = {};
              for (const file of prContext.changedFiles.slice(0, 10)) { // Limit to first 10 files
                try {
                  const diff = await this.pullRequestClient.getFileDiffContent(
                    prInfo.repositoryId,
                    baseCommit,
                    targetCommit,
                    file.path
                  );
                  prContext.diffs[file.path] = diff;
                } catch (error) {
                  // Check if this is a branch not found error (happens when branches are deleted)
                  if (error instanceof Error && error.message.includes('TF401175')) {
                    console.warn(`Branch deleted for PR ${prInfo.pullRequestId}, cannot get diff for ${file.path}`);
                  } else {
                    console.warn(`Failed to get diff for file ${file.path}:`, error);
                  }
                }
              }
            }
          } catch (error) {
            console.warn(`Failed to get changes for PR ${prInfo.pullRequestId}:`, error);
          }
        }

        // Get comments if requested
        if (options.includePRComments) {
          try {
            prContext.comments = await this.pullRequestClient.getPullRequestComments(
              prInfo.repositoryId,
              prInfo.pullRequestId
            );
          } catch (error) {
            console.warn(`Failed to get comments for PR ${prInfo.pullRequestId}:`, error);
          }
        }

        // Get linked work items
        try {
          const linkedWorkItems = await this.pullRequestClient.getWorkItemsLinkedToPullRequest(
            prInfo.repositoryId,
            prInfo.pullRequestId
          );
          prContext.linkedWorkItems = linkedWorkItems.map(wi => parseInt(wi.id, 10));
        } catch (error) {
          console.warn(`Failed to get linked work items for PR ${prInfo.pullRequestId}:`, error);
        }

        pullRequests.push(prContext);
      } catch (error) {
        console.warn(`Failed to process PR link:`, error);
      }
    }

    return pullRequests;
  }

  /**
   * Get pull requests from related work items
   */
  private async getRelatedPullRequests(
    relatedWorkItems: WorkItem[],
    options: {
      includePRChanges?: boolean;
      includePRComments?: boolean;
      includePRCommits?: boolean;
      includePRDiffs?: boolean;
      maxPRs?: number;
    }
  ): Promise<PullRequestContext[]> {
    const allPRs: PullRequestContext[] = [];

    for (const relatedItem of relatedWorkItems) {
      const prs = await this.getLinkedPullRequests(relatedItem, {
        ...options,
        maxPRs: Math.min(options.maxPRs || 2, 2) // Limit to 2 PRs per related item
      });
      allPRs.push(...prs);
    }

    return allPRs;
  }

  /**
   * Parse pull request information from artifact link URL
   */
  private parsePullRequestLink(url: string): { repositoryId: string; pullRequestId: number } | null {
    try {
      // URL format: vstfs:///Git/PullRequestId/{projectId}%2F{repoId}%2F{prId}
      const matches = url.match(/PullRequestId\/[^%]+%2F([^%]+)%2F(\d+)/);
      if (matches) {
        return {
          repositoryId: matches[1],
          pullRequestId: parseInt(matches[2], 10)
        };
      }
    } catch (error) {
      console.warn('Failed to parse PR link:', url, error);
    }
    return null;
  }

  /**
   * Generate a comprehensive prompt from work item context
   */
  async generatePrompt(
    workItemId: number,
    options: ContextGeneratorOptions = {}
  ): Promise<string> {
    const context = await this.generateContext(workItemId, options);
    return this.formatContextAsPrompt(context);
  }

  /**
   * Format work item context as a comprehensive prompt
   */
  private formatContextAsPrompt(context: WorkItemContext): string {
    const prompt: string[] = [];

    // Work Item Information
    prompt.push('# Work Item Context');
    prompt.push('');
    prompt.push(`## Work Item #${context.workItem.id}: ${context.workItem.fields['System.Title']}`);
    prompt.push('');

    // Basic Information
    prompt.push('### Basic Information');
    prompt.push(`- **Type**: ${context.workItem.fields['System.WorkItemType']}`);
    prompt.push(`- **State**: ${context.workItem.fields['System.State']}`);
    prompt.push(`- **Assigned To**: ${context.workItem.fields['System.AssignedTo']?.displayName || 'Unassigned'}`);
    prompt.push(`- **Created**: ${new Date(context.workItem.fields['System.CreatedDate']).toLocaleDateString()}`);
    prompt.push(`- **Tags**: ${context.workItem.fields['System.Tags'] || 'None'}`);

    const priority = context.workItem.fields['Microsoft.VSTS.Common.Priority'];
    if (priority) {
      prompt.push(`- **Priority**: ${priority}`);
    }

    const severity = context.workItem.fields['Microsoft.VSTS.Common.Severity'];
    if (severity) {
      prompt.push(`- **Severity**: ${severity}`);
    }

    prompt.push('');

    // Description
    if (context.workItem.fields['System.Description']) {
      prompt.push('### Description');
      prompt.push(this.cleanHtml(context.workItem.fields['System.Description']));
      prompt.push('');
    }

    // Acceptance Criteria
    if (context.workItem.fields['Microsoft.VSTS.Common.AcceptanceCriteria']) {
      prompt.push('### Acceptance Criteria');
      prompt.push(this.cleanHtml(context.workItem.fields['Microsoft.VSTS.Common.AcceptanceCriteria']));
      prompt.push('');
    }

    // Comments and Discussion
    if (context.comments.length > 0) {
      prompt.push('### Discussion History');
      for (const comment of context.comments) {
        const date = new Date(comment.createdDate).toLocaleDateString();
        prompt.push(`**${comment.createdBy.displayName}** (${date}):`);
        prompt.push(this.cleanHtml(comment.text));
        prompt.push('');
      }
    }

    // Parent Work Item
    if (context.parentWorkItem) {
      prompt.push('### Parent Work Item');
      prompt.push(`- #${context.parentWorkItem.id}: ${context.parentWorkItem.fields['System.Title']}`);
      prompt.push(`  - Type: ${context.parentWorkItem.fields['System.WorkItemType']}`);
      prompt.push(`  - State: ${context.parentWorkItem.fields['System.State']}`);
      prompt.push('');
    }

    // Child Work Items
    if (context.childWorkItems.length > 0) {
      prompt.push('### Child Work Items');
      for (const child of context.childWorkItems) {
        prompt.push(`- #${child.id}: ${child.fields['System.Title']}`);
        prompt.push(`  - Type: ${child.fields['System.WorkItemType']}`);
        prompt.push(`  - State: ${child.fields['System.State']}`);
      }
      prompt.push('');
    }

    // Related Work Items
    if (context.relatedWorkItems.length > 0) {
      prompt.push('### Related Work Items');
      for (const related of context.relatedWorkItems) {
        prompt.push(`- #${related.id}: ${related.fields['System.Title']}`);
        prompt.push(`  - Type: ${related.fields['System.WorkItemType']}`);
        prompt.push(`  - State: ${related.fields['System.State']}`);
      }
      prompt.push('');
    }

    // Linked Pull Requests
    if (context.linkedPullRequests.length > 0) {
      prompt.push('### Directly Linked Pull Requests');
      prompt.push('');

      for (const prContext of context.linkedPullRequests) {
        const pr = prContext.pullRequest;
        prompt.push(`#### PR #${pr.pullRequestId}: ${pr.title}`);
        prompt.push('');

        // Basic PR Information
        prompt.push('**Pull Request Details:**');
        prompt.push(`- Repository: ${prContext.repository.name}`);
        prompt.push(`- Status: ${pr.status}`);
        prompt.push(`- Created by: ${pr.createdBy.displayName}`);
        prompt.push(`- Created: ${new Date(pr.creationDate).toLocaleDateString()}`);
        prompt.push(`- Branch: \`${pr.sourceRefName.replace('refs/heads/', '')}\` → \`${pr.targetRefName.replace('refs/heads/', '')}\``);

        if (pr.mergeStatus) {
          prompt.push(`- Merge Status: ${pr.mergeStatus}`);
        }

        prompt.push('');

        // PR Description/Summary
        if (pr.description) {
          prompt.push('**Description/Summary:**');
          const descLines = this.cleanHtml(pr.description).split('\n');
          const maxDescLines = 10;
          for (const line of descLines.slice(0, maxDescLines)) {
            if (line.trim()) {
              prompt.push(`> ${line}`);
            }
          }
          if (descLines.length > maxDescLines) {
            prompt.push(`> ... [${descLines.length - maxDescLines} more lines]`);
          }
          prompt.push('');
        }

        // Changed Files with details
        if (prContext.changedFiles && prContext.changedFiles.length > 0) {
          prompt.push(`**Changed Files (${prContext.changedFiles.length} files):**`);

          // Group files by directory for better organization
          const filesByDir = new Map<string, FileChangeInfo[]>();
          for (const file of prContext.changedFiles) {
            const dir = file.path.substring(0, file.path.lastIndexOf('/')) || '/';
            if (!filesByDir.has(dir)) {
              filesByDir.set(dir, []);
            }
            filesByDir.get(dir)!.push(file);
          }

          // Display files grouped by directory (show first 15 files)
          let fileCount = 0;
          const maxFiles = 15;

          for (const [dir, files] of filesByDir) {
            if (fileCount >= maxFiles) break;

            prompt.push(`  📁 ${dir}/`);
            for (const file of files) {
              if (fileCount >= maxFiles) break;

              const filename = file.path.substring(file.path.lastIndexOf('/') + 1);
              const changeIndicator = this.getChangeTypeIndicator(file.changeType);
              prompt.push(`    ${changeIndicator} ${filename}`);
              fileCount++;
            }
          }

          if (prContext.changedFiles.length > maxFiles) {
            prompt.push(`  ... and ${prContext.changedFiles.length - maxFiles} more files`);
          }

          // Summary of change types
          const changeTypes = new Map<string, number>();
          for (const file of prContext.changedFiles) {
            changeTypes.set(file.changeType, (changeTypes.get(file.changeType) || 0) + 1);
          }

          prompt.push('');
          prompt.push('**Change Summary:**');
          for (const [type, count] of changeTypes) {
            prompt.push(`- ${type}: ${count} file${count !== 1 ? 's' : ''}`);
          }

          prompt.push('');
        }

        // Commits information
        if (prContext.commits && prContext.commits.length > 0) {
          prompt.push(`**Commits (${prContext.commits.length} total):**`);

          // Show first 5 commits
          const maxCommits = 5;
          for (let i = 0; i < Math.min(prContext.commits.length, maxCommits); i++) {
            const commit = prContext.commits[i];
            const shortHash = commit.commitId.substring(0, 8);
            const author = commit.author?.name || 'Unknown';
            const message = commit.comment?.split('\n')[0] || 'No message';
            prompt.push(`- \`${shortHash}\` ${message} (by ${author})`);
          }

          if (prContext.commits.length > maxCommits) {
            prompt.push(`- ... and ${prContext.commits.length - maxCommits} more commits`);
          }

          prompt.push('');
        }

        // Branch information
        if (prContext.sourceBranch && prContext.targetBranch) {
          prompt.push('**Branch Information:**');
          prompt.push(`- Source: \`${prContext.sourceBranch.replace('refs/heads/', '')}\``);
          prompt.push(`- Target: \`${prContext.targetBranch.replace('refs/heads/', '')}\``);
          prompt.push('');
        }

        // File diffs (show first few files)
        if (prContext.diffs && Object.keys(prContext.diffs).length > 0) {
          prompt.push('**Code Diffs (sample):**');

          const diffFiles = Object.keys(prContext.diffs).slice(0, 3);
          for (const filePath of diffFiles) {
            const filename = filePath.substring(filePath.lastIndexOf('/') + 1);
            prompt.push(`\n📄 ${filename}:`);
            prompt.push('```diff');

            const diffLines = prContext.diffs[filePath].split('\n').slice(0, 20);
            for (const line of diffLines) {
              if (line.trim()) {
                prompt.push(line);
              }
            }

            if (prContext.diffs[filePath].split('\n').length > 20) {
              prompt.push('... [diff truncated]');
            }
            prompt.push('```');
          }

          if (Object.keys(prContext.diffs).length > 3) {
            prompt.push(`\n... and diffs for ${Object.keys(prContext.diffs).length - 3} more files`);
          }

          prompt.push('');
        }

        // Comments summary
        if (prContext.comments && prContext.comments.length > 0) {
          const commentCount = prContext.comments.reduce((sum, t) => sum + (t.comments?.length || 0), 0);
          prompt.push(`**Discussion:** ${prContext.comments.length} threads with ${commentCount} total comments`);

          // Show a few key comments
          const recentThreads = prContext.comments
            .filter(t => t.comments && t.comments.length > 0)
            .sort((a, b) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime())
            .slice(0, 3);

          if (recentThreads.length > 0) {
            prompt.push('');
            prompt.push('Recent discussions:');
            for (const thread of recentThreads) {
              if (thread.comments && thread.comments[0]) {
                const comment = thread.comments[0];
                const author = comment.author?.displayName || 'Unknown';
                const content = this.cleanHtml(comment.content || '').substring(0, 100);
                prompt.push(`- ${author}: "${content}${comment.content && comment.content.length > 100 ? '...' : ''}"`);
              }
            }
          }

          prompt.push('');
        }

        // Linked work items from this PR
        if (prContext.linkedWorkItems && prContext.linkedWorkItems.length > 0) {
          prompt.push(`**Linked Work Items:** ${prContext.linkedWorkItems.map(id => `#${id}`).join(', ')}`);
          prompt.push('');
        }

        prompt.push('-'.repeat(40));
        prompt.push('');
      }
    }

    // Related Pull Requests
    if (context.relatedPullRequests.length > 0) {
      prompt.push('### Pull Requests from Related Work Items');
      for (const prContext of context.relatedPullRequests) {
        const pr = prContext.pullRequest;
        prompt.push(`- PR #${pr.pullRequestId}: ${pr.title} (${pr.status})`);
        if (prContext.linkedWorkItems && prContext.linkedWorkItems.length > 0) {
          prompt.push(`  - Linked to work items: ${prContext.linkedWorkItems.join(', ')}`);
        }
      }
      prompt.push('');
    }

    // Implementation Guidance
    prompt.push('## Implementation Context');
    prompt.push('');
    prompt.push('Based on the work item details and related information above:');
    prompt.push('1. This work item requires implementation of the described functionality');
    prompt.push('2. Consider the acceptance criteria and any constraints mentioned');
    prompt.push('3. Review related PRs for context on similar implementations');
    prompt.push('4. Ensure alignment with parent/child work items if present');
    prompt.push('');
    prompt.push('Please implement the required functionality following the specifications and context provided.');

    return prompt.join('\n');
  }

  /**
   * Get change type indicator for file changes
   */
  private getChangeTypeIndicator(changeType: string): string {
    switch (changeType?.toLowerCase()) {
      case 'add':
      case 'added':
        return '➕';
      case 'edit':
      case 'edited':
      case 'modify':
      case 'modified':
        return '📝';
      case 'delete':
      case 'deleted':
        return '❌';
      case 'rename':
      case 'renamed':
        return '📋';
      default:
        return '•';
    }
  }

  /**
   * Clean HTML content and convert to plain text
   */
  private cleanHtml(html: string): string {
    if (!html) return '';

    // Remove HTML tags
    let text = html.replace(/<[^>]*>/g, '');

    // Decode HTML entities
    text = text.replace(/&nbsp;/g, ' ')
               .replace(/&lt;/g, '<')
               .replace(/&gt;/g, '>')
               .replace(/&amp;/g, '&')
               .replace(/&quot;/g, '"')
               .replace(/&#39;/g, "'");

    // Remove excessive whitespace
    text = text.replace(/\s+/g, ' ').trim();

    return text;
  }
}