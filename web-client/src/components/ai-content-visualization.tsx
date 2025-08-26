import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import { 
  User, 
  Bot, 
  Settings, 
  Wrench, 
  ChevronDown, 
  ChevronRight,
  MessageSquare,
  Eye,
  EyeOff
} from "lucide-react"

interface Message {
  role: "user" | "assistant" | "system" | "tool"
  content: string | any[]
  name?: string
  tool_calls?: ToolCall[]
  tool_call_id?: string
}

interface ToolCall {
  id: string
  type: "function"
  function: {
    name: string
    arguments: string
  }
}

interface AIRequestContent {
  model?: string
  messages?: Message[]
  tools?: any[]
  temperature?: number
  max_tokens?: number
  stream?: boolean
  [key: string]: any
}

interface AIResponseContent {
  id?: string
  object?: string
  model?: string
  choices?: Array<{
    index: number
    message?: Message
    delta?: Message
    finish_reason?: string
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
  [key: string]: any
}

interface AIContentVisualizationProps {
  content: AIRequestContent | AIResponseContent | any
  type: "request" | "response"
  showRaw?: boolean
  onToggleRaw?: () => void
}

export function AIContentVisualization({ content, type, showRaw = false, onToggleRaw }: AIContentVisualizationProps) {
  if (showRaw) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Raw JSON</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleRaw}
            className="h-6 px-2"
          >
            <Eye className="w-3 h-3 mr-1" />
            Structured
          </Button>
        </div>
        <pre className="text-xs overflow-auto max-h-64 bg-muted/50 p-2 rounded">
          {JSON.stringify(content, null, 2)}
        </pre>
      </div>
    )
  }

  if (type === "request") {
    return <AIRequestVisualization content={content} onToggleRaw={onToggleRaw} />
  }

  return <AIResponseVisualization content={content} onToggleRaw={onToggleRaw} />
}

function AIRequestVisualization({ content, onToggleRaw }: { content: AIRequestContent, onToggleRaw?: () => void }) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["messages"]))

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(section)) {
        newSet.delete(section)
      } else {
        newSet.add(section)
      }
      return newSet
    })
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium">AI Request</span>
          {content.model && (
            <Badge variant="outline" className="text-xs">
              {content.model}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleRaw}
          className="h-6 px-2"
        >
          <EyeOff className="w-3 h-3 mr-1" />
          Raw
        </Button>
      </div>

      {/* Model Parameters */}
      {(content.temperature !== undefined || content.max_tokens || content.stream !== undefined) && (
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="w-3 h-3 text-gray-500" />
            <span className="text-xs font-medium">Parameters</span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {content.temperature !== undefined && (
              <Badge variant="secondary">temp: {content.temperature}</Badge>
            )}
            {content.max_tokens && (
              <Badge variant="secondary">max_tokens: {content.max_tokens}</Badge>
            )}
            {content.stream !== undefined && (
              <Badge variant="secondary">stream: {content.stream.toString()}</Badge>
            )}
          </div>
        </Card>
      )}

      {/* Messages */}
      {content.messages && (
        <Collapsible
          open={expandedSections.has("messages")}
          onOpenChange={() => toggleSection("messages")}
        >
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-2 h-auto">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                <span className="text-sm font-medium">Messages ({content.messages.length})</span>
              </div>
              {expandedSections.has("messages") ? 
                <ChevronDown className="w-4 h-4" /> : 
                <ChevronRight className="w-4 h-4" />
              }
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2">
            {content.messages.map((message, index) => (
              <MessageVisualization key={index} message={message} />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Tools */}
      {content.tools && content.tools.length > 0 && (
        <Collapsible
          open={expandedSections.has("tools")}
          onOpenChange={() => toggleSection("tools")}
        >
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-2 h-auto">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4" />
                <span className="text-sm font-medium">Available Tools ({content.tools.length})</span>
              </div>
              {expandedSections.has("tools") ? 
                <ChevronDown className="w-4 h-4" /> : 
                <ChevronRight className="w-4 h-4" />
              }
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2">
            {content.tools.map((tool, index) => (
              <ToolVisualization key={index} tool={tool} />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}

function AIResponseVisualization({ content, onToggleRaw }: { content: AIResponseContent, onToggleRaw?: () => void }) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["choices"]))

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(section)) {
        newSet.delete(section)
      } else {
        newSet.add(section)
      }
      return newSet
    })
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-green-500" />
          <span className="text-sm font-medium">AI Response</span>
          {content.model && (
            <Badge variant="outline" className="text-xs">
              {content.model}
            </Badge>
          )}
          {content.id && (
            <Badge variant="secondary" className="text-xs">
              {content.id.substring(0, 8)}...
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleRaw}
          className="h-6 px-2"
        >
          <EyeOff className="w-3 h-3 mr-1" />
          Raw
        </Button>
      </div>

      {/* Usage Information */}
      {content.usage && (
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="w-3 h-3 text-gray-500" />
            <span className="text-xs font-medium">Token Usage</span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {content.usage.prompt_tokens && (
              <Badge variant="secondary">prompt: {content.usage.prompt_tokens}</Badge>
            )}
            {content.usage.completion_tokens && (
              <Badge variant="secondary">completion: {content.usage.completion_tokens}</Badge>
            )}
            {content.usage.total_tokens && (
              <Badge variant="secondary">total: {content.usage.total_tokens}</Badge>
            )}
          </div>
        </Card>
      )}

      {/* Choices */}
      {content.choices && (
        <Collapsible
          open={expandedSections.has("choices")}
          onOpenChange={() => toggleSection("choices")}
        >
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-2 h-auto">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                <span className="text-sm font-medium">Choices ({content.choices.length})</span>
              </div>
              {expandedSections.has("choices") ? 
                <ChevronDown className="w-4 h-4" /> : 
                <ChevronRight className="w-4 h-4" />
              }
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2">
            {content.choices.map((choice, index) => (
              <div key={index} className="border rounded p-2">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline" className="text-xs">
                    Choice {choice.index}
                  </Badge>
                  {choice.finish_reason && (
                    <Badge variant="secondary" className="text-xs">
                      {choice.finish_reason}
                    </Badge>
                  )}
                </div>
                {choice.message && (
                  <MessageVisualization message={choice.message} />
                )}
                {choice.delta && (
                  <MessageVisualization message={choice.delta} />
                )}
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  )
}

function MessageVisualization({ message }: { message: Message }) {
  const [expanded, setExpanded] = useState(false)

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "user": return <User className="w-4 h-4 text-blue-500" />
      case "assistant": return <Bot className="w-4 h-4 text-green-500" />
      case "system": return <Settings className="w-4 h-4 text-gray-500" />
      case "tool": return <Wrench className="w-4 h-4 text-orange-500" />
      default: return <MessageSquare className="w-4 h-4" />
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case "user": return "text-blue-600 dark:text-blue-400"
      case "assistant": return "text-green-600 dark:text-green-400"
      case "system": return "text-gray-600 dark:text-gray-400"
      case "tool": return "text-orange-600 dark:text-orange-400"
      default: return "text-gray-600 dark:text-gray-400"
    }
  }

  const getContent = () => {
    if (typeof message.content === "string") {
      // Render string content as markdown with syntax highlighting and formatting
      return <MarkdownRenderer content={message.content} className="text-xs" />
    }
    if (Array.isArray(message.content)) {
      return message.content.map((item, index) => (
        <div key={index} className="mb-1">
          {typeof item === "string" ? (
            <MarkdownRenderer content={item} className="text-xs" />
          ) : (
            <pre className="text-xs whitespace-pre-wrap">
              {JSON.stringify(item, null, 2)}
            </pre>
          )}
        </div>
      ))
    }
    return (
      <pre className="text-xs whitespace-pre-wrap">
        {JSON.stringify(message.content, null, 2)}
      </pre>
    )
  }

  const hasLongContent = () => {
    if (typeof message.content === "string") {
      return message.content.length > 200
    }
    return JSON.stringify(message.content).length > 200
  }

  const getTruncatedContent = () => {
    if (typeof message.content === "string") {
      const truncated = message.content.length > 200 
        ? `${message.content.substring(0, 200)}...` 
        : message.content
      return <MarkdownRenderer content={truncated} className="text-xs" />
    }
    const str = JSON.stringify(message.content)
    const truncated = str.length > 200 ? `${str.substring(0, 200)}...` : str
    return (
      <pre className="text-xs whitespace-pre-wrap">
        {truncated}
      </pre>
    )
  }

  return (
    <Card className="p-3">
      <div className="space-y-2">
        {/* Message Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getRoleIcon(message.role)}
            <span className={`text-sm font-medium ${getRoleColor(message.role)}`}>
              {message.role}
            </span>
            {message.name && (
              <Badge variant="outline" className="text-xs">
                {message.name}
              </Badge>
            )}
            {message.tool_call_id && (
              <Badge variant="secondary" className="text-xs">
                call: {message.tool_call_id.substring(0, 8)}...
              </Badge>
            )}
          </div>
          {hasLongContent() && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="h-6 px-2"
            >
              {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              {expanded ? "Less" : "More"}
            </Button>
          )}
        </div>

        {/* Message Content */}
        <div className="bg-muted/30 p-2 rounded">
          {expanded || !hasLongContent() ? getContent() : getTruncatedContent()}
        </div>

        {/* Tool Calls */}
        {message.tool_calls && message.tool_calls.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Wrench className="w-3 h-3 text-orange-500" />
              <span className="text-xs font-medium">Tool Calls ({message.tool_calls.length})</span>
            </div>
            {message.tool_calls.map((toolCall, index) => (
              <div key={index} className="bg-orange-50 dark:bg-orange-900/20 p-2 rounded text-xs">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs">
                    {toolCall.function.name}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {toolCall.id.substring(0, 8)}...
                  </Badge>
                </div>
                <pre className="whitespace-pre-wrap text-xs">
                  {JSON.stringify(JSON.parse(toolCall.function.arguments), null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}

function ToolVisualization({ tool }: { tool: any }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card className="p-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-medium">
              {tool.function?.name || tool.name || "Unknown Tool"}
            </span>
            {tool.type && (
              <Badge variant="outline" className="text-xs">
                {tool.type}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="h-6 px-2"
          >
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            {expanded ? "Less" : "More"}
          </Button>
        </div>

        {tool.function?.description && (
          <p className="text-xs text-muted-foreground">
            {tool.function.description}
          </p>
        )}

        {expanded && (
          <div className="text-xs bg-muted/30 p-2 rounded">
            <pre className="whitespace-pre-wrap">
              {JSON.stringify(tool, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </Card>
  )
}

// Helper function to detect if content is AI-related
export function isAIContent(content: any): boolean {
  if (!content || typeof content !== "object") return false
  
  // Check for common AI request/response patterns
  return !!(
    content.messages ||
    content.choices ||
    content.model ||
    content.tools ||
    content.tool_calls ||
    content.usage ||
    (content.role && ["user", "assistant", "system", "tool"].includes(content.role))
  )
}