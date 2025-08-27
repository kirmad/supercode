---
description: "Production-optimized settings with minimal logging"
placement: "before"
---

# Production Mode

Optimize settings for production deployment with minimal logging, compression, and performance enhancements.

## Features Enabled

- Warning-level logging only (`--log-level WARN`)
- Disable console output (`--print-logs=false`)
- Enable optimization (`--optimize`)
- Enable minification (`--minify`) 
- Enable compression (`--compress`)

## Best Used For

- Production deployments
- Performance-critical environments
- Minimal resource usage
- Clean production logs

## Example Usage

```bash
supercode --prod-mode build
supercode --prod-mode deploy --target production
```

This flag is equivalent to:
```bash
supercode --log-level WARN --optimize --minify --compress
```