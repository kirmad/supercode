/**
 * Service for fetching and managing related ADO data (parent tasks, child tasks, and linked PRs)
 */

import { ADOSourceService } from './ADOSourceService'

export interface RelatedTask {
  id: number
  title: string
  state: string
  type?: string
  url?: string
}

export interface RelatedPullRequest {
  pullRequestId: number
  title: string
  status: string
  repository?: string
  url?: string
}

export interface WorkItemRelatedData {
  parentTask?: RelatedTask
  childTasks: RelatedTask[]
  linkedPullRequests: RelatedPullRequest[]
}

export class ADORelatedDataService {
  private adoService: ADOSourceService
  private cachedData: Map<number, WorkItemRelatedData> = new Map()

  constructor(adoService: ADOSourceService) {
    this.adoService = adoService
  }

  /**
   * Get all related data for a work item
   */
  public async getWorkItemRelatedData(workItemId: number): Promise<WorkItemRelatedData> {
    // Check cache first
    if (this.cachedData.has(workItemId)) {
      const cached = this.cachedData.get(workItemId)!
      console.log(`[ADORelatedDataService] Returning CACHED data for work item ${workItemId}:`, {
        hasParentTask: !!cached.parentTask,
        childTasksCount: cached.childTasks?.length || 0,
        linkedPRsCount: cached.linkedPullRequests?.length || 0
      })
      return cached
    }

    try {
      // Get the complete work item information including relations
      const workItemData = await this.fetchWorkItemWithRelations(workItemId)

      const relatedData: WorkItemRelatedData = {
        parentTask: undefined,
        childTasks: [],
        linkedPullRequests: []
      }

      // Parse relations if they exist
      if (workItemData.relations && Array.isArray(workItemData.relations)) {
        console.log(`[ADORelatedDataService] Processing ${workItemData.relations.length} relations for work item ${workItemId}`)

        // Extract parent work item
        const parentRelation = workItemData.relations.find(
          (r: any) => r.rel === 'System.LinkTypes.Hierarchy-Reverse'
        )

        if (parentRelation) {
          console.log('[ADORelatedDataService] Found parent relation:', parentRelation.url)
          const parentId = this.extractIdFromUrl(parentRelation.url)
          if (parentId) {
            console.log(`[ADORelatedDataService] Fetching parent work item ${parentId}`)
            const parentData = await this.fetchWorkItemBasicInfo(parentId)
            if (parentData) {
              relatedData.parentTask = {
                id: parentId,
                title: parentData.fields['System.Title'] || `Work Item ${parentId}`,
                state: parentData.fields['System.State'] || 'Unknown',
                type: parentData.fields['System.WorkItemType'],
                url: parentData._links?.html?.href
              }
              console.log('[ADORelatedDataService] Parent task set:', relatedData.parentTask)
            } else {
              console.log('[ADORelatedDataService] Failed to fetch parent data')
            }
          } else {
            console.log('[ADORelatedDataService] Could not extract parent ID from URL')
          }
        } else {
          console.log('[ADORelatedDataService] No parent relation found')
        }

        // Extract child work items
        const childRelations = workItemData.relations.filter(
          (r: any) => r.rel === 'System.LinkTypes.Hierarchy-Forward'
        )
        for (const childRel of childRelations) {
          const childId = this.extractIdFromUrl(childRel.url)
          if (childId) {
            const childData = await this.fetchWorkItemBasicInfo(childId)
            if (childData) {
              relatedData.childTasks.push({
                id: childId,
                title: childData.fields['System.Title'] || `Work Item ${childId}`,
                state: childData.fields['System.State'] || 'Unknown',
                type: childData.fields['System.WorkItemType'],
                url: childData._links?.html?.href
              })
            }
          }
        }

        // Extract linked pull requests
        const prRelations = workItemData.relations.filter(
          (r: any) => r.rel === 'ArtifactLink' && r.url?.includes('PullRequestId')
        )
        console.log(`[ADORelatedDataService] Found ${prRelations.length} PR relations for work item ${workItemId}`)

        for (const prRel of prRelations) {
          console.log('[ADORelatedDataService] Processing PR relation:', prRel.url)
          const prInfo = this.extractPullRequestInfo(prRel.url)
          if (prInfo) {
            console.log('[ADORelatedDataService] Extracted PR info:', prInfo)
            const prData = await this.fetchPullRequestBasicInfo(prInfo.repositoryId, prInfo.pullRequestId)
            if (prData) {
              const pr = {
                pullRequestId: prInfo.pullRequestId,
                title: prData.title,
                status: prData.status,
                repository: prInfo.repositoryId,
                url: prData._links?.web?.href
              }
              console.log('[ADORelatedDataService] Adding PR to results:', pr)
              relatedData.linkedPullRequests.push(pr)
            } else {
              console.log('[ADORelatedDataService] Failed to fetch PR data for:', prInfo)
            }
          } else {
            console.log('[ADORelatedDataService] Failed to extract PR info from URL:', prRel.url)
          }
        }
      }

      // Log what we're returning
      console.log('[ADORelatedDataService] Returning related data for work item', workItemId, {
        hasParentTask: !!relatedData.parentTask,
        parentTaskId: relatedData.parentTask?.id,
        childTasksCount: relatedData.childTasks.length,
        linkedPRsCount: relatedData.linkedPullRequests.length,
        linkedPRsDetails: relatedData.linkedPullRequests,
        fullData: JSON.stringify(relatedData)
      })

      // Cache the result
      this.cachedData.set(workItemId, relatedData)

      return relatedData
    } catch (error) {
      console.error(`Failed to fetch related data for work item ${workItemId}:`, error)
      return {
        parentTask: undefined,
        childTasks: [],
        linkedPullRequests: []
      }
    }
  }

  /**
   * Fetch work item with relations from Azure DevOps
   */
  private async fetchWorkItemWithRelations(workItemId: number): Promise<any> {
    const credentials = this.getCredentials()
    if (!credentials) {
      throw new Error('ADO credentials not available')
    }

    const url = `https://dev.azure.com/${credentials.organization}/${credentials.project}/_apis/wit/workitems/${workItemId}?$expand=relations&api-version=7.1`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${btoa(':' + credentials.pat)}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch work item ${workItemId}: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Fetch basic work item information
   */
  private async fetchWorkItemBasicInfo(workItemId: number): Promise<any> {
    try {
      const credentials = this.getCredentials()
      if (!credentials) {
        return null
      }

      const url = `https://dev.azure.com/${credentials.organization}/${credentials.project}/_apis/wit/workitems/${workItemId}?api-version=7.1`

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${btoa(':' + credentials.pat)}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        console.warn(`Failed to fetch work item ${workItemId}`)
        return null
      }

      return response.json()
    } catch (error) {
      console.warn(`Error fetching work item ${workItemId}:`, error)
      return null
    }
  }

  /**
   * Fetch basic pull request information
   */
  private async fetchPullRequestBasicInfo(repositoryId: string, pullRequestId: number): Promise<any> {
    try {
      const credentials = this.getCredentials()
      if (!credentials) {
        return null
      }

      const url = `https://dev.azure.com/${credentials.organization}/${credentials.project}/_apis/git/repositories/${repositoryId}/pullrequests/${pullRequestId}?api-version=7.1`

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${btoa(':' + credentials.pat)}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        console.warn(`Failed to fetch PR ${pullRequestId}`)
        return null
      }

      return response.json()
    } catch (error) {
      console.warn(`Error fetching PR ${pullRequestId}:`, error)
      return null
    }
  }

  /**
   * Extract work item ID from relation URL
   */
  private extractIdFromUrl(url: string): number | null {
    const match = url.match(/\/(\d+)$/)
    if (match) {
      return parseInt(match[1])
    }
    return null
  }

  /**
   * Extract pull request information from artifact link URL
   */
  private extractPullRequestInfo(url: string): { repositoryId: string; pullRequestId: number } | null {
    // URL format: vstfs:///Git/PullRequestId/{projectId}%2F{repositoryId}%2F{pullRequestId}
    // Note: projectId and repositoryId are GUIDs that contain hyphens
    // Example: vstfs:///Git/PullRequestId/e54c15f5-9715-4ec8-bf57-43fbd00fe57b%2Fb9087db4-a273-43f3-91db-472c1bfd4c05%2F1270179
    const match = url.match(/PullRequestId\/([a-f0-9-]+)%2F([a-f0-9-]+)%2F(\d+)/i)
    if (match) {
      return {
        repositoryId: match[2],
        pullRequestId: parseInt(match[3])
      }
    }

    // Log warning for debugging if URL contains PullRequestId but doesn't match
    if (url.includes('PullRequestId')) {
      console.warn('[ADORelatedDataService] Failed to extract PR info from URL:', url)
    }

    return null
  }

  /**
   * Get ADO credentials from the service
   */
  private getCredentials(): { organization: string; project: string; pat: string } | null {
    // Access the credentials through the ADO service
    // This is a simplified version - in reality you'd need proper access to the credentials
    const serviceAny = this.adoService as any
    if (serviceAny.credentials) {
      return serviceAny.credentials
    }
    return null
  }

  /**
   * Clear cache for a specific work item or all
   */
  public clearCache(workItemId?: number): void {
    if (workItemId) {
      this.cachedData.delete(workItemId)
    } else {
      this.cachedData.clear()
    }
  }
}