# Custom Commands API Reference

## Overview

This document provides comprehensive API reference for the Custom Commands system, including server endpoints, TypeScript interfaces, Go structures, and integration patterns.

## Server API Endpoints

### Base Configuration

**Base URL**: `http://localhost:3000` (default development server)
**Content-Type**: `application/json`
**Authentication**: Inherits from OpenCode server authentication

### GET /commands/custom

Retrieve all available custom commands.

**Request**:
```http
GET /commands/custom HTTP/1.1
Host: localhost:3000
Accept: application/json
```

**Response**:
```json
{
  "commands": [
    {
      "name": "sc:implement",
      "namespace": "sc", 
      "command": "implement",
      "description": "Implement features with systematic approach",
      "examples": [
        "/sc:implement --think fix auth bug",
        "/sc:implement --iterative add user dashboard"
      ],
      "lastModified": 1703875200000
    }
  ]
}
```

**Response Schema**:
```typescript
interface CustomCommandsResponse {
  commands: Array<{
    name: string          // Full command name (namespace:command)
    namespace: string     // Command namespace
    command: string       // Command name within namespace  
    description?: string  // Optional description from frontmatter
    examples?: string[]   // Usage examples from frontmatter
    lastModified: number  // Unix timestamp of last file modification
  }>
}
```

**Status Codes**:
- `200 OK` - Commands retrieved successfully
- `500 Internal Server Error` - Server error retrieving commands

### GET /commands/custom/:namespace

Retrieve all commands within a specific namespace.

**Parameters**:
- `namespace` (path) - The namespace to filter by (e.g., "sc", "team", "dev")

**Request**:
```http
GET /commands/custom/sc HTTP/1.1
Host: localhost:3000
Accept: application/json
```

**Response**:
```json
{
  "commands": [
    {
      "name": "sc:implement",
      "namespace": "sc",
      "command": "implement", 
      "description": "Implement features with systematic approach",
      "examples": ["/sc:implement --think fix auth bug"],
      "lastModified": 1703875200000
    },
    {
      "name": "sc:analyze",
      "namespace": "sc",
      "command": "analyze",
      "description": "Deep code analysis and review",
      "examples": ["/sc:analyze performance bottlenecks"],
      "lastModified": 1703875300000
    }
  ]
}
```

**Status Codes**:
- `200 OK` - Commands retrieved successfully  
- `404 Not Found` - Namespace not found
- `500 Internal Server Error` - Server error

### GET /commands/custom/:namespace/:command

Retrieve a specific command with full details.

**Parameters**:
- `namespace` (path) - Command namespace
- `command` (path) - Command name (may include colons for nested commands)

**Request**:
```http
GET /commands/custom/sc/implement HTTP/1.1
Host: localhost:3000
Accept: application/json
```

**Response**:
```json
{
  "command": {
    "name": "sc:implement",
    "namespace": "sc",
    "command": "implement",
    "filePath": "/project/.opencode/commands/sc/implement.md",
    "content": "---\ndescription: \"Implement features...\"\n---\n\n# Implementation Command\n...",
    "processedContent": "# Implementation Command\n\nYour implementation instructions...",
    "metadata": {
      "description": "Implement features with systematic approach",
      "args": ["--think", "--iterative", "--type"],
      "examples": [
        "/sc:implement --think fix auth bug",
        "/sc:implement --iterative add user dashboard"
      ]
    },
    "lastModified": 1703875200000,
    "hash": "a1b2c3d4e5f6..."
  }
}
```

**Response Schema**:
```typescript
interface CustomCommandResponse {
  command: {
    name: string                    // Full command name
    namespace: string               // Command namespace
    command: string                 // Command name
    filePath: string                // Absolute path to markdown file
    content: string                 // Raw markdown content including frontmatter
    processedContent: string        // Content with frontmatter removed
    metadata?: {                    // Parsed YAML frontmatter
      description?: string
      args?: string[]
      examples?: string[]
      tags?: string[]
      author?: string
      version?: string
    }
    lastModified: number           // Unix timestamp
    hash: string                   // Content hash for caching
  }
}
```

**Status Codes**:
- `200 OK` - Command retrieved successfully
- `404 Not Found` - Command not found  
- `500 Internal Server Error` - Server error

## TypeScript Interfaces

### Core Types

```typescript
// packages/opencode/src/commands/types.ts

export namespace CustomCommands {
  // Command metadata from YAML frontmatter
  export interface CommandMetadata {
    description?: string    // Brief description
    args?: string[]        // Expected arguments/flags
    examples?: string[]    // Usage examples
    tags?: string[]        // Classification tags
    author?: string        // Command author
    version?: string       // Command version
  }

  // Core command structure
  export interface Command {
    name: string              // Full command name (namespace:command)
    namespace: string         // Command namespace
    command: string          // Command name within namespace
    filePath: string         // Absolute path to markdown file
    content: string          // Raw markdown content
    processedContent: string // Content with frontmatter removed
    metadata?: CommandMetadata
    lastModified: number     // File modification timestamp
    hash: string            // Content hash for caching
  }

  // Registry state
  export interface Registry {
    commands: Map<string, Command>      // Commands by full name
    byNamespace: Map<string, Command[]> // Commands grouped by namespace
    watchers: Map<string, FSWatcher>    // File system watchers
    isInitialized: boolean
  }

  // Command execution context
  export interface ExecutionContext {
    command: Command
    args: string            // User-provided arguments
    originalInput: string   // Original user input
    sessionID: string      // Session identifier
  }

  // Parsed command result
  export interface ParsedCommand {
    isCustomCommand: boolean
    namespace?: string
    command?: string
    args?: string
    originalInput: string
    fullCommand?: string    // namespace:command
  }
}
```

### Registry Interface

```typescript
// packages/opencode/src/commands/registry.ts

export namespace CommandRegistry {
  // Initialize the command registry
  export function initialize(): Promise<void>
  
  // Cleanup resources
  export function cleanup(): Promise<void>
  
  // Get commands directory path
  export function getCommandsDirectory(): string
  
  // Discover commands in directory
  export function discoverCommands(rootDir: string): Promise<void>
  
  // Get specific command
  export function getCommand(namespace: string, command: string): CustomCommands.Command | undefined
  
  // Get all commands
  export function getAllCommands(): CustomCommands.Command[]
  
  // Get commands by namespace
  export function getCommandsByNamespace(namespace: string): CustomCommands.Command[]
  
  // Get all namespaces
  export function getNamespaces(): string[]
  
  // Check if command exists
  export function hasCommand(namespace: string, command: string): boolean
}
```

### Processor Interface

```typescript
// packages/opencode/src/commands/processor.ts

export namespace CommandProcessor {
  // Parse user input for custom commands
  export function parseCommand(input: string): CustomCommands.ParsedCommand
  
  // Generate messages for LLM
  export function generateMessages(
    context: CustomCommands.ExecutionContext
  ): Array<{
    role: "user"
    content: string
    synthetic: boolean
  }>
  
  // Validate command structure
  export function validateCommand(command: CustomCommands.Command): {
    valid: boolean
    errors: string[]
    warnings: string[]
  }
}
```

### Main Commands Interface

```typescript
// packages/opencode/src/commands/index.ts

export namespace Commands {
  // Initialize the commands system
  export function initialize(): Promise<void>
  
  // Cleanup resources
  export function cleanup(): Promise<void>
  
  // Parse command from user input
  export function parseCommand(input: string): CustomCommands.ParsedCommand
  
  // Get specific command
  export function getCommand(namespace: string, command: string): CustomCommands.Command | undefined
  
  // Get all available commands
  export function getAllCommands(): CustomCommands.Command[]
  
  // Get all namespaces
  export function getNamespaces(): string[]
  
  // Execute custom command and generate messages
  export function executeCommand(
    sessionID: string,
    input: string
  ): Promise<Array<{
    role: "user"
    content: string  
    synthetic: boolean
  }> | null>
}
```

## Go Structures (TUI Integration)

### Completion Provider

```go
// packages/tui/internal/completions/customcommands.go

// CustomCommand represents a custom command from the server
type CustomCommand struct {
    Name         string   `json:"name"`
    Namespace    string   `json:"namespace"`
    Command      string   `json:"command"`
    Description  string   `json:"description,omitempty"`
    Examples     []string `json:"examples,omitempty"`
    LastModified int64    `json:"lastModified"`
}

// CustomCommandsResponse is the server response structure
type CustomCommandsResponse struct {
    Commands []CustomCommand `json:"commands"`
}

// CustomCommandCompletionProvider implements CompletionProvider
type CustomCommandCompletionProvider struct {
    app           *app.App
    cachedCommands []CustomCommand
    lastFetch     time.Time
    cacheDuration time.Duration
}

// CompletionProvider interface methods
func (c *CustomCommandCompletionProvider) GetId() string
func (c *CustomCommandCompletionProvider) GetEmptyMessage() string
func (c *CustomCommandCompletionProvider) GetChildEntries(query string) ([]CompletionSuggestion, error)

// Internal methods
func (c *CustomCommandCompletionProvider) fetchCommands() ([]CustomCommand, error)
func (c *CustomCommandCompletionProvider) createCompletionItem(cmd CustomCommand, maxNameWidth int) CompletionSuggestion
```

### Integration with Editor

```go
// packages/tui/internal/components/chat/editor.go

// Add to completion dialog initialization
customCommandProvider := completions.NewCustomCommandCompletionProvider(m.app)

completionDialog := dialog.NewCompletionDialogComponent(
    "/",
    commandProvider,
    customCommandProvider,  // Add custom command provider
    fileProvider,
    symbolProvider,
    agentProvider,
)

// Add to CompletionSelectedMsg handler
case "custom-commands":
    commandName := msg.Item.Value
    slashIndex := m.textarea.LastRuneIndex('/')
    if slashIndex == -1 {
        m.textarea.InsertString("/" + commandName + " ")
        return m, nil
    }
    cursorCol := m.textarea.CursorColumn()
    m.textarea.ReplaceRange(slashIndex, cursorCol, "/"+commandName+" ")
    return m, nil
```

## Session Integration

### Modified Session.chat() Function

```typescript
// packages/opencode/src/session/index.ts

export async function chat(
  input: z.infer<typeof ChatInput>,
): Promise<{ info: MessageV2.Assistant; parts: MessageV2.Part[] }> {
  // ... existing code ...

  // Check for custom commands before creating user message
  if (input.parts.length === 1 && input.parts[0].type === "text") {
    const textPart = input.parts[0]
    const commandMessages = await Commands.executeCommand(input.sessionID, textPart.text)
    
    if (commandMessages) {
      l.info("executing custom command", { 
        command: Commands.parseCommand(textPart.text).fullCommand 
      })
      
      // Replace single text part with multiple generated parts
      input.parts = commandMessages.map((msg, index) => ({
        id: textPart.id ?? Identifier.ascending("part"),
        type: "text" as const,
        text: msg.content,
        synthetic: msg.synthetic
      }))
    }
  }

  // ... continue with existing user message creation ...
}
```

### Message Generation

```typescript
// Generated message structure
interface GeneratedMessage {
  role: "user"
  content: string
  synthetic: boolean
}

// Example generated messages for "/sc:implement --think fix auth bug"
const messages: GeneratedMessage[] = [
  {
    role: "user",
    content: `<command-message>sc:implement is running…</command-message>
<command-name>/sc:implement</command-name>
<command-args>--think fix auth bug</command-args>`,
    synthetic: true
  },
  {
    role: "user",
    content: "# Implementation Command\n\nPlease implement fix auth bug following...",
    synthetic: false
  }
]
```

## Error Handling

### Server Error Responses

```typescript
interface ErrorResponse {
  error: string
  details?: string
  code?: string
}
```

**Common Error Codes**:
- `COMMAND_NOT_FOUND` - Requested command does not exist
- `INVALID_NAMESPACE` - Namespace contains invalid characters
- `FILE_READ_ERROR` - Cannot read command file
- `PARSE_ERROR` - Cannot parse command frontmatter
- `REGISTRY_NOT_INITIALIZED` - Command registry not ready

### Client Error Handling

```go
// TUI error handling
func (c *CustomCommandCompletionProvider) fetchCommands() ([]CustomCommand, error) {
    resp, err := http.Get(serverURL + "/commands/custom")
    if err != nil {
        // Log error and return cached commands if available
        slog.Error("Failed to fetch custom commands", "error", err)
        if len(c.cachedCommands) > 0 {
            return c.cachedCommands, nil
        }
        return nil, fmt.Errorf("failed to fetch custom commands: %w", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("server returned status %d", resp.StatusCode)
    }

    // ... parse response ...
}
```

## Configuration

### Environment Variables

```bash
# Command system configuration
OPENCODE_COMMANDS_DIR=".opencode/commands"     # Commands directory
OPENCODE_COMMANDS_MAX_SIZE="65536"            # Max file size (bytes)
OPENCODE_COMMANDS_WATCH_DEBOUNCE="1000"       # File watcher debounce (ms)
OPENCODE_COMMANDS_CACHE_TTL="30"              # TUI cache TTL (seconds)
```

### Project Configuration

```json
// opencode.json
{
  "commands": {
    "enabled": true,
    "directory": ".opencode/commands",
    "maxFileSize": 65536,
    "watchDebounce": 1000,
    "namespaces": {
      "sc": {
        "description": "SuperClaude commands",
        "enabled": true
      },
      "team": {
        "description": "Team collaboration commands",
        "enabled": true
      }
    }
  }
}
```

## Command File Format

### Markdown Structure

```markdown
---
# YAML frontmatter (optional)
description: "Brief command description"
args: ["--flag1", "--flag2"]
examples:
  - "/namespace:command example usage"
tags: ["tag1", "tag2"]
author: "Author Name"
version: "1.0.0"
---

# Command Title

Command content here with {{args}} template variable.

## Sections
- Use standard markdown
- Include examples and usage
- Document expected behavior
```

### Frontmatter Schema

```yaml
# All frontmatter properties are optional
description: string    # Brief description for autocomplete
args: array           # Expected arguments/flags
examples: array       # Usage examples
tags: array          # Classification tags
author: string       # Command author
version: string      # Command version
created: string      # Creation date (ISO)
updated: string      # Last update date (ISO)
deprecated: boolean  # Mark as deprecated
```

### Template Variables

Current supported template variables:
- `{{args}}` - Replaced with user-provided arguments

Future template variables (planned):
- `{{namespace}}` - Command namespace
- `{{command}}` - Command name  
- `{{timestamp}}` - Current timestamp
- `{{user}}` - Current user name
- `{{project}}` - Project name

## Performance Considerations

### Caching Strategy

**Server-Side**:
- Commands cached in memory with file modification tracking
- File watching for automatic cache invalidation
- Content hashing for change detection

**Client-Side (TUI)**:
- 30-second cache TTL for command list
- Graceful fallback to cached data on network errors
- Incremental cache updates

### File Watching

```typescript
// Debounced file watching configuration
const watcherConfig = {
  ignored: /node_modules/,
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 1000,  // Wait 1s for file stability
    pollInterval: 100          // Check every 100ms
  }
}
```

### Network Optimization

**Request Batching**:
- Bulk command fetching
- Conditional requests with ETags
- Compression for large responses

**Error Resilience**:
- Retry logic with exponential backoff
- Circuit breaker pattern for server unavailability
- Graceful degradation to cached data

## Security Considerations

### Path Validation

```typescript
// Prevent directory traversal
function validateCommandPath(filePath: string): boolean {
  const normalized = path.normalize(filePath)
  const commandsDir = getCommandsDirectory()
  return normalized.startsWith(commandsDir) && 
         path.extname(normalized) === '.md'
}
```

### Content Sanitization

```typescript
// File size limits
const MAX_FILE_SIZE = 64 * 1024  // 64KB

// Content validation
function validateCommandContent(content: string): boolean {
  return content.length <= MAX_FILE_SIZE &&
         Buffer.isBuffer(Buffer.from(content, 'utf8'))
}
```

### Access Control

- Commands inherit project-level permissions
- No privilege escalation through custom commands
- Standard session security applies to command execution

## Migration and Versioning

### API Versioning

Current API version: `v1`
Future versions will maintain backward compatibility or provide migration paths.

### Command Format Evolution

- Frontmatter schema is extensible
- New template variables added without breaking changes
- Deprecated features marked with warnings before removal

### Database Schema

Commands are file-based with no database schema. File format changes are backward compatible through:
- Optional frontmatter properties
- Graceful fallback for missing metadata
- Version detection through content analysis