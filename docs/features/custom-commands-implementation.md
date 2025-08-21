# Custom Commands Implementation Guide - Simplified

## Overview

Simplified implementation following KISS principles. The system enables custom markdown-based commands without complex infrastructure.

**Architecture**: `File → Parser → Session` (3 layers)
**Implementation**: Staged approach over 3 phases
**Complexity**: ~200 lines total vs original ~1000+ lines

## Implementation Stages

### Stage 1: Minimal Viable Implementation (Day 1) ✅ COMPLETED
**Goal**: Basic custom command execution
**Files**: 2 files, ~140 lines
**Features**: 
- Parse namespaced commands: `/ns:cmd args` → read `.opencode/commands/ns/cmd.md`
- Parse root-level commands: `/cmd args` → read `.opencode/commands/cmd.md`
- Argument substitution using `$ARGUMENTS` placeholder

### Stage 2: TUI Integration (Day 2)
**Goal**: Command completion in editor
**Files**: 1 file, ~50 lines  
**Features**: Autocomplete custom commands

### Stage 3: Enhancement Features (Day 3)
**Goal**: Polish and metadata support
**Files**: 1 file, ~50 lines
**Features**: YAML frontmatter, validation, API endpoints

---

# Stage 1: Minimal Viable Implementation

## Core Types (Simplified)

**File**: `packages/opencode/src/commands/custom.ts`

```typescript
export namespace CustomCommands {
  export interface ParsedCommand {
    isCustomCommand: boolean
    namespace?: string
    command?: string  
    args?: string
    fullCommand?: string
  }
}

## Stage 1: Core Parser (~50 lines)

**File**: `packages/opencode/src/commands/custom.ts`

```typescript
import { promises as fs } from "fs"
import path from "path"
import { App } from "../app/app"

export namespace CustomCommands {
  export interface ParsedCommand {
    isCustomCommand: boolean
    namespace?: string
    command?: string  
    args?: string
    filePath?: string
  }

  const NAMESPACED_COMMAND_REGEX = /^\/([a-zA-Z0-9_-]+):([a-zA-Z0-9_:-]+)(\s+.*)?$/
  const ROOT_COMMAND_REGEX = /^\/([a-zA-Z0-9_-]+)(\s+.*)?$/

  export function parseCommand(input: string): ParsedCommand {
    const trimmed = input.trim()
    
    // Try namespaced command first (e.g., /sc:implement)
    const namespacedMatch = trimmed.match(NAMESPACED_COMMAND_REGEX)
    if (namespacedMatch) {
      const [, namespace, command, argsString] = namespacedMatch
      const args = argsString?.trim() || ""
      
      return {
        isCustomCommand: true,
        namespace,
        command,
        args,
        filePath: getCommandPath(namespace, command)
      }
    }
    
    // Try root-level command (e.g., /bolo)
    const rootMatch = trimmed.match(ROOT_COMMAND_REGEX)
    if (rootMatch) {
      const [, command, argsString] = rootMatch
      const args = argsString?.trim() || ""
      
      return {
        isCustomCommand: true,
        command,
        args,
        filePath: getRootCommandPath(command)
      }
    }
    
    return { isCustomCommand: false }
  }

  export async function executeCommand(input: string): Promise<string | null> {
    const parsed = parseCommand(input)
    
    if (!parsed.isCustomCommand || !parsed.filePath) {
      return null
    }
    
    try {
      const content = await fs.readFile(parsed.filePath, "utf-8")
      return content.replace(/\$ARGUMENTS/g, parsed.args || "")
    } catch (error) {
      const commandRef = parsed.namespace ? `${parsed.namespace}:${parsed.command}` : parsed.command
      throw new Error(`Command not found: ${commandRef}`)
    }
  }

  function getCommandPath(namespace: string, command: string): string {
    try {
      const app = App.info()
      const commandsDir = path.join(app.path.root, ".opencode", "commands")
      return path.join(commandsDir, namespace, `${command}.md`)
    } catch (error) {
      const commandsDir = path.join(process.cwd(), ".opencode", "commands")
      return path.join(commandsDir, namespace, `${command}.md`)
    }
  }

  function getRootCommandPath(command: string): string {
    try {
      const app = App.info()
      const commandsDir = path.join(app.path.root, ".opencode", "commands")
      return path.join(commandsDir, `${command}.md`)
    } catch (error) {
      const commandsDir = path.join(process.cwd(), ".opencode", "commands")
      return path.join(commandsDir, `${command}.md`)
    }
  }
}
```

## Session Integration (Stage 1)

**File**: `packages/opencode/src/session/index.ts` (minimal change)

Add near existing imports:
```typescript
import { CustomCommands } from "../commands/custom"
```

In the `chat()` function, add before user message creation:
```typescript
// Check for custom commands
if (input.parts.length === 1 && input.parts[0].type === "text") {
  const textPart = input.parts[0]
  const commandContent = await CustomCommands.executeCommand(textPart.text)
  
  if (commandContent) {
    // Replace input with command content
    textPart.text = commandContent
  }
}
```

## Test Commands (Stage 1)

Create test directory and commands:

**File**: `.opencode/commands/test/hello.md` (namespaced)
```markdown
# Hello Command

Say hello to $ARGUMENTS!
```

**File**: `.opencode/commands/sc/implement.md` (namespaced)
```markdown
# Implementation Command

You are an expert developer. Please implement: $ARGUMENTS

Follow these steps:
1. Understand requirements
2. Write clean code
3. Add tests
4. Validate solution
```

**File**: `.opencode/commands/bolo.md` (root-level)
```markdown
# Bolo Command

Say hello to $ARGUMENTS
```

---

# Stage 2: TUI Integration (~50 lines)

## Simple Command Discovery

**File**: `packages/tui/internal/completions/simple-custom.go`

```go
package completions

import (
	"os"
	"path/filepath"
	"strings"
)

type SimpleCustomProvider struct {
	commands []string
}

func NewSimpleCustomProvider() *SimpleCustomProvider {
	return &SimpleCustomProvider{}
}

func (p *SimpleCustomProvider) GetCompletions(query string) []string {
	if len(p.commands) == 0 {
		p.loadCommands()
	}
	
	var matches []string
	for _, cmd := range p.commands {
		if strings.Contains(cmd, query) {
			matches = append(matches, cmd)
		}
	}
	return matches
}

func (p *SimpleCustomProvider) loadCommands() {
	commandDir := ".opencode/commands"
	
	filepath.Walk(commandDir, func(path string, info os.FileInfo, err error) error {
		if err != nil || !strings.HasSuffix(path, ".md") {
			return nil
		}
		
		rel, _ := filepath.Rel(commandDir, path)
		parts := strings.Split(strings.TrimSuffix(rel, ".md"), string(filepath.Separator))
		
		if len(parts) >= 2 {
			cmd := "/" + parts[0] + ":" + strings.Join(parts[1:], ":")
			p.commands = append(p.commands, cmd)
		}
		
		return nil
	})
}
```

---

# Stage 3: Enhancement Features (~50 lines)

## YAML Frontmatter Support

**File**: `packages/opencode/src/commands/enhanced.ts`

```typescript
import { z } from "zod"
import * as yaml from "js-yaml"

export namespace EnhancedCommands {
  const Metadata = z.object({
    description: z.string().optional(),
    examples: z.array(z.string()).optional(),
  }).optional()

  export function parseWithMetadata(content: string): {
    content: string
    description?: string
  } {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/
    const match = content.match(frontmatterRegex)
    
    if (!match) {
      return { content }
    }
    
    try {
      const metadata = Metadata.parse(yaml.load(match[1]))
      return {
        content: match[2],
        description: metadata?.description
      }
    } catch {
      return { content }
    }
  }
}
```

## Simple API Endpoint

**File**: `packages/opencode/src/server/server.ts` (addition)

```typescript
.get("/commands/list", async (c) => {
  // Simple command discovery for TUI
  const commands = await SimpleCommands.discoverCommands()
  return c.json({ commands })
})
```

---

# Implementation Timeline

## Day 1: Core Functionality ✅ COMPLETED
- Implement `CustomCommands` parser with dual pattern support
- Add session integration  
- Create test commands (namespaced and root-level)
- **Result**: Both `/sc:implement hello world` and `/bolo test` work end-to-end

## Day 2: TUI Integration  
- Add simple completion provider
- Integrate with editor autocomplete
- **Result**: Tab completion for custom commands

## Day 3: Polish & Enhancement
- Add YAML frontmatter support
- Add basic API endpoint
- Add error handling
- **Result**: Production-ready with metadata

## Testing Each Stage

**Stage 1 Test**: 
- `echo "/test:hello world" | opencode` ✅
- `echo "/bolo test args" | opencode` ✅
- `echo "/sc:implement user form" | opencode` ✅

**Stage 2 Test**: Type `/` in TUI → see custom commands
**Stage 3 Test**: Commands with descriptions show properly

## Simplified vs Original Comparison

| Aspect | Original Design | Simplified Design |
|--------|----------------|-------------------|
| **Lines of Code** | ~1000+ | ~140 (Stage 1) |
| **Files** | 8 files | 2 files (Stage 1) |
| **Dependencies** | chokidar, js-yaml | Built-ins only |
| **Architecture** | 6 layers | 3 layers |
| **Caching** | Complex multi-layer | Read-on-demand |
| **File Watching** | Real-time with debouncing | None (Stage 1) |
| **Validation** | Multi-step with metadata | Basic error handling |
| **API** | Full REST endpoints | Single discovery endpoint |

## Benefits of Simplified Approach

✅ **Faster Implementation**: 3 days vs 2+ weeks  
✅ **Lower Maintenance**: Fewer moving parts  
✅ **Better Reliability**: Less failure points  
✅ **Easier Testing**: Simple integration tests  
✅ **KISS Compliance**: Minimal complexity for core functionality

The simplified approach achieves 90% of the value with 20% of the complexity.