# Autocompacting

## Overview

OpenCode's autocompacting system provides intelligent context management by automatically summarizing session history when the conversation approaches the model's context limits. This ensures that conversations can continue indefinitely while maintaining important context and preventing token limit errors.

## How Autocompacting Works

### Automatic Trigger

Autocompacting is triggered automatically during the chat process when:

1. **Context Limit Threshold**: The total token count (input + cache read + cache write + output) exceeds 90% of the model's available context window after reserving space for the next response
2. **Model Context Calculation**: Available context = `(model.context_limit - output_token_max) * 0.9`
3. **Token Accounting**: All previous message tokens are counted to determine if compacting is needed

### Implementation Location

The autocompacting logic is implemented in:
- **Primary Logic**: `packages/opencode/src/session/index.ts` (lines 654-668)
- **State Management**: Session state tracks `autoCompacting` status per session
- **API Endpoint**: `/session/{id}/summarize` (POST)

### Process Flow

```typescript
// Auto-trigger check during chat
if (previous && previous.tokens) {
  const tokens = 
    previous.tokens.input + 
    previous.tokens.cache.read + 
    previous.tokens.cache.write + 
    previous.tokens.output
    
  if (model.info.limit.context && 
      tokens > Math.max((model.info.limit.context - outputLimit) * 0.9, 0)) {
    
    // Mark session as auto-compacting
    state().autoCompacting.set(input.sessionID, true)
    
    // Perform summarization
    await summarize({
      sessionID: input.sessionID,
      providerID: input.providerID,
      modelID: input.modelID,
    })
    
    // Restart chat with compacted history
    return chat(input)
  }
}
```

## Summarization Process

### Summary Generation

When autocompacting triggers, the system:

1. **Message Filtering**: Finds messages since the last summary or all messages if no previous summary exists
2. **AI Summarization**: Uses the configured AI model to generate a comprehensive summary
3. **Summary Storage**: Creates a new assistant message marked with `summary: true`
4. **Context Preservation**: Maintains essential information for conversation continuity

### Summarization Prompt

The system uses specialized prompts for summarization:

```typescript
// From packages/opencode/src/session/prompt/summarize.txt
"Provide a detailed but concise summary of our conversation above. 
Focus on information that would be helpful for continuing the conversation, including:
- What we did
- What we're doing  
- Which files we're working on
- What we're going to do next"
```

### Provider-Specific Handling

Different AI providers receive tailored system prompts:

```typescript
export function summarize(providerID: string) {
  switch (providerID) {
    case "anthropic":
      return [PROMPT_ANTHROPIC_SPOOF.trim(), PROMPT_SUMMARIZE]
    default:
      return [PROMPT_SUMMARIZE]
  }
}
```

## State Management

### Session State

The autocompacting system maintains state through:

```typescript
const state = App.state("session", () => ({
  sessions: new Map<string, Info>(),
  messages: new Map<string, MessageV2.Info[]>(),
  pending: new Map<string, AbortController>(),
  autoCompacting: new Map<string, boolean>(), // Tracks auto-compact status
  queued: new Map<string, QueuedMessage[]>()
}))
```

### Session Locking

During autocompacting:

1. **Lock Prevention**: Session is locked to prevent concurrent operations
2. **State Tracking**: `autoCompacting.set(sessionID, true)` marks the session
3. **Clean Unlock**: After completion, `autoCompacting.delete(sessionID)` cleans up state
4. **Event Suppression**: Idle events are suppressed during auto-compacting

```typescript
// In lock disposal
const isAutoCompacting = state().autoCompacting.get(sessionID) ?? false
if (isAutoCompacting) {
  state().autoCompacting.delete(sessionID)
  return // Skip idle event emission
}
```

## Manual Compacting

### User-Initiated Compacting

Users can manually trigger compacting through:

- **Slash Command**: `/compact` or `/summarize`
- **Keyboard Shortcut**: `<leader>c` (default)
- **TUI Command**: `session_compact`

### API Access

Manual compacting via API:
```bash
POST /session/{id}/summarize
Content-Type: application/json

{
  "providerID": "anthropic",
  "modelID": "claude-3-5-sonnet-20241022"
}
```

## Configuration

### Keybinding Configuration

```json
{
  "keybinds": {
    "session_compact": "<leader>c"
  }
}
```

To disable manual compacting:
```json
{
  "keybinds": {
    "session_compact": "none"
  }
}
```

### Model Limits

Autocompacting behavior depends on model configuration:

- **Context Limit**: Model's maximum context window
- **Output Limit**: Capped at `OUTPUT_TOKEN_MAX = 32_000`
- **Safety Threshold**: 90% of available context triggers compacting

## Benefits

### Continuous Conversations

- **Unlimited Length**: Sessions can continue indefinitely without hitting context limits
- **Context Preservation**: Important information is maintained through intelligent summarization
- **Seamless Experience**: Users experience no interruption when compacting occurs

### Performance Optimization

- **Token Efficiency**: Reduces token usage by removing redundant conversation history
- **Model Performance**: Keeps context within optimal ranges for model performance
- **Memory Management**: Prevents memory issues from extremely long conversations

### Cost Management

- **Reduced Costs**: Lower token usage translates to reduced API costs
- **Smart Summarization**: Only essential context is preserved, minimizing waste
- **Automatic Optimization**: No manual intervention required for cost management

## Technical Details

### Implementation Architecture

```typescript
// Core function signature
export async function summarize(input: { 
  sessionID: string; 
  providerID: string; 
  modelID: string 
}) {
  using abort = lock(input.sessionID)
  const msgs = await messages(input.sessionID)
  const lastSummary = msgs.findLast((msg) => 
    msg.info.role === "assistant" && msg.info.summary === true
  )
  const filtered = msgs.filter((msg) => 
    !lastSummary || msg.info.id >= lastSummary.info.id
  )
  // ... summarization logic
}
```

### Message Management

- **Summary Markers**: Assistant messages with `summary: true` flag
- **Incremental Summarization**: Only summarizes content since last summary
- **Message Ordering**: Uses ascending IDs to maintain chronological order

### Error Handling

- **Abort Signals**: Respects cancellation through AbortController
- **Lock Management**: Prevents concurrent summarization attempts
- **State Cleanup**: Ensures clean state after errors or cancellation

## Best Practices

### For Users

- **Trust the System**: Autocompacting is designed to preserve important context automatically
- **Manual Triggers**: Use manual compacting (`/compact`) when you want to create a checkpoint
- **Session Organization**: Long-running sessions benefit most from autocompacting

### For Developers

- **Context Awareness**: Consider autocompacting when designing features that add significant context
- **Token Monitoring**: Be mindful of operations that might trigger autocompacting
- **State Handling**: Respect the autocompacting state when implementing session features

## Troubleshooting

### Common Issues

1. **Unexpected Compacting**: Check model context limits and token usage
2. **Missing Context**: Verify summarization prompts capture necessary information
3. **Performance Issues**: Monitor summarization frequency and adjust thresholds if needed

### Debugging

```typescript
// Check if session is auto-compacting
const isAutoCompacting = state().autoCompacting.get(sessionID) ?? false

// Monitor token usage
const tokens = previous.tokens.input + previous.tokens.cache.read + 
               previous.tokens.cache.write + previous.tokens.output

// Check threshold
const threshold = Math.max((model.info.limit.context - outputLimit) * 0.9, 0)
```

## Future Enhancements

### Potential Improvements

- **Adaptive Thresholds**: Dynamic adjustment based on conversation patterns
- **Selective Summarization**: Preserve specific message types (e.g., code blocks)
- **User Preferences**: Configurable compacting behavior and thresholds
- **Summary Quality**: Enhanced prompts for better context preservation