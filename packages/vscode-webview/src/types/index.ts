export interface Message {
  id: string
  type: 'user' | 'assistant' | 'error' | 'system' | 'tool_call' | 'tool_result'
  content: string
  timestamp: number
  tokens?: number
}

export interface ModelInfo {
  name: string
  provider: string
  version?: string
}

export interface TokenUsage {
  used: number
  max: number
  percentage?: number
}

export interface VsCodeApi {
  postMessage(message: any): void
  getState(): any
  setState(state: any): void
}

export interface WebviewMessage {
  command: string
  [key: string]: any
}

export interface StatusUpdate {
  command: 'statusUpdate'
  status: ConnectionStatus
  port: number
}

export interface AddMessage {
  command: 'addMessage'
  type: Message['type']
  content: string
}

export interface OfferRestart {
  command: 'offerRestart'
  message: string
}

export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error'
}

export interface StatusConfig {
  dot: string
  text: string
  enabled: boolean
}

export interface SSEMessage {
  type: string
  content?: string
  tool?: string
  output?: any
  [key: string]: any
}

declare global {
  interface Window {
    vscode: VsCodeApi
    supercodePort: number
  }
}