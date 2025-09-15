import { z } from "zod"
import type { ServerWebSocket } from "bun"
import { Log } from "../util/log"
import { Bus } from "../bus"
import { nanoid } from "nanoid"
import { Hono } from "hono"

/**
 * WebSocket Message Protocol Types
 */

// Base message structure
const BaseMessage = z.object({
  id: z.string().optional(), // Unique ID for request/response correlation
  timestamp: z.number().default(() => Date.now()),
})

// Request message from client
export const WSRequest = BaseMessage.extend({
  type: z.literal("request"),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  path: z.string(),
  params: z.object({
    query: z.record(z.string(), z.any()).optional(),
    param: z.record(z.string(), z.any()).optional(),
    body: z.any().optional(),
  }).optional(),
  headers: z.record(z.string(), z.string()).optional(),
})

// Response message to client
export const WSResponse = BaseMessage.extend({
  type: z.literal("response"),
  status: z.number(),
  data: z.any(),
  error: z.object({
    message: z.string(),
    code: z.string().optional(),
    details: z.any().optional(),
  }).optional(),
})

// Event message (server push)
export const WSEvent = BaseMessage.extend({
  type: z.literal("event"),
  event: z.string(),
  data: z.any(),
})

// Error message
export const WSError = BaseMessage.extend({
  type: z.literal("error"),
  error: z.object({
    message: z.string(),
    code: z.string().optional(),
    details: z.any().optional(),
  }),
})

// Control messages
export const WSControl = BaseMessage.extend({
  type: z.literal("control"),
  action: z.enum(["ping", "pong", "subscribe", "unsubscribe", "authenticate"]),
  data: z.any().optional(),
})

// Union of all message types
export const WSMessage = z.discriminatedUnion("type", [
  WSRequest,
  WSResponse,
  WSEvent,
  WSError,
  WSControl,
])

export type WSRequestType = z.infer<typeof WSRequest>
export type WSResponseType = z.infer<typeof WSResponse>
export type WSEventType = z.infer<typeof WSEvent>
export type WSErrorType = z.infer<typeof WSError>
export type WSControlType = z.infer<typeof WSControl>
export type WSMessageType = z.infer<typeof WSMessage>

/**
 * WebSocket Connection Context
 */
export interface WSConnectionContext {
  id: string
  sessionId?: string
  directory?: string
  subscriptions: Set<string>
  authenticated: boolean
  lastActivity: number
  ws: ServerWebSocket<WSConnectionData>
}

export interface WSConnectionData {
  connectionId: string
  sessionId?: string
  directory?: string
}

/**
 * WebSocket Handler Class
 */
export class WebSocketHandler {
  private static log = Log.create({ service: "websocket" })
  private static connections = new Map<string, WSConnectionContext>()
  private static app: Hono | null = null
  private static busUnsubscribers = new Map<string, () => void>()

  /**
   * Initialize WebSocket handler with Hono app
   */
  static initialize(app: Hono) {
    this.app = app
    this.log.info("WebSocket handler initialized")
  }

  /**
   * Handle WebSocket connection open with initialization delay
   */
  static async handleOpen(ws: ServerWebSocket<WSConnectionData>) {
    const connectionId = nanoid()
    ws.data.connectionId = connectionId

    const context: WSConnectionContext = {
      id: connectionId,
      sessionId: ws.data.sessionId,
      directory: ws.data.directory,
      subscriptions: new Set(),
      authenticated: false,
      lastActivity: Date.now(),
      ws,
    }

    this.connections.set(connectionId, context)
    this.log.info("WebSocket connection opened", { connectionId })

    // Add a small delay to ensure the connection is stable before sending initial message
    setTimeout(() => {
      // Verify connection is still active
      if (this.connections.has(connectionId)) {
        // Send welcome message
        this.sendMessage(ws, {
          type: "event",
          event: "connected",
          data: { connectionId },
          timestamp: Date.now(),
        })

        // Subscribe to all bus events for this connection
        this.subscribeToEvents(connectionId)
      }
    }, 100)
  }

  /**
   * Handle WebSocket message
   */
  static async handleMessage(
    ws: ServerWebSocket<WSConnectionData>,
    message: string | Buffer
  ) {
    const connectionId = ws.data.connectionId
    const context = this.connections.get(connectionId)

    if (!context) {
      this.log.error("Connection context not found", { connectionId })
      return
    }

    context.lastActivity = Date.now()

    try {
      const data = typeof message === "string" ? message : message.toString()
      const parsed = JSON.parse(data)
      const msg = WSMessage.parse(parsed)

      this.log.debug("WebSocket message received", {
        connectionId,
        type: msg.type,
        id: msg.id,
      })

      switch (msg.type) {
        case "request":
          await this.handleRequest(context, msg)
          break
        case "control":
          await this.handleControl(context, msg)
          break
        default:
          this.sendError(ws, {
            message: `Unsupported message type: ${msg.type}`,
            code: "UNSUPPORTED_MESSAGE_TYPE",
          }, msg.id)
      }
    } catch (error) {
      this.log.error("Failed to process WebSocket message", { error, connectionId })
      this.sendError(ws, {
        message: error instanceof Error ? error.message : "Invalid message format",
        code: "INVALID_MESSAGE",
      })
    }
  }

  /**
   * Handle WebSocket connection close
   */
  static handleClose(ws: ServerWebSocket<WSConnectionData>, code: number, reason: string) {
    const connectionId = ws.data.connectionId
    const context = this.connections.get(connectionId)

    if (context) {
      // Unsubscribe from events
      const unsubscriber = this.busUnsubscribers.get(connectionId)
      if (unsubscriber) {
        unsubscriber()
        this.busUnsubscribers.delete(connectionId)
      }

      this.connections.delete(connectionId)
      this.log.info("WebSocket connection closed", { connectionId, code, reason })
    }
  }

  /**
   * Handle WebSocket error
   */
  static handleError(ws: ServerWebSocket<WSConnectionData>, error: Error) {
    const connectionId = ws.data.connectionId
    this.log.error("WebSocket error", { connectionId, error })
  }

  /**
   * Handle API request over WebSocket
   */
  private static async handleRequest(context: WSConnectionContext, request: WSRequestType) {
    if (!this.app) {
      this.sendError(context.ws, {
        message: "Server not initialized",
        code: "SERVER_NOT_INITIALIZED",
      }, request.id)
      return
    }

    try {
      // Build URL from path and query params
      let url = `http://localhost${request.path}`
      if (request.params?.query) {
        const queryString = new URLSearchParams(request.params.query).toString()
        if (queryString) {
          url += `?${queryString}`
        }
      }

      // Add directory query param if context has it
      if (context.directory) {
        const separator = url.includes("?") ? "&" : "?"
        url += `${separator}directory=${encodeURIComponent(context.directory)}`
      }

      // Create fetch request
      const fetchOptions: RequestInit = {
        method: request.method,
        headers: {
          "Content-Type": "application/json",
          ...request.headers,
        },
      }

      // Add body for non-GET requests
      if (request.method !== "GET" && request.params?.body !== undefined) {
        fetchOptions.body = JSON.stringify(request.params.body)
      }

      // Execute request through Hono app
      const response = await this.app.fetch(new Request(url, fetchOptions))

      // Parse response
      const data = await response.json().catch(() => response.text())

      // Send response
      const wsResponse: WSResponseType = {
        type: "response",
        id: request.id,
        status: response.status,
        data,
        timestamp: Date.now(),
      }

      if (response.status >= 400) {
        wsResponse.error = {
          message: typeof data === "object" && data.message ? data.message : "Request failed",
          code: typeof data === "object" && data.code ? data.code : undefined,
          details: data,
        }
      }

      this.sendMessage(context.ws, wsResponse)
    } catch (error) {
      this.log.error("Failed to handle WebSocket request", { error, request })
      this.sendError(context.ws, {
        message: error instanceof Error ? error.message : "Request failed",
        code: "REQUEST_FAILED",
      }, request.id)
    }
  }

  /**
   * Handle control messages
   */
  private static async handleControl(context: WSConnectionContext, control: WSControlType) {
    switch (control.action) {
      case "ping":
        this.sendMessage(context.ws, {
          type: "control",
          action: "pong",
          id: control.id,
          timestamp: Date.now(),
        })
        break

      case "authenticate":
        // Handle authentication if needed
        context.authenticated = true
        this.sendMessage(context.ws, {
          type: "control",
          action: "authenticate",
          id: control.id,
          data: { authenticated: true },
          timestamp: Date.now(),
        })
        break

      case "subscribe":
        if (control.data?.events) {
          const events = Array.isArray(control.data.events) ? control.data.events : [control.data.events]
          events.forEach((event: string) => context.subscriptions.add(event))
          this.log.debug("Subscribed to events", { connectionId: context.id, events })
        }
        break

      case "unsubscribe":
        if (control.data?.events) {
          const events = Array.isArray(control.data.events) ? control.data.events : [control.data.events]
          events.forEach((event: string) => context.subscriptions.delete(event))
          this.log.debug("Unsubscribed from events", { connectionId: context.id, events })
        }
        break
    }
  }

  /**
   * Subscribe to Bus events for a connection
   */
  private static subscribeToEvents(connectionId: string) {
    const context = this.connections.get(connectionId)
    if (!context) return

    // Subscribe to all Bus events
    const unsubscriber = Bus.subscribeAll(async (event) => {
      // Check if connection still exists
      const currentContext = this.connections.get(connectionId)
      if (!currentContext) {
        return
      }

      // Check if connection is subscribed to this event type
      if (currentContext.subscriptions.size > 0 && !currentContext.subscriptions.has(event.type)) {
        return
      }

      // Send event to WebSocket client
      const wsEvent: WSEventType = {
        type: "event",
        event: event.type,
        data: event.properties,
        timestamp: Date.now(),
      }

      this.sendMessage(currentContext.ws, wsEvent)
    })

    this.busUnsubscribers.set(connectionId, unsubscriber)
  }

  /**
   * Broadcast event to all connected WebSocket clients
   */
  static broadcastEvent(event: string, data: any) {
    const wsEvent: WSEventType = {
      type: "event",
      event,
      data,
      timestamp: Date.now(),
    }

    this.connections.forEach((context) => {
      // Check if connection is subscribed to this event
      if (context.subscriptions.size > 0 && !context.subscriptions.has(event)) {
        return
      }

      try {
        this.sendMessage(context.ws, wsEvent)
      } catch (error) {
        this.log.error("Failed to broadcast event", { error, connectionId: context.id })
      }
    })
  }

  /**
   * Send message to WebSocket client
   */
  private static sendMessage(ws: ServerWebSocket<WSConnectionData>, message: WSMessageType) {
    try {
      ws.send(JSON.stringify(message))
    } catch (error) {
      this.log.error("Failed to send WebSocket message", { error })
    }
  }

  /**
   * Send error message to WebSocket client
   */
  private static sendError(
    ws: ServerWebSocket<WSConnectionData>,
    error: { message: string; code?: string; details?: any },
    id?: string
  ) {
    const errorMessage: WSErrorType = {
      type: "error",
      id,
      error,
      timestamp: Date.now(),
    }
    this.sendMessage(ws, errorMessage)
  }

  /**
   * Get active connections count
   */
  static getConnectionsCount(): number {
    return this.connections.size
  }

  /**
   * Get connection info
   */
  static getConnectionInfo(connectionId: string) {
    const context = this.connections.get(connectionId)
    if (!context) return null

    return {
      id: context.id,
      sessionId: context.sessionId,
      directory: context.directory,
      subscriptions: Array.from(context.subscriptions),
      authenticated: context.authenticated,
      lastActivity: context.lastActivity,
    }
  }

  /**
   * Get all connections info
   */
  static getAllConnections() {
    return Array.from(this.connections.entries()).map(([_id, context]) => ({
      id: context.id,
      sessionId: context.sessionId,
      directory: context.directory,
      subscriptions: Array.from(context.subscriptions),
      authenticated: context.authenticated,
      lastActivity: context.lastActivity,
    }))
  }
}