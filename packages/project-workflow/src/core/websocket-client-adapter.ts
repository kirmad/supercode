/**
 * WebSocket Client Adapter for Operation Subscription
 * Based on SuperCodeWebSocketClient patterns with simplified interface
 */

import { createLogger } from './utils.js'
import type {
  WebSocketConfig,
  SuperCodeWebSocketEvent,
  ProcessedMessage
} from '../types/index.js'
import { OperationSubscriptionError } from '../types/index.js'

export type EventHandler = (event: SuperCodeWebSocketEvent) => void
export type ErrorHandler = (error: Error) => void
export type ConnectionHandler = () => void

/**
 * WebSocket client adapter for operation subscription
 * Provides a simplified interface focused on event listening
 */
export class WebSocketClientAdapter {
  private ws: WebSocket | null = null
  private logger = createLogger('WebSocketClientAdapter')
  private isConnected = false
  private isConnecting = false
  private connectingPromise: Promise<void> | null = null
  private reconnectAttempts = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null

  // Event handlers
  private eventHandlers = new Set<EventHandler>()
  private errorHandlers = new Set<ErrorHandler>()
  private openHandlers = new Set<ConnectionHandler>()
  private closeHandlers = new Set<ConnectionHandler>()

  constructor(private config: WebSocketConfig) {
    this.logger.debug('WebSocket client adapter created', {
      url: config.url,
      autoReconnect: config.autoReconnect,
      maxReconnectAttempts: config.maxReconnectAttempts
    })
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      this.logger.debug('Already connected')
      return
    }

    if (this.isConnecting && this.connectingPromise) {
      this.logger.debug('Connection in progress, waiting...')
      return this.connectingPromise
    }

    this.isConnecting = true
    this.connectingPromise = this.performConnection()

    try {
      await this.connectingPromise
      // Subscribe to all events after connection is established
      await this.subscribeToAllEvents()
    } finally {
      this.isConnecting = false
      this.connectingPromise = null
    }
  }

  /**
   * Perform the actual WebSocket connection
   */
  private async performConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.logger.debug('Attempting WebSocket connection', { url: this.config.url })

        // Create WebSocket connection
        this.ws = new WebSocket(this.config.url)

        // Connection timeout
        const timeout = setTimeout(() => {
          if (!this.isConnected) {
            this.ws?.close()
            reject(new OperationSubscriptionError(
              'WebSocket connection timeout',
              { url: this.config.url, timeout: 10000 }
            ))
          }
        }, 10000)

        // Set up event handlers
        this.ws.onopen = () => {
          clearTimeout(timeout)
          this.logger.info('WebSocket connected successfully')
          this.isConnected = true
          this.reconnectAttempts = 0

          // Start heartbeat
          this.startHeartbeat()

          // Notify open handlers
          this.openHandlers.forEach(handler => {
            try {
              handler()
            } catch (error) {
              this.logger.error('Error in open handler', { error })
            }
          })

          resolve()
        }

        this.ws.onmessage = (event) => {
          this.handleMessage(event)
        }

        this.ws.onerror = (error) => {
          this.logger.error('WebSocket error', { error })
          const wsError = new OperationSubscriptionError(
            'WebSocket connection error',
            { originalError: error, url: this.config.url }
          )

          this.errorHandlers.forEach(handler => {
            try {
              handler(wsError)
            } catch (handlerError) {
              this.logger.error('Error in error handler', { error: handlerError })
            }
          })

          if (!this.isConnected) {
            reject(wsError)
          }
        }

        this.ws.onclose = (event) => {
          this.logger.info('WebSocket connection closed', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean
          })

          this.isConnected = false
          this.stopHeartbeat()

          // Notify close handlers
          this.closeHandlers.forEach(handler => {
            try {
              handler()
            } catch (error) {
              this.logger.error('Error in close handler', { error })
            }
          })

          // Attempt reconnection if enabled
          if (this.config.autoReconnect && !event.wasClean) {
            this.scheduleReconnect()
          }

          if (!this.isConnected) {
            reject(new OperationSubscriptionError(
              `WebSocket connection closed: ${event.reason || 'Unknown reason'}`,
              { code: event.code, wasClean: event.wasClean }
            ))
          }
        }


      } catch (error) {
        reject(new OperationSubscriptionError(
          'Failed to create WebSocket connection',
          { originalError: error, url: this.config.url }
        ))
      }
    })
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data)

      // Log all raw messages for debugging
      this.logger.debug('Raw WebSocket message', {
        rawData: data,
        dataKeys: Object.keys(data || {}),
        hasSessionId: !!(data?.sessionId || data?.sessionID || data?.session || data?.message?.sessionId),
        type: data?.type,
        event: data?.event
      })

      // Convert to SuperCode event format if needed
      const superCodeEvent = this.normalizeEvent(data)

      // Process only if it's an event
      if (superCodeEvent.type === 'event') {
        this.logger.debug('Received WebSocket event', {
          event: superCodeEvent.event,
          hasData: !!superCodeEvent.data,
          dataStructure: superCodeEvent.data ? Object.keys(superCodeEvent.data) : []
        })

        // Notify all event handlers
        this.eventHandlers.forEach(handler => {
          try {
            handler(superCodeEvent)
          } catch (error) {
            this.logger.error('Error in event handler', { error, event: superCodeEvent.event })
          }
        })
      }

    } catch (error) {
      this.logger.error('Failed to parse WebSocket message', {
        error,
        rawMessage: event.data
      })
    }
  }

  /**
   * Normalize incoming data to SuperCode event format
   */
  private normalizeEvent(data: any): SuperCodeWebSocketEvent {
    // If already in correct format, return as-is
    if (data.type === 'event' && data.event && data.data) {
      return data as SuperCodeWebSocketEvent
    }

    // Try to convert other formats
    return {
      type: 'event',
      event: data.event || data.type || 'unknown',
      data: data.data || data,
      timestamp: data.timestamp || Date.now(),
      id: data.id
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    if (!this.config.heartbeatInterval) return

    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected && this.ws) {
        try {
          // Send ping frame
          this.ws.send(JSON.stringify({
            type: 'control',
            action: 'ping',
            timestamp: Date.now()
          }))
        } catch (error) {
          this.logger.error('Failed to send heartbeat', { error })
        }
      }
    }, this.config.heartbeatInterval)
  }

  /**
   * Stop heartbeat timer
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    const maxAttempts = this.config.maxReconnectAttempts || 10
    if (this.reconnectAttempts >= maxAttempts) {
      this.logger.warn('Max reconnection attempts reached', {
        attempts: this.reconnectAttempts,
        maxAttempts
      })
      return
    }

    this.reconnectAttempts++
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000)

    this.logger.info('Scheduling reconnection', {
      attempt: this.reconnectAttempts,
      delay
    })

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect()
      } catch (error) {
        this.logger.error('Reconnection attempt failed', {
          error,
          attempt: this.reconnectAttempts
        })
      }
    }, delay)
  }

  /**
   * Subscribe to all WebSocket events using wildcard pattern
   * This matches the SuperCodeWebSocketClient pattern for receiving all bus events
   * No subscription message needed - the server broadcasts to all connected clients
   */
  private async subscribeToAllEvents(): Promise<void> {
    try {
      this.logger.debug('Setting up event listening (no subscription required)...')

      // Wait a bit to ensure connection is fully ready
      await new Promise(resolve => setTimeout(resolve, 200))

      if (!this.isConnected || !this.ws) {
        throw new Error('WebSocket connection lost during setup')
      }

      // No subscription message needed - the server automatically broadcasts
      // message events to all connected WebSocket clients
      this.logger.info('✅ Ready to receive all WebSocket events')

    } catch (error) {
      this.logger.error('Failed to setup event listening', { error })
      throw error
    }
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect(): Promise<void> {
    this.logger.debug('Disconnecting WebSocket')

    // Clear timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.stopHeartbeat()

    // Close WebSocket
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect')
      this.ws = null
    }

    this.isConnected = false
    this.isConnecting = false
    this.connectingPromise = null
    this.reconnectAttempts = 0
  }

  /**
   * Add event handler
   */
  onEvent(handler: EventHandler): void {
    this.eventHandlers.add(handler)
  }

  /**
   * Remove event handler
   */
  offEvent(handler: EventHandler): void {
    this.eventHandlers.delete(handler)
  }

  /**
   * Add error handler
   */
  onError(handler: ErrorHandler): void {
    this.errorHandlers.add(handler)
  }

  /**
   * Remove error handler
   */
  offError(handler: ErrorHandler): void {
    this.errorHandlers.delete(handler)
  }

  /**
   * Add connection open handler
   */
  onOpen(handler: ConnectionHandler): void {
    this.openHandlers.add(handler)
  }

  /**
   * Remove connection open handler
   */
  offOpen(handler: ConnectionHandler): void {
    this.openHandlers.delete(handler)
  }

  /**
   * Add connection close handler
   */
  onClose(handler: ConnectionHandler): void {
    this.closeHandlers.add(handler)
  }

  /**
   * Remove connection close handler
   */
  offClose(handler: ConnectionHandler): void {
    this.closeHandlers.delete(handler)
  }

  /**
   * Check if connected
   */
  get connected(): boolean {
    return this.isConnected
  }

  /**
   * Get connection status
   */
  getStatus(): {
    connected: boolean
    connecting: boolean
    reconnectAttempts: number
    url: string
  } {
    return {
      connected: this.isConnected,
      connecting: this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
      url: this.config.url
    }
  }

  /**
   * Convert SuperCode event to processed message format
   */
  static convertToProcessedMessage(event: SuperCodeWebSocketEvent): ProcessedMessage | null {
    // Extract session ID with specific patterns for message.part.updated and message.completed events
    let sessionId = null

    if (event.event === 'message.part.updated' || event.event === 'message.completed') {
      // For message part events, session ID is in event.data.part.sessionID or event.data.message.sessionID
      sessionId = event.data?.part?.sessionID ||
                  event.data?.message?.sessionID ||
                  event.data?.part?.sessionId ||
                  event.data?.message?.sessionId
    } else {
      // For other events, use broader search patterns
      sessionId = event.data?.sessionId ||
                  event.data?.sessionID ||
                  event.data?.info?.sessionID ||   // Critical: for message.updated events
                  event.data?.session_id ||
                  event.data?.session ||
                  event.data?.message?.sessionId ||
                  event.data?.message?.sessionID ||
                  event.data?.message?.session_id ||
                  event.data?.message?.session ||
                  event.id ||
                  null
    }

    if (!sessionId || sessionId === 'unknown') {
      return null
    }

    // Determine role with broader patterns including part-specific patterns
    let role = 'assistant'
    if (event.event === 'message.part.updated' || event.event === 'message.completed') {
      // For message part events, assume assistant role (agent responses)
      role = 'assistant'
    } else {
      role = event.data?.message?.info?.role ||
             event.data?.message?.role ||
             event.data?.role ||
             event.data?.sender ||
             event.data?.from ||
             'assistant'
    }

    // Extract content with specific patterns for message part events
    let content = ''
    if (event.event === 'message.part.updated') {
      // For message part updates, content is in event.data.part.text
      content = event.data?.part?.text || ''
    } else if (event.event === 'message.completed') {
      // For completed messages, might be in message content or parts
      if (event.data?.message?.content && typeof event.data.message.content === 'string') {
        content = event.data.message.content
      } else if (event.data?.message?.parts) {
        content = event.data.message.parts
          .filter((part: any) => part.type === 'text' && part.text)
          .map((part: any) => part.text)
          .join('')
      }
    } else {
      // For other events, use broader patterns
      if (event.data?.content && typeof event.data.content === 'string') {
        content = event.data.content
      } else if (event.data?.text && typeof event.data.text === 'string') {
        content = event.data.text
      } else if (event.data?.message?.content && typeof event.data.message.content === 'string') {
        content = event.data.message.content
      } else if (event.data?.message?.text && typeof event.data.message.text === 'string') {
        content = event.data.message.text
      } else if (event.data?.message?.parts) {
        content = event.data.message.parts
          .filter((part: any) => part.type === 'text' && part.text)
          .map((part: any) => part.text)
          .join('')
      } else if (event.data?.parts) {
        content = event.data.parts
          .filter((part: any) => part.type === 'text' && part.text)
          .map((part: any) => part.text)
          .join('')
      }
    }

    // Determine if partial based on event type and completion status
    let isPartial = true
    if (event.event === 'message.completed') {
      isPartial = false
    } else if (event.event === 'message.part.updated') {
      // Check if the part is completed
      isPartial = !(
        event.data?.part?.time?.completed ||
        event.data?.part?.completed
      )
    } else {
      // For other events, use broader patterns
      isPartial = !(
        event.data?.message?.time?.completed ||
        event.data?.message?.completed ||
        event.data?.completed ||
        event.data?.finished ||
        event.event?.includes('completed') ||
        event.event?.includes('finished')
      )
    }

    return {
      sessionId,
      role: role as 'assistant' | 'user' | 'system',
      content,
      isPartial,
      timestamp: new Date().toISOString(),
      rawEvent: event
    }
  }

  /**
   * Check if event is from agent
   */
  static isAgentMessage(event: SuperCodeWebSocketEvent): boolean {
    // Method 1: Direct role checks with broader patterns
    if (event.data?.message?.info?.role === 'assistant' ||
        event.data?.message?.role === 'assistant' ||
        event.data?.role === 'assistant' ||
        event.data?.sender === 'assistant' ||
        event.data?.from === 'assistant') {
      return true
    }

    // Method 2: Agent-specific event types (expanded)
    const agentEventTypes = [
      'agent.response',
      'agent.thinking',
      'agent.tool_use',
      'assistant.message',
      'message.part.updated',
      'message.completed',
      'message.delta',
      'message.chunk',
      'message.part',
      'session.message',
      'response.delta',
      'response.chunk',
      'content.delta',
      'content.chunk'
    ]

    if (agentEventTypes.includes(event.event)) {
      return true
    }

    // Method 3: Event name patterns (partial matches)
    const agentEventPatterns = [
      /message/i,
      /response/i,
      /delta/i,
      /chunk/i,
      /assistant/i,
      /agent/i
    ]

    if (agentEventPatterns.some(pattern => pattern.test(event.event))) {
      return true
    }

    // Method 4: Content analysis with broader search
    const hasContent = event.data?.content ||
                      event.data?.text ||
                      event.data?.message?.content ||
                      event.data?.message?.text ||
                      event.data?.message?.parts ||
                      event.data?.parts

    if (hasContent) {
      // Check for parts array
      const parts = event.data?.message?.parts || event.data?.parts
      if (parts && Array.isArray(parts)) {
        return parts.some((part: any) => {
          if (part.type === 'tool_use' || part.type === 'tool_result') {
            return true
          }

          if (part.text && part.type === 'text') {
            // Check for agent response patterns
            const agentPatterns = [
              /<[^>]+>/,  // XML tags often indicate structured agent responses
              /```/,      // Code blocks common in agent responses
              /review-insight/i,
              /hunk/i,
              /comment/i
            ]
            return agentPatterns.some(pattern => pattern.test(part.text))
          }
          return false
        })
      }

      // Check direct content for agent patterns
      const contentToCheck = event.data?.content ||
                            event.data?.text ||
                            event.data?.message?.content ||
                            event.data?.message?.text

      if (contentToCheck && typeof contentToCheck === 'string') {
        const agentPatterns = [
          /<[^>]+>/,  // XML tags
          /```/,      // Code blocks
          /review-insight/i,
          /hunk/i,
          /comment/i
        ]
        if (agentPatterns.some(pattern => pattern.test(contentToCheck))) {
          return true
        }
      }
    }

    // Method 5: Default to true for events with session IDs (be more permissive)
    const hasSessionId = !!(event.data?.sessionId ||
                           event.data?.sessionID ||
                           event.data?.session_id ||
                           event.data?.session ||
                           event.data?.message?.sessionId ||
                           event.id)

    // If we have a session ID and it's not clearly a control message, assume it could be agent
    if (hasSessionId && event.event !== 'control' && event.event !== 'ping' && event.event !== 'pong') {
      return true
    }

    return false
  }

  /**
   * Extract session ID from event
   */
  static extractSessionId(event: SuperCodeWebSocketEvent): string | null {
    return event.data?.sessionId ||
           event.data?.sessionID ||
           event.data?.info?.sessionID ||     // Critical: for message.updated events
           event.data?.part?.sessionID ||     // Critical: for message.part.updated events
           event.data?.session_id ||
           event.data?.session ||
           event.data?.message?.sessionId ||
           event.data?.message?.sessionID ||
           event.data?.message?.session_id ||
           event.data?.message?.session ||
           event.id ||
           null
  }
}