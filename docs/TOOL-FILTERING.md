# Tool Filtering System

## Overview

The tool filtering system in SuperCode/OpenCode provides fine-grained control over which tools are available during AI agent execution. This allows you to restrict or expand tool access based on security requirements, specific workflows, or custom configurations.

## Architecture

The system uses a hierarchical configuration approach with four levels of control:

1. **Agent Configuration** - Base tool configuration from agent definitions
2. **Command Configuration** - Tool overrides from custom commands
3. **Flag Configuration** - Tool modifications from flags
4. **Input Configuration** - Direct user overrides (highest precedence)

### Precedence Order

```
Input > Flags > Commands > Agent
```

Higher precedence levels can override or modify lower levels.

## Configuration Methods

### 1. Agent Configuration

Agents define their base tool configuration in `opencode.json` or through the agent system:

```json
{
  "agent": {
    "my-agent": {
      "tools": {
        "read": true,
        "write": true,
        "bash": false
      },
      "allowedTools": ["grep", "glob"],
      "denyTools": ["patch"]
    }
  }
}
```

**Fields:**
- `tools`: Explicit tool enable/disable configuration
- `allowedTools`: Additional tools to enable (additive)
- `denyTools`: Tools to explicitly disable (subtractive)

### 2. Command Configuration

Custom commands in `.opencode/commands/` can specify tool configurations in their YAML frontmatter:

```yaml
---
description: Security audit command
allowed-tools: read, grep, glob
deny-tools: write, bash, edit
---

Perform a security audit...
```

**Behavior:** Commands with `allowed-tools` create a restrictive allowlist - ONLY the specified tools are enabled.

### 3. Flag Configuration

Flags in `.opencode/flags/` can modify tool availability through their frontmatter:

```yaml
---
description: Safe mode flag
allowed-tools: read, grep
deny-tools: write, edit, bash
placement: before
---

Enable safe mode with restricted tool access...
```

**Flag Modes:**
- **Additive Mode**: Only `allowed-tools` specified → adds tools to existing configuration
- **Restrictive Mode**: `deny-tools: "*"` with `allowed-tools` → ONLY allows specified tools
- **Subtractive Mode**: Specific `deny-tools` → removes specific tools from existing configuration

### 4. Input Configuration

Direct tool configuration can be passed programmatically (primarily for internal use):

```typescript
const input = {
  tools: {
    read: true,
    write: false
  }
}
```

## Tool Configuration Modes

### Additive Mode

When only `allowedTools` is specified, tools are ADDED to the existing configuration:

```yaml
# Flag or Agent config
allowed-tools: bash, grep
```

Result: Existing tools remain enabled, bash and grep are added.

### Restrictive Mode

When `denyTools: ["*"]` is combined with `allowedTools`, ONLY the allowed tools are enabled:

```yaml
# Flag config
deny-tools: "*"
allowed-tools: read, grep
```

Result: Only read and grep are enabled, all others are disabled.

### Subtractive Mode

When specific tools are listed in `denyTools`, they are removed from the configuration:

```yaml
# Flag or Agent config
deny-tools: write, bash
```

Result: write and bash are disabled, other tools remain as configured.

## Examples

### Example 1: Secure Read-Only Mode

Create a flag `.opencode/flags/readonly.md`:

```yaml
---
description: Read-only mode for safe operations
deny-tools: write, edit, multiedit, patch, bash
allowed-tools: read, grep, glob, ls
---

Restricts to read-only operations for safety.
```

Usage: `--readonly Analyze this codebase`

### Example 2: Development Mode Command

Create a command `.opencode/commands/dev.md`:

```yaml
---
description: Full development access
allowed-tools: 
  - read
  - write
  - edit
  - multiedit
  - bash
  - grep
  - glob
deny-tools: []
---

Full development access with all tools enabled.
```

Usage: `/dev implement this feature`

### Example 3: Security Audit Configuration

Create an agent configuration:

```json
{
  "agent": {
    "security": {
      "tools": {
        "read": true,
        "grep": true,
        "glob": true
      },
      "allowedTools": ["ls"],
      "denyTools": ["write", "edit", "bash", "patch"]
    }
  }
}
```

## Implementation Details

### File Structure

```
.opencode/
├── flags/
│   ├── safe-mode.md       # Flag with tool restrictions
│   └── verbose.md          # Flag without tool config
├── commands/
│   ├── security.md         # Command with tool config
│   └── analyze.md          # Regular command
└── agents/
    └── custom-agent.json   # Agent configurations
```

### YAML Frontmatter Format

Both flags and commands use YAML frontmatter with consistent fields:

```yaml
---
# For flags (uses camelCase internally after parsing)
allowed-tools: tool1, tool2, tool3
deny-tools: tool4, tool5

# For commands (uses hyphenated keys)
allowed-tools: 
  - tool1
  - tool2
deny-tools: tool3, tool4

# Both support string or array format
---
```

### Tool Names

Available tools include:
- `read` - Read files
- `write` - Write files
- `edit` - Edit files
- `multiedit` - Multiple edits
- `patch` - Apply patches
- `bash` - Execute bash commands
- `grep` - Search in files
- `glob` - File pattern matching
- `ls` - List directories
- `webfetch` - Fetch web resources
- `todoread` - Read todo items (always allowed)
- `todowrite` - Write todo items (always allowed)

### Special Tools

Some tools are ALWAYS allowed regardless of configuration:
- `todoread`
- `todowrite`

These ensure basic task management functionality is always available.

## Technical Implementation

### Key Components

1. **`flags/flags.ts`**
   - Uses `gray-matter` for YAML parsing
   - Converts hyphenated keys to camelCase
   - `extractFlagToolConfig()` extracts tool configurations

2. **`commands/custom.ts`**
   - Uses `gray-matter` for YAML parsing
   - Maintains hyphenated keys
   - `executeCommand()` returns tool configurations

3. **`agent/agent.ts`**
   - Extended schema with `allowedTools` and `denyTools`
   - Loads configurations from files

4. **`tool/filter.ts`**
   - `resolveToolConfig()` - Combines all configurations
   - `isToolEnabled()` - Checks if a tool is allowed
   - Handles precedence and mode logic

5. **`session/index.ts`**
   - Builds complete tool configuration
   - Applies filtering during tool registration

### Resolution Algorithm

```typescript
// Simplified resolution logic
function resolveToolConfig(config) {
  // 1. Start with agent base configuration
  let result = { ...agent.tools, ...agent.allowedTools }
  
  // 2. Apply agent deny list
  for (tool of agent.denyTools) {
    result[tool] = false
  }
  
  // 3. If command has allowedTools, replace with restrictive set
  if (command?.allowedTools) {
    result = onlyThese(command.allowedTools)
  }
  
  // 4. Apply flag modifications based on mode
  if (flags?.denyTools?.includes("*")) {
    // Restrictive mode
    result = onlyThese(flags.allowedTools)
  } else if (flags?.allowedTools) {
    // Additive mode
    result = { ...result, ...toEnabled(flags.allowedTools) }
  }
  
  // 5. Apply flag deny list
  for (tool of flags?.denyTools || []) {
    result[tool] = false
  }
  
  // 6. Input overrides everything
  if (input) {
    result = { ...result, ...input }
  }
  
  return result
}
```

## Best Practices

1. **Use Flags for Temporary Restrictions**
   - Create flags for temporary safety modes
   - Apply restrictions during sensitive operations

2. **Use Commands for Workflow-Specific Tools**
   - Define command-specific tool sets
   - Ensure commands have appropriate access

3. **Configure Agents for Base Behavior**
   - Set reasonable defaults in agent configuration
   - Use agent-level restrictions for security

4. **Test Tool Configurations**
   - Verify tool availability with test commands
   - Check that restrictions work as expected

## Troubleshooting

### Tools Not Available

1. Check if a command is overriding with `allowed-tools`
2. Verify no flags are applying `deny-tools: "*"`
3. Check agent configuration for base restrictions

### Tools Not Restricted

1. Ensure flag/command files have correct frontmatter format
2. Verify the flag/command is being triggered
3. Check precedence - input overrides everything

### Debugging

To debug tool filtering:

1. Check `input.flagTools` and `input.commandTools` in session
2. Verify `agent.allowedTools` and `agent.denyTools` are populated
3. Use `ToolFilter.resolveToolConfig()` to see resolution
4. Test with `ToolFilter.isToolEnabled()` for specific tools

## Security Considerations

1. **Default Deny Strategy**: Consider using restrictive mode for sensitive operations
2. **Audit Tool Access**: Regularly review which tools are available
3. **Principle of Least Privilege**: Only enable tools necessary for the task
4. **Command Isolation**: Use commands to isolate different security contexts

## Migration Notes

If upgrading from an older version:

1. Update flag files to use `allowed-tools` and `deny-tools` (hyphenated)
2. Update command files similarly
3. Agent configurations now support `allowedTools` and `denyTools` arrays
4. The system now uses `gray-matter` for robust YAML parsing