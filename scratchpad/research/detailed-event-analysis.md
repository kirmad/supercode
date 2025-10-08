# Detailed WebSocket Event Format Analysis

## 📋 Executive Summary

This document provides a comprehensive analysis of the exact WebSocket event formats, message structures, and detection patterns used in the vscode-webview implementation. This data is critical for implementing the Operation Subscription system.

## 🔍 WebSocket Event Structure Deep Dive

### Base WebSocket Message Protocol

```typescript
// From packages/vscode-webview/src/types/websocket.ts
export interface WSEventType extends BaseMessage {
  type: 'event';
  event: string;        // Event name/type
  data: any;            // Event payload (structure varies by event type)
  timestamp: number;    // Unix timestamp
  id?: string;          // Optional correlation ID
}
```

### Complete Event Data Structure

Based on analysis of the WebSocket client implementation, events have this structure:

```typescript
interface SuperCodeWebSocketEvent {
  type: 'event';
  event: string;                    // Event type identifier
  data: {
    sessionId?: string;             // Session identifier (primary)
    sessionID?: string;             // Alternative session identifier
    messageId?: string;             // Message correlation ID
    role?: 'assistant' | 'user' | 'system';
    content?: string;               // Raw content for some events
    message?: {                     // Structured message object
      id: string;
      sessionId: string;
      parts: MessagePart[];
      info: MessageInfo;
      time: {
        created: string;            // ISO timestamp
        updated: string;            // ISO timestamp
        completed?: string;         // ISO timestamp - KEY for completion detection
      };
    };
    [key: string]: any;             // Additional event-specific fields
  };
  timestamp: number;
}

interface MessagePart {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;                    // Text content
  tool?: string;                    // Tool name if tool_use/tool_result
  output?: any;                     // Tool output if tool_result
  id?: string;                      // Part identifier
}

interface MessageInfo {
  role: 'assistant' | 'user' | 'system';
  id: string;
  tokens?: {
    input: number;
    output: number;
    cache?: {
      read: number;
      write: number;
    };
    reasoning?: number;
  };
  summary?: boolean;                // Indicates if this is a summary message
}
```

## 🎯 Complete vs Partial Message Detection

### Primary Detection Method: `time.completed` Field

```typescript
function isCompleteMessage(event: SuperCodeWebSocketEvent): boolean {
  // Primary indicator: completed timestamp exists
  if (event.data?.message?.time?.completed) {
    return true;
  }

  // Fallback: check for completion indicators in event type
  if (event.event === 'message.completed' ||
      event.event === 'session.message.completed') {
    return true;
  }

  return false;
}

function isPartialMessage(event: SuperCodeWebSocketEvent): boolean {
  // Streaming/partial indicators
  if (event.event === 'message.part.updated' ||
      event.event === 'message.streaming' ||
      event.event === 'session.message.partial') {
    return true;
  }

  // Has message but no completion timestamp
  if (event.data?.message && !event.data.message.time?.completed) {
    return true;
  }

  return false;
}
```

### Event Type Analysis

Based on the implementation, here are the key event types:

```typescript
// Complete message events
const COMPLETE_MESSAGE_EVENTS = [
  'message.completed',
  'session.message.completed',
  'message.final'
];

// Partial/streaming message events
const PARTIAL_MESSAGE_EVENTS = [
  'message.part.updated',
  'message.streaming',
  'session.message.partial',
  'message.chunk'
];

// Session lifecycle events
const SESSION_EVENTS = [
  'session.created',
  'session.updated',
  'session.deleted',
  'session.message.added'
];
```

## 🤖 Agent Message Identification

### Multi-Layer Detection Strategy

```typescript
function isAgentMessage(event: SuperCodeWebSocketEvent): boolean {
  // Method 1: Direct role check in message info
  if (event.data?.message?.info?.role === 'assistant') {
    return true;
  }

  // Method 2: Role in top-level data
  if (event.data?.role === 'assistant') {
    return true;
  }

  // Method 3: Event type indicates agent activity
  const agentEventTypes = [
    'agent.response',
    'agent.thinking',
    'agent.tool_use',
    'assistant.message'
  ];
  if (agentEventTypes.includes(event.event)) {
    return true;
  }

  // Method 4: Content analysis fallback
  if (event.data?.message?.parts) {
    // Check if any parts contain agent-like content
    const hasAgentContent = event.data.message.parts.some((part: MessagePart) => {
      if (part.type === 'tool_use' || part.type === 'tool_result') {
        return true; // Tools are typically agent actions
      }

      // Check for agent response patterns in text
      if (part.text && part.type === 'text') {
        // Agent responses often start with analysis or have structured content
        const agentPatterns = [
          /^(I'll|Let me|I can|I need to|I'm going to)/i,
          /<[^>]+>/,  // XML tags often indicate structured agent responses
          /```/       // Code blocks often in agent responses
        ];
        return agentPatterns.some(pattern => pattern.test(part.text!));
      }
    });

    if (hasAgentContent) {
      return true;
    }
  }

  return false;
}
```

### User Message Exclusion

```typescript
function isUserMessage(event: SuperCodeWebSocketEvent): boolean {
  // Direct role check
  if (event.data?.message?.info?.role === 'user' ||
      event.data?.role === 'user') {
    return true;
  }

  // Content-based detection
  if (event.data?.message?.parts) {
    const hasUserContent = event.data.message.parts.some((part: MessagePart) => {
      if (part.text && part.type === 'text') {
        // User messages often contain questions or instructions
        const userPatterns = [
          /^(Please|Can you|Could you|Help me|I want|I need)/i,
          /\?$/,  // Questions
          /## Review Guidelines/  // Template content
        ];
        return userPatterns.some(pattern => pattern.test(part.text!));
      }
    });

    return hasUserContent;
  }

  return false;
}
```

## 📝 Message Content Structure

### Text Content Extraction

```typescript
function extractTextContent(event: SuperCodeWebSocketEvent): string {
  let fullText = '';

  // Method 1: Direct content field
  if (event.data?.content && typeof event.data.content === 'string') {
    fullText += event.data.content;
  }

  // Method 2: Extract from message parts
  if (event.data?.message?.parts) {
    for (const part of event.data.message.parts) {
      if (part.type === 'text' && part.text) {
        fullText += part.text;
      }
    }
  }

  // Method 3: Fallback to stringified data
  if (!fullText && event.data) {
    // Sometimes content is embedded in other fields
    const searchFields = ['output', 'result', 'response', 'body'];
    for (const field of searchFields) {
      if (event.data[field] && typeof event.data[field] === 'string') {
        fullText += event.data[field];
      }
    }
  }

  return fullText;
}
```

### Streaming Content Assembly

```typescript
class StreamingContentAssembler {
  private buffers = new Map<string, string>();

  processStreamingEvent(event: SuperCodeWebSocketEvent): {
    content: string;
    isComplete: boolean;
    sessionId: string;
  } {
    const sessionId = this.extractSessionId(event);
    const newContent = extractTextContent(event);

    // Accumulate content for this session
    const existing = this.buffers.get(sessionId) || '';
    const fullContent = existing + newContent;
    this.buffers.set(sessionId, fullContent);

    const isComplete = isCompleteMessage(event);

    // Clean up buffer if complete
    if (isComplete) {
      this.buffers.delete(sessionId);
    }

    return {
      content: fullContent,
      isComplete,
      sessionId
    };
  }

  private extractSessionId(event: SuperCodeWebSocketEvent): string {
    return event.data?.sessionId ||
           event.data?.sessionID ||
           event.data?.message?.sessionId ||
           'unknown';
  }
}
```

## 🔗 Session Integration Patterns

### Session ID Extraction

```typescript
function extractSessionId(event: SuperCodeWebSocketEvent): string | null {
  // Primary locations for session ID
  const sessionId =
    event.data?.sessionId ||          // Most common
    event.data?.sessionID ||          // Alternative spelling
    event.data?.message?.sessionId || // Nested in message
    event.data?.session?.id ||        // Session object
    event.id;                         // Event ID as fallback

  return sessionId || null;
}
```

### Session-Based Event Filtering

```typescript
function filterEventsBySession(
  events: SuperCodeWebSocketEvent[],
  targetSessionIds: Set<string>
): SuperCodeWebSocketEvent[] {
  return events.filter(event => {
    const sessionId = extractSessionId(event);

    // Include if session matches or if it's a global event we care about
    return sessionId && targetSessionIds.has(sessionId);
  });
}
```

## 🔄 Streaming Response Patterns

### Stream Lifecycle Detection

```typescript
interface StreamState {
  sessionId: string;
  messageId: string;
  isActive: boolean;
  startTime: string;
  lastUpdate: string;
  content: string;
}

class StreamTracker {
  private activeStreams = new Map<string, StreamState>();

  processEvent(event: SuperCodeWebSocketEvent): StreamState | null {
    const sessionId = extractSessionId(event);
    if (!sessionId) return null;

    const messageId = event.data?.message?.id || event.data?.messageId || sessionId;
    const streamKey = `${sessionId}:${messageId}`;

    // Detect stream start
    if (this.isStreamStart(event)) {
      const streamState: StreamState = {
        sessionId,
        messageId,
        isActive: true,
        startTime: new Date().toISOString(),
        lastUpdate: new Date().toISOString(),
        content: extractTextContent(event)
      };

      this.activeStreams.set(streamKey, streamState);
      return streamState;
    }

    // Update existing stream
    const existingStream = this.activeStreams.get(streamKey);
    if (existingStream) {
      existingStream.content += extractTextContent(event);
      existingStream.lastUpdate = new Date().toISOString();

      // Check for stream completion
      if (isCompleteMessage(event)) {
        existingStream.isActive = false;
        this.activeStreams.delete(streamKey);
      }

      return existingStream;
    }

    return null;
  }

  private isStreamStart(event: SuperCodeWebSocketEvent): boolean {
    // Indicators of stream start
    return event.event === 'message.started' ||
           event.event === 'session.message.started' ||
           (event.data?.message && !event.data.message.time?.completed);
  }
}
```

## 📊 Real Event Examples

### Example 1: Complete Agent Message

```json
{
  "type": "event",
  "event": "session.message.completed",
  "data": {
    "sessionId": "sess_abc123",
    "message": {
      "id": "msg_456def",
      "sessionId": "sess_abc123",
      "parts": [
        {
          "type": "text",
          "text": "I'll analyze the code structure.\n\n<review-insight priority=\"high\">This function lacks error handling</review-insight>\n\n<hunk file=\"src/api.ts\" startLine=\"45\" endLine=\"52\">The authentication logic needs improvement</hunk>\n\nLet me continue with the review..."
        }
      ],
      "info": {
        "role": "assistant",
        "id": "msg_456def",
        "tokens": {
          "input": 1500,
          "output": 850
        }
      },
      "time": {
        "created": "2024-01-15T10:30:00.000Z",
        "updated": "2024-01-15T10:30:05.000Z",
        "completed": "2024-01-15T10:30:05.000Z"
      }
    }
  },
  "timestamp": 1705314605000
}
```

### Example 2: Partial Streaming Message

```json
{
  "type": "event",
  "event": "message.part.updated",
  "data": {
    "sessionId": "sess_abc123",
    "message": {
      "id": "msg_789ghi",
      "sessionId": "sess_abc123",
      "parts": [
        {
          "type": "text",
          "text": "I'm analyzing the security implications...\n\n<comment file=\"src/auth.ts\" line=\"23\" severity=\"medium\">Consider using bcrypt"
        }
      ],
      "info": {
        "role": "assistant",
        "id": "msg_789ghi"
      },
      "time": {
        "created": "2024-01-15T10:31:00.000Z",
        "updated": "2024-01-15T10:31:02.000Z"
        // Note: No "completed" field - indicates partial message
      }
    }
  },
  "timestamp": 1705314662000
}
```

### Example 3: User Message (to be filtered out)

```json
{
  "type": "event",
  "event": "session.message.added",
  "data": {
    "sessionId": "sess_abc123",
    "message": {
      "id": "msg_user001",
      "sessionId": "sess_abc123",
      "parts": [
        {
          "type": "text",
          "text": "Please review this pull request for security issues."
        }
      ],
      "info": {
        "role": "user",
        "id": "msg_user001"
      },
      "time": {
        "created": "2024-01-15T10:29:30.000Z",
        "updated": "2024-01-15T10:29:30.000Z",
        "completed": "2024-01-15T10:29:30.000Z"
      }
    }
  },
  "timestamp": 1705314570000
}
```

## 🎯 Implementation Implications

### Key Detection Logic for Operation Subscription

```typescript
function shouldProcessEvent(event: SuperCodeWebSocketEvent): boolean {
  // 1. Must be agent message
  if (!isAgentMessage(event)) {
    return false;
  }

  // 2. Must have extractable content
  const content = extractTextContent(event);
  if (!content || content.trim().length === 0) {
    return false;
  }

  // 3. Must have session ID for filtering
  const sessionId = extractSessionId(event);
  if (!sessionId) {
    return false;
  }

  // 4. Process both partial and complete messages
  return isPartialMessage(event) || isCompleteMessage(event);
}
```

### Content Processing Pipeline

```typescript
function processEventForSubscription(
  event: SuperCodeWebSocketEvent,
  subscribedTags: string[]
): { sessionId: string; content: string; isComplete: boolean; tags: ExtractedTagData } | null {

  if (!shouldProcessEvent(event)) {
    return null;
  }

  const sessionId = extractSessionId(event)!;
  const content = extractTextContent(event);
  const isComplete = isCompleteMessage(event);

  // Extract XML tags
  const tags = extractXMLTags(content, subscribedTags);

  return {
    sessionId,
    content,
    isComplete,
    tags
  };
}
```

This detailed analysis provides the exact implementation requirements for the Operation Subscription system to correctly identify, filter, and process agent messages in real-time.