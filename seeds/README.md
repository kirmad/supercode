# OpenCode Seeds

Simple pre-seeding system for OpenCode. Seeds are organized into folders and copied to global configuration during installation.

## Structure

```
seeds/
├── commands/     # TypeScript command definitions
├── flags/        # Markdown flag definitions with YAML frontmatter
├── prompts/      # Markdown prompt templates
└── configs/      # JSON configuration files
```

## Commands

Commands are TypeScript files that export a command using the `cmd()` helper:

```typescript
// commands/example.ts
import { cmd } from "../../packages/opencode/src/cli/cmd/cmd"
import { App } from "../../packages/opencode/src/app/app"

export const ExampleCommand = cmd({
  command: "example",
  describe: "An example command",
  handler: async (argv) => {
    await App.provide({ cwd: process.cwd() }, async () => {
      console.log("Hello from example command!")
    })
  },
})
```

## Flags

Flags are markdown files with YAML frontmatter:

```markdown
---
description: "Enable development features"
placement: "before"
---

# Development Mode

Enable comprehensive development settings.

This flag enables:
- Debug logging
- File watching  
- Auto-reload
```

### Placement Options
- `replace`: Replace the flag reference with content (default)
- `before`: Add content before the main input
- `after`: Add content after the main input

## Prompts

Prompts are markdown templates with variable substitution:

```markdown
# Code Review

Review the following {{language}} code:

```{{language}}
{{code}}
```

Context: {{context}}
```

Variables use `{{variable}}` syntax and can include conditionals.

## Installation

Seeds are automatically installed on first run. You can also manage them manually:

```bash
# Install seeds
supercode seed install

# Reinstall (overwrite existing)
supercode seed reinstall

# Check status
supercode seed status
```

## Usage

Once installed, seeds become available:

- **Commands**: `supercode quickstart`, `supercode gitflow`
- **Flags**: `supercode --dev-mode run script.js`
- **Prompts**: Available in prompt libraries and templates

## Creating Seeds

1. Create files in the appropriate `seeds/` subfolder
2. Follow the format conventions for each type
3. Run `supercode seed install` to copy to global location
4. Test your seeds

Seeds are copied to `~/.config/supercode/` and become globally available.