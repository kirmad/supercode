import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  MessageSquare, 
  ChevronRight, 
  ArrowLeft, 
  User, 
  Bot, 
  Settings,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Calendar,
  Clock
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

type ViewMode = 'list' | 'detail'

export function SessionsTab() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedMessages, setExpandedMessages] = useState<Set<number>>(new Set())
  const [compactView, setCompactView] = useState(true)

  useEffect(() => {
    if (viewMode === 'list') {
      loadSessions()
    }
  }, [viewMode])

  const loadSessions = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`${window.APP_CONFIG.apiUrl}/session`)
      if (!response.ok) throw new Error('Failed to fetch sessions')
      
      const sessionsData = await response.json()
      setSessions(sessionsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }

  const loadSessionDetail = async (sessionId: string) => {
    setLoading(true)
    setError(null)
    
    try {
      const [sessionResponse, messagesResponse] = await Promise.all([
        fetch(`${window.APP_CONFIG.apiUrl}/session/${sessionId}`),
        fetch(`${window.APP_CONFIG.apiUrl}/session/${sessionId}/message`)
      ])
      
      if (!sessionResponse.ok || !messagesResponse.ok) {
        throw new Error('Failed to fetch session details')
      }
      
      const sessionData = await sessionResponse.json()
      const messagesData = await messagesResponse.json()
      
      setSelectedSession(sessionData)
      setMessages(messagesData)
      setViewMode('detail')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session details')
    } finally {
      setLoading(false)
    }
  }

  const backToList = () => {
    setViewMode('list')
    setSelectedSession(null)
    setMessages([])
  }

  const getTimeAgo = (dateString: string) => {
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
  }

  const formatMessageText = (text: string, isPreview = false) => {
    if (!text) return ''
    
    if (isPreview) {
      // Show only first line for preview
      const firstLine = text.split('\n')[0]
      return firstLine.length > 100 ? firstLine.substring(0, 100) + '...' : firstLine
    }
    
    return text
      .split('\n\n')
      .map((paragraph, i) => (
        <p key={i} className="mb-2 last:mb-0 leading-relaxed">
          {paragraph.split('\n').map((line, j) => (
            <span key={j}>
              {line}
              {j < paragraph.split('\n').length - 1 && <br />}
            </span>
          ))}
        </p>
      ))
  }

  const toggleMessageExpansion = (index: number) => {
    const newExpanded = new Set(expandedMessages)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedMessages(newExpanded)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-3">
          <div className="spinner"></div>
          <span className="text-muted-foreground">
            {viewMode === 'list' ? 'Loading sessions...' : 'Loading session details...'}
          </span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-lg mb-2">Error loading sessions</p>
          <p className="text-sm mb-4">{error}</p>
          <Button onClick={viewMode === 'list' ? loadSessions : backToList}>
            {viewMode === 'list' ? 'Retry' : 'Back to Sessions'}
          </Button>
        </div>
      </div>
    )
  }

  if (viewMode === 'detail' && selectedSession) {
    return (
      <div className="h-full flex flex-col">
        {/* Compact Header */}
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-3 p-4">
            <Button variant="ghost" size="sm" onClick={backToList} className="gap-1 text-xs">
              <ArrowLeft className="h-3 w-3" />
              Sessions
            </Button>
            <div className="h-4 w-px bg-border" />
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm truncate">
                {selectedSession.title || 'Untitled Session'}
              </h3>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {getTimeAgo(selectedSession.time.created)}
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setCompactView(!compactView)}
              className="text-xs"
            >
              {compactView ? 'Expand' : 'Compact'}
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No messages</p>
              </div>
            </div>
          ) : (
            <div className={`divide-y ${compactView ? 'divide-border/50' : ''}`}>
              {messages.map((message, index) => {
                const { info, parts } = message
                const isUser = info.role === 'user'
                const isAssistant = info.role === 'assistant'
                const isExpanded = expandedMessages.has(index)
                const textParts = parts.filter(p => p.type === 'text')
                const hasLongContent = textParts.some(p => (p.text || '').length > 100)
                
                return (
                  <div key={index} className={`${
                    compactView ? 'py-2 px-4' : 'p-4'
                  } hover:bg-muted/30 transition-colors`}>
                    <div className="flex gap-3">
                      {/* Compact Avatar */}
                      <div className="flex-shrink-0 mt-0.5">
                        <div className={`${
                          compactView ? 'w-6 h-6' : 'w-8 h-8'
                        } rounded-full flex items-center justify-center border ${
                          isUser 
                            ? 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800' 
                            : isAssistant 
                            ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800' 
                            : 'bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-700'
                        }`}>
                          {isUser ? (
                            <User className={`${
                              compactView ? 'w-3 h-3' : 'w-4 h-4'
                            } text-blue-600 dark:text-blue-400`} />
                          ) : isAssistant ? (
                            <Bot className={`${
                              compactView ? 'w-3 h-3' : 'w-4 h-4'
                            } text-emerald-600 dark:text-emerald-400`} />
                          ) : (
                            <Settings className={`${
                              compactView ? 'w-3 h-3' : 'w-4 h-4'
                            } text-gray-500`} />
                          )}
                        </div>
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Header Row */}
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`font-medium ${
                            compactView ? 'text-xs' : 'text-sm'
                          } ${
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
                          {compactView && hasLongContent && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleMessageExpansion(index)}
                              className="h-5 w-5 p-0 ml-auto"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </Button>
                          )}
                        </div>
                        
                        {/* Message Content */}
                        {textParts.map((part, partIndex) => {
                          const shouldShowPreview = compactView && hasLongContent && !isExpanded
                          
                          return (
                            <div key={partIndex} className={`${
                              compactView ? 'text-sm' : 'text-sm'
                            } text-foreground/90 leading-relaxed`}>
                              {shouldShowPreview ? (
                                <div className="space-y-1">
                                  <p className="text-muted-foreground">
                                    {formatMessageText(part.text || '', true)}
                                  </p>
                                  <Button
                                    variant="link"
                                    size="sm"
                                    onClick={() => toggleMessageExpansion(index)}
                                    className="h-auto p-0 text-xs text-primary"
                                  >
                                    Show more
                                  </Button>
                                </div>
                              ) : (
                                <div className="prose prose-sm max-w-none dark:prose-invert">
                                  {formatMessageText(part.text || '')}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  // List view
  return (
    <div className="h-full flex flex-col">
      {/* Compact Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Sessions</h2>
            <Badge variant="secondary" className="text-xs">
              {sessions.length}
            </Badge>
          </div>
        </div>
      </div>
        
      {/* Sessions List */}
      <div className="flex-1 overflow-auto">
        {sessions.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm mb-1">No sessions</p>
              <p className="text-xs opacity-75">Start a conversation to begin</p>
            </div>
          </div>
        ) : (
          <div className="divide-y">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="p-3 cursor-pointer hover:bg-muted/50 transition-colors border-l-2 border-transparent hover:border-primary/20"
                onClick={() => loadSessionDetail(session.id)}
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
                      <Clock className="w-3 h-3" />
                      <span>Updated {getTimeAgo(session.time.updated)}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}