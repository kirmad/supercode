# 11-Error-Handling.md

**Comprehensive Error Handling and Recovery Strategies for VS Code Extension**

---

## 🎯 Overview

This document outlines the comprehensive error handling system for the VS Code extension chat feature, covering error boundaries, retry logic, user feedback, tool execution failures, communication layer errors, and graceful degradation strategies. The implementation ensures robust operation and excellent user experience even when things go wrong.

## 🏗️ Error Handling Architecture

### Error Classification System
```typescript
// src/types/errorTypes.ts - Error classification
export enum ErrorSeverity {
  LOW = 'low',           // Minor issues, operation can continue
  MEDIUM = 'medium',     // Important but recoverable errors
  HIGH = 'high',         // Critical errors requiring user attention
  CRITICAL = 'critical'  // System-breaking errors requiring intervention
}

export enum ErrorCategory {
  NETWORK = 'network',           // Connection and API errors
  TOOL_EXECUTION = 'tool',       // Tool execution failures
  VALIDATION = 'validation',     // Input validation errors
  PERMISSION = 'permission',     // Permission and security errors
  SYSTEM = 'system',            // System and runtime errors
  USER_INPUT = 'user_input',    // User input and interaction errors
  PARSE = 'parse',              // Data parsing and format errors
  TIMEOUT = 'timeout'           // Operation timeout errors
}

export interface ErrorContext {
  id: string
  category: ErrorCategory
  severity: ErrorSeverity
  message: string
  details?: any
  timestamp: number
  sessionId?: string
  toolCallId?: string
  retryable: boolean
  userMessage: string
  technicalMessage?: string
  recoveryActions?: RecoveryAction[]
}

export interface RecoveryAction {
  id: string
  label: string
  action: () => Promise<void>
  primary?: boolean
}
```

### Error Handling Layers
```
┌─────────────────────────────────────────┐
│           User Interface Layer          │ ← User-friendly error messages
├─────────────────────────────────────────┤
│         React Error Boundaries          │ ← Component-level error capture
├─────────────────────────────────────────┤
│         Service Layer Errors            │ ← API and tool execution errors
├─────────────────────────────────────────┤
│        Communication Layer              │ ← Network and SSE errors
├─────────────────────────────────────────┤
│         Global Error Handler            │ ← Unhandled errors and reporting
└─────────────────────────────────────────┘
```

## 💻 Core Error Handling Components

### 1. React Error Boundaries

```typescript
// src/components/error/ErrorBoundary.tsx - React error boundary
interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
  errorId: string | null
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  private errorReportingService: ErrorReportingService

  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    }
    this.errorReportingService = new ErrorReportingService()
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: generateErrorId()
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const errorContext: ErrorContext = {
      id: this.state.errorId!,
      category: ErrorCategory.SYSTEM,
      severity: ErrorSeverity.HIGH,
      message: error.message,
      details: {
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        errorBoundary: this.props.name || 'Unknown'
      },
      timestamp: Date.now(),
      retryable: true,
      userMessage: 'An unexpected error occurred in the interface',
      technicalMessage: `${error.name}: ${error.message}`,
      recoveryActions: [
        {
          id: 'reload-component',
          label: 'Reload Interface',
          action: this.handleReload,
          primary: true
        },
        {
          id: 'report-error',
          label: 'Report Issue',
          action: () => this.reportError(errorContext)
        }
      ]
    }

    this.setState({ errorInfo })
    this.errorReportingService.captureError(errorContext)
  }

  private handleReload = async () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    })
  }

  private reportError = async (context: ErrorContext) => {
    try {
      await this.errorReportingService.submitUserReport(context)
      vscode.window.showInformationMessage('Error report submitted successfully')
    } catch (err) {
      vscode.window.showErrorMessage('Failed to submit error report')
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error!}
          errorInfo={this.state.errorInfo}
          onRetry={this.handleReload}
          onReport={() => this.reportError({
            id: this.state.errorId!,
            category: ErrorCategory.SYSTEM,
            severity: ErrorSeverity.HIGH,
            message: this.state.error!.message,
            timestamp: Date.now(),
            retryable: true,
            userMessage: 'An unexpected error occurred'
          })}
        />
      )
    }

    return this.props.children
  }
}

// Error fallback component
interface ErrorFallbackProps {
  error: Error
  errorInfo: React.ErrorInfo | null
  onRetry: () => void
  onReport: () => void
}

function ErrorFallback({ error, errorInfo, onRetry, onReport }: ErrorFallbackProps) {
  const [showDetails, setShowDetails] = useState(false)

  return (
    <div className="error-fallback">
      <div className="error-fallback__header">
        <vscode-icon name="error" size="32"></vscode-icon>
        <h3>Something went wrong</h3>
      </div>
      
      <div className="error-fallback__message">
        <p>An unexpected error occurred while rendering this component.</p>
        <p>You can try reloading the interface or report this issue to help us improve.</p>
      </div>

      <div className="error-fallback__actions">
        <vscode-button onClick={onRetry} appearance="primary">
          Reload Interface
        </vscode-button>
        <vscode-button onClick={onReport} appearance="secondary">
          Report Issue
        </vscode-button>
        <vscode-button 
          onClick={() => setShowDetails(!showDetails)}
          appearance="secondary"
        >
          {showDetails ? 'Hide' : 'Show'} Details
        </vscode-button>
      </div>

      {showDetails && (
        <div className="error-fallback__details">
          <h4>Error Details</h4>
          <pre className="error-fallback__stack">
            <code>{error.message}</code>
            {error.stack && <code>{error.stack}</code>}
          </pre>
          
          {errorInfo && (
            <details>
              <summary>Component Stack</summary>
              <pre><code>{errorInfo.componentStack}</code></pre>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
```

### 2. Network and API Error Handling

```typescript
// src/services/errorHandling/networkErrorHandler.ts - Network error handling
export class NetworkErrorHandler {
  private retryAttempts = new Map<string, number>()
  private readonly maxRetries = 3
  private readonly baseDelay = 1000

  async handleApiError<T>(
    operation: () => Promise<T>,
    context: {
      operationName: string
      sessionId?: string
      retryable?: boolean
    }
  ): Promise<T> {
    const { operationName, sessionId, retryable = true } = context
    let lastError: Error

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await operation()
        
        // Reset retry count on success
        this.retryAttempts.delete(operationName)
        return result
        
      } catch (error) {
        lastError = error as Error
        
        const errorContext = this.classifyNetworkError(error as Error, {
          operationName,
          sessionId,
          attempt,
          maxAttempts: this.maxRetries
        })

        // Report error immediately for monitoring
        ErrorReportingService.getInstance().captureError(errorContext)

        // Don't retry for certain error types
        if (!retryable || !this.shouldRetry(error as Error, attempt)) {
          throw this.createUserFriendlyError(errorContext)
        }

        // Exponential backoff with jitter
        const delay = this.calculateRetryDelay(attempt)
        await this.delay(delay)
        
        console.warn(`Retrying ${operationName} (${attempt}/${this.maxRetries})`, error)
      }
    }

    throw this.createUserFriendlyError(
      this.classifyNetworkError(lastError!, {
        operationName,
        sessionId,
        attempt: this.maxRetries,
        maxAttempts: this.maxRetries
      })
    )
  }

  private classifyNetworkError(
    error: Error, 
    context: {
      operationName: string
      sessionId?: string
      attempt: number
      maxAttempts: number
    }
  ): ErrorContext {
    const { operationName, sessionId, attempt, maxAttempts } = context
    
    // Network connectivity errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return {
        id: generateErrorId(),
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.HIGH,
        message: 'Network connection failed',
        details: {
          originalError: error.message,
          operation: operationName,
          attempt,
          maxAttempts
        },
        timestamp: Date.now(),
        sessionId,
        retryable: true,
        userMessage: 'Unable to connect to the server. Please check your internet connection.',
        technicalMessage: `Network error in ${operationName}: ${error.message}`,
        recoveryActions: [
          {
            id: 'check-connection',
            label: 'Check Connection',
            action: async () => {
              const isOnline = await this.checkConnection()
              if (isOnline) {
                vscode.window.showInformationMessage('Connection restored')
              } else {
                vscode.window.showWarningMessage('Still offline')
              }
            }
          },
          {
            id: 'retry-operation',
            label: 'Retry',
            action: async () => {
              // Retry will be handled by caller
            },
            primary: true
          }
        ]
      }
    }

    // HTTP status code errors
    if (error.message.includes('HTTP')) {
      const statusMatch = error.message.match(/HTTP (\d+)/)
      const statusCode = statusMatch ? parseInt(statusMatch[1]) : 0

      return this.createHttpErrorContext(statusCode, operationName, sessionId, error)
    }

    // Timeout errors
    if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
      return {
        id: generateErrorId(),
        category: ErrorCategory.TIMEOUT,
        severity: ErrorSeverity.MEDIUM,
        message: 'Operation timed out',
        details: { operation: operationName, attempt, maxAttempts },
        timestamp: Date.now(),
        sessionId,
        retryable: true,
        userMessage: 'The operation took too long to complete. This might be due to server load.',
        technicalMessage: `Timeout in ${operationName}: ${error.message}`,
        recoveryActions: [
          {
            id: 'retry-operation',
            label: 'Try Again',
            action: async () => {
              // Retry will be handled by caller
            },
            primary: true
          }
        ]
      }
    }

    // Generic error fallback
    return {
      id: generateErrorId(),
      category: ErrorCategory.SYSTEM,
      severity: ErrorSeverity.MEDIUM,
      message: 'Unexpected error occurred',
      details: {
        originalError: error.message,
        operation: operationName,
        attempt,
        maxAttempts
      },
      timestamp: Date.now(),
      sessionId,
      retryable: true,
      userMessage: 'An unexpected error occurred. Please try again.',
      technicalMessage: `Error in ${operationName}: ${error.message}`
    }
  }

  private createHttpErrorContext(
    statusCode: number,
    operationName: string,
    sessionId?: string,
    originalError?: Error
  ): ErrorContext {
    const baseContext = {
      id: generateErrorId(),
      details: {
        statusCode,
        operation: operationName,
        originalError: originalError?.message
      },
      timestamp: Date.now(),
      sessionId
    }

    switch (Math.floor(statusCode / 100)) {
      case 4: // Client errors (400-499)
        if (statusCode === 401) {
          return {
            ...baseContext,
            category: ErrorCategory.PERMISSION,
            severity: ErrorSeverity.HIGH,
            message: 'Authentication failed',
            retryable: false,
            userMessage: 'Your session has expired. Please sign in again.',
            technicalMessage: `HTTP 401: Authentication required for ${operationName}`,
            recoveryActions: [
              {
                id: 'sign-in',
                label: 'Sign In',
                action: async () => {
                  vscode.commands.executeCommand('opencode.signIn')
                },
                primary: true
              }
            ]
          }
        }
        
        if (statusCode === 403) {
          return {
            ...baseContext,
            category: ErrorCategory.PERMISSION,
            severity: ErrorSeverity.HIGH,
            message: 'Access denied',
            retryable: false,
            userMessage: 'You don\'t have permission to perform this action.',
            technicalMessage: `HTTP 403: Insufficient permissions for ${operationName}`
          }
        }

        if (statusCode === 429) {
          return {
            ...baseContext,
            category: ErrorCategory.NETWORK,
            severity: ErrorSeverity.MEDIUM,
            message: 'Rate limit exceeded',
            retryable: true,
            userMessage: 'Too many requests. Please wait a moment before trying again.',
            technicalMessage: `HTTP 429: Rate limit exceeded for ${operationName}`,
            recoveryActions: [
              {
                id: 'retry-later',
                label: 'Try Again Later',
                action: async () => {
                  await this.delay(5000)
                  // Retry will be handled by caller
                },
                primary: true
              }
            ]
          }
        }

        return {
          ...baseContext,
          category: ErrorCategory.VALIDATION,
          severity: ErrorSeverity.MEDIUM,
          message: 'Request validation failed',
          retryable: false,
          userMessage: 'There was a problem with your request. Please check your input and try again.',
          technicalMessage: `HTTP ${statusCode}: Client error in ${operationName}`
        }

      case 5: // Server errors (500-599)
        return {
          ...baseContext,
          category: ErrorCategory.SYSTEM,
          severity: ErrorSeverity.HIGH,
          message: 'Server error',
          retryable: true,
          userMessage: 'The server encountered an error. This is usually temporary.',
          technicalMessage: `HTTP ${statusCode}: Server error in ${operationName}`,
          recoveryActions: [
            {
              id: 'retry-operation',
              label: 'Try Again',
              action: async () => {
                // Retry will be handled by caller
              },
              primary: true
            },
            {
              id: 'report-issue',
              label: 'Report Issue',
              action: async () => {
                // Report server error
              }
            }
          ]
        }

      default:
        return {
          ...baseContext,
          category: ErrorCategory.NETWORK,
          severity: ErrorSeverity.MEDIUM,
          message: 'Network error',
          retryable: true,
          userMessage: 'A network error occurred. Please try again.',
          technicalMessage: `HTTP ${statusCode}: Network error in ${operationName}`
        }
    }
  }

  private shouldRetry(error: Error, attempt: number): boolean {
    // Don't retry if we've exceeded max attempts
    if (attempt >= this.maxRetries) return false

    // Don't retry client errors (4xx) except for specific cases
    if (error.message.includes('HTTP 4')) {
      const statusMatch = error.message.match(/HTTP (\d+)/)
      const statusCode = statusMatch ? parseInt(statusMatch[1]) : 0
      
      // Retry for rate limiting and certain temporary client errors
      return [408, 429].includes(statusCode)
    }

    // Retry for network errors, timeouts, and server errors
    return error.name === 'TypeError' || 
           error.name === 'TimeoutError' || 
           error.message.includes('HTTP 5') ||
           error.message.includes('timeout') ||
           error.message.includes('fetch')
  }

  private calculateRetryDelay(attempt: number): number {
    // Exponential backoff with jitter
    const exponentialDelay = this.baseDelay * Math.pow(2, attempt - 1)
    const jitter = Math.random() * 0.1 * exponentialDelay
    return Math.min(exponentialDelay + jitter, 10000) // Cap at 10 seconds
  }

  private async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch('/health', {
        method: 'HEAD',
        cache: 'no-cache'
      })
      return response.ok
    } catch {
      return false
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private createUserFriendlyError(context: ErrorContext): Error {
    const error = new Error(context.userMessage)
    error.name = 'UserFriendlyError'
    ;(error as any).context = context
    return error
  }
}
```

### 3. Tool Execution Error Handling

```typescript
// src/services/errorHandling/toolErrorHandler.ts - Tool execution error handling
export class ToolExecutionErrorHandler {
  private readonly store = useOpenCodeStore()

  async handleToolError(
    toolCallId: string,
    error: Error,
    toolName: string,
    parameters: any
  ): Promise<void> {
    const errorContext = this.classifyToolError(error, toolName, toolCallId, parameters)
    
    // Update tool call state immediately
    this.store.updateToolCall(toolCallId, {
      state: 'error',
      error: errorContext.userMessage,
      endTime: Date.now()
    })

    // Show user notification based on severity
    await this.showUserNotification(errorContext)

    // Report error for monitoring
    ErrorReportingService.getInstance().captureError(errorContext)

    // Handle automatic recovery if appropriate
    if (errorContext.retryable && this.shouldAutoRetry(errorContext)) {
      await this.attemptAutoRecovery(toolCallId, toolName, parameters, errorContext)
    }
  }

  private classifyToolError(
    error: Error,
    toolName: string,
    toolCallId: string,
    parameters: any
  ): ErrorContext {
    const baseContext = {
      id: generateErrorId(),
      timestamp: Date.now(),
      toolCallId,
      details: {
        toolName,
        parameters,
        originalError: error.message,
        stack: error.stack
      }
    }

    // File operation errors
    if (['read', 'write', 'edit'].includes(toolName)) {
      return this.handleFileOperationError(error, toolName, baseContext)
    }

    // Shell command errors
    if (toolName === 'bash') {
      return this.handleBashError(error, baseContext)
    }

    // Permission errors
    if (error.message.includes('permission') || error.message.includes('EACCES')) {
      return {
        ...baseContext,
        category: ErrorCategory.PERMISSION,
        severity: ErrorSeverity.HIGH,
        message: 'Permission denied',
        retryable: false,
        userMessage: `Permission denied for ${toolName} operation. Check file permissions.`,
        technicalMessage: error.message,
        recoveryActions: [
          {
            id: 'check-permissions',
            label: 'Check Permissions',
            action: async () => {
              vscode.window.showInformationMessage(
                'Please check that VS Code has permission to access the file system'
              )
            }
          }
        ]
      }
    }

    // Timeout errors
    if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
      return {
        ...baseContext,
        category: ErrorCategory.TIMEOUT,
        severity: ErrorSeverity.MEDIUM,
        message: 'Tool execution timed out',
        retryable: true,
        userMessage: `${toolName} operation timed out. This might be due to a large operation or slow system.`,
        technicalMessage: error.message,
        recoveryActions: [
          {
            id: 'retry-tool',
            label: 'Try Again',
            action: async () => {
              await this.retryToolExecution(toolCallId, toolName, parameters)
            },
            primary: true
          }
        ]
      }
    }

    // Generic tool error
    return {
      ...baseContext,
      category: ErrorCategory.TOOL_EXECUTION,
      severity: ErrorSeverity.MEDIUM,
      message: 'Tool execution failed',
      retryable: true,
      userMessage: `Failed to execute ${toolName}. ${this.getToolErrorHint(toolName, error)}`,
      technicalMessage: error.message,
      recoveryActions: [
        {
          id: 'retry-tool',
          label: 'Retry',
          action: async () => {
            await this.retryToolExecution(toolCallId, toolName, parameters)
          },
          primary: true
        }
      ]
    }
  }

  private handleFileOperationError(
    error: Error,
    toolName: string,
    baseContext: any
  ): ErrorContext {
    // File not found
    if (error.message.includes('ENOENT') || error.message.includes('not found')) {
      return {
        ...baseContext,
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.MEDIUM,
        message: 'File not found',
        retryable: false,
        userMessage: 'The specified file could not be found. Please check the file path.',
        technicalMessage: error.message,
        recoveryActions: [
          {
            id: 'check-path',
            label: 'Check File Path',
            action: async () => {
              const filePath = baseContext.details.parameters.filePath || 
                             baseContext.details.parameters.file_path
              if (filePath) {
                vscode.window.showInformationMessage(`File path: ${filePath}`)
              }
            }
          }
        ]
      }
    }

    // Directory not found
    if (error.message.includes('ENOENT') && toolName === 'write') {
      return {
        ...baseContext,
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.MEDIUM,
        message: 'Directory not found',
        retryable: true,
        userMessage: 'The target directory does not exist. It may need to be created first.',
        technicalMessage: error.message,
        recoveryActions: [
          {
            id: 'create-directory',
            label: 'Create Directory',
            action: async () => {
              // Attempt to create parent directories
              const filePath = baseContext.details.parameters.filePath || 
                             baseContext.details.parameters.file_path
              if (filePath) {
                try {
                  const dirname = path.dirname(filePath)
                  await vscode.workspace.fs.createDirectory(vscode.Uri.file(dirname))
                  vscode.window.showInformationMessage('Directory created successfully')
                } catch (err) {
                  vscode.window.showErrorMessage('Failed to create directory')
                }
              }
            },
            primary: true
          }
        ]
      }
    }

    // File too large
    if (error.message.includes('file too large') || error.message.includes('EFBIG')) {
      return {
        ...baseContext,
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.MEDIUM,
        message: 'File too large',
        retryable: false,
        userMessage: 'The file is too large to process. Consider breaking it into smaller parts.',
        technicalMessage: error.message
      }
    }

    // Disk space error
    if (error.message.includes('ENOSPC') || error.message.includes('no space')) {
      return {
        ...baseContext,
        category: ErrorCategory.SYSTEM,
        severity: ErrorSeverity.HIGH,
        message: 'Insufficient disk space',
        retryable: false,
        userMessage: 'Not enough disk space to complete the operation. Please free up some space.',
        technicalMessage: error.message,
        recoveryActions: [
          {
            id: 'check-space',
            label: 'Check Disk Space',
            action: async () => {
              vscode.window.showInformationMessage(
                'Please check available disk space and try again'
              )
            }
          }
        ]
      }
    }

    return {
      ...baseContext,
      category: ErrorCategory.TOOL_EXECUTION,
      severity: ErrorSeverity.MEDIUM,
      message: 'File operation failed',
      retryable: true,
      userMessage: `Failed to ${toolName} file. ${error.message}`,
      technicalMessage: error.message
    }
  }

  private handleBashError(error: Error, baseContext: any): ErrorContext {
    // Command not found
    if (error.message.includes('command not found') || error.message.includes('not recognized')) {
      return {
        ...baseContext,
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.MEDIUM,
        message: 'Command not found',
        retryable: false,
        userMessage: 'The specified command was not found. Please check the command and try again.',
        technicalMessage: error.message,
        recoveryActions: [
          {
            id: 'check-command',
            label: 'Check Command',
            action: async () => {
              const command = baseContext.details.parameters.command
              vscode.window.showInformationMessage(`Command: ${command}`)
            }
          }
        ]
      }
    }

    // Permission denied
    if (error.message.includes('permission denied') || error.message.includes('access denied')) {
      return {
        ...baseContext,
        category: ErrorCategory.PERMISSION,
        severity: ErrorSeverity.HIGH,
        message: 'Permission denied',
        retryable: false,
        userMessage: 'Permission denied when executing command. You may need to run with elevated privileges.',
        technicalMessage: error.message
      }
    }

    // Exit code error
    if (error.message.includes('exit code')) {
      const exitCodeMatch = error.message.match(/exit code (\d+)/)
      const exitCode = exitCodeMatch ? parseInt(exitCodeMatch[1]) : 0

      return {
        ...baseContext,
        category: ErrorCategory.TOOL_EXECUTION,
        severity: exitCode === 0 ? ErrorSeverity.LOW : ErrorSeverity.MEDIUM,
        message: 'Command execution failed',
        retryable: exitCode !== 127, // Don't retry "command not found"
        userMessage: `Command failed with exit code ${exitCode}. Check the command output for details.`,
        technicalMessage: error.message,
        recoveryActions: [
          {
            id: 'view-output',
            label: 'View Output',
            action: async () => {
              // Show command output in a new document
            }
          }
        ]
      }
    }

    return {
      ...baseContext,
      category: ErrorCategory.TOOL_EXECUTION,
      severity: ErrorSeverity.MEDIUM,
      message: 'Shell command failed',
      retryable: true,
      userMessage: 'Shell command execution failed. Check the command and try again.',
      technicalMessage: error.message
    }
  }

  private getToolErrorHint(toolName: string, error: Error): string {
    const hints: Record<string, string> = {
      'read': 'Please check that the file exists and is readable.',
      'write': 'Please check that you have write permissions and sufficient disk space.',
      'edit': 'Please verify the file exists and the edit parameters are correct.',
      'bash': 'Please check the command syntax and permissions.',
      'webfetch': 'Please check your internet connection and the URL.',
      'todowrite': 'Please check the todo list format.',
      'todoread': 'Unable to read current todos.'
    }

    return hints[toolName] || 'Please check the tool parameters and try again.'
  }

  private async showUserNotification(errorContext: ErrorContext): Promise<void> {
    const message = errorContext.userMessage
    const actions = errorContext.recoveryActions || []

    if (errorContext.severity === ErrorSeverity.CRITICAL) {
      const choice = await vscode.window.showErrorMessage(
        message,
        ...actions.map(action => action.label)
      )
      if (choice) {
        const action = actions.find(a => a.label === choice)
        if (action) await action.action()
      }
    } else if (errorContext.severity === ErrorSeverity.HIGH) {
      const choice = await vscode.window.showWarningMessage(
        message,
        ...actions.slice(0, 2).map(action => action.label) // Limit to 2 actions
      )
      if (choice) {
        const action = actions.find(a => a.label === choice)
        if (action) await action.action()
      }
    } else {
      // For medium and low severity, just show info message
      vscode.window.showInformationMessage(message)
    }
  }

  private shouldAutoRetry(errorContext: ErrorContext): boolean {
    // Auto-retry for temporary network issues and timeouts
    return errorContext.category === ErrorCategory.TIMEOUT ||
           (errorContext.category === ErrorCategory.NETWORK && errorContext.retryable)
  }

  private async attemptAutoRecovery(
    toolCallId: string,
    toolName: string,
    parameters: any,
    errorContext: ErrorContext
  ): Promise<void> {
    try {
      await this.delay(2000) // Wait 2 seconds before retry
      
      // Update tool state to show retry attempt
      this.store.updateToolCall(toolCallId, {
        state: 'running',
        error: undefined
      })

      // Retry the tool execution through the store
      await this.retryToolExecution(toolCallId, toolName, parameters)
      
    } catch (retryError) {
      // If retry also fails, show final error
      this.store.updateToolCall(toolCallId, {
        state: 'error',
        error: 'Retry failed: ' + (retryError as Error).message,
        endTime: Date.now()
      })
    }
  }

  private async retryToolExecution(
    toolCallId: string,
    toolName: string,
    parameters: any
  ): Promise<void> {
    // This would integrate with the actual tool execution system
    // For now, we'll use the store to trigger a retry
    const { executeToolCall } = this.store.getState()
    await executeToolCall(toolName, parameters, toolCallId)
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
```

### 4. SSE Connection Error Handling

```typescript
// src/services/errorHandling/sseErrorHandler.ts - SSE connection error handling
export class SSEErrorHandler {
  private eventSource: EventSource | null = null
  private reconnectAttempts = 0
  private readonly maxReconnectAttempts = 10
  private readonly baseReconnectDelay = 1000
  private connectionMonitor: NodeJS.Timeout | null = null
  private isManuallyDisconnected = false

  constructor(private store: ReturnType<typeof useOpenCodeStore>) {}

  connect(sessionId: string): void {
    this.isManuallyDisconnected = false
    this.attemptConnection(sessionId)
  }

  disconnect(): void {
    this.isManuallyDisconnected = true
    this.cleanup()
  }

  private attemptConnection(sessionId: string): void {
    try {
      this.cleanup()

      const url = `${config.apiBaseUrl}/v1/sessions/${sessionId}/events`
      this.eventSource = new EventSource(url)

      this.eventSource.onopen = this.handleOpen
      this.eventSource.onmessage = this.handleMessage
      this.eventSource.onerror = (event) => this.handleError(event, sessionId)

      // Set up connection monitoring
      this.startConnectionMonitor()

    } catch (error) {
      this.handleConnectionError(error as Error, sessionId)
    }
  }

  private handleOpen = (event: Event): void => {
    console.log('SSE connection established')
    this.reconnectAttempts = 0
    
    this.store.setConnectionState({
      connected: true,
      connecting: false,
      error: null
    })

    // Send connection restored notification if this was a reconnection
    if (this.reconnectAttempts > 0) {
      vscode.window.showInformationMessage('Connection restored')
    }
  }

  private handleMessage = (event: MessageEvent): void => {
    try {
      const data = JSON.parse(event.data)
      this.processSSEMessage(data)
    } catch (error) {
      console.error('Failed to parse SSE message:', error)
      
      const errorContext: ErrorContext = {
        id: generateErrorId(),
        category: ErrorCategory.PARSE,
        severity: ErrorSeverity.LOW,
        message: 'Failed to parse server message',
        details: {
          rawData: event.data,
          parseError: (error as Error).message
        },
        timestamp: Date.now(),
        retryable: false,
        userMessage: 'Received invalid data from server',
        technicalMessage: `Parse error: ${(error as Error).message}`
      }

      ErrorReportingService.getInstance().captureError(errorContext)
    }
  }

  private handleError = (event: Event, sessionId: string): void => {
    console.error('SSE connection error:', event)

    const errorContext: ErrorContext = {
      id: generateErrorId(),
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.HIGH,
      message: 'SSE connection error',
      details: {
        eventType: event.type,
        readyState: this.eventSource?.readyState,
        url: this.eventSource?.url,
        reconnectAttempts: this.reconnectAttempts
      },
      timestamp: Date.now(),
      sessionId,
      retryable: true,
      userMessage: 'Lost connection to server',
      technicalMessage: 'SSE connection failed'
    }

    this.store.setConnectionState({
      connected: false,
      connecting: false,
      error: errorContext.userMessage
    })

    // Attempt reconnection if not manually disconnected
    if (!this.isManuallyDisconnected) {
      this.attemptReconnection(sessionId, errorContext)
    }

    ErrorReportingService.getInstance().captureError(errorContext)
  }

  private async attemptReconnection(sessionId: string, lastError: ErrorContext): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      await this.handleMaxReconnectAttemptsReached(lastError)
      return
    }

    this.reconnectAttempts++
    const delay = this.calculateReconnectDelay()

    console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`)

    this.store.setConnectionState({
      connected: false,
      connecting: true,
      error: `Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    })

    setTimeout(() => {
      if (!this.isManuallyDisconnected) {
        this.attemptConnection(sessionId)
      }
    }, delay)
  }

  private async handleMaxReconnectAttemptsReached(lastError: ErrorContext): Promise<void> {
    const errorContext: ErrorContext = {
      ...lastError,
      id: generateErrorId(),
      severity: ErrorSeverity.CRITICAL,
      message: 'Failed to reconnect to server',
      userMessage: 'Unable to establish connection to server. Please check your internet connection.',
      recoveryActions: [
        {
          id: 'retry-connection',
          label: 'Try Again',
          action: async () => {
            this.reconnectAttempts = 0
            const sessionId = this.store.getState().currentSession?.id
            if (sessionId) {
              this.attemptConnection(sessionId)
            }
          },
          primary: true
        },
        {
          id: 'check-network',
          label: 'Check Network',
          action: async () => {
            const isOnline = await this.checkNetworkConnectivity()
            if (isOnline) {
              vscode.window.showInformationMessage('Network connection is available')
            } else {
              vscode.window.showErrorMessage('No network connection detected')
            }
          }
        },
        {
          id: 'work-offline',
          label: 'Work Offline',
          action: async () => {
            this.store.setOfflineMode(true)
            vscode.window.showInformationMessage('Switched to offline mode')
          }
        }
      ]
    }

    this.store.setConnectionState({
      connected: false,
      connecting: false,
      error: errorContext.userMessage
    })

    // Show critical error dialog
    const choice = await vscode.window.showErrorMessage(
      errorContext.userMessage,
      ...errorContext.recoveryActions!.map(action => action.label)
    )

    if (choice) {
      const action = errorContext.recoveryActions!.find(a => a.label === choice)
      if (action) await action.action()
    }

    ErrorReportingService.getInstance().captureError(errorContext)
  }

  private calculateReconnectDelay(): number {
    // Exponential backoff with jitter, capped at 30 seconds
    const exponentialDelay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
    const jitter = Math.random() * 0.1 * exponentialDelay
    return Math.min(exponentialDelay + jitter, 30000)
  }

  private startConnectionMonitor(): void {
    // Monitor connection health every 30 seconds
    this.connectionMonitor = setInterval(() => {
      if (this.eventSource && this.eventSource.readyState === EventSource.CLOSED) {
        console.warn('SSE connection closed unexpectedly')
        this.handleError(new Event('error'), this.store.getState().currentSession?.id || '')
      }
    }, 30000)
  }

  private async checkNetworkConnectivity(): Promise<boolean> {
    try {
      const response = await fetch(`${config.apiBaseUrl}/health`, {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000)
      })
      return response.ok
    } catch {
      return false
    }
  }

  private processSSEMessage(data: any): void {
    try {
      switch (data.type) {
        case 'message_start':
          this.store.addMessage({
            id: data.data.id,
            role: data.data.role,
            content: '',
            timestamp: Date.now()
          })
          break

        case 'message_delta':
          this.store.updateMessageContent(data.data.id, data.data.content)
          break

        case 'tool_call_start':
          this.store.addToolCall({
            id: data.data.id,
            name: data.data.name,
            parameters: data.data.parameters,
            state: 'running',
            startTime: Date.now()
          })
          break

        case 'tool_call_result':
          this.store.updateToolCall(data.data.id, {
            state: 'completed',
            result: data.data.result,
            endTime: Date.now()
          })
          break

        case 'error':
          this.handleServerError(data.data)
          break

        default:
          console.warn('Unknown SSE message type:', data.type)
      }
    } catch (error) {
      console.error('Error processing SSE message:', error)
    }
  }

  private handleServerError(errorData: any): void {
    const errorContext: ErrorContext = {
      id: errorData.id || generateErrorId(),
      category: ErrorCategory.SYSTEM,
      severity: ErrorSeverity.HIGH,
      message: errorData.message || 'Server error',
      details: errorData,
      timestamp: Date.now(),
      retryable: false,
      userMessage: errorData.userMessage || 'The server encountered an error',
      technicalMessage: errorData.technicalMessage || errorData.message
    }

    // Show error to user
    vscode.window.showErrorMessage(errorContext.userMessage)

    // Report error
    ErrorReportingService.getInstance().captureError(errorContext)
  }

  private handleConnectionError(error: Error, sessionId: string): void {
    const errorContext: ErrorContext = {
      id: generateErrorId(),
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.HIGH,
      message: 'Failed to establish SSE connection',
      details: {
        error: error.message,
        sessionId,
        reconnectAttempts: this.reconnectAttempts
      },
      timestamp: Date.now(),
      sessionId,
      retryable: true,
      userMessage: 'Failed to connect to server',
      technicalMessage: `SSE connection error: ${error.message}`
    }

    this.store.setConnectionState({
      connected: false,
      connecting: false,
      error: errorContext.userMessage
    })

    ErrorReportingService.getInstance().captureError(errorContext)

    // Attempt reconnection
    if (!this.isManuallyDisconnected) {
      this.attemptReconnection(sessionId, errorContext)
    }
  }

  private cleanup(): void {
    if (this.connectionMonitor) {
      clearInterval(this.connectionMonitor)
      this.connectionMonitor = null
    }

    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
  }
}
```

### 5. Error Reporting and Telemetry

```typescript
// src/services/errorReporting.ts - Error reporting service
export class ErrorReportingService {
  private static instance: ErrorReportingService
  private errorQueue: ErrorContext[] = []
  private isSubmitting = false

  static getInstance(): ErrorReportingService {
    if (!ErrorReportingService.instance) {
      ErrorReportingService.instance = new ErrorReportingService()
    }
    return ErrorReportingService.instance
  }

  async captureError(context: ErrorContext): Promise<void> {
    // Add to queue for batch processing
    this.errorQueue.push(context)

    // Log locally for development
    this.logErrorLocally(context)

    // Submit to telemetry service
    if (config.enableErrorReporting) {
      await this.submitToTelemetry(context)
    }

    // Trigger batch submission if queue is full
    if (this.errorQueue.length >= 10 && !this.isSubmitting) {
      this.submitBatch()
    }
  }

  async submitUserReport(context: ErrorContext): Promise<void> {
    // User-initiated error reports get priority
    const reportData = {
      ...context,
      userInitiated: true,
      environment: {
        vscodeVersion: vscode.version,
        extensionVersion: this.getExtensionVersion(),
        platform: process.platform,
        nodeVersion: process.version
      }
    }

    try {
      await this.sendToReportingService(reportData)
    } catch (error) {
      console.error('Failed to submit user report:', error)
      throw error
    }
  }

  private logErrorLocally(context: ErrorContext): void {
    const logLevel = this.getLogLevel(context.severity)
    const message = `[${context.category}] ${context.message}`
    
    switch (logLevel) {
      case 'error':
        console.error(message, context)
        break
      case 'warn':
        console.warn(message, context)
        break
      case 'info':
        console.info(message, context)
        break
      default:
        console.log(message, context)
    }
  }

  private async submitToTelemetry(context: ErrorContext): Promise<void> {
    try {
      // Sanitize sensitive data
      const sanitizedContext = this.sanitizeErrorContext(context)

      // Submit to VS Code telemetry
      vscode.env.telemetry.sendTelemetryErrorEvent('opencode.error', {
        category: sanitizedContext.category,
        severity: sanitizedContext.severity,
        message: sanitizedContext.message,
        retryable: sanitizedContext.retryable.toString(),
        timestamp: sanitizedContext.timestamp.toString()
      })

    } catch (error) {
      console.error('Failed to submit telemetry:', error)
    }
  }

  private async submitBatch(): Promise<void> {
    if (this.isSubmitting || this.errorQueue.length === 0) return

    this.isSubmitting = true
    const batch = this.errorQueue.splice(0, 10) // Process up to 10 errors

    try {
      await this.sendBatchToReportingService(batch)
    } catch (error) {
      console.error('Failed to submit error batch:', error)
      // Re-queue failed errors
      this.errorQueue.unshift(...batch)
    } finally {
      this.isSubmitting = false
    }
  }

  private sanitizeErrorContext(context: ErrorContext): ErrorContext {
    // Remove potentially sensitive information
    const sanitized = { ...context }
    
    if (sanitized.details) {
      delete sanitized.details.filePath
      delete sanitized.details.parameters?.content
      delete sanitized.details.stack
    }

    return sanitized
  }

  private getLogLevel(severity: ErrorSeverity): 'error' | 'warn' | 'info' | 'log' {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return 'error'
      case ErrorSeverity.MEDIUM:
        return 'warn'
      case ErrorSeverity.LOW:
        return 'info'
      default:
        return 'log'
    }
  }

  private getExtensionVersion(): string {
    return vscode.extensions.getExtension('opencode.vscode-extension')?.packageJSON.version || 'unknown'
  }

  private async sendToReportingService(data: any): Promise<void> {
    // Implementation would send to actual reporting service
    console.log('Sending error report:', data)
  }

  private async sendBatchToReportingService(batch: ErrorContext[]): Promise<void> {
    // Implementation would send batch to actual reporting service
    console.log('Sending error batch:', batch)
  }
}
```

### 6. User-Facing Error Components

```typescript
// src/components/error/ErrorDisplay.tsx - User-facing error display
interface ErrorDisplayProps {
  error: ErrorContext
  onRetry?: () => void
  onDismiss?: () => void
  compact?: boolean
}

export function ErrorDisplay({ error, onRetry, onDismiss, compact = false }: ErrorDisplayProps) {
  const [showDetails, setShowDetails] = useState(false)

  const getErrorIcon = (category: ErrorCategory) => {
    switch (category) {
      case ErrorCategory.NETWORK:
        return 'cloud-offline'
      case ErrorCategory.PERMISSION:
        return 'lock'
      case ErrorCategory.VALIDATION:
        return 'warning'
      case ErrorCategory.TOOL_EXECUTION:
        return 'tools'
      default:
        return 'error'
    }
  }

  const getSeverityClass = (severity: ErrorSeverity) => {
    return `error-display--${severity}`
  }

  if (compact) {
    return (
      <div className={`error-display error-display--compact ${getSeverityClass(error.severity)}`}>
        <vscode-icon name={getErrorIcon(error.category)} size="16"></vscode-icon>
        <span className="error-display__message">{error.userMessage}</span>
        {onRetry && error.retryable && (
          <vscode-button size="small" onClick={onRetry} appearance="icon">
            <vscode-icon name="refresh"></vscode-icon>
          </vscode-button>
        )}
        {onDismiss && (
          <vscode-button size="small" onClick={onDismiss} appearance="icon">
            <vscode-icon name="close"></vscode-icon>
          </vscode-button>
        )}
      </div>
    )
  }

  return (
    <div className={`error-display ${getSeverityClass(error.severity)}`}>
      <div className="error-display__header">
        <div className="error-display__icon">
          <vscode-icon name={getErrorIcon(error.category)} size="24"></vscode-icon>
        </div>
        <div className="error-display__title">
          <h4>{error.message}</h4>
          <p className="error-display__description">{error.userMessage}</p>
        </div>
        {onDismiss && (
          <vscode-button onClick={onDismiss} appearance="icon">
            <vscode-icon name="close"></vscode-icon>
          </vscode-button>
        )}
      </div>

      {error.recoveryActions && error.recoveryActions.length > 0 && (
        <div className="error-display__actions">
          {error.recoveryActions.map((action, index) => (
            <vscode-button
              key={action.id}
              onClick={action.action}
              appearance={action.primary ? 'primary' : 'secondary'}
            >
              {action.label}
            </vscode-button>
          ))}
        </div>
      )}

      <div className="error-display__footer">
        <vscode-button 
          onClick={() => setShowDetails(!showDetails)}
          appearance="secondary"
          size="small"
        >
          {showDetails ? 'Hide' : 'Show'} Technical Details
        </vscode-button>

        <span className="error-display__timestamp">
          {new Date(error.timestamp).toLocaleTimeString()}
        </span>
      </div>

      {showDetails && (
        <div className="error-display__details">
          <h5>Technical Information</h5>
          <div className="error-display__detail-item">
            <strong>Error ID:</strong> {error.id}
          </div>
          <div className="error-display__detail-item">
            <strong>Category:</strong> {error.category}
          </div>
          <div className="error-display__detail-item">
            <strong>Severity:</strong> {error.severity}
          </div>
          {error.technicalMessage && (
            <div className="error-display__detail-item">
              <strong>Technical Message:</strong> {error.technicalMessage}
            </div>
          )}
          {error.details && (
            <details>
              <summary>Additional Details</summary>
              <pre><code>{JSON.stringify(error.details, null, 2)}</code></pre>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

// Error notification system
export function ErrorNotificationProvider({ children }: { children: React.ReactNode }) {
  const [errors, setErrors] = useState<ErrorContext[]>([])

  const addError = useCallback((error: ErrorContext) => {
    setErrors(prev => [...prev, error])

    // Auto-dismiss low severity errors after 5 seconds
    if (error.severity === ErrorSeverity.LOW) {
      setTimeout(() => {
        setErrors(prev => prev.filter(e => e.id !== error.id))
      }, 5000)
    }
  }, [])

  const removeError = useCallback((errorId: string) => {
    setErrors(prev => prev.filter(e => e.id !== errorId))
  }, [])

  const retryError = useCallback(async (error: ErrorContext) => {
    if (error.recoveryActions && error.recoveryActions.length > 0) {
      const primaryAction = error.recoveryActions.find(a => a.primary) || error.recoveryActions[0]
      await primaryAction.action()
      removeError(error.id)
    }
  }, [removeError])

  return (
    <ErrorContext.Provider value={{ addError, removeError }}>
      {children}
      
      <div className="error-notifications">
        {errors.map(error => (
          <ErrorDisplay
            key={error.id}
            error={error}
            onRetry={error.retryable ? () => retryError(error) : undefined}
            onDismiss={() => removeError(error.id)}
            compact={error.severity === ErrorSeverity.LOW}
          />
        ))}
      </div>
    </ErrorContext.Provider>
  )
}
```

## 🎯 Integration and Usage

### Error Handler Integration

```typescript
// src/hooks/useErrorHandling.ts - React hook for error handling
export function useErrorHandling() {
  const { addError } = useContext(ErrorContext)
  const networkErrorHandler = useMemo(() => new NetworkErrorHandler(), [])
  const toolErrorHandler = useMemo(() => new ToolExecutionErrorHandler(), [])

  const handleApiCall = useCallback(async <T>(
    operation: () => Promise<T>,
    operationName: string,
    sessionId?: string
  ): Promise<T> => {
    return networkErrorHandler.handleApiError(operation, {
      operationName,
      sessionId,
      retryable: true
    })
  }, [networkErrorHandler])

  const handleToolError = useCallback(async (
    toolCallId: string,
    error: Error,
    toolName: string,
    parameters: any
  ): Promise<void> => {
    return toolErrorHandler.handleToolError(toolCallId, error, toolName, parameters)
  }, [toolErrorHandler])

  const showError = useCallback((error: ErrorContext) => {
    addError(error)
  }, [addError])

  return {
    handleApiCall,
    handleToolError,
    showError
  }
}
```

### Store Integration

```typescript
// src/stores/openCodeStore.ts - Error handling in store
const openCodeStore = create<OpenCodeState>((set, get) => ({
  // ... other state

  setConnectionState: (state: ConnectionState) => {
    set({ connectionState: state })
    
    // Show error notification if connection failed
    if (!state.connected && state.error) {
      const errorContext: ErrorContext = {
        id: generateErrorId(),
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.HIGH,
        message: 'Connection lost',
        timestamp: Date.now(),
        retryable: true,
        userMessage: state.error
      }
      
      ErrorReportingService.getInstance().captureError(errorContext)
    }
  },

  executeToolCall: async (toolName: string, parameters: any, toolCallId?: string) => {
    const callId = toolCallId || generateId()
    
    try {
      set(state => ({
        toolCalls: [
          ...state.toolCalls,
          {
            id: callId,
            name: toolName,
            parameters,
            state: 'running',
            startTime: Date.now()
          }
        ]
      }))

      const result = await executeToolOnServer(toolName, parameters)
      
      set(state => ({
        toolCalls: state.toolCalls.map(tc =>
          tc.id === callId
            ? { ...tc, state: 'completed', result, endTime: Date.now() }
            : tc
        )
      }))

    } catch (error) {
      const toolErrorHandler = new ToolExecutionErrorHandler()
      await toolErrorHandler.handleToolError(callId, error as Error, toolName, parameters)
    }
  }
}))
```

## 📊 Error Handling Metrics and Monitoring

### Error Tracking

```typescript
// src/services/errorMetrics.ts - Error metrics collection
export class ErrorMetricsService {
  private errorCounts = new Map<string, number>()
  private errorTrends = new Map<string, number[]>()

  trackError(context: ErrorContext): void {
    const key = `${context.category}-${context.severity}`
    this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1)

    // Track hourly trends
    const hour = new Date().getHours()
    const trends = this.errorTrends.get(key) || new Array(24).fill(0)
    trends[hour]++
    this.errorTrends.set(key, trends)
  }

  getErrorSummary(): ErrorSummary {
    return {
      totalErrors: Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0),
      errorsByCategory: Object.fromEntries(this.errorCounts),
      trends: Object.fromEntries(this.errorTrends)
    }
  }

  getMostCommonErrors(): Array<{ key: string; count: number }> {
    return Array.from(this.errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
  }
}
```

## 🔧 Configuration and Customization

### Error Handling Configuration

```typescript
// src/config/errorHandling.ts - Error handling configuration
export interface ErrorHandlingConfig {
  retryAttempts: number
  retryDelay: number
  enableUserReporting: boolean
  enableTelemetry: boolean
  autoRetryCategories: ErrorCategory[]
  notificationDuration: Record<ErrorSeverity, number>
  logLevel: 'debug' | 'info' | 'warn' | 'error'
}

export const defaultErrorConfig: ErrorHandlingConfig = {
  retryAttempts: 3,
  retryDelay: 1000,
  enableUserReporting: true,
  enableTelemetry: true,
  autoRetryCategories: [ErrorCategory.NETWORK, ErrorCategory.TIMEOUT],
  notificationDuration: {
    [ErrorSeverity.LOW]: 5000,
    [ErrorSeverity.MEDIUM]: 10000,
    [ErrorSeverity.HIGH]: 0, // Manual dismiss
    [ErrorSeverity.CRITICAL]: 0 // Manual dismiss
  },
  logLevel: 'warn'
}
```

## 🎯 Testing Error Scenarios

### Error Simulation for Testing

```typescript
// src/utils/errorSimulation.ts - Error simulation utilities
export class ErrorSimulator {
  static simulateNetworkError(): Error {
    return new Error('TypeError: fetch failed')
  }

  static simulateTimeoutError(): Error {
    const error = new Error('Operation timed out')
    error.name = 'TimeoutError'
    return error
  }

  static simulatePermissionError(): Error {
    return new Error('EACCES: permission denied')
  }

  static simulateFileNotFoundError(): Error {
    return new Error('ENOENT: no such file or directory')
  }

  static simulateServerError(statusCode: number = 500): Error {
    return new Error(`HTTP ${statusCode}: Internal Server Error`)
  }
}
```

---

## 📝 Summary

This comprehensive error handling system provides:

1. **React Error Boundaries** - Component-level error capture and recovery
2. **Network Error Handling** - Robust retry logic for API failures and connection issues
3. **Tool Execution Error Handling** - Specialized handling for tool operation failures
4. **SSE Connection Error Handling** - Automatic reconnection with exponential backoff
5. **Error Reporting and Telemetry** - Comprehensive error tracking and user feedback
6. **User-Friendly Error Display** - Clear error messages with recovery actions
7. **Graceful Degradation** - Fallback strategies for different failure scenarios

The system ensures excellent user experience by providing clear error messages, automated recovery where possible, and actionable steps for manual recovery when needed. All errors are properly classified, tracked, and reported for continuous improvement of the extension's reliability.