# Custom Commands Output Style

## Overview

Custom commands in SuperCode can now specify their preferred output style directly in the frontmatter. This allows each command to control how the AI assistant responds, choosing between different communication styles like explanatory, learning-focused, or the default concise style.

## How It Works

When a custom command is executed:
1. The command's frontmatter is parsed for the `output-style` field
2. If specified, this style overrides the global output style configuration for that specific command execution
3. The AI assistant uses the specified style when generating responses

## Configuration

Add the `output-style` field to your custom command's frontmatter:

```yaml
---
description: "Your command description"
argument-hint: "[arguments]"
output-style: "explanatory"  # Choose: default, explanatory, learning, or custom styles
---

# Your command content here
```

## Available Output Styles

### Built-in Styles

- **default**: Concise and direct responses (default if not specified)
- **explanatory**: Educational insights with helpful explanations
- **learning**: Learning-focused with detailed explanations

### Custom Styles

You can also create custom output styles in:
- Project level: `.opencode/custom-outputs/[style-name].md`
- Global level: `~/.opencode/custom-outputs/[style-name].md`

## Examples

### Command with Explanatory Style

```markdown
---
description: "Implement a new feature with detailed explanations"
output-style: "explanatory"
---

# Implementation Guide

I'll implement this feature and explain each step...
```

### Command with Learning Style

```markdown
---
description: "Learn about a programming concept"
output-style: "learning"
---

# Learning Topic: $ARGUMENTS

Let's explore this topic with detailed educational content...
```

### Command Using Default Style

```markdown
---
description: "Quick task execution"
# No output-style specified, uses global default
---

# Execute: $ARGUMENTS

Performing the requested task...
```

## Priority Order

The output style is determined in this order:
1. **Command frontmatter** `output-style` field (highest priority)
2. **Global configuration** `outputStyle` setting
3. **System default** ("default" style)

## Use Cases

- **Tutorial Commands**: Use "learning" style for educational commands
- **Implementation Commands**: Use "explanatory" style for complex implementations
- **Quick Actions**: Use "default" style for simple, direct tasks
- **Domain-Specific**: Create custom styles for specialized domains

## Testing

Test commands are available in `.opencode/commands/`:
- `/test-output-style` - Tests explanatory style
- `/test-learning-style` - Tests learning style
- `/test-default-style` - Tests default style behavior

## Technical Implementation

The feature is implemented in:
- `packages/opencode/src/commands/custom.ts` - Frontmatter parsing and extraction
- `packages/opencode/src/session/index.ts` - Output style application in sessions
- `packages/opencode/src/output-style/output-style.ts` - Style management system
- `packages/opencode/src/server/server.ts` - TUI communication endpoints
- `packages/opencode/src/server/tui.ts` - TUI helper functions
- `packages/tui/internal/tui/tui.go` - TUI output style handlers

### TUI Integration

The TUI can be queried for its current output style:
- **Endpoint**: `GET /tui/get-output-style`
- **Helper**: `getTUIOutputStyle()` function in `server/tui.ts`
- **Response**: `{ styleName: string }` with the current style