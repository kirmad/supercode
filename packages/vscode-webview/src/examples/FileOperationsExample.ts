/**
 * Example implementation showing how to integrate the comment threading
 * and review persistence services together
 */

import { CodeReviewService } from '../services/CodeReviewService'
import { CommentThreadingService } from '../services/CommentThreadingService'
import { ReviewPersistenceService } from '../services/ReviewPersistenceService'
import { SuperCodeWebSocketClient } from '../services/SuperCodeWebSocketClient'
import type { SavedCodeReview } from '../types/CodeReview'

/**
 * Example class that demonstrates the integration of all services
 */
export class CodeReviewIntegrationExample {
  private codeReviewService: CodeReviewService
  private commentThreadingService: CommentThreadingService
  private reviewPersistenceService: ReviewPersistenceService
  private wsClient: SuperCodeWebSocketClient

  constructor() {
    // Initialize WebSocket client
    this.wsClient = new SuperCodeWebSocketClient({
      baseUrl: 'http://localhost',
      port: 25716,
      timeout: 30000
    })

    // Initialize services
    this.codeReviewService = new CodeReviewService(this.wsClient)
    this.commentThreadingService = new CommentThreadingService(this.wsClient)
    this.reviewPersistenceService = new ReviewPersistenceService()

    this.setupCallbacks()
  }

  /**
   * Setup callbacks for service integration
   */
  private setupCallbacks(): void {
    // Code review callbacks
    this.codeReviewService.setCallbacks({
      onInsightReceived: (insight) => {
        console.log('📋 New insight received:', insight)
      },
      onReviewComplete: (result) => {
        console.log('✅ Review completed:', result)
        this.handleReviewComplete(result)
      },
      onProgressUpdate: (message) => {
        console.log('🔄 Progress:', message)
      },
      onError: (error) => {
        console.error('❌ Code review error:', error)
      }
    })

    // Comment threading callbacks
    this.commentThreadingService.setCallbacks({
      onThreadCreated: (threadInfo) => {
        console.log('🧵 Thread created:', threadInfo.threadId)
      },
      onResponseReceived: (response, threadId) => {
        console.log('💬 Response received in thread', threadId, ':', response)
        this.handleCommentResponse(response, threadId)
      },
      onAIResponseChunk: (chunk, threadId) => {
        console.log('🔗 AI chunk for thread', threadId, ':', chunk.length, 'chars')
      },
      onAIResponseComplete: (_fullContent, threadId) => {
        console.log('✅ AI response complete for thread', threadId)
      },
      onError: (error, threadId) => {
        console.error('❌ Comment threading error:', error, 'Thread:', threadId)
      }
    })

    // Review persistence callbacks
    this.reviewPersistenceService.setCallbacks({
      onReviewSaved: (reviewId, filename) => {
        console.log('💾 Review saved:', reviewId, 'as', filename)
      },
      onReviewLoaded: (review) => {
        console.log('📂 Review loaded:', review.id)
      },
      onReviewDeleted: (reviewId) => {
        console.log('🗑️ Review deleted:', reviewId)
      },
      onCommentResponseAdded: (responseId, commentId) => {
        console.log('📝 Comment response added:', responseId, 'to comment', commentId)
      },
      onError: (error) => {
        console.error('❌ Persistence error:', error)
      }
    })
  }

  /**
   * Example: Start a code review and auto-save it
   */
  public async startAndSaveReview(): Promise<void> {
    try {
      console.log('🚀 Starting integrated code review example...')

      // Start a code review for staged changes
      const reviewResult = await this.codeReviewService.startReview({
        staged: true
      })

      if (reviewResult) {
        console.log('📊 Review result:', reviewResult)

        // Save the review
        await this.saveCurrentReview(reviewResult)
      }

    } catch (error) {
      console.error('❌ Failed to start and save review:', error)
    }
  }

  /**
   * Example: Load a saved review and enable comment threading
   */
  public async loadReviewAndEnableThreading(reviewId: string): Promise<SavedCodeReview | undefined> {
    try {
      console.log('📂 Loading review for threading:', reviewId)

      // Load the saved review
      const savedReview = await this.reviewPersistenceService.loadReview(reviewId)
      console.log('✅ Review loaded:', savedReview.metadata.title)

      // Display comments and enable threading
      for (const comment of savedReview.comments) {
        console.log('💬 Comment available for threading:', comment.id, comment.message)
      }

      return savedReview

    } catch (error) {
      console.error('❌ Failed to load review for threading:', error)
      return undefined
    }
  }

  /**
   * Example: User responds to a comment, creating a thread
   */
  public async respondToComment(
    savedReview: SavedCodeReview,
    commentId: string,
    userResponse: string
  ): Promise<void> {
    try {
      console.log('💬 User responding to comment:', commentId)

      // Find the comment
      const comment = savedReview.comments.find(c => c.id === commentId)
      if (!comment) {
        throw new Error(`Comment not found: ${commentId}`)
      }

      // Create comment thread
      const threadInfo = await this.commentThreadingService.createCommentThread(
        comment,
        userResponse,
        'User'
      )

      console.log('🧵 Thread created:', threadInfo.threadId)

      // Save the response to persistence
      if (threadInfo.responses.length > 0) {
        const latestResponse = threadInfo.responses[threadInfo.responses.length - 1]

        await this.reviewPersistenceService.addCommentResponse(
          savedReview.id,
          commentId,
          latestResponse.content,
          latestResponse.author,
          threadInfo.sessionId
        )
      }

    } catch (error) {
      console.error('❌ Failed to respond to comment:', error)
    }
  }

  /**
   * Example: Continue a conversation in a thread
   */
  public async continueThread(threadId: string, userInput: string): Promise<void> {
    try {
      console.log('🔄 Continuing thread conversation:', threadId)

      const response = await this.commentThreadingService.addUserResponseToThread(
        threadId,
        userInput,
        'User'
      )

      console.log('✅ User response added to thread:', response.id)

    } catch (error) {
      console.error('❌ Failed to continue thread:', error)
    }
  }

  /**
   * Handle review completion - auto-save the review
   */
  private async handleReviewComplete(reviewResult: any): Promise<void> {
    try {
      await this.saveCurrentReview(reviewResult)
    } catch (error) {
      console.error('❌ Failed to auto-save completed review:', error)
    }
  }

  /**
   * Handle comment response - update persistence
   */
  private async handleCommentResponse(response: any, threadId: string): Promise<void> {
    try {
      const threadInfo = this.commentThreadingService.getThread(threadId)
      if (threadInfo && response.author.type === 'ai') {
        console.log('🤖 AI response received, could update persistence here')
        // Note: In a real implementation, you'd update the saved review with the AI response
      }
    } catch (error) {
      console.error('❌ Failed to handle comment response:', error)
    }
  }

  /**
   * Save current review with generated metadata
   */
  private async saveCurrentReview(reviewResult: any): Promise<void> {
    const currentFiles = this.codeReviewService.getCurrentFiles()
    const state = this.codeReviewService.getState()

    // Generate review metadata
    const metadata = {
      title: `Code Review - ${new Date().toLocaleDateString()}`,
      status: 'active' as const
    }

    // Generate source information
    const source = {
      type: 'staged' as const,
      diffContent: 'Generated from staged changes',
      diffFiles: currentFiles
    }

    // Generate analysis information
    const analysis = {
      insights: state.insights || []
    }

    // Save to persistence
    await this.reviewPersistenceService.saveReview(
      reviewResult,
      metadata,
      source,
      analysis
    )
  }

  /**
   * Cleanup all services
   */
  public cleanup(): void {
    this.commentThreadingService.cleanup()
    this.reviewPersistenceService.cleanup()
    console.log('🧹 Integration example cleanup completed')
  }
}

/**
 * Example usage function
 */
export async function runCodeReviewIntegrationExample(): Promise<void> {
  const example = new CodeReviewIntegrationExample()

  try {
    console.log('🎯 Running code review integration example...')

    // Example 1: Start and save a review
    await example.startAndSaveReview()

    // Example 2: Load a review (would need a real review ID)
    // const reviewId = 'some-review-id'
    // const savedReview = await example.loadReviewAndEnableThreading(reviewId)

    // Example 3: Respond to a comment (would need real data)
    // await example.respondToComment(savedReview, 'comment-id', 'Can you explain this suggestion?')

    console.log('✅ Integration example completed successfully')

  } catch (error) {
    console.error('❌ Integration example failed:', error)
  } finally {
    example.cleanup()
  }
}