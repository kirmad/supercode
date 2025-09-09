# 07-Todo-Management.md

**Interactive Todo Lists with Real-time Updates and State Management**

---

## 🎯 Overview

This document covers the implementation of the todo management system in the VS Code extension, including data structures, real-time synchronization, UI components, and integration with the broader tool execution system. The todo system provides session-scoped task tracking with interactive updates and visual feedback.

## 🏗️ Architecture

### System Components
```
Todo Management System
├── Data Layer (Session-scoped storage, state management)
├── Communication Layer (SSE streaming, API integration)
├── UI Components (Todo lists, items, interaction handlers)
├── State Management (Zustand store, persistence)
├── Tool Integration (TodoWrite/TodoRead tool handlers)
└── Performance Layer (Caching, optimizations)
```

### Data Flow
```
Tool Execution → Todo State Updates → UI Re-render → User Interaction
     ↓                    ↑                ↓              ↓
SSE Events → Store Updates → Component Updates → Actions → API Calls
```

## 💻 Implementation

### 1. Todo Data Structures

```typescript
// src/types/todo.ts - Core todo type definitions
export interface TodoItem {
  id: string
  content: string
  status: TodoStatus
  priority?: TodoPriority
  activeForm?: string    // Text shown during in_progress state
  metadata?: TodoMetadata
  created: number
  updated: number
}

export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'
export type TodoPriority = 'high' | 'medium' | 'low'

export interface TodoMetadata {
  estimatedDuration?: number
  tags?: string[]
  assignee?: string
  dependencies?: string[]  // IDs of dependent todos
}

export interface TodoList {
  sessionId: string
  todos: TodoItem[]
  phase: TodoPhase
  lastUpdated: number
  version: number  // For conflict resolution
}

export type TodoPhase = 
  | 'creating_plan' 
  | 'updating_plan' 
  | 'executing_tasks' 
  | 'reviewing_progress'
  | 'completed'

// Tool call metadata for todo operations
export interface TodoToolCallMetadata {
  todos: TodoItem[]
  phase: TodoPhase
  changes: TodoChange[]
  operation: 'create' | 'update' | 'delete' | 'reorder'
}

export interface TodoChange {
  type: 'added' | 'updated' | 'removed' | 'status_changed'
  todoId: string
  before?: Partial<TodoItem>
  after?: Partial<TodoItem>
}
```

### 2. Todo Store Management

```typescript
// src/stores/todoStore.ts - Dedicated todo state management
import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { TodoItem, TodoList, TodoPhase, TodoChange } from '@types/todo'

interface TodoState {
  // Session-scoped todo lists
  todoLists: Record<string, TodoList>  // sessionId -> TodoList
  
  // UI State
  expandedLists: Set<string>           // sessionIds with expanded lists
  selectedTodos: Set<string>           // todoIds currently selected
  showCompleted: boolean               // Toggle for completed items
  sortBy: 'created' | 'priority' | 'status' | 'updated'
  
  // Interaction State
  editingTodo: string | null           // todoId being edited
  draggedTodo: string | null           // todoId being dragged
  dragOverTodo: string | null          // todoId being dragged over
  
  // Actions - Todo List Management
  setTodoList: (sessionId: string, todoList: TodoList) => void
  updateTodoList: (sessionId: string, updates: Partial<TodoList>) => void
  getTodoList: (sessionId: string) => TodoList | null
  
  // Actions - Todo Item Management
  addTodo: (sessionId: string, todo: TodoItem) => void
  updateTodo: (sessionId: string, todoId: string, updates: Partial<TodoItem>) => void
  removeTodo: (sessionId: string, todoId: string) => void
  reorderTodos: (sessionId: string, fromIndex: number, toIndex: number) => void
  
  // Actions - Bulk Operations
  bulkUpdateTodos: (sessionId: string, todos: TodoItem[]) => void
  markAllCompleted: (sessionId: string) => void
  clearCompleted: (sessionId: string) => void
  
  // Actions - UI State
  toggleListExpanded: (sessionId: string) => void
  setSelectedTodos: (todoIds: string[]) => void
  toggleTodoSelection: (todoId: string) => void
  setEditingTodo: (todoId: string | null) => void
  
  // Actions - Drag and Drop
  setDraggedTodo: (todoId: string | null) => void
  setDragOverTodo: (todoId: string | null) => void
  
  // Computed Getters
  getTodosByStatus: (sessionId: string, status: TodoStatus) => TodoItem[]
  getTodosCount: (sessionId: string) => { total: number; completed: number; pending: number }
  getPhaseProgress: (sessionId: string) => number  // 0-1 completion percentage
}

export const useTodoStore = create<TodoState>()(
  subscribeWithSelector((set, get) => ({
    // Initial State
    todoLists: {},
    expandedLists: new Set(),
    selectedTodos: new Set(),
    showCompleted: true,
    sortBy: 'created',
    editingTodo: null,
    draggedTodo: null,
    dragOverTodo: null,
    
    // Todo List Management
    setTodoList: (sessionId, todoList) => {
      set((state) => ({
        todoLists: {
          ...state.todoLists,
          [sessionId]: {
            ...todoList,
            lastUpdated: Date.now()
          }
        }
      }))
    },
    
    updateTodoList: (sessionId, updates) => {
      set((state) => {
        const existingList = state.todoLists[sessionId]
        if (!existingList) return state
        
        return {
          todoLists: {
            ...state.todoLists,
            [sessionId]: {
              ...existingList,
              ...updates,
              lastUpdated: Date.now(),
              version: existingList.version + 1
            }
          }
        }
      })
    },
    
    getTodoList: (sessionId) => {
      return get().todoLists[sessionId] || null
    },
    
    // Todo Item Management
    addTodo: (sessionId, todo) => {
      set((state) => {
        const existingList = state.todoLists[sessionId]
        const todos = existingList?.todos || []
        
        return {
          todoLists: {
            ...state.todoLists,
            [sessionId]: {
              sessionId,
              todos: [...todos, todo],
              phase: existingList?.phase || 'creating_plan',
              lastUpdated: Date.now(),
              version: (existingList?.version || 0) + 1
            }
          }
        }
      })
    },
    
    updateTodo: (sessionId, todoId, updates) => {
      set((state) => {
        const existingList = state.todoLists[sessionId]
        if (!existingList) return state
        
        const updatedTodos = existingList.todos.map(todo =>
          todo.id === todoId 
            ? { ...todo, ...updates, updated: Date.now() }
            : todo
        )
        
        return {
          todoLists: {
            ...state.todoLists,
            [sessionId]: {
              ...existingList,
              todos: updatedTodos,
              lastUpdated: Date.now(),
              version: existingList.version + 1
            }
          }
        }
      })
    },
    
    removeTodo: (sessionId, todoId) => {
      set((state) => {
        const existingList = state.todoLists[sessionId]
        if (!existingList) return state
        
        const filteredTodos = existingList.todos.filter(todo => todo.id !== todoId)
        
        return {
          todoLists: {
            ...state.todoLists,
            [sessionId]: {
              ...existingList,
              todos: filteredTodos,
              lastUpdated: Date.now(),
              version: existingList.version + 1
            }
          }
        }
      })
    },
    
    // Bulk Operations
    bulkUpdateTodos: (sessionId, todos) => {
      set((state) => ({
        todoLists: {
          ...state.todoLists,
          [sessionId]: {
            sessionId,
            todos: todos.map(todo => ({ ...todo, updated: Date.now() })),
            phase: state.todoLists[sessionId]?.phase || 'creating_plan',
            lastUpdated: Date.now(),
            version: (state.todoLists[sessionId]?.version || 0) + 1
          }
        }
      }))
    },
    
    // UI State Management
    toggleListExpanded: (sessionId) => {
      set((state) => {
        const newExpandedLists = new Set(state.expandedLists)
        if (newExpandedLists.has(sessionId)) {
          newExpandedLists.delete(sessionId)
        } else {
          newExpandedLists.add(sessionId)
        }
        return { expandedLists: newExpandedLists }
      })
    },
    
    setSelectedTodos: (todoIds) => {
      set({ selectedTodos: new Set(todoIds) })
    },
    
    toggleTodoSelection: (todoId) => {
      set((state) => {
        const newSelected = new Set(state.selectedTodos)
        if (newSelected.has(todoId)) {
          newSelected.delete(todoId)
        } else {
          newSelected.add(todoId)
        }
        return { selectedTodos: newSelected }
      })
    },
    
    // Computed Getters
    getTodosByStatus: (sessionId, status) => {
      const todoList = get().todoLists[sessionId]
      return todoList?.todos.filter(todo => todo.status === status) || []
    },
    
    getTodosCount: (sessionId) => {
      const todoList = get().todoLists[sessionId]
      if (!todoList) return { total: 0, completed: 0, pending: 0 }
      
      const total = todoList.todos.length
      const completed = todoList.todos.filter(t => t.status === 'completed').length
      const pending = todoList.todos.filter(t => t.status === 'pending').length
      
      return { total, completed, pending }
    },
    
    getPhaseProgress: (sessionId) => {
      const todoList = get().todoLists[sessionId]
      if (!todoList || todoList.todos.length === 0) return 0
      
      const completed = todoList.todos.filter(t => t.status === 'completed').length
      return completed / todoList.todos.length
    }
  }))
)
```

### 3. Todo Tool Integration

```typescript
// src/components/tools/TodoTool.tsx - Tool call component for todo operations
import React, { useMemo } from 'react'
import { ToolCall } from '@types/tools'
import { TodoToolCallMetadata } from '@types/todo'
import { useTodoStore } from '@stores/todoStore'
import { useOpenCodeStore } from '@stores/openCodeStore'
import { TodoList } from './TodoList'
import { TodoPhaseIndicator } from './TodoPhaseIndicator'
import { TodoChangeSummary } from './TodoChangeSummary'

interface TodoToolProps {
  toolCall: ToolCall
}

export function TodoTool({ toolCall }: TodoToolProps) {
  const { currentSession } = useOpenCodeStore()
  const { setTodoList, getTodoList } = useTodoStore()
  
  const metadata = toolCall.metadata as TodoToolCallMetadata | undefined
  const isCompleted = toolCall.state === 'completed'
  const isRunning = toolCall.state === 'running'
  const isError = toolCall.state === 'error'
  
  // Update store when tool call completes
  React.useEffect(() => {
    if (isCompleted && metadata?.todos && currentSession) {
      const todoList = {
        sessionId: currentSession.id,
        todos: metadata.todos,
        phase: metadata.phase,
        lastUpdated: Date.now(),
        version: (getTodoList(currentSession.id)?.version || 0) + 1
      }
      setTodoList(currentSession.id, todoList)
    }
  }, [isCompleted, metadata, currentSession, setTodoList, getTodoList])
  
  const stats = useMemo(() => {
    if (!metadata?.todos) return null
    
    const total = metadata.todos.length
    const completed = metadata.todos.filter(t => t.status === 'completed').length
    const inProgress = metadata.todos.filter(t => t.status === 'in_progress').length
    const pending = metadata.todos.filter(t => t.status === 'pending').length
    
    return { total, completed, inProgress, pending }
  }, [metadata?.todos])
  
  return (
    <div className={`todo-tool todo-tool--${toolCall.state}`}>
      {/* Tool Header */}
      <div className="todo-tool__header">
        <div className="todo-tool__icon">
          <ChecklistIcon className={isRunning ? 'animate-pulse' : ''} />
        </div>
        
        <div className="todo-tool__title">
          <span className="todo-tool__title-text">
            {toolCall.title || 'Todo Management'}
          </span>
          
          {stats && (
            <span className="todo-tool__stats">
              {stats.completed}/{stats.total} completed
            </span>
          )}
        </div>
        
        {metadata?.phase && (
          <TodoPhaseIndicator 
            phase={metadata.phase} 
            animated={isRunning}
          />
        )}
      </div>
      
      {/* Error State */}
      {isError && (
        <div className="todo-tool__error">
          <AlertTriangleIcon className="todo-tool__error-icon" />
          <span>Failed to update todos: {toolCall.error}</span>
        </div>
      )}
      
      {/* Loading State */}
      {isRunning && !metadata?.todos && (
        <div className="todo-tool__loading">
          <div className="todo-tool__loading-skeleton">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="todo-tool__loading-item">
                <div className="todo-tool__loading-checkbox" />
                <div className="todo-tool__loading-text" />
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Todo List Content */}
      {metadata?.todos && (
        <div className="todo-tool__content">
          {/* Change Summary */}
          {metadata.changes && metadata.changes.length > 0 && (
            <TodoChangeSummary 
              changes={metadata.changes}
              operation={metadata.operation}
            />
          )}
          
          {/* Todo List */}
          <TodoList
            todos={metadata.todos}
            phase={metadata.phase}
            animated={isRunning}
            readonly={true}  // Tool display is read-only
            showPhaseProgress={true}
            compact={false}
          />
        </div>
      )}
    </div>
  )
}

// Supporting components
interface ChecklistIconProps {
  className?: string
}

function ChecklistIcon({ className }: ChecklistIconProps) {
  return (
    <svg 
      className={`todo-tool__icon-svg ${className || ''}`}
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10,9 9,10 7,8" />
    </svg>
  )
}

function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg 
      className={className}
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}
```

### 4. TodoList Component

```typescript
// src/components/todos/TodoList.tsx - Reusable todo list component
import React, { useMemo, useState } from 'react'
import { TodoItem, TodoStatus, TodoPhase } from '@types/todo'
import { useTodoStore } from '@stores/todoStore'
import { TodoItemComponent } from './TodoItemComponent'
import { TodoFilters } from './TodoFilters'
import { TodoProgress } from './TodoProgress'

interface TodoListProps {
  todos: TodoItem[]
  phase: TodoPhase
  animated?: boolean
  readonly?: boolean
  showFilters?: boolean
  showPhaseProgress?: boolean
  compact?: boolean
  maxHeight?: string
  onTodoClick?: (todo: TodoItem) => void
  onTodoUpdate?: (todoId: string, updates: Partial<TodoItem>) => void
}

export function TodoList({
  todos,
  phase,
  animated = false,
  readonly = false,
  showFilters = false,
  showPhaseProgress = false,
  compact = false,
  maxHeight = '400px',
  onTodoClick,
  onTodoUpdate
}: TodoListProps) {
  const { 
    showCompleted, 
    sortBy,
    selectedTodos,
    draggedTodo,
    dragOverTodo,
    setDraggedTodo,
    setDragOverTodo
  } = useTodoStore()
  
  const [statusFilter, setStatusFilter] = useState<TodoStatus | 'all'>('all')
  
  // Filter and sort todos
  const filteredTodos = useMemo(() => {
    let filtered = todos
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(todo => todo.status === statusFilter)
    }
    
    if (!showCompleted) {
      filtered = filtered.filter(todo => todo.status !== 'completed')
    }
    
    // Sort todos
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 }
          return (priorityOrder[b.priority || 'low'] || 1) - (priorityOrder[a.priority || 'low'] || 1)
        case 'status':
          const statusOrder = { pending: 1, in_progress: 2, completed: 3, cancelled: 4 }
          return statusOrder[a.status] - statusOrder[b.status]
        case 'updated':
          return b.updated - a.updated
        case 'created':
        default:
          return a.created - b.created
      }
    })
  }, [todos, statusFilter, showCompleted, sortBy])
  
  // Calculate statistics
  const stats = useMemo(() => {
    const total = todos.length
    const completed = todos.filter(t => t.status === 'completed').length
    const inProgress = todos.filter(t => t.status === 'in_progress').length
    const pending = todos.filter(t => t.status === 'pending').length
    const cancelled = todos.filter(t => t.status === 'cancelled').length
    
    return { total, completed, inProgress, pending, cancelled }
  }, [todos])
  
  // Drag and drop handlers
  const handleDragStart = (todoId: string) => {
    if (readonly) return
    setDraggedTodo(todoId)
  }
  
  const handleDragOver = (todoId: string) => {
    if (readonly || !draggedTodo) return
    setDragOverTodo(todoId)
  }
  
  const handleDragEnd = () => {
    setDraggedTodo(null)
    setDragOverTodo(null)
  }
  
  const handleDrop = (targetTodoId: string) => {
    if (readonly || !draggedTodo || draggedTodo === targetTodoId) return
    
    // Implement reordering logic here if needed
    onTodoUpdate?.(draggedTodo, { updated: Date.now() })
    
    handleDragEnd()
  }
  
  if (todos.length === 0) {
    return (
      <div className="todo-list todo-list--empty">
        <div className="todo-list__empty-state">
          <ChecklistIcon className="todo-list__empty-icon" />
          <span className="todo-list__empty-text">No todos yet</span>
        </div>
      </div>
    )
  }
  
  return (
    <div className={`todo-list ${compact ? 'todo-list--compact' : ''}`}>
      {/* Filters */}
      {showFilters && (
        <TodoFilters
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          stats={stats}
        />
      )}
      
      {/* Phase Progress */}
      {showPhaseProgress && (
        <TodoProgress
          phase={phase}
          stats={stats}
          animated={animated}
        />
      )}
      
      {/* Todo Items */}
      <div 
        className="todo-list__items"
        style={{ maxHeight }}
      >
        {filteredTodos.map((todo, index) => (
          <TodoItemComponent
            key={todo.id}
            todo={todo}
            index={index}
            animated={animated && todo.status === 'in_progress'}
            readonly={readonly}
            compact={compact}
            selected={selectedTodos.has(todo.id)}
            dragged={draggedTodo === todo.id}
            draggedOver={dragOverTodo === todo.id}
            onClick={() => onTodoClick?.(todo)}
            onUpdate={(updates) => onTodoUpdate?.(todo.id, updates)}
            onDragStart={() => handleDragStart(todo.id)}
            onDragOver={() => handleDragOver(todo.id)}
            onDragEnd={handleDragEnd}
            onDrop={() => handleDrop(todo.id)}
          />
        ))}
      </div>
      
      {/* Summary */}
      {!compact && (
        <div className="todo-list__summary">
          <span className="todo-list__summary-text">
            {stats.completed} of {stats.total} completed
            {stats.inProgress > 0 && ` • ${stats.inProgress} in progress`}
            {stats.pending > 0 && ` • ${stats.pending} pending`}
          </span>
        </div>
      )}
    </div>
  )
}

// Additional helper component for empty state icon
function ChecklistIcon({ className }: { className?: string }) {
  return (
    <svg 
      className={className}
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10,9 9,10 7,8" />
    </svg>
  )
}
```

### 5. TodoItemComponent

```typescript
// src/components/todos/TodoItemComponent.tsx - Individual todo item with interactions
import React, { useState, useRef, useEffect } from 'react'
import { TodoItem, TodoStatus, TodoPriority } from '@types/todo'
import { useTodoStore } from '@stores/todoStore'

interface TodoItemProps {
  todo: TodoItem
  index: number
  animated?: boolean
  readonly?: boolean
  compact?: boolean
  selected?: boolean
  dragged?: boolean
  draggedOver?: boolean
  onClick?: () => void
  onUpdate?: (updates: Partial<TodoItem>) => void
  onDragStart?: () => void
  onDragOver?: () => void
  onDragEnd?: () => void
  onDrop?: () => void
}

export function TodoItemComponent({
  todo,
  index,
  animated = false,
  readonly = false,
  compact = false,
  selected = false,
  dragged = false,
  draggedOver = false,
  onClick,
  onUpdate,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop
}: TodoItemProps) {
  const { editingTodo, setEditingTodo } = useTodoStore()
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(todo.content)
  const inputRef = useRef<HTMLInputElement>(null)
  
  const isEditingThis = editingTodo === todo.id
  const canEdit = !readonly && !dragged
  
  // Handle edit mode
  useEffect(() => {
    if (isEditingThis && !isEditing) {
      setIsEditing(true)
      setEditContent(todo.content)
    } else if (!isEditingThis && isEditing) {
      setIsEditing(false)
    }
  }, [isEditingThis, isEditing, todo.content])
  
  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])
  
  // Handle status change
  const handleStatusChange = (newStatus: TodoStatus) => {
    if (readonly) return
    onUpdate?.({ 
      status: newStatus,
      updated: Date.now()
    })
  }
  
  // Handle edit save
  const handleEditSave = () => {
    if (editContent.trim() !== todo.content) {
      onUpdate?.({ 
        content: editContent.trim(),
        updated: Date.now()
      })
    }
    setEditingTodo(null)
    setIsEditing(false)
  }
  
  // Handle edit cancel
  const handleEditCancel = () => {
    setEditContent(todo.content)
    setEditingTodo(null)
    setIsEditing(false)
  }
  
  // Handle key events in edit mode
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleEditSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleEditCancel()
    }
  }
  
  // Get status icon
  const getStatusIcon = () => {
    switch (todo.status) {
      case 'completed':
        return <CheckCircleIcon className="todo-item__status-icon todo-item__status-icon--completed" />
      case 'in_progress':
        return (
          <div className="todo-item__status-icon todo-item__status-icon--in-progress">
            {animated ? (
              <SpinnerIcon className="animate-spin" />
            ) : (
              <PlayCircleIcon />
            )}
          </div>
        )
      case 'cancelled':
        return <XCircleIcon className="todo-item__status-icon todo-item__status-icon--cancelled" />
      case 'pending':
      default:
        return <CircleIcon className="todo-item__status-icon todo-item__status-icon--pending" />
    }
  }
  
  // Get priority color
  const getPriorityClass = () => {
    if (!todo.priority) return ''
    return `todo-item--priority-${todo.priority}`
  }
  
  return (
    <div
      className={`
        todo-item 
        todo-item--${todo.status}
        ${compact ? 'todo-item--compact' : ''}
        ${selected ? 'todo-item--selected' : ''}
        ${dragged ? 'todo-item--dragged' : ''}
        ${draggedOver ? 'todo-item--drag-over' : ''}
        ${getPriorityClass()}
      `}
      draggable={canEdit}
      onClick={onClick}
      onDragStart={onDragStart}
      onDragOver={(e) => {
        e.preventDefault()
        onDragOver?.()
      }}
      onDragEnd={onDragEnd}
      onDrop={(e) => {
        e.preventDefault()
        onDrop?.()
      }}
    >
      {/* Status Indicator */}
      <div 
        className="todo-item__status"
        onClick={(e) => {
          e.stopPropagation()
          if (!readonly) {
            const nextStatus = getNextStatus(todo.status)
            handleStatusChange(nextStatus)
          }
        }}
      >
        {getStatusIcon()}
      </div>
      
      {/* Content */}
      <div className="todo-item__content">
        {isEditing ? (
          <input
            ref={inputRef}
            className="todo-item__edit-input"
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onBlur={handleEditSave}
            onKeyDown={handleKeyDown}
            placeholder="Enter todo content..."
          />
        ) : (
          <div className="todo-item__text-content">
            <span 
              className={`
                todo-item__text 
                ${todo.status === 'completed' ? 'todo-item__text--completed' : ''}
                ${todo.status === 'cancelled' ? 'todo-item__text--cancelled' : ''}
              `}
            >
              {todo.content}
            </span>
            
            {/* Active form text for in-progress items */}
            {todo.status === 'in_progress' && todo.activeForm && (
              <span className="todo-item__active-form">
                {todo.activeForm}
              </span>
            )}
          </div>
        )}
      </div>
      
      {/* Priority Indicator */}
      {todo.priority && !compact && (
        <div className={`todo-item__priority todo-item__priority--${todo.priority}`}>
          <PriorityIcon priority={todo.priority} />
        </div>
      )}
      
      {/* Actions */}
      {!readonly && !isEditing && (
        <div className="todo-item__actions">
          <button
            className="todo-item__action todo-item__action--edit"
            onClick={(e) => {
              e.stopPropagation()
              setEditingTodo(todo.id)
            }}
            title="Edit todo"
          >
            <EditIcon />
          </button>
        </div>
      )}
      
      {/* Drag Handle */}
      {!readonly && !isEditing && (
        <div className="todo-item__drag-handle">
          <DragHandleIcon />
        </div>
      )}
    </div>
  )
}

// Helper function to get next status in cycle
function getNextStatus(currentStatus: TodoStatus): TodoStatus {
  const statusCycle: TodoStatus[] = ['pending', 'in_progress', 'completed']
  const currentIndex = statusCycle.indexOf(currentStatus)
  const nextIndex = (currentIndex + 1) % statusCycle.length
  return statusCycle[nextIndex]
}

// Icon components
function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
    </svg>
  )
}

function PlayCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
    </svg>
  )
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M21 12a9 9 0 11-6.219-8.56"/>
    </svg>
  )
}

function CircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <circle cx="12" cy="12" r="10"/>
    </svg>
  )
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11H7v-2h10v2z"/>
    </svg>
  )
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}

function DragHandleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 9H4v2h16V9zM4 15h16v-2H4v2z"/>
    </svg>
  )
}

function PriorityIcon({ priority, className }: { priority: TodoPriority; className?: string }) {
  const color = priority === 'high' ? '#ef4444' : priority === 'medium' ? '#f59e0b' : '#6b7280'
  
  return (
    <svg className={className} viewBox="0 0 24 24" fill={color}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  )
}
```

### 6. Real-time Updates Integration

```typescript
// src/hooks/useTodoSync.ts - Hook for syncing todos with SSE events
import { useEffect } from 'react'
import { useSSEStore } from '@stores/sseStore'
import { useTodoStore } from '@stores/todoStore'
import { useOpenCodeStore } from '@stores/openCodeStore'
import { TodoToolCallMetadata } from '@types/todo'

export function useTodoSync() {
  const { currentSession } = useOpenCodeStore()
  const { setTodoList, getTodoList } = useTodoStore()
  const { on, off } = useSSEStore()
  
  useEffect(() => {
    if (!currentSession) return
    
    // Handler for tool call updates
    const handleToolCallUpdate = (event: any) => {
      if (event.type !== 'tool_call_result') return
      if (!event.data.toolCall) return
      
      const toolCall = event.data.toolCall
      if (toolCall.name !== 'todowrite' && toolCall.name !== 'todoread') return
      
      const metadata = toolCall.metadata as TodoToolCallMetadata | undefined
      if (!metadata?.todos) return
      
      // Update todo store with new data
      const todoList = {
        sessionId: currentSession.id,
        todos: metadata.todos,
        phase: metadata.phase,
        lastUpdated: Date.now(),
        version: (getTodoList(currentSession.id)?.version || 0) + 1
      }
      
      setTodoList(currentSession.id, todoList)
    }
    
    // Handler for streaming todo updates
    const handleToolCallStreaming = (event: any) => {
      if (event.type !== 'tool_call_delta') return
      if (!event.data.toolCall) return
      
      const toolCall = event.data.toolCall
      if (toolCall.name !== 'todowrite') return
      
      const metadata = toolCall.metadata as TodoToolCallMetadata | undefined
      if (!metadata?.todos) return
      
      // Update store with streaming data
      const todoList = {
        sessionId: currentSession.id,
        todos: metadata.todos,
        phase: metadata.phase || 'updating_plan',
        lastUpdated: Date.now(),
        version: (getTodoList(currentSession.id)?.version || 0) + 1
      }
      
      setTodoList(currentSession.id, todoList)
    }
    
    // Subscribe to SSE events
    on('tool_call_result', handleToolCallUpdate)
    on('tool_call_delta', handleToolCallStreaming)
    
    return () => {
      off('tool_call_result', handleToolCallUpdate)
      off('tool_call_delta', handleToolCallStreaming)
    }
  }, [currentSession, setTodoList, getTodoList, on, off])
}

// Helper hook for todo statistics
export function useTodoStats(sessionId: string) {
  const { getTodosCount, getPhaseProgress } = useTodoStore()
  
  return {
    counts: getTodosCount(sessionId),
    progress: getPhaseProgress(sessionId)
  }
}

// Helper hook for todo operations
export function useTodoOperations() {
  const { currentSession } = useOpenCodeStore()
  const { updateTodo, addTodo, removeTodo } = useTodoStore()
  
  const createTodo = (content: string, priority?: TodoPriority) => {
    if (!currentSession) return
    
    const todo = {
      id: generateTodoId(),
      content,
      status: 'pending' as const,
      priority,
      created: Date.now(),
      updated: Date.now()
    }
    
    addTodo(currentSession.id, todo)
  }
  
  const completeTodo = (todoId: string) => {
    if (!currentSession) return
    updateTodo(currentSession.id, todoId, { 
      status: 'completed',
      updated: Date.now()
    })
  }
  
  const startTodo = (todoId: string, activeForm?: string) => {
    if (!currentSession) return
    updateTodo(currentSession.id, todoId, { 
      status: 'in_progress',
      activeForm,
      updated: Date.now()
    })
  }
  
  const cancelTodo = (todoId: string) => {
    if (!currentSession) return
    updateTodo(currentSession.id, todoId, { 
      status: 'cancelled',
      updated: Date.now()
    })
  }
  
  return {
    createTodo,
    completeTodo,
    startTodo,
    cancelTodo,
    updateTodo: (todoId: string, updates: Partial<TodoItem>) => {
      if (!currentSession) return
      updateTodo(currentSession.id, todoId, updates)
    },
    deleteTodo: (todoId: string) => {
      if (!currentSession) return
      removeTodo(currentSession.id, todoId)
    }
  }
}

// Utility function for generating todo IDs
function generateTodoId(): string {
  return `todo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}
```

### 7. Performance Optimizations

```typescript
// src/components/todos/VirtualizedTodoList.tsx - Optimized for large todo lists
import React, { useMemo, useCallback } from 'react'
import { FixedSizeList as List } from 'react-window'
import { TodoItem, TodoStatus } from '@types/todo'
import { TodoItemComponent } from './TodoItemComponent'

interface VirtualizedTodoListProps {
  todos: TodoItem[]
  height: number
  itemHeight: number
  onTodoUpdate?: (todoId: string, updates: Partial<TodoItem>) => void
  readonly?: boolean
}

export function VirtualizedTodoList({
  todos,
  height,
  itemHeight = 56,
  onTodoUpdate,
  readonly = false
}: VirtualizedTodoListProps) {
  // Memoized item data to prevent unnecessary re-renders
  const itemData = useMemo(() => ({
    todos,
    onTodoUpdate,
    readonly
  }), [todos, onTodoUpdate, readonly])
  
  // Memoized row renderer
  const Row = useCallback(({ index, style, data }: any) => {
    const { todos, onTodoUpdate, readonly } = data
    const todo = todos[index]
    
    return (
      <div style={style}>
        <TodoItemComponent
          todo={todo}
          index={index}
          readonly={readonly}
          onUpdate={(updates) => onTodoUpdate?.(todo.id, updates)}
        />
      </div>
    )
  }, [])
  
  if (todos.length === 0) {
    return (
      <div className="todo-list__empty-state">
        <span>No todos to display</span>
      </div>
    )
  }
  
  return (
    <List
      height={height}
      itemCount={todos.length}
      itemSize={itemHeight}
      itemData={itemData}
      className="virtualized-todo-list"
    >
      {Row}
    </List>
  )
}

// Memoized todo item for performance
export const MemoizedTodoItem = React.memo(
  TodoItemComponent,
  (prevProps, nextProps) => {
    return (
      prevProps.todo.id === nextProps.todo.id &&
      prevProps.todo.status === nextProps.todo.status &&
      prevProps.todo.content === nextProps.todo.content &&
      prevProps.todo.updated === nextProps.todo.updated &&
      prevProps.animated === nextProps.animated &&
      prevProps.readonly === nextProps.readonly &&
      prevProps.selected === nextProps.selected &&
      prevProps.dragged === nextProps.dragged &&
      prevProps.draggedOver === nextProps.draggedOver
    )
  }
)
```

### 8. Styling

```css
/* src/styles/todo.css - Todo-specific styles */

/* Todo Tool Component */
.todo-tool {
  @apply border rounded-lg overflow-hidden;
  background: var(--bg-primary);
  border-color: var(--border-primary);
}

.todo-tool--pending {
  border-color: var(--tool-pending);
}

.todo-tool--running {
  border-color: var(--tool-running);
  box-shadow: 0 0 0 1px var(--tool-running);
}

.todo-tool--completed {
  border-color: var(--tool-completed);
}

.todo-tool--error {
  border-color: var(--tool-error);
}

/* Todo Tool Header */
.todo-tool__header {
  @apply flex items-center gap-3 p-4 border-b;
  border-color: var(--border-primary);
  background: var(--bg-secondary);
}

.todo-tool__icon {
  @apply w-5 h-5 flex-shrink-0;
  color: var(--text-secondary);
}

.todo-tool__icon-svg {
  @apply w-full h-full;
}

.todo-tool__title {
  @apply flex-1 flex items-center justify-between;
}

.todo-tool__title-text {
  @apply font-medium;
  color: var(--text-primary);
}

.todo-tool__stats {
  @apply text-sm;
  color: var(--text-secondary);
}

/* Todo Tool Content */
.todo-tool__content {
  @apply p-4;
}

.todo-tool__error {
  @apply flex items-center gap-2 p-4 text-sm;
  color: var(--color-error);
  background: var(--bg-error);
}

.todo-tool__error-icon {
  @apply w-4 h-4 flex-shrink-0;
}

/* Loading States */
.todo-tool__loading {
  @apply p-4;
}

.todo-tool__loading-skeleton {
  @apply space-y-3;
}

.todo-tool__loading-item {
  @apply flex items-center gap-3;
}

.todo-tool__loading-checkbox {
  @apply w-4 h-4 rounded bg-gray-200 animate-pulse;
}

.todo-tool__loading-text {
  @apply h-4 bg-gray-200 rounded flex-1 animate-pulse;
}

/* Todo List Component */
.todo-list {
  @apply space-y-4;
}

.todo-list--compact {
  @apply space-y-2;
}

.todo-list--empty {
  @apply p-8 text-center;
}

.todo-list__empty-state {
  @apply flex flex-col items-center gap-3;
}

.todo-list__empty-icon {
  @apply w-12 h-12;
  color: var(--text-muted);
}

.todo-list__empty-text {
  color: var(--text-muted);
}

.todo-list__items {
  @apply space-y-2 overflow-y-auto;
}

.todo-list__summary {
  @apply pt-4 border-t text-sm;
  border-color: var(--border-primary);
  color: var(--text-secondary);
}

/* Todo Item Component */
.todo-item {
  @apply flex items-center gap-3 p-3 rounded-lg border transition-all duration-200;
  background: var(--bg-primary);
  border-color: var(--border-primary);
}

.todo-item:hover {
  background: var(--bg-secondary);
  border-color: var(--border-secondary);
}

.todo-item--compact {
  @apply p-2;
}

.todo-item--selected {
  background: var(--bg-selected);
  border-color: var(--border-focus);
}

.todo-item--dragged {
  @apply opacity-50 transform scale-105;
}

.todo-item--drag-over {
  @apply border-2 border-dashed;
  border-color: var(--color-primary);
}

/* Todo Item Priority */
.todo-item--priority-high {
  border-left: 4px solid var(--color-error);
}

.todo-item--priority-medium {
  border-left: 4px solid var(--color-warning);
}

.todo-item--priority-low {
  border-left: 4px solid var(--color-info);
}

/* Todo Item Status */
.todo-item__status {
  @apply w-6 h-6 flex-shrink-0 cursor-pointer;
}

.todo-item__status-icon {
  @apply w-full h-full transition-colors duration-200;
}

.todo-item__status-icon--pending {
  color: var(--text-muted);
}

.todo-item__status-icon--in-progress {
  color: var(--tool-running);
}

.todo-item__status-icon--completed {
  color: var(--tool-completed);
}

.todo-item__status-icon--cancelled {
  color: var(--text-muted);
}

/* Todo Item Content */
.todo-item__content {
  @apply flex-1 min-w-0;
}

.todo-item__text-content {
  @apply space-y-1;
}

.todo-item__text {
  @apply block text-sm leading-relaxed;
  color: var(--text-primary);
}

.todo-item__text--completed {
  @apply line-through;
  color: var(--text-muted);
}

.todo-item__text--cancelled {
  @apply line-through;
  color: var(--text-muted);
}

.todo-item__active-form {
  @apply block text-xs font-mono;
  color: var(--tool-running);
}

.todo-item__edit-input {
  @apply w-full px-2 py-1 text-sm border rounded;
  background: var(--bg-primary);
  border-color: var(--border-focus);
  color: var(--text-primary);
}

.todo-item__edit-input:focus {
  @apply outline-none ring-2;
  ring-color: var(--color-primary);
}

/* Todo Item Priority */
.todo-item__priority {
  @apply w-4 h-4 flex-shrink-0;
}

.todo-item__priority--high {
  color: var(--color-error);
}

.todo-item__priority--medium {
  color: var(--color-warning);
}

.todo-item__priority--low {
  color: var(--color-info);
}

/* Todo Item Actions */
.todo-item__actions {
  @apply flex items-center gap-1 opacity-0 transition-opacity duration-200;
}

.todo-item:hover .todo-item__actions {
  @apply opacity-100;
}

.todo-item__action {
  @apply p-1 rounded hover:bg-gray-100 transition-colors duration-200;
}

.todo-item__action svg {
  @apply w-4 h-4;
  color: var(--text-secondary);
}

.todo-item__action:hover svg {
  color: var(--text-primary);
}

/* Todo Item Drag Handle */
.todo-item__drag-handle {
  @apply w-4 h-4 flex-shrink-0 cursor-grab opacity-0 transition-opacity duration-200;
  color: var(--text-muted);
}

.todo-item:hover .todo-item__drag-handle {
  @apply opacity-100;
}

.todo-item__drag-handle:active {
  @apply cursor-grabbing;
}

/* Animations */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.todo-tool--running .todo-tool__title-text {
  background: linear-gradient(90deg, 
    transparent, 
    rgba(var(--tool-running-rgb), 0.2), 
    transparent);
  background-size: 200% 100%;
  animation: shimmer 2.5s infinite;
}

/* Virtualized List */
.virtualized-todo-list {
  @apply outline-none;
}

.virtualized-todo-list:focus {
  @apply outline-none;
}

/* Responsive Design */
@media (max-width: 640px) {
  .todo-item {
    @apply p-2;
  }
  
  .todo-item__actions {
    @apply opacity-100;
  }
  
  .todo-item__drag-handle {
    @apply opacity-100;
  }
}

/* Dark Theme Overrides */
[data-theme="dark"] {
  --bg-error: rgba(239, 68, 68, 0.1);
  --bg-selected: rgba(59, 130, 246, 0.1);
}

/* High Contrast Theme */
[data-theme="high-contrast"] .todo-item {
  @apply border-2;
}

[data-theme="high-contrast"] .todo-item--selected {
  @apply border-4;
}
```

## 🔧 Integration Points

### 1. Store Integration

```typescript
// Integrate todo store with main application store
export const useOpenCodeStore = create<OpenCodeState>()(
  subscribeWithSelector((set, get) => ({
    // ... existing state
    
    // Todo-related actions
    onToolCallComplete: (toolCall: ToolCall) => {
      // Handle todo tool completions
      if (toolCall.name === 'todowrite' || toolCall.name === 'todoread') {
        const todoStore = useTodoStore.getState()
        const metadata = toolCall.metadata as TodoToolCallMetadata
        
        if (metadata?.todos && get().currentSession) {
          todoStore.bulkUpdateTodos(get().currentSession!.id, metadata.todos)
        }
      }
    }
  }))
)
```

### 2. SSE Event Handling

```typescript
// Add todo-specific event handlers to SSE service
export class SSEService {
  private handleToolCallUpdate(event: any) {
    if (event.data.toolCall?.name === 'todowrite') {
      const metadata = event.data.toolCall.metadata as TodoToolCallMetadata
      if (metadata?.todos) {
        const todoStore = useTodoStore.getState()
        const sessionId = event.data.sessionId
        
        todoStore.bulkUpdateTodos(sessionId, metadata.todos)
      }
    }
  }
}
```

### 3. Tool Registry Integration

```typescript
// Register todo tool renderers in tool registry
const toolRenderers = {
  todowrite: TodoTool,
  todoread: TodoTool,  // Same component handles both
  // ... other tools
}
```

## 📊 Performance Considerations

### 1. Optimization Strategies
- **Memoization**: React.memo for todo items and lists
- **Virtualization**: For lists with >100 items
- **Debounced Updates**: For edit operations
- **Selective Re-renders**: Only update changed items

### 2. Memory Management
- **Cleanup**: Remove old session todos from store
- **Pagination**: Load todos in chunks for large lists
- **Caching**: Cache computed statistics and filters

### 3. Network Optimization
- **Batch Updates**: Group multiple todo changes
- **Optimistic Updates**: Update UI before server confirmation
- **Conflict Resolution**: Handle concurrent modifications

## 🧪 Testing Strategy

### 1. Unit Tests

```typescript
// Example todo store test
describe('TodoStore', () => {
  beforeEach(() => {
    useTodoStore.setState({
      todoLists: {},
      expandedLists: new Set(),
      selectedTodos: new Set()
    })
  })
  
  it('should add todo to session', () => {
    const { addTodo, getTodoList } = useTodoStore.getState()
    
    const todo: TodoItem = {
      id: 'test-1',
      content: 'Test todo',
      status: 'pending',
      created: Date.now(),
      updated: Date.now()
    }
    
    addTodo('session-1', todo)
    
    const todoList = getTodoList('session-1')
    expect(todoList?.todos).toHaveLength(1)
    expect(todoList?.todos[0]).toEqual(todo)
  })
})
```

### 2. Integration Tests

```typescript
// Test todo tool integration
describe('TodoTool Integration', () => {
  it('should update store when tool call completes', async () => {
    const toolCall: ToolCall = {
      id: 'tool-1',
      name: 'todowrite',
      state: 'completed',
      metadata: {
        todos: [/* test todos */],
        phase: 'executing_tasks'
      }
    }
    
    render(<TodoTool toolCall={toolCall} />)
    
    await waitFor(() => {
      const todoStore = useTodoStore.getState()
      expect(todoStore.getTodoList('current-session')).toBeDefined()
    })
  })
})
```

### 3. E2E Tests

```typescript
// Test complete todo workflow
describe('Todo Workflow', () => {
  it('should create, update, and complete todos', async () => {
    // Navigate to chat
    await page.goto('/chat')
    
    // Send message to create todos
    await page.fill('[data-testid="message-input"]', 'Create a todo list for this project')
    await page.click('[data-testid="send-button"]')
    
    // Wait for todo tool to appear
    await page.waitForSelector('.todo-tool')
    
    // Verify todos are displayed
    const todoItems = await page.locator('.todo-item').count()
    expect(todoItems).toBeGreaterThan(0)
    
    // Click on a todo status to complete it
    await page.click('.todo-item__status')
    
    // Verify status changed
    await page.waitForSelector('.todo-item--completed')
  })
})
```

---

This comprehensive implementation provides a robust todo management system that integrates seamlessly with the VS Code extension's chat interface, offering real-time updates, interactive features, and excellent performance for managing development tasks and project planning workflows.