# OpenCode Architecture

## System Overview

OpenCode is designed as a client/server architecture with a focus on terminal user interfaces (TUI). The system provides an AI coding agent that can run locally while being driven remotely from various clients, including mobile applications.

## High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client Layer  │    │  Server Layer   │    │  Cloud Layer    │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │     TUI     │ │◄──►│ │ OpenCode    │ │◄──►│ │ Cloud API   │ │
│ │   Terminal  │ │    │ │   Server    │ │    │ │   Services  │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │  VS Code    │ │    │ │   AI Agent  │ │    │ │  Database   │ │
│ │ Extension   │ │    │ │   Engine    │ │    │ │  Services   │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │   Mobile    │ │    │ │    Tool     │ │    │ │   Billing   │ │
│ │    App      │ │    │ │  Registry   │ │    │ │  Services   │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Core Components

### 1. Client Layer

#### Terminal UI (TUI)
- **Primary Interface**: Built for terminal power users
- **Theme System**: 25+ customizable color themes
- **Real-time Updates**: Live session monitoring and interaction
- **Keyboard Navigation**: Optimized for terminal workflows

#### VS Code Extension
- **IDE Integration**: Native VS Code experience
- **Command Palette**: Integrated OpenCode commands
- **File Synchronization**: Seamless editor integration

#### Future Clients
- **Mobile Apps**: Remote control of local OpenCode instances
- **Web Interface**: Browser-based client for remote access

### 2. Server Layer

#### OpenCode Server (`packages/opencode/src/server/`)
- **Session Management**: Multi-session support with state persistence
- **Command Processing**: CLI command execution and routing
- **Real-time Communication**: WebSocket-based client communication
- **Plugin System**: Extensible architecture for custom tools

#### AI Agent Engine (`packages/opencode/src/agent/`)
- **Provider Agnostic**: Support for Anthropic, OpenAI, Google, local models
- **Context Management**: Intelligent context window management
- **Tool Integration**: Dynamic tool selection and execution
- **Memory System**: Conversation and project memory

#### Tool Registry (`packages/opencode/src/tool/`)
- **Development Tools**: bash, edit, glob, grep, ls, multiedit, read, test, todo
- **Language Support**: LSP integration for multiple languages
- **File Operations**: Comprehensive file system operations
- **Code Analysis**: Static analysis and pattern matching

### 3. Cloud Layer

#### Cloud API Services (`cloud/`)
- **Authentication**: GitHub Copilot integration and token management
- **User Management**: Account creation and workspace management
- **Billing**: Stripe integration for subscription management
- **Analytics**: Usage tracking and performance metrics

#### Database Services
- **User Data**: Account information and preferences
- **Workspace State**: Project configurations and settings
- **Session History**: Conversation logs and command history
- **Usage Metrics**: Performance and billing data

## Data Flow Architecture

### 1. Command Execution Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client    │───►│    CLI      │───►│   Agent     │───►│    Tool     │
│  Command    │    │  Parser     │    │  Engine     │    │  Registry   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                            │                  │                  │
                            ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Result    │◄───│  Response   │◄───│   AI Model  │◄───│  Execution  │
│  Display    │    │ Formatter   │    │  Response   │    │   Result    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### 2. Session Management Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client    │───►│   Session   │───►│   Storage   │
│ Connection  │    │  Manager    │    │   Layer     │
└─────────────┘    └─────────────┘    └─────────────┘
        │                  │                  │
        ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Message   │    │   State     │    │  Persistence│
│   Handler   │    │ Management  │    │   System    │
└─────────────┘    └─────────────┘    └─────────────┘
```

## Technology Stack

### Runtime Environment
- **Primary Runtime**: Bun (JavaScript/TypeScript)
- **Secondary Runtime**: Go (TUI components)
- **Package Manager**: Bun with workspace support
- **Type System**: TypeScript 5.8.2

### Web Framework
- **API Framework**: Hono 4.7.10
- **Validation**: Zod 3.25.76
- **Router**: Hono's built-in routing
- **Middleware**: Authentication, logging, error handling

### Database & Storage
- **ORM**: Drizzle with SQL schema definitions
- **Database**: Production-ready SQL database
- **Migrations**: Automated schema migrations
- **Local Storage**: File-based session storage

### Infrastructure
- **Platform**: SST (Serverless Stack) v3
- **Cloud Provider**: Cloudflare Workers
- **Authentication**: OpenAuth with GitHub integration
- **Payments**: Stripe integration
- **Deployment**: Infrastructure as Code

### AI Integration
- **AI Library**: Generic AI library (5.0.8)
- **Providers**: Multi-provider support
- **Context Protocol**: Model Context Protocol (MCP)
- **Tool Integration**: Dynamic tool selection

## Security Architecture

### Authentication Flow
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client    │───►│   GitHub    │───►│  OpenAuth   │
│    Auth     │    │   Copilot   │    │  Service    │
└─────────────┘    └─────────────┘    └─────────────┘
        │                                      │
        ▼                                      ▼
┌─────────────┐                    ┌─────────────┐
│    Token    │◄───────────────────│   Session   │
│  Validation │                    │  Creation   │
└─────────────┘                    └─────────────┘
```

### Authorization Layers
1. **Client Authentication**: Token-based authentication
2. **Command Authorization**: Permission-based command execution
3. **File System Access**: Sandboxed file operations
4. **Cloud Service Access**: API key management

## Plugin Architecture

### Plugin System (`packages/plugin/`)
- **Interface Definition**: Standardized plugin API
- **Runtime Loading**: Dynamic plugin discovery and loading
- **Tool Registration**: Plugin tools integrated with tool registry
- **Configuration**: Plugin-specific configuration management

### Extension Points
1. **Custom Tools**: Add new development tools
2. **AI Providers**: Integrate additional AI providers
3. **File Handlers**: Custom file type processing
4. **UI Components**: Custom TUI components

## Performance Considerations

### Optimization Strategies
1. **Lazy Loading**: On-demand component loading
2. **Connection Pooling**: Efficient resource management
3. **Caching**: Intelligent caching at multiple layers
4. **Streaming**: Real-time response streaming

### Scalability Design
1. **Horizontal Scaling**: Stateless server design
2. **Resource Management**: Efficient memory and CPU usage
3. **Load Balancing**: Cloud-native load distribution
4. **Auto-scaling**: Dynamic resource allocation

## Development Patterns

### Monorepo Organization
- **Workspace Management**: Bun workspace with dependency catalog
- **Code Sharing**: Shared utilities and types across packages
- **Build Coordination**: Centralized build and type checking
- **Version Management**: Synchronized versioning across packages

### Error Handling
- **Graceful Degradation**: Fallback mechanisms for failures
- **Error Propagation**: Structured error handling throughout the stack
- **Logging**: Comprehensive logging for debugging and monitoring
- **Recovery**: Automatic recovery from transient failures

### Testing Strategy
- **Unit Testing**: Component-level testing
- **Integration Testing**: Cross-component testing
- **End-to-End Testing**: Full workflow testing
- **Performance Testing**: Load and stress testing

## Future Architecture Considerations

### Planned Enhancements
1. **Mobile Client Support**: Native mobile applications
2. **Multi-user Collaboration**: Shared workspace functionality
3. **Plugin Marketplace**: Community plugin distribution
4. **Advanced AI Features**: Enhanced context and reasoning

### Scalability Roadmap
1. **Microservices**: Service decomposition for larger scale
2. **Event-Driven Architecture**: Asynchronous event processing
3. **Multi-region Deployment**: Global availability
4. **Edge Computing**: Reduced latency through edge deployment