/**
 * WebSocket Message Protocol Types for vscode-webview
 */

// Base message structure
export interface BaseMessage {
  id?: string; // Unique ID for request/response correlation
  timestamp: number;
}

// Request message from client
export interface WSRequestType extends BaseMessage {
  type: 'request';
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  params?: {
    query?: Record<string, any>;
    param?: Record<string, any>;
    body?: any;
  };
  headers?: Record<string, string>;
}

// Response message to client
export interface WSResponseType extends BaseMessage {
  type: 'response';
  id?: string;
  status: number;
  data: any;
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
}

// Event message (server push)
export interface WSEventType extends BaseMessage {
  type: 'event';
  event: string;
  data: any;
}

// Error message
export interface WSErrorType extends BaseMessage {
  type: 'error';
  id?: string;
  error: {
    message: string;
    code?: string;
    details?: any;
  };
}

// Control messages
export interface WSControlType extends BaseMessage {
  type: 'control';
  action: 'ping' | 'pong' | 'subscribe' | 'unsubscribe' | 'authenticate';
  data?: any;
}

// Union of all message types
export type WSMessageType = 
  | WSRequestType 
  | WSResponseType 
  | WSEventType 
  | WSErrorType 
  | WSControlType;