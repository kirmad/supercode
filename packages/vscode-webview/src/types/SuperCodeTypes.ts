/**
 * Message interface for SuperCode chat system
 */
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  streaming?: boolean;
}

/**
 * Tool call interface for SuperCode tool execution
 */
export interface ToolCall {
  id: string;
  name: string;
  parameters: Record<string, any>;
  state: 'pending' | 'running' | 'completed' | 'error';
  result?: any;
  error?: string;
  start_time?: number;
  end_time?: number;
  metadata?: Record<string, any>;
  expanded?: boolean;
}

/**
 * Server-Sent Event message interface
 */
export interface SSEMessage {
  type: string;
  data: any;
  timestamp: string;
  session_id?: string;
}

/**
 * Message part for structured message content
 */
export interface MessagePart {
  type: 'text';
  text: string;
}

/**
 * Model configuration for AI requests
 */
export interface ModelConfig {
  providerID: string;
  modelID: string;
}

/**
 * Prompt request structure for session API
 */
export interface PromptRequest {
  model: ModelConfig;
  messageID?: string;
  parts: MessagePart[];
}