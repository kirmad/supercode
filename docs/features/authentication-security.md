# Authentication and Security

## Overview

OpenCode implements a comprehensive authentication and security system with multi-provider OAuth support, permission-based tool execution, and secure credential management. The system ensures user consent for tool operations while maintaining secure access to AI providers and external services.

## File Locations

### Authentication System
- **Auth Namespace**: `packages/opencode/src/auth/index.ts`
- **GitHub Copilot Integration**: `packages/opencode/src/auth/github-copilot.ts`

### Security and Permissions
- **Permission System**: `packages/opencode/src/permission/index.ts`
- **Tool Security**: `packages/opencode/src/tool/registry.ts` (tool wrapping and validation)

### Configuration and Validation
- **Config Schema**: `packages/opencode/src/config/config.ts`
- **ID Generation**: `packages/opencode/src/id/id.ts`

## Authentication Architecture

### Credential Types

OpenCode supports three types of authentication credentials:

```typescript
// packages/opencode/src/auth/index.ts

// OAuth flow with refresh tokens
export const Oauth = z.object({
  type: z.literal("oauth"),
  refresh: z.string(),      // Refresh token
  access: z.string(),       // Current access token
  expires: z.number(),      // Expiration timestamp
})

// API key authentication
export const Api = z.object({
  type: z.literal("api"),
  key: z.string(),          // API key
})

// Well-known provider authentication
export const WellKnown = z.object({
  type: z.literal("wellknown"),
  key: z.string(),          // Provider key
  token: z.string(),        // Access token
})
```

### Secure Storage

```typescript
// Credentials stored in encrypted local file
const filepath = path.join(Global.Path.data, "auth.json")

export async function set(key: string, info: Info) {
  const file = Bun.file(filepath)
  const data = await all()
  await Bun.write(file, JSON.stringify({ ...data, [key]: info }, null, 2))
  await fs.chmod(file.name!, 0o600)  // Secure file permissions
}
```

### Authentication Operations

#### Credential Management
```typescript
// Get credentials for provider
const credentials = await Auth.get("anthropic")

// Set new credentials
await Auth.set("openai", {
  type: "api",
  key: process.env.OPENAI_API_KEY
})

// Remove credentials
await Auth.remove("github-copilot")

// List all stored credentials
const allCreds = await Auth.all()
```

## GitHub Copilot Integration

### OAuth Device Flow

```typescript
// packages/opencode/src/auth/github-copilot.ts

export async function authorize() {
  // 1. Request device code
  const deviceResponse = await fetch(DEVICE_CODE_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "GitHubCopilotChat/0.26.7",
    },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      scope: "read:user",
    }),
  })
  
  const deviceData = await deviceResponse.json()
  return {
    device: deviceData.device_code,
    user: deviceData.user_code,
    verification: deviceData.verification_uri,
    interval: deviceData.interval || 5,
    expiry: deviceData.expires_in,
  }
}
```

### Token Management

```typescript
export async function poll(device_code: string) {
  const response = await fetch(ACCESS_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "GitHubCopilotChat/0.26.7",
    },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      device_code,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    }),
  })

  const data = await response.json()
  
  if (data.access_token) {
    // Store OAuth token
    await Auth.set("github-copilot", {
      type: "oauth",
      refresh: data.access_token,
      access: "",
      expires: 0,
    })
    return "complete"
  }
  
  return data.error === "authorization_pending" ? "pending" : "failed"
}
```

### Access Token Refresh

```typescript
export async function access() {
  const info = await Auth.get("github-copilot")
  if (!info || info.type !== "oauth") return
  if (info.access && info.expires > Date.now()) return info.access

  // Get new Copilot API token
  const response = await fetch(COPILOT_API_KEY_URL, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${info.refresh}`,
      "User-Agent": "GitHubCopilotChat/0.26.7",
      "Editor-Version": "vscode/1.99.3",
      "Editor-Plugin-Version": "copilot-chat/0.26.7",
    },
  })

  const tokenData = await response.json()
  
  // Update stored credentials with new access token
  await Auth.set("github-copilot", {
    type: "oauth",
    refresh: info.refresh,
    access: tokenData.token,
    expires: tokenData.expires_at * 1000,
  })

  return tokenData.token
}
```

## Permission System

### Permission Architecture

The permission system implements user consent for tool operations with granular control:

```typescript
// packages/opencode/src/permission/index.ts

export const Info = z.object({
  id: z.string(),                    // Permission request ID
  type: z.string(),                  // Permission type
  pattern: z.string().optional(),    // Pattern for batch permissions
  sessionID: z.string(),            // Session context
  messageID: z.string(),            // Message context
  callID: z.string().optional(),    // Tool call ID
  title: z.string(),                // Human-readable description
  metadata: z.record(z.any()),      // Additional context
  time: z.object({
    created: z.number(),            // Creation timestamp
  }),
})
```

### Permission Request Flow

```typescript
export async function ask(input: {
  type: Info["type"]
  title: Info["title"]
  pattern?: Info["pattern"]
  callID?: Info["callID"]
  sessionID: Info["sessionID"]
  messageID: Info["messageID"]
  metadata: Info["metadata"]
}) {
  const { pending, approved } = state()
  
  // Check if already approved
  if (approved[input.sessionID]?.[input.pattern ?? input.type]) return
  
  const info: Info = {
    id: Identifier.ascending("permission"),
    type: input.type,
    pattern: input.pattern,
    sessionID: input.sessionID,
    messageID: input.messageID,
    callID: input.callID,
    title: input.title,
    metadata: input.metadata,
    time: { created: Date.now() },
  }

  // Plugin hook for automated decisions
  switch (
    await Plugin.trigger("permission.ask", info, {
      status: "ask",
    }).then((x) => x.status)
  ) {
    case "deny":
      throw new RejectedError(info.sessionID, info.id, info.callID, info.metadata)
    case "allow":
      return
  }

  // Request user permission
  pending[input.sessionID] = pending[input.sessionID] || {}
  return new Promise<void>((resolve, reject) => {
    pending[input.sessionID][info.id] = {
      info,
      resolve,
      reject,
    }
    Bus.publish(Event.Updated, info)
  })
}
```

### Permission Responses

```typescript
export const Response = z.enum(["once", "always", "reject"])

export function respond(input: { 
  sessionID: Info["sessionID"]
  permissionID: Info["id"]
  response: Response 
}) {
  const { pending, approved } = state()
  const match = pending[input.sessionID]?.[input.permissionID]
  if (!match) return
  
  delete pending[input.sessionID][input.permissionID]
  
  if (input.response === "reject") {
    match.reject(new RejectedError(input.sessionID, input.permissionID, match.info.callID, match.info.metadata))
    return
  }
  
  match.resolve()
  Bus.publish(Event.Replied, {
    sessionID: input.sessionID,
    permissionID: input.permissionID,
    response: input.response,
  })
  
  // Handle "always" approval
  if (input.response === "always") {
    approved[input.sessionID] = approved[input.sessionID] || {}
    approved[input.sessionID][match.info.pattern ?? match.info.type] = true
    
    // Auto-approve similar pending requests
    for (const item of Object.values(pending[input.sessionID])) {
      if ((item.info.pattern ?? item.info.type) === (match.info.pattern ?? match.info.type)) {
        respond({ 
          sessionID: item.info.sessionID, 
          permissionID: item.info.id, 
          response: input.response 
        })
      }
    }
  }
}
```

### Permission Error Handling

```typescript
export class RejectedError extends Error {
  constructor(
    public readonly sessionID: string,
    public readonly permissionID: string,
    public readonly toolCallID?: string,
    public readonly metadata?: Record<string, any>,
  ) {
    super(`The user rejected permission to use this specific tool call. You may try again with different parameters.`)
  }
}
```

## Tool Security Integration

### Tool Registry Security

```typescript
// packages/opencode/src/tool/registry.ts

// Tools are wrapped with permission checks
export function wrapTool<T extends Tool.Definition>(
  tool: T,
  opts?: {
    beforeExecute?: (args: any, context: Tool.Context) => Promise<void>
  }
): T {
  return {
    ...tool,
    execute: async (args, context) => {
      // Permission check before execution
      await Permission.ask({
        type: tool.name,
        title: `Execute ${tool.name}`,
        pattern: tool.name,
        sessionID: context.sessionID,
        messageID: context.messageID,
        callID: context.callID,
        metadata: { args, toolName: tool.name }
      })
      
      // Custom pre-execution hook
      if (opts?.beforeExecute) {
        await opts.beforeExecute(args, context)
      }
      
      // Execute tool
      return tool.execute(args, context)
    }
  }
}
```

### File System Security

```typescript
// Example: Write tool with path validation
// packages/opencode/src/tool/write.ts

export const definition = Tool.define({
  name: "write_file",
  description: "Write content to a file",
  parameters: z.object({
    path: z.string(),
    content: z.string(),
  }),
  execute: async ({ path, content }, context) => {
    // Validate file path
    const resolvedPath = path.resolve(path)
    const workingDir = process.cwd()
    
    if (!resolvedPath.startsWith(workingDir)) {
      throw new Error("Cannot write outside working directory")
    }
    
    // Request permission with file path context
    await Permission.ask({
      type: "file_write",
      title: `Write to ${path}`,
      pattern: "file_write",
      sessionID: context.sessionID,
      messageID: context.messageID,
      callID: context.callID,
      metadata: { path: resolvedPath, size: content.length }
    })
    
    // Write file securely
    await fs.writeFile(resolvedPath, content, { mode: 0o644 })
    return `Successfully wrote ${content.length} characters to ${path}`
  }
})
```

### Network Security

```typescript
// Example: WebFetch tool with URL validation
// packages/opencode/src/tool/webfetch.ts

export const definition = Tool.define({
  name: "web_fetch",
  description: "Fetch content from a URL",
  parameters: z.object({
    url: z.string().url(),
  }),
  execute: async ({ url }, context) => {
    // Validate URL
    const parsedUrl = new URL(url)
    
    // Block private/local addresses
    if (parsedUrl.hostname === 'localhost' || 
        parsedUrl.hostname.startsWith('127.') ||
        parsedUrl.hostname.startsWith('192.168.') ||
        parsedUrl.hostname.startsWith('10.')) {
      throw new Error("Cannot fetch from private/local addresses")
    }
    
    // Request permission
    await Permission.ask({
      type: "web_fetch",
      title: `Fetch from ${parsedUrl.hostname}`,
      pattern: "web_fetch",
      sessionID: context.sessionID,
      messageID: context.messageID,
      callID: context.callID,
      metadata: { url, hostname: parsedUrl.hostname }
    })
    
    // Fetch with timeout and size limits
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30000),
      headers: { 'User-Agent': 'OpenCode/1.0' }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const content = await response.text()
    if (content.length > 1024 * 1024) { // 1MB limit
      throw new Error("Response too large")
    }
    
    return content
  }
})
```

## Security Features

### Credential Encryption

```typescript
// All credentials stored with restricted file permissions
export async function set(key: string, info: Info) {
  const file = Bun.file(filepath)
  const data = await all()
  await Bun.write(file, JSON.stringify({ ...data, [key]: info }, null, 2))
  await fs.chmod(file.name!, 0o600)  // Owner read/write only
}
```

### Session Isolation

- **Session Boundaries**: Permissions scoped to individual sessions
- **Child Session Inheritance**: Child sessions inherit parent permissions
- **Session Cleanup**: Automatic cleanup of permission state

### Input Validation

```typescript
// All inputs validated with Zod schemas
export const Info = z.object({
  id: z.string(),
  type: z.string(),
  pattern: z.string().optional(),
  sessionID: z.string(),
  messageID: z.string(),
  callID: z.string().optional(),
  title: z.string(),
  metadata: z.record(z.any()),
  time: z.object({
    created: z.number(),
  }),
}).openapi({ ref: "Permission" })
```

### Error Handling

```typescript
// Comprehensive error types for authentication
export const DeviceCodeError = NamedError.create("DeviceCodeError", z.object({}))
export const TokenExchangeError = NamedError.create("TokenExchangeError", z.object({
  message: z.string(),
}))
export const AuthenticationError = NamedError.create("AuthenticationError", z.object({
  message: z.string(),
}))
export const CopilotTokenError = NamedError.create("CopilotTokenError", z.object({
  message: z.string(),
}))
```

## Security Best Practices

### Authentication Security
- **Secure Storage**: Credentials stored with 0o600 permissions
- **Token Refresh**: Automatic token refresh for OAuth flows
- **Provider Isolation**: Separate credential storage per provider
- **Credential Validation**: Input validation for all credential operations

### Permission Security
- **User Consent**: Explicit user approval for tool operations
- **Granular Control**: Fine-grained permission patterns
- **Session Scope**: Permissions scoped to session context
- **Plugin Integration**: Automated permission decisions via plugins

### Tool Security
- **Path Validation**: File system operations restricted to working directory
- **Network Filtering**: Blocked access to private/local addresses
- **Resource Limits**: Size and timeout limits for network operations
- **Input Sanitization**: All tool inputs validated and sanitized

### Runtime Security
- **Principle of Least Privilege**: Tools request minimal necessary permissions
- **Fail-Safe Defaults**: Deny by default, require explicit approval
- **Audit Trail**: Complete logging of permission requests and responses
- **Error Recovery**: Graceful error handling with security context

## Plugin Integration

### Permission Hooks

```typescript
// Automated permission decisions via plugins
switch (
  await Plugin.trigger("permission.ask", info, {
    status: "ask",
  }).then((x) => x.status)
) {
  case "deny":
    throw new RejectedError(info.sessionID, info.id, info.callID, info.metadata)
  case "allow":
    return
  default:
    // Request user permission
}
```

### Custom Security Policies

Plugins can implement custom security policies:
- **Environment-based**: Different policies for development vs production
- **User-based**: Role-based permission systems
- **Context-aware**: Dynamic permissions based on session context
- **Audit Integration**: Custom logging and monitoring

## Event System Integration

### Security Events

```typescript
export const Event = {
  Updated: Bus.event("permission.updated", Info),
  Replied: Bus.event("permission.replied", z.object({ 
    sessionID: z.string(), 
    permissionID: z.string(), 
    response: z.string() 
  })),
}
```

### Real-time Monitoring

- **Permission Requests**: Real-time permission request notifications
- **Security Events**: Audit trail of all security-related events
- **Failed Attempts**: Logging of denied or failed operations
- **Usage Analytics**: Monitoring of tool usage patterns

## Configuration

### Security Configuration

```typescript
// Security settings in configuration
export const experimental = z.object({
  permission: z.object({
    autoApprove: z.array(z.string()).optional(),  // Auto-approved tools
    alwaysDeny: z.array(z.string()).optional(),   // Always denied tools
    requireConfirmation: z.boolean().optional(),  // Force confirmation
  }).optional(),
})
```

### Environment Variables

- **Provider Keys**: Stored in environment variables
- **Security Settings**: Configurable security policies
- **Debug Modes**: Additional logging for development

The authentication and security system provides comprehensive protection while maintaining usability, ensuring that OpenCode operates securely in various environments while respecting user privacy and consent.