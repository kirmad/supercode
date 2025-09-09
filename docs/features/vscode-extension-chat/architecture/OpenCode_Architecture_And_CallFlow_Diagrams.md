# OpenCode Architecture and Call Flow Diagrams

## Executive Summary

This document provides comprehensive architecture and call flow diagrams for the OpenCode system, illustrating the complete journey from user prompt to AI response, including message streaming, tool execution, agent selection, and model interaction patterns. These diagrams serve as a visual guide for understanding system complexity and implementing HTML versions with full functional parity.

## Table of Contents

1. [System Architecture Overview](#system-architecture-overview)
2. [End-to-End Message Flow](#end-to-end-message-flow)
3. [Tool Execution Architecture](#tool-execution-architecture)
4. [Real-time Communication Patterns](#real-time-communication-patterns)
5. [Component Interaction Diagrams](#component-interaction-diagrams)
6. [State Management Flow](#state-management-flow)
7. [HTML Implementation Architecture](#html-implementation-architecture)

---

## System Architecture Overview

### High-Level System Components

```mermaid
graph TB
    subgraph "Client Layer"
        TUI[Terminal UI<br/>Go + Bubble Tea]
        WebUI[Web UI<br/>React + TypeScript]
        VSCode[VS Code Extension<br/>TypeScript]
        Mobile[Mobile App<br/>React Native]
    end

    subgraph "Server Layer"
        API[HTTP API Server<br/>Hono Framework]
        WS[WebSocket/SSE<br/>Real-time Events]
        Auth[Authentication<br/>OpenAuth + GitHub]
    end

    subgraph "Core Services"
        Session[Session Manager<br/>CRUD + State]
        Agent[Agent Controller<br/>Multi-provider]
        Tools[Tool Registry<br/>Execution Engine]
        Project[Project Manager<br/>Context + Files]
    end

    subgraph "AI Providers"
        Anthropic[Anthropic<br/>Claude Models]
        OpenAI[OpenAI<br/>GPT Models]
        Google[Google<br/>Gemini Models]
        Local[Local Models<br/>Ollama/Custom]
    end

    subgraph "Data Layer"
        DB[(Database<br/>SQLite + Drizzle)]
        Files[(File System<br/>Project Files)]
        Cache[(Cache Layer<br/>Redis/Memory)]
    end

    subgraph "Infrastructure"
        CDN[CloudFlare CDN]
        Workers[CloudFlare Workers]
        Monitoring[Observability<br/>Logs + Metrics]
    end

    %% Client connections
    TUI --> API
    WebUI --> API
    VSCode --> API
    Mobile --> API

    %% Real-time connections
    TUI -.-> WS
    WebUI -.-> WS
    VSCode -.-> WS
    Mobile -.-> WS

    %% Core service interactions
    API --> Session
    API --> Agent
    API --> Tools
    API --> Project
    API --> Auth

    %% Agent to AI providers
    Agent --> Anthropic
    Agent --> OpenAI
    Agent --> Google
    Agent --> Local

    %% Data access
    Session --> DB
    Project --> Files
    Tools --> Files
    Session --> Cache

    %% Infrastructure
    API --> Workers
    Workers --> CDN
    API --> Monitoring

    classDef client fill:#e1f5fe
    classDef server fill:#f3e5f5
    classDef core fill:#e8f5e8
    classDef ai fill:#fff3e0
    classDef data fill:#fce4ec
    classDef infra fill:#f1f8e9

    class TUI,WebUI,VSCode,Mobile client
    class API,WS,Auth server
    class Session,Agent,Tools,Project core
    class Anthropic,OpenAI,Google,Local ai
    class DB,Files,Cache data
    class CDN,Workers,Monitoring infra
```

### Core System Layers

**1. Client Layer**
- **Terminal UI**: Go-based TUI using Bubble Tea framework
- **Web UI**: React + TypeScript with real-time capabilities
- **VS Code Extension**: TypeScript integration with IDE
- **Mobile Apps**: React Native for cross-platform support

**2. Server Layer**
- **HTTP API**: Hono-based REST API with OpenAPI specification
- **Real-time Events**: Server-Sent Events for live updates
- **Authentication**: OpenAuth with GitHub Copilot integration

**3. Core Services**
- **Session Manager**: CRUD operations and conversation state
- **Agent Controller**: Multi-provider AI model management
- **Tool Registry**: Tool execution and response handling
- **Project Manager**: File system context and project awareness

**4. AI Provider Layer**
- **Anthropic Claude**: Primary AI provider with tool support
- **OpenAI GPT**: Alternative provider with parameter transformation
- **Google Gemini**: Provider with schema sanitization
- **Local Models**: Ollama and custom model support

**5. Data Layer**
- **Database**: SQLite with Drizzle ORM for structured data
- **File System**: Direct file access for project operations
- **Cache Layer**: Redis/Memory for performance optimization

---

## End-to-End Message Flow

### Complete User Interaction Flow

```mermaid
sequenceDiagram
    participant U as User
    participant TUI as Terminal UI
    participant API as API Server
    participant SSE as Event Stream
    participant SM as Session Manager
    participant AC as Agent Controller
    participant TR as Tool Registry
    participant AI as AI Provider
    participant FS as File System

    Note over U,FS: User sends prompt with potential tool operations

    %% Initial prompt submission
    U->>TUI: Types prompt + attachments
    TUI->>TUI: Validate input & attachments
    TUI->>API: POST /sessions/{id}/messages
    
    Note over API: Message creation and processing begins
    
    API->>SM: Create message record
    SM->>SM: Generate message ID
    SM-->>API: Message created
    
    API->>SSE: Broadcast message.created
    SSE-->>TUI: message.created event
    TUI->>TUI: Add pending message to UI
    
    %% AI Provider interaction
    API->>AC: Send message to AI
    AC->>AC: Select model & prepare context
    AC->>AI: API call with conversation history
    
    Note over AI: AI processes request and may generate tool calls
    
    AI-->>AC: Streaming response begins
    AC->>SM: Create assistant message
    SM-->>API: Message ID returned
    
    %% Text streaming
    loop Streaming Text Response
        AI-->>AC: Text chunk
        AC->>SM: Update message part (text)
        SM->>SSE: Broadcast message.part.updated
        SSE-->>TUI: Live text update
        TUI->>TUI: Append text with animation
    end
    
    %% Tool call generation
    AI-->>AC: Tool call request
    AC->>SM: Create tool part (pending)
    SM->>SSE: Broadcast message.part.updated
    SSE-->>TUI: Tool call appears (pending)
    TUI->>TUI: Show tool with shimmer animation
    
    %% Tool execution
    AC->>TR: Execute tool call
    TR->>TR: Validate parameters & permissions
    
    alt Permission Required
        TR->>SM: Create permission request
        SM->>SSE: Broadcast permission.required
        SSE-->>TUI: Show permission dialog
        TUI->>U: Display permission prompt
        U->>TUI: Accept/Reject permission
        TUI->>API: POST /permissions/{id}/respond
        API->>TR: Permission response
    end
    
    TR->>TR: Update tool status (running)
    TR->>SM: Update tool part metadata
    SM->>SSE: Broadcast message.part.updated
    SSE-->>TUI: Tool shows running state
    
    %% Tool execution with potential file operations
    alt File Operation Tool (read/write/edit)
        TR->>FS: File system operation
        FS-->>TR: File content/result
        TR->>TR: Process file content (syntax highlighting, diffs)
    else Bash Tool
        TR->>TR: Execute shell command
        loop Streaming Output
            TR->>SM: Update metadata with output
            SM->>SSE: Broadcast message.part.updated
            SSE-->>TUI: Streaming terminal output
        end
    else Todo Tool
        TR->>SM: Update session todos
        TR->>TR: Format todo display
    end
    
    TR->>SM: Update tool part (completed/error)
    SM->>SSE: Broadcast message.part.updated
    SSE-->>TUI: Tool shows final state
    TUI->>TUI: Remove shimmer, show results
    
    %% AI continues with tool results
    AC->>AI: Send tool results back to AI
    AI-->>AC: Continued streaming response
    
    loop Final Response Streaming
        AI-->>AC: Text chunk
        AC->>SM: Update message part
        SM->>SSE: Broadcast message.part.updated
        SSE-->>TUI: Continue text streaming
    end
    
    %% Completion
    AI-->>AC: Response complete
    AC->>SM: Mark message as complete
    SM->>SSE: Broadcast message.completed
    SSE-->>TUI: Stop animations, finalize UI
    TUI->>TUI: Update state, enable input

    Note over U,FS: Complete conversation turn finished
```

### Message State Transitions

```mermaid
stateDiagram-v2
    [*] --> Draft: User typing
    Draft --> Sending: User submits
    Sending --> Processing: API receives
    Processing --> Streaming: AI responds
    Streaming --> Tool_Pending: AI requests tool
    Tool_Pending --> Tool_Running: Tool execution starts
    Tool_Running --> Tool_Completed: Tool finishes
    Tool_Running --> Tool_Error: Tool fails
    Tool_Completed --> Streaming: Continue AI response
    Tool_Error --> Streaming: AI handles error
    Streaming --> Complete: AI finishes
    Complete --> [*]
    
    Tool_Pending --> Tool_Permission: Permission required
    Tool_Permission --> Tool_Running: User allows
    Tool_Permission --> Tool_Error: User denies
```

---

## Tool Execution Architecture

### Tool Registry and Execution Engine

```mermaid
graph TB
    subgraph "Tool Execution Pipeline"
        TR[Tool Registry<br/>Central Coordinator]
        TV[Tool Validator<br/>Parameter Check]
        TP[Tool Permissions<br/>Security Gate]
        TE[Tool Executor<br/>Implementation]
        TF[Tool Formatter<br/>Response Processing]
    end

    subgraph "Tool Categories"
        FileTools[File Operations<br/>read, write, edit]
        ShellTools[Shell Commands<br/>bash, exec]
        TaskTools[Task Management<br/>todoread, todowrite]
        WebTools[Web Operations<br/>webfetch, curl]
        AgentTools[Agent Control<br/>task delegation]
    end

    subgraph "Tool Context"
        Session[Session Context<br/>ID, Messages, State]
        Project[Project Context<br/>Files, Git, Config]
        Agent[Agent Context<br/>Permissions, Capabilities]
    end

    subgraph "External Systems"
        FS[File System<br/>Read/Write Operations]
        Shell[Shell Environment<br/>Command Execution]
        LSP[Language Server<br/>Code Analysis]
        Git[Git Repository<br/>Version Control]
        Web[Web Services<br/>HTTP Requests]
    end

    %% Tool execution flow
    TR --> TV
    TV --> TP
    TP --> TE
    TE --> TF
    TF --> TR

    %% Tool category assignment
    TR --> FileTools
    TR --> ShellTools  
    TR --> TaskTools
    TR --> WebTools
    TR --> AgentTools

    %% Context access
    TE --> Session
    TE --> Project
    TE --> Agent

    %% External integrations
    FileTools --> FS
    FileTools --> LSP
    ShellTools --> Shell
    TaskTools --> Session
    WebTools --> Web
    FileTools --> Git

    classDef pipeline fill:#e3f2fd
    classDef tools fill:#f1f8e9
    classDef context fill:#fff3e0
    classDef external fill:#fce4ec

    class TR,TV,TP,TE,TF pipeline
    class FileTools,ShellTools,TaskTools,WebTools,AgentTools tools
    class Session,Project,Agent context
    class FS,Shell,LSP,Git,Web external
```

### Tool Execution Call Flow

```mermaid
sequenceDiagram
    participant AI as AI Provider
    participant AC as Agent Controller
    participant TR as Tool Registry
    participant Tool as Tool Implementation
    participant Ctx as Tool Context
    participant Ext as External System
    participant SSE as Event Stream
    participant UI as User Interface

    Note over AI,UI: AI requests tool execution

    AI->>AC: Tool call request
    AC->>TR: Execute tool (type, params)
    
    %% Tool validation and preparation
    TR->>TR: Validate tool type exists
    TR->>TR: Sanitize parameters by provider
    TR->>Ctx: Prepare execution context
    Ctx-->>TR: Context ready
    
    %% Permission check
    TR->>TR: Check agent permissions
    alt Permission Denied
        TR-->>AC: Permission error
        AC->>SSE: Broadcast tool error
        SSE->>UI: Show error state
    else Permission Required
        TR->>SSE: Broadcast permission request
        SSE->>UI: Show permission dialog
        UI->>UI: Wait for user response
        UI->>TR: Permission response
    end
    
    %% Tool execution begins
    TR->>Tool: Execute with context
    Tool->>SSE: Update status (running)
    SSE->>UI: Show running animation
    
    %% Tool-specific execution patterns
    alt File Operation Tool
        Tool->>Ext: File system operation
        Ext-->>Tool: File content/result
        Tool->>Tool: Process content (syntax highlight)
        Tool->>SSE: Update with file preview
        SSE->>UI: Show file content
        
    else Bash Tool  
        Tool->>Ext: Execute shell command
        loop Streaming Output
            Ext-->>Tool: Output chunk
            Tool->>SSE: Stream output update
            SSE->>UI: Update terminal display
        end
        
    else Todo Tool
        Tool->>Ctx: Update session state
        Tool->>Tool: Format todo list
        Tool->>SSE: Update with todo data
        SSE->>UI: Render todo checkboxes
        
    else Web Tool
        Tool->>Ext: HTTP request
        Ext-->>Tool: Response data
        Tool->>Tool: Format response
    end
    
    %% Completion and result formatting
    Tool->>Tool: Format final result
    Tool-->>TR: Execution result
    TR->>TR: Validate result format
    TR->>SSE: Update status (completed)
    SSE->>UI: Remove animation, show results
    TR-->>AC: Tool result for AI
    AC->>AI: Return tool output

    Note over AI,UI: Tool execution complete, AI continues
```

---

## Real-time Communication Patterns

### Server-Sent Events Architecture

```mermaid
graph TB
    subgraph "Event Sources"
        SM[Session Manager<br/>Message Events]
        TR[Tool Registry<br/>Tool Events] 
        AC[Agent Controller<br/>Model Events]
        Auth[Auth Service<br/>Permission Events]
    end

    subgraph "Event Bus"
        Bus[Central Event Bus<br/>Pub/Sub Pattern]
        Filter[Event Filtering<br/>Session Scoped]
        Queue[Event Queue<br/>Ordering & Buffering]
    end

    subgraph "Event Stream"
        SSE[Server-Sent Events<br/>HTTP Streaming]
        Conn[Connection Manager<br/>Client Tracking]
        Retry[Reconnection Logic<br/>Error Recovery]
    end

    subgraph "Event Types"
        MsgEvents[Message Events<br/>created, updated, removed]
        PartEvents[Part Events<br/>text/tool updates]
        ToolEvents[Tool Events<br/>status, metadata, errors]
        SessionEvents[Session Events<br/>state changes]
        PermEvents[Permission Events<br/>requests, responses]
    end

    subgraph "Client Handlers"
        TUI[TUI Event Handler<br/>Go Channels]
        Web[Web Event Handler<br/>EventSource API]
        VSCode[VSCode Handler<br/>WebSocket Wrapper]
    end

    %% Event flow
    SM --> Bus
    TR --> Bus
    AC --> Bus
    Auth --> Bus

    Bus --> Filter
    Filter --> Queue
    Queue --> SSE

    SSE --> Conn
    Conn --> Retry

    %% Event type routing
    Bus --> MsgEvents
    Bus --> PartEvents
    Bus --> ToolEvents
    Bus --> SessionEvents
    Bus --> PermEvents

    %% Client consumption
    SSE --> TUI
    SSE --> Web
    SSE --> VSCode

    classDef sources fill:#e8f5e8
    classDef bus fill:#e3f2fd
    classDef stream fill:#fff3e0
    classDef events fill:#f1f8e9
    classDef clients fill:#fce4ec

    class SM,TR,AC,Auth sources
    class Bus,Filter,Queue bus
    class SSE,Conn,Retry stream
    class MsgEvents,PartEvents,ToolEvents,SessionEvents,PermEvents events
    class TUI,Web,VSCode clients
```

### Event Flow Patterns

```mermaid
sequenceDiagram
    participant SM as Session Manager
    participant Bus as Event Bus
    participant SSE as SSE Stream
    participant TUI as TUI Client
    participant Web as Web Client

    Note over SM,Web: Multiple event types flowing simultaneously

    %% Message events
    SM->>Bus: message.created
    Bus->>SSE: Filtered event
    par Parallel delivery
        SSE->>TUI: Event via Go channels
        SSE->>Web: Event via EventSource
    end

    %% Tool events with streaming
    SM->>Bus: message.part.updated (tool)
    Bus->>SSE: Tool status change
    par
        SSE->>TUI: Update tool animation
        SSE->>Web: Update React component
    end

    %% High-frequency streaming (bash output)
    loop Streaming Output
        SM->>Bus: tool.metadata.updated
        Bus->>Bus: Debounce rapid events
        Bus->>SSE: Batched update
        par
            SSE->>TUI: Terminal output
            SSE->>Web: Console display
        end
    end

    %% Permission events
    SM->>Bus: permission.required
    Bus->>SSE: Permission request
    par
        SSE->>TUI: Modal dialog
        SSE->>Web: Permission component
    end

    TUI->>SSE: Permission response
    SSE->>Bus: User decision
    Bus->>SM: Process response

    Note over SM,Web: Event ordering and delivery guaranteed
```

---

## Component Interaction Diagrams

### TUI Component Architecture

```mermaid
graph TB
    subgraph "TUI Application"
        Model[TUI Model<br/>Bubble Tea Root]
        App[App State<br/>Session & Config]
        EventLoop[Event Loop<br/>Input & Updates]
    end

    subgraph "UI Components"
        Messages[Messages Component<br/>Chat Display]
        Editor[Editor Component<br/>Input Field]
        Status[Status Component<br/>Bottom Bar]
        Modal[Modal Component<br/>Dialogs]
        Toast[Toast Component<br/>Notifications]
    end

    subgraph "Component State"
        MessageState[Message State<br/>Content & Animation]
        EditorState[Editor State<br/>Input & History]
        ModalState[Modal State<br/>Active Dialog]
        ThemeState[Theme State<br/>Colors & Styles]
    end

    subgraph "External Events"
        SSE[Server Events<br/>Real-time Updates]
        Input[User Input<br/>Keyboard & Mouse]
        Timer[Timer Events<br/>Animation Ticks]
    end

    %% Component hierarchy
    Model --> App
    Model --> EventLoop
    
    App --> Messages
    App --> Editor
    App --> Status
    App --> Modal
    App --> Toast

    %% State management
    Messages --> MessageState
    Editor --> EditorState
    Modal --> ModalState
    App --> ThemeState

    %% Event handling
    SSE --> EventLoop
    Input --> EventLoop
    Timer --> EventLoop
    
    EventLoop --> Model
    Model --> App
    
    %% Update flow
    App --> Messages
    App --> Editor
    App --> Status

    classDef app fill:#e3f2fd
    classDef components fill:#e8f5e8
    classDef state fill:#fff3e0
    classDef events fill:#fce4ec

    class Model,App,EventLoop app
    class Messages,Editor,Status,Modal,Toast components
    class MessageState,EditorState,ModalState,ThemeState state
    class SSE,Input,Timer events
```

### Message Rendering Pipeline

```mermaid
flowchart TD
    Start([Message Update Event]) --> Check{Message Type}
    
    Check -->|User Message| UserRender[Render User Message<br/>- Format content<br/>- Apply user styling<br/>- Handle attachments]
    
    Check -->|Assistant Message| AssistRender[Render Assistant Message<br/>- Process parts array<br/>- Handle streaming state]
    
    AssistRender --> PartLoop{For Each Part}
    
    PartLoop -->|Text Part| TextRender[Render Text<br/>- Markdown processing<br/>- Syntax highlighting<br/>- Apply shimmer if streaming]
    
    PartLoop -->|Tool Part| ToolRender[Render Tool Call<br/>- Check tool type<br/>- Apply appropriate renderer<br/>- Handle tool state]
    
    ToolRender --> ToolType{Tool Type}
    
    ToolType -->|File Tool| FileRender[File Tool Renderer<br/>- Syntax highlighting<br/>- Diff visualization<br/>- Diagnostics display]
    
    ToolType -->|Bash Tool| BashRender[Bash Tool Renderer<br/>- Terminal formatting<br/>- Streaming output<br/>- Command styling]
    
    ToolType -->|Todo Tool| TodoRender[Todo Tool Renderer<br/>- Checkbox formatting<br/>- Status styling<br/>- Interactive display]
    
    ToolType -->|Other Tool| GenericRender[Generic Tool Renderer<br/>- Basic formatting<br/>- Error handling]
    
    FileRender --> Cache{Check Cache}
    BashRender --> Cache
    TodoRender --> Cache
    GenericRender --> Cache
    TextRender --> Cache
    
    Cache -->|Hit| UseCached[Use Cached Render<br/>- Return cached content<br/>- Apply animations if needed]
    
    Cache -->|Miss| GenerateRender[Generate New Render<br/>- Process content<br/>- Apply formatting<br/>- Cache result]
    
    UseCached --> Display[Display Content<br/>- Update UI component<br/>- Trigger animations<br/>- Scroll if needed]
    
    GenerateRender --> Display
    
    Display --> Animation{Animation Needed?}
    
    Animation -->|Yes| StartAnim[Start Animation<br/>- Shimmer for streaming<br/>- Typewriter for output<br/>- State transitions]
    
    Animation -->|No| Complete([Rendering Complete])
    
    StartAnim --> AnimLoop{Animation Active?}
    
    AnimLoop -->|Yes| UpdateAnim[Update Animation<br/>- Progress animation<br/>- Check completion]
    
    UpdateAnim --> AnimLoop
    
    AnimLoop -->|No| Complete
    
    UserRender --> Display

    classDef process fill:#e3f2fd
    classDef decision fill:#fff3e0
    classDef tool fill:#e8f5e8
    classDef terminal fill:#fce4ec

    class Check,PartLoop,ToolType,Cache,Animation,AnimLoop decision
    class UserRender,AssistRender,TextRender,Display,StartAnim,UpdateAnim process
    class FileRender,BashRender,TodoRender,GenericRender tool
    class Start,Complete terminal
```

---

## State Management Flow

### Application State Architecture

```mermaid
graph TB
    subgraph "Global State"
        AppState[App State<br/>Current Session, Agent, Model]
        ConfigState[Config State<br/>Settings, Preferences]
        AuthState[Auth State<br/>User, Tokens, Permissions]
    end

    subgraph "Session State"
        SessionData[Session Data<br/>Messages, Metadata]
        MessageState[Message State<br/>Content, Parts, Status]
        ToolState[Tool State<br/>Executions, Results]
    end

    subgraph "UI State"
        ViewState[View State<br/>Current Page, Modals]
        InputState[Input State<br/>Editor Content, History]
        AnimState[Animation State<br/>Active Animations]
    end

    subgraph "Persistent State"
        LocalStorage[Local Storage<br/>Theme, Preferences]
        SessionStorage[Session Storage<br/>Temp Data]
        FileSystem[File System<br/>Project Context]
    end

    subgraph "State Operations"
        Actions[State Actions<br/>Mutations, Updates]
        Reducers[State Reducers<br/>State Transformation]
        Effects[Side Effects<br/>API Calls, Persistence]
    end

    %% State relationships
    AppState --> SessionData
    SessionData --> MessageState
    MessageState --> ToolState
    
    AppState --> ViewState
    ViewState --> InputState
    ViewState --> AnimState

    %% Persistence
    ConfigState --> LocalStorage
    AuthState --> SessionStorage
    AppState --> FileSystem

    %% State management
    Actions --> Reducers
    Reducers --> AppState
    Reducers --> SessionData
    Reducers --> ViewState
    
    Effects --> Actions
    AppState --> Effects
    SessionData --> Effects

    classDef global fill:#e3f2fd
    classDef session fill:#e8f5e8  
    classDef ui fill:#fff3e0
    classDef persist fill:#fce4ec
    classDef ops fill:#f1f8e9

    class AppState,ConfigState,AuthState global
    class SessionData,MessageState,ToolState session
    class ViewState,InputState,AnimState ui
    class LocalStorage,SessionStorage,FileSystem persist
    class Actions,Reducers,Effects ops
```

### State Update Flow

```mermaid
sequenceDiagram
    participant UI as UI Component
    participant Store as State Store
    participant API as API Service
    participant SSE as Event Stream
    participant Cache as Cache Layer

    Note over UI,Cache: User initiates action

    UI->>Store: Dispatch action
    Store->>Store: Update state optimistically
    Store->>UI: Re-render with new state
    
    Store->>API: Make API request
    
    alt Success
        API-->>Store: Success response
        Store->>Cache: Update cache
        Store->>Store: Confirm optimistic update
        Store->>UI: Final state update
        
    else Error
        API-->>Store: Error response
        Store->>Store: Revert optimistic update
        Store->>UI: Show error state
        Store->>UI: Restore previous state
    end

    Note over UI,Cache: Real-time updates from server

    SSE-->>Store: Server event
    Store->>Store: Apply server update
    Store->>Cache: Invalidate affected cache
    Store->>UI: Re-render components
    
    UI->>UI: Update animations
    UI->>UI: Scroll if needed

    Note over UI,Cache: State persistence

    Store->>Cache: Persist critical state
    Cache->>Cache: Write to storage
```

---

## HTML Implementation Architecture

### Web Application Architecture

```mermaid
graph TB
    subgraph "Frontend Framework"
        React[React 18<br/>Component Framework]
        TS[TypeScript<br/>Type Safety]
        Vite[Vite<br/>Build Tool]
    end

    subgraph "State Management"
        Zustand[Zustand Store<br/>Global State]
        ReactQuery[React Query<br/>Server State]
        LocalState[React State<br/>Component State]
    end

    subgraph "Communication Layer"
        EventSource[EventSource API<br/>Server-Sent Events]
        FetchAPI[Fetch API<br/>HTTP Requests]
        WebSocket[WebSocket<br/>Bi-directional Comms]
    end

    subgraph "UI Components"
        ChatComponents[Chat Components<br/>Messages, Editor, Tools]
        ModalComponents[Modal Components<br/>Dialogs, Settings]
        CommonComponents[Common Components<br/>Layout, Theme, Utils]
    end

    subgraph "Tool System"
        ToolRenderers[Tool Renderers<br/>File, Bash, Todo]
        ToolStore[Tool Store<br/>State Management]
        ToolEvents[Tool Events<br/>Real-time Updates]
    end

    subgraph "Performance Layer"
        VirtualScroll[Virtual Scrolling<br/>Large Lists]
        Memoization[React.memo<br/>Component Caching]
        CodeSplitting[Code Splitting<br/>Lazy Loading]
    end

    subgraph "Styling System"
        TailwindCSS[Tailwind CSS<br/>Utility Framework]
        ThemeProvider[Theme Provider<br/>Dynamic Theming]
        Animations[Framer Motion<br/>Animations]
    end

    %% Framework connections
    React --> TS
    React --> Vite
    
    %% State management
    React --> Zustand
    React --> ReactQuery
    React --> LocalState
    
    %% Communication
    ReactQuery --> FetchAPI
    Zustand --> EventSource
    EventSource --> WebSocket
    
    %% UI system
    React --> ChatComponents
    React --> ModalComponents
    React --> CommonComponents
    
    %% Tool integration
    ChatComponents --> ToolRenderers
    ToolRenderers --> ToolStore
    ToolStore --> ToolEvents
    ToolEvents --> EventSource
    
    %% Performance
    ChatComponents --> VirtualScroll
    React --> Memoization
    Vite --> CodeSplitting
    
    %% Styling
    React --> TailwindCSS
    TailwindCSS --> ThemeProvider
    React --> Animations

    classDef framework fill:#e3f2fd
    classDef state fill:#e8f5e8
    classDef comm fill:#fff3e0
    classDef ui fill:#f1f8e9
    classDef tools fill:#fce4ec
    classDef perf fill:#f3e5f5
    classDef style fill:#e0f2f1

    class React,TS,Vite framework
    class Zustand,ReactQuery,LocalState state
    class EventSource,FetchAPI,WebSocket comm
    class ChatComponents,ModalComponents,CommonComponents ui
    class ToolRenderers,ToolStore,ToolEvents tools
    class VirtualScroll,Memoization,CodeSplitting perf
    class TailwindCSS,ThemeProvider,Animations style
```

### React Component Hierarchy

```mermaid
graph TB
    App[App Component<br/>Root Provider Setup]
    
    subgraph "Layout Components"
        MainLayout[Main Layout<br/>Header, Main, Footer]
        ChatLayout[Chat Layout<br/>Messages + Editor]
        HomeLayout[Home Layout<br/>Session Selection]
    end
    
    subgraph "Chat Components"
        MessageList[Message List<br/>Virtual Scrolling]
        MessageItem[Message Item<br/>User/Assistant]
        MessageParts[Message Parts<br/>Text/Tool Rendering]
        ToolDisplay[Tool Display<br/>Dynamic Tool Renderers]
        Editor[Editor<br/>Input with Attachments]
        StatusBar[Status Bar<br/>Git, CWD, Agent Info]
    end
    
    subgraph "Tool Components"
        FileReadTool[File Read Tool<br/>Syntax Highlighting]
        FileWriteTool[File Write Tool<br/>Code + Diagnostics]
        FileEditTool[File Edit Tool<br/>Diff Viewer]
        BashTool[Bash Tool<br/>Terminal Output]
        TodoTool[Todo Tool<br/>Task List]
        GenericTool[Generic Tool<br/>Fallback Renderer]
    end
    
    subgraph "Modal Components"
        HelpModal[Help Modal<br/>Keyboard Shortcuts]
        SessionModal[Session Modal<br/>Session Management]
        ThemeModal[Theme Modal<br/>Theme Selection]
        ModelModal[Model Modal<br/>AI Provider Selection]
    end
    
    subgraph "Common Components"
        CodeBlock[Code Block<br/>Syntax Highlighted]
        DiffViewer[Diff Viewer<br/>Unified/Side-by-side]
        Terminal[Terminal<br/>Console Display]
        VirtualList[Virtual List<br/>Performance Optimization]
        ThemeProvider[Theme Provider<br/>CSS Variables]
        ErrorBoundary[Error Boundary<br/>Error Handling]
    end

    %% Component relationships
    App --> MainLayout
    App --> HomeLayout
    
    MainLayout --> ChatLayout
    ChatLayout --> MessageList
    ChatLayout --> Editor
    ChatLayout --> StatusBar
    
    MessageList --> MessageItem
    MessageItem --> MessageParts
    MessageParts --> ToolDisplay
    
    ToolDisplay --> FileReadTool
    ToolDisplay --> FileWriteTool
    ToolDisplay --> FileEditTool
    ToolDisplay --> BashTool
    ToolDisplay --> TodoTool
    ToolDisplay --> GenericTool
    
    MainLayout --> HelpModal
    MainLayout --> SessionModal
    MainLayout --> ThemeModal
    MainLayout --> ModelModal
    
    FileReadTool --> CodeBlock
    FileEditTool --> DiffViewer
    BashTool --> Terminal
    MessageList --> VirtualList
    
    App --> ThemeProvider
    App --> ErrorBoundary

    classDef app fill:#e3f2fd
    classDef layout fill:#e8f5e8
    classDef chat fill:#fff3e0
    classDef tools fill:#f1f8e9
    classDef modals fill:#fce4ec
    classDef common fill:#e0f2f1

    class App app
    class MainLayout,ChatLayout,HomeLayout layout
    class MessageList,MessageItem,MessageParts,ToolDisplay,Editor,StatusBar chat
    class FileReadTool,FileWriteTool,FileEditTool,BashTool,TodoTool,GenericTool tools
    class HelpModal,SessionModal,ThemeModal,ModelModal modals
    class CodeBlock,DiffViewer,Terminal,VirtualList,ThemeProvider,ErrorBoundary common
```

---

## Implementation Considerations

### Performance Optimization Strategies

1. **Virtual Scrolling**
   - Handle large message lists efficiently
   - Render only visible items + buffer
   - Smooth scrolling with position caching

2. **Intelligent Caching**
   - Component-level memoization with React.memo
   - Tool result caching with cache invalidation
   - Theme-aware caching strategies

3. **Code Splitting**
   - Lazy load modal components
   - Dynamic import of tool renderers
   - Route-based splitting for different views

4. **Animation Performance**
   - CSS animations over JavaScript
   - GPU acceleration for shimmer effects
   - Efficient animation lifecycle management

### Real-time Communication

1. **EventSource Integration**
   - Automatic reconnection on connection loss
   - Event queuing during disconnection
   - Exponential backoff retry strategy

2. **State Synchronization**
   - Optimistic updates for better UX
   - Server reconciliation for consistency
   - Conflict resolution strategies

3. **Error Handling**
   - Graceful degradation on network issues
   - User feedback for connection problems
   - Fallback to polling if EventSource fails

### Accessibility and UX

1. **Keyboard Navigation**
   - Full keyboard accessibility
   - Focus management for modals
   - Keyboard shortcuts matching TUI

2. **Screen Reader Support**
   - ARIA labels for tool states
   - Semantic HTML structure
   - Live regions for dynamic content

3. **Responsive Design**
   - Mobile-first approach
   - Adaptive layouts for different screen sizes
   - Touch-friendly interactions

This architecture provides a comprehensive blueprint for implementing the OpenCode HTML client while maintaining functional parity with the TUI and ensuring optimal performance, accessibility, and user experience.