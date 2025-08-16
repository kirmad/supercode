# Tools System

## Overview

OpenCode provides a comprehensive tools system that enables the AI agent to interact with files, execute commands, and perform various development tasks. The tools are designed to be provider-agnostic and adapt to different AI model capabilities.

## File Locations

### Core Tool System
- **Registry**: `packages/opencode/src/tool/registry.ts`
- **Base Tool Interface**: `packages/opencode/src/tool/tool.ts`
- **Individual Tools**: `packages/opencode/src/tool/*.ts`

### Tool Descriptions
Each tool has an associated `.txt` file containing detailed usage instructions:
- **Example**: `packages/opencode/src/tool/bash.txt`

## Available Tools

### File System Tools

#### Read Tool (`read.ts`)
- **Purpose**: Read file contents with optional line ranges
- **Parameters**: file_path, offset, limit
- **Features**: Handles text files, images, and binary files
- **Security**: Sandboxed to project directory

#### Write Tool (`write.ts`)
- **Purpose**: Create or overwrite files
- **Parameters**: file_path, content
- **Features**: Atomic writes, backup creation
- **Security**: Requires edit permissions

#### Edit Tool (`edit.ts`)
- **Purpose**: Make precise edits to existing files
- **Parameters**: file_path, old_string, new_string, replace_all
- **Features**: String replacement with validation
- **Security**: Validates changes before applying

#### List Tool (`ls.ts`)
- **Purpose**: List directory contents
- **Parameters**: path, ignore patterns
- **Features**: Recursive listing, pattern filtering
- **Output**: Structured directory information

### Search Tools

#### Grep Tool (`grep.ts`)
- **Purpose**: Search text patterns in files
- **Parameters**: pattern, path, glob, case_sensitive
- **Features**: Regex support, context lines, file filtering
- **Backend**: Uses ripgrep for performance

#### Glob Tool (`glob.ts`)
- **Purpose**: Find files matching patterns
- **Parameters**: pattern, path
- **Features**: Fast file discovery, glob patterns
- **Performance**: Optimized for large codebases

### Execution Tools

#### Bash Tool (`bash.ts`)
- **Purpose**: Execute shell commands
- **Parameters**: command, timeout
- **Features**: Persistent sessions, output capture, security parsing
- **Security**: Command validation, timeout limits
- **Limits**: 30,000 character output, 10-minute timeout

#### Task Tool (`task.ts`)
- **Purpose**: Delegate complex tasks to sub-agents
- **Parameters**: description, subagent_type, prompt
- **Features**: Specialized agent routing, parallel execution
- **Integration**: Connects with agent system

### Development Tools

#### Todo Tools (`todo.ts`)
- **TodoWrite**: Create and manage task lists
- **TodoRead**: Read current task status
- **Features**: Progress tracking, state management
- **Integration**: Works with session management

#### WebFetch Tool (`webfetch.ts`)
- **Purpose**: Fetch and process web content
- **Parameters**: url, prompt
- **Features**: HTML to markdown conversion, AI processing
- **Security**: URL validation, content sanitization

### Advanced Tools

#### Patch Tool (`patch.ts`)
- **Purpose**: Apply git-style patches
- **Parameters**: patch_content, target_path
- **Features**: Unified diff format, conflict resolution
- **Status**: Disabled by default

#### LSP Tools (`lsp-*.ts`)
- **LSP Diagnostics**: Get code diagnostics
- **LSP Hover**: Get symbol information
- **Integration**: Language Server Protocol support

## Tool Architecture

### Base Tool Interface

```typescript
// packages/opencode/src/tool/tool.ts
export namespace Tool {
  export interface Info<Parameters, Metadata> {
    id: string
    init: () => Promise<{
      description: string
      parameters: Parameters
      execute(args, ctx): Promise<{
        title: string
        metadata: Metadata
        output: string
      }>
    }>
  }
}
```

### Tool Definition Pattern

Each tool follows a consistent pattern:

```typescript
// Example: bash.ts
export const BashTool = Tool.define("bash", {
  description: DESCRIPTION,  // From bash.txt
  parameters: z.object({
    command: z.string().describe("The command to execute"),
    timeout: z.number().optional()
  }),
  async execute(args, ctx) {
    // Tool implementation
    return {
      title: "Command executed",
      metadata: { exitCode: 0 },
      output: "Command output..."
    }
  }
})
```

## Tool Registry

### Registration System

```typescript
// packages/opencode/src/tool/registry.ts
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
```

### Provider Adaptation

The registry adapts tool schemas for different AI providers:

#### OpenAI/Azure Adaptation
```typescript
if (providerID === "openai") {
  return result.map((t) => ({
    ...t,
    parameters: optionalToNullable(t.parameters),
  }))
}
```

#### Google Gemini Adaptation
```typescript
if (providerID === "google") {
  return result.map((t) => ({
    ...t,
    parameters: sanitizeGeminiParameters(t.parameters),
  }))
}
```

### Permission-Based Tool Enabling

Tools are enabled/disabled based on permissions:

```typescript
export async function enabled(
  _providerID: string,
  modelID: string,
  agent: Agent.Info,
): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = {}
  
  // Edit permission controls
  if (agent.permission.edit === "deny") {
    result["edit"] = false
    result["patch"] = false
    result["write"] = false
  }
  
  // Bash permission controls
  if (agent.permission.bash["*"] === "deny") {
    result["bash"] = false
  }
  
  // Model-specific disabling
  if (modelID.includes("qwen")) {
    result["todowrite"] = false
    result["todoread"] = false
  }
  
  return result
}
```

## Security Framework

### Permission System

Tools respect a comprehensive permission system:

```typescript
// Example permission checks
export namespace Permission {
  export interface Config {
    edit: "allow" | "deny"
    bash: Record<string, "allow" | "deny">
    webfetch: "allow" | "deny"
  }
}
```

### Command Validation

The Bash tool includes sophisticated command parsing:

```typescript
// Tree-sitter based parsing for security
const parser = lazy(async () => {
  const { default: Parser } = await import("tree-sitter")
  const Bash = await import("tree-sitter-bash")
  const p = new Parser()
  p.setLanguage(Bash.language)
  return p
})
```

### Sandboxing

- **File Operations**: Limited to project directory
- **Command Execution**: Timeout limits and output size restrictions
- **Web Requests**: URL validation and content sanitization

## Tool Context

### Execution Context

Each tool receives rich context:

```typescript
export type Context = {
  sessionID: string
  messageID: string
  agent: string
  callID?: string
  abort: AbortSignal
  extra?: { [key: string]: any }
  metadata(input: { title?: string; metadata?: any }): void
}
```

### Metadata System

Tools can provide structured metadata:

```typescript
// Example metadata from bash tool
{
  title: "Command executed successfully",
  metadata: {
    exitCode: 0,
    duration: 1500,
    command: "npm test"
  },
  output: "Test results..."
}
```

## Tool Development

### Creating a New Tool

1. **Define Tool File**:
   ```typescript
   // packages/opencode/src/tool/my-tool.ts
   import { z } from "zod"
   import { Tool } from "./tool"
   import DESCRIPTION from "./my-tool.txt"
   
   export const MyTool = Tool.define("my-tool", {
     description: DESCRIPTION,
     parameters: z.object({
       input: z.string(),
       options: z.record(z.any()).optional()
     }),
     async execute(args, ctx) {
       // Implementation
       return {
         title: "Task completed",
         metadata: { status: "success" },
         output: "Result..."
       }
     }
   })
   ```

2. **Create Description File**:
   ```txt
   # packages/opencode/src/tool/my-tool.txt
   Detailed description of what this tool does and how to use it.
   
   Parameters:
   - input: Description of input parameter
   - options: Optional configuration
   
   Usage examples and best practices...
   ```

3. **Register Tool**:
   ```typescript
   // packages/opencode/src/tool/registry.ts
   import { MyTool } from "./my-tool"
   
   const ALL = [
     // ... existing tools
     MyTool,
   ]
   ```

### Best Practices

#### Parameter Design
- **Clear Types**: Use Zod for strong typing
- **Good Descriptions**: Provide helpful parameter descriptions
- **Optional Parameters**: Mark non-required parameters as optional
- **Validation**: Include parameter validation logic

#### Error Handling
- **Graceful Failures**: Return meaningful error messages
- **Timeout Handling**: Respect timeout limits
- **Resource Cleanup**: Clean up resources on abort
- **Progress Updates**: Use metadata for progress indication

#### Security Considerations
- **Input Validation**: Validate all parameters
- **Path Traversal**: Prevent directory traversal attacks
- **Command Injection**: Sanitize command inputs
- **Resource Limits**: Implement appropriate limits

## Integration Points

### Agent Integration

Tools are integrated with the agent system:

```typescript
// packages/opencode/src/agent/agent.ts
export class Agent {
  async execute(toolName: string, parameters: any) {
    const tool = this.toolRegistry.get(toolName)
    return await tool.execute(parameters, this.context)
  }
}
```

### Session Integration

Tools participate in session management:

```typescript
// packages/opencode/src/session/index.ts
export class Session {
  async executeTool(toolCall: ToolCall) {
    const tool = this.toolRegistry.get(toolCall.name)
    const result = await tool.execute(toolCall.parameters, this.context)
    this.recordToolExecution(toolCall, result)
    return result
  }
}
```

### Permission Integration

Tools check permissions before execution:

```typescript
// packages/opencode/src/permission/index.ts
export function canExecuteTool(
  agent: Agent.Info,
  toolName: string
): boolean {
  return this.permissionSystem.check(agent, toolName)
}
```

## Performance Optimization

### Output Limits
- **Bash Tool**: 30,000 character limit
- **File Tools**: Reasonable size limits
- **Search Tools**: Result count limits

### Timeout Management
- **Default Timeout**: 2 minutes for bash commands
- **Maximum Timeout**: 10 minutes for long operations
- **Abort Handling**: Graceful cancellation support

### Caching Strategy
- **Tool Schemas**: Cached per provider
- **Permission Checks**: Cached per session
- **File System Operations**: Minimal caching for consistency

## Debugging and Monitoring

### Logging
Each tool includes comprehensive logging:

```typescript
const log = Log.create({ service: "tool-name" })

log.info("Tool execution started", { parameters })
log.debug("Processing step", { step, data })
log.error("Tool execution failed", { error, context })
```

### Metrics
- **Execution Times**: Track tool performance
- **Success Rates**: Monitor tool reliability
- **Usage Patterns**: Analyze tool adoption
- **Error Rates**: Track failure modes

### Error Reporting
- **Structured Errors**: Consistent error format
- **Context Information**: Rich debugging context
- **Stack Traces**: Full error traces for debugging
- **User-Friendly Messages**: Clear error explanations