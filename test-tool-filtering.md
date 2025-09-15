# Test Tool Filtering Implementation

## Test Custom Command
Create this file at `.opencode/commands/test/limited.md`:

```markdown
---
description: Test command with limited tools
allowed-tools: read, write, edit, Bash(git status:*), Bash(git diff:*)
deny-tools: webfetch
---

This is a test command that only allows specific tools:
- read, write, edit tools are allowed
- Only git status and git diff bash commands are allowed
- webfetch is explicitly denied

$ARGUMENTS
```

## Test Flag
Create this file at `.opencode/flags/test/notools.md`:

```markdown
---
description: Flag that disables most tools
placement: before
deny-tools: bash, webfetch, task
allowed-tools: read, write
---

This flag limits tools to only read and write operations.
```

## Usage Examples

### 1. Using a custom command with tool restrictions:
```
/test:limited analyze the codebase
```

This will only allow:
- read, write, edit tools
- git status and git diff bash commands
- No webfetch

### 2. Using a flag to restrict tools:
```
--test:notools please analyze the code
```

This will:
- Deny bash, webfetch, and task tools
- Only allow read and write tools

### 3. Combining flags and commands:
Flags have higher precedence than commands. If you use both, the flag restrictions will override command restrictions.

## Tool Pattern Examples

The implementation supports various patterns:

1. **Simple tool names**: `read`, `write`, `edit`, `bash`

2. **Bash command patterns**: 
   - `Bash(git add:*)` - Allow git add with any arguments
   - `Bash(git status:*)` - Allow git status with any arguments
   - `Bash(npm:*)` - Allow all npm commands

3. **MCP tool patterns**:
   - `context7_*` - Allow all context7 MCP tools
   - `mcp__*` - Allow all MCP tools

4. **Wildcard patterns**:
   - `*` - Allow all tools
   - `todo*` - Allow todoread and todowrite

## Precedence Rules

The tool filtering follows this precedence (highest to lowest):
1. **Flag tools** - Tools specified in flag front matter
2. **Command tools** - Tools specified in command front matter  
3. **Agent tools** - Tools specified in agent configuration
4. **Input tools** - Tools passed directly to the prompt

## Front Matter Format

Both commands and flags support the same front matter format:

```yaml
---
allowed-tools: tool1, tool2, Bash(command:*), pattern_*
deny-tools: tool3, tool4
---
```

The tools can be specified as:
- Comma-separated string: `"read, write, edit"`
- YAML array:
  ```yaml
  allowed-tools:
    - read
    - write
    - edit
  ```

## Testing the Implementation

1. Create a custom command with tool restrictions
2. Create a flag with different tool restrictions
3. Test that the command properly limits tools
4. Test that the flag overrides command restrictions
5. Test that patterns work correctly (e.g., `Bash(git:*)`)
6. Verify the precedence order is correct