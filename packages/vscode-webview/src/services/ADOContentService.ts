/**
 * ADO Content Service - Constructs detailed content for work items and pull requests
 * Based on selected items and their related items
 */

import { ADOSourceService, type ADOSource } from './ADOSourceService'
import { htmlToMarkdown } from '../utils/htmlToMarkdown'

export interface WorkItemContent {
  id: number
  title: string
  description: string
  state: string
  type: string
  assignedTo?: string
  priority?: string
  severity?: string
  tags?: string
  acceptanceCriteria?: string
  comments?: Array<{
    author: string
    date: string
    text: string
  }>
}

export interface PullRequestContent {
  id: number
  title: string
  description: string
  status: string
  repository: string
  author: string
  createdDate: string
  sourceBranch: string
  targetBranch: string
  commits?: Array<{
    id: string
    message: string
    author: string
  }>
  changedFiles?: Array<{
    path: string
    changeType: string
  }>
  fileDiffs?: Record<string, string>
  comments?: Array<{
    author: string
    content: string
  }>
}

export interface SelectedItems {
  parentTask?: { id: number; title: string; state: string }
  tasks: Array<{ id: number; title: string; state: string }>
  prs: Array<{ pullRequestId: number; title: string; status: string }>
}

export class ADOContentService {
  private adoService: ADOSourceService
  private baseUrl: string
  private headers: Record<string, string>

  constructor(adoService: ADOSourceService) {
    this.adoService = adoService

    // Get credentials from ADO service
    const creds = adoService.credentials
    if (creds.organization && creds.project && creds.pat) {
      this.baseUrl = `https://dev.azure.com/${creds.organization}/${creds.project}/_apis`
      this.headers = {
        'Authorization': `Basic ${btoa(':' + creds.pat)}`,
        'Content-Type': 'application/json'
      }
    } else {
      throw new Error('ADO service not initialized with credentials')
    }

  }

  /**
   * Construct comprehensive content based on selected items
   */
  async constructContent(
    mainSource: ADOSource,
    selectedRelated?: SelectedItems
  ): Promise<string> {
    const contentSections: string[] = []

    // Log what we received
    console.log('[ADOContentService] constructContent called with:', {
      mainSourceId: mainSource.id,
      mainSourceType: mainSource.type,
      selectedRelated: selectedRelated ? {
        parentTask: selectedRelated.parentTask ? `ID: ${selectedRelated.parentTask.id}` : 'undefined',
        tasks: `${selectedRelated.tasks?.length || 0} tasks`,
        prs: `${selectedRelated.prs?.length || 0} prs`
      } : 'undefined'
    })

    // Process main source
    if (mainSource.type === 'workitem') {
      const workItemContent = await this.getWorkItemContent(mainSource.metadata.workItemId!)
      contentSections.push(this.formatWorkItemContent(workItemContent, true))

      // If no selected related items provided, try to fetch them automatically
      if (!selectedRelated) {
        console.log(`[ADOContentService] No selected related items, fetching automatically for work item ${mainSource.metadata.workItemId}`)
        try {
          // Import and use ADORelatedDataService to get related items
          const { ADORelatedDataService } = await import('./ADORelatedDataService')
          const relatedService = new ADORelatedDataService(this.adoService)
          const relatedData = await relatedService.getWorkItemRelatedData(mainSource.metadata.workItemId!)

          console.log(`[ADOContentService] Auto-fetched related data:`, {
            parent: relatedData.parentTask ? 'Yes' : 'No',
            children: relatedData.childTasks?.length || 0,
            linkedPRs: relatedData.linkedPullRequests?.length || 0
          })

          // Convert to selectedRelated format with all items selected by default
          selectedRelated = {
            parentTask: relatedData.parentTask,
            tasks: relatedData.childTasks || [],
            prs: relatedData.linkedPullRequests || []
          }
        } catch (error) {
          console.error(`[ADOContentService] Failed to auto-fetch related items:`, error)
        }
      }
    } else if (mainSource.type === 'pullrequest') {
      const prContent = await this.getPullRequestContent(
        mainSource.metadata.repositoryId!,
        mainSource.metadata.pullRequestId!
      )
      contentSections.push(this.formatPullRequestContent(prContent, true))
    }

    // Process selected related items
    if (selectedRelated) {
      console.log('[ADOContentService] Processing selected related items:', {
        parentTask: selectedRelated.parentTask ? `ID: ${selectedRelated.parentTask.id}` : 'none',
        tasks: Array.isArray(selectedRelated.tasks) ? selectedRelated.tasks.length : 'not array',
        prs: Array.isArray(selectedRelated.prs) ? selectedRelated.prs.length : 'not array'
      })

      // Parent task
      if (selectedRelated.parentTask && selectedRelated.parentTask.id) {
        console.log('[ADOContentService] Processing parent task:', selectedRelated.parentTask.id)
        const parentContent = await this.getWorkItemContent(selectedRelated.parentTask.id)
        contentSections.push('\n## Parent Work Item')
        contentSections.push(this.formatWorkItemContent(parentContent, false))
      }

      // Related tasks - defensive check for array
      if (selectedRelated.tasks && Array.isArray(selectedRelated.tasks) && selectedRelated.tasks.length > 0) {
        console.log(`[ADOContentService] Processing ${selectedRelated.tasks.length} related tasks`)
        contentSections.push('\n## Related Work Items')
        for (const task of selectedRelated.tasks) {
          if (task && task.id) {
            const taskContent = await this.getWorkItemContent(task.id)
            contentSections.push(this.formatWorkItemContent(taskContent, false))
          }
        }
      }

      // Related PRs - defensive check for array
      if (selectedRelated.prs && Array.isArray(selectedRelated.prs) && selectedRelated.prs.length > 0) {
        console.log(`[ADOContentService] Processing ${selectedRelated.prs.length} related PRs`)
        contentSections.push('\n## Related Pull Requests')
        for (const pr of selectedRelated.prs) {
          if (pr && pr.pullRequestId) {
            console.log(`[ADOContentService] Processing PR:`, {
              pullRequestId: pr.pullRequestId,
              repository: pr.repository,
              title: pr.title
            })

            // Check if we have the repository ID
            if (!pr.repository) {
              console.error(`[ADOContentService] Missing repository ID for PR ${pr.pullRequestId}`)
              contentSections.push(`\n### PR #${pr.pullRequestId}: ${pr.title || 'Unknown'}\n\n*Error: Missing repository information*`)
              continue
            }

            try {
              const prContent = await this.getPullRequestContent(
                pr.repository,
                pr.pullRequestId
              )
              contentSections.push(this.formatPullRequestContent(prContent, false))
            } catch (error) {
              console.error(`[ADOContentService] Failed to fetch PR ${pr.pullRequestId} details:`, error)
              contentSections.push(`\n### PR #${pr.pullRequestId}: ${pr.title || 'Unknown'}\n\n*Error fetching PR details: ${error instanceof Error ? error.message : 'Unknown error'}*`)
            }
          }
        }
      }
    }

    return contentSections.join('\n\n')
  }

  /**
   * Get detailed work item content including comments
   */
  private async getWorkItemContent(workItemId: number): Promise<WorkItemContent> {
    try {
      // Fetch work item details with relations
      const workItemUrl = `${this.baseUrl}/wit/workitems/${workItemId}?$expand=relations&api-version=7.1`
      console.log(`[ADOContentService] Fetching work item ${workItemId} from:`, workItemUrl)

      const response = await fetch(workItemUrl, {
        method: 'GET',
        headers: this.headers
      })

      if (!response.ok) {
        console.error(`[ADOContentService] Failed to fetch work item ${workItemId}. Status: ${response.status}`)
        const errorText = await response.text()
        console.error(`[ADOContentService] Error response:`, errorText)
        throw new Error(`Failed to fetch work item ${workItemId}: ${response.status}`)
      }

      const workItem = await response.json()
      console.log(`[ADOContentService] Work item ${workItemId} fetched successfully`)
      console.log(`[ADOContentService] Fields available:`, Object.keys(workItem.fields || {}))
      console.log(`[ADOContentService] Description field:`, workItem.fields?.['System.Description'] ? 'Present' : 'Missing')
      console.log(`[ADOContentService] Relations count:`, workItem.relations?.length || 0)

      // Fetch comments
      const commentsUrl = `${this.baseUrl}/wit/workitems/${workItemId}/comments?api-version=7.1-preview.3`
      const commentsResponse = await fetch(commentsUrl, {
        method: 'GET',
        headers: this.headers
      })

      let comments: any[] = []
      if (commentsResponse.ok) {
        const commentsData = await commentsResponse.json()
        comments = commentsData.comments || []
      }

      return {
        id: workItemId,
        title: workItem.fields['System.Title'] || '',
        description: htmlToMarkdown(workItem.fields['System.Description'] || ''),
        state: workItem.fields['System.State'] || 'Unknown',
        type: workItem.fields['System.WorkItemType'] || 'Unknown',
        assignedTo: workItem.fields['System.AssignedTo']?.displayName,
        priority: workItem.fields['Microsoft.VSTS.Common.Priority'],
        severity: workItem.fields['Microsoft.VSTS.Common.Severity'],
        tags: workItem.fields['System.Tags'],
        acceptanceCriteria: htmlToMarkdown(workItem.fields['Microsoft.VSTS.Common.AcceptanceCriteria'] || ''),
        comments: comments.map(c => ({
          author: c.createdBy?.displayName || 'Unknown',
          date: new Date(c.createdDate).toLocaleDateString(),
          text: htmlToMarkdown(c.text || '')
        }))
      }
    } catch (error) {
      console.error(`[ADOContentService] Failed to get work item content for ${workItemId}:`, error)
      console.error(`[ADOContentService] Error details:`, {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack?.split('\n').slice(0, 3) : undefined
      })

      // Return a more informative error object
      return {
        id: workItemId,
        title: `Work Item ${workItemId}`,
        description: `[Error loading details: ${error instanceof Error ? error.message : 'Unknown error'}]`,
        state: 'Error',
        type: 'Unknown',
        comments: [{
          author: 'System',
          date: new Date().toLocaleDateString(),
          text: `Failed to fetch work item details. Please check your Azure DevOps credentials and permissions.`
        }]
      }
    }
  }

  /**
   * Get detailed pull request content including file changes and diffs
   */
  private async getPullRequestContent(
    repositoryId: string,
    pullRequestId: number
  ): Promise<PullRequestContent> {
    try {
      console.log('[ADOContentService] Fetching PR details:', {
        repositoryId,
        pullRequestId
      })

      // Fetch PR details
      const prUrl = `${this.baseUrl}/git/repositories/${repositoryId}/pullrequests/${pullRequestId}?api-version=7.1`
      console.log('[ADOContentService] PR URL:', prUrl)

      const response = await fetch(prUrl, {
        method: 'GET',
        headers: this.headers
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[ADOContentService] PR fetch failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        })
        throw new Error(`Failed to fetch PR ${pullRequestId}: ${response.status} ${response.statusText}`)
      }

      const pr = await response.json()
      console.log('[ADOContentService] PR details fetched successfully:', {
        id: pr.pullRequestId,
        title: pr.title,
        status: pr.status
      })

      // Fetch commits
      let commits: any[] = []
      try {
        const commitsUrl = `${this.baseUrl}/git/repositories/${repositoryId}/pullrequests/${pullRequestId}/commits?api-version=7.1`
        const commitsResponse = await fetch(commitsUrl, {
          method: 'GET',
          headers: this.headers
        })
        if (commitsResponse.ok) {
          const commitsData = await commitsResponse.json()
          commits = commitsData.value || []
        }
      } catch (error) {
        console.warn('Failed to fetch commits:', error)
      }

      // Fetch changed files
      let changedFiles: any[] = []
      let fileDiffs: Record<string, string> = {}
      try {
        const changesUrl = `${this.baseUrl}/git/repositories/${repositoryId}/pullrequests/${pullRequestId}/iterations?api-version=7.1`
        const changesResponse = await fetch(changesUrl, {
          method: 'GET',
          headers: this.headers
        })

        if (changesResponse.ok) {
          const iterationsData = await changesResponse.json()
          if (iterationsData.value && iterationsData.value.length > 0) {
            // Get the latest iteration
            const latestIteration = iterationsData.value[iterationsData.value.length - 1]
            const iterationId = latestIteration.id

            // Get changes for this iteration
            const iterationChangesUrl = `${this.baseUrl}/git/repositories/${repositoryId}/pullrequests/${pullRequestId}/iterations/${iterationId}/changes?api-version=7.1`
            const iterationChangesResponse = await fetch(iterationChangesUrl, {
              method: 'GET',
              headers: this.headers
            })

            if (iterationChangesResponse.ok) {
              const changesData = await iterationChangesResponse.json()
              changedFiles = changesData.changeEntries || []

              // Get diffs for first 5 files
              if (commits.length >= 2) {
                const baseCommit = commits[0].commitId
                const targetCommit = commits[commits.length - 1].commitId

                for (const file of changedFiles.slice(0, 5)) {
                  if (file.item?.path) {
                    try {
                      const diff = await this.getFileDiff(
                        repositoryId,
                        baseCommit,
                        targetCommit,
                        file.item.path
                      )
                      if (diff) {
                        fileDiffs[file.item.path] = diff
                      }
                    } catch (error) {
                      console.warn(`Failed to get diff for ${file.item.path}:`, error)
                    }
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.warn('Failed to fetch changes:', error)
      }

      // Fetch comments
      let comments: any[] = []
      try {
        const threadsUrl = `${this.baseUrl}/git/repositories/${repositoryId}/pullrequests/${pullRequestId}/threads?api-version=7.1`
        const threadsResponse = await fetch(threadsUrl, {
          method: 'GET',
          headers: this.headers
        })
        if (threadsResponse.ok) {
          const threadsData = await threadsResponse.json()
          const threads = threadsData.value || []
          for (const thread of threads) {
            if (thread.comments) {
              comments.push(...thread.comments.map((c: any) => ({
                author: c.author?.displayName || 'Unknown',
                content: htmlToMarkdown(c.content || '')
              })))
            }
          }
        }
      } catch (error) {
        console.warn('Failed to fetch comments:', error)
      }

      return {
        id: pullRequestId,
        title: pr.title || `PR #${pullRequestId}`,
        description: htmlToMarkdown(pr.description || ''),
        status: pr.status || 'Unknown',
        repository: pr.repository?.name || repositoryId,
        author: pr.createdBy?.displayName || 'Unknown',
        createdDate: new Date(pr.creationDate).toLocaleDateString(),
        sourceBranch: pr.sourceRefName?.replace('refs/heads/', '') || 'Unknown',
        targetBranch: pr.targetRefName?.replace('refs/heads/', '') || 'Unknown',
        commits: commits.map(c => ({
          id: c.commitId.substring(0, 8),
          message: c.comment?.split('\n')[0] || 'No message',
          author: c.author?.name || 'Unknown'
        })),
        changedFiles: changedFiles.map(f => ({
          path: f.item?.path || 'Unknown',
          changeType: f.changeType || 'edit'
        })),
        fileDiffs,
        comments
      }
    } catch (error) {
      console.error(`Failed to get PR content for ${pullRequestId}:`, error)
      return {
        id: pullRequestId,
        title: `PR #${pullRequestId}`,
        description: 'Failed to load PR details',
        status: 'Unknown',
        repository: repositoryId,
        author: 'Unknown',
        createdDate: new Date().toLocaleDateString(),
        sourceBranch: 'Unknown',
        targetBranch: 'Unknown'
      }
    }
  }

  /**
   * Get file diff between two commits
   */
  private async getFileDiff(
    repositoryId: string,
    baseCommit: string,
    targetCommit: string,
    path: string
  ): Promise<string | null> {
    try {
      const diffUrl = `${this.baseUrl}/git/repositories/${repositoryId}/diffs/commits?baseVersion=${baseCommit}&targetVersion=${targetCommit}&api-version=7.1`
      const response = await fetch(diffUrl, {
        method: 'GET',
        headers: this.headers
      })

      if (!response.ok) {
        return null
      }

      const diffData = await response.json()
      const changes = diffData.changes || []

      // Find the specific file in the changes
      const fileChange = changes.find((c: any) => c.item?.path === path)
      if (!fileChange) {
        return null
      }

      // Get the actual diff content
      const fileDiffUrl = `${this.baseUrl}/git/repositories/${repositoryId}/commits/${targetCommit}/changes?path=${encodeURIComponent(path)}&api-version=7.1`
      const fileDiffResponse = await fetch(fileDiffUrl, {
        method: 'GET',
        headers: this.headers
      })

      if (fileDiffResponse.ok) {
        const fileDiffData = await fileDiffResponse.json()
        // Construct a simple diff representation
        return this.constructDiffString(fileChange, fileDiffData)
      }

      return null
    } catch (error) {
      console.error('Failed to get file diff:', error)
      return null
    }
  }

  /**
   * Construct a diff string from change data
   */
  private constructDiffString(change: any, diffData: any): string {
    const lines: string[] = []
    const changeType = change.changeType || 'edit'

    if (changeType === 'add') {
      lines.push('+++ New file')
    } else if (changeType === 'delete') {
      lines.push('--- Deleted file')
    } else {
      lines.push('--- Modified file')
    }

    // Add some sample lines to show the change
    if (diffData.changes && diffData.changes.length > 0) {
      const firstChange = diffData.changes[0]
      if (firstChange.item?.content) {
        const contentLines = firstChange.item.content.split('\n').slice(0, 20)
        contentLines.forEach((line: string) => {
          lines.push(`+ ${line}`)
        })
      }
    }

    return lines.join('\n')
  }

  /**
   * Format work item content for display
   */
  private formatWorkItemContent(content: WorkItemContent, isMain: boolean): string {
    const sections: string[] = []

    // Title section
    sections.push(`### [${content.type}] ${content.title}`)
    sections.push(`Type: Work Item`)
    sections.push(`State: ${content.state}`)

    // Add separator for main items
    if (isMain) {
      sections.push('')
      sections.push('---')
    }

    sections.push('')

    // Description section - Always include if available
    if (content.description && content.description.trim()) {
      sections.push('**Description:**')
      sections.push(content.description)
      sections.push('')
    }

    // Metadata section
    sections.push('**Metadata:**')
    sections.push(`- Work Item ID: ${content.id}`)
    sections.push(`- Type: ${content.type}`)
    sections.push(`- State: ${content.state}`)
    if (content.assignedTo) sections.push(`- Assigned To: ${content.assignedTo}`)
    if (content.priority) sections.push(`- Priority: ${content.priority}`)
    if (content.severity) sections.push(`- Severity: ${content.severity}`)
    if (content.tags) sections.push(`- Tags: ${content.tags}`)
    sections.push('')

    // Acceptance Criteria
    if (content.acceptanceCriteria && content.acceptanceCriteria.trim()) {
      sections.push('**Acceptance Criteria:**')
      sections.push(content.acceptanceCriteria)
      sections.push('')
    }

    // Discussion/Comments section - Include full discussion
    if (content.comments && content.comments.length > 0) {
      sections.push('**Discussion/Comments:**')
      for (const comment of content.comments) {
        sections.push('')
        sections.push(`**${comment.author}** (${comment.date}):`)
        // Include full comment text, not truncated
        sections.push(`> ${comment.text.replace(/\n/g, '\n> ')}`)
      }
      sections.push('')
    }

    // Add separator at the end for main items
    if (isMain) {
      sections.push('---')
      sections.push('')
    }

    return sections.join('\n')
  }

  /**
   * Format pull request content for display
   */
  private formatPullRequestContent(content: PullRequestContent, isMain: boolean): string {
    const sections: string[] = []

    if (isMain) {
      sections.push(`# Pull Request #${content.id}: ${content.title}`)
    } else {
      sections.push(`### PR #${content.id}: ${content.title}`)
    }

    sections.push('')
    sections.push('**Details:**')
    sections.push(`- Repository: ${content.repository}`)
    sections.push(`- Status: ${content.status}`)
    sections.push(`- Author: ${content.author}`)
    sections.push(`- Created: ${content.createdDate}`)
    sections.push(`- Branch: \`${content.sourceBranch}\` → \`${content.targetBranch}\``)

    if (content.description) {
      sections.push('')
      sections.push('**Description:**')
      const descLines = content.description.split('\n').slice(0, 10)
      sections.push(descLines.join('\n'))
      if (content.description.split('\n').length > 10) {
        sections.push('... [description truncated]')
      }
    }

    if (content.changedFiles && content.changedFiles.length > 0) {
      sections.push('')
      sections.push(`**Changed Files (${content.changedFiles.length} files):**`)
      for (const file of content.changedFiles.slice(0, 10)) {
        const indicator = this.getChangeIndicator(file.changeType)
        sections.push(`  ${indicator} ${file.path}`)
      }
      if (content.changedFiles.length > 10) {
        sections.push(`  ... and ${content.changedFiles.length - 10} more files`)
      }
    }

    if (content.commits && content.commits.length > 0) {
      sections.push('')
      sections.push(`**Commits (${content.commits.length} total):**`)
      for (const commit of content.commits.slice(0, 5)) {
        sections.push(`- \`${commit.id}\` ${commit.message} (by ${commit.author})`)
      }
      if (content.commits.length > 5) {
        sections.push(`... and ${content.commits.length - 5} more commits`)
      }
    }

    if (content.fileDiffs && Object.keys(content.fileDiffs).length > 0) {
      sections.push('')
      sections.push('**Code Changes (sample):**')
      for (const [path, diff] of Object.entries(content.fileDiffs).slice(0, 3)) {
        const filename = path.substring(path.lastIndexOf('/') + 1)
        sections.push(`\n📄 ${filename}:`)
        sections.push('```diff')
        const diffLines = diff.split('\n').slice(0, 15)
        sections.push(diffLines.join('\n'))
        if (diff.split('\n').length > 15) {
          sections.push('... [diff truncated]')
        }
        sections.push('```')
      }
    }

    if (content.comments && content.comments.length > 0) {
      sections.push('')
      sections.push(`**Comments (${content.comments.length} total):**`)
      for (const comment of content.comments.slice(0, 3)) {
        sections.push(`- ${comment.author}: "${comment.content.substring(0, 100)}${comment.content.length > 100 ? '...' : ''}"`)
      }
      if (content.comments.length > 3) {
        sections.push(`... and ${content.comments.length - 3} more comments`)
      }
    }

    return sections.join('\n')
  }

  /**
   * Get change indicator for file change type
   */
  private getChangeIndicator(changeType: string): string {
    switch (changeType?.toLowerCase()) {
      case 'add':
      case 'added':
        return '➕'
      case 'edit':
      case 'edited':
      case 'modify':
      case 'modified':
        return '📝'
      case 'delete':
      case 'deleted':
        return '❌'
      case 'rename':
      case 'renamed':
        return '📋'
      default:
        return '•'
    }
  }

}
