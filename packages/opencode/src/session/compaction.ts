import { Log } from "../util/log"
import { MessageV2 } from "./message-v2"
import { Provider } from "../provider/provider"

export namespace CompactionManager {
  const log = Log.create({ service: "compaction" })

  // Constants for token calculation - using exact calculations
  const CHARACTERS_PER_TOKEN = 4
  
    
  /**
   * Estimates the number of tokens in a text string
   * @param text - The text to estimate tokens for
   * @returns The estimated number of tokens
   */
  export function estimateTokens(text: string): number {
    if (!text || typeof text !== 'string') return 0
    return Math.ceil(text.length / CHARACTERS_PER_TOKEN)
  }

  /**
   * Estimates tokens from pending tool call results
   * @param toolCalls - Array of tool calls to estimate tokens for
   * @returns Estimated token count from all tool calls
   */
  export function estimateToolCallTokens(toolCalls: any[]): number {
    if (!toolCalls?.length) return 0
    return toolCalls.reduce((total, toolCall) => {
      if (toolCall.result) {
        const resultStr = typeof toolCall.result === 'string' 
          ? toolCall.result 
          : JSON.stringify(toolCall.result)
        return total + estimateTokens(resultStr)
      }
      return total
    }, 0)
  }

  /**
   * Estimates tokens from queued messages
   * @param queuedMessages - Array of queued messages to estimate tokens for
   * @returns Estimated token count from all queued messages
   */
  export function estimateQueuedMessageTokens(queuedMessages: any[]): number {
    if (!queuedMessages?.length) return 0
    return queuedMessages.reduce((total, message) => {
      if (message.content) {
        const contentStr = typeof message.content === 'string' 
          ? message.content 
          : JSON.stringify(message.content)
        return total + estimateTokens(contentStr)
      }
      return total
    }, 0)
  }

  /**
   * Estimate tokens that will be added by a new message
   * Enhanced version that uses the refined token estimation
   */
  export function estimateNewMessageTokens(parts: MessageV2.Part[]): number {
    let estimate = 100 // Base overhead for message structure
    
    for (const part of parts) {
      if (part.type === "text") {
        estimate += estimateTokens(part.text)
      } else if (part.type === "file") {
        estimate += 1000 // Conservative estimate
      } else if (part.type === "tool") {
        estimate += 200 // Tool call overhead
        if (part.state?.status === "completed" && part.state.output) {
          estimate += estimateTokens(part.state.output)
        }
      }
    }
    
    return estimate
  }
  
  
  /**
   * Enhanced compression check that includes pending operations
   * @param providerID - The provider ID for the model
   * @param modelID - The model ID to check limits for
   * @param sessionID - The session to check
   * @param toolCalls - Optional pending tool calls to include in estimation
   * @param queuedMessages - Optional queued messages to include in estimation
   * @param messages - Current session messages
   * @returns Promise<boolean> - True if compression is needed
   */
  export async function checkShouldCompress(
    providerID: string,
    modelID: string,
    sessionID: string,
    toolCalls?: any[],
    queuedMessages?: any[],
    messages?: Array<{ info: MessageV2.Info; parts: MessageV2.Part[] }>
  ): Promise<boolean> {
    try {
      let tokens = 0

      if (messages && messages.length > 0) {
        // Find the last assistant message and use its token count
        const lastAssistantMsg = [...messages].reverse().find(msg => msg.info.role === "assistant")
        if (lastAssistantMsg?.info.role === "assistant") {
          const assistant = lastAssistantMsg.info as MessageV2.Assistant
          if (assistant.tokens) {
            tokens = assistant.tokens.input + assistant.tokens.output + assistant.tokens.reasoning + assistant.tokens.cache.read + assistant.tokens.cache.write
          }
        }
      }
      
      // Add estimated tokens from pending operations
      if (toolCalls?.length) {
        tokens += estimateToolCallTokens(toolCalls)
      }
      if (queuedMessages?.length) {
        tokens += estimateQueuedMessageTokens(queuedMessages)
      }
      
      const model = await Provider.getModel(providerID, modelID)
      const outputLimit = Math.min(model.info.limit.output, 32_000) || 32_000

      // Use input limit if available (from GitHub Copilot overrides), otherwise fall back to calculated limit
      const inputLimit = model.info.limit.input || (model.info.limit.context - outputLimit)
      
      if (inputLimit && tokens > Math.max(inputLimit * 0.95, 0)) {
        return true
      }

      return false        
    } catch (error) {
      log.error('Error checking compression threshold', { error, sessionID })
      return false
    }
  }
}