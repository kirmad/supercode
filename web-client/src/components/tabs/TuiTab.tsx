import { useState, useEffect, useRef, useCallback, memo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import { 
  Terminal, 
  Send, 
  RefreshCw, 
  AlertCircle, 
  Activity,
  MessageSquare,
  Loader2,
  Square,
  Settings,
  User,
  Bot,
  Clock,
  Maximize2,
  Minimize2,
  PlusCircle
} from "lucide-react"

interface Session {
  id: string
  title?: string
  version: string
  time: {
    created: string
    updated: string
  }
}

interface Message {
  info: {
    role: 'user' | 'assistant' | 'system'
    time: {
      created: string
    }
  }
  parts: Array<{
    type: string
    text?: string
    [key: string]: any
  }>
}

interface TuiStatus {
  connected: boolean
  error?: string
}

// Memoized message component to prevent unnecessary re-renders
const MessageItem = memo(({ message, getTimeAgo, isCompact }: {
  message: Message
  getTimeAgo: (dateString: string) => string
  isCompact?: boolean
}) => {
  const { info, parts } = message
  const isUser = info.role === 'user'
  const isAssistant = info.role === 'assistant'
  const textParts = parts.filter(p => p.type === 'text')
  
  return (
    <div className={`${isCompact ? 'p-3' : 'p-4'} hover:bg-muted/20 transition-colors`}>
      <div className="flex gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0 mt-0.5">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${
            isUser 
              ? 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800' 
              : isAssistant 
              ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800' 
              : 'bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-700'
          }`}>
            {isUser ? (
              <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            ) : isAssistant ? (
              <Bot className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Settings className="w-4 h-4 text-gray-500" />
            )}
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header Row */}
          <div className="flex items-center gap-2 mb-2">
            <span className={`font-medium text-sm ${
              isUser 
                ? 'text-blue-700 dark:text-blue-300' 
                : isAssistant 
                ? 'text-emerald-700 dark:text-emerald-300' 
                : 'text-gray-700 dark:text-gray-300'
            }`}>
              {isUser ? 'You' : isAssistant ? 'Assistant' : 'System'}
            </span>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {getTimeAgo(info.time.created)}
            </div>
          </div>
          
          {/* Message Content */}
          {textParts.map((part, partIndex) => (
            <div key={partIndex} className="text-sm text-foreground/90 leading-relaxed">
              <MarkdownRenderer content={part.text || ''} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})

MessageItem.displayName = 'MessageItem'

export function TuiTab() {
  const [prompt, setPrompt] = useState("")
  const [sessions, setSessions] = useState<Session[]>([])
  const [currentSession, setCurrentSession] = useState<Session | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [tuiStatus, setTuiStatus] = useState<TuiStatus>({ connected: false })
  const [loading, setLoading] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Check for chatOnlyMode from global config and auto-maximize if enabled
  const [isMaximized, setIsMaximized] = useState(() => {
    return (window as any).APP_CONFIG?.chatOnlyMode === true
  })
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [previousMessageCount, setPreviousMessageCount] = useState(0)
  const isAtBottomRef = useRef(true) // Track if user is at bottom without causing re-renders

  // Debug: Log re-renders to validate fixes
  console.log('🔄 TuiTab re-render:', {
    messageCount: messages.length,
    loadingMessages,
    isSubmitting,
    currentSessionId: currentSession?.id
  })

  useEffect(() => {
    loadSessions()
    checkTuiStatus()
  }, [])

  // Load messages when current session changes
  useEffect(() => {
    if (currentSession) {
      loadMessages(currentSession.id)
    } else {
      setMessages([])
    }
  }, [currentSession])

  // Setup IntersectionObserver to track if user is at bottom
  useEffect(() => {
    if (!messagesEndRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        const isVisible = entries[0].isIntersecting
        isAtBottomRef.current = isVisible
        console.log('👁️ Bottom visibility changed:', isVisible)
      },
      {
        root: messagesContainerRef.current,
        threshold: 0.1
      }
    )

    observer.observe(messagesEndRef.current)

    return () => {
      observer.disconnect()
    }
  }, [currentSession]) // Re-setup when session changes

  // Auto-scroll to bottom when new messages arrive (only if user is at bottom and there are new messages)
  useEffect(() => {
    // Only proceed if we have actual new messages and this isn't the initial load
    if (messages.length > previousMessageCount && previousMessageCount > 0) {
      console.log('🔄 New messages detected, was at bottom:', isAtBottomRef.current)
      
      // Use setTimeout to ensure DOM has updated before scrolling
      setTimeout(() => {
        if (isAtBottomRef.current) {
          console.log('⬇️ Auto-scrolling to bottom')
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
        } else {
          console.log('⏸️ User scrolled up, skipping auto-scroll')
        }
      }, 50) // Slightly longer delay to ensure DOM updates
    }
    setPreviousMessageCount(messages.length)
  }, [messages.length]) // Only depend on message count, not the full messages array

  // Poll for message updates when there's an active session
  useEffect(() => {
    if (!currentSession) return

    const interval = setInterval(() => {
      loadMessages(currentSession.id, true) // isPolling = true for background updates
    }, 2000) // Poll every 2 seconds

    return () => clearInterval(interval)
  }, [currentSession])

  const loadSessions = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`${window.APP_CONFIG.apiUrl}/session`)
      if (!response.ok) throw new Error('Failed to fetch sessions')
      
      const sessionsData = await response.json()
      setSessions(sessionsData)
      
      // Set the most recent session as current if none selected
      if (sessionsData.length > 0 && !currentSession) {
        setCurrentSession(sessionsData[0])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }

  const loadMessages = async (sessionId: string, isPolling: boolean = false) => {
    console.log('📡 loadMessages called:', { sessionId, isPolling })
    
    // Only show loading state for manual refreshes, not background polling
    if (!isPolling) {
      setLoadingMessages(true)
    }
    
    try {
      const response = await fetch(`${window.APP_CONFIG.apiUrl}/session/${sessionId}/message`)
      if (!response.ok) throw new Error('Failed to fetch messages')
      
      const messagesData = await response.json()
      
      // Only update messages if they've actually changed (prevent unnecessary re-renders)
      setMessages(prevMessages => {
        // Compare arrays deeply to prevent unnecessary updates
        if (prevMessages.length !== messagesData.length) {
          console.log('📝 Messages length changed:', prevMessages.length, '→', messagesData.length)
          return messagesData
        }
        
        // Check if any message content has changed
        const hasChanged = messagesData.some((newMsg: Message, index: number) => {
          const prevMsg = prevMessages[index]
          if (!prevMsg) return true
          
          // Compare message content and timing
          return (
            newMsg.info?.time?.created !== prevMsg.info?.time?.created ||
            JSON.stringify(newMsg.parts) !== JSON.stringify(prevMsg.parts) ||
            newMsg.info?.role !== prevMsg.info?.role
          )
        })
        
        if (hasChanged) {
          console.log('📝 Messages content changed, updating state')
        } else {
          console.log('✅ No message changes, skipping state update')
        }
        
        return hasChanged ? messagesData : prevMessages
      })
    } catch (err) {
      console.error('Failed to load messages:', err)
    } finally {
      // Only update loading state if we showed it
      if (!isPolling) {
        setLoadingMessages(false)
      }
    }
  }

  const checkTuiStatus = async () => {
    try {
      // Try to get app info to check if TUI is responsive
      const response = await fetch(`${window.APP_CONFIG.apiUrl}/app`)
      if (response.ok) {
        setTuiStatus({ connected: true })
      } else {
        setTuiStatus({ connected: false, error: 'TUI not responding' })
      }
    } catch (err) {
      setTuiStatus({ 
        connected: false, 
        error: err instanceof Error ? err.message : 'TUI connection failed' 
      })
    }
  }

  const submitPrompt = async () => {
    if (!prompt.trim() || isSubmitting) return
    
    setIsSubmitting(true)
    setError(null)
    
    try {
      // Check if the prompt is a slash command
      const trimmedPrompt = prompt.trim()
      if (trimmedPrompt.startsWith('/')) {
        const command = trimmedPrompt.substring(1).toLowerCase()
        
        // Handle slash commands
        if (command === 'clear' || command === 'new') {
          await executeCommand('session_new')
          setPrompt("")
          return
        }
        
        // For other slash commands, fall through to normal submission
      }
      
      // First append the prompt to TUI
      const appendResponse = await fetch(`${window.APP_CONFIG.apiUrl}/tui/append-prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: prompt }),
      })
      
      if (!appendResponse.ok) throw new Error('Failed to append prompt to TUI')
      
      // Then submit it
      const submitResponse = await fetch(`${window.APP_CONFIG.apiUrl}/tui/submit-prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })
      
      if (!submitResponse.ok) throw new Error('Failed to submit prompt')
      
      // Clear the prompt and refresh sessions and messages
      setPrompt("")
      await loadSessions()
      if (currentSession) {
        await loadMessages(currentSession.id)
      }
      
      // Restore focus to the input field after submission
      setTimeout(() => {
        promptRef.current?.focus()
      }, 100)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit prompt')
    } finally {
      setIsSubmitting(false)
    }
  }

  const executeCommand = async (commandName: string) => {
    try {
      const response = await fetch(`${window.APP_CONFIG.apiUrl}/tui/execute-command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command: commandName }),
      })
      
      if (!response.ok) throw new Error(`Failed to execute command: ${commandName}`)
      
      // Refresh sessions and messages after command execution
      await loadSessions()
      if (currentSession) {
        await loadMessages(currentSession.id)
      }
    } catch (err) {
      console.error(`Failed to execute TUI command ${commandName}:`, err)
      setError(err instanceof Error ? err.message : `Failed to execute command: ${commandName}`)
    }
  }

  const clearPrompt = async () => {
    try {
      const response = await fetch(`${window.APP_CONFIG.apiUrl}/tui/clear-prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })
      
      if (response.ok) {
        setPrompt("")
      }
    } catch (err) {
      console.error('Failed to clear TUI prompt:', err)
    }
  }

  const newSession = async () => {
    setError(null)
    try {
      await executeCommand('session_new')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create new session')
    }
  }

  const openTuiHelp = async () => {
    try {
      await fetch(`${window.APP_CONFIG.apiUrl}/tui/open-help`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })
    } catch (err) {
      console.error('Failed to open TUI help:', err)
    }
  }

  const openTuiSessions = async () => {
    try {
      await fetch(`${window.APP_CONFIG.apiUrl}/tui/open-sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })
    } catch (err) {
      console.error('Failed to open TUI sessions:', err)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      submitPrompt()
    }
  }

  const handleSessionSelect = (session: Session) => {
    setCurrentSession(session)
    setError(null) // Clear any errors when switching sessions
    setPreviousMessageCount(0) // Reset message count for new session
  }


  const getTimeAgo = useCallback((dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }, [])

  return (
    <div className={`h-full flex flex-col ${isMaximized ? 'fixed inset-0 z-50 bg-background' : ''}`}>
      {/* Header - Compact when maximized */}
      {isMaximized ? (
        /* Minimal header for maximized mode */
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="px-3 py-1.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                tuiStatus.connected ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className="text-xs text-muted-foreground">
                {currentSession?.title || 'TUI Chat'}
              </span>
            </div>
            {/* Hide minimize button in chat-only mode */}
            {!(window as any).APP_CONFIG?.chatOnlyMode && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMaximized(false)}
                className="h-6 w-6 p-0"
                title="Exit fullscreen"
              >
                <Minimize2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      ) : (
        /* Full header for normal mode */
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Terminal className="w-5 h-5" />
                <h2 className="font-semibold">TUI Interface</h2>
                {currentSession && (
                  <Badge variant="outline" className="text-xs">
                    {currentSession.title || 'Untitled Session'}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${
                  tuiStatus.connected 
                    ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' 
                    : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    tuiStatus.connected ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  {tuiStatus.connected ? 'Connected' : 'Disconnected'}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMaximized(true)}
                  className="text-xs"
                  title="Enter fullscreen"
                >
                  <Maximize2 className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={checkTuiStatus}
                  className="text-xs"
                >
                  <RefreshCw className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* TUI Controls */}
            <div className="flex items-center gap-2 text-xs">
              <Button
                variant="outline"
                size="sm"
                onClick={openTuiHelp}
                className="gap-1"
              >
                <Settings className="w-3 h-3" />
                Help
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={openTuiSessions}
                className="gap-1"
              >
                <MessageSquare className="w-3 h-3" />
                Sessions
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={loadSessions}
                className="gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Conversation Display */}
        <div className="flex-1 flex flex-col">
          {/* Hide conversation header when maximized */}
          {!isMaximized && (
            <div className="p-4 border-b bg-muted/50">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm">Conversation</h3>
                {currentSession && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    Updated {getTimeAgo(currentSession.time.updated)}
                  </div>
                )}
              </div>
            </div>
          )}

          <div ref={messagesContainerRef} className="flex-1 overflow-auto">
            {!currentSession ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm mb-1">No session selected</p>
                  <p className="text-xs opacity-75">Select a session to view the conversation</p>
                </div>
              </div>
            ) : loadingMessages ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-muted-foreground text-sm">Loading conversation...</span>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm mb-1">No messages</p>
                  <p className="text-xs opacity-75">Send a prompt to start the conversation</p>
                </div>
              </div>
            ) : (
              <div className="divide-y">
                {messages.map((message, index) => (
                  <MessageItem
                    key={`${message.info?.time?.created || index}-${index}`}
                    message={message}
                    getTimeAgo={getTimeAgo}
                    isCompact={isMaximized}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Session Monitor Side - Hidden when maximized */}
        {!isMaximized && (
          <div className="w-80 border-l flex flex-col">
            <div className="p-4 border-b bg-muted/50">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm">Sessions</h3>
                <Badge variant="secondary" className="text-xs">
                  {sessions.length}
                </Badge>
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-muted-foreground text-sm">Loading...</span>
                  </div>
                </div>
              ) : sessions.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm mb-1">No sessions</p>
                    <p className="text-xs opacity-75">Send a prompt to start</p>
                  </div>
                </div>
              ) : (
                <div className="divide-y">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors border-l-2 ${
                        currentSession?.id === session.id 
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20' 
                          : 'border-transparent'
                      }`}
                      onClick={() => handleSessionSelect(session)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-sm truncate">
                              {session.title || 'Untitled Session'}
                            </h3>
                            <Badge variant="outline" className="text-xs px-1.5 py-0.5 h-5">
                              {session.version}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Activity className="w-3 h-3" />
                            <span>Updated {getTimeAgo(session.time.updated)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Prompt Input Section - Now at the bottom */}
      <div className="border-t bg-muted/50">
        <div className={isMaximized ? 'p-2' : 'p-4'}>
          <div className={`flex ${isMaximized ? 'gap-2' : 'gap-4'}`}>
            <div className="flex-1">
              <div className="flex gap-2">
                <textarea
                  ref={promptRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter your prompt here... (Cmd/Ctrl+Enter to submit, or try /clear, /new)"
                  className={`flex-1 resize-none border rounded-md ${isMaximized ? 'p-2' : 'p-3'} text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 ${isMaximized ? 'min-h-[50px] max-h-[100px]' : 'min-h-[60px] max-h-[120px]'}`}
                  disabled={!tuiStatus.connected || isSubmitting}
                />
                <div className={`flex flex-col ${isMaximized ? 'gap-1' : 'gap-2'}`}>
                  <Button
                    onClick={submitPrompt}
                    disabled={!prompt.trim() || !tuiStatus.connected || isSubmitting}
                    size={isMaximized ? "sm" : "sm"}
                    className={isMaximized ? "gap-1 h-8" : "gap-2"}
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    {isMaximized ? 'Send' : (isSubmitting ? 'Sending...' : 'Send')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={clearPrompt}
                    disabled={isSubmitting}
                    size={isMaximized ? "sm" : "sm"}
                    className={isMaximized ? "gap-1 h-8" : "gap-2"}
                  >
                    <Square className="w-4 h-4" />
                    {isMaximized ? '' : 'Clear'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={newSession}
                    disabled={!tuiStatus.connected || isSubmitting}
                    size={isMaximized ? "sm" : "sm"}
                    className={isMaximized ? "gap-1 h-8" : "gap-2"}
                    title="Create a new session (same as typing /clear or /new)"
                  >
                    <PlusCircle className="w-4 h-4" />
                    {isMaximized ? '' : 'New Session'}
                  </Button>
                </div>
              </div>
              
              {error && (
                <div className="flex items-center gap-2 p-2 mt-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md text-xs">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span className="text-red-700 dark:text-red-300">{error}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}