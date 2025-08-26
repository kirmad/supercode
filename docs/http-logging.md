# HTTP Request/Response Logging

This feature allows logging of all HTTP requests and responses to the AI provider services to separate files for debugging and analysis purposes.

## Usage

Enable HTTP logging by passing the `--debug-http` flag when starting the TUI:

```bash
opencode --debug-http
```

## Log Files

When HTTP logging is enabled, log files are created in `.opencode/logs/http/` directory:

- `YYYY-MM-DD_requests.jsonl` - AI requests (messages, tools, parameters)
- `YYYY-MM-DD_responses.jsonl` - AI responses (tokens, cost, duration, success/failure)  
- `YYYY-MM-DD_tool_calls.jsonl` - Tool calls and results
- `YYYY-MM-DD_raw_http.jsonl` - **Raw HTTP requests/responses with headers, body, status codes**

## Log Format

Each log entry is a JSON object with the following structure:

```json
{
  "id": "01HXXX...",
  "timestamp": 1703001234567,
  "sessionID": "session_xxx",
  "messageID": "message_xxx", 
  "direction": "request|response",
  "providerID": "anthropic",
  "modelID": "claude-3-5-sonnet-20241022",
  "data": { ... }
}
```

### Request Data Structure

```json
{
  "type": "ai_request",
  "messages": [...],
  "tools": ["read", "write", "bash"],
  "temperature": 0.7,
  "topP": 1.0,
  "maxOutputTokens": 32000,
  "messageCount": 5,
  "enabledToolsCount": 12
}
```

### Response Data Structure

```json
{
  "type": "ai_response", 
  "success": true,
  "tokens": {
    "input": 1234,
    "output": 567,
    "reasoning": 89,
    "cache": { "read": 100, "write": 200 }
  },
  "cost": 0.045,
  "partsCount": 3,
  "completed": true,
  "duration": 5432
}
```

### Tool Call Data Structure

```json
{
  "type": "tool_call",
  "toolCallId": "call_xxx",
  "toolName": "read",
  "args": { "filePath": "/path/to/file" }
}
```

### Raw HTTP Request Data Structure

```json
{
  "type": "raw_http_request",
  "url": "https://api.anthropic.com/v1/messages",
  "method": "POST",
  "headers": {
    "content-type": "application/json",
    "authorization": "Bearer sk-...",
    "anthropic-version": "2023-06-01",
    "user-agent": "ai/3.4.0"
  },
  "body": "{\"model\":\"claude-3-5-sonnet-20241022\",\"messages\":[...]}",
  "bodySize": 1234
}
```

### Raw HTTP Response Data Structure

```json
{
  "type": "raw_http_response", 
  "url": "https://api.anthropic.com/v1/messages",
  "method": "POST",
  "requestHeaders": { "...": "..." },
  "requestBody": "...",
  "status": 200,
  "statusText": "OK",
  "responseHeaders": {
    "content-type": "application/json",
    "x-request-id": "req_123...",
    "content-length": "567"
  },
  "responseBody": "{\"id\":\"msg_123\",\"type\":\"message\",\"content\":[...]}",
  "duration": 1250,
  "requestBodySize": 1234,
  "responseBodySize": 567
}
```

## Log Rotation

- Log files are automatically cleaned up after 7 days
- Cleanup runs every 24 hours while the application is running
- Files are named by date to enable easy rotation

## Implementation Details

### High-Level Logging
- AI SDK level request/response logging (structured data)
- Tool call tracking and results
- Token usage, cost, and duration metrics

### Raw HTTP Interception  
- **Global fetch patching**: Intercepts all HTTP requests at transport layer
- **AI Provider Detection**: Only logs requests to known AI provider endpoints (Anthropic, OpenAI, etc.)
- **Complete HTTP Capture**: Headers, body, status codes, response timing
- **Smart Body Handling**: Handles different content types (JSON, text, binary)
- **Response Body Cloning**: Reads response without consuming original stream

### Performance & Safety
- Logs are written asynchronously to avoid impacting performance
- Failed writes are logged but don't interrupt the main flow
- Large response bodies are truncated (>100KB)
- Binary content is marked with content-type only
- Context tracking links raw HTTP to AI SDK operations
- Log directory is created automatically if it doesn't exist

## Environment Variable

The flag sets the `OPENCODE_DEBUG_HTTP` environment variable which is checked throughout the application.

## Security Considerations

- Log files may contain sensitive request/response data
- Consider the `.opencode/logs/` directory in your `.gitignore`
- Automatic cleanup helps prevent log files from consuming excessive disk space