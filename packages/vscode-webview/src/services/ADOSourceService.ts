/**
 * Azure DevOps Source Service for managing work items and pull requests
 */

// Browser-compatible Azure DevOps API implementation
// The npm package uses Node.js Buffer which doesn't work in browser
// Note: WorkItemContextGenerator from @supercode/azure-devops cannot be used directly
// in browser environment due to Node.js dependencies

interface AzureDevOpsConfig {
  organization: string;
  project: string;
  pat: string;
}

interface WorkItem {
  id: number;
  fields: Record<string, any>;
  _links?: {
    html?: {
      href?: string;
    };
  };
}

interface PullRequest {
  pullRequestId: number;
  title: string;
  description?: string;
  status: string;
  createdBy?: {
    displayName?: string;
  };
  creationDate: string;
  targetRefName: string;
  sourceRefName: string;
  _links?: {
    web?: {
      href?: string;
    };
  };
}

interface WorkItemDetails {
  workItem: WorkItem;
  parentWorkItem?: WorkItem;
  childWorkItems?: WorkItem[];
  linkedPullRequests?: Array<{
    pullRequestId: number;
    title: string;
    status: string;
  }>;
  comments?: Array<{
    revisedBy?: {
      displayName?: string;
    };
    revisedDate: string;
    text: string;
  }>;
}

interface PullRequestDetails {
  pullRequest: PullRequest;
  linkedWorkItems?: Array<{
    id: number;
    title: string;
  }>;
  changes?: Array<{
    changeType: string;
    item?: {
      path?: string;
    };
  }>;
  comments?: {
    threads?: Array<{
      comments?: Array<{
        author?: {
          displayName?: string;
        };
        content: string;
      }>;
    }>;
  };
}

// Browser-compatible Azure DevOps client
class AzureDevOpsClient {
  private baseUrl: string;
  private headers: Record<string, string>;
  private apiVersion: string = '7.1';
  public workItems: {
    getWorkItemsAssignedToUser(userEmail?: string): Promise<WorkItem[]>;
  };

  constructor(private config: AzureDevOpsConfig) {
    this.baseUrl = `https://dev.azure.com/${config.organization}/${config.project}/_apis`;

    // Browser-compatible base64 encoding for Basic auth
    const authString = `:${config.pat}`;
    const base64Auth = btoa(authString);

    this.headers = {
      'Authorization': `Basic ${base64Auth}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // Initialize workItems namespace
    this.workItems = {
      getWorkItemsAssignedToUser: this.getWorkItemsAssignedToUser.bind(this)
    };
  }

  private async getWorkItemsAssignedToUser(userEmail?: string): Promise<WorkItem[]> {
    console.log('[AzureDevOpsClient] getWorkItemsAssignedToUser called, userEmail:', userEmail);

    const assignee = userEmail ? `'${userEmail}'` : '@Me';
    const query = `SELECT [System.Id] FROM WorkItems WHERE [System.AssignedTo] = ${assignee} AND [System.State] <> 'Closed' AND [System.State] <> 'Removed' ORDER BY [System.ChangedDate] DESC`;

    // Execute WIQL query
    const wiqlUrl = `${this.baseUrl}/wit/wiql?api-version=${this.apiVersion}`;
    console.log('[AzureDevOpsClient] Executing WIQL query to:', wiqlUrl);

    try {
      const wiqlResponse = await fetch(wiqlUrl, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ query })
      });

      console.log('[AzureDevOpsClient] WIQL response status:', wiqlResponse.status);

      if (!wiqlResponse.ok) {
        const error = await wiqlResponse.text();
        console.error('[AzureDevOpsClient] WIQL query failed:', error);
        throw new Error(`Failed to execute WIQL query: ${wiqlResponse.statusText}`);
      }

      const queryResult = await wiqlResponse.json();
      console.log('[AzureDevOpsClient] WIQL result, work item count:', queryResult.workItems?.length || 0);

      if (!queryResult.workItems || queryResult.workItems.length === 0) {
        return [];
      }

      // Get work item details
      const ids = queryResult.workItems.map((wi: any) => wi.id);
      const workItemsUrl = `${this.baseUrl}/wit/workitems?ids=${ids.join(',')}&$expand=all&api-version=${this.apiVersion}`;
      console.log('[AzureDevOpsClient] Fetching work items from:', workItemsUrl);

      const workItemsResponse = await fetch(workItemsUrl, {
        method: 'GET',
        headers: this.headers
      });

      console.log('[AzureDevOpsClient] Work items response status:', workItemsResponse.status);

      if (!workItemsResponse.ok) {
        const error = await workItemsResponse.text();
        console.error('[AzureDevOpsClient] Failed to get work items:', error);
        throw new Error(`Failed to get work items: ${workItemsResponse.statusText}`);
      }

      const result = await workItemsResponse.json();
      console.log('[AzureDevOpsClient] Retrieved work items:', result.value?.length || 0);
      return result.value || [];
    } catch (error) {
      console.error('[AzureDevOpsClient] Error in getWorkItemsAssignedToUser:', error);
      throw error;
    }
  }

  async getCompleteWorkItemInfo(workItemId: number): Promise<WorkItemDetails> {
    // Simplified implementation for browser
    const url = `${this.baseUrl}/wit/workitems/${workItemId}?$expand=all&api-version=${this.apiVersion}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers
    });

    if (!response.ok) {
      throw new Error(`Failed to get work item ${workItemId}: ${response.statusText}`);
    }

    const workItem = await response.json();

    return {
      workItem,
      // These would require additional API calls in a real implementation
      parentWorkItem: undefined,
      childWorkItems: [],
      linkedPullRequests: [],
      comments: []
    };
  }

  async getCompletePullRequestInfo(repositoryId: string, pullRequestId: number): Promise<PullRequestDetails> {
    // Simplified implementation for browser
    const url = `${this.baseUrl}/git/repositories/${repositoryId}/pullrequests/${pullRequestId}?api-version=${this.apiVersion}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.headers
    });

    if (!response.ok) {
      throw new Error(`Failed to get pull request ${pullRequestId}: ${response.statusText}`);
    }

    const pullRequest = await response.json();

    return {
      pullRequest,
      // These would require additional API calls in a real implementation
      linkedWorkItems: [],
      changes: [],
      comments: undefined
    };
  }
}

export interface ADOSource {
  id: string;
  type: 'workitem' | 'pullrequest';
  title: string;
  description?: string;
  url: string;
  state?: string;
  assignedTo?: string;
  metadata: {
    workItemId?: number;
    pullRequestId?: number;
    repositoryId?: string;
    fields?: Record<string, any>;
    author?: string;
    createdDate?: string;
    targetBranch?: string;
    sourceBranch?: string;
  };
  content?: string; // Full context for prompt enrichment
}

export interface ADOCredentials {
  organization?: string;
  project?: string;
  pat?: string;
}

export class ADOSourceService {
  private client: AzureDevOpsClient | null = null;
  public credentials: ADOCredentials = {};
  private cachedSources: Map<string, ADOSource> = new Map();
  private isInitialized: boolean = false;

  constructor() {
    // Try to load credentials from environment or config
    this.loadCredentials();
  }

  /**
   * Load credentials from environment variables or config
   */
  private loadCredentials(): void {
    // Try to load from our config helper
    try {
      // Dynamic import to avoid circular dependencies
      import('../config/ado.config').then(({ getADOCredentials }) => {
        const creds = getADOCredentials();
        if (creds.organization || creds.project || creds.pat) {
          this.credentials = creds;
          console.log('[ADOSourceService] Loaded credentials from config:', {
            hasOrg: !!creds.organization,
            hasProject: !!creds.project,
            hasPat: !!creds.pat
          });
        }
      }).catch(err => {
        console.warn('[ADOSourceService] Failed to load config:', err);
      });
    } catch (e) {
      console.warn('[ADOSourceService] Could not load credentials from config:', e);
    }

    // Fallback to process.env if available
    if (typeof process !== 'undefined' && process.env) {
      this.credentials = {
        organization: process.env.VSCODE_ADO_ORG || process.env.AZURE_DEVOPS_ORG || this.credentials.organization,
        project: process.env.VSCODE_ADO_PROJECT || process.env.AZURE_DEVOPS_PROJECT || this.credentials.project,
        pat: process.env.VSCODE_ADO_PAT || process.env.AZURE_DEVOPS_PAT || this.credentials.pat
      };
    }
  }

  /**
   * Initialize the Azure DevOps client with provided credentials
   */
  public async initialize(credentials?: ADOCredentials): Promise<void> {
    console.log('[ADOSourceService] Initialize called with credentials:', {
      hasCredentials: !!credentials,
      hasOrg: !!credentials?.organization,
      hasProject: !!credentials?.project,
      hasPat: !!credentials?.pat
    });

    if (credentials) {
      this.credentials = { ...this.credentials, ...credentials };
    }

    if (!this.credentials.organization || !this.credentials.project || !this.credentials.pat) {
      console.error('[ADOSourceService] Missing credentials:', {
        hasOrg: !!this.credentials.organization,
        hasProject: !!this.credentials.project,
        hasPat: !!this.credentials.pat
      });
      throw new Error('Azure DevOps credentials not configured. Please provide organization, project, and PAT.');
    }

    const config: AzureDevOpsConfig = {
      organization: this.credentials.organization,
      project: this.credentials.project,
      pat: this.credentials.pat
    };

    console.log('[ADOSourceService] Creating AzureDevOpsClient with config:', {
      organization: config.organization,
      project: config.project,
      hasPat: !!config.pat
    });

    this.client = new AzureDevOpsClient(config);
    this.isInitialized = true;
    console.log('[ADOSourceService] Client initialized successfully');
  }

  /**
   * Check if the service is initialized
   */
  public isReady(): boolean {
    return this.isInitialized && this.client !== null;
  }

  /**
   * Get work items assigned to the current user
   */
  public async getMyWorkItems(userEmail?: string): Promise<ADOSource[]> {
    console.log('[ADOSourceService] getMyWorkItems called, userEmail:', userEmail);

    if (!this.client) {
      console.error('[ADOSourceService] Client not initialized');
      throw new Error('ADO client not initialized. Call initialize() first.');
    }

    console.log('[ADOSourceService] Client exists, calling getWorkItemsAssignedToUser...');

    try {
      console.log('[ADOSourceService] Making API call to Azure DevOps...');
      const workItems = await this.client.workItems.getWorkItemsAssignedToUser(userEmail);

      console.log('[ADOSourceService] API response received, work items count:', workItems?.length || 0);

      return workItems.map((wi: WorkItem) => {
        const source: ADOSource = {
          id: `wi-${wi.id}`,
          type: 'workitem',
          title: wi.fields['System.Title'] || `Work Item ${wi.id}`,
          description: wi.fields['System.Description'],
          url: wi._links?.html?.href || this.getWorkItemUrl(wi.id),
          state: wi.fields['System.State'],
          assignedTo: wi.fields['System.AssignedTo']?.displayName,
          metadata: {
            workItemId: wi.id,
            fields: wi.fields,
            createdDate: wi.fields['System.CreatedDate']
          }
        };

        this.cachedSources.set(source.id, source);
        return source;
      });
    } catch (error) {
      console.error('Failed to fetch work items:', error);
      throw new Error(`Failed to fetch work items: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get a specific work item by ID
   */
  public async getWorkItem(workItemId: number): Promise<ADOSource> {
    if (!this.client) {
      throw new Error('ADO client not initialized. Call initialize() first.');
    }

    const cacheKey = `wi-${workItemId}`;
    if (this.cachedSources.has(cacheKey)) {
      return this.cachedSources.get(cacheKey)!;
    }

    try {
      const details = await this.getCompleteWorkItemInfoWithContext(workItemId);

      // Generate enhanced context content for the work item
      const content = this.generateEnhancedWorkItemContext(details);

      const source: ADOSource = {
        id: cacheKey,
        type: 'workitem',
        title: details.workItem.fields['System.Title'] || `Work Item ${workItemId}`,
        description: details.workItem.fields['System.Description'],
        url: details.workItem._links?.html?.href || this.getWorkItemUrl(workItemId),
        state: details.workItem.fields['System.State'],
        assignedTo: details.workItem.fields['System.AssignedTo']?.displayName,
        metadata: {
          workItemId,
          fields: details.workItem.fields,
          createdDate: details.workItem.fields['System.CreatedDate']
        },
        content
      };

      this.cachedSources.set(cacheKey, source);
      return source;
    } catch (error) {
      console.error(`Failed to fetch work item ${workItemId}:`, error);
      throw new Error(`Failed to fetch work item ${workItemId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get complete work item info with parent and related context
   */
  private async getCompleteWorkItemInfoWithContext(workItemId: number): Promise<WorkItemDetails> {
    if (!this.client) {
      throw new Error('ADO client not initialized.');
    }

    // Get the main work item
    const workItemDetails = await this.client.getCompleteWorkItemInfo(workItemId);

    // Try to fetch parent work item if there's a parent relation
    const parentRelation = workItemDetails.workItem.relations?.find(
      (r: any) => r.rel === 'System.LinkTypes.Hierarchy-Reverse'
    );

    if (parentRelation?.url) {
      try {
        const parentId = parseInt(parentRelation.url.split('/').pop());
        if (!isNaN(parentId)) {
          const parentResponse = await fetch(
            `https://dev.azure.com/${this.credentials.organization}/${this.credentials.project}/_apis/wit/workitems/${parentId}?api-version=7.1`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Basic ${btoa(':' + this.credentials.pat!)}`,
                'Content-Type': 'application/json'
              }
            }
          );
          if (parentResponse.ok) {
            workItemDetails.parentWorkItem = await parentResponse.json();
          }
        }
      } catch (e) {
        console.warn('Failed to fetch parent work item:', e);
      }
    }

    // Try to fetch child work items
    const childRelations = workItemDetails.workItem.relations?.filter(
      (r: any) => r.rel === 'System.LinkTypes.Hierarchy-Forward'
    ) || [];

    workItemDetails.childWorkItems = [];
    for (const childRelation of childRelations.slice(0, 5)) { // Limit to 5 children
      try {
        const childId = parseInt(childRelation.url.split('/').pop());
        if (!isNaN(childId)) {
          const childResponse = await fetch(
            `https://dev.azure.com/${this.credentials.organization}/${this.credentials.project}/_apis/wit/workitems/${childId}?api-version=7.1`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Basic ${btoa(':' + this.credentials.pat!)}`,
                'Content-Type': 'application/json'
              }
            }
          );
          if (childResponse.ok) {
            workItemDetails.childWorkItems.push(await childResponse.json());
          }
        }
      } catch (e) {
        console.warn('Failed to fetch child work item:', e);
      }
    }

    // Try to fetch linked pull requests
    const prRelations = workItemDetails.workItem.relations?.filter(
      (r: any) => r.rel === 'ArtifactLink' && r.url?.includes('PullRequestId')
    ) || [];

    workItemDetails.linkedPullRequests = [];
    for (const prRelation of prRelations.slice(0, 3)) { // Limit to 3 PRs
      try {
        // Extract PR info from the URL
        const matches = prRelation.url.match(/PullRequestId\/[^%]+%2F([^%]+)%2F(\d+)/);
        if (matches) {
          const repoId = matches[1];
          const prId = parseInt(matches[2]);

          const prResponse = await fetch(
            `https://dev.azure.com/${this.credentials.organization}/${this.credentials.project}/_apis/git/repositories/${repoId}/pullrequests/${prId}?api-version=7.1`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Basic ${btoa(':' + this.credentials.pat!)}`,
                'Content-Type': 'application/json'
              }
            }
          );

          if (prResponse.ok) {
            const pr = await prResponse.json();
            workItemDetails.linkedPullRequests.push({
              pullRequestId: pr.pullRequestId,
              title: pr.title,
              status: pr.status
            });
          }
        }
      } catch (e) {
        console.warn('Failed to fetch linked PR:', e);
      }
    }

    return workItemDetails;
  }

  /**
   * Get a pull request by URL or ID
   */
  public async getPullRequest(identifier: string): Promise<ADOSource> {
    if (!this.client) {
      throw new Error('ADO client not initialized. Call initialize() first.');
    }

    // Parse identifier - could be URL or "repoId/prId"
    const { repositoryId, pullRequestId } = this.parsePullRequestIdentifier(identifier);

    const cacheKey = `pr-${repositoryId}-${pullRequestId}`;
    if (this.cachedSources.has(cacheKey)) {
      return this.cachedSources.get(cacheKey)!;
    }

    try {
      const details = await this.client.getCompletePullRequestInfo(repositoryId, pullRequestId);

      // Generate context content for the PR
      const content = this.generatePullRequestContext(details);

      const source: ADOSource = {
        id: cacheKey,
        type: 'pullrequest',
        title: details.pullRequest.title,
        description: details.pullRequest.description,
        url: details.pullRequest._links?.web?.href || this.getPullRequestUrl(repositoryId, pullRequestId),
        state: details.pullRequest.status,
        metadata: {
          pullRequestId,
          repositoryId,
          author: details.pullRequest.createdBy?.displayName,
          createdDate: details.pullRequest.creationDate,
          targetBranch: details.pullRequest.targetRefName,
          sourceBranch: details.pullRequest.sourceRefName
        },
        content
      };

      this.cachedSources.set(cacheKey, source);
      return source;
    } catch (error) {
      console.error(`Failed to fetch pull request ${identifier}:`, error);
      throw new Error(`Failed to fetch pull request ${identifier}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Parse a pull request identifier (URL or ID format)
   */
  private parsePullRequestIdentifier(identifier: string): { repositoryId: string; pullRequestId: number } {
    // Check if it's a URL
    if (identifier.includes('pullrequest/')) {
      const prIdMatch = identifier.match(/pullrequest\/(\d+)/);
      if (prIdMatch) {
        const pullRequestId = parseInt(prIdMatch[1]);
        // Extract repository ID from URL if possible
        const repoMatch = identifier.match(/_git\/([^\/]+)/);
        const repositoryId = repoMatch ? repoMatch[1] : this.credentials.project!;
        return { repositoryId, pullRequestId };
      }
    }

    // Check if it's in "repoId/prId" format
    if (identifier.includes('/')) {
      const [repositoryId, prIdStr] = identifier.split('/');
      return { repositoryId, pullRequestId: parseInt(prIdStr) };
    }

    // Assume it's just a PR ID for the default project
    return {
      repositoryId: this.credentials.project!,
      pullRequestId: parseInt(identifier)
    };
  }

  /**
   * Generate context content for a work item (for backwards compatibility)
   */
  private generateWorkItemContext(details: WorkItemDetails): string {
    return this.generateEnhancedWorkItemContext(details);
  }

  /**
   * Generate enhanced context content for a work item including parent and related items
   */
  private generateEnhancedWorkItemContext(details: WorkItemDetails): string {
    const sections = [
      `# Work Item ${details.workItem.id}: ${details.workItem.fields['System.Title']}`,
      '',
      '## Details',
      `- **Type**: ${details.workItem.fields['System.WorkItemType']}`,
      `- **State**: ${details.workItem.fields['System.State']}`,
      `- **Assigned To**: ${details.workItem.fields['System.AssignedTo']?.displayName || 'Unassigned'}`,
      `- **Priority**: ${details.workItem.fields['Microsoft.VSTS.Common.Priority'] || 'Not set'}`,
      `- **Area Path**: ${details.workItem.fields['System.AreaPath']}`,
      `- **Iteration Path**: ${details.workItem.fields['System.IterationPath']}`,
      ''
    ];

    // Add description
    if (details.workItem.fields['System.Description']) {
      sections.push('## Description');
      sections.push(details.workItem.fields['System.Description']);
      sections.push('');
    }

    // Add acceptance criteria
    if (details.workItem.fields['Microsoft.VSTS.Common.AcceptanceCriteria']) {
      sections.push('## Acceptance Criteria');
      sections.push(details.workItem.fields['Microsoft.VSTS.Common.AcceptanceCriteria']);
      sections.push('');
    }

    // Add parent work item
    if (details.parentWorkItem) {
      sections.push('## Parent Work Item');
      sections.push(`- ${details.parentWorkItem.fields['System.Title']} (${details.parentWorkItem.fields['System.State']})`);
      sections.push('');
    }

    // Add child work items
    if (details.childWorkItems && details.childWorkItems.length > 0) {
      sections.push('## Child Work Items');
      details.childWorkItems.forEach((child: WorkItem) => {
        sections.push(`- ${child.fields['System.Title']} (${child.fields['System.State']})`);
      });
      sections.push('');
    }

    // Add linked PRs
    if (details.linkedPullRequests && details.linkedPullRequests.length > 0) {
      sections.push('## Linked Pull Requests');
      details.linkedPullRequests.forEach((pr: any) => {
        sections.push(`- PR #${pr.pullRequestId}: ${pr.title} (${pr.status})`);
      });
      sections.push('');
    }

    // Add comments
    if (details.comments && details.comments.length > 0) {
      sections.push('## Recent Comments');
      details.comments.slice(0, 3).forEach((comment: any) => {
        sections.push(`**${comment.revisedBy?.displayName}** (${new Date(comment.revisedDate).toLocaleDateString()}):`);
        sections.push(comment.text);
        sections.push('');
      });
    }

    return sections.join('\n');
  }

  /**
   * Generate context content for a pull request
   */
  private generatePullRequestContext(details: PullRequestDetails): string {
    const sections = [
      `# Pull Request #${details.pullRequest.pullRequestId}: ${details.pullRequest.title}`,
      '',
      '## Details',
      `- **Author**: ${details.pullRequest.createdBy?.displayName}`,
      `- **Status**: ${details.pullRequest.status}`,
      `- **Source Branch**: ${details.pullRequest.sourceRefName?.replace('refs/heads/', '')}`,
      `- **Target Branch**: ${details.pullRequest.targetRefName?.replace('refs/heads/', '')}`,
      `- **Created**: ${new Date(details.pullRequest.creationDate).toLocaleDateString()}`,
      ''
    ];

    // Add description
    if (details.pullRequest.description) {
      sections.push('## Description');
      sections.push(details.pullRequest.description);
      sections.push('');
    }

    // Add linked work items
    if (details.linkedWorkItems && details.linkedWorkItems.length > 0) {
      sections.push('## Linked Work Items');
      details.linkedWorkItems.forEach((wi: any) => {
        sections.push(`- ${wi.id}: ${wi.title}`);
      });
      sections.push('');
    }

    // Add changed files summary
    if (details.changes && details.changes.length > 0) {
      sections.push('## Changed Files');
      sections.push(`Total: ${details.changes.length} files`);

      // Group by change type
      const added = details.changes.filter((c: any) => c.changeType === 'add').length;
      const modified = details.changes.filter((c: any) => c.changeType === 'edit').length;
      const deleted = details.changes.filter((c: any) => c.changeType === 'delete').length;

      if (added > 0) sections.push(`- Added: ${added} files`);
      if (modified > 0) sections.push(`- Modified: ${modified} files`);
      if (deleted > 0) sections.push(`- Deleted: ${deleted} files`);
      sections.push('');

      // List first 10 files
      sections.push('### File List (first 10):');
      details.changes.slice(0, 10).forEach((change: any) => {
        sections.push(`- ${change.item?.path} (${change.changeType})`);
      });
      sections.push('');
    }

    // Add recent comments
    if (details.comments && details.comments.threads && details.comments.threads.length > 0) {
      sections.push('## Recent Comments');
      details.comments.threads.slice(0, 3).forEach((thread: any) => {
        if (thread.comments?.length > 0) {
          const firstComment = thread.comments[0];
          sections.push(`**${firstComment.author?.displayName}**:`);
          sections.push(firstComment.content);
          sections.push('');
        }
      });
    }

    return sections.join('\n');
  }

  /**
   * Generate work item URL
   */
  private getWorkItemUrl(workItemId: number): string {
    return `https://dev.azure.com/${this.credentials.organization}/${this.credentials.project}/_workitems/edit/${workItemId}`;
  }

  /**
   * Generate pull request URL
   */
  private getPullRequestUrl(repositoryId: string, pullRequestId: number): string {
    return `https://dev.azure.com/${this.credentials.organization}/${this.credentials.project}/_git/${repositoryId}/pullrequest/${pullRequestId}`;
  }

  /**
   * Clear cached sources
   */
  public clearCache(): void {
    this.cachedSources.clear();
  }

  /**
   * Get all cached sources
   */
  public getCachedSources(): ADOSource[] {
    return Array.from(this.cachedSources.values());
  }

  /**
   * Remove a source from cache
   */
  public removeSource(sourceId: string): void {
    this.cachedSources.delete(sourceId);
  }
}