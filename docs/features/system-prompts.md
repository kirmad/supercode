# System Prompts

## Overview

OpenCode uses a sophisticated system prompt architecture that adapts based on the AI provider and model being used. The system prompt is the foundation that defines the agent's behavior, capabilities, and communication style.

## File Locations

### Core System Prompt Manager
- **Primary**: `packages/opencode/src/session/system.ts`
- **Prompt Templates**: `packages/opencode/src/session/prompt/*.txt`

### System Prompt Templates

Located in `packages/opencode/src/session/prompt/`:

```
prompt/
├── anthropic.txt           # Claude-specific prompt with TodoWrite integration
├── anthropic_spoof.txt     # Provider header for Anthropic models
├── beast.txt               # GPT and O1/O3 models prompt (autonomous agent style)
├── codex.txt               # Legacy Codex prompt
├── copilot-gpt-5.txt       # GPT-5 specific prompt
├── gemini.txt              # Google Gemini prompt
├── initialize.txt          # Session initialization prompt
├── plan.txt                # Planning mode prompt
├── qwen.txt                # Qwen and non-Todo models prompt
├── summarize.txt           # Conversation summarization prompt
└── title.txt               # Title generation prompt
```

## System Prompt Architecture

### Provider-Specific Selection

The system automatically selects appropriate prompts based on the model:

```typescript
// packages/opencode/src/session/system.ts
export function provider(modelID: string) {
  if (modelID.includes("gpt-5")) return [PROMPT_COPILOT_GPT_5]
  if (modelID.includes("gpt-") || modelID.includes("o1") || modelID.includes("o3")) return [PROMPT_BEAST]
  if (modelID.includes("gemini-")) return [PROMPT_GEMINI]
  if (modelID.includes("claude")) return [PROMPT_ANTHROPIC]
  return [PROMPT_ANTHROPIC_WITHOUT_TODO]
}
```

### Prompt Components

Each session combines multiple prompt elements:

1. **Header Prompt**: Provider-specific instructions
2. **Provider Prompt**: Model-specific behavior guidelines
3. **Environment Context**: Dynamic project and system information
4. **Custom Instructions**: User-defined rules and preferences

### Environment Context Generation

Dynamic context is added to every session:

```typescript
// packages/opencode/src/session/system.ts:32-55
export async function environment() {
  const app = App.info()
  return [
    `Working directory: ${app.path.cwd}`,
    `Is directory a git repo: ${app.git ? "yes" : "no"}`,
    `Platform: ${process.platform}`,
    `Today's date: ${new Date().toDateString()}`,
    // Project tree structure (up to 200 files)
    app.git ? await Ripgrep.tree({ cwd: app.path.cwd, limit: 200 }) : ""
  ]
}
```

## Custom Instructions

### Local Rule Files

OpenCode searches for custom instructions in priority order:

```typescript
// Local files (project-specific)
const LOCAL_RULE_FILES = [
  "AGENTS.md",     // OpenCode-specific instructions
  "CLAUDE.md",     // Claude Code compatibility
  "CONTEXT.md"     // Deprecated
]

// Global files (user-specific)
const GLOBAL_RULE_FILES = [
  path.join(Global.Path.config, "AGENTS.md"),
  path.join(os.homedir(), ".claude", "CLAUDE.md")
]
```

### Configuration-Based Instructions

Users can specify additional instruction files in configuration:

```json
// opencode.json or config
{
  "instructions": [
    "~/my-custom-instructions.md",
    "./project-specific-rules.md",
    "/absolute/path/to/instructions.md"
  ]
}
```

## Key Prompt Differences

### Anthropic Prompt (`anthropic.txt`)
- **Focus**: Concise, direct responses
- **Style**: Minimal output tokens, avoid explanations
- **Tools**: Full TodoWrite integration
- **Examples**: Direct Q&A format demonstrating brevity

### Beast Prompt (`beast.txt`)
- **Focus**: Autonomous problem-solving
- **Style**: Thorough, iterative approach
- **Tools**: Extensive web research, sequential thinking
- **Workflow**: 10-step problem-solving methodology

### Gemini Prompt (`gemini.txt`)
- **Focus**: Google-specific optimizations
- **Style**: Adapted for Gemini model characteristics
- **Tools**: Tailored tool usage patterns

### GPT-5 Prompt (`copilot-gpt-5.txt`)
- **Focus**: Advanced reasoning capabilities
- **Style**: Leverages enhanced model capabilities
- **Tools**: Full feature utilization

## Prompt Composition Flow

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Model ID      │───►│  Provider       │───►│  Base Prompt    │
│  Detection      │    │  Selection      │    │  Selection      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Final System   │◄───│   Prompt        │◄───│   Environment   │
│    Prompt       │    │ Composition     │    │    Context      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Custom        │
                       │ Instructions    │
                       └─────────────────┘
```

## Special Prompt Functions

### Summarization Prompts
Used for conversation summarization:
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

### Title Generation
Used for generating conversation titles:
```typescript
export function title(providerID: string) {
  switch (providerID) {
    case "anthropic":
      return [PROMPT_ANTHROPIC_SPOOF.trim(), PROMPT_TITLE]
    default:
      return [PROMPT_TITLE]
  }
}
```

## Integration Points

### Session Management
- **File**: `packages/opencode/src/session/index.ts`
- **Integration**: System prompts are loaded during session initialization
- **Caching**: Prompts are cached per session to avoid recomputation

### Message Processing
- **File**: `packages/opencode/src/session/message.ts`
- **Usage**: System prompts are prepended to conversation context
- **Dynamic**: Environment context is refreshed when needed

### Agent Processing
- **File**: `packages/opencode/src/agent/agent.ts`
- **Role**: Agent uses system prompts to understand its capabilities and behavior
- **Tool Integration**: Prompts define which tools are available and how to use them

## Customization Guide

### Adding New Model Support

1. **Create Prompt Template**:
   ```txt
   // packages/opencode/src/session/prompt/my-model.txt
   You are a specialized AI assistant for [model-specific instructions]...
   ```

2. **Update Provider Selection**:
   ```typescript
   // packages/opencode/src/session/system.ts
   export function provider(modelID: string) {
     if (modelID.includes("my-model")) return [PROMPT_MY_MODEL]
     // ... existing conditions
   }
   ```

3. **Import Template**:
   ```typescript
   // packages/opencode/src/session/system.ts
   import PROMPT_MY_MODEL from "./prompt/my-model.txt"
   ```

### Creating Custom Instructions

1. **Local Project Instructions**:
   ```bash
   # Create in project root
   echo "Project-specific instructions..." > AGENTS.md
   ```

2. **Global User Instructions**:
   ```bash
   # Create in home directory
   mkdir -p ~/.claude
   echo "Global user instructions..." > ~/.claude/CLAUDE.md
   ```

3. **Configuration-Based**:
   ```json
   // opencode.json
   {
     "instructions": ["./custom-rules.md"]
   }
   ```

## Best Practices

### Prompt Design
- **Clear Objectives**: Define specific goals and behaviors
- **Tool Integration**: Specify how tools should be used
- **Error Handling**: Include instructions for error scenarios
- **Output Format**: Define expected response formats

### Performance Optimization
- **Token Efficiency**: Keep prompts concise while maintaining clarity
- **Caching**: Leverage prompt caching for repeated elements
- **Dynamic Content**: Only include dynamic context when necessary
- **Model-Specific**: Optimize prompts for specific model capabilities

### Maintenance
- **Version Control**: Track prompt changes in git
- **Testing**: Test prompts with different scenarios
- **Documentation**: Document prompt purposes and usage
- **Consistency**: Maintain consistent tone and style across prompts