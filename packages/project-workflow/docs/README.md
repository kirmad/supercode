# Project Workflow Module Documentation

A comprehensive, object-oriented workflow processing system designed for extensibility and reusability across CLI and VSCode extension environments.

## 📚 Documentation Index

- **[Architecture Overview](./architecture.md)** - High-level system design and component relationships
- **[Core Interfaces](./interfaces.md)** - Interface specifications and design patterns
- **[API Reference](./api-reference.md)** - Public API documentation and usage examples
- **[Implementation Guide](./implementation-guide.md)** - Step-by-step implementation instructions
- **[Migration Strategy](./migration-strategy.md)** - Strategy for migrating from existing scripts
- **[Extension Guide](./extension-guide.md)** - How to add new workflow types

## 🎯 Quick Start

```typescript
import { WorkflowFactory } from '@opencode/project-workflow'

// Create a review workflow
const reviewWorkflow = WorkflowFactory.createReviewWorkflow({
  baseUrl: 'http://localhost:3000',
  maxParallelSessions: 3,
  optimalTokensPerShard: 7000,
  agent: 'code-reviewer'
})

// Process ADO PR or Git commit
const result = await reviewWorkflow.process({
  source: 'https://dev.azure.com/org/project/_git/repo/pullrequest/123',
  type: 'ado-pr'
})
```

## 🏗️ Design Principles

- **Interface-Based Design**: All major components implement interfaces for testability
- **Strategy Pattern**: Pluggable algorithms for different processing approaches
- **Single Responsibility**: Each class handles one major concern
- **Open/Closed**: Easy to extend for new workflow types without modifying existing code
- **Dependency Injection**: Constructor-based injection for flexibility and testing

## 🔄 Workflow Types

### Currently Supported
- **Review Workflow**: Code review with intelligent sharding and parallel processing

### Planned
- **Design Workflow**: System and component design generation
- **Implementation Workflow**: Feature and code implementation
- **Enhancement Workflow**: Prompt enhancement and optimization

## 🧩 Core Components

- **WorkflowProcessor**: Base class for all workflow implementations
- **ContentSource**: Abstraction for Git, ADO, and other content sources
- **ShardingStrategy**: Intelligent content splitting algorithms
- **ProcessingEngine**: Parallel execution with session management
- **ResultAggregator**: Result transformation and combination
- **WorkspaceManager**: File organization and cleanup

## 🚀 Benefits

- **Reusability**: Shared logic across CLI scripts and VSCode extension
- **Testability**: Comprehensive unit testing of isolated components
- **Extensibility**: Add new workflow types without breaking existing functionality
- **Performance**: Maintains existing optimizations (parallel processing, intelligent sharding)
- **Maintainability**: Clear separation of concerns and well-defined interfaces