---
description: "Enable verbose logging and development features"
placement: "before"
---

# Development Mode

Enable comprehensive development settings with verbose logging, file watching, and debugging features.

## Features Enabled

- Debug-level logging (`--log-level DEBUG`)
- Console log output (`--print-logs`)
- File watching for auto-reload (`--watch`)
- Automatic reload on changes (`--auto-reload`)

## Best Used For

- Local development
- Debugging issues
- Active coding sessions
- Testing new features

## Example Usage

```bash
supercode --dev-mode run my-script.js
supercode --dev-mode serve --port 3000
```

This flag is equivalent to:
```bash
supercode --log-level DEBUG --print-logs --watch --auto-reload
```