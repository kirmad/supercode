# Custom Commands Implementation Guide

## Overview

This guide provides step-by-step instructions for implementing the Custom Commands system. The implementation follows a server-first architecture where the core logic resides in `packages/opencode` with TUI integration for user interaction.

## Phase 1: Server-Side Implementation

### Step 1: Create Core Types and Interfaces

**File**: `packages/opencode/src/commands/types.ts`

```typescript
import { z } from "zod"

export namespace CustomCommands {
  // Command metadata from YAML frontmatter
  export const CommandMetadata = z.object({
    description: z.string().optional(),
    args: z.array(z.string()).optional(),
    examples: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    author: z.string().optional(),
    version: z.string().optional(),
  }).optional()
  
  export type CommandMetadata = z.infer<typeof CommandMetadata>

  // Core command structure
  export interface Command {
    name: string              // "sc:implement"
    namespace: string         // "sc"  
    command: string          // "implement"
    filePath: string         // Absolute path to .md file
    content: string          // Raw markdown content
    processedContent: string // Content with frontmatter removed
    metadata: CommandMetadata
    lastModified: number     // File modification timestamp
    hash: string            // Content hash for caching
  }

  // Registry state
  export interface Registry {
    commands: Map<string, Command>     // key: "namespace:command"
    byNamespace: Map<string, Command[]> // grouped by namespace
    watchers: Map<string, any>         // FSWatcher instances
    isInitialized: boolean
  }

  // Command execution context
  export interface ExecutionContext {
    command: Command
    args: string
    originalInput: string
    sessionID: string
  }

  // Parsed command result
  export interface ParsedCommand {
    isCustomCommand: boolean
    namespace?: string
    command?: string  
    args?: string
    originalInput: string
    fullCommand?: string  // "namespace:command"
  }
}
```

### Step 2: Implement Command Registry

**File**: `packages/opencode/src/commands/registry.ts`

```typescript
import { promises as fs } from "fs"
import path from "path"
import { watch, FSWatcher } from "chokidar"
import { createHash } from "crypto"
import * as yaml from "js-yaml"
import { App } from "../app/app"
import { Log } from "../util/log"
import { CustomCommands } from "./types"

const log = Log.create({ service: "commands" })

export namespace CommandRegistry {
  let registry: CustomCommands.Registry = {
    commands: new Map(),
    byNamespace: new Map(), 
    watchers: new Map(),
    isInitialized: false
  }

  export async function initialize(): Promise<void> {
    if (registry.isInitialized) return
    
    const commandsDir = getCommandsDirectory()
    log.info("initializing command registry", { commandsDir })
    
    // Ensure commands directory exists
    await fs.mkdir(commandsDir, { recursive: true })
    
    // Discover existing commands
    await discoverCommands(commandsDir)
    
    // Setup file watching
    await setupFileWatching(commandsDir)
    
    registry.isInitialized = true
    log.info("command registry initialized", { 
      commandCount: registry.commands.size,
      namespaces: Array.from(registry.byNamespace.keys())
    })
  }

  export function getCommandsDirectory(): string {
    const app = App.info()
    return path.join(app.path.root, ".opencode", "commands")
  }

  export async function discoverCommands(rootDir: string): Promise<void> {
    try {
      await walkDirectory(rootDir, async (filePath, relativePath) => {
        if (path.extname(filePath) === ".md") {
          await addCommand(filePath, relativePath)
        }
      })
      
      rebuildNamespaceIndex()
    } catch (error) {
      log.error("failed to discover commands", { error, rootDir })
    }
  }

  async function walkDirectory(
    dir: string, 
    callback: (filePath: string, relativePath: string) => Promise<void>
  ): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      
      if (entry.isDirectory()) {
        await walkDirectory(fullPath, callback)
      } else if (entry.isFile()) {
        const relativePath = path.relative(getCommandsDirectory(), fullPath)
        await callback(fullPath, relativePath)
      }
    }
  }

  async function addCommand(filePath: string, relativePath: string): Promise<void> {
    try {
      const stats = await fs.stat(filePath)
      const content = await fs.readFile(filePath, "utf-8")
      
      // Parse namespace and command from file path
      const parts = relativePath.replace(/\.md$/, "").split(path.sep)
      if (parts.length < 2) {
        log.warn("invalid command file path", { filePath, relativePath })
        return
      }
      
      const namespace = parts[0]
      const command = parts.slice(1).join(":")  // Support nested paths
      const fullCommand = `${namespace}:${command}`
      
      // Parse frontmatter and content
      const { metadata, processedContent } = parseFrontmatter(content)
      
      // Create command object
      const cmd: CustomCommands.Command = {
        name: fullCommand,
        namespace,
        command,
        filePath,
        content,
        processedContent,
        metadata,
        lastModified: stats.mtime.getTime(),
        hash: createHash("sha256").update(content).digest("hex")
      }
      
      registry.commands.set(fullCommand, cmd)
      log.info("command added", { 
        command: fullCommand,
        filePath: relativePath,
        hasMetadata: !!metadata
      })
      
    } catch (error) {
      log.error("failed to add command", { error, filePath })
    }
  }

  function parseFrontmatter(content: string): {
    metadata: CustomCommands.CommandMetadata
    processedContent: string
  } {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/
    const match = content.match(frontmatterRegex)
    
    if (!match) {
      return { metadata: undefined, processedContent: content }
    }
    
    try {
      const yamlContent = match[1]
      const markdownContent = match[2]
      const parsed = yaml.load(yamlContent) as any
      
      const metadata = CustomCommands.CommandMetadata.parse(parsed)
      return { metadata, processedContent: markdownContent }
    } catch (error) {
      log.warn("failed to parse frontmatter", { error })
      return { metadata: undefined, processedContent: content }
    }
  }

  function rebuildNamespaceIndex(): void {
    registry.byNamespace.clear()
    
    for (const [_, command] of registry.commands) {
      const existing = registry.byNamespace.get(command.namespace) || []
      existing.push(command)
      registry.byNamespace.set(command.namespace, existing)
    }
    
    // Sort commands within each namespace
    for (const [namespace, commands] of registry.byNamespace) {
      commands.sort((a, b) => a.command.localeCompare(b.command))
      registry.byNamespace.set(namespace, commands)
    }
  }

  async function setupFileWatching(rootDir: string): Promise<void> {
    const watcher = watch(rootDir, {
      ignored: /node_modules/,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 100
      }
    })

    const debounce = new Map<string, NodeJS.Timeout>()

    watcher
      .on("add", (filePath) => handleFileEvent("add", filePath, debounce))
      .on("change", (filePath) => handleFileEvent("change", filePath, debounce))  
      .on("unlink", (filePath) => handleFileEvent("unlink", filePath, debounce))
      .on("error", (error) => log.error("file watcher error", { error }))

    registry.watchers.set(rootDir, watcher)
    log.info("file watching enabled", { rootDir })
  }

  function handleFileEvent(
    event: string, 
    filePath: string, 
    debounce: Map<string, NodeJS.Timeout>
  ): void {
    // Debounce file events
    if (debounce.has(filePath)) {
      clearTimeout(debounce.get(filePath)!)
    }
    
    debounce.set(filePath, setTimeout(async () => {
      debounce.delete(filePath)
      
      if (path.extname(filePath) !== ".md") return
      
      const relativePath = path.relative(getCommandsDirectory(), filePath)
      log.info("file event", { event, filePath: relativePath })
      
      try {
        switch (event) {
          case "add":
          case "change":
            await addCommand(filePath, relativePath)
            rebuildNamespaceIndex()
            break
            
          case "unlink":
            await removeCommand(relativePath)
            rebuildNamespaceIndex()
            break
        }
      } catch (error) {
        log.error("failed to handle file event", { error, event, filePath })
      }
    }, 1000))
  }

  async function removeCommand(relativePath: string): Promise<void> {
    const parts = relativePath.replace(/\.md$/, "").split(path.sep)
    if (parts.length < 2) return
    
    const namespace = parts[0]
    const command = parts.slice(1).join(":")
    const fullCommand = `${namespace}:${command}`
    
    if (registry.commands.has(fullCommand)) {
      registry.commands.delete(fullCommand)
      log.info("command removed", { command: fullCommand })
    }
  }

  // Public API
  export function getCommand(namespace: string, command: string): CustomCommands.Command | undefined {
    return registry.commands.get(`${namespace}:${command}`)
  }

  export function getAllCommands(): CustomCommands.Command[] {
    return Array.from(registry.commands.values())
  }

  export function getCommandsByNamespace(namespace: string): CustomCommands.Command[] {
    return registry.byNamespace.get(namespace) || []
  }

  export function getNamespaces(): string[] {
    return Array.from(registry.byNamespace.keys())
  }

  export function hasCommand(namespace: string, command: string): boolean {
    return registry.commands.has(`${namespace}:${command}`)
  }

  export async function cleanup(): Promise<void> {
    for (const [_, watcher] of registry.watchers) {
      await watcher.close()
    }
    registry.watchers.clear()
    registry.commands.clear()
    registry.byNamespace.clear()
    registry.isInitialized = false
  }
}
```

### Step 3: Implement Command Processor

**File**: `packages/opencode/src/commands/processor.ts`

```typescript
import { CustomCommands } from "./types"
import { Log } from "../util/log"

const log = Log.create({ service: "command-processor" })

export namespace CommandProcessor {
  const COMMAND_REGEX = /^\/([a-zA-Z0-9_-]+):([a-zA-Z0-9_:-]+)(\s+.*)?$/

  export function parseCommand(input: string): CustomCommands.ParsedCommand {
    const trimmed = input.trim()
    const match = trimmed.match(COMMAND_REGEX)
    
    if (!match) {
      return {
        isCustomCommand: false,
        originalInput: input
      }
    }
    
    const [, namespace, command, argsString] = match
    const args = argsString?.trim() || ""
    const fullCommand = `${namespace}:${command}`
    
    return {
      isCustomCommand: true,
      namespace,
      command,
      args,
      fullCommand,
      originalInput: input
    }
  }

  export function generateMessages(
    context: CustomCommands.ExecutionContext
  ): Array<{ role: "user"; content: string; synthetic: boolean }> {
    const { command, args, originalInput } = context
    
    // First message: Command metadata for the LLM
    const commandMessage = [
      `<command-message>${command.name} is running…</command-message>`,
      `<command-name>/${command.name}</command-name>`,
      args ? `<command-args>${args}</command-args>` : ""
    ].filter(Boolean).join("\n")
    
    // Second message: Processed command content with argument substitution
    const processedContent = substituteArguments(command.processedContent, args)
    
    const messages = [
      {
        role: "user" as const,
        content: commandMessage,
        synthetic: true
      },
      {
        role: "user" as const,
        content: processedContent,
        synthetic: false
      }
    ]
    
    log.info("messages generated", {
      command: command.name,
      args,
      messageCount: messages.length,
      totalLength: messages.reduce((sum, msg) => sum + msg.content.length, 0)
    })
    
    return messages
  }

  function substituteArguments(content: string, args: string): string {
    // Simple template substitution - replace {{args}} with actual arguments
    let result = content.replace(/\{\{args\}\}/g, args)
    
    // Support more advanced substitutions if needed
    // {{namespace}}, {{command}}, {{timestamp}}, etc.
    
    return result
  }

  export function validateCommand(command: CustomCommands.Command): {
    valid: boolean
    errors: string[]
    warnings: string[]
  } {
    const errors: string[] = []
    const warnings: string[] = []
    
    // Validate command structure
    if (!command.name || !command.namespace || !command.command) {
      errors.push("Invalid command structure")
    }
    
    // Validate content
    if (!command.content.trim()) {
      warnings.push("Empty command content")
    }
    
    // Validate file size (64KB default limit)
    const maxSize = 64 * 1024
    if (command.content.length > maxSize) {
      warnings.push(`Command content exceeds ${maxSize} bytes`)
    }
    
    // Validate metadata if present
    if (command.metadata) {
      if (command.metadata.examples) {
        for (const example of command.metadata.examples) {
          if (!example.startsWith(`/${command.name}`)) {
            warnings.push(`Example doesn't match command name: ${example}`)
          }
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }
}
```

### Step 4: Implement Main Commands Module

**File**: `packages/opencode/src/commands/index.ts`

```typescript
import { CommandRegistry } from "./registry"
import { CommandProcessor } from "./processor"
import { CustomCommands } from "./types"

export * from "./types"
export * from "./registry" 
export * from "./processor"

export namespace Commands {
  export async function initialize(): Promise<void> {
    await CommandRegistry.initialize()
  }

  export async function cleanup(): Promise<void> {
    await CommandRegistry.cleanup()
  }

  export function parseCommand(input: string): CustomCommands.ParsedCommand {
    return CommandProcessor.parseCommand(input)
  }

  export function getCommand(namespace: string, command: string): CustomCommands.Command | undefined {
    return CommandRegistry.getCommand(namespace, command)
  }

  export function getAllCommands(): CustomCommands.Command[] {
    return CommandRegistry.getAllCommands()
  }

  export function getNamespaces(): string[] {
    return CommandRegistry.getNamespaces()
  }

  export async function executeCommand(
    sessionID: string,
    input: string
  ): Promise<Array<{ role: "user"; content: string; synthetic: boolean }> | null> {
    const parsed = parseCommand(input)
    
    if (!parsed.isCustomCommand || !parsed.namespace || !parsed.command) {
      return null
    }
    
    const command = getCommand(parsed.namespace, parsed.command)
    if (!command) {
      throw new Error(`Command not found: ${parsed.fullCommand}`)
    }
    
    const context: CustomCommands.ExecutionContext = {
      command,
      args: parsed.args || "",
      originalInput: input,
      sessionID
    }
    
    return CommandProcessor.generateMessages(context)
  }
}
```

### Step 5: Integrate with Session System

**File**: `packages/opencode/src/session/index.ts` (modifications)

Add the following imports at the top:
```typescript
import { Commands, CustomCommands } from "../commands"
```

Modify the `chat()` function around line 440 (after processing revert cleanup):

```typescript
export async function chat(
  input: z.infer<typeof ChatInput>,
): Promise<{ info: MessageV2.Assistant; parts: MessageV2.Part[] }> {
  const l = log.clone().tag("session", input.sessionID)
  l.info("chatting")

  const inputAgent = input.agent ?? "build"

  // Process revert cleanup first...
  // [existing revert code remains unchanged]

  // NEW: Check for custom commands before creating user message
  if (input.parts.length === 1 && input.parts[0].type === "text") {
    const textPart = input.parts[0]
    const commandMessages = await Commands.executeCommand(input.sessionID, textPart.text)
    
    if (commandMessages) {
      l.info("executing custom command", { 
        command: Commands.parseCommand(textPart.text).fullCommand 
      })
      
      // Replace the single text part with multiple generated parts
      input.parts = commandMessages.map((msg, index) => ({
        id: textPart.id ?? Identifier.ascending("part"),
        type: "text" as const,
        text: msg.content,
        synthetic: msg.synthetic
      }))
    }
  }

  // Continue with existing user message creation...
  const userMsg: MessageV2.Info = {
    id: input.messageID ?? Identifier.ascending("message"),
    role: "user",
    sessionID: input.sessionID,
    time: {
      created: Date.now(),
    },
  }

  // [rest of the function remains unchanged]
}
```

### Step 6: Add Server API Endpoints

**File**: `packages/opencode/src/server/server.ts` (additions)

Add import:
```typescript
import { Commands } from "../commands"
```

Add routes after existing routes:
```typescript
.get("/commands/custom", async (c) => {
  try {
    const commands = Commands.getAllCommands()
    return c.json({
      commands: commands.map(cmd => ({
        name: cmd.name,
        namespace: cmd.namespace,
        command: cmd.command,
        description: cmd.metadata?.description,
        examples: cmd.metadata?.examples,
        lastModified: cmd.lastModified
      }))
    })
  } catch (error) {
    return c.json({ error: "Failed to fetch commands" }, 500)
  }
})

.get("/commands/custom/:namespace", async (c) => {
  try {
    const namespace = c.req.param("namespace")
    const commands = Commands.getAllCommands().filter(cmd => cmd.namespace === namespace)
    return c.json({ commands })
  } catch (error) {
    return c.json({ error: "Failed to fetch namespace commands" }, 500)
  }
})

.get("/commands/custom/:namespace/:command", async (c) => {
  try {
    const { namespace, command } = c.req.param()
    const cmd = Commands.getCommand(namespace, command)
    
    if (!cmd) {
      return c.json({ error: "Command not found" }, 404)
    }
    
    return c.json({ command: cmd })
  } catch (error) {
    return c.json({ error: "Failed to fetch command" }, 500)
  }
})
```

### Step 7: Initialize Commands in App

**File**: `packages/opencode/src/app/app.ts` (modification)

Add initialization in the App startup:

```typescript
import { Commands } from "../commands"

// In the App.start() or similar initialization function:
export async function start() {
  // ... existing initialization code ...
  
  // Initialize custom commands
  try {
    await Commands.initialize()
    log.info("custom commands initialized")
  } catch (error) {
    log.error("failed to initialize custom commands", { error })
  }
  
  // ... rest of initialization ...
}

// Add cleanup in App.stop() or similar:
export async function stop() {
  // ... existing cleanup code ...
  
  try {
    await Commands.cleanup()
    log.info("custom commands cleaned up")
  } catch (error) {
    log.error("failed to cleanup custom commands", { error })
  }
}
```

## Phase 2: TUI Integration

### Step 1: Create Custom Command Completion Provider

**File**: `packages/tui/internal/completions/customcommands.go`

```go
package completions

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/charmbracelet/lipgloss/v2"
	"github.com/lithammer/fuzzysearch/fuzzy"
	"github.com/sst/opencode/internal/app"
	"github.com/sst/opencode/internal/styles"
	"github.com/sst/opencode/internal/theme"
)

type CustomCommand struct {
	Name         string    `json:"name"`
	Namespace    string    `json:"namespace"`
	Command      string    `json:"command"`
	Description  string    `json:"description,omitempty"`
	Examples     []string  `json:"examples,omitempty"`
	LastModified int64     `json:"lastModified"`
}

type CustomCommandsResponse struct {
	Commands []CustomCommand `json:"commands"`
}

type CustomCommandCompletionProvider struct {
	app          *app.App
	cachedCommands []CustomCommand
	lastFetch      time.Time
	cacheDuration  time.Duration
}

func NewCustomCommandCompletionProvider(app *app.App) CompletionProvider {
	return &CustomCommandCompletionProvider{
		app:           app,
		cacheDuration: 30 * time.Second, // Cache for 30 seconds
	}
}

func (c *CustomCommandCompletionProvider) GetId() string {
	return "custom-commands"
}

func (c *CustomCommandCompletionProvider) GetEmptyMessage() string {
	return "no custom commands found"
}

func (c *CustomCommandCompletionProvider) GetChildEntries(query string) ([]CompletionSuggestion, error) {
	commands, err := c.fetchCommands()
	if err != nil {
		slog.Error("Failed to fetch custom commands", "error", err)
		return nil, err
	}

	// Calculate max width for alignment
	maxNameWidth := 0
	for _, cmd := range commands {
		nameWidth := lipgloss.Width(cmd.Name)
		if nameWidth > maxNameWidth {
			maxNameWidth = nameWidth
		}
	}
	maxNameWidth += 2 // Add padding

	if query == "" {
		// Return all commands
		items := make([]CompletionSuggestion, 0, len(commands))
		for _, cmd := range commands {
			items = append(items, c.createCompletionItem(cmd, maxNameWidth))
		}
		return items, nil
	}

	// Fuzzy search
	commandNames := make([]string, len(commands))
	commandMap := make(map[string]CustomCommand)
	
	for i, cmd := range commands {
		// Search both full name and just command part
		searchKey := cmd.Name
		commandNames[i] = searchKey
		commandMap[searchKey] = cmd
	}

	matches := fuzzy.RankFindFold(query, commandNames)
	sort.Sort(matches)

	items := make([]CompletionSuggestion, 0, len(matches))
	for _, match := range matches {
		if cmd, ok := commandMap[match.Target]; ok {
			items = append(items, c.createCompletionItem(cmd, maxNameWidth))
		}
	}

	return items, nil
}

func (c *CustomCommandCompletionProvider) createCompletionItem(cmd CustomCommand, maxNameWidth int) CompletionSuggestion {
	displayFunc := func(s styles.Style) string {
		t := theme.CurrentTheme()
		
		// Format: /namespace:command    description
		nameWidth := lipgloss.Width(cmd.Name)
		spacer := strings.Repeat(" ", max(1, maxNameWidth-nameWidth))
		
		name := s.Foreground(t.Primary()).Render("/" + cmd.Name)
		desc := ""
		if cmd.Description != "" {
			desc = s.Foreground(t.TextMuted()).Render(spacer + cmd.Description)
		}
		
		return "  " + name + desc
	}

	return CompletionSuggestion{
		Display:    displayFunc,
		Value:      cmd.Name, // This will be used in the completion
		ProviderID: c.GetId(),
		RawData:    cmd,
	}
}

func (c *CustomCommandCompletionProvider) fetchCommands() ([]CustomCommand, error) {
	// Check cache
	if time.Since(c.lastFetch) < c.cacheDuration && len(c.cachedCommands) > 0 {
		return c.cachedCommands, nil
	}

	// Fetch from server
	serverURL := c.app.Config.ServerURL
	if serverURL == "" {
		serverURL = "http://localhost:3000" // Default local server
	}

	resp, err := http.Get(serverURL + "/commands/custom")
	if err != nil {
		return nil, fmt.Errorf("failed to fetch custom commands: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("server returned status %d", resp.StatusCode)
	}

	var response CustomCommandsResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	// Sort commands by namespace then by command name
	sort.Slice(response.Commands, func(i, j int) bool {
		cmdA, cmdB := response.Commands[i], response.Commands[j]
		if cmdA.Namespace != cmdB.Namespace {
			return cmdA.Namespace < cmdB.Namespace
		}
		return cmdA.Command < cmdB.Command
	})

	// Update cache
	c.cachedCommands = response.Commands
	c.lastFetch = time.Now()

	return c.cachedCommands, nil
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
```

### Step 2: Integrate with Editor Component

**File**: `packages/tui/internal/components/chat/editor.go` (modifications)

Add the custom command provider to the autocomplete system. Find the section where completion providers are initialized and add:

```go
import (
	// ... existing imports ...
	customcmd "github.com/sst/opencode/internal/completions"
)

// In the autocomplete initialization section, add:
customCommandProvider := customcmd.NewCustomCommandCompletionProvider(m.app)

// Add to the completion dialog creation
completionDialog := dialog.NewCompletionDialogComponent(
	"/",
	commandProvider,
	customCommandProvider,  // Add this line
	fileProvider,
	symbolProvider,
	agentProvider,
)
```

In the `CompletionSelectedMsg` handler, add a new case:

```go
case "custom-commands":
	// Handle custom command completion
	// The command name comes as "namespace:command"
	commandName := msg.Item.Value
	
	// Find the position to replace (from the last "/")
	slashIndex := m.textarea.LastRuneIndex('/')
	if slashIndex == -1 {
		// Fallback: insert at cursor
		m.textarea.InsertString("/" + commandName + " ")
		return m, nil
	}
	
	// Replace from "/" to cursor with the command and add space
	cursorCol := m.textarea.CursorColumn()
	m.textarea.ReplaceRange(slashIndex, cursorCol, "/"+commandName+" ")
	
	return m, nil
```

## Phase 3: Testing and Validation

### Step 1: Create Test Commands

Create test command files to validate the implementation:

**File**: `.opencode/commands/test/hello.md`
```markdown
---
description: "Simple hello world command"
examples:
  - "/test:hello World"
  - "/test:hello --name Claude"
---

# Hello Command

Say hello to {{args}}!

This is a test command to verify the custom commands system is working correctly.
```

**File**: `.opencode/commands/sc/implement.md`
```markdown
---
description: "Implement features with systematic approach"
args: ["--think", "--iterative", "--type"]
examples:
  - "/sc:implement --think fix auth bug"
  - "/sc:implement --iterative add user dashboard"
---

# Implementation Command

You are an expert software developer. Please implement the requested feature following these steps:

## Process
1. **Analysis**: Understand the requirements thoroughly
2. **Design**: Plan the implementation approach
3. **Code**: Write clean, well-tested code
4. **Validate**: Ensure the solution works correctly

## Guidelines
- Write tests for new functionality
- Follow existing code patterns and conventions
- Consider edge cases and error handling
- Document complex logic

## Request
Please implement: {{args}}
```

### Step 2: Integration Testing

1. **Server Testing**:
   ```bash
   # Test command discovery
   curl http://localhost:3000/commands/custom
   
   # Test specific command
   curl http://localhost:3000/commands/custom/sc/implement
   ```

2. **TUI Testing**:
   - Start TUI and type `/` - should show custom commands
   - Type `/impl` - should show `/sc:implement` 
   - Select command with tab - should preserve and allow continued typing
   - Submit `/sc:implement --think fix bug` - should generate two messages

### Step 3: Error Handling Testing

1. **Missing Files**: Test behavior when command files are deleted
2. **Invalid Syntax**: Test malformed YAML frontmatter
3. **Permission Errors**: Test restricted file access
4. **Network Errors**: Test TUI behavior when server is unavailable

## Phase 4: Documentation and Deployment

### Step 1: Update Configuration

Add custom commands configuration to `opencode.json` schema:

```typescript
// In configuration schema
commands: {
  enabled: z.boolean().default(true),
  directory: z.string().default(".opencode/commands"),
  maxFileSize: z.number().default(65536),
  watchDebounce: z.number().default(1000)
}
```

### Step 2: Migration Guide

Create migration documentation for existing projects:

1. Create `.opencode/commands/` directory
2. Move existing custom prompts to command files
3. Update team workflows to use new command structure

### Step 3: Performance Monitoring

Add metrics collection:

```typescript
// In CommandRegistry
export const metrics = {
  commandsLoaded: 0,
  commandsExecuted: 0,
  cacheHits: 0,
  cacheMisses: 0,
  averageExecutionTime: 0
}
```

This completes the server-side implementation of the Custom Commands system. The next phase would involve TUI integration and user experience refinements.