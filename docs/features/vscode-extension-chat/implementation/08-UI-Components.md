# 08-UI-Components.md

**React UI Components Architecture and Implementation for VS Code Extension Chat Interface**

---

## 🎯 Overview

This document provides comprehensive coverage of the React UI component architecture for the VS Code extension chat interface. Building on the OpenCode TUI implementation patterns, this guide covers component organization, composition patterns, TypeScript integration, and testing strategies for creating a sophisticated chat interface within VS Code.

## 🏗️ Component Architecture Overview

### Component Hierarchy

```
Extension Root
├── ChatProvider (Context & State)
├── MainLayout
│   ├── ChatHeader
│   ├── ChatInterface
│   │   ├── MessageList
│   │   │   ├── MessageItem
│   │   │   │   ├── MessageBubble
│   │   │   │   ├── ToolCallDisplay
│   │   │   │   └── MessageActions
│   │   │   └── VirtualizedList
│   │   ├── ToolExecutionPanel
│   │   │   ├── ToolCallCard
│   │   │   ├── FileOperationTool
│   │   │   ├── BashTool
│   │   │   └── TodoTool
│   │   └── ChatInput
│   │       ├── EditorComponent
│   │       ├── CompletionDialog
│   │       └── SubmitButton
│   ├── StatusBar
│   └── ToastContainer
└── DialogSystem
    ├── SessionDialog
    ├── ThemeDialog
    ├── ModelDialog
    └── HelpDialog
```

### Design System Integration

```typescript
// src/design-system/tokens.ts
export const designTokens = {
  colors: {
    // VS Code theme integration
    primary: 'var(--vscode-button-background)',
    secondary: 'var(--vscode-button-secondaryBackground)',
    foreground: 'var(--vscode-foreground)',
    background: 'var(--vscode-editor-background)',
    border: 'var(--vscode-panel-border)',
    
    // Chat-specific colors
    userMessage: 'var(--vscode-inputValidation-infoBackground)',
    assistantMessage: 'var(--vscode-editor-background)',
    systemMessage: 'var(--vscode-inputValidation-warningBackground)',
    
    // Tool states
    toolPending: 'var(--vscode-editorWarning-foreground)',
    toolRunning: 'var(--vscode-progressBar-background)',
    toolCompleted: 'var(--vscode-testing-iconPassed)',
    toolError: 'var(--vscode-errorForeground)',
  },
  
  spacing: {
    xs: '4px',
    sm: '8px', 
    md: '12px',
    lg: '16px',
    xl: '24px',
    xxl: '32px',
  },
  
  typography: {
    fontSize: {
      xs: '11px',
      sm: '12px',
      md: '13px',
      lg: '14px',
      xl: '16px',
    },
    fontFamily: {
      mono: 'var(--vscode-editor-font-family)',
      ui: 'var(--vscode-font-family)',
    },
  },
  
  borderRadius: {
    sm: '3px',
    md: '5px',
    lg: '8px',
  },
  
  shadows: {
    sm: '0 1px 3px rgba(0, 0, 0, 0.1)',
    md: '0 4px 6px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
  },
}
```

## 💬 Core Chat Components

### 1. Chat Provider & Context

```typescript
// src/contexts/ChatContext.tsx
interface ChatContextType {
  // Session management
  currentSession: Session | null
  sessions: Session[]
  
  // Messages and tool calls
  messages: Message[]
  toolCalls: ToolCall[]
  
  // UI state
  isLoading: boolean
  streamingMessage: Partial<Message> | null
  
  // Actions
  sendMessage: (content: string) => Promise<void>
  createSession: () => Promise<Session>
  selectSession: (sessionId: string) => void
  abortSession: () => void
  
  // Tool interaction
  approvePermission: (permissionId: string) => void
  denyPermission: (permissionId: string) => void
  
  // Settings
  theme: string
  setTheme: (theme: string) => void
  showToolDetails: boolean
  toggleToolDetails: () => void
}

export const ChatContext = createContext<ChatContextType | null>(null)

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ChatState>({
    currentSession: null,
    sessions: [],
    messages: [],
    toolCalls: [],
    isLoading: false,
    streamingMessage: null,
    theme: 'auto',
    showToolDetails: true,
  })
  
  const chatService = useRef(new ChatService())
  
  // SSE connection management
  useEffect(() => {
    if (state.currentSession) {
      chatService.current.connect(state.currentSession.id)
      
      // Event handlers for real-time updates
      chatService.current.on('message.delta', handleMessageDelta)
      chatService.current.on('tool.call.start', handleToolCallStart)
      chatService.current.on('tool.call.result', handleToolCallResult)
      chatService.current.on('permission.request', handlePermissionRequest)
      
      return () => chatService.current.disconnect()
    }
  }, [state.currentSession])
  
  const sendMessage = useCallback(async (content: string) => {
    if (!state.currentSession) return
    
    setState(prev => ({ ...prev, isLoading: true }))
    
    try {
      // Add user message immediately
      const userMessage: Message = {
        id: generateId(),
        role: 'user',
        content,
        timestamp: Date.now(),
        sessionId: state.currentSession.id,
      }
      
      setState(prev => ({
        ...prev,
        messages: [...prev.messages, userMessage],
      }))
      
      // Send to server
      await chatService.current.sendMessage(content)
      
    } catch (error) {
      console.error('Failed to send message:', error)
      // TODO: Show error toast
    } finally {
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }, [state.currentSession])
  
  // Real-time event handlers
  const handleMessageDelta = useCallback((delta: MessageDelta) => {
    setState(prev => {
      if (prev.streamingMessage?.id === delta.messageId) {
        return {
          ...prev,
          streamingMessage: {
            ...prev.streamingMessage,
            content: (prev.streamingMessage.content || '') + delta.content,
          },
        }
      } else {
        // New streaming message
        return {
          ...prev,
          streamingMessage: {
            id: delta.messageId,
            role: 'assistant',
            content: delta.content,
            timestamp: Date.now(),
            sessionId: prev.currentSession!.id,
          },
        }
      }
    })
  }, [])
  
  const handleToolCallStart = useCallback((toolCall: ToolCall) => {
    setState(prev => ({
      ...prev,
      toolCalls: [...prev.toolCalls, { ...toolCall, state: 'running' }],
    }))
  }, [])
  
  const handleToolCallResult = useCallback((result: ToolCallResult) => {
    setState(prev => ({
      ...prev,
      toolCalls: prev.toolCalls.map(tc =>
        tc.id === result.toolCallId
          ? { ...tc, state: 'completed', result: result.data }
          : tc
      ),
    }))
  }, [])
  
  const contextValue: ChatContextType = {
    ...state,
    sendMessage,
    createSession: () => chatService.current.createSession(),
    selectSession: (sessionId) => chatService.current.selectSession(sessionId),
    abortSession: () => chatService.current.abortSession(),
    approvePermission: (permissionId) => chatService.current.approvePermission(permissionId),
    denyPermission: (permissionId) => chatService.current.denyPermission(permissionId),
    setTheme: (theme) => setState(prev => ({ ...prev, theme })),
    toggleToolDetails: () => setState(prev => ({ ...prev, showToolDetails: !prev.showToolDetails })),
  }
  
  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  )
}

export const useChat = () => {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider')
  }
  return context
}
```

### 2. Main Layout Component

```typescript
// src/components/layout/MainLayout.tsx
export function MainLayout() {
  const { currentSession } = useChat()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  
  return (
    <div className="main-layout">
      <ChatHeader 
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        sidebarCollapsed={sidebarCollapsed}
      />
      
      <div className="main-content">
        {sidebarCollapsed ? null : (
          <SessionSidebar className="sidebar" />
        )}
        
        <div className="chat-area">
          {currentSession ? (
            <ChatInterface />
          ) : (
            <WelcomeScreen />
          )}
        </div>
      </div>
      
      <StatusBar />
    </div>
  )
}

// Styles
const styles = `
.main-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--vscode-editor-background);
  color: var(--vscode-foreground);
}

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.sidebar {
  width: 250px;
  border-right: 1px solid var(--vscode-panel-border);
  background: var(--vscode-sideBar-background);
}

.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
`
```

### 3. Chat Header Component

```typescript
// src/components/layout/ChatHeader.tsx
interface ChatHeaderProps {
  onToggleSidebar: () => void
  sidebarCollapsed: boolean
}

export function ChatHeader({ onToggleSidebar, sidebarCollapsed }: ChatHeaderProps) {
  const { currentSession, abortSession, isLoading } = useChat()
  const [showSessionMenu, setShowSessionMenu] = useState(false)
  
  return (
    <header className="chat-header">
      <div className="chat-header__left">
        <IconButton
          icon={sidebarCollapsed ? 'sidebar-expand' : 'sidebar-collapse'}
          onClick={onToggleSidebar}
          tooltip={sidebarCollapsed ? 'Show Sessions' : 'Hide Sessions'}
        />
        
        {currentSession && (
          <div className="session-info">
            <h2 className="session-title">
              {currentSession.title || 'Untitled Session'}
            </h2>
            <span className="session-id">
              {currentSession.id.slice(0, 8)}
            </span>
          </div>
        )}
      </div>
      
      <div className="chat-header__right">
        {isLoading && (
          <IconButton
            icon="stop"
            onClick={abortSession}
            tooltip="Stop Generation"
            variant="danger"
          />
        )}
        
        <DropdownMenu
          trigger={
            <IconButton
              icon="more-horizontal"
              tooltip="Session Options"
            />
          }
          items={[
            {
              label: 'Share Session',
              icon: 'share',
              onClick: () => shareSession(currentSession?.id),
            },
            {
              label: 'Export Chat',
              icon: 'download',
              onClick: () => exportSession(currentSession?.id),
            },
            {
              label: 'Clear History',
              icon: 'trash',
              onClick: () => clearSession(currentSession?.id),
              danger: true,
            },
          ]}
        />
      </div>
    </header>
  )
}
```

### 4. Message List Component

```typescript
// src/components/chat/MessageList.tsx
export function MessageList() {
  const { messages, streamingMessage } = useChat()
  const listRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  
  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages, streamingMessage, autoScroll])
  
  // Detect manual scroll to disable auto-scroll
  const handleScroll = useCallback((e: React.UIEvent) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10
    setAutoScroll(isAtBottom)
  }, [])
  
  const allMessages = useMemo(() => {
    const result = [...messages]
    if (streamingMessage) {
      result.push(streamingMessage as Message)
    }
    return result
  }, [messages, streamingMessage])
  
  return (
    <div className="message-list-container">
      <div 
        ref={listRef}
        className="message-list"
        onScroll={handleScroll}
      >
        <div className="message-list__content">
          {allMessages.map((message, index) => (
            <MessageItem
              key={message.id}
              message={message}
              index={index}
              isStreaming={message.id === streamingMessage?.id}
            />
          ))}
        </div>
      </div>
      
      {!autoScroll && (
        <button
          className="scroll-to-bottom"
          onClick={() => {
            setAutoScroll(true)
            listRef.current?.scrollTo({
              top: listRef.current.scrollHeight,
              behavior: 'smooth',
            })
          }}
        >
          <Icon name="chevron-down" />
          Scroll to bottom
        </button>
      )}
    </div>
  )
}
```

### 5. Message Item Component

```typescript
// src/components/chat/MessageItem.tsx
interface MessageItemProps {
  message: Message
  index: number
  isStreaming?: boolean
}

export const MessageItem = memo(function MessageItem({ 
  message, 
  index, 
  isStreaming = false 
}: MessageItemProps) {
  const [showActions, setShowActions] = useState(false)
  const [copied, setCopied] = useState(false)
  
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [message.content])
  
  const handleRevert = useCallback(() => {
    // TODO: Implement revert functionality
  }, [])
  
  return (
    <div 
      className={`message-item message-item--${message.role}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="message-item__avatar">
        <MessageAvatar role={message.role} />
      </div>
      
      <div className="message-item__content">
        <div className="message-item__header">
          <span className="message-role">
            {message.role === 'user' ? 'You' : 'Assistant'}
          </span>
          <span className="message-timestamp">
            {formatTimestamp(message.timestamp)}
          </span>
        </div>
        
        <div className="message-item__body">
          <MessageContent 
            content={message.content}
            isStreaming={isStreaming}
          />
          
          {message.toolCalls && message.toolCalls.length > 0 && (
            <ToolCallsList toolCalls={message.toolCalls} />
          )}
        </div>
        
        {showActions && !isStreaming && (
          <MessageActions
            onCopy={handleCopy}
            onRevert={handleRevert}
            copied={copied}
            canRevert={message.role === 'assistant'}
          />
        )}
      </div>
    </div>
  )
})

// Message Actions Component
function MessageActions({ 
  onCopy, 
  onRevert, 
  copied, 
  canRevert 
}: MessageActionsProps) {
  return (
    <div className="message-actions">
      <IconButton
        icon={copied ? 'check' : 'copy'}
        onClick={onCopy}
        tooltip={copied ? 'Copied!' : 'Copy message'}
        size="sm"
      />
      
      {canRevert && (
        <IconButton
          icon="undo"
          onClick={onRevert}
          tooltip="Revert to this point"
          size="sm"
        />
      )}
    </div>
  )
}
```

### 6. Message Content Component

```typescript
// src/components/chat/MessageContent.tsx
interface MessageContentProps {
  content: string
  isStreaming?: boolean
}

export function MessageContent({ content, isStreaming }: MessageContentProps) {
  const [displayContent, setDisplayContent] = useState('')
  
  // Streaming effect for assistant messages
  useEffect(() => {
    if (isStreaming) {
      let index = 0
      const interval = setInterval(() => {
        if (index < content.length) {
          setDisplayContent(content.slice(0, index + 1))
          index++
        } else {
          clearInterval(interval)
        }
      }, 20) // Adjust speed as needed
      
      return () => clearInterval(interval)
    } else {
      setDisplayContent(content)
    }
  }, [content, isStreaming])
  
  return (
    <div className="message-content">
      <MarkdownRenderer 
        content={displayContent}
        className="message-content__text"
      />
      
      {isStreaming && (
        <span className="streaming-cursor">|</span>
      )}
    </div>
  )
}

// Markdown Renderer with syntax highlighting
function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const renderedContent = useMemo(() => {
    return marked(content, {
      highlight: (code, language) => {
        if (language && hljs.getLanguage(language)) {
          return hljs.highlight(code, { language }).value
        }
        return hljs.highlightAuto(code).value
      },
      breaks: true,
      gfm: true,
    })
  }, [content])
  
  return (
    <div 
      className={`markdown-content ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedContent }}
    />
  )
}
```

## 🔧 Tool Execution Components

### 1. Tool Call Display System

```typescript
// src/components/tools/ToolCallDisplay.tsx
interface ToolCallDisplayProps {
  toolCall: ToolCall
  width?: number
}

export function ToolCallDisplay({ toolCall, width }: ToolCallDisplayProps) {
  const { showToolDetails } = useChat()
  const [expanded, setExpanded] = useState(showToolDetails)
  
  const ToolRenderer = getToolRenderer(toolCall.name)
  
  return (
    <div className={`tool-call tool-call--${toolCall.state}`}>
      <div 
        className="tool-call__header"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="tool-call__title">
          <ToolIcon name={toolCall.name} />
          <span className="tool-call__name">
            {getToolDisplayName(toolCall.name)}
          </span>
          <ToolStateIndicator state={toolCall.state} />
        </div>
        
        <div className="tool-call__controls">
          {toolCall.state === 'running' && (
            <IconButton
              icon="stop"
              onClick={(e) => {
                e.stopPropagation()
                // TODO: Cancel tool execution
              }}
              size="sm"
              tooltip="Cancel"
            />
          )}
          
          <IconButton
            icon={expanded ? 'chevron-up' : 'chevron-down'}
            size="sm"
            tooltip={expanded ? 'Collapse' : 'Expand'}
          />
        </div>
      </div>
      
      {toolCall.state === 'running' && (
        <div className="tool-call__progress">
          <ProgressBar indeterminate />
        </div>
      )}
      
      {expanded && (
        <div className="tool-call__body">
          {ToolRenderer ? (
            <ToolRenderer toolCall={toolCall} width={width} />
          ) : (
            <GenericToolDisplay toolCall={toolCall} />
          )}
        </div>
      )}
      
      {toolCall.error && (
        <div className="tool-call__error">
          <Icon name="alert-circle" />
          <span>{toolCall.error}</span>
        </div>
      )}
    </div>
  )
}

// Tool state indicator
function ToolStateIndicator({ state }: { state: ToolCallState }) {
  const getStateConfig = (state: ToolCallState) => {
    switch (state) {
      case 'pending':
        return { icon: 'clock', className: 'pending', label: 'Pending' }
      case 'running':
        return { icon: 'loader', className: 'running', label: 'Running' }
      case 'completed':
        return { icon: 'check', className: 'completed', label: 'Completed' }
      case 'error':
        return { icon: 'x', className: 'error', label: 'Error' }
      default:
        return { icon: 'help-circle', className: 'unknown', label: 'Unknown' }
    }
  }
  
  const config = getStateConfig(state)
  
  return (
    <div className={`tool-state tool-state--${config.className}`}>
      <Icon name={config.icon} size="sm" />
      <span className="tool-state__label">{config.label}</span>
    </div>
  )
}
```

### 2. File Operation Tools

```typescript
// src/components/tools/FileReadTool.tsx
export function FileReadTool({ toolCall }: ToolRendererProps) {
  const { parameters, result, state } = toolCall
  
  if (state === 'running') {
    return (
      <div className="file-tool file-tool--loading">
        <div className="file-tool__header">
          <Icon name="file-text" />
          <code className="file-path">{parameters.file_path}</code>
          <Spinner size="sm" />
        </div>
        <SkeletonLoader lines={5} />
      </div>
    )
  }
  
  if (state === 'completed' && result) {
    const language = getLanguageFromPath(parameters.file_path)
    const lineCount = result.content.split('\n').length
    
    return (
      <div className="file-tool file-tool--completed">
        <div className="file-tool__header">
          <Icon name="file-text" />
          <code className="file-path">{parameters.file_path}</code>
          <span className="file-stats">
            {lineCount} lines
          </span>
          <CopyButton content={result.content} />
        </div>
        
        <CodeBlock
          language={language}
          content={result.content}
          showLineNumbers
          maxHeight="400px"
          className="file-content"
        />
      </div>
    )
  }
  
  return <ToolErrorDisplay toolCall={toolCall} />
}

// File Write Tool
export function FileWriteTool({ toolCall }: ToolRendererProps) {
  const { parameters, result, state } = toolCall
  
  if (state === 'completed') {
    const language = getLanguageFromPath(parameters.file_path)
    
    return (
      <div className="file-tool file-tool--write">
        <div className="file-tool__header">
          <Icon name="file-plus" />
          <code className="file-path">{parameters.file_path}</code>
          <span className="file-action">Created</span>
        </div>
        
        <CodeBlock
          language={language}
          content={parameters.content}
          showLineNumbers
          maxHeight="300px"
          className="file-content"
        />
        
        {result?.diagnostics && result.diagnostics.length > 0 && (
          <div className="file-diagnostics">
            <h4>Diagnostics:</h4>
            {result.diagnostics.map((diagnostic: any, i: number) => (
              <div key={i} className="diagnostic-item">
                <Icon name="info" />
                <span>Line {diagnostic.line}: {diagnostic.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }
  
  return <GenericToolDisplay toolCall={toolCall} />
}

// File Edit Tool with Diff Viewer
export function FileEditTool({ toolCall }: ToolRendererProps) {
  const { parameters, result, state } = toolCall
  
  if (state === 'completed' && result?.diff) {
    return (
      <div className="file-tool file-tool--edit">
        <div className="file-tool__header">
          <Icon name="edit" />
          <code className="file-path">{parameters.file_path}</code>
          <span className="edit-stats">
            {result.replacements} replacement{result.replacements !== 1 ? 's' : ''}
          </span>
        </div>
        
        <DiffViewer
          oldContent={result.old_content}
          newContent={result.new_content}
          filename={parameters.file_path}
          className="edit-diff"
        />
      </div>
    )
  }
  
  return <GenericToolDisplay toolCall={toolCall} />
}
```

### 3. Bash Tool Component

```typescript
// src/components/tools/BashTool.tsx
export function BashTool({ toolCall }: ToolRendererProps) {
  const { parameters, result, state } = toolCall
  const [output, setOutput] = useState<string[]>([])
  
  // Handle streaming output
  useEffect(() => {
    if (state === 'running' && result?.stream) {
      const newLines = result.stream.split('\n')
      setOutput(prev => [...prev, ...newLines])
    } else if (state === 'completed' && result?.output) {
      setOutput(result.output.split('\n'))
    }
  }, [state, result])
  
  return (
    <div className="bash-tool">
      <div className="bash-tool__header">
        <Icon name="terminal" />
        <code className="command">{parameters.command}</code>
        {state === 'running' && <Spinner size="sm" />}
      </div>
      
      <div className="bash-tool__terminal">
        <div className="terminal-prompt">
          <span className="prompt-symbol">$</span>
          <span className="command-text">{parameters.command}</span>
        </div>
        
        {output.length > 0 && (
          <div className="terminal-output">
            {output.map((line, index) => (
              <div key={index} className="output-line">
                <AnsiToHtml content={line} />
              </div>
            ))}
          </div>
        )}
        
        {state === 'running' && (
          <div className="terminal-cursor">█</div>
        )}
      </div>
      
      {state === 'completed' && result && (
        <div className="bash-tool__footer">
          <span className={`exit-code ${result.exit_code === 0 ? 'success' : 'error'}`}>
            Exit code: {result.exit_code}
          </span>
          {result.execution_time && (
            <span className="execution-time">
              {result.execution_time}ms
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ANSI escape code processing
function AnsiToHtml({ content }: { content: string }) {
  const processedContent = useMemo(() => {
    // Basic ANSI escape code processing
    return content
      .replace(/\x1b\[31m/g, '<span class="ansi-red">')
      .replace(/\x1b\[32m/g, '<span class="ansi-green">')
      .replace(/\x1b\[33m/g, '<span class="ansi-yellow">')
      .replace(/\x1b\[34m/g, '<span class="ansi-blue">')
      .replace(/\x1b\[35m/g, '<span class="ansi-magenta">')
      .replace(/\x1b\[36m/g, '<span class="ansi-cyan">')
      .replace(/\x1b\[37m/g, '<span class="ansi-white">')
      .replace(/\x1b\[0m/g, '</span>')
      .replace(/\x1b\[[0-9;]*m/g, '') // Remove other escape codes
  }, [content])
  
  return (
    <span 
      dangerouslySetInnerHTML={{ __html: processedContent }}
    />
  )
}
```

### 4. Todo Management Tool

```typescript
// src/components/tools/TodoTool.tsx
interface TodoItem {
  content: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  activeForm?: string
}

export function TodoTool({ toolCall }: ToolRendererProps) {
  const { parameters, result, state } = toolCall
  const todos: TodoItem[] = parameters.todos || []
  
  const [animatedTodos, setAnimatedTodos] = useState<TodoItem[]>([])
  
  // Progressive reveal animation
  useEffect(() => {
    if (state === 'running') {
      let index = 0
      const interval = setInterval(() => {
        if (index < todos.length) {
          setAnimatedTodos(todos.slice(0, index + 1))
          index++
        } else {
          clearInterval(interval)
        }
      }, 200)
      
      return () => clearInterval(interval)
    } else {
      setAnimatedTodos(todos)
    }
  }, [todos, state])
  
  const todoStats = useMemo(() => {
    const completed = todos.filter(t => t.status === 'completed').length
    const inProgress = todos.filter(t => t.status === 'in_progress').length
    const pending = todos.filter(t => t.status === 'pending').length
    
    return { completed, inProgress, pending, total: todos.length }
  }, [todos])
  
  return (
    <div className="todo-tool">
      <div className="todo-tool__header">
        <Icon name="check-circle" />
        <span className="todo-title">Todo List</span>
        <div className="todo-stats">
          <span className="completed">{todoStats.completed}</span>
          <span className="separator">/</span>
          <span className="total">{todoStats.total}</span>
        </div>
      </div>
      
      <div className="todo-list">
        {animatedTodos.map((todo, index) => (
          <TodoItem
            key={index}
            todo={todo}
            index={index}
            animate={state === 'running'}
          />
        ))}
      </div>
      
      {state === 'running' && (
        <div className="todo-progress">
          <ProgressBar 
            value={(todoStats.completed / todoStats.total) * 100}
            label={`${todoStats.completed} of ${todoStats.total} completed`}
          />
        </div>
      )}
    </div>
  )
}

function TodoItem({ 
  todo, 
  index, 
  animate 
}: { 
  todo: TodoItem
  index: number
  animate: boolean 
}) {
  const [visible, setVisible] = useState(!animate)
  
  useEffect(() => {
    if (animate) {
      const timer = setTimeout(() => setVisible(true), index * 100)
      return () => clearTimeout(timer)
    }
  }, [animate, index])
  
  if (!visible) return null
  
  return (
    <motion.div
      initial={animate ? { opacity: 0, x: -20 } : false}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className={`todo-item todo-item--${todo.status}`}
    >
      <div className="todo-item__indicator">
        {todo.status === 'completed' && (
          <Icon name="check" className="completed" />
        )}
        {todo.status === 'in_progress' && (
          <Spinner size="xs" />
        )}
        {todo.status === 'pending' && (
          <Icon name="circle" className="pending" />
        )}
        {todo.status === 'cancelled' && (
          <Icon name="x" className="cancelled" />
        )}
      </div>
      
      <div className="todo-item__content">
        <span className="todo-text">{todo.content}</span>
        {todo.status === 'in_progress' && todo.activeForm && (
          <span className="active-form">→ {todo.activeForm}</span>
        )}
      </div>
    </motion.div>
  )
}
```

## 💬 Chat Input Components

### 1. Chat Input Component

```typescript
// src/components/chat/ChatInput.tsx
export function ChatInput() {
  const { sendMessage, isLoading } = useChat()
  const [value, setValue] = useState('')
  const [showCompletions, setShowCompletions] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault()
    
    if (!value.trim() || isLoading) return
    
    const messageContent = value.trim()
    setValue('')
    setShowCompletions(false)
    
    await sendMessage(messageContent)
  }, [value, isLoading, sendMessage])
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === 'Escape') {
      setValue('')
      setShowCompletions(false)
    } else if (e.key === '/' && value === '') {
      setShowCompletions(true)
    }
  }, [handleSubmit, value])
  
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    
    // Auto-hide completions when typing
    if (showCompletions && e.target.value !== '/') {
      setShowCompletions(false)
    }
  }, [showCompletions])
  
  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [value])
  
  return (
    <form className="chat-input" onSubmit={handleSubmit}>
      <div className="chat-input__container">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Type your message... (use / for commands)"
          className="chat-input__textarea"
          disabled={isLoading}
          rows={1}
        />
        
        <div className="chat-input__actions">
          {value.trim() && (
            <IconButton
              icon="send"
              onClick={handleSubmit}
              disabled={isLoading}
              tooltip="Send message (Enter)"
              variant="primary"
            />
          )}
        </div>
      </div>
      
      {showCompletions && (
        <CompletionDialog
          value={value}
          onSelect={(completion) => {
            setValue(completion)
            setShowCompletions(false)
            textareaRef.current?.focus()
          }}
          onClose={() => setShowCompletions(false)}
        />
      )}
    </form>
  )
}
```

### 2. Completion Dialog Component

```typescript
// src/components/chat/CompletionDialog.tsx
interface CompletionItem {
  value: string
  label: string
  description?: string
  icon?: string
}

interface CompletionDialogProps {
  value: string
  onSelect: (completion: string) => void
  onClose: () => void
}

export function CompletionDialog({ value, onSelect, onClose }: CompletionDialogProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  
  const completions: CompletionItem[] = useMemo(() => [
    {
      value: '/build',
      label: 'Build',
      description: 'Build project or component',
      icon: 'hammer',
    },
    {
      value: '/analyze',
      label: 'Analyze',
      description: 'Analyze code or project',
      icon: 'search',
    },
    {
      value: '/fix',
      label: 'Fix',
      description: 'Fix bugs or issues',
      icon: 'wrench',
    },
    {
      value: '/explain',
      label: 'Explain',
      description: 'Explain code or concepts',
      icon: 'help-circle',
    },
    {
      value: '/test',
      label: 'Test',
      description: 'Create or run tests',
      icon: 'check-circle',
    },
  ], [])
  
  const filteredCompletions = useMemo(() => {
    if (!value || value === '/') return completions
    
    const query = value.slice(1).toLowerCase()
    return completions.filter(comp =>
      comp.label.toLowerCase().includes(query) ||
      comp.description?.toLowerCase().includes(query)
    )
  }, [value, completions])
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(i => (i + 1) % filteredCompletions.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(i => i === 0 ? filteredCompletions.length - 1 : i - 1)
        break
      case 'Enter':
        e.preventDefault()
        if (filteredCompletions[selectedIndex]) {
          onSelect(filteredCompletions[selectedIndex].value + ' ')
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }, [filteredCompletions, selectedIndex, onSelect, onClose])
  
  useEffect(() => {
    setSelectedIndex(0)
  }, [filteredCompletions])
  
  useEffect(() => {
    const handleDocumentKeyDown = (e: KeyboardEvent) => {
      handleKeyDown(e as any)
    }
    
    document.addEventListener('keydown', handleDocumentKeyDown)
    return () => document.removeEventListener('keydown', handleDocumentKeyDown)
  }, [handleKeyDown])
  
  if (filteredCompletions.length === 0) {
    return null
  }
  
  return (
    <div className="completion-dialog">
      <div className="completion-dialog__header">
        <span>Commands</span>
        <span className="completion-hint">
          ↑↓ to navigate, Enter to select, Esc to close
        </span>
      </div>
      
      <div className="completion-dialog__list">
        {filteredCompletions.map((completion, index) => (
          <button
            key={completion.value}
            className={`completion-item ${index === selectedIndex ? 'selected' : ''}`}
            onClick={() => onSelect(completion.value + ' ')}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            {completion.icon && (
              <Icon name={completion.icon} className="completion-icon" />
            )}
            <div className="completion-content">
              <span className="completion-label">{completion.label}</span>
              {completion.description && (
                <span className="completion-description">
                  {completion.description}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
```

## 🎨 UI Components Library

### 1. Icon Button Component

```typescript
// src/components/ui/IconButton.tsx
interface IconButtonProps {
  icon: string
  onClick?: () => void
  disabled?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg'
  variant?: 'default' | 'primary' | 'danger' | 'ghost'
  tooltip?: string
  className?: string
}

export function IconButton({
  icon,
  onClick,
  disabled = false,
  size = 'md',
  variant = 'default',
  tooltip,
  className = '',
}: IconButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  
  const buttonElement = (
    <button
      className={`icon-button icon-button--${size} icon-button--${variant} ${className}`}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <Icon name={icon} size={size} />
    </button>
  )
  
  if (tooltip) {
    return (
      <div className="icon-button-wrapper">
        {buttonElement}
        {showTooltip && (
          <div className="tooltip">
            {tooltip}
          </div>
        )}
      </div>
    )
  }
  
  return buttonElement
}
```

### 2. Code Block Component

```typescript
// src/components/ui/CodeBlock.tsx
interface CodeBlockProps {
  language?: string
  content: string
  showLineNumbers?: boolean
  maxHeight?: string
  className?: string
  fileName?: string
}

export function CodeBlock({
  language,
  content,
  showLineNumbers = false,
  maxHeight = '400px',
  className = '',
  fileName,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  
  const detectedLanguage = useMemo(() => {
    if (language) return language
    
    // Simple language detection
    if (content.includes('import ') && content.includes('from ')) return 'javascript'
    if (content.includes('def ') && content.includes(':')) return 'python'
    if (content.includes('function ') || content.includes('=>')) return 'javascript'
    if (content.includes('<') && content.includes('>')) return 'html'
    
    return 'text'
  }, [language, content])
  
  const highlightedCode = useMemo(() => {
    try {
      return hljs.highlight(content, { language: detectedLanguage }).value
    } catch {
      return hljs.highlightAuto(content).value
    }
  }, [content, detectedLanguage])
  
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [content])
  
  const lines = content.split('\n')
  
  return (
    <div className={`code-block ${className}`}>
      <div className="code-block__header">
        <div className="code-block__info">
          {fileName && (
            <span className="code-block__filename">{fileName}</span>
          )}
          <span className="code-block__language">{detectedLanguage}</span>
        </div>
        
        <IconButton
          icon={copied ? 'check' : 'copy'}
          onClick={handleCopy}
          size="sm"
          tooltip={copied ? 'Copied!' : 'Copy code'}
        />
      </div>
      
      <div 
        className="code-block__content"
        style={{ maxHeight }}
      >
        {showLineNumbers && (
          <div className="code-block__line-numbers">
            {lines.map((_, index) => (
              <span key={index} className="line-number">
                {index + 1}
              </span>
            ))}
          </div>
        )}
        
        <pre className="code-block__code">
          <code
            className={`language-${detectedLanguage}`}
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
          />
        </pre>
      </div>
    </div>
  )
}
```

### 3. Progress Bar Component

```typescript
// src/components/ui/ProgressBar.tsx
interface ProgressBarProps {
  value?: number
  max?: number
  indeterminate?: boolean
  label?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function ProgressBar({
  value = 0,
  max = 100,
  indeterminate = false,
  label,
  size = 'md',
  className = '',
}: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100)
  
  return (
    <div className={`progress-bar progress-bar--${size} ${className}`}>
      {label && (
        <div className="progress-bar__label">
          <span>{label}</span>
          {!indeterminate && (
            <span className="progress-bar__percentage">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}
      
      <div className="progress-bar__track">
        <div
          className={`progress-bar__fill ${indeterminate ? 'indeterminate' : ''}`}
          style={indeterminate ? {} : { width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
```

## 📱 Component Lifecycle Management

### 1. Component Cleanup Hook

```typescript
// src/hooks/useComponentCleanup.ts
export function useComponentCleanup() {
  const cleanupCallbacks = useRef<(() => void)[]>([])
  
  const addCleanup = useCallback((callback: () => void) => {
    cleanupCallbacks.current.push(callback)
  }, [])
  
  const cleanup = useCallback(() => {
    cleanupCallbacks.current.forEach(callback => {
      try {
        callback()
      } catch (error) {
        console.error('Cleanup error:', error)
      }
    })
    cleanupCallbacks.current = []
  }, [])
  
  useEffect(() => {
    return cleanup
  }, [cleanup])
  
  return { addCleanup, cleanup }
}
```

### 2. Intersection Observer Hook

```typescript
// src/hooks/useIntersectionObserver.ts
export function useIntersectionObserver(
  targetRef: RefObject<Element>,
  options: IntersectionObserverInit = {}
) {
  const [isIntersecting, setIsIntersecting] = useState(false)
  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null)
  
  useEffect(() => {
    const target = targetRef.current
    if (!target) return
    
    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting)
      setEntry(entry)
    }, options)
    
    observer.observe(target)
    
    return () => {
      observer.unobserve(target)
    }
  }, [targetRef, options])
  
  return { isIntersecting, entry }
}
```

### 3. Debounced State Hook

```typescript
// src/hooks/useDebounced.ts
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
```

## 🧪 Component Testing Strategies

### 1. Component Test Utilities

```typescript
// src/test-utils/render.tsx
import { render as rtlRender, RenderOptions } from '@testing-library/react'
import { ReactElement } from 'react'
import { ChatProvider } from '../contexts/ChatContext'

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  chatProviderProps?: Partial<ChatContextType>
}

function render(ui: ReactElement, options: CustomRenderOptions = {}) {
  const { chatProviderProps, ...renderOptions } = options
  
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <ChatProvider {...chatProviderProps}>
        {children}
      </ChatProvider>
    )
  }
  
  return rtlRender(ui, { wrapper: Wrapper, ...renderOptions })
}

// re-export everything
export * from '@testing-library/react'
export { render }
```

### 2. Component Tests

```typescript
// src/components/chat/__tests__/MessageItem.test.tsx
import { render, screen, fireEvent, waitFor } from '../../../test-utils/render'
import { MessageItem } from '../MessageItem'

const mockMessage: Message = {
  id: 'test-message',
  role: 'assistant',
  content: 'Hello, world!',
  timestamp: Date.now(),
  sessionId: 'test-session',
}

describe('MessageItem', () => {
  it('renders message content correctly', () => {
    render(<MessageItem message={mockMessage} index={0} />)
    
    expect(screen.getByText('Hello, world!')).toBeInTheDocument()
    expect(screen.getByText('Assistant')).toBeInTheDocument()
  })
  
  it('shows actions on hover', async () => {
    render(<MessageItem message={mockMessage} index={0} />)
    
    const messageItem = screen.getByRole('article')
    fireEvent.mouseEnter(messageItem)
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
    })
  })
  
  it('copies message content to clipboard', async () => {
    const writeText = jest.fn()
    Object.assign(navigator, {
      clipboard: { writeText },
    })
    
    render(<MessageItem message={mockMessage} index={0} />)
    
    const messageItem = screen.getByRole('article')
    fireEvent.mouseEnter(messageItem)
    
    const copyButton = await screen.findByRole('button', { name: /copy/i })
    fireEvent.click(copyButton)
    
    expect(writeText).toHaveBeenCalledWith('Hello, world!')
  })
  
  it('handles streaming messages correctly', () => {
    render(
      <MessageItem 
        message={mockMessage} 
        index={0} 
        isStreaming={true} 
      />
    )
    
    expect(screen.getByText('|')).toBeInTheDocument() // Cursor
  })
})
```

### 3. Tool Component Tests

```typescript
// src/components/tools/__tests__/FileReadTool.test.tsx
import { render, screen } from '../../../test-utils/render'
import { FileReadTool } from '../FileReadTool'

const mockToolCall: ToolCall = {
  id: 'test-tool',
  name: 'read',
  parameters: { file_path: '/test/file.js' },
  state: 'completed',
  result: {
    content: 'console.log("Hello, world!");',
  },
}

describe('FileReadTool', () => {
  it('renders completed file read correctly', () => {
    render(<FileReadTool toolCall={mockToolCall} />)
    
    expect(screen.getByText('/test/file.js')).toBeInTheDocument()
    expect(screen.getByText('console.log("Hello, world!");')).toBeInTheDocument()
    expect(screen.getByText('1 lines')).toBeInTheDocument()
  })
  
  it('shows loading state for running tool', () => {
    const runningToolCall = { 
      ...mockToolCall, 
      state: 'running' as const,
      result: undefined,
    }
    
    render(<FileReadTool toolCall={runningToolCall} />)
    
    expect(screen.getByText('/test/file.js')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })
  
  it('shows error state for failed tool', () => {
    const errorToolCall = { 
      ...mockToolCall, 
      state: 'error' as const,
      error: 'File not found',
      result: undefined,
    }
    
    render(<FileReadTool toolCall={errorToolCall} />)
    
    expect(screen.getByText('File not found')).toBeInTheDocument()
  })
})
```

## 📊 Performance Optimization

### 1. Virtual Scrolling for Large Lists

```typescript
// src/components/ui/VirtualizedMessageList.tsx
interface VirtualizedMessageListProps {
  messages: Message[]
  itemHeight: number
  containerHeight: number
}

export function VirtualizedMessageList({
  messages,
  itemHeight,
  containerHeight,
}: VirtualizedMessageListProps) {
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const visibleRange = useMemo(() => {
    const start = Math.floor(scrollTop / itemHeight)
    const end = Math.min(
      start + Math.ceil(containerHeight / itemHeight) + 1,
      messages.length
    )
    
    return { start, end }
  }, [scrollTop, itemHeight, containerHeight, messages.length])
  
  const visibleMessages = useMemo(() => {
    return messages.slice(visibleRange.start, visibleRange.end)
  }, [messages, visibleRange])
  
  const totalHeight = messages.length * itemHeight
  const offsetY = visibleRange.start * itemHeight
  
  return (
    <div
      ref={containerRef}
      className="virtualized-message-list"
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          {visibleMessages.map((message, index) => (
            <div
              key={message.id}
              style={{ height: itemHeight }}
            >
              <MessageItem
                message={message}
                index={visibleRange.start + index}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

### 2. Memoization Strategies

```typescript
// src/components/chat/OptimizedMessageList.tsx
export const OptimizedMessageList = memo(function MessageList() {
  const { messages, streamingMessage } = useChat()
  
  // Memoize combined message list
  const allMessages = useMemo(() => {
    const result = [...messages]
    if (streamingMessage) {
      result.push(streamingMessage as Message)
    }
    return result
  }, [messages, streamingMessage])
  
  // Memoize message renderers
  const messageRenderers = useMemo(() => {
    return allMessages.map((message, index) => (
      <MemoizedMessageItem
        key={message.id}
        message={message}
        index={index}
        isStreaming={message.id === streamingMessage?.id}
      />
    ))
  }, [allMessages, streamingMessage])
  
  return (
    <div className="message-list">
      {messageRenderers}
    </div>
  )
})

// Optimized message item with React.memo
const MemoizedMessageItem = memo(
  MessageItem,
  (prevProps, nextProps) => {
    return (
      prevProps.message.id === nextProps.message.id &&
      prevProps.message.content === nextProps.message.content &&
      prevProps.isStreaming === nextProps.isStreaming
    )
  }
)
```

## 🎯 Summary

This comprehensive UI Components guide provides:

1. **Complete Component Architecture**: Hierarchical structure with clear separation of concerns
2. **Advanced Chat Interface**: Real-time messaging with streaming support and tool integration  
3. **Sophisticated Tool System**: Interactive tool execution with state management and animations
4. **Performance Optimization**: Virtual scrolling, memoization, and efficient rendering strategies
5. **TypeScript Integration**: Complete type safety with proper interfaces and props definitions
6. **Testing Framework**: Comprehensive testing utilities and strategies for component validation
7. **VS Code Integration**: Native design system integration with VS Code theming and UX patterns

The architecture enables building a professional-grade chat interface that rivals the OpenCode TUI functionality while leveraging modern React patterns and VS Code extension capabilities. All components are designed for maintainability, testability, and performance in the VS Code environment.