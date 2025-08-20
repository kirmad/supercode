import { useState, useEffect, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Terminal } from "lucide-react"

type LogLevel = 'error' | 'warn' | 'info' | 'debug'

interface LogEntry {
  id: string
  timestamp: string
  level: LogLevel
  message: string
}

export function LogsTab() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [activeFilters, setActiveFilters] = useState<Set<LogLevel>>(
    new Set(['error', 'warn', 'info', 'debug'])
  )
  const [autoScroll, setAutoScroll] = useState(true)
  const [connected, setConnected] = useState(false)
  const logsAreaRef = useRef<HTMLDivElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    setupLogStream()
    
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  useEffect(() => {
    if (autoScroll && logsAreaRef.current) {
      logsAreaRef.current.scrollTop = logsAreaRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  const setupLogStream = () => {
    try {
      addLogEntry('Connecting to event stream...', 'info')
      
      const eventSource = new EventSource(`${window.APP_CONFIG.apiUrl}/event`)
      eventSourceRef.current = eventSource
      
      eventSource.onopen = () => {
        setConnected(true)
        addLogEntry('Connected to event stream', 'info')
      }
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          const message = `${data.type}: ${JSON.stringify(data.properties)}`
          
          // Determine log level from the message content
          let level: LogLevel = 'info'
          const lowerMessage = (data.type || '').toLowerCase()
          if (lowerMessage.includes('error') || lowerMessage.includes('fail')) level = 'error'
          else if (lowerMessage.includes('warn') || lowerMessage.includes('warning')) level = 'warn'
          else if (lowerMessage.includes('debug') || lowerMessage.includes('trace')) level = 'debug'
          
          addLogEntry(message, level)
          
        } catch (e) {
          console.error('Error parsing log event:', e)
          addLogEntry('Error parsing log event', 'error')
        }
      }

      eventSource.onerror = (error) => {
        console.error('EventSource error:', error)
        setConnected(false)
        addLogEntry('Connection error - retrying...', 'error')
      }

    } catch (error) {
      console.error('Failed to setup log stream:', error)
      addLogEntry('Failed to setup log stream', 'error')
    }
  }

  const addLogEntry = (message: string, level: LogLevel) => {
    const timestamp = new Date().toLocaleTimeString()
    const entry: LogEntry = {
      id: Date.now().toString() + Math.random(),
      timestamp,
      level,
      message
    }
    
    setLogs(prev => {
      const newLogs = [...prev, entry]
      // Limit to last 200 entries
      return newLogs.slice(-200)
    })
  }

  const toggleFilter = (level: LogLevel) => {
    setActiveFilters(prev => {
      const newFilters = new Set(prev)
      if (newFilters.has(level)) {
        newFilters.delete(level)
      } else {
        newFilters.add(level)
      }
      return newFilters
    })
  }

  const filteredLogs = logs.filter(log => activeFilters.has(log.level))

  const getLevelColor = (level: LogLevel) => {
    switch (level) {
      case 'error': return 'text-red-600 dark:text-red-400'
      case 'warn': return 'text-yellow-600 dark:text-yellow-400'
      case 'info': return 'text-blue-600 dark:text-blue-400'
      case 'debug': return 'text-gray-600 dark:text-gray-400'
      default: return 'text-gray-600 dark:text-gray-400'
    }
  }

  const getFilterButtonClass = (level: LogLevel, isActive: boolean) => {
    const baseClass = "text-xs px-2 py-1 rounded border transition-colors"
    
    if (isActive) {
      switch (level) {
        case 'error': return `${baseClass} bg-red-100 border-red-300 text-red-800 dark:bg-red-900 dark:border-red-700 dark:text-red-200`
        case 'warn': return `${baseClass} bg-yellow-100 border-yellow-300 text-yellow-800 dark:bg-yellow-900 dark:border-yellow-700 dark:text-yellow-200`
        case 'info': return `${baseClass} bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900 dark:border-blue-700 dark:text-blue-200`
        case 'debug': return `${baseClass} bg-gray-100 border-gray-300 text-gray-800 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200`
      }
    }
    
    return `${baseClass} bg-background border-border text-muted-foreground hover:bg-accent`
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium">Logs</h2>
          
          <div className="flex items-center gap-4">
            {/* Filters */}
            <div className="flex gap-1">
              {(['error', 'warn', 'info', 'debug'] as LogLevel[]).map(level => (
                <button
                  key={level}
                  onClick={() => toggleFilter(level)}
                  className={getFilterButtonClass(level, activeFilters.has(level))}
                >
                  {level.toUpperCase()}
                </button>
              ))}
            </div>
            
            {/* Auto-scroll toggle */}
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
            
            {/* Connection status */}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                connected ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className="text-xs text-muted-foreground">
                {connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Logs Area */}
      <div 
        ref={logsAreaRef}
        className="flex-1 overflow-y-auto p-2 bg-muted/30 font-mono text-sm"
      >
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <Terminal className="w-8 h-8 mx-auto mb-2" />
              <p>No logs matching current filters</p>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredLogs.map(log => (
              <div key={log.id} className="flex gap-2 text-xs leading-relaxed">
                <span className="text-muted-foreground shrink-0">
                  [{log.timestamp}]
                </span>
                <Badge 
                  variant="outline" 
                  className={`shrink-0 text-xs h-auto py-0 ${getLevelColor(log.level)}`}
                >
                  {log.level.toUpperCase()}
                </Badge>
                <span className="text-foreground break-all">
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}