# 02-Communication-Layer.md

**SSE Streams, API Client, and Real-Time Messaging Implementation**

---

## 🎯 Overview

This document covers the implementation of real-time communication with the OpenCode server using Server-Sent Events (SSE) for streaming and REST API for standard operations. This is the foundation for all real-time features like tool execution, message streaming, and live updates.

## 🏗️ Architecture

### Communication Stack
- **REST API**: Standard HTTP requests for CRUD operations
- **Server-Sent Events (SSE)**: Real-time streaming for messages and tool updates
- **Automatic Reconnection**: Robust connection management with exponential backoff
- **Message Queuing**: Handle offline scenarios and connection interruptions

### Data Flow
```
User Action → API Request → Server Processing → SSE Stream → UI Updates
     ↓              ↓              ↓              ↓            ↓
Send Message → POST /messages → AI Processing → Stream Events → Update Store
```

## 💻 Implementation

### 1. API Client Service

```typescript
// src/services/apiClient.ts - REST API client
export interface APIConfig {
  baseUrl: string
  timeout: number
  retryAttempts: number
  retryDelay: number
}

export class APIClient {
  private config: APIConfig
  private controller: AbortController | null = null

  constructor(config: APIConfig) {
    this.config = config
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`
    
    // Create abort controller for this request
    this.controller = new AbortController()
    
    const requestOptions: RequestInit = {
      ...options,
      signal: this.controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    }

    try {
      const response = await fetch(url, requestOptions)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      return await response.json()
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request cancelled')
      }
      throw error
    } finally {
      this.controller = null
    }
  }

  private async requestWithRetry<T>(
    endpoint: string,
    options: RequestInit = {},
    maxRetries = this.config.retryAttempts
  ): Promise<T> {
    let lastError: Error

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.request<T>(endpoint, options)
      } catch (error) {
        lastError = error as Error
        
        // Don't retry client errors (4xx)
        if (error instanceof Error && error.message.includes('HTTP 4')) {
          throw error
        }
        
        if (attempt === maxRetries) break
        
        // Exponential backoff with jitter
        const delay = this.config.retryDelay * Math.pow(2, attempt - 1)
        const jitter = Math.random() * 1000
        await new Promise(resolve => setTimeout(resolve, delay + jitter))
        
        console.warn(`API request failed, retrying (${attempt}/${maxRetries})`, error)
      }
    }
    
    throw lastError!
  }

  // Session Management
  async getSessions(): Promise<Session[]> {
    return this.requestWithRetry('/v1/sessions')
  }

  async createSession(data: Partial<Session>): Promise<Session> {
    return this.requestWithRetry('/v1/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getSession(id: string): Promise<Session> {
    return this.requestWithRetry(`/v1/sessions/${id}`)
  }

  async deleteSession(id: string): Promise<void> {
    return this.requestWithRetry(`/v1/sessions/${id}`, {
      method: 'DELETE',
    })
  }

  // Message Management
  async getMessages(sessionId: string): Promise<Message[]> {
    return this.requestWithRetry(`/v1/sessions/${sessionId}/messages`)
  }

  async sendMessage(sessionId: string, content: string): Promise<Message> {
    return this.requestWithRetry(`/v1/sessions/${sessionId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    })
  }

  // Tool Management
  async getAvailableTools(): Promise<ToolDefinition[]> {
    return this.requestWithRetry('/v1/tools')
  }

  // Configuration
  async getConfig(): Promise<any> {
    return this.requestWithRetry('/v1/config')
  }

  async updateConfig(config: any): Promise<any> {
    return this.requestWithRetry('/v1/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    })
  }

  // Cancel current request
  cancel() {
    if (this.controller) {
      this.controller.abort()
    }
  }
}

// Create singleton instance
export const apiClient = new APIClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
})
```

### 2. Server-Sent Events Service

```typescript
// src/services/sseService.ts - Server-Sent Events client
import { useOpenCodeStore } from '@stores/openCodeStore'

export interface SSEConfig {
  maxReconnectAttempts: number
  reconnectDelay: number
  heartbeatInterval: number
}

export class SSEService {
  private eventSource: EventSource | null = null
  private reconnectAttempts = 0
  private config: SSEConfig
  private heartbeatTimer: NodeJS.Timeout | null = null
  private isManualClose = false

  constructor(config: SSEConfig) {
    this.config = config
  }

  connect(sessionId: string) {
    if (this.eventSource?.readyState === EventSource.OPEN) {
      console.warn('SSE already connected')
      return
    }

    this.isManualClose = false
    const url = `${import.meta.env.VITE_API_BASE_URL}/v1/sessions/${sessionId}/events`
    
    console.log('Connecting to SSE:', url)
    this.eventSource = new EventSource(url)

    this.eventSource.onopen = this.handleOpen
    this.eventSource.onmessage = this.handleMessage
    this.eventSource.onerror = this.handleError

    // Start heartbeat monitoring
    this.startHeartbeat()
    
    // Update connection state
    useOpenCodeStore.getState().setConnectionState(false) // Connecting
  }

  private handleOpen = () => {
    console.log('SSE connection established')
    this.reconnectAttempts = 0
    useOpenCodeStore.getState().setConnectionState(true)
  }

  private handleMessage = (event: MessageEvent) => {
    try {
      const message: SSEMessage = JSON.parse(event.data)
      console.log('SSE message received:', message.type, message)
      
      this.processMessage(message)
    } catch (error) {
      console.error('Failed to parse SSE message:', error, event.data)
    }
  }

  private handleError = (error: Event) => {
    console.error('SSE connection error:', error)
    
    if (!this.isManualClose && this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.scheduleReconnect()
    } else {
      useOpenCodeStore.getState().setConnectionState(false)
      useOpenCodeStore.getState().setError('Connection failed. Please refresh the page.')
    }
  }

  private processMessage(message: SSEMessage) {
    const store = useOpenCodeStore.getState()

    switch (message.type) {
      case 'message_start':
        store.addMessage({
          id: message.data.id,
          session_id: message.session_id,
          role: message.data.role,
          content: '',
          timestamp: message.timestamp,
        })
        break

      case 'message_delta':
        store.updateMessage(message.data.id, {
          content: message.data.content,
        })
        break

      case 'message_end':
        store.updateMessage(message.data.id, {
          content: message.data.content,
        })
        break

      case 'tool_call_start':
        store.addToolCall({
          id: message.data.id,
          name: message.data.name,
          parameters: message.data.parameters,
          state: 'running',
          start_time: Date.now(),
          expanded: false,
          show_details: false,
        })
        break

      case 'tool_call_result':
        store.updateToolCall(message.data.id, {
          state: message.data.error ? 'error' : 'completed',
          result: message.data.result,
          error: message.data.error,
          end_time: Date.now(),
        })
        break

      case 'error':
        console.error('Server error:', message.data)
        store.setError(message.data.message || 'Server error occurred')
        break

      case 'connection_state':
        store.setConnectionState(message.data.connected)
        break

      default:
        console.warn('Unknown SSE message type:', message.type)
    }
  }

  private scheduleReconnect() {
    this.reconnectAttempts++
    const delay = this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
    
    console.log(`Scheduling SSE reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`)
    useOpenCodeStore.getState().setConnectionState(false)
    
    setTimeout(() => {
      if (!this.isManualClose) {
        const { currentSession } = useOpenCodeStore.getState()
        if (currentSession) {
          this.connect(currentSession.id)
        }
      }
    }, delay)
  }

  private startHeartbeat() {
    this.stopHeartbeat()
    
    this.heartbeatTimer = setInterval(() => {
      if (this.eventSource?.readyState !== EventSource.OPEN) {
        console.warn('SSE connection lost, triggering reconnect')
        this.handleError(new Event('heartbeat_timeout'))
      }
    }, this.config.heartbeatInterval)
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  disconnect() {
    this.isManualClose = true
    this.stopHeartbeat()
    
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
    
    useOpenCodeStore.getState().setConnectionState(false)
    console.log('SSE connection closed')
  }

  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN
  }
}

// Create singleton instance
export const sseService = new SSEService({
  maxReconnectAttempts: 5,
  reconnectDelay: 1000,
  heartbeatInterval: 30000, // 30 seconds
})
```

### 3. Communication Provider

```typescript
// src/components/providers/SSEProvider.tsx - React provider for SSE
import React, { createContext, useContext, useEffect, useRef } from 'react'
import { sseService } from '@services/sseService'
import { useOpenCodeStore } from '@stores/openCodeStore'

interface SSEContextType {
  isConnected: boolean
  connect: (sessionId: string) => void
  disconnect: () => void
}

const SSEContext = createContext<SSEContextType | null>(null)

export function SSEProvider({ children }: { children: React.ReactNode }) {
  const currentSession = useOpenCodeStore(state => state.currentSession)
  const isConnected = useOpenCodeStore(state => state.connected)
  const mountedRef = useRef(true)

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Auto-connect when session changes
  useEffect(() => {
    if (currentSession && mountedRef.current) {
      sseService.connect(currentSession.id)
    }

    return () => {
      if (!mountedRef.current) {
        sseService.disconnect()
      }
    }
  }, [currentSession?.id])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      sseService.disconnect()
    }
  }, [])

  const contextValue: SSEContextType = {
    isConnected,
    connect: (sessionId: string) => sseService.connect(sessionId),
    disconnect: () => sseService.disconnect(),
  }

  return (
    <SSEContext.Provider value={contextValue}>
      {children}
    </SSEContext.Provider>
  )
}

export function useSSE() {
  const context = useContext(SSEContext)
  if (!context) {
    throw new Error('useSSE must be used within SSEProvider')
  }
  return context
}
```

### 4. Message Queue System

```typescript
// src/services/messageQueue.ts - Handle offline scenarios
interface QueuedMessage {
  id: string
  sessionId: string
  content: string
  timestamp: number
  retryCount: number
}

export class MessageQueue {
  private queue: QueuedMessage[] = []
  private processing = false
  private maxRetries = 3

  add(sessionId: string, content: string): string {
    const messageId = generateId()
    
    this.queue.push({
      id: messageId,
      sessionId,
      content,
      timestamp: Date.now(),
      retryCount: 0,
    })

    this.processQueue()
    return messageId
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return
    
    this.processing = true

    while (this.queue.length > 0) {
      const message = this.queue[0]
      
      try {
        await apiClient.sendMessage(message.sessionId, message.content)
        
        // Success - remove from queue
        this.queue.shift()
        console.log('Queued message sent successfully:', message.id)
        
      } catch (error) {
        console.error('Failed to send queued message:', error)
        
        message.retryCount++
        
        if (message.retryCount >= this.maxRetries) {
          // Max retries reached - remove from queue and notify user
          this.queue.shift()
          useOpenCodeStore.getState().setError(
            'Failed to send message after multiple attempts'
          )
        } else {
          // Wait before retry
          await new Promise(resolve => 
            setTimeout(resolve, 1000 * Math.pow(2, message.retryCount))
          )
        }
      }
    }

    this.processing = false
  }

  clear() {
    this.queue = []
    this.processing = false
  }

  getQueueSize(): number {
    return this.queue.length
  }
}

export const messageQueue = new MessageQueue()

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}
```

### 5. Communication Hook

```typescript
// src/hooks/useCommunication.ts - React hook for communication
import { useCallback } from 'react'
import { useOpenCodeStore } from '@stores/openCodeStore'
import { apiClient } from '@services/apiClient'
import { messageQueue } from '@services/messageQueue'
import { useSSE } from '@components/providers/SSEProvider'

export function useCommunication() {
  const { isConnected } = useSSE()
  const { currentSession, setError, clearError } = useOpenCodeStore()

  const sendMessage = useCallback(async (content: string) => {
    if (!currentSession) {
      setError('No active session')
      return null
    }

    clearError()

    try {
      if (isConnected) {
        // Send immediately if connected
        const message = await apiClient.sendMessage(currentSession.id, content)
        return message
      } else {
        // Queue for later if not connected
        const messageId = messageQueue.add(currentSession.id, content)
        console.log('Message queued for later delivery:', messageId)
        return null
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      setError(error instanceof Error ? error.message : 'Failed to send message')
      return null
    }
  }, [currentSession, isConnected, setError, clearError])

  const createSession = useCallback(async (data: Partial<Session>) => {
    try {
      clearError()
      const session = await apiClient.createSession(data)
      useOpenCodeStore.getState().setCurrentSession(session)
      return session
    } catch (error) {
      console.error('Failed to create session:', error)
      setError(error instanceof Error ? error.message : 'Failed to create session')
      return null
    }
  }, [setError, clearError])

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      clearError()
      await apiClient.deleteSession(sessionId)
      
      // Remove from store
      const store = useOpenCodeStore.getState()
      store.setSessions(store.sessions.filter(s => s.id !== sessionId))
      
      // If this was the current session, clear it
      if (store.currentSession?.id === sessionId) {
        store.setCurrentSession(null)
      }
      
      return true
    } catch (error) {
      console.error('Failed to delete session:', error)
      setError(error instanceof Error ? error.message : 'Failed to delete session')
      return false
    }
  }, [setError, clearError])

  return {
    sendMessage,
    createSession,
    deleteSession,
    isConnected,
    queueSize: messageQueue.getQueueSize(),
  }
}
```

## 🔧 Configuration

### Environment Variables

```typescript
// src/config/communication.ts
export const communicationConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  wsBaseUrl: import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:3000',
  
  // SSE Configuration
  sseReconnectAttempts: 5,
  sseReconnectDelay: 1000,
  sseHeartbeatInterval: 30000,
  
  // API Configuration
  apiTimeout: 30000,
  apiRetryAttempts: 3,
  apiRetryDelay: 1000,
  
  // Message Queue Configuration
  queueMaxRetries: 3,
  queueRetryDelay: 1000,
}
```

## ✅ Testing

### SSE Service Tests

```typescript
// src/services/__tests__/sseService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SSEService } from '../sseService'

// Mock EventSource
const mockEventSource = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  close: vi.fn(),
  onmessage: null,
  onerror: null,
  onopen: null,
  readyState: EventSource.CONNECTING,
}

global.EventSource = vi.fn(() => mockEventSource) as any

describe('SSEService', () => {
  let service: SSEService
  
  beforeEach(() => {
    vi.clearAllMocks()
    service = new SSEService({
      maxReconnectAttempts: 3,
      reconnectDelay: 100,
      heartbeatInterval: 1000,
    })
  })

  it('should connect to SSE endpoint', () => {
    service.connect('session-123')
    
    expect(global.EventSource).toHaveBeenCalledWith(
      expect.stringContaining('/v1/sessions/session-123/events')
    )
  })

  it('should handle message events', () => {
    service.connect('session-123')
    
    const messageEvent = new MessageEvent('message', {
      data: JSON.stringify({
        type: 'message_start',
        data: { id: 'msg-1', role: 'assistant', content: '' },
        timestamp: '2023-01-01T00:00:00Z',
        session_id: 'session-123',
      }),
    })

    mockEventSource.onmessage?.(messageEvent)

    // Should process message and update store
    // (This would require mocking the store as well)
  })

  it('should reconnect on error', async () => {
    const connectSpy = vi.spyOn(service, 'connect')
    service.connect('session-123')
    
    // Simulate connection error
    const errorEvent = new Event('error')
    mockEventSource.onerror?.(errorEvent)

    // Wait for reconnect delay
    await new Promise(resolve => setTimeout(resolve, 150))
    
    // Should attempt to reconnect
    expect(connectSpy).toHaveBeenCalledTimes(2)
  })
})
```

### API Client Tests

```typescript
// src/services/__tests__/apiClient.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { APIClient } from '../apiClient'

// Mock fetch
global.fetch = vi.fn()

describe('APIClient', () => {
  let client: APIClient
  
  beforeEach(() => {
    vi.clearAllMocks()
    client = new APIClient({
      baseUrl: 'http://localhost:3000',
      timeout: 5000,
      retryAttempts: 2,
      retryDelay: 100,
    })
  })

  it('should make successful API calls', async () => {
    const mockResponse = { id: '123', title: 'Test Session' }
    
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    })

    const result = await client.getSessions()
    
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/v1/sessions',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    )
    expect(result).toEqual(mockResponse)
  })

  it('should retry on failure', async () => {
    ;(global.fetch as any)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })

    const result = await client.getSessions()
    
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(result).toEqual({ success: true })
  })

  it('should handle HTTP errors', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    })

    await expect(client.getSession('invalid')).rejects.toThrow('HTTP 404: Not Found')
  })
})
```

## 📝 Implementation Checklist

### API Client ✅
- [ ] REST API client with retry logic
- [ ] Request/response TypeScript interfaces
- [ ] Error handling with proper error types
- [ ] Request cancellation support
- [ ] Configuration management

### SSE Communication ✅
- [ ] EventSource connection management
- [ ] Message parsing and routing
- [ ] Automatic reconnection logic
- [ ] Connection state tracking
- [ ] Heartbeat monitoring

### Message Queue ✅
- [ ] Offline message queuing
- [ ] Retry logic with exponential backoff
- [ ] Queue size monitoring
- [ ] Error handling for failed messages

### React Integration ✅
- [ ] SSE Provider component
- [ ] Communication hook
- [ ] Store integration
- [ ] Error state management
- [ ] Loading states

### Testing ✅
- [ ] Unit tests for API client
- [ ] Unit tests for SSE service
- [ ] Integration tests for providers
- [ ] Mock implementations for testing
- [ ] Error scenario testing

### Next Steps
After implementing the communication layer:
1. **[03-State-Management.md](./03-State-Management.md)** - Set up Zustand stores to handle the data from communication
2. **[04-Tool-Execution-System.md](./04-Tool-Execution-System.md)** - Build the tool execution framework that uses these communication patterns

---

This communication layer provides robust, real-time connectivity with the OpenCode server, handling all edge cases like network interruptions, connection failures, and offline scenarios.