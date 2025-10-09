/**
 * Git API Client for interfacing with OpenCode git endpoints
 * Provides high-level methods for all git diff scenarios
 */

import type {
  GitDiffConfig,
  GitDiffType
} from '../types/index.js'
import { GitError, GitRepositoryError } from '../types/index.js'

// Response types matching the git API
interface GitDiffResponse {
  diff: string
  files: Array<{
    path: string
    additions: number
    deletions: number
  }>
}

interface GitFileResponse {
  content: string
  exists: boolean
}

interface GitStatusResponse {
  branch: string
  ahead: number
  behind: number
  modified: string[]
  staged: string[]
  untracked: string[]
}

interface GitBranchesResponse {
  current: string
  branches: string[]
}

interface GitCommitsResponse {
  commits: Array<{
    hash: string
    shortHash: string
    subject: string
    author: string
    date: string
  }>
}

/**
 * Git API Client for all git operations
 */
export class GitApiClient {
  private baseUrl: string
  private repositoryPath: string

  constructor(baseUrl: string, repositoryPath: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.repositoryPath = repositoryPath
  }

  /**
   * Get git diff for any of the 5 supported scenarios
   */
  async getDiff(config: GitDiffConfig): Promise<GitDiffResponse> {
    try {
      let requestBody: any

      switch (config.type) {
        case 'staged':
          requestBody = { staged: true }
          break

        case 'unpushed':
          const remoteName = config.remoteName || 'origin'
          const baseBranch = config.baseBranch || 'main'
          requestBody = {
            sourceBranch: 'HEAD',
            targetBranch: `${remoteName}/${baseBranch}`
          }
          break

        case 'commit':
          if (!config.commit) {
            throw new GitError('Commit hash is required for commit diff type')
          }
          requestBody = { commitHash: config.commit }
          break

        case 'commit-range':
          if (!config.fromCommit || !config.toCommit) {
            throw new GitError('Both fromCommit and toCommit are required for commit-range diff type')
          }
          // For commit ranges, use the git diff range notation in sourceBranch/targetBranch
          // This is a workaround until proper commitRange support is added to the API
          requestBody = {
            sourceBranch: config.toCommit,
            targetBranch: config.fromCommit
          }
          break

        case 'branch-diff':
          if (!config.fromBranch || !config.toBranch) {
            throw new GitError('Both fromBranch and toBranch are required for branch-diff type')
          }
          requestBody = {
            sourceBranch: config.toBranch,
            targetBranch: config.fromBranch
          }
          break

        default:
          throw new GitError(`Unsupported git diff type: ${config.type}`)
      }

      const response = await this.makeRequest<GitDiffResponse>('POST', '/git/diff', requestBody)
      return response
    } catch (error) {
      if (error instanceof GitError) {
        throw error
      }
      throw new GitError(`Failed to get git diff: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get file content at specific revision
   */
  async getFileContent(path: string, ref?: string): Promise<GitFileResponse> {
    try {
      const response = await this.makeRequest<GitFileResponse>('POST', '/git/file', {
        path,
        ref: ref || 'HEAD'
      })
      return response
    } catch (error) {
      throw new GitError(`Failed to get file content: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get current git status
   */
  async getStatus(): Promise<GitStatusResponse> {
    try {
      const response = await this.makeRequest<GitStatusResponse>('GET', '/git/status')
      return response
    } catch (error) {
      throw new GitError(`Failed to get git status: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get list of branches
   */
  async getBranches(): Promise<GitBranchesResponse> {
    try {
      const response = await this.makeRequest<GitBranchesResponse>('GET', '/git/branches')
      return response
    } catch (error) {
      throw new GitError(`Failed to get branches: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get recent commits
   */
  async getCommits(limit?: number, branch?: string): Promise<GitCommitsResponse> {
    try {
      const queryParams = new URLSearchParams()
      if (limit) queryParams.append('limit', limit.toString())
      if (branch) queryParams.append('branch', branch)

      const url = `/git/commits${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
      const response = await this.makeRequest<GitCommitsResponse>('GET', url)
      return response
    } catch (error) {
      throw new GitError(`Failed to get commits: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Validate that the repository exists and is accessible
   */
  async validateRepository(): Promise<void> {
    try {
      await this.getStatus()
    } catch (error) {
      throw new GitRepositoryError(
        `Repository at ${this.repositoryPath} is not accessible or not a git repository`,
        this.repositoryPath,
        { originalError: error }
      )
    }
  }

  /**
   * Validate that a commit exists
   */
  async validateCommit(commitHash: string): Promise<boolean> {
    try {
      // Try to get commits and see if the hash is valid
      const commits = await this.getCommits(100) // Get more commits to check
      return commits.commits.some(commit =>
        commit.hash === commitHash ||
        commit.shortHash === commitHash ||
        commit.hash.startsWith(commitHash)
      )
    } catch (error) {
      return false
    }
  }

  /**
   * Validate that a branch exists
   */
  async validateBranch(branchName: string): Promise<boolean> {
    try {
      const branches = await this.getBranches()
      return branches.branches.some(branch =>
        branch === branchName ||
        branch.endsWith(`/${branchName}`) ||
        branch.replace('remotes/', '') === branchName
      )
    } catch (error) {
      return false
    }
  }

  /**
   * Get the current branch name
   */
  async getCurrentBranch(): Promise<string> {
    try {
      const status = await this.getStatus()
      return status.branch
    } catch (error) {
      throw new GitError(`Failed to get current branch: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Check if there are any staged changes
   */
  async hasStaged(): Promise<boolean> {
    try {
      const status = await this.getStatus()
      return status.staged.length > 0
    } catch (error) {
      throw new GitError(`Failed to check staged changes: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Check if there are unpushed changes
   */
  async hasUnpushed(): Promise<boolean> {
    try {
      const status = await this.getStatus()
      return status.ahead > 0
    } catch (error) {
      throw new GitError(`Failed to check unpushed changes: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Make HTTP request to git API
   */
  private async makeRequest<T>(method: 'GET' | 'POST', endpoint: string, body?: any): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    try {
      const requestOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
        } as Record<string, string>,
      }

      if (body && method !== 'GET') {
        requestOptions.body = JSON.stringify(body)
      }

      // In browser/webview environment, we can't change working directory
      // Instead, include repository path in headers for the API to use
      if (this.repositoryPath && this.repositoryPath !== '.') {
        requestOptions.headers = {
          ...requestOptions.headers,
          'X-Repository-Path': this.repositoryPath
        }
      }

      const response = await fetch(url, requestOptions)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const data = await response.json()

      // Check for API-level errors
      if (data.error) {
        throw new Error(data.error)
      }

      return data as T
    } catch (error) {
      if (error instanceof Error) {
        // Handle specific git errors
        if (error.message.includes('not a git repository')) {
          throw new GitRepositoryError(
            `${this.repositoryPath} is not a git repository`,
            this.repositoryPath
          )
        }
        if (error.message.includes('unknown revision')) {
          throw new GitError('Invalid commit hash or branch name')
        }
        if (error.message.includes('No such file or directory')) {
          throw new GitRepositoryError(
            `Repository path ${this.repositoryPath} does not exist`,
            this.repositoryPath
          )
        }
      }

      throw error
    }
  }
}

/**
 * Factory function to create GitApiClient instances
 */
export function createGitApiClient(baseUrl: string, repositoryPath: string): GitApiClient {
  return new GitApiClient(baseUrl, repositoryPath)
}