# OpenCode TUI HTML Implementation Guide

## Executive Summary

This guide provides a comprehensive roadmap for implementing an HTML/web-based clone of the OpenCode Terminal User Interface (TUI) with complete functional parity. The OpenCode TUI is a sophisticated coding assistant interface built with Go using the Bubble Tea framework, featuring real-time chat, session management, theming, extensive keyboard shortcuts, and sophisticated tool call visualization.

The HTML implementation will replicate all core functionalities while leveraging modern web technologies to provide a seamless developer experience accessible through any web browser.

### Key Features to Implement
- **Real-time Chat Interface** with AI agent interaction
- **Tool Call Visualization** with streaming updates and syntax highlighting
- **File Operation Display** including diffs, syntax highlighting, and diagnostics
- **Todo Management** with interactive task lists and status tracking
- **Session Management** with creation, deletion, sharing, and navigation
- **Theme System** supporting 25+ themes with dynamic switching
- **Keyboard Navigation** matching TUI shortcuts and workflows
- **Modal Dialog System** for help, settings, and configurations
- **Performance Optimizations** including virtual scrolling and intelligent caching

## Project Architecture Overview

### Current TUI Architecture Analysis

The OpenCode TUI is structured as follows:

```
packages/tui/
├── cmd/opencode/main.go          # Application entry point
├── internal/
│   ├── app/                      # Core application logic
│   │   ├── app.go               # Main app state and operations
│   │   ├── state.go             # Persistent state management
│   │   └── prompt.go            # Prompt handling
│   ├── tui/                     # Main TUI controller
│   │   └── tui.go               # Event handling and view rendering
│   ├── components/              # UI components
│   │   ├── chat/                # Chat interface components
│   │   ├── dialog/              # Modal dialogs
│   │   ├── status/              # Status bar
│   │   └── toast/               # Toast notifications
│   ├── theme/                   # Theme management
│   ├── layout/                  # Layout utilities
│   └── styles/                  # Styling system
```

### Proposed HTML Architecture

```
opencode-web/
├── src/
│   ├── components/              # React/Vue components
│   │   ├── chat/               # Chat interface
│   │   ├── dialogs/            # Modal dialogs
│   │   ├── editor/             # Input editor
│   │   ├── status/             # Status bar
│   │   └── common/             # Shared components
│   ├── services/               # API and WebSocket services
│   │   ├── api.ts              # HTTP API client
│   │   ├── websocket.ts        # Real-time communication
│   │   └── auth.ts             # Authentication
│   ├── stores/                 # State management
│   │   ├── app.ts              # Application state
│   │   ├── session.ts          # Session management
│   │   ├── theme.ts            # Theme state
│   │   └── settings.ts         # User preferences
│   ├── utils/                  # Utility functions
│   │   ├── keymap.ts           # Keyboard handling
│   │   ├── formatting.ts       # Text formatting
│   │   └── validation.ts       # Input validation
│   ├── styles/                 # Styling system
│   │   ├── themes/             # Theme definitions
│   │   ├── components/         # Component styles
│   │   └── globals.css         # Global styles
│   └── types/                  # TypeScript definitions
└── public/                     # Static assets
```

## Technology Stack Recommendations

### Primary Framework Options

#### Option 1: React + TypeScript (Recommended)
- **React 18+** with Concurrent Features
- **TypeScript 5+** for type safety
- **Vite** for fast development and building
- **React Query (TanStack Query)** for API state management
- **Zustand** for client-side state management
- **Tailwind CSS** for utility-first styling

#### Option 2: Vue.js + TypeScript
- **Vue 3** with Composition API
- **TypeScript 5+**
- **Vite**
- **Pinia** for state management
- **Vue Query** for API state management

#### Option 3: SvelteKit
- **SvelteKit** for full-stack framework
- **TypeScript**
- **Threlte** for any 3D needs (future)

### Supporting Libraries

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "typescript": "^5.0.0",
    "@tanstack/react-query": "^4.0.0",
    "zustand": "^4.0.0",
    "tailwindcss": "^3.0.0",
    "framer-motion": "^10.0.0",
    "react-hot-toast": "^2.4.0",
    "react-textarea-autosize": "^8.4.0",
    "fuse.js": "^6.6.0",
    "highlight.js": "^11.8.0",
    "marked": "^5.0.0",
    "socket.io-client": "^4.7.0",
    "cmdk": "^0.2.0",
    "react-hotkeys-hook": "^4.4.0",
    "date-fns": "^2.30.0"
  },
  "devDependencies": {
    "vite": "^4.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "vitest": "^0.34.0",
    "@testing-library/react": "^13.4.0",
    "playwright": "^1.36.0",
    "storybook": "^7.0.0"
  }
}
```

## API Integration Requirements

### Core API Endpoints

Based on the server analysis, implement the following endpoints:

#### Session Management
```typescript
interface SessionAPI {
  // Session CRUD
  list(): Promise<Session[]>
  get(id: string): Promise<Session>
  create(parentId?: string, title?: string): Promise<Session>
  delete(id: string): Promise<boolean>
  update(id: string, updates: Partial<Session>): Promise<Session>
  
  // Session operations
  share(id: string): Promise<Session>
  unshare(id: string): Promise<Session>
  abort(id: string): Promise<boolean>
  
  // Message operations
  sendPrompt(sessionId: string, prompt: PromptInput): Promise<AssistantMessage>
  sendCommand(sessionId: string, command: CommandInput): Promise<AssistantMessage>
  sendShell(sessionId: string, shell: ShellInput): Promise<AssistantMessage>
  
  // Session utilities
  messages(sessionId: string): Promise<Message[]>
  revert(sessionId: string, messageId: string): Promise<Session>
  unrevert(sessionId: string): Promise<Session>
}
```

#### Real-time Communication
```typescript
interface EventAPI {
  // Server-Sent Events connection
  connect(): EventSource
  
  // Event types to handle
  handleMessage(event: MessageEvent): void
  handleSessionUpdate(event: SessionUpdateEvent): void
  handlePermissionRequest(event: PermissionEvent): void
  handleError(event: ErrorEvent): void
}
```

#### Configuration and Metadata
```typescript
interface ConfigAPI {
  getConfig(): Promise<Config>
  getProviders(): Promise<ProvidersResponse>
  getAgents(): Promise<Agent[]>
  getCommands(): Promise<Command[]>
}
```

#### File Operations
```typescript
interface FileAPI {
  list(path: string): Promise<FileNode[]>
  read(path: string): Promise<FileContent>
  search(pattern: string): Promise<SearchMatch[]>
  findFiles(query: string): Promise<string[]>
  findSymbols(query: string): Promise<Symbol[]>
}
```

### API Client Implementation

```typescript
// src/services/api.ts
export class OpenCodeAPI {
  private baseURL: string
  private directory: string
  
  constructor(baseURL: string, directory: string = process.cwd()) {
    this.baseURL = baseURL
    this.directory = directory
  }
  
  private async request<T>(
    endpoint: string, 
    options?: RequestInit
  ): Promise<T> {
    const url = new URL(endpoint, this.baseURL)
    url.searchParams.set('directory', this.directory)
    
    const response = await fetch(url.toString(), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`)
    }
    
    return response.json()
  }
  
  // Implement all API methods using this.request()
  sessions = {
    list: () => this.request<Session[]>('/session'),
    get: (id: string) => this.request<Session>(`/session/${id}`),
    create: (data?: { parentID?: string; title?: string }) =>
      this.request<Session>('/session', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    // ... other session methods
  }
  
  // ... other API groups
}
```

## Component Implementation Guide

### 1. Main Application Component

```typescript
// src/components/App.tsx
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ErrorBoundary } from './common/ErrorBoundary'
import { ThemeProvider } from './common/ThemeProvider'
import { KeyboardHandler } from './common/KeyboardHandler'
import { MainLayout } from './layout/MainLayout'
import { ToastProvider } from './common/ToastProvider'

const queryClient = new QueryClient()

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>
            <KeyboardHandler>
              <MainLayout />
            </KeyboardHandler>
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
```

### 2. Main Layout Component

```typescript
// src/components/layout/MainLayout.tsx
import React from 'react'
import { useAppStore } from '../../stores/app'
import { HomeView } from '../views/HomeView'
import { ChatView } from '../views/ChatView'
import { StatusBar } from '../status/StatusBar'
import { Modal } from '../common/Modal'
import { ToastContainer } from '../common/ToastContainer'

export function MainLayout() {
  const { currentSession, activeModal } = useAppStore()
  
  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <main className="flex-1 overflow-hidden">
        {currentSession ? <ChatView /> : <HomeView />}
      </main>
      
      <StatusBar />
      
      {activeModal && <Modal />}
      <ToastContainer />
    </div>
  )
}
```

### 3. Tool Call Implementation and Visualization

The OpenCode TUI features sophisticated tool call handling with real-time streaming, syntax highlighting, and interactive displays. This section covers the complete implementation of tool call visualization for the HTML version.

#### Tool Call Architecture

```typescript
// src/types/tools.ts
export interface ToolCall {
  id: string
  type: string  // 'read', 'write', 'edit', 'bash', 'todowrite', etc.
  parameters: Record<string, any>
  state: {
    status: 'pending' | 'running' | 'completed' | 'error'
    metadata?: Record<string, any>
    error?: string
  }
  title?: string
  output?: string
  createdAt: number
  updatedAt?: number
}

export interface MessagePart {
  id: string
  type: 'text' | 'tool'
  messageID: string
  content?: string
  toolCall?: ToolCall
}
```

#### Tool Call Component System

```typescript
// src/components/tools/ToolCallDisplay.tsx
import React from 'react'
import { ToolCall } from '../../types/tools'
import { FileReadTool } from './FileReadTool'
import { FileWriteTool } from './FileWriteTool'
import { FileEditTool } from './FileEditTool'
import { BashTool } from './BashTool'
import { TodoWriteTool } from './TodoWriteTool'
import { TaskTool } from './TaskTool'
import { useAppStore } from '../../stores/app'
import { cn } from '../../utils/cn'

interface ToolCallDisplayProps {
  toolCall: ToolCall
  width?: number
}

const TOOL_RENDERERS = {
  read: FileReadTool,
  write: FileWriteTool,  
  edit: FileEditTool,
  bash: BashTool,
  todowrite: TodoWriteTool,
  todoread: () => null, // Hidden in TUI
  task: TaskTool,
} as const

export function ToolCallDisplay({ toolCall, width }: ToolCallDisplayProps) {
  const { showToolDetails } = useAppStore()
  const ToolRenderer = TOOL_RENDERERS[toolCall.type as keyof typeof TOOL_RENDERERS]
  
  if (!ToolRenderer) {
    return <GenericToolDisplay toolCall={toolCall} />
  }

  const isStreaming = toolCall.state.status === 'pending' || toolCall.state.status === 'running'
  
  return (
    <div className={cn(
      "tool-call-container",
      "border rounded-lg my-2",
      {
        "border-border": toolCall.state.status === 'completed',
        "border-warning": toolCall.state.status === 'pending' || toolCall.state.status === 'running',
        "border-error": toolCall.state.status === 'error',
      }
    )}>
      <div className="tool-header p-2 border-b border-border">
        <div className={cn(
          "tool-title font-medium",
          {
            "animate-shimmer": isStreaming,
            "text-error": toolCall.state.status === 'error'
          }
        )}>
          {toolCall.title || `${toolCall.type} tool`}
        </div>
      </div>
      
      {showToolDetails ? (
        <div className="tool-body p-2">
          <ToolRenderer toolCall={toolCall} width={width} />
        </div>
      ) : (
        <div className="tool-summary p-2 text-sm text-muted">
          ∟ {getToolSummary(toolCall)}
        </div>
      )}
      
      {toolCall.state.error && (
        <div className="tool-error p-2 border-t border-error bg-error/10 text-error text-sm">
          {toolCall.state.error}
        </div>
      )}
    </div>
  )
}

function getToolSummary(toolCall: ToolCall): string {
  switch (toolCall.type) {
    case 'read':
      return `Read ${toolCall.parameters.filePath?.split('/').pop() || 'file'}`
    case 'write':
      return `Write ${toolCall.parameters.filePath?.split('/').pop() || 'file'}`
    case 'edit':
      return `Edit ${toolCall.parameters.filePath?.split('/').pop() || 'file'}`
    case 'bash':
      return `$ ${toolCall.parameters.command}`
    case 'todowrite':
      return `Todo list (${toolCall.parameters.todos?.length || 0} items)`
    default:
      return toolCall.type
  }
}
```

#### File Operation Tool Renderers

```typescript
// src/components/tools/FileReadTool.tsx
import React from 'react'
import { ToolCall } from '../../types/tools'
import { CodeBlock } from '../common/CodeBlock'
import { getFileExtension } from '../../utils/file'

interface FileReadToolProps {
  toolCall: ToolCall
  width?: number
}

export function FileReadTool({ toolCall }: FileReadToolProps) {
  const { filePath } = toolCall.parameters
  const { preview } = toolCall.state.metadata || {}
  
  if (!preview) {
    return <div className="text-muted">Reading file...</div>
  }
  
  const extension = getFileExtension(filePath)
  const language = getLanguageFromExtension(extension)
  
  return (
    <div className="file-read-tool">
      <div className="file-path text-sm text-muted mb-2">{filePath}</div>
      <CodeBlock
        code={preview}
        language={language}
        maxLines={6}
        showLineNumbers
      />
    </div>
  )
}

// src/components/tools/FileWriteTool.tsx
export function FileWriteTool({ toolCall }: FileReadToolProps) {
  const { filePath, content } = toolCall.parameters
  const { preview, diagnostics } = toolCall.state.metadata || {}
  
  const extension = getFileExtension(filePath)
  const language = getLanguageFromExtension(extension)
  
  return (
    <div className="file-write-tool">
      <div className="file-path text-sm text-muted mb-2">{filePath}</div>
      <CodeBlock
        code={preview || content}
        language={language}
        maxLines={6}
        showLineNumbers
      />
      
      {diagnostics && diagnostics.length > 0 && (
        <div className="diagnostics mt-2 p-2 bg-warning/10 border border-warning rounded">
          <div className="font-medium text-warning mb-1">File Diagnostics:</div>
          {diagnostics.map((diagnostic: any, i: number) => (
            <div key={i} className="text-sm">
              Line {diagnostic.line}: {diagnostic.message}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// src/components/tools/FileEditTool.tsx
import { DiffViewer } from '../common/DiffViewer'

export function FileEditTool({ toolCall }: FileReadToolProps) {
  const { filePath } = toolCall.parameters
  const { diff, oldContent, newContent, replacements } = toolCall.state.metadata || {}
  
  if (!diff) {
    return <div className="text-muted">Applying changes...</div>
  }
  
  return (
    <div className="file-edit-tool">
      <div className="file-path text-sm text-muted mb-2">
        {filePath} ({replacements} replacement{replacements !== 1 ? 's' : ''})
      </div>
      <DiffViewer
        oldContent={oldContent}
        newContent={newContent}
        filename={filePath}
        unified={true}
      />
    </div>
  )
}
```

#### Bash Tool with Streaming Output

```typescript
// src/components/tools/BashTool.tsx
import React, { useEffect, useState } from 'react'
import { ToolCall } from '../../types/tools'
import { Terminal } from '../common/Terminal'

export function BashTool({ toolCall }: { toolCall: ToolCall }) {
  const { command, description } = toolCall.parameters
  const { output } = toolCall.state.metadata || {}
  const [displayOutput, setDisplayOutput] = useState('')
  
  // Simulate streaming output for completed commands
  useEffect(() => {
    if (output && toolCall.state.status === 'completed') {
      setDisplayOutput(output)
    } else if (output && toolCall.state.status === 'running') {
      // Stream output character by character for effect
      let currentIndex = 0
      const interval = setInterval(() => {
        if (currentIndex < output.length) {
          setDisplayOutput(output.slice(0, currentIndex + 1))
          currentIndex++
        } else {
          clearInterval(interval)
        }
      }, 10)
      
      return () => clearInterval(interval)
    }
  }, [output, toolCall.state.status])
  
  return (
    <div className="bash-tool">
      {description && (
        <div className="description text-sm text-muted mb-2">{description}</div>
      )}
      
      <Terminal>
        <div className="command-line">
          <span className="prompt text-primary">$</span>
          <span className="ml-2">{command}</span>
        </div>
        
        {displayOutput && (
          <div className="output mt-1 whitespace-pre-wrap font-mono text-sm">
            {displayOutput}
          </div>
        )}
        
        {toolCall.state.status === 'running' && (
          <div className="cursor animate-pulse">█</div>
        )}
      </Terminal>
    </div>
  )
}
```

#### Todo Management Tool

```typescript
// src/components/tools/TodoWriteTool.tsx
import React from 'react'
import { ToolCall } from '../../types/tools'
import { CheckCircle, Circle, X } from 'lucide-react'
import { cn } from '../../utils/cn'

interface TodoItem {
  content: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  id: string
}

export function TodoWriteTool({ toolCall }: { toolCall: ToolCall }) {
  const { todos } = toolCall.parameters as { todos: TodoItem[] }
  const { phase, changes } = toolCall.state.metadata || {}
  
  if (!todos || todos.length === 0) {
    return <div className="text-muted">No todos to display</div>
  }
  
  return (
    <div className="todo-write-tool">
      {phase && (
        <div className="phase text-sm font-medium mb-2">{phase}</div>
      )}
      
      <div className="todo-list space-y-1">
        {todos.map((todo, index) => (
          <div key={todo.id || index} className="todo-item flex items-start gap-2">
            <div className="todo-checkbox mt-0.5">
              {todo.status === 'completed' ? (
                <CheckCircle className="w-4 h-4 text-success" />
              ) : todo.status === 'cancelled' ? (
                <X className="w-4 h-4 text-error" />
              ) : (
                <Circle className="w-4 h-4 text-muted" />
              )}
            </div>
            
            <div className={cn(
              "todo-content text-sm flex-1",
              {
                "line-through text-muted": todo.status === 'cancelled',
                "font-mono bg-muted/20 px-1 rounded": todo.status === 'in_progress',
                "text-success": todo.status === 'completed',
              }
            )}>
              {todo.content}
            </div>
          </div>
        ))}
      </div>
      
      {changes && changes.length > 0 && (
        <div className="changes mt-2 text-xs text-muted">
          {changes.join(', ')}
        </div>
      )}
    </div>
  )
}
```

#### Animation and Streaming Effects

```css
/* src/styles/animations.css */

/* Shimmer animation for pending/running tools */
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.animate-shimmer {
  background: linear-gradient(
    90deg,
    transparent,
    rgba(var(--foreground) / 0.1),
    transparent
  );
  background-size: 200% 100%;
  animation: shimmer 2.5s infinite;
}

/* Typewriter effect for streaming output */
@keyframes typewriter {
  from {
    width: 0;
  }
  to {
    width: 100%;
  }
}

.typewriter {
  overflow: hidden;
  white-space: nowrap;
  animation: typewriter 1s steps(40, end);
}

/* Cursor blink animation */
@keyframes blink {
  0%, 50% {
    opacity: 1;
  }
  51%, 100% {
    opacity: 0;
  }
}

.cursor-blink {
  animation: blink 1s infinite;
}

/* Tool state transitions */
.tool-call-container {
  transition: all 0.2s ease-in-out;
}

.tool-call-container.error {
  animation: shake 0.5s ease-in-out;
}

@keyframes shake {
  0%, 100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-4px);
  }
  75% {
    transform: translateX(4px);
  }
}
```

#### Tool Call State Management

```typescript
// src/stores/toolStore.ts
import { create } from 'zustand'
import { ToolCall } from '../types/tools'

interface ToolStore {
  tools: Record<string, ToolCall>
  showToolDetails: boolean
  
  updateTool: (id: string, update: Partial<ToolCall>) => void
  setToolStatus: (id: string, status: ToolCall['state']['status']) => void
  setToolMetadata: (id: string, metadata: Record<string, any>) => void
  setToolError: (id: string, error: string) => void
  toggleToolDetails: () => void
  
  // Animation state
  hasAnimatingTools: () => boolean
}

export const useToolStore = create<ToolStore>((set, get) => ({
  tools: {},
  showToolDetails: true,
  
  updateTool: (id, update) =>
    set((state) => ({
      tools: {
        ...state.tools,
        [id]: { ...state.tools[id], ...update, updatedAt: Date.now() }
      }
    })),
  
  setToolStatus: (id, status) =>
    set((state) => ({
      tools: {
        ...state.tools,
        [id]: {
          ...state.tools[id],
          state: { ...state.tools[id].state, status },
          updatedAt: Date.now()
        }
      }
    })),
  
  setToolMetadata: (id, metadata) =>
    set((state) => ({
      tools: {
        ...state.tools,
        [id]: {
          ...state.tools[id],
          state: { ...state.tools[id].state, metadata },
          updatedAt: Date.now()
        }
      }
    })),
  
  setToolError: (id, error) =>
    set((state) => ({
      tools: {
        ...state.tools,
        [id]: {
          ...state.tools[id],
          state: { ...state.tools[id].state, status: 'error', error },
          updatedAt: Date.now()
        }
      }
    })),
  
  toggleToolDetails: () =>
    set((state) => ({ showToolDetails: !state.showToolDetails })),
  
  hasAnimatingTools: () => {
    const { tools } = get()
    return Object.values(tools).some(
      tool => tool.state.status === 'pending' || tool.state.status === 'running'
    )
  }
}))
```

#### Real-time Tool Updates via WebSocket

```typescript
// src/services/toolEventHandler.ts
import { useToolStore } from '../stores/toolStore'
import { EventService } from './eventService'

export class ToolEventHandler {
  constructor(private eventService: EventService) {
    this.setupEventListeners()
  }
  
  private setupEventListeners() {
    // Tool part updates (status, metadata changes)
    this.eventService.on('message.part.updated', (event) => {
      if (event.part.type === 'tool') {
        const toolCall = event.part.toolCall
        if (toolCall) {
          useToolStore.getState().updateTool(toolCall.id, toolCall)
        }
      }
    })
    
    // Tool execution started
    this.eventService.on('tool.execution.started', (event) => {
      useToolStore.getState().setToolStatus(event.toolId, 'running')
    })
    
    // Tool execution completed
    this.eventService.on('tool.execution.completed', (event) => {
      useToolStore.getState().updateTool(event.toolId, {
        state: {
          status: 'completed',
          metadata: event.metadata
        },
        output: event.output
      })
    })
    
    // Tool execution failed
    this.eventService.on('tool.execution.error', (event) => {
      useToolStore.getState().setToolError(event.toolId, event.error)
    })
    
    // Streaming metadata updates (especially for bash tool)
    this.eventService.on('tool.metadata.updated', (event) => {
      useToolStore.getState().setToolMetadata(event.toolId, event.metadata)
    })
  }
}
```

### 4. Chat Interface Components

#### Messages Component
```typescript
// src/components/chat/Messages.tsx
import React, { useEffect, useRef } from 'react'
import { useSessionStore } from '../../stores/session'
import { MessageItem } from './MessageItem'
import { VirtualizedList } from '../common/VirtualizedList'

export function Messages() {
  const { messages, isLoading } = useSessionStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])
  
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <VirtualizedList
        items={messages}
        renderItem={({ item, index }) => (
          <MessageItem 
            key={item.id} 
            message={item} 
            index={index}
          />
        )}
        estimatedHeight={100}
      />
      <div ref={messagesEndRef} />
    </div>
  )
}
```

#### Editor Component
```typescript
// src/components/chat/Editor.tsx
import React, { useState, useRef, useEffect } from 'react'
import TextareaAutosize from 'react-textarea-autosize'
import { useSessionStore } from '../../stores/session'
import { useKeymap } from '../../hooks/useKeymap'
import { CompletionDialog } from './CompletionDialog'

export function Editor() {
  const [value, setValue] = useState('')
  const [showCompletions, setShowCompletions] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { sendMessage, isLoading } = useSessionStore()
  
  const keymap = useKeymap({
    'Enter': (e) => {
      if (!e.shiftKey && !e.ctrlKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    'Escape': () => {
      setValue('')
      setShowCompletions(false)
    },
    '/': () => {
      if (value === '') {
        setShowCompletions(true)
      }
    },
  })
  
  const handleSubmit = async () => {
    if (!value.trim()) return
    
    await sendMessage(value)
    setValue('')
    setShowCompletions(false)
  }
  
  return (
    <div className="relative border-t border-border p-4">
      <TextareaAutosize
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={keymap}
        placeholder="Type your message..."
        className="w-full resize-none rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        minRows={1}
        maxRows={10}
        disabled={isLoading}
      />
      
      {showCompletions && (
        <CompletionDialog
          value={value}
          onSelect={(completion) => {
            setValue(completion)
            setShowCompletions(false)
          }}
          onClose={() => setShowCompletions(false)}
        />
      )}
    </div>
  )
}
```

### 4. Theme System Components

```typescript
// src/components/common/ThemeProvider.tsx
import React, { createContext, useContext, useEffect } from 'react'
import { useThemeStore } from '../../stores/theme'
import { themes } from '../../styles/themes'

const ThemeContext = createContext<{
  theme: string
  setTheme: (theme: string) => void
} | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { currentTheme, setTheme } = useThemeStore()
  
  useEffect(() => {
    const theme = themes[currentTheme]
    if (theme) {
      // Apply CSS variables to document root
      const root = document.documentElement
      Object.entries(theme.colors).forEach(([key, value]) => {
        root.style.setProperty(`--color-${key}`, value)
      })
    }
  }, [currentTheme])
  
  return (
    <ThemeContext.Provider value={{ theme: currentTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}
```

### 5. Modal Dialog System

```typescript
// src/components/dialogs/BaseDialog.tsx
import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useKeymap } from '../../hooks/useKeymap'

interface BaseDialogProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  className?: string
}

export function BaseDialog({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  className = '' 
}: BaseDialogProps) {
  const keymap = useKeymap({
    'Escape': onClose,
  })
  
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className={`bg-background border border-border rounded-lg shadow-lg max-w-2xl w-full max-h-[80vh] overflow-hidden ${className}`}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={keymap}
          >
            <div className="flex items-center justify-between border-b border-border p-4">
              <h2 className="text-lg font-semibold">{title}</h2>
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

## State Management Implementation

### Application State Store

```typescript
// src/stores/app.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AppState {
  // Current session
  currentSession: Session | null
  
  // UI state
  activeModal: string | null
  showCompletions: boolean
  isLoading: boolean
  
  // User preferences
  preferences: {
    keybindings: Record<string, string>
    scrollSpeed: number
    toolDetailsVisible: boolean
    thinkingBlocksVisible: boolean
  }
  
  // Actions
  setCurrentSession: (session: Session | null) => void
  setActiveModal: (modal: string | null) => void
  setShowCompletions: (show: boolean) => void
  setLoading: (loading: boolean) => void
  updatePreferences: (prefs: Partial<AppState['preferences']>) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentSession: null,
      activeModal: null,
      showCompletions: false,
      isLoading: false,
      preferences: {
        keybindings: {},
        scrollSpeed: 3,
        toolDetailsVisible: false,
        thinkingBlocksVisible: false,
      },
      
      setCurrentSession: (session) => set({ currentSession: session }),
      setActiveModal: (modal) => set({ activeModal: modal }),
      setShowCompletions: (show) => set({ showCompletions: show }),
      setLoading: (loading) => set({ isLoading: loading }),
      updatePreferences: (prefs) => 
        set((state) => ({
          preferences: { ...state.preferences, ...prefs }
        })),
    }),
    {
      name: 'opencode-app-state',
      partialize: (state) => ({
        preferences: state.preferences,
      }),
    }
  )
)
```

### Session State Store

```typescript
// src/stores/session.ts
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { api } from '../services/api'

interface SessionState {
  sessions: Session[]
  messages: Message[]
  isLoading: boolean
  error: string | null
  
  // Actions
  loadSessions: () => Promise<void>
  loadMessages: (sessionId: string) => Promise<void>
  createSession: (parentId?: string, title?: string) => Promise<Session>
  deleteSession: (sessionId: string) => Promise<void>
  sendMessage: (content: string) => Promise<void>
  abortSession: (sessionId: string) => Promise<void>
  
  // Real-time updates
  addMessage: (message: Message) => void
  updateMessage: (messageId: string, updates: Partial<Message>) => void
  removeMessage: (messageId: string) => void
}

export const useSessionStore = create<SessionState>()(
  immer((set, get) => ({
    sessions: [],
    messages: [],
    isLoading: false,
    error: null,
    
    loadSessions: async () => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      
      try {
        const sessions = await api.sessions.list()
        set((state) => {
          state.sessions = sessions
          state.isLoading = false
        })
      } catch (error) {
        set((state) => {
          state.error = error.message
          state.isLoading = false
        })
      }
    },
    
    loadMessages: async (sessionId: string) => {
      set((state) => {
        state.isLoading = true
        state.error = null
      })
      
      try {
        const messages = await api.sessions.messages(sessionId)
        set((state) => {
          state.messages = messages
          state.isLoading = false
        })
      } catch (error) {
        set((state) => {
          state.error = error.message
          state.isLoading = false
        })
      }
    },
    
    sendMessage: async (content: string) => {
      const { currentSession } = useAppStore.getState()
      if (!currentSession) return
      
      try {
        await api.sessions.sendPrompt(currentSession.id, {
          messageID: generateId(),
          parts: [{ type: 'text', text: content }],
        })
      } catch (error) {
        set((state) => {
          state.error = error.message
        })
      }
    },
    
    addMessage: (message: Message) => {
      set((state) => {
        state.messages.push(message)
      })
    },
    
    updateMessage: (messageId: string, updates: Partial<Message>) => {
      set((state) => {
        const index = state.messages.findIndex(m => m.id === messageId)
        if (index !== -1) {
          Object.assign(state.messages[index], updates)
        }
      })
    },
    
    removeMessage: (messageId: string) => {
      set((state) => {
        state.messages = state.messages.filter(m => m.id !== messageId)
      })
    },
  }))
)
```

## Real-time Communication Setup

### WebSocket/SSE Implementation

```typescript
// src/services/websocket.ts
import { useSessionStore } from '../stores/session'
import { useAppStore } from '../stores/app'

export class EventService {
  private eventSource: EventSource | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  
  connect(baseURL: string, directory: string) {
    const url = new URL('/event', baseURL)
    url.searchParams.set('directory', directory)
    
    this.eventSource = new EventSource(url.toString())
    
    this.eventSource.onopen = () => {
      console.log('Event stream connected')
      this.reconnectAttempts = 0
    }
    
    this.eventSource.onmessage = (event) => {
      this.handleEvent(JSON.parse(event.data))
    }
    
    this.eventSource.onerror = () => {
      console.error('Event stream error')
      this.reconnect()
    }
  }
  
  private handleEvent(event: any) {
    const { type, properties } = event
    const sessionStore = useSessionStore.getState()
    const appStore = useAppStore.getState()
    
    switch (type) {
      case 'message.updated':
        sessionStore.updateMessage(properties.info.id, {
          ...properties.info,
          parts: properties.parts,
        })
        break
        
      case 'message.part.updated':
        // Handle streaming message parts
        this.handlePartUpdate(properties)
        break
        
      case 'session.updated':
        if (appStore.currentSession?.id === properties.info.id) {
          appStore.setCurrentSession(properties.info)
        }
        break
        
      case 'permission.updated':
        // Handle permission requests
        this.handlePermissionRequest(properties)
        break
        
      case 'session.error':
        // Handle session errors
        this.handleSessionError(properties.error)
        break
        
      default:
        console.log('Unknown event type:', type)
    }
  }
  
  private reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      const delay = Math.pow(2, this.reconnectAttempts) * 1000
      
      setTimeout(() => {
        console.log(`Reconnecting... (attempt ${this.reconnectAttempts})`)
        this.connect()
      }, delay)
    }
  }
  
  disconnect() {
    this.eventSource?.close()
    this.eventSource = null
  }
}

// React hook for using the event service
export function useEventService() {
  const eventService = useRef(new EventService())
  
  useEffect(() => {
    const service = eventService.current
    service.connect(API_BASE_URL, process.cwd())
    
    return () => service.disconnect()
  }, [])
  
  return eventService.current
}
```

### Streaming Message Handling

```typescript
// src/utils/streaming.ts
export class StreamingMessageHandler {
  private messageBuffer = new Map<string, {
    content: string
    timestamp: number
  }>()
  
  handlePartUpdate(part: MessagePart) {
    const messageId = part.messageID
    
    if (part.type === 'text') {
      const current = this.messageBuffer.get(messageId) || { content: '', timestamp: Date.now() }
      current.content += part.text
      current.timestamp = Date.now()
      this.messageBuffer.set(messageId, current)
      
      // Debounced update to prevent excessive re-renders
      this.debouncedUpdate(messageId)
    }
  }
  
  private debouncedUpdate = debounce((messageId: string) => {
    const buffer = this.messageBuffer.get(messageId)
    if (buffer) {
      useSessionStore.getState().updateMessage(messageId, {
        content: buffer.content,
        updatedAt: buffer.timestamp,
      })
    }
  }, 100)
}

function debounce<T extends (...args: any[]) => void>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout
  return ((...args: any[]) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }) as T
}
```

## Styling and Theming System

### Theme Structure

```typescript
// src/styles/themes/index.ts
export interface Theme {
  name: string
  colors: {
    background: string
    foreground: string
    primary: string
    secondary: string
    accent: string
    muted: string
    border: string
    input: string
    ring: string
    // Message-specific colors
    userMessage: string
    assistantMessage: string
    systemMessage: string
    // Status colors
    success: string
    warning: string
    error: string
    info: string
  }
  typography: {
    fontFamily: string
    fontSize: {
      xs: string
      sm: string
      base: string
      lg: string
      xl: string
    }
    lineHeight: {
      tight: string
      normal: string
      relaxed: string
    }
  }
  spacing: {
    xs: string
    sm: string
    md: string
    lg: string
    xl: string
  }
  borderRadius: {
    sm: string
    md: string
    lg: string
  }
}

export const themes: Record<string, Theme> = {
  dark: {
    name: 'Dark',
    colors: {
      background: '#0f0f0f',
      foreground: '#fafafa',
      primary: '#f97316',
      secondary: '#64748b',
      accent: '#3b82f6',
      muted: '#71717a',
      border: '#27272a',
      input: '#18181b',
      ring: '#3b82f6',
      userMessage: '#1e40af',
      assistantMessage: '#166534',
      systemMessage: '#7c2d12',
      success: '#16a34a',
      warning: '#eab308',
      error: '#dc2626',
      info: '#0ea5e9',
    },
    // ... typography, spacing, borderRadius
  },
  
  light: {
    name: 'Light',
    colors: {
      background: '#ffffff',
      foreground: '#0f0f0f',
      // ... other colors
    },
    // ... typography, spacing, borderRadius
  },
  
  // Additional themes can be loaded dynamically
}
```

### CSS Variables Integration

```css
/* src/styles/globals.css */
:root {
  /* Theme colors will be injected by ThemeProvider */
  --color-background: #0f0f0f;
  --color-foreground: #fafafa;
  /* ... other color variables */
}

/* Component styles using theme variables */
.message {
  @apply bg-background text-foreground border-border;
}

.message--user {
  background-color: var(--color-userMessage);
}

.message--assistant {
  background-color: var(--color-assistantMessage);
}

/* Responsive design */
@media (max-width: 768px) {
  .layout {
    @apply flex-col;
  }
}

/* Dark mode specific adjustments */
@media (prefers-color-scheme: dark) {
  .scrollbar {
    scrollbar-color: var(--color-muted) var(--color-background);
  }
}
```

### Tailwind Configuration

```javascript
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        foreground: 'var(--color-foreground)',
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        accent: 'var(--color-accent)',
        muted: 'var(--color-muted)',
        border: 'var(--color-border)',
        input: 'var(--color-input)',
        ring: 'var(--color-ring)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.2s ease-in-out',
        'pulse-slow': 'pulse 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('tailwind-scrollbar'),
  ],
}
```

## Performance Considerations

### Optimization Strategies

#### 1. Virtual Scrolling for Large Message Lists
```typescript
// src/components/common/VirtualizedList.tsx
import React, { useMemo } from 'react'
import { FixedSizeList as List } from 'react-window'

interface VirtualizedListProps<T> {
  items: T[]
  renderItem: ({ item, index }: { item: T; index: number }) => React.ReactNode
  estimatedHeight: number
  height?: number
}

export function VirtualizedList<T>({ 
  items, 
  renderItem, 
  estimatedHeight,
  height = 600 
}: VirtualizedListProps<T>) {
  const Row = useMemo(() => 
    ({ index, style }: { index: number; style: React.CSSProperties }) => (
      <div style={style}>
        {renderItem({ item: items[index], index })}
      </div>
    ), [items, renderItem]
  )
  
  return (
    <List
      height={height}
      itemCount={items.length}
      itemSize={estimatedHeight}
      overscanCount={5}
    >
      {Row}
    </List>
  )
}
```

#### 2. Message Caching and Memoization
```typescript
// src/hooks/useMessageCache.ts
import { useMemo } from 'react'
import { LRUCache } from 'lru-cache'

const messageCache = new LRUCache<string, RenderedMessage>({
  max: 1000,
  ttl: 1000 * 60 * 10, // 10 minutes
})

export function useMessageCache(messages: Message[]) {
  return useMemo(() => {
    return messages.map(message => {
      const cacheKey = `${message.id}-${message.updatedAt}`
      let cached = messageCache.get(cacheKey)
      
      if (!cached) {
        cached = {
          ...message,
          renderedContent: renderMessageContent(message),
          renderedTimestamp: formatTimestamp(message.timestamp),
        }
        messageCache.set(cacheKey, cached)
      }
      
      return cached
    })
  }, [messages])
}
```

#### 3. Code Splitting and Lazy Loading
```typescript
// src/components/lazy/index.ts
import { lazy } from 'react'

// Lazy load heavy components
export const SessionDialog = lazy(() => import('../dialogs/SessionDialog'))
export const ThemeDialog = lazy(() => import('../dialogs/ThemeDialog'))
export const ModelDialog = lazy(() => import('../dialogs/ModelDialog'))
export const TimelineDialog = lazy(() => import('../dialogs/TimelineDialog'))

// Preload critical components
export const preloadDialogs = () => {
  import('../dialogs/SessionDialog')
  import('../dialogs/ThemeDialog')
}
```

#### 4. Debounced API Calls
```typescript
// src/hooks/useDebounced.ts
import { useEffect, useState } from 'react'

export function useDebounced<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Usage in search components
export function useSearch(query: string) {
  const debouncedQuery = useDebounced(query, 300)
  
  return useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => api.search(debouncedQuery),
    enabled: debouncedQuery.length > 2,
  })
}
```

## Testing Strategy

### Unit Testing Setup

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock API
vi.mock('../services/api', () => ({
  api: {
    sessions: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
    },
  },
}))

// Mock WebSocket
global.EventSource = vi.fn(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  close: vi.fn(),
}))
```

### Component Testing

```typescript
// src/components/chat/__tests__/Editor.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Editor } from '../Editor'
import { TestWrapper } from '../../../test/TestWrapper'

describe('Editor', () => {
  it('submits message on Enter key', async () => {
    const user = userEvent.setup()
    const mockSendMessage = vi.fn()
    
    render(
      <TestWrapper mockSendMessage={mockSendMessage}>
        <Editor />
      </TestWrapper>
    )
    
    const textarea = screen.getByPlaceholderText('Type your message...')
    await user.type(textarea, 'Hello world')
    await user.keyboard('{Enter}')
    
    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith('Hello world')
    })
  })
  
  it('shows completions on "/" trigger', async () => {
    const user = userEvent.setup()
    
    render(
      <TestWrapper>
        <Editor />
      </TestWrapper>
    )
    
    const textarea = screen.getByPlaceholderText('Type your message...')
    await user.type(textarea, '/')
    
    expect(screen.getByRole('dialog', { name: /completions/i })).toBeInTheDocument()
  })
})
```

### Integration Testing

```typescript
// src/test/integration/chat.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../../components/App'
import { mockApiResponses } from '../mocks/api'

describe('Chat Integration', () => {
  beforeEach(() => {
    mockApiResponses()
  })
  
  it('creates session and sends message', async () => {
    const user = userEvent.setup()
    
    render(<App />)
    
    // Start new session
    await user.click(screen.getByText('New Session'))
    
    // Send message
    const editor = screen.getByPlaceholderText('Type your message...')
    await user.type(editor, 'Hello AI')
    await user.keyboard('{Enter}')
    
    // Verify message appears
    await screen.findByText('Hello AI')
    expect(screen.getByText('Hello AI')).toBeInTheDocument()
  })
})
```

### E2E Testing with Playwright

```typescript
// tests/e2e/chat.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Chat Interface', () => {
  test('can create session and send message', async ({ page }) => {
    await page.goto('/')
    
    // Should show home screen initially
    await expect(page.getByText('super')).toBeVisible()
    
    // Create new session
    await page.keyboard.press('s')
    await expect(page.getByRole('dialog')).toBeVisible()
    
    // Select first session option and create
    await page.keyboard.press('Enter')
    
    // Should now be in chat view
    await expect(page.getByPlaceholder('Type your message...')).toBeVisible()
    
    // Send a message
    await page.fill('[placeholder="Type your message..."]', 'Hello world')
    await page.keyboard.press('Enter')
    
    // Message should appear
    await expect(page.getByText('Hello world')).toBeVisible()
  })
  
  test('keyboard shortcuts work correctly', async ({ page }) => {
    await page.goto('/')
    
    // Test help dialog
    await page.keyboard.press('?')
    await expect(page.getByRole('dialog')).toBeVisible()
    
    // Close with escape
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })
})
```

## Security Considerations

### Authentication and Authorization

```typescript
// src/services/auth.ts
import { jwtDecode } from 'jwt-decode'

export class AuthService {
  private token: string | null = null
  
  async login(credentials: LoginCredentials): Promise<AuthResult> {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    })
    
    if (!response.ok) {
      throw new Error('Authentication failed')
    }
    
    const { token, user } = await response.json()
    this.setToken(token)
    
    return { token, user }
  }
  
  setToken(token: string) {
    this.token = token
    localStorage.setItem('auth_token', token)
  }
  
  getToken(): string | null {
    return this.token || localStorage.getItem('auth_token')
  }
  
  isTokenValid(): boolean {
    const token = this.getToken()
    if (!token) return false
    
    try {
      const decoded = jwtDecode(token)
      return decoded.exp! * 1000 > Date.now()
    } catch {
      return false
    }
  }
  
  logout() {
    this.token = null
    localStorage.removeItem('auth_token')
  }
}
```

### Input Sanitization

```typescript
// src/utils/sanitization.ts
import DOMPurify from 'dompurify'

export function sanitizeInput(input: string): string {
  // Remove potentially dangerous characters
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim()
}

export function sanitizeHTML(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'pre', 'blockquote'],
    ALLOWED_ATTR: ['class'],
  })
}

export function validateMessageContent(content: string): boolean {
  // Check content length
  if (content.length > 10000) {
    throw new Error('Message too long')
  }
  
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /data:text\/html/i,
    /vbscript:/i,
  ]
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(content)) {
      throw new Error('Potentially dangerous content detected')
    }
  }
  
  return true
}
```

### CSP Headers and Security

```typescript
// src/utils/security.ts
export const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", "data:", "https:"],
  'font-src': ["'self'", "https://fonts.gstatic.com"],
  'connect-src': ["'self'", "ws:", "wss:"],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
}

// Rate limiting for API calls
export class RateLimiter {
  private calls: Map<string, number[]> = new Map()
  
  canMakeRequest(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now()
    const windowStart = now - windowMs
    
    const calls = this.calls.get(key) || []
    const recentCalls = calls.filter(time => time > windowStart)
    
    if (recentCalls.length >= limit) {
      return false
    }
    
    recentCalls.push(now)
    this.calls.set(key, recentCalls)
    return true
  }
}
```

## Deployment Considerations

### Production Build Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'es2020',
    minify: 'terser',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@tanstack/react-query', 'zustand', 'framer-motion'],
          utils: ['date-fns', 'lodash-es'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
```

### Docker Configuration

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

FROM nginx:alpine AS production

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

```nginx
# nginx.conf
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    server {
        listen 80;
        server_name localhost;
        
        root /usr/share/nginx/html;
        index index.html;
        
        location / {
            try_files $uri $uri/ /index.html;
        }
        
        location /api {
            proxy_pass http://backend:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
        
        location /event {
            proxy_pass http://backend:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header Cache-Control no-cache;
            proxy_buffering off;
        }
    }
}
```

### Environment Configuration

```typescript
// src/config/environment.ts
export const config = {
  apiBaseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  wsBaseURL: import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:3000',
  environment: import.meta.env.VITE_ENVIRONMENT || 'development',
  enableDevTools: import.meta.env.DEV,
  version: import.meta.env.VITE_APP_VERSION || '1.0.0',
  sentry: {
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_ENVIRONMENT,
  },
}

// Validate required environment variables
const requiredVars = ['VITE_API_BASE_URL']
for (const varName of requiredVars) {
  if (!import.meta.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`)
  }
}
```

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- [ ] Project setup with Vite + React + TypeScript
- [ ] Basic component structure
- [ ] API client implementation
- [ ] Core state management with Zustand
- [ ] Theme system foundation
- [ ] Basic routing and layout

### Phase 2: Core UI Components (Weeks 3-4)
- [ ] Home view with logo and commands
- [ ] Basic chat interface (messages + editor)
- [ ] Message rendering with markdown support
- [ ] Status bar component
- [ ] Toast notification system
- [ ] Basic modal dialogs

### Phase 3: Real-time Communication (Weeks 5-6)
- [ ] WebSocket/SSE integration
- [ ] Streaming message handling
- [ ] Real-time session updates
- [ ] Permission request handling
- [ ] Error handling and reconnection

### Phase 4: Advanced Features (Weeks 7-8)
- [ ] Session management (create, delete, share)
- [ ] Command completion system
- [ ] File and symbol search
- [ ] Keyboard shortcuts
- [ ] Theme switching
- [ ] Model and provider selection

### Phase 5: Performance & Polish (Weeks 9-10)
- [ ] Virtual scrolling for messages
- [ ] Message caching and optimization
- [ ] Responsive design improvements
- [ ] Accessibility enhancements
- [ ] Loading states and animations
- [ ] Error boundaries and fallbacks

### Phase 6: Testing & Deployment (Weeks 11-12)
- [ ] Comprehensive unit tests
- [ ] Integration tests
- [ ] E2E tests with Playwright
- [ ] Performance testing
- [ ] Security audit
- [ ] Production deployment setup
- [ ] Documentation and user guides

### Phase 7: Advanced Integrations (Weeks 13-14)
- [ ] Advanced agent features
- [ ] Tool details and thinking blocks
- [ ] Session timeline and navigation
- [ ] Export functionality
- [ ] MCP extension support
- [ ] Custom command support

## Appendices

### A. Key Mappings Reference

```typescript
// src/config/keymaps.ts
export const defaultKeymaps = {
  // Global shortcuts
  'ctrl+/': 'app.help',
  'ctrl+n': 'session.new',
  'ctrl+o': 'session.list',
  'ctrl+shift+p': 'commands.palette',
  'ctrl+,': 'settings.open',
  
  // Session shortcuts
  'ctrl+k': 'session.clear',
  'ctrl+r': 'session.reload',
  'ctrl+shift+c': 'session.copy',
  'ctrl+shift+s': 'session.share',
  
  // Editor shortcuts
  'enter': 'editor.submit',
  'shift+enter': 'editor.newline',
  'ctrl+a': 'editor.selectAll',
  'escape': 'editor.clear',
  
  // Navigation shortcuts
  'j': 'messages.scrollDown',
  'k': 'messages.scrollUp',
  'g g': 'messages.goToTop',
  'shift+g': 'messages.goToBottom',
  
  // Modal shortcuts
  'escape': 'modal.close',
  'tab': 'modal.nextItem',
  'shift+tab': 'modal.prevItem',
}
```

### B. API Response Types

```typescript
// src/types/api.ts
export interface Session {
  id: string
  title: string
  parentID?: string
  createdAt: number
  updatedAt: number
  share: {
    url: string
  }
}

export interface Message {
  id: string
  sessionID: string
  type: 'user' | 'assistant'
  content: string
  parts: MessagePart[]
  timestamp: number
  updatedAt?: number
}

export interface MessagePart {
  id: string
  messageID: string
  type: 'text' | 'file' | 'tool' | 'reasoning'
  content: any
  state?: {
    status: 'pending' | 'running' | 'completed' | 'failed'
  }
}

export interface Agent {
  name: string
  mode: string
  description: string
  model: {
    providerID: string
    modelID: string
  }
}

export interface Provider {
  id: string
  name: string
  models: Model[]
}

export interface Model {
  id: string
  name: string
  description: string
  contextLength: number
}
```

### C. Component Props Interfaces

```typescript
// src/types/components.ts
export interface MessageProps {
  message: Message
  index: number
  onCopy?: () => void
  onRevert?: () => void
  showToolDetails?: boolean
}

export interface EditorProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  disabled?: boolean
  placeholder?: string
}

export interface DialogProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export interface StatusBarProps {
  session?: Session
  isLoading?: boolean
  error?: string
  agent?: Agent
  model?: Model
}
```

### D. Performance Benchmarks

Target performance metrics for the HTML implementation:

- **Initial Load Time**: < 2 seconds
- **Time to Interactive**: < 3 seconds
- **Message Rendering**: < 100ms per message
- **Keyboard Response**: < 50ms
- **Memory Usage**: < 100MB for 1000 messages
- **Bundle Size**: < 500KB gzipped initial bundle

### E. Browser Compatibility

Minimum supported browsers:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Required browser features:
- ES2020 support
- WebSocket API
- EventSource API
- CSS Grid and Flexbox
- CSS Custom Properties

This implementation guide provides a comprehensive roadmap for creating a feature-complete HTML clone of the OpenCode TUI. The modular architecture ensures maintainability, while the performance optimizations ensure smooth user experience even with large datasets.