import { PullRequestClient } from '@supercode/azure-devops'
import { createLogger } from '../core/utils.js'
import type { IWorkspaceManager } from '../core/interfaces.js'

const logger = createLogger('ado-diff-helper')

export interface AdoDiffHelperConfig {
  client: PullRequestClient
  workspaceManager?: IWorkspaceManager
  gitApiBaseUrl?: string  // Optional base URL for git API, defaults to localhost:3000
}

export class AdoDiffHelper {
  private client: PullRequestClient
  private workspaceManager?: IWorkspaceManager
  private gitApiBaseUrl: string

  constructor(config: AdoDiffHelperConfig) {
    this.client = config.client
    this.workspaceManager = config.workspaceManager
    this.gitApiBaseUrl = config.gitApiBaseUrl || 'http://localhost:3000'
  }

  async generateFileDiffWithContents(
    repositoryId: string,
    baseCommit: string,
    targetCommit: string,
    filePath: string,
    changeType?: string
  ): Promise<{ diff: string; oldContent: string | null; newContent: string | null }> {
    logger.info(`Generating diff for ${filePath} between ${baseCommit} and ${targetCommit}, changeType: ${changeType}`)

    let oldContent: string | null = null
    let newContent: string | null = null

    try {
      // Handle different change types
      if (changeType !== 'add') {
        // File exists in base commit (modify or delete)
        try {
          oldContent = await this.client.getFileContent(repositoryId, baseCommit, filePath)
          logger.debug(`Retrieved old content for ${filePath}: ${oldContent ? oldContent.length : 0} chars`)
        } catch (error) {
          logger.warn(`Failed to fetch old content for ${filePath}:`, error)
          oldContent = null
        }
      } else {
        logger.debug(`Skipping old content fetch for added file: ${filePath}`)
      }

      if (changeType !== 'delete') {
        // File exists in target commit (add or modify)
        try {
          newContent = await this.client.getFileContent(repositoryId, targetCommit, filePath)
          logger.debug(`Retrieved new content for ${filePath}: ${newContent ? newContent.length : 0} chars`)
        } catch (error) {
          logger.warn(`Failed to fetch new content for ${filePath}:`, error)
          newContent = null
        }
      } else {
        logger.debug(`Skipping new content fetch for deleted file: ${filePath}`)
      }

      // Debug content status
      logger.info(`Content status for ${filePath}: old=${oldContent ? `${oldContent.length} chars` : 'null'}, new=${newContent ? `${newContent.length} chars` : 'null'}`)

      // Check if contents are identical
      if (oldContent === newContent) {
        logger.warn(`Contents are identical for ${filePath}, this might cause empty diff`)
      }

      // Generate optimized diff using server API
      const diff = await this.generateOptimizedDiff(oldContent, newContent, filePath, changeType)

      // Save version files if workspace manager is provided
      if (this.workspaceManager) {
        try {
          const fileName = filePath.replace(/[\/\\]/g, '_').replace(/[<>:"|?*]/g, '_')

          await this.workspaceManager.saveContent(`versions/${fileName}.local`, oldContent || '')
          await this.workspaceManager.saveContent(`versions/${fileName}.remote`, newContent || '')
          await this.workspaceManager.saveContent(`versions/${fileName}.diff`, diff)

          logger.debug(`Saved version files for ${filePath}`)
        } catch (error) {
          logger.warn(`Failed to save version files for ${filePath}:`, error)
        }
      }

      return { diff, oldContent, newContent }
    } catch (error) {
      logger.error(`Error generating diff for ${filePath}:`, error)
      throw error
    }
  }

  /**
   * Generate optimized diff using server API
   */
  private async generateOptimizedDiff(
    oldContent: string | null,
    newContent: string | null,
    filePath: string,
    changeType?: string
  ): Promise<string> {
    logger.debug(`Attempting to generate diff via server API at ${this.gitApiBaseUrl}/git/content-diff`)

    try {
      const requestBody = {
        oldContent,
        newContent,
        filePath,
        changeType,
      }

      logger.debug(`Request payload: oldContent=${oldContent ? oldContent.length : 'null'} chars, newContent=${newContent ? newContent.length : 'null'} chars, changeType=${changeType}`)

      const response = await fetch(`${this.gitApiBaseUrl}/git/content-diff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Server API error: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const result = await response.json()

      if (result.error) {
        throw new Error(result.error)
      }

      logger.info(`Generated optimized git diff for ${filePath}: ${result.diff.length} chars, +${result.stats.additions} -${result.stats.deletions}`)

      if (result.diff.length === 0) {
        logger.warn(`Server returned empty diff for ${filePath}`)
      }

      return result.diff

    } catch (error: any) {
      logger.warn(`Could not generate optimized diff via server API for ${filePath}: ${error.message}`)

      // Fallback to enhanced diff generation
      return this.generateFallbackDiff(oldContent, newContent, filePath, changeType)
    }
  }

  /**
   * Generate enhanced fallback diff when git diff tools are not available
   */
  private generateFallbackDiff(
    oldContent: string | null,
    newContent: string | null,
    filePath: string,
    changeType?: string
  ): string {
    logger.debug(`Generating fallback diff for ${filePath}`)

    // If both contents are null or identical, return meaningful message
    if (!oldContent && !newContent) {
      return `diff --git a${filePath} b${filePath}\n--- a${filePath}\n+++ b${filePath}\n@@ -0,0 +0,0 @@\n[No content available for comparison]\n`
    }

    if (oldContent === newContent) {
      return `diff --git a${filePath} b${filePath}\n--- a${filePath}\n+++ b${filePath}\n@@ -0,0 +0,0 @@\n[Files are identical - no changes detected]\n`
    }

    // Generate basic diff format with actual content hints
    let diff = `diff --git a${filePath} b${filePath}\n`

    if (changeType === 'add' || !oldContent) {
      diff += `new file mode 100644\n--- /dev/null\n+++ b${filePath}\n`
      if (newContent) {
        const lines = newContent.split('\n')
        diff += `@@ -0,0 +1,${lines.length} @@\n`
        // Show first few lines as preview
        const preview = lines.slice(0, Math.min(3, lines.length))
        for (const line of preview) {
          diff += `+${line}\n`
        }
        if (lines.length > 3) {
          diff += `+... (${lines.length - 3} more lines)\n`
        }
      }
    } else if (changeType === 'delete' || !newContent) {
      diff += `deleted file mode 100644\n--- a${filePath}\n+++ /dev/null\n`
      if (oldContent) {
        const lines = oldContent.split('\n')
        diff += `@@ -1,${lines.length} +0,0 @@\n`
        // Show first few lines as preview
        const preview = lines.slice(0, Math.min(3, lines.length))
        for (const line of preview) {
          diff += `-${line}\n`
        }
        if (lines.length > 3) {
          diff += `-... (${lines.length - 3} more lines)\n`
        }
      }
    } else {
      // Modified file
      diff += `--- a${filePath}\n+++ b${filePath}\n`
      const oldLines = oldContent.split('\n')
      const newLines = newContent.split('\n')
      diff += `@@ -1,${oldLines.length} +1,${newLines.length} @@\n`

      // Show size difference as indicator
      const sizeDiff = newContent.length - oldContent.length
      diff += `[Content modified: ${sizeDiff >= 0 ? '+' : ''}${sizeDiff} chars difference]\n`

      // Show brief preview of first difference
      for (let i = 0; i < Math.min(3, Math.max(oldLines.length, newLines.length)); i++) {
        const oldLine = i < oldLines.length ? oldLines[i] : undefined
        const newLine = i < newLines.length ? newLines[i] : undefined

        if (oldLine !== newLine) {
          if (oldLine !== undefined) diff += `-${oldLine}\n`
          if (newLine !== undefined) diff += `+${newLine}\n`
        } else if (oldLine !== undefined) {
          diff += ` ${oldLine}\n`
        }
      }

      const totalLines = Math.max(oldLines.length, newLines.length)
      if (totalLines > 3) {
        diff += `... (${totalLines - 3} more lines may differ)\n`
      }
    }

    logger.info(`Generated fallback diff for ${filePath}: ${diff.length} chars`)
    return diff
  }
}

export async function generateAdoFileDiff(
  config: AdoDiffHelperConfig,
  repositoryId: string,
  baseCommit: string,
  targetCommit: string,
  filePath: string,
  changeType?: string
): Promise<{ diff: string; oldContent: string | null; newContent: string | null }> {
  const helper = new AdoDiffHelper(config)
  return helper.generateFileDiffWithContents(repositoryId, baseCommit, targetCommit, filePath, changeType)
}