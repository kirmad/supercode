import { XMLParser } from "../utils/XMLUtils"
import { SuperCodeWebSocketClient } from "./SuperCodeWebSocketClient"
import { SessionManager, type StreamingCallbacks, type MessagePayload, type SessionConfig } from "./SessionManager"
import { debounce } from "../utils/debounce"

/**
 * Types for code review functionality
 */
export interface ReviewInsight {
  type: 'security' | 'bug' | 'performance' | 'quality' | 'pattern'
  severity: 'high' | 'medium' | 'low'
  message: string
}

export interface Hunk {
  file: string
  start: number
  end: number
  category: 'feature' | 'bugfix' | 'refactor' | 'security-fix' | 'performance' | 'test'
  risk: 'high' | 'medium' | 'low'
  description: string
  needsAttention: boolean
}

export interface Comment {
  file: string
  lines: {
    start: number
    end: number
  }
  type: 'issue' | 'suggestion' | 'praise'
  severity: 'high' | 'medium' | 'low'
  message: string
  fixCode?: string
}

export interface ReviewResult {
  hunks: Hunk[]
  comments: Comment[]
}

export interface DiffFile {
  path: string
  oldContent?: string
  newContent?: string
  diff?: string
  additions?: number
  deletions?: number
  patches?: Array<{
    oldStart: number
    oldLines: number
    newStart: number
    newLines: number
    lines: string[]
  }>
}

/**
 * Service for handling code review operations
 */
export class CodeReviewService {
  private xmlParser: XMLParser
  private wsClient: SuperCodeWebSocketClient
  private sessionManager: SessionManager
  private readonly port: number = 25716

  private insights: ReviewInsight[] = []
  private reviewResult: ReviewResult | null = null
  private isReviewing = false
  private currentFiles: DiffFile[] = []
  private currentSessionId: string | null = null
  private accumulatedContent = '' // Accumulate streaming content for complete XML parsing

  // Callbacks for UI updates
  private onInsightReceived?: (insight: ReviewInsight) => void
  private onReviewComplete?: (result: ReviewResult) => void
  private onProgressUpdate?: (message: string) => void
  private onError?: (error: string) => void

  constructor(wsClient: SuperCodeWebSocketClient) {
    this.xmlParser = new XMLParser()
    this.wsClient = wsClient
    this.sessionManager = new SessionManager(this.port)
  }

  /**
   * Set callback handlers for UI updates
   */
  public setCallbacks(callbacks: {
    onInsightReceived?: (insight: ReviewInsight) => void
    onReviewComplete?: (result: ReviewResult) => void
    onProgressUpdate?: (message: string) => void
    onError?: (error: string) => void
  }) {
    this.onInsightReceived = callbacks.onInsightReceived
    this.onReviewComplete = callbacks.onReviewComplete
    this.onProgressUpdate = callbacks.onProgressUpdate
    this.onError = callbacks.onError
  }

  /**
   * Fetch git diff from the server
   */
  private async fetchGitDiff(params: {
    sourceBranch?: string
    targetBranch?: string
    commitHash?: string
    staged?: boolean
  }): Promise<{ diff: string; files: Array<{ path: string; additions: number; deletions: number }> }> {
    try {
      const response = await fetch(`http://localhost:${this.port}/git/diff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params)
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch git diff: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('[CodeReviewService] Failed to fetch git diff:', error)
      throw error
    }
  }

  /**
   * Fetch file content at a specific git revision
   */
  private async fetchFileContent(path: string, ref?: string): Promise<string> {
    try {
      const response = await fetch(`http://localhost:${this.port}/git/file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path, ref })
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch file content: ${response.statusText}`)
      }

      const data = await response.json()
      return data.content || ''
    } catch (error) {
      console.error('[CodeReviewService] Failed to fetch file content:', error)
      return ''
    }
  }

  /**
   * Fetch git status from the server
   */
  public async fetchGitStatus(): Promise<{
    branch: string
    ahead: number
    behind: number
    modified: string[]
    staged: string[]
    untracked: string[]
  }> {
    try {
      const response = await fetch(`http://localhost:${this.port}/git/status`)
      if (!response.ok) {
        throw new Error(`Failed to fetch git status: ${response.statusText}`)
      }
      return await response.json()
    } catch (error) {
      console.error('[CodeReviewService] Failed to fetch git status:', error)
      throw error
    }
  }

  /**
   * Fetch git branches from the server
   */
  public async fetchGitBranches(): Promise<{ current: string; branches: string[] }> {
    try {
      const response = await fetch(`http://localhost:${this.port}/git/branches`)
      if (!response.ok) {
        throw new Error(`Failed to fetch git branches: ${response.statusText}`)
      }
      return await response.json()
    } catch (error) {
      console.error('[CodeReviewService] Failed to fetch git branches:', error)
      throw error
    }
  }

  /**
   * Fetch recent commits
   */
  public async fetchRecentCommits(limit = 20, branch?: string): Promise<Array<{
    hash: string
    shortHash: string
    subject: string
    author: string
    date: string
  }>> {
    try {
      const params = new URLSearchParams()
      params.set('limit', limit.toString())
      if (branch) params.set('branch', branch)

      const response = await fetch(`http://localhost:${this.port}/git/commits?${params}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch commits: ${response.statusText}`)
      }
      const data = await response.json()
      return data.commits || []
    } catch (error) {
      console.error('[CodeReviewService] Failed to fetch commits:', error)
      return []
    }
  }

  /**
   * Start a code review for the provided diff or files
   */
  public async startReview(options: {
    diff?: string
    files?: DiffFile[]
    commitHash?: string
    sourceBranch?: string
    targetBranch?: string
    staged?: boolean
  }): Promise<ReviewResult | null> {
    if (this.isReviewing) {
      this.onError?.("A review is already in progress")
      return null
    }

    try {
      this.isReviewing = true
      this.insights = []
      this.reviewResult = null
      this.currentFiles = options.files || []

      // Prepare the command
      let command = '/code-review'
      let diffContent = options.diff || ''
      let diffFiles: Array<{ path: string; additions: number; deletions: number }> = []

      // Fetch real git diff if we have branch information or commit hash
      if (!diffContent && (options.sourceBranch || options.commitHash || options.staged)) {
        this.onProgressUpdate?.("Fetching git diff...")
        const gitDiffResult = await this.fetchGitDiff({
          sourceBranch: options.sourceBranch,
          targetBranch: options.targetBranch,
          commitHash: options.commitHash,
          staged: options.staged
        })
        diffContent = gitDiffResult.diff
        diffFiles = gitDiffResult.files

        // Parse the diff to extract file information
        if (diffContent) {
          this.currentFiles = await this.parseDiffToFiles(diffContent, diffFiles)
        }
      } else if (!diffContent && options.files) {
        // If no diff provided but files are, generate diff from files
        diffContent = this.generateDiffFromFiles(options.files)
      }

      // If we have branch information, include it
      if (options.sourceBranch && options.targetBranch) {
        command += ` --source ${options.sourceBranch} --target ${options.targetBranch}`
      } else if (options.commitHash) {
        command += ` --commit ${options.commitHash}`
      }

      // Construct the full prompt with command and diff content
      let fullPrompt = command
      if (diffContent) {
        fullPrompt += '\n\n' + diffContent
      }

      console.log('📤 Sending review prompt:', fullPrompt)

      this.onProgressUpdate?.("Starting review...")

      // Create a session if we don't have one
      if (!this.sessionManager.getCurrentSessionId()) {
        console.log('[CodeReviewService] Creating new session for review')

        const sessionConfig: SessionConfig = {
          directory: '.',
          projectID: 'vscode-webview',
          providerID: 'anthropic',
          modelID: 'claude-3-5-sonnet-latest'
        }

        const sessionId = await this.sessionManager.createSession(sessionConfig)
        this.currentSessionId = sessionId
        console.log('[CodeReviewService] Session created:', sessionId)
      }

      // Reset accumulated content for new review
      this.accumulatedContent = ''

      // Setup streaming callbacks to process content in real-time
      const streamingCallbacks: StreamingCallbacks = {
        onChunk: (chunk: string) => {
          // Process review insights and results from chunks (not final)
          console.log('[CodeReviewService] Chunk received, length:', chunk.length)
          if (chunk.length < 500) {
            console.log('[CodeReviewService] Chunk content:', chunk)
          }

          // Skip if this looks like template/instruction content
          if (chunk.includes('## Review Guidelines') ||
              chunk.includes('[path/to/file') ||
              chunk.includes('**`<review-result>` tag**')) {
            console.log('[CodeReviewService] Skipping template/instruction chunk')
            return
          }

          this.processStreamingContent(chunk, false)
        },
        onMessagePart: (part: any) => {
          // Process structured message parts (not final)
          console.log('[CodeReviewService] Message part received:', JSON.stringify(part).substring(0, 200))

          // Only process agent messages, not user messages
          // Check for role or other indicators
          if (part && part.text && typeof part.text === 'string') {
            // Skip if this looks like a user message or template
            if (part.role === 'user' || part.text.includes('## Review Guidelines')) {
              console.log('[CodeReviewService] Skipping user/template message part')
              return
            }
            this.processStreamingContent(part.text, false)
          }
        },
        onComplete: (fullContent: string) => {
          console.log('[CodeReviewService] Streaming complete, received', fullContent.length, 'characters')
          console.log('[CodeReviewService] First 1000 chars of full content:', fullContent.substring(0, 1000))

          // Don't reset accumulated content - we've been building it from message parts
          // Just mark as final for any remaining parsing
          this.processStreamingContent('', true) // Pass empty string since we already have everything in accumulated content
          if (!this.reviewResult) {
            console.log('⚠️ No review result found in response, creating empty result')
            // If no explicit review result, create one from insights
            this.reviewResult = {
              hunks: [],
              comments: []
            }
          }

          // Don't generate comments from insights - keep them separate
          // Insights are displayed in their own section, not as inline comments

          this.isReviewing = false
          this.onProgressUpdate?.("Review complete")
        },
        onError: (error: Error) => {
          console.error('[CodeReviewService] Streaming error:', error)
          this.isReviewing = false
          this.onError?.(error.message)
        }
      }

      // Create message payload for SessionManager
      const messagePayload: MessagePayload = {
        parts: [
          {
            type: 'text',
            text: fullPrompt
          }
        ]
      }

      // Use SessionManager to send message and process streaming response
      const fullContent = await this.sessionManager.sendMessageWithStreaming(messagePayload, {
        includeSessionFilter: true,
        callbacks: streamingCallbacks
      })

      return this.reviewResult

    } catch (error) {
      this.isReviewing = false
      this.onError?.(`Failed to start review: ${error}`)
      return null
    }
  }

  /**
   * Get files from the local codebase or via API
   */
  public async getFiles(paths: string[]): Promise<DiffFile[]> {
    const files: DiffFile[] = []

    // Note: Currently the WebSocket API doesn't have a direct file reading endpoint
    // This would need to be implemented server-side or use a different approach
    // For now, we'll return empty files array
    // In a real implementation, you might:
    // 1. Use the file system API if available
    // 2. Send a command to read files via the prompt
    // 3. Implement a custom endpoint on the server

    this.onError?.("File reading not yet implemented in WebSocket API")
    return files
  }

  /**
   * Get diff between two commits or branches
   */
  public async getDiff(options: {
    sourceBranch?: string
    targetBranch?: string
    commitHash?: string
  }): Promise<string> {
    // Note: Getting git diff would require sending a command through the prompt
    // For now, we'll return empty string
    // In a real implementation, you might:
    // 1. Execute git commands locally if available
    // 2. Send a git diff command via the prompt
    // 3. Implement a custom endpoint on the server

    this.onError?.("Git diff not yet implemented in WebSocket API")
    return ''
  }

  /**
   * Cancel an ongoing review
   */
  public async cancelReview(): Promise<void> {
    if (this.isReviewing) {
      this.isReviewing = false

      try {
        // Cancel the current prompt
        await this.wsClient.cancelPrompt()

        // Clear the session if we have one
        if (this.currentSessionId) {
          await this.wsClient.deleteSession(this.currentSessionId)
          this.currentSessionId = null
        }

        // Unsubscribe from events
        this.wsClient.unsubscribeFromEvents()

        this.onProgressUpdate?.("Review cancelled")
      } catch (error) {
        console.error('Error cancelling review:', error)
      }
    }
  }

  /**
   * Get current review state
   */
  public getState() {
    return {
      isReviewing: this.isReviewing,
      insights: this.insights,
      reviewResult: this.reviewResult,
      files: this.currentFiles
    }
  }

  /**
   * Process streaming content from the agent
   */
  private processStreamingContent(content: string, isFinal: boolean = false): void {
    try {
      // Accumulate content for complete XML parsing
      this.accumulatedContent += content

      // Parse review insights (streaming) - these can be parsed incrementally
      const insightMatches = this.accumulatedContent.matchAll(/<review-insight[^>]*>([\s\S]*?)<\/review-insight>/g)
      for (const match of insightMatches) {
        const insight = this.parseInsight(match[0])
        if (insight && !this.insights.some(i => i.message === insight.message)) {
          this.insights.push(insight)
          this.onInsightReceived?.(insight)
          console.log('💡 Insight received:', insight)
        }
      }

      // Parse review result only when we have the complete content
      // Check if we have a complete review-result section (with closing tag)
      const hasCompleteReviewResult = this.accumulatedContent.includes('<review-result>') &&
                                      this.accumulatedContent.includes('</review-result>')

      if ((hasCompleteReviewResult || isFinal) && !this.reviewResult) {
        // Look for ALL review-result sections in case there are multiple
        const allResultMatches = [...this.accumulatedContent.matchAll(/<review-result>([\s\S]*?)<\/review-result>/gs)]
        console.log('🔍 Found', allResultMatches.length, 'review-result sections')

        // Try to find the valid one (not template)
        let validResultMatch = null
        for (const match of allResultMatches) {
          const contentLower = match[1].toLowerCase()
          if (!contentLower.includes('[path/to/file') &&
              !contentLower.includes('[start-line]') &&
              !contentLower.includes('[type]')) {
            validResultMatch = match
            break
          }
        }

        const resultMatch = validResultMatch || allResultMatches[allResultMatches.length - 1] // Use last match if no valid found

        if (resultMatch) {
          console.log('🔍 Found complete review-result section, content length:', resultMatch[1].length)
          console.log('🔍 First 500 chars of review-result content:', resultMatch[1].substring(0, 500))

          // Check if this is actually template text instead of real XML
          const contentLower = resultMatch[1].toLowerCase()
          if (contentLower.includes('[path/to/file') ||
              contentLower.includes('[start-line]') ||
              contentLower.includes('[type]') ||
              contentLower.includes('## part')) {
            console.error('❌ ERROR: Received template/instruction text instead of actual review XML!')
            console.error('The AI returned instructions on how to format a review instead of the actual review.')
            console.log('🔍 Full invalid content:', resultMatch[1].substring(0, 1000))

            // Create empty result since we got invalid XML
            this.reviewResult = {
              hunks: [],
              comments: []
            }
            this.onReviewComplete?.(this.reviewResult)
            return
          }

          const result = this.parseReviewResult(resultMatch[1])
          if (result) {
            this.reviewResult = result
            this.onReviewComplete?.(result)
            console.log('✅ Review completed with result:', result)
          } else {
            console.log('❌ Failed to parse review result from XML')
            // Log the full content for debugging
            console.log('🔍 Full review-result content:', resultMatch[1])
          }
        }
      }

      // Handle progress messages
      if (content.includes("Analyzing") || content.includes("Reading")) {
        const progressMatch = content.match(/(?:Analyzing|Reading)[^<]*/)?.[0]
        if (progressMatch) {
          this.onProgressUpdate?.(progressMatch.trim())
        }
      }
    } catch (error) {
      console.error("Error processing streaming content:", error)
    }
  }

  /**
   * DEPRECATED - Create a message handler for processing review responses
   */
  private createMessageHandler() {
    return (message: any) => {
      try {
        console.log('📥 Review Service - Received message:', message)

        // Handle SSE message format
        let content = ''
        if (typeof message === 'object') {
          // Check for various message types that may contain agent responses
          // The agent's response typically comes through these events
          if (message.type === 'message.created' ||
              message.type === 'message.updated' ||
              message.type === 'message.delta' ||
              message.type === 'message.completed' ||
              message.type === 'agent.response' ||
              message.type === 'completion.message') {

            // Extract content from various possible locations in the message structure
            // Different message types may have content in different places
            if (message.properties?.text) {
              content = message.properties.text
            } else if (message.properties?.content) {
              content = message.properties.content
            } else if (message.properties?.delta?.text) {
              // For streaming messages, content may be in delta
              content = message.properties.delta.text
            } else if (message.data?.text) {
              content = message.data.text
            } else if (message.data?.content) {
              content = message.data.content
            } else if (message.data?.delta?.text) {
              content = message.data.delta.text
            } else if (message.data?.message?.content) {
              // Sometimes the message is nested
              content = message.data.message.content
            } else if (message.text) {
              // Direct text property
              content = message.text
            } else if (message.content) {
              // Direct content property
              content = message.content
            }
          } else if (message.properties?.content) {
            content = message.properties.content
          } else if (message.data?.content) {
            content = message.data.content
          } else if (message.data && typeof message.data === 'string') {
            content = message.data
          }
        } else if (typeof message === 'string') {
          content = message
        }

        if (!content) {
          console.log('📥 Review Service - No content found in message type:', message.type)
          return
        }

        console.log('📥 Review Service - Extracted content:', content)

        // Parse review insights (streaming)
        const insightMatches = content.matchAll(/<review-insight[^>]*>([\s\S]*?)<\/review-insight>/g)
        for (const match of insightMatches) {
          const insight = this.parseInsight(match[0])
          if (insight && !this.insights.some(i => i.message === insight.message)) {
            this.insights.push(insight)
            this.onInsightReceived?.(insight)
          }
        }

        // Parse review result (final)
        const resultMatch = content.match(/<review-result>([\s\S]*?)<\/review-result>/s)
        if (resultMatch && !this.reviewResult) {
          const result = this.parseReviewResult(resultMatch[1])
          if (result) {
            this.reviewResult = result
            this.onReviewComplete?.(result)
            this.isReviewing = false
            this.onProgressUpdate?.("Review complete")
          }
        }

        // Handle progress messages
        if (content.includes("Analyzing") || content.includes("Reading")) {
          const progressMatch = content.match(/(?:Analyzing|Reading)[^<]*/)?.[0]
          if (progressMatch) {
            this.onProgressUpdate?.(progressMatch.trim())
          }
        }

      } catch (error) {
        console.error("Error processing review message:", error)
      }
    }
  }

  /**
   * Parse a review insight from XML
   */
  private parseInsight(xml: string): ReviewInsight | null {
    try {
      const typeMatch = xml.match(/type="([^"]+)"/)
      const severityMatch = xml.match(/severity="([^"]+)"/)
      const messageMatch = xml.match(/<review-insight[^>]*>([\s\S]*?)<\/review-insight>/s)

      if (typeMatch && severityMatch && messageMatch) {
        return {
          type: typeMatch[1] as ReviewInsight['type'],
          severity: severityMatch[1] as ReviewInsight['severity'],
          message: messageMatch[1].trim()
        }
      }
    } catch (error) {
      console.error("Error parsing insight:", error)
    }
    return null
  }

  /**
   * Parse the review result from XML
   */
  private parseReviewResult(xml: string): ReviewResult | null {
    try {
      console.log('🔍 Starting parseReviewResult with XML length:', xml.length)
      console.log('🔍 XML content preview:', xml.substring(0, 500))
      const hunks: Hunk[] = []
      const comments: Comment[] = []

      // Parse hunks
      // First, let's check if the hunks section exists at all
      console.log('🔍 Checking for <hunks> tag:', xml.includes('<hunks>'))
      console.log('🔍 Checking for </hunks> tag:', xml.includes('</hunks>'))

      const hunksSectionMatch = xml.match(/<hunks>([\s\S]*?)<\/hunks>/s)
      console.log('🔍 Hunks section found:', !!hunksSectionMatch)

      if (hunksSectionMatch) {
        const hunksSection = hunksSectionMatch[1]
        console.log('🔍 Hunks section length:', hunksSection.length)
        console.log('🔍 First 200 chars of hunks section:', hunksSection.substring(0, 200))

        // Convert iterator to array for counting
        // Make sure to match hunk tags with attributes like <hunk file="..." start="..." end="...">
        const hunkMatchesArray = [...hunksSection.matchAll(/<hunk[^>]*>([\s\S]*?)<\/hunk>/gs)]
        console.log('🔍 Found hunk matches:', hunkMatchesArray.length)

        for (const match of hunkMatchesArray) {
          const hunk = this.parseHunk(match[0])
          if (hunk) {
            hunks.push(hunk)
            console.log('✅ Parsed hunk:', hunk.file)
          } else {
            console.log('❌ Failed to parse hunk')
          }
        }
      }

      // Parse comments
      console.log('🔍 Checking for <comments> tag:', xml.includes('<comments>'))
      console.log('🔍 Checking for </comments> tag:', xml.includes('</comments>'))

      const commentsSectionMatch = xml.match(/<comments>([\s\S]*?)<\/comments>/s)
      console.log('🔍 Comments section found:', !!commentsSectionMatch)

      if (commentsSectionMatch) {
        const commentsSection = commentsSectionMatch[1]
        console.log('🔍 Comments section length:', commentsSection.length)

        // Convert iterator to array for counting
        const commentMatchesArray = [...commentsSection.matchAll(/<comment>([\s\S]*?)<\/comment>/gs)]
        console.log('🔍 Found comment matches:', commentMatchesArray.length)

        for (const match of commentMatchesArray) {
          const comment = this.parseComment(match[1])
          if (comment) {
            comments.push(comment)
            console.log('✅ Parsed comment:', comment.file, 'lines:', comment.lines)
          } else {
            console.log('❌ Failed to parse comment')
          }
        }
      }

      console.log('📊 Parsed review result:', { hunks: hunks.length, comments: comments.length })

      return { hunks, comments }

    } catch (error) {
      console.error("Error parsing review result:", error)
    }
    return null
  }

  /**
   * Parse a hunk from XML
   */
  private parseHunk(xml: string): Hunk | null {
    try {
      const fileMatch = xml.match(/file="([^"]+)"/)
      const startMatch = xml.match(/start="([^"]+)"/)
      const endMatch = xml.match(/end="([^"]+)"/)
      const categoryMatch = xml.match(/<category>([^<]+)<\/category>/)
      const riskMatch = xml.match(/<risk>([^<]+)<\/risk>/)
      const descriptionMatch = xml.match(/<description>([^<]+)<\/description>/)
      const needsAttentionMatch = xml.match(/<needs-attention>([^<]+)<\/needs-attention>/)

      console.log('🔍 Parsing hunk - file:', fileMatch?.[1], 'start:', startMatch?.[1], 'end:', endMatch?.[1])

      if (fileMatch && startMatch && endMatch) {
        return {
          file: fileMatch[1],
          start: parseInt(startMatch[1]),
          end: parseInt(endMatch[1]),
          category: categoryMatch?.[1] as Hunk['category'] || 'feature',
          risk: riskMatch?.[1] as Hunk['risk'] || 'low',
          description: descriptionMatch?.[1] || '',
          needsAttention: needsAttentionMatch?.[1] === 'yes'
        }
      } else {
        console.log('❌ Missing required hunk fields')
      }
    } catch (error) {
      console.error("Error parsing hunk:", error)
    }
    return null
  }

  /**
   * Parse a comment from XML
   */
  private parseComment(xml: string): Comment | null {
    try {
      const fileMatch = xml.match(/<file>([^<]+)<\/file>/)
      // Handle both formats: <lines start="30" end="35"/> and <lines start="30" end="35">
      const linesMatch = xml.match(/<lines\s+start=["']?(\d+)["']?\s+end=["']?(\d+)["']?/)
      const typeMatch = xml.match(/<type>([^<]+)<\/type>/)
      const severityMatch = xml.match(/<severity>([^<]+)<\/severity>/)
      const messageMatch = xml.match(/<message>([\s\S]*?)<\/message>/)
      const fixCodeMatch = xml.match(/<fix-code>([\s\S]*?)<\/fix-code>/)

      if (fileMatch && linesMatch && typeMatch && severityMatch && messageMatch) {
        const comment: Comment = {
          file: fileMatch[1],
          lines: {
            start: parseInt(linesMatch[1]),
            end: parseInt(linesMatch[2])
          },
          type: typeMatch[1] as Comment['type'],
          severity: severityMatch[1] as Comment['severity'],
          message: messageMatch[1].trim(),
          author: 'AI Reviewer',
          body: messageMatch[1].trim()
        }

        if (fixCodeMatch && fixCodeMatch[1].trim()) {
          // Extract the code from the markdown code block
          const codeMatch = fixCodeMatch[1].match(/```[\w]*\n([\s\S]*?)```/)
          if (codeMatch) {
            comment.fixCode = codeMatch[1].trim()
          }
        }

        return comment
      }
    } catch (error) {
      console.error("Error parsing comment:", error)
    }
    return null
  }


  /**
   * Parse git diff output to DiffFile array
   */
  private async parseDiffToFiles(diffContent: string, fileStats: Array<{ path: string; additions: number; deletions: number }>): Promise<DiffFile[]> {
    const files: DiffFile[] = []

    // Handle case where diffContent starts with "diff --git"
    let processedDiff = diffContent
    if (!diffContent.startsWith('diff --git')) {
      // If it doesn't start with diff --git, try to find where the actual diff starts
      const diffStart = diffContent.indexOf('diff --git')
      if (diffStart > -1) {
        processedDiff = diffContent.substring(diffStart)
      }
    }

    const diffSections = processedDiff.split(/^diff --git /m).filter(s => s.trim())

    for (const section of diffSections) {
      const fileMatch = section.match(/^a\/(.+?) b\/(.+?)$/m)
      if (!fileMatch) continue

      const path = fileMatch[2]
      const stats = fileStats.find(s => s.path === path) || fileStats.find(s => s.path.endsWith(path))

      // Parse the patches from the diff
      const patches: DiffFile['patches'] = []
      const hunkMatches = [...section.matchAll(/@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@[^\n]*/g)]

      for (let i = 0; i < hunkMatches.length; i++) {
        const hunkMatch = hunkMatches[i]
        const oldStart = parseInt(hunkMatch[1])
        const oldLines = parseInt(hunkMatch[2] || '1')
        const newStart = parseInt(hunkMatch[3])
        const newLines = parseInt(hunkMatch[4] || '1')

        // Get lines after this hunk header until the next hunk or end of section
        const hunkIndex = section.indexOf(hunkMatch[0])
        const nextHunk = hunkMatches[i + 1]
        const nextHunkIndex = nextHunk ? section.indexOf(nextHunk[0]) : section.length

        let hunkContent = section.substring(
          hunkIndex + hunkMatch[0].length,
          nextHunkIndex
        )

        // Remove only the first newline after the hunk header if it exists
        if (hunkContent.startsWith('\n')) {
          hunkContent = hunkContent.substring(1)
        }

        // Split lines and preserve the diff markers
        const lines = hunkContent.split('\n')
          .map(line => {
            // Ensure each line has proper diff marker
            if (line.startsWith('+') || line.startsWith('-') || line.startsWith(' ')) {
              return line
            } else if (line.trim() === '') {
              return '' // Will be filtered out
            }
            return line
          })
          .filter(line => line !== '')

        patches.push({
          oldStart,
          oldLines,
          newStart,
          newLines,
          lines
        })
      }

      // Include the full diff section for reference
      const fullDiff = 'diff --git a/' + path + ' b/' + path + '\n' + section

      files.push({
        path,
        diff: fullDiff,
        additions: stats?.additions || 0,
        deletions: stats?.deletions || 0,
        patches
      })
    }

    console.log(`📁 Parsed ${files.length} files from diff with ${files.reduce((sum, f) => sum + (f.patches?.length || 0), 0)} patches`)

    return files
  }


  /**
   * Generate a diff string from DiffFile array
   */
  private generateDiffFromFiles(files: DiffFile[]): string {
    let diff = ''

    for (const file of files) {
      if (file.diff) {
        diff += file.diff + '\n'
      } else if (file.oldContent && file.newContent) {
        // Generate a simple unified diff format
        diff += `--- a/${file.path}\n`
        diff += `+++ b/${file.path}\n`

        const oldLines = file.oldContent.split('\n')
        const newLines = file.newContent.split('\n')

        // Simple diff generation (for demo purposes)
        // In production, use a proper diff library
        diff += '@@ -1,' + oldLines.length + ' +1,' + newLines.length + ' @@\n'

        for (const line of oldLines) {
          diff += '-' + line + '\n'
        }

        for (const line of newLines) {
          diff += '+' + line + '\n'
        }
      }
    }

    return diff
  }

  /**
   * Generate comments from insights by intelligently mapping them to file locations
   */
  private generateCommentsFromInsights(insights: ReviewInsight[], files: DiffFile[]): Comment[] {
    const comments: Comment[] = []

    for (const insight of insights) {
      // Skip if not enough information to create a comment
      if (!insight.message) continue

      // Try to extract file references from the insight message
      const fileMatches = insight.message.match(/`([^`]+\.(ts|tsx|js|jsx|vue|py|go|java|rs|cpp|h|c|md))`/gi)
      const lineMatches = insight.message.match(/line[s]?\s+(\d+)(?:\s*[-–]\s*(\d+))?/gi)

      // Map severity to comment type
      const type: Comment['type'] =
        insight.type === 'bug' || insight.type === 'security' ? 'issue' :
        insight.type === 'performance' || insight.type === 'best-practice' ? 'suggestion' :
        'suggestion'

      // If we found file references in the message
      if (fileMatches && fileMatches.length > 0) {
        for (const fileMatch of fileMatches) {
          const fileName = fileMatch.replace(/`/g, '')

          // Find the matching file in our diff files
          const matchingFile = files.find(f =>
            f.path.endsWith(fileName) ||
            f.path.includes(fileName) ||
            fileName.includes(f.path.split('/').pop() || '')
          )

          if (matchingFile) {
            // Extract line numbers if mentioned
            let startLine = 1
            let endLine = 1

            if (lineMatches && lineMatches.length > 0) {
              const lineMatch = lineMatches[0].match(/(\d+)(?:\s*[-–]\s*(\d+))?/)
              if (lineMatch) {
                startLine = parseInt(lineMatch[1])
                endLine = lineMatch[2] ? parseInt(lineMatch[2]) : startLine
              }
            } else if (matchingFile.patches && matchingFile.patches.length > 0) {
              // If no specific line mentioned, use the first changed hunk
              const firstPatch = matchingFile.patches[0]
              startLine = firstPatch.newStart
              endLine = firstPatch.newStart + Math.min(5, firstPatch.newLines) // Show first 5 lines of the hunk
            }

            comments.push({
              file: matchingFile.path,
              lines: { start: startLine, end: endLine },
              type,
              severity: insight.severity,
              message: insight.message
            })
          }
        }
      } else if (files.length > 0) {
        // If no specific file mentioned, but we have context about which files changed
        // Try to intelligently map based on content keywords

        // Keywords that might indicate which file type this relates to
        const componentKeywords = ['component', 'render', 'props', 'state', 'hooks', 'jsx', 'tsx']
        const serviceKeywords = ['service', 'api', 'fetch', 'request', 'response', 'async', 'promise']
        const styleKeywords = ['style', 'css', 'sass', 'scss', 'class', 'selector']

        // Try to find the most relevant file based on keywords
        let targetFile = files[0] // Default to first file if no match

        const lowerMessage = insight.message.toLowerCase()

        for (const file of files) {
          const isComponent = file.path.includes('component') || file.path.endsWith('.vue') || file.path.endsWith('.tsx')
          const isService = file.path.includes('service') || file.path.includes('api')
          const isStyle = file.path.endsWith('.css') || file.path.endsWith('.scss')

          if (isComponent && componentKeywords.some(k => lowerMessage.includes(k))) {
            targetFile = file
            break
          } else if (isService && serviceKeywords.some(k => lowerMessage.includes(k))) {
            targetFile = file
            break
          } else if (isStyle && styleKeywords.some(k => lowerMessage.includes(k))) {
            targetFile = file
            break
          }
        }

        // Find the most relevant lines in the target file
        let startLine = 1
        let endLine = 1

        if (targetFile.patches && targetFile.patches.length > 0) {
          // Focus on the largest change hunk
          const largestPatch = targetFile.patches.reduce((largest, patch) =>
            patch.lines.length > largest.lines.length ? patch : largest
          )
          startLine = largestPatch.newStart
          endLine = largestPatch.newStart + Math.min(10, largestPatch.newLines)
        }

        comments.push({
          file: targetFile.path,
          lines: { start: startLine, end: endLine },
          type,
          severity: insight.severity,
          message: insight.message
        })
      }
    }

    console.log(`💬 Generated ${comments.length} comments from ${insights.length} insights`)
    return comments
  }

  /**
   * Get the current diff files
   */
  public getCurrentFiles(): DiffFile[] {
    return this.currentFiles
  }
}