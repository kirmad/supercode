# Tool Filtering Quick Reference

## Precedence Order
```
Input > Flags > Commands > Agent
```

## Configuration Modes

### Additive Mode (Flags/Agent)
```yaml
allowed-tools: bash, grep  # Adds these tools
```

### Restrictive Mode (Flags)
```yaml
deny-tools: "*"            # Deny all first
allowed-tools: read, grep  # Then allow only these
```

### Subtractive Mode (Flags/Agent)
```yaml
deny-tools: write, bash    # Remove specific tools
```

### Command Mode (Always Restrictive)
```yaml
allowed-tools: read, edit  # ONLY these tools allowed
deny-tools: webfetch       # Additional denials
```

## File Locations

```
.opencode/
├── flags/            # Flag definitions
│   └── *.md          # Flag files with frontmatter
├── commands/         # Command definitions  
│   └── *.md          # Command files with frontmatter
└── agent/            # Agent configurations
    └── *.json        # Agent config files
```

## Frontmatter Format

### Flags (hyphenated, converted to camelCase internally)
```yaml
---
description: Flag description
allowed-tools: tool1, tool2
deny-tools: tool3, tool4
placement: before|after|replace
---
```

### Commands (hyphenated keys)
```yaml
---
description: Command description
allowed-tools: 
  - tool1
  - tool2
deny-tools: tool3, tool4
argument-hint: <args>
---
```

## Agent Configuration

```json
{
  "agent": {
    "my-agent": {
      "tools": {
        "read": true,
        "write": false
      },
      "allowedTools": ["grep", "glob"],
      "denyTools": ["patch", "bash"]
    }
  }
}
```

## Available Tools

| Tool | Description | Risk Level |
|------|-------------|------------|
| `read` | Read files | Low |
| `write` | Create files | High |
| `edit` | Modify files | High |
| `multiedit` | Multiple edits | High |
| `patch` | Apply patches | High |
| `bash` | Execute commands | Critical |
| `grep` | Search files | Low |
| `glob` | Find files | Low |
| `ls` | List directories | Low |
| `webfetch` | Fetch web content | Medium |
| `todoread` | Read todos | None (always allowed) |
| `todowrite` | Write todos | None (always allowed) |

## Common Patterns

### Read-Only Mode
```yaml
deny-tools: write, edit, multiedit, patch, bash
allowed-tools: read, grep, glob, ls
```

### Development Mode
```yaml
allowed-tools: read, write, edit, multiedit, grep, glob, bash
deny-tools: webfetch
```

### Security Audit
```yaml
allowed-tools: read, grep, glob
deny-tools: "*"
```

### Testing Mode
```yaml
allowed-tools: read, bash, grep
deny-tools: write, edit, patch
```

## Usage Examples

```bash
# Use a flag
supercode --safe-mode "Analyze this code"

# Use a command
supercode "/security audit the system"

# Combine flag and command
supercode --safe-mode "/analyze check architecture"

# Multiple flags
supercode --safe-mode --verbose "Review the codebase"
```

## Debugging

```typescript
// Check what's configured
console.log("flagTools:", input.flagTools)
console.log("commandTools:", input.commandTools)
console.log("agent tools:", agent.tools)
console.log("agent allowedTools:", agent.allowedTools)
console.log("agent denyTools:", agent.denyTools)

// Test resolution
const resolution = ToolFilter.resolveToolConfig(toolConfig)
console.log("Resolution:", resolution)

// Check specific tool
const canUseBash = ToolFilter.isToolEnabled("bash", resolution)
console.log("Can use bash:", canUseBash)
```

## Key Implementation Files

- `packages/opencode/src/flags/flags.ts` - Flag parsing with gray-matter
- `packages/opencode/src/commands/custom.ts` - Command parsing with gray-matter
- `packages/opencode/src/agent/agent.ts` - Agent schema with tool fields
- `packages/opencode/src/tool/filter.ts` - Tool filtering logic
- `packages/opencode/src/session/index.ts` - Integration point