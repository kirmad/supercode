/**
 * Comment Threading Service
 * Handles creating new comment threads when user responds to AI comments,
 * managing AI sessions for comment conversations, and storing conversation history
 */

import { SessionManager, type SessionConfig, type MessagePayload, type StreamingCallbacks } from './SessionManager'
import { SuperCodeWebSocketClient } from './SuperCodeWebSocketClient'
import {
  CommentResponse,
  SavedComment,
  SavedHunk,
  ThreadContext,
  CommentThreadInfo,
  HunkThreadInfo,
  ThreadInfo
} from '../types/CodeReview'
import { Hunk } from './CodeReviewService'

export interface CommentThreadCallbacks {
  onThreadCreated?: (threadInfo: ThreadInfo) => void
  onResponseReceived?: (response: CommentResponse, threadId: string) => void
  onAIResponseChunk?: (chunk: string, threadId: string) => void
  onAIResponseComplete?: (fullContent: string, threadId: string) => void
  onError?: (error: string, threadId?: string) => void
}

/**
 * Service for handling comment threading and AI conversation management
 */
export class CommentThreadingService {
  private sessionManager: SessionManager
  private wsClient: SuperCodeWebSocketClient
  private readonly port: number = 25716

  // Thread management
  private activeThreads: Map<string, ThreadInfo> = new Map()
  private threadToSessionMap: Map<string, string> = new Map()

  // Callbacks for UI updates
  private callbacks?: CommentThreadCallbacks

  constructor(wsClient: SuperCodeWebSocketClient) {
    this.wsClient = wsClient
    this.sessionManager = new SessionManager(this.port)
  }

  /**
   * Set callback handlers for thread updates
   */
  public setCallbacks(callbacks: CommentThreadCallbacks) {
    this.callbacks = callbacks
  }

  /**
   * Create a new comment thread when user responds to an AI comment
   */
  public async createCommentThread(
    comment: SavedComment,
    userResponse: string,
    userName: string = 'User'
  ): Promise<CommentThreadInfo> {
    // Use the simple thread ID format that the UI expects: file-start-end
    const threadId = `${comment.file}-${comment.lines.start}-${comment.lines.end}`

    try {
      console.log('[CommentThreadingService] Creating new comment thread:', threadId)

      // Create thread context from the original comment
      const context: ThreadContext = {
        commentId: comment.id,
        file: comment.file,
        lines: comment.lines,
        originalMessage: comment.message,
        codeSnippet: this.extractCodeSnippet(comment),
        contextType: 'comment'
      }

      // Create initial response from user
      const userResponseObj: CommentResponse = {
        id: this.generateResponseId(),
        author: { type: 'user', name: userName },
        content: userResponse,
        createdAt: new Date().toISOString()
      }

      // Create thread info
      const threadInfo: CommentThreadInfo = {
        threadId,
        context,
        responses: [userResponseObj],
        isActive: true
      }

      // Store thread
      this.activeThreads.set(threadId, threadInfo)

      // Create AI session for this thread
      const sessionId = await this.createAISessionForThread(threadId, comment, userResponse)
      if (sessionId) {
        threadInfo.sessionId = sessionId
        this.threadToSessionMap.set(threadId, sessionId)

        // Send the initial user message to AI and get response
        await this.getAIResponseForThread(threadId, userResponse)
      }

      // Notify callbacks for thread creation and user response
      this.callbacks?.onThreadCreated?.(threadInfo)
      this.callbacks?.onResponseReceived?.(userResponseObj, threadId)

      console.log('[CommentThreadingService] Thread created successfully:', threadId)
      return threadInfo

    } catch (error) {
      const errorMessage = `Failed to create comment thread: ${error}`
      console.error('[CommentThreadingService]', errorMessage)
      this.callbacks?.onError?.(errorMessage, threadId)
      throw new Error(errorMessage)
    }
  }

  /**
   * Find thread by comment or create new thread if needed
   */
  public async findOrCreateThreadForComment(
    comment: SavedComment,
    userResponse: string,
    userName: string = 'User'
  ): Promise<CommentThreadInfo> {
    // First try to find existing thread by threadId
    let thread = this.activeThreads.get(comment.threadId)

    if (!thread) {
      // Try to find by comment ID
      thread = Array.from(this.activeThreads.values()).find(t =>
        t.context.commentId === comment.id
      )
    }

    if (!thread) {
      // Create new thread for this comment
      console.log('[CommentThreadingService] Creating new thread for comment:', comment.id)
      thread = await this.createCommentThread(comment, userResponse, userName)
    }

    return thread
  }

  /**
   * Add user response to existing thread and get AI response
   */
  public async addUserResponseToThread(
    threadId: string,
    userResponse: string,
    userName: string = 'User'
  ): Promise<CommentResponse> {
    let thread = this.activeThreads.get(threadId)

    // If thread not found by threadId, try to find by comment ID or create new one
    if (!thread) {
      // Check if threadId looks like a comment-based ID (file-line-line format)
      if (threadId.includes('-') && /\d+-\d+$/.test(threadId)) {
        // This might be a comment from existing review, try to find matching comment
        console.log('[CommentThreadingService] Thread not found, checking for matching comments:', threadId)

        // In this case, we need the comment object to create a proper thread
        // For now, throw a more helpful error
        throw new Error(`Thread not found and cannot create without comment context: ${threadId}`)
      } else {
        throw new Error(`Thread not found: ${threadId}`)
      }
    }

    try {
      console.log('[CommentThreadingService] Adding user response to thread:', threadId)

      // Create user response
      const userResponseObj: CommentResponse = {
        id: this.generateResponseId(),
        author: { type: 'user', name: userName },
        content: userResponse,
        createdAt: new Date().toISOString(),
        sessionId: thread.sessionId
      }

      // Add to thread
      thread.responses.push(userResponseObj)

      // Notify callback
      this.callbacks?.onResponseReceived?.(userResponseObj, threadId)

      // Get AI response if we have a session
      if (thread.sessionId) {
        await this.getAIResponseForThread(threadId, userResponse)
      }

      return userResponseObj

    } catch (error) {
      const errorMessage = `Failed to add user response: ${error}`
      console.error('[CommentThreadingService]', errorMessage)
      this.callbacks?.onError?.(errorMessage, threadId)
      throw new Error(errorMessage)
    }
  }

  /**
   * Create a new hunk thread when user asks about a code change
   */
  public async createHunkThread(
    hunk: Hunk,
    userQuestion: string,
    userName: string = 'User'
  ): Promise<HunkThreadInfo> {
    // Use hunk-specific thread ID format: file-hunk-start-end
    const threadId = `${hunk.file}-hunk-${hunk.start}-${hunk.end}`

    try {
      console.log('[CommentThreadingService] Creating new hunk thread:', threadId)

      // Create thread context from the hunk
      const context: ThreadContext = {
        hunkId: `${hunk.file}-${hunk.start}-${hunk.end}`,
        file: hunk.file,
        lines: { start: hunk.start, end: hunk.end },
        originalMessage: hunk.description,
        codeSnippet: this.extractHunkCodeSnippet(hunk),
        contextType: 'hunk'
      }

      // Create initial response from user
      const userResponseObj: CommentResponse = {
        id: this.generateResponseId(),
        author: { type: 'user', name: userName },
        content: userQuestion,
        createdAt: new Date().toISOString()
      }

      // Create thread info
      const threadInfo: HunkThreadInfo = {
        threadId,
        context,
        responses: [userResponseObj],
        isActive: true
      }

      // Store thread
      this.activeThreads.set(threadId, threadInfo)

      // Create AI session for this thread
      const sessionId = await this.createAISessionForHunk(threadId, hunk, userQuestion)
      if (sessionId) {
        threadInfo.sessionId = sessionId
        this.threadToSessionMap.set(threadId, sessionId)

        // Send the initial user question to AI and get response
        await this.getAIResponseForThread(threadId, userQuestion)
      }

      // Notify callbacks for thread creation and user response
      this.callbacks?.onThreadCreated?.(threadInfo)
      this.callbacks?.onResponseReceived?.(userResponseObj, threadId)

      console.log('[CommentThreadingService] Hunk thread created successfully:', threadId)
      return threadInfo

    } catch (error) {
      const errorMessage = `Failed to create hunk thread: ${error}`
      console.error('[CommentThreadingService]', errorMessage)
      this.callbacks?.onError?.(errorMessage, threadId)
      throw new Error(errorMessage)
    }
  }

  /**
   * Find or create hunk thread for a specific hunk
   */
  public async findOrCreateHunkThread(
    hunk: Hunk,
    userQuestion: string,
    userName: string = 'User'
  ): Promise<HunkThreadInfo> {
    const threadId = `${hunk.file}-hunk-${hunk.start}-${hunk.end}`
    let thread = this.activeThreads.get(threadId) as HunkThreadInfo

    if (!thread || thread.context.contextType !== 'hunk') {
      // Create new thread for this hunk
      console.log('[CommentThreadingService] Creating new thread for hunk:', hunk.file, hunk.start, hunk.end)
      thread = await this.createHunkThread(hunk, userQuestion, userName)
    }

    return thread
  }

  /**
   * Get AI response for a thread
   */
  private async getAIResponseForThread(threadId: string, userInput: string): Promise<void> {
    const thread = this.activeThreads.get(threadId)
    if (!thread || !thread.sessionId) {
      throw new Error(`No active session for thread: ${threadId}`)
    }

    try {
      console.log('[CommentThreadingService] Getting AI response for thread:', threadId)

      // Build conversation context prompt
      const contextPrompt = this.buildContextPrompt(thread, userInput)

      // Setup streaming callbacks
      const streamingCallbacks: StreamingCallbacks = {
        onChunk: (chunk: string) => {
          this.callbacks?.onAIResponseChunk?.(chunk, threadId)
        },
        onMessagePart: (part: any) => {
          if (part && part.text && typeof part.text === 'string') {
            this.callbacks?.onAIResponseChunk?.(part.text, threadId)
          }
        },
        onComplete: (fullContent: string) => {
          console.log('[CommentThreadingService] AI response complete for thread:', threadId)

          // Create AI response object
          const aiResponse: CommentResponse = {
            id: this.generateResponseId(),
            author: { type: 'ai', name: 'AI Assistant' },
            content: fullContent,
            createdAt: new Date().toISOString(),
            sessionId: thread.sessionId
          }

          // Add to thread
          thread.responses.push(aiResponse)

          // Notify callbacks
          this.callbacks?.onResponseReceived?.(aiResponse, threadId)
          this.callbacks?.onAIResponseComplete?.(fullContent, threadId)
        },
        onError: (error: Error) => {
          console.error('[CommentThreadingService] AI response error:', error)
          this.callbacks?.onError?.(error.message, threadId)
        }
      }

      // Create message payload
      const messagePayload: MessagePayload = {
        parts: [
          {
            type: 'text',
            text: contextPrompt
          }
        ]
      }

      // Send message with streaming
      await this.sessionManager.sendMessageWithStreaming(messagePayload, {
        sessionId: thread.sessionId,
        includeSessionFilter: true,
        callbacks: streamingCallbacks
      })

    } catch (error) {
      const errorMessage = `Failed to get AI response: ${error}`
      console.error('[CommentThreadingService]', errorMessage)
      this.callbacks?.onError?.(errorMessage, threadId)
      throw new Error(errorMessage)
    }
  }

  /**
   * Create AI session for a comment thread
   */
  private async createAISessionForThread(
    threadId: string,
    comment: SavedComment,
    userResponse: string
  ): Promise<string | null> {
    try {
      console.log('[CommentThreadingService] Creating AI session for thread:', threadId)

      const sessionConfig: SessionConfig = {
        directory: '.',
        projectID: 'vscode-webview-comments',
        providerID: 'anthropic',
        modelID: 'claude-3-5-sonnet-latest'
      }

      const sessionId = await this.sessionManager.createSession(sessionConfig)
      console.log('[CommentThreadingService] AI session created:', sessionId)

      return sessionId

    } catch (error) {
      console.error('[CommentThreadingService] Failed to create AI session:', error)
      return null
    }
  }

  /**
   * Build context prompt for AI conversation
   */
  private buildContextPrompt(thread: ThreadInfo, userInput: string): string {
    const { context } = thread

    let prompt = ''

    if (context.contextType === 'comment') {
      prompt = `You are helping with a code review conversation. Here's the context:

**Original Comment Context:**
- File: ${context.file}
- Lines: ${context.lines.start}-${context.lines.end}
- Original AI Comment: ${context.originalMessage}

`
    } else if (context.contextType === 'hunk') {
      prompt = `You are helping explain a code change during a code review. Here's the context:

**Code Change Context:**
- File: ${context.file}
- Lines: ${context.lines.start}-${context.lines.end}
- Change Description: ${context.originalMessage}

`
    }

    // Add code snippet if available
    if (context.codeSnippet) {
      const contextLabel = context.contextType === 'hunk' ? 'Code Changes' : 'Code Context'
      prompt += `**${contextLabel}:**
\`\`\`
${context.codeSnippet}
\`\`\`

`
    }

    // Add conversation history
    if (thread.responses.length > 1) {
      prompt += `**Conversation History:**
`
      thread.responses.slice(0, -1).forEach(response => {
        prompt += `${response.author.name}: ${response.content}\n`
      })
      prompt += '\n'
    }

    prompt += `**Latest User Message:**
${userInput}

`

    if (context.contextType === 'hunk') {
      prompt += `Please provide a helpful explanation that addresses the user's question about this code change. Focus on explaining what the change does, why it might be necessary, and any potential impacts or considerations.`
    } else {
      prompt += `Please provide a helpful response that addresses the user's question or feedback about the code review comment. Keep the response focused on the specific code and context mentioned above.`
    }

    return prompt
  }

  /**
   * Extract code snippet from comment context (mock implementation)
   */
  private extractCodeSnippet(comment: SavedComment): string | undefined {
    // In a real implementation, this would fetch the actual code lines
    // from the file at the specified line range
    return `// Code snippet from ${comment.file} lines ${comment.lines.start}-${comment.lines.end}\n// This would contain the actual code`
  }

  /**
   * Extract code snippet from hunk context (mock implementation)
   */
  private extractHunkCodeSnippet(hunk: Hunk): string | undefined {
    // In a real implementation, this would fetch the actual code changes
    // from the diff at the specified line range
    return `// Code changes in ${hunk.file} lines ${hunk.start}-${hunk.end}\n// ${hunk.category} - ${hunk.description}\n// This would contain the actual diff`
  }

  /**
   * Create AI session for a hunk thread
   */
  private async createAISessionForHunk(
    threadId: string,
    hunk: Hunk,
    userQuestion: string
  ): Promise<string | null> {
    try {
      console.log('[CommentThreadingService] Creating AI session for hunk thread:', threadId)

      const sessionConfig: SessionConfig = {
        directory: '.',
        projectID: 'vscode-webview-hunk-discussion',
        providerID: 'anthropic',
        modelID: 'claude-3-5-sonnet-latest'
      }

      const sessionId = await this.sessionManager.createSession(sessionConfig)
      console.log('[CommentThreadingService] AI session created for hunk:', sessionId)

      return sessionId

    } catch (error) {
      console.error('[CommentThreadingService] Failed to create AI session for hunk:', error)
      return null
    }
  }

  /**
   * Get thread information
   */
  public getThread(threadId: string): ThreadInfo | undefined {
    return this.activeThreads.get(threadId)
  }

  /**
   * Get all active threads
   */
  public getAllThreads(): ThreadInfo[] {
    return Array.from(this.activeThreads.values())
  }

  /**
   * Close a thread (mark as inactive)
   */
  public closeThread(threadId: string): void {
    const thread = this.activeThreads.get(threadId)
    if (thread) {
      thread.isActive = false
      console.log('[CommentThreadingService] Thread closed:', threadId)
    }
  }

  /**
   * Clear all threads
   */
  public clearAllThreads(): void {
    this.activeThreads.clear()
    this.threadToSessionMap.clear()
    console.log('[CommentThreadingService] All threads cleared')
  }

  /**
   * Generate unique thread ID
   */
  private generateThreadId(commentId: string): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 9)
    return `thread-${commentId}-${timestamp}-${random}`
  }

  /**
   * Generate unique response ID
   */
  private generateResponseId(): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 9)
    return `response-${timestamp}-${random}`
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    this.clearAllThreads()
    console.log('[CommentThreadingService] Cleanup completed')
  }
}