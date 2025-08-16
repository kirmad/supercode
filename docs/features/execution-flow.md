# OpenCode Execution Flow: From User Input to Agent Completion

## Overview

This document provides a comprehensive, step-by-step technical trace of OpenCode's execution flow from the moment a user types a command until the AI agent completes its response. Every major code path, file interaction, and system component is documented with specific file references and code examples.

## Complete Execution Flow Diagram

```
User Input → CLI Parser → Session Manager → Prompt Builder → AI Provider → Tool Registry → Permission System → Streaming Processor → Response Output
     ↓            ↓            ↓              ↓              ↓              ↓                 ↓                    ↓                  ↓
[Terminal]   [run.ts]    [index.ts]      [system.ts]   [provider.ts]  [registry.ts]    [permission/]        [processor]        [UI Output]
```

## Phase 1: CLI Command Entry and Parsing

### User Command Initiation
**File**: `packages/opencode/src/cli/cmd/run.ts`

When a user types `opencode run "help me debug this error"`, the execution begins:

```typescript
// packages/opencode/src/cli/cmd/run.ts:62-193
export const RunCommand = cmd({
  command: "run [message..]",
  describe: "run opencode with a message",
  handler: async (args) => {
    // 1. Parse message from command line arguments
    let message = args.message.join(" ")
    
    // 2. Read from stdin if piped input
    if (!process.stdin.isTTY) message += "\n" + (await Bun.stdin.text())
    
    // 3. Bootstrap application environment
    await bootstrap({ cwd: process.cwd() }, async () => {
      // Execution continues inside bootstrap context...
    })
  }
})
```

### Command Line Argument Processing

The CLI parser extracts several key parameters:

```typescript
// packages/opencode/src/cli/cmd/run.ts:68-80
const session = await (async () => {
  // Option 1: Continue last session
  if (args.continue) {
    const list = Session.list()
    const first = await list.next()
    await list.return()
    if (first.done) return
    return first.value
  }
  
  // Option 2: Continue specific session by ID
  if (args.session) return Session.get(args.session)
  
  // Option 3: Create new session
  return Session.create()
})()
```

### Model and Agent Selection

```typescript
// packages/opencode/src/cli/cmd/run.ts:101-112
const agent = await (async () => {
  if (args.agent) return Agent.get(args.agent)
  const build = Agent.get("build")
  if (build) return build
  return Agent.list().then((x) => x[0])
})()

const { providerID, modelID } = await (async () => {
  if (args.model) return Provider.parseModel(args.model)
  if (agent.model) return agent.model
  return await Provider.defaultModel()
})()
```

## Phase 2: Session Initialization and Context Setup

### Session Creation or Retrieval
**File**: `packages/opencode/src/session/index.ts`

When a new session is created:

```typescript
// packages/opencode/src/session/index.ts:51-85
export async function create(input?: {
  title?: string
  parentID?: string
  agent?: string
  model?: { providerID: string; modelID: string }
}): Promise<Info> {
  const session: Info = {
    id: ulid(),                                    // Unique session identifier
    parentID: input?.parentID,                     // Parent session for hierarchy
    title: input?.title ?? createDefaultTitle(),   // Human-readable title
    version: Installation.info.version,            // OpenCode version
    time: {
      created: Date.now(),
      updated: Date.now()
    },
    agent: input?.agent ?? config.agent ?? "claude",
    model: input?.model ?? await Provider.defaultModel(),
    cost: { input: 0, output: 0, cache: 0 },
    usage: { input: 0, output: 0, cache: { read: 0, write: 0 } }
  }
  
  // Persist session to storage
  await Storage.set(`session/info/${session.id}`, session)
  
  // Publish session creation event
  Bus.publish(Event.Updated, { info: session })
  
  return session
}
```

### Event Listener Setup for Real-time Updates

```typescript
// packages/opencode/src/cli/cmd/run.ts:123-148
Bus.subscribe(MessageV2.Event.PartUpdated, async (evt) => {
  if (evt.properties.part.sessionID !== session.id) return
  const part = evt.properties.part
  
  // Handle tool execution events
  if (part.type === "tool" && part.state.status === "completed") {
    const [tool, color] = TOOL[part.tool] ?? [part.tool, UI.Style.TEXT_INFO_BOLD]
    const title = part.state.title || JSON.stringify(part.state.input)
    printEvent(color, tool, title)
  }
  
  // Handle streaming text updates
  if (part.type === "text") {
    text = part.text
    if (part.time?.end) {
      UI.empty()
      UI.println(UI.markdown(text))
      UI.empty()
      text = ""
    }
  }
})
```

## Phase 3: Message Preparation and Prompt Building

### User Message Creation
**File**: `packages/opencode/src/session/index.ts:441-610`

```typescript
// Session.chat() begins message processing
const userMsg: MessageV2.Info = {
  id: input.messageID ?? Identifier.ascending("message"),
  role: "user",
  sessionID: input.sessionID,
  time: {
    created: Date.now(),
  },
}

// Process user input parts (text, files, attachments)
const userParts = await Promise.all(
  input.parts.map(async (part): Promise<MessageV2.Part[]> => {
    if (part.type === "file") {
      // Handle file attachments with Read tool integration
      const result = await ReadTool.init().then((t) =>
        t.execute(args, {
          sessionID: input.sessionID,
          abort: new AbortController().signal,
          agent: input.agent!,
          messageID: userMsg.id,
          extra: { bypassCwdCheck: true },
          metadata: async () => {},
        }),
      )
      // Create synthetic parts showing tool execution
      return [
        {
          id: Identifier.ascending("part"),
          messageID: userMsg.id,
          sessionID: input.sessionID,
          type: "text",
          synthetic: true,
          text: `Called the Read tool with the following input: ${JSON.stringify(args)}`,
        },
        {
          id: Identifier.ascending("part"),
          messageID: userMsg.id,
          sessionID: input.sessionID,
          type: "text",
          synthetic: true,
          text: result.output,
        }
      ]
    }
    // Handle other part types...
  })
)
```

### System Prompt Construction
**File**: `packages/opencode/src/session/system.ts`

The system prompt is built from multiple sources:

```typescript
// packages/opencode/src/session/index.ts:730-741
system.push(
  ...(() => {
    if (input.system) return [input.system]           // Custom system prompt
    if (agent.prompt) return [agent.prompt]           // Agent-specific prompt
    return SystemPrompt.provider(input.modelID)       // Model-specific prompt
  })(),
)
system.push(...(await SystemPrompt.environment()))    // Environment context
system.push(...(await SystemPrompt.custom()))         // Custom instructions

// Optimize for caching (max 2 system messages)
const [first, ...rest] = system
system = [first, rest.join("\n")]
```

#### Provider-Specific Prompts
```typescript
// packages/opencode/src/session/system.ts:23-29
export function provider(modelID: string) {
  if (modelID.includes("gpt-5")) return [PROMPT_COPILOT_GPT_5]
  if (modelID.includes("gpt-") || modelID.includes("o1") || modelID.includes("o3")) return [PROMPT_BEAST]
  if (modelID.includes("gemini-")) return [PROMPT_GEMINI]
  if (modelID.includes("claude")) return [PROMPT_ANTHROPIC]
  return [PROMPT_ANTHROPIC_WITHOUT_TODO]
}
```

#### Environment Context Injection
```typescript
// packages/opencode/src/session/system.ts:31-55
export async function environment() {
  const app = App.info()
  return [
    [
      `Here is some useful information about the environment you are running in:`,
      `<env>`,
      `  Working directory: ${app.path.cwd}`,
      `  Is directory a git repo: ${app.git ? "yes" : "no"}`,
      `  Platform: ${process.platform}`,
      `  Today's date: ${new Date().toDateString()}`,
      `</env>`,
      `<project>`,
      `  ${app.git ? await Ripgrep.tree({ cwd: app.path.cwd, limit: 200 }) : ""}`,
      `</project>`,
    ].join("\n"),
  ]
}
```

#### Custom Instructions Loading
```typescript
// packages/opencode/src/session/system.ts:67-99
export async function custom() {
  const { cwd, root } = App.info().path
  const paths = new Set<string>()
  
  // Look for local rule files (CLAUDE.md, AGENTS.md, CONTEXT.md)
  for (const localRuleFile of LOCAL_RULE_FILES) {
    const matches = await Filesystem.findUp(localRuleFile, cwd, root)
    if (matches.length > 0) {
      matches.forEach((path) => paths.add(path))
      break
    }
  }
  
  // Look for global rule files (~/.claude/CLAUDE.md)
  for (const globalRuleFile of GLOBAL_RULE_FILES) {
    if (await Bun.file(globalRuleFile).exists()) {
      paths.add(globalRuleFile)
      break
    }
  }
  
  // Process configuration-specified instructions
  if (config.instructions) {
    for (let instruction of config.instructions) {
      // Handle relative paths and glob patterns
      // ... (file discovery and loading logic)
    }
  }
}
```

## Phase 4: Tool Registration and Configuration

### Tool Registry Initialization
**File**: `packages/opencode/src/tool/registry.ts`

```typescript
// All available tools are registered
const ALL = [
  InvalidTool,
  BashTool,
  EditTool,
  WebFetchTool,
  GlobTool,
  GrepTool,
  ListTool,
  PatchTool,
  ReadTool,
  WriteTool,
  TodoWriteTool,
  TodoReadTool,
  TaskTool,
]

export async function tools(providerID: string, _modelID: string) {
  const result = await Promise.all(
    ALL.map(async (t) => ({
      id: t.id,
      ...(await t.init()),
    })),
  )
  
  // Provider-specific tool adaptations
  if (providerID === "openai") {
    return result.map((t) => ({
      ...t,
      parameters: optionalToNullable(t.parameters),
    }))
  }
  
  if (providerID === "google") {
    return result.map((t) => ({
      ...t,
      parameters: sanitizeGeminiParameters(t.parameters),
    }))
  }
  
  return result
}
```

### Agent-Specific Tool Filtering
```typescript
// packages/opencode/src/tool/registry.ts:69-95
export async function enabled(
  _providerID: string,
  modelID: string,
  agent: Agent.Info,
): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = {}
  result["patch"] = false  // Patch tool disabled by default
  
  // Respect agent permission settings
  if (agent.permission.edit === "deny") {
    result["edit"] = false
    result["patch"] = false
    result["write"] = false
  }
  
  if (agent.permission.bash["*"] === "deny" && Object.keys(agent.permission.bash).length === 1) {
    result["bash"] = false
  }
  
  if (agent.permission.webfetch === "deny") {
    result["webfetch"] = false
  }
  
  // Model-specific tool filtering
  if (modelID.includes("qwen")) {
    result["todowrite"] = false
    result["todoread"] = false
  }
  
  return result
}
```

### Tool Context and Wrapping
**File**: `packages/opencode/src/session/index.ts:780-865`

Each tool is wrapped with context and permission handling:

```typescript
for (const [key, options] of Object.entries(enabledTools)) {
  if (options === false) continue
  
  const tool = await ToolRegistry.get(key)
  if (!tool) continue
  
  const item: AITool = {
    description: tool.description,
    parameters: tool.parameters,
    async execute(input) {
      // Execute tool with full context
      const result = await tool.execute(input as any, {
        sessionID: input.sessionID,
        messageID: assistantMsg.id,
        callID: options.toolCallId,
        abort: abort.signal,
        agent: agent.name,
        metadata: async (val) => {
          const match = processor.partFromToolCall(options.toolCallId)
          if (match && match.state.status === "running") {
            await updatePart({
              ...match,
              state: { ...match.state, metadata: val },
            })
          }
        },
      })
      
      return { output: result.output }
    }
  }
  
  tools[key] = item
}
```

## Phase 5: AI Provider Integration and Model Invocation

### Provider Loading and Configuration
**File**: `packages/opencode/src/provider/provider.ts`

```typescript
// Custom loaders for different AI providers
const CUSTOM_LOADERS: Record<string, CustomLoader> = {
  async anthropic() {
    return {
      autoload: false,
      options: {
        headers: {
          "anthropic-beta": "claude-code-20250219,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14",
        },
      },
    }
  },
  
  openai: async () => {
    return {
      autoload: false,
      async getModel(sdk: any, modelID: string) {
        return sdk.responses(modelID)  // Enable response format for OpenAI
      },
      options: {},
    }
  },
}
```

### Model Parameter Configuration
```typescript
// packages/opencode/src/session/index.ts:867-885
const params = await Plugin.trigger(
  "chat.params",
  {
    model: model.info,
    provider: await Provider.getProvider(input.providerID),
    message: userMsg,
  },
  {
    temperature: model.info.temperature
      ? (agent.temperature ?? ProviderTransform.temperature(input.providerID, input.modelID))
      : undefined,
    topP: agent.topP ?? ProviderTransform.topP(input.providerID, input.modelID),
    options: {
      ...ProviderTransform.options(input.providerID, input.modelID, input.sessionID),
      ...model.info.options,
      ...agent.options,
    },
  },
)
```

### Stream Text Invocation
```typescript
// packages/opencode/src/session/index.ts:886-993
const stream = streamText({
  onError(e) {
    log.error("streamText error", { error: e })
  },
  
  // Dynamic message preparation for multi-turn conversations
  async prepareStep({ messages }) {
    const queue = (state().queued.get(input.sessionID) ?? []).filter((x) => !x.processed)
    if (queue.length) {
      for (const item of queue) {
        if (item.processed) continue
        messages.push(...MessageV2.toModelMessage([{ info: item.message, parts: item.parts }]))
        item.processed = true
      }
    }
    return { messages }
  },
  
  // Tool call repair for malformed calls
  async experimental_repairToolCall(input) {
    return {
      ...input.toolCall,
      input: JSON.stringify({
        tool: input.toolCall.toolName,
        error: input.error.message,
      }),
      toolName: "invalid",
    }
  },
  
  maxRetries: 3,
  activeTools: Object.keys(tools).filter((x) => x !== "invalid"),
  maxOutputTokens: outputLimit,
  abortSignal: abort.signal,
  
  // Stop conditions
  stopWhen: async ({ steps }) => {
    if (steps.length >= 1000) return true
    if (processor.getShouldStop()) return true
    return false
  },
  
  providerOptions: { [input.providerID]: params.options },
  temperature: params.temperature,
  topP: params.topP,
  
  // Complete message history
  messages: [
    ...system.map((x): ModelMessage => ({ role: "system", content: x })),
    ...MessageV2.toModelMessage(msgs.filter((m) => !(m.info.role === "assistant" && m.info.error))),
  ],
  
  tools: model.info.tool_call === false ? undefined : tools,
  model: wrapLanguageModel({
    model: model.language,
    middleware: [
      {
        async transformParams(args) {
          if (args.type === "stream") {
            args.params.prompt = ProviderTransform.message(args.params.prompt, input.providerID, input.modelID)
          }
          return args.params
        },
      },
    ],
  }),
})
```

## Phase 6: Streaming Response Processing

### Stream Processor Creation
**File**: `packages/opencode/src/session/index.ts:1138-1149`

```typescript
function createProcessor(assistantMsg: MessageV2.Assistant, model: ModelsDev.Model) {
  const toolcalls: Record<string, MessageV2.ToolPart> = {}
  let snapshot: string | undefined
  let shouldStop = false
  
  return {
    partFromToolCall(toolCallID: string) {
      return toolcalls[toolCallID]
    },
    getShouldStop() {
      return shouldStop
    },
    async process(stream: StreamTextResult<Record<string, AITool>, never>) {
      // Main streaming processing loop...
    }
  }
}
```

### Stream Event Processing Loop
**File**: `packages/opencode/src/session/index.ts:1149-1400`

The processor handles all streaming events in real-time:

```typescript
for await (const value of stream.fullStream) {
  switch (value.type) {
    case "reasoning-start":
      // Create reasoning part for models that show thinking
      reasoningMap[value.id] = {
        id: Identifier.ascending("part"),
        messageID: assistantMsg.id,
        sessionID: assistantMsg.sessionID,
        type: "reasoning",
        text: "",
        time: { start: Date.now() },
      }
      break
      
    case "reasoning-delta":
      // Update reasoning text as it streams
      if (value.id in reasoningMap) {
        const part = reasoningMap[value.id]
        part.text += value.text
        if (part.text) await updatePart(part)
      }
      break
      
    case "tool-input-start":
      // Create tool part when tool execution begins
      const part = await updatePart({
        id: toolcalls[value.id]?.id ?? Identifier.ascending("part"),
        messageID: assistantMsg.id,
        sessionID: assistantMsg.sessionID,
        type: "tool",
        tool: value.toolName,
        callID: value.id,
        state: { status: "pending" },
      })
      toolcalls[value.id] = part as MessageV2.ToolPart
      break
      
    case "tool-call":
      // Update tool part with input parameters
      const match = toolcalls[value.toolCallId]
      if (match) {
        const part = await updatePart({
          ...match,
          tool: value.toolName,
          state: {
            status: "running",
            input: value.input,
            time: { start: Date.now() },
          },
        })
        toolcalls[value.toolCallId] = part as MessageV2.ToolPart
      }
      break
      
    case "tool-result":
      // Update tool part with execution results
      const match = toolcalls[value.toolCallId]
      if (match && match.state.status === "running") {
        await updatePart({
          ...match,
          state: {
            status: "completed",
            input: value.input,
            output: value.output.output,
            metadata: value.output.metadata,
            title: value.output.title,
            time: {
              start: match.state.time.start,
              end: Date.now(),
            },
          },
        })
        delete toolcalls[value.toolCallId]
      }
      break
      
    case "tool-error":
      // Handle tool execution errors
      const match = toolcalls[value.toolCallId]
      if (match && match.state.status === "running") {
        if (value.error instanceof Permission.RejectedError) {
          shouldStop = true  // Stop execution if user rejects permission
        }
        await updatePart({
          ...match,
          state: {
            status: "error",
            input: value.input,
            error: (value.error as any).toString(),
            metadata: value.error instanceof Permission.RejectedError ? value.error.metadata : undefined,
            time: {
              start: match.state.time.start,
              end: Date.now(),
            },
          },
        })
        delete toolcalls[value.toolCallId]
      }
      break
      
    case "text-start":
      // Begin streaming text response
      currentText = {
        id: Identifier.ascending("part"),
        messageID: assistantMsg.id,
        sessionID: assistantMsg.sessionID,
        type: "text",
        text: "",
        time: { start: Date.now() },
      }
      break
      
    case "text-delta":
      // Update streaming text in real-time
      if (currentText) {
        currentText.text += value.text
        if (currentText.text) await updatePart(currentText)
      }
      break
      
    case "text-end":
      // Finalize text response
      if (currentText) {
        currentText.text = currentText.text.trimEnd()
        currentText.time = {
          start: currentText.time.start,
          end: Date.now(),
        }
        await updatePart(currentText)
      }
      currentText = undefined
      break
      
    case "start-step":
      // Track conversation step beginning
      await updatePart({
        id: Identifier.ascending("part"),
        messageID: assistantMsg.id,
        sessionID: assistantMsg.sessionID,
        type: "step-start",
      })
      snapshot = await Snapshot.track()  // Track file system state
      break
      
    case "finish-step":
      // Track conversation step completion with usage metrics
      const usage = getUsage(model, value.usage, value.providerMetadata)
      assistantMsg.cost += usage.cost
      assistantMsg.tokens = usage.tokens
      
      await updatePart({
        id: Identifier.ascending("part"),
        messageID: assistantMsg.id,
        sessionID: assistantMsg.sessionID,
        type: "step-finish",
        tokens: usage.tokens,
        cost: usage.cost,
      })
      
      await updateMessage(assistantMsg)
      
      // Create file system diff if changes detected
      if (snapshot) {
        const patch = await Snapshot.patch(snapshot)
        if (patch.files.length) {
          await updatePart({
            id: Identifier.ascending("part"),
            messageID: assistantMsg.id,
            sessionID: assistantMsg.sessionID,
            type: "patch",
            hash: patch.hash,
            files: patch.files,
          })
        }
        snapshot = undefined
      }
      break
      
    case "finish":
      // Complete the assistant message
      assistantMsg.time.completed = Date.now()
      await updateMessage(assistantMsg)
      break
  }
}
```

## Phase 7: Tool Execution and Permission System

### Tool Execution Context
**File**: `packages/opencode/src/tool/write.ts` (Example)

When a tool is called by the AI, it executes with full context and permission checking:

```typescript
export const WriteTool = Tool.define("write", {
  description: DESCRIPTION,
  parameters: z.object({
    filePath: z.string().describe("The absolute path to the file to write (must be absolute, not relative)"),
    content: z.string().describe("The content to write to the file"),
  }),
  
  async execute(params, ctx) {
    const app = App.info()
    
    // 1. Path validation and security
    const filepath = path.isAbsolute(params.filePath) 
      ? params.filePath 
      : path.join(app.path.cwd, params.filePath)
      
    if (!Filesystem.contains(app.path.cwd, filepath)) {
      throw new Error(`File ${filepath} is not in the current working directory`)
    }
    
    // 2. File existence check and change tracking
    const file = Bun.file(filepath)
    const exists = await file.exists()
    if (exists) await FileTime.assert(ctx.sessionID, filepath)
    
    // 3. Permission system integration
    const agent = await Agent.get(ctx.agent)
    if (agent.permission.edit === "ask") {
      await Permission.ask({
        type: "write",
        sessionID: ctx.sessionID,
        messageID: ctx.messageID,
        callID: ctx.callID,
        title: exists ? "Overwrite this file: " + filepath : "Create new file: " + filepath,
        metadata: {
          filePath: filepath,
          content: params.content,
          exists,
        },
      })
    }
    
    // 4. File operation execution
    await Bun.write(filepath, params.content)
    
    // 5. Event publication for hooks and monitoring
    await Bus.publish(File.Event.Edited, { file: filepath })
    FileTime.read(ctx.sessionID, filepath)
    
    return {
      output: exists 
        ? `Successfully overwrote ${filepath} with ${params.content.length} characters`
        : `Successfully created ${filepath} with ${params.content.length} characters`,
      title: `Write to ${path.basename(filepath)}`,
      metadata: { filepath, exists, size: params.content.length }
    }
  }
})
```

### Permission Request Flow
**File**: `packages/opencode/src/permission/index.ts:71-122`

```typescript
export async function ask(input: {
  type: Info["type"]
  title: Info["title"]
  pattern?: Info["pattern"]
  callID?: Info["callID"]
  sessionID: Info["sessionID"]
  messageID: Info["messageID"]
  metadata: Info["metadata"]
}) {
  const { pending, approved } = state()
  
  // Check if already approved for this pattern/type
  if (approved[input.sessionID]?.[input.pattern ?? input.type]) return
  
  const info: Info = {
    id: Identifier.ascending("permission"),
    type: input.type,
    pattern: input.pattern,
    sessionID: input.sessionID,
    messageID: input.messageID,
    callID: input.callID,
    title: input.title,
    metadata: input.metadata,
    time: { created: Date.now() },
  }
  
  // Plugin hook for automated decisions
  switch (
    await Plugin.trigger("permission.ask", info, { status: "ask" }).then((x) => x.status)
  ) {
    case "deny":
      throw new RejectedError(info.sessionID, info.id, info.callID, info.metadata)
    case "allow":
      return
  }
  
  // Request user permission
  pending[input.sessionID] = pending[input.sessionID] || {}
  return new Promise<void>((resolve, reject) => {
    pending[input.sessionID][info.id] = { info, resolve, reject }
    Bus.publish(Event.Updated, info)  // Notify UI
  })
}
```

### Permission Response Handling
```typescript
export function respond(input: { 
  sessionID: Info["sessionID"]
  permissionID: Info["id"]
  response: Response 
}) {
  const { pending, approved } = state()
  const match = pending[input.sessionID]?.[input.permissionID]
  if (!match) return
  
  delete pending[input.sessionID][input.permissionID]
  
  if (input.response === "reject") {
    match.reject(new RejectedError(input.sessionID, input.permissionID, match.info.callID, match.info.metadata))
    return
  }
  
  match.resolve()
  Bus.publish(Event.Replied, {
    sessionID: input.sessionID,
    permissionID: input.permissionID,
    response: input.response,
  })
  
  // Handle "always" approval
  if (input.response === "always") {
    approved[input.sessionID] = approved[input.sessionID] || {}
    approved[input.sessionID][match.info.pattern ?? match.info.type] = true
    
    // Auto-approve similar pending requests
    for (const item of Object.values(pending[input.sessionID])) {
      if ((item.info.pattern ?? item.info.type) === (match.info.pattern ?? match.info.type)) {
        respond({ 
          sessionID: item.info.sessionID, 
          permissionID: item.info.id, 
          response: input.response 
        })
      }
    }
  }
}
```

## Phase 8: Real-time Updates and Event System

### Event Bus Architecture
**File**: `packages/opencode/src/bus/index.ts`

All components communicate through a centralized event bus:

```typescript
// Event publishing for real-time updates
Bus.publish(MessageV2.Event.PartUpdated, {
  sessionID: assistantMsg.sessionID,
  messageID: assistantMsg.id,
  part: {
    id: part.id,
    type: part.type,
    content: part.content,
    time: part.time
  }
})

// Event subscription for UI updates
Bus.subscribe(MessageV2.Event.PartUpdated, async (evt) => {
  const part = evt.properties.part
  
  // Update UI in real-time based on part type
  if (part.type === "text") {
    UI.updateText(part.content)
  } else if (part.type === "tool") {
    UI.updateTool(part.tool, part.state.status)
  }
})
```

### Message Part Updates
**File**: `packages/opencode/src/session/message-v2.ts`

```typescript
export async function updatePart(part: Part): Promise<Part> {
  // Persist part to storage
  await Storage.set(`session/part/${part.sessionID}/${part.messageID}/${part.id}`, part)
  
  // Publish real-time update
  await Bus.publish(Event.PartUpdated, {
    sessionID: part.sessionID,
    messageID: part.messageID,
    part
  })
  
  return part
}
```

### Session State Updates
```typescript
export async function updateMessage(message: Info): Promise<Info> {
  // Update session statistics
  const session = await Session.get(message.sessionID)
  session.cost.input += message.cost
  session.usage.input += message.tokens.input
  session.usage.output += message.tokens.output
  session.time.updated = Date.now()
  
  // Persist updates
  await Storage.set(`session/info/${session.id}`, session)
  await Storage.set(`session/message/${message.sessionID}/${message.id}`, message)
  
  // Publish events
  await Bus.publish(Session.Event.Updated, { info: session })
  await Bus.publish(MessageV2.Event.Updated, { 
    sessionID: message.sessionID, 
    messageID: message.id, 
    message 
  })
  
  return message
}
```

## Phase 9: Completion and Finalization

### Session Completion
**File**: `packages/opencode/src/session/index.ts:994-1006`

```typescript
// Process stream and handle completion
const result = await processor.process(stream)

// Handle queued messages from multi-turn conversations
const queued = state().queued.get(input.sessionID) ?? []
const unprocessed = queued.find((x) => !x.processed)
if (unprocessed) {
  unprocessed.processed = true
  return chat(unprocessed.input)  // Continue with next queued message
}

// Execute callbacks for completed conversation
for (const item of queued) {
  item.callback(result)
}

// Clean up session state
state().queued.delete(input.sessionID)

return result
```

### Hooks System Execution
**File**: `packages/opencode/src/config/hooks.ts`

After completion, hooks are triggered for automation:

```typescript
// File modification hooks
Bus.subscribe(File.Event.Edited, async (event) => {
  const config = await Config.get()
  const hooks = config.experimental?.hook?.file_edited
  
  if (hooks) {
    for (const hook of hooks) {
      if (hook.pattern && !minimatch(event.properties.file, hook.pattern)) continue
      
      // Execute hook command
      await BunProc.spawn({
        cmd: hook.command.split(' '),
        cwd: App.info().path.cwd,
        env: {
          ...process.env,
          OPENCODE_FILE: event.properties.file,
          OPENCODE_SESSION: sessionID
        }
      })
    }
  }
})

// Session completion hooks
Bus.subscribe(Session.Event.Idle, async (event) => {
  const config = await Config.get()
  const hooks = config.experimental?.hook?.session_completed
  
  if (hooks) {
    for (const hook of hooks) {
      await BunProc.spawn({
        cmd: hook.command.split(' '),
        cwd: App.info().path.cwd,
        env: {
          ...process.env,
          OPENCODE_SESSION: event.properties.sessionID
        }
      })
    }
  }
})
```

### Usage and Cost Tracking
**File**: `packages/opencode/src/session/index.ts:1298-1310`

```typescript
// Calculate and track usage for billing and analytics
const usage = getUsage(model, value.usage, value.providerMetadata)
assistantMsg.cost += usage.cost
assistantMsg.tokens = usage.tokens

// Update session totals
await Session.updateUsage(input.sessionID, usage.tokens, {
  input: usage.cost.input,
  output: usage.cost.output,
  cache: usage.cost.cache
})
```

### CLI Response Output
**File**: `packages/opencode/src/cli/cmd/run.ts:184-191`

```typescript
// Final output handling
const isPiped = !process.stdout.isTTY
if (isPiped) {
  const match = result.parts.findLast((x) => x.type === "text")
  if (match) process.stdout.write(UI.markdown(match.text))
  if (errorMsg) process.stdout.write(errorMsg)
}
UI.empty()
```

## Complete Flow Summary

1. **CLI Entry** (`run.ts`): Parse user command and options
2. **Session Management** (`session/index.ts`): Create/retrieve session, set up event listeners
3. **Message Preparation** (`session/index.ts`): Process user input, handle file attachments
4. **Prompt Building** (`session/system.ts`): Construct system prompts from multiple sources
5. **Tool Registration** (`tool/registry.ts`): Register and filter tools based on agent permissions
6. **Provider Integration** (`provider/provider.ts`): Load AI provider and configure model
7. **Stream Invocation** (`session/index.ts`): Call streamText with complete configuration
8. **Stream Processing** (`session/index.ts`): Handle all streaming events in real-time
9. **Tool Execution** (`tool/*.ts`): Execute tools with permission checks and context
10. **Permission System** (`permission/index.ts`): Handle user consent for operations
11. **Real-time Updates** (`bus/index.ts`, `message-v2.ts`): Publish events for UI updates
12. **Completion** (`session/index.ts`): Finalize message, update costs, trigger hooks
13. **Output** (`run.ts`): Display results to user via CLI

## Key Design Principles

### Event-Driven Architecture
- All components communicate through the event bus
- Real-time updates flow through events
- UI components subscribe to relevant events
- Hooks system responds to completion events

### Security by Design
- All file operations validated against working directory
- Permission system requires user consent
- Tools cannot execute without proper context
- Agent permissions control tool availability

### Provider Agnostic
- Common interface for all AI providers
- Provider-specific adaptations handled transparently
- Model-specific prompt selection
- Tool schema adaptation per provider

### Streaming First
- All responses stream in real-time
- Partial results available immediately
- Tool execution tracked live
- Progress updates throughout execution

### Session Hierarchy
- Parent-child session relationships
- Context inheritance between sessions
- Cost and usage tracking per session
- Clean session state management

This comprehensive execution flow demonstrates OpenCode's sophisticated architecture that balances real-time responsiveness, security, flexibility, and user experience in a cohesive AI coding agent system.