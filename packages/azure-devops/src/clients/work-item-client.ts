/**
 * Azure DevOps Work Item Client
 */

import { AzureDevOpsError } from '../interfaces/index.js';
import type {
  AzureDevOpsConfig,
  WorkItem,
  WiqlQuery,
  WiqlQueryResult,
  WorkItemComment,
  WorkItemType,
  WorkItemUpdateRequest
} from '../interfaces/index.js';

export class WorkItemClient {
  private baseUrl: string;
  private headers: Record<string, string>;
  private apiVersion: string;

  constructor(config: AzureDevOpsConfig) {
    this.baseUrl = `https://dev.azure.com/${config.organization}/${config.project}/_apis`;
    this.apiVersion = config.apiVersion || '7.1';
    this.headers = {
      'Authorization': `Basic ${Buffer.from(`:${config.pat}`).toString('base64')}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  /**
   * Execute a WIQL query to get work item IDs
   */
  private async executeWiqlQuery(query: string): Promise<WiqlQueryResult> {
    const url = `${this.baseUrl}/wit/wiql?api-version=${this.apiVersion}`;
    const wiqlQuery: WiqlQuery = { query };

    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(wiqlQuery)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new AzureDevOpsError(
        `Failed to execute WIQL query: ${error.message || response.statusText}`,
        response.status,
        error
      );
    }

    return response.json();
  }

  /**
   * Get work items by IDs with batching support
   */
  private async getWorkItemsByIds(ids: number[], expand: string = 'all'): Promise<WorkItem[]> {
    if (ids.length === 0) return [];

    const results: WorkItem[] = [];
    const batchSize = 200; // Azure DevOps limit

    for (let i = 0; i < ids.length; i += batchSize) {
      const batchIds = ids.slice(i, i + batchSize);
      const url = `${this.baseUrl}/wit/workitems?ids=${batchIds.join(',')}&$expand=${expand}&api-version=${this.apiVersion}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new AzureDevOpsError(
          `Failed to get work items: ${error.message || response.statusText}`,
          response.status,
          error
        );
      }

      const data = await response.json();
      results.push(...(data.value || []));
    }

    return results;
  }

  /**
   * 1. Get work items assigned to me (or specific user)
   */
  async getWorkItemsAssignedToUser(userEmail?: string): Promise<WorkItem[]> {
    const assignee = userEmail ? `'${userEmail}'` : '@Me';
    const query = `SELECT [System.Id] FROM WorkItems WHERE [System.AssignedTo] = ${assignee} AND [System.State] <> 'Closed' AND [System.State] <> 'Removed' ORDER BY [System.ChangedDate] DESC`;

    const queryResult = await this.executeWiqlQuery(query);
    const ids = queryResult.workItems.map(wi => wi.id);

    return this.getWorkItemsByIds(ids);
  }

  /**
   * 2. Get work items assigned to me with specific tag
   */
  async getWorkItemsWithTag(tag: string, assignedToMe: boolean = false): Promise<WorkItem[]> {
    let query = `SELECT [System.Id] FROM WorkItems WHERE [System.Tags] CONTAINS '${tag}'`;

    if (assignedToMe) {
      query += ` AND [System.AssignedTo] = @Me`;
    }

    query += ` AND [System.State] <> 'Closed' AND [System.State] <> 'Removed' ORDER BY [System.ChangedDate] DESC`;

    const queryResult = await this.executeWiqlQuery(query);
    const ids = queryResult.workItems.map(wi => wi.id);

    return this.getWorkItemsByIds(ids);
  }

  /**
   * 3. Get work item details with summary and discussion
   */
  async getWorkItemDetails(workItemId: number): Promise<{
    workItem: WorkItem;
    comments: WorkItemComment[];
  }> {
    // Get work item with relations (not using $expand=all which may cause issues)
    const workItemUrl = `${this.baseUrl}/wit/workitems/${workItemId}?$expand=relations&api-version=${this.apiVersion}`;

    const workItemResponse = await fetch(workItemUrl, {
      method: 'GET',
      headers: this.headers
    });

    if (!workItemResponse.ok) {
      const error = await workItemResponse.json().catch(() => ({ message: 'Unknown error' }));
      throw new AzureDevOpsError(
        `Failed to get work item details: ${error.message || workItemResponse.statusText}`,
        workItemResponse.status,
        error
      );
    }

    const workItem = await workItemResponse.json();

    // Get comments (discussion)
    const comments = await this.getWorkItemComments(workItemId);

    return {
      workItem,
      comments
    };
  }

  /**
   * Get work item comments/discussion
   */
  async getWorkItemComments(workItemId: number): Promise<WorkItemComment[]> {
    // Try to get comments using the updates API instead since comments API requires preview
    // and might not be available in all environments
    try {
      const params = new URLSearchParams({
        'api-version': this.apiVersion
      });

      const url = `${this.baseUrl}/wit/workitems/${workItemId}/updates?${params}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers
      });

      if (!response.ok) {
        // If updates API fails, return empty array instead of throwing
        console.warn(`Could not fetch comments for work item ${workItemId}`);
        return [];
      }

      const data = await response.json();
      const comments: WorkItemComment[] = [];

      // Convert updates to comments format
      if (data.value && Array.isArray(data.value)) {
        for (const update of data.value) {
          if (update.fields?.['System.History']) {
            comments.push({
              id: update.id,
              workItemId: workItemId,
              text: update.fields['System.History'].newValue || '',
              url: `${this.baseUrl}/wit/workitems/${workItemId}/updates/${update.id}`,
              createdBy: {
                displayName: update.revisedBy?.displayName || 'Unknown',
                uniqueName: update.revisedBy?.uniqueName || '',
                id: update.revisedBy?.id || '',
                imageUrl: update.revisedBy?.imageUrl || ''
              },
              createdDate: update.revisedDate || new Date().toISOString(),
              modifiedBy: update.revisedBy || {
                displayName: 'Unknown',
                uniqueName: '',
                id: '',
                imageUrl: ''
              },
              modifiedDate: update.revisedDate || new Date().toISOString()
            });
          }
        }
      }

      return comments;
    } catch (error: any) {
      console.warn(`Failed to get comments for work item ${workItemId}:`, error.message);
      return [];
    }
  }

  /**
   * 4. Get work item type
   */
  async getWorkItemType(workItemTypeName: string): Promise<WorkItemType> {
    const url = `${this.baseUrl}/wit/workitemtypes/${encodeURIComponent(workItemTypeName)}?api-version=${this.apiVersion}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new AzureDevOpsError(
        `Failed to get work item type: ${error.message || response.statusText}`,
        response.status,
        error
      );
    }

    return response.json();
  }

  /**
   * 5. Get parent and related work items
   */
  async getRelatedWorkItems(workItemId: number): Promise<{
    parent?: WorkItem;
    children: WorkItem[];
    related: WorkItem[];
    linkedPRs: string[];
  }> {
    // Get work item with relations
    const workItemUrl = `${this.baseUrl}/wit/workitems/${workItemId}?$expand=relations&api-version=${this.apiVersion}`;

    const response = await fetch(workItemUrl, {
      method: 'GET',
      headers: this.headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new AzureDevOpsError(
        `Failed to get related work items: ${error.message || response.statusText}`,
        response.status,
        error
      );
    }

    const workItem: WorkItem = await response.json();

    if (!workItem.relations || workItem.relations.length === 0) {
      return {
        parent: undefined,
        children: [],
        related: [],
        linkedPRs: []
      };
    }

    const parentRelations = workItem.relations.filter(r =>
      r.rel === 'System.LinkTypes.Hierarchy-Reverse'
    );

    const childRelations = workItem.relations.filter(r =>
      r.rel === 'System.LinkTypes.Hierarchy-Forward'
    );

    const relatedRelations = workItem.relations.filter(r =>
      r.rel === 'System.LinkTypes.Related'
    );

    const pullRequestRelations = workItem.relations.filter(r =>
      r.rel === 'ArtifactLink' && r.url?.includes('pullrequest')
    );

    // Extract work item IDs from relations
    const extractIdFromUrl = (url: string): number | null => {
      const match = url.match(/workItems\/(\d+)/);
      return match ? parseInt(match[1]) : null;
    };

    const parentIds = parentRelations
      .map(r => extractIdFromUrl(r.url))
      .filter((id): id is number => id !== null);

    const childIds = childRelations
      .map(r => extractIdFromUrl(r.url))
      .filter((id): id is number => id !== null);

    const relatedIds = relatedRelations
      .map(r => extractIdFromUrl(r.url))
      .filter((id): id is number => id !== null);

    // Fetch all related work items
    const [parentItems, childItems, relatedItems] = await Promise.all([
      parentIds.length > 0 ? this.getWorkItemsByIds(parentIds) : [],
      childIds.length > 0 ? this.getWorkItemsByIds(childIds) : [],
      relatedIds.length > 0 ? this.getWorkItemsByIds(relatedIds) : []
    ]);

    return {
      parent: parentItems[0],
      children: childItems,
      related: relatedItems,
      linkedPRs: pullRequestRelations.map(r => r.url)
    };
  }

  /**
   * 11. Update work item
   */
  async updateWorkItem(
    workItemId: number,
    updates: WorkItemUpdateRequest[]
  ): Promise<WorkItem> {
    const url = `${this.baseUrl}/wit/workitems/${workItemId}?api-version=${this.apiVersion}`;

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        ...this.headers,
        'Content-Type': 'application/json-patch+json'
      },
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new AzureDevOpsError(
        `Failed to update work item: ${error.message || response.statusText}`,
        response.status,
        error
      );
    }

    return response.json();
  }

  /**
   * Helper method to update common fields
   */
  async updateWorkItemFields(
    workItemId: number,
    fields: Partial<{
      title: string;
      description: string;
      assignedTo: string;
      state: string;
      tags: string;
      priority: number;
      areaPath: string;
      iterationPath: string;
      [key: string]: any;
    }>
  ): Promise<WorkItem> {
    const updates: WorkItemUpdateRequest[] = [];

    if (fields.title !== undefined) {
      updates.push({
        op: 'replace',
        path: '/fields/System.Title',
        value: fields.title
      });
    }

    if (fields.description !== undefined) {
      updates.push({
        op: 'replace',
        path: '/fields/System.Description',
        value: fields.description
      });
    }

    if (fields.assignedTo !== undefined) {
      updates.push({
        op: 'replace',
        path: '/fields/System.AssignedTo',
        value: fields.assignedTo
      });
    }

    if (fields.state !== undefined) {
      updates.push({
        op: 'replace',
        path: '/fields/System.State',
        value: fields.state
      });
    }

    if (fields.tags !== undefined) {
      updates.push({
        op: 'replace',
        path: '/fields/System.Tags',
        value: fields.tags
      });
    }

    if (fields.priority !== undefined) {
      updates.push({
        op: 'replace',
        path: '/fields/Microsoft.VSTS.Common.Priority',
        value: fields.priority
      });
    }

    if (fields.areaPath !== undefined) {
      updates.push({
        op: 'replace',
        path: '/fields/System.AreaPath',
        value: fields.areaPath
      });
    }

    if (fields.iterationPath !== undefined) {
      updates.push({
        op: 'replace',
        path: '/fields/System.IterationPath',
        value: fields.iterationPath
      });
    }

    // Add any custom fields
    Object.keys(fields).forEach(key => {
      if (!['title', 'description', 'assignedTo', 'state', 'tags', 'priority', 'areaPath', 'iterationPath'].includes(key)) {
        updates.push({
          op: 'replace',
          path: `/fields/${key}`,
          value: fields[key]
        });
      }
    });

    return this.updateWorkItem(workItemId, updates);
  }

  /**
   * Add a comment to a work item
   */
  async addWorkItemComment(workItemId: number, comment: string): Promise<WorkItemComment> {
    const url = `${this.baseUrl}/wit/workitems/${workItemId}/comments?api-version=${this.apiVersion}-preview.3`;

    const response = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ text: comment })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new AzureDevOpsError(
        `Failed to add work item comment: ${error.message || response.statusText}`,
        response.status,
        error
      );
    }

    return response.json();
  }

  /**
   * Add a relation to a work item (e.g., link to PR, parent/child)
   */
  async addWorkItemRelation(
    workItemId: number,
    relationType: string,
    targetUrl: string,
    comment?: string
  ): Promise<WorkItem> {
    const updates: WorkItemUpdateRequest[] = [{
      op: 'add',
      path: '/relations/-',
      value: {
        rel: relationType,
        url: targetUrl,
        attributes: comment ? { comment } : undefined
      }
    }];

    return this.updateWorkItem(workItemId, updates);
  }
}