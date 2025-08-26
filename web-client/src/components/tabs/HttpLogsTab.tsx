import { useState, useEffect, useRef, useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card" 
import { Switch } from "@/components/ui/switch"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Globe, Clock, ArrowUpRight, ArrowDownLeft, Filter, RefreshCw, Eye, MessageSquare, ChevronDown, Calendar } from "lucide-react"
import { AIContentVisualization, isAIContent } from "../ai-content-visualization"

interface HttpLogEntry {
  id: string
  timestamp: number
  sessionID: string
  messageID: string
  direction: "request" | "response"
  providerID: string
  modelID: string
  data: {
    type: "raw_http_request" | "raw_http_response"
    url: string
    method: string
    headers?: Record<string, string>
    requestHeaders?: Record<string, string>
    responseHeaders?: Record<string, string>
    body?: string
    requestBody?: string
    responseBody?: string
    status?: number
    statusText?: string
    duration?: number
    bodySize?: number
    requestBodySize?: number
    responseBodySize?: number
  }
}

interface Session {
  id: string
  title?: string
  version: string
  time: {
    created: string
    updated: string
  }
}

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD"
type StatusRange = "2xx" | "3xx" | "4xx" | "5xx" | "all"

export function HttpLogsTab() {
  const [logs, setLogs] = useState<HttpLogEntry[]>([])
  const [filteredLogs, setFilteredLogs] = useState<HttpLogEntry[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<string>("all")
  const [selectedMethods, setSelectedMethods] = useState<Set<HttpMethod>>(
    new Set(["GET", "POST", "PUT", "DELETE", "PATCH"])
  )
  const [selectedStatus, setSelectedStatus] = useState<StatusRange>("all")
  const [selectedProvider, setSelectedProvider] = useState<string>("all")
  const [autoScroll, setAutoScroll] = useState(true)
  const [showRequestBodies, setShowRequestBodies] = useState(true)
  const [showResponseBodies, setShowResponseBodies] = useState(true)
  const [showSessionSelector, setShowSessionSelector] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rawViewState, setRawViewState] = useState<Map<string, boolean>>(new Map())
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const sessionSelectorRef = useRef<HTMLDivElement>(null)

  // Fetch sessions from the API
  const fetchSessions = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`${window.APP_CONFIG?.apiUrl || 'http://localhost:3000'}/session`)
      if (!response.ok) {
        throw new Error('Failed to fetch sessions')
      }
      
      const sessionsData = await response.json()
      setSessions(sessionsData || [])
    } catch (err) {
      console.error('Error fetching sessions:', err)
      setError(err instanceof Error ? err.message : 'Failed to load sessions')
      setSessions([])
    } finally {
      setLoading(false)
    }
  }

  // Fetch HTTP logs from the API
  const fetchHttpLogs = async (sessionId?: string) => {
    try {
      setLoading(true)
      setError(null)
      
      let url = `${window.APP_CONFIG?.apiUrl || 'http://localhost:3000'}/http-logs`
      if (sessionId && sessionId !== 'all') {
        url = `${window.APP_CONFIG?.apiUrl || 'http://localhost:3000'}/http-logs/${sessionId}`
      }
      
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Failed to fetch HTTP logs')
      }
      
      const entries: HttpLogEntry[] = await response.json()
      setLogs(entries || [])
      setError(null)
    } catch (error) {
      console.error('Error fetching HTTP logs:', error)
      setError(error instanceof Error ? error.message : 'Failed to load HTTP logs')
      // For demo purposes, we'll use sample data
      setSampleData()
    } finally {
      setLoading(false)
    }
  }

  // Sample data for demonstration
  const setSampleData = () => {
    const sampleLogs: HttpLogEntry[] = [
      {
        id: "1",
        timestamp: Date.now() - 5000,
        sessionID: "session-1",
        messageID: "msg-1", 
        direction: "request",
        providerID: "github-copilot",
        modelID: "gpt-4o",
        data: {
          type: "raw_http_request",
          url: "https://api.github.com/copilot_internal/v2/token",
          method: "GET",
          headers: {
            "Accept": "application/json",
            "Authorization": "Bearer ghu_***",
            "User-Agent": "GitHubCopilotChat/0.26.7"
          },
          bodySize: 0
        }
      },
      {
        id: "2",
        timestamp: Date.now() - 4500,
        sessionID: "session-1",
        messageID: "msg-1",
        direction: "response",
        providerID: "github-copilot",
        modelID: "gpt-4o",
        data: {
          type: "raw_http_response",
          url: "https://api.github.com/copilot_internal/v2/token",
          method: "GET",
          requestHeaders: {
            "Accept": "application/json",
            "Authorization": "Bearer ghu_***",
            "User-Agent": "GitHubCopilotChat/0.26.7"
          },
          status: 200,
          statusText: "OK",
          responseHeaders: {
            "content-type": "application/json",
            "x-ratelimit-remaining": "4999"
          },
          responseBody: '{"token": "***", "expires_at": 1756183114}',
          duration: 340,
          requestBodySize: 0,
          responseBodySize: 156
        }
      }
    ]
    setLogs(sampleLogs)
  }

  // Apply filters to logs
  useEffect(() => {
    let filtered = logs

    // Filter by session (client-side filtering for "all" case)
    if (selectedSession !== "all") {
      filtered = filtered.filter(log => log.sessionID === selectedSession)
    }

    // Filter by HTTP method
    if (selectedMethods.size > 0) {
      filtered = filtered.filter(log => 
        selectedMethods.has(log.data.method as HttpMethod)
      )
    }

    // Filter by status code range
    if (selectedStatus !== "all") {
      filtered = filtered.filter(log => {
        const status = log.data.status
        if (!status) return selectedStatus === "2xx" // Assume success for requests
        
        switch (selectedStatus) {
          case "2xx": return status >= 200 && status < 300
          case "3xx": return status >= 300 && status < 400
          case "4xx": return status >= 400 && status < 500
          case "5xx": return status >= 500
          default: return true
        }
      })
    }

    // Filter by provider
    if (selectedProvider !== "all") {
      filtered = filtered.filter(log => log.providerID === selectedProvider)
    }

    setFilteredLogs(filtered)
  }, [logs, selectedSession, selectedMethods, selectedStatus, selectedProvider])

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && scrollAreaRef.current) {
      // ScrollArea uses a viewport div internally
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight
      }
    }
  }, [filteredLogs, autoScroll])

  // Load sessions and logs on component mount
  useEffect(() => {
    fetchSessions()
    fetchHttpLogs()
  }, [])

  // Reload logs when session selection changes
  useEffect(() => {
    fetchHttpLogs(selectedSession)
  }, [selectedSession])

  // Set up periodic refresh for logs
  useEffect(() => {
    const interval = setInterval(() => {
      fetchHttpLogs(selectedSession)
    }, 3000) // Refresh every 3 seconds
    return () => clearInterval(interval)
  }, [selectedSession])

  // Close session selector when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sessionSelectorRef.current && !sessionSelectorRef.current.contains(event.target as Node)) {
        setShowSessionSelector(false)
      }
    }

    if (showSessionSelector) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSessionSelector])

  // Get unique providers for filtering
  const providers = useMemo(() => {
    const uniqueProviders = new Set(logs.map(log => log.providerID))
    return Array.from(uniqueProviders)
  }, [logs])

  // Helper functions
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString()
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

  const handleSessionChange = (sessionId: string) => {
    setSelectedSession(sessionId)
    setShowSessionSelector(false)
  }

  const getSelectedSessionInfo = () => {
    if (selectedSession === 'all') return 'All Sessions'
    const session = sessions.find(s => s.id === selectedSession)
    return session ? (session.title || 'Untitled Session') : 'Unknown Session'
  }

  const getStatusColor = (status?: number) => {
    if (!status) return "text-blue-600 dark:text-blue-400"
    if (status >= 200 && status < 300) return "text-green-600 dark:text-green-400"
    if (status >= 300 && status < 400) return "text-yellow-600 dark:text-yellow-400"
    if (status >= 400) return "text-red-600 dark:text-red-400"
    return "text-gray-600 dark:text-gray-400"
  }

  const getMethodColor = (method: string) => {
    switch (method) {
      case "GET": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "POST": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      case "PUT": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
      case "DELETE": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      case "PATCH": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    }
  }

  const formatHeaders = (headers?: Record<string, string>) => {
    if (!headers) return null
    
    return (
      <div className="space-y-1">
        {Object.entries(headers).map(([key, value]) => (
          <div key={key} className="flex flex-wrap gap-2 text-xs">
            <span className="font-mono font-medium text-blue-600 dark:text-blue-400">
              {key}:
            </span>
            <span className="font-mono break-all">
              {key.toLowerCase().includes('authorization') ? 
                value.replace(/Bearer\s+(.{10})[^,]*/, 'Bearer $1***') : 
                value
              }
            </span>
          </div>
        ))}
      </div>
    )
  }

  const formatBody = (body?: string, contentType?: string, logId?: string, bodyType?: "request" | "response") => {
    if (!body) return "Empty body"
    
    try {
      // Try to parse JSON for AI content detection
      if (contentType?.includes('json') || body.trim().startsWith('{')) {
        const parsed = JSON.parse(body)
        
        // Check if this is AI-related content
        if (isAIContent(parsed) && logId && bodyType) {
          const viewKey = `${logId}-${bodyType}`
          const showRaw = rawViewState.get(viewKey) || false
          
          const toggleRaw = () => {
            setRawViewState(prev => {
              const newMap = new Map(prev)
              newMap.set(viewKey, !showRaw)
              return newMap
            })
          }
          
          return (
            <AIContentVisualization
              content={parsed}
              type={bodyType}
              showRaw={showRaw}
              onToggleRaw={toggleRaw}
            />
          )
        }
        
        // Fall back to formatted JSON for non-AI content
        return (
          <pre className="text-xs overflow-auto max-h-64 bg-muted/50 p-2 rounded">
            {JSON.stringify(parsed, null, 2)}
          </pre>
        )
      }
    } catch {
      // Fall back to raw text
    }
    
    return (
      <pre className="text-xs overflow-x-auto bg-muted/50 p-2 rounded whitespace-pre-wrap">
        {body.length > 1000 ? `${body.substring(0, 1000)}...\n[truncated]` : body}
      </pre>
    )
  }

  const toggleMethod = (method: HttpMethod) => {
    setSelectedMethods(prev => {
      const newMethods = new Set(prev)
      if (newMethods.has(method)) {
        newMethods.delete(method)
      } else {
        newMethods.add(method)
      }
      return newMethods
    })
  }

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* Header with filters */}
      <div className="flex-shrink-0 p-4 border-b space-y-4 bg-background">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-medium flex items-center gap-2">
              <Globe className="w-5 h-5" />
              HTTP Request Logs
            </h2>
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="spinner w-3 h-3"></div>
                <span>Loading...</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {/* Session Selector */}
            <div className="relative" ref={sessionSelectorRef}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSessionSelector(!showSessionSelector)}
                className="gap-2 min-w-[140px] justify-between"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  <span className="truncate">{getSelectedSessionInfo()}</span>
                </div>
                <ChevronDown className="w-3 h-3" />
              </Button>
              
              {showSessionSelector && (
                <div className="absolute top-full right-0 mt-1 w-64 bg-background border rounded-md shadow-lg z-50">
                  <div className="max-h-64 overflow-y-auto">
                    <div className="p-2">
                      <Button
                        variant={selectedSession === 'all' ? 'default' : 'ghost'}
                        size="sm"
                        className="w-full justify-start mb-1"
                        onClick={() => handleSessionChange('all')}
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        All Sessions
                      </Button>
                      <div className="border-t pt-2 mt-2">
                        {sessions.length === 0 ? (
                          <div className="text-sm text-muted-foreground p-2 text-center">
                            No sessions found
                          </div>
                        ) : (
                          sessions.map((session) => (
                            <Button
                              key={session.id}
                              variant={selectedSession === session.id ? 'default' : 'ghost'}
                              size="sm"
                              className="w-full justify-start mb-1"
                              onClick={() => handleSessionChange(session.id)}
                            >
                              <div className="flex flex-col items-start flex-1 min-w-0">
                                <div className="flex items-center gap-2 w-full">
                                  <span className="truncate flex-1">
                                    {session.title || 'Untitled Session'}
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    {session.version}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Calendar className="w-3 h-3" />
                                  {getTimeAgo(session.time.updated)}
                                </div>
                              </div>
                            </Button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Auto-scroll toggle */}
            <div className="flex items-center gap-2">
              <Switch
                checked={autoScroll}
                onCheckedChange={setAutoScroll}
                id="auto-scroll-http"
              />
              <label htmlFor="auto-scroll-http" className="text-sm">
                Auto-scroll
              </label>
            </div>

            {/* Refresh button */}
            <Button
              variant="outline" 
              size="sm"
              onClick={() => {
                fetchSessions()
                fetchHttpLogs(selectedSession)
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {/* HTTP Methods */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            <span className="font-medium">Methods:</span>
            {(["GET", "POST", "PUT", "DELETE", "PATCH"] as HttpMethod[]).map(method => (
              <button
                key={method}
                onClick={() => toggleMethod(method)}
                className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                  selectedMethods.has(method) 
                    ? getMethodColor(method)
                    : "bg-background border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                {method}
              </button>
            ))}
          </div>

          {/* Status codes */}
          <div className="flex items-center gap-2">
            <span className="font-medium">Status:</span>
            {(["all", "2xx", "3xx", "4xx", "5xx"] as StatusRange[]).map(status => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-2 py-1 rounded text-xs border transition-colors ${
                  selectedStatus === status
                    ? "bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900 dark:border-blue-700 dark:text-blue-200"
                    : "bg-background border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Provider filter */}
          {providers.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="font-medium">Provider:</span>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="px-2 py-1 rounded text-xs border bg-background"
              >
                <option value="all">All</option>
                {providers.map(provider => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Body visibility toggles */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={showRequestBodies}
                onCheckedChange={setShowRequestBodies}
                id="show-req-bodies"
              />
              <label htmlFor="show-req-bodies" className="text-xs">
                Request Bodies
              </label>
            </div>
            
            <div className="flex items-center gap-2">
              <Switch
                checked={showResponseBodies}
                onCheckedChange={setShowResponseBodies}
                id="show-res-bodies"
              />
              <label htmlFor="show-res-bodies" className="text-xs">
                Response Bodies
              </label>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Total: {logs.length} requests</span>
            <span>Filtered: {filteredLogs.length} shown</span>
            {selectedSession !== 'all' && (
              <span>Session: {selectedSession.substring(0, 8)}...</span>
            )}
          </div>
          
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
              <span>⚠️ {error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Logs Area */}
      <div className="flex-1 min-h-0 relative">
        <ScrollArea className="h-full w-full" ref={scrollAreaRef}>
          <div className="p-4 space-y-3">
          {filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <div className="text-center">
                <Globe className="w-8 h-8 mx-auto mb-2" />
                <p>No HTTP requests matching current filters</p>
              </div>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <Card key={log.id} className="p-4 overflow-hidden">
                <div className="space-y-3 min-w-0">
                  {/* Request/Response Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {log.direction === "request" ? (
                        <ArrowUpRight className="w-4 h-4 text-blue-600" />
                      ) : (
                        <ArrowDownLeft className="w-4 h-4 text-green-600" />
                      )}
                      
                      <Badge className={getMethodColor(log.data.method)}>
                        {log.data.method}
                      </Badge>
                      
                      {log.data.status && (
                        <Badge 
                          variant="outline" 
                          className={getStatusColor(log.data.status)}
                        >
                          {log.data.status} {log.data.statusText}
                        </Badge>
                      )}
                      
                      <span className="text-sm font-medium text-muted-foreground">
                        {log.direction}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimestamp(log.timestamp)}
                      </div>
                      {log.data.duration && (
                        <span>{log.data.duration}ms</span>
                      )}
                    </div>
                  </div>

                  {/* URL */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-medium">URL:</span>
                    <code className="text-xs bg-muted px-2 py-1 rounded font-mono break-all">
                      {log.data.url}
                    </code>
                  </div>

                  {/* Session/Message correlation */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Session: {log.sessionID.substring(0, 8)}...</span>
                    <span>Message: {log.messageID.substring(0, 8)}...</span>
                    <span>Provider: {log.providerID}</span>
                  </div>

                  {/* Expandable Details */}
                  <Accordion type="single" collapsible className="w-full">
                    {/* Headers */}
                    <AccordionItem value="headers">
                      <AccordionTrigger className="text-sm py-2">
                        <span className="flex items-center gap-2">
                          <Eye className="w-4 h-4" />
                          Headers ({Object.keys(log.data.headers || log.data.requestHeaders || log.data.responseHeaders || {}).length})
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        {log.direction === "request" && (
                          <div>
                            <h5 className="font-medium text-xs mb-2">Request Headers</h5>
                            {formatHeaders(log.data.headers)}
                          </div>
                        )}
                        {log.direction === "response" && (
                          <>
                            {log.data.requestHeaders && (
                              <div className="mb-4">
                                <h5 className="font-medium text-xs mb-2">Request Headers</h5>
                                {formatHeaders(log.data.requestHeaders)}
                              </div>
                            )}
                            <div>
                              <h5 className="font-medium text-xs mb-2">Response Headers</h5>
                              {formatHeaders(log.data.responseHeaders)}
                            </div>
                          </>
                        )}
                      </AccordionContent>
                    </AccordionItem>

                    {/* Request Body */}
                    {((log.direction === "request" && log.data.body) || 
                      (log.direction === "response" && log.data.requestBody)) && 
                      showRequestBodies && (
                      <AccordionItem value="request-body">
                        <AccordionTrigger className="text-sm py-2">
                          <span className="flex items-center gap-2">
                            Request Body ({log.data.bodySize || log.data.requestBodySize || 0} bytes)
                          </span>
                        </AccordionTrigger>
                        <AccordionContent>
                          {formatBody(
                            log.data.body || log.data.requestBody,
                            log.data.headers?.["content-type"] || log.data.requestHeaders?.["content-type"],
                            log.id,
                            "request"
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    )}

                    {/* Response Body */}
                    {log.direction === "response" && log.data.responseBody && showResponseBodies && (
                      <AccordionItem value="response-body">
                        <AccordionTrigger className="text-sm py-2">
                          <span className="flex items-center gap-2">
                            Response Body ({log.data.responseBodySize || 0} bytes)
                          </span>
                        </AccordionTrigger>
                        <AccordionContent>
                          {formatBody(
                            log.data.responseBody,
                            log.data.responseHeaders?.["content-type"],
                            log.id,
                            "response"
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    )}
                  </Accordion>
                </div>
              </Card>
            ))
          )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}