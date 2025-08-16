# AI Providers

## Overview

OpenCode is designed to be provider-agnostic, supporting multiple AI providers including Anthropic, OpenAI, Google, Amazon Bedrock, and local models. The provider system dynamically loads models based on configuration and available credentials.

## File Locations

### Core Provider System
- **Provider Management**: `packages/opencode/src/provider/provider.ts`
- **Model Definitions**: `packages/opencode/src/provider/models.ts`
- **Model Database**: `packages/opencode/src/provider/models-macro.ts`
- **Message Transform**: `packages/opencode/src/provider/transform.ts`

## Supported Providers

### Anthropic (Claude)
- **Models**: Claude 3, Claude 3.5, Claude 4 Sonnet variants
- **Features**: Tool calling, caching, reasoning, attachments
- **Environment**: `ANTHROPIC_API_KEY`
- **Special Headers**: Claude Code beta features, fine-grained streaming
- **Caching**: Ephemeral caching for system prompts

### OpenAI
- **Models**: GPT-4, GPT-5, O1, O3 series
- **Features**: Function calling, vision, responses mode
- **Environment**: `OPENAI_API_KEY`
- **Special Handling**: Response streaming, tool call normalization

### Google (Gemini)
- **Models**: Gemini 2.0, Gemini 2.5 Pro/Flash variants
- **Features**: Tool calling, multimodal, reasoning
- **Environment**: `GOOGLE_GENERATIVE_AI_API_KEY`
- **Schema Handling**: Custom parameter sanitization for compatibility

### Amazon Bedrock
- **Models**: Claude (via Bedrock), Nova series, Llama3
- **Features**: Regional model prefixing, credential chaining
- **Environment**: `AWS_PROFILE`, `AWS_ACCESS_KEY_ID`, `AWS_BEARER_TOKEN_BEDROCK`
- **Regions**: Multi-region support with automatic model prefixing

### OpenRouter
- **Models**: Wide variety of third-party models
- **Features**: Model aggregation, competitive pricing
- **Environment**: `OPENROUTER_API_KEY`
- **Headers**: Custom referer and title headers

### Azure OpenAI
- **Models**: Azure-hosted OpenAI models
- **Features**: Enterprise compliance, custom deployments
- **Environment**: `AZURE_OPENAI_API_KEY`
- **Configuration**: Custom endpoints and deployments

### Local/Custom Providers
- **Support**: Any OpenAI-compatible API
- **Configuration**: Custom base URLs and endpoints
- **Use Cases**: Local models, private deployments, custom APIs

## Provider Architecture

### Dynamic Provider Loading

```typescript
// packages/opencode/src/provider/provider.ts
const CUSTOM_LOADERS: Record<string, CustomLoader> = {
  async anthropic() {
    return {
      autoload: false,
      options: {
        headers: {
          "anthropic-beta": "claude-code-20250219,interleaved-thinking-2025-05-14"
        }
      }
    }
  },
  
  async "amazon-bedrock"() {
    const region = process.env["AWS_REGION"] ?? "us-east-1"
    return {
      autoload: true,
      options: {
        region,
        credentialProvider: fromNodeProviderChain()
      },
      async getModel(sdk, modelID) {
        // Regional model prefixing logic
        if (regionRequiresPrefix && modelRequiresPrefix) {
          modelID = `${regionPrefix}.${modelID}`
        }
        return sdk.languageModel(modelID)
      }
    }
  }
}
```

### Provider Discovery

Providers are discovered through multiple sources:

1. **Environment Variables**: Auto-detect based on API keys
2. **Configuration Files**: Explicit provider configuration
3. **Custom Loaders**: Provider-specific initialization logic
4. **API Authentication**: Runtime API key management
5. **Plugin System**: Third-party provider extensions

### Model Schema

```typescript
// packages/opencode/src/provider/models.ts
export const Model = z.object({
  id: z.string(),
  name: z.string(),
  release_date: z.string(),
  attachment: z.boolean(),        // File attachment support
  reasoning: z.boolean(),         // Reasoning capabilities
  temperature: z.boolean(),       // Temperature control
  tool_call: z.boolean(),        // Tool calling support
  cost: z.object({
    input: z.number(),            // Cost per input token
    output: z.number(),           // Cost per output token
    cache_read: z.number().optional(),
    cache_write: z.number().optional()
  }),
  limit: z.object({
    context: z.number(),          // Context window size
    output: z.number()            // Max output tokens
  }),
  options: z.record(z.any())      // Provider-specific options
})

export const Provider = z.object({
  api: z.string().optional(),     // API base URL
  name: z.string(),               // Display name
  env: z.array(z.string()),       // Environment variables
  id: z.string(),                 // Unique identifier
  npm: z.string().optional(),     // NPM package name
  models: z.record(Model)         // Available models
})
```

## Configuration

### Environment-Based Configuration

```bash
# Anthropic
export ANTHROPIC_API_KEY="your_api_key"

# OpenAI
export OPENAI_API_KEY="your_api_key"

# Google
export GOOGLE_GENERATIVE_AI_API_KEY="your_api_key"

# AWS Bedrock
export AWS_PROFILE="your_profile"
export AWS_REGION="us-east-1"

# OpenRouter
export OPENROUTER_API_KEY="your_api_key"

# Azure
export AZURE_OPENAI_API_KEY="your_api_key"
```

### Configuration File

```json
// opencode.json
{
  "model": "anthropic/claude-3-5-sonnet-20241022",
  "small_model": "anthropic/claude-3-5-haiku-20241022",
  "disabled_providers": ["openai", "google"],
  "provider": {
    "anthropic": {
      "options": {
        "baseURL": "https://api.anthropic.com"
      }
    },
    "custom-provider": {
      "name": "Custom Provider",
      "api": "https://api.custom.com/v1",
      "env": ["CUSTOM_API_KEY"],
      "models": {
        "custom-model": {
          "name": "Custom Model",
          "cost": { "input": 0.01, "output": 0.03 },
          "limit": { "context": 8192, "output": 4096 }
        }
      }
    }
  }
}
```

## Provider-Specific Features

### Anthropic Claude

```typescript
// Anthropic-specific headers and features
const anthropicOptions = {
  headers: {
    "anthropic-beta": [
      "claude-code-20250219",           // Claude Code integration
      "interleaved-thinking-2025-05-14", // Reasoning features
      "fine-grained-tool-streaming-2025-05-14" // Tool streaming
    ].join(",")
  }
}

// Caching support
const cachingOptions = {
  cacheControl: { type: "ephemeral" }
}
```

### Amazon Bedrock

```typescript
// Regional model prefixing
function applyRegionalPrefix(modelID: string, region: string): string {
  let regionPrefix = region.split("-")[0]
  
  switch (regionPrefix) {
    case "us":
      if (["claude", "deepseek"].some(m => modelID.includes(m))) {
        return `${regionPrefix}.${modelID}`
      }
      break
    case "eu":
      if (["claude", "nova-lite", "llama3"].some(m => modelID.includes(m))) {
        return `${regionPrefix}.${modelID}`
      }
      break
    case "ap":
      if (["claude", "nova-lite", "nova-pro"].some(m => modelID.includes(m))) {
        return `apac.${modelID}`
      }
      break
  }
  
  return modelID
}
```

### Google Gemini

```typescript
// Parameter sanitization for Gemini compatibility
function sanitizeGeminiParameters(schema: z.ZodTypeAny): z.ZodTypeAny {
  // Remove unsupported default values on unions
  if (schema instanceof z.ZodDefault) {
    const innerSchema = schema.removeDefault()
    if (innerSchema instanceof z.ZodUnion) {
      return sanitizeGeminiParameters(innerSchema)
    }
  }
  
  // Handle string validation restrictions
  if (schema instanceof z.ZodString) {
    const safeChecks = ["min", "max", "length", "regex", "startsWith", "endsWith"]
    return filterStringChecks(schema, safeChecks)
  }
  
  return schema
}
```

## Message Transformation

### Tool Call Normalization

```typescript
// packages/opencode/src/provider/transform.ts
function normalizeToolCallIds(msgs: ModelMessage[]): ModelMessage[] {
  return msgs.map((msg) => {
    if (Array.isArray(msg.content)) {
      msg.content = msg.content.map((part) => {
        if (part.type === "tool-call" && "toolCallId" in part) {
          return {
            ...part,
            toolCallId: part.toolCallId.replace(/[^a-zA-Z0-9_-]/g, "_")
          }
        }
        return part
      })
    }
    return msg
  })
}
```

### Caching Strategy

```typescript
function applyCaching(msgs: ModelMessage[], providerID: string): ModelMessage[] {
  const system = msgs.filter(msg => msg.role === "system").slice(0, 2)
  const final = msgs.filter(msg => msg.role !== "system").slice(-2)
  
  const providerOptions = {
    anthropic: { cacheControl: { type: "ephemeral" } },
    openrouter: { cache_control: { type: "ephemeral" } },
    bedrock: { cachePoint: { type: "ephemeral" } }
  }
  
  // Apply caching to system and recent messages
  for (const msg of [...system, ...final]) {
    applyProviderCaching(msg, providerOptions[providerID])
  }
  
  return msgs
}
```

## Model Selection

### Default Model Priority

```typescript
// Model priority for auto-selection
const priority = [
  "gemini-2.5-pro-preview",
  "gpt-5", 
  "claude-sonnet-4"
]

// Small model priority for operations like summarization
const smallModelPriority = [
  "3-5-haiku",
  "3.5-haiku", 
  "gemini-2.5-flash",
  "gpt-5-nano"
]
```

### Model Parsing

```typescript
// Parse model strings like "provider/model"
export function parseModel(model: string) {
  const [providerID, ...rest] = model.split("/")
  return {
    providerID: providerID,
    modelID: rest.join("/")
  }
}

// Usage examples:
// "anthropic/claude-3-5-sonnet-20241022"
// "openai/gpt-4"
// "google/gemini-2.5-pro"
```

## Authentication Integration

### API Key Management

```typescript
// Load API keys from multiple sources
async function loadProviders() {
  // 1. Environment variables
  for (const [providerID, provider] of Object.entries(database)) {
    const apiKey = provider.env.map(env => process.env[env]).at(0)
    if (apiKey) {
      mergeProvider(providerID, { apiKey }, "env")
    }
  }
  
  // 2. Runtime API management
  for (const [providerID, provider] of Object.entries(await Auth.all())) {
    if (provider.type === "api") {
      mergeProvider(providerID, { apiKey: provider.key }, "api")
    }
  }
  
  // 3. Custom loaders (OAuth, special auth)
  for (const [providerID, loader] of Object.entries(CUSTOM_LOADERS)) {
    const result = await loader(database[providerID])
    if (result.autoload || providers[providerID]) {
      mergeProvider(providerID, result.options, "custom", result.getModel)
    }
  }
}
```

### GitHub Copilot Integration

OpenCode integrates with GitHub Copilot authentication for seamless model access:

```typescript
// packages/opencode/src/auth/github-copilot.ts
export async function getCopilotToken(): Promise<string> {
  // Integrate with GitHub Copilot authentication flow
  // Use existing Copilot credentials for model access
}
```

## Plugin System Integration

### Custom Provider Plugins

```typescript
// Plugin-based provider loading
for (const plugin of await Plugin.list()) {
  if (!plugin.auth) continue
  
  const providerID = plugin.auth.provider
  const auth = await Auth.get(providerID)
  
  if (plugin.auth.loader) {
    const options = await plugin.auth.loader(
      () => Auth.get(providerID),
      database[providerID]
    )
    mergeProvider(providerID, options, "custom")
  }
}
```

## Error Handling

### Provider-Specific Errors

```typescript
export const ModelNotFoundError = NamedError.create(
  "ProviderModelNotFoundError",
  z.object({
    providerID: z.string(),
    modelID: z.string()
  })
)

export const InitError = NamedError.create(
  "ProviderInitError", 
  z.object({
    providerID: z.string()
  })
)
```

### Error Recovery

- **Fallback Models**: Automatic fallback to available models
- **Provider Retry**: Retry with different providers
- **Graceful Degradation**: Continue with reduced functionality
- **Clear Error Messages**: User-friendly error reporting

## Performance Optimization

### SDK Caching

```typescript
// Cache SDK instances to avoid re-initialization
const sdk = new Map<string, SDK>()

async function getSDK(provider: ModelsDev.Provider) {
  const existing = sdk.get(provider.id)
  if (existing) return existing
  
  // Dynamic import and initialization
  const pkg = provider.npm ?? provider.id
  const mod = await import(await BunProc.install(pkg, "latest"))
  const loaded = createProvider(mod, provider.options)
  
  sdk.set(provider.id, loaded)
  return loaded
}
```

### Model Caching

```typescript
// Cache model instances for reuse
const models = new Map<string, { info: Model; language: LanguageModel }>()

export async function getModel(providerID: string, modelID: string) {
  const key = `${providerID}/${modelID}`
  if (models.has(key)) return models.get(key)!
  
  // Load and cache model
  const model = await loadModel(providerID, modelID)
  models.set(key, model)
  return model
}
```

## Best Practices

### Provider Configuration
- **Environment First**: Use environment variables for API keys
- **Configuration Override**: Use config files for custom settings
- **Security**: Never commit API keys to version control
- **Fallbacks**: Configure multiple providers for reliability

### Model Selection
- **Default Models**: Configure sensible defaults for common use cases
- **Cost Optimization**: Use smaller models for simple tasks
- **Feature Matching**: Match model capabilities to task requirements
- **Performance**: Consider latency and throughput requirements

### Error Handling
- **Graceful Degradation**: Handle provider outages gracefully
- **User Communication**: Provide clear error messages
- **Logging**: Log provider issues for debugging
- **Monitoring**: Monitor provider health and performance