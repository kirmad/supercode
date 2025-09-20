/**
 * Azure DevOps Main Client
 */

import { WorkItemClient } from './work-item-client.js';
import { PullRequestClient } from './pull-request-client.js';
import { BuildClient } from './build-client.js';
import type { AzureDevOpsConfig } from '../interfaces/index.js';

export class AzureDevOpsClient {
  public readonly workItems: WorkItemClient;
  public readonly pullRequests: PullRequestClient;
  public readonly builds: BuildClient;
  private config: AzureDevOpsConfig;

  constructor(config: AzureDevOpsConfig) {
    this.config = config;
    this.workItems = new WorkItemClient(config);
    this.pullRequests = new PullRequestClient(config);
    this.builds = new BuildClient(config);
  }

  /**
   * Get complete information about a work item including:
   * - Work item details
   * - Comments/discussion
   * - Related work items (parent, children, related)
   * - Linked pull requests
   */
  async getCompleteWorkItemInfo(workItemId: number) {
    const [details, relations, linkedPRs] = await Promise.all([
      this.workItems.getWorkItemDetails(workItemId),
      this.workItems.getRelatedWorkItems(workItemId),
      this.pullRequests.getPullRequestsLinkedToWorkItem(workItemId)
    ]);

    return {
      workItem: details.workItem,
      comments: details.comments,
      parentWorkItem: relations.parent,
      childWorkItems: relations.children,
      relatedWorkItems: relations.related,
      linkedPullRequests: linkedPRs.pullRequests
    };
  }

  /**
   * Get complete pull request information including:
   * - PR details
   * - Changed files
   * - Comments/threads
   * - Linked work items
   */
  async getCompletePullRequestInfo(repositoryId: string, pullRequestId: number) {
    const [pr, changes, comments, workItems] = await Promise.all([
      this.pullRequests.getPullRequest(repositoryId, pullRequestId),
      this.pullRequests.getPullRequestChanges(repositoryId, pullRequestId),
      this.pullRequests.getPullRequestComments(repositoryId, pullRequestId),
      this.pullRequests.getWorkItemsLinkedToPullRequest(repositoryId, pullRequestId)
    ]);

    return {
      pullRequest: pr,
      changes: changes.changes,
      iterations: changes.iterations,
      comments,
      linkedWorkItems: workItems
    };
  }

  /**
   * Get all my work items organized by status
   */
  async getMyWorkItemsDashboard(userEmail?: string) {
    const workItems = await this.workItems.getWorkItemsAssignedToUser(userEmail);

    const dashboard = {
      active: [] as typeof workItems,
      inProgress: [] as typeof workItems,
      new: [] as typeof workItems,
      resolved: [] as typeof workItems,
      other: [] as typeof workItems
    };

    for (const wi of workItems) {
      const state = wi.fields['System.State'];
      switch (state) {
        case 'Active':
          dashboard.active.push(wi);
          break;
        case 'In Progress':
          dashboard.inProgress.push(wi);
          break;
        case 'New':
          dashboard.new.push(wi);
          break;
        case 'Resolved':
          dashboard.resolved.push(wi);
          break;
        default:
          dashboard.other.push(wi);
      }
    }

    return dashboard;
  }

  /**
   * Get configuration
   */
  getConfig(): AzureDevOpsConfig {
    return { ...this.config };
  }
}