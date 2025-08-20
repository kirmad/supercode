# Custom Commands System

## Overview

The Custom Commands System allows users to create templated commands that inject predefined content into prompts, enabling consistent and reusable interaction patterns with the AI. Commands are stored as Markdown files in the `.opencode/commands/` directory and are accessible through autocomplete in the TUI.

## Architecture

### Core Components

```
packages/opencode/src/commands/     # Server-side implementation
├── index.ts                        # Main exports
├── registry.ts                     # Command discovery and caching
├── processor.ts                    # Command parsing and message generation
├── watcher.ts                      # File system monitoring
└── types.ts                        # TypeScript definitions

packages/tui/internal/completions/  # TUI integration
└── customcommands.go               # Completion provider

.opencode/commands/                 # User command files
├── sc/
│   ├── implement.md
│   ├── analyze.md
│   └── improve.md
└── team/
    └── review.md
```

### Data Flow

1. **Discovery**: Server scans `.opencode/commands/` for `.md` files on startup
2. **Caching**: Commands are cached in memory with file watching for updates
3. **Autocomplete**: TUI fetches available commands from server API
4. **Execution**: Command input is transformed into multiple LLM messages
5. **Processing**: Standard session flow processes the enhanced messages

## Command Structure

### File Organization

Commands are organized using a namespace pattern:
```
.opencode/commands/{namespace}/{command}.md
```

Examples:
- `.opencode/commands/sc/implement.md` → `/sc:implement`
- `.opencode/commands/team/review.md` → `/team:review`
- `.opencode/commands/personal/notes.md` → `/personal:notes`

### Command Format

Commands are Markdown files with optional YAML frontmatter:

```markdown
---
description: "Implement features with systematic approach"
args: ["--think", "--iterative", "--type"]
examples:
  - "/sc:implement --think fix auth bug"
  - "/sc:implement --iterative add user dashboard"
---

# Implementation Command

Your detailed implementation instructions here...

## Process
1. Analyze the requirements
2. Design the solution
3. Implement with tests
4. Validate the results

Use arguments: {{args}}
```

## User Experience

### Autocomplete Behavior

1. **Trigger**: Type `/` in the TUI to show command suggestions
2. **Fuzzy Search**: `/imp` shows `/sc:implement` as option
3. **Tab Completion**: Tab completes to `/sc:implement ` (preserves command)
4. **Continue Typing**: User can add arguments after command

### Command Execution

**Input**: `/sc:implement --think fix authentication bug`

**Generated Messages**:
```
Message 1: <command-message>sc:implement is running…</command-message>
<command-name>/sc:implement</command-name>
<command-args>--think fix authentication bug</command-args>

Message 2: [Content of implement.md file with {{args}} substituted]
```

## Implementation Details

### Server-Side Processing

Commands are processed in the `Session.chat()` function before creating user messages:

1. **Parse Command**: Extract namespace, command name, and arguments
2. **Retrieve Template**: Load cached command content from registry
3. **Generate Messages**: Create structured messages for LLM consumption
4. **Continue Flow**: Process through existing session management

### TUI Integration

Custom commands integrate with the existing completion system:

1. **Completion Provider**: Implements `CompletionProvider` interface
2. **API Client**: Fetches commands from server endpoints
3. **Fuzzy Matching**: Uses existing fuzzy search functionality
4. **Selection Handling**: Preserves command structure on completion

### Performance Optimizations

- **Memory Caching**: Commands cached with file modification timestamps
- **File Watching**: Automatic cache invalidation on file changes
- **Lazy Loading**: Command content loaded only when accessed
- **Debounced Updates**: File watcher prevents excessive reloads

## Security Considerations

### Path Validation
- Prevents directory traversal attacks
- Validates file extensions (`.md` only)
- Restricts to `.opencode/commands/` directory

### Content Sanitization
- Basic Markdown validation
- File size limits (configurable, default 64KB)
- Encoding validation (UTF-8)

### Access Control
- Commands inherit project permissions
- No elevation of privileges
- Standard session security applies

## Configuration

### Environment Variables

```bash
OPENCODE_COMMANDS_DIR=".opencode/commands"     # Commands directory
OPENCODE_COMMANDS_MAX_SIZE="65536"            # Max file size in bytes
OPENCODE_COMMANDS_WATCH_DEBOUNCE="1000"       # File watcher debounce (ms)
```

### Project Configuration

Commands can be configured per-project in `opencode.json`:

```json
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

## Error Handling

### File System Errors
- Missing command files: Log warning, skip in autocomplete
- Permission errors: Graceful fallback to available commands
- Malformed YAML: Use file without metadata

### Runtime Errors
- Invalid command syntax: Show user-friendly error
- Template substitution failures: Use original template
- API communication errors: Fall back to cached data

## Monitoring and Debugging

### Logging

Commands emit structured logs for debugging:

```typescript
log.info("command.discovered", {
  namespace: "sc",
  command: "implement", 
  filePath: "/path/to/.opencode/commands/sc/implement.md"
})

log.info("command.executed", {
  command: "sc:implement",
  args: "--think fix auth bug",
  messageCount: 2
})
```

### Metrics

- Command usage frequency
- Cache hit/miss rates
- File watcher performance
- API response times

## Migration and Compatibility

### Backward Compatibility
- Existing slash commands (`/help`, `/models`) remain unchanged
- New custom commands use namespace pattern (`namespace:command`)
- No breaking changes to existing functionality

### Migration Path
1. Create `.opencode/commands/` directory
2. Add command files with appropriate namespaces
3. Commands immediately available in autocomplete
4. No configuration changes required

## Related Documentation

- [Tools System](./tools-system.md) - Understanding the broader tool ecosystem
- [Session Management](./session-management.md) - How commands integrate with sessions
- [TUI Architecture](../architecture.md#tui) - TUI implementation details
- [API Reference](./custom-commands-api.md) - Complete API documentation

## See Also

- [Implementation Guide](./custom-commands-implementation.md) - Step-by-step implementation
- [User Guide](./custom-commands-user-guide.md) - Creating and using custom commands
- [Examples](./custom-commands-examples.md) - Common command patterns and templates