# 03-State-Management.md

**Zustand Stores, Persistence, and Data Flow Management**

---

## 🎯 Overview

This document covers the implementation of application state management using Zustand, including global stores, persistence strategies, and data flow patterns. The state management system handles sessions, messages, tool calls, UI state, and real-time updates from the communication layer.

## 🏗️ Architecture

### State Structure
```
Global State
├── Session Management (currentSession, sessions list)
├── Chat State (messages, streaming message, tool calls)
├── UI State (theme, sidebar, active panels, modals)
├── Connection State (connected, error messages, retry info)
├── Settings (user preferences, configuration)
└── Cache (API responses, computed data)
```

### Data Flow Patterns
```
SSE Events → Store Actions → State Updates → React Re-renders
API Calls → Store Actions → State Updates → UI Updates
User Actions → Store Actions → Side Effects → State Updates
```

## 💻 Implementation

### 1. Main Application Store

```typescript
// src/stores/openCodeStore.ts - Primary application state
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { devtools } from 'zustand/middleware'
import { Session, Message, ToolCall, ToolCallState } from '@types/index'

interface OpenCodeState {
  // Session Management
  currentSession: Session | null
  sessions: Session[]
  loadingSessions: boolean
  
  // Chat State
  messages: Message[]
  toolCalls: ToolCall[]
  streamingMessage: Partial<Message> | null
  
  // Connection State
  connected: boolean
  connecting: boolean
  reconnectAttempts: number
  lastError: string | null
  
  // UI State
  sidebarCollapsed: boolean
  activePanel: 'chat' | 'files' | 'settings' | 'history'
  selectedToolCall: string | null
  
  // Loading States
  sendingMessage: boolean
  loadingMessages: boolean
  
  // Actions - Session Management
  setCurrentSession: (session: Session | null) => void
  setSessions: (sessions: Session[]) => void
  addSession: (session: Session) => void
  updateSession: (id: string, updates: Partial<Session>) => void
  removeSession: (id: string) => void
  
  // Actions - Chat Management  
  addMessage: (message: Message) => void
  updateMessage: (id: string, updates: Partial<Message>) => void
  setMessages: (messages: Message[]) => void
  clearMessages: () => void
  
  // Actions - Tool Call Management
  addToolCall: (toolCall: ToolCall) => void
  updateToolCall: (id: string, updates: Partial<ToolCall>) => void
  setToolCalls: (toolCalls: ToolCall[]) => void
  removeToolCall: (id: string) => void
  toggleToolCallExpanded: (id: string) => void
  
  // Actions - Streaming
  setStreamingMessage: (message: Partial<Message> | null) => void
  appendToStreamingMessage: (content: string) => void
  
  // Actions - Connection State
  setConnectionState: (connected: boolean) => void
  setReconnectAttempts: (attempts: number) => void
  setError: (error: string | null) => void
  clearError: () => void
  
  // Actions - UI State
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void
  setActivePanel: (panel: OpenCodeState['activePanel']) => void
  setSelectedToolCall: (id: string | null) => void
  
  // Actions - Loading States
  setSendingMessage: (sending: boolean) => void
  setLoadingMessages: (loading: boolean) => void
  setLoadingSessions: (loading: boolean) => void
  
  // Computed Values
  getToolCallsByMessage: (messageId: string) => ToolCall[]
  getRunningToolCalls: () => ToolCall[]
  hasActiveOperations: () => boolean
}

export const useOpenCodeStore = create<OpenCodeState>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // Initial State
      currentSession: null,
      sessions: [],
      loadingSessions: false,
      messages: [],
      toolCalls: [],
      streamingMessage: null,
      connected: false,
      connecting: false,
      reconnectAttempts: 0,
      lastError: null,
      sidebarCollapsed: false,
      activePanel: 'chat',
      selectedToolCall: null,
      sendingMessage: false,
      loadingMessages: false,

      // Session Management Actions
      setCurrentSession: (session) => {
        set({ currentSession: session })
        
        // Clear previous session data
        if (session?.id !== get().currentSession?.id) {
          set({ 
            messages: [], 
            toolCalls: [], 
            streamingMessage: null,
            selectedToolCall: null 
          })
        }
      },

      setSessions: (sessions) => set({ sessions }),

      addSession: (session) => 
        set((state) => ({ 
          sessions: [session, ...state.sessions] 
        })),

      updateSession: (id, updates) =>
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === id ? { ...session, ...updates } : session
          ),
          currentSession: state.currentSession?.id === id
            ? { ...state.currentSession, ...updates }
            : state.currentSession
        })),

      removeSession: (id) =>
        set((state) => ({
          sessions: state.sessions.filter((session) => session.id !== id),
          currentSession: state.currentSession?.id === id 
            ? null 
            : state.currentSession
        })),

      // Chat Management Actions
      addMessage: (message) =>
        set((state) => ({
          messages: [...state.messages, message],
          streamingMessage: null // Clear streaming when real message arrives
        })),

      updateMessage: (id, updates) =>
        set((state) => ({
          messages: state.messages.map((message) =>
            message.id === id ? { ...message, ...updates } : message
          )
        })),

      setMessages: (messages) => set({ messages }),
      
      clearMessages: () => set({ messages: [], toolCalls: [] }),

      // Tool Call Management Actions
      addToolCall: (toolCall) =>
        set((state) => ({
          toolCalls: [...state.toolCalls, toolCall]
        })),

      updateToolCall: (id, updates) =>
        set((state) => ({
          toolCalls: state.toolCalls.map((toolCall) =>
            toolCall.id === id ? { ...toolCall, ...updates } : toolCall
          )
        })),

      setToolCalls: (toolCalls) => set({ toolCalls }),

      removeToolCall: (id) =>
        set((state) => ({
          toolCalls: state.toolCalls.filter((toolCall) => toolCall.id !== id),
          selectedToolCall: state.selectedToolCall === id 
            ? null 
            : state.selectedToolCall
        })),

      toggleToolCallExpanded: (id) =>
        set((state) => ({
          toolCalls: state.toolCalls.map((toolCall) =>
            toolCall.id === id 
              ? { ...toolCall, expanded: !toolCall.expanded } 
              : toolCall
          )
        })),

      // Streaming Actions
      setStreamingMessage: (message) => set({ streamingMessage: message }),

      appendToStreamingMessage: (content) =>
        set((state) => ({
          streamingMessage: state.streamingMessage
            ? { 
                ...state.streamingMessage, 
                content: (state.streamingMessage.content || '') + content 
              }
            : { content }
        })),

      // Connection State Actions
      setConnectionState: (connected) => 
        set({ 
          connected, 
          connecting: false,
          lastError: connected ? null : get().lastError 
        }),

      setReconnectAttempts: (attempts) => set({ reconnectAttempts: attempts }),

      setError: (error) => set({ lastError: error }),
      
      clearError: () => set({ lastError: null }),

      // UI State Actions
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      setActivePanel: (panel) => set({ activePanel: panel }),
      
      setSelectedToolCall: (id) => set({ selectedToolCall: id }),

      // Loading State Actions
      setSendingMessage: (sending) => set({ sendingMessage: sending }),
      setLoadingMessages: (loading) => set({ loadingMessages: loading }),
      setLoadingSessions: (loading) => set({ loadingSessions: loading }),

      // Computed Values
      getToolCallsByMessage: (messageId) => {
        return get().toolCalls.filter(tc => tc.message_id === messageId)
      },

      getRunningToolCalls: () => {
        return get().toolCalls.filter(tc => tc.state === 'running')
      },

      hasActiveOperations: () => {
        const state = get()
        return state.sendingMessage || 
               state.loadingMessages || 
               state.getRunningToolCalls().length > 0
      }
    })),
    { name: 'opencode-store' }
  )
)
```

### 2. UI Preferences Store

```typescript
// src/stores/preferencesStore.ts - User preferences and UI state
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PreferencesState {
  // Theme Settings
  theme: string
  fontSize: 'sm' | 'md' | 'lg'
  fontFamily: string
  
  // Layout Preferences
  sidebarWidth: number
  toolPanelHeight: number
  chatInputHeight: number
  
  // Editor Settings
  showLineNumbers: boolean
  wordWrap: boolean
  tabSize: number
  
  // Notification Settings
  enableSounds: boolean
  enableDesktopNotifications: boolean
  
  // Privacy Settings
  saveHistory: boolean
  shareAnalytics: boolean
  
  // Actions
  setTheme: (theme: string) => void
  setFontSize: (size: PreferencesState['fontSize']) => void
  setFontFamily: (family: string) => void
  setSidebarWidth: (width: number) => void
  setToolPanelHeight: (height: number) => void
  setChatInputHeight: (height: number) => void
  setShowLineNumbers: (show: boolean) => void
  setWordWrap: (wrap: boolean) => void
  setTabSize: (size: number) => void
  setEnableSounds: (enable: boolean) => void
  setEnableDesktopNotifications: (enable: boolean) => void
  setSaveHistory: (save: boolean) => void
  setShareAnalytics: (share: boolean) => void
  resetToDefaults: () => void
}

const defaultPreferences = {
  theme: 'default',
  fontSize: 'md' as const,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  sidebarWidth: 280,
  toolPanelHeight: 400,
  chatInputHeight: 120,
  showLineNumbers: true,
  wordWrap: true,
  tabSize: 2,
  enableSounds: true,
  enableDesktopNotifications: true,
  saveHistory: true,
  shareAnalytics: false,
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      ...defaultPreferences,

      // Theme Actions
      setTheme: (theme) => {
        set({ theme })
        document.documentElement.setAttribute('data-theme', theme)
      },

      setFontSize: (fontSize) => {
        set({ fontSize })
        document.documentElement.setAttribute('data-font-size', fontSize)
      },

      setFontFamily: (fontFamily) => {
        set({ fontFamily })
        document.documentElement.style.setProperty('--font-family', fontFamily)
      },

      // Layout Actions
      setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
      setToolPanelHeight: (toolPanelHeight) => set({ toolPanelHeight }),
      setChatInputHeight: (chatInputHeight) => set({ chatInputHeight }),

      // Editor Actions
      setShowLineNumbers: (showLineNumbers) => set({ showLineNumbers }),
      setWordWrap: (wordWrap) => set({ wordWrap }),
      setTabSize: (tabSize) => set({ tabSize }),

      // Notification Actions
      setEnableSounds: (enableSounds) => set({ enableSounds }),
      setEnableDesktopNotifications: (enableDesktopNotifications) => 
        set({ enableDesktopNotifications }),

      // Privacy Actions
      setSaveHistory: (saveHistory) => set({ saveHistory }),
      setShareAnalytics: (shareAnalytics) => set({ shareAnalytics }),

      // Reset
      resetToDefaults: () => set(defaultPreferences),
    }),
    {
      name: 'opencode-preferences',
      version: 1,
    }
  )
)
```

### 3. Cache Store for API Responses

```typescript
// src/stores/cacheStore.ts - API response caching
import { create } from 'zustand'

interface CacheEntry<T = any> {
  data: T
  timestamp: number
  expiry: number
}

interface CacheState {
  cache: Map<string, CacheEntry>
  
  // Actions
  set: <T>(key: string, data: T, ttl?: number) => void
  get: <T>(key: string) => T | null
  has: (key: string) => boolean
  delete: (key: string) => void
  clear: () => void
  cleanup: () => void
  
  // Specialized caching
  cacheSession: (session: Session) => void
  getCachedSession: (id: string) => Session | null
  cacheMessages: (sessionId: string, messages: Message[]) => void
  getCachedMessages: (sessionId: string) => Message[] | null
}

export const useCacheStore = create<CacheState>((set, get) => ({
  cache: new Map(),

  set: (key, data, ttl = 300000) => { // 5 minutes default
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + ttl,
    }
    
    set((state) => {
      const newCache = new Map(state.cache)
      newCache.set(key, entry)
      return { cache: newCache }
    })
  },

  get: (key) => {
    const entry = get().cache.get(key)
    if (!entry) return null
    
    // Check if expired
    if (Date.now() > entry.expiry) {
      get().delete(key)
      return null
    }
    
    return entry.data
  },

  has: (key) => {
    const entry = get().cache.get(key)
    if (!entry) return false
    
    // Check if expired
    if (Date.now() > entry.expiry) {
      get().delete(key)
      return false
    }
    
    return true
  },

  delete: (key) => {
    set((state) => {
      const newCache = new Map(state.cache)
      newCache.delete(key)
      return { cache: newCache }
    })
  },

  clear: () => {
    set({ cache: new Map() })
  },

  cleanup: () => {
    const now = Date.now()
    set((state) => {
      const newCache = new Map()
      state.cache.forEach((entry, key) => {
        if (entry.expiry > now) {
          newCache.set(key, entry)
        }
      })
      return { cache: newCache }
    })
  },

  // Specialized caching methods
  cacheSession: (session) => {
    get().set(`session:${session.id}`, session, 600000) // 10 minutes
  },

  getCachedSession: (id) => {
    return get().get(`session:${id}`)
  },

  cacheMessages: (sessionId, messages) => {
    get().set(`messages:${sessionId}`, messages, 300000) // 5 minutes
  },

  getCachedMessages: (sessionId) => {
    return get().get(`messages:${sessionId}`)
  },
}))

// Automatic cleanup every 5 minutes
setInterval(() => {
  useCacheStore.getState().cleanup()
}, 300000)
```

### 4. State Selectors and Hooks

```typescript
// src/hooks/useAppState.ts - Optimized state selectors
import { shallow } from 'zustand/shallow'
import { useOpenCodeStore } from '@stores/openCodeStore'

// Session selectors
export function useCurrentSession() {
  return useOpenCodeStore(state => state.currentSession)
}

export function useSessions() {
  return useOpenCodeStore(
    state => ({
      sessions: state.sessions,
      loading: state.loadingSessions,
    }),
    shallow
  )
}

// Chat selectors
export function useMessages() {
  return useOpenCodeStore(
    state => ({
      messages: state.messages,
      streamingMessage: state.streamingMessage,
      loading: state.loadingMessages,
    }),
    shallow
  )
}

export function useToolCalls() {
  return useOpenCodeStore(state => state.toolCalls)
}

export function useToolCallById(id: string) {
  return useOpenCodeStore(
    state => state.toolCalls.find(tc => tc.id === id) || null
  )
}

export function useRunningToolCalls() {
  return useOpenCodeStore(state => state.getRunningToolCalls())
}

// Connection selectors
export function useConnectionState() {
  return useOpenCodeStore(
    state => ({
      connected: state.connected,
      connecting: state.connecting,
      error: state.lastError,
      reconnectAttempts: state.reconnectAttempts,
    }),
    shallow
  )
}

// UI selectors
export function useUIState() {
  return useOpenCodeStore(
    state => ({
      sidebarCollapsed: state.sidebarCollapsed,
      activePanel: state.activePanel,
      selectedToolCall: state.selectedToolCall,
    }),
    shallow
  )
}

// Loading state selectors
export function useLoadingState() {
  return useOpenCodeStore(
    state => ({
      sendingMessage: state.sendingMessage,
      loadingMessages: state.loadingMessages,
      loadingSessions: state.loadingSessions,
      hasActiveOperations: state.hasActiveOperations(),
    }),
    shallow
  )
}

// Action hooks
export function useSessionActions() {
  return useOpenCodeStore(
    state => ({
      setCurrentSession: state.setCurrentSession,
      addSession: state.addSession,
      updateSession: state.updateSession,
      removeSession: state.removeSession,
    }),
    shallow
  )
}

export function useChatActions() {
  return useOpenCodeStore(
    state => ({
      addMessage: state.addMessage,
      updateMessage: state.updateMessage,
      clearMessages: state.clearMessages,
      addToolCall: state.addToolCall,
      updateToolCall: state.updateToolCall,
      toggleToolCallExpanded: state.toggleToolCallExpanded,
    }),
    shallow
  )
}

export function useUIActions() {
  return useOpenCodeStore(
    state => ({
      toggleSidebar: state.toggleSidebar,
      setSidebarCollapsed: state.setSidebarCollapsed,
      setActivePanel: state.setActivePanel,
      setSelectedToolCall: state.setSelectedToolCall,
    }),
    shallow
  )
}
```

### 5. State Synchronization Effects

```typescript
// src/hooks/useStateSynchronization.ts - Sync state with external sources
import { useEffect } from 'react'
import { useOpenCodeStore } from '@stores/openCodeStore'
import { useCacheStore } from '@stores/cacheStore'
import { apiClient } from '@services/apiClient'

export function useStateSynchronization() {
  const currentSession = useOpenCodeStore(state => state.currentSession)
  const { cacheMessages, getCachedMessages } = useCacheStore()

  // Load messages when session changes
  useEffect(() => {
    if (!currentSession) return

    const loadMessages = async () => {
      // Check cache first
      const cached = getCachedMessages(currentSession.id)
      if (cached) {
        useOpenCodeStore.getState().setMessages(cached)
        return
      }

      // Load from API
      useOpenCodeStore.getState().setLoadingMessages(true)
      
      try {
        const messages = await apiClient.getMessages(currentSession.id)
        useOpenCodeStore.getState().setMessages(messages)
        cacheMessages(currentSession.id, messages)
      } catch (error) {
        console.error('Failed to load messages:', error)
        useOpenCodeStore.getState().setError('Failed to load messages')
      } finally {
        useOpenCodeStore.getState().setLoadingMessages(false)
      }
    }

    loadMessages()
  }, [currentSession?.id, cacheMessages, getCachedMessages])

  // Load sessions on mount
  useEffect(() => {
    const loadSessions = async () => {
      useOpenCodeStore.getState().setLoadingSessions(true)
      
      try {
        const sessions = await apiClient.getSessions()
        useOpenCodeStore.getState().setSessions(sessions)
      } catch (error) {
        console.error('Failed to load sessions:', error)
        useOpenCodeStore.getState().setError('Failed to load sessions')
      } finally {
        useOpenCodeStore.getState().setLoadingSessions(false)
      }
    }

    loadSessions()
  }, [])

  // Auto-save session data
  useEffect(() => {
    const { currentSession, messages } = useOpenCodeStore.getState()
    if (currentSession && messages.length > 0) {
      cacheMessages(currentSession.id, messages)
    }
  }, [useOpenCodeStore(state => state.messages), cacheMessages])
}
```

### 6. State Debug Tools

```typescript
// src/utils/stateDebugger.ts - Development debugging utilities
export function logStateChanges() {
  if (process.env.NODE_ENV !== 'development') return

  useOpenCodeStore.subscribe(
    state => state.currentSession,
    (currentSession, previousSession) => {
      console.log('Session changed:', { previousSession, currentSession })
    }
  )

  useOpenCodeStore.subscribe(
    state => state.messages,
    (messages, previousMessages) => {
      if (messages.length !== previousMessages.length) {
        console.log('Messages updated:', {
          count: messages.length,
          latest: messages[messages.length - 1]
        })
      }
    }
  )

  useOpenCodeStore.subscribe(
    state => state.toolCalls,
    (toolCalls, previousToolCalls) => {
      const stateChanges = toolCalls.filter((tc, index) => {
        const prev = previousToolCalls[index]
        return !prev || prev.state !== tc.state
      })
      
      if (stateChanges.length > 0) {
        console.log('Tool call states changed:', stateChanges)
      }
    }
  )
}

export function exportState() {
  const state = useOpenCodeStore.getState()
  const preferences = usePreferencesStore.getState()
  const cache = useCacheStore.getState()
  
  return {
    opencode: {
      currentSession: state.currentSession,
      sessions: state.sessions,
      messages: state.messages,
      toolCalls: state.toolCalls,
      connected: state.connected,
    },
    preferences,
    cacheSize: cache.cache.size,
  }
}

export function validateState() {
  const state = useOpenCodeStore.getState()
  const issues: string[] = []
  
  // Validate current session
  if (state.currentSession && !state.sessions.find(s => s.id === state.currentSession.id)) {
    issues.push('Current session not found in sessions list')
  }
  
  // Validate tool calls
  state.toolCalls.forEach(tc => {
    if (!['pending', 'running', 'completed', 'error'].includes(tc.state)) {
      issues.push(`Invalid tool call state: ${tc.state}`)
    }
  })
  
  return issues
}
```

## 🔧 Configuration

### Store Configuration

```typescript
// src/stores/config.ts - Store configuration
export const storeConfig = {
  // Cache TTL values (milliseconds)
  cacheTTL: {
    sessions: 600000,    // 10 minutes
    messages: 300000,    // 5 minutes
    tools: 3600000,      // 1 hour
    config: 1800000,     // 30 minutes
  },
  
  // State persistence
  persistence: {
    enabled: true,
    version: 1,
    migrate: (persistedState: any, version: number) => {
      // Handle state migrations
      if (version < 1) {
        // Migration logic
      }
      return persistedState
    }
  },
  
  // Development settings
  devtools: process.env.NODE_ENV === 'development',
  debug: process.env.NODE_ENV === 'development',
}
```

## ✅ Testing

### Store Tests

```typescript
// src/stores/__tests__/openCodeStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useOpenCodeStore } from '../openCodeStore'

describe('OpenCodeStore', () => {
  beforeEach(() => {
    useOpenCodeStore.setState({
      currentSession: null,
      sessions: [],
      messages: [],
      toolCalls: [],
      connected: false,
    })
  })

  it('should set current session', () => {
    const session: Session = {
      id: 'test-session',
      title: 'Test Session',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
      model_provider: 'anthropic',
      model_name: 'claude-3',
    }

    useOpenCodeStore.getState().setCurrentSession(session)
    
    expect(useOpenCodeStore.getState().currentSession).toEqual(session)
  })

  it('should clear messages when session changes', () => {
    const store = useOpenCodeStore.getState()
    
    // Add some messages
    store.addMessage({
      id: 'msg-1',
      session_id: 'old-session',
      role: 'user',
      content: 'Hello',
      timestamp: '2023-01-01T00:00:00Z',
    })
    
    expect(store.messages).toHaveLength(1)
    
    // Change session
    store.setCurrentSession({
      id: 'new-session',
      title: 'New Session',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
      model_provider: 'anthropic',
      model_name: 'claude-3',
    })
    
    expect(useOpenCodeStore.getState().messages).toHaveLength(0)
  })

  it('should manage tool call states correctly', () => {
    const store = useOpenCodeStore.getState()
    
    const toolCall: ToolCall = {
      id: 'tool-1',
      name: 'read',
      parameters: { file_path: 'test.txt' },
      state: 'running',
      expanded: false,
      show_details: false,
    }
    
    store.addToolCall(toolCall)
    expect(store.toolCalls).toHaveLength(1)
    
    store.updateToolCall('tool-1', { state: 'completed', result: { content: 'Hello' } })
    
    const updated = store.toolCalls.find(tc => tc.id === 'tool-1')
    expect(updated?.state).toBe('completed')
    expect(updated?.result).toEqual({ content: 'Hello' })
  })

  it('should compute running tool calls correctly', () => {
    const store = useOpenCodeStore.getState()
    
    store.addToolCall({
      id: 'tool-1',
      name: 'read',
      parameters: {},
      state: 'running',
      expanded: false,
      show_details: false,
    })
    
    store.addToolCall({
      id: 'tool-2',
      name: 'write',
      parameters: {},
      state: 'completed',
      expanded: false,
      show_details: false,
    })
    
    const running = store.getRunningToolCalls()
    expect(running).toHaveLength(1)
    expect(running[0].id).toBe('tool-1')
  })
})
```

### Hook Tests

```typescript
// src/hooks/__tests__/useAppState.test.ts
import { renderHook, act } from '@testing-library/react'
import { useCurrentSession, useSessionActions } from '../useAppState'
import { useOpenCodeStore } from '@stores/openCodeStore'

describe('useAppState hooks', () => {
  it('should return current session', () => {
    const session = {
      id: 'test-session',
      title: 'Test',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
      model_provider: 'anthropic' as const,
      model_name: 'claude-3',
    }

    act(() => {
      useOpenCodeStore.getState().setCurrentSession(session)
    })

    const { result } = renderHook(() => useCurrentSession())
    expect(result.current).toEqual(session)
  })

  it('should provide session actions', () => {
    const { result } = renderHook(() => useSessionActions())
    
    expect(result.current).toHaveProperty('setCurrentSession')
    expect(result.current).toHaveProperty('addSession')
    expect(result.current).toHaveProperty('updateSession')
    expect(result.current).toHaveProperty('removeSession')
  })
})
```

## 📝 Implementation Checklist

### Core Stores ✅
- [ ] Main application store with all state
- [ ] Preferences store with persistence
- [ ] Cache store for API responses
- [ ] Proper TypeScript interfaces
- [ ] Store composition and organization

### State Management ✅
- [ ] Session management actions
- [ ] Chat and message handling
- [ ] Tool call state management
- [ ] Connection state tracking
- [ ] UI state management

### Performance Optimization ✅
- [ ] Optimized selectors with shallow comparison
- [ ] Custom hooks for common patterns
- [ ] Computed values and memoization
- [ ] Cache invalidation strategies
- [ ] State subscription optimization

### Persistence ✅
- [ ] Local storage persistence for preferences
- [ ] Session state caching
- [ ] Cache cleanup and expiration
- [ ] State migration strategies
- [ ] Error recovery for corrupted state

### Development Tools ✅
- [ ] Redux DevTools integration
- [ ] State debugging utilities
- [ ] State validation functions
- [ ] Development logging
- [ ] Export/import functionality

### Testing ✅
- [ ] Unit tests for all stores
- [ ] Hook testing with React Testing Library
- [ ] State transition testing
- [ ] Cache behavior testing
- [ ] Performance testing

### Next Steps
After implementing state management:
1. **[04-Tool-Execution-System.md](./04-Tool-Execution-System.md)** - Build tool execution that uses this state management
2. **[08-UI-Components.md](./08-UI-Components.md)** - Create React components that consume this state

---

This state management system provides a robust, type-safe foundation for managing all application data with proper caching, persistence, and performance optimization.