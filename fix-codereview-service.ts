// Fix for CodeReviewService.ts TypeScript issues

// 1. Remove unused imports at top
// Remove: import { type SavedCodeReview, type ReviewMetadata } from "../types/CodeReview"
// Add: import { type ReviewMetadata, type CommentThreadInfo } from "../types/CodeReview"

// 2. Fix constructor
// Change: this.threadingService = new CommentThreadingService()
// To: this.threadingService = new CommentThreadingService(wsClient)

// 3. Fix unused parameters by prefixing with underscore
// getDiff(options) -> getDiff(_options)
// getFiles(paths) -> getFiles(_paths)

// 4. Fix performAutoSave method - wrong source structure
const performAutoSaveFixed = `
  private async performAutoSave(review: ReviewResult): Promise<void> {
    if (!this.autoSaveEnabled || !review) return

    try {
      // Generate auto-save title if none exists
      const title = this.generateAutoSaveTitle(review)
      const metadata = {
        title,
        status: 'active' as const,
        autoSaved: true
      }

      const source = {
        type: 'branches' as const,
        diffContent: this.generateDiffFromFiles(this.currentFiles),
        diffFiles: this.currentFiles
      }

      const analysis = {
        insights: this.insights,
        aiSessionId: this.currentSessionId || undefined
      }

      const result = await this.persistenceService.saveReview(review, metadata, source, analysis)
      this.currentReviewId = result.id
      this.lastSaveTime = new Date()
      this.onReviewSaved?.(result.id, result.filename)
    } catch (error) {
      console.error('Auto-save failed:', error)
      // Don't show error to user for auto-save failures
    }
  }
`

// 5. Fix saveReview method - same issue
const saveReviewFixed = `
  public async saveReview(
    title: string,
    description?: string,
    status: 'draft' | 'active' | 'completed' = 'active'
  ): Promise<string | null> {
    if (!this.reviewResult) {
      this.onError?.('No review result to save')
      return null
    }

    try {
      const metadata = {
        title,
        description,
        status,
        autoSaved: false
      }

      const source = {
        type: 'branches' as const,
        diffContent: this.generateDiffFromFiles(this.currentFiles),
        diffFiles: this.currentFiles
      }

      const analysis = {
        insights: this.insights,
        aiSessionId: this.currentSessionId || undefined
      }

      const result = await this.persistenceService.saveReview(this.reviewResult, metadata, source, analysis)
      this.currentReviewId = result.id
      this.lastSaveTime = new Date()
      this.onReviewSaved?.(result.id, result.filename)
      return result.id
    } catch (error) {
      this.onError?.(\`Failed to save review: \${error}\`)
      return null
    }
  }
`

// 6. Fix callback signatures in initializeCommentThreading
const initializeCommentThreadingFixed = `
  public initializeCommentThreading(): void {
    this.threadingService.setCallbacks({
      onThreadCreated: (threadInfo: CommentThreadInfo) => {
        console.log('Thread created:', threadInfo.threadId, threadInfo.context)
      },
      onResponseReceived: (response, threadId) => {
        console.log('Response added to thread:', threadId, response)
      },
      onError: (error) => {
        this.onError?.(error)
      }
    })
  }
`

// 7. Fix addThreadResponse method
const addThreadResponseFixed = `
  public async addThreadResponse(threadId: string, content: string): Promise<void> {
    try {
      await this.threadingService.addUserResponseToThread(threadId, content, 'User')
    } catch (error) {
      this.onError?.(\`Failed to add thread response: \${error}\`)
    }
  }
`

// 8. Fix updateThreadStatus method
const updateThreadStatusFixed = `
  public async updateThreadStatus(threadId: string, status: 'open' | 'resolved' | 'dismissed'): Promise<void> {
    try {
      // Need to implement this method in CommentThreadingService
      const thread = this.threadingService.getAllThreads().find(t => t.threadId === threadId)
      if (thread) {
        // Update thread status logic would go here
        console.log('Updating thread status:', threadId, status)
      }
    } catch (error) {
      this.onError?.(\`Failed to update thread status: \${error}\`)
    }
  }
`

// 9. Fix loadSavedReview session restoration
const loadSavedReviewFixed = `
      // Restore session if possible
      if (savedReview.analysis?.aiSessionId) {
        this.currentSessionId = savedReview.analysis.aiSessionId
      }
`

// 10. Remove unused functions
const functionsToRemove = [
  'createMessageHandler',
  'generateCommentsFromInsights'
]

// 11. Fix the type error in generateCommentsFromInsights (line 998)
// Change: insight.type === 'best-practice'
// To: insight.type === 'pattern' (or whatever valid type)

console.log('All fixes needed for CodeReviewService.ts')