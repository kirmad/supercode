# API Reference

## 🚀 Public API

The Project Workflow Module provides a clean, type-safe API for processing various workflow types. The primary entry point is the `WorkflowFactory` class.

## 📦 Main Exports

```typescript
import {
  // Factory
  WorkflowFactory,

  // Workflow Processors
  ReviewWorkflowProcessor,

  // Types
  ReviewInput,
  ReviewResult,
  ReviewConfig,
  WorkflowConfig,

  // Enums
  SourceType,
  SeverityLevel,
  InsightType
} from '@opencode/project-workflow'
```

## 🏭 WorkflowFactory

Main factory class for creating workflow processors.

### Methods

#### `createReviewWorkflow(config: ReviewConfig): ReviewWorkflowProcessor`

Creates a configured review workflow processor.

**Parameters:**
- `config: ReviewConfig` - Review workflow configuration

**Returns:** `ReviewWorkflowProcessor` - Configured workflow processor

**Example:**
```typescript
const reviewWorkflow = WorkflowFactory.createReviewWorkflow({
  baseUrl: 'http://localhost:3000',
  maxParallelSessions: 3,
  optimalTokensPerShard: 7000,
  maxTokensPerShard: 9000,
  minTokensPerShard: 3000,
  agent: 'code-reviewer',
  workspace: '/tmp/review-workspace'
})
```

#### `createContentSource(identifier: string): IContentSource`

Creates appropriate content source based on identifier format.

**Parameters:**
- `identifier: string` - Source identifier (commit hash, PR URL, etc.)

**Returns:** `IContentSource` - Content source implementation

**Example:**
```typescript
const adoSource = WorkflowFactory.createContentSource(
  'https://dev.azure.com/org/project/_git/repo/pullrequest/123'
)

const gitSource = WorkflowFactory.createContentSource('abc123def')
```

## 🔍 ReviewWorkflowProcessor

Main class for processing code review workflows.

### Methods

#### `process(input: ReviewInput, config?: Partial<ReviewConfig>): Promise<ReviewResult>`

Process a review workflow from input to result.

**Parameters:**
- `input: ReviewInput` - Review input specification
- `config?: Partial<ReviewConfig>` - Optional configuration overrides

**Returns:** `Promise<ReviewResult>` - Review processing result

**Example:**
```typescript
const result = await reviewWorkflow.process({
  identifier: 'https://dev.azure.com/org/project/_git/repo/pullrequest/123',
  type: SourceType.ADO_PR,
  metadata: {
    saveVersions: true,
    includeComments: true
  }
})

console.log(`Found ${result.comments.length} review comments`)
console.log(`Processed ${result.metadata.totalShards} shards`)
```

#### `validateInput(input: ReviewInput): boolean`

Validate review input before processing.

**Parameters:**
- `input: ReviewInput` - Input to validate

**Returns:** `boolean` - True if valid, false otherwise

**Example:**
```typescript
const isValid = reviewWorkflow.validateInput({
  identifier: 'invalid-input',
  type: SourceType.GIT
})
// Returns: false
```

#### `getMetadata(): WorkflowMetadata`

Get workflow metadata and capabilities.

**Returns:** `WorkflowMetadata` - Workflow information

**Example:**
```typescript
const metadata = reviewWorkflow.getMetadata()
console.log(`Workflow: ${metadata.type} v${metadata.version}`)
console.log(`Capabilities: ${metadata.capabilities.join(', ')}`)
```

## 📝 Configuration Types

### ReviewConfig

Configuration for review workflows.

```typescript
interface ReviewConfig extends WorkflowConfig {
  // Token limits for sharding
  optimalTokensPerShard: number      // Default: 7000
  maxTokensPerShard: number          // Default: 9000
  minTokensPerShard: number          // Default: 3000

  // Review-specific settings
  agent: string                      // Default: 'code-reviewer'
  outputFormat: 'xml' | 'json'       // Default: 'json'

  // File filtering
  includeFilePatterns?: string[]     // Optional: file patterns to include
  excludeFilePatterns?: string[]     // Optional: file patterns to exclude
  maxFileSize?: number               // Optional: max file size in bytes

  // ADO-specific settings
  adoCredentials?: ADOCredentials    // Optional: ADO authentication
  saveVersions?: boolean             // Optional: save file versions locally
}
```

### WorkflowConfig

Base configuration for all workflows.

```typescript
interface WorkflowConfig {
  // Server settings
  baseUrl: string                    // Required: API base URL

  // Processing settings
  maxParallelSessions: number        // Default: 3
  timeoutPerShard: number           // Default: 90000 (90 seconds)

  // Workspace settings
  workspace?: string                 // Optional: custom workspace path
  autoCleanup?: boolean             // Default: true

  // Logging
  logging?: LoggingConfig           // Optional: logging configuration
}
```

## 📥 Input Types

### ReviewInput

Input specification for review workflows.

```typescript
interface ReviewInput extends WorkflowInput {
  identifier: string                 // Required: commit hash or PR URL
  type: SourceType                  // Required: source type
  metadata?: {
    saveVersions?: boolean          // Optional: save file versions
    includeComments?: boolean       // Optional: include existing comments
    filters?: ReviewFilters         // Optional: content filters
  }
}
```

### SourceType

Enumeration of supported source types.

```typescript
enum SourceType {
  GIT = 'git',                      // Git commit hash
  ADO_PR = 'ado-pr',               // Azure DevOps PR URL
  GITHUB_PR = 'github-pr',         // GitHub PR URL (future)
  LOCAL = 'local'                  // Local file path (future)
}
```

## 📤 Result Types

### ReviewResult

Result of review workflow processing.

```typescript
interface ReviewResult extends WorkflowResult {
  // Review-specific results
  insights: ReviewInsight[]          // High-level insights
  hunks: ReviewHunk[]               // Code hunks with analysis
  comments: ReviewComment[]         // Generated review comments
  adoComments?: ADOComment[]        // Existing ADO comments

  // Inherited from WorkflowResult
  success: boolean                  // Processing success status
  metadata: WorkflowMetadata        // Workflow metadata
  statistics: ProcessingStatistics  // Processing statistics
  workspace?: string                // Workspace path (if preserved)
}
```

### ReviewInsight

High-level review insights.

```typescript
interface ReviewInsight {
  shard: number                     // Source shard index
  type: InsightType                // Insight category
  severity: SeverityLevel          // Severity level
  content: string                  // Insight description
}

enum InsightType {
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  QUALITY = 'quality',
  MAINTAINABILITY = 'maintainability'
}
```

### ReviewHunk

Code hunk analysis results.

```typescript
interface ReviewHunk {
  shard: number                    // Source shard index
  file: string                     // File path
  startLine: number                // Start line number
  endLine: number                  // End line number
  category: HunkCategory           // Hunk category
  risk: RiskLevel                  // Risk assessment
  description: string              // Hunk description
  needsAttention: boolean          // Requires attention flag
}

enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}
```

### ReviewComment

Generated review comments.

```typescript
interface ReviewComment {
  shard: number                    // Source shard index
  file: string                     // File path
  startLine: number                // Start line number
  endLine: number                  // End line number
  type: CommentType               // Comment type
  severity: SeverityLevel         // Severity level
  message: string                 // Comment message
  fixCode?: string                // Optional fix code
  threadId?: string               // Thread identifier

  // Metadata
  id: string                      // Unique comment ID
  author: CommentAuthor           // Comment author info
  createdAt: string              // Creation timestamp
  responses?: CommentResponse[]   // Thread responses
}
```

## 🔧 Utility Functions

### Token Estimation

```typescript
function estimateTokens(text: string): number
```

Estimate token count for text content.

**Parameters:**
- `text: string` - Text to analyze

**Returns:** `number` - Estimated token count

**Example:**
```typescript
import { estimateTokens } from '@opencode/project-workflow'

const tokens = estimateTokens('function hello() { return "world" }')
console.log(`Estimated tokens: ${tokens}`)
```

### Source Type Detection

```typescript
function detectSourceType(identifier: string): SourceType | null
```

Detect source type from identifier format.

**Parameters:**
- `identifier: string` - Source identifier

**Returns:** `SourceType | null` - Detected source type or null

**Example:**
```typescript
import { detectSourceType, SourceType } from '@opencode/project-workflow'

const type = detectSourceType('https://dev.azure.com/org/project/_git/repo/pullrequest/123')
console.log(type === SourceType.ADO_PR) // true
```

## 🔍 Advanced Usage

### Custom Configuration

```typescript
// Advanced review configuration
const advancedConfig: ReviewConfig = {
  // Base settings
  baseUrl: 'http://localhost:3000',
  maxParallelSessions: 5,
  timeoutPerShard: 120000,

  // Sharding optimization
  optimalTokensPerShard: 8000,
  maxTokensPerShard: 12000,
  minTokensPerShard: 4000,

  // File filtering
  excludeFilePatterns: [
    '*.xml',
    '*.json',
    '*.md',
    '**/bin/**',
    '**/obj/**'
  ],
  maxFileSize: 50000,

  // ADO settings
  adoCredentials: {
    pat: process.env.AZURE_DEVOPS_PAT,
    organization: 'myorg'
  },
  saveVersions: true,

  // Workspace
  workspace: '/tmp/custom-review-workspace',
  autoCleanup: false,

  // Logging
  logging: {
    level: 'debug',
    format: 'json',
    destination: '/var/log/workflow.log'
  }
}

const workflow = WorkflowFactory.createReviewWorkflow(advancedConfig)
```

### Error Handling

```typescript
import {
  WorkflowError,
  ContentSourceError,
  ProcessingError,
  ValidationError
} from '@opencode/project-workflow'

try {
  const result = await reviewWorkflow.process({
    identifier: 'invalid-pr-url',
    type: SourceType.ADO_PR
  })
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Input validation failed:', error.message)
  } else if (error instanceof ContentSourceError) {
    console.error('Failed to fetch content:', error.message)
  } else if (error instanceof ProcessingError) {
    console.error('Processing failed:', error.message)
    console.log('Partial results:', error.partialResults)
  } else if (error instanceof WorkflowError) {
    console.error('Workflow error:', error.message)
  } else {
    console.error('Unexpected error:', error)
  }
}
```

### Progress Monitoring

```typescript
// With progress callbacks (if supported)
const result = await reviewWorkflow.process(input, {
  ...config,
  onProgress: (progress) => {
    console.log(`Progress: ${progress.completed}/${progress.total} shards`)
    console.log(`Estimated completion: ${progress.estimatedCompletion}`)
  },
  onShardComplete: (shardResult) => {
    if (shardResult.success) {
      console.log(`Shard ${shardResult.shardIndex} completed successfully`)
    } else {
      console.warn(`Shard ${shardResult.shardIndex} failed: ${shardResult.error?.message}`)
    }
  }
})
```

### Partial Results Handling

```typescript
try {
  const result = await reviewWorkflow.process(input, config)
  console.log('Full processing completed successfully')
} catch (error) {
  if (error instanceof ProcessingError && error.partialResults) {
    console.warn('Processing partially failed, using partial results')

    // Use partial results
    const insights = error.partialResults.insights || []
    const comments = error.partialResults.comments || []

    console.log(`Recovered ${insights.length} insights and ${comments.length} comments`)
  }
}
```

## 🧪 Testing Support

### Mock Implementations

```typescript
import {
  MockContentSource,
  MockProcessingEngine,
  createMockReviewResult
} from '@opencode/project-workflow/testing'

// Create mock workflow for testing
const mockWorkflow = new ReviewWorkflowProcessor(
  new MockContentSource(),
  new FileBoundaryShardingStrategy(),
  new MockProcessingEngine(),
  new ReviewResultAggregator(),
  new WorkspaceManager()
)

// Use in tests
const mockResult = createMockReviewResult({
  commentCount: 10,
  insightCount: 5
})
```

This API provides a comprehensive, type-safe interface for workflow processing while maintaining simplicity for common use cases and flexibility for advanced scenarios.