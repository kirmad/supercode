# Tool Description Override System

This directory contains tool description overrides that allow you to customize how tools are described and behave.

## How it Works

The tool description override system follows a 3-tier priority system:

1. **Project-level**: `.opencode/prompts/tools/<toolname>.md` (highest priority)
2. **Global-level**: `~/.opencode/prompts/tools/<toolname>.md` (medium priority)  
3. **Built-in**: Original tool descriptions (lowest priority)

## Supported Formats

- `.md` files (recommended for rich formatting)
- `.txt` files (for simple text descriptions)

## Regular Tools

For built-in tools like `todowrite`, `bash`, `edit`, etc., use the tool's name:

```
todowrite.md       # Override TodoWrite tool
bash.md           # Override Bash tool  
edit.md           # Override Edit tool
webfetch.md       # Override WebFetch tool
```

## MCP Tools

For MCP (Model Context Protocol) tools, use the format: `<server-name>_<tool-name>.md`

```
context7_resolve-library-id.md           # Override Context7 library resolver
context7_get-library-docs.md             # Override Context7 docs fetcher
playwright_browser_navigate.md           # Override Playwright navigation
sequential_thinking_sequentialthinking.md # Override Sequential thinking tool
```

## Creating Overrides

1. Create a file with the appropriate name in this directory
2. Write your custom description using Markdown or plain text
3. The system will automatically use your description instead of the built-in one

## Examples

See the included example files:
- `todowrite.md` - Example regular tool override
- `context7_resolve-library-id.md` - Example MCP tool override

## Benefits

- **Project-specific customization** - Tailor tools for your project's needs
- **Enhanced instructions** - Add your own usage guidelines  
- **Context-aware behavior** - Provide domain-specific guidance
- **Consistent experience** - Maintain your preferred tool behaviors across sessions

## Installation

Tool description overrides are automatically copied from the `seeds/prompts/tools/` directory to your global configuration when you first run the application.