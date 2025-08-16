# OpenCode Features Documentation

## Overview

This directory contains comprehensive documentation for OpenCode's key features and implementation details. Each document provides deep technical insights into specific subsystems, including file locations, code examples, and architectural patterns.

## Feature Documentation

### Core Systems

#### [System Prompts](./system-prompts.md)
- **Purpose**: Sophisticated prompt management for different AI models and conversation contexts
- **Key Files**: `packages/opencode/src/session/system.ts`, `packages/opencode/src/session/prompt/*.txt`
- **Features**: Model-specific prompt adaptation, conversation context awareness, dynamic prompt selection

#### [Tools System](./tools-system.md)
- **Purpose**: Comprehensive tools architecture with security sandboxing and provider adaptation
- **Key Files**: `packages/opencode/src/tool/registry.ts`, `packages/opencode/src/tool/*.ts`
- **Features**: Tool registration, security wrapping, provider-specific adaptation, execution context management

#### [AI Providers](./ai-providers.md)
- **Purpose**: Provider-agnostic AI integration supporting multiple vendors and models
- **Key Files**: `packages/opencode/src/provider/provider.ts`, provider-specific configurations
- **Features**: Dynamic provider loading, model management, cost tracking, usage analytics

#### [Session Management](./session-management.md)
- **Purpose**: Comprehensive conversation and state management with hierarchical organization
- **Key Files**: `packages/opencode/src/session/index.ts`, `packages/opencode/src/session/message-v2.ts`
- **Features**: Hierarchical sessions, real-time streaming, parent-child relationships, cost tracking

### Advanced Features

#### [Hooks System](./hooks-system.md)
- **Purpose**: Event-driven automation system for file operations and session lifecycle
- **Key Files**: `packages/opencode/src/config/hooks.ts`, configuration schemas
- **Features**: File event automation, session completion hooks, custom script execution

#### [Authentication & Security](./authentication-security.md)
- **Purpose**: Multi-provider OAuth, permission system, and secure credential management
- **Key Files**: `packages/opencode/src/auth/index.ts`, `packages/opencode/src/permission/index.ts`
- **Features**: OAuth device flows, user consent system, secure credential storage, tool security

## Architecture Patterns

### Common Design Patterns

#### Event-Driven Architecture
- **Event Bus**: `packages/opencode/src/bus/index.ts`
- **Real-time Updates**: Streaming updates across all subsystems
- **Pub/Sub Pattern**: Decoupled communication between components

#### Schema-First Design
- **Zod Validation**: All data structures validated with Zod schemas
- **Type Safety**: Full TypeScript integration with runtime validation
- **OpenAPI Integration**: Automatic API documentation generation

#### Plugin Architecture
- **Plugin System**: `packages/opencode/src/plugin/index.ts`
- **Extensibility**: Custom behavior via plugin hooks
- **Security Integration**: Plugin-based permission decisions

#### Provider Pattern
- **Abstraction Layer**: Unified interface for different AI providers
- **Dynamic Loading**: Runtime provider selection and configuration
- **Graceful Degradation**: Fallback mechanisms for provider failures

### Security Architecture

#### Defense in Depth
- **Permission System**: User consent for all operations
- **Input Validation**: Comprehensive validation at all boundaries
- **Resource Limits**: Size and timeout limits for operations
- **Secure Storage**: Encrypted credential storage with proper file permissions

#### Principle of Least Privilege
- **Minimal Permissions**: Tools request only necessary permissions
- **Session Isolation**: Permissions scoped to individual sessions
- **User Control**: Explicit user approval for sensitive operations

## Integration Points

### Tool Integration
All tools integrate with the permission system and session context:
```typescript
await Permission.ask({
  type: toolName,
  title: `Execute ${toolName}`,
  sessionID: context.sessionID,
  messageID: context.messageID,
  callID: context.callID,
  metadata: { args, toolName }
})
```

### Provider Integration
AI providers implement a common interface:
```typescript
interface Provider {
  models(): Promise<Model[]>
  createLanguageModel(modelID: string): LanguageModel
  createEmbeddingModel(modelID: string): EmbeddingModel
}
```

### Session Integration
All features integrate with the session system:
```typescript
const session = await Session.create({
  title: "Feature Task",
  agent: "specialist",
  model: { providerID: "anthropic", modelID: "claude-3-5-sonnet" }
})
```

## Development Workflow

### Feature Development Pattern
1. **Schema Definition**: Define Zod schemas for data structures
2. **Event Integration**: Add events to the bus system
3. **Permission Integration**: Implement permission checks
4. **Session Integration**: Connect with session lifecycle
5. **Testing**: Comprehensive testing including security scenarios

### Configuration Pattern
All features use consistent configuration:
```typescript
export const Config = z.object({
  featureName: z.object({
    enabled: z.boolean().default(true),
    settings: z.record(z.any()).optional(),
  }).optional(),
})
```

### Error Handling Pattern
Consistent error handling with typed errors:
```typescript
export const FeatureError = NamedError.create("FeatureError", z.object({
  message: z.string(),
  code: z.string(),
}))
```

## Performance Considerations

### Streaming Architecture
- **Real-time Updates**: All responses stream in real-time
- **Backpressure Handling**: Proper handling of high-frequency updates
- **Memory Management**: Efficient memory usage for large conversations

### Caching Strategy
- **Session Cache**: Active sessions cached in memory
- **Provider Cache**: Model metadata and capabilities cached
- **Permission Cache**: Approved permissions cached per session

### Resource Management
- **Token Tracking**: Comprehensive usage and cost tracking
- **Rate Limiting**: Proper rate limiting for external APIs
- **Cleanup**: Automatic cleanup of old sessions and data

## Monitoring and Observability

### Event Monitoring
All features emit events for monitoring:
```typescript
Bus.publish(Event.Updated, { info: updatedData })
Bus.publish(Event.Error, { error: errorDetails })
```

### Usage Analytics
- **Session Analytics**: Detailed session usage statistics
- **Tool Analytics**: Tool usage patterns and performance
- **Cost Analytics**: Provider costs and token usage

### Error Tracking
- **Structured Errors**: Consistent error format across features
- **Error Context**: Full context preservation for debugging
- **Error Recovery**: Graceful error recovery mechanisms

## Contributing

### Documentation Standards
- **File Locations**: Always include specific file paths
- **Code Examples**: Provide comprehensive code examples
- **Architecture Context**: Explain how features fit into overall architecture

### Testing Requirements
- **Unit Tests**: Comprehensive unit test coverage
- **Integration Tests**: Full integration testing
- **Security Tests**: Specific security scenario testing

### Review Checklist
- [ ] Schema validation implemented
- [ ] Permission system integrated
- [ ] Session lifecycle respected
- [ ] Event system connected
- [ ] Error handling comprehensive
- [ ] Documentation complete

## Related Documentation

- [Project Structure](../project-structure.md) - Overall codebase organization
- [Architecture](../architecture.md) - High-level system architecture
- [Development Guide](../development-guide.md) - Setup and contribution guidelines

Each feature document provides implementation details, code examples, and integration patterns for developers working with OpenCode's sophisticated AI coding agent architecture.