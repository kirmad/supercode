/**
 * WebSocket utility functions for managing WebSocket connections and events
 */

/**
 * WebSocket connection states
 */
export enum WebSocketState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3
}

/**
 * WebSocket event types for comment threading
 */
export const WebSocketEvents = {
  // Comment-specific events
  COMMENT_THREAD_CREATED: 'comment.thread.created',
  COMMENT_RESPONSE_ADDED: 'comment.response.added',
  COMMENT_AI_RESPONSE: 'comment.ai.response',
  COMMENT_AI_CHUNK: 'comment.ai.chunk',

  // Session events
  SESSION_CREATED: 'session.created',
  SESSION_MESSAGE: 'session.message',
  SESSION_ERROR: 'session.error',
  SESSION_CLOSED: 'session.closed',

  // Connection events
  CONNECTION_OPEN: 'connection.open',
  CONNECTION_CLOSE: 'connection.close',
  CONNECTION_ERROR: 'connection.error',
  CONNECTION_RECONNECT: 'connection.reconnect'
} as const

export type WebSocketEventType = typeof WebSocketEvents[keyof typeof WebSocketEvents]

/**
 * Check if WebSocket is in a connected state
 */
export function isWebSocketConnected(readyState: number): boolean {
  return readyState === WebSocketState.OPEN
}

/**
 * Check if WebSocket is connecting
 */
export function isWebSocketConnecting(readyState: number): boolean {
  return readyState === WebSocketState.CONNECTING
}

/**
 * Check if WebSocket is closed or closing
 */
export function isWebSocketClosed(readyState: number): boolean {
  return readyState === WebSocketState.CLOSED || readyState === WebSocketState.CLOSING
}

/**
 * Get human-readable WebSocket state
 */
export function getWebSocketStateString(readyState: number): string {
  switch (readyState) {
    case WebSocketState.CONNECTING:
      return 'CONNECTING'
    case WebSocketState.OPEN:
      return 'OPEN'
    case WebSocketState.CLOSING:
      return 'CLOSING'
    case WebSocketState.CLOSED:
      return 'CLOSED'
    default:
      return 'UNKNOWN'
  }
}

/**
 * Create a WebSocket event payload
 */
export function createWebSocketEvent(
  type: WebSocketEventType,
  data: any,
  sessionId?: string
): {
  event: WebSocketEventType
  data: any
  sessionId?: string
  timestamp: number
} {
  return {
    event: type,
    data,
    sessionId,
    timestamp: Date.now()
  }
}

/**
 * Parse WebSocket message safely
 */
export function parseWebSocketMessage(message: string | MessageEvent): any {
  try {
    const data = typeof message === 'string' ? message : message.data
    return JSON.parse(data)
  } catch (error) {
    console.warn('Failed to parse WebSocket message:', error)
    return null
  }
}

/**
 * Create a WebSocket message for sending
 */
export function createWebSocketMessage(
  type: string,
  payload: any,
  id?: string
): string {
  const message = {
    type,
    payload,
    id: id || generateMessageId(),
    timestamp: Date.now()
  }
  return JSON.stringify(message)
}

/**
 * Generate unique message ID
 */
export function generateMessageId(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substr(2, 9)
  return `msg-${timestamp}-${random}`
}

/**
 * WebSocket connection retry utility
 */
export class WebSocketRetryManager {
  private retryCount = 0
  private maxRetries: number
  private baseDelay: number
  private maxDelay: number

  constructor(
    maxRetries = 5,
    baseDelay = 1000,
    maxDelay = 30000
  ) {
    this.maxRetries = maxRetries
    this.baseDelay = baseDelay
    this.maxDelay = maxDelay
  }

  /**
   * Calculate delay with exponential backoff
   */
  public getRetryDelay(): number {
    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.retryCount),
      this.maxDelay
    )
    return delay + (Math.random() * 1000) // Add jitter
  }

  /**
   * Check if should retry
   */
  public shouldRetry(): boolean {
    return this.retryCount < this.maxRetries
  }

  /**
   * Increment retry count
   */
  public incrementRetry(): void {
    this.retryCount++
  }

  /**
   * Reset retry count
   */
  public reset(): void {
    this.retryCount = 0
  }

  /**
   * Get current retry count
   */
  public getRetryCount(): number {
    return this.retryCount
  }

  /**
   * Get max retries
   */
  public getMaxRetries(): number {
    return this.maxRetries
  }
}

/**
 * WebSocket heartbeat manager
 */
export class WebSocketHeartbeat {
  private pingInterval: NodeJS.Timeout | null = null
  private pongTimeout: NodeJS.Timeout | null = null
  private readonly pingIntervalMs: number
  private readonly pongTimeoutMs: number
  private onConnectionLost?: () => void

  constructor(
    pingIntervalMs = 30000,
    pongTimeoutMs = 5000,
    onConnectionLost?: () => void
  ) {
    this.pingIntervalMs = pingIntervalMs
    this.pongTimeoutMs = pongTimeoutMs
    this.onConnectionLost = onConnectionLost
  }

  /**
   * Start heartbeat
   */
  public start(sendPing: () => Promise<void>): void {
    this.stop() // Clear any existing intervals

    this.pingInterval = setInterval(async () => {
      try {
        await sendPing()

        // Set timeout for pong response
        this.pongTimeout = setTimeout(() => {
          console.warn('WebSocket heartbeat: Pong timeout')
          this.onConnectionLost?.()
        }, this.pongTimeoutMs)

      } catch (error) {
        console.error('WebSocket heartbeat: Ping failed', error)
        this.onConnectionLost?.()
      }
    }, this.pingIntervalMs)
  }

  /**
   * Handle pong response
   */
  public onPong(): void {
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout)
      this.pongTimeout = null
    }
  }

  /**
   * Stop heartbeat
   */
  public stop(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout)
      this.pongTimeout = null
    }
  }
}