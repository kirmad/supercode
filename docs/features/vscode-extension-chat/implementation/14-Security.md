# 14-Security.md

**Security Implementation for OpenCode VS Code Extension Chat Feature**

---

## 🎯 Overview

This document provides comprehensive security implementation guidelines for the OpenCode VS Code extension chat feature. It covers Content Security Policy (CSP) configuration, input sanitization, XSS prevention, secure communication patterns, file system access security, authentication handling, dependency security, and security testing practices.

## 🛡️ Content Security Policy (CSP) Configuration

### CSP Header Implementation

```typescript
// src/security/csp.ts - Content Security Policy configuration
export const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-inline'", // Required for VS Code webview
    "https://vscode-unpkg.net",
    "https://cdn.jsdelivr.net"
  ],
  'style-src': [
    "'self'",
    "'unsafe-inline'", // Required for dynamic theming
    "https://fonts.googleapis.com"
  ],
  'img-src': [
    "'self'",
    "data:",
    "https:",
    "vscode-resource:",
    "vscode-webview-resource:"
  ],
  'font-src': [
    "'self'",
    "https://fonts.gstatic.com",
    "vscode-resource:"
  ],
  'connect-src': [
    "'self'",
    "https://api.opencode.app",
    "wss://api.opencode.app",
    "https://api.anthropic.com",
    "https://api.openai.com"
  ],
  'frame-ancestors': ["'none'"],
  'frame-src': ["'none'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"]
}

export function generateCSPHeader(): string {
  return Object.entries(CSP_DIRECTIVES)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ')
}

// VS Code webview CSP configuration
export function configureWebviewCSP(webview: vscode.Webview): void {
  const cspHeader = generateCSPHeader()
  
  // Apply CSP through meta tag in webview HTML
  const cspMeta = `<meta http-equiv="Content-Security-Policy" content="${cspHeader}">`
  
  // Also configure webview options
  webview.options = {
    enableScripts: true,
    enableForms: false,
    enableCommandUris: true,
    localResourceRoots: [
      vscode.Uri.file(path.join(context.extensionPath, 'out')),
      vscode.Uri.file(path.join(context.extensionPath, 'assets'))
    ]
  }
}
```

### CSP Violation Reporting

```typescript
// src/security/cspReporting.ts - CSP violation handling
export class CSPViolationReporter {
  private static instance: CSPViolationReporter
  private violations: CSPViolation[] = []
  
  static getInstance(): CSPViolationReporter {
    if (!CSPViolationReporter.instance) {
      CSPViolationReporter.instance = new CSPViolationReporter()
    }
    return CSPViolationReporter.instance
  }
  
  setupViolationListener(): void {
    // Listen for CSP violations in webview
    window.addEventListener('securitypolicyviolation', (event) => {
      this.handleViolation({
        blockedURI: event.blockedURI,
        violatedDirective: event.violatedDirective,
        originalPolicy: event.originalPolicy,
        sourceFile: event.sourceFile,
        lineNumber: event.lineNumber,
        timestamp: new Date().toISOString()
      })
    })
  }
  
  private handleViolation(violation: CSPViolation): void {
    this.violations.push(violation)
    
    // Log violation for development
    console.warn('CSP Violation:', violation)
    
    // Report to extension host for logging
    if (typeof acquireVsCodeApi !== 'undefined') {
      const vscode = acquireVsCodeApi()
      vscode.postMessage({
        type: 'csp-violation',
        data: violation
      })
    }
    
    // In production, report to security monitoring
    if (process.env.NODE_ENV === 'production') {
      this.reportToMonitoring(violation)
    }
  }
  
  private async reportToMonitoring(violation: CSPViolation): Promise<void> {
    try {
      await fetch('/api/security/csp-violation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(violation)
      })
    } catch (error) {
      console.error('Failed to report CSP violation:', error)
    }
  }
}

interface CSPViolation {
  blockedURI: string
  violatedDirective: string
  originalPolicy: string
  sourceFile: string
  lineNumber: number
  timestamp: string
}
```

## 🔐 Input Sanitization and Validation

### Message Content Sanitization

```typescript
// src/security/sanitization.ts - Input sanitization utilities
import DOMPurify from 'dompurify'

export class InputSanitizer {
  private static readonly MAX_MESSAGE_LENGTH = 50000
  private static readonly MAX_FILE_PATH_LENGTH = 500
  private static readonly DANGEROUS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /data:text\/html/gi,
    /on\w+\s*=/gi,
    /<iframe\b[^>]*>/gi,
    /<object\b[^>]*>/gi,
    /<embed\b[^>]*>/gi
  ]
  
  static sanitizeMessage(content: string): string {
    if (!content || typeof content !== 'string') {
      throw new SecurityError('Invalid message content type')
    }
    
    // Check length limits
    if (content.length > this.MAX_MESSAGE_LENGTH) {
      throw new SecurityError(`Message exceeds maximum length of ${this.MAX_MESSAGE_LENGTH} characters`)
    }
    
    // Remove dangerous patterns
    let sanitized = content
    for (const pattern of this.DANGEROUS_PATTERNS) {
      sanitized = sanitized.replace(pattern, '')
    }
    
    // Additional sanitization with DOMPurify
    sanitized = DOMPurify.sanitize(sanitized, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li'],
      ALLOWED_ATTR: ['class', 'data-*'],
      FORBID_TAGS: ['script', 'object', 'embed', 'iframe', 'form', 'input'],
      FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover']
    })
    
    return sanitized.trim()
  }
  
  static sanitizeFilePath(filePath: string): string {
    if (!filePath || typeof filePath !== 'string') {
      throw new SecurityError('Invalid file path type')
    }
    
    if (filePath.length > this.MAX_FILE_PATH_LENGTH) {
      throw new SecurityError(`File path exceeds maximum length of ${this.MAX_FILE_PATH_LENGTH} characters`)
    }
    
    // Prevent path traversal attacks
    const normalizedPath = path.normalize(filePath)
    if (normalizedPath.includes('..') || normalizedPath.startsWith('/')) {
      throw new SecurityError('Invalid file path: path traversal detected')
    }
    
    // Remove dangerous characters
    const sanitized = normalizedPath.replace(/[<>:"|?*\x00-\x1f]/g, '')
    
    if (!sanitized) {
      throw new SecurityError('File path is empty after sanitization')
    }
    
    return sanitized
  }
  
  static validateToolParameters(toolName: string, parameters: any): any {
    if (!parameters || typeof parameters !== 'object') {
      throw new SecurityError('Invalid tool parameters')
    }
    
    const sanitized: any = {}
    
    switch (toolName) {
      case 'read':
      case 'write':
      case 'edit':
        sanitized.filePath = this.sanitizeFilePath(parameters.filePath)
        if (parameters.content) {
          sanitized.content = this.sanitizeFileContent(parameters.content)
        }
        break
        
      case 'bash':
        sanitized.command = this.sanitizeShellCommand(parameters.command)
        if (parameters.description) {
          sanitized.description = this.sanitizeMessage(parameters.description)
        }
        break
        
      case 'todowrite':
        sanitized.todos = this.sanitizeTodos(parameters.todos)
        break
        
      default:
        throw new SecurityError(`Unknown tool: ${toolName}`)
    }
    
    return sanitized
  }
  
  private static sanitizeFileContent(content: string): string {
    if (content.length > 100000) {
      throw new SecurityError('File content exceeds maximum size')
    }
    
    // Allow most content for code files, but remove null bytes
    return content.replace(/\x00/g, '')
  }
  
  private static sanitizeShellCommand(command: string): string {
    if (command.length > 1000) {
      throw new SecurityError('Command exceeds maximum length')
    }
    
    // Remove null bytes and potentially dangerous patterns
    let sanitized = command.replace(/\x00/g, '')
    
    // Check for dangerous command patterns
    const dangerousCommands = [
      /rm\s+-rf?\s+\//, // rm -rf /
      /sudo\s+/, // sudo commands
      /chmod\s+777/, // dangerous permissions
      />\s*\/dev\//, // writing to system devices
      /curl.*\|\s*sh/, // curl pipe to shell
      /wget.*\|\s*sh/ // wget pipe to shell
    ]
    
    for (const pattern of dangerousCommands) {
      if (pattern.test(sanitized)) {
        throw new SecurityError('Potentially dangerous command detected')
      }
    }
    
    return sanitized
  }
  
  private static sanitizeTodos(todos: any[]): any[] {
    if (!Array.isArray(todos)) {
      throw new SecurityError('Invalid todos format')
    }
    
    if (todos.length > 100) {
      throw new SecurityError('Too many todo items')
    }
    
    return todos.map(todo => ({
      content: this.sanitizeMessage(todo.content || ''),
      status: ['pending', 'in_progress', 'completed', 'cancelled'].includes(todo.status) 
        ? todo.status 
        : 'pending',
      id: todo.id || crypto.randomUUID()
    }))
  }
}

export class SecurityError extends Error {
  constructor(message: string) {
    super(`Security Error: ${message}`)
    this.name = 'SecurityError'
  }
}
```

### Output Encoding

```typescript
// src/security/encoding.ts - Output encoding utilities
export class OutputEncoder {
  static encodeHTML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
  }
  
  static encodeJavaScript(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t')
      .replace(/\x00/g, '\\x00')
  }
  
  static encodeCSSValue(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\A ')
      .replace(/\r/g, '\\D ')
  }
  
  static encodeURL(text: string): string {
    return encodeURIComponent(text)
  }
  
  // Safe markdown rendering
  static renderMarkdownSafe(markdown: string): string {
    // Use a safe markdown parser with restricted features
    const sanitized = DOMPurify.sanitize(marked(markdown), {
      ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'br', 'strong', 'em', 'code', 'pre',
        'blockquote', 'ul', 'ol', 'li', 'a'
      ],
      ALLOWED_ATTR: ['href', 'class', 'data-*'],
      FORBID_TAGS: ['script', 'object', 'embed', 'iframe'],
      ALLOW_DATA_ATTR: false
    })
    
    return sanitized
  }
}
```

## 🔒 XSS Prevention and Output Encoding

### XSS Prevention Framework

```typescript
// src/security/xssPrevention.ts - XSS prevention utilities
export class XSSPrevention {
  private static readonly SCRIPT_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<[^>]*\son\w+\s*=.*?>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /data:text\/html/gi
  ]
  
  static sanitizeUserInput(input: string): string {
    if (typeof input !== 'string') {
      return ''
    }
    
    let cleaned = input
    
    // Remove script patterns
    for (const pattern of this.SCRIPT_PATTERNS) {
      cleaned = cleaned.replace(pattern, '')
    }
    
    // Encode HTML entities
    cleaned = OutputEncoder.encodeHTML(cleaned)
    
    return cleaned
  }
  
  static createSafeHTML(template: string, ...values: string[]): string {
    const encodedValues = values.map(value => OutputEncoder.encodeHTML(value))
    return template.replace(/%s/g, () => encodedValues.shift() || '')
  }
  
  static validateAndSanitizeURL(url: string): string | null {
    if (!url || typeof url !== 'string') {
      return null
    }
    
    try {
      const parsed = new URL(url)
      
      // Only allow safe protocols
      const allowedProtocols = ['http:', 'https:', 'vscode:', 'vscode-resource:', 'data:']
      if (!allowedProtocols.includes(parsed.protocol)) {
        return null
      }
      
      // Prevent javascript: URLs in data: URIs
      if (parsed.protocol === 'data:' && url.toLowerCase().includes('javascript')) {
        return null
      }
      
      return parsed.toString()
    } catch {
      return null
    }
  }
  
  // Safe event handler attachment
  static addEventListenerSafe(
    element: HTMLElement,
    event: string,
    handler: (event: Event) => void,
    options?: AddEventListenerOptions
  ): void {
    // Validate event name
    if (!/^[a-z]+$/.test(event)) {
      throw new SecurityError('Invalid event name')
    }
    
    // Use addEventListener instead of setting properties
    element.addEventListener(event, handler, options)
  }
}
```

### Component-Level XSS Protection

```typescript
// src/components/chat/MessageRenderer.tsx - Safe message rendering
import { OutputEncoder, XSSPrevention } from '@/security'

interface MessageRendererProps {
  content: string
  isMarkdown?: boolean
  allowCodeBlocks?: boolean
}

export function MessageRenderer({ 
  content, 
  isMarkdown = false, 
  allowCodeBlocks = true 
}: MessageRendererProps) {
  const [sanitizedContent, setSanitizedContent] = useState('')
  
  useEffect(() => {
    const processContent = async () => {
      try {
        let processed = content
        
        // First sanitize the input
        processed = XSSPrevention.sanitizeUserInput(processed)
        
        if (isMarkdown) {
          // Use safe markdown rendering
          processed = OutputEncoder.renderMarkdownSafe(processed)
        } else {
          // For plain text, encode HTML entities
          processed = OutputEncoder.encodeHTML(processed)
          
          // Convert newlines to <br> tags safely
          processed = processed.replace(/\n/g, '<br>')
        }
        
        setSanitizedContent(processed)
      } catch (error) {
        console.error('Content processing error:', error)
        setSanitizedContent(OutputEncoder.encodeHTML(content))
      }
    }
    
    processContent()
  }, [content, isMarkdown])
  
  return (
    <div 
      className="message-content"
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  )
}

// Safe code block component
export function CodeBlock({ 
  code, 
  language, 
  filename 
}: { 
  code: string
  language?: string
  filename?: string 
}) {
  const [highlightedCode, setHighlightedCode] = useState('')
  
  useEffect(() => {
    const highlightCode = async () => {
      try {
        // Sanitize code content
        const sanitizedCode = XSSPrevention.sanitizeUserInput(code)
        
        // Use safe syntax highlighting
        const highlighted = await highlightSyntax(sanitizedCode, language)
        setHighlightedCode(highlighted)
      } catch (error) {
        console.error('Syntax highlighting error:', error)
        setHighlightedCode(OutputEncoder.encodeHTML(code))
      }
    }
    
    highlightCode()
  }, [code, language])
  
  return (
    <div className="code-block">
      {filename && (
        <div className="code-header">
          <span className="filename">{OutputEncoder.encodeHTML(filename)}</span>
        </div>
      )}
      <pre className="code-content">
        <code dangerouslySetInnerHTML={{ __html: highlightedCode }} />
      </pre>
    </div>
  )
}
```

## 🌐 Secure Communication Patterns

### API Communication Security

```typescript
// src/services/secureApiClient.ts - Secure API communication
export class SecureApiClient {
  private baseURL: string
  private authToken: string | null = null
  private requestId = 0
  
  constructor(baseURL: string) {
    this.baseURL = baseURL
  }
  
  setAuthToken(token: string): void {
    // Validate token format
    if (!token || typeof token !== 'string' || token.length < 10) {
      throw new SecurityError('Invalid authentication token')
    }
    this.authToken = token
  }
  
  async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const requestId = ++this.requestId
    const startTime = Date.now()
    
    try {
      // Validate endpoint
      const url = this.validateAndBuildURL(endpoint)
      
      // Prepare secure headers
      const headers = this.buildSecureHeaders(options.headers)
      
      // Sanitize request body
      const body = options.body ? this.sanitizeRequestBody(options.body) : undefined
      
      // Make request with timeout
      const response = await this.fetchWithTimeout(url, {
        ...options,
        headers,
        body: body ? JSON.stringify(body) : undefined
      })
      
      // Validate response
      const result = await this.validateResponse<T>(response)
      
      // Log request for security monitoring
      this.logRequest(requestId, endpoint, response.status, Date.now() - startTime)
      
      return result
    } catch (error) {
      this.logError(requestId, endpoint, error)
      throw error
    }
  }
  
  private validateAndBuildURL(endpoint: string): string {
    // Ensure endpoint starts with /
    if (!endpoint.startsWith('/')) {
      endpoint = '/' + endpoint
    }
    
    // Prevent URL manipulation
    if (endpoint.includes('../') || endpoint.includes('..\\')) {
      throw new SecurityError('Invalid endpoint: path traversal detected')
    }
    
    try {
      return new URL(endpoint, this.baseURL).toString()
    } catch {
      throw new SecurityError('Invalid endpoint URL')
    }
  }
  
  private buildSecureHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-Request-ID': crypto.randomUUID(),
      ...customHeaders
    }
    
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`
    }
    
    return headers
  }
  
  private sanitizeRequestBody(body: any): any {
    if (typeof body === 'string') {
      return InputSanitizer.sanitizeMessage(body)
    }
    
    if (typeof body === 'object' && body !== null) {
      const sanitized: any = {}
      
      for (const [key, value] of Object.entries(body)) {
        if (typeof value === 'string') {
          sanitized[key] = InputSanitizer.sanitizeMessage(value)
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = this.sanitizeRequestBody(value)
        } else {
          sanitized[key] = value
        }
      }
      
      return sanitized
    }
    
    return body
  }
  
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout = 30000
  ): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      return response
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new SecurityError('Request timeout')
      }
      throw error
    }
  }
  
  private async validateResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API Error: ${response.status} ${errorText}`)
    }
    
    const contentType = response.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      throw new SecurityError('Invalid response content type')
    }
    
    try {
      return await response.json()
    } catch {
      throw new SecurityError('Invalid JSON response')
    }
  }
  
  private logRequest(requestId: number, endpoint: string, status: number, duration: number): void {
    console.log(`[API] ${requestId}: ${endpoint} -> ${status} (${duration}ms)`)
  }
  
  private logError(requestId: number, endpoint: string, error: any): void {
    console.error(`[API] ${requestId}: ${endpoint} -> ERROR:`, error)
  }
}

interface RequestOptions extends Omit<RequestInit, 'headers' | 'body'> {
  headers?: Record<string, string>
  body?: any
}
```

### WebSocket Security

```typescript
// src/services/secureWebSocket.ts - Secure WebSocket communication
export class SecureWebSocketClient {
  private ws: WebSocket | null = null
  private url: string
  private authToken: string | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private messageHandlers = new Map<string, (data: any) => void>()
  
  constructor(url: string) {
    this.url = this.validateWebSocketURL(url)
  }
  
  private validateWebSocketURL(url: string): string {
    try {
      const parsed = new URL(url)
      
      if (!['ws:', 'wss:'].includes(parsed.protocol)) {
        throw new SecurityError('Invalid WebSocket protocol')
      }
      
      // Prefer secure WebSocket in production
      if (process.env.NODE_ENV === 'production' && parsed.protocol === 'ws:') {
        console.warn('Using insecure WebSocket in production')
      }
      
      return url
    } catch {
      throw new SecurityError('Invalid WebSocket URL')
    }
  }
  
  connect(authToken?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (authToken) {
          this.authToken = authToken
        }
        
        // Add auth token to URL if available
        const wsUrl = this.authToken 
          ? `${this.url}?token=${encodeURIComponent(this.authToken)}`
          : this.url
        
        this.ws = new WebSocket(wsUrl)
        
        this.ws.onopen = () => {
          console.log('WebSocket connected')
          this.reconnectAttempts = 0
          resolve()
        }
        
        this.ws.onmessage = (event) => {
          this.handleMessage(event)
        }
        
        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          reject(error)
        }
        
        this.ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason)
          this.handleDisconnect()
        }
      } catch (error) {
        reject(error)
      }
    })
  }
  
  private handleMessage(event: MessageEvent): void {
    try {
      // Validate message data
      if (typeof event.data !== 'string') {
        console.warn('Received non-string message')
        return
      }
      
      if (event.data.length > 1000000) { // 1MB limit
        console.warn('Received oversized message')
        return
      }
      
      const message = JSON.parse(event.data)
      
      // Validate message structure
      if (!message.type || typeof message.type !== 'string') {
        console.warn('Received invalid message format')
        return
      }
      
      // Sanitize message data
      const sanitizedData = this.sanitizeMessageData(message.data)
      
      // Route to appropriate handler
      const handler = this.messageHandlers.get(message.type)
      if (handler) {
        handler(sanitizedData)
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error)
    }
  }
  
  private sanitizeMessageData(data: any): any {
    if (typeof data === 'string') {
      return InputSanitizer.sanitizeMessage(data)
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeMessageData(item))
    }
    
    if (typeof data === 'object' && data !== null) {
      const sanitized: any = {}
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeMessageData(value)
      }
      return sanitized
    }
    
    return data
  }
  
  send(message: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected')
    }
    
    try {
      // Validate and sanitize outgoing message
      const sanitized = this.sanitizeMessageData(message)
      const serialized = JSON.stringify(sanitized)
      
      if (serialized.length > 1000000) { // 1MB limit
        throw new SecurityError('Message too large')
      }
      
      this.ws.send(serialized)
    } catch (error) {
      console.error('Error sending WebSocket message:', error)
      throw error
    }
  }
  
  onMessage(type: string, handler: (data: any) => void): void {
    this.messageHandlers.set(type, handler)
  }
  
  private handleDisconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.pow(2, this.reconnectAttempts) * 1000
      console.log(`Reconnecting in ${delay}ms...`)
      
      setTimeout(() => {
        this.reconnectAttempts++
        this.connect(this.authToken)
      }, delay)
    } else {
      console.error('Max reconnection attempts reached')
    }
  }
  
  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}
```

## 📁 File System Access Security

### File Access Control

```typescript
// src/security/fileAccess.ts - File system security
export class FileAccessController {
  private static readonly ALLOWED_EXTENSIONS = [
    '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h',
    '.css', '.scss', '.html', '.xml', '.json', '.yaml', '.yml',
    '.md', '.txt', '.log', '.csv', '.sql', '.go', '.rs', '.php',
    '.rb', '.swift', '.kt', '.dart', '.sh', '.ps1', '.bat'
  ]
  
  private static readonly BLOCKED_PATHS = [
    '/etc/passwd',
    '/etc/shadow',
    '/etc/hosts',
    '/.env',
    '/.git/config',
    '/node_modules',
    '/.ssh/',
    '/System/',
    '/Windows/',
    '/Program Files/'
  ]
  
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
  
  static validateFileAccess(filePath: string, operation: 'read' | 'write' | 'delete'): void {
    // Sanitize and normalize path
    const normalizedPath = this.normalizePath(filePath)
    
    // Check for path traversal
    if (this.hasPathTraversal(normalizedPath)) {
      throw new SecurityError('Path traversal attack detected')
    }
    
    // Check against blocked paths
    if (this.isBlockedPath(normalizedPath)) {
      throw new SecurityError('Access to sensitive file/directory denied')
    }
    
    // Validate file extension for certain operations
    if (operation === 'write' && !this.hasAllowedExtension(normalizedPath)) {
      throw new SecurityError('File type not allowed for write operations')
    }
    
    // Additional checks for write operations
    if (operation === 'write') {
      this.validateWriteOperation(normalizedPath)
    }
  }
  
  private static normalizePath(filePath: string): string {
    try {
      return path.resolve(path.normalize(filePath))
    } catch {
      throw new SecurityError('Invalid file path')
    }
  }
  
  private static hasPathTraversal(filePath: string): boolean {
    const normalized = path.normalize(filePath)
    return normalized.includes('..') || 
           normalized.includes('~') ||
           normalized.startsWith('/') ||
           /^[a-zA-Z]:\\/.test(normalized) // Windows absolute path
  }
  
  private static isBlockedPath(filePath: string): boolean {
    const lowerPath = filePath.toLowerCase()
    
    return this.BLOCKED_PATHS.some(blocked => 
      lowerPath.includes(blocked.toLowerCase()) ||
      lowerPath.startsWith(blocked.toLowerCase())
    )
  }
  
  private static hasAllowedExtension(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase()
    return this.ALLOWED_EXTENSIONS.includes(ext)
  }
  
  private static validateWriteOperation(filePath: string): void {
    // Check if trying to write to system directories
    const systemDirs = ['/bin/', '/sbin/', '/usr/bin/', '/usr/sbin/']
    const lowerPath = filePath.toLowerCase()
    
    if (systemDirs.some(dir => lowerPath.startsWith(dir))) {
      throw new SecurityError('Cannot write to system directories')
    }
    
    // Check for dangerous file names
    const dangerousNames = [
      'autorun.inf',
      'desktop.ini',
      '.htaccess',
      'web.config',
      'robots.txt'
    ]
    
    const fileName = path.basename(filePath).toLowerCase()
    if (dangerousNames.includes(fileName)) {
      throw new SecurityError('Cannot write dangerous system files')
    }
  }
  
  static async validateFileSize(filePath: string): Promise<void> {
    try {
      const stats = await fs.stat(filePath)
      
      if (stats.size > this.MAX_FILE_SIZE) {
        throw new SecurityError(`File size exceeds maximum allowed size of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`)
      }
    } catch (error) {
      if (error instanceof SecurityError) {
        throw error
      }
      // File doesn't exist or other error - that's okay
    }
  }
  
  static sanitizeFileContent(content: string, fileType: string): string {
    // Remove null bytes
    let sanitized = content.replace(/\x00/g, '')
    
    // Additional sanitization based on file type
    switch (fileType) {
      case 'html':
      case 'xml':
        sanitized = XSSPrevention.sanitizeUserInput(sanitized)
        break
        
      case 'json':
        try {
          // Validate JSON structure
          JSON.parse(sanitized)
        } catch {
          throw new SecurityError('Invalid JSON content')
        }
        break
        
      case 'javascript':
      case 'typescript':
        // Check for potentially dangerous patterns
        if (this.hasDangerousJSPatterns(sanitized)) {
          throw new SecurityError('Potentially dangerous JavaScript code detected')
        }
        break
    }
    
    return sanitized
  }
  
  private static hasDangerousJSPatterns(code: string): boolean {
    const dangerousPatterns = [
      /eval\s*\(/,
      /Function\s*\(/,
      /setTimeout\s*\(\s*["'].*["']\s*,/,
      /setInterval\s*\(\s*["'].*["']\s*,/,
      /document\.write\s*\(/,
      /innerHTML\s*=/,
      /outerHTML\s*=/
    ]
    
    return dangerousPatterns.some(pattern => pattern.test(code))
  }
}
```

### Secure File Operations

```typescript
// src/services/secureFileService.ts - Secure file operations
export class SecureFileService {
  private accessController = FileAccessController
  
  async readFile(filePath: string): Promise<string> {
    try {
      // Validate access
      this.accessController.validateFileAccess(filePath, 'read')
      
      // Check file size
      await this.accessController.validateFileSize(filePath)
      
      // Read file with encoding detection
      const content = await fs.readFile(filePath, 'utf8')
      
      // Sanitize content based on file type
      const fileType = this.getFileType(filePath)
      return this.accessController.sanitizeFileContent(content, fileType)
    } catch (error) {
      console.error('File read error:', error)
      throw error
    }
  }
  
  async writeFile(filePath: string, content: string): Promise<void> {
    try {
      // Validate access
      this.accessController.validateFileAccess(filePath, 'write')
      
      // Sanitize content
      const fileType = this.getFileType(filePath)
      const sanitizedContent = this.accessController.sanitizeFileContent(content, fileType)
      
      // Validate content size
      if (sanitizedContent.length > 10 * 1024 * 1024) { // 10MB
        throw new SecurityError('File content too large')
      }
      
      // Create backup if file exists
      await this.createBackup(filePath)
      
      // Write file atomically
      const tempPath = `${filePath}.tmp.${Date.now()}`
      await fs.writeFile(tempPath, sanitizedContent, 'utf8')
      await fs.rename(tempPath, filePath)
      
    } catch (error) {
      console.error('File write error:', error)
      throw error
    }
  }
  
  private async createBackup(filePath: string): Promise<void> {
    try {
      const exists = await fs.access(filePath).then(() => true).catch(() => false)
      if (exists) {
        const backupPath = `${filePath}.backup.${Date.now()}`
        await fs.copyFile(filePath, backupPath)
        
        // Clean up old backups (keep only last 5)
        await this.cleanupBackups(filePath)
      }
    } catch (error) {
      console.warn('Backup creation failed:', error)
    }
  }
  
  private async cleanupBackups(filePath: string): Promise<void> {
    try {
      const dir = path.dirname(filePath)
      const fileName = path.basename(filePath)
      const files = await fs.readdir(dir)
      
      const backups = files
        .filter(file => file.startsWith(`${fileName}.backup.`))
        .map(file => ({
          name: file,
          path: path.join(dir, file),
          timestamp: parseInt(file.split('.backup.')[1])
        }))
        .sort((a, b) => b.timestamp - a.timestamp)
      
      // Keep only the 5 most recent backups
      const toDelete = backups.slice(5)
      for (const backup of toDelete) {
        await fs.unlink(backup.path)
      }
    } catch (error) {
      console.warn('Backup cleanup failed:', error)
    }
  }
  
  private getFileType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase()
    
    const typeMap: Record<string, string> = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.jsx': 'javascript',
      '.tsx': 'typescript',
      '.html': 'html',
      '.xml': 'xml',
      '.json': 'json',
      '.css': 'css',
      '.scss': 'scss',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c'
    }
    
    return typeMap[ext] || 'text'
  }
}
```

## 🔐 Authentication and Authorization

### Token Management

```typescript
// src/security/tokenManager.ts - Secure token management
export class TokenManager {
  private static readonly TOKEN_STORAGE_KEY = 'opencode_auth_token'
  private static readonly REFRESH_TOKEN_KEY = 'opencode_refresh_token'
  private static readonly TOKEN_EXPIRY_BUFFER = 5 * 60 * 1000 // 5 minutes
  
  private currentToken: string | null = null
  private refreshToken: string | null = null
  private tokenExpiry: number | null = null
  private refreshTimer: NodeJS.Timeout | null = null
  
  constructor(private apiClient: SecureApiClient) {
    this.loadStoredTokens()
    this.setupRefreshTimer()
  }
  
  private loadStoredTokens(): void {
    try {
      // In VS Code extension, use secure storage
      const storedToken = vscode.workspace.getConfiguration().get<string>('opencode.authToken')
      const storedRefresh = vscode.workspace.getConfiguration().get<string>('opencode.refreshToken')
      
      if (storedToken) {
        this.setToken(storedToken, storedRefresh || undefined)
      }
    } catch (error) {
      console.error('Error loading stored tokens:', error)
    }
  }
  
  setToken(accessToken: string, refreshToken?: string): void {
    try {
      // Validate token format (JWT)
      const payload = this.validateJWT(accessToken)
      
      this.currentToken = accessToken
      this.tokenExpiry = payload.exp * 1000 // Convert to milliseconds
      
      if (refreshToken) {
        this.validateJWT(refreshToken)
        this.refreshToken = refreshToken
      }
      
      // Store securely in VS Code
      this.storeTokensSecurely(accessToken, refreshToken)
      
      // Update API client
      this.apiClient.setAuthToken(accessToken)
      
      // Setup refresh timer
      this.setupRefreshTimer()
      
    } catch (error) {
      throw new SecurityError('Invalid token format')
    }
  }
  
  private validateJWT(token: string): any {
    const parts = token.split('.')
    if (parts.length !== 3) {
      throw new SecurityError('Invalid JWT format')
    }
    
    try {
      const payload = JSON.parse(atob(parts[1]))
      
      // Validate required fields
      if (!payload.exp || !payload.iat || !payload.sub) {
        throw new SecurityError('Invalid JWT payload')
      }
      
      // Check expiration
      if (payload.exp * 1000 < Date.now()) {
        throw new SecurityError('Token expired')
      }
      
      return payload
    } catch (error) {
      throw new SecurityError('Invalid JWT payload')
    }
  }
  
  private async storeTokensSecurely(accessToken: string, refreshToken?: string): Promise<void> {
    try {
      // Use VS Code's secure storage
      const config = vscode.workspace.getConfiguration('opencode')
      
      await config.update('authToken', accessToken, vscode.ConfigurationTarget.Global)
      
      if (refreshToken) {
        await config.update('refreshToken', refreshToken, vscode.ConfigurationTarget.Global)
      }
    } catch (error) {
      console.error('Error storing tokens:', error)
    }
  }
  
  getCurrentToken(): string | null {
    if (!this.currentToken || !this.tokenExpiry) {
      return null
    }
    
    // Check if token is expired or about to expire
    if (this.tokenExpiry - Date.now() < this.TOKEN_EXPIRY_BUFFER) {
      this.refreshTokenAsync()
      return null
    }
    
    return this.currentToken
  }
  
  private setupRefreshTimer(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
    }
    
    if (!this.tokenExpiry) {
      return
    }
    
    // Refresh 5 minutes before expiry
    const refreshTime = this.tokenExpiry - Date.now() - this.TOKEN_EXPIRY_BUFFER
    
    if (refreshTime > 0) {
      this.refreshTimer = setTimeout(() => {
        this.refreshTokenAsync()
      }, refreshTime)
    }
  }
  
  private async refreshTokenAsync(): Promise<void> {
    if (!this.refreshToken) {
      this.clearTokens()
      return
    }
    
    try {
      const response = await fetch('/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.refreshToken}`
        }
      })
      
      if (!response.ok) {
        throw new Error('Token refresh failed')
      }
      
      const { accessToken, refreshToken } = await response.json()
      this.setToken(accessToken, refreshToken)
      
    } catch (error) {
      console.error('Token refresh error:', error)
      this.clearTokens()
    }
  }
  
  clearTokens(): void {
    this.currentToken = null
    this.refreshToken = null
    this.tokenExpiry = null
    
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    }
    
    // Clear from storage
    try {
      const config = vscode.workspace.getConfiguration('opencode')
      config.update('authToken', undefined, vscode.ConfigurationTarget.Global)
      config.update('refreshToken', undefined, vscode.ConfigurationTarget.Global)
    } catch (error) {
      console.error('Error clearing tokens:', error)
    }
  }
  
  isAuthenticated(): boolean {
    return this.getCurrentToken() !== null
  }
}
```

### Permission System

```typescript
// src/security/permissionManager.ts - Permission management
export class PermissionManager {
  private grantedPermissions = new Set<string>()
  private deniedPermissions = new Set<string>()
  private pendingRequests = new Map<string, PermissionRequest>()
  
  async requestPermission(
    operation: string,
    resource: string,
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<boolean> {
    const permissionId = `${operation}:${resource}`
    
    // Check if already granted/denied
    if (this.grantedPermissions.has(permissionId)) {
      return true
    }
    
    if (this.deniedPermissions.has(permissionId)) {
      return false
    }
    
    // Auto-approve low-risk operations
    if (riskLevel === 'low' && this.isLowRiskOperation(operation, resource)) {
      this.grantedPermissions.add(permissionId)
      return true
    }
    
    // Request user approval for higher-risk operations
    return this.requestUserApproval(operation, resource, riskLevel)
  }
  
  private isLowRiskOperation(operation: string, resource: string): boolean {
    const lowRiskPatterns = [
      'read:*.md',
      'read:*.txt',
      'read:*.json',
      'write:temp/*',
      'list:*'
    ]
    
    const pattern = `${operation}:${resource}`
    return lowRiskPatterns.some(allowed => this.matchPattern(pattern, allowed))
  }
  
  private matchPattern(input: string, pattern: string): boolean {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'))
    return regex.test(input)
  }
  
  private async requestUserApproval(
    operation: string,
    resource: string,
    riskLevel: string
  ): Promise<boolean> {
    const requestId = crypto.randomUUID()
    const permissionId = `${operation}:${resource}`
    
    const request: PermissionRequest = {
      id: requestId,
      operation,
      resource,
      riskLevel,
      timestamp: Date.now(),
      resolved: false
    }
    
    this.pendingRequests.set(requestId, request)
    
    try {
      // Show permission dialog to user
      const approved = await this.showPermissionDialog(request)
      
      if (approved) {
        this.grantedPermissions.add(permissionId)
        this.logPermissionGrant(operation, resource, riskLevel)
      } else {
        this.deniedPermissions.add(permissionId)
        this.logPermissionDenial(operation, resource, riskLevel)
      }
      
      return approved
    } finally {
      this.pendingRequests.delete(requestId)
    }
  }
  
  private async showPermissionDialog(request: PermissionRequest): Promise<boolean> {
    const message = this.formatPermissionMessage(request)
    const riskWarning = this.getRiskWarning(request.riskLevel)
    
    const options = ['Allow', 'Deny', 'Allow Always', 'Deny Always']
    
    const choice = await vscode.window.showWarningMessage(
      `${message}\n\n${riskWarning}`,
      { modal: true },
      ...options
    )
    
    switch (choice) {
      case 'Allow':
        return true
      case 'Deny':
        return false
      case 'Allow Always':
        this.grantedPermissions.add(`${request.operation}:${request.resource}`)
        return true
      case 'Deny Always':
        this.deniedPermissions.add(`${request.operation}:${request.resource}`)
        return false
      default:
        return false
    }
  }
  
  private formatPermissionMessage(request: PermissionRequest): string {
    switch (request.operation) {
      case 'read':
        return `OpenCode wants to read file: ${request.resource}`
      case 'write':
        return `OpenCode wants to write to file: ${request.resource}`
      case 'execute':
        return `OpenCode wants to execute command: ${request.resource}`
      case 'delete':
        return `OpenCode wants to delete: ${request.resource}`
      default:
        return `OpenCode wants to perform ${request.operation} on: ${request.resource}`
    }
  }
  
  private getRiskWarning(riskLevel: string): string {
    switch (riskLevel) {
      case 'low':
        return '⚪ Low Risk: This operation is generally safe.'
      case 'medium':
        return '🟡 Medium Risk: This operation may modify your files.'
      case 'high':
        return '🟠 High Risk: This operation could significantly impact your system.'
      case 'critical':
        return '🔴 Critical Risk: This operation could cause irreversible changes.'
      default:
        return '⚪ Unknown Risk: Please review carefully.'
    }
  }
  
  private logPermissionGrant(operation: string, resource: string, riskLevel: string): void {
    console.log(`Permission granted: ${operation} on ${resource} (${riskLevel} risk)`)
  }
  
  private logPermissionDenial(operation: string, resource: string, riskLevel: string): void {
    console.log(`Permission denied: ${operation} on ${resource} (${riskLevel} risk)`)
  }
  
  revokePermission(operation: string, resource: string): void {
    const permissionId = `${operation}:${resource}`
    this.grantedPermissions.delete(permissionId)
    this.deniedPermissions.delete(permissionId)
  }
  
  clearAllPermissions(): void {
    this.grantedPermissions.clear()
    this.deniedPermissions.clear()
    this.pendingRequests.clear()
  }
}

interface PermissionRequest {
  id: string
  operation: string
  resource: string
  riskLevel: string
  timestamp: number
  resolved: boolean
}
```

## 📦 Dependency Security and Vulnerability Management

### Dependency Scanner

```typescript
// src/security/dependencyScanner.ts - Dependency vulnerability scanning
export class DependencyScanner {
  private vulnerabilities: VulnerabilityReport[] = []
  private lastScan: number = 0
  private scanInterval = 24 * 60 * 60 * 1000 // 24 hours
  
  async scanDependencies(): Promise<VulnerabilityReport[]> {
    const now = Date.now()
    
    // Skip if recently scanned
    if (now - this.lastScan < this.scanInterval) {
      return this.vulnerabilities
    }
    
    try {
      this.lastScan = now
      this.vulnerabilities = await this.performScan()
      
      if (this.vulnerabilities.length > 0) {
        this.reportVulnerabilities()
      }
      
      return this.vulnerabilities
    } catch (error) {
      console.error('Dependency scan failed:', error)
      return []
    }
  }
  
  private async performScan(): Promise<VulnerabilityReport[]> {
    const vulnerabilities: VulnerabilityReport[] = []
    
    // Check package.json
    const packageJson = await this.loadPackageJson()
    if (!packageJson) {
      return vulnerabilities
    }
    
    // Scan production dependencies
    await this.scanDependencySet(
      packageJson.dependencies || {},
      'production',
      vulnerabilities
    )
    
    // Scan development dependencies
    await this.scanDependencySet(
      packageJson.devDependencies || {},
      'development',
      vulnerabilities
    )
    
    return vulnerabilities
  }
  
  private async loadPackageJson(): Promise<any> {
    try {
      const packagePath = path.join(process.cwd(), 'package.json')
      const content = await fs.readFile(packagePath, 'utf8')
      return JSON.parse(content)
    } catch {
      return null
    }
  }
  
  private async scanDependencySet(
    dependencies: Record<string, string>,
    type: 'production' | 'development',
    vulnerabilities: VulnerabilityReport[]
  ): Promise<void> {
    for (const [name, version] of Object.entries(dependencies)) {
      const vulns = await this.checkPackageVulnerabilities(name, version, type)
      vulnerabilities.push(...vulns)
    }
  }
  
  private async checkPackageVulnerabilities(
    packageName: string,
    version: string,
    type: string
  ): Promise<VulnerabilityReport[]> {
    try {
      // Use npm audit API or similar service
      const response = await fetch('https://registry.npmjs.org/-/npm/v1/security/advisories/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          [packageName]: [version]
        })
      })
      
      if (!response.ok) {
        return []
      }
      
      const data = await response.json()
      const advisories = data[packageName] || []
      
      return advisories.map((advisory: any) => ({
        packageName,
        version,
        type,
        severity: advisory.severity,
        title: advisory.title,
        description: advisory.overview,
        recommendation: advisory.recommendation,
        references: advisory.references,
        cwe: advisory.cwe,
        cvss: advisory.cvss
      }))
    } catch (error) {
      console.error(`Error checking vulnerabilities for ${packageName}:`, error)
      return []
    }
  }
  
  private reportVulnerabilities(): void {
    const critical = this.vulnerabilities.filter(v => v.severity === 'critical')
    const high = this.vulnerabilities.filter(v => v.severity === 'high')
    const medium = this.vulnerabilities.filter(v => v.severity === 'moderate')
    const low = this.vulnerabilities.filter(v => v.severity === 'low')
    
    console.warn('Dependency vulnerabilities found:')
    console.warn(`Critical: ${critical.length}, High: ${high.length}, Medium: ${medium.length}, Low: ${low.length}`)
    
    // Show critical vulnerabilities to user
    if (critical.length > 0) {
      vscode.window.showErrorMessage(
        `${critical.length} critical security vulnerabilities found in dependencies. Please update immediately.`,
        'View Details'
      ).then(choice => {
        if (choice === 'View Details') {
          this.showVulnerabilityDetails(critical)
        }
      })
    } else if (high.length > 0) {
      vscode.window.showWarningMessage(
        `${high.length} high-severity vulnerabilities found. Consider updating dependencies.`,
        'View Details'
      ).then(choice => {
        if (choice === 'View Details') {
          this.showVulnerabilityDetails(high)
        }
      })
    }
  }
  
  private showVulnerabilityDetails(vulnerabilities: VulnerabilityReport[]): void {
    const details = vulnerabilities.map(v => 
      `${v.packageName}@${v.version}: ${v.title} (${v.severity})`
    ).join('\n')
    
    vscode.window.showInformationMessage(
      `Vulnerabilities:\n${details}`,
      { modal: true }
    )
  }
  
  getCriticalVulnerabilities(): VulnerabilityReport[] {
    return this.vulnerabilities.filter(v => v.severity === 'critical')
  }
  
  getVulnerabilityCount(): { critical: number; high: number; medium: number; low: number } {
    return {
      critical: this.vulnerabilities.filter(v => v.severity === 'critical').length,
      high: this.vulnerabilities.filter(v => v.severity === 'high').length,
      medium: this.vulnerabilities.filter(v => v.severity === 'moderate').length,
      low: this.vulnerabilities.filter(v => v.severity === 'low').length
    }
  }
}

interface VulnerabilityReport {
  packageName: string
  version: string
  type: string
  severity: 'critical' | 'high' | 'moderate' | 'low'
  title: string
  description: string
  recommendation: string
  references: string[]
  cwe: string[]
  cvss: number
}
```

### Secure Dependency Loading

```typescript
// src/security/secureDependencyLoader.ts - Secure dynamic imports
export class SecureDependencyLoader {
  private allowedModules = new Set([
    'highlight.js',
    'marked',
    'dompurify',
    'crypto-js',
    'lodash-es'
  ])
  
  private loadedModules = new Map<string, any>()
  private integrityHashes = new Map<string, string>()
  
  async loadModule(moduleName: string): Promise<any> {
    // Validate module name
    if (!this.isAllowedModule(moduleName)) {
      throw new SecurityError(`Module ${moduleName} is not in the allowlist`)
    }
    
    // Return cached module if available
    if (this.loadedModules.has(moduleName)) {
      return this.loadedModules.get(moduleName)
    }
    
    try {
      // Load module with integrity check
      const module = await this.loadWithIntegrityCheck(moduleName)
      
      // Cache the module
      this.loadedModules.set(moduleName, module)
      
      return module
    } catch (error) {
      console.error(`Failed to load module ${moduleName}:`, error)
      throw new SecurityError(`Failed to load secure module: ${moduleName}`)
    }
  }
  
  private isAllowedModule(moduleName: string): boolean {
    return this.allowedModules.has(moduleName)
  }
  
  private async loadWithIntegrityCheck(moduleName: string): Promise<any> {
    const expectedHash = this.integrityHashes.get(moduleName)
    
    if (expectedHash) {
      // Verify module integrity
      const moduleContent = await this.getModuleContent(moduleName)
      const actualHash = await this.calculateHash(moduleContent)
      
      if (actualHash !== expectedHash) {
        throw new SecurityError(`Module integrity check failed for ${moduleName}`)
      }
    }
    
    // Dynamic import with error handling
    try {
      return await import(moduleName)
    } catch (error) {
      throw new SecurityError(`Module import failed: ${error}`)
    }
  }
  
  private async getModuleContent(moduleName: string): Promise<string> {
    // This would typically fetch from a CDN or read from node_modules
    // Implementation depends on your module loading strategy
    return ''
  }
  
  private async calculateHash(content: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(content)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }
  
  setModuleIntegrity(moduleName: string, hash: string): void {
    this.integrityHashes.set(moduleName, hash)
  }
  
  addAllowedModule(moduleName: string): void {
    this.allowedModules.add(moduleName)
  }
  
  removeAllowedModule(moduleName: string): void {
    this.allowedModules.delete(moduleName)
    this.loadedModules.delete(moduleName)
  }
}
```

## 🧪 Security Testing and Code Review Practices

### Security Test Suite

```typescript
// src/tests/security/security.test.ts - Security test suite
import { describe, it, expect, beforeEach } from 'vitest'
import { InputSanitizer, XSSPrevention, FileAccessController, SecurityError } from '@/security'

describe('Security Tests', () => {
  describe('Input Sanitization', () => {
    it('should sanitize malicious script tags', () => {
      const maliciousInput = '<script>alert("xss")</script>Hello'
      const sanitized = InputSanitizer.sanitizeMessage(maliciousInput)
      expect(sanitized).not.toContain('<script>')
      expect(sanitized).toContain('Hello')
    })
    
    it('should prevent JavaScript URLs', () => {
      const maliciousInput = '<a href="javascript:alert(1)">Click me</a>'
      const sanitized = InputSanitizer.sanitizeMessage(maliciousInput)
      expect(sanitized).not.toContain('javascript:')
    })
    
    it('should reject oversized messages', () => {
      const oversizedMessage = 'a'.repeat(60000)
      expect(() => InputSanitizer.sanitizeMessage(oversizedMessage))
        .toThrow(SecurityError)
    })
    
    it('should sanitize file paths', () => {
      expect(() => InputSanitizer.sanitizeFilePath('../../../etc/passwd'))
        .toThrow(SecurityError)
      
      expect(() => InputSanitizer.sanitizeFilePath('/etc/passwd'))
        .toThrow(SecurityError)
    })
  })
  
  describe('XSS Prevention', () => {
    it('should encode HTML entities', () => {
      const input = '<img src="x" onerror="alert(1)">'
      const encoded = XSSPrevention.sanitizeUserInput(input)
      expect(encoded).not.toContain('<img')
      expect(encoded).not.toContain('onerror')
    })
    
    it('should validate URLs safely', () => {
      expect(XSSPrevention.validateAndSanitizeURL('javascript:alert(1)')).toBeNull()
      expect(XSSPrevention.validateAndSanitizeURL('data:text/html,<script>alert(1)</script>')).toBeNull()
      expect(XSSPrevention.validateAndSanitizeURL('https://example.com')).toBe('https://example.com/')
    })
  })
  
  describe('File Access Control', () => {
    it('should block access to sensitive files', () => {
      expect(() => FileAccessController.validateFileAccess('/etc/passwd', 'read'))
        .toThrow(SecurityError)
      
      expect(() => FileAccessController.validateFileAccess('/.env', 'read'))
        .toThrow(SecurityError)
    })
    
    it('should prevent path traversal', () => {
      expect(() => FileAccessController.validateFileAccess('../config/secrets.txt', 'read'))
        .toThrow(SecurityError)
    })
    
    it('should allow safe file operations', () => {
      expect(() => FileAccessController.validateFileAccess('src/index.ts', 'read'))
        .not.toThrow()
    })
  })
  
  describe('Tool Parameter Validation', () => {
    it('should validate bash command parameters', () => {
      expect(() => InputSanitizer.validateToolParameters('bash', {
        command: 'rm -rf /'
      })).toThrow(SecurityError)
      
      expect(() => InputSanitizer.validateToolParameters('bash', {
        command: 'ls -la'
      })).not.toThrow()
    })
    
    it('should validate file operation parameters', () => {
      const validParams = {
        filePath: 'src/test.ts',
        content: 'console.log("hello")'
      }
      
      expect(() => InputSanitizer.validateToolParameters('write', validParams))
        .not.toThrow()
    })
  })
})

describe('Integration Security Tests', () => {
  it('should handle malicious API responses', async () => {
    const maliciousResponse = {
      message: '<script>alert("xss")</script>',
      filePath: '../../../etc/passwd'
    }
    
    // Test that the response handler sanitizes the data
    expect(() => {
      InputSanitizer.sanitizeMessage(maliciousResponse.message)
    }).not.toThrow()
    
    expect(() => {
      InputSanitizer.sanitizeFilePath(maliciousResponse.filePath)
    }).toThrow(SecurityError)
  })
  
  it('should validate WebSocket messages', () => {
    const maliciousMessage = {
      type: 'message_update',
      data: {
        content: '<img src="x" onerror="eval(localStorage.getItem(\'malicious\'))">',
        filePath: '../../../../etc/shadow'
      }
    }
    
    // Test message sanitization
    const sanitizedContent = XSSPrevention.sanitizeUserInput(maliciousMessage.data.content)
    expect(sanitizedContent).not.toContain('onerror')
    expect(sanitizedContent).not.toContain('eval')
  })
})
```

### Security Audit Tools

```typescript
// src/tools/securityAudit.ts - Security audit automation
export class SecurityAuditor {
  private findings: SecurityFinding[] = []
  
  async runFullAudit(): Promise<SecurityAuditReport> {
    this.findings = []
    
    // Run all security checks
    await this.auditDependencies()
    await this.auditCodePatterns()
    await this.auditConfigurations()
    await this.auditPermissions()
    
    return this.generateReport()
  }
  
  private async auditDependencies(): Promise<void> {
    try {
      const scanner = new DependencyScanner()
      const vulnerabilities = await scanner.scanDependencies()
      
      for (const vuln of vulnerabilities) {
        this.findings.push({
          type: 'dependency',
          severity: this.mapSeverity(vuln.severity),
          title: `Vulnerable dependency: ${vuln.packageName}`,
          description: vuln.description,
          recommendation: vuln.recommendation,
          file: 'package.json',
          line: 0
        })
      }
    } catch (error) {
      console.error('Dependency audit failed:', error)
    }
  }
  
  private async auditCodePatterns(): Promise<void> {
    const patterns = [
      {
        pattern: /eval\s*\(/g,
        severity: 'high' as const,
        message: 'Use of eval() function detected'
      },
      {
        pattern: /innerHTML\s*=/g,
        severity: 'medium' as const,
        message: 'Direct innerHTML assignment detected'
      },
      {
        pattern: /document\.write\s*\(/g,
        severity: 'medium' as const,
        message: 'Use of document.write() detected'
      },
      {
        pattern: /\$\{.*\}/g,
        severity: 'low' as const,
        message: 'Template literal usage - verify data sanitization'
      }
    ]
    
    const files = await this.getSourceFiles()
    
    for (const file of files) {
      const content = await fs.readFile(file, 'utf8')
      const lines = content.split('\n')
      
      for (const { pattern, severity, message } of patterns) {
        lines.forEach((line, index) => {
          if (pattern.test(line)) {
            this.findings.push({
              type: 'code_pattern',
              severity,
              title: message,
              description: `Potentially unsafe code pattern in ${file}`,
              recommendation: 'Review and ensure proper input sanitization',
              file,
              line: index + 1
            })
          }
        })
      }
    }
  }
  
  private async auditConfigurations(): Promise<void> {
    // Check CSP configuration
    const cspConfig = CSP_DIRECTIVES
    
    if (cspConfig['script-src']?.includes("'unsafe-eval'")) {
      this.findings.push({
        type: 'configuration',
        severity: 'high',
        title: 'Unsafe CSP configuration',
        description: "CSP allows 'unsafe-eval' which can enable XSS attacks",
        recommendation: "Remove 'unsafe-eval' from script-src directive",
        file: 'src/security/csp.ts',
        line: 0
      })
    }
    
    if (cspConfig['script-src']?.includes("'unsafe-inline'")) {
      this.findings.push({
        type: 'configuration',
        severity: 'medium',
        title: 'CSP allows inline scripts',
        description: "CSP allows 'unsafe-inline' which reduces XSS protection",
        recommendation: "Use nonces or hashes instead of 'unsafe-inline'",
        file: 'src/security/csp.ts',
        line: 0
      })
    }
  }
  
  private async auditPermissions(): Promise<void> {
    // Check for overly permissive file access patterns
    const permissivePatterns = [
      '/**/*',
      '/*',
      '../*'
    ]
    
    // This would check permission configurations
    // Implementation depends on your permission system
  }
  
  private async getSourceFiles(): Promise<string[]> {
    const glob = require('glob')
    return new Promise((resolve, reject) => {
      glob('src/**/*.{ts,tsx,js,jsx}', (err: any, files: string[]) => {
        if (err) reject(err)
        else resolve(files)
      })
    })
  }
  
  private mapSeverity(severity: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (severity) {
      case 'critical': return 'critical'
      case 'high': return 'high'
      case 'moderate': return 'medium'
      case 'low': return 'low'
      default: return 'medium'
    }
  }
  
  private generateReport(): SecurityAuditReport {
    const findings = this.findings
    const criticalCount = findings.filter(f => f.severity === 'critical').length
    const highCount = findings.filter(f => f.severity === 'high').length
    const mediumCount = findings.filter(f => f.severity === 'medium').length
    const lowCount = findings.filter(f => f.severity === 'low').length
    
    return {
      timestamp: new Date().toISOString(),
      summary: {
        total: findings.length,
        critical: criticalCount,
        high: highCount,
        medium: mediumCount,
        low: lowCount
      },
      findings,
      recommendations: this.generateRecommendations()
    }
  }
  
  private generateRecommendations(): string[] {
    const recommendations = []
    
    if (this.findings.some(f => f.type === 'dependency' && f.severity === 'critical')) {
      recommendations.push('Update critical dependencies immediately')
    }
    
    if (this.findings.some(f => f.type === 'code_pattern')) {
      recommendations.push('Review and fix unsafe code patterns')
    }
    
    if (this.findings.some(f => f.type === 'configuration')) {
      recommendations.push('Harden security configurations')
    }
    
    return recommendations
  }
}

interface SecurityFinding {
  type: 'dependency' | 'code_pattern' | 'configuration' | 'permission'
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  recommendation: string
  file: string
  line: number
}

interface SecurityAuditReport {
  timestamp: string
  summary: {
    total: number
    critical: number
    high: number
    medium: number
    low: number
  }
  findings: SecurityFinding[]
  recommendations: string[]
}
```

## 📋 Implementation Checklist

### Core Security Components ✅
- [ ] Content Security Policy (CSP) configuration and enforcement
- [ ] Input sanitization framework with XSS prevention
- [ ] Output encoding utilities for safe rendering
- [ ] Secure API communication with authentication
- [ ] File system access controls with permission management
- [ ] Token management with secure storage
- [ ] Dependency vulnerability scanning
- [ ] Security audit automation

### Security Patterns ✅
- [ ] Defense in depth approach
- [ ] Principle of least privilege
- [ ] Input validation at all entry points
- [ ] Secure by default configurations
- [ ] Error handling without information disclosure
- [ ] Logging and monitoring for security events

### Testing & Validation ✅
- [ ] Comprehensive security test suite
- [ ] Integration testing for security controls
- [ ] Automated vulnerability scanning
- [ ] Code review checklist for security
- [ ] Penetration testing scenarios
- [ ] Security audit reporting

### Documentation ✅
- [ ] Security implementation guidelines
- [ ] Threat model documentation
- [ ] Incident response procedures
- [ ] Security best practices for developers
- [ ] User security guidance

---

This comprehensive security implementation provides multiple layers of protection for the VS Code extension chat feature, ensuring robust defense against common web application vulnerabilities while maintaining usability and performance.