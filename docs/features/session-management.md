# Session Management

## Overview

OpenCode's session management system provides a comprehensive framework for handling conversations, message history, state persistence, and hierarchical session organization. The system supports parent-child session relationships, real-time updates, and integration with external storage and sharing services.

## File Locations

### Core Session System
- **Session Manager**: `packages/opencode/src/session/index.ts`
- **Message System**: `packages/opencode/src/session/message-v2.ts`
- **Legacy Messages**: `packages/opencode/src/session/message.ts`
- **System Prompts**: `packages/opencode/src/session/system.ts`

### Integration Points
- **Storage**: `packages/opencode/src/storage/storage.ts`
- **Event Bus**: `packages/opencode/src/bus/index.ts`
- **Sharing**: `packages/opencode/src/share/share.ts`
- **Snapshots**: `packages/opencode/src/snapshot/index.ts`

## Session Architecture

### Session Hierarchy

```
Parent Session
├── Child Session 1 (Task delegation)
├── Child Session 2 (Sub-agent work)
└── Child Session 3 (Background processing)
```

#### Session Information Schema

```typescript
// packages/opencode/src/session/index.ts
export const Info = z.object({
  id: Identifier.schema("session"),        // Unique session identifier
  parentID: Identifier.schema("session").optional(), // Parent session reference
  share: z.object({
    url: z.string()                        // Sharing URL if shared
  }).optional(),
  title: z.string(),                       // Session title
  version: z.string(),                     // OpenCode version
  time: z.object({
    created: z.number(),                   // Creation timestamp
    updated: z.number()                    // Last update timestamp
  }),
  agent: z.string(),                       // Active agent name
  model: z.object({
    providerID: z.string(),                // AI provider
    modelID: z.string()                    // Model identifier
  }),
  cost: z.object({
    input: z.number(),                     // Input token cost
    output: z.number(),                    // Output token cost
    cache: z.number().optional()          // Cache cost
  }),
  usage: z.object({
    input: z.number(),                     // Input tokens used
    output: z.number(),                    // Output tokens used
    cache: z.object({
      read: z.number(),                    // Cache tokens read
      write: z.number()                    // Cache tokens written
    }).optional()
  }),
  data: z.record(z.any()).optional()      // Custom session data
})
```

### Message System

#### Message Types

```typescript
// Modern message system (message-v2.ts)
export const Info = z.object({
  id: z.string(),                          // Message identifier
  type: z.enum(["user", "assistant"]),     // Message role
  time: z.object({
    created: z.number(),                   // Creation time
    updated: z.number()                    // Last update time
  }),
  parent: z.string().optional(),           // Parent message ID
  input: z.string(),                       // User input or system prompt
  output: z.string().optional(),           // Assistant response
  parts: z.array(Part).optional()         // Message parts (tool calls, results)
})

// Message parts for tool interactions
export const Part = z.discriminatedUnion("state", [
  ToolCall,        // Tool invocation
  ToolResult,      // Tool execution result
  ToolPartialCall, // Streaming tool call
  ToolPartialResult // Streaming tool result
])
```

#### Tool Integration

```typescript
// Tool calls within messages
export const ToolCall = z.object({
  state: z.literal("call"),
  step: z.number().optional(),
  toolCallId: z.string(),
  toolName: z.string(),
  args: z.custom<Required<unknown>>()
})

export const ToolResult = z.object({
  state: z.literal("result"),
  step: z.number().optional(),
  toolCallId: z.string(),
  toolName: z.string(),
  args: z.custom<Required<unknown>>(),
  result: z.string()
})
```

## Session Lifecycle

### Session Creation

```typescript
export async function create(input: {
  title?: string
  parentID?: string
  agent?: string
  model?: { providerID: string; modelID: string }
}): Promise<Info> {
  const session: Info = {
    id: ulid(),
    parentID: input.parentID,
    title: input.title ?? createDefaultTitle(!!input.parentID),
    version: Installation.info.version,
    time: {
      created: Date.now(),
      updated: Date.now()
    },
    agent: input.agent ?? config.agent ?? "claude",
    model: input.model ?? await Provider.defaultModel(),
    cost: { input: 0, output: 0, cache: 0 },
    usage: { input: 0, output: 0, cache: { read: 0, write: 0 } }
  }
  
  await Storage.set(`session/info/${session.id}`, session)
  Bus.publish(Event.Updated, { info: session })
  
  return session
}
```

### Message Flow

```typescript
export async function chat(input: {
  sessionID: string
  input: string
  providerID?: string
  modelID?: string
  agent?: string
  temperature?: number
  attachments?: Array<{ name: string; content: string }>
}): Promise<void> {
  // 1. Create user message
  const userMsg = await MessageV2.create({
    sessionID: input.sessionID,
    type: "user",
    input: input.input,
    attachments: input.attachments
  })
  
  // 2. Initialize assistant message
  const assistantMsg = await MessageV2.create({
    sessionID: input.sessionID,
    type: "assistant",
    parent: userMsg.id
  })
  
  // 3. Process with AI model
  const result = await streamText({
    model: model.language,
    messages: conversationHistory,
    tools: availableTools,
    // ... streaming configuration
  })
  
  // 4. Handle tool calls and responses
  // 5. Update session costs and usage
  // 6. Emit completion events
}
```

### Session States

#### Active Session
- **Processing**: Currently executing AI model or tools
- **Streaming**: Receiving real-time responses
- **Tool Execution**: Running tool commands
- **Waiting**: Idle, ready for new input

#### Session Events

```typescript
export const Event = {
  Updated: Bus.event("session.updated", z.object({
    info: Info
  })),
  
  Deleted: Bus.event("session.deleted", z.object({
    info: Info
  })),
  
  Error: Bus.event("session.error", z.object({
    sessionID: z.string(),
    error: z.any()
  })),
  
  Idle: Bus.event("session.idle", z.object({
    sessionID: z.string()
  }))
}
```

## Storage and Persistence

### Storage Structure

```
session/
├── info/
│   ├── {sessionID}           # Session metadata
│   └── ...
└── message/
    ├── {sessionID}/
    │   ├── {messageID}       # Individual messages
    │   └── ...
    └── ...
```

### Data Persistence

```typescript
// Session persistence
await Storage.set(`session/info/${sessionID}`, sessionInfo)

// Message persistence
await Storage.set(`session/message/${sessionID}/${messageID}`, messageData)

// Batch operations for performance
await Storage.setMany(entries)
```

### Caching Strategy

- **Memory Cache**: Active sessions cached in memory
- **Storage Layer**: Persistent storage for all sessions
- **Lazy Loading**: Messages loaded on demand
- **Cleanup**: Automatic cleanup of old sessions

## Parent-Child Session Relationships

### Child Session Creation

```typescript
// Create child session for task delegation
const childSession = await Session.create({
  title: "Task: Code Analysis",
  parentID: parentSessionID,
  agent: "analyzer",
  model: { providerID: "anthropic", modelID: "claude-3-5-haiku" }
})
```

### Navigation and Management

```typescript
// Get all child sessions
const children = await Session.children(parentSessionID)

// Navigate between sessions
export async function children(sessionID: string): Promise<Info[]> {
  const sessions = await list()
  return sessions.filter(s => s.parentID === sessionID)
}

// Get session hierarchy
export async function hierarchy(sessionID: string): Promise<{
  parent?: Info
  current: Info
  children: Info[]
}> {
  const current = await get(sessionID)
  const parent = current.parentID ? await get(current.parentID) : undefined
  const children = await children(sessionID)
  
  return { parent, current, children }
}
```

### Use Cases

#### Task Delegation
```typescript
// Delegate specific tasks to child sessions
const analysisSession = await createChildSession({
  parentID: mainSessionID,
  agent: "analyzer",
  task: "code_analysis"
})

const implementationSession = await createChildSession({
  parentID: mainSessionID,
  agent: "developer", 
  task: "feature_implementation"
})
```

#### Background Processing
```typescript
// Long-running tasks in background
const backgroundSession = await createChildSession({
  parentID: mainSessionID,
  agent: "processor",
  task: "data_processing"
})
```

## Real-time Updates and Events

### Event-Driven Architecture

```typescript
// Subscribe to session events
Bus.subscribe(Session.Event.Updated, async (payload) => {
  console.log("Session updated:", payload.info.id)
  // Update UI, sync state, trigger hooks
})

Bus.subscribe(Session.Event.Idle, async (payload) => {
  console.log("Session idle:", payload.sessionID)
  // Trigger completion hooks, auto-save, cleanup
})

// Message events
Bus.subscribe(MessageV2.Event.Updated, async (payload) => {
  // Real-time message updates
})

Bus.subscribe(MessageV2.Event.PartUpdated, async (payload) => {
  // Tool execution progress
})
```

### Streaming Updates

```typescript
// Real-time streaming of assistant responses
const stream = streamText({
  model: languageModel,
  messages: history,
  onChunk: (chunk) => {
    // Update message content in real-time
    Bus.publish(MessageV2.Event.PartUpdated, {
      sessionID,
      messageID,
      content: chunk.text
    })
  }
})
```

## Sharing and Collaboration

### Session Sharing

```typescript
export async function share(sessionID: string): Promise<string> {
  const session = await get(sessionID)
  const shareURL = await Share.create({
    sessionID,
    title: session.title,
    content: await exportSession(sessionID)
  })
  
  // Update session with share information
  await update(sessionID, {
    share: { url: shareURL }
  })
  
  return shareURL
}

export async function unshare(sessionID: string): Promise<void> {
  const session = await get(sessionID)
  if (session.share) {
    await Share.remove(session.share.url)
    await update(sessionID, {
      share: undefined
    })
  }
}
```

### Export and Import

```typescript
// Export session for sharing or backup
export async function exportSession(sessionID: string): Promise<{
  session: Info
  messages: MessageV2.Info[]
  metadata: any
}> {
  const session = await get(sessionID)
  const messages = await MessageV2.list(sessionID)
  
  return {
    session,
    messages,
    metadata: {
      exportTime: Date.now(),
      version: Installation.info.version
    }
  }
}

// Import session from external source
export async function importSession(data: ExportedSession): Promise<string> {
  const newSessionID = ulid()
  
  // Create session with imported data
  const session = await create({
    ...data.session,
    id: newSessionID
  })
  
  // Import messages
  for (const message of data.messages) {
    await MessageV2.create({
      ...message,
      sessionID: newSessionID
    })
  }
  
  return newSessionID
}
```

## Cost and Usage Tracking

### Token Usage Monitoring

```typescript
// Update session usage after each interaction
export async function updateUsage(
  sessionID: string, 
  usage: LanguageModelUsage,
  cost: { input: number; output: number; cache?: number }
): Promise<void> {
  const session = await get(sessionID)
  
  const updatedSession = {
    ...session,
    usage: {
      input: session.usage.input + usage.promptTokens,
      output: session.usage.output + usage.completionTokens,
      cache: {
        read: (session.usage.cache?.read ?? 0) + (usage.cachedPromptTokens ?? 0),
        write: (session.usage.cache?.write ?? 0) + (usage.cacheCreationInputTokens ?? 0)
      }
    },
    cost: {
      input: session.cost.input + cost.input,
      output: session.cost.output + cost.output,
      cache: (session.cost.cache ?? 0) + (cost.cache ?? 0)
    },
    time: {
      ...session.time,
      updated: Date.now()
    }
  }
  
  await update(sessionID, updatedSession)
}
```

### Cost Calculation

```typescript
// Calculate costs based on model pricing
function calculateCost(
  usage: LanguageModelUsage,
  model: ModelsDev.Model
): { input: number; output: number; cache?: number } {
  const inputCost = new Decimal(usage.promptTokens)
    .mul(model.cost.input)
    .div(1_000_000)
    .toNumber()
    
  const outputCost = new Decimal(usage.completionTokens)
    .mul(model.cost.output)
    .div(1_000_000)
    .toNumber()
    
  const cacheCost = usage.cachedPromptTokens
    ? new Decimal(usage.cachedPromptTokens)
        .mul(model.cost.cache_read ?? 0)
        .div(1_000_000)
        .toNumber()
    : 0
    
  return { input: inputCost, output: outputCost, cache: cacheCost }
}
```

## Session Management Operations

### CRUD Operations

```typescript
// Create new session
const session = await Session.create({
  title: "New Analysis Session",
  agent: "analyzer"
})

// Read session
const session = await Session.get(sessionID)

// Update session
await Session.update(sessionID, {
  title: "Updated Title",
  agent: "developer"
})

// Delete session (and all children)
await Session.remove(sessionID)
```

### Batch Operations

```typescript
// List all sessions
const sessions = await Session.list()

// List user sessions (non-child)
const userSessions = sessions.filter(s => !s.parentID)

// Search sessions
const searchResults = await Session.search({
  query: "authentication",
  agent: "security",
  timeRange: { start: Date.now() - 86400000, end: Date.now() }
})
```

### Session Cleanup

```typescript
// Clean up old sessions
export async function cleanup(options: {
  olderThan?: number  // Timestamp
  maxSessions?: number
  keepShared?: boolean
}): Promise<number> {
  const sessions = await list()
  let removed = 0
  
  for (const session of sessions) {
    if (options.keepShared && session.share) continue
    if (options.olderThan && session.time.updated > options.olderThan) continue
    
    await remove(session.id)
    removed++
  }
  
  return removed
}
```

## Integration with Tools and Agents

### Tool Execution Context

```typescript
// Provide session context to tools
const toolContext: Tool.Context = {
  sessionID: session.id,
  messageID: message.id,
  agent: session.agent,
  callID: toolCall.toolCallId,
  abort: abortSignal,
  metadata: (data) => updateToolMetadata(toolCall.toolCallId, data)
}

// Execute tool with context
const result = await tool.execute(args, toolContext)
```

### Agent Integration

```typescript
// Agent-specific session behavior
const agent = await Agent.get(session.agent)

// Apply agent-specific settings
const chatParams = {
  temperature: agent.temperature,
  topP: agent.topP,
  systemPrompt: agent.systemPrompt,
  tools: agent.enabledTools
}
```

## Performance Optimization

### Memory Management

```typescript
// Session state management
const state = App.state("session", () => ({
  sessions: new Map<string, Info>(),
  queued: new Map<string, QueuedMessage[]>(),
  abortControllers: new Map<string, AbortController>()
}))

// Lazy loading of messages
export async function getMessages(sessionID: string, limit?: number): Promise<MessageV2.Info[]> {
  return MessageV2.list(sessionID, limit)
}
```

### Streaming Optimization

```typescript
// Efficient streaming with backpressure handling
const stream = streamText({
  model: languageModel,
  onChunk: async (chunk) => {
    // Batch updates to reduce event frequency
    await throttledUpdate(chunk)
  },
  experimental_telemetry: {
    isEnabled: true,
    functionId: "opencode-chat"
  }
})
```

### Storage Optimization

```typescript
// Efficient storage patterns
export async function compactSession(sessionID: string): Promise<void> {
  const messages = await MessageV2.list(sessionID)
  
  // Remove intermediate tool results, keep only final outputs
  const compacted = messages.filter(msg => 
    msg.type === "user" || 
    (msg.type === "assistant" && msg.output)
  )
  
  // Update storage with compacted version
  await Storage.setMany(
    compacted.map(msg => [`session/message/${sessionID}/${msg.id}`, msg])
  )
}
```

## Error Handling and Recovery

### Error Management

```typescript
// Session-level error handling
try {
  await Session.chat(chatInput)
} catch (error) {
  if (error instanceof LoadAPIKeyError) {
    Bus.publish(Session.Event.Error, {
      sessionID: chatInput.sessionID,
      error: new Message.AuthError({
        providerID: chatInput.providerID,
        message: "API key required"
      })
    })
  } else {
    // Handle other errors
    Bus.publish(Session.Event.Error, {
      sessionID: chatInput.sessionID,
      error
    })
  }
}
```

### Recovery Mechanisms

```typescript
// Session recovery after crash
export async function recoverSession(sessionID: string): Promise<void> {
  const session = await get(sessionID)
  const messages = await MessageV2.list(sessionID)
  
  // Find incomplete messages
  const incompleteMessage = messages.find(msg => 
    msg.type === "assistant" && !msg.output
  )
  
  if (incompleteMessage) {
    // Resume from last complete state
    await MessageV2.remove(sessionID, incompleteMessage.id)
  }
  
  // Reset session state
  abort(sessionID)
  Bus.publish(Event.Updated, { info: session })
}
```

## Best Practices

### Session Organization
- **Clear Titles**: Use descriptive session titles
- **Agent Selection**: Choose appropriate agents for tasks
- **Child Sessions**: Use child sessions for complex workflows
- **Regular Cleanup**: Remove old sessions to maintain performance

### Cost Management
- **Model Selection**: Use appropriate models for task complexity
- **Token Optimization**: Monitor and optimize token usage
- **Caching**: Leverage caching for repeated prompts
- **Usage Tracking**: Monitor costs across sessions

### Performance
- **Lazy Loading**: Load messages only when needed
- **Streaming**: Use streaming for real-time updates
- **Batching**: Batch operations for efficiency
- **Memory Management**: Clean up inactive sessions