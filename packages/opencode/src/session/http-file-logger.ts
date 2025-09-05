import { promises as fs } from "fs"
import path from "path"
import { ulid } from "ulid"
import { Flag } from "../flag/flag"
import { Log } from "../util/log"
import { Instance } from "../project/instance"

/**
 * HTTP File Logger - Logs HTTP requests/responses to separate files when enabled via --debug-http flag
 */
export namespace HttpFileLogger {
  const log = Log.create({ service: "http-file-logger" })

  interface HttpLogEntry {
    id: string
    timestamp: number
    sessionID: string
    messageID: string
    direction: "request" | "response"
    providerID: string
    modelID: string
    data: any
  }

  let logDir: string | null = null

  /**
   * Initialize the HTTP file logger
   */
  export async function init(): Promise<void> {
    if (!Flag.OPENCODE_DEBUG_HTTP()) {
      log.debug("HTTP file logging disabled")
      return
    }

    try {
      let rootPath: string
      
      try {
        rootPath = Instance.worktree
      } catch (error) {
        // Fallback to current working directory if Instance context not available
        rootPath = process.cwd()
        log.info("Using current directory as fallback for HTTP logging", { rootPath })
      }
      
      logDir = path.join(rootPath, ".opencode", "logs", "http")
      
      // Ensure log directory exists
      await fs.mkdir(logDir, { recursive: true })
      
      log.info("HTTP file logging enabled", { logDir })
    } catch (error) {
      log.error("Failed to initialize HTTP file logging", { error })
      logDir = null
    }
  }

  /**
   * Check if HTTP file logging is enabled
   */
  export function isEnabled(): boolean {
    return Flag.OPENCODE_DEBUG_HTTP() && logDir !== null
  }

  /**
   * Log the raw AI library request being sent (including messages, tools, etc.)
   */
  export async function logAiRequest(
    sessionID: string,
    messageID: string,
    providerID: string,
    modelID: string,
    requestParams: {
      messages: any[]
      tools?: Record<string, any>
      temperature?: number
      topP?: number
      maxOutputTokens?: number
      [key: string]: any
    }
  ): Promise<void> {
    if (!isEnabled() || !logDir) return

    const entry: HttpLogEntry = {
      id: ulid(),
      timestamp: Date.now(),
      sessionID,
      messageID,
      direction: "request",
      providerID,
      modelID,
      data: {
        type: "ai_request",
        messages: requestParams.messages,
        tools: requestParams.tools ? Object.keys(requestParams.tools) : [],
        temperature: requestParams.temperature,
        topP: requestParams.topP,
        maxOutputTokens: requestParams.maxOutputTokens,
        messageCount: requestParams.messages.length,
        enabledToolsCount: requestParams.tools ? Object.keys(requestParams.tools).length : 0
      }
    }

    const filename = `${new Date().toISOString().split('T')[0]}_ai_requests.jsonl`
    const filePath = path.join(logDir, filename)

    try {
      const logLine = JSON.stringify(entry) + '\n'
      await fs.appendFile(filePath, logLine, { encoding: 'utf8' })
      
      log.debug("AI request logged to file", { 
        filePath, 
        sessionID, 
        messageID,
        providerID,
        modelID 
      })
    } catch (error) {
      log.error("Failed to log AI request to file", { 
        error, 
        sessionID, 
        messageID,
        filePath 
      })
    }
  }

  /**
   * Log the AI library response (including tokens, cost, duration)
   */
  export async function logAiResponse(
    sessionID: string,
    messageID: string,
    providerID: string,
    modelID: string,
    responseData: {
      success: boolean
      tokens?: {
        input: number
        output: number
        reasoning?: number
        cache?: { read: number; write: number }
      }
      cost?: number
      partsCount?: number
      completed?: boolean
      error?: string
    },
    duration: number
  ): Promise<void> {
    if (!isEnabled() || !logDir) return

    const entry: HttpLogEntry = {
      id: ulid(),
      timestamp: Date.now(),
      sessionID,
      messageID,
      direction: "response",
      providerID,
      modelID,
      data: {
        type: "ai_response",
        success: responseData.success,
        tokens: responseData.tokens,
        cost: responseData.cost,
        partsCount: responseData.partsCount,
        completed: responseData.completed,
        error: responseData.error,
        duration
      }
    }

    const filename = `${new Date().toISOString().split('T')[0]}_ai_responses.jsonl`
    const filePath = path.join(logDir, filename)

    try {
      const logLine = JSON.stringify(entry) + '\n'
      await fs.appendFile(filePath, logLine, { encoding: 'utf8' })
      
      log.debug("AI response logged to file", { 
        filePath, 
        sessionID, 
        messageID,
        providerID,
        modelID,
        duration 
      })
    } catch (error) {
      log.error("Failed to log AI response to file", { 
        error, 
        sessionID, 
        messageID,
        filePath 
      })
    }
  }

  /**
   * Log a tool call request
   */
  export async function logToolCallRequest(
    sessionID: string,
    messageID: string,
    toolCallId: string,
    toolName: string,
    args: any
  ): Promise<void> {
    if (!isEnabled() || !logDir) return

    const entry: HttpLogEntry = {
      id: ulid(),
      timestamp: Date.now(),
      sessionID,
      messageID,
      direction: "request",
      providerID: "tool",
      modelID: toolName,
      data: {
        type: "tool_call",
        toolCallId,
        toolName,
        args
      }
    }

    const filename = `${new Date().toISOString().split('T')[0]}_tool_calls.jsonl`
    const filePath = path.join(logDir, filename)

    try {
      const logLine = JSON.stringify(entry) + '\n'
      await fs.appendFile(filePath, logLine, { encoding: 'utf8' })
    } catch (error) {
      log.error("Failed to log tool call to file", { error, sessionID, messageID, toolCallId })
    }
  }

  /**
   * Log a tool call response
   */
  export async function logToolCallResponse(
    sessionID: string,
    messageID: string,
    toolCallId: string,
    toolName: string,
    result: string,
    success: boolean,
    duration: number
  ): Promise<void> {
    if (!isEnabled() || !logDir) return

    const entry: HttpLogEntry = {
      id: ulid(),
      timestamp: Date.now(),
      sessionID,
      messageID,
      direction: "response",
      providerID: "tool",
      modelID: toolName,
      data: {
        type: "tool_result",
        toolCallId,
        toolName,
        result: result.length > 1000 ? result.substring(0, 1000) + "..." : result,
        success,
        duration,
        resultLength: result.length
      }
    }

    const filename = `${new Date().toISOString().split('T')[0]}_tool_calls.jsonl`
    const filePath = path.join(logDir, filename)

    try {
      const logLine = JSON.stringify(entry) + '\n'
      await fs.appendFile(filePath, logLine, { encoding: 'utf8' })
    } catch (error) {
      log.error("Failed to log tool result to file", { error, sessionID, messageID, toolCallId })
    }
  }

  /**
   * Clean up old log files (keep only last 7 days)
   */
  export async function cleanup(): Promise<void> {
    if (!isEnabled() || !logDir) return

    try {
      const files = await fs.readdir(logDir)
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - 7)
      const cutoffString = cutoffDate.toISOString().split('T')[0]

      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue
        
        const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})_/)
        if (dateMatch && dateMatch[1] < cutoffString) {
          const filePath = path.join(logDir, file)
          await fs.unlink(filePath)
          log.info("Cleaned up old HTTP log file", { filePath })
        }
      }
    } catch (error) {
      log.error("Failed to cleanup old HTTP log files", { error })
    }
  }

  /**
   * Log raw HTTP request to file
   */
  export async function logRawHttpRequest(
    sessionID: string,
    messageID: string,
    requestData: {
      url: string
      method: string
      headers: Record<string, string>
      body?: string
      timestamp: number
    }
  ): Promise<void> {
    if (!isEnabled() || !logDir) return

    const entry: HttpLogEntry = {
      id: ulid(),
      timestamp: requestData.timestamp,
      sessionID,
      messageID,
      direction: "request",
      providerID: getProviderFromUrl(requestData.url),
      modelID: "unknown",
      data: {
        type: "raw_http_request",
        url: requestData.url,
        method: requestData.method,
        headers: requestData.headers,
        body: requestData.body,
        bodySize: requestData.body ? requestData.body.length : 0
      }
    }

    const filename = `${new Date().toISOString().split('T')[0]}_raw_http.jsonl`
    const filePath = path.join(logDir, filename)

    try {
      const logLine = JSON.stringify(entry) + '\n'
      await fs.appendFile(filePath, logLine, { encoding: 'utf8' })
      
      log.debug("Raw HTTP request logged to file", { 
        filePath, 
        sessionID, 
        messageID,
        url: requestData.url,
        method: requestData.method
      })
    } catch (error) {
      log.error("Failed to log raw HTTP request to file", { 
        error, 
        sessionID, 
        messageID,
        url: requestData.url,
        filePath 
      })
    }
  }

  /**
   * Log raw HTTP response to file
   */
  export async function logRawHttpResponse(
    sessionID: string,
    messageID: string,
    responseData: {
      url: string
      method: string
      headers: Record<string, string>
      body?: string
      timestamp: number
      status: number
      statusText: string
      responseHeaders: Record<string, string>
      responseBody?: string
      duration: number
    }
  ): Promise<void> {
    if (!isEnabled() || !logDir) return

    const entry: HttpLogEntry = {
      id: ulid(),
      timestamp: responseData.timestamp,
      sessionID,
      messageID,
      direction: "response",
      providerID: getProviderFromUrl(responseData.url),
      modelID: "unknown",
      data: {
        type: "raw_http_response",
        url: responseData.url,
        method: responseData.method,
        requestHeaders: responseData.headers,
        requestBody: responseData.body,
        status: responseData.status,
        statusText: responseData.statusText,
        responseHeaders: responseData.responseHeaders,
        responseBody: responseData.responseBody,
        duration: responseData.duration,
        requestBodySize: responseData.body ? responseData.body.length : 0,
        responseBodySize: responseData.responseBody ? responseData.responseBody.length : 0
      }
    }

    const filename = `${new Date().toISOString().split('T')[0]}_raw_http.jsonl`
    const filePath = path.join(logDir, filename)

    try {
      const logLine = JSON.stringify(entry) + '\n'
      await fs.appendFile(filePath, logLine, { encoding: 'utf8' })
      
      log.debug("Raw HTTP response logged to file", { 
        filePath, 
        sessionID, 
        messageID,
        url: responseData.url,
        status: responseData.status,
        duration: responseData.duration
      })
    } catch (error) {
      log.error("Failed to log raw HTTP response to file", { 
        error, 
        sessionID, 
        messageID,
        url: responseData.url,
        filePath 
      })
    }
  }

  /**
   * Extract provider name from URL
   */
  function getProviderFromUrl(url: string): string {
    if (url.includes('api.anthropic.com')) return 'anthropic'
    if (url.includes('api.openai.com')) return 'openai'
    if (url.includes('api.azure.com')) return 'azure'
    if (url.includes('generativelanguage.googleapis.com')) return 'google'
    if (url.includes('api.mistral.ai')) return 'mistral'
    if (url.includes('api.cohere.ai')) return 'cohere'
    if (url.includes('api.together.ai')) return 'together'
    if (url.includes('api.fireworks.ai')) return 'fireworks'
    
    // Try to extract from URL
    const match = url.match(/https?:\/\/([^.]+)\./)
    return match ? match[1] : 'unknown'
  }

  /**
   * Get the log directory path
   */
  export function getLogDir(): string | null {
    return logDir
  }
}