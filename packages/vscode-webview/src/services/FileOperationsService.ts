/**
 * File Operations Service
 * Provides file system operations for code review functionality
 */

export interface FileOperationResult {
  success: boolean
  content?: string
  error?: string
}

export interface CodeReviewSummary {
  reviewId: string
  title: string
  status: 'draft' | 'active' | 'completed' | 'archived'
  createdAt: string
  commentCount: number
  responseCount: number
}

/**
 * Service for file-based operations
 */
export class FileOperationsService {
  private readonly port: number = 25716
  private readonly baseUrl: string

  constructor() {
    this.baseUrl = `http://localhost:${this.port}`
  }

  /**
   * Read file content from the server
   */
  public async readFile(filePath: string): Promise<FileOperationResult> {
    try {
      const response = await fetch(`${this.baseUrl}/git/file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path: filePath })
      })

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to read file: ${response.statusText}`
        }
      }

      const data = await response.json()
      return {
        success: true,
        content: data.content || ''
      }

    } catch (error) {
      return {
        success: false,
        error: `Failed to read file: ${error}`
      }
    }
  }

  /**
   * Get file content at specific line range
   */
  public async getFileLines(
    filePath: string,
    startLine: number,
    endLine: number
  ): Promise<FileOperationResult> {
    try {
      const fileResult = await this.readFile(filePath)
      if (!fileResult.success || !fileResult.content) {
        return fileResult
      }

      const lines = fileResult.content.split('\n')
      const selectedLines = lines.slice(startLine - 1, endLine)

      return {
        success: true,
        content: selectedLines.join('\n')
      }

    } catch (error) {
      return {
        success: false,
        error: `Failed to get file lines: ${error}`
      }
    }
  }

  /**
   * Check if file exists
   */
  public async fileExists(filePath: string): Promise<boolean> {
    const result = await this.readFile(filePath)
    return result.success
  }

  /**
   * Get code review summaries from saved reviews
   */
  public async getCodeReviewSummaries(): Promise<CodeReviewSummary[]> {
    try {
      const response = await fetch(`${this.baseUrl}/reviews`)

      if (!response.ok) {
        console.error('Failed to fetch reviews:', response.statusText)
        return []
      }

      const reviews = await response.json()

      return reviews.map((review: any) => ({
        reviewId: review.id,
        title: review.title,
        status: review.status,
        createdAt: review.createdAt,
        commentCount: 0, // Would need to fetch full review to get accurate count
        responseCount: 0  // Would need to fetch full review to get accurate count
      }))

    } catch (error) {
      console.error('Failed to get code review summaries:', error)
      return []
    }
  }
}