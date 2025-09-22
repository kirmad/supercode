# Prompt Enhancement Architecture

## Overview

The prompt enhancement system has been refactored to use a clean separation of concerns with custom commands and output styles.

## Architecture Components

### 1. Built-in Command (`packages/opencode/src/commands/defaults/enhance-prompt.md`)

**Location**: `packages/opencode/src/commands/defaults/enhance-prompt.md`

**Purpose**: Contains the domain logic and enhancement expertise.

**Responsibilities (WHAT to enhance)**:
- Enhancement process and methodology
- Quality guidelines and standards
- Research focus areas and analysis dimensions
- Content requirements for the enhanced prompt
- Technical specifications and implementation guidance
- Uses `$ARGUMENTS` placeholder for user context
- Specifies `outputStyle: prompt-enhancer` for formatting

### 2. Output Style (`packages/opencode/src/session/output-styles/prompt-enhancer.md`)

**Location**: `packages/opencode/src/session/output-styles/prompt-enhancer.md`

**Purpose**: Controls the output format and streaming behavior.

**Responsibilities (HOW to output)**:
- Enforces strict XML structure for responses
- Defines real-time streaming requirements for `<research-update>` tags
- Specifies the exact XML schema for all response types
- Ensures proper tag formatting and structure
- Controls streaming behavior (immediate, no batching)
- Guarantees response completeness with final `<enhanced-prompt>`

### 3. PromptEnhancementService (`packages/vscode-webview/src/services/PromptEnhancementService.ts`)

**Location**: `packages/vscode-webview/src/services/PromptEnhancementService.ts`

**Purpose**: Handles the client-side logic for prompt enhancement.

**Key Changes**:
- Simplified prompt construction using `/enhance-prompt` command
- Maintains XML parsing logic for response processing
- Handles WebSocket streaming for real-time updates
- Supports follow-up enhancements with context

## XML Response Format

### Research Updates (Streamed in Real-Time)
```xml
<research-update type="analysis|pattern|requirement|best-practice" priority="high|medium|low">
  Research finding or insight here
</research-update>
```

### Clarification Questions (Optional)
```xml
<clarification-needed>
  <question id="unique-id">
    <text>Question text</text>
    <options>Possible answers</options>
  </question>
</clarification-needed>
```

### Enhanced Prompt (Final Output)
```xml
<enhanced-prompt>
  <metadata>
    <complexity>simple|moderate|complex</complexity>
    <domains>comma,separated,list</domains>
    <technologies>comma,separated,list</technologies>
    <patterns>comma,separated,list</patterns>
  </metadata>
  <content>
    Complete enhanced prompt specification here
  </content>
</enhanced-prompt>
```

## Usage Flow

1. **User Input**: User provides a prompt to enhance
2. **Command Invocation**: Service sends `/enhance-prompt <user-prompt>` to the AI
3. **Output Style Applied**: The `prompt-enhancer` output style enforces response format
4. **Streaming Response**: AI streams `<research-update>` tags in real-time
5. **XML Parsing**: Service parses the XML responses
6. **UI Updates**: Research items update in real-time, final prompt displayed

## Testing the Implementation

### Manual Testing

1. **Command Line Test**:
```bash
# In the SuperCode CLI
/enhance-prompt Create a TODO application with React
```

2. **VS Code Extension Test**:
- Open the Prompt Generation tab
- Enter a prompt to enhance
- Observe real-time research updates
- Verify enhanced prompt output

### Expected Behavior

1. **Real-Time Updates**: Research findings should appear as they're discovered
2. **XML Format**: All responses should use proper XML tags
3. **Complete Output**: Final enhanced prompt should include:
   - Metadata (complexity, domains, technologies, patterns)
   - Comprehensive content specification

### Validation Points

✅ Built-in command file exists at `packages/opencode/src/commands/defaults/enhance-prompt.md`
✅ Output style file exists at `packages/opencode/src/session/output-styles/prompt-enhancer.md`
✅ PromptEnhancementService uses `/enhance-prompt` command
✅ XML parsing logic remains intact
✅ WebSocket streaming continues to work
✅ Follow-up enhancements maintain context

## Benefits of New Architecture

1. **Clear Separation of Concerns**:
   - **Command**: Domain expertise (WHAT to enhance, quality standards)
   - **Output Style**: Presentation logic (HOW to format, XML structure)
   - **Service**: Client logic (parsing, UI updates, WebSocket handling)

2. **Enhanced Reusability**:
   - Output style can be reused for ANY XML-streaming response pattern
   - Command logic is portable across different interfaces (CLI, VS Code)
   - XML schema is consistent and predictable for parsers

3. **Improved Maintainability**:
   - Update enhancement logic without touching format/streaming behavior
   - Modify XML structure without changing enhancement methodology
   - Service code remains stable as command/style evolve

4. **Better Testability**:
   - Command logic can be tested independently
   - Output format validation is isolated
   - Service parsing logic has consistent input format

5. **Scalability**:
   - Easy to create variations (e.g., `prompt-enhancer-json` style)
   - Multiple commands can share the same output style
   - New enhancement strategies via new commands

## Migration Notes

### From Old Architecture
- Complex prompt string construction in service → Simple command invocation
- Inline XML instructions → Separated into command and output style
- Hardcoded format rules → Configurable output style

### To New Architecture
- Service uses `/enhance-prompt` command
- Enhancement logic in built-in command (`packages/opencode/src/commands/defaults/enhance-prompt.md`)
- Format enforcement in output style file (`packages/opencode/src/session/output-styles/prompt-enhancer.md`)
- XML parsing logic unchanged
- Command now ships with supercode package by default

### Command Resolution Order
1. **Project-specific**: `.opencode/commands/enhance-prompt.md` (highest priority)
2. **Global config**: `~/.config/supercode/commands/enhance-prompt.md`
3. **Built-in default**: `packages/opencode/src/commands/defaults/enhance-prompt.md` (fallback)

## Future Enhancements

1. Support for multiple output styles (e.g., JSON format)
2. Configurable research update types
3. Custom metadata fields
4. Template support for common enhancement patterns
5. Integration with other AI services