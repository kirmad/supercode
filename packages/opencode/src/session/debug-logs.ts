import { z } from "zod"
import { Bus } from "../bus"
import { Log } from "../util/log"
import { ulid } from "ulid"

export namespace DebugLogs {
  const log = Log.create({ service: "debug-logs" })

  // Core debug log entry types
  export const MessageSent = z.object({
    id: z.string(),
    type: z.literal("message_sent"),
    timestamp: z.number(),
    sessionID: z.string(),
    messageID: z.string(),
    role: z.enum(["user", "assistant", "system"]),
    content: z.string(),
    providerID: z.string(),
    modelID: z.string(),
    metadata: z.record(z.any()).optional(),
  })
  export type MessageSent = z.infer<typeof MessageSent>

  export const MessageReceived = z.object({
    id: z.string(),
    type: z.literal("message_received"),
    timestamp: z.number(),
    sessionID: z.string(),
    messageID: z.string(),
    content: z.string(),
    streaming: z.boolean(),
    metadata: z.record(z.any()).optional(),
  })
  export type MessageReceived = z.infer<typeof MessageReceived>

  export const ToolCallSent = z.object({
    id: z.string(),
    type: z.literal("tool_call_sent"),
    timestamp: z.number(),
    sessionID: z.string(),
    messageID: z.string(),
    toolCallId: z.string(),
    toolName: z.string(),
    args: z.record(z.any()),
  })
  export type ToolCallSent = z.infer<typeof ToolCallSent>

  export const ToolCallResult = z.object({
    id: z.string(),
    type: z.literal("tool_call_result"),
    timestamp: z.number(),
    sessionID: z.string(),
    messageID: z.string(),
    toolCallId: z.string(),
    toolName: z.string(),
    result: z.string(),
    success: z.boolean(),
    duration: z.number(),
  })
  export type ToolCallResult = z.infer<typeof ToolCallResult>

  export const ProtocolTransaction = z.object({
    id: z.string(),
    type: z.literal("protocol_transaction"),
    timestamp: z.number(),
    sessionID: z.string(),
    messageID: z.string(),
    direction: z.enum(["request", "response"]),
    providerID: z.string(),
    modelID: z.string(),
    requestData: z.record(z.any()).optional(),
    responseData: z.record(z.any()).optional(),
    tokens: z.object({
      input: z.number(),
      output: z.number(),
      reasoning: z.number().optional(),
      cache: z.object({
        read: z.number(),
        write: z.number(),
      }).optional(),
    }).optional(),
    cost: z.number().optional(),
    duration: z.number().optional(),
  })
  export type ProtocolTransaction = z.infer<typeof ProtocolTransaction>

  export const SystemEvent = z.object({
    id: z.string(),
    type: z.literal("system_event"),
    timestamp: z.number(),
    sessionID: z.string(),
    event: z.string(),
    details: z.record(z.any()).optional(),
  })
  export type SystemEvent = z.infer<typeof SystemEvent>

  // Union type for all debug log entries
  export const DebugLogEntry = z.discriminatedUnion("type", [
    MessageSent,
    MessageReceived,
    ToolCallSent,
    ToolCallResult,
    ProtocolTransaction,
    SystemEvent,
  ])
  export type DebugLogEntry = z.infer<typeof DebugLogEntry>

  // Event definitions for the Bus system
  export const Event = {
    LogEntry: Bus.event("debug_logs.entry", DebugLogEntry),
  }

  // Storage for debug logs (in-memory with size limit)
  const MAX_LOGS_PER_SESSION = 1000
  const logs = new Map<string, DebugLogEntry[]>()

  export function addLog(entry: DebugLogEntry) {
    const sessionLogs = logs.get(entry.sessionID) || []
    sessionLogs.push(entry)
    
    // Keep only the last MAX_LOGS_PER_SESSION entries
    if (sessionLogs.length > MAX_LOGS_PER_SESSION) {
      sessionLogs.splice(0, sessionLogs.length - MAX_LOGS_PER_SESSION)
    }
    
    logs.set(entry.sessionID, sessionLogs)
    
    // Publish to event bus for real-time streaming
    Bus.publish(Event.LogEntry, entry)
    
    log.debug("debug log added", { 
      type: entry.type, 
      sessionID: entry.sessionID,
      id: entry.id 
    })
  }

  export function getLogs(sessionID: string, limit?: number): DebugLogEntry[] {
    const sessionLogs = logs.get(sessionID) || []
    if (limit) {
      return sessionLogs.slice(-limit)
    }
    return sessionLogs
  }

  export function clearLogs(sessionID: string) {
    logs.delete(sessionID)
    log.info("debug logs cleared", { sessionID })
  }

  export function getAllSessionLogs(): Record<string, DebugLogEntry[]> {
    const result: Record<string, DebugLogEntry[]> = {}
    for (const [sessionID, sessionLogs] of logs.entries()) {
      result[sessionID] = sessionLogs
    }
    return result
  }

  // Helper functions to create specific log entries
  export function createMessageSentLog(
    sessionID: string,
    messageID: string,
    role: "user" | "assistant" | "system",
    content: string,
    providerID: string,
    modelID: string,
    metadata?: Record<string, any>
  ): MessageSent {
    return {
      id: ulid(),
      type: "message_sent",
      timestamp: Date.now(),
      sessionID,
      messageID,
      role,
      content,
      providerID,
      modelID,
      metadata,
    }
  }

  export function createMessageReceivedLog(
    sessionID: string,
    messageID: string,
    content: string,
    streaming: boolean,
    metadata?: Record<string, any>
  ): MessageReceived {
    return {
      id: ulid(),
      type: "message_received",
      timestamp: Date.now(),
      sessionID,
      messageID,
      content,
      streaming,
      metadata,
    }
  }

  export function createToolCallSentLog(
    sessionID: string,
    messageID: string,
    toolCallId: string,
    toolName: string,
    args: Record<string, any>
  ): ToolCallSent {
    return {
      id: ulid(),
      type: "tool_call_sent",
      timestamp: Date.now(),
      sessionID,
      messageID,
      toolCallId,
      toolName,
      args,
    }
  }

  export function createToolCallResultLog(
    sessionID: string,
    messageID: string,
    toolCallId: string,
    toolName: string,
    result: string,
    success: boolean,
    duration: number
  ): ToolCallResult {
    return {
      id: ulid(),
      type: "tool_call_result",
      timestamp: Date.now(),
      sessionID,
      messageID,
      toolCallId,
      toolName,
      result,
      success,
      duration,
    }
  }

  export function createProtocolTransactionLog(
    sessionID: string,
    messageID: string,
    direction: "request" | "response",
    providerID: string,
    modelID: string,
    requestData?: Record<string, any>,
    responseData?: Record<string, any>,
    tokens?: ProtocolTransaction["tokens"],
    cost?: number,
    duration?: number
  ): ProtocolTransaction {
    return {
      id: ulid(),
      type: "protocol_transaction",
      timestamp: Date.now(),
      sessionID,
      messageID,
      direction,
      providerID,
      modelID,
      requestData,
      responseData,
      tokens,
      cost,
      duration,
    }
  }

  export function createSystemEventLog(
    sessionID: string,
    event: string,
    details?: Record<string, any>
  ): SystemEvent {
    return {
      id: ulid(),
      type: "system_event",
      timestamp: Date.now(),
      sessionID,
      event,
      details,
    }
  }
}