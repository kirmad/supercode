/**
 * Azure DevOps Pull Request Client
 */

import { AzureDevOpsError } from '../interfaces/index.js';
import type {
  AzureDevOpsConfig,
  PullRequest,
  GitPullRequestIteration,
  GitPullRequestChange,
  GitPullRequestCommentThread,
  Comment,
  CommentThreadContext,
  CreateThreadRequest,
  CreateCommentRequest,
  UpdateCommentRequest,
  UpdateThreadRequest,
  PullRequestSearchCriteria,
  PullRequestCompletionOptions,
  AssociatedWorkItem,
  GitRepository,
  GitItem,
  GitCommitRef
} from '../interfaces/index.js';

/**
 * Browser-compatible base64 encoding function
 * Uses native browser btoa() function for web compatibility
 */
function toBase64(input: string): string {
  if (typeof btoa !== 'undefined') {
    // Browser environment
    return btoa(input);
  } else {
    // Node.js fallback (if needed)
    return Buffer.from(input).toString('base64');
  }
}

export class PullRequestClient {
  private baseUrl: string;
  private headers: Record<string, string>;
  private apiVersion: string;
  private prApiVersion: string;
  private config: AzureDevOpsConfig;

  constructor(config: AzureDevOpsConfig) {
    this.config = config;
    this.baseUrl = `https://dev.azure.com/${config.organization}/${config.project}/_apis`;
    this.apiVersion = config.apiVersion || '7.1';
    this.prApiVersion = '7.2-preview';
    this.headers = {
      'Authorization': `Basic ${toBase64(`:${config.pat}`)}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  /**
   * Get list of repositories
   */
  async getRepositories(): Promise<GitRepository[]> {
    const url = `${this.baseUrl}/git/repositories?api-version=${this.apiVersion}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new AzureDevOpsError(
        `Failed to get repositories: ${error.message || response.statusText}`,
        response.status,
        error
      );
    }

    const data = await response.json();
    return data.value || [];
  }

  /**
   * Get repository by name or ID
   */
  async getRepository(repositoryNameOrId: string): Promise<GitRepository> {
    const url = `${this.baseUrl}/git/repositories/${repositoryNameOrId}?api-version=${this.apiVersion}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new AzureDevOpsError(
        `Failed to get repository: ${error.message || response.statusText}`,
        response.status,
        error
      );
    }

    return response.json();
  }

  /**
   * 6. Get pull request details
   */
  async getPullRequest(repositoryId: string, pullRequestId: number): Promise<PullRequest> {
    const url = `${this.baseUrl}/git/repositories/${repositoryId}/pullrequests/${pullRequestId}?api-version=${this.prApiVersion}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new AzureDevOpsError(
        `Failed to get pull request: ${error.message || response.statusText}`,
        response.status,
        error
      );
    }

    return response.json();
  }

  /**
   * Get current user ID from the API
   */
  async getCurrentUserId(): Promise<string> {
    // Get current user's identity
    const url = `https://dev.azure.com/${this.config.organization}/_apis/connectiondata?api-version=${this.apiVersion}-preview`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new AzureDevOpsError(
        `Failed to get current user: ${error.message || response.statusText}`,
        response.status,
        error
      );
    }

    const data = await response.json();
    return data.authenticatedUser.id;
  }

  /**
   * Get pull requests created by me
   */
  async getMyCreatedPullRequests(options?: {
    status?: 'active' | 'completed' | 'abandoned' | 'all';
    top?: number;
    includeAllRepositories?: boolean;
  }): Promise<{ repository: GitRepository; pullRequests: PullRequest[] }[]> {
    // Get current user ID
    const userId = await this.getCurrentUserId();

    // Get all repositories or use a subset
    const repositories = await this.getRepositories();
    const reposToSearch = options?.includeAllRepositories
      ? repositories
      : repositories.slice(0, 20); // Limit to first 20 repos by default

    const results: { repository: GitRepository; pullRequests: PullRequest[] }[] = [];

    // Search each repository for PRs created by the user
    for (const repo of reposToSearch) {
      try {
        const prs = await this.searchPullRequests(repo.id, {
          creatorId: userId,
          status: options?.status || 'all',
          top: options?.top || 50
        });

        if (prs.length > 0) {
          results.push({ repository: repo, pullRequests: prs });
        }
      } catch (error: any) {
        // Skip repos with errors (might not have access)
        console.log(`Skipping repo ${repo.name}: ${error.message || error}`);
      }
    }

    return results;
  }

  /**
   * Get pull requests assigned to me as reviewer
   */
  async getMyAssignedPullRequests(options?: {
    status?: 'active' | 'completed' | 'abandoned' | 'all';
    top?: number;
    includeAllRepositories?: boolean;
  }): Promise<{ repository: GitRepository; pullRequests: PullRequest[] }[]> {
    // Get current user ID
    const userId = await this.getCurrentUserId();

    // Get all repositories or use a subset
    const repositories = await this.getRepositories();
    const reposToSearch = options?.includeAllRepositories
      ? repositories
      : repositories.slice(0, 20); // Limit to first 20 repos by default

    const results: { repository: GitRepository; pullRequests: PullRequest[] }[] = [];

    // Search each repository for PRs where user is a reviewer
    for (const repo of reposToSearch) {
      try {
        const prs = await this.searchPullRequests(repo.id, {
          reviewerId: userId,
          status: options?.status || 'active',
          top: options?.top || 50
        });

        if (prs.length > 0) {
          results.push({ repository: repo, pullRequests: prs });
        }
      } catch (error: any) {
        // Skip repos with errors (might not have access)
        console.log(`Skipping repo ${repo.name}: ${error.message || error}`);
      }
    }

    return results;
  }

  /**
   * Get all my pull requests (created by me or assigned to me)
   */
  async getMyPullRequests(options?: {
    status?: 'active' | 'completed' | 'abandoned' | 'all';
    top?: number;
    includeAllRepositories?: boolean;
  }): Promise<{
    created: { repository: GitRepository; pullRequests: PullRequest[] }[];
    assigned: { repository: GitRepository; pullRequests: PullRequest[] }[];
    total: number;
  }> {
    const [created, assigned] = await Promise.all([
      this.getMyCreatedPullRequests(options),
      this.getMyAssignedPullRequests(options)
    ]);

    const totalCreated = created.reduce((sum, r) => sum + r.pullRequests.length, 0);
    const totalAssigned = assigned.reduce((sum, r) => sum + r.pullRequests.length, 0);

    return {
      created,
      assigned,
      total: totalCreated + totalAssigned
    };
  }

  /**
   * Search for pull requests
   */
  async searchPullRequests(
    repositoryId: string,
    criteria?: PullRequestSearchCriteria
  ): Promise<PullRequest[]> {
    const params = new URLSearchParams({
      'api-version': this.prApiVersion,
      ...(criteria?.status && { 'searchCriteria.status': criteria.status }),
      ...(criteria?.creatorId && { 'searchCriteria.creatorId': criteria.creatorId }),
      ...(criteria?.reviewerId && { 'searchCriteria.reviewerId': criteria.reviewerId }),
      ...(criteria?.sourceRefName && { 'searchCriteria.sourceRefName': criteria.sourceRefName }),
      ...(criteria?.targetRefName && { 'searchCriteria.targetRefName': criteria.targetRefName }),
      ...(criteria?.includeLinks && { 'searchCriteria.includeLinks': criteria.includeLinks.toString() }),
      ...(criteria?.skip && { '$skip': criteria.skip.toString() }),
      ...(criteria?.top && { '$top': criteria.top.toString() })
    });

    const url = `${this.baseUrl}/git/repositories/${repositoryId}/pullrequests?${params}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new AzureDevOpsError(
        `Failed to search pull requests: ${error.message || response.statusText}`,
        response.status,
        error
      );
    }

    const data = await response.json();
    return data.value || [];
  }

  /**
   * 7. Get pull requests linked to a work item
   */
  async getPullRequestsLinkedToWorkItem(workItemId: number): Promise<{
    pullRequestUrls: string[];
    pullRequests: PullRequest[];
  }> {
    // First get the work item with relations
    const wiUrl = `${this.baseUrl}/wit/workitems/${workItemId}?$expand=relations&api-version=${this.apiVersion}`;

    const wiResponse = await fetch(wiUrl, {
      method: 'GET',
      headers: this.headers
    });

    if (!wiResponse.ok) {
      const error = await wiResponse.json().catch(() => ({ message: 'Unknown error' }));
      throw new AzureDevOpsError(
        `Failed to get work item relations: ${error.message || wiResponse.statusText}`,
        wiResponse.status,
        error
      );
    }

    const workItem = await wiResponse.json();
    const pullRequestUrls: string[] = [];

    if (workItem.relations) {
      for (const relation of workItem.relations) {
        if (relation.rel === 'ArtifactLink' && relation.url?.includes('pullrequest')) {
          pullRequestUrls.push(relation.url);
        }
      }
    }

    // Extract repository and PR IDs from URLs and fetch PR details
    const pullRequests: PullRequest[] = [];
    for (const url of pullRequestUrls) {
      // URL format: vstfs:///Git/PullRequestId/{projectId}%2F{repositoryId}%2F{pullRequestId}
      const match = url.match(/PullRequestId\/[^\/]+%2F([^%]+)%2F(\d+)/);
      if (match) {
        const [, repositoryId, prId] = match;
        try {
          const pr = await this.getPullRequest(repositoryId, parseInt(prId));
          pullRequests.push(pr);
        } catch (error: any) {
          console.error(`Failed to fetch PR ${prId}:`, error.message || error);
        }
      }
    }

    return { pullRequestUrls, pullRequests };
  }

  /**
   * Get work items associated with a pull request
   */
  async getWorkItemsLinkedToPullRequest(
    repositoryId: string,
    pullRequestId: number
  ): Promise<AssociatedWorkItem[]> {
    const url = `${this.baseUrl}/git/repositories/${repositoryId}/pullrequests/${pullRequestId}/workitems?api-version=${this.prApiVersion}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new AzureDevOpsError(
        `Failed to get work items linked to PR: ${error.message || response.statusText}`,
        response.status,
        error
      );
    }

    const data = await response.json();
    return data.value || [];
  }

  /**
   * 8. Get changed files and changes in the pull request
   */
  async getPullRequestChanges(
    repositoryId: string,
    pullRequestId: number,
    iterationId?: number
  ): Promise<{
    changes: GitPullRequestChange[];
    iterations?: GitPullRequestIteration[];
  }> {
    // If no iteration specified, get all iterations first
    if (!iterationId) {
      const iterationsUrl = `${this.baseUrl}/git/repositories/${repositoryId}/pullrequests/${pullRequestId}/iterations?api-version=${this.prApiVersion}`;

      const iterResponse = await fetch(iterationsUrl, {
        method: 'GET',
        headers: this.headers
      });

      if (!iterResponse.ok) {
        const error = await iterResponse.json().catch(() => ({ message: 'Unknown error' }));
        throw new AzureDevOpsError(
          `Failed to get PR iterations: ${error.message || iterResponse.statusText}`,
          iterResponse.status,
          error
        );
      }

      const iterData = await iterResponse.json();
      const iterations: GitPullRequestIteration[] = iterData.value || [];

      // Get changes from the latest iteration
      if (iterations.length > 0) {
        const latestIteration = iterations[iterations.length - 1];
        const changesUrl = `${this.baseUrl}/git/repositories/${repositoryId}/pullrequests/${pullRequestId}/iterations/${latestIteration.id}/changes?api-version=${this.prApiVersion}`;

        const changesResponse = await fetch(changesUrl, {
          method: 'GET',
          headers: this.headers
        });

        if (!changesResponse.ok) {
          const error = await changesResponse.json().catch(() => ({ message: 'Unknown error' }));
          throw new AzureDevOpsError(
            `Failed to get PR changes: ${error.message || changesResponse.statusText}`,
            changesResponse.status,
            error
          );
        }

        const changesData = await changesResponse.json();
        return {
          changes: changesData.changeEntries || [],
          iterations
        };
      }

      return { changes: [], iterations };
    } else {
      // Get changes for specific iteration
      const changesUrl = `${this.baseUrl}/git/repositories/${repositoryId}/pullrequests/${pullRequestId}/iterations/${iterationId}/changes?api-version=${this.prApiVersion}`;

      const changesResponse = await fetch(changesUrl, {
        method: 'GET',
        headers: this.headers
      });

      if (!changesResponse.ok) {
        const error = await changesResponse.json().catch(() => ({ message: 'Unknown error' }));
        throw new AzureDevOpsError(
          `Failed to get PR changes: ${error.message || changesResponse.statusText}`,
          changesResponse.status,
          error
        );
      }

      const changesData = await changesResponse.json();
      return { changes: changesData.changeEntries || [] };
    }
  }

  /**
   * Get file content diff
   */
  async getFileDiff(
    repositoryId: string,
    pullRequestId: number,
    iterationId: number,
    path: string
  ): Promise<GitItem> {
    const params = new URLSearchParams({
      'api-version': this.prApiVersion,
      path,
      '$top': '1'
    });

    const url = `${this.baseUrl}/git/repositories/${repositoryId}/pullrequests/${pullRequestId}/iterations/${iterationId}/changes?${params}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new AzureDevOpsError(
        `Failed to get file diff: ${error.message || response.statusText}`,
        response.status,
        error
      );
    }

    const data = await response.json();
    return data.changeEntries?.[0]?.item || null;
  }

  /**
   * Get commits in a pull request
   */
  async getPullRequestCommits(
    repositoryId: string,
    pullRequestId: number
  ): Promise<GitCommitRef[]> {
    const url = `${this.baseUrl}/git/repositories/${repositoryId}/pullrequests/${pullRequestId}/commits?api-version=${this.prApiVersion}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new AzureDevOpsError(
        `Failed to get PR commits: ${error.message || response.statusText}`,
        response.status,
        error
      );
    }

    const data = await response.json();
    return data.value || [];
  }

  /**
   * Get file diff between commits
   * @param repositoryId Repository ID
   * @param baseCommit Base commit SHA (not branch reference)
   * @param targetCommit Target commit SHA (not branch reference)
   * @param path File path
   */
  async getFileDiffContent(
    repositoryId: string,
    baseCommit: string,
    targetCommit: string,
    path: string
  ): Promise<string> {
    try {
      // Method 1: Try to get file content from both commits and generate diff
      const [baseContent, targetContent] = await Promise.allSettled([
        this.getFileContentAtCommit(repositoryId, baseCommit, path),
        this.getFileContentAtCommit(repositoryId, targetCommit, path)
      ]);

      const baseText = baseContent.status === 'fulfilled' ? baseContent.value : null;
      const targetText = targetContent.status === 'fulfilled' ? targetContent.value : null;

      // Generate a unified diff-like output
      let diff = `diff --git a${path} b${path}\n`;

      if (baseText === null && targetText !== null) {
        // File was added
        diff += `new file mode 100644\n`;
        diff += `--- /dev/null\n`;
        diff += `+++ b${path}\n`;
        const lines = targetText.split('\n');
        diff += `@@ -0,0 +1,${lines.length} @@\n`;
        lines.forEach(line => {
          diff += `+${line}\n`;
        });
      } else if (baseText !== null && targetText === null) {
        // File was deleted
        diff += `deleted file mode 100644\n`;
        diff += `--- a${path}\n`;
        diff += `+++ /dev/null\n`;
        const lines = baseText.split('\n');
        diff += `@@ -1,${lines.length} +0,0 @@\n`;
        lines.forEach(line => {
          diff += `-${line}\n`;
        });
      } else if (baseText !== null && targetText !== null) {
        // File was modified
        diff += `--- a${path}\n`;
        diff += `+++ b${path}\n`;

        if (baseText === targetText) {
          diff += `@@ File unchanged @@\n`;
        } else {
          // Simple line-by-line comparison
          const baseLines = baseText.split('\n');
          const targetLines = targetText.split('\n');
          const maxLines = Math.max(baseLines.length, targetLines.length);

          diff += `@@ -1,${baseLines.length} +1,${targetLines.length} @@\n`;

          // Simple diff - this could be enhanced with a proper diff algorithm
          for (let i = 0; i < maxLines; i++) {
            const baseLine = i < baseLines.length ? baseLines[i] : undefined;
            const targetLine = i < targetLines.length ? targetLines[i] : undefined;

            if (baseLine !== undefined && targetLine !== undefined) {
              if (baseLine !== targetLine) {
                diff += `-${baseLine}\n`;
                diff += `+${targetLine}\n`;
              } else {
                diff += ` ${baseLine}\n`;
              }
            } else if (baseLine !== undefined) {
              diff += `-${baseLine}\n`;
            } else if (targetLine !== undefined) {
              diff += `+${targetLine}\n`;
            }
          }
        }
      } else {
        // Both failed to retrieve
        diff += `Binary files a${path} and b${path} differ or file not found\n`;
      }

      return diff;
    } catch (error: any) {
      // Fallback: Try to get changes using the commits API
      try {
        return await this.getCommitChanges(repositoryId, targetCommit, path);
      } catch (fallbackError: any) {
        throw new AzureDevOpsError(
          `Failed to get diff content for ${path} between commits ${baseCommit} and ${targetCommit}: ${error.message || error}`,
          500,
          {
            $id: 'diff-error',
            message: `Original error: ${error.message || error}. Fallback error: ${fallbackError.message || fallbackError}`,
            typeName: 'DiffError',
            typeKey: 'diff-error',
            innerException: error
          }
        );
      }
    }
  }

  /**
   * Get file content at a specific commit
   * @param repositoryId Repository ID
   * @param commitId Commit ID
   * @param filePath File path
   */
  async getFileContent(
    repositoryId: string,
    commitId: string,
    filePath: string
  ): Promise<string | null> {
    try {
      const itemUrl = `https://dev.azure.com/${this.config.organization}/${this.config.project}/_apis/git/repositories/${repositoryId}/items`
      const queryParams = new URLSearchParams({
        'path': filePath,
        'versionDescriptor.version': commitId,
        'versionDescriptor.versionType': 'commit',
        'api-version': '7.1'
      })
      const fullUrl = `${itemUrl}?${queryParams.toString()}`

      const response = await fetch(fullUrl, {
        headers: {
          "Authorization": `Basic ${toBase64(`:${this.config.pat}`)}`,
          "Accept": "text/plain"
        }
      })

      if (!response.ok) {
        if (response.status === 404) {
          return null // File doesn't exist at this commit
        }
        throw new Error(`Azure DevOps API error: ${response.status} ${response.statusText}`)
      }

      return await response.text()
    } catch (error) {
      console.error(`Failed to get file content for ${filePath} at ${commitId}:`, error)
      return null
    }
  }
  
  /**
   * Get file content at a specific commit
   * @param repositoryId Repository ID
   * @param commitSha Commit SHA
   * @param path File path
   */
  private async getFileContentAtCommit(
    repositoryId: string,
    commitSha: string,
    path: string
  ): Promise<string> {
    // Use the Git Items API with version specifier for commit
    const params = new URLSearchParams({
      'api-version': this.apiVersion,
      'version': commitSha,
      'versionType': 'commit',
      'includeContent': 'true'
    });

    const url = `${this.baseUrl}/git/repositories/${repositoryId}/items?path=${encodeURIComponent(path)}&${params}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`File not found: ${path} at commit ${commitSha}`);
      }
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`Failed to get file content: ${error.message || response.statusText}`);
    }

    const data = await response.json();
    return data.content || '';
  }

  /**
   * Get changes for a specific commit (fallback method)
   * @param repositoryId Repository ID
   * @param commitSha Commit SHA
   * @param path Optional file path filter
   */
  private async getCommitChanges(
    repositoryId: string,
    commitSha: string,
    path?: string
  ): Promise<string> {
    const url = `${this.baseUrl}/git/repositories/${repositoryId}/commits/${commitSha}/changes?api-version=${this.apiVersion}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`Failed to get commit changes: ${error.message || response.statusText}`);
    }

    const data = await response.json();
    const changes = data.changes || [];

    if (path) {
      const fileChange = changes.find((c: any) => c.item?.path === path);
      if (!fileChange) {
        return `No changes found for file: ${path}`;
      }

      let diff = `diff --git a${path} b${path}\n`;
      diff += `--- a${path}\n`;
      diff += `+++ b${path}\n`;
      diff += `@@ Commit ${commitSha} @@\n`;
      diff += `~ Change type: ${fileChange.changeType}\n`;

      return diff;
    }

    // Return summary of all changes
    let summary = `Changes in commit ${commitSha}:\n`;
    changes.forEach((change: any) => {
      summary += `${change.changeType}: ${change.item?.path || 'unknown'}\n`;
    });

    return summary;
  }

  /**
   * 9. Get summary in a pull request (description)
   * The summary is included in the PR details as the description field
   */
  async getPullRequestSummary(
    repositoryId: string,
    pullRequestId: number
  ): Promise<{
    title: string;
    description: string;
    createdBy: string;
    creationDate: string;
    status: string;
    sourceRefName: string;
    targetRefName: string;
  }> {
    const pr = await this.getPullRequest(repositoryId, pullRequestId);

    return {
      title: pr.title,
      description: pr.description || '',
      createdBy: pr.createdBy.displayName,
      creationDate: pr.creationDate,
      status: pr.status,
      sourceRefName: pr.sourceRefName,
      targetRefName: pr.targetRefName
    };
  }

  /**
   * 10. Get comments added to a pull request
   */
  async getPullRequestComments(
    repositoryId: string,
    pullRequestId: number
  ): Promise<GitPullRequestCommentThread[]> {
    const url = `${this.baseUrl}/git/repositories/${repositoryId}/pullrequests/${pullRequestId}/threads?api-version=${this.prApiVersion}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers
    });

    if (!response.ok) {
      const errorText = await response.text();
      let error;
      try {
        error = JSON.parse(errorText);
      } catch {
        error = { message: errorText || 'Unknown error' };
      }
      throw new AzureDevOpsError(
        `Failed to get PR comments: ${error.message || response.statusText}`,
        response.status,
        error
      );
    }

    const data = await response.json();
    return data.value || [];
  }

  /**
   * 12. Add comment to pull request
   */
  async addPullRequestComment(
    repositoryId: string,
    pullRequestId: number,
    content: string,
    status: 'active' | 'pending' | 'closed' = 'active',
    threadContext?: CommentThreadContext
  ): Promise<GitPullRequestCommentThread> {
    const url = `${this.baseUrl}/git/repositories/${repositoryId}/pullrequests/${pullRequestId}/threads?api-version=${this.prApiVersion}`;

    const body: CreateThreadRequest = {
      comments: [{
        content,
        commentType: threadContext ? 'codeChange' : 'text'
      }],
      status,
      threadContext
    };

    console.log(`[PullRequestClient] Creating comment with threadContext:`, JSON.stringify({
      url,
      threadContext,
      hasThreadContext: !!threadContext,
      commentType: threadContext ? 'codeChange' : 'text'
    }, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new AzureDevOpsError(
        `Failed to add PR comment: ${error.message || response.statusText}`,
        response.status,
        error
      );
    }

    return response.json();
  }

  /**
   * Add reply to existing thread
   */
  async addReplyToThread(
    repositoryId: string,
    pullRequestId: number,
    threadId: number,
    content: string,
    parentCommentId?: number
  ): Promise<Comment> {
    const url = `${this.baseUrl}/git/repositories/${repositoryId}/pullrequests/${pullRequestId}/threads/${threadId}/comments?api-version=${this.prApiVersion}`;

    const body: CreateCommentRequest = {
      content,
      parentCommentId,
      commentType: 1
    };

    console.log(`[ADO Client] Adding reply to thread ${threadId}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new AzureDevOpsError(
        `Failed to add reply to thread: ${error.message || response.statusText}`,
        response.status,
        error
      );
    }

    const responseData = await response.json();
    return responseData;
  }

  /**
   * 12. Update PR comment
   */
  async updatePullRequestComment(
    repositoryId: string,
    pullRequestId: number,
    threadId: number,
    commentId: number,
    content: string
  ): Promise<Comment> {
    const url = `${this.baseUrl}/git/repositories/${repositoryId}/pullrequests/${pullRequestId}/threads/${threadId}/comments/${commentId}?api-version=${this.prApiVersion}`;

    const body: UpdateCommentRequest = {
      content
    };

    const response = await fetch(url, {
      method: 'PATCH',
      headers: this.headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new AzureDevOpsError(
        `Failed to update PR comment: ${error.message || response.statusText}`,
        response.status,
        error
      );
    }

    return response.json();
  }

  /**
   * Update thread status
   */
  async updateThreadStatus(
    repositoryId: string,
    pullRequestId: number,
    threadId: number,
    status: 'active' | 'fixed' | 'wontFix' | 'closed' | 'byDesign' | 'pending'
  ): Promise<GitPullRequestCommentThread> {
    const url = `${this.baseUrl}/git/repositories/${repositoryId}/pullrequests/${pullRequestId}/threads/${threadId}?api-version=${this.prApiVersion}`;

    const body: UpdateThreadRequest = {
      status
    };

    const response = await fetch(url, {
      method: 'PATCH',
      headers: this.headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new AzureDevOpsError(
        `Failed to update thread status: ${error.message || response.statusText}`,
        response.status,
        error
      );
    }

    return response.json();
  }

  /**
   * Delete comment
   */
  async deletePullRequestComment(
    repositoryId: string,
    pullRequestId: number,
    threadId: number,
    commentId: number
  ): Promise<void> {
    const url = `${this.baseUrl}/git/repositories/${repositoryId}/pullrequests/${pullRequestId}/threads/${threadId}/comments/${commentId}?api-version=${this.prApiVersion}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new AzureDevOpsError(
        `Failed to delete PR comment: ${error.message || response.statusText}`,
        response.status,
        error
      );
    }
  }

  /**
   * Search for pull requests by source and target branch names
   * @param repositoryId Repository ID
   * @param sourceBranch Source branch name (without refs/heads/)
   * @param targetBranch Target branch name (without refs/heads/)
   * @param status PR status filter (default: 'all')
   */
  async searchPullRequestsByBranches(
    repositoryId: string,
    sourceBranch: string,
    targetBranch: string,
    status: 'active' | 'completed' | 'abandoned' | 'all' = 'all'
  ): Promise<PullRequest[]> {
    const searchCriteria: PullRequestSearchCriteria = {
      sourceRefName: `refs/heads/${sourceBranch}`,
      targetRefName: `refs/heads/${targetBranch}`,
      status: status,
      top: 50
    };

    return this.searchPullRequests(repositoryId, searchCriteria);
  }

  /**
   * Find existing active PR or create a new one with the specified branches
   * @param repositoryId Repository ID
   * @param sourceBranch Source branch name (without refs/heads/)
   * @param targetBranch Target branch name (without refs/heads/)
   * @param title PR title (optional, will generate default)
   * @param description PR description (optional, will generate default)
   * @returns Object with action ('found' | 'created') and PR details
   */
  async findOrCreatePullRequest(
    repositoryId: string,
    sourceBranch: string,
    targetBranch: string,
    title?: string,
    description?: string
  ): Promise<{
    action: 'found' | 'created';
    pullRequest: PullRequest;
  }> {
    // First check for active PRs with these branches
    const activePRs = await this.searchPullRequestsByBranches(
      repositoryId,
      sourceBranch,
      targetBranch,
      'active'
    );

    // If active PR exists, return it
    if (activePRs.length > 0) {
      return {
        action: 'found',
        pullRequest: activePRs[0]
      };
    }

    // No active PR found, create a new one
    const defaultTitle = title || `Merge ${sourceBranch} into ${targetBranch}`;
    const defaultDescription = description || `Automated PR created to merge changes from ${sourceBranch} into ${targetBranch}.`;

    const createUrl = `${this.baseUrl}/git/repositories/${repositoryId}/pullrequests?api-version=${this.prApiVersion}`;

    const createPayload = {
      sourceRefName: `refs/heads/${sourceBranch}`,
      targetRefName: `refs/heads/${targetBranch}`,
      title: defaultTitle,
      description: defaultDescription
    };

    const response = await fetch(createUrl, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(createPayload)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new AzureDevOpsError(
        `Failed to create pull request: ${error.message || response.statusText}`,
        response.status,
        error
      );
    }

    const newPR = await response.json();

    return {
      action: 'created',
      pullRequest: newPR
    };
  }

  /**
   * Get complete pull request data including commits, changes, and comments
   * @param repositoryId Repository ID
   * @param pullRequestId Pull request ID
   * @param options Options for data retrieval
   * @returns Complete PR data with all related information
   */
  async getCompletePullRequestData(
    repositoryId: string,
    pullRequestId: number,
    options?: {
      includeCommits?: boolean;
      includeChanges?: boolean;
      includeComments?: boolean;
      includeWorkItems?: boolean;
      maxChanges?: number;
    }
  ): Promise<{
    pullRequest: PullRequest;
    commits?: GitCommitRef[];
    changes?: { changes: GitPullRequestChange[]; iterations?: GitPullRequestIteration[] };
    comments?: GitPullRequestCommentThread[];
    workItems?: AssociatedWorkItem[];
  }> {
    const opts = {
      includeCommits: true,
      includeChanges: true,
      includeComments: true,
      includeWorkItems: false,
      maxChanges: 50,
      ...options
    };

    // Start with the basic PR data
    const pullRequest = await this.getPullRequest(repositoryId, pullRequestId);

    // Fetch additional data in parallel based on options
    const promises: Promise<any>[] = [];
    const dataKeys: string[] = [];

    if (opts.includeCommits) {
      promises.push(this.getPullRequestCommits(repositoryId, pullRequestId));
      dataKeys.push('commits');
    }

    if (opts.includeChanges) {
      promises.push(this.getPullRequestChanges(repositoryId, pullRequestId));
      dataKeys.push('changes');
    }

    if (opts.includeComments) {
      promises.push(this.getPullRequestComments(repositoryId, pullRequestId));
      dataKeys.push('comments');
    }

    if (opts.includeWorkItems) {
      promises.push(this.getWorkItemsLinkedToPullRequest(repositoryId, pullRequestId));
      dataKeys.push('workItems');
    }

    // Execute all requests in parallel
    const results = await Promise.allSettled(promises);

    // Build result object
    const result: any = { pullRequest };

    results.forEach((promiseResult, index) => {
      const key = dataKeys[index];
      if (promiseResult.status === 'fulfilled') {
        result[key] = promiseResult.value;
      } else {
        console.warn(`Failed to fetch ${key} for PR ${pullRequestId}:`, promiseResult.reason);
        // Set empty default for failed requests
        if (key === 'commits') result[key] = [];
        else if (key === 'changes') result[key] = { changes: [], iterations: [] };
        else if (key === 'comments') result[key] = [];
        else if (key === 'workItems') result[key] = [];
      }
    });

    return result;
  }

  /**
   * Publish a comment to a pull request (alias for addPullRequestComment)
   * @param repositoryId Repository ID
   * @param pullRequestId Pull request ID
   * @param commentData Comment data
   * @returns Created comment thread
   */
  async publishComment(
    repositoryId: string,
    pullRequestId: number,
    commentData: {
      content: string;
      status?: 'active' | 'pending' | 'closed';
      threadContext?: CommentThreadContext;
    }
  ): Promise<GitPullRequestCommentThread> {
    return this.addPullRequestComment(
      repositoryId,
      pullRequestId,
      commentData.content,
      commentData.status || 'active',
      commentData.threadContext
    );
  }

  /**
   * Reply to an existing comment thread
   * @param repositoryId Repository ID
   * @param pullRequestId Pull request ID
   * @param threadId Thread ID to reply to
   * @param content Reply content
   * @param parentCommentId Optional parent comment ID for nested replies
   * @returns Created reply comment
   */
  async replyToThread(
    repositoryId: string,
    pullRequestId: number,
    threadId: number,
    content: string,
    parentCommentId?: number
  ): Promise<Comment> {
    return this.addReplyToThread(
      repositoryId,
      pullRequestId,
      threadId,
      content,
      parentCommentId
    );
  }

  /**
   * Create a new pull request
   * @param repositoryId Repository ID
   * @param createData Pull request creation data
   * @returns Created pull request
   */
  async createPullRequest(
    repositoryId: string,
    createData: {
      sourceRefName: string;
      targetRefName: string;
      title: string;
      description?: string;
      reviewers?: string[];
      workItemRefs?: number[];
      labels?: string[];
      isDraft?: boolean;
    }
  ): Promise<PullRequest> {
    const url = `${this.baseUrl}/git/repositories/${repositoryId}/pullrequests?api-version=${this.prApiVersion}`;

    const payload: any = {
      sourceRefName: createData.sourceRefName,
      targetRefName: createData.targetRefName,
      title: createData.title,
      description: createData.description || '',
      isDraft: createData.isDraft || false
    };

    // Add reviewers if provided
    if (createData.reviewers && createData.reviewers.length > 0) {
      payload.reviewers = createData.reviewers.map(reviewerId => ({
        id: reviewerId,
        vote: 0
      }));
    }

    // Add work item references if provided
    if (createData.workItemRefs && createData.workItemRefs.length > 0) {
      payload.workItemRefs = createData.workItemRefs.map(workItemId => ({
        id: workItemId.toString()
      }));
    }

    // Add labels if provided
    if (createData.labels && createData.labels.length > 0) {
      payload.labels = createData.labels.map(label => ({ name: label }));
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new AzureDevOpsError(
        `Failed to create pull request: ${error.message || response.statusText}`,
        response.status,
        error
      );
    }

    return response.json();
  }

  /**
   * Update an existing pull request
   * @param repositoryId Repository ID
   * @param pullRequestId Pull request ID
   * @param updateData Update data
   * @returns Updated pull request
   */
  async updatePullRequest(
    repositoryId: string,
    pullRequestId: number,
    updateData: {
      title?: string;
      description?: string;
      targetRefName?: string;
      status?: 'active' | 'abandoned' | 'completed';
      isDraft?: boolean;
      autoCompleteSetBy?: string;
      completionOptions?: PullRequestCompletionOptions;
    }
  ): Promise<PullRequest> {
    const url = `${this.baseUrl}/git/repositories/${repositoryId}/pullrequests/${pullRequestId}?api-version=${this.prApiVersion}`;

    const response = await fetch(url, {
      method: 'PATCH',
      headers: this.headers,
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new AzureDevOpsError(
        `Failed to update pull request: ${error.message || response.statusText}`,
        response.status,
        error
      );
    }

    return response.json();
  }

  /**
   * Get pull request status with additional metadata
   * @param repositoryId Repository ID
   * @param pullRequestId Pull request ID
   * @returns PR status information
   */
  async getPullRequestStatus(
    repositoryId: string,
    pullRequestId: number
  ): Promise<{
    status: string;
    mergeStatus: string;
    isDraft: boolean;
    hasConflicts: boolean;
    canComplete: boolean;
    reviewersStatus: {
      approved: number;
      waiting: number;
      rejected: number;
      total: number;
    };
  }> {
    const pr = await this.getPullRequest(repositoryId, pullRequestId);

    // Calculate reviewer statistics
    const reviewersStatus = {
      approved: 0,
      waiting: 0,
      rejected: 0,
      total: pr.reviewers?.length || 0
    };

    if (pr.reviewers) {
      for (const reviewer of pr.reviewers) {
        if (reviewer.vote >= 10) {
          reviewersStatus.approved++;
        } else if (reviewer.vote <= -5) {
          reviewersStatus.rejected++;
        } else {
          reviewersStatus.waiting++;
        }
      }
    }

    return {
      status: pr.status,
      mergeStatus: pr.mergeStatus,
      isDraft: pr.isDraft,
      hasConflicts: pr.mergeStatus === 'conflicts',
      canComplete: pr.status === 'active' && pr.mergeStatus === 'succeeded' && reviewersStatus.rejected === 0,
      reviewersStatus
    };
  }
}