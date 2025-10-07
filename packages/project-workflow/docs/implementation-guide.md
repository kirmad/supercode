# Implementation Guide

## 🚀 Step-by-Step Implementation

This guide walks through implementing the Project Workflow Module by extracting logic from the existing `scripts/sharded-review-parallel.js` script.

## 📋 Implementation Phases

### Phase 1: Foundation Setup
1. Create module structure
2. Define core interfaces
3. Set up build configuration
4. Create initial tests

### Phase 2: Core Components
1. Implement base classes
2. Create content source implementations
3. Build sharding strategies
4. Develop processing engine

### Phase 3: Review Workflow
1. Extract review-specific logic
2. Implement result aggregation
3. Create review workflow processor
4. Add comprehensive tests

### Phase 4: Integration
1. Create factory and public API
2. Update existing script
3. Add documentation
4. Performance optimization

## 🏗️ Phase 1: Foundation Setup

### Step 1.1: Create Module Structure

```bash
# Create the module directory
mkdir -p packages/project-workflow

# Create the source structure
mkdir -p packages/project-workflow/src/{core,review,sources,types,factory}
mkdir -p packages/project-workflow/docs
mkdir -p packages/project-workflow/test
```

### Step 1.2: Initialize Package Configuration

Create `packages/project-workflow/package.json`:

```json
{
  "name": "@opencode/project-workflow",
  "version": "0.1.0",
  "description": "Extensible workflow processing system for OpenCode",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./testing": {
      "import": "./dist/testing/index.js",
      "types": "./dist/testing/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "test": "bun test",
    "test:watch": "bun test --watch",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/**/*.ts",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.0.0"
  },
  "peerDependencies": {
    "@types/node": "*"
  }
}
```

### Step 1.3: TypeScript Configuration

Create `packages/project-workflow/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "test", "**/*.test.ts"]
}
```

### Step 1.4: Core Type Definitions

Create `packages/project-workflow/src/types/WorkflowTypes.ts`:

```typescript
// Base workflow interfaces
export interface IWorkflowProcessor<TInput extends WorkflowInput, TResult extends WorkflowResult> {
  process(input: TInput, config: WorkflowConfig): Promise<TResult>
  validateInput(input: TInput): boolean
  getMetadata(): WorkflowMetadata
}

export interface WorkflowInput {
  identifier: string
  type: SourceType
  metadata?: Record<string, any>
}

export interface WorkflowResult {
  success: boolean
  metadata: WorkflowMetadata
  statistics: ProcessingStatistics
  workspace?: string
}

export interface WorkflowConfig {
  baseUrl: string
  maxParallelSessions: number
  timeoutPerShard: number
  workspace?: string
  logging?: LoggingConfig
}

export interface WorkflowMetadata {
  type: string
  version: string
  capabilities: string[]
  startTime: string
  endTime?: string
  processingTime?: number
}

export interface ProcessingStatistics {
  totalShards: number
  successfulShards: number
  failedShards: number
  totalTokens: number
  processingTime: number
  averageShardTime: number
}

export enum SourceType {
  GIT = 'git',
  ADO_PR = 'ado-pr',
  GITHUB_PR = 'github-pr',
  LOCAL = 'local'
}
```

## 🔧 Phase 2: Core Components

### Step 2.1: Content Source Abstraction

Create `packages/project-workflow/src/core/ContentSource.ts`:

```typescript
import type { SourceContent, ContentFetchOptions, SourceMetadata } from '../types/SourceTypes.js'
import type { SourceType } from '../types/WorkflowTypes.js'

export interface IContentSource {
  fetchContent(identifier: string, options?: ContentFetchOptions): Promise<SourceContent>
  validateIdentifier(identifier: string): boolean
  isAvailable(identifier: string): Promise<boolean>
  getSourceType(): SourceType
}

export abstract class ContentSource implements IContentSource {
  abstract fetchContent(identifier: string, options?: ContentFetchOptions): Promise<SourceContent>
  abstract validateIdentifier(identifier: string): boolean
  abstract getSourceType(): SourceType

  async isAvailable(identifier: string): Promise<boolean> {
    try {
      if (!this.validateIdentifier(identifier)) {
        return false
      }
      // Basic availability check - can be overridden
      return true
    } catch {
      return false
    }
  }

  protected createSourceContent(
    identifier: string,
    metadata: SourceMetadata,
    content: any
  ): SourceContent {
    return {
      identifier,
      type: this.getSourceType(),
      metadata,
      content
    }
  }
}
```

### Step 2.2: ADO Content Source Implementation

Create `packages/project-workflow/src/sources/ADOContentSource.ts`:

```typescript
import { ContentSource } from '../core/ContentSource.js'
import type { SourceContent, ContentFetchOptions, ADOCredentials } from '../types/SourceTypes.js'
import { SourceType } from '../types/WorkflowTypes.js'

export class ADOContentSource extends ContentSource {
  private credentials: ADOCredentials

  constructor(credentials?: ADOCredentials) {
    super()
    this.credentials = credentials || this.getDefaultCredentials()
  }

  validateIdentifier(identifier: string): boolean {
    const adoRegex = /https:\/\/(.+)\.visualstudio\.com\/([^\/]+)\/_git\/([^\/]+)\/pullrequest\/(\d+)/
    return adoRegex.test(identifier)
  }

  getSourceType(): SourceType {
    return SourceType.ADO_PR
  }

  async fetchContent(identifier: string, options?: ContentFetchOptions): Promise<SourceContent> {
    const adoInfo = this.parseADOUrl(identifier)
    if (!adoInfo.isADO) {
      throw new Error('Invalid ADO PR URL format')
    }

    // Fetch PR data from ADO API
    const prData = await this.fetchADOPullRequest(
      adoInfo.organization,
      adoInfo.project,
      adoInfo.repository,
      adoInfo.pullRequestId,
      options?.saveDirectory
    )

    // Process and filter files
    const processedFiles = await this.processFiles(prData.fileDiffs, options)

    return this.createSourceContent(identifier, {
      source: 'ado',
      prId: adoInfo.pullRequestId,
      organization: adoInfo.organization,
      project: adoInfo.project,
      repository: adoInfo.repository,
      title: prData.title,
      description: prData.description,
      author: prData.author,
      createdDate: prData.createdDate,
      sourceBranch: prData.sourceBranch,
      targetBranch: prData.targetBranch
    }, {
      files: processedFiles,
      diffs: Object.values(prData.fileDiffs),
      totalSize: processedFiles.reduce((sum, f) => sum + f.size, 0),
      totalTokens: processedFiles.reduce((sum, f) => sum + f.tokens, 0)
    })
  }

  private parseADOUrl(url: string) {
    const adoRegex = /https:\/\/(.+)\.visualstudio\.com\/([^\/]+)\/_git\/([^\/]+)\/pullrequest\/(\d+)/
    const match = url.match(adoRegex)

    if (match) {
      return {
        organization: match[1],
        project: match[2],
        repository: match[3],
        pullRequestId: parseInt(match[4]),
        isADO: true
      }
    }

    return { isADO: false }
  }

  private async fetchADOPullRequest(
    organization: string,
    project: string,
    repository: string,
    pullRequestId: number,
    saveDirectory?: string
  ) {
    // Extract from existing script's fetchADOPullRequest function
    const baseUrl = process.env.WORKFLOW_BASE_URL || 'http://localhost:3000'
    let apiUrl = `${baseUrl}/api/ado/pullrequests/${repository}/${pullRequestId}`

    if (saveDirectory) {
      apiUrl += `?saveDirectory=${encodeURIComponent(saveDirectory)}`
    }

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`ADO API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    return await response.json()
  }

  private async processFiles(fileDiffs: Record<string, any>, options?: ContentFetchOptions) {
    // Extract file processing logic from existing script
    const processedFiles = []

    for (const [filePath, diffData] of Object.entries(fileDiffs)) {
      if (!diffData.diff || diffData.diff.trim().length === 0) continue

      const diffSize = diffData.diff.length
      const isSkipped = this.shouldSkipFile(filePath)
      const isMassive = diffSize > 50000

      if (isSkipped || isMassive) {
        continue
      }

      processedFiles.push({
        path: filePath,
        content: diffData.diff,
        size: diffSize,
        tokens: this.estimateTokens(diffData.diff),
        changeType: diffData.changeType
      })
    }

    return processedFiles
  }

  private shouldSkipFile(filePath: string): boolean {
    const skipPatterns = [
      /\.xml$/i,
      /\.json$/i,
      /\.md$/i,
      /\.txt$/i,
      /\.gitignore$/i,
      /\/bin\//i,
      /\/obj\//i,
      /\.dll$/i,
      /\.exe$/i,
      /\.pdb$/i,
      /packages\.config$/i,
      /\.min\./i,
      /\.generated\./i,
      /\.designer\./i
    ]

    return skipPatterns.some(pattern => pattern.test(filePath))
  }

  private estimateTokens(text: string): number {
    return Math.floor(text.length / 4)
  }

  private getDefaultCredentials(): ADOCredentials {
    return {
      pat: process.env.AZURE_DEVOPS_PAT || process.env.ADO_PAT || ''
    }
  }
}
```

### Step 2.3: Sharding Strategy Implementation

Create `packages/project-workflow/src/review/ReviewShardingStrategy.ts`:

```typescript
import type { IShardingStrategy } from '../core/ShardingStrategy.js'
import type { SourceContent, Shard, ShardingConfig } from '../types/SourceTypes.js'

export class FileBoundaryShardingStrategy implements IShardingStrategy {
  async createShards(content: SourceContent, config: ShardingConfig): Promise<Shard[]> {
    const shards: Shard[] = []
    let currentShard: any[] = []
    let currentShardTokens = 0
    let shardIndex = 0

    for (const file of content.content.files) {
      // If adding this file would exceed the target, start a new shard
      if (currentShardTokens > 0 && currentShardTokens + file.tokens > config.targetTokens) {
        shards.push(this.createShard(shardIndex, currentShard))
        currentShard = []
        currentShardTokens = 0
        shardIndex++
      }

      currentShard.push(file)
      currentShardTokens += file.tokens

      // If this single file is too large, put it in its own shard
      if (file.tokens > config.targetTokens) {
        shards.push(this.createShard(shardIndex, currentShard))
        currentShard = []
        currentShardTokens = 0
        shardIndex++
      }
    }

    // Add remaining files to final shard
    if (currentShard.length > 0) {
      shards.push(this.createShard(shardIndex, currentShard))
    }

    return shards
  }

  estimateShardCount(content: SourceContent, config: ShardingConfig): number {
    const totalTokens = content.content.totalTokens
    return Math.max(1, Math.ceil(totalTokens / config.targetTokens))
  }

  validateConfig(config: ShardingConfig): boolean {
    return (
      config.targetTokens > 0 &&
      config.maxTokens > config.targetTokens &&
      config.minTokens < config.targetTokens
    )
  }

  getMetadata() {
    return {
      type: 'file_boundary',
      version: '1.0.0',
      description: 'File-boundary-aware sharding with token optimization'
    }
  }

  private createShard(index: number, files: any[]): Shard {
    const content = files.map(f => f.content).join('\n\n')
    const tokens = files.reduce((sum, f) => sum + f.tokens, 0)
    const size = files.reduce((sum, f) => sum + f.size, 0)

    return {
      index,
      files,
      content,
      tokens,
      metadata: {
        fileCount: files.length,
        size,
        strategy: 'file_boundary'
      }
    }
  }
}
```

### Step 2.4: Processing Engine Implementation

Create `packages/project-workflow/src/core/ProcessingEngine.ts`:

```typescript
import type { IProcessingEngine } from '../types/WorkflowTypes.js'
import type { Shard, ShardResult, ProcessingConfig, ShardProcessor } from '../types/SourceTypes.js'

export class ProcessingEngine implements IProcessingEngine {
  private processingStatus: ProcessingStatus = ProcessingStatus.IDLE
  private partialResults: ShardResult[] = []
  private activeSessions: Set<string> = new Set()

  async processShards(
    shards: Shard[],
    processor: ShardProcessor,
    config: ProcessingConfig
  ): Promise<ShardResult[]> {
    this.processingStatus = ProcessingStatus.PROCESSING
    this.partialResults = []

    try {
      const results = await this.processShardsBatched(shards, processor, config)
      this.processingStatus = ProcessingStatus.COMPLETED
      return results
    } catch (error) {
      this.processingStatus = ProcessingStatus.ERROR
      throw error
    }
  }

  private async processShardsBatched(
    shards: Shard[],
    processor: ShardProcessor,
    config: ProcessingConfig
  ): Promise<ShardResult[]> {
    const results: ShardResult[] = []
    const batchSize = config.batchSize

    for (let i = 0; i < shards.length; i += batchSize) {
      const batch = shards.slice(i, i + batchSize)

      // Process batch in parallel
      const batchPromises = batch.map(shard =>
        this.processShardWithRetry(shard, processor, config)
      )

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
      this.partialResults = results

      // Short delay between batches to avoid overwhelming the server
      if (i + batchSize < shards.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    return results
  }

  private async processShardWithRetry(
    shard: Shard,
    processor: ShardProcessor,
    config: ProcessingConfig
  ): Promise<ShardResult> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < config.retryAttempts; attempt++) {
      try {
        const startTime = Date.now()
        const result = await processor.processShard(shard, config)
        const processingTime = Date.now() - startTime

        return {
          shardIndex: shard.index,
          success: true,
          result,
          processingTime,
          metadata: { attempt: attempt + 1 }
        }
      } catch (error) {
        lastError = error as Error

        if (attempt < config.retryAttempts - 1) {
          const delay = config.retryDelay * Math.pow(2, attempt) // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    return {
      shardIndex: shard.index,
      success: false,
      error: lastError,
      processingTime: 0,
      metadata: { attempts: config.retryAttempts }
    }
  }

  getStatus(): ProcessingStatus {
    return this.processingStatus
  }

  async cancel(): Promise<void> {
    this.processingStatus = ProcessingStatus.CANCELLED
    // Cancel active sessions
    for (const sessionId of this.activeSessions) {
      await this.cleanupSession(sessionId)
    }
    this.activeSessions.clear()
  }

  getPartialResults(): ShardResult[] {
    return [...this.partialResults]
  }

  private async cleanupSession(sessionId: string): Promise<void> {
    try {
      const baseUrl = process.env.WORKFLOW_BASE_URL || 'http://localhost:3000'
      await fetch(`${baseUrl}/session/${sessionId}`, { method: 'DELETE' })
    } catch {
      // Ignore cleanup errors
    }
  }
}

enum ProcessingStatus {
  IDLE = 'idle',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ERROR = 'error'
}
```

## 🔍 Phase 3: Review Workflow

### Step 3.1: Review Workflow Processor

Create `packages/project-workflow/src/review/ReviewWorkflowProcessor.ts`:

```typescript
import { WorkflowProcessor } from '../core/WorkflowProcessor.js'
import type { ReviewInput, ReviewResult, ReviewConfig } from '../types/ReviewTypes.js'
import type { ShardProcessor } from '../types/SourceTypes.js'

export class ReviewWorkflowProcessor extends WorkflowProcessor<ReviewInput, ReviewResult> {
  constructor(
    contentSource: IContentSource,
    shardingStrategy: IShardingStrategy,
    processingEngine: IProcessingEngine,
    resultAggregator: IResultAggregator<ReviewResult>,
    workspaceManager: IWorkspaceManager,
    private config: ReviewConfig
  ) {
    super(contentSource, shardingStrategy, processingEngine, resultAggregator, workspaceManager)
  }

  protected createShardProcessor(config: WorkflowConfig): ShardProcessor {
    return new ReviewShardProcessor(this.config)
  }

  protected getWorkspacePrefix(): string {
    return 'review'
  }

  validateInput(input: ReviewInput): boolean {
    return (
      super.validateInput(input) &&
      this.contentSource.validateIdentifier(input.identifier)
    )
  }

  protected getCapabilities(): string[] {
    return [
      'parallel_processing',
      'file_boundary_sharding',
      'xml_to_json_aggregation',
      'ado_integration',
      'git_integration',
      'comment_threading'
    ]
  }
}

class ReviewShardProcessor implements ShardProcessor {
  constructor(private config: ReviewConfig) {}

  async processShard(shard: Shard, config: ProcessingConfig): Promise<any> {
    // Extract from generateShardXMLWithSession function
    const sessionId = await this.createSession()

    try {
      const prompt = this.buildReviewPrompt(shard.content)

      const response = await fetch(`${this.config.baseUrl}/session/${sessionId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parts: [{ type: 'text', text: prompt }],
          agent: this.config.agent
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const responseText = await response.text()
      const responseData = JSON.parse(responseText)

      let xmlContent = ''
      if (responseData.parts) {
        for (const part of responseData.parts) {
          if (part.type === 'text' && part.text) {
            xmlContent += part.text
          }
        }
      }

      if (xmlContent.length === 0) {
        throw new Error('Empty XML content received')
      }

      return xmlContent
    } finally {
      await this.cleanupSession(sessionId)
    }
  }

  private buildReviewPrompt(shardContent: string): string {
    return `Please conduct a code review and follow the exact XML output format.

**CRITICAL**: Use this exact XML structure:

1. First output multiple <review-insight> tags as you read:

<review-insight type="security" severity="high">
[Your immediate security observation]
</review-insight>

<review-insight type="performance" severity="medium">
[Your performance observation]
</review-insight>

2. Then output ONE <review-result> containing both hunks and comments:

<review-result>

<hunks>
<hunk file="path/to/file.ext" start="10" end="20">
<category>security-fix</category>
<risk>high</risk>
<description>Brief description of what this hunk does</description>
<needs-attention>yes</needs-attention>
</hunk>
</hunks>

<comments>
<comment>
<file>path/to/file.ext</file>
<lines start="15" end="15"/>
<type>issue</type>
<severity>high</severity>
<message>Specific issue description</message>
<fix-code>
\`\`\`javascript
// Fixed code here
\`\`\`
</fix-code>
</comment>
</comments>

</review-result>

**Code diff to review:**
\`\`\`diff
${shardContent}
\`\`\`

Output ONLY the XML format above. Focus on security, performance, quality issues with specific line numbers.`
  }

  private async createSession(): Promise<string> {
    const response = await fetch(`${this.config.baseUrl}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022'
      })
    })

    if (!response.ok) {
      throw new Error(`Session creation failed: ${response.statusText}`)
    }

    const session = await response.json()
    return session.id
  }

  private async cleanupSession(sessionId: string): Promise<void> {
    try {
      await fetch(`${this.config.baseUrl}/session/${sessionId}`, { method: 'DELETE' })
    } catch {
      // Ignore cleanup errors
    }
  }
}
```

### Step 3.2: Result Aggregation

Create `packages/project-workflow/src/review/ReviewResultAggregator.ts`:

```typescript
import type { IResultAggregator } from '../core/ResultAggregator.js'
import type { ReviewResult, ReviewInsight, ReviewHunk, ReviewComment } from '../types/ReviewTypes.js'
import type { ShardResult, SourceMetadata, AggregationConfig } from '../types/SourceTypes.js'

export class ReviewResultAggregator implements IResultAggregator<ReviewResult> {
  async aggregateResults(
    results: ShardResult[],
    metadata: SourceMetadata,
    config: AggregationConfig
  ): Promise<ReviewResult> {
    const successful = results.filter(r => r.success)

    const aggregatedData = {
      success: true,
      metadata: {
        type: 'review',
        version: '1.0.0',
        capabilities: ['xml_parsing', 'comment_threading', 'insight_extraction'],
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        processingTime: results.reduce((sum, r) => sum + r.processingTime, 0)
      },
      statistics: {
        totalShards: results.length,
        successfulShards: successful.length,
        failedShards: results.length - successful.length,
        totalTokens: 0, // Will be calculated from shards
        processingTime: results.reduce((sum, r) => sum + r.processingTime, 0),
        averageShardTime: results.reduce((sum, r) => sum + r.processingTime, 0) / results.length
      },
      insights: [] as ReviewInsight[],
      hunks: [] as ReviewHunk[],
      comments: [] as ReviewComment[],
      adoComments: metadata.adoComments || []
    }

    // Parse and aggregate results from successful shards
    for (const result of successful) {
      if (result.result) {
        const parsed = this.parseXMLToJSON(result.result, result.shardIndex)
        aggregatedData.insights.push(...parsed.insights)
        aggregatedData.hunks.push(...parsed.hunks)
        aggregatedData.comments.push(...parsed.comments)
      }
    }

    // Transform AI comments to unified format
    const transformedAIComments = this.transformAIComments(aggregatedData.comments)

    // Merge AI and ADO comments with threading support
    aggregatedData.comments = this.mergeCommentsWithThreading(
      transformedAIComments,
      aggregatedData.adoComments
    )

    return aggregatedData
  }

  validateShardResult(result: ShardResult): boolean {
    return result.success && typeof result.result === 'string' && result.result.length > 0
  }

  getStatistics(results: ShardResult[]) {
    const successful = results.filter(r => r.success)

    return {
      totalResults: results.length,
      successfulResults: successful.length,
      failureRate: (results.length - successful.length) / results.length,
      averageProcessingTime: results.reduce((sum, r) => sum + r.processingTime, 0) / results.length,
      totalProcessingTime: results.reduce((sum, r) => sum + r.processingTime, 0)
    }
  }

  private parseXMLToJSON(xmlContent: string, shardIndex: number) {
    const insights: ReviewInsight[] = []
    const hunks: ReviewHunk[] = []
    const comments: ReviewComment[] = []

    // Extract review insights
    const insightRegex = /<review-insight[^>]*type="([^"]*)"[^>]*severity="([^"]*)"[^>]*>([\s\S]*?)<\/review-insight>/g
    let match
    while ((match = insightRegex.exec(xmlContent)) !== null) {
      insights.push({
        shard: shardIndex,
        type: match[1] as any,
        severity: match[2] as any,
        content: match[3].trim()
      })
    }

    // Extract hunks
    const hunkRegex = /<hunk[^>]*file="([^"]*)"[^>]*start="([^"]*)"[^>]*end="([^"]*)"[^>]*>([\s\S]*?)<\/hunk>/g
    while ((match = hunkRegex.exec(xmlContent)) !== null) {
      const hunkContent = match[4]
      const categoryMatch = hunkContent.match(/<category>(.*?)<\/category>/)
      const riskMatch = hunkContent.match(/<risk>(.*?)<\/risk>/)
      const descMatch = hunkContent.match(/<description>(.*?)<\/description>/)
      const attentionMatch = hunkContent.match(/<needs-attention>(.*?)<\/needs-attention>/)

      hunks.push({
        shard: shardIndex,
        file: match[1],
        startLine: parseInt(match[2]),
        endLine: parseInt(match[3]),
        category: categoryMatch ? categoryMatch[1] as any : 'unknown',
        risk: riskMatch ? riskMatch[1] as any : 'unknown',
        description: descMatch ? descMatch[1] : '',
        needsAttention: attentionMatch ? attentionMatch[1] === 'yes' : false
      })
    }

    // Extract comments
    const commentRegex = /<comment>([\s\S]*?)<\/comment>/g
    while ((match = commentRegex.exec(xmlContent)) !== null) {
      const commentContent = match[1]
      const fileMatch = commentContent.match(/<file>(.*?)<\/file>/)
      const linesMatch = commentContent.match(/<lines[^>]*start="([^"]*)"[^>]*end="([^"]*)"[^>]*\/>/)
      const typeMatch = commentContent.match(/<type>(.*?)<\/type>/)
      const severityMatch = commentContent.match(/<severity>(.*?)<\/severity>/)
      const messageMatch = commentContent.match(/<message>(.*?)<\/message>/)
      const fixCodeMatch = commentContent.match(/<fix-code>([\s\S]*?)<\/fix-code>/)

      comments.push({
        shard: shardIndex,
        file: fileMatch ? fileMatch[1] : '',
        startLine: linesMatch ? parseInt(linesMatch[1]) : 0,
        endLine: linesMatch ? parseInt(linesMatch[2]) : 0,
        type: typeMatch ? typeMatch[1] as any : 'unknown',
        severity: severityMatch ? severityMatch[1] as any : 'unknown',
        message: messageMatch ? messageMatch[1] : '',
        fixCode: fixCodeMatch ? fixCodeMatch[1].trim() : ''
      })
    }

    return { insights, hunks, comments }
  }

  private transformAIComments(comments: any[]): ReviewComment[] {
    return comments.map((comment, index) => ({
      ...comment,
      id: comment.shard !== undefined ? `ai-${comment.shard}-${index}` : `ai-${index}`,
      threadId: `${comment.file}-${comment.startLine}-${comment.endLine}`,
      createdAt: new Date().toISOString(),
      author: {
        type: 'ai',
        name: 'AI Assistant'
      }
    }))
  }

  private mergeCommentsWithThreading(aiComments: ReviewComment[], adoComments: any[]): ReviewComment[] {
    // Create stable IDs for ADO comments
    const processedAdoComments = adoComments.map(comment => {
      let id: string

      if (comment.id) {
        if (comment.createdAt || comment.publishedDate) {
          const timestamp = new Date(comment.createdAt || comment.publishedDate).getTime()
          id = `ado-${comment.id}-${timestamp}`
        } else {
          id = `ado-${comment.id}`
        }
      } else if (comment.adoThreadId && comment.adoThreadId !== 1) {
        id = `ado-${comment.adoThreadId}`
      } else if (comment.threadId && comment.threadId !== 1) {
        id = `ado-${comment.threadId}`
      } else {
        // Fallback: create hash from content and timestamp
        const hashInput = `${comment.threadId || 1}-${comment.createdDate || comment.createdAt || ''}-${comment.message?.substring(0, 50) || ''}`
        const simpleHash = hashInput.split('').reduce((hash, char) => {
          return ((hash << 5) - hash + char.charCodeAt(0)) & 0xffffffff
        }, 0)
        id = `ado-hash-${Math.abs(simpleHash)}`
      }

      return { ...comment, id }
    })

    // Merge all comments and group by threadId
    const allComments = [...aiComments, ...processedAdoComments]
    const commentsByThread = new Map()

    allComments.forEach(comment => {
      const threadId = comment.threadId
      if (!commentsByThread.has(threadId)) {
        commentsByThread.set(threadId, [])
      }
      commentsByThread.get(threadId).push(comment)
    })

    // Create unified comments with thread support
    const unifiedComments: ReviewComment[] = []

    for (const [threadId, threadComments] of commentsByThread) {
      threadComments.sort((a: any, b: any) => {
        const aTime = new Date(a.createdAt || '').getTime()
        const bTime = new Date(b.createdAt || '').getTime()
        if (aTime === bTime) {
          return a.author?.type === 'ai' ? -1 : 1
        }
        return aTime - bTime
      })

      const primaryComment = threadComments[0]
      const unifiedComment: ReviewComment = {
        ...primaryComment,
        threadId
      }

      if (threadComments.length > 1) {
        unifiedComment.responses = threadComments.slice(1).map((comment: any, index: number) => ({
          id: comment.id || `response-${threadId}-${index + 1}`,
          author: comment.author || { type: 'user', name: 'Unknown' },
          content: comment.message || comment.content || '',
          createdAt: comment.createdAt || new Date().toISOString(),
          ...(comment.shard !== undefined && { shard: comment.shard })
        }))
      }

      unifiedComments.push(unifiedComment)
    }

    return unifiedComments
  }
}
```

## 🏭 Phase 4: Integration

### Step 4.1: Workflow Factory

Create `packages/project-workflow/src/factory/WorkflowFactory.ts`:

```typescript
import { ReviewWorkflowProcessor } from '../review/ReviewWorkflowProcessor.js'
import { ADOContentSource } from '../sources/ADOContentSource.js'
import { GitContentSource } from '../sources/GitContentSource.js'
import { FileBoundaryShardingStrategy } from '../review/ReviewShardingStrategy.js'
import { ProcessingEngine } from '../core/ProcessingEngine.js'
import { ReviewResultAggregator } from '../review/ReviewResultAggregator.js'
import { WorkspaceManager } from '../core/WorkspaceManager.js'
import type { ReviewConfig } from '../types/ReviewTypes.js'
import type { IContentSource } from '../core/ContentSource.js'
import { SourceType } from '../types/WorkflowTypes.js'

export class WorkflowFactory {
  static createReviewWorkflow(config: ReviewConfig): ReviewWorkflowProcessor {
    // Create default content source (can be overridden)
    const contentSource = new ADOContentSource(config.adoCredentials)

    const shardingStrategy = new FileBoundaryShardingStrategy()
    const processingEngine = new ProcessingEngine()
    const resultAggregator = new ReviewResultAggregator()
    const workspaceManager = new WorkspaceManager({
      basePath: config.workspace,
      autoCleanup: config.autoCleanup ?? true
    })

    return new ReviewWorkflowProcessor(
      contentSource,
      shardingStrategy,
      processingEngine,
      resultAggregator,
      workspaceManager,
      config
    )
  }

  static createContentSource(identifier: string): IContentSource {
    if (this.isGitCommit(identifier)) {
      return new GitContentSource()
    } else if (this.isADOPR(identifier)) {
      return new ADOContentSource()
    } else {
      throw new Error(`Unsupported source type for identifier: ${identifier}`)
    }
  }

  private static isGitCommit(identifier: string): boolean {
    return /^[a-f0-9]{7,40}$/i.test(identifier) || identifier.startsWith('HEAD')
  }

  private static isADOPR(identifier: string): boolean {
    return identifier.includes('visualstudio.com') && identifier.includes('pullrequest')
  }
}
```

### Step 4.2: Public API

Create `packages/project-workflow/src/index.ts`:

```typescript
// Main exports
export { WorkflowFactory } from './factory/WorkflowFactory.js'

// Workflow processors
export { ReviewWorkflowProcessor } from './review/ReviewWorkflowProcessor.js'

// Core interfaces
export type { IWorkflowProcessor } from './types/WorkflowTypes.js'
export type { IContentSource } from './core/ContentSource.js'
export type { IShardingStrategy } from './core/ShardingStrategy.js'
export type { IProcessingEngine } from './core/ProcessingEngine.js'
export type { IResultAggregator } from './core/ResultAggregator.js'

// Types
export type {
  WorkflowInput,
  WorkflowResult,
  WorkflowConfig,
  WorkflowMetadata,
  ProcessingStatistics
} from './types/WorkflowTypes.js'

export type {
  ReviewInput,
  ReviewResult,
  ReviewConfig,
  ReviewInsight,
  ReviewHunk,
  ReviewComment
} from './types/ReviewTypes.js'

export type {
  SourceContent,
  ContentFile,
  Shard,
  ShardResult
} from './types/SourceTypes.js'

// Enums
export {
  SourceType
} from './types/WorkflowTypes.js'

export {
  SeverityLevel,
  InsightType,
  CommentType,
  RiskLevel
} from './types/ReviewTypes.js'

// Utility functions
export { estimateTokens } from './utils/TokenUtils.js'
export { detectSourceType } from './utils/SourceUtils.js'

// Error types
export {
  WorkflowError,
  ContentSourceError,
  ProcessingError,
  ValidationError
} from './errors/WorkflowErrors.js'
```

### Step 4.3: Testing Infrastructure

Create `packages/project-workflow/src/testing/index.ts`:

```typescript
// Mock implementations for testing
export { MockContentSource } from './mocks/MockContentSource.js'
export { MockProcessingEngine } from './mocks/MockProcessingEngine.js'
export { MockWorkspaceManager } from './mocks/MockWorkspaceManager.js'

// Test utilities
export { createMockReviewResult } from './utils/ReviewTestUtils.js'
export { createMockSourceContent } from './utils/SourceTestUtils.js'

// Test fixtures
export { sampleADOPR } from './fixtures/SampleADOPR.js'
export { sampleGitCommit } from './fixtures/SampleGitCommit.js'
```

### Step 4.4: Migration Script

Create a migration script to update the existing `scripts/sharded-review-parallel.js`:

```typescript
// At the top of the existing script, add:
import { WorkflowFactory, SourceType } from '@opencode/project-workflow'

// Replace the main function logic:
async function runParallelShardedReview(input: string) {
  try {
    const inputType = isADOUrl(input) ? 'ADO PR' : 'Git Commit'
    await log(`🚀 Starting Parallel Sharded Review for ${inputType}: ${input}`)

    // Create workflow using the new module
    const reviewWorkflow = WorkflowFactory.createReviewWorkflow({
      baseUrl: CONFIG.BASE_URL,
      maxParallelSessions: CONFIG.MAX_PARALLEL_SESSIONS,
      optimalTokensPerShard: CONFIG.OPTIMAL_TOKENS_PER_SHARD,
      maxTokensPerShard: CONFIG.MAX_TOKENS_PER_SHARD,
      minTokensPerShard: CONFIG.MIN_TOKENS_PER_SHARD,
      agent: 'code-reviewer',
      timeoutPerShard: CONFIG.TIMEOUT_PER_SHARD
    })

    // Process using the new workflow
    const result = await reviewWorkflow.process({
      identifier: input,
      type: isADOUrl(input) ? SourceType.ADO_PR : SourceType.GIT,
      metadata: {
        saveVersions: true,
        includeComments: true
      }
    })

    // Final summary using result data
    await log('\n🎉 PARALLEL SHARDED REVIEW COMPLETE!')
    await log(`✅ ${inputType}: ${input}`)
    await log(`✅ Workspace: ${result.workspace}`)
    await log(`✅ Shards: ${result.statistics.totalShards} (${result.statistics.successfulShards} successful)`)
    await log(`✅ Processing: Parallel batches of ${CONFIG.MAX_PARALLEL_SESSIONS}`)
    await log(`✅ Comments: ${result.comments.length} generated, ${result.adoComments?.length || 0} existing`)

    return {
      workspace: result.workspace,
      successful: result.statistics.successfulShards,
      total: result.statistics.totalShards,
      result
    }
  } catch (error) {
    await log(`💥 Review failed: ${error.message}`, 'ERROR')
    throw error
  }
}
```

## 🧪 Testing Strategy

### Unit Tests

Create comprehensive unit tests for each component:

```typescript
// packages/project-workflow/test/sources/ADOContentSource.test.ts
import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { ADOContentSource } from '../../src/sources/ADOContentSource.js'

describe('ADOContentSource', () => {
  let contentSource: ADOContentSource

  beforeEach(() => {
    contentSource = new ADOContentSource()
  })

  describe('validateIdentifier', () => {
    it('should validate ADO PR URLs correctly', () => {
      const validUrl = 'https://dev.azure.com/org/project/_git/repo/pullrequest/123'
      expect(contentSource.validateIdentifier(validUrl)).toBe(true)
    })

    it('should reject invalid URLs', () => {
      expect(contentSource.validateIdentifier('invalid-url')).toBe(false)
      expect(contentSource.validateIdentifier('https://github.com/user/repo/pull/123')).toBe(false)
    })
  })

  describe('fetchContent', () => {
    it('should fetch and process ADO PR content', async () => {
      // Mock fetch response
      const mockFetch = mock(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          title: 'Test PR',
          description: 'Test description',
          fileDiffs: {
            'file1.ts': {
              diff: 'test diff content',
              changeType: 'modify'
            }
          }
        })
      }))

      global.fetch = mockFetch

      const result = await contentSource.fetchContent(
        'https://dev.azure.com/org/project/_git/repo/pullrequest/123'
      )

      expect(result.identifier).toBe('https://dev.azure.com/org/project/_git/repo/pullrequest/123')
      expect(result.content.files).toHaveLength(1)
      expect(result.content.files[0].path).toBe('file1.ts')
    })
  })
})
```

### Integration Tests

```typescript
// packages/project-workflow/test/integration/ReviewWorkflow.test.ts
import { describe, it, expect } from 'bun:test'
import { WorkflowFactory } from '../../src/factory/WorkflowFactory.js'
import { SourceType } from '../../src/types/WorkflowTypes.js'

describe('Review Workflow Integration', () => {
  it('should process a complete review workflow', async () => {
    const workflow = WorkflowFactory.createReviewWorkflow({
      baseUrl: 'http://localhost:3000',
      maxParallelSessions: 1,
      optimalTokensPerShard: 5000,
      maxTokensPerShard: 7000,
      minTokensPerShard: 2000,
      agent: 'code-reviewer'
    })

    // This would require a running test server
    // const result = await workflow.process({
    //   identifier: 'test-commit-hash',
    //   type: SourceType.GIT
    // })

    // expect(result.success).toBe(true)
    // expect(result.comments).toBeDefined()
    // expect(result.insights).toBeDefined()
  })
})
```

## 📊 Performance Optimization

### Monitoring and Metrics

Add performance monitoring throughout the workflow:

```typescript
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map()

  startTimer(operation: string): () => void {
    const startTime = performance.now()

    return () => {
      const duration = performance.now() - startTime
      if (!this.metrics.has(operation)) {
        this.metrics.set(operation, [])
      }
      this.metrics.get(operation)!.push(duration)
    }
  }

  getStatistics(operation: string) {
    const durations = this.metrics.get(operation) || []
    if (durations.length === 0) return null

    return {
      count: durations.length,
      average: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      total: durations.reduce((sum, d) => sum + d, 0)
    }
  }
}
```

### Memory Management

Implement streaming and cleanup:

```typescript
export class StreamingWorkspaceManager implements IWorkspaceManager {
  private openStreams: Set<ReadableStream> = new Set()

  async saveContentStream(relativePath: string, stream: ReadableStream): Promise<string> {
    const filePath = path.join(this.workspacePath, relativePath)
    const writeStream = Bun.file(filePath).writer()

    this.openStreams.add(stream)

    try {
      await stream.pipeTo(writeStream)
      return filePath
    } finally {
      this.openStreams.delete(stream)
    }
  }

  async cleanup(): Promise<void> {
    // Close all open streams
    for (const stream of this.openStreams) {
      try {
        await stream.cancel()
      } catch {
        // Ignore errors during cleanup
      }
    }
    this.openStreams.clear()

    // Remove workspace directory
    await super.cleanup()
  }
}
```

This implementation guide provides a comprehensive roadmap for creating the Project Workflow Module while maintaining backward compatibility and enabling future extensibility.