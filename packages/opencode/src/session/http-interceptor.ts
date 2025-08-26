import { HttpFileLogger } from "./http-file-logger"
import { Flag } from "../flag/flag"
import { Log } from "../util/log"

/**
 * HTTP Interceptor - Patches the global fetch function to capture raw HTTP requests/responses
 */
export namespace HttpInterceptor {
  const log = Log.create({ service: "http-interceptor" })

  let isEnabled = false
  let originalFetch: typeof globalThis.fetch | null = null
  let activeSessionID: string | null = null
  let activeMessageID: string | null = null

  interface HttpLogData {
    url: string
    method: string
    headers: Record<string, string>
    body?: string
    timestamp: number
  }

  interface HttpResponseData extends HttpLogData {
    status: number
    statusText: string
    responseHeaders: Record<string, string>
    responseBody?: string
    duration: number
  }

  /**
   * Initialize the HTTP interceptor by patching global fetch
   */
  export function init(): void {
    if (!Flag.OPENCODE_DEBUG_HTTP()) {
      log.debug("HTTP interceptor disabled")
      return
    }

    if (isEnabled || !globalThis.fetch) {
      return
    }
    
    // Store original fetch
    originalFetch = globalThis.fetch

    // Patch global fetch
    const interceptedFetch = async function(
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      const startTime = Date.now()
      const url = input instanceof URL ? input.toString() : 
                 typeof input === 'string' ? input : input.url
      
      // Log ALL HTTP requests when debugging to discover GitHub Copilot endpoints
      // Filter out common noise like localhost, internal services, etc.
      const shouldSkip = shouldSkipUrl(url)
      
      if (shouldSkip) {
        return originalFetch!(input, init)
      }
      
      if (!originalFetch) {
        return originalFetch!(input, init)
      }

      const method = init?.method || 'GET'
      const headers = extractHeaders(init?.headers)
      let requestBody: string | undefined

      // Capture request body for POST/PUT requests
      if (init?.body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        try {
          if (typeof init.body === 'string') {
            requestBody = init.body
          } else if (init.body instanceof FormData) {
            requestBody = '[FormData]'
          } else if (init.body instanceof ArrayBuffer) {
            requestBody = '[ArrayBuffer]'
          } else if (init.body instanceof ReadableStream) {
            requestBody = '[ReadableStream]'
          } else {
            requestBody = init.body.toString()
          }
        } catch (error) {
          requestBody = '[Unable to serialize body]'
          log.warn("Failed to serialize request body", { error, url })
        }
      }

      const requestData: HttpLogData = {
        url,
        method,
        headers,
        body: requestBody,
        timestamp: startTime
      }

      // Log the raw HTTP request
      await logHttpRequest(requestData)

      try {
        // Make the actual request
        const response = await originalFetch(input, init)
        const duration = Date.now() - startTime

        // Clone the response to read the body without consuming it
        const responseClone = response.clone()
        let responseBody: string | undefined

        try {
          // Try to read response body as text
          const contentType = response.headers.get('content-type') || ''
          if (contentType.includes('application/json') || 
              contentType.includes('text/') ||
              contentType.includes('application/xml')) {
            responseBody = await responseClone.text()
            
            // Truncate very large responses
            if (responseBody.length > 100000) {
              responseBody = responseBody.substring(0, 100000) + '... [truncated]'
            }
          } else {
            responseBody = `[Binary content: ${contentType}]`
          }
        } catch (error) {
          responseBody = '[Unable to read response body]'
          log.warn("Failed to read response body", { error, url })
        }

        const responseData: HttpResponseData = {
          ...requestData,
          status: response.status,
          statusText: response.statusText,
          responseHeaders: extractHeaders(response.headers),
          responseBody,
          duration
        }

        // Log the raw HTTP response
        await logHttpResponse(responseData)

        return response
      } catch (error) {
        const duration = Date.now() - startTime
        
        // Log failed request
        const errorData: HttpResponseData = {
          ...requestData,
          status: 0,
          statusText: 'Network Error',
          responseHeaders: {},
          responseBody: error instanceof Error ? error.message : String(error),
          duration
        }

        await logHttpResponse(errorData)
        throw error
      }
    }
    
    // Assign the function to globalThis.fetch
    globalThis.fetch = interceptedFetch as typeof globalThis.fetch

    isEnabled = true
    log.info("HTTP interceptor enabled")
  }

  /**
   * Set the current session and message context for logging
   */
  export function setContext(sessionID: string, messageID: string): void {
    activeSessionID = sessionID
    activeMessageID = messageID
  }

  /**
   * Clear the current session context
   */
  export function clearContext(): void {
    activeSessionID = null
    activeMessageID = null
  }

  /**
   * Disable the HTTP interceptor and restore original fetch
   */
  export function disable(): void {
    if (!isEnabled || !originalFetch) return

    globalThis.fetch = originalFetch
    originalFetch = null
    isEnabled = false
    log.info("HTTP interceptor disabled")
  }

  /**
   * Check if a URL should be skipped from logging (to reduce noise)
   */
  function shouldSkipUrl(url: string): boolean {
    const skipPatterns = [
      // Local development
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
      
      // Internal/system URLs
      'ai-sdk://',
      'file://',
      'chrome-extension://',
      'moz-extension://',
      
      // Common telemetry/metrics that aren't AI related
      'google-analytics.com',
      'googletagmanager.com',
      'segment.io',
      'mixpanel.com',
      'amplitude.com',
      
      // CDNs for static assets (unless they're AI related)
      'cdnjs.cloudflare.com',
      'unpkg.com',
      'jsdelivr.net'
    ]

    // Skip if it matches any skip pattern
    if (skipPatterns.some(pattern => url.includes(pattern))) {
      return true
    }

    // Skip very short URLs or malformed ones
    if (url.length < 10 || !url.includes('://')) {
      return true
    }

    return false
  }

  /**
   * Extract headers as a plain object
   */
  function extractHeaders(headers?: HeadersInit): Record<string, string> {
    const result: Record<string, string> = {}

    if (!headers) return result

    if (headers instanceof Headers) {
      headers.forEach((value, key) => {
        result[key] = value
      })
    } else if (Array.isArray(headers)) {
      headers.forEach(([key, value]) => {
        result[key] = value
      })
    } else {
      Object.entries(headers).forEach(([key, value]) => {
        result[key] = value
      })
    }

    return result
  }

  /**
   * Log raw HTTP request to file
   */
  async function logHttpRequest(requestData: HttpLogData): Promise<void> {
    // Use fallback context if no session context is set (for bootstrap requests)
    const sessionID = activeSessionID || "bootstrap"
    const messageID = activeMessageID || "init"
    

    try {
      await HttpFileLogger.logRawHttpRequest(
        sessionID,
        messageID,
        requestData
      )
    } catch (error) {
      log.error("Failed to log HTTP request", { error, url: requestData.url })
    }
  }

  /**
   * Log raw HTTP response to file
   */
  async function logHttpResponse(responseData: HttpResponseData): Promise<void> {
    // Use fallback context if no session context is set (for bootstrap requests)
    const sessionID = activeSessionID || "bootstrap"
    const messageID = activeMessageID || "init"

    try {
      await HttpFileLogger.logRawHttpResponse(
        sessionID,
        messageID,
        responseData
      )
    } catch (error) {
      log.error("Failed to log HTTP response", { error, url: responseData.url })
    }
  }

  /**
   * Get the current enabled status
   */
  export function getStatus(): { enabled: boolean; hasContext: boolean } {
    return {
      enabled: isEnabled,
      hasContext: activeSessionID !== null && activeMessageID !== null
    }
  }
}