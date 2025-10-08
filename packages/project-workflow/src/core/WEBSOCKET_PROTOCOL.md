# WebSocket Protocol Documentation

This document describes the WebSocket protocol used by the SuperCode server and how to properly extract session IDs from different event types.

## Event Types and Session ID Locations

Based on server implementation analysis and actual message logs, here are the correct paths for extracting session IDs:

### 1. `message.updated` Events

**Session ID Location**: `event.data.info.sessionID`

```json
{
  "event": "message.updated",
  "data": {
    "info": {
      "id": "msg_9c2c593c40022bW8LIDg7cKs4V",
      "role": "assistant",
      "sessionID": "ses_63d3a6c75ffelIRYYcg7Bt85pL"
    }
  }
}
```

### 2. `message.part.updated` Events

**Session ID Location**: `event.data.part.sessionID`

```json
{
  "event": "message.part.updated",
  "data": {
    "part": {
      "sessionID": "ses_63d3a6c75ffelIRYYcg7Bt85pL",
      "text": "partial content..."
    }
  }
}
```

### 3. `message.completed` Events

**Session ID Location**: `event.data.message.sessionId` or `event.data.message.sessionID`

### 4. Other Event Types

For other events, session IDs may be found at:
- `event.data.sessionId`
- `event.data.sessionID`
- `event.data.message.sessionId`
- `event.data.message.sessionID`

## Critical Fix Applied

The `websocket-client-adapter.ts` file was missing these critical paths:

1. **`event.data?.info?.sessionID`** - For `message.updated` events
2. **`event.data?.part?.sessionID`** - For `message.part.updated` events

### Before Fix
```typescript
// Missing the critical paths
sessionId = event.data?.sessionId ||
           event.data?.sessionID ||
           // Missing: event.data?.info?.sessionID
           // Missing: event.data?.part?.sessionID
```

### After Fix
```typescript
// Now includes the critical paths
sessionId = event.data?.sessionId ||
           event.data?.sessionID ||
           event.data?.info?.sessionID ||     // ✅ For message.updated
           event.data?.part?.sessionID ||     // ✅ For message.part.updated
```

## Impact

This fix resolves the issue where `message.updated` events were returning `sessionIdExtracted: null` even though the session ID was present in the `info.sessionID` field.

## Server Implementation Details

The WebSocket server uses an event bus system that transforms internal messages into WebSocket events. The session ID placement varies by event type:

- **Message updates**: Session ID embedded in the `info` object
- **Part updates**: Session ID embedded in the `part` object
- **Completions**: Session ID in the `message` object

## Testing

To test the fix, look for log entries like:
```
[DEBUG] [OperationSubscriber] Skipping event - convertToProcessedMessage returned null
```

After the fix, `message.updated` events should successfully extract session IDs and not be skipped.