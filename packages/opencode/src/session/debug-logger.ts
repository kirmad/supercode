import { DebugLogs } from "./debug-logs"
import type { ModelMessage } from "ai"

/**
 * Centralized debug logging utilities for session operations
 */
export namespace DebugLogger {
  
  export function logMessagesToSend(
    sessionID: string,
    messageID: string,
    messages: ModelMessage[],
    providerID: string,
    modelID: string
  ) {
    // Log each message being sent
    for (const message of messages) {
      // Only log user, assistant, and system roles (filter out tool role)
      if (message.role === "user" || message.role === "assistant" || message.role === "system") {
        DebugLogs.addLog(DebugLogs.createMessageSentLog(
          sessionID,
          messageID,
          message.role,
          typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
          providerID,
          modelID,
          { messageCount: messages.length }
        ))
      }
    }
  }

  export function logProtocolRequest(
    sessionID: string,
    messageID: string,
    providerID: string,
    modelID: string,
    requestData: {
      messageCount: number,
      enabledTools: string[],
      temperature?: number,
      topP?: number
    }
  ) {
    DebugLogs.addLog(DebugLogs.createProtocolTransactionLog(
      sessionID,
      messageID,
      "request",
      providerID,
      modelID,
      requestData
    ))
  }

  export function logProtocolResponse(
    sessionID: string,
    messageID: string,
    providerID: string,
    modelID: string,
    responseData: {
      partsCount: number,
      completed: boolean
    },
    tokens: any,
    cost: number,
    duration: number
  ) {
    DebugLogs.addLog(DebugLogs.createProtocolTransactionLog(
      sessionID,
      messageID,
      "response",
      providerID,
      modelID,
      undefined, // requestData
      responseData,
      tokens,
      cost,
      duration
    ))
  }

  export function logMessageReceived(
    sessionID: string,
    messageID: string,
    content: string,
    metadata?: Record<string, any>
  ) {
    DebugLogs.addLog(DebugLogs.createMessageReceivedLog(
      sessionID,
      messageID,
      content,
      false, // not streaming since we're logging after completion
      metadata
    ))
  }

  export function logToolCallSent(
    sessionID: string,
    messageID: string,
    toolCallId: string,
    toolName: string,
    input: any
  ) {
    DebugLogs.addLog(DebugLogs.createToolCallSentLog(
      sessionID,
      messageID,
      toolCallId,
      toolName,
      input
    ))
  }

  export function logToolCallResult(
    sessionID: string,
    messageID: string,
    toolCallId: string,
    toolName: string,
    output: string,
    success: boolean,
    duration: number
  ) {
    DebugLogs.addLog(DebugLogs.createToolCallResultLog(
      sessionID,
      messageID,
      toolCallId,
      toolName,
      output,
      success,
      duration
    ))
  }
}