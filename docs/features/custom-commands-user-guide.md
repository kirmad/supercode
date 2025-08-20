# Custom Commands User Guide

## Overview

Custom Commands allow you to create reusable, templated prompts that streamline your workflow with OpenCode. Commands are stored as Markdown files and accessible through intelligent autocomplete in the TUI.

## Getting Started

### Creating Your First Command

1. **Create the Commands Directory**:
   ```bash
   mkdir -p .opencode/commands/personal
   ```

2. **Create a Command File**:
   `.opencode/commands/personal/hello.md`
   ```markdown
   ---
   description: "A simple greeting command"
   examples:
     - "/personal:hello World"
     - "/personal:hello --formal OpenCode Team"
   ---

   # Hello Command

   Please provide a friendly greeting to {{args}}.

   If the --formal flag is used, make it professional and courteous.
   Otherwise, keep it casual and warm.
   ```

3. **Use the Command**:
   - Open OpenCode TUI
   - Type `/personal:hello` and press Tab to autocomplete
   - Add your arguments: `/personal:hello --formal the development team`
   - Press Enter to execute

## Command Structure

### File Organization

Commands follow a namespace pattern:
```
.opencode/commands/{namespace}/{command}.md
```

**Examples**:
- `.opencode/commands/dev/review.md` → `/dev:review`
- `.opencode/commands/team/standup.md` → `/team:standup`  
- `.opencode/commands/personal/notes.md` → `/personal:notes`

### Nested Commands

You can create nested command structures:
```
.opencode/commands/api/
├── create.md          → /api:create
├── debug.md           → /api:debug
└── auth/
    ├── login.md       → /api:auth:login
    └── permissions.md → /api:auth:permissions
```

## Command Syntax

### Basic Structure

```markdown
---
# Optional YAML frontmatter
description: "Brief description of the command"
args: ["--flag1", "--flag2", "--option"]
examples:
  - "/namespace:command example usage"
tags: ["development", "debugging"]
author: "Your Name"
---

# Command Title

Your command content here...

Use {{args}} to insert user arguments.
```

### Frontmatter Properties

| Property | Type | Description |
|----------|------|-------------|
| `description` | string | Brief description shown in autocomplete |
| `args` | array | Expected arguments/flags |
| `examples` | array | Usage examples for documentation |
| `tags` | array | Categorization tags |
| `author` | string | Command author |
| `version` | string | Command version |

### Template Variables

- `{{args}}` - Replaced with user-provided arguments
- More template variables may be added in future versions

## Common Use Cases

### Development Commands

**Code Review** (`.opencode/commands/dev/review.md`):
```markdown
---
description: "Perform thorough code review"
args: ["--security", "--performance", "--style"]
examples:
  - "/dev:review --security auth.ts"
  - "/dev:review --performance database queries"
---

# Code Review

Please perform a comprehensive code review of {{args}}.

## Review Checklist
- [ ] Code correctness and logic
- [ ] Security vulnerabilities
- [ ] Performance implications
- [ ] Code style and conventions
- [ ] Test coverage
- [ ] Documentation

Focus areas based on flags:
- `--security`: Extra attention to security issues
- `--performance`: Focus on performance optimization
- `--style`: Emphasize code style and conventions
```

**Bug Investigation** (`.opencode/commands/debug/investigate.md`):
```markdown
---
description: "Systematically investigate bugs"
examples:
  - "/debug:investigate user login fails intermittently"
---

# Bug Investigation

I need help investigating this issue: {{args}}

## Investigation Process
1. **Reproduce**: Can we reproduce the issue consistently?
2. **Isolate**: What are the minimal steps to trigger it?
3. **Analyze**: What could be causing this behavior?
4. **Hypotheses**: What are the most likely root causes?
5. **Test**: How can we verify each hypothesis?
6. **Fix**: What's the safest way to resolve it?

Please start with step 1 and guide me through the investigation.
```

### Team Collaboration

**Daily Standup** (`.opencode/commands/team/standup.md`):
```markdown
---
description: "Generate standup update"
examples:
  - "/team:standup worked on authentication, blocked by API rate limits"
---

# Daily Standup Update

Help me prepare my standup update based on: {{args}}

## Template
**Yesterday**: What did I complete?
**Today**: What am I working on?
**Blockers**: What's preventing progress?

Please format this professionally and include any relevant technical details.
```

**Meeting Notes** (`.opencode/commands/team/notes.md`):
```markdown
---
description: "Structure meeting notes"
examples:
  - "/team:notes sprint planning, discussed user stories 123-127"
---

# Meeting Notes

Please help me create structured meeting notes for: {{args}}

## Format
- **Date**: [Today's date]
- **Attendees**: [To be filled]
- **Agenda**: 
- **Key Decisions**:
- **Action Items**:
- **Next Steps**:

Use the provided context to fill in relevant details.
```

### Documentation Commands

**API Documentation** (`.opencode/commands/docs/api.md`):
```markdown
---
description: "Generate API documentation"
args: ["--openapi", "--examples", "--auth"]
---

# API Documentation

Please create comprehensive API documentation for {{args}}.

## Required Sections
1. **Overview**: Purpose and functionality
2. **Endpoints**: All available routes
3. **Request/Response**: Format and examples
4. **Authentication**: Security requirements
5. **Error Handling**: Error codes and messages
6. **Rate Limits**: Usage restrictions

Special focus areas:
- `--openapi`: Generate OpenAPI/Swagger spec
- `--examples`: Include detailed examples
- `--auth`: Emphasize authentication details
```

### Personal Productivity

**Task Planning** (`.opencode/commands/personal/plan.md`):
```markdown
---
description: "Break down complex tasks"
examples:
  - "/personal:plan implement user authentication system"
---

# Task Planning

Help me break down this task: {{args}}

## Planning Framework
1. **Requirements**: What needs to be accomplished?
2. **Dependencies**: What must be done first?
3. **Subtasks**: Break into smaller, actionable items
4. **Timeline**: Estimate effort and sequence
5. **Risks**: What could go wrong?
6. **Success Criteria**: How will we know it's done?

Please create a detailed action plan with prioritized steps.
```

## Advanced Features

### Command Chaining

While not directly supported, you can reference other commands in your templates:

```markdown
# Complex Analysis

First, let me do a basic review:
<!-- User can run /dev:review after this command -->

Then we'll need to check security:
<!-- User can run /security:audit separately -->

Finally, performance testing:
<!-- User can run /perf:benchmark -->

For now, let's start with: {{args}}
```

### Conditional Logic

Use descriptive text to guide AI behavior:

```markdown
# Smart Code Review

Please review {{args}}.

**Instructions**:
- If this is a security-related change, pay extra attention to authentication and authorization
- If this touches the database, verify transaction handling and data integrity
- If this is a public API, ensure backward compatibility
- If this includes tests, verify they cover edge cases
```

### Context-Aware Commands

Commands can reference project structure:

```markdown
# Project Analysis

Analyze {{args}} in the context of our project structure.

**Consider**:
- How this fits with our existing architecture
- Dependencies on other modules in this project
- Consistency with our coding standards
- Impact on the overall system design

Please provide specific recommendations for our codebase.
```

## Best Practices

### Naming Conventions

1. **Namespaces**: Use clear, descriptive namespace names
   - `dev` for development tasks
   - `team` for collaboration
   - `docs` for documentation
   - `debug` for troubleshooting

2. **Commands**: Use verb-based names
   - `create`, `analyze`, `review`, `fix`, `test`
   - Avoid abbreviations when possible

3. **File Names**: Match command names exactly
   - `/dev:review` → `dev/review.md`
   - `/api:auth:login` → `api/auth/login.md`

### Content Guidelines

1. **Be Specific**: Clear, actionable instructions work better than vague requests
2. **Provide Context**: Include relevant background information
3. **Use Structure**: Organize content with headers, lists, and sections
4. **Include Examples**: Show expected usage patterns
5. **Consider Edge Cases**: Address common variations and exceptions

### Template Design

1. **Single Responsibility**: Each command should have one clear purpose
2. **Flexible Arguments**: Design `{{args}}` to handle various input formats
3. **Fallback Behavior**: Provide default behavior when arguments are minimal
4. **Progressive Enhancement**: Basic usage should be simple, advanced usage possible

## Command Management

### Organizing Large Collections

For teams with many commands, consider this structure:

```
.opencode/commands/
├── core/                 # Essential, frequently-used commands
│   ├── review.md
│   ├── analyze.md
│   └── fix.md
├── specialized/          # Domain-specific commands
│   ├── frontend/
│   ├── backend/
│   └── devops/
├── team/                 # Collaboration commands
│   ├── standup.md
│   └── planning.md
└── experimental/         # New or testing commands
    └── prototype.md
```

### Version Control

1. **Include in Git**: Commands are part of your project configuration
2. **Team Sharing**: Commit useful commands for team adoption
3. **Documentation**: Maintain a team guide for available commands
4. **Review Process**: Consider PR reviews for new team-wide commands

### Command Discovery

Use the TUI's autocomplete to explore available commands:

1. Type `/` to see all available commands
2. Type namespace prefix to filter: `/dev` shows development commands
3. Use fuzzy search: `/rev` might match `/dev:review`
4. Check command descriptions in the autocomplete dropdown

## Troubleshooting

### Common Issues

**Command Not Appearing in Autocomplete**:
- Check file is in `.opencode/commands/` directory
- Verify file has `.md` extension
- Ensure proper namespace/command structure
- Wait a moment for file watching to detect changes

**Command Content Not Updated**:
- File watching should detect changes automatically
- Restart OpenCode server if needed
- Check file permissions

**Template Substitution Not Working**:
- Verify `{{args}}` syntax is correct
- Check for typos in variable names
- Arguments are passed exactly as typed after command name

**Syntax Errors in Frontmatter**:
- YAML frontmatter must be valid
- Use proper indentation (spaces, not tabs)
- Quote strings containing special characters

### Getting Help

1. **Check Logs**: OpenCode server logs show command loading and execution
2. **Validate Structure**: Ensure file paths match expected command names
3. **Test Incrementally**: Start with simple commands before complex ones
4. **Community**: Share useful commands with the OpenCode community

## Examples Repository

### Complete Command Examples

See the [Custom Commands Examples](./custom-commands-examples.md) document for a comprehensive collection of ready-to-use commands covering:

- Development workflows
- Code review processes
- Documentation generation
- Team collaboration
- Project management
- Debugging procedures
- Performance optimization
- Security analysis

Each example includes:
- Complete command file content
- Usage instructions
- Customization tips
- Related commands for workflows