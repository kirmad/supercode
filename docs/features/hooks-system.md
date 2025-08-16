# Hooks System

## Overview

OpenCode provides an extensible hooks system that allows users to execute custom commands in response to specific events. This enables powerful integrations with external tools, automated workflows, and custom processing pipelines.

## File Locations

### Core Hooks System
- **Hooks Manager**: `packages/opencode/src/config/hooks.ts`
- **Configuration Schema**: `packages/opencode/src/config/config.ts` (experimental.hook section)
- **Git Hooks Setup**: `script/hooks` (development git hooks)

### Event Sources
- **File Events**: `packages/opencode/src/file/index.ts`
- **Session Events**: `packages/opencode/src/session/index.ts`
- **Bus System**: `packages/opencode/src/bus/index.ts`

## Hook Types

### File Edited Hooks

Triggered when files are modified through OpenCode tools (Edit, Write, etc.).

#### Configuration

```json
{
  "experimental": {
    "hook": {
      "file_edited": {
        ".ts": [
          {
            "command": ["npx", "prettier", "--write", "$FILE"],
            "environment": {
              "NODE_ENV": "development"
            }
          }
        ],
        ".js": [
          {
            "command": ["eslint", "--fix", "$FILE"]
          }
        ],
        ".py": [
          {
            "command": ["black", "$FILE"],
            "environment": {
              "PYTHONPATH": "."
            }
          }
        ]
      }
    }
  }
}
```

#### Features
- **File Extension Filtering**: Hooks are triggered based on file extensions
- **Variable Substitution**: `$FILE` is replaced with the actual file path
- **Environment Variables**: Custom environment variables for hook execution
- **Multiple Commands**: Multiple hooks can be configured per file type

#### Use Cases
- **Code Formatting**: Auto-format files after editing (Prettier, Black, etc.)
- **Linting**: Run linters and auto-fix issues
- **Build Triggers**: Trigger builds when specific files change
- **Git Operations**: Auto-stage or commit certain files
- **Documentation Generation**: Update docs when code changes

### Session Completed Hooks

Triggered when a top-level session becomes idle (conversation ends).

#### Configuration

```json
{
  "experimental": {
    "hook": {
      "session_completed": [
        {
          "command": ["git", "add", "."],
          "environment": {
            "GIT_AUTHOR_NAME": "OpenCode",
            "GIT_AUTHOR_EMAIL": "opencode@ai"
          }
        },
        {
          "command": ["npm", "test"]
        }
      ]
    }
  }
}
```

#### Features
- **Session Scope**: Only triggers for top-level sessions (not sub-agent sessions)
- **Sequential Execution**: Commands run in the order specified
- **Custom Environment**: Set environment variables for hook execution
- **Async Execution**: Hooks run in background without blocking the UI

#### Use Cases
- **Auto-commit**: Automatically commit changes after sessions
- **Testing**: Run test suites after code modifications
- **Deployment**: Trigger deployments after successful sessions
- **Notifications**: Send notifications about completed work
- **Cleanup**: Clean up temporary files or resources

## Implementation Details

### Hook Manager

```typescript
// packages/opencode/src/config/hooks.ts
export namespace ConfigHooks {
  export function init() {
    // Subscribe to file edit events
    Bus.subscribe(File.Event.Edited, async (payload) => {
      const cfg = await Config.get()
      const ext = path.extname(payload.properties.file)
      
      for (const item of cfg.experimental?.hook?.file_edited?.[ext] ?? []) {
        log.info("file_edited", {
          file: payload.properties.file,
          command: item.command,
        })
        
        Bun.spawn({
          cmd: item.command.map((x) => x.replace("$FILE", payload.properties.file)),
          env: item.environment,
          cwd: app.path.cwd,
          stdout: "ignore",
          stderr: "ignore",
        })
      }
    })

    // Subscribe to session idle events
    Bus.subscribe(Session.Event.Idle, async (payload) => {
      const cfg = await Config.get()
      if (cfg.experimental?.hook?.session_completed) {
        const session = await Session.get(payload.properties.sessionID)
        
        // Only fire for top-level sessions
        if (session.parentID) return

        for (const item of cfg.experimental.hook.session_completed) {
          Bun.spawn({
            cmd: item.command,
            cwd: App.info().path.cwd,
            env: item.environment,
            stdout: "ignore",
            stderr: "ignore",
          })
        }
      }
    })
  }
}
```

### Configuration Schema

```typescript
// packages/opencode/src/config/config.ts
experimental: z.object({
  hook: z.object({
    file_edited: z.record(
      z.string(),  // File extension (e.g., ".ts", ".py")
      z.object({
        command: z.string().array(),  // Command and arguments
        environment: z.record(z.string(), z.string()).optional()  // Environment variables
      }).array()  // Array of hook configurations
    ).optional(),
    
    session_completed: z.object({
      command: z.string().array(),
      environment: z.record(z.string(), z.string()).optional()
    }).array().optional()
  }).optional()
}).optional()
```

### Event Bus Integration

The hooks system uses OpenCode's event bus for decoupled event handling:

```typescript
// Event subscription pattern
Bus.subscribe(EventType, async (payload) => {
  // Process event and trigger hooks
})

// Event emission (from tools and session management)
Bus.emit(File.Event.Edited, {
  properties: { file: filePath }
})

Bus.emit(Session.Event.Idle, {
  properties: { sessionID: session.id }
})
```

## Git Hooks Integration

### Development Git Hooks

OpenCode includes development git hooks for the project itself:

```bash
#!/bin/sh
# script/hooks - Installed during npm postinstall

mkdir -p .git/hooks

cat > .git/hooks/pre-push << 'EOF'
#!/bin/sh
bun run typecheck
EOF

chmod +x .git/hooks/pre-push
```

#### Features
- **Pre-push Hook**: Runs TypeScript type checking before pushes
- **Automatic Installation**: Installed via `postinstall` script
- **Cross-platform**: Works on Unix and Windows systems

## Configuration Examples

### Code Quality Workflow

```json
{
  "experimental": {
    "hook": {
      "file_edited": {
        ".ts": [
          {
            "command": ["npx", "prettier", "--write", "$FILE"],
            "environment": {
              "NODE_ENV": "development"
            }
          },
          {
            "command": ["npx", "eslint", "--fix", "$FILE"]
          }
        ],
        ".tsx": [
          {
            "command": ["npx", "prettier", "--write", "$FILE"]
          }
        ]
      },
      "session_completed": [
        {
          "command": ["npm", "run", "typecheck"]
        },
        {
          "command": ["npm", "test", "--", "--passWithNoTests"]
        }
      ]
    }
  }
}
```

### Auto-commit Workflow

```json
{
  "experimental": {
    "hook": {
      "session_completed": [
        {
          "command": ["git", "add", "."],
          "environment": {
            "GIT_AUTHOR_NAME": "OpenCode Assistant",
            "GIT_AUTHOR_EMAIL": "assistant@opencode.ai"
          }
        },
        {
          "command": ["git", "commit", "-m", "Auto-commit: OpenCode session completed"],
          "environment": {
            "GIT_AUTHOR_NAME": "OpenCode Assistant",
            "GIT_AUTHOR_EMAIL": "assistant@opencode.ai"
          }
        }
      ]
    }
  }
}
```

### Documentation Generation

```json
{
  "experimental": {
    "hook": {
      "file_edited": {
        ".ts": [
          {
            "command": ["typedoc", "--out", "docs/api", "src/"]
          }
        ],
        ".md": [
          {
            "command": ["markdownlint", "--fix", "$FILE"]
          }
        ]
      }
    }
  }
}
```

### Multi-language Support

```json
{
  "experimental": {
    "hook": {
      "file_edited": {
        ".py": [
          {
            "command": ["black", "$FILE"],
            "environment": {
              "PYTHONPATH": "."
            }
          },
          {
            "command": ["flake8", "$FILE"]
          }
        ],
        ".go": [
          {
            "command": ["gofmt", "-w", "$FILE"]
          },
          {
            "command": ["golint", "$FILE"]
          }
        ],
        ".rs": [
          {
            "command": ["rustfmt", "$FILE"]
          },
          {
            "command": ["cargo", "clippy", "--", "--deny", "warnings"]
          }
        ]
      }
    }
  }
}
```

## Best Practices

### Security Considerations
- **Command Validation**: Be careful with command injection when using variable substitution
- **Environment Isolation**: Use environment variables to control tool behavior
- **Path Validation**: Validate file paths before processing
- **Permission Checks**: Ensure hooks don't have excessive permissions

### Performance Optimization
- **Async Execution**: Hooks run asynchronously to avoid blocking the UI
- **Resource Limits**: Consider resource usage of hook commands
- **Conditional Execution**: Use file extension filtering to limit hook execution
- **Error Handling**: Hooks should handle errors gracefully

### Configuration Management
- **Project-specific**: Use local `opencode.json` for project-specific hooks
- **Global Configuration**: Use global config for user-wide hooks
- **Version Control**: Consider whether to commit hook configurations
- **Documentation**: Document hook purposes and requirements

### Common Patterns

#### Formatting Chain
```json
{
  "file_edited": {
    ".ts": [
      { "command": ["prettier", "--write", "$FILE"] },
      { "command": ["eslint", "--fix", "$FILE"] },
      { "command": ["tsc", "--noEmit", "--skipLibCheck"] }
    ]
  }
}
```

#### Conditional Hooks
```json
{
  "file_edited": {
    ".ts": [
      {
        "command": ["sh", "-c", "if [ -f package.json ]; then npm run format; fi"],
        "environment": {
          "FILE_PATH": "$FILE"
        }
      }
    ]
  }
}
```

#### Build Pipeline
```json
{
  "session_completed": [
    { "command": ["npm", "run", "build"] },
    { "command": ["npm", "run", "test"] },
    { "command": ["docker", "build", "-t", "myapp", "."] }
  ]
}
```

## Troubleshooting

### Common Issues

#### Hooks Not Executing
- Check that `experimental.hook` is properly configured
- Verify file extensions match exactly (case-sensitive)
- Ensure commands are in PATH or use absolute paths
- Check OpenCode logs for hook execution messages

#### Command Failures
- Test commands manually in the same directory
- Verify environment variables are set correctly
- Check file permissions for executables
- Use absolute paths for commands if needed

#### Performance Issues
- Limit hook complexity and execution time
- Use background processes for long-running tasks
- Consider debouncing for frequently edited files
- Monitor system resource usage

### Debugging

Enable debug logging to troubleshoot hook execution:

```bash
DEBUG=opencode:config.hooks opencode
```

This will show detailed information about:
- Hook detection and execution
- Command parameters and environment
- File paths and extensions
- Session lifecycle events

### Migration Guide

When upgrading from older versions:

1. **Check Configuration**: Ensure hooks are under `experimental.hook`
2. **Update Paths**: Use absolute paths if relative paths fail
3. **Test Commands**: Verify all hook commands work manually
4. **Environment Variables**: Check that required environment variables are available
5. **File Extensions**: Ensure file extension patterns are correct