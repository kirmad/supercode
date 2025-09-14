/**
 * WebSocket Client for testing and SDK usage
 * This client provides a simple interface to connect to the OpenCode WebSocket server
 */

import { WSMessage, type WSRequestType, type WSResponseType, type WSEventType, type WSErrorType, type WSControlType } from "./websocket-handler"

export interface WebSocketClientOptions {
  url: string
  sessionId?: string
  directory?: string
  autoReconnect?: boolean
  reconnectDelay?: number
  maxReconnectAttempts?: number
  heartbeatInterval?: number
}

interface InternalOptions {
  url: string
  sessionId?: string
  directory: string
  autoReconnect: boolean
  reconnectDelay: number
  maxReconnectAttempts: number
  heartbeatInterval: number
}

export class WebSocketClient {
  private ws: WebSocket | null = null
  private options: InternalOptions
  private pendingRequests = new Map<string, {
    resolve: (data: any) => void
    reject: (error: any) => void
    timeout: NodeJS.Timeout
  }>()
  private eventListeners = new Map<string, Set<(data: any) => void>>()
  private reconnectAttempts = 0
  private reconnectTimeout: NodeJS.Timeout | null = null
  private heartbeatInterval: NodeJS.Timeout | null = null
  private messageCounter = 0
  private isClosing = false

  constructor(options: WebSocketClientOptions) {
    this.options = {
      url: options.url,
      sessionId: options.sessionId || undefined,
      directory: options.directory || process.cwd(),
      autoReconnect: options.autoReconnect ?? true,
      reconnectDelay: options.reconnectDelay ?? 1000,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 10,
      heartbeatInterval: options.heartbeatInterval ?? 30000,
    }
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Build connection URL with parameters
        const url = new URL(this.options.url)
        if (this.options.directory) {
          url.searchParams.set("directory", this.options.directory)
        }

        // Create WebSocket connection
        this.ws = new WebSocket(url.toString(), {
          headers: this.options.sessionId ? {
            "x-session-id": this.options.sessionId,
          } : undefined,
        } as any)

        this.ws.onopen = () => {
          console.log("WebSocket connected")
          this.reconnectAttempts = 0
          this.setupHeartbeat()
          resolve()
        }

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data)
        }

        this.ws.onerror = (error) => {
          console.error("WebSocket error:", error)
          reject(error)
        }

        this.ws.onclose = (event) => {
          console.log("WebSocket closed", { code: event.code, reason: event.reason })
          this.cleanup()
          
          if (this.options.autoReconnect && !this.isClosing) {
            this.attemptReconnect()
          }
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Disconnect from WebSocket server
   */
  async disconnect(): Promise<void> {
    this.isClosing = true
    this.cleanup()
    
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  /**
   * Send API request over WebSocket
   */
  async request<T = any>(
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    path: string,
    params?: {
      query?: Record<string, any>
      body?: any
      headers?: Record<string, string>
    }
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error("WebSocket not connected"))
        return
      }

      const id = this.generateId()
      const request: WSRequestType = {
        type: "request",
        id,
        method,
        path,
        params,
        timestamp: Date.now(),
      }

      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error("Request timeout"))
      }, 30000) // 30 second timeout

      // Store pending request
      this.pendingRequests.set(id, { resolve, reject, timeout })

      // Send request
      this.ws.send(JSON.stringify(request))
    })
  }

  /**
   * Subscribe to events
   */
  on(event: string, listener: (data: any) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
      
      // Send subscribe message
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const control: WSControlType = {
          type: "control",
          action: "subscribe",
          data: { events: [event] },
          timestamp: Date.now(),
        }
        this.ws.send(JSON.stringify(control))
      }
    }

    this.eventListeners.get(event)!.add(listener)

    // Return unsubscribe function
    return () => {
      const listeners = this.eventListeners.get(event)
      if (listeners) {
        listeners.delete(listener)
        
        if (listeners.size === 0) {
          this.eventListeners.delete(event)
          
          // Send unsubscribe message
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const control: WSControlType = {
              type: "control",
              action: "unsubscribe",
              data: { events: [event] },
              timestamp: Date.now(),
            }
            this.ws.send(JSON.stringify(control))
          }
        }
      }
    }
  }

  /**
   * Send ping message
   */
  async ping(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error("WebSocket not connected"))
        return
      }

      const id = this.generateId()
      const control: WSControlType = {
        type: "control",
        action: "ping",
        id,
        timestamp: Date.now(),
      }

      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error("Ping timeout"))
      }, 5000)

      // Store pending request
      this.pendingRequests.set(id, {
        resolve,
        reject,
        timeout,
      })

      this.ws.send(JSON.stringify(control))
    })
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: string) {
    try {
      const message = JSON.parse(data)
      const parsed = WSMessage.parse(message)

      switch (parsed.type) {
        case "response":
          this.handleResponse(parsed)
          break
        case "event":
          this.handleEvent(parsed)
          break
        case "error":
          this.handleError(parsed)
          break
        case "control":
          this.handleControl(parsed)
          break
      }
    } catch (error) {
      console.error("Failed to parse WebSocket message:", error)
    }
  }

  /**
   * Handle response message
   */
  private handleResponse(response: WSResponseType) {
    const pending = response.id ? this.pendingRequests.get(response.id) : null
    
    if (pending) {
      clearTimeout(pending.timeout)
      this.pendingRequests.delete(response.id!)
      
      if (response.error) {
        pending.reject(response.error)
      } else {
        pending.resolve(response.data)
      }
    }
  }

  /**
   * Handle event message
   */
  private handleEvent(event: WSEventType) {
    const listeners = this.eventListeners.get(event.event)
    
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event.data)
        } catch (error) {
          console.error("Event listener error:", error)
        }
      })
    }

    // Also emit to wildcard listeners
    const wildcardListeners = this.eventListeners.get("*")
    if (wildcardListeners) {
      wildcardListeners.forEach(listener => {
        try {
          listener({ event: event.event, data: event.data })
        } catch (error) {
          console.error("Wildcard listener error:", error)
        }
      })
    }
  }

  /**
   * Handle error message
   */
  private handleError(error: WSErrorType) {
    const pending = error.id ? this.pendingRequests.get(error.id) : null
    
    if (pending) {
      clearTimeout(pending.timeout)
      this.pendingRequests.delete(error.id!)
      pending.reject(error.error)
    } else {
      console.error("WebSocket error:", error.error)
    }
  }

  /**
   * Handle control message
   */
  private handleControl(control: WSControlType) {
    if (control.action === "pong" && control.id) {
      const pending = this.pendingRequests.get(control.id)
      
      if (pending) {
        clearTimeout(pending.timeout)
        this.pendingRequests.delete(control.id)
        pending.resolve(control.data)
      }
    }
  }

  /**
   * Setup heartbeat
   */
  private setupHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }

    this.heartbeatInterval = setInterval(async () => {
      try {
        await this.ping()
      } catch (error) {
        console.error("Heartbeat failed:", error)
        // Connection might be dead, trigger reconnect
        if (this.ws) {
          this.ws.close()
        }
      }
    }, this.options.heartbeatInterval)
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      console.error("Max reconnect attempts reached")
      return
    }

    this.reconnectAttempts++
    const delay = this.options.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.options.maxReconnectAttempts})`)

    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch(error => {
        console.error("Reconnect failed:", error)
      })
    }, delay)
  }

  /**
   * Cleanup resources
   */
  private cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    // Reject all pending requests
    this.pendingRequests.forEach(pending => {
      clearTimeout(pending.timeout)
      pending.reject(new Error("Connection closed"))
    })
    this.pendingRequests.clear()
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `req-${++this.messageCounter}-${Date.now()}`
  }

  /**
   * Get WebSocket state
   */
  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

// Export for testing
export async function testWebSocketClient() {
  const client = new WebSocketClient({
    url: "ws://localhost:3000",
    autoReconnect: true,
  })

  try {
    // Connect
    await client.connect()
    console.log("Connected to WebSocket server")

    // Subscribe to events
    const unsubscribe = client.on("*", (data) => {
      console.log("Event received:", data)
    })

    // Test API calls
    console.log("\nTesting API calls over WebSocket:")

    // Get sessions
    const sessions = await client.request("GET", "/session")
    console.log("Sessions:", sessions)

    // Get config
    const config = await client.request("GET", "/config")
    console.log("Config:", config)

    // Test ping
    await client.ping()
    console.log("Ping successful")

    // Wait a bit for events
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Cleanup
    unsubscribe()
    await client.disconnect()
    console.log("Disconnected")
  } catch (error) {
    console.error("Test failed:", error)
    await client.disconnect()
  }
}

// Run test if this file is executed directly
if (import.meta.main) {
  testWebSocketClient()
}