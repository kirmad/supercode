# OpenCode Tool Execution Flow Diagrams

## Table of Contents

1. [Tool Execution Pipeline Overview](#tool-execution-pipeline-overview)
2. [File Operation Tools Flow](#file-operation-tools-flow)
3. [Shell Command Execution Flow](#shell-command-execution-flow)
4. [Todo Management Tools Flow](#todo-management-tools-flow)
5. [Web Fetch Tools Flow](#web-fetch-tools-flow)
6. [Task Delegation Tools Flow](#task-delegation-tools-flow)
7. [Permission Integration Flow](#permission-integration-flow)
8. [Error Handling and Recovery](#error-handling-and-recovery)

---

## Tool Execution Pipeline Overview

### Master Tool Execution Flow

```mermaid
flowchart TD
    Start([AI Requests Tool]) --> Validate{Validate Tool Type}
    
    Validate -->|Invalid| Error[Return Tool Error]
    Validate -->|Valid| GetTool[Get Tool Implementation]
    
    GetTool --> SanitizeParams[Sanitize Parameters<br/>Provider-specific]
    SanitizeParams --> CheckPerms[Check Agent Permissions]
    
    CheckPerms -->|Denied| PermError[Permission Denied Error]
    CheckPerms -->|Requires Permission| PermRequest[Request User Permission]
    CheckPerms -->|Allowed| PrepareCtx[Prepare Execution Context]
    
    PermRequest --> PermDialog{User Decision}
    PermDialog -->|Allow| UpdatePerms[Update Permissions]
    PermDialog -->|Deny| PermError
    
    UpdatePerms --> PrepareCtx
    
    PrepareCtx --> SetStatus[Set Tool Status: Running]
    SetStatus --> StreamUpdate[Stream Status Update to UI]
    
    StreamUpdate --> ToolType{Tool Type Router}
    
    ToolType -->|read/write/edit| FileTools[File Operation Tools]
    ToolType -->|bash| ShellTools[Shell Command Tools]  
    ToolType -->|todoread/todowrite| TodoTools[Todo Management Tools]
    ToolType -->|webfetch| WebTools[Web Fetch Tools]
    ToolType -->|task| TaskTools[Task Delegation Tools]
    ToolType -->|Other| GenericTools[Generic Tool Handler]
    
    FileTools --> ProcessResult[Process Tool Result]
    ShellTools --> ProcessResult
    TodoTools --> ProcessResult
    WebTools --> ProcessResult
    TaskTools --> ProcessResult
    GenericTools --> ProcessResult
    
    ProcessResult --> FormatOutput[Format Output for AI]
    FormatOutput --> FormatMetadata[Format Metadata for UI]
    
    FormatMetadata --> StatusComplete{Execution Status}
    
    StatusComplete -->|Success| SuccessUpdate[Stream Success Update]
    StatusComplete -->|Error| ErrorUpdate[Stream Error Update]
    
    SuccessUpdate --> ReturnResult[Return Tool Result to AI]
    ErrorUpdate --> ReturnError[Return Error to AI]
    
    ReturnResult --> End([Tool Execution Complete])
    ReturnError --> End
    Error --> End
    PermError --> End

    classDef start fill:#e8f5e8
    classDef process fill:#e3f2fd
    classDef decision fill:#fff3e0
    classDef tooltype fill:#f1f8e9
    classDef terminal fill:#fce4ec

    class Start,End start
    class GetTool,SanitizeParams,PrepareCtx,SetStatus,StreamUpdate,ProcessResult,FormatOutput,FormatMetadata process
    class Validate,CheckPerms,PermDialog,StatusComplete decision
    class FileTools,ShellTools,TodoTools,WebTools,TaskTools,GenericTools tooltype
    class Error,PermError,SuccessUpdate,ErrorUpdate,ReturnResult,ReturnError terminal
```

### Tool State Management Lifecycle

```mermaid
stateDiagram-v2
    [*] --> pending: AI generates tool call
    
    pending --> validating: Parameter validation
    validating --> permission_check: Validation passed
    validating --> error: Validation failed
    
    permission_check --> permission_required: Permission needed
    permission_check --> running: Permission granted
    permission_check --> error: Permission denied
    
    permission_required --> permission_dialog: Show user dialog
    permission_dialog --> running: User allows
    permission_dialog --> error: User denies
    
    running --> streaming: Tool executing
    streaming --> streaming: Metadata updates
    streaming --> completed: Execution successful
    streaming --> error: Execution failed
    
    completed --> [*]
    error --> [*]
    
    note right of streaming
        Tools can stream metadata
        updates during execution
        (especially bash tools)
    end note
    
    note right of permission_required
        Permission requests can
        interrupt tool flow and
        require user interaction
    end note
```

---

## File Operation Tools Flow

### File Read Tool Execution

```mermaid
sequenceDiagram
    participant AI as AI Provider
    participant TR as Tool Registry
    participant ReadTool as Read Tool
    participant FS as File System
    participant LSP as Language Server
    participant UI as User Interface

    Note over AI,UI: AI requests file read operation

    AI->>TR: Tool call: read(filePath)
    TR->>ReadTool: Execute read tool
    ReadTool->>ReadTool: Validate file path (absolute)
    ReadTool->>FS: Check file exists & permissions
    
    alt File Accessible
        FS-->>ReadTool: File metadata
        ReadTool->>UI: Update status: Reading file...
        ReadTool->>FS: Read file content
        FS-->>ReadTool: Raw file content
        
        ReadTool->>ReadTool: Detect file type/language
        ReadTool->>ReadTool: Process content for preview
        ReadTool->>ReadTool: Truncate if too large (>1000 lines)
        
        %% Optional LSP integration
        alt Code File
            ReadTool->>LSP: Get syntax info (optional)
            LSP-->>ReadTool: Language metadata
        end
        
        ReadTool->>UI: Stream metadata update:
        Note over UI: - File path<br/>- Preview content<br/>- File stats (size, mtime)
        
        ReadTool-->>TR: Success result
        TR-->>AI: File content + metadata
        
    else File Not Accessible
        FS-->>ReadTool: Access error
        ReadTool->>UI: Error status: File not found/accessible
        ReadTool-->>TR: Error result
        TR-->>AI: Error message
    end

    Note over AI,UI: File read complete with syntax highlighting ready
```

### File Write Tool Execution with LSP Integration

```mermaid
sequenceDiagram
    participant AI as AI Provider
    participant TR as Tool Registry
    participant WriteTool as Write Tool
    participant FS as File System
    participant LSP as Language Server
    participant UI as User Interface

    Note over AI,UI: AI requests file write operation

    AI->>TR: Tool call: write(filePath, content)
    TR->>WriteTool: Execute write tool
    WriteTool->>WriteTool: Validate parameters
    WriteTool->>WriteTool: Resolve absolute path
    
    WriteTool->>FS: Check file/directory permissions
    
    alt Permission Check Required
        WriteTool->>TR: Request file write permission
        TR->>UI: Show permission dialog
        UI->>UI: User grants/denies permission
        UI-->>TR: Permission response
        alt Permission Denied
            TR-->>WriteTool: Permission denied
            WriteTool-->>AI: Permission error
        end
    end
    
    WriteTool->>UI: Update status: Writing file...
    WriteTool->>FS: Write content to file
    FS-->>WriteTool: Write result
    
    alt Write Successful
        WriteTool->>WriteTool: Generate preview (first 1000 chars)
        WriteTool->>LSP: Request diagnostics check
        
        par Parallel LSP Operations
            LSP->>FS: Analyze written file
            LSP-->>WriteTool: Syntax diagnostics
        and UI Metadata Update
            WriteTool->>UI: Stream metadata:
            Note over UI: - File path<br/>- Content preview<br/>- Write timestamp
        end
        
        alt Has Diagnostics
            WriteTool->>WriteTool: Format diagnostic messages
            WriteTool->>UI: Stream diagnostic update:
            Note over UI: - Error locations<br/>- Warning messages<br/>- Severity levels
        end
        
        WriteTool-->>TR: Success with diagnostics
        TR-->>AI: File written + diagnostic info
        
    else Write Failed
        FS-->>WriteTool: Write error (permissions/disk space/etc)
        WriteTool->>UI: Error status with details
        WriteTool-->>TR: Write error
        TR-->>AI: Error message with context
    end

    Note over AI,UI: File write complete with immediate feedback
```

### File Edit Tool with Advanced Replacement

```mermaid
flowchart TD
    Start([Edit Tool Request]) --> ValidateParams[Validate Parameters<br/>filePath, oldString, newString]
    
    ValidateParams --> ReadFile[Read Target File Content]
    ReadFile --> TryReplace{Replacement Strategy}
    
    TryReplace -->|Strategy 1| SimpleReplace[Simple String Replacement<br/>Direct match]
    TryReplace -->|Strategy 2| TrimmedReplace[Line-Trimmed Replacement<br/>Ignore whitespace differences]
    TryReplace -->|Strategy 3| BlockAnchor[Block Anchor Replacement<br/>Context-aware matching]
    TryReplace -->|Strategy 4| WhitespaceNorm[Whitespace Normalized<br/>Flexible whitespace handling]
    TryReplace -->|Strategy 5| IndentFlex[Indentation Flexible<br/>Ignore indentation differences]
    
    SimpleReplace --> CheckMatch{Match Found?}
    TrimmedReplace --> CheckMatch
    BlockAnchor --> CheckMatch
    WhitespaceNorm --> CheckMatch
    IndentFlex --> CheckMatch
    
    CheckMatch -->|Yes| ApplyReplace[Apply Replacement<br/>Generate new content]
    CheckMatch -->|No| NextStrategy{More Strategies?}
    
    NextStrategy -->|Yes| TryReplace
    NextStrategy -->|No| ReplaceFailed[Replacement Failed<br/>No match found]
    
    ApplyReplace --> WriteFile[Write Modified Content]
    WriteFile --> GenerateDiff[Generate Unified Diff]
    
    GenerateDiff --> FormatMetadata[Format Metadata:<br/>• diff output<br/>• replacement count<br/>• old/new content]
    
    FormatMetadata --> LSPCheck[Request LSP Diagnostics]
    LSPCheck --> StreamUpdate[Stream UI Update:<br/>• File path<br/>• Diff visualization<br/>• Diagnostics]
    
    StreamUpdate --> Success[Return Success Result]
    ReplaceFailed --> Error[Return Replacement Error]
    
    Success --> End([Edit Complete])
    Error --> End

    classDef start fill:#e8f5e8
    classDef process fill:#e3f2fd
    classDef strategy fill:#fff3e0
    classDef decision fill:#f1f8e9
    classDef terminal fill:#fce4ec

    class Start,End start
    class ValidateParams,ReadFile,ApplyReplace,WriteFile,GenerateDiff,FormatMetadata,LSPCheck,StreamUpdate process
    class SimpleReplace,TrimmedReplace,BlockAnchor,WhitespaceNorm,IndentFlex strategy
    class CheckMatch,NextStrategy decision
    class Success,Error,ReplaceFailed terminal
```

---

## Shell Command Execution Flow

### Bash Tool with Real-time Streaming

```mermaid
sequenceDiagram
    participant AI as AI Provider
    participant TR as Tool Registry
    participant BashTool as Bash Tool
    participant Shell as Shell Process
    participant UI as User Interface

    Note over AI,UI: AI requests shell command execution

    AI->>TR: Tool call: bash(command, description)
    TR->>BashTool: Execute bash tool
    BashTool->>BashTool: Validate command safety
    BashTool->>BashTool: Check execution permissions
    
    alt Dangerous Command
        BashTool->>TR: Request shell execution permission
        TR->>UI: Show permission dialog with command details
        UI->>UI: User reviews command + allows/denies
        UI-->>TR: Permission decision
        
        alt Permission Denied
            TR-->>BashTool: Permission denied
            BashTool-->>AI: Permission error
        end
    end
    
    BashTool->>UI: Update status: Executing command...
    BashTool->>Shell: Start shell process with command
    Shell->>Shell: Begin command execution
    
    %% Real-time output streaming
    loop Command Output Streaming
        Shell-->>BashTool: stdout/stderr chunk
        BashTool->>BashTool: Accumulate output
        BashTool->>UI: Stream metadata update:
        Note over UI: - Current output<br/>- Command description<br/>- Execution progress
        
        UI->>UI: Update terminal display
        UI->>UI: Auto-scroll to latest output
        UI->>UI: Apply terminal formatting
    end
    
    %% Command completion
    alt Command Success
        Shell-->>BashTool: Exit code 0 + final output
        BashTool->>BashTool: Format final output
        BashTool->>UI: Final status: Command completed
        BashTool-->>TR: Success with full output
        TR-->>AI: Command result + output
        
    else Command Failure
        Shell-->>BashTool: Non-zero exit code + error output
        BashTool->>BashTool: Capture error details
        BashTool->>UI: Error status: Command failed (exit code)
        BashTool-->>TR: Error with output + exit code
        TR-->>AI: Command failed with details
        
    else Command Timeout
        BashTool->>Shell: Kill process (timeout)
        Shell-->>BashTool: Process terminated
        BashTool->>UI: Error status: Command timed out
        BashTool-->>TR: Timeout error
        TR-->>AI: Timeout with partial output
    end

    Note over AI,UI: Command execution complete with full output history
```

### Shell Command Security and Validation

```mermaid
graph TB
    subgraph "Command Input"
        UserCmd[User Command<br/>AI Generated]
        CmdParsing[Command Parsing<br/>Extract components]
        SafetyCheck[Safety Validation<br/>Risk assessment]
    end

    subgraph "Security Categories"
        SafeCmd[Safe Commands<br/>ls, cat, echo, grep]
        ModerateCmd[Moderate Risk<br/>mkdir, touch, cp, mv]
        DangerousCmd[Dangerous Commands<br/>rm, sudo, chmod, systemctl]
        BlockedCmd[Blocked Commands<br/>format, dd, shutdown]
    end

    subgraph "Permission Levels"
        AutoAllow[Auto Allow<br/>No user prompt]
        PromptUser[Prompt User<br/>Show command details]
        AlwaysDeny[Always Deny<br/>Block execution]
        EscalatePriv[Escalate Privileges<br/>Admin required]
    end

    subgraph "Execution Context"
        SandboxEnv[Sandbox Environment<br/>Limited file access]
        TimeoutLimit[Timeout Limits<br/>30s default, 5min max]
        OutputLimit[Output Limits<br/>10MB max capture]
        ResourceLimit[Resource Limits<br/>CPU/Memory constraints]
    end

    %% Command flow
    UserCmd --> CmdParsing
    CmdParsing --> SafetyCheck
    
    %% Safety categorization
    SafetyCheck --> SafeCmd
    SafetyCheck --> ModerateCmd
    SafetyCheck --> DangerousCmd
    SafetyCheck --> BlockedCmd
    
    %% Permission mapping
    SafeCmd --> AutoAllow
    ModerateCmd --> PromptUser
    DangerousCmd --> PromptUser
    BlockedCmd --> AlwaysDeny
    
    %% Execution constraints
    AutoAllow --> SandboxEnv
    PromptUser --> TimeoutLimit
    SandboxEnv --> OutputLimit
    TimeoutLimit --> ResourceLimit

    classDef input fill:#e3f2fd
    classDef security fill:#fff3e0
    classDef permission fill:#f1f8e9
    classDef execution fill:#e8f5e8

    class UserCmd,CmdParsing,SafetyCheck input
    class SafeCmd,ModerateCmd,DangerousCmd,BlockedCmd security
    class AutoAllow,PromptUser,AlwaysDeny,EscalatePriv permission
    class SandboxEnv,TimeoutLimit,OutputLimit,ResourceLimit execution
```

---

## Todo Management Tools Flow

### Todo Write Tool with State Management

```mermaid
sequenceDiagram
    participant AI as AI Provider
    participant TR as Tool Registry
    participant TodoTool as Todo Write Tool
    participant State as Session State
    participant UI as User Interface

    Note over AI,UI: AI requests todo list update

    AI->>TR: Tool call: todowrite(todos[])
    TR->>TodoTool: Execute todo write tool
    TodoTool->>TodoTool: Validate todo structure
    TodoTool->>State: Get current session todos
    State-->>TodoTool: Existing todo list
    
    TodoTool->>TodoTool: Compare new vs existing todos
    TodoTool->>TodoTool: Detect changes:
    Note over TodoTool: - New todos added<br/>- Status changes<br/>- Content updates<br/>- Todos removed
    
    TodoTool->>TodoTool: Determine operation phase:
    Note over TodoTool: - "Creating plan"<br/>- "Updating plan"<br/>- "Refining tasks"<br/>- "Completing work"
    
    TodoTool->>State: Update session todo state
    State->>State: Store todos with timestamps
    
    TodoTool->>UI: Stream metadata update:
    Note over UI: - Todo list with statuses<br/>- Phase description<br/>- Change summary
    
    %% UI rendering of todos
    UI->>UI: Render todo list with:
    UI->>UI: ✅ Completed items (green)
    UI->>UI: 🔄 In progress items (highlighted)
    UI->>UI: ⭕ Pending items (normal)
    UI->>UI: ❌ Cancelled items (struck through)
    
    TodoTool->>TodoTool: Format output for AI:
    Note over TodoTool: - Todo count summary<br/>- Status distribution<br/>- Recent changes
    
    TodoTool-->>TR: Success with formatted todos
    TR-->>AI: Todo update confirmation
    
    Note over AI,UI: Todo state persisted for session continuity

    %% Todo Read Tool (hidden from UI)
    AI->>TR: Tool call: todoread()
    TR->>TodoTool: Execute todo read (hidden tool)
    TodoTool->>State: Get current todos
    State-->>TodoTool: Todo list
    TodoTool-->>TR: Todo summary (no UI update)
    TR-->>AI: Current todo state
```

### Todo Status Flow and Lifecycle

```mermaid
stateDiagram-v2
    [*] --> pending: Todo created
    
    pending --> in_progress: Work started
    pending --> cancelled: Todo cancelled
    
    in_progress --> completed: Task finished
    in_progress --> pending: Work paused
    in_progress --> cancelled: Task abandoned
    
    completed --> [*]: Final state
    cancelled --> pending: Task resumed
    cancelled --> [*]: Permanently cancelled
    
    note right of pending
        New todos start in
        pending status with
        unique IDs generated
    end note
    
    note right of in_progress
        Active todos show with
        code highlighting in UI
        and progress indicators
    end note
    
    note right of completed
        Completed todos show
        with checkmarks and
        success styling
    end note
    
    note right of cancelled
        Cancelled todos show
        with strikethrough
        text and muted colors
    end note
```

---

## Web Fetch Tools Flow

### Web Fetch Tool with Content Processing

```mermaid
sequenceDiagram
    participant AI as AI Provider
    participant TR as Tool Registry
    participant WebTool as Web Fetch Tool
    participant HTTP as HTTP Client
    participant Parser as Content Parser
    participant UI as User Interface

    Note over AI,UI: AI requests web content fetch

    AI->>TR: Tool call: webfetch(url, selector?)
    TR->>WebTool: Execute web fetch tool
    WebTool->>WebTool: Validate URL format
    WebTool->>WebTool: Check permissions (network access)
    
    alt Network Permission Required
        WebTool->>TR: Request network permission
        TR->>UI: Show network access dialog
        UI->>UI: User allows/denies network access
        UI-->>TR: Permission response
        
        alt Permission Denied
            TR-->>WebTool: Permission denied
            WebTool-->>AI: Network access denied
        end
    end
    
    WebTool->>UI: Update status: Fetching URL...
    WebTool->>HTTP: Make HTTP request with timeout
    
    alt Request Successful
        HTTP-->>WebTool: Response (status, headers, content)
        WebTool->>WebTool: Check content type
        
        alt HTML Content
            WebTool->>Parser: Parse HTML content
            Parser->>Parser: Extract text content
            Parser->>Parser: Apply CSS selector (if provided)
            Parser->>Parser: Convert to markdown format
            Parser-->>WebTool: Processed content
            
        else JSON Content
            WebTool->>Parser: Parse JSON
            Parser->>Parser: Format JSON structure  
            Parser-->>WebTool: Formatted JSON
            
        else Plain Text
            WebTool->>WebTool: Use content as-is
        end
        
        WebTool->>WebTool: Truncate content (10 lines max for UI)
        WebTool->>UI: Stream metadata update:
        Note over UI: - URL accessed<br/>- Content type<br/>- Content preview<br/>- Response status
        
        WebTool-->>TR: Success with processed content
        TR-->>AI: Web content + metadata
        
    else Request Failed
        HTTP-->>WebTool: HTTP error (timeout/404/500/etc)
        WebTool->>UI: Error status: Request failed
        WebTool-->>TR: HTTP error with details
        TR-->>AI: Error message + status code
    end

    Note over AI,UI: Web content processed and ready for AI analysis
```

### Web Content Processing Pipeline

```mermaid
flowchart TD
    Start([Web Fetch Request]) --> ValidateURL[Validate URL Format<br/>Protocol, domain, path]
    
    ValidateURL --> CheckCache{Check Content Cache}
    CheckCache -->|Hit| CacheContent[Return Cached Content<br/>Skip HTTP request]
    CheckCache -->|Miss| MakeRequest[Make HTTP Request<br/>With timeout & headers]
    
    MakeRequest --> CheckStatus{HTTP Status}
    CheckStatus -->|2xx Success| ProcessContent[Process Response Content]
    CheckStatus -->|3xx Redirect| FollowRedirect[Follow Redirect<br/>Max 5 redirects]
    CheckStatus -->|4xx/5xx Error| HTTPError[Return HTTP Error<br/>With status details]
    
    FollowRedirect --> MakeRequest
    
    ProcessContent --> DetectType{Content Type}
    
    DetectType -->|text/html| HTMLProcess[HTML Processing<br/>• Parse DOM<br/>• Extract text<br/>• Apply selectors<br/>• Convert to markdown]
    
    DetectType -->|application/json| JSONProcess[JSON Processing<br/>• Parse structure<br/>• Format output<br/>• Handle arrays/objects]
    
    DetectType -->|text/plain| TextProcess[Text Processing<br/>• Clean encoding<br/>• Format lines<br/>• Handle special chars]
    
    DetectType -->|Other| BinaryHandle[Binary Content Handling<br/>• Detect file type<br/>• Extract metadata<br/>• Convert if possible]
    
    HTMLProcess --> TruncateContent[Truncate Content<br/>• Limit to 10 lines for UI<br/>• Keep full content for AI<br/>• Add truncation indicator]
    
    JSONProcess --> TruncateContent
    TextProcess --> TruncateContent
    BinaryHandle --> TruncateContent
    
    TruncateContent --> CacheResult[Cache Result<br/>• Store processed content<br/>• Set expiration time<br/>• Include metadata]
    
    CacheResult --> FormatMetadata[Format UI Metadata<br/>• URL and title<br/>• Content preview<br/>• Processing info]
    
    FormatMetadata --> Success[Return Success Result<br/>• Full content for AI<br/>• Metadata for UI]
    
    CacheContent --> Success
    HTTPError --> Error[Return Error Result]
    
    Success --> End([Web Fetch Complete])
    Error --> End

    classDef start fill:#e8f5e8
    classDef process fill:#e3f2fd
    classDef decision fill:#fff3e0
    classDef contenttype fill:#f1f8e9
    classDef terminal fill:#fce4ec

    class Start,End start
    class ValidateURL,MakeRequest,ProcessContent,TruncateContent,CacheResult,FormatMetadata process
    class CheckCache,CheckStatus,DetectType decision
    class HTMLProcess,JSONProcess,TextProcess,BinaryHandle contenttype
    class CacheContent,FollowRedirect,HTTPError,Success,Error terminal
```

---

## Task Delegation Tools Flow

### Task Tool with Sub-agent Coordination

```mermaid
sequenceDiagram
    participant AI as Main AI
    participant TR as Tool Registry
    participant TaskTool as Task Tool
    participant SubAgent as Sub-agent
    participant Session as Session Manager
    participant UI as User Interface

    Note over AI,UI: AI requests task delegation to sub-agent

    AI->>TR: Tool call: task(description, subagent_type)
    TR->>TaskTool: Execute task tool
    TaskTool->>TaskTool: Validate task description
    TaskTool->>TaskTool: Validate sub-agent type
    
    TaskTool->>Session: Create child session
    Session->>Session: Generate child session ID
    Session->>Session: Link to parent session
    Session-->>TaskTool: Child session created
    
    TaskTool->>UI: Update status: Delegating task...
    TaskTool->>UI: Stream metadata:
    Note over UI: - Task description<br/>- Sub-agent type<br/>- Child session ID<br/>- Navigation link
    
    TaskTool->>SubAgent: Initialize sub-agent
    SubAgent->>SubAgent: Load specialist capabilities
    SubAgent->>SubAgent: Set context from parent
    
    TaskTool->>SubAgent: Execute delegated task
    
    %% Sub-agent execution (can include its own tools)
    loop Sub-agent Processing
        SubAgent->>SubAgent: Analyze task requirements
        SubAgent->>TR: Execute specialist tools
        TR-->>SubAgent: Tool results
        SubAgent->>Session: Update child session
        Session->>UI: Stream child session updates
        UI->>UI: Show nested tool execution
    end
    
    %% Task completion
    alt Task Successful
        SubAgent-->>TaskTool: Task completion report
        TaskTool->>TaskTool: Format results summary
        TaskTool->>UI: Final status: Task completed
        TaskTool->>UI: Stream final metadata:
        Note over UI: - Execution summary<br/>- Key results<br/>- Child session reference<br/>- Success metrics
        
        TaskTool-->>TR: Success with summary
        TR-->>AI: Task results + child session data
        
    else Task Failed
        SubAgent-->>TaskTool: Task failure report
        TaskTool->>UI: Error status: Task failed
        TaskTool->>UI: Stream error metadata:
        Note over UI: - Error description<br/>- Failure point<br/>- Partial results<br/>- Recovery suggestions
        
        TaskTool-->>TR: Task failure
        TR-->>AI: Error details + partial results
    end

    Note over AI,UI: Task delegation complete with full traceability
```

### Sub-agent Specialization Matrix

```mermaid
graph TB
    subgraph "Task Categories"
        CodeAnalysis[Code Analysis<br/>Review, audit, patterns]
        FileOps[File Operations<br/>Read, write, transform]
        Research[Research Tasks<br/>Search, gather, analyze]
        Testing[Testing Tasks<br/>Unit, integration, E2E]
        Documentation[Documentation<br/>Generate, update, format]
    end

    subgraph "Sub-agent Types"
        GeneralPurpose[general-purpose<br/>Multi-domain capabilities]
        Frontend[frontend-developer<br/>UI/UX specialist]
        Backend[backend-architect<br/>Server-side expert]
        DevOps[devops-automator<br/>Infrastructure specialist]
        QA[test-writer-fixer<br/>Quality assurance]
    end

    subgraph "Tool Access"
        AllTools[All Tools<br/>Full tool registry access]
        SpecializedTools[Specialized Tools<br/>Domain-specific subset]
        ReadOnlyTools[Read-Only Tools<br/>Analysis tools only]
        LimitedTools[Limited Tools<br/>Safe operations only]
    end

    subgraph "Context Inheritance"
        FullContext[Full Context<br/>Complete parent session]
        FilteredContext[Filtered Context<br/>Relevant information only]
        TaskContext[Task Context<br/>Task-specific data]
        IsolatedContext[Isolated Context<br/>Independent execution]
    end

    %% Task to sub-agent mapping
    CodeAnalysis --> GeneralPurpose
    CodeAnalysis --> Backend
    FileOps --> GeneralPurpose
    FileOps --> Frontend
    Research --> GeneralPurpose
    Testing --> QA
    Documentation --> GeneralPurpose

    %% Sub-agent tool access
    GeneralPurpose --> AllTools
    Frontend --> SpecializedTools
    Backend --> SpecializedTools
    DevOps --> AllTools
    QA --> SpecializedTools

    %% Context patterns
    AllTools --> FullContext
    SpecializedTools --> FilteredContext
    ReadOnlyTools --> TaskContext
    LimitedTools --> IsolatedContext

    classDef task fill:#e3f2fd
    classDef agent fill:#e8f5e8
    classDef tools fill:#fff3e0
    classDef context fill:#f1f8e9

    class CodeAnalysis,FileOps,Research,Testing,Documentation task
    class GeneralPurpose,Frontend,Backend,DevOps,QA agent
    class AllTools,SpecializedTools,ReadOnlyTools,LimitedTools tools
    class FullContext,FilteredContext,TaskContext,IsolatedContext context
```

---

## Permission Integration Flow

### Cross-Tool Permission Management

```mermaid
flowchart TD
    ToolExecution[Tool Execution Request] --> PermissionCheck{Check Permission Cache}
    
    PermissionCheck -->|Cached Allow| ExecuteDirectly[Execute Tool Immediately]
    PermissionCheck -->|Cached Deny| BlockExecution[Block Tool Execution]
    PermissionCheck -->|No Cache| EvaluateRisk[Evaluate Risk Level]
    
    EvaluateRisk --> RiskLevel{Risk Assessment}
    
    RiskLevel -->|Low Risk| AutoAllow[Auto-allow<br/>Cache permission]
    RiskLevel -->|Medium Risk| PromptUser[Prompt User<br/>Show permission dialog]
    RiskLevel -->|High Risk| RequireExplicit[Require Explicit Approval<br/>Detailed explanation]
    RiskLevel -->|Critical Risk| AlwaysDeny[Always Deny<br/>Block operation]
    
    AutoAllow --> CachePermission[Cache Permission Decision]
    
    PromptUser --> UserDialog{User Decision}
    UserDialog -->|Allow Once| TempPermission[Grant Temporary Permission<br/>Current operation only]
    UserDialog -->|Allow Always| PermPermission[Grant Permanent Permission<br/>Cache for future use]
    UserDialog -->|Deny| DenyPermission[Deny Permission<br/>Block operation]
    
    RequireExplicit --> UserDialog
    
    TempPermission --> ExecuteTool[Execute Tool with Permission]
    PermPermission --> CachePermission
    CachePermission --> ExecuteTool
    
    ExecuteTool --> PermissionContext{Permission Context}
    
    PermissionContext -->|File Operation| FilePermission[File System Access<br/>Read/Write permissions]
    PermissionContext -->|Shell Command| ShellPermission[Shell Execution<br/>Command safety validation]
    PermissionContext -->|Network Access| NetworkPermission[Network Request<br/>External connectivity]
    PermissionContext -->|System Access| SystemPermission[System Information<br/>Environment access]
    
    FilePermission --> MonitorExecution[Monitor Tool Execution<br/>Validate permissions used]
    ShellPermission --> MonitorExecution
    NetworkPermission --> MonitorExecution
    SystemPermission --> MonitorExecution
    
    MonitorExecution --> ExecutionResult{Execution Result}
    
    ExecutionResult -->|Success| LogSuccess[Log Successful Operation<br/>Update permission statistics]
    ExecutionResult -->|Violation| RevokePermission[Revoke Permission<br/>Block future operations]
    ExecutionResult -->|Error| LogError[Log Error<br/>Permission context preserved]
    
    ExecuteDirectly --> MonitorExecution
    BlockExecution --> PermissionDenied[Return Permission Denied Error]
    DenyPermission --> PermissionDenied
    AlwaysDeny --> PermissionDenied
    
    LogSuccess --> ToolComplete[Tool Execution Complete]
    RevokePermission --> ToolComplete
    LogError --> ToolComplete
    PermissionDenied --> ToolComplete

    classDef start fill:#e8f5e8
    classDef decision fill:#fff3e0
    classDef permission fill:#e3f2fd
    classDef execution fill:#f1f8e9
    classDef terminal fill:#fce4ec

    class ToolExecution start
    class PermissionCheck,RiskLevel,UserDialog,PermissionContext,ExecutionResult decision
    class AutoAllow,PromptUser,RequireExplicit,TempPermission,PermPermission,CachePermission permission
    class ExecuteTool,MonitorExecution,FilePermission,ShellPermission,NetworkPermission,SystemPermission execution
    class ExecuteDirectly,BlockExecution,LogSuccess,RevokePermission,LogError,PermissionDenied,ToolComplete terminal
```

---

## Error Handling and Recovery

### Tool Error Recovery Strategies

```mermaid
sequenceDiagram
    participant Tool as Tool Executor
    participant Error as Error Handler
    participant Recovery as Recovery Manager
    participant UI as User Interface
    participant AI as AI Provider

    Note over Tool,AI: Tool execution encounters error

    Tool->>Error: Tool execution error
    Error->>Error: Classify error type:
    Note over Error: - Network timeout<br/>- File not found<br/>- Permission denied<br/>- Command failed<br/>- Resource exhausted

    Error->>Recovery: Initiate recovery strategy
    
    alt Network/Timeout Error
        Recovery->>Recovery: Implement exponential backoff
        Recovery->>UI: Show retry notification
        Recovery->>Tool: Retry operation (max 3 attempts)
        
        alt Retry Successful
            Tool-->>Recovery: Operation succeeded
            Recovery->>UI: Clear error notification
            Recovery-->>AI: Tool result
        else All Retries Failed
            Recovery->>UI: Show persistent error
            Recovery-->>AI: Operation failed after retries
        end
        
    else File System Error
        Recovery->>Recovery: Analyze file error
        Recovery->>UI: Show file error dialog
        
        alt File Not Found
            Recovery->>UI: Suggest file creation
            UI->>UI: User chooses to create/select file
            Recovery->>Tool: Retry with user input
            
        else Permission Denied
            Recovery->>UI: Request elevated permissions
            UI->>UI: User grants/denies permissions
            Recovery->>Tool: Retry with new permissions
            
        else Disk Full
            Recovery->>UI: Show disk space error
            Recovery-->>AI: Cannot proceed - disk full
        end
        
    else Command Execution Error
        Recovery->>Recovery: Analyze command failure
        Recovery->>UI: Show command error details
        
        alt Command Not Found
            Recovery->>UI: Suggest command installation
            Recovery-->>AI: Command unavailable
            
        else Command Failed
            Recovery->>Recovery: Capture error output
            Recovery->>UI: Show execution details
            Recovery-->>AI: Command failed with output
        end
        
    else Resource Exhaustion
        Recovery->>Recovery: Implement resource management
        Recovery->>UI: Show resource warning
        
        alt Memory Exhausted
            Recovery->>Recovery: Enable aggressive cleanup
            Recovery->>Tool: Retry with reduced memory
            
        else CPU Timeout
            Recovery->>Recovery: Increase timeout limit
            Recovery->>Tool: Retry with longer timeout
            
        else Rate Limited
            Recovery->>Recovery: Implement backoff delay
            Recovery->>UI: Show rate limit notice
            Recovery->>Tool: Retry after delay
        end
        
    else Unrecoverable Error
        Recovery->>UI: Show fatal error dialog
        Recovery->>Recovery: Log error for analysis
        Recovery-->>AI: Tool execution permanently failed
    end

    Note over Tool,AI: Error handling complete with user feedback
```

## Implementation Summary

These tool execution flow diagrams provide comprehensive coverage of:

### 🛠 **Tool Categories Covered**
- **File Operations**: read, write, edit with LSP integration and syntax highlighting
- **Shell Commands**: bash execution with real-time streaming and security validation
- **Todo Management**: todoread/todowrite with state persistence and UI formatting
- **Web Fetching**: HTTP requests with content processing and caching
- **Task Delegation**: Sub-agent coordination with specialist capabilities

### 🔒 **Security and Permissions**
- **Risk Assessment**: Multi-level security categorization
- **Permission Management**: Cached decisions with context awareness
- **Command Validation**: Safety checks for shell operations
- **Network Controls**: Secure web access with user approval

### 🚀 **Performance Features**
- **Real-time Streaming**: Live updates for bash and file operations
- **Intelligent Caching**: Content caching with expiration and invalidation
- **Resource Management**: Memory, CPU, and timeout controls
- **Error Recovery**: Comprehensive retry strategies with user guidance

### 🎨 **User Experience**
- **Visual Feedback**: Status indicators, progress animations, and error states
- **Interactive Elements**: Todo checkboxes, terminal displays, and diff viewers
- **Permission Dialogs**: Clear explanations and risk assessment
- **Error Handling**: Graceful degradation with recovery suggestions

These diagrams serve as a complete implementation guide for building tool execution systems that match OpenCode's sophisticated functionality while maintaining security, performance, and excellent user experience.