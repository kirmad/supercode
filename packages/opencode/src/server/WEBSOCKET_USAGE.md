# WebSocket Support Documentation

## Overview

The OpenCode server now supports WebSocket connections alongside traditional REST API endpoints. This enables:
- Real-time bidirectional communication
- All API calls over WebSocket with request/response pattern
- Server-push notifications replacing Server-Sent Events (SSE)
- Better performance with persistent connections
- Automatic reconnection and heartbeat monitoring

## Architecture

### Components

1. **WebSocket Handler** (`websocket-handler.ts`)
   - Message routing and dispatching
   - Request/response correlation using unique IDs
   - Event broadcasting to connected clients
   - Session management for WebSocket connections

2. **WebSocket Client** (`websocket-client.ts`)
   - TypeScript client for testing and SDK usage
   - Automatic reconnection with exponential backoff
   - Event subscription management
   - Heartbeat/ping-pong for connection health

3. **Server Integration** (`server.ts`)
   - WebSocket upgrade handling in Bun server
   - Integration with existing Hono routes
   - Backward compatibility with REST endpoints

## Message Protocol

All WebSocket messages use JSON format with the following structure:

### Message Types

#### Request (Client → Server)
```typescript
{
  type: "request",
  id: "unique-request-id",  // For response correlation
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: "/api/endpoint",
  params: {
    query?: { key: "value" },     // Query parameters
    param?: { id: "123" },         // Path parameters
    body?: { data: "payload" }    // Request body
  },
  headers?: { "x-custom": "value" },
  timestamp: 1234567890
}
```

#### Response (Server → Client)
```typescript
{
  type: "response",
  id: "unique-request-id",  // Matches request ID
  status: 200,
  data: { result: "data" },
  error?: {
    message: "Error message",
    code: "ERROR_CODE",
    details: {}
  },
  timestamp: 1234567890
}
```

#### Event (Server → Client)
```typescript
{
  type: "event",
  event: "event.name",
  data: { payload: "data" },
  timestamp: 1234567890
}
```

#### Control Messages
```typescript
{
  type: "control",
  action: "ping" | "pong" | "subscribe" | "unsubscribe" | "authenticate",
  data?: { events: ["event1", "event2"] },
  timestamp: 1234567890
}
```

## Client Usage

### Basic Connection

```typescript
import { WebSocketClient } from "./websocket-client"

const client = new WebSocketClient({
  url: "ws://localhost:3000",
  sessionId: "optional-session-id",
  directory: "/path/to/project",
  autoReconnect: true,
  reconnectDelay: 1000,
  maxReconnectAttempts: 10,
  heartbeatInterval: 30000
})

// Connect to server
await client.connect()
```

### Making API Calls

```typescript
// GET request
const sessions = await client.request("GET", "/session")

// POST request with body
const response = await client.request("POST", "/session/123/message", {
  body: {
    text: "Hello",
    providerID: "anthropic",
    modelID: "claude-3"
  }
})

// Request with query parameters
const files = await client.request("GET", "/file", {
  query: { path: "/src" }
})
```

### Subscribing to Events

```typescript
// Subscribe to all events
const unsubscribe = client.on("*", (data) => {
  console.log("Event received:", data)
})

// Subscribe to specific events
client.on("server.connected", (data) => {
  console.log("Connected:", data)
})

client.on("tui.model.changed", (data) => {
  console.log("Model changed:", data)
})

// Unsubscribe
unsubscribe()
```

### Connection Management

```typescript
// Check connection status
if (client.isConnected) {
  console.log("Connected")
}

// Send ping
await client.ping()

// Disconnect
await client.disconnect()
```

## Server-Side Configuration

### WebSocket Settings

The WebSocket server is configured with:
- **Max Payload**: 16MB per message
- **Idle Timeout**: 2 minutes
- **Backpressure Limit**: 1MB
- **Compression**: Enabled (perMessageDeflate)

### Connection Parameters

When connecting, clients can specify:
- `directory`: Working directory for the session (query parameter)
- `x-session-id`: Session ID for tracking (header)

## Browser Usage

For browser-based clients, use the native WebSocket API:

```javascript
const ws = new WebSocket('ws://localhost:3000?directory=/path/to/project')

ws.onopen = () => {
  // Send request
  ws.send(JSON.stringify({
    type: 'request',
    id: 'req-1',
    method: 'GET',
    path: '/config',
    timestamp: Date.now()
  }))
}

ws.onmessage = (event) => {
  const message = JSON.parse(event.data)
  console.log('Received:', message)
}
```

## Migration from REST/SSE

### REST API Calls

All existing REST endpoints remain available. WebSocket is an additional transport option.

**Before (REST):**
```typescript
const response = await fetch('http://localhost:3000/session')
const data = await response.json()
```

**After (WebSocket):**
```typescript
const data = await client.request('GET', '/session')
```

### Server-Sent Events (SSE)

The `/event` SSE endpoint is still available but WebSocket events are recommended.

**Before (SSE):**
```typescript
const events = new EventSource('http://localhost:3000/event')
events.onmessage = (event) => {
  const data = JSON.parse(event.data)
}
```

**After (WebSocket):**
```typescript
client.on('*', (data) => {
  console.log('Event:', data)
})
```

## Testing

Run the test client:

```bash
bun run packages/opencode/src/server/websocket-client.ts
```

This will:
1. Connect to the WebSocket server
2. Subscribe to all events
3. Make test API calls (sessions, config)
4. Test ping/pong
5. Disconnect after 5 seconds

## Monitoring

### Get Active Connections

```bash
# REST endpoint for monitoring
curl http://localhost:3000/websocket/connections

# Get specific connection info
curl http://localhost:3000/websocket/connection/{connectionId}
```

### Connection Info

Each connection tracks:
- Connection ID
- Session ID
- Working directory
- Event subscriptions
- Authentication status
- Last activity timestamp

## Error Handling

### Connection Errors

The client automatically handles:
- Connection failures with exponential backoff
- Network interruptions with auto-reconnect
- Server restarts with session recovery
- Timeout errors with request retry

### Message Errors

Error responses include:
- Error message
- Error code for programmatic handling
- Additional details for debugging

```typescript
try {
  const data = await client.request('GET', '/invalid-endpoint')
} catch (error) {
  console.error('Request failed:', error.message)
  console.error('Error code:', error.code)
  console.error('Details:', error.details)
}
```

## Performance Considerations

### Benefits over REST

1. **Persistent Connection**: No connection overhead per request
2. **Lower Latency**: No HTTP handshake for each call
3. **Bidirectional**: Server can push updates without polling
4. **Header Compression**: WebSocket frame header is minimal
5. **Message Compression**: Built-in compression support

### Best Practices

1. **Batch Operations**: Send multiple requests without waiting
2. **Event Filtering**: Subscribe only to needed events
3. **Connection Reuse**: Share client instance across modules
4. **Error Recovery**: Implement proper error handling
5. **Resource Cleanup**: Unsubscribe and disconnect when done

## Backward Compatibility

All existing REST endpoints remain functional. WebSocket is an additional transport layer that doesn't break existing integrations. Clients can choose to:
- Use REST only (existing behavior)
- Use WebSocket only (new capability)
- Mix REST and WebSocket as needed

## Future Enhancements

Potential improvements for the WebSocket implementation:
- Binary message support for file transfers
- Message compression for large payloads
- Rate limiting and throttling
- WebSocket authentication tokens
- Horizontal scaling with Redis pub/sub
- GraphQL subscriptions over WebSocket