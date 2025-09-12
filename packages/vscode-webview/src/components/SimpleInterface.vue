<template>
  <div class="supercode-simple">
    <!-- Context window display -->
    <div class="context-window">
      <span class="context-info">{{ contextInfo }}</span>
    </div>
    
    <!-- Status indicator -->
    <div class="status-bar" :class="connectionStatus">
      <div class="status-line">
        <span class="status-dot"></span>
        <span class="status-text">
          {{ statusText }}
          <span v-if="currentPort" class="port">:{{ currentPort }}</span>
          <span v-if="modelInfo" class="model-info-inline">{{ modelInfo.name }}</span>
        </span>
      </div>
    </div>
    
    <!-- Todo Section -->
    <div v-if="todos.length > 0 && todos.some(todo => todo.status !== 'completed')" class="todo-section">
      <div class="todo-header" @click="toggleTodoSection">
        <span class="todo-prefix">📋</span>
        <span class="todo-title">{{ inProgressTodos.length > 0 ? inProgressTodos[0].content : 'Tasks' }}</span>
        <span class="todo-count">({{ completedTodos.length }} done, {{ inProgressTodos.length }} active, {{ pendingTodos.length }} remain)</span>
        <span class="todo-toggle">{{ todoExpanded ? '▼' : '▶' }}</span>
      </div>
      <div v-if="todoExpanded" class="todo-list">
        <div v-for="todo in todos" :key="todo.id" class="todo-item" :class="todo.status">
          <input 
            type="checkbox" 
            :checked="todo.status === 'completed'"
            @change="updateTodoStatus(todo.id, $event.target.checked ? 'completed' : 'pending')"
            class="todo-checkbox"
          />
          <span class="todo-status-icon">{{ getStatusIcon(todo.status) }}</span>
          <span class="todo-content">{{ todo.content }}</span>
        </div>
      </div>
    </div>
    
    <!-- Messages area -->
    <div class="messages" ref="messagesContainer">
      <div
        v-for="message in messages"
        :key="message.id"
        :class="['message', message.type]"
      >
        <div v-if="message.type === 'user'" class="user-message">
          <div class="user-line">
            <span class="user-prefix">></span>
            <span class="user-content">{{ message.content }}</span>
          </div>
          <!-- Display tool calls immediately after user messages -->
          <div v-if="message.toolCalls && message.toolCalls.length > 0" class="tool-calls-after-user">
            <div v-for="toolCall in message.toolCalls" :key="toolCall.id" class="tool-call-inline">
              <span class="tool-prefix">∟ </span>
              <span class="tool-title" :class="{ 'tool-error': toolCall.state.status === 'error' }">
                {{ formatToolTitle(toolCall) }}
              </span>
            </div>
          </div>
        </div>
        <div v-else-if="message.type === 'assistant'" class="assistant-message">
          <div class="assistant-content" v-html="formatMessageContent(message.content)"></div>
          <!-- Display associated tool calls inline -->
          <div v-if="message.toolCalls && message.toolCalls.length > 0" class="tool-calls-inline">
            <div v-for="toolCall in message.toolCalls" :key="toolCall.id" class="tool-call-inline">
              <span class="tool-prefix">∟ </span>
              <span class="tool-title" :class="{ 'tool-error': toolCall.state.status === 'error' }">
                {{ formatToolTitle(toolCall) }}
              </span>
            </div>
          </div>
          <!-- Model and timestamp info -->
          <div class="assistant-footer">
            {{ (modelInfo?.name || 'GPT-4o - 0x') + ' (' + new Date(message.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) + ')' }}
          </div>
        </div>
        <div v-else-if="message.type === 'system'" class="system-message">
          {{ message.content }}
        </div>
      </div>
    </div>
    
    <!-- Input area -->
    <div class="input-area">
      <div class="input-wrapper">
        <span class="prompt">></span>
        <textarea
          v-model="inputText"
          @keydown="handleKeydown"
          @input="autoResizeTextarea"
          @paste="handlePaste"
          :disabled="!isConnected"
          placeholder="Type your message... (Enter = send, Shift+Enter = new line)"
          class="input-field auto-expand-textarea"
          ref="inputField"
          rows="1"
          :style="{ height: typeof textareaHeight === 'number' ? textareaHeight + 'px' : textareaHeight }"
        ></textarea>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, nextTick, watch, onUnmounted } from 'vue'
import type { Message, ConnectionStatus, WebviewMessage, StatusUpdate, AddMessage, ModelInfo, TokenUsage } from '../types'

// Tool call interface matching TUI's ToolPart structure
interface ToolCall {
  id: string
  tool: string
  state: {
    status: 'pending' | 'completed' | 'error'
    input?: any
    output?: string
    error?: string
    metadata?: any
  }
}

// Extended message type for tool calls
interface ExtendedMessage extends Message {
  toolCalls?: ToolCall[]
}
import { SuperCodeSDKClient, type SSEMessage } from '../services/SuperCodeSDKClient'

// Reactive state
const connectionStatus = ref<ConnectionStatus>('disconnected' as ConnectionStatus)
const currentPort = ref<number>(25716) // Default to SuperCode's default port for standalone operation
const messages = ref<ExtendedMessage[]>([])
const inputText = ref('')
const messagesContainer = ref<HTMLElement>()
const inputField = ref<HTMLTextAreaElement>()
const textareaHeight = ref<number | string>(20) // Starting height for single line

// New state for enhanced UI
const modelInfo = ref<ModelInfo | null>(null)
const tokenUsage = ref<TokenUsage | null>(null)

// Track message roles for proper type assignment
const messageRoles = ref<Map<string, string>>(new Map())

// Todo state
interface TodoItem {
  id: string
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  activeForm?: string
}

const todos = ref<TodoItem[]>([])
const todoExpanded = ref(false)

// SDK Client instance
let sdkClient: SuperCodeSDKClient | null = null

// Computed properties
const isConnected = computed(() => connectionStatus.value === 'connected')
const statusText = computed(() => {
  switch (connectionStatus.value) {
    case 'connected': return 'Connected'
    case 'connecting': return 'Connecting...'
    case 'error': return 'Error'
    default: return 'Disconnected'
  }
})

// Store formatted context info from SDK
const formattedContextInfo = ref<string>('Context Unavailable')

const contextInfo = computed(() => formattedContextInfo.value)

// Todo computed properties
const inProgressTodos = computed(() => todos.value.filter(todo => todo.status === 'in_progress'))
const completedTodos = computed(() => todos.value.filter(todo => todo.status === 'completed'))
const pendingTodos = computed(() => todos.value.filter(todo => todo.status === 'pending'))

// Format message content with proper markdown and syntax highlighting
function formatMessageContent(content: string): string {
  let formatted = content
  
  // Handle code blocks first (JSON and others)
  formatted = formatted.replace(/```json\n([\s\S]*?)```/g, (match, jsonContent) => {
    try {
      const formattedJSON = formatJSON(jsonContent.trim())
      return `<div class="code-block json">${formattedJSON}</div>`
    } catch {
      return `<pre class="code-block json"><code>${escapeHtml(jsonContent.trim())}</code></pre>`
    }
  })
  
  // Handle other code blocks
  formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    if (lang === 'json') {
      try {
        const formattedJSON = formatJSON(code.trim())
        return `<div class="code-block json">${formattedJSON}</div>`
      } catch {
        return `<pre class="code-block json"><code>${escapeHtml(code.trim())}</code></pre>`
      }
    }
    return `<pre class="code-block ${lang || 'plaintext'}"><code>${escapeHtml(code.trim())}</code></pre>`
  })
  
  // Handle markdown formatting
  // Headers
  formatted = formatted.replace(/^### (.*$)/gm, '<h3 class="header-3">$1</h3>')
  formatted = formatted.replace(/^## (.*$)/gm, '<h2 class="header-2">$1</h2>')
  formatted = formatted.replace(/^# (.*$)/gm, '<h1 class="header-1">$1</h1>')
  
  // Bold text
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="bold-text">$1</strong>')
  
  // Code spans (inline code)
  formatted = formatted.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
  
  // Lists - convert markdown lists to HTML
  formatted = formatted.replace(/^- (.*)$/gm, '<div class="list-item">- $1</div>')
  formatted = formatted.replace(/^(\d+\. .*)$/gm, '<div class="numbered-item">$1</div>')
  
  // Line breaks - preserve line breaks
  formatted = formatted.replace(/\n/g, '<br>')
  
  return formatted
}

// Format JSON with syntax highlighting
function formatJSON(jsonStr: string): string {
  try {
    const obj = JSON.parse(jsonStr)
    return formatJSONObject(obj, 0)
  } catch {
    // If not valid JSON, format as string with basic highlighting
    return formatJSONString(jsonStr)
  }
}

function formatJSONString(str: string): string {
  // Basic JSON syntax highlighting
  return str
    .replace(/(".*?")/g, '<span class="json-string">$1</span>')
    .replace(/:\s*(".*?")/g, ': <span class="json-value">$1</span>')
    .replace(/:\s*(\d+)/g, ': <span class="json-number">$1</span>')
    .replace(/:\s*(true|false)/g, ': <span class="json-boolean">$1</span>')
    .replace(/:\s*(null)/g, ': <span class="json-null">$1</span>')
}

function formatJSONObject(obj: any, indent: number = 0): string {
  const spaces = '  '.repeat(indent)
  const nextSpaces = '  '.repeat(indent + 1)
  
  if (obj === null) return '<span class="json-null">null</span>'
  if (typeof obj === 'boolean') return `<span class="json-boolean">${obj}</span>`
  if (typeof obj === 'number') return `<span class="json-number">${obj}</span>`
  if (typeof obj === 'string') return `<span class="json-string">"${escapeHtml(obj)}"</span>`
  
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]'
    const items = obj.map(item => `${nextSpaces}${formatJSONObject(item, indent + 1)}`).join(',\n')
    return `[\n${items}\n${spaces}]`
  }
  
  if (typeof obj === 'object') {
    const entries = Object.entries(obj)
    if (entries.length === 0) return '{}'
    const items = entries.map(([key, value]) => 
      `${nextSpaces}<span class="json-key">"${escapeHtml(key)}"</span>: ${formatJSONObject(value, indent + 1)}`
    ).join(',\n')
    return `{\n${items}\n${spaces}}`
  }
  
  return String(obj)
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, m => map[m])
}

// Formatting functions for tool displays
function formatToolTitle(toolCall: ToolCall): string {
  const input = toolCall.state.input || {}
  
  // Handle pending state with animated text
  if (toolCall.state.status === 'pending') {
    return formatToolAction(toolCall.tool)
  }
  
  const toolName = formatToolName(toolCall.tool)
  
  switch (toolCall.tool.toLowerCase()) {
    case 'read':
      const readPath = input.filePath || input.file_path || input.path || ''
      return `${toolName} ${readPath}`
    case 'edit':
    case 'write':
      const editPath = input.filePath || input.file_path || input.path || ''
      return `${toolName} ${editPath}`
    case 'bash':
      return `${toolName} ${input.description || input.command || ''}`
    case 'webfetch':
      return `${toolName} ${input.url || ''}`
    case 'task':
      const description = input.description || ''
      const subagent = input.subagent_type || input.subagentType || ''
      return subagent ? `${toolName}[${subagent}] ${description}` : `${toolName} ${description}`
    case 'multiedit':
      const multiPath = input.file_path || input.filePath || ''
      return `${toolName} ${multiPath}`
    case 'grep':
      const pattern = input.pattern || ''
      return `${toolName} "${pattern}"`
    case 'glob':
      const globPattern = input.pattern || ''
      return `${toolName} ${globPattern}`
    case 'todowrite':
      return 'Plan'
    case 'todoread':
      return 'Plan'
    case 'ls':
      const lsPath = input.path || input.directory || ''
      return `${toolName} ${lsPath}`
    default:
      // Default format with first argument
      const keys = Object.keys(input)
      if (keys.length > 0) {
        const firstValue = input[keys[0]]
        if (typeof firstValue === 'string') {
          return `${toolName} ${firstValue}`
        }
      }
      return toolName
  }
}

function formatToolName(name: string): string {
  switch (name) {
    case 'bash':
      return 'Shell'
    case 'webfetch':
      return 'Fetch'
    case 'multiedit':
      return 'MultiEdit'
    case 'todowrite':
      return 'TodoWrite'
    case 'todoread':
      return 'TodoRead'
    default:
      // Handle underscore-separated names
      const normalized = name.replace(/_/g, ' ')
      // Capitalize first letter of each word
      return normalized.replace(/\b\w/g, l => l.toUpperCase())
  }
}

function formatToolAction(name: string): string {
  switch (name) {
    case 'task':
      return 'Delegating...'
    case 'bash':
      return 'Writing command...'
    case 'edit':
      return 'Preparing edit...'
    case 'write':
      return 'Writing file...'
    case 'read':
      return 'Reading file...'
    case 'webfetch':
      return 'Fetching from the web...'
    case 'glob':
      return 'Searching files...'
    case 'grep':
      return 'Searching content...'
    case 'multiedit':
      return 'Editing multiple sections...'
    default:
      return 'Processing...'
  }
}


// Auto-resize textarea functionality
function autoResizeTextarea() {
  if (!inputField.value) return
  
  const textarea = inputField.value
  const minHeight = 20 // Minimum single line height
  const maxHeight = 400 // Maximum height (about 20 lines)
  
  // Temporarily set to auto for proper scrollHeight calculation
  // This works with Vue's reactive system
  textareaHeight.value = 'auto'
  
  // Wait for Vue to update the DOM, then calculate height
  nextTick(() => {
    if (!inputField.value) return
    
    const scrollHeight = textarea.scrollHeight
    let newHeight = Math.max(minHeight, scrollHeight)
    
    // Limit to maximum height and handle overflow
    if (newHeight > maxHeight) {
      newHeight = maxHeight
      textarea.style.overflowY = 'auto'
    } else {
      textarea.style.overflowY = 'hidden'
    }
    
    // Only update if height actually changed to prevent unnecessary reactivity
    if (textareaHeight.value !== newHeight) {
      textareaHeight.value = newHeight
    }
  })
}

// Handle keyboard navigation
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    if (event.shiftKey) {
      // Shift+Enter = new line (default behavior)
      // Allow default behavior for multiline input
      nextTick(() => autoResizeTextarea())
    } else {
      // Plain Enter = send message
      event.preventDefault()
      sendMessage()
    }
  }
}

// Handle paste events to ensure auto-resize
function handlePaste() {
  // Allow the paste to complete, then auto-resize
  nextTick(() => autoResizeTextarea())
}

// Watch for input changes to auto-resize
watch(inputText, () => {
  nextTick(() => autoResizeTextarea())
})

// Message handling
async function sendMessage() {
  if (!inputText.value.trim() || !isConnected.value || !sdkClient) return
  
  const message = inputText.value.trim()
  inputText.value = ''
  
  // Don't add user message locally - it will be received via SSE
  
  try {
    // Send message via SDK client
    await sdkClient.sendMessage('default-session', message)
  } catch (error) {
    console.error('Failed to send message:', error)
    addMessage('system', `Error sending message: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

function addMessage(type: Message['type'], content: string) {
  messages.value.push({
    id: Date.now().toString() + Math.random().toString(36).substring(2),
    type,
    content,
    timestamp: Date.now()
  })
  
  // Auto-scroll to bottom
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

// Track tool calls separately - they will be associated with messages
const currentToolCalls = ref<Map<string, ToolCall>>(new Map())

function addOrUpdateToolCall(toolCall: ToolCall) {
  console.log('🎯 Adding/updating tool call:', toolCall)
  currentToolCalls.value.set(toolCall.id, toolCall)
  
  // Associate tool call with the most recent user message
  // This matches TUI behavior where tool calls appear after user messages
  for (let i = messages.value.length - 1; i >= 0; i--) {
    const message = messages.value[i]
    if (message.type === 'user') {
      console.log('🔗 Associating tool call with user message:', message.id)
      if (!message.toolCalls) {
        message.toolCalls = []
      }
      
      // Update existing tool call or add new one
      const existingIndex = message.toolCalls.findIndex(tc => tc.id === toolCall.id)
      if (existingIndex !== -1) {
        console.log('📝 Updating existing tool call at index:', existingIndex)
        message.toolCalls[existingIndex] = toolCall
      } else {
        console.log('➕ Adding new tool call to message')
        message.toolCalls.push(toolCall)
      }
      
      console.log('📊 Message now has', message.toolCalls.length, 'tool calls')
      
      // Auto-scroll to bottom
      nextTick(() => {
        if (messagesContainer.value) {
          messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
        }
      })
      break
    }
  }
}

// Add missing function for associating tool calls with specific messages
function addOrUpdateToolCallForMessage(toolCall: ToolCall, messageId: string) {
  console.log('🎯 Adding/updating tool call for message:', messageId, toolCall)
  currentToolCalls.value.set(toolCall.id, toolCall)
  
  // Try to find the most recent user message for this tool call
  // Tool calls typically appear after user messages in TUI
  for (let i = messages.value.length - 1; i >= 0; i--) {
    const message = messages.value[i]
    if (message.type === 'user') {
      console.log('🔗 Found user message, associating tool call:', message.id)
      if (!message.toolCalls) {
        message.toolCalls = []
      }
      
      // Update existing tool call or add new one
      const existingIndex = message.toolCalls.findIndex(tc => tc.id === toolCall.id)
      if (existingIndex !== -1) {
        console.log('📝 Updating existing tool call at index:', existingIndex)
        message.toolCalls[existingIndex] = toolCall
      } else {
        console.log('➕ Adding new tool call to message')
        message.toolCalls.push(toolCall)
      }
      
      console.log('📊 Message now has', message.toolCalls.length, 'tool calls')
      
      // Auto-scroll to bottom
      nextTick(() => {
        if (messagesContainer.value) {
          messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
        }
      })
      break
    }
  }
}

function updateOrCreateMessage(messageId: string, content: string, type: Message['type'] = 'assistant') {
  // Find existing message by ID
  const existingIndex = messages.value.findIndex(msg => msg.id === messageId)
  
  if (existingIndex !== -1) {
    // Update existing message
    messages.value[existingIndex].content = content
    messages.value[existingIndex].timestamp = Date.now()
  } else {
    // Create new message with the specific ID
    messages.value.push({
      id: messageId,
      type,
      content,
      timestamp: Date.now()
    })
  }
  
  // Auto-scroll to bottom
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

// Token usage fetching using TUI approach
async function fetchTokenUsage() {
  if (!sdkClient) {
    console.log('❌ No SDK client available for token usage fetching')
    formattedContextInfo.value = 'Context Unavailable'
    return
  }
  
  try {
    const formattedUsage = await sdkClient.getFormattedTokenUsage()
    
    formattedContextInfo.value = formattedUsage
    
    // Also update raw token usage for compatibility
    const tokenData = await sdkClient.getTokenUsage()
    if (tokenData && tokenData.used !== -1 && tokenData.max !== -1 && tokenData.percentage !== -1) {
      tokenUsage.value = {
        used: tokenData.used,
        max: tokenData.max,
        percentage: tokenData.percentage
      }
    } else {
      tokenUsage.value = { used: -1, max: -1, percentage: -1 }
    }
  } catch (error) {
    console.error('❌ Failed to fetch token usage info:', error)
    formattedContextInfo.value = 'Context Unavailable'
    tokenUsage.value = { used: -1, max: -1, percentage: -1 }
  }
}

// Active session fetching and message loading
async function fetchActiveSessionAndLoadMessages() {
  if (!sdkClient) {
    return
  }
  
  try {
    const activeSessionData = await sdkClient.getActiveSession()
    
    if (activeSessionData && activeSessionData.sessionID) {
      const sessionMessages = await sdkClient.getSessionMessages(activeSessionData.sessionID)
      const convertedMessages: ExtendedMessage[] = []
      
      for (const msg of sessionMessages as any[]) {
        if (msg.info && msg.info.role && msg.parts) {
          const textParts = msg.parts.filter((p: any) => p.type === 'text')
          const content = textParts.map((p: any) => p.text).join('')
          
          if (content && content.trim()) {
            const messageType = msg.info.role === 'user' ? 'user' : 'assistant'
            
            convertedMessages.push({
              id: msg.info.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2)}`,
              type: messageType,
              content: content.trim(),
              timestamp: msg.info.time?.created || Date.now()
            })
          }
        }
      }
      
      if (convertedMessages.length > 0) {
        messages.value = convertedMessages
        
        nextTick(() => {
          if (messagesContainer.value) {
            messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
          }
        })
      } else {
        addMessage('system', 'Connected to active session but no messages found')
      }
    } else {
      addMessage('system', 'No active session found in TUI')
    }
  } catch (error) {
    console.error('Failed to fetch active session or load messages:', error)
    addMessage('system', `Failed to load active session: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Model info fetching
async function fetchModelInfo() {
  if (!sdkClient) {
    console.log('❌ No SDK client available for model fetching')
    return
  }
  
  try {
    const modelData = await sdkClient.getCurrentModel()
    
    // Update model info based on received data
    if (modelData && modelData.name) {
      modelInfo.value = {
        name: modelData.name,
        provider: modelData.provider || '',
        version: modelData.version || ''
      }
    } else {
      modelInfo.value = {
        name: 'Unknown Model',
        provider: '',
        version: ''
      }
    }
  } catch (error) {
    console.error('❌ Failed to fetch model info:', error)
    // Indicate that model info is not available
    modelInfo.value = {
      name: 'Model Unavailable',
      provider: '',
      version: ''
    }
  }
}

// Todo management functions
function toggleTodoSection() {
  todoExpanded.value = !todoExpanded.value
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'completed': return '✅'
    case 'in_progress': return '🔄'
    case 'pending': return '📋'
    default: return '📋'
  }
}

function updateTodoStatus(todoId: string, completed: boolean) {
  const todo = todos.value.find(t => t.id === todoId)
  if (todo) {
    todo.status = completed ? 'completed' : 'pending'
  }
}

function parseTodoFromToolOutput(toolName: string, output: string, metadata?: any) {
  
  // Check for any todo-related tools - make this more permissive
  if (toolName.toLowerCase().includes('todo') || toolName === 'TodoWrite' || toolName === 'TodoRead' || toolName === 'todowrite' || toolName === 'todoread') {
    
    // First try to parse from metadata.todos (the correct way)
    if (metadata && metadata.todos && Array.isArray(metadata.todos)) {
      try {
        const todoItems: TodoItem[] = metadata.todos.map((todo: any, index: number) => ({
          id: todo.id || `todo_${Date.now()}_${index}`,
          content: todo.content || 'Untitled task',
          status: todo.status as 'pending' | 'in_progress' | 'completed' || 'pending',
          activeForm: todo.content || 'Untitled task'
        }))
        
        todos.value = todoItems
        return // Successfully parsed from metadata
      } catch (error) {
        console.error('Error parsing todos from metadata:', error)
      }
    }
    try {
      // More flexible parsing - look for various todo patterns
      const lines = output.split('\n')
      const todoItems: TodoItem[] = []
      
      lines.forEach((line, index) => {
        // Look for various patterns:
        // "1. [status] Task description"
        // "- [status] Task description" 
        // "✅ Task description"
        // "🔄 Task description"
        // "📋 Task description"
        
        let match = line.match(/(\d+)\.\s*\[?(pending|in_progress|completed|in-progress)\]?\s*(.+)/)
        if (match) {
          const [, , status, content] = match
          todoItems.push({
            id: `todo_${Date.now()}_${index}`,
            content: content.trim(),
            status: status.replace('-', '_') as 'pending' | 'in_progress' | 'completed',
            activeForm: content.trim()
          })
          return
        }
        
        // Try pattern with bullet points
        match = line.match(/[-*]\s*\[?(pending|in_progress|completed|in-progress)\]?\s*(.+)/)
        if (match) {
          const [, status, content] = match
          todoItems.push({
            id: `todo_${Date.now()}_${index}`,
            content: content.trim(),
            status: status.replace('-', '_') as 'pending' | 'in_progress' | 'completed',
            activeForm: content.trim()
          })
          return
        }
        
        // Try pattern with emojis
        if (line.includes('✅') || line.includes('🔄') || line.includes('📋')) {
          const content = line.replace(/[✅🔄📋]\s*/, '').trim()
          if (content) {
            let status = 'pending'
            if (line.includes('✅')) status = 'completed'
            else if (line.includes('🔄')) status = 'in_progress'
            
            todoItems.push({
              id: `todo_${Date.now()}_${index}`,
              content: content,
              status: status as 'pending' | 'in_progress' | 'completed',
              activeForm: content
            })
          }
        }
      })
      
      if (todoItems.length > 0) {
        todos.value = todoItems
      } else {
      }
    } catch (error) {
      console.error('Error parsing todo output:', error)
    }
  }
  
  // Also try parsing from any tool that has todo-like content
  if (output.toLowerCase().includes('todo') || output.toLowerCase().includes('task') || 
      output.toLowerCase().includes('1.') && output.toLowerCase().includes('2.')) {
    try {
      const lines = output.split('\n')
      const todoItems: TodoItem[] = []
      
      lines.forEach((line, index) => {
        // Simple numbered list parsing
        const match = line.match(/^\s*(\d+)\.\s*(.+)$/)
        if (match && match[2].trim().length > 0) {
          todoItems.push({
            id: `todo_${Date.now()}_${index}`,
            content: match[2].trim(),
            status: 'pending',
            activeForm: match[2].trim()
          })
        }
      })
      
      if (todoItems.length > 0) {
        todos.value = todoItems
      }
    } catch (error) {
      console.error('Error in generic todo parsing:', error)
    }
  }
}


// SDK Client functions
async function initializeSDKClient() {
  console.log(`🔄 Starting SDK client initialization on port ${currentPort.value}`)
  connectionStatus.value = 'connecting'
  
  // Initialize SDK client
  sdkClient = new SuperCodeSDKClient({
    baseUrl: `http://localhost:${currentPort.value}`,
    port: currentPort.value,
    timeout: 5000
  })
  
  // Implement polling mechanism with exponential backoff
  await pollForConnection()
}

async function pollForConnection() {
  const maxRetries = 10
  const baseDelay = 1000 // Start with 1 second
  const maxDelay = 10000 // Max 10 seconds between retries
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      
      if (!sdkClient) {
        connectionStatus.value = 'error'
        return
      }
      
      const isConnected = await sdkClient.testConnection()
      
      
      if (isConnected) {
        connectionStatus.value = 'connected'
        
        // Subscribe to SSE events
        await sdkClient.subscribeToEvents()
        
        // Set up message handlers
        sdkClient.onMessage(handleSSEMessage)
        sdkClient.onError(handleSSEError)
        
        // Fetch current model information, token usage, and active session
        await fetchModelInfo()
        await fetchTokenUsage()
        await fetchActiveSessionAndLoadMessages()
        
        return // Success - exit polling loop
      }
      
    } catch (error) {
    }
    
    // If this wasn't the last attempt, wait before retrying
    if (attempt < maxRetries) {
      const delay = Math.min(baseDelay * Math.pow(1.5, attempt - 1), maxDelay)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  // All attempts failed
  connectionStatus.value = 'error'
  addMessage('system', `Connection failed: SuperCode server not responding on port ${currentPort.value}`)
}

function handleSSEMessage(message: SSEMessage) {
  
  // Handle different message types
  switch (message.type) {
    case 'message':
      if (message.content) {
        addMessage('assistant', message.content)
      }
      break
    case 'message.updated':
      // Process both assistant and user messages, but prevent duplicates
      const messageRole = message.properties?.info?.role
      const messageId = message.properties.info?.id
      let content = null
      
      // Store the role information for later use, even if no content yet
      if (messageId && messageRole) {
        messageRoles.value.set(messageId, messageRole)
      }
      
      // Extract content from the message parts
      if (message.properties?.info?.parts) {
        const parts = message.properties.info.parts
        const textParts = parts.filter((p: any) => p.type === 'text')
        if (textParts.length > 0) {
          content = textParts.map((p: any) => p.text).join('')
        }
        
        // Extract tool invocations from parts
        const toolParts = parts.filter((p: any) => p.type === 'tool-invocation')
        if (toolParts.length > 0 && messageId) {
          // Process each tool invocation
          toolParts.forEach((part: any) => {
            const toolInvocation = part.toolInvocation
            if (toolInvocation) {
              const toolCall: ToolCall = {
                id: toolInvocation.toolCallId || `tool_${Date.now()}_${Math.random().toString(36).substring(2)}`,
                tool: toolInvocation.toolName || 'unknown',
                state: {
                  status: toolInvocation.state === 'result' ? 'completed' : 
                         toolInvocation.state === 'partial-call' ? 'pending' : 'pending',
                  input: toolInvocation.args,
                  output: toolInvocation.result || toolInvocation.output,
                  error: toolInvocation.error
                }
              }
              
              // Associate tool call with this specific message
              addOrUpdateToolCallForMessage(toolCall, messageId)
            }
          })
        }
      } else if (message.properties?.info?.content) {
        content = message.properties.info.content
      } else if (message.properties?.info?.text) {
        content = message.properties.info.text
      } else if (message.properties?.content) {
        content = message.properties.content
      }
      
      if (content && messageId) {
        // Check if message already exists to prevent duplicates
        const existingIndex = messages.value.findIndex(msg => msg.id === messageId)
        if (existingIndex === -1) {
          // Only add if it doesn't already exist
          const messageType = messageRole === 'user' ? 'user' : 'assistant'
          updateOrCreateMessage(messageId, content, messageType)
        }
      }
      break
    case 'message.part.updated':
      // Handle streaming message parts - use messageID to update existing message
      const part = message.properties?.part
      const partMessageId = part?.messageID || part?.message_id
      
      if (part && partMessageId) {
        // Log all part types to debug what we're receiving
        
        // Check if this is a tool part
        if (part.type === 'tool') {
          
          const toolCall: ToolCall = {
            id: part.id || `tool_${Date.now()}_${Math.random().toString(36).substring(2)}`,
            tool: part.tool || 'unknown',
            state: {
              status: part.state?.status || 'pending',
              input: part.state?.input,
              output: part.state?.output,
              title: part.state?.title,
              metadata: part.state?.metadata
            }
          }
          
          // If tool is completed, parse todos from it
          if (part.state?.status === 'completed') {
            
            // Parse todo output if it's a todo tool
            parseTodoFromToolOutput(toolCall.tool, toolCall.state.output || '', toolCall.state.metadata)
          }
          
          // Associate directly with the specific message ID instead of searching
          addOrUpdateToolCallForMessage(toolCall, partMessageId)
        } else {
          // Handle text parts
          let content = null
          
          if (part.text) {
            content = part.text
          } else if (part.content) {
            content = part.content  
          } else if (part.data?.text) {
            content = part.data.text
          } else if (typeof part === 'string') {
            content = part
          }
          
          if (content) {
            // For streaming parts, replace the entire message content with the latest part
            // The server sends the complete accumulated text in each part
            // Use stored role information or check existing messages
            const existingMessage = messages.value.find(msg => msg.id === partMessageId)
            const storedRole = messageRoles.value.get(partMessageId)
            
            let messageType: Message['type']
            if (storedRole) {
              messageType = storedRole === 'user' ? 'user' : 'assistant'
            } else if (existingMessage) {
              messageType = existingMessage.type
            } else {
              messageType = 'assistant'
            }
            
            updateOrCreateMessage(partMessageId, content, messageType)
            
            // Auto-scroll to bottom
            nextTick(() => {
              if (messagesContainer.value) {
                messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
              }
            })
          }
        }
      }
      break
    case 'tool_call':
      if (message.name || message.properties?.name) {
        const toolName = message.name || message.properties?.name
        const toolId = message.id || message.properties?.id || `tool_${Date.now()}_${Math.random().toString(36).substring(2)}`
        const parameters = message.parameters || message.properties?.parameters || message.properties?.input
        
        const toolCall: ToolCall = {
          id: toolId,
          tool: toolName,
          state: {
            status: 'pending',
            input: parameters
          }
        }
        
        addOrUpdateToolCall(toolCall)
      }
      break
    case 'tool_result':
      if (message.result || message.properties?.result) {
        const result = message.result || message.properties?.result
        const toolId = message.id || message.properties?.id
        
        if (toolId && currentToolCalls.value.has(toolId)) {
          const existingToolCall = currentToolCalls.value.get(toolId)!
          // Parse metadata from result if it's a structured object
          let metadata = undefined
          let output = result
          
          if (typeof result === 'object' && result !== null) {
            if (result.metadata) {
              metadata = result.metadata
            }
            if (result.output) {
              output = result.output
            } else {
              output = JSON.stringify(result)
            }
          } else if (typeof result === 'string') {
            // Try to parse as JSON to extract metadata
            try {
              const parsed = JSON.parse(result)
              if (parsed && typeof parsed === 'object') {
                if (parsed.metadata) {
                  metadata = parsed.metadata
                }
                if (parsed.output) {
                  output = parsed.output
                }
              }
            } catch {
              // Not JSON, use as-is
              output = result
            }
          } else {
            output = JSON.stringify(result)
          }
          
          const updatedToolCall: ToolCall = {
            ...existingToolCall,
            state: {
              ...existingToolCall.state,
              status: 'completed',
              output: output,
              metadata: metadata
            }
          }
          
          addOrUpdateToolCall(updatedToolCall)
          
          // Parse todo output if it's a todo tool
          parseTodoFromToolOutput(updatedToolCall.tool, updatedToolCall.state.output || '', updatedToolCall.state.metadata)
          
          // Also try parsing from any tool output that might contain todos
          if (updatedToolCall.state.output) {
            parseTodoFromToolOutput('any', updatedToolCall.state.output, updatedToolCall.state.metadata)
          }
        }
      }
      break
    case 'file.edited':
      // Handle actual tool events that are emitted when files are modified
      if (message.properties?.file) {
        const filePath = message.properties.file
        const toolId = `tool_${Date.now()}_${Math.random().toString(36).substring(2)}`
        
        const toolCall: ToolCall = {
          id: toolId,
          tool: 'edit',
          state: {
            status: 'completed',
            input: { filePath },
            output: `File edited: ${filePath}`
          }
        }
        
        addOrUpdateToolCall(toolCall)
      }
      break
    case 'debug_logs.entry':
      // Optional: show debug logs as system messages (commented out to reduce noise)
      // if (message.properties?.message) {
      //   addMessage('system', `Debug: ${message.properties.message}`)
      // }
      break
    case 'tui.model.changed':
      // Model changed - refresh model info
      console.log('🔄 Model changed event received, refreshing model info...')
      if (sdkClient) {
        fetchModelInfo()
      }
      break
    case 'tui.agent.changed':
      // Agent changed - could be used for UI updates in the future
      console.log('🔄 Agent changed event received')
      break
    case 'server.connected':
    case 'session.updated':
    case 'session.idle':
      // These are status messages, don't show in chat
      break
    default:
      console.log('Unhandled SSE message type:', message.type, message)
  }
}

function handleSSEError(error: Error) {
  console.error('SSE error:', error)
  addMessage('system', `Connection error: ${error.message}`)
}

// VS Code message handling (minimal glue code for VSCode-specific communication)
function handleVsCodeMessage(event: MessageEvent) {
  const message = event.data as WebviewMessage
  
  switch (message.command) {
    case 'statusUpdate': {
      // Optional: Allow VSCode extension to override port if needed
      const statusMsg = message as StatusUpdate
      if (statusMsg.port && statusMsg.port !== currentPort.value) {
        console.log('VSCode provided port override:', statusMsg.port)
        currentPort.value = statusMsg.port
        // Reinitialize SDK client with new port if needed
        initializeSDKClient()
      }
      break
    }
    
    case 'addPrompt': {
      // Add text to the input field from VSCode extension
      const text = (message as any).text
      const variant = (message as any).variant || 'clearAndAdd'
      
      if (text) {
        if (variant === 'clearAndAdd') {
          // Clear existing text and add new text
          inputText.value = text
          console.log('VSCode addPrompt (clearAndAdd): Set input text:', text)
        } else if (variant === 'appendWithSpacing') {
          // Add line spacing and append new text to existing content
          const currentText = inputText.value.trim()
          inputText.value = currentText ? `${currentText}\n\n${text}` : text
          console.log('VSCode addPrompt (appendWithSpacing): Appended text:', text)
        }
        
        // Focus the input field, move cursor to end, and auto-resize
        nextTick(() => {
          if (inputField.value) {
            inputField.value.focus()
            const finalText = inputText.value
            inputField.value.setSelectionRange(finalText.length, finalText.length)
            autoResizeTextarea()
          }
        })
      }
      break
    }
    
    // Remove addMessage case - all messages now come through SDK
    default:
      console.log('VSCode message (ignored, using SDK):', message.command)
  }
}

// Auto-focus input when connected and retry model fetching
watch(isConnected, (connected) => {
  if (connected) {
    nextTick(() => {
      inputField.value?.focus()
      autoResizeTextarea()
    })
    // Retry model and token usage fetching when connection is established
    if (sdkClient && !modelInfo.value) {
      fetchModelInfo()
    }
    if (sdkClient && !tokenUsage.value) {
      fetchTokenUsage()
    }
  }
})

// Lifecycle
onMounted(async () => {
  if (typeof window !== 'undefined') {
    // Set up VS Code message listener (fallback for VS Code integration)
    window.addEventListener('message', handleVsCodeMessage)
    
    // Set port from global if available
    if (window.supercodePort) {
      currentPort.value = window.supercodePort
    }
    
    // Always initialize SDK client for full functionality
    if (window.vscode) {
    } else {
    }
    
    // Initialize SDK client in both modes
    await initializeSDKClient()
    
    // Always ensure model info is set (indicate unavailable if dynamic fetch fails)
    if (!modelInfo.value) {
      modelInfo.value = {
        name: 'Model Unavailable',
        provider: '',
        version: ''
      }
    }
    
    // Always ensure token usage is set (indicate unavailable if dynamic fetch fails)
    if (!tokenUsage.value) {
      tokenUsage.value = { used: -1, max: -1, percentage: -1 }
      formattedContextInfo.value = 'Context Unavailable'
    }
    
    // Focus input and initialize textarea height
    nextTick(() => {
      inputField.value?.focus()
      autoResizeTextarea()
    })
    
  }
})

onUnmounted(() => {
  // Cleanup SDK client
  if (sdkClient) {
    sdkClient.unsubscribeFromEvents()
    sdkClient = null
  }
  
  // Remove VS Code listener
  if (typeof window !== 'undefined') {
    window.removeEventListener('message', handleVsCodeMessage)
  }
})
</script>

<style scoped>
.supercode-simple {
  display: flex;
  flex-direction: column;
  height: 100vh;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.4;
  color: #e8e6e3;
  background: #181818;
  position: relative;
}

/* Reset any browser list styling */
.supercode-simple * {
  list-style: none !important;
  list-style-type: none !important;
}

.context-window {
  position: absolute;
  top: 8px;
  right: 16px;
  z-index: 100;
}

.context-info {
  font-family: inherit;
  font-size: 12px;
  color: #999;
  background: #1a1a1a;
  padding: 4px 8px;
  border-radius: 3px;
  border: 1px solid #333;
}

.status-bar {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  border-bottom: 1px solid #333;
  background: #1a1a1a;
  font-size: 12px;
}

.status-line {
  display: flex;
  align-items: center;
}

.model-info-inline {
  margin-left: 8px;
  font-size: 11px;
  color: #999;
  font-family: inherit;
  opacity: 0.8;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 8px;
}

.status-bar.connected .status-dot { background: #00ff00; }
.status-bar.connecting .status-dot { background: #ffff00; }
.status-bar.error .status-dot { background: #ff0000; }
.status-bar.disconnected .status-dot { background: #666; }

.port {
  color: #888;
  font-size: 11px;
}

.messages {
  flex: 1;
  padding: 8px 16px;
  overflow-y: auto;
  scroll-behavior: smooth;
}

.message {
  margin-bottom: 0px;
  word-wrap: break-word;
  line-height: 1.0;
}

/* User messages - console-style */
.user-message {
  color: #888;
}

.user-line {
  display: flex;
  align-items: flex-start;
}

.user-prefix {
  color: #4fc3f7;
  margin-right: 8px;
  font-weight: bold;
  flex-shrink: 0;
}

.user-content {
  flex: 1;
}

/* Tool calls after user messages */
.tool-calls-after-user {
  margin-top: 0px;
  margin-left: 16px;
}

/* Inline tool calls (TUI style) */
.tool-calls-inline {
  margin-top: 0px;
}

.tool-call-inline {
  display: flex;
  align-items: flex-start;
  margin-bottom: 0px;
  font-family: inherit;
  line-height: 1.0;
}

.tool-prefix {
  color: #666;
  margin-right: 4px;
  font-size: 13px;
  flex-shrink: 0;
}

.tool-title {
  color: #e8e6e3;
  font-size: 13px;
  line-height: 1.4;
}

.tool-title.tool-error {
  color: #f48fb1;
}

/* Assistant messages */
.assistant-message {
  color: #e8e6e3;
}

.assistant-content {
  margin: 0;
  font-family: inherit;
  font-size: inherit;
  white-space: pre-wrap;
  word-wrap: break-word;
  line-height: 1.3;
}

.assistant-footer {
  color: #4fc3f7;
  font-size: 12px;
  margin-top: 2px;
  margin-bottom: 12px;
  font-family: inherit;
  line-height: 1.2;
}

/* System messages */
.system-message {
  color: #81c784;
  font-style: italic;
  font-size: 12px;
}

/* Legacy message types */
.message.user {
  color: #888;
}

.message.assistant {
  color: #e8e6e3;
}

.message.system {
  color: #81c784;
  font-style: italic;
}

.message.error {
  color: #f48fb1;
}

.input-area {
  border-top: 1px solid #333;
  background: #1a1a1a;
}

.input-wrapper {
  display: flex;
  align-items: flex-start;
  padding: 12px 16px;
  gap: 8px;
}

.prompt {
  color: #4fc3f7;
  font-weight: bold;
  flex-shrink: 0;
  margin-top: 1px;
}

.input-field {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #e8e6e3;
  font-family: inherit;
  font-size: inherit;
}

/* Auto-expanding textarea specific styles */
.auto-expand-textarea {
  min-height: 20px;
  max-height: 400px;
  resize: none;
  overflow-y: hidden;
  transition: height 0.15s ease-out;
  line-height: 1.4;
  padding: 0;
  margin: 0;
  vertical-align: top;
  word-wrap: break-word;
}

.auto-expand-textarea:focus {
  overflow-y: hidden;
}

/* When textarea exceeds max-height, show scrollbar */
.auto-expand-textarea[style*="overflow-y: auto"] {
  overflow-y: auto !important;
}

.input-field::placeholder {
  color: #666;
}

.input-field:disabled {
  color: #444;
}

/* Code blocks - Ultra Compact */
.code-block {
  background: #0d0d0d;
  border: 1px solid #333;
  border-radius: 2px;
  padding: 4px 6px;
  margin: 2px 0;
  overflow-x: auto;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.0;
  white-space: pre;
}

.code-block code {
  color: #e8e6e3;
  font-family: inherit;
  font-size: inherit;
}

.code-block.json code,
.code-block.javascript code,
.code-block.typescript code {
  color: #9cdcfe;
}

.code-block.python code,
.code-block.bash code,
.code-block.shell code {
  color: #ce9178;
}

/* JSON Syntax Highlighting - matching TUI colors */
.code-block.json .json-key {
  color: #9cdcfe;  /* Blue for keys */
}

.code-block.json .json-string {
  color: #ce9178;  /* Orange for strings */
}

.code-block.json .json-number {
  color: #b5cea8;  /* Light green for numbers */
}

.code-block.json .json-boolean {
  color: #569cd6;  /* Blue for booleans */
}

.code-block.json .json-null {
  color: #569cd6;  /* Blue for null */
}

/* Markdown formatting - TUI style - Ultra Compact */
.assistant-content :deep(.header-1) {
  color: #ffff00;
  font-size: 13px;
  font-weight: bold;
  margin: 0px 0 0px 0;
  line-height: 1.3;
  display: inline-block;
  width: 100%;
}

.assistant-content :deep(.header-2) {
  color: #ffff00;
  font-size: 13px;
  font-weight: bold;
  margin: 0px 0 0px 0;
  line-height: 1.3;
  display: inline-block;
  width: 100%;
}

.assistant-content :deep(.header-3) {
  color: #ffff00;
  font-size: 13px;
  font-weight: bold;
  margin: 0px 0 0px 0;
  line-height: 1.3;
  display: inline-block;
  width: 100%;
}

.assistant-content :deep(.bold-text) {
  color: #ffff00;
  font-weight: bold;
}

.assistant-content :deep(.inline-code) {
  color: #ce9178;
  background-color: transparent;
  padding: 0;
  border-radius: 0;
  font-family: inherit;
}

.assistant-content :deep(.list-item) {
  color: #e8e6e3;
  margin: 0px 0;
  margin-left: 12px;
  line-height: 1.3;
  display: inline-block;
  width: 100%;
  list-style: none;
  text-indent: 0;
}

.assistant-content :deep(.numbered-item) {
  color: #e8e6e3;
  margin: 0px 0;
  margin-left: 12px;
  line-height: 1.3;
  display: inline-block;
  width: 100%;
}

/* Scrollbar styling */
.messages::-webkit-scrollbar {
  width: 6px;
}

.messages::-webkit-scrollbar-track {
  background: #1a1a1a;
}

.messages::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 3px;
}

.messages::-webkit-scrollbar-thumb:hover {
  background: #444;
}

/* Todo Section Styles */
.todo-section {
  border-bottom: 1px solid #333;
  background: #1a1a1a;
  margin: 0;
  padding: 0;
}

.todo-header {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  cursor: pointer;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #e0e0e0;
  background: #1a1a1a;
  border-bottom: 1px solid #333;
}

.todo-header:hover {
  background: #252525;
}

.todo-prefix {
  margin-right: 6px;
  font-size: 11px;
}

.todo-title {
  font-weight: bold;
  margin-right: 6px;
}

.todo-count {
  color: #4fc3f7;
  margin-right: auto;
  font-size: 11px;
}

.todo-toggle {
  color: #666;
  font-size: 10px;
}

.todo-list {
  max-height: 200px;
  overflow-y: auto;
  background: #1a1a1a;
}

.todo-item {
  display: flex;
  align-items: center;
  padding: 4px 12px;
  font-family: 'Courier New', monospace;
  font-size: 11px;
  line-height: 1.2;
  border-bottom: 1px solid #2a2a2a;
}

.todo-item:last-child {
  border-bottom: none;
}

.todo-item.completed {
  opacity: 0.6;
}

.todo-item.completed .todo-content {
  text-decoration: line-through;
}

.todo-item.in_progress {
  background: #1f2a1f;
  border-left: 3px solid #4fc3f7;
}

.todo-checkbox {
  width: 12px;
  height: 12px;
  margin-right: 6px;
  accent-color: #4fc3f7;
}

.todo-status-icon {
  margin-right: 6px;
  font-size: 10px;
}

.todo-content {
  color: #e0e0e0;
  flex: 1;
}



/* Todo list scrollbar */
.todo-list::-webkit-scrollbar {
  width: 8px;
}

.todo-list::-webkit-scrollbar-track {
  background: #1a1a1a;
}

.todo-list::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 3px;
}

.todo-list::-webkit-scrollbar-thumb:hover {
  background: #444;
}


.input-area {
  position: relative;
}
</style>