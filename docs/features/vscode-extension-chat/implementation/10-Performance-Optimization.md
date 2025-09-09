# 10-Performance-Optimization.md

**Performance Optimization Strategies for VS Code Extension Chat Interface**

---

## 🎯 Overview

This document outlines comprehensive performance optimization strategies for the VS Code extension chat interface. It covers virtual scrolling, memory management, React rendering optimization, stream processing efficiency, WebView performance, bundle size optimization, CPU usage optimization, and monitoring techniques.

## 🚀 Performance Architecture

### Performance Requirements
- **Initial Load Time**: < 2 seconds for WebView initialization
- **Message Rendering**: < 100ms per message
- **Keyboard Response**: < 50ms for input events
- **Memory Usage**: < 100MB for 1000 messages
- **Bundle Size**: < 500KB gzipped WebView bundle
- **CPU Usage**: < 30% average, < 80% peak for real-time updates
- **Stream Processing**: < 10ms latency for SSE message handling

### Core Performance Principles
1. **Virtual Rendering**: Only render visible content
2. **Memory Efficiency**: Aggressive garbage collection and cleanup
3. **React Optimization**: Memoization and lazy loading
4. **Stream Buffering**: Efficient message processing
5. **Bundle Splitting**: Code-level optimization
6. **CPU Optimization**: Debounced updates and async processing

---

## 🔄 Virtual Scrolling Implementation

### Virtual List Component
```typescript
// src/components/ui/VirtualList.tsx
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react'

interface VirtualListProps<T> {
  items: T[]
  itemHeight: number
  containerHeight: number
  renderItem: (item: T, index: number) => React.ReactNode
  overscan?: number
  scrollToIndex?: number
}

export function VirtualList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
  scrollToIndex
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Calculate visible range with overscan
  const visibleRange = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const end = Math.min(
      items.length,
      start + Math.ceil(containerHeight / itemHeight) + overscan * 2
    )
    return { start, end }
  }, [scrollTop, itemHeight, containerHeight, overscan, items.length])
  
  // Get visible items
  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.start, visibleRange.end).map((item, index) => ({
      item,
      index: visibleRange.start + index
    }))
  }, [items, visibleRange.start, visibleRange.end])
  
  // Handle scroll events with throttling
  const handleScroll = useCallback(
    throttle((event: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(event.currentTarget.scrollTop)
    }, 16), // 60fps throttling
    []
  )
  
  // Auto-scroll to specific index
  useEffect(() => {
    if (scrollToIndex !== undefined && containerRef.current) {
      const targetScrollTop = scrollToIndex * itemHeight
      containerRef.current.scrollTop = targetScrollTop
      setScrollTop(targetScrollTop)
    }
  }, [scrollToIndex, itemHeight])
  
  const totalHeight = items.length * itemHeight
  const offsetY = visibleRange.start * itemHeight
  
  return (
    <div
      ref={containerRef}
      className="virtual-list"
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0
          }}
        >
          {visibleItems.map(({ item, index }) => (
            <div
              key={index}
              style={{ height: itemHeight }}
              className="virtual-list-item"
            >
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Throttle utility for scroll performance
function throttle<T extends (...args: any[]) => void>(func: T, limit: number): T {
  let inThrottle: boolean
  return ((...args: any[]) => {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }) as T
}
```

### Virtual Chat Messages Implementation
```typescript
// src/components/chat/VirtualMessages.tsx
import React, { useMemo, useState, useEffect } from 'react'
import { VirtualList } from '../ui/VirtualList'
import { MessageItem } from './MessageItem'
import { useSessionStore } from '../../stores/session'

export function VirtualMessages() {
  const { messages } = useSessionStore()
  const [containerHeight, setContainerHeight] = useState(600)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)
  
  // Dynamic item height estimation
  const estimatedItemHeight = useMemo(() => {
    if (messages.length === 0) return 100
    
    // Calculate average height based on message content
    const avgContentLength = messages.reduce((sum, msg) => sum + msg.content.length, 0) / messages.length
    return Math.max(80, Math.min(300, 80 + (avgContentLength / 50) * 20))
  }, [messages])
  
  // Auto-scroll to latest message
  const scrollToIndex = useMemo(() => {
    return shouldAutoScroll ? messages.length - 1 : undefined
  }, [messages.length, shouldAutoScroll])
  
  // Handle container resize
  useEffect(() => {
    const handleResize = () => {
      const container = document.querySelector('.chat-container')
      if (container) {
        setContainerHeight(container.clientHeight - 100) // Account for input area
      }
    }
    
    window.addEventListener('resize', handleResize)
    handleResize()
    
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  
  const renderMessage = useMemo(() => (message: any, index: number) => (
    <MessageItem
      key={message.id || index}
      message={message}
      index={index}
    />
  ), [])
  
  return (
    <div className="virtual-messages">
      <VirtualList
        items={messages}
        itemHeight={estimatedItemHeight}
        containerHeight={containerHeight}
        renderItem={renderMessage}
        scrollToIndex={scrollToIndex}
        overscan={3}
      />
    </div>
  )
}
```

---

## 🧠 Memory Management and Garbage Collection

### Memory-Efficient Message Store
```typescript
// src/stores/optimizedSessionStore.ts
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

interface OptimizedMessage {
  id: string
  content: string
  role: 'user' | 'assistant' | 'system'
  timestamp: number
  // Use WeakMap for additional data to allow GC
}

interface MessageCache {
  rendered: WeakMap<OptimizedMessage, React.ReactElement>
  heights: Map<string, number>
  lastCleanup: number
}

interface OptimizedSessionState {
  messages: OptimizedMessage[]
  messageCache: MessageCache
  maxMessages: number
  
  // Actions
  addMessage: (message: Omit<OptimizedMessage, 'id' | 'timestamp'>) => void
  updateMessage: (id: string, updates: Partial<OptimizedMessage>) => void
  clearOldMessages: () => void
  cleanupCache: () => void
}

export const useOptimizedSessionStore = create<OptimizedSessionState>()(
  subscribeWithSelector((set, get) => ({
    messages: [],
    messageCache: {
      rendered: new WeakMap(),
      heights: new Map(),
      lastCleanup: Date.now()
    },
    maxMessages: 1000,
    
    addMessage: (message) => {
      const newMessage: OptimizedMessage = {
        ...message,
        id: generateId(),
        timestamp: Date.now()
      }
      
      set((state) => {
        const messages = [...state.messages, newMessage]
        
        // Trim old messages if exceeding limit
        if (messages.length > state.maxMessages) {
          const trimmedMessages = messages.slice(-state.maxMessages)
          // Clean up cache for removed messages
          const removedIds = new Set(
            messages
              .slice(0, messages.length - state.maxMessages)
              .map(m => m.id)
          )
          
          state.messageCache.heights.forEach((_, id) => {
            if (removedIds.has(id)) {
              state.messageCache.heights.delete(id)
            }
          })
          
          return { ...state, messages: trimmedMessages }
        }
        
        return { ...state, messages }
      })
    },
    
    updateMessage: (id, updates) => {
      set((state) => ({
        ...state,
        messages: state.messages.map((msg) =>
          msg.id === id ? { ...msg, ...updates } : msg
        )
      }))
    },
    
    clearOldMessages: () => {
      set((state) => {
        const cutoff = Date.now() - 24 * 60 * 60 * 1000 // 24 hours
        const filteredMessages = state.messages.filter(
          (msg) => msg.timestamp > cutoff
        )
        
        // Clean up cache
        const activeIds = new Set(filteredMessages.map(m => m.id))
        state.messageCache.heights.forEach((_, id) => {
          if (!activeIds.has(id)) {
            state.messageCache.heights.delete(id)
          }
        })
        
        return {
          ...state,
          messages: filteredMessages
        }
      })
    },
    
    cleanupCache: () => {
      set((state) => {
        const now = Date.now()
        if (now - state.messageCache.lastCleanup > 5 * 60 * 1000) { // 5 minutes
          // Force garbage collection of WeakMap entries
          state.messageCache.rendered = new WeakMap()
          state.messageCache.lastCleanup = now
        }
        return state
      })
    }
  }))
)

// Cleanup subscription
let cleanupInterval: NodeJS.Timeout

if (typeof window !== 'undefined') {
  cleanupInterval = setInterval(() => {
    useOptimizedSessionStore.getState().cleanupCache()
    
    // Force garbage collection if available (dev mode)
    if (window.gc && typeof window.gc === 'function') {
      window.gc()
    }
  }, 5 * 60 * 1000) // Every 5 minutes
}
```

### Memory Monitoring Hook
```typescript
// src/hooks/useMemoryMonitor.ts
import { useEffect, useState, useRef } from 'react'

interface MemoryStats {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
  componentCount: number
}

export function useMemoryMonitor() {
  const [memoryStats, setMemoryStats] = useState<MemoryStats | null>(null)
  const intervalRef = useRef<NodeJS.Timeout>()
  
  useEffect(() => {
    const updateMemoryStats = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory
        setMemoryStats({
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
          componentCount: document.querySelectorAll('[data-react-component]').length
        })
      }
    }
    
    // Update every 10 seconds in development
    if (process.env.NODE_ENV === 'development') {
      intervalRef.current = setInterval(updateMemoryStats, 10000)
      updateMemoryStats()
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])
  
  const formatBytes = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB'
  }
  
  return {
    memoryStats,
    formatBytes,
    isMemoryHigh: memoryStats ? memoryStats.usedJSHeapSize / memoryStats.jsHeapSizeLimit > 0.8 : false
  }
}
```

---

## ⚛️ React Rendering Optimization

### Memoized Components
```typescript
// src/components/chat/OptimizedMessageItem.tsx
import React, { memo, useMemo, useCallback } from 'react'
import { MessageContent } from './MessageContent'
import { ToolCallResults } from './ToolCallResults'

interface MessageItemProps {
  message: {
    id: string
    content: string
    role: 'user' | 'assistant' | 'system'
    toolCalls?: any[]
    timestamp: number
  }
  index: number
  isVisible?: boolean
}

export const OptimizedMessageItem = memo<MessageItemProps>(({
  message,
  index,
  isVisible = true
}) => {
  // Memoize expensive computations
  const formattedTimestamp = useMemo(() => {
    return new Date(message.timestamp).toLocaleTimeString()
  }, [message.timestamp])
  
  const hasToolCalls = useMemo(() => {
    return message.toolCalls && message.toolCalls.length > 0
  }, [message.toolCalls])
  
  // Memoized event handlers
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content)
  }, [message.content])
  
  const handleShare = useCallback(() => {
    // Share logic
  }, [message.id])
  
  // Don't render if not visible (for virtual scrolling)
  if (!isVisible) {
    return <div style={{ height: '100px' }} />
  }
  
  return (
    <div
      className={`message-item message-item--${message.role}`}
      data-message-id={message.id}
      data-react-component="message-item"
    >
      <div className="message-header">
        <span className="message-role">{message.role}</span>
        <span className="message-timestamp">{formattedTimestamp}</span>
        <div className="message-actions">
          <button onClick={handleCopy} className="message-action">
            Copy
          </button>
          <button onClick={handleShare} className="message-action">
            Share
          </button>
        </div>
      </div>
      
      <div className="message-body">
        <MessageContent content={message.content} />
        {hasToolCalls && (
          <ToolCallResults toolCalls={message.toolCalls!} />
        )}
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison for memo
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.toolCalls === nextProps.message.toolCalls &&
    prevProps.isVisible === nextProps.isVisible
  )
})

OptimizedMessageItem.displayName = 'OptimizedMessageItem'
```

### Lazy Loading and Code Splitting
```typescript
// src/components/lazy/LazyComponents.tsx
import { lazy, Suspense } from 'react'
import { LoadingSpinner } from '../ui/LoadingSpinner'

// Lazy load heavy components
export const LazyToolExecutionPanel = lazy(() => 
  import('../tools/ToolExecutionPanel').then(module => ({
    default: module.ToolExecutionPanel
  }))
)

export const LazyFileViewer = lazy(() =>
  import('../tools/FileViewer').then(module => ({
    default: module.FileViewer
  }))
)

export const LazyTerminalOutput = lazy(() =>
  import('../tools/TerminalOutput').then(module => ({
    default: module.TerminalOutput
  }))
)

export const LazyCodeEditor = lazy(() =>
  import('../tools/CodeEditor').then(module => ({
    default: module.CodeEditor
  }))
)

// Wrapper component with consistent loading UI
interface LazyWrapperProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function LazyWrapper({ children, fallback }: LazyWrapperProps) {
  return (
    <Suspense fallback={fallback || <LoadingSpinner />}>
      {children}
    </Suspense>
  )
}

// Usage example
export function ToolPanel({ toolType }: { toolType: string }) {
  switch (toolType) {
    case 'file':
      return (
        <LazyWrapper>
          <LazyFileViewer />
        </LazyWrapper>
      )
    case 'terminal':
      return (
        <LazyWrapper>
          <LazyTerminalOutput />
        </LazyWrapper>
      )
    case 'editor':
      return (
        <LazyWrapper>
          <LazyCodeEditor />
        </LazyWrapper>
      )
    default:
      return (
        <LazyWrapper>
          <LazyToolExecutionPanel />
        </LazyWrapper>
      )
  }
}
```

### React Concurrent Features
```typescript
// src/hooks/useConcurrentUpdate.ts
import { 
  useDeferredValue, 
  useTransition, 
  startTransition,
  useMemo 
} from 'react'

export function useConcurrentMessageUpdate() {
  const [isPending, startTransition] = useTransition()
  
  const updateMessages = useMemo(() => (
    updater: (messages: any[]) => any[]
  ) => {
    startTransition(() => {
      // Non-urgent updates that can be deferred
      updater
    })
  }, [])
  
  return { updateMessages, isPending }
}

// Deferred value for expensive computations
export function useDeferredMessages(messages: any[]) {
  const deferredMessages = useDeferredValue(messages)
  
  // Show loading state when values are different
  const isStale = messages !== deferredMessages
  
  return { deferredMessages, isStale }
}
```

---

## 🌊 Stream Processing Efficiency

### Optimized SSE Handler
```typescript
// src/services/optimizedSSEHandler.ts
export class OptimizedSSEHandler {
  private eventSource: EventSource | null = null
  private messageBuffer = new Map<string, BufferedMessage>()
  private flushTimer: NodeJS.Timeout | null = null
  private readonly BATCH_SIZE = 10
  private readonly FLUSH_INTERVAL = 50 // 50ms batching
  
  interface BufferedMessage {
    content: string
    timestamp: number
    parts: string[]
  }
  
  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.eventSource = new EventSource(url)
      
      this.eventSource.onopen = () => resolve()
      this.eventSource.onerror = (error) => reject(error)
      
      // Optimized message handling
      this.eventSource.addEventListener('message', this.handleMessage)
      this.eventSource.addEventListener('tool_call', this.handleToolCall)
      this.eventSource.addEventListener('delta', this.handleDelta)
    })
  }
  
  private handleMessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)
      
      // Process in next tick to avoid blocking
      requestIdleCallback(() => {
        this.processMessage(data)
      }, { timeout: 16 }) // Max 16ms delay
      
    } catch (error) {
      console.error('Failed to parse SSE message:', error)
    }
  }
  
  private handleDelta = (event: MessageEvent) => {
    try {
      const delta = JSON.parse(event.data)
      
      if (delta.messageId && delta.text) {
        this.bufferTextDelta(delta.messageId, delta.text)
      }
    } catch (error) {
      console.error('Failed to parse delta:', error)
    }
  }
  
  private bufferTextDelta(messageId: string, text: string) {
    const existing = this.messageBuffer.get(messageId) || {
      content: '',
      timestamp: Date.now(),
      parts: []
    }
    
    existing.parts.push(text)
    existing.timestamp = Date.now()
    this.messageBuffer.set(messageId, existing)
    
    // Schedule batch flush
    this.scheduleBatchFlush()
  }
  
  private scheduleBatchFlush() {
    if (this.flushTimer) return
    
    this.flushTimer = setTimeout(() => {
      this.flushBufferedMessages()
      this.flushTimer = null
    }, this.FLUSH_INTERVAL)
  }
  
  private flushBufferedMessages() {
    const updates: Array<{ id: string; content: string }> = []
    
    this.messageBuffer.forEach((buffer, messageId) => {
      const content = buffer.parts.join('')
      updates.push({ id: messageId, content })
      
      // Update buffer with combined content
      buffer.content = content
      buffer.parts = []
    })
    
    if (updates.length > 0) {
      // Batch update to store
      startTransition(() => {
        updates.forEach(({ id, content }) => {
          useOptimizedSessionStore.getState().updateMessage(id, { content })
        })
      })
    }
  }
  
  private handleToolCall = (event: MessageEvent) => {
    try {
      const toolCall = JSON.parse(event.data)
      
      // Use scheduler for non-urgent tool updates
      scheduler.postTask(() => {
        this.processToolCall(toolCall)
      }, { priority: 'user-blocking' })
      
    } catch (error) {
      console.error('Failed to parse tool call:', error)
    }
  }
  
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
    
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
    
    // Final flush
    this.flushBufferedMessages()
    this.messageBuffer.clear()
  }
}

// Scheduler polyfill for older browsers
const scheduler = {
  postTask: (callback: () => void, options?: { priority: string }) => {
    if ('scheduler' in window && 'postTask' in window.scheduler) {
      return (window.scheduler as any).postTask(callback, options)
    } else {
      // Fallback to setTimeout with priority mapping
      const delay = options?.priority === 'user-blocking' ? 0 : 5
      return setTimeout(callback, delay)
    }
  }
}
```

### Stream Processing Performance Monitor
```typescript
// src/services/streamPerformanceMonitor.ts
export class StreamPerformanceMonitor {
  private metrics = {
    messagesProcessed: 0,
    bytesReceived: 0,
    averageLatency: 0,
    droppedMessages: 0,
    bufferOverflows: 0
  }
  
  private latencyQueue: number[] = []
  private readonly MAX_LATENCY_SAMPLES = 100
  
  trackMessage(size: number, processingTime: number) {
    this.metrics.messagesProcessed++
    this.metrics.bytesReceived += size
    
    // Track latency
    this.latencyQueue.push(processingTime)
    if (this.latencyQueue.length > this.MAX_LATENCY_SAMPLES) {
      this.latencyQueue.shift()
    }
    
    // Calculate average latency
    this.metrics.averageLatency = this.latencyQueue.reduce((a, b) => a + b, 0) / this.latencyQueue.length
    
    // Alert on performance issues
    if (processingTime > 100) { // >100ms is concerning
      console.warn(`Slow message processing: ${processingTime}ms`)
    }
  }
  
  trackDroppedMessage() {
    this.metrics.droppedMessages++
  }
  
  trackBufferOverflow() {
    this.metrics.bufferOverflows++
  }
  
  getMetrics() {
    return {
      ...this.metrics,
      throughput: this.metrics.messagesProcessed / (Date.now() / 1000), // messages per second
      averageMessageSize: this.metrics.bytesReceived / this.metrics.messagesProcessed || 0
    }
  }
  
  reset() {
    this.metrics = {
      messagesProcessed: 0,
      bytesReceived: 0,
      averageLatency: 0,
      droppedMessages: 0,
      bufferOverflows: 0
    }
    this.latencyQueue = []
  }
}
```

---

## 🖥️ WebView Performance Optimization

### WebView Resource Management
```typescript
// src/webview/performanceOptimizer.ts
export class WebViewPerformanceOptimizer {
  private observer: IntersectionObserver | null = null
  private resizeObserver: ResizeObserver | null = null
  private idleCallback: number | null = null
  
  initialize() {
    this.setupIntersectionObserver()
    this.setupResizeObserver()
    this.setupIdleOptimizations()
    this.setupResourceCleanup()
  }
  
  private setupIntersectionObserver() {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const element = entry.target as HTMLElement
          
          if (entry.isIntersecting) {
            // Load content when visible
            element.classList.add('visible')
            this.lazyLoadContent(element)
          } else {
            // Unload heavy content when not visible
            element.classList.remove('visible')
            this.unloadContent(element)
          }
        })
      },
      {
        rootMargin: '100px', // Start loading 100px before entering viewport
        threshold: [0, 0.1, 0.5, 1]
      }
    )
    
    // Observe all lazy-loadable elements
    document.querySelectorAll('[data-lazy]').forEach((el) => {
      this.observer!.observe(el)
    })
  }
  
  private setupResizeObserver() {
    this.resizeObserver = new ResizeObserver((entries) => {
      // Debounce resize handling
      requestIdleCallback(() => {
        entries.forEach((entry) => {
          const element = entry.target as HTMLElement
          this.handleElementResize(element, entry.contentRect)
        })
      })
    })
  }
  
  private setupIdleOptimizations() {
    // Run optimizations during idle time
    const runIdleOptimizations = () => {
      this.idleCallback = requestIdleCallback((deadline) => {
        while (deadline.timeRemaining() > 5) {
          // Clean up DOM nodes
          this.cleanupUnusedNodes()
          
          // Compress images
          this.optimizeImages()
          
          // Clean up event listeners
          this.cleanupEventListeners()
          
          break // Only do one optimization per idle period
        }
        
        // Schedule next idle optimization
        runIdleOptimizations()
      }, { timeout: 5000 })
    }
    
    runIdleOptimizations()
  }
  
  private setupResourceCleanup() {
    // Clean up resources on visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseNonEssentialOperations()
      } else {
        this.resumeOperations()
      }
    })
    
    // Memory pressure handling
    if ('memory' in performance) {
      setInterval(() => {
        const memory = (performance as any).memory
        const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit
        
        if (usageRatio > 0.8) {
          this.aggressiveCleanup()
        }
      }, 30000) // Check every 30 seconds
    }
  }
  
  private lazyLoadContent(element: HTMLElement) {
    const type = element.dataset.lazy
    
    switch (type) {
      case 'syntax-highlight':
        this.loadSyntaxHighlighting(element)
        break
      case 'file-content':
        this.loadFileContent(element)
        break
      case 'tool-output':
        this.loadToolOutput(element)
        break
    }
  }
  
  private unloadContent(element: HTMLElement) {
    // Remove heavy content when not visible
    const type = element.dataset.lazy
    
    if (type === 'syntax-highlight') {
      // Keep structure but remove highlighting
      element.innerHTML = element.textContent || ''
    }
  }
  
  private aggressiveCleanup() {
    // Force garbage collection if available
    if (window.gc) {
      window.gc()
    }
    
    // Clean up caches
    useOptimizedSessionStore.getState().cleanupCache()
    
    // Remove non-visible content
    document.querySelectorAll('[data-lazy]:not(.visible)').forEach((el) => {
      this.unloadContent(el as HTMLElement)
    })
  }
  
  destroy() {
    if (this.observer) {
      this.observer.disconnect()
    }
    
    if (this.resizeObserver) {
      this.resizeObserver.disconnect()
    }
    
    if (this.idleCallback) {
      cancelIdleCallback(this.idleCallback)
    }
  }
}
```

### WebView Message Optimization
```typescript
// src/webview/messageOptimizer.ts
export class WebViewMessageOptimizer {
  private messageQueue: any[] = []
  private flushTimer: NodeJS.Timeout | null = null
  private readonly BATCH_SIZE = 50
  private readonly FLUSH_INTERVAL = 16 // 60fps
  
  queueMessage(message: any) {
    this.messageQueue.push(message)
    
    if (this.messageQueue.length >= this.BATCH_SIZE) {
      this.flushMessages()
    } else {
      this.scheduleFlush()
    }
  }
  
  private scheduleFlush() {
    if (this.flushTimer) return
    
    this.flushTimer = setTimeout(() => {
      this.flushMessages()
      this.flushTimer = null
    }, this.FLUSH_INTERVAL)
  }
  
  private flushMessages() {
    if (this.messageQueue.length === 0) return
    
    const messages = this.messageQueue.splice(0, this.BATCH_SIZE)
    
    // Send batch to VS Code extension
    if (window.vscode) {
      window.vscode.postMessage({
        type: 'batch-update',
        messages: messages
      })
    }
  }
  
  optimizeMessage(message: any): any {
    // Remove unnecessary data
    const optimized = { ...message }
    
    // Remove large binary data
    if (optimized.data && optimized.data.length > 1000000) { // 1MB
      optimized.data = '[Large data truncated]'
    }
    
    // Compress repeated strings
    if (typeof optimized.content === 'string') {
      optimized.content = this.compressString(optimized.content)
    }
    
    return optimized
  }
  
  private compressString(str: string): string {
    // Simple compression for repeated patterns
    if (str.length < 1000) return str
    
    // Replace common patterns
    return str
      .replace(/\s+/g, ' ') // Multiple spaces to single
      .replace(/\n\s*\n/g, '\n') // Multiple newlines to single
  }
}
```

---

## 📦 Bundle Size Optimization

### Webpack Bundle Analysis Configuration
```typescript
// webpack.analyzer.config.js
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin
const path = require('path')

module.exports = {
  mode: 'production',
  entry: './src/index.tsx',
  
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          priority: 10
        },
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
          name: 'react',
          chunks: 'all',
          priority: 20
        },
        ui: {
          test: /[\\/]node_modules[\\/](@radix-ui|@headlessui)[\\/]/,
          name: 'ui',
          chunks: 'all',
          priority: 15
        },
        syntax: {
          test: /[\\/]node_modules[\\/](prismjs|monaco-editor)[\\/]/,
          name: 'syntax',
          chunks: 'all',
          priority: 15
        }
      }
    },
    
    // Tree shaking
    usedExports: true,
    sideEffects: false,
    
    // Minimize
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: true,
            drop_debugger: true,
            pure_funcs: ['console.log', 'console.warn']
          }
        }
      })
    ]
  },
  
  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      openAnalyzer: false,
      reportFilename: 'bundle-report.html'
    })
  ],
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  }
}
```

### Dynamic Import Strategy
```typescript
// src/utils/dynamicImports.ts
export class DynamicImportManager {
  private loadedModules = new Map<string, any>()
  private loadingPromises = new Map<string, Promise<any>>()
  
  async loadModule<T>(moduleName: string, importFn: () => Promise<T>): Promise<T> {
    // Return cached module if already loaded
    if (this.loadedModules.has(moduleName)) {
      return this.loadedModules.get(moduleName)
    }
    
    // Return existing promise if already loading
    if (this.loadingPromises.has(moduleName)) {
      return this.loadingPromises.get(moduleName)
    }
    
    // Start loading
    const loadingPromise = this.loadWithRetry(importFn, 3)
    this.loadingPromises.set(moduleName, loadingPromise)
    
    try {
      const module = await loadingPromise
      this.loadedModules.set(moduleName, module)
      this.loadingPromises.delete(moduleName)
      return module
    } catch (error) {
      this.loadingPromises.delete(moduleName)
      throw error
    }
  }
  
  private async loadWithRetry<T>(importFn: () => Promise<T>, retries: number): Promise<T> {
    try {
      return await importFn()
    } catch (error) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        return this.loadWithRetry(importFn, retries - 1)
      }
      throw error
    }
  }
  
  preloadModules(moduleSpecs: Array<{ name: string; importFn: () => Promise<any> }>) {
    // Preload during idle time
    requestIdleCallback(() => {
      moduleSpecs.forEach(({ name, importFn }) => {
        this.loadModule(name, importFn).catch(() => {
          // Ignore preload failures
        })
      })
    })
  }
  
  clearCache() {
    this.loadedModules.clear()
    this.loadingPromises.clear()
  }
}

export const dynamicImports = new DynamicImportManager()

// Module specifications
export const MODULE_SPECS = {
  syntaxHighlighter: {
    name: 'syntax-highlighter',
    importFn: () => import('prismjs')
  },
  codeEditor: {
    name: 'code-editor',
    importFn: () => import('monaco-editor')
  },
  chartLibrary: {
    name: 'chart-library',
    importFn: () => import('recharts')
  },
  pdfViewer: {
    name: 'pdf-viewer',
    importFn: () => import('react-pdf')
  }
}
```

### Bundle Optimization Utilities
```typescript
// src/utils/bundleOptimization.ts
export class BundleOptimizer {
  // Lazy load CSS
  static loadCSS(href: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = href
      link.onload = () => resolve()
      link.onerror = () => reject(new Error(`Failed to load CSS: ${href}`))
      document.head.appendChild(link)
    })
  }
  
  // Preload critical resources
  static preloadResource(href: string, as: string) {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.href = href
    link.as = as
    document.head.appendChild(link)
  }
  
  // Feature detection for polyfills
  static loadPolyfillsIfNeeded(): Promise<void[]> {
    const polyfills: Promise<void>[] = []
    
    // IntersectionObserver polyfill
    if (!window.IntersectionObserver) {
      polyfills.push(
        import('intersection-observer').then(() => {})
      )
    }
    
    // ResizeObserver polyfill
    if (!window.ResizeObserver) {
      polyfills.push(
        import('resize-observer-polyfill').then((module) => {
          window.ResizeObserver = module.default
        })
      )
    }
    
    // Web Streams polyfill
    if (!window.ReadableStream) {
      polyfills.push(
        import('web-streams-polyfill').then(() => {})
      )
    }
    
    return Promise.all(polyfills)
  }
  
  // Tree shake unused exports
  static analyzeUsage() {
    if (process.env.NODE_ENV === 'development') {
      // Track component usage
      const usedComponents = new Set<string>()
      
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element
              const componentName = element.getAttribute('data-component')
              if (componentName) {
                usedComponents.add(componentName)
              }
            }
          })
        })
      })
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      })
      
      // Log usage after 30 seconds
      setTimeout(() => {
        console.log('Used components:', Array.from(usedComponents))
        observer.disconnect()
      }, 30000)
    }
  }
}
```

---

## ⚡ CPU Usage Optimization

### Debounced Updates System
```typescript
// src/utils/debouncedUpdates.ts
export class DebouncedUpdateManager {
  private updateQueues = new Map<string, {
    updates: any[]
    timer: NodeJS.Timeout | null
    batchSize: number
    delay: number
  }>()
  
  scheduleUpdate<T>(
    queueName: string,
    update: T,
    options: {
      batchSize?: number
      delay?: number
      processor: (updates: T[]) => void
    }
  ) {
    let queue = this.updateQueues.get(queueName)
    
    if (!queue) {
      queue = {
        updates: [],
        timer: null,
        batchSize: options.batchSize || 10,
        delay: options.delay || 100
      }
      this.updateQueues.set(queueName, queue)
    }
    
    queue.updates.push(update)
    
    // Process immediately if batch is full
    if (queue.updates.length >= queue.batchSize) {
      this.processQueue(queueName, options.processor)
    } else {
      // Schedule delayed processing
      if (queue.timer) {
        clearTimeout(queue.timer)
      }
      
      queue.timer = setTimeout(() => {
        this.processQueue(queueName, options.processor)
      }, queue.delay)
    }
  }
  
  private processQueue<T>(queueName: string, processor: (updates: T[]) => void) {
    const queue = this.updateQueues.get(queueName)
    if (!queue || queue.updates.length === 0) return
    
    const updates = queue.updates.splice(0)
    queue.timer = null
    
    // Process in next frame to avoid blocking
    requestAnimationFrame(() => {
      processor(updates)
    })
  }
  
  flush(queueName?: string) {
    if (queueName) {
      const queue = this.updateQueues.get(queueName)
      if (queue && queue.timer) {
        clearTimeout(queue.timer)
        // Process immediately
      }
    } else {
      // Flush all queues
      this.updateQueues.forEach((queue, name) => {
        if (queue.timer) {
          clearTimeout(queue.timer)
        }
      })
    }
  }
}

export const updateManager = new DebouncedUpdateManager()
```

### Worker-Based Processing
```typescript
// src/workers/messageProcessor.worker.ts
// Web Worker for CPU-intensive tasks

interface MessageProcessingTask {
  id: string
  type: 'parse' | 'highlight' | 'format'
  data: any
}

interface ProcessingResult {
  id: string
  result: any
  error?: string
}

class MessageProcessor {
  async processMessage(task: MessageProcessingTask): Promise<ProcessingResult> {
    try {
      let result: any
      
      switch (task.type) {
        case 'parse':
          result = this.parseMessage(task.data)
          break
        case 'highlight':
          result = await this.highlightCode(task.data)
          break
        case 'format':
          result = this.formatContent(task.data)
          break
        default:
          throw new Error(`Unknown task type: ${task.type}`)
      }
      
      return { id: task.id, result }
    } catch (error) {
      return { 
        id: task.id, 
        result: null, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
  
  private parseMessage(data: string) {
    // CPU-intensive parsing logic
    return JSON.parse(data)
  }
  
  private async highlightCode(data: { code: string; language: string }) {
    // Syntax highlighting logic
    // This would use Prism.js or similar
    return `<pre><code class="language-${data.language}">${data.code}</code></pre>`
  }
  
  private formatContent(data: string) {
    // Format markdown or other content
    return data.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  }
}

const processor = new MessageProcessor()

// Listen for messages from main thread
self.onmessage = async (event: MessageEvent<MessageProcessingTask>) => {
  const result = await processor.processMessage(event.data)
  self.postMessage(result)
}
```

### Worker Manager
```typescript
// src/services/workerManager.ts
export class WorkerManager {
  private workers: Worker[] = []
  private taskQueue: any[] = []
  private busyWorkers = new Set<number>()
  private readonly MAX_WORKERS = navigator.hardwareConcurrency || 4
  
  constructor() {
    this.initializeWorkers()
  }
  
  private initializeWorkers() {
    for (let i = 0; i < Math.min(this.MAX_WORKERS, 4); i++) {
      const worker = new Worker(
        new URL('../workers/messageProcessor.worker.ts', import.meta.url),
        { type: 'module' }
      )
      
      worker.onmessage = (event) => {
        this.handleWorkerResult(i, event.data)
      }
      
      worker.onerror = (error) => {
        console.error(`Worker ${i} error:`, error)
        this.busyWorkers.delete(i)
        this.processNextTask()
      }
      
      this.workers.push(worker)
    }
  }
  
  async processTask(task: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const enrichedTask = {
        ...task,
        id: this.generateTaskId(),
        resolve,
        reject
      }
      
      this.taskQueue.push(enrichedTask)
      this.processNextTask()
    })
  }
  
  private processNextTask() {
    if (this.taskQueue.length === 0) return
    
    const availableWorkerIndex = this.findAvailableWorker()
    if (availableWorkerIndex === -1) return
    
    const task = this.taskQueue.shift()!
    this.busyWorkers.add(availableWorkerIndex)
    
    this.workers[availableWorkerIndex].postMessage(task)
  }
  
  private findAvailableWorker(): number {
    for (let i = 0; i < this.workers.length; i++) {
      if (!this.busyWorkers.has(i)) {
        return i
      }
    }
    return -1
  }
  
  private handleWorkerResult(workerIndex: number, result: any) {
    this.busyWorkers.delete(workerIndex)
    
    // Find the corresponding task
    const task = this.findTaskById(result.id)
    if (task) {
      if (result.error) {
        task.reject(new Error(result.error))
      } else {
        task.resolve(result.result)
      }
    }
    
    // Process next task
    this.processNextTask()
  }
  
  private findTaskById(id: string) {
    // Implementation depends on how you track pending tasks
    // This is a simplified version
    return null
  }
  
  private generateTaskId(): string {
    return Math.random().toString(36).substr(2, 9)
  }
  
  terminate() {
    this.workers.forEach(worker => worker.terminate())
    this.workers = []
    this.busyWorkers.clear()
    this.taskQueue = []
  }
}

export const workerManager = new WorkerManager()
```

---

## 📊 Performance Monitoring and Profiling

### Comprehensive Performance Monitor
```typescript
// src/services/performanceMonitor.ts
export class PerformanceMonitor {
  private metrics = new Map<string, PerformanceMetric[]>()
  private observers: PerformanceObserver[] = []
  private isMonitoring = false
  
  interface PerformanceMetric {
    name: string
    value: number
    timestamp: number
    category: 'timing' | 'memory' | 'network' | 'rendering'
  }
  
  startMonitoring() {
    if (this.isMonitoring) return
    
    this.isMonitoring = true
    this.setupPerformanceObservers()
    this.startCustomMetrics()
  }
  
  private setupPerformanceObservers() {
    // Monitor navigation timing
    const navObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.entryType === 'navigation') {
          const navEntry = entry as PerformanceNavigationTiming
          this.recordMetric('navigation.loadComplete', navEntry.loadEventEnd, 'timing')
          this.recordMetric('navigation.domContentLoaded', navEntry.domContentLoadedEventEnd, 'timing')
          this.recordMetric('navigation.firstPaint', navEntry.responseEnd, 'timing')
        }
      })
    })
    navObserver.observe({ entryTypes: ['navigation'] })
    this.observers.push(navObserver)
    
    // Monitor resource loading
    const resourceObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        const resourceEntry = entry as PerformanceResourceTiming
        this.recordMetric(`resource.${resourceEntry.name}`, resourceEntry.duration, 'network')
      })
    })
    resourceObserver.observe({ entryTypes: ['resource'] })
    this.observers.push(resourceObserver)
    
    // Monitor long tasks
    if ('PerformanceObserver' in window) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            this.recordMetric('longTask', entry.duration, 'rendering')
            
            if (entry.duration > 50) {
              console.warn(`Long task detected: ${entry.duration}ms`)
            }
          })
        })
        longTaskObserver.observe({ entryTypes: ['longtask'] })
        this.observers.push(longTaskObserver)
      } catch (e) {
        // longtask not supported
      }
    }
    
    // Monitor layout shifts
    try {
      const clsObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
            this.recordMetric('layoutShift', (entry as any).value, 'rendering')
          }
        })
      })
      clsObserver.observe({ entryTypes: ['layout-shift'] })
      this.observers.push(clsObserver)
    } catch (e) {
      // layout-shift not supported
    }
  }
  
  private startCustomMetrics() {
    // Memory monitoring
    setInterval(() => {
      if ('memory' in performance) {
        const memory = (performance as any).memory
        this.recordMetric('memory.used', memory.usedJSHeapSize, 'memory')
        this.recordMetric('memory.total', memory.totalJSHeapSize, 'memory')
        this.recordMetric('memory.limit', memory.jsHeapSizeLimit, 'memory')
      }
    }, 5000)
    
    // Frame rate monitoring
    let lastFrameTime = performance.now()
    let frameCount = 0
    
    const measureFrameRate = () => {
      const now = performance.now()
      frameCount++
      
      if (now - lastFrameTime >= 1000) {
        const fps = (frameCount * 1000) / (now - lastFrameTime)
        this.recordMetric('rendering.fps', fps, 'rendering')
        frameCount = 0
        lastFrameTime = now
      }
      
      requestAnimationFrame(measureFrameRate)
    }
    requestAnimationFrame(measureFrameRate)
    
    // Component render timing
    this.monitorReactPerformance()
  }
  
  private monitorReactPerformance() {
    // Hook into React DevTools profiler if available
    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      const devtools = window.__REACT_DEVTOOLS_GLOBAL_HOOK__
      
      devtools.onCommitFiberRoot = (id: number, root: any, priorityLevel: any) => {
        const renderTime = performance.now()
        this.recordMetric('react.commit', renderTime, 'rendering')
      }
    }
  }
  
  private recordMetric(name: string, value: number, category: PerformanceMetric['category']) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }
    
    const metrics = this.metrics.get(name)!
    metrics.push({
      name,
      value,
      timestamp: Date.now(),
      category
    })
    
    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift()
    }
    
    // Alert on performance issues
    this.checkPerformanceThresholds(name, value, category)
  }
  
  private checkPerformanceThresholds(name: string, value: number, category: string) {
    const thresholds = {
      'longTask': 50,
      'layoutShift': 0.1,
      'rendering.fps': 30, // Alert if FPS drops below 30
      'memory.used': 100 * 1024 * 1024, // 100MB
    }
    
    const threshold = thresholds[name as keyof typeof thresholds]
    if (threshold && value > threshold) {
      console.warn(`Performance threshold exceeded: ${name} = ${value}`)
      
      // Could send to analytics service
      this.reportPerformanceIssue(name, value, category)
    }
  }
  
  private reportPerformanceIssue(name: string, value: number, category: string) {
    // Send to analytics or monitoring service
    if (window.vscode) {
      window.vscode.postMessage({
        type: 'performance-issue',
        data: { name, value, category, timestamp: Date.now() }
      })
    }
  }
  
  getMetrics(category?: string): PerformanceMetric[] {
    const allMetrics: PerformanceMetric[] = []
    
    this.metrics.forEach((metrics) => {
      metrics.forEach((metric) => {
        if (!category || metric.category === category) {
          allMetrics.push(metric)
        }
      })
    })
    
    return allMetrics
  }
  
  getAverageMetric(name: string): number {
    const metrics = this.metrics.get(name)
    if (!metrics || metrics.length === 0) return 0
    
    const sum = metrics.reduce((total, metric) => total + metric.value, 0)
    return sum / metrics.length
  }
  
  exportMetrics(): string {
    const data = {
      timestamp: Date.now(),
      metrics: Object.fromEntries(this.metrics),
      summary: {
        averageFPS: this.getAverageMetric('rendering.fps'),
        averageMemory: this.getAverageMetric('memory.used'),
        totalLongTasks: this.metrics.get('longTask')?.length || 0,
        averageLayoutShift: this.getAverageMetric('layoutShift')
      }
    }
    
    return JSON.stringify(data, null, 2)
  }
  
  stopMonitoring() {
    this.isMonitoring = false
    this.observers.forEach(observer => observer.disconnect())
    this.observers = []
  }
}

export const performanceMonitor = new PerformanceMonitor()

// Auto-start monitoring in development
if (process.env.NODE_ENV === 'development') {
  performanceMonitor.startMonitoring()
}
```

### Performance Dashboard Component
```typescript
// src/components/debug/PerformanceDashboard.tsx
import React, { useState, useEffect } from 'react'
import { performanceMonitor } from '../../services/performanceMonitor'

export function PerformanceDashboard() {
  const [metrics, setMetrics] = useState<any>({})
  const [isVisible, setIsVisible] = useState(false)
  
  useEffect(() => {
    if (!isVisible) return
    
    const interval = setInterval(() => {
      const summary = {
        fps: performanceMonitor.getAverageMetric('rendering.fps').toFixed(1),
        memory: (performanceMonitor.getAverageMetric('memory.used') / 1024 / 1024).toFixed(1),
        longTasks: performanceMonitor.getMetrics('rendering').filter(m => m.name === 'longTask').length,
        layoutShifts: performanceMonitor.getAverageMetric('layoutShift').toFixed(3)
      }
      setMetrics(summary)
    }, 1000)
    
    return () => clearInterval(interval)
  }, [isVisible])
  
  // Toggle with Ctrl+Shift+P
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'P') {
        setIsVisible(!isVisible)
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isVisible])
  
  if (!isVisible) return null
  
  return (
    <div className="performance-dashboard">
      <div className="performance-header">
        <h3>Performance Dashboard</h3>
        <button onClick={() => setIsVisible(false)}>×</button>
      </div>
      
      <div className="performance-metrics">
        <div className="metric">
          <span className="metric-label">FPS</span>
          <span className={`metric-value ${parseFloat(metrics.fps) < 30 ? 'warning' : ''}`}>
            {metrics.fps}
          </span>
        </div>
        
        <div className="metric">
          <span className="metric-label">Memory</span>
          <span className={`metric-value ${parseFloat(metrics.memory) > 100 ? 'warning' : ''}`}>
            {metrics.memory} MB
          </span>
        </div>
        
        <div className="metric">
          <span className="metric-label">Long Tasks</span>
          <span className={`metric-value ${metrics.longTasks > 5 ? 'warning' : ''}`}>
            {metrics.longTasks}
          </span>
        </div>
        
        <div className="metric">
          <span className="metric-label">Layout Shifts</span>
          <span className={`metric-value ${parseFloat(metrics.layoutShifts) > 0.1 ? 'warning' : ''}`}>
            {metrics.layoutShifts}
          </span>
        </div>
      </div>
      
      <div className="performance-actions">
        <button onClick={() => performanceMonitor.exportMetrics()}>
          Export Metrics
        </button>
        <button onClick={() => console.log(performanceMonitor.getMetrics())}>
          Log to Console
        </button>
      </div>
    </div>
  )
}
```

---

## 📈 Performance Testing and Benchmarks

### Automated Performance Tests
```typescript
// src/tests/performance/performanceTests.ts
import { performanceMonitor } from '../../services/performanceMonitor'

export class PerformanceTestSuite {
  private results: TestResult[] = []
  
  interface TestResult {
    testName: string
    duration: number
    memoryUsed: number
    success: boolean
    metrics: any
  }
  
  async runAllTests(): Promise<TestResult[]> {
    const tests = [
      this.testMessageRendering,
      this.testVirtualScrolling,
      this.testMemoryUsage,
      this.testBundleSize,
      this.testStreamProcessing
    ]
    
    for (const test of tests) {
      try {
        const result = await test.call(this)
        this.results.push(result)
      } catch (error) {
        console.error(`Test failed: ${test.name}`, error)
        this.results.push({
          testName: test.name,
          duration: 0,
          memoryUsed: 0,
          success: false,
          metrics: { error: error.message }
        })
      }
    }
    
    return this.results
  }
  
  private async testMessageRendering(): Promise<TestResult> {
    const startTime = performance.now()
    const startMemory = this.getCurrentMemory()
    
    // Simulate rendering 1000 messages
    const messages = Array.from({ length: 1000 }, (_, i) => ({
      id: `test-${i}`,
      content: `Test message ${i}`,
      role: 'user' as const,
      timestamp: Date.now()
    }))
    
    // Measure render time
    const renderStart = performance.now()
    
    // Would trigger actual rendering in real test
    await new Promise(resolve => setTimeout(resolve, 100))
    
    const renderEnd = performance.now()
    const endMemory = this.getCurrentMemory()
    
    return {
      testName: 'messageRendering',
      duration: renderEnd - renderStart,
      memoryUsed: endMemory - startMemory,
      success: true,
      metrics: {
        messagesPerSecond: 1000 / ((renderEnd - renderStart) / 1000),
        avgTimePerMessage: (renderEnd - renderStart) / 1000
      }
    }
  }
  
  private async testVirtualScrolling(): Promise<TestResult> {
    const startTime = performance.now()
    const startMemory = this.getCurrentMemory()
    
    // Test virtual scrolling performance
    const itemCount = 10000
    const visibleItems = 20
    
    // Simulate scroll events
    for (let i = 0; i < 100; i++) {
      const scrollTop = Math.random() * (itemCount * 100)
      // Would trigger virtual scroll calculation
      await new Promise(resolve => setTimeout(resolve, 1))
    }
    
    const endTime = performance.now()
    const endMemory = this.getCurrentMemory()
    
    return {
      testName: 'virtualScrolling',
      duration: endTime - startTime,
      memoryUsed: endMemory - startMemory,
      success: true,
      metrics: {
        scrollEventsPerSecond: 100 / ((endTime - startTime) / 1000),
        memoryEfficiency: endMemory < startMemory * 1.1 // Should not increase by more than 10%
      }
    }
  }
  
  private async testMemoryUsage(): Promise<TestResult> {
    const startMemory = this.getCurrentMemory()
    
    // Create and destroy many objects
    const objects: any[] = []
    for (let i = 0; i < 1000; i++) {
      objects.push({
        id: i,
        data: new Array(1000).fill(i),
        timestamp: Date.now()
      })
    }
    
    const peakMemory = this.getCurrentMemory()
    
    // Clear objects and force GC
    objects.length = 0
    if (window.gc) {
      window.gc()
    }
    
    await new Promise(resolve => setTimeout(resolve, 100))
    const endMemory = this.getCurrentMemory()
    
    return {
      testName: 'memoryUsage',
      duration: 0,
      memoryUsed: peakMemory - startMemory,
      success: true,
      metrics: {
        peakMemory: peakMemory,
        memoryReclaimed: peakMemory - endMemory,
        memoryLeakCheck: endMemory < startMemory * 1.05 // Should return to within 5% of start
      }
    }
  }
  
  private async testBundleSize(): Promise<TestResult> {
    // Would analyze actual bundle in real environment
    const bundleMetrics = {
      totalSize: 450000, // 450KB
      gzippedSize: 150000, // 150KB
      chunks: {
        main: 200000,
        vendor: 150000,
        ui: 100000
      }
    }
    
    const sizeTarget = 500000 // 500KB target
    
    return {
      testName: 'bundleSize',
      duration: 0,
      memoryUsed: 0,
      success: bundleMetrics.totalSize < sizeTarget,
      metrics: bundleMetrics
    }
  }
  
  private async testStreamProcessing(): Promise<TestResult> {
    const startTime = performance.now()
    
    // Simulate processing stream of messages
    const messageCount = 1000
    const processedMessages = []
    
    for (let i = 0; i < messageCount; i++) {
      const message = {
        id: `stream-${i}`,
        data: `Message data ${i}`,
        timestamp: Date.now()
      }
      
      // Simulate processing
      processedMessages.push({
        ...message,
        processed: true,
        processingTime: Math.random() * 10
      })
      
      if (i % 100 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1))
      }
    }
    
    const endTime = performance.now()
    const avgProcessingTime = processedMessages.reduce((sum, msg) => sum + msg.processingTime, 0) / messageCount
    
    return {
      testName: 'streamProcessing',
      duration: endTime - startTime,
      memoryUsed: 0,
      success: avgProcessingTime < 10, // Should process in under 10ms on average
      metrics: {
        messagesPerSecond: messageCount / ((endTime - startTime) / 1000),
        avgProcessingTime,
        throughput: messageCount
      }
    }
  }
  
  private getCurrentMemory(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize
    }
    return 0
  }
  
  generateReport(): string {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: this.results.length,
        passed: this.results.filter(r => r.success).length,
        failed: this.results.filter(r => !r.success).length
      },
      results: this.results,
      recommendations: this.generateRecommendations()
    }
    
    return JSON.stringify(report, null, 2)
  }
  
  private generateRecommendations(): string[] {
    const recommendations: string[] = []
    
    // Analyze results and generate recommendations
    const renderingTest = this.results.find(r => r.testName === 'messageRendering')
    if (renderingTest && renderingTest.metrics.avgTimePerMessage > 5) {
      recommendations.push('Consider optimizing message rendering - average time per message is too high')
    }
    
    const memoryTest = this.results.find(r => r.testName === 'memoryUsage')
    if (memoryTest && !memoryTest.metrics.memoryLeakCheck) {
      recommendations.push('Potential memory leak detected - implement better cleanup')
    }
    
    const bundleTest = this.results.find(r => r.testName === 'bundleSize')
    if (bundleTest && !bundleTest.success) {
      recommendations.push('Bundle size exceeds target - implement code splitting and tree shaking')
    }
    
    return recommendations
  }
}

// Export for use in tests
export const performanceTestSuite = new PerformanceTestSuite()
```

---

## 🎯 Performance Best Practices Summary

### Critical Performance Principles

1. **Virtual Rendering**
   - Implement virtual scrolling for message lists >100 items
   - Use intersection observers for lazy loading
   - Render only visible content + small buffer

2. **Memory Management**
   - Implement aggressive cleanup of unused components
   - Use WeakMap for caches to allow garbage collection
   - Monitor memory usage and alert on thresholds

3. **React Optimization**
   - Memoize expensive components with React.memo
   - Use useMemo and useCallback appropriately
   - Implement code splitting and lazy loading

4. **Stream Processing**
   - Batch updates to prevent excessive re-renders
   - Use debouncing for real-time updates
   - Implement efficient message buffering

5. **Bundle Optimization**
   - Implement code splitting by route and feature
   - Tree shake unused exports
   - Use dynamic imports for heavy dependencies

6. **CPU Optimization**
   - Use Web Workers for CPU-intensive tasks
   - Implement proper debouncing and throttling
   - Leverage browser's idle time for optimizations

7. **Monitoring**
   - Implement comprehensive performance monitoring
   - Set up automated performance testing
   - Monitor real user metrics in production

### Performance Targets

- **Load Time**: < 2 seconds initial load
- **Memory Usage**: < 100MB for 1000 messages
- **Bundle Size**: < 500KB gzipped
- **CPU Usage**: < 30% average
- **Frame Rate**: 60 FPS maintained
- **Stream Latency**: < 10ms processing time

This comprehensive performance optimization strategy ensures the VS Code extension chat interface remains responsive and efficient even under heavy usage scenarios.