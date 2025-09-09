# 04-Tool-Execution-System.md

**Tool Calls, State Machines, Animations, and Execution Framework**

---

## 🎯 Overview

This document covers the implementation of the tool execution system - the core framework that handles tool calls, manages execution states, provides real-time animations, and renders tool results. This system is central to OpenCode's functionality, managing everything from file operations to shell commands.

## 🏗️ Architecture

### Tool Execution Pipeline
```
Tool Call Request → State Machine → Animation System → Result Rendering
       ↓                 ↓              ↓               ↓
   SSE Event →     pending/running →  Shimmer →    Component
                      /completed       Effects       Rendering
                       /error
```

### State Machine Flow
```
pending → running → completed
   ↓         ↓         ↑
   ↓         ↓      success
   ↓         ↓         ↓
   ↓       error ←──────┘
   ↓         ↓
   └─────→ timeout
```

## 💻 Implementation

### 1. Tool Registry and Definitions

```typescript
// src/services/toolRegistry.ts - Tool registry and definitions
export interface ToolDefinition {
  name: string
  icon: string
  description: string
  category: 'file' | 'shell' | 'web' | 'task' | 'ui'
  renderer: React.ComponentType<ToolRendererProps>
  validator?: (params: any) => boolean
  estimatedDuration?: number // milliseconds
}

export interface ToolRendererProps {
  toolCall: ToolCall
  onExpand?: (id: string) => void
  onCollapse?: (id: string) => void
  onRetry?: (id: string) => void
}

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>()

  register(tool: ToolDefinition) {
    this.tools.set(tool.name, tool)
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values())
  }

  getByCategory(category: ToolDefinition['category']): ToolDefinition[] {
    return this.getAll().filter(tool => tool.category === category)
  }

  getRenderer(name: string): React.ComponentType<ToolRendererProps> | null {
    return this.tools.get(name)?.renderer || null
  }

  getIcon(name: string): string {
    return this.tools.get(name)?.icon || 'tool'
  }

  validate(name: string, params: any): boolean {
    const tool = this.tools.get(name)
    return tool?.validator ? tool.validator(params) : true
  }
}

// Singleton registry instance
export const toolRegistry = new ToolRegistry()
```

### 2. Tool State Machine

```typescript
// src/services/toolStateMachine.ts - Tool execution state management
export type ToolCallState = 'pending' | 'running' | 'completed' | 'error' | 'cancelled'

export interface ToolStateTransition {
  from: ToolCallState
  to: ToolCallState
  trigger: string
  timestamp: number
}

export class ToolStateMachine {
  private transitions: Map<string, ToolStateTransition[]> = new Map()
  private timeouts: Map<string, NodeJS.Timeout> = new Map()

  constructor(private store = useOpenCodeStore) {}

  transition(toolCallId: string, newState: ToolCallState, data?: any) {
    const toolCall = this.store.getState().toolCalls.find(tc => tc.id === toolCallId)
    if (!toolCall) {
      console.warn(`Tool call ${toolCallId} not found`)
      return false
    }

    const oldState = toolCall.state
    
    // Validate transition
    if (!this.isValidTransition(oldState, newState)) {
      console.warn(`Invalid transition from ${oldState} to ${newState}`)
      return false
    }

    // Record transition
    this.recordTransition(toolCallId, oldState, newState)

    // Update store
    this.store.getState().updateToolCall(toolCallId, {
      state: newState,
      ...data
    })

    // Handle side effects
    this.handleStateEffects(toolCallId, newState, oldState)

    return true
  }

  private isValidTransition(from: ToolCallState, to: ToolCallState): boolean {
    const validTransitions: Record<ToolCallState, ToolCallState[]> = {
      pending: ['running', 'cancelled', 'error'],
      running: ['completed', 'error', 'cancelled'],
      completed: [], // Terminal state
      error: ['running'], // Can retry
      cancelled: ['running'] // Can restart
    }

    return validTransitions[from]?.includes(to) ?? false
  }

  private recordTransition(toolCallId: string, from: ToolCallState, to: ToolCallState) {
    const transitions = this.transitions.get(toolCallId) || []
    transitions.push({
      from,
      to,
      trigger: 'manual', // Could be enhanced to track triggers
      timestamp: Date.now()
    })
    this.transitions.set(toolCallId, transitions)
  }

  private handleStateEffects(toolCallId: string, newState: ToolCallState, oldState: ToolCallState) {
    // Clear any existing timeout
    const existingTimeout = this.timeouts.get(toolCallId)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
      this.timeouts.delete(toolCallId)
    }

    // Set timeout for running state
    if (newState === 'running') {
      const timeout = setTimeout(() => {
        this.transition(toolCallId, 'error', {
          error: 'Tool execution timeout'
        })
      }, 300000) // 5 minutes timeout

      this.timeouts.set(toolCallId, timeout)
    }

    // Trigger animations
    if (newState === 'running' && oldState === 'pending') {
      this.triggerStartAnimation(toolCallId)
    }

    if (newState === 'completed' && oldState === 'running') {
      this.triggerCompletionAnimation(toolCallId)
    }

    if (newState === 'error') {
      this.triggerErrorAnimation(toolCallId)
    }
  }

  private triggerStartAnimation(toolCallId: string) {
    // Trigger shimmer animation
    document.getElementById(`tool-${toolCallId}`)?.classList.add('tool-starting')
  }

  private triggerCompletionAnimation(toolCallId: string) {
    // Trigger completion animation
    const element = document.getElementById(`tool-${toolCallId}`)
    element?.classList.add('tool-completed')
    element?.classList.remove('tool-starting')
    
    // Remove class after animation
    setTimeout(() => {
      element?.classList.remove('tool-completed')
    }, 1000)
  }

  private triggerErrorAnimation(toolCallId: string) {
    // Trigger error animation
    const element = document.getElementById(`tool-${toolCallId}`)
    element?.classList.add('tool-error')
    element?.classList.remove('tool-starting')
  }

  getTransitionHistory(toolCallId: string): ToolStateTransition[] {
    return this.transitions.get(toolCallId) || []
  }

  cleanup(toolCallId: string) {
    const timeout = this.timeouts.get(toolCallId)
    if (timeout) {
      clearTimeout(timeout)
      this.timeouts.delete(toolCallId)
    }
    this.transitions.delete(toolCallId)
  }
}

// Singleton state machine
export const toolStateMachine = new ToolStateMachine()
```

### 3. Tool Call Component Framework

```typescript
// src/components/tools/ToolCallCard.tsx - Base tool call component
import React from 'react'
import { ToolCall } from '@types/index'
import { toolRegistry } from '@services/toolRegistry'
import { ToolIcon } from './ToolIcon'
import { ToolStateIndicator } from './ToolStateIndicator'
import { ToolActions } from './ToolActions'
import { ShimmerAnimation } from '@components/ui/ShimmerAnimation'

interface ToolCallCardProps {
  toolCall: ToolCall
  className?: string
}

export function ToolCallCard({ toolCall, className = '' }: ToolCallCardProps) {
  const ToolRenderer = toolRegistry.getRenderer(toolCall.name)
  const toolIcon = toolRegistry.getIcon(toolCall.name)

  return (
    <div 
      id={`tool-${toolCall.id}`}
      className={`tool-call tool-call--${toolCall.state} ${className}`}
      data-tool-name={toolCall.name}
    >
      <div className="tool-call__header">
        <div className="tool-call__info">
          <ToolIcon name={toolIcon} />
          <span className="tool-call__name">{toolCall.name}</span>
          <ToolStateIndicator state={toolCall.state} />
        </div>
        
        <ToolActions 
          toolCall={toolCall}
          onExpand={() => toolCall.expanded ? undefined : toggleExpanded(toolCall.id)}
          onCollapse={() => toolCall.expanded ? toggleExpanded(toolCall.id) : undefined}
          onRetry={() => retryToolCall(toolCall.id)}
        />
      </div>

      {toolCall.state === 'running' && (
        <div className="tool-call__progress">
          <ShimmerAnimation variant="tool" />
        </div>
      )}

      <div className="tool-call__content">
        {ToolRenderer && (
          <ToolRenderer 
            toolCall={toolCall}
            onExpand={() => toggleExpanded(toolCall.id)}
            onRetry={() => retryToolCall(toolCall.id)}
          />
        )}
      </div>

      {toolCall.error && (
        <div className="tool-call__error">
          <span className="tool-call__error-message">{toolCall.error}</span>
        </div>
      )}

      {toolCall.state === 'completed' && toolCall.end_time && toolCall.start_time && (
        <div className="tool-call__footer">
          <span className="tool-call__duration">
            {toolCall.end_time - toolCall.start_time}ms
          </span>
        </div>
      )}
    </div>
  )
}

function toggleExpanded(toolCallId: string) {
  useOpenCodeStore.getState().toggleToolCallExpanded(toolCallId)
}

function retryToolCall(toolCallId: string) {
  // Implementation depends on how retries are handled
  console.log('Retry tool call:', toolCallId)
}
```

### 4. Animation System

```typescript
// src/components/ui/ShimmerAnimation.tsx - Loading animations
import React from 'react'

interface ShimmerAnimationProps {
  variant?: 'default' | 'tool' | 'text' | 'code'
  width?: string
  height?: string
  className?: string
}

export function ShimmerAnimation({ 
  variant = 'default',
  width,
  height,
  className = ''
}: ShimmerAnimationProps) {
  const shimmerClasses = {
    default: 'shimmer',
    tool: 'shimmer shimmer--tool',
    text: 'shimmer shimmer--text',
    code: 'shimmer shimmer--code',
  }

  return (
    <div 
      className={`${shimmerClasses[variant]} ${className}`}
      style={{ width, height }}
    >
      <div className="shimmer__content" />
    </div>
  )
}

// Skeleton components for specific use cases
export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton-text">
      {Array.from({ length: lines }, (_, i) => (
        <ShimmerAnimation 
          key={i}
          variant="text"
          height="1rem"
          width={i === lines - 1 ? '60%' : '100%'}
        />
      ))}
    </div>
  )
}

export function SkeletonCodeBlock({ lines = 8 }: { lines?: number }) {
  return (
    <div className="skeleton-code">
      {Array.from({ length: lines }, (_, i) => (
        <ShimmerAnimation 
          key={i}
          variant="code"
          height="1.2rem"
          width={`${Math.random() * 40 + 40}%`}
        />
      ))}
    </div>
  )
}
```

### 5. Tool State Indicator Component

```typescript
// src/components/tools/ToolStateIndicator.tsx - Visual state indicators
import React from 'react'
import { ToolCallState } from '@types/index'

interface ToolStateIndicatorProps {
  state: ToolCallState
  showText?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function ToolStateIndicator({ 
  state, 
  showText = false, 
  size = 'md' 
}: ToolStateIndicatorProps) {
  const indicators = {
    pending: {
      icon: '⏳',
      text: 'Pending',
      className: 'tool-indicator--pending'
    },
    running: {
      icon: '🔄',
      text: 'Running',
      className: 'tool-indicator--running'
    },
    completed: {
      icon: '✅',
      text: 'Completed',
      className: 'tool-indicator--completed'
    },
    error: {
      icon: '❌',
      text: 'Error',
      className: 'tool-indicator--error'
    },
    cancelled: {
      icon: '🚫',
      text: 'Cancelled',
      className: 'tool-indicator--cancelled'
    }
  }

  const indicator = indicators[state]

  return (
    <div className={`tool-indicator tool-indicator--${size} ${indicator.className}`}>
      <span className="tool-indicator__icon">{indicator.icon}</span>
      {showText && (
        <span className="tool-indicator__text">{indicator.text}</span>
      )}
    </div>
  )
}

// Animated spinner for running state
export function SpinnerIcon({ size = 16 }: { size?: number }) {
  return (
    <div 
      className="spinner"
      style={{ width: size, height: size }}
    >
      <div className="spinner__circle" />
    </div>
  )
}
```

### 6. Tool Actions Component

```typescript
// src/components/tools/ToolActions.tsx - Tool action buttons
import React from 'react'
import { ToolCall } from '@types/index'

interface ToolActionsProps {
  toolCall: ToolCall
  onExpand?: () => void
  onCollapse?: () => void
  onRetry?: () => void
  onCancel?: () => void
}

export function ToolActions({ 
  toolCall, 
  onExpand, 
  onCollapse, 
  onRetry,
  onCancel 
}: ToolActionsProps) {
  return (
    <div className="tool-actions">
      {/* Expand/Collapse */}
      {!toolCall.expanded && onExpand && (
        <button 
          className="tool-action tool-action--expand"
          onClick={onExpand}
          title="Expand details"
        >
          ⬇️
        </button>
      )}
      
      {toolCall.expanded && onCollapse && (
        <button 
          className="tool-action tool-action--collapse"
          onClick={onCollapse}
          title="Collapse details"
        >
          ⬆️
        </button>
      )}

      {/* Retry */}
      {(toolCall.state === 'error' || toolCall.state === 'cancelled') && onRetry && (
        <button 
          className="tool-action tool-action--retry"
          onClick={onRetry}
          title="Retry execution"
        >
          🔄
        </button>
      )}

      {/* Cancel */}
      {toolCall.state === 'running' && onCancel && (
        <button 
          className="tool-action tool-action--cancel"
          onClick={onCancel}
          title="Cancel execution"
        >
          ⏹️
        </button>
      )}

      {/* Copy result */}
      {toolCall.state === 'completed' && toolCall.result && (
        <button 
          className="tool-action tool-action--copy"
          onClick={() => copyToClipboard(JSON.stringify(toolCall.result, null, 2))}
          title="Copy result"
        >
          📋
        </button>
      )}
    </div>
  )
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    // Could show toast notification here
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
  }
}
```

### 7. Tool Execution Panel

```typescript
// src/components/tools/ToolExecutionPanel.tsx - Main tool execution display
import React from 'react'
import { useToolCalls } from '@hooks/useAppState'
import { ToolCallCard } from './ToolCallCard'
import { VirtualList } from '@components/ui/VirtualList'

export function ToolExecutionPanel() {
  const toolCalls = useToolCalls()

  if (toolCalls.length === 0) {
    return (
      <div className="tool-execution-panel tool-execution-panel--empty">
        <div className="tool-execution-panel__placeholder">
          <span className="tool-execution-panel__icon">🛠️</span>
          <p>No tool executions yet</p>
          <p className="tool-execution-panel__hint">
            Tool calls will appear here as they are executed
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="tool-execution-panel">
      <div className="tool-execution-panel__header">
        <h3>Tool Executions</h3>
        <span className="tool-execution-panel__count">
          {toolCalls.length} tool{toolCalls.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="tool-execution-panel__content">
        <VirtualList
          items={toolCalls}
          itemHeight={120} // Estimated height
          containerHeight={600}
          renderItem={(toolCall) => (
            <ToolCallCard key={toolCall.id} toolCall={toolCall} />
          )}
        />
      </div>
    </div>
  )
}
```

### 8. Tool Execution Hook

```typescript
// src/hooks/useToolExecution.ts - Tool execution management hook
import { useCallback } from 'react'
import { useOpenCodeStore } from '@stores/openCodeStore'
import { toolStateMachine } from '@services/toolStateMachine'
import { toolRegistry } from '@services/toolRegistry'

export function useToolExecution() {
  const { addToolCall, updateToolCall } = useOpenCodeStore()

  const executeToolCall = useCallback(async (
    name: string, 
    parameters: Record<string, any>
  ) => {
    // Validate tool and parameters
    if (!toolRegistry.get(name)) {
      throw new Error(`Unknown tool: ${name}`)
    }

    if (!toolRegistry.validate(name, parameters)) {
      throw new Error(`Invalid parameters for tool: ${name}`)
    }

    // Create tool call
    const toolCallId = generateId()
    const toolCall: ToolCall = {
      id: toolCallId,
      name,
      parameters,
      state: 'pending',
      start_time: Date.now(),
      expanded: false,
      show_details: false,
    }

    // Add to store
    addToolCall(toolCall)

    // Start execution (this would be handled by SSE in real implementation)
    toolStateMachine.transition(toolCallId, 'running')

    return toolCallId
  }, [addToolCall])

  const retryToolCall = useCallback((toolCallId: string) => {
    toolStateMachine.transition(toolCallId, 'running', {
      error: null,
      result: null,
      start_time: Date.now(),
      end_time: undefined,
    })
  }, [])

  const cancelToolCall = useCallback((toolCallId: string) => {
    toolStateMachine.transition(toolCallId, 'cancelled')
  }, [])

  const getToolCallHistory = useCallback((toolCallId: string) => {
    return toolStateMachine.getTransitionHistory(toolCallId)
  }, [])

  return {
    executeToolCall,
    retryToolCall,
    cancelToolCall,
    getToolCallHistory,
  }
}

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}
```

## 🔧 Configuration

### Tool System CSS

```css
/* src/styles/tools.css - Tool execution styling */

/* Tool Call Card Styles */
.tool-call {
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  margin-bottom: var(--space-md);
  background: var(--bg-primary);
  transition: all var(--transition-normal);
}

.tool-call--pending {
  border-left: 4px solid var(--tool-pending);
}

.tool-call--running {
  border-left: 4px solid var(--tool-running);
  box-shadow: var(--shadow-md);
}

.tool-call--completed {
  border-left: 4px solid var(--tool-completed);
}

.tool-call--error {
  border-left: 4px solid var(--tool-error);
  background: rgba(var(--tool-error-rgb), 0.05);
}

/* Tool Call Header */
.tool-call__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md);
  border-bottom: 1px solid var(--border-secondary);
}

.tool-call__info {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.tool-call__name {
  font-family: monospace;
  font-weight: 500;
  color: var(--text-primary);
}

/* Progress Animation */
.tool-call__progress {
  padding: 0 var(--space-md);
  height: 4px;
  overflow: hidden;
}

/* Shimmer Animation */
.shimmer {
  position: relative;
  overflow: hidden;
  background: var(--bg-secondary);
  border-radius: 4px;
}

.shimmer::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.2),
    transparent
  );
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% { left: -100%; }
  100% { left: 100%; }
}

.shimmer--tool {
  height: 4px;
  background: var(--tool-running);
}

.shimmer--text {
  height: 1rem;
  margin-bottom: var(--space-xs);
}

.shimmer--code {
  height: 1.2rem;
  margin-bottom: 2px;
  background: var(--bg-tertiary);
}

/* Tool State Indicators */
.tool-indicator {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--font-sm);
}

.tool-indicator--sm {
  font-size: var(--font-xs);
}

.tool-indicator--lg {
  font-size: var(--font-md);
}

.tool-indicator--running .tool-indicator__icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Tool Actions */
.tool-actions {
  display: flex;
  gap: var(--space-xs);
}

.tool-action {
  background: none;
  border: 1px solid var(--border-secondary);
  border-radius: 4px;
  padding: var(--space-xs);
  cursor: pointer;
  font-size: var(--font-sm);
  transition: all var(--transition-fast);
}

.tool-action:hover {
  background: var(--bg-secondary);
  border-color: var(--border-focus);
}

.tool-action:active {
  transform: scale(0.95);
}

/* Tool Execution Panel */
.tool-execution-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.tool-execution-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md);
  border-bottom: 1px solid var(--border-primary);
}

.tool-execution-panel__count {
  font-size: var(--font-sm);
  color: var(--text-secondary);
}

.tool-execution-panel__content {
  flex: 1;
  overflow: hidden;
}

.tool-execution-panel--empty {
  justify-content: center;
  align-items: center;
}

.tool-execution-panel__placeholder {
  text-align: center;
  color: var(--text-muted);
}

.tool-execution-panel__icon {
  font-size: 3rem;
  display: block;
  margin-bottom: var(--space-md);
}

.tool-execution-panel__hint {
  font-size: var(--font-sm);
  margin-top: var(--space-xs);
}

/* Animations */
.tool-starting {
  animation: toolStart 0.5s ease-out;
}

.tool-completed {
  animation: toolComplete 1s ease-out;
}

.tool-error {
  animation: toolError 0.5s ease-out;
}

@keyframes toolStart {
  from { 
    transform: scale(0.98);
    opacity: 0.8;
  }
  to { 
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes toolComplete {
  0% { transform: scale(1); }
  50% { transform: scale(1.02); }
  100% { transform: scale(1); }
}

@keyframes toolError {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-2px); }
  75% { transform: translateX(2px); }
}

/* Spinner */
.spinner {
  display: inline-block;
  position: relative;
}

.spinner__circle {
  width: 100%;
  height: 100%;
  border: 2px solid var(--border-secondary);
  border-top: 2px solid var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
```

## ✅ Testing

### Tool State Machine Tests

```typescript
// src/services/__tests__/toolStateMachine.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { ToolStateMachine } from '../toolStateMachine'
import { useOpenCodeStore } from '@stores/openCodeStore'

describe('ToolStateMachine', () => {
  let stateMachine: ToolStateMachine
  
  beforeEach(() => {
    // Reset store
    useOpenCodeStore.setState({
      toolCalls: [{
        id: 'test-tool',
        name: 'read',
        parameters: {},
        state: 'pending',
        expanded: false,
        show_details: false,
      }]
    })
    
    stateMachine = new ToolStateMachine()
  })

  it('should allow valid state transitions', () => {
    const result = stateMachine.transition('test-tool', 'running')
    expect(result).toBe(true)
    
    const toolCall = useOpenCodeStore.getState().toolCalls[0]
    expect(toolCall.state).toBe('running')
  })

  it('should reject invalid state transitions', () => {
    const result = stateMachine.transition('test-tool', 'completed')
    expect(result).toBe(false)
    
    const toolCall = useOpenCodeStore.getState().toolCalls[0]
    expect(toolCall.state).toBe('pending') // Unchanged
  })

  it('should record transition history', () => {
    stateMachine.transition('test-tool', 'running')
    stateMachine.transition('test-tool', 'completed')
    
    const history = stateMachine.getTransitionHistory('test-tool')
    expect(history).toHaveLength(2)
    expect(history[0]).toMatchObject({
      from: 'pending',
      to: 'running'
    })
    expect(history[1]).toMatchObject({
      from: 'running',
      to: 'completed'
    })
  })

  it('should handle timeout for running state', async () => {
    // Mock shorter timeout for testing
    const quickStateMachine = new ToolStateMachine()
    
    // Start tool
    quickStateMachine.transition('test-tool', 'running')
    
    // Wait for timeout (would need to mock setTimeout in real test)
    // This is a conceptual test - actual implementation would mock timers
  })
})
```

### Tool Component Tests

```typescript
// src/components/tools/__tests__/ToolCallCard.test.tsx
import { render, screen } from '@testing-library/react'
import { ToolCallCard } from '../ToolCallCard'
import { toolRegistry } from '@services/toolRegistry'
import { ToolCall } from '@types/index'

// Mock tool renderer
const MockToolRenderer = ({ toolCall }: { toolCall: ToolCall }) => (
  <div data-testid="mock-renderer">{toolCall.name} content</div>
)

beforeEach(() => {
  toolRegistry.register({
    name: 'read',
    icon: 'file',
    description: 'Read file',
    category: 'file',
    renderer: MockToolRenderer,
  })
})

describe('ToolCallCard', () => {
  const mockToolCall: ToolCall = {
    id: 'test-1',
    name: 'read',
    parameters: { file_path: 'test.txt' },
    state: 'running',
    expanded: false,
    show_details: false,
  }

  it('should render tool call information', () => {
    render(<ToolCallCard toolCall={mockToolCall} />)
    
    expect(screen.getByText('read')).toBeInTheDocument()
    expect(screen.getByTestId('mock-renderer')).toBeInTheDocument()
  })

  it('should show shimmer animation for running state', () => {
    render(<ToolCallCard toolCall={mockToolCall} />)
    
    expect(document.querySelector('.tool-call__progress')).toBeInTheDocument()
  })

  it('should show error message for error state', () => {
    const errorToolCall = {
      ...mockToolCall,
      state: 'error' as const,
      error: 'File not found'
    }
    
    render(<ToolCallCard toolCall={errorToolCall} />)
    
    expect(screen.getByText('File not found')).toBeInTheDocument()
  })

  it('should show duration for completed state', () => {
    const completedToolCall = {
      ...mockToolCall,
      state: 'completed' as const,
      start_time: 1000,
      end_time: 2500
    }
    
    render(<ToolCallCard toolCall={completedToolCall} />)
    
    expect(screen.getByText('1500ms')).toBeInTheDocument()
  })
})
```

## 📝 Implementation Checklist

### Core Framework ✅
- [ ] Tool registry with definitions and validation
- [ ] State machine with transition validation
- [ ] Tool call component architecture
- [ ] Animation system with shimmer effects
- [ ] State indicators and visual feedback

### State Management ✅
- [ ] Tool execution state machine
- [ ] Transition history tracking
- [ ] Timeout handling for long-running tools
- [ ] Error state management
- [ ] Retry and cancellation support

### UI Components ✅
- [ ] ToolCallCard base component
- [ ] Tool state indicators with animations
- [ ] Tool action buttons (expand, retry, cancel)
- [ ] Tool execution panel with virtual scrolling
- [ ] Shimmer animations and loading states

### Animation System ✅
- [ ] Shimmer effects for loading states
- [ ] State transition animations
- [ ] Skeleton components for placeholders
- [ ] Completion and error animations
- [ ] Smooth state transitions

### Performance ✅
- [ ] Virtual scrolling for large tool lists
- [ ] Component memoization for tool renderers
- [ ] Efficient state updates and selectors
- [ ] Animation performance optimization
- [ ] Memory cleanup for completed tools

### Testing ✅
- [ ] State machine unit tests
- [ ] Component rendering tests
- [ ] Animation behavior tests
- [ ] Error handling tests
- [ ] Performance tests

### Next Steps
After implementing the tool execution system:
1. **[05-File-Operations.md](./05-File-Operations.md)** - Implement specific file tool renderers
2. **[06-Shell-Commands.md](./06-Shell-Commands.md)** - Implement shell command tool renderers
3. **[07-Todo-Management.md](./07-Todo-Management.md)** - Implement todo tool renderers

---

This tool execution system provides the foundation for all tool interactions in OpenCode, with robust state management, smooth animations, and extensible architecture for adding new tool types.