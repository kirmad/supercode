import { useState, useEffect, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card" 
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import { 
  Terminal, 
  MessageSquare, 
  Settings, 
  Clock, 
  Hash, 
  Bot,
  Wrench,
  CheckCircle,
  XCircle,
  RefreshCw,
  Trash2,
  Filter,
  ChevronDown,
  ChevronRight,
  Copy
} from "lucide-react"

interface DebugLogEntry {
  id: string
  type: 'message_sent' | 'message_received' | 'tool_call_sent' | 'tool_call_result' | 'protocol_transaction' | 'system_event'
  timestamp: number
  sessionID: string
  messageID?: string
  // Message specific fields
  role?: 'user' | 'assistant' | 'system'
  content?: string
  providerID?: string
  modelID?: string
  streaming?: boolean
  // Tool call specific fields
  toolCallId?: string
  toolName?: string
  args?: Record<string, any>
  result?: string
  success?: boolean
  duration?: number
  // Protocol transaction fields
  direction?: 'request' | 'response'
  requestData?: Record<string, any>
  responseData?: Record<string, any>
  tokens?: {
    input: number
    output: number
    reasoning?: number
    cache?: { read: number, write: number }
  }
  cost?: number
  // System event fields
  event?: string
  details?: Record<string, any>
  metadata?: Record<string, any>
}

type LogType = 'all' | 'message_sent' | 'message_received' | 'tool_call_sent' | 'tool_call_result' | 'protocol_transaction' | 'system_event'

interface InteractionGroup {
  id: string
  messageID: string
  timestamp: number
  userPrompt?: string
  entries: DebugLogEntry[]
}

export function DebugLogsTab() {
  const [logs, setLogs] = useState<DebugLogEntry[]>([])
  const [groupedInteractions, setGroupedInteractions] = useState<InteractionGroup[]>([])
  const [sessions, setSessions] = useState<{id: string, title: string}[]>([])
  const [selectedSession, setSelectedSession] = useState<string>("")
  const [activeFilters, setActiveFilters] = useState<Set<LogType>>(
    new Set(['all'])
  )
  const [autoScroll, setAutoScroll] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set())
  const [expandedInteractions, setExpandedInteractions] = useState<Set<string>>(new Set())
  const [connected, setConnected] = useState(false)
  const logsAreaRef = useRef<HTMLDivElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    fetchSessions()
    if (autoRefresh) {
      setupEventStream()
      startRefreshInterval()
    }
    
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [autoRefresh])

  useEffect(() => {
    if (selectedSession) {
      fetchDebugLogs()
    }
  }, [selectedSession])

  useEffect(() => {
    // Group logs by interaction when logs change
    const grouped = groupLogsByInteraction(logs)
    setGroupedInteractions(grouped)
  }, [logs])

  useEffect(() => {
    if (autoScroll && logsAreaRef.current) {
      logsAreaRef.current.scrollTop = logsAreaRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  const fetchSessions = async () => {
    try {
      const response = await fetch(`${window.APP_CONFIG.apiUrl}/session`)
      if (response.ok) {
        const sessionsData = await response.json()
        setSessions(sessionsData.map((s: any) => ({id: s.id, title: s.title})))
        if (sessionsData.length > 0 && !selectedSession) {
          setSelectedSession(sessionsData[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error)
    }
  }

  const fetchDebugLogs = async () => {
    if (!selectedSession) return
    
    try {
      const response = await fetch(`${window.APP_CONFIG.apiUrl}/debug-logs/${selectedSession}`)
      if (response.ok) {
        const debugLogs = await response.json()
        setLogs(debugLogs)
      }
    } catch (error) {
      console.error('Failed to fetch debug logs:', error)
    }
  }

  const groupLogsByInteraction = (logs: DebugLogEntry[]): InteractionGroup[] => {
    const groups: InteractionGroup[] = []
    const groupMap = new Map<string, InteractionGroup>()

    // Sort logs by timestamp to ensure proper chronological order
    const sortedLogs = [...logs].sort((a, b) => a.timestamp - b.timestamp)

    for (const log of sortedLogs) {
      if (!log.messageID) continue

      let group = groupMap.get(log.messageID)
      
      if (!group) {
        // Find user prompt from message_sent logs with role 'user'
        const userPrompt = log.type === 'message_sent' && log.role === 'user' 
          ? log.content?.substring(0, 100) + (log.content && log.content.length > 100 ? '...' : '')
          : undefined

        group = {
          id: log.messageID,
          messageID: log.messageID,
          timestamp: log.timestamp,
          userPrompt,
          entries: []
        }
        
        groups.push(group)
        groupMap.set(log.messageID, group)
      }

      // Update user prompt if we find one and don't have it yet
      if (!group.userPrompt && log.type === 'message_sent' && log.role === 'user' && log.content) {
        group.userPrompt = log.content.substring(0, 100) + (log.content.length > 100 ? '...' : '')
      }

      group.entries.push(log)
      
      // Update group timestamp to earliest timestamp
      if (log.timestamp < group.timestamp) {
        group.timestamp = log.timestamp
      }
    }

    // Sort groups by timestamp (newest first)
    return groups.sort((a, b) => b.timestamp - a.timestamp)
  }

  const setupEventStream = () => {
    try {
      const eventSource = new EventSource(`${window.APP_CONFIG.apiUrl}/event`)
      eventSourceRef.current = eventSource
      
      eventSource.onopen = () => {
        setConnected(true)
      }
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'debug_logs.entry' && data.properties.sessionID === selectedSession) {
            setLogs(prev => [...prev, data.properties])
          }
        } catch (e) {
          console.error('Error parsing debug log event:', e)
        }
      }

      eventSource.onerror = () => {
        setConnected(false)
      }

    } catch (error) {
      console.error('Failed to setup event stream:', error)
    }
  }

  const startRefreshInterval = () => {
    refreshIntervalRef.current = setInterval(() => {
      if (selectedSession) {
        fetchDebugLogs()
      }
    }, 2000) // Refresh every 2 seconds
  }

  const clearLogs = async () => {
    if (!selectedSession) return
    
    try {
      await fetch(`${window.APP_CONFIG.apiUrl}/debug-logs/${selectedSession}`, {
        method: 'DELETE'
      })
      setLogs([])
    } catch (error) {
      console.error('Failed to clear logs:', error)
    }
  }

  const toggleFilter = (type: LogType) => {
    setActiveFilters(prev => {
      const newFilters = new Set(prev)
      if (type === 'all') {
        return new Set(['all'])
      }
      newFilters.delete('all')
      if (newFilters.has(type)) {
        newFilters.delete(type)
      } else {
        newFilters.add(type)
      }
      if (newFilters.size === 0) {
        newFilters.add('all')
      }
      return newFilters
    })
  }

  const toggleExpanded = (entryId: string) => {
    setExpandedEntries(prev => {
      const newSet = new Set(prev)
      if (newSet.has(entryId)) {
        newSet.delete(entryId)
      } else {
        newSet.add(entryId)
      }
      return newSet
    })
  }

  const toggleInteractionExpanded = (interactionId: string) => {
    setExpandedInteractions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(interactionId)) {
        newSet.delete(interactionId)
      } else {
        newSet.add(interactionId)
      }
      return newSet
    })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  const formatDuration = (duration: number) => {
    return `${duration}ms`
  }

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'message_sent': return <MessageSquare className="w-4 h-4" />
      case 'message_received': return <Bot className="w-4 h-4" />
      case 'tool_call_sent': return <Wrench className="w-4 h-4" />
      case 'tool_call_result': return <CheckCircle className="w-4 h-4" />
      case 'protocol_transaction': return <Settings className="w-4 h-4" />
      case 'system_event': return <Terminal className="w-4 h-4" />
      default: return <Hash className="w-4 h-4" />
    }
  }

  const getLogColor = (type: string) => {
    switch (type) {
      case 'message_sent': return 'text-blue-600 dark:text-blue-400'
      case 'message_received': return 'text-green-600 dark:text-green-400'
      case 'tool_call_sent': return 'text-yellow-600 dark:text-yellow-400'
      case 'tool_call_result': return 'text-purple-600 dark:text-purple-400'
      case 'protocol_transaction': return 'text-indigo-600 dark:text-indigo-400'
      case 'system_event': return 'text-gray-600 dark:text-gray-400'
      default: return 'text-gray-600 dark:text-gray-400'
    }
  }

  const filteredInteractions = groupedInteractions.map(interaction => ({
    ...interaction,
    entries: interaction.entries.filter(log => 
      activeFilters.has('all') || activeFilters.has(log.type as LogType)
    )
  })).filter(interaction => interaction.entries.length > 0)

  const renderInteractionGroup = (interaction: InteractionGroup) => {
    const isInteractionExpanded = expandedInteractions.has(interaction.id)
    const totalTokens = interaction.entries.reduce((sum, entry) => {
      if (entry.tokens) {
        return sum + entry.tokens.input + entry.tokens.output
      }
      return sum
    }, 0)
    
    const totalCost = interaction.entries.reduce((sum, entry) => sum + (entry.cost || 0), 0)
    
    const toolCalls = interaction.entries.filter(e => e.type === 'tool_call_sent')
    const hasErrors = interaction.entries.some(e => e.success === false)
    
    return (
      <Card key={interaction.id} className="mb-4 border-l-4" style={{
        borderLeftColor: hasErrors ? '#ef4444' : '#10b981'
      }}>
        {/* Interaction Header */}
        <div className="p-4 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleInteractionExpanded(interaction.id)}
                className="h-8 w-8 p-0"
              >
                {isInteractionExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </Button>
              
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-sm">
                  {interaction.userPrompt || `Interaction ${interaction.messageID.slice(0, 8)}...`}
                </span>
              </div>
              
              <Badge variant="outline" className="text-xs">
                {interaction.entries.length} events
              </Badge>
              
              {toolCalls.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  <Wrench className="w-3 h-3 mr-1" />
                  {toolCalls.length} tools
                </Badge>
              )}
              
              {hasErrors && (
                <Badge variant="destructive" className="text-xs">
                  <XCircle className="w-3 h-3 mr-1" />
                  Has Errors
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>[{formatTimestamp(interaction.timestamp)}]</span>
              {totalTokens > 0 && (
                <span>{totalTokens} tokens</span>
              )}
              {totalCost > 0 && (
                <span>${totalCost.toFixed(4)}</span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(JSON.stringify(interaction.entries, null, 2))}
                className="h-6 w-6 p-0"
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          </div>
          
          {!isInteractionExpanded && (
            <div className="mt-2 text-xs text-muted-foreground">
              <div className="flex flex-wrap gap-1">
                {interaction.entries.map((entry, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {entry.type.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Expanded interaction details */}
        {isInteractionExpanded && (
          <div className="p-4 space-y-3">
            {interaction.entries.map((entry, idx) => renderLogEntry(entry, idx))}
          </div>
        )}
      </Card>
    )
  }

  const renderLogEntry = (log: DebugLogEntry, index: number) => {
    const isExpanded = expandedEntries.has(log.id)
    
    return (
      <div key={log.id} className="border rounded-lg p-3 bg-background">
        <div className="flex items-start gap-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-muted-foreground font-mono">#{index + 1}</span>
            <div className={`flex-shrink-0 ${getLogColor(log.type)}`}>
              {getLogIcon(log.type)}
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {log.type.replace('_', ' ').toUpperCase()}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatTimestamp(log.timestamp)}
                </span>
                {log.duration && (
                  <Badge variant="secondary" className="text-xs">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatDuration(log.duration)}
                  </Badge>
                )}
                {log.success === false && (
                  <Badge variant="destructive" className="text-xs">
                    <XCircle className="w-3 h-3 mr-1" />
                    FAILED
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(JSON.stringify(log, null, 2))}
                  className="h-6 w-6 p-0"
                >
                  <Copy className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleExpanded(log.id)}
                  className="h-6 w-6 p-0"
                >
                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </Button>
              </div>
            </div>
            
            {/* Compact summary */}
            <div className="mt-1 text-sm">
              {log.type === 'message_sent' && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{log.role}</Badge>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-mono text-xs">{log.providerID}/{log.modelID}</span>
                </div>
              )}
              
              {log.type === 'tool_call_sent' && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{log.toolName}</Badge>
                  <span className="text-muted-foreground">Tool Call ID:</span>
                  <span className="font-mono text-xs">{log.toolCallId?.slice(0, 8)}...</span>
                </div>
              )}
              
              {log.type === 'protocol_transaction' && (
                <div className="flex items-center gap-2">
                  <Badge variant={log.direction === 'request' ? 'default' : 'secondary'}>
                    {log.direction?.toUpperCase()}
                  </Badge>
                  {log.tokens && (
                    <span className="text-xs text-muted-foreground">
                      {log.tokens.input}↑ {log.tokens.output}↓ tokens
                    </span>
                  )}
                  {log.cost && (
                    <span className="text-xs text-muted-foreground">
                      ${log.cost.toFixed(4)}
                    </span>
                  )}
                </div>
              )}
            </div>
            
            {/* Expanded details */}
            {isExpanded && (
              <div className="mt-3 space-y-3 text-xs">
                {log.content && (
                  <div>
                    <div className="font-semibold mb-1">Content:</div>
                    <div className="bg-muted p-2 rounded font-mono max-h-40 overflow-y-auto">
                      {log.content.length > 200 ? (
                        <MarkdownRenderer content={log.content} />
                      ) : (
                        log.content
                      )}
                    </div>
                  </div>
                )}
                
                {log.args && (
                  <div>
                    <div className="font-semibold mb-1">Arguments:</div>
                    <div className="bg-muted p-2 rounded font-mono">
                      <pre>{JSON.stringify(log.args, null, 2)}</pre>
                    </div>
                  </div>
                )}
                
                {log.result && (
                  <div>
                    <div className="font-semibold mb-1">Result:</div>
                    <div className="bg-muted p-2 rounded font-mono max-h-40 overflow-y-auto">
                      {log.result}
                    </div>
                  </div>
                )}
                
                {log.requestData && (
                  <div>
                    <div className="font-semibold mb-1">Request Data:</div>
                    <div className="bg-muted p-2 rounded font-mono">
                      <pre>{JSON.stringify(log.requestData, null, 2)}</pre>
                    </div>
                  </div>
                )}
                
                {log.responseData && (
                  <div>
                    <div className="font-semibold mb-1">Response Data:</div>
                    <div className="bg-muted p-2 rounded font-mono">
                      <pre>{JSON.stringify(log.responseData, null, 2)}</pre>
                    </div>
                  </div>
                )}
                
                {log.metadata && (
                  <div>
                    <div className="font-semibold mb-1">Metadata:</div>
                    <div className="bg-muted p-2 rounded font-mono">
                      <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Debug Logs - Protocol Transactions</h2>
          
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              connected ? 'bg-green-500' : 'bg-red-500'
            }`} />
            <span className="text-xs text-muted-foreground">
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        {/* Session selector */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Session:</label>
            <select 
              value={selectedSession} 
              onChange={(e) => setSelectedSession(e.target.value)}
              className="px-2 py-1 border rounded text-sm"
            >
              <option value="">Select a session</option>
              {sessions.map(session => (
                <option key={session.id} value={session.id}>
                  {session.title}
                </option>
              ))}
            </select>
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchDebugLogs}
            className="h-8"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={clearLogs}
            className="h-8"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Clear
          </Button>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between gap-4">
          {/* Filters */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            <div className="flex flex-wrap gap-1">
              {(['all', 'message_sent', 'message_received', 'tool_call_sent', 'tool_call_result', 'protocol_transaction', 'system_event'] as LogType[]).map(type => (
                <Button
                  key={type}
                  variant={activeFilters.has(type) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleFilter(type)}
                  className="text-xs h-7"
                >
                  {type.replace('_', ' ').toUpperCase()}
                </Button>
              ))}
            </div>
          </div>
          
          {/* Settings */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
                id="auto-refresh"
              />
              <label htmlFor="auto-refresh" className="text-sm">
                Auto-refresh
              </label>
            </div>
            
            <div className="flex items-center gap-2">
              <Switch
                checked={autoScroll}
                onCheckedChange={setAutoScroll}
                id="auto-scroll"
              />
              <label htmlFor="auto-scroll" className="text-sm">
                Auto-scroll
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Logs Area */}
      <div 
        ref={logsAreaRef}
        className="flex-1 overflow-y-auto p-4 bg-muted/30"
      >
        {!selectedSession ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <Terminal className="w-8 h-8 mx-auto mb-2" />
              <p>Select a session to view debug logs</p>
            </div>
          </div>
        ) : filteredInteractions.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="w-8 h-8 mx-auto mb-2" />
              <p>No debug logs for current filters</p>
              <p className="text-xs mt-1">Debug logs will appear here when the agent communicates with LLMs</p>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredInteractions.map(renderInteractionGroup)}
          </div>
        )}
      </div>
    </div>
  )
}