import { ulid } from "ulid"
import { Flag } from "../flag/flag"
import { Log } from "../util/log"
import { HttpFileLogger } from "./http-file-logger"
// AI SDK v5.0.8 types - using any for now to avoid breaking builds
// TODO: Update to correct types once AI SDK types are stable

/**
 * AI SDK Logging Middleware - Captures all AI requests and responses at the SDK level
 * This includes the actual request parameters sent to providers like GitHub Copilot
 */
export namespace AiSdkLoggingMiddleware {
  const log = Log.create({ service: "ai-sdk-logging-middleware" })

  let currentSessionID: string | null = null
  let currentMessageID: string | null = null

  /**
   * Set the current session and message context for logging
   */
  export function setContext(sessionID: string, messageID: string): void {
    currentSessionID = sessionID
    currentMessageID = messageID
    log.debug("Context set", { sessionID, messageID })
  }

  /**
   * Clear the current context
   */
  export function clearContext(): void {
    currentSessionID = null
    currentMessageID = null
  }

  /**
   * The main logging middleware for AI SDK
   */
  export const middleware: any = {
    wrapGenerate: async ({ doGenerate, params }: { doGenerate: any, params: any }) => {
      if (!Flag.OPENCODE_DEBUG_HTTP()) {
        return doGenerate()
      }

      const startTime = Date.now()
      const requestId = ulid()
      
      log.info("AI SDK generate request", {
        requestId,
        sessionID: currentSessionID,
        messageID: currentMessageID
      })

      // Log the full request parameters
      await logAiSdkRequest(requestId, {
        type: 'generate',
        params: params,
        timestamp: startTime
      })

      try {
        const result = await doGenerate()
        const endTime = Date.now()
        const duration = endTime - startTime

        log.info("AI SDK generate completed", {
          requestId,
          sessionID: currentSessionID,
          messageID: currentMessageID,
          duration
        })

        // Log the response
        await logAiSdkResponse(requestId, {
          type: 'generate',
          result: {
            text: result.text,
            finishReason: result.finishReason,
            usage: result.usage,
            warnings: result.warnings
          },
          duration,
          timestamp: endTime
        })

        return result
      } catch (error) {
        const endTime = Date.now()
        const duration = endTime - startTime

        log.error("AI SDK generate failed", {
          requestId,
          sessionID: currentSessionID,
          messageID: currentMessageID,
          error: error instanceof Error ? error.message : String(error),
          duration
        })

        // Log the error
        await logAiSdkResponse(requestId, {
          type: 'generate',
          error: error instanceof Error ? error.message : String(error),
          duration,
          timestamp: endTime
        })

        throw error
      }
    },

    wrapStream: async ({ doStream, params }: { doStream: any, params: any }) => {
      if (!Flag.OPENCODE_DEBUG_HTTP()) {
        return doStream()
      }

      const startTime = Date.now()
      const requestId = ulid()

      log.info("AI SDK stream request", {
        requestId,
        sessionID: currentSessionID,
        messageID: currentMessageID
      })

      // Log the full request parameters
      await logAiSdkRequest(requestId, {
        type: 'stream',
        params: params,
        timestamp: startTime
      })

      try {
        const { stream, ...rest } = await doStream()

        let generatedText = ''
        let totalParts = 0
        const textBlocks = new Map<string, string>()

        const transformStream = new TransformStream<
          any,
          any
        >({
          transform(chunk, controller) {
            totalParts++

            switch (chunk.type) {
              case 'text-start': {
                textBlocks.set(chunk.id, '')
                break
              }
              case 'text-delta': {
                const existing = textBlocks.get(chunk.id) || ''
                textBlocks.set(chunk.id, existing + chunk.delta)
                generatedText += chunk.delta
                break
              }
              case 'text-end': {
                log.debug(`Text block ${chunk.id} completed`, {
                  requestId,
                  blockLength: textBlocks.get(chunk.id)?.length || 0
                })
                break
              }
              case 'tool-call': {
                log.debug("Tool call detected", {
                  requestId,
                  toolCallId: chunk.toolCallId,
                  toolName: chunk.toolName
                })
                break
              }
              case 'error': {
                log.error("Stream error", {
                  requestId,
                  error: chunk.error
                })
                break
              }
            }

            controller.enqueue(chunk)
          },

          flush() {
            const endTime = Date.now()
            const duration = endTime - startTime

            log.info("AI SDK stream completed", {
              requestId,
              sessionID: currentSessionID,
              messageID: currentMessageID,
              duration,
              totalParts,
              generatedTextLength: generatedText.length
            })

            // Log the final response
            logAiSdkResponse(requestId, {
              type: 'stream',
              result: {
                generatedText: generatedText.length > 1000 
                  ? generatedText.substring(0, 1000) + '...' 
                  : generatedText,
                totalParts,
                textBlocks: Array.from(textBlocks.entries()).map(([id, text]) => ({
                  id,
                  length: text.length
                }))
              },
              duration,
              timestamp: endTime
            }).catch(err => log.error("Failed to log stream response", { error: err }))
          }
        })

        return {
          stream: stream.pipeThrough(transformStream),
          ...rest
        }
      } catch (error) {
        const endTime = Date.now()
        const duration = endTime - startTime

        log.error("AI SDK stream failed", {
          requestId,
          sessionID: currentSessionID,
          messageID: currentMessageID,
          error: error instanceof Error ? error.message : String(error),
          duration
        })

        // Log the error
        await logAiSdkResponse(requestId, {
          type: 'stream',
          error: error instanceof Error ? error.message : String(error),
          duration,
          timestamp: endTime
        })

        throw error
      }
    }
  }

  /**
   * Log AI SDK request parameters
   */
  async function logAiSdkRequest(
    requestId: string,
    data: {
      type: 'generate' | 'stream'
      params: any
      timestamp: number
    }
  ): Promise<void> {
    if (!currentSessionID || !currentMessageID) {
      log.warn("No context set for AI SDK logging", { requestId })
      return
    }

    try {
      await HttpFileLogger.logRawHttpRequest(
        currentSessionID,
        currentMessageID,
        {
          url: `ai-sdk://${data.type}`,
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-ai-sdk-request-id': requestId,
            'x-ai-sdk-type': data.type
          },
          body: JSON.stringify({
            requestId,
            type: data.type,
            prompt: data.params.prompt,
            messages: data.params.messages,
            tools: data.params.tools ? Object.keys(data.params.tools) : [],
            mode: data.params.mode,
            maxTokens: data.params.maxTokens,
            temperature: data.params.temperature,
            topP: data.params.topP,
            topK: data.params.topK,
            frequencyPenalty: data.params.frequencyPenalty,
            presencePenalty: data.params.presencePenalty,
            stopSequences: data.params.stopSequences,
            seed: data.params.seed,
            abortSignal: data.params.abortSignal ? 'AbortSignal' : undefined,
            headers: data.params.headers,
            providerMetadata: data.params.providerMetadata
          }, null, 2),
          timestamp: data.timestamp
        }
      )

      log.debug("AI SDK request logged", { requestId })
    } catch (error) {
      log.error("Failed to log AI SDK request", { requestId, error })
    }
  }

  /**
   * Log AI SDK response data
   */
  async function logAiSdkResponse(
    requestId: string,
    data: {
      type: 'generate' | 'stream'
      result?: any
      error?: string
      duration: number
      timestamp: number
    }
  ): Promise<void> {
    if (!currentSessionID || !currentMessageID) {
      log.warn("No context set for AI SDK response logging", { requestId })
      return
    }

    try {
      const status = data.error ? 500 : 200
      const statusText = data.error ? 'Internal Server Error' : 'OK'

      await HttpFileLogger.logRawHttpResponse(
        currentSessionID,
        currentMessageID,
        {
          url: `ai-sdk://${data.type}`,
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-ai-sdk-request-id': requestId,
            'x-ai-sdk-type': data.type
          },
          body: '',
          timestamp: data.timestamp,
          status,
          statusText,
          responseHeaders: {
            'content-type': 'application/json',
            'x-ai-sdk-request-id': requestId,
            'x-ai-sdk-duration': data.duration.toString()
          },
          responseBody: JSON.stringify({
            requestId,
            type: data.type,
            success: !data.error,
            error: data.error,
            result: data.result,
            duration: data.duration
          }, null, 2),
          duration: data.duration
        }
      )

      log.debug("AI SDK response logged", { requestId, status })
    } catch (error) {
      log.error("Failed to log AI SDK response", { requestId, error })
    }
  }
}