# TUI API Communication Analysis

## Executive Summary

The OpenCode TUI is a Go-based terminal application that communicates with a Node.js/TypeScript server via HTTP REST APIs and Server-Sent Events (SSE). This document provides a comprehensive analysis of the communication patterns, data structures, and APIs that would need to be implemented for an HTML client to achieve functional parity with the TUI.

## Architecture Overview

### Communication Flow
1. **TUI ↔ Server**: HTTP REST API calls and SSE for real-time events
2. **Server Control**: Bidirectional communication through `/tui/control/` endpoints
3. **Event Stream**: Server-Sent Events for real-time updates
4. **Authentication**: File-based auth storage with multiple provider support

## Core API Communication Patterns

### 1. HTTP Client Implementation (Go SDK Pattern)

The TUI uses the OpenCode Go SDK (`github.com/sst/opencode-sdk-go`) which provides:

```go
type Client struct {
    Options []option.RequestOption
    Event   *EventService
    Path    *PathService
    App     *AppService
    Agent   *AgentService
    Find    *FindService
    File    *FileService
    Config  *ConfigService
    Command *CommandService
    Project *ProjectService
    Session *SessionService
    Tui     *TuiService
}
```

### 2. Base URL Configuration
- Environment variable: `OPENCODE_BASE_URL`
- Default production URL is configurable
- Directory-based context via query parameter: `?directory=/path/to/project`

## API Endpoints Used by TUI

### Core Service Endpoints

#### **Project Service**
- `GET /project/current` - Get current project info
- Response: Project metadata, worktree path, git info

#### **Agent Service** 
- `GET /agent/list` - List available agents
- Response: Array of agent configurations with models and capabilities

#### **Path Service**
- `GET /path` - Get path configuration
- Response: State, config, worktree, and directory paths

#### **Config Service**
- `GET /config` - Get configuration info
- Response: Keybindings, theme, TUI settings, model preferences

#### **Session Service** (Primary API)
- `POST /session` - Create new session
- `GET /session` - List all sessions
- `GET /session/:id` - Get specific session
- `PATCH /session/:id` - Update session (title, etc.)
- `DELETE /session/:id` - Delete session
- `POST /session/:id/abort` - Abort running session
- `POST /session/:id/init` - Initialize session with model/provider
- `GET /session/:id/messages` - Get session messages
- `POST /session/:id/prompt` - Send user prompt
- `POST /session/:id/command` - Execute command
- `POST /session/:id/shell` - Execute shell command
- `POST /session/:id/revert` - Revert to previous message
- `POST /session/:id/unrevert` - Undo revert
- `POST /session/:id/summarize` - Compact/summarize session
- `POST /session/:id/share` - Share session
- `POST /session/:id/unshare` - Unshare session

#### **Permission Service**
- `POST /session/:sessionId/permissions/:permissionId/respond` - Respond to permission request

#### **Provider Service**
- `GET /app/providers` - List available AI providers and models

### TUI Control Endpoints

#### **Bidirectional TUI Communication**
- `GET /tui/control/next` - Get next request from server (polling)
- `POST /tui/control/response` - Send response back to server

#### **TUI Remote Control** (Via server → TUI control flow)
- `/tui/open-help` - Open help dialog
- `/tui/open-sessions` - Open session selection dialog  
- `/tui/open-timeline` - Open timeline navigation dialog
- `/tui/open-themes` - Open theme selection dialog
- `/tui/open-models` - Open model selection dialog
- `/tui/open-mcp` - Open MCP (Model Context Protocol) dialog
- `/tui/append-prompt` - Append text to prompt input
- `/tui/submit-prompt` - Submit current prompt
- `/tui/clear-prompt` - Clear prompt input
- `/tui/execute-command` - Execute TUI command
- `/tui/show-toast` - Show toast notification
- `/tui/status` - Get TUI status (ready/working/waiting_for_permission)

## Data Structures & Communication Protocols

### 1. Server-Sent Events (SSE)

**Endpoint**: `GET /event`
**Content-Type**: `text/event-stream`

```typescript
// Event stream connection for real-time updates
const eventSource = new EventSource('/event');
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle event based on data.type
};
```

**Event Types**:
- `server.connected` - Initial connection confirmation
- `session.*` - Session state changes
- `message.*` - Message updates
- `tool.*` - Tool execution updates
- `permission.*` - Permission requests

### 2. Session Communication

**Session Creation**:
```json
POST /session
{
  "parentID": "optional-parent-session-id",
  "title": "optional-session-title"
}
```

**Prompt Submission**:
```json
POST /session/:id/prompt
{
  "model": {
    "providerID": "anthropic",
    "modelID": "claude-3-5-sonnet-20241022"
  },
  "agent": "build",
  "messageID": "generated-message-id", 
  "parts": [
    {
      "type": "text",
      "text": "User prompt content"
    }
  ]
}
```

**Command Execution**:
```json
POST /session/:id/command
{
  "command": "/build",
  "arguments": "frontend components",
  "agent": "build",
  "model": "anthropic/claude-3-5-sonnet-20241022"
}
```

### 3. Message Data Structure

```typescript
interface Message {
  info: MessageInfo;  // User, Assistant, or System message
  parts: MessagePart[]; // Text, code, tool results, etc.
}

interface MessageInfo {
  id: string;
  sessionID: string; 
  time: {
    created: number;
    completed?: number;
  };
  // Union type: UserMessage | AssistantMessage | SystemMessage
}

interface MessagePart {
  // Union type: TextPart | CodePart | ToolPart | etc.
}
```

### 4. TUI Control Protocol

The TUI uses a unique polling-based control mechanism:

```typescript
// TUI polls for server requests
interface TuiRequest {
  path: string;      // e.g., "/tui/show-toast"
  body: any;         // Request payload
}

// TUI responds with result
interface TuiResponse {
  // Response data (typically boolean true for success)
}
```

### 5. Authentication System

**Storage**: File-based (`~/.opencode/data/auth.json`)
**Types**:
- OAuth: `{ type: "oauth", refresh: string, access: string, expires: number }`
- API Key: `{ type: "api", key: string }`
- Well-known: `{ type: "wellknown", key: string, token: string }`

## HTML Client Implementation Requirements

### 1. HTTP Client
- RESTful HTTP client with base URL configuration
- Query parameter support for directory context
- JSON request/response handling
- Error handling and retry logic

### 2. Server-Sent Events Client
```typescript
class EventStreamClient {
  private eventSource: EventSource;
  
  connect(baseUrl: string) {
    this.eventSource = new EventSource(`${baseUrl}/event`);
    this.eventSource.onmessage = this.handleEvent.bind(this);
    this.eventSource.onerror = this.handleError.bind(this);
  }
  
  private handleEvent(event: MessageEvent) {
    const data = JSON.parse(event.data);
    // Dispatch to appropriate handlers
  }
}
```

### 3. Session Management
```typescript
class SessionManager {
  async createSession(parentID?: string, title?: string): Promise<Session>;
  async listSessions(): Promise<Session[]>;
  async sendPrompt(sessionId: string, prompt: PromptRequest): Promise<void>;
  async sendCommand(sessionId: string, command: string, args: string): Promise<void>;
  async sendShell(sessionId: string, command: string): Promise<void>;
  async abortSession(sessionId: string): Promise<void>;
}
```

### 4. Real-time Updates
- WebSocket alternative to SSE for bidirectional communication
- Message streaming and progressive updates
- Tool execution status tracking
- Permission request handling

### 5. State Management
- Session state synchronization
- Message history management  
- Provider/model selection state
- Agent configuration state

## Key Differences for HTML Client

### 1. **No TUI Control Protocol Needed**
HTML clients don't need the `/tui/control/` polling mechanism - they can implement UI interactions directly.

### 2. **Enhanced Real-time Capabilities** 
HTML clients can use WebSockets for better bidirectional communication vs. the TUI's polling approach.

### 3. **Browser-specific Considerations**
- CORS policy compliance
- LocalStorage/SessionStorage for state persistence
- File upload/download capabilities for file operations
- Browser security restrictions

### 4. **Authentication Flow**
- OAuth2 flow integration for web
- Token storage in browser (with security considerations)
- Automatic token refresh handling

## Implementation Recommendations

### 1. **Base Client Architecture**
```typescript
class OpenCodeClient {
  constructor(private baseUrl: string, private directory?: string) {}
  
  // Service clients
  readonly session = new SessionService(this);
  readonly project = new ProjectService(this);
  readonly config = new ConfigService(this);
  readonly agent = new AgentService(this);
  readonly events = new EventStreamClient(this);
}
```

### 2. **Progressive Enhancement**
- Start with core session/messaging APIs
- Add real-time updates via SSE
- Implement advanced features (file operations, MCP integration)

### 3. **Error Handling**
- Network retry logic
- Graceful degradation when offline
- User-friendly error messages

### 4. **Performance Considerations**
- Message pagination for large sessions
- Efficient diff-based UI updates
- Background sync for offline support

This analysis provides the foundation for implementing an HTML client with functional parity to the existing TUI, focusing on the core communication patterns and data structures that enable the OpenCode AI coding assistant functionality.