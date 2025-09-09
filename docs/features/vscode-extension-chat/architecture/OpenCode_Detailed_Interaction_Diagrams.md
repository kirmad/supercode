# OpenCode Detailed Interaction Diagrams

## Table of Contents

1. [Agent and Model Selection Flow](#agent-and-model-selection-flow)
2. [Session Management Patterns](#session-management-patterns)  
3. [Permission System Flow](#permission-system-flow)
4. [Error Handling and Recovery](#error-handling-and-recovery)
5. [Theme and Configuration Management](#theme-and-configuration-management)
6. [Performance Optimization Flows](#performance-optimization-flows)

---

## Agent and Model Selection Flow

### Agent Selection and Switching

```mermaid
sequenceDiagram
    participant U as User
    participant TUI as Terminal UI
    participant API as API Server
    participant Config as Config Service
    participant Agent as Agent Controller
    participant AI as AI Provider

    Note over U,AI: User initiates agent/model selection

    %% Agent selection trigger
    U->>TUI: Press 'a' (agent selection)
    TUI->>TUI: Show agent selection modal
    TUI->>API: GET /agents
    API->>Config: Fetch available agents
    Config-->>API: Agent list with capabilities
    API-->>TUI: Available agents
    TUI->>TUI: Display agent modal with options

    %% User selects agent
    U->>TUI: Select agent (arrow keys + enter)
    TUI->>API: PUT /sessions/{id}/agent
    API->>Config: Validate agent selection
    Config-->>API: Agent validation result
    
    alt Valid Agent
        API->>Agent: Switch to new agent
        Agent->>Agent: Load agent configuration
        Agent->>Agent: Update permissions & capabilities
        Agent->>Config: Update usage statistics
        API->>TUI: Agent switch successful
        TUI->>TUI: Update status bar
        TUI->>TUI: Close modal
        TUI->>TUI: Show toast: "Switched to {agent}"
        
    else Invalid Agent
        API-->>TUI: Error response
        TUI->>TUI: Show error toast
        TUI->>TUI: Keep modal open
    end

    Note over U,AI: Model selection follows similar pattern

    %% Model selection (can be triggered independently)
    U->>TUI: Press 'm' (model selection)
    TUI->>API: GET /providers
    API->>Config: Fetch providers & models
    Config-->>API: Provider list with model capabilities
    API-->>TUI: Available models grouped by provider
    
    TUI->>TUI: Show model selection modal
    TUI->>TUI: Display providers (Anthropic, OpenAI, etc.)
    U->>TUI: Navigate and select model
    TUI->>API: PUT /sessions/{id}/model
    
    API->>Agent: Update model configuration
    Agent->>AI: Test model connectivity
    
    alt Model Available
        AI-->>Agent: Connection successful
        Agent->>Config: Update model usage stats
        API->>TUI: Model switch successful
        TUI->>TUI: Update status bar with model info
        
    else Model Unavailable
        AI-->>Agent: Connection failed
        Agent-->>API: Model error
        API-->>TUI: Error with fallback suggestion
        TUI->>TUI: Show error + suggest alternative
    end

    Note over U,AI: Agent-Model association for future sessions
    
    Config->>Config: Update agent-model preferences
    Config->>Config: Store in persistent state
```

### Model Capability and Parameter Handling

```mermaid
graph TB
    subgraph "Model Selection Process"
        User[User Selection<br/>Agent + Model]
        Validation[Capability Validation<br/>Tools, Context, Features]
        ParamTransform[Parameter Transformation<br/>Provider-specific]
    end

    subgraph "Provider Adapters"
        Anthropic[Anthropic Adapter<br/>Native Tool Support]
        OpenAI[OpenAI Adapter<br/>Function Calling]
        Google[Google Adapter<br/>Parameter Sanitization]
        Local[Local Adapter<br/>Limited Features]
    end

    subgraph "Parameter Transformations"
        OptionalNull[Optional → Nullable<br/>OpenAI/Azure Requirement]
        SchemaSanitize[Schema Sanitization<br/>Gemini Limitations]
        ToolMapping[Tool Function Mapping<br/>Provider Formats]
    end

    subgraph "Capability Matrix"
        ToolSupport[Tool Execution<br/>✓ Anthropic, OpenAI<br/>⚠ Google, ❌ Some Local]
        ContextLength[Context Window<br/>8K-200K tokens]
        StreamingSupport[Response Streaming<br/>Most Providers]
        VisionSupport[Vision/Image Input<br/>GPT-4V, Claude-3]
    end

    %% Selection flow
    User --> Validation
    Validation --> ParamTransform
    
    %% Provider routing
    ParamTransform --> Anthropic
    ParamTransform --> OpenAI
    ParamTransform --> Google
    ParamTransform --> Local

    %% Transformations
    OpenAI --> OptionalNull
    Google --> SchemaSanitize
    OpenAI --> ToolMapping
    Google --> ToolMapping

    %% Capabilities
    Validation --> ToolSupport
    Validation --> ContextLength
    Validation --> StreamingSupport
    Validation --> VisionSupport

    classDef process fill:#e3f2fd
    classDef provider fill:#e8f5e8
    classDef transform fill:#fff3e0
    classDef capability fill:#fce4ec

    class User,Validation,ParamTransform process
    class Anthropic,OpenAI,Google,Local provider
    class OptionalNull,SchemaSanitize,ToolMapping transform
    class ToolSupport,ContextLength,StreamingSupport,VisionSupport capability
```

---

## Session Management Patterns

### Session Lifecycle Management

```mermaid
stateDiagram-v2
    [*] --> SessionList: App Launch
    SessionList --> CreateSession: New Session
    SessionList --> LoadSession: Select Existing
    SessionList --> DeleteSession: Delete Action
    
    CreateSession --> ActiveSession: Session Created
    LoadSession --> ActiveSession: Messages Loaded
    
    state ActiveSession {
        [*] --> Chatting
        Chatting --> Processing: Send Message
        Processing --> Streaming: AI Response
        Streaming --> ToolExecution: Tool Called
        ToolExecution --> Streaming: Tool Complete
        Streaming --> Chatting: Response Complete
        
        Chatting --> SessionSettings: Settings Modal
        SessionSettings --> Chatting: Settings Updated
        
        Chatting --> ShareSession: Share Action
        ShareSession --> Chatting: Share Complete
    }
    
    ActiveSession --> SessionList: Exit Session
    DeleteSession --> SessionList: Confirm Delete
    
    ActiveSession --> [*]: App Close
    SessionList --> [*]: App Close
```

### Session Data Flow and Persistence

```mermaid
sequenceDiagram
    participant UI as UI Component
    participant Store as Session Store
    participant API as API Service
    participant DB as Database
    participant Cache as Cache Layer

    Note over UI,Cache: Session creation and management

    %% Create new session
    UI->>Store: Create session action
    Store->>API: POST /sessions
    API->>DB: Insert session record
    DB-->>API: Session created with ID
    API-->>Store: Session data
    Store->>Cache: Cache session metadata
    Store->>UI: Update UI with new session

    %% Load existing session
    UI->>Store: Load session action
    Store->>Cache: Check session cache
    
    alt Cache Hit
        Cache-->>Store: Cached messages
        Store->>UI: Display cached data
        Store->>API: GET /sessions/{id}/messages (background sync)
        API-->>Store: Latest messages
        Store->>UI: Update with server data
        
    else Cache Miss
        Store->>API: GET /sessions/{id}/messages
        API->>DB: Fetch messages with parts
        DB-->>API: Complete message data
        API-->>Store: Message history
        Store->>Cache: Update cache
        Store->>UI: Display messages
    end

    %% Session state updates
    loop Real-time Updates
        API->>Store: SSE event (message/session update)
        Store->>Store: Apply update to state
        Store->>Cache: Update cached data
        Store->>UI: Re-render affected components
    end

    %% Session persistence
    Store->>API: PUT /sessions/{id} (periodic sync)
    API->>DB: Update session metadata
    DB-->>API: Update confirmed
    Store->>Cache: Persist critical state locally

    Note over UI,Cache: Offline/online state handling

    alt Network Offline
        UI->>Store: User actions
        Store->>Store: Queue actions locally
        Store->>Cache: Persist queued actions
        Store->>UI: Optimistic updates
        
        Store->>Store: Network reconnected
        Store->>API: Sync queued actions
        API->>DB: Apply queued updates
        Store->>Store: Clear action queue
    end
```

---

## Permission System Flow

### Permission Request and Approval Flow

```mermaid
sequenceDiagram
    participant AI as AI Provider
    participant Agent as Agent Controller  
    participant Tool as Tool Executor
    participant Perm as Permission Service
    participant UI as User Interface
    participant User as User

    Note over AI,User: AI requests tool that requires permission

    AI->>Agent: Tool call (file write/bash/etc)
    Agent->>Tool: Execute tool request
    Tool->>Perm: Check agent permissions
    Perm->>Perm: Evaluate permission requirements
    
    alt Permission Granted (cached)
        Perm-->>Tool: Permission allowed
        Tool->>Tool: Execute immediately
        Tool-->>Agent: Tool result
        
    else Permission Required
        Perm->>Perm: Create permission request
        Perm->>UI: Broadcast permission.required event
        UI->>UI: Show permission modal
        UI->>UI: Display permission details:
        Note over UI: - Tool type and parameters<br/>- Risk assessment<br/>- Allow Once/Always/Reject options
        
        UI->>User: Present permission choice
        User->>UI: Select permission response
        UI->>Perm: POST /permissions/{id}/respond
        
        alt User Allows Once
            Perm->>Perm: Grant temporary permission
            Perm->>Tool: Permission granted (temporary)
            Tool->>Tool: Execute with temp permission
            Tool-->>Agent: Tool result
            Agent->>AI: Continue with result
            
        else User Allows Always  
            Perm->>Perm: Grant permanent permission
            Perm->>Perm: Update agent permission cache
            Perm->>Tool: Permission granted (permanent)
            Tool->>Tool: Execute with full permission
            Tool-->>Agent: Tool result
            Agent->>AI: Continue with result
            
        else User Rejects
            Perm->>Tool: Permission denied
            Tool-->>Agent: Permission error
            Agent->>AI: Tool execution failed (permission)
            AI->>Agent: Handle permission denial
        end
        
        UI->>UI: Close permission modal
    end

    Note over AI,User: Permission state persisted for future requests
```

### Permission Matrix and Risk Assessment

```mermaid
graph TB
    subgraph "Permission Categories"
        FilePerms[File Permissions<br/>read, write, edit]
        ExecPerms[Execution Permissions<br/>bash, shell commands]
        NetPerms[Network Permissions<br/>webfetch, external APIs]
        SysPerms[System Permissions<br/>system info, env vars]
    end

    subgraph "Risk Assessment"
        LowRisk[Low Risk<br/>read files, basic queries]
        MedRisk[Medium Risk<br/>write files, safe commands]
        HighRisk[High Risk<br/>system commands, network]
        CritRisk[Critical Risk<br/>destructive operations]
    end

    subgraph "Permission Policies"
        AllowAlways[Allow Always<br/>Cached permanently]
        AllowOnce[Allow Once<br/>Single operation]
        PromptAlways[Prompt Always<br/>Never cache decision]
        DenyAlways[Deny Always<br/>Block completely]
    end

    subgraph "Context Factors"
        ProjectType[Project Type<br/>Trusted/Unknown]
        UserHistory[User History<br/>Previous decisions]
        OperationScope[Operation Scope<br/>Single file/System-wide]
        TimeOfDay[Time Context<br/>Working hours/Off-hours]
    end

    %% Risk assessment flow
    FilePerms --> LowRisk
    FilePerms --> MedRisk
    ExecPerms --> MedRisk
    ExecPerms --> HighRisk
    NetPerms --> HighRisk
    SysPerms --> CritRisk

    %% Policy application
    LowRisk --> AllowAlways
    MedRisk --> AllowOnce
    HighRisk --> PromptAlways
    CritRisk --> DenyAlways

    %% Context influence
    ProjectType --> AllowAlways
    UserHistory --> AllowOnce
    OperationScope --> PromptAlways
    TimeOfDay --> DenyAlways

    classDef permission fill:#e3f2fd
    classDef risk fill:#fff3e0
    classDef policy fill:#e8f5e8
    classDef context fill:#fce4ec

    class FilePerms,ExecPerms,NetPerms,SysPerms permission
    class LowRisk,MedRisk,HighRisk,CritRisk risk
    class AllowAlways,AllowOnce,PromptAlways,DenyAlways policy
    class ProjectType,UserHistory,OperationScope,TimeOfDay context
```

---

## Error Handling and Recovery

### Error Propagation and Recovery Flow

```mermaid
sequenceDiagram
    participant Comp as UI Component
    participant Store as State Store
    participant API as API Service
    participant Error as Error Handler
    participant User as User Interface

    Note over Comp,User: Error occurs at various system levels

    %% Network error
    Comp->>API: Make API request
    API-->>Comp: Network error (timeout/500/etc)
    Comp->>Error: Handle network error
    
    Error->>Error: Categorize error type
    Error->>Error: Determine retry strategy
    
    alt Retryable Error (network timeout)
        Error->>Store: Queue retry with backoff
        Error->>User: Show retry notification
        Store->>API: Retry request (exponential backoff)
        API-->>Store: Request succeeds
        Store->>User: Clear error notification
        Store->>Comp: Update with success data
        
    else Non-retryable Error (authentication)
        Error->>User: Show error modal
        Error->>Store: Update error state
        User->>User: Display error details + actions
        User->>Comp: User acknowledges error
        Comp->>Store: Clear error state
    end

    %% AI Provider error
    Store->>API: Send message to AI
    API-->>Store: AI provider error
    Store->>Error: Handle AI error
    
    Error->>Error: Check error type:
    Note over Error: - Rate limit<br/>- Model unavailable<br/>- Context too long<br/>- Invalid request
    
    alt Rate Limited
        Error->>Store: Set rate limit state
        Error->>User: Show rate limit notice
        Error->>Store: Schedule retry after rate limit
        
    else Model Unavailable
        Error->>Store: Suggest fallback model
        Error->>User: Show model switch dialog
        User->>Store: Accept/reject fallback
        
    else Context Too Long
        Error->>Store: Suggest context trimming
        Error->>User: Show context management dialog
        User->>Store: Trim conversation/summarize
        
    else Invalid Request
        Error->>User: Show error details
        Error->>Store: Log error for debugging
    end

    %% Tool execution error
    API->>API: Tool execution fails
    API->>Error: Handle tool error
    
    Error->>Error: Analyze tool error:
    Note over Error: - Permission denied<br/>- File not found<br/>- Command failed<br/>- Timeout
    
    alt Permission Denied
        Error->>User: Show permission request
        User->>Error: Grant/deny permission
        Error->>API: Retry with permission
        
    else File Operation Error
        Error->>User: Show file error dialog
        Error->>User: Suggest file fixes
        User->>Comp: Manual file operation
        
    else Command Failed
        Error->>User: Show command output
        Error->>Store: Log for AI context
        Store->>API: Send error to AI for handling
    end

    Note over Comp,User: Error recovery and learning

    Error->>Store: Log error patterns
    Store->>Store: Update error prevention rules
    Store->>Comp: Apply preventive measures
```

### Error Classification and Response Matrix

```mermaid
graph TB
    subgraph "Error Categories"
        NetworkErr[Network Errors<br/>Timeout, Connection, DNS]
        AuthErr[Authentication Errors<br/>Token, Permission, Session]
        AIErr[AI Provider Errors<br/>Rate Limit, Model, Context]
        ToolErr[Tool Execution Errors<br/>File, Command, System]
        ValidationErr[Validation Errors<br/>Input, Schema, Format]
    end

    subgraph "Error Severity"
        Info[Info Level<br/>Informational messages]
        Warning[Warning Level<br/>Potential issues]
        Error[Error Level<br/>Operation failed]
        Critical[Critical Level<br/>System failure]
    end

    subgraph "Recovery Strategies"
        AutoRetry[Automatic Retry<br/>Exponential backoff]
        UserAction[User Action Required<br/>Manual intervention]
        Fallback[Fallback Options<br/>Alternative approaches]
        GracefulDeg[Graceful Degradation<br/>Reduced functionality]
    end

    subgraph "User Experience"
        SilentRetry[Silent Retry<br/>No user notification]
        ProgressNotif[Progress Notification<br/>Show retry attempts]
        ErrorDialog[Error Dialog<br/>Detailed information]
        InlineError[Inline Error<br/>Contextual feedback]
    end

    %% Error routing
    NetworkErr --> Warning
    NetworkErr --> Error
    AuthErr --> Error
    AuthErr --> Critical
    AIErr --> Warning
    AIErr --> Error
    ToolErr --> Error
    ValidationErr --> Warning

    %% Recovery mapping
    Warning --> AutoRetry
    Error --> UserAction
    Error --> Fallback
    Critical --> GracefulDeg

    %% UX mapping
    AutoRetry --> SilentRetry
    AutoRetry --> ProgressNotif
    UserAction --> ErrorDialog
    Fallback --> InlineError

    classDef category fill:#e3f2fd
    classDef severity fill:#fff3e0
    classDef recovery fill:#e8f5e8
    classDef ux fill:#fce4ec

    class NetworkErr,AuthErr,AIErr,ToolErr,ValidationErr category
    class Info,Warning,Error,Critical severity
    class AutoRetry,UserAction,Fallback,GracefulDeg recovery
    class SilentRetry,ProgressNotif,ErrorDialog,InlineError ux
```

---

## Theme and Configuration Management

### Dynamic Theme Switching

```mermaid
sequenceDiagram
    participant User as User
    participant UI as UI Component
    participant Theme as Theme Store
    participant CSS as CSS Variables
    participant Cache as Local Storage

    Note over User,Cache: User initiates theme change

    User->>UI: Press 't' or select theme from menu
    UI->>UI: Show theme selection modal
    UI->>Theme: Get available themes
    Theme-->>UI: Theme list (25+ themes)
    
    UI->>UI: Display themes with previews
    User->>UI: Select new theme
    UI->>Theme: Set active theme
    
    Theme->>Theme: Validate theme structure
    Theme->>CSS: Apply CSS custom properties
    
    Note over CSS: CSS variables update:
    CSS->>CSS: --background: #new-color
    CSS->>CSS: --foreground: #new-color  
    CSS->>CSS: --primary: #new-color
    CSS->>CSS: --accent: #new-color
    CSS->>CSS: --error: #new-color
    
    CSS->>UI: Trigger re-render with new colors
    UI->>UI: Update all themed components
    UI->>UI: Animate color transitions
    
    Theme->>Cache: Persist theme selection
    Cache->>Cache: Store in localStorage
    
    Theme->>Theme: Clear component render cache
    Theme->>UI: Invalidate cached styles
    UI->>UI: Re-render message components
    UI->>UI: Update syntax highlighting colors
    UI->>UI: Refresh tool visualizations
    
    UI->>User: Show theme applied notification
    UI->>UI: Close theme selection modal

    Note over User,Cache: Theme persistence and system integration

    Theme->>Theme: Detect system theme changes
    Theme->>Theme: Auto-switch if system preference
    Theme->>UI: Apply system theme
```

### Configuration Management Flow

```mermaid
graph TB
    subgraph "Configuration Sources"
        UserPrefs[User Preferences<br/>Manual Settings]
        SystemDetect[System Detection<br/>OS Theme, Terminal Colors]
        ProjectConfig[Project Config<br/>Local Settings File]
        DefaultConfig[Default Config<br/>Built-in Defaults]
    end

    subgraph "Configuration Types"
        ThemeConfig[Theme Configuration<br/>Colors, Fonts, Spacing]
        UIConfig[UI Configuration<br/>Layout, Animations, Behavior]
        AgentConfig[Agent Configuration<br/>Default Models, Permissions]
        ToolConfig[Tool Configuration<br/>Command Paths, Options]
    end

    subgraph "Configuration Storage"
        LocalStorage[Local Storage<br/>Browser Persistence]
        SessionStorage[Session Storage<br/>Temporary Settings]
        FileSystem[File System<br/>Config Files]
        CloudSync[Cloud Sync<br/>Cross-device Settings]
    end

    subgraph "Configuration Application"
        CSSVars[CSS Variables<br/>Dynamic Styling]
        ReactContext[React Context<br/>App-wide State]
        ComponentProps[Component Props<br/>Direct Application]
        SystemIntegration[System Integration<br/>OS/Browser APIs]
    end

    %% Configuration flow
    UserPrefs --> ThemeConfig
    SystemDetect --> ThemeConfig
    ProjectConfig --> UIConfig
    DefaultConfig --> AgentConfig
    
    UserPrefs --> UIConfig
    SystemDetect --> ToolConfig
    ProjectConfig --> AgentConfig
    
    %% Storage routing
    ThemeConfig --> LocalStorage
    UIConfig --> SessionStorage
    AgentConfig --> FileSystem
    ToolConfig --> CloudSync
    
    %% Application routing
    ThemeConfig --> CSSVars
    UIConfig --> ReactContext
    AgentConfig --> ComponentProps
    ToolConfig --> SystemIntegration

    classDef source fill:#e3f2fd
    classDef config fill:#e8f5e8
    classDef storage fill:#fff3e0
    classDef application fill:#fce4ec

    class UserPrefs,SystemDetect,ProjectConfig,DefaultConfig source
    class ThemeConfig,UIConfig,AgentConfig,ToolConfig config
    class LocalStorage,SessionStorage,FileSystem,CloudSync storage
    class CSSVars,ReactContext,ComponentProps,SystemIntegration application
```

---

## Performance Optimization Flows

### Caching and Performance Strategy

```mermaid
sequenceDiagram
    participant User as User Request
    participant Comp as UI Component
    participant Cache as Cache Layer
    participant Store as State Store
    participant API as API Service

    Note over User,API: Performance-optimized request flow

    %% Initial request with caching
    User->>Comp: Request data (messages/sessions)
    Comp->>Cache: Check cache first
    
    alt Cache Hit (fresh)
        Cache-->>Comp: Return cached data
        Comp->>User: Display immediately
        
        %% Background refresh
        Comp->>Store: Background refresh check
        Store->>API: GET latest data
        API-->>Store: Fresh data
        
        alt Data Changed
            Store->>Cache: Update cache
            Store->>Comp: Update component
            Comp->>User: Smooth update transition
        else Data Unchanged
            Store->>Cache: Refresh timestamp
        end
        
    else Cache Miss or Stale
        Comp->>Store: Fetch fresh data
        Store->>API: GET request
        API-->>Store: Data response
        Store->>Cache: Cache new data
        Store->>Comp: Return data
        Comp->>User: Display data
    end

    %% Real-time updates
    loop Server Events
        API->>Store: SSE event
        Store->>Store: Process event
        Store->>Cache: Invalidate affected cache
        Store->>Comp: Selective component update
        Comp->>Comp: Virtual scrolling optimization
        Comp->>User: Efficient UI update
    end

    %% Performance monitoring
    Comp->>Comp: Measure render time
    
    alt Performance Threshold Exceeded
        Comp->>Cache: Implement aggressive caching
        Comp->>Comp: Enable virtual scrolling
        Comp->>Comp: Reduce animation complexity
        Comp->>Store: Request fewer concurrent updates
    end

    Note over User,API: Memory and performance cleanup
    
    Cache->>Cache: Periodic cleanup (LRU eviction)
    Comp->>Comp: Component unmount cleanup
    Store->>Store: Remove unused subscriptions
```

### Virtual Scrolling and Large Dataset Handling

```mermaid
graph TB
    subgraph "Large Dataset Challenge"
        LargeConv[Large Conversations<br/>1000+ messages]
        ComplexTools[Complex Tool Outputs<br/>Large files, long outputs]
        RealtimeUpdates[Real-time Updates<br/>High-frequency events]
    end

    subgraph "Virtual Scrolling Solution"
        VirtualList[Virtual List Container<br/>Fixed viewport height]
        ItemRenderer[Item Renderer<br/>Dynamic height calculation]
        ScrollManager[Scroll Manager<br/>Position tracking]
        BufferMgmt[Buffer Management<br/>Render buffer + overscan]
    end

    subgraph "Performance Optimizations"
        Memoization[React.memo<br/>Component memoization]
        LazyLoading[Lazy Loading<br/>Deferred rendering]
        ContentTrunc[Content Truncation<br/>Large output limiting]
        BatchUpdates[Batch Updates<br/>Multiple change batching]
    end

    subgraph "Memory Management"
        CacheEviction[Cache Eviction<br/>LRU strategy]
        ComponentPool[Component Pooling<br/>Reuse instances]
        WeakReferences[Weak References<br/>Garbage collection friendly]
        MemoryMonitor[Memory Monitoring<br/>Usage tracking]
    end

    %% Problem to solution mapping
    LargeConv --> VirtualList
    ComplexTools --> ItemRenderer
    RealtimeUpdates --> ScrollManager
    
    %% Virtual scrolling components
    VirtualList --> BufferMgmt
    ItemRenderer --> Memoization
    ScrollManager --> LazyLoading
    
    %% Performance integration
    Memoization --> CacheEviction
    LazyLoading --> ComponentPool
    ContentTrunc --> WeakReferences
    BatchUpdates --> MemoryMonitor

    classDef challenge fill:#ffebee
    classDef virtual fill:#e3f2fd
    classDef optimization fill:#e8f5e8
    classDef memory fill:#fff3e0

    class LargeConv,ComplexTools,RealtimeUpdates challenge
    class VirtualList,ItemRenderer,ScrollManager,BufferMgmt virtual
    class Memoization,LazyLoading,ContentTrunc,BatchUpdates optimization
    class CacheEviction,ComponentPool,WeakReferences,MemoryMonitor memory
```

---

## Implementation Summary

These detailed interaction diagrams provide comprehensive insight into:

### 🎯 **Core System Flows**
- **Agent/Model Selection**: Dynamic switching with capability validation
- **Session Management**: Complete lifecycle with persistence and caching
- **Permission System**: Security-first approach with user control
- **Error Handling**: Comprehensive recovery and user experience patterns

### 🚀 **Performance Patterns**
- **Virtual Scrolling**: Handle large conversations efficiently  
- **Intelligent Caching**: Multi-layer caching with invalidation
- **Memory Management**: Prevent memory leaks and optimize usage
- **Real-time Optimization**: Efficient event handling and updates

### 🎨 **User Experience**
- **Theme Management**: Dynamic switching with system integration
- **Configuration**: Flexible, multi-source configuration system  
- **Error Recovery**: Graceful degradation and user guidance
- **Performance Monitoring**: Adaptive optimization based on usage

These diagrams serve as a complete blueprint for implementing the OpenCode HTML client with full functional parity, optimal performance, and excellent user experience. Each flow diagram includes specific implementation details, error handling strategies, and performance considerations essential for a production-quality implementation.