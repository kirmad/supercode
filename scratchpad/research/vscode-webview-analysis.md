# VSCode WebView WebSocket Communication Research

## Executive Summary

The vscode-webview implementation provides a sophisticated WebSocket-based communication system for AI agent interactions. The system handles streaming responses, message parsing, XML processing, and operation subscriptions through event-driven patterns.

## Key Components and Architecture

### 1. WebSocket Client Architecture

**SuperCodeWebSocketClient** (`packages/vscode-webview/src/services/SuperCodeWebSocketClient.ts`)
- Main WebSocket client that wraps the lower-level `WebSocketClient`
- Handles connection management, auto-reconnection, and heartbeat
- Provides high-level API methods for session management and agent communication

**WebSocketClient** (`packages/vscode-webview/src/services/WebSocketClient.ts`)
- Low-level WebSocket implementation handling raw message protocols
- Manages connection state, request/response correlation, and event subscription
- Uses typed message protocols defined in `types/websocket.ts`

### 2. Message Types and Structure

#### WebSocket Message Protocol (`types/websocket.ts`)

```typescript
// Base message structure
export interface BaseMessage {
  id?: string; // Unique ID for request/response correlation
  timestamp: number;
}

// Request message from client
export interface WSRequestType extends BaseMessage {
  type: 'request';
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  params?: { query?: Record<string, any>; body?: any; };
  headers?: Record<string, string>;
}

// Response message to client
export interface WSResponseType extends BaseMessage {
  type: 'response';
  id?: string;
  status: number;
  data: any;
  error?: { message: string; code?: string; details?: any; };
}

// Event message (server push)
export interface WSEventType extends BaseMessage {
  type: 'event';
  event: string;
  data: any;
}

// Control messages
export interface WSControlType extends BaseMessage {
  type: 'control';
  action: 'ping' | 'pong' | 'subscribe' | 'unsubscribe' | 'authenticate';
  data?: any;
}
```

#### SSE Message Format (`types/index.ts`)

```typescript
export interface SSEMessage {
  type: string
  content?: string
  tool?: string
  output?: any
  [key: string]: any
}
```

### 3. Event Handling and Subscription Patterns

#### Event Subscription Mechanism

The SuperCodeWebSocketClient uses a unique approach to receive **ALL** server events without explicit subscription:

```typescript
// From SuperCodeWebSocketClient.subscribeToEvents()
// IMPORTANT: Uses special internal listener that doesn't send subscribe messages
// This keeps the server's subscriptions.size === 0, allowing us to receive ALL Bus events

const handleAllEvents = (eventData: { event: string; data: any }) => {
  // Convert WebSocket event to SSE message format
  const sseMessage: SSEMessage = {
    type: eventData.event || 'message',
    properties: eventData.data,  // Map data to properties
    data: eventData.data,        // Keep data as well for compatibility
    timestamp: Date.now()
  };

  // Notify all message handlers
  this.handlers.message.forEach(handler => handler(sseMessage));
};

// Directly access the WebSocketClient's internal event listener map
// to add handler without triggering a subscribe message
eventListeners.get('*')!.add(handleAllEvents);
```

#### Message Handler Registration

```typescript
// Message handlers
export type SSEMessageHandler = (message: SSEMessage) => void;
export type SSEErrorHandler = (error: Error) => void;
export type SSEOpenHandler = () => void;

// Handler management
client.onMessage(handler: SSEMessageHandler): void
client.offMessage(handler: SSEMessageHandler): void
client.onError(handler: SSEErrorHandler): void
client.onOpen(handler: SSEOpenHandler): void
```

### 4. Agent vs User Message Detection

Multiple strategies are used to distinguish agent vs user messages:

#### Role-based Detection
```typescript
// Check message role from properties
const messageRole = message.properties?.info?.role;

if (messageRole === 'assistant') {
  // Process agent message
} else if (messageRole === 'user') {
  // Process user message
}
```

#### Content-based Detection
```typescript
// Skip user messages based on content patterns
if (part.role === 'user' || part.text.includes('## Review Guidelines')) {
  console.log('Skipping user/template message part');
  return;
}
```

#### Session Message Structure
Messages from the server contain structured data:
```typescript
// Message structure from session API
{
  info: {
    role: 'user' | 'assistant' | 'system',
    id: string,
    tokens?: { input: number, output: number, ... }
  },
  parts: [
    { type: 'text', text: string }
  ]
}
```

### 5. Streaming Response Handling

#### Partial vs Complete Response Detection

**Streaming Callbacks** (`services/SessionManager.ts`):
```typescript
export interface StreamingCallbacks {
  onChunk?: (chunk: string, sessionId: string) => void;
  onMessagePart?: (part: any, sessionId: string) => void;
  onComplete?: (fullContent: string, sessionId: string) => void;
  onError?: (error: Error, sessionId: string) => void;
}
```

**Streaming Process**:
1. **onChunk**: Raw text chunks as they arrive
2. **onMessagePart**: Structured message parts (can be called multiple times)
3. **onComplete**: Final complete message

**Buffer Management**:
```typescript
// From SessionManager.sendMessage()
let buffer = '';
let fullContent = '';

// Process streaming chunks
const lines = buffer.split('\n');
buffer = lines[lines.length - 1]; // Keep incomplete line

for (const line of lines.slice(0, -1)) {
  if (line.startsWith('data: ')) {
    jsonStr = line.slice(6);
  }

  const jsonData = JSON.parse(jsonStr);

  // Process message parts
  if (jsonData.parts && Array.isArray(jsonData.parts)) {
    for (const part of jsonData.parts) {
      if (part.type === 'text' && part.text) {
        fullContent += part.text;
        callbacks?.onMessagePart(part, sessionId);
      }
    }
  }
}

// Final completion
callbacks?.onComplete(fullContent, sessionId);
```

### 6. XML Tag Parsing Patterns

#### XML Parser Utilities (`utils/XMLUtils.ts`)

The system includes comprehensive XML parsing for structured agent responses:

```typescript
export class XMLParser {
  /**
   * Parse XML content from the response
   * Handles partial XML and nested tags
   */
  public parseXMLContent(content: string, tag: string): string[] {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'g');
    const matches: string[] = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      matches.push(match[1].trim());
    }

    return matches;
  }

  /**
   * Parse research updates from XML
   * Extracts research-update tags with type and priority attributes
   */
  public parseResearchUpdates(content: string): ResearchItem[] {
    const regex = /<research-update\s+type="([^"]+)"\s+priority="([^"]+)">([^<]+)<\/research-update>/g;
    // ... processing logic
  }

  /**
   * Process streaming clarification questions from text content
   * Handles partial XML and real-time updates
   */
  public processStreamingClarifications(textContent: string, existingQuestions: ClarificationQuestion[] = []): {
    questions: ClarificationQuestion[];
    newQuestions: ClarificationQuestion[];
  }
}
```

#### Streaming XML Processing

Real-time XML processing for incremental content:

```typescript
// Process streaming research with deduplication
public processStreamingResearch(
  textContent: string,
  processedContent?: Set<string>
): { items: ResearchItem[]; updatedProcessedContent: Set<string>; } {

  const researchRegex = /<research-update[^>]*>([\s\S]*?)<\/research-update>/g;

  while ((match = researchRegex.exec(textContent)) !== null) {
    const content = match[1].trim();

    // Filter out instruction examples
    if (this.isInstructionExample(content)) continue;

    // Check against global processed set for deduplication
    if (this.globalProcessedResearch.has(content)) continue;

    // Create research item and mark as processed
    const researchItem: ResearchItem = { /* ... */ };
    this.globalProcessedResearch.add(content);
    items.push(researchItem);
  }
}
```

### 7. Operation Subscription Implementation Insights

Based on the vscode-webview patterns, here are key insights for operation subscription:

#### Event Flow Architecture
1. **WebSocket Events** → **Event Handler** → **SSE Message Conversion** → **Operation Processor**
2. Events are received through wildcard subscription (`*`) to catch all server events
3. Real-time processing with deduplication and state management
4. Structured message parts allow incremental processing

#### Message Processing Pipeline
```typescript
// Recommended pattern for operation subscription
class OperationSubscriber {
  private processedOperations = new Set<string>();

  handleWebSocketEvent(eventData: { event: string; data: any }) {
    // Convert to standardized format
    const operationMessage = this.convertToOperationMessage(eventData);

    // Process based on operation type
    switch (operationMessage.type) {
      case 'operation_start':
        this.handleOperationStart(operationMessage);
        break;
      case 'operation_progress':
        this.handleOperationProgress(operationMessage);
        break;
      case 'operation_complete':
        this.handleOperationComplete(operationMessage);
        break;
    }
  }

  private handleOperationProgress(message: OperationMessage) {
    // Real-time processing with deduplication
    const operationId = message.operationId;

    if (!this.processedOperations.has(operationId)) {
      // Process new operation
      this.processedOperations.add(operationId);
      this.notifySubscribers(message);
    }
  }
}
```

#### Streaming Data Patterns
- **Incremental Processing**: Handle partial data as it arrives
- **Deduplication**: Use Sets to track processed content
- **State Management**: Maintain operation state across message parts
- **Error Handling**: Graceful degradation for malformed messages

#### Key Integration Points
1. **Message Conversion**: WebSocket events → SSE format → Operation events
2. **Session Filtering**: Filter events by session ID when needed
3. **Content Validation**: Validate message structure and content
4. **Real-time Updates**: Process and notify subscribers immediately

## Implementation Recommendations

For implementing Operation Subscription in the project-workflow package:

1. **Follow the WebSocket event subscription pattern** from SuperCodeWebSocketClient
2. **Use the XML parsing utilities** for structured operation data
3. **Implement streaming callbacks** similar to SessionManager
4. **Add deduplication logic** to prevent duplicate processing
5. **Maintain operation state** using Maps/Sets for tracking
6. **Handle partial messages** gracefully with buffer management
7. **Use role-based detection** to filter agent vs user messages

The vscode-webview implementation provides a solid foundation for understanding how to build robust, real-time operation subscription systems with WebSocket communication in the SuperCode ecosystem.