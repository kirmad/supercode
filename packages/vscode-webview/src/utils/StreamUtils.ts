/**
 * Streaming utility functions for handling AI responses in comment threads
 */

import type { StreamingCallbacks } from '../services/SessionManager'

/**
 * Create streaming callbacks with error handling and logging
 */
export function createStreamingCallbacks(
  onChunk?: (chunk: string) => void,
  onComplete?: (fullContent: string) => void,
  onError?: (error: Error) => void,
  logPrefix: string = 'StreamUtils'
): StreamingCallbacks {
  let accumulatedContent = ''

  return {
    onChunk: (chunk: string, sessionId: string) => {
      try {
        console.log(`[${logPrefix}] Chunk received for session ${sessionId}:`, chunk.length, 'chars')
        accumulatedContent += chunk
        onChunk?.(chunk)
      } catch (error) {
        console.error(`[${logPrefix}] Error in onChunk:`, error)
        onError?.(error instanceof Error ? error : new Error(String(error)))
      }
    },

    onMessagePart: (part: any, sessionId: string) => {
      try {
        if (part && part.text && typeof part.text === 'string') {
          console.log(`[${logPrefix}] Message part received for session ${sessionId}:`, part.text.length, 'chars')
          accumulatedContent += part.text
          onChunk?.(part.text)
        }
      } catch (error) {
        console.error(`[${logPrefix}] Error in onMessagePart:`, error)
        onError?.(error instanceof Error ? error : new Error(String(error)))
      }
    },

    onComplete: (fullContent: string, sessionId: string) => {
      try {
        console.log(`[${logPrefix}] Streaming complete for session ${sessionId}:`, fullContent.length, 'chars')
        // Use accumulated content if fullContent is empty
        const finalContent = fullContent || accumulatedContent
        onComplete?.(finalContent)
      } catch (error) {
        console.error(`[${logPrefix}] Error in onComplete:`, error)
        onError?.(error instanceof Error ? error : new Error(String(error)))
      }
    },

    onError: (error: Error, sessionId: string) => {
      console.error(`[${logPrefix}] Streaming error for session ${sessionId}:`, error)
      onError?.(error)
    }
  }
}

/**
 * Extract meaningful content from streaming chunks
 */
export function extractContentFromChunk(chunk: string): string {
  // Remove common streaming artifacts
  const cleaned = chunk
    .replace(/^data:\s*/, '') // Remove SSE data prefix
    .replace(/\[DONE\]$/, '') // Remove completion marker
    .trim()

  return cleaned
}

/**
 * Check if a chunk indicates completion
 */
export function isCompletionChunk(chunk: string): boolean {
  return chunk.includes('[DONE]') || chunk.includes('data: [DONE]')
}

/**
 * Parse JSON from streaming chunk safely
 */
export function parseStreamingJSON(chunk: string): any | null {
  try {
    const cleaned = extractContentFromChunk(chunk)
    if (!cleaned || isCompletionChunk(chunk)) {
      return null
    }
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}

/**
 * Accumulate streaming text content
 */
export class StreamAccumulator {
  private content = ''
  private chunks: string[] = []

  public addChunk(chunk: string): void {
    const cleaned = extractContentFromChunk(chunk)
    if (cleaned && !isCompletionChunk(chunk)) {
      this.chunks.push(cleaned)
      this.content += cleaned
    }
  }

  public getContent(): string {
    return this.content
  }

  public getChunks(): string[] {
    return [...this.chunks]
  }

  public clear(): void {
    this.content = ''
    this.chunks = []
  }

  public getStats(): { totalChunks: number; totalLength: number } {
    return {
      totalChunks: this.chunks.length,
      totalLength: this.content.length
    }
  }
}