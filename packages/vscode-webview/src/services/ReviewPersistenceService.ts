/**
 * Review Persistence Service
 * Handles saving reviews to the server using the new API endpoints,
 * loading saved reviews from the server, and managing review metadata and state
 */

import {
  SavedCodeReview,
  SavedComment,
  CommentResponse,
  ReviewMetadata
} from '../types/CodeReview'
import { CodeReviewService, type ReviewResult, type DiffFile, type ReviewInsight, type Hunk } from './CodeReviewService'

export interface PersistenceCallbacks {
  onReviewSaved?: (reviewId: string, filename: string) => void
  onReviewLoaded?: (review: SavedCodeReview) => void
  onReviewDeleted?: (reviewId: string) => void
  onCommentResponseAdded?: (responseId: string, commentId: string) => void
  onError?: (error: string) => void
}

/**
 * Service for handling review persistence operations
 */
export class ReviewPersistenceService {
  private readonly port: number = 25716
  private readonly baseUrl: string

  // Callbacks for UI updates
  private callbacks?: PersistenceCallbacks

  // Auto-save configuration
  private autoSaveEnabled = true
  private autoSaveDelay = 2000 // 2 seconds
  private pendingSaves: Map<string, NodeJS.Timeout> = new Map()

  constructor() {
    this.baseUrl = `http://localhost:${this.port}`
  }

  /**
   * Set callback handlers for persistence updates
   */
  public setCallbacks(callbacks: PersistenceCallbacks) {
    this.callbacks = callbacks
  }

  /**
   * Save a review to the server
   */
  public async saveReview(
    reviewResult: ReviewResult,
    metadata: {
      title: string
      status?: 'draft' | 'active' | 'completed' | 'archived'
    },
    source: {
      type: 'branches' | 'commit' | 'diff' | 'staged'
      sourceBranch?: string
      targetBranch?: string
      commitHash?: string
      customDiff?: string
      diffContent: string
      diffFiles: DiffFile[]
    },
    analysis: {
      insights: ReviewInsight[]
      aiSessionId?: string
    },
    existingReviewId?: string
  ): Promise<{ success: boolean; id: string; filename: string }> {
    try {
      console.log('[ReviewPersistenceService] Saving review...')

      // Generate or use existing ID
      const reviewId = existingReviewId || this.generateReviewId()
      const now = new Date().toISOString()

      // Convert ReviewResult comments to SavedComments
      const savedComments: SavedComment[] = reviewResult.comments.map(comment => ({
        ...comment,
        id: this.generateCommentId(),
        threadId: this.generateThreadId(),
        status: 'open' as const,
        createdAt: now,
        updatedAt: now,
        author: { type: 'ai' as const, name: 'AI Reviewer' },
        responses: []
      }))

      // Create SavedCodeReview object
      const savedReview: SavedCodeReview = {
        id: reviewId,
        metadata: {
          title: metadata.title,
          createdAt: existingReviewId ? (await this.getExistingCreatedAt(existingReviewId)) || now : now,
          updatedAt: now,
          status: metadata.status || 'draft',
          version: existingReviewId ? await this.getNextVersion(existingReviewId) : 1
        },
        source,
        analysis: {
          insights: analysis.insights,
          hunks: reviewResult.hunks,
          aiSessionId: analysis.aiSessionId
        },
        comments: savedComments
      }

      // Send to server
      const response = await fetch(`${this.baseUrl}/reviews/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(savedReview)
      })

      if (!response.ok) {
        throw new Error(`Failed to save review: ${response.statusText}`)
      }

      const result = await response.json()
      console.log('[ReviewPersistenceService] Review saved successfully:', result)

      // Notify callback
      this.callbacks?.onReviewSaved?.(result.id, result.filename)

      return result

    } catch (error) {
      const errorMessage = `Failed to save review: ${error}`
      console.error('[ReviewPersistenceService]', errorMessage)
      this.callbacks?.onError?.(errorMessage)
      throw new Error(errorMessage)
    }
  }

  /**
   * Load a review from the server
   */
  public async loadReview(reviewId: string): Promise<SavedCodeReview> {
    try {
      console.log('[ReviewPersistenceService] Loading review:', reviewId)

      const response = await fetch(`${this.baseUrl}/reviews/${reviewId}`)

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Review not found: ${reviewId}`)
        }
        throw new Error(`Failed to load review: ${response.statusText}`)
      }

      const review: SavedCodeReview = await response.json()
      console.log('[ReviewPersistenceService] Review loaded successfully:', reviewId)

      // Notify callback
      this.callbacks?.onReviewLoaded?.(review)

      return review

    } catch (error) {
      const errorMessage = `Failed to load review: ${error}`
      console.error('[ReviewPersistenceService]', errorMessage)
      this.callbacks?.onError?.(errorMessage)
      throw new Error(errorMessage)
    }
  }

  /**
   * List all saved reviews
   */
  public async listReviews(): Promise<ReviewMetadata[]> {
    try {
      console.log('[ReviewPersistenceService] Listing all reviews...')

      const response = await fetch(`${this.baseUrl}/reviews`)

      if (!response.ok) {
        throw new Error(`Failed to list reviews: ${response.statusText}`)
      }

      const reviews: ReviewMetadata[] = await response.json()
      console.log('[ReviewPersistenceService] Reviews listed successfully:', reviews.length)

      return reviews

    } catch (error) {
      const errorMessage = `Failed to list reviews: ${error}`
      console.error('[ReviewPersistenceService]', errorMessage)
      this.callbacks?.onError?.(errorMessage)
      throw new Error(errorMessage)
    }
  }

  /**
   * Delete a review
   */
  public async deleteReview(reviewId: string): Promise<void> {
    try {
      console.log('[ReviewPersistenceService] Deleting review:', reviewId)

      const response = await fetch(`${this.baseUrl}/reviews/${reviewId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Review not found: ${reviewId}`)
        }
        throw new Error(`Failed to delete review: ${response.statusText}`)
      }

      console.log('[ReviewPersistenceService] Review deleted successfully:', reviewId)

      // Notify callback
      this.callbacks?.onReviewDeleted?.(reviewId)

    } catch (error) {
      const errorMessage = `Failed to delete review: ${error}`
      console.error('[ReviewPersistenceService]', errorMessage)
      this.callbacks?.onError?.(errorMessage)
      throw new Error(errorMessage)
    }
  }

  /**
   * Add a response to a comment thread
   */
  public async addCommentResponse(
    reviewId: string,
    commentId: string,
    content: string,
    author: { type: 'ai' | 'user'; name: string },
    sessionId?: string
  ): Promise<{ success: boolean; responseId: string }> {
    try {
      console.log('[ReviewPersistenceService] Adding comment response:', { reviewId, commentId })

      const response = await fetch(`${this.baseUrl}/reviews/${reviewId}/comments/${commentId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          author,
          sessionId
        })
      })

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Review or comment not found`)
        }
        throw new Error(`Failed to add comment response: ${response.statusText}`)
      }

      const result = await response.json()
      console.log('[ReviewPersistenceService] Comment response added successfully:', result)

      // Notify callback
      this.callbacks?.onCommentResponseAdded?.(result.responseId, commentId)

      return result

    } catch (error) {
      const errorMessage = `Failed to add comment response: ${error}`
      console.error('[ReviewPersistenceService]', errorMessage)
      this.callbacks?.onError?.(errorMessage)
      throw new Error(errorMessage)
    }
  }

  /**
   * Auto-save a review with debouncing
   */
  public autoSaveReview(
    reviewId: string,
    reviewResult: ReviewResult,
    metadata: { title: string; status?: 'draft' | 'active' | 'completed' | 'archived' },
    source: {
      type: 'branches' | 'commit' | 'diff' | 'staged'
      sourceBranch?: string
      targetBranch?: string
      commitHash?: string
      customDiff?: string
      diffContent: string
      diffFiles: DiffFile[]
    },
    analysis: { insights: ReviewInsight[]; aiSessionId?: string }
  ): void {
    if (!this.autoSaveEnabled) {
      return
    }

    // Clear any pending save for this review
    const existingTimeout = this.pendingSaves.get(reviewId)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    // Schedule new save
    const timeout = setTimeout(async () => {
      try {
        await this.saveReview(reviewResult, metadata, source, analysis, reviewId)
        console.log('[ReviewPersistenceService] Auto-save completed for review:', reviewId)
        this.pendingSaves.delete(reviewId)
      } catch (error) {
        console.error('[ReviewPersistenceService] Auto-save failed:', error)
      }
    }, this.autoSaveDelay)

    this.pendingSaves.set(reviewId, timeout)
  }

  /**
   * Convert SavedCodeReview back to ReviewResult for CodeReviewService
   */
  public convertToReviewResult(savedReview: SavedCodeReview): ReviewResult {
    // Convert SavedComments back to Comments (remove extra fields)
    const comments = savedReview.comments.map(savedComment => ({
      file: savedComment.file,
      lines: savedComment.lines,
      type: savedComment.type,
      severity: savedComment.severity,
      message: savedComment.message,
      fixCode: savedComment.fixCode
    }))

    return {
      hunks: savedReview.analysis.hunks,
      comments
    }
  }

  /**
   * Enable/disable auto-save
   */
  public setAutoSaveEnabled(enabled: boolean): void {
    this.autoSaveEnabled = enabled
    if (!enabled) {
      // Clear all pending saves
      this.pendingSaves.forEach(timeout => clearTimeout(timeout))
      this.pendingSaves.clear()
    }
  }

  /**
   * Set auto-save delay
   */
  public setAutoSaveDelay(delayMs: number): void {
    this.autoSaveDelay = delayMs
  }

  /**
   * Helper: Get existing review's created date
   */
  private async getExistingCreatedAt(reviewId: string): Promise<string | null> {
    try {
      const existingReview = await this.loadReview(reviewId)
      return existingReview.metadata.createdAt
    } catch {
      return null
    }
  }

  /**
   * Helper: Get next version number for existing review
   */
  private async getNextVersion(reviewId: string): Promise<number> {
    try {
      const existingReview = await this.loadReview(reviewId)
      return existingReview.metadata.version + 1
    } catch {
      return 1
    }
  }

  /**
   * Generate unique review ID
   */
  private generateReviewId(): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 9)
    return `review-${timestamp}-${random}`
  }

  /**
   * Generate unique comment ID
   */
  private generateCommentId(): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 9)
    return `comment-${timestamp}-${random}`
  }

  /**
   * Generate unique thread ID
   */
  private generateThreadId(): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 9)
    return `thread-${timestamp}-${random}`
  }

  /**
   * Clean up pending saves
   */
  public cleanup(): void {
    this.pendingSaves.forEach(timeout => clearTimeout(timeout))
    this.pendingSaves.clear()
    console.log('[ReviewPersistenceService] Cleanup completed')
  }
}