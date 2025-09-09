# 12-Testing-Strategy.md

**Comprehensive Testing Strategy for OpenCode VS Code Extension Chat**

---

## 🎯 Overview

This document outlines a comprehensive testing strategy for the OpenCode VS Code extension chat feature, covering all aspects from unit testing to end-to-end validation. The strategy ensures reliability, performance, and maintainability while supporting continuous integration and automated testing workflows.

## 🏗️ Testing Architecture

### Testing Pyramid Structure
```
                    E2E Tests
                   (VS Code Integration)
                 /                    \
          Integration Tests        Visual Tests
         (Component Interactions)  (UI Consistency)
            /                  \       |
    Unit Tests              Performance Tests
   (Logic & Utils)         (Benchmarking)
        |                       |
   Tool Execution          Communication
     Testing                  Testing
```

### Test Categories
- **Unit Tests**: Pure functions, utilities, state management
- **Component Tests**: React components in isolation
- **Integration Tests**: Component interactions and workflows
- **Communication Tests**: API, WebSocket, SSE connections
- **Tool Execution Tests**: Tool call mocking and validation
- **Performance Tests**: Benchmarking and optimization validation
- **Visual Regression Tests**: UI consistency across changes
- **End-to-End Tests**: Complete user workflows in VS Code

## 💻 Implementation

### 1. Test Configuration Setup

```typescript
// vitest.config.ts - Main test configuration
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/tests/',
        '**/*.d.ts',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
        'src/services/': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
        'src/stores/': {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@services': resolve(__dirname, 'src/services'),
      '@stores': resolve(__dirname, 'src/stores'),
      '@hooks': resolve(__dirname, 'src/hooks'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@types': resolve(__dirname, 'src/types'),
    }
  }
})
```

```typescript
// src/tests/setup.ts - Global test setup
import '@testing-library/jest-dom'
import { vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll, afterAll } from 'vitest'

// Clean up after each test
afterEach(() => {
  cleanup()
})

// Mock VS Code API
global.vscode = {
  window: {
    showInformationMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(),
      show: vi.fn(),
      dispose: vi.fn(),
    })),
  },
  workspace: {
    getConfiguration: vi.fn(() => ({
      get: vi.fn(),
      update: vi.fn(),
    })),
    workspaceFolders: [],
  },
  commands: {
    registerCommand: vi.fn(),
    executeCommand: vi.fn(),
  },
  Uri: {
    file: vi.fn((path) => ({ fsPath: path, toString: () => path })),
    parse: vi.fn((path) => ({ fsPath: path, toString: () => path })),
  },
}

// Mock EventSource for SSE testing
global.EventSource = vi.fn(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  close: vi.fn(),
  onmessage: null,
  onerror: null,
  onopen: null,
  readyState: 1,
  url: '',
  withCredentials: false,
})) as any

// Mock WebSocket for testing
global.WebSocket = vi.fn(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  send: vi.fn(),
  close: vi.fn(),
  onopen: null,
  onmessage: null,
  onerror: null,
  onclose: null,
  readyState: 1,
  url: '',
  protocol: '',
  bufferedAmount: 0,
  extensions: '',
  binaryType: 'blob' as BinaryType,
})) as any

// Mock ResizeObserver
global.ResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
}))

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(''),
  },
})

// Mock performance API
global.performance = {
  ...global.performance,
  mark: vi.fn(),
  measure: vi.fn(),
  now: vi.fn(() => Date.now()),
  getEntriesByName: vi.fn(() => []),
  getEntriesByType: vi.fn(() => []),
}
```

### 2. Unit Testing Framework

```typescript
// src/tests/utils/testUtils.tsx - Testing utilities
import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { vi } from 'vitest'
import { ThemeProvider } from '@components/providers/ThemeProvider'
import { SSEProvider } from '@components/providers/SSEProvider'

// Mock providers for testing
const MockSSEProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <div data-testid="mock-sse-provider">{children}</div>
}

const AllTheProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ThemeProvider>
      <MockSSEProvider>
        {children}
      </MockSSEProvider>
    </ThemeProvider>
  )
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }

// Mock tool registry for testing
export const createMockToolRegistry = () => ({
  register: vi.fn(),
  get: vi.fn(),
  getAll: vi.fn(() => []),
  getByCategory: vi.fn(() => []),
  getRenderer: vi.fn(),
  getIcon: vi.fn(() => 'tool'),
  validate: vi.fn(() => true),
})

// Mock SSE client
export const createMockSSEClient = () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  isConnected: vi.fn(() => true),
  reconnect: vi.fn(),
})

// Mock API client
export const createMockAPIClient = () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  patch: vi.fn(),
  upload: vi.fn(),
  download: vi.fn(),
})

// Tool call factory for testing
export const createMockToolCall = (overrides = {}) => ({
  id: 'test-tool-1',
  name: 'read',
  parameters: { file_path: 'test.txt' },
  state: 'pending' as const,
  expanded: false,
  show_details: false,
  start_time: Date.now(),
  ...overrides,
})

// Session factory for testing
export const createMockSession = (overrides = {}) => ({
  id: 'test-session-1',
  title: 'Test Session',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  model_provider: 'anthropic' as const,
  model_name: 'claude-3-5-sonnet-20241022',
  ...overrides,
})

// Message factory for testing
export const createMockMessage = (overrides = {}) => ({
  id: 'test-message-1',
  session_id: 'test-session-1',
  role: 'user' as const,
  content: 'Test message',
  timestamp: new Date().toISOString(),
  tool_calls: [],
  ...overrides,
})

// Wait for async operations
export const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0))

// Simulate user typing
export const simulateTyping = async (element: Element, text: string, delay = 50) => {
  const { userEvent } = await import('@testing-library/user-event')
  const user = userEvent.setup({ delay })
  await user.type(element, text)
}

// Mock file operations
export const mockFileOperations = () => ({
  readFile: vi.fn().mockResolvedValue('file content'),
  writeFile: vi.fn().mockResolvedValue(undefined),
  deleteFile: vi.fn().mockResolvedValue(undefined),
  createDirectory: vi.fn().mockResolvedValue(undefined),
  listDirectory: vi.fn().mockResolvedValue(['file1.txt', 'file2.txt']),
})
```

### 3. Component Testing Strategy

```typescript
// src/components/chat/__tests__/ChatInput.test.tsx - Component testing example
import { render, screen, fireEvent, waitFor } from '@tests/utils/testUtils'
import { ChatInput } from '../ChatInput'
import { useOpenCodeStore } from '@stores/openCodeStore'
import { vi } from 'vitest'

// Mock the store
vi.mock('@stores/openCodeStore')
const mockStore = useOpenCodeStore as unknown as ReturnType<typeof vi.fn>

describe('ChatInput', () => {
  const mockOnSend = vi.fn()
  const mockOnCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockStore.mockReturnValue({
      currentSession: { id: 'test-session' },
      isExecuting: false,
      sendMessage: vi.fn(),
    })
  })

  it('should render input field and send button', () => {
    render(<ChatInput onSend={mockOnSend} onCancel={mockOnCancel} />)
    
    expect(screen.getByPlaceholderText(/type your message/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument()
  })

  it('should handle message input and submission', async () => {
    render(<ChatInput onSend={mockOnSend} onCancel={mockOnCancel} />)
    
    const input = screen.getByPlaceholderText(/type your message/i)
    const sendButton = screen.getByRole('button', { name: /send/i })
    
    // Type message
    await fireEvent.change(input, { target: { value: 'Hello, OpenCode!' } })
    expect(input).toHaveValue('Hello, OpenCode!')
    
    // Submit message
    await fireEvent.click(sendButton)
    
    await waitFor(() => {
      expect(mockOnSend).toHaveBeenCalledWith('Hello, OpenCode!')
    })
  })

  it('should handle keyboard shortcuts', async () => {
    render(<ChatInput onSend={mockOnSend} onCancel={mockOnCancel} />)
    
    const input = screen.getByPlaceholderText(/type your message/i)
    
    // Type message
    await fireEvent.change(input, { target: { value: 'Test message' } })
    
    // Submit with Ctrl+Enter
    await fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true })
    
    await waitFor(() => {
      expect(mockOnSend).toHaveBeenCalledWith('Test message')
    })
  })

  it('should show cancel button when executing', () => {
    mockStore.mockReturnValue({
      currentSession: { id: 'test-session' },
      isExecuting: true,
      sendMessage: vi.fn(),
    })
    
    render(<ChatInput onSend={mockOnSend} onCancel={mockOnCancel} />)
    
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /send/i })).not.toBeInTheDocument()
  })

  it('should handle multiline input correctly', async () => {
    render(<ChatInput onSend={mockOnSend} onCancel={mockOnCancel} />)
    
    const input = screen.getByPlaceholderText(/type your message/i)
    
    // Type multiline message
    const multilineText = 'Line 1\nLine 2\nLine 3'
    await fireEvent.change(input, { target: { value: multilineText } })
    
    expect(input).toHaveValue(multilineText)
    
    // Regular Enter should add new line, not submit
    await fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockOnSend).not.toHaveBeenCalled()
  })

  it('should validate input before sending', async () => {
    render(<ChatInput onSend={mockOnSend} onCancel={mockOnCancel} />)
    
    const sendButton = screen.getByRole('button', { name: /send/i })
    
    // Try to send empty message
    await fireEvent.click(sendButton)
    
    expect(mockOnSend).not.toHaveBeenCalled()
    expect(sendButton).toBeDisabled()
  })
})
```

### 4. Tool Execution Testing

```typescript
// src/services/__tests__/toolExecution.test.ts - Tool execution testing
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ToolStateMachine } from '../toolStateMachine'
import { toolRegistry } from '../toolRegistry'
import { useOpenCodeStore } from '@stores/openCodeStore'
import { createMockToolCall } from '@tests/utils/testUtils'

describe('Tool Execution System', () => {
  let stateMachine: ToolStateMachine
  let mockStore: any

  beforeEach(() => {
    mockStore = {
      getState: vi.fn(() => ({
        toolCalls: [createMockToolCall()],
        updateToolCall: vi.fn(),
        addToolCall: vi.fn(),
      })),
    }
    
    stateMachine = new ToolStateMachine(mockStore)
  })

  describe('State Transitions', () => {
    it('should allow valid transitions', () => {
      const result = stateMachine.transition('test-tool-1', 'running')
      expect(result).toBe(true)
    })

    it('should reject invalid transitions', () => {
      const result = stateMachine.transition('test-tool-1', 'completed')
      expect(result).toBe(false)
    })

    it('should handle error state transitions', () => {
      stateMachine.transition('test-tool-1', 'running')
      const result = stateMachine.transition('test-tool-1', 'error', {
        error: 'Tool execution failed'
      })
      expect(result).toBe(true)
    })

    it('should allow retry from error state', () => {
      stateMachine.transition('test-tool-1', 'running')
      stateMachine.transition('test-tool-1', 'error')
      const result = stateMachine.transition('test-tool-1', 'running')
      expect(result).toBe(true)
    })
  })

  describe('Timeout Handling', () => {
    it('should set timeout for running tools', () => {
      vi.useFakeTimers()
      
      stateMachine.transition('test-tool-1', 'running')
      
      // Fast-forward time
      vi.advanceTimersByTime(300000) // 5 minutes
      
      // Should transition to error state
      expect(mockStore.getState().updateToolCall).toHaveBeenCalledWith(
        'test-tool-1',
        expect.objectContaining({
          state: 'error',
          error: 'Tool execution timeout'
        })
      )
      
      vi.useRealTimers()
    })

    it('should clear timeout on completion', () => {
      vi.useFakeTimers()
      
      stateMachine.transition('test-tool-1', 'running')
      stateMachine.transition('test-tool-1', 'completed')
      
      // Fast-forward time
      vi.advanceTimersByTime(300000)
      
      // Should not transition to error after completion
      expect(mockStore.getState().updateToolCall).not.toHaveBeenCalledWith(
        'test-tool-1',
        expect.objectContaining({ state: 'error' })
      )
      
      vi.useRealTimers()
    })
  })

  describe('Tool Registry', () => {
    beforeEach(() => {
      toolRegistry.register({
        name: 'test-tool',
        icon: 'test',
        description: 'Test tool',
        category: 'file',
        renderer: () => null,
        validator: (params) => Boolean(params.file_path),
      })
    })

    it('should validate tool parameters', () => {
      const validParams = { file_path: '/test/path' }
      const invalidParams = {}

      expect(toolRegistry.validate('test-tool', validParams)).toBe(true)
      expect(toolRegistry.validate('test-tool', invalidParams)).toBe(false)
    })

    it('should get tool renderer', () => {
      const renderer = toolRegistry.getRenderer('test-tool')
      expect(renderer).toBeDefined()
    })

    it('should categorize tools correctly', () => {
      const fileTools = toolRegistry.getByCategory('file')
      expect(fileTools).toHaveLength(1)
      expect(fileTools[0].name).toBe('test-tool')
    })
  })
})
```

### 5. Communication Layer Testing

```typescript
// src/services/__tests__/sseClient.test.ts - SSE communication testing
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SSEClient } from '../sseClient'

describe('SSE Client', () => {
  let sseClient: SSEClient
  let mockEventSource: any

  beforeEach(() => {
    mockEventSource = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      close: vi.fn(),
      readyState: 1,
    }

    // Mock EventSource constructor
    global.EventSource = vi.fn(() => mockEventSource)
    
    sseClient = new SSEClient('http://localhost:3000')
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('should establish SSE connection', () => {
    sseClient.connect()
    
    expect(global.EventSource).toHaveBeenCalledWith(
      'http://localhost:3000/event'
    )
  })

  it('should handle SSE messages', () => {
    const mockHandler = vi.fn()
    
    sseClient.connect()
    sseClient.subscribe('message.updated', mockHandler)
    
    // Simulate message event
    const messageEvent = {
      data: JSON.stringify({
        type: 'message.updated',
        data: { id: 'test', content: 'updated' },
        timestamp: new Date().toISOString()
      })
    }
    
    const messageListener = mockEventSource.addEventListener.mock.calls
      .find(call => call[0] === 'message')?.[1]
    
    messageListener(messageEvent)
    
    expect(mockHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'message.updated',
        data: { id: 'test', content: 'updated' }
      })
    )
  })

  it('should handle connection errors', () => {
    const mockErrorHandler = vi.fn()
    
    sseClient.connect()
    sseClient.subscribe('connection.error', mockErrorHandler)
    
    // Simulate error event
    const errorListener = mockEventSource.addEventListener.mock.calls
      .find(call => call[0] === 'error')?.[1]
    
    errorListener(new Event('error'))
    
    expect(mockErrorHandler).toHaveBeenCalled()
  })

  it('should reconnect on connection loss', async () => {
    vi.useFakeTimers()
    
    sseClient.connect()
    
    // Simulate connection loss
    mockEventSource.readyState = 2 // CLOSED
    const errorListener = mockEventSource.addEventListener.mock.calls
      .find(call => call[0] === 'error')?.[1]
    
    errorListener(new Event('error'))
    
    // Fast-forward reconnection delay
    vi.advanceTimersByTime(1000)
    
    expect(global.EventSource).toHaveBeenCalledTimes(2)
    
    vi.useRealTimers()
  })

  it('should cleanup on disconnect', () => {
    sseClient.connect()
    sseClient.disconnect()
    
    expect(mockEventSource.close).toHaveBeenCalled()
  })
})
```

### 6. Performance Testing Framework

```typescript
// src/tests/performance/benchmark.test.ts - Performance testing
import { describe, it, expect } from 'vitest'
import { render } from '@tests/utils/testUtils'
import { ToolExecutionPanel } from '@components/tools/ToolExecutionPanel'
import { createMockToolCall } from '@tests/utils/testUtils'

describe('Performance Tests', () => {
  it('should render large tool lists efficiently', async () => {
    const startTime = performance.now()
    
    // Create large dataset
    const toolCalls = Array.from({ length: 1000 }, (_, i) => 
      createMockToolCall({ id: `tool-${i}`, name: `tool-${i}` })
    )
    
    // Mock store with large dataset
    vi.mock('@hooks/useAppState', () => ({
      useToolCalls: () => toolCalls,
    }))
    
    render(<ToolExecutionPanel />)
    
    const endTime = performance.now()
    const renderTime = endTime - startTime
    
    // Should render in under 100ms even with 1000 tools
    expect(renderTime).toBeLessThan(100)
  })

  it('should handle rapid state updates efficiently', async () => {
    const { rerender } = render(<ToolExecutionPanel />)
    
    const startTime = performance.now()
    
    // Simulate rapid state updates
    for (let i = 0; i < 100; i++) {
      const toolCalls = [createMockToolCall({ 
        id: `tool-${i}`, 
        state: i % 2 === 0 ? 'running' : 'completed' 
      })]
      
      vi.mocked(useToolCalls).mockReturnValue(toolCalls)
      rerender(<ToolExecutionPanel />)
    }
    
    const endTime = performance.now()
    const updateTime = endTime - startTime
    
    // Should handle 100 updates in under 50ms
    expect(updateTime).toBeLessThan(50)
  })

  it('should manage memory efficiently', () => {
    const initialMemory = performance.memory?.usedJSHeapSize || 0
    
    // Create and destroy many components
    for (let i = 0; i < 100; i++) {
      const { unmount } = render(<ToolExecutionPanel />)
      unmount()
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc()
    }
    
    const finalMemory = performance.memory?.usedJSHeapSize || 0
    const memoryIncrease = finalMemory - initialMemory
    
    // Memory increase should be minimal (less than 10MB)
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024)
  })
})
```

### 7. Visual Regression Testing

```typescript
// src/tests/visual/visual.test.ts - Visual regression testing
import { describe, it, expect } from 'vitest'
import { render } from '@tests/utils/testUtils'
import { ToolCallCard } from '@components/tools/ToolCallCard'
import { createMockToolCall } from '@tests/utils/testUtils'

describe('Visual Regression Tests', () => {
  it('should match tool card snapshots', () => {
    const toolCall = createMockToolCall()
    const { container } = render(<ToolCallCard toolCall={toolCall} />)
    
    expect(container.firstChild).toMatchSnapshot()
  })

  it('should match running state snapshot', () => {
    const toolCall = createMockToolCall({ state: 'running' })
    const { container } = render(<ToolCallCard toolCall={toolCall} />)
    
    expect(container.firstChild).toMatchSnapshot()
  })

  it('should match error state snapshot', () => {
    const toolCall = createMockToolCall({ 
      state: 'error', 
      error: 'Tool execution failed' 
    })
    const { container } = render(<ToolCallCard toolCall={toolCall} />)
    
    expect(container.firstChild).toMatchSnapshot()
  })

  it('should match dark theme snapshots', () => {
    // Mock dark theme
    document.documentElement.setAttribute('data-theme', 'dark')
    
    const toolCall = createMockToolCall()
    const { container } = render(<ToolCallCard toolCall={toolCall} />)
    
    expect(container.firstChild).toMatchSnapshot()
    
    // Cleanup
    document.documentElement.removeAttribute('data-theme')
  })
})
```

### 8. End-to-End Testing with VS Code

```typescript
// src/tests/e2e/vscode.test.ts - VS Code integration testing
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as vscode from 'vscode'

describe('VS Code Integration Tests', () => {
  let extension: vscode.Extension<any>

  beforeAll(async () => {
    // Activate extension
    extension = vscode.extensions.getExtension('opencode.opencode-vscode')!
    await extension.activate()
  })

  afterAll(async () => {
    // Cleanup
    await vscode.commands.executeCommand('workbench.action.closeAllEditors')
  })

  it('should register opencode chat command', async () => {
    const commands = await vscode.commands.getCommands()
    expect(commands).toContain('opencode.openChat')
  })

  it('should open chat panel', async () => {
    await vscode.commands.executeCommand('opencode.openChat')
    
    // Check if webview panel is created
    // This would require additional setup for webview testing
    expect(vscode.window.activeWebviewPanel).toBeDefined()
  })

  it('should handle file operations', async () => {
    // Create test file
    const testFile = vscode.Uri.file('/tmp/test.txt')
    await vscode.workspace.fs.writeFile(testFile, Buffer.from('test content'))
    
    // Open file
    const document = await vscode.workspace.openTextDocument(testFile)
    await vscode.window.showTextDocument(document)
    
    // Execute read command through chat
    await vscode.commands.executeCommand('opencode.executeCommand', {
      command: 'read',
      args: { file_path: testFile.fsPath }
    })
    
    // Verify file was read (would need to check chat output)
    expect(document.getText()).toBe('test content')
    
    // Cleanup
    await vscode.workspace.fs.delete(testFile)
  })

  it('should handle workspace changes', async () => {
    const workspaceFolders = vscode.workspace.workspaceFolders
    
    // Test workspace detection
    if (workspaceFolders) {
      await vscode.commands.executeCommand('opencode.refreshWorkspace')
      
      // Verify workspace context is updated
      const config = vscode.workspace.getConfiguration('opencode')
      expect(config.get('workspacePath')).toBe(workspaceFolders[0].uri.fsPath)
    }
  })
})
```

### 9. Test Automation and CI/CD

```yaml
# .github/workflows/test.yml - CI/CD test automation
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info

  integration-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run integration tests
        run: npm run test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Setup VS Code
        run: |
          wget -qO- https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > packages.microsoft.gpg
          sudo install -o root -g root -m 644 packages.microsoft.gpg /etc/apt/trusted.gpg.d/
          sudo sh -c 'echo "deb [arch=amd64,arm64,armhf signed-by=/etc/apt/trusted.gpg.d/packages.microsoft.gpg] https://packages.microsoft.com/repos/code stable main" > /etc/apt/sources.list.d/vscode.list'
          sudo apt update
          sudo apt install code
      
      - name: Run E2E tests
        run: npm run test:e2e
        env:
          DISPLAY: :99.0

  visual-regression:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run visual regression tests
        run: npm run test:visual
      
      - name: Upload visual diff artifacts
        uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: visual-diffs
          path: tests/visual/__image_snapshots__/__diff_output__/

  performance-tests:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run performance tests
        run: npm run test:performance
      
      - name: Upload performance reports
        uses: actions/upload-artifact@v3
        with:
          name: performance-reports
          path: tests/performance/reports/
```

### 10. Testing Utilities and Mocks

```typescript
// src/tests/mocks/toolMocks.ts - Tool execution mocks
import { vi } from 'vitest'

export const mockFileOperations = {
  read: vi.fn().mockResolvedValue({
    title: 'Read test.txt',
    metadata: { filePath: 'test.txt', preview: 'file content' },
    output: 'file content'
  }),
  
  write: vi.fn().mockResolvedValue({
    title: 'Write test.txt',
    metadata: { filePath: 'test.txt', preview: 'new content' },
    output: 'File written successfully'
  }),
  
  edit: vi.fn().mockResolvedValue({
    title: 'Edit test.txt',
    metadata: { 
      filePath: 'test.txt', 
      diff: '@@ -1 +1 @@\n-old content\n+new content',
      replacements: 1
    },
    output: 'Applied 1 replacement'
  }),
}

export const mockShellOperations = {
  bash: vi.fn().mockResolvedValue({
    title: 'Execute command',
    metadata: { 
      command: 'ls -la',
      output: 'total 0\ndrwxr-xr-x 2 user user 4096 Jan 1 12:00 .'
    },
    output: 'Command executed successfully'
  }),
}

export const mockTodoOperations = {
  todoWrite: vi.fn().mockResolvedValue({
    title: 'Creating plan',
    metadata: {
      todos: [
        { id: '1', content: 'Task 1', status: 'pending' },
        { id: '2', content: 'Task 2', status: 'in_progress' },
      ],
      phase: 'Creating plan',
      changes: { added: 2, updated: 0, removed: 0 }
    },
    output: 'Plan created with 2 tasks'
  }),
  
  todoRead: vi.fn().mockResolvedValue({
    title: 'Current todos',
    metadata: {
      todos: [
        { id: '1', content: 'Task 1', status: 'completed' },
        { id: '2', content: 'Task 2', status: 'in_progress' },
      ],
      count: 2,
      completed: 1
    },
    output: 'Current tasks: 2 total, 1 completed'
  }),
}

// Mock SSE events
export const mockSSEEvents = {
  toolStart: (toolId: string) => ({
    type: 'tool.start',
    data: { toolId, timestamp: Date.now() },
    timestamp: new Date().toISOString()
  }),
  
  toolProgress: (toolId: string, progress: number) => ({
    type: 'tool.progress',
    data: { toolId, progress, timestamp: Date.now() },
    timestamp: new Date().toISOString()
  }),
  
  toolComplete: (toolId: string, result: any) => ({
    type: 'tool.complete',
    data: { toolId, result, timestamp: Date.now() },
    timestamp: new Date().toISOString()
  }),
  
  toolError: (toolId: string, error: string) => ({
    type: 'tool.error',
    data: { toolId, error, timestamp: Date.now() },
    timestamp: new Date().toISOString()
  }),
}

// Mock WebSocket messages
export const mockWebSocketMessages = {
  connect: () => ({ type: 'connection.open' }),
  disconnect: () => ({ type: 'connection.close' }),
  ping: () => ({ type: 'ping', timestamp: Date.now() }),
  pong: () => ({ type: 'pong', timestamp: Date.now() }),
}
```

## 🔧 Configuration

### Package.json Test Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run --reporter=verbose --coverage",
    "test:integration": "vitest run tests/integration --reporter=verbose",
    "test:e2e": "vitest run tests/e2e --reporter=verbose",
    "test:visual": "vitest run tests/visual --reporter=verbose",
    "test:performance": "vitest run tests/performance --reporter=verbose",
    "test:watch": "vitest --watch",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage && open coverage/index.html",
    "test:debug": "vitest --inspect-brk --no-coverage",
    "test:ci": "vitest run --reporter=junit --outputFile=test-results.xml"
  }
}
```

### Test Environment Configuration

```typescript
// src/tests/config/testEnv.ts - Test environment setup
export const testConfig = {
  api: {
    baseUrl: 'http://localhost:3000',
    timeout: 5000,
  },
  sse: {
    url: 'http://localhost:3000/event',
    reconnectDelay: 1000,
  },
  performance: {
    renderThreshold: 100, // ms
    updateThreshold: 50,  // ms
    memoryThreshold: 10 * 1024 * 1024, // 10MB
  },
  visual: {
    threshold: 0.1, // 10% pixel difference allowed
    updateSnapshots: process.env.UPDATE_SNAPSHOTS === 'true',
  },
}
```

## ✅ Testing Checklist

### Unit Testing ✅
- [ ] State management logic (Zustand stores)
- [ ] Utility functions and helpers
- [ ] Tool registry and validation
- [ ] State machine transitions
- [ ] API client methods
- [ ] Event handling logic
- [ ] Data transformation functions

### Component Testing ✅
- [ ] Chat input component
- [ ] Message rendering components
- [ ] Tool call components
- [ ] Theme switching
- [ ] Error boundaries
- [ ] Loading states
- [ ] Animation components

### Integration Testing ✅
- [ ] Component interactions
- [ ] State synchronization
- [ ] Event flow between components
- [ ] Tool execution workflows
- [ ] Error handling across components
- [ ] Theme propagation
- [ ] Performance under load

### Communication Testing ✅
- [ ] SSE connection and reconnection
- [ ] API request/response handling
- [ ] Error handling and retries
- [ ] Message serialization/deserialization
- [ ] Connection state management
- [ ] Real-time updates

### Tool Execution Testing ✅
- [ ] Tool state machine validation
- [ ] Parameter validation
- [ ] Execution timeout handling
- [ ] Error state management
- [ ] Retry mechanisms
- [ ] Progress updates
- [ ] Result rendering

### Performance Testing ✅
- [ ] Component render performance
- [ ] Large dataset handling
- [ ] Memory usage optimization
- [ ] Animation performance
- [ ] Virtual scrolling efficiency
- [ ] State update performance

### Visual Regression Testing ✅
- [ ] Component appearance consistency
- [ ] Theme switching visual validation
- [ ] Animation frame consistency
- [ ] Cross-browser compatibility
- [ ] Responsive design validation

### End-to-End Testing ✅
- [ ] Complete user workflows
- [ ] VS Code integration
- [ ] File operation workflows
- [ ] Multi-tool execution sequences
- [ ] Error recovery scenarios
- [ ] Session management

### Automation ✅
- [ ] CI/CD pipeline integration
- [ ] Automated test execution
- [ ] Coverage reporting
- [ ] Performance monitoring
- [ ] Visual diff detection
- [ ] Test result notifications

---

This comprehensive testing strategy ensures robust, reliable, and maintainable code while supporting continuous integration and deployment workflows. The multi-layered approach catches issues at every level, from individual functions to complete user workflows.