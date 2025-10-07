# Extension Guide

## 🎯 Overview

This guide demonstrates how to extend the Project Workflow Module to support new workflow types beyond the initial review workflow. The module is designed with extensibility as a core principle.

## 🏗️ Adding New Workflow Types

### Design Workflow Example

Let's walk through adding a "Design Workflow" that generates system architecture diagrams and specifications.

### Step 1: Define Design-Specific Types

Create `packages/project-workflow/src/types/DesignTypes.ts`:

```typescript
import type { WorkflowInput, WorkflowResult, WorkflowConfig } from './WorkflowTypes.js'

// Design workflow input
export interface DesignInput extends WorkflowInput {
  type: 'git' | 'ado-pr' | 'requirements'
  requirements?: string[]
  designScope?: DesignScope
  outputFormats?: OutputFormat[]
}

// Design workflow result
export interface DesignResult extends WorkflowResult {
  diagrams: DesignDiagram[]
  specifications: DesignSpecification[]
  recommendations: DesignRecommendation[]
  architecture: ArchitectureOverview
}

// Design workflow configuration
export interface DesignConfig extends WorkflowConfig {
  // Design-specific settings
  diagramFormats: DiagramFormat[]
  architecturePatterns: string[]
  complexityLevel: ComplexityLevel
  includeImplementationGuidance: boolean

  // Agent settings
  agent: string // 'design-architect'
  outputFormat: 'markdown' | 'structured'

  // Analysis depth
  analysisDepth: 'surface' | 'detailed' | 'comprehensive'
}

// Supporting types
export interface DesignDiagram {
  type: DiagramType
  title: string
  content: string
  format: DiagramFormat
  metadata: DiagramMetadata
}

export interface DesignSpecification {
  component: string
  description: string
  interfaces: InterfaceSpec[]
  dependencies: string[]
  constraints: string[]
}

export interface DesignRecommendation {
  category: RecommendationCategory
  priority: Priority
  title: string
  description: string
  implementation: string
  rationale: string
}

export interface ArchitectureOverview {
  summary: string
  components: ComponentOverview[]
  patterns: ArchitecturalPattern[]
  qualityAttributes: QualityAttribute[]
}

// Enums
export enum DesignScope {
  COMPONENT = 'component',
  MODULE = 'module',
  SYSTEM = 'system',
  ENTERPRISE = 'enterprise'
}

export enum DiagramType {
  ARCHITECTURE = 'architecture',
  SEQUENCE = 'sequence',
  COMPONENT = 'component',
  DEPLOYMENT = 'deployment',
  DATA_FLOW = 'data_flow'
}

export enum DiagramFormat {
  MERMAID = 'mermaid',
  PLANTUML = 'plantuml',
  ASCII = 'ascii',
  SVG = 'svg'
}

export enum ComplexityLevel {
  SIMPLE = 'simple',
  MODERATE = 'moderate',
  COMPLEX = 'complex',
  ENTERPRISE = 'enterprise'
}

export enum RecommendationCategory {
  ARCHITECTURE = 'architecture',
  PERFORMANCE = 'performance',
  SECURITY = 'security',
  MAINTAINABILITY = 'maintainability',
  SCALABILITY = 'scalability'
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}
```

### Step 2: Create Design Sharding Strategy

Create `packages/project-workflow/src/design/DesignShardingStrategy.ts`:

```typescript
import type { IShardingStrategy } from '../core/ShardingStrategy.js'
import type { SourceContent, Shard, ShardingConfig } from '../types/SourceTypes.js'

export class ComponentBasedShardingStrategy implements IShardingStrategy {
  async createShards(content: SourceContent, config: ShardingConfig): Promise<Shard[]> {
    const shards: Shard[] = []

    // Group files by architectural components
    const componentGroups = this.groupFilesByComponent(content.content.files)

    let shardIndex = 0
    for (const [componentName, files] of componentGroups) {
      const componentContent = files.map(f => f.content).join('\n\n')
      const totalTokens = files.reduce((sum, f) => sum + f.tokens, 0)

      // If component is too large, split it further
      if (totalTokens > config.targetTokens) {
        const subShards = await this.splitLargeComponent(componentName, files, config)
        for (const subShard of subShards) {
          shards.push({
            ...subShard,
            index: shardIndex++
          })
        }
      } else {
        shards.push({
          index: shardIndex++,
          files,
          content: componentContent,
          tokens: totalTokens,
          metadata: {
            componentName,
            fileCount: files.length,
            strategy: 'component_based'
          }
        })
      }
    }

    return shards
  }

  estimateShardCount(content: SourceContent, config: ShardingConfig): number {
    const componentGroups = this.groupFilesByComponent(content.content.files)
    return componentGroups.size
  }

  validateConfig(config: ShardingConfig): boolean {
    return config.targetTokens > 0 && config.strategy === 'component_based'
  }

  getMetadata() {
    return {
      type: 'component_based',
      version: '1.0.0',
      description: 'Component-aware sharding for design workflows'
    }
  }

  private groupFilesByComponent(files: any[]): Map<string, any[]> {
    const groups = new Map<string, any[]>()

    for (const file of files) {
      const component = this.inferComponentFromPath(file.path)

      if (!groups.has(component)) {
        groups.set(component, [])
      }
      groups.get(component)!.push(file)
    }

    return groups
  }

  private inferComponentFromPath(filePath: string): string {
    // Infer component from file path patterns
    const pathParts = filePath.split('/')

    // Look for common patterns
    if (pathParts.includes('components')) {
      const componentIndex = pathParts.indexOf('components')
      return pathParts[componentIndex + 1] || 'ui-components'
    } else if (pathParts.includes('services')) {
      const serviceIndex = pathParts.indexOf('services')
      return pathParts[serviceIndex + 1] || 'services'
    } else if (pathParts.includes('utils') || pathParts.includes('utilities')) {
      return 'utilities'
    } else if (pathParts.includes('api') || pathParts.includes('routes')) {
      return 'api'
    } else if (pathParts.includes('models') || pathParts.includes('entities')) {
      return 'data-models'
    } else if (pathParts.includes('tests') || pathParts.includes('spec')) {
      return 'tests'
    } else {
      // Default to directory name or core
      return pathParts[pathParts.length - 2] || 'core'
    }
  }

  private async splitLargeComponent(
    componentName: string,
    files: any[],
    config: ShardingConfig
  ): Promise<Partial<Shard>[]> {
    const subShards: Partial<Shard>[] = []
    let currentShard: any[] = []
    let currentTokens = 0

    for (const file of files) {
      if (currentTokens + file.tokens > config.targetTokens && currentShard.length > 0) {
        subShards.push({
          files: currentShard,
          content: currentShard.map(f => f.content).join('\n\n'),
          tokens: currentTokens,
          metadata: {
            componentName,
            subComponent: `${componentName}-${subShards.length + 1}`,
            fileCount: currentShard.length,
            strategy: 'component_based'
          }
        })
        currentShard = []
        currentTokens = 0
      }

      currentShard.push(file)
      currentTokens += file.tokens
    }

    if (currentShard.length > 0) {
      subShards.push({
        files: currentShard,
        content: currentShard.map(f => f.content).join('\n\n'),
        tokens: currentTokens,
        metadata: {
          componentName,
          subComponent: `${componentName}-${subShards.length + 1}`,
          fileCount: currentShard.length,
          strategy: 'component_based'
        }
      })
    }

    return subShards
  }
}
```

### Step 3: Create Design Result Aggregator

Create `packages/project-workflow/src/design/DesignResultAggregator.ts`:

```typescript
import type { IResultAggregator } from '../core/ResultAggregator.js'
import type { DesignResult } from '../types/DesignTypes.js'
import type { ShardResult, SourceMetadata, AggregationConfig } from '../types/SourceTypes.js'

export class DesignResultAggregator implements IResultAggregator<DesignResult> {
  async aggregateResults(
    results: ShardResult[],
    metadata: SourceMetadata,
    config: AggregationConfig
  ): Promise<DesignResult> {
    const successful = results.filter(r => r.success)

    const designResult: DesignResult = {
      success: true,
      metadata: {
        type: 'design',
        version: '1.0.0',
        capabilities: ['architecture_analysis', 'diagram_generation', 'pattern_recognition'],
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        processingTime: results.reduce((sum, r) => sum + r.processingTime, 0)
      },
      statistics: {
        totalShards: results.length,
        successfulShards: successful.length,
        failedShards: results.length - successful.length,
        totalTokens: 0,
        processingTime: results.reduce((sum, r) => sum + r.processingTime, 0),
        averageShardTime: results.reduce((sum, r) => sum + r.processingTime, 0) / results.length
      },
      diagrams: [],
      specifications: [],
      recommendations: [],
      architecture: {
        summary: '',
        components: [],
        patterns: [],
        qualityAttributes: []
      }
    }

    // Parse and aggregate design artifacts from successful shards
    for (const result of successful) {
      if (result.result) {
        const parsed = this.parseDesignOutput(result.result, result.shardIndex)
        designResult.diagrams.push(...parsed.diagrams)
        designResult.specifications.push(...parsed.specifications)
        designResult.recommendations.push(...parsed.recommendations)
      }
    }

    // Generate overall architecture overview
    designResult.architecture = this.generateArchitectureOverview(
      designResult.specifications,
      designResult.recommendations,
      metadata
    )

    // Sort and prioritize recommendations
    designResult.recommendations = this.prioritizeRecommendations(designResult.recommendations)

    return designResult
  }

  validateShardResult(result: ShardResult): boolean {
    return result.success && typeof result.result === 'string' && result.result.length > 0
  }

  getStatistics(results: ShardResult[]) {
    return {
      totalResults: results.length,
      successfulResults: results.filter(r => r.success).length,
      averageProcessingTime: results.reduce((sum, r) => sum + r.processingTime, 0) / results.length,
      totalProcessingTime: results.reduce((sum, r) => sum + r.processingTime, 0)
    }
  }

  private parseDesignOutput(output: string, shardIndex: number) {
    const diagrams: any[] = []
    const specifications: any[] = []
    const recommendations: any[] = []

    // Parse structured design output (assuming markdown format)
    const sections = this.parseSections(output)

    for (const section of sections) {
      switch (section.type) {
        case 'diagram':
          diagrams.push(this.parseDiagram(section, shardIndex))
          break
        case 'specification':
          specifications.push(this.parseSpecification(section, shardIndex))
          break
        case 'recommendation':
          recommendations.push(this.parseRecommendation(section, shardIndex))
          break
      }
    }

    return { diagrams, specifications, recommendations }
  }

  private parseSections(output: string) {
    // Parse markdown sections with headers
    const sections: any[] = []
    const lines = output.split('\n')
    let currentSection: any = null

    for (const line of lines) {
      if (line.startsWith('## ')) {
        if (currentSection) {
          sections.push(currentSection)
        }
        currentSection = {
          type: this.inferSectionType(line),
          title: line.replace('## ', ''),
          content: []
        }
      } else if (currentSection) {
        currentSection.content.push(line)
      }
    }

    if (currentSection) {
      sections.push(currentSection)
    }

    return sections
  }

  private inferSectionType(header: string): string {
    const lower = header.toLowerCase()
    if (lower.includes('diagram') || lower.includes('architecture')) {
      return 'diagram'
    } else if (lower.includes('specification') || lower.includes('component')) {
      return 'specification'
    } else if (lower.includes('recommendation') || lower.includes('suggestion')) {
      return 'recommendation'
    } else {
      return 'general'
    }
  }

  private parseDiagram(section: any, shardIndex: number) {
    return {
      type: this.inferDiagramType(section.title),
      title: section.title,
      content: section.content.join('\n'),
      format: this.inferDiagramFormat(section.content.join('\n')),
      metadata: {
        shard: shardIndex,
        generatedAt: new Date().toISOString()
      }
    }
  }

  private parseSpecification(section: any, shardIndex: number) {
    const content = section.content.join('\n')
    return {
      component: this.extractComponentName(section.title),
      description: this.extractDescription(content),
      interfaces: this.extractInterfaces(content),
      dependencies: this.extractDependencies(content),
      constraints: this.extractConstraints(content),
      metadata: {
        shard: shardIndex,
        generatedAt: new Date().toISOString()
      }
    }
  }

  private parseRecommendation(section: any, shardIndex: number) {
    const content = section.content.join('\n')
    return {
      category: this.inferRecommendationCategory(section.title),
      priority: this.inferPriority(content),
      title: section.title,
      description: this.extractDescription(content),
      implementation: this.extractImplementation(content),
      rationale: this.extractRationale(content),
      metadata: {
        shard: shardIndex,
        generatedAt: new Date().toISOString()
      }
    }
  }

  private generateArchitectureOverview(
    specifications: any[],
    recommendations: any[],
    metadata: SourceMetadata
  ) {
    return {
      summary: this.generateArchitectureSummary(specifications, metadata),
      components: this.generateComponentOverview(specifications),
      patterns: this.identifyArchitecturalPatterns(specifications),
      qualityAttributes: this.extractQualityAttributes(recommendations)
    }
  }

  private prioritizeRecommendations(recommendations: any[]) {
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
    return recommendations.sort((a, b) => {
      const aPriority = priorityOrder[a.priority] || 0
      const bPriority = priorityOrder[b.priority] || 0
      return bPriority - aPriority
    })
  }

  // Helper methods for parsing specific content (implementation details)
  private inferDiagramType(title: string): string {
    const lower = title.toLowerCase()
    if (lower.includes('sequence')) return 'sequence'
    if (lower.includes('component')) return 'component'
    if (lower.includes('deployment')) return 'deployment'
    if (lower.includes('data')) return 'data_flow'
    return 'architecture'
  }

  private inferDiagramFormat(content: string): string {
    if (content.includes('```mermaid')) return 'mermaid'
    if (content.includes('@startuml')) return 'plantuml'
    if (content.includes('<svg')) return 'svg'
    return 'ascii'
  }

  private extractComponentName(title: string): string {
    return title.replace(/^## /, '').replace(/ Specification$/, '')
  }

  private extractDescription(content: string): string {
    const lines = content.split('\n')
    const descriptionLine = lines.find(line => line.trim() && !line.startsWith('#'))
    return descriptionLine?.trim() || ''
  }

  private extractInterfaces(content: string): any[] {
    // Parse interface definitions from content
    return []
  }

  private extractDependencies(content: string): string[] {
    // Parse dependency lists from content
    return []
  }

  private extractConstraints(content: string): string[] {
    // Parse constraint lists from content
    return []
  }

  private inferRecommendationCategory(title: string): string {
    const lower = title.toLowerCase()
    if (lower.includes('security')) return 'security'
    if (lower.includes('performance')) return 'performance'
    if (lower.includes('scalability')) return 'scalability'
    if (lower.includes('maintainability')) return 'maintainability'
    return 'architecture'
  }

  private inferPriority(content: string): string {
    const lower = content.toLowerCase()
    if (lower.includes('critical') || lower.includes('urgent')) return 'critical'
    if (lower.includes('high') || lower.includes('important')) return 'high'
    if (lower.includes('low') || lower.includes('optional')) return 'low'
    return 'medium'
  }

  private extractImplementation(content: string): string {
    // Extract implementation guidance from content
    return ''
  }

  private extractRationale(content: string): string {
    // Extract rationale from content
    return ''
  }

  private generateArchitectureSummary(specifications: any[], metadata: SourceMetadata): string {
    return `Architecture analysis of ${metadata.repository || 'codebase'} with ${specifications.length} components identified.`
  }

  private generateComponentOverview(specifications: any[]): any[] {
    return specifications.map(spec => ({
      name: spec.component,
      description: spec.description,
      interfaces: spec.interfaces.length,
      dependencies: spec.dependencies.length,
      complexity: this.assessComponentComplexity(spec)
    }))
  }

  private identifyArchitecturalPatterns(specifications: any[]): any[] {
    // Analyze specifications to identify common patterns
    return []
  }

  private extractQualityAttributes(recommendations: any[]): any[] {
    const attributes = new Map()

    recommendations.forEach(rec => {
      if (!attributes.has(rec.category)) {
        attributes.set(rec.category, {
          attribute: rec.category,
          score: 0,
          recommendations: 0
        })
      }
      const attr = attributes.get(rec.category)
      attr.recommendations++

      // Calculate score based on priority
      const priorityScore = { critical: 4, high: 3, medium: 2, low: 1 }
      attr.score += priorityScore[rec.priority] || 0
    })

    return Array.from(attributes.values())
  }

  private assessComponentComplexity(spec: any): string {
    const dependencyCount = spec.dependencies.length
    const interfaceCount = spec.interfaces.length

    const complexityScore = dependencyCount + interfaceCount * 2

    if (complexityScore < 3) return 'low'
    if (complexityScore < 7) return 'medium'
    if (complexityScore < 12) return 'high'
    return 'very_high'
  }
}
```

### Step 4: Create Design Workflow Processor

Create `packages/project-workflow/src/design/DesignWorkflowProcessor.ts`:

```typescript
import { WorkflowProcessor } from '../core/WorkflowProcessor.js'
import type { DesignInput, DesignResult, DesignConfig } from '../types/DesignTypes.js'
import type { ShardProcessor } from '../types/SourceTypes.js'

export class DesignWorkflowProcessor extends WorkflowProcessor<DesignInput, DesignResult> {
  constructor(
    contentSource: IContentSource,
    shardingStrategy: IShardingStrategy,
    processingEngine: IProcessingEngine,
    resultAggregator: IResultAggregator<DesignResult>,
    workspaceManager: IWorkspaceManager,
    private config: DesignConfig
  ) {
    super(contentSource, shardingStrategy, processingEngine, resultAggregator, workspaceManager)
  }

  protected createShardProcessor(config: WorkflowConfig): ShardProcessor {
    return new DesignShardProcessor(this.config)
  }

  protected getWorkspacePrefix(): string {
    return 'design'
  }

  validateInput(input: DesignInput): boolean {
    return (
      super.validateInput(input) &&
      this.contentSource.validateIdentifier(input.identifier) &&
      this.validateDesignScope(input.designScope)
    )
  }

  protected getCapabilities(): string[] {
    return [
      'architecture_analysis',
      'diagram_generation',
      'component_identification',
      'pattern_recognition',
      'design_recommendations',
      'specification_generation'
    ]
  }

  private validateDesignScope(scope?: any): boolean {
    if (!scope) return true
    return Object.values(DesignScope).includes(scope)
  }
}

class DesignShardProcessor implements ShardProcessor {
  constructor(private config: DesignConfig) {}

  async processShard(shard: Shard, config: ProcessingConfig): Promise<any> {
    const sessionId = await this.createSession()

    try {
      const prompt = this.buildDesignPrompt(shard)

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

      const responseData = await response.json()

      let designContent = ''
      if (responseData.parts) {
        for (const part of responseData.parts) {
          if (part.type === 'text' && part.text) {
            designContent += part.text
          }
        }
      }

      if (designContent.length === 0) {
        throw new Error('Empty design content received')
      }

      return designContent
    } finally {
      await this.cleanupSession(sessionId)
    }
  }

  private buildDesignPrompt(shard: Shard): string {
    const componentName = shard.metadata.componentName || `Component ${shard.index + 1}`

    return `Please analyze the following codebase component and provide architectural design insights.

**Component**: ${componentName}
**Analysis Depth**: ${this.config.analysisDepth}
**Complexity Level**: ${this.config.complexityLevel}

**Required Output Format**:

## Architecture Diagram
\`\`\`mermaid
// Generate a component diagram showing relationships
\`\`\`

## Component Specification
- **Purpose**: Brief description of component's role
- **Interfaces**: Input/output interfaces
- **Dependencies**: Other components this depends on
- **Constraints**: Technical and business constraints

## Design Recommendations
- **Priority**: [high|medium|low]
- **Category**: [architecture|performance|security|maintainability|scalability]
- **Recommendation**: Specific improvement suggestion
- **Implementation**: How to implement the recommendation
- **Rationale**: Why this recommendation is important

**Code to Analyze**:
\`\`\`
${shard.content}
\`\`\`

Focus on architectural patterns, component relationships, data flow, and potential improvements. ${this.config.includeImplementationGuidance ? 'Include specific implementation guidance.' : ''}

Output should be in markdown format with clear sections.`
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

### Step 5: Update Factory

Update `packages/project-workflow/src/factory/WorkflowFactory.ts`:

```typescript
import { DesignWorkflowProcessor } from '../design/DesignWorkflowProcessor.js'
import { ComponentBasedShardingStrategy } from '../design/DesignShardingStrategy.js'
import { DesignResultAggregator } from '../design/DesignResultAggregator.js'
import type { DesignConfig } from '../types/DesignTypes.js'

export class WorkflowFactory {
  // ... existing review workflow method

  static createDesignWorkflow(config: DesignConfig): DesignWorkflowProcessor {
    const contentSource = this.createContentSource(config.sourceType || 'auto')
    const shardingStrategy = new ComponentBasedShardingStrategy()
    const processingEngine = new ProcessingEngine()
    const resultAggregator = new DesignResultAggregator()
    const workspaceManager = new WorkspaceManager({
      basePath: config.workspace,
      autoCleanup: config.autoCleanup ?? true
    })

    return new DesignWorkflowProcessor(
      contentSource,
      shardingStrategy,
      processingEngine,
      resultAggregator,
      workspaceManager,
      config
    )
  }

  // Factory method for easy workflow type selection
  static createWorkflow(type: 'review' | 'design', config: any) {
    switch (type) {
      case 'review':
        return this.createReviewWorkflow(config)
      case 'design':
        return this.createDesignWorkflow(config)
      default:
        throw new Error(`Unsupported workflow type: ${type}`)
    }
  }
}
```

### Step 6: Update Public API

Update `packages/project-workflow/src/index.ts`:

```typescript
// Add design workflow exports
export { DesignWorkflowProcessor } from './design/DesignWorkflowProcessor.js'
export { ComponentBasedShardingStrategy } from './design/DesignShardingStrategy.js'
export { DesignResultAggregator } from './design/DesignResultAggregator.js'

// Add design types
export type {
  DesignInput,
  DesignResult,
  DesignConfig,
  DesignDiagram,
  DesignSpecification,
  DesignRecommendation,
  ArchitectureOverview
} from './types/DesignTypes.js'

export {
  DesignScope,
  DiagramType,
  DiagramFormat,
  ComplexityLevel,
  RecommendationCategory,
  Priority
} from './types/DesignTypes.js'
```

## 🧩 Adding Custom Content Sources

### GitHub PR Content Source Example

Create `packages/project-workflow/src/sources/GitHubContentSource.ts`:

```typescript
import { ContentSource } from '../core/ContentSource.js'
import type { SourceContent, ContentFetchOptions, GitHubCredentials } from '../types/SourceTypes.js'
import { SourceType } from '../types/WorkflowTypes.js'

export class GitHubContentSource extends ContentSource {
  private credentials: GitHubCredentials

  constructor(credentials?: GitHubCredentials) {
    super()
    this.credentials = credentials || this.getDefaultCredentials()
  }

  validateIdentifier(identifier: string): boolean {
    // GitHub PR URL pattern
    const githubRegex = /https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/
    return githubRegex.test(identifier)
  }

  getSourceType(): SourceType {
    return SourceType.GITHUB_PR
  }

  async fetchContent(identifier: string, options?: ContentFetchOptions): Promise<SourceContent> {
    const prInfo = this.parseGitHubUrl(identifier)
    if (!prInfo) {
      throw new Error('Invalid GitHub PR URL format')
    }

    // Fetch PR data using GitHub API
    const prData = await this.fetchGitHubPullRequest(
      prInfo.owner,
      prInfo.repo,
      prInfo.pullNumber
    )

    // Fetch file diffs
    const files = await this.fetchPRFiles(prInfo.owner, prInfo.repo, prInfo.pullNumber)

    return this.createSourceContent(identifier, {
      source: 'github',
      prId: prInfo.pullNumber,
      owner: prInfo.owner,
      repository: prInfo.repo,
      title: prData.title,
      description: prData.body,
      author: prData.user.login,
      createdDate: prData.created_at,
      sourceBranch: prData.head.ref,
      targetBranch: prData.base.ref
    }, {
      files: files,
      diffs: files.map(f => f.patch).filter(Boolean),
      totalSize: files.reduce((sum, f) => sum + (f.patch?.length || 0), 0),
      totalTokens: files.reduce((sum, f) => sum + this.estimateTokens(f.patch || ''), 0)
    })
  }

  private parseGitHubUrl(url: string) {
    const githubRegex = /https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/
    const match = url.match(githubRegex)

    if (match) {
      return {
        owner: match[1],
        repo: match[2],
        pullNumber: parseInt(match[3])
      }
    }

    return null
  }

  private async fetchGitHubPullRequest(owner: string, repo: string, pullNumber: number) {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}`,
      {
        headers: {
          'Authorization': `token ${this.credentials.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  }

  private async fetchPRFiles(owner: string, repo: string, pullNumber: number) {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/files`,
      {
        headers: {
          'Authorization': `token ${this.credentials.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
    }

    const files = await response.json()

    return files.map((file: any) => ({
      path: file.filename,
      content: file.patch || '',
      size: file.patch?.length || 0,
      tokens: this.estimateTokens(file.patch || ''),
      changeType: this.mapGitHubStatus(file.status)
    }))
  }

  private mapGitHubStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'added': 'add',
      'modified': 'modify',
      'removed': 'delete',
      'renamed': 'rename'
    }
    return statusMap[status] || 'modify'
  }

  private estimateTokens(text: string): number {
    return Math.floor(text.length / 4)
  }

  private getDefaultCredentials(): GitHubCredentials {
    return {
      token: process.env.GITHUB_TOKEN || ''
    }
  }
}
```

## 🔧 Custom Processing Strategies

### Specialized Processing Engine

Create `packages/project-workflow/src/design/DesignProcessingEngine.ts`:

```typescript
import { ProcessingEngine } from '../core/ProcessingEngine.js'
import type { Shard, ShardResult, ProcessingConfig, ShardProcessor } from '../types/SourceTypes.js'

export class DesignProcessingEngine extends ProcessingEngine {
  async processShards(
    shards: Shard[],
    processor: ShardProcessor,
    config: ProcessingConfig
  ): Promise<ShardResult[]> {
    // Override to add design-specific processing logic

    // Pre-process shards for design analysis
    const enrichedShards = await this.enrichShardsWithContext(shards)

    // Process with component-aware batching
    const results = await this.processComponentBatches(enrichedShards, processor, config)

    // Post-process to ensure design consistency
    return await this.validateDesignConsistency(results)
  }

  private async enrichShardsWithContext(shards: Shard[]): Promise<Shard[]> {
    return shards.map(shard => ({
      ...shard,
      metadata: {
        ...shard.metadata,
        designContext: this.inferDesignContext(shard),
        relatedComponents: this.findRelatedComponents(shard, shards)
      }
    }))
  }

  private async processComponentBatches(
    shards: Shard[],
    processor: ShardProcessor,
    config: ProcessingConfig
  ): Promise<ShardResult[]> {
    // Group shards by component for better design coherence
    const componentGroups = this.groupShardsByComponent(shards)
    const results: ShardResult[] = []

    for (const [componentName, componentShards] of componentGroups) {
      console.log(`Processing component: ${componentName}`)

      // Process component shards with shared context
      const componentResults = await super.processShards(componentShards, processor, config)
      results.push(...componentResults)
    }

    return results
  }

  private async validateDesignConsistency(results: ShardResult[]): Promise<ShardResult[]> {
    // Validate that design outputs are consistent across components
    for (const result of results) {
      if (result.success && result.result) {
        result.metadata.designValidation = this.validateDesignOutput(result.result)
      }
    }

    return results
  }

  private inferDesignContext(shard: Shard): any {
    return {
      isAPI: shard.files.some(f => f.path.includes('api') || f.path.includes('routes')),
      isUI: shard.files.some(f => f.path.includes('component') || f.path.includes('ui')),
      isData: shard.files.some(f => f.path.includes('model') || f.path.includes('entity')),
      isUtil: shard.files.some(f => f.path.includes('util') || f.path.includes('helper'))
    }
  }

  private findRelatedComponents(targetShard: Shard, allShards: Shard[]): string[] {
    const relatedComponents: string[] = []
    const targetFiles = new Set(targetShard.files.map(f => f.path))

    for (const shard of allShards) {
      if (shard.index === targetShard.index) continue

      // Look for import/require statements that reference files in target shard
      const hasReferences = shard.files.some(file =>
        targetFiles.has(file.path) || this.hasImportReferences(file.content, targetFiles)
      )

      if (hasReferences && shard.metadata.componentName) {
        relatedComponents.push(shard.metadata.componentName)
      }
    }

    return relatedComponents
  }

  private hasImportReferences(content: string, targetFiles: Set<string>): boolean {
    const importRegex = /(?:import|require)\s*.*?['"`]([^'"`]+)['"`]/g
    let match

    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1]
      if (Array.from(targetFiles).some(file => file.includes(importPath))) {
        return true
      }
    }

    return false
  }

  private groupShardsByComponent(shards: Shard[]): Map<string, Shard[]> {
    const groups = new Map<string, Shard[]>()

    for (const shard of shards) {
      const component = shard.metadata.componentName || 'default'

      if (!groups.has(component)) {
        groups.set(component, [])
      }
      groups.get(component)!.push(shard)
    }

    return groups
  }

  private validateDesignOutput(output: string): any {
    return {
      hasDiagram: output.includes('```mermaid') || output.includes('@startuml'),
      hasSpecification: output.includes('## Component Specification') || output.includes('## Specification'),
      hasRecommendations: output.includes('## Design Recommendations') || output.includes('## Recommendations'),
      wordCount: output.split(/\s+/).length,
      isStructured: this.checkStructuredFormat(output)
    }
  }

  private checkStructuredFormat(output: string): boolean {
    const requiredSections = ['## Architecture Diagram', '## Component Specification', '## Design Recommendations']
    return requiredSections.every(section => output.includes(section))
  }
}
```

## 🧪 Testing New Workflow Types

### Unit Tests for Design Workflow

Create `packages/project-workflow/test/design/DesignWorkflowProcessor.test.ts`:

```typescript
import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { DesignWorkflowProcessor } from '../../src/design/DesignWorkflowProcessor.js'
import { ComponentBasedShardingStrategy } from '../../src/design/DesignShardingStrategy.js'
import { DesignResultAggregator } from '../../src/design/DesignResultAggregator.js'
import { MockContentSource, MockProcessingEngine, MockWorkspaceManager } from '../mocks/index.js'

describe('DesignWorkflowProcessor', () => {
  let processor: DesignWorkflowProcessor

  beforeEach(() => {
    processor = new DesignWorkflowProcessor(
      new MockContentSource(),
      new ComponentBasedShardingStrategy(),
      new MockProcessingEngine(),
      new DesignResultAggregator(),
      new MockWorkspaceManager(),
      {
        baseUrl: 'http://localhost:3000',
        maxParallelSessions: 2,
        timeoutPerShard: 30000,
        diagramFormats: ['mermaid'],
        architecturePatterns: ['mvc', 'microservices'],
        complexityLevel: 'moderate',
        includeImplementationGuidance: true,
        agent: 'design-architect',
        outputFormat: 'markdown',
        analysisDepth: 'detailed'
      }
    )
  })

  describe('validateInput', () => {
    it('should validate design input correctly', () => {
      const validInput = {
        identifier: 'test-component',
        type: 'local' as any,
        designScope: 'component' as any,
        outputFormats: ['mermaid' as any]
      }

      expect(processor.validateInput(validInput)).toBe(true)
    })

    it('should reject invalid design scope', () => {
      const invalidInput = {
        identifier: 'test-component',
        type: 'local' as any,
        designScope: 'invalid' as any
      }

      expect(processor.validateInput(invalidInput)).toBe(false)
    })
  })

  describe('process', () => {
    it('should generate design artifacts', async () => {
      const input = {
        identifier: 'test-repo',
        type: 'local' as any,
        designScope: 'system' as any
      }

      const result = await processor.process(input)

      expect(result.success).toBe(true)
      expect(result.diagrams).toBeDefined()
      expect(result.specifications).toBeDefined()
      expect(result.recommendations).toBeDefined()
      expect(result.architecture).toBeDefined()
    })
  })

  describe('getCapabilities', () => {
    it('should return design-specific capabilities', () => {
      const capabilities = processor.getCapabilities()

      expect(capabilities).toContain('architecture_analysis')
      expect(capabilities).toContain('diagram_generation')
      expect(capabilities).toContain('pattern_recognition')
    })
  })
})
```

### Integration Tests

Create `packages/project-workflow/test/integration/DesignWorkflow.test.ts`:

```typescript
import { describe, it, expect } from 'bun:test'
import { WorkflowFactory } from '../../src/factory/WorkflowFactory.js'

describe('Design Workflow Integration', () => {
  it('should create and process design workflow end-to-end', async () => {
    const workflow = WorkflowFactory.createDesignWorkflow({
      baseUrl: 'http://localhost:3000',
      maxParallelSessions: 1,
      timeoutPerShard: 30000,
      diagramFormats: ['mermaid'],
      architecturePatterns: ['mvc'],
      complexityLevel: 'moderate',
      includeImplementationGuidance: true,
      agent: 'design-architect',
      outputFormat: 'markdown',
      analysisDepth: 'detailed'
    })

    expect(workflow).toBeDefined()
    expect(workflow.getCapabilities()).toContain('architecture_analysis')

    // Note: Full end-to-end test would require running server
    // const result = await workflow.process({
    //   identifier: 'test-codebase',
    //   type: 'local',
    //   designScope: 'component'
    // })
    //
    // expect(result.success).toBe(true)
    // expect(result.diagrams.length).toBeGreaterThan(0)
  })
})
```

## 🚀 Usage Examples

### Using the Design Workflow

```typescript
import { WorkflowFactory, SourceType, DesignScope, ComplexityLevel } from '@opencode/project-workflow'

async function generateSystemDesign() {
  // Create design workflow
  const designWorkflow = WorkflowFactory.createDesignWorkflow({
    baseUrl: 'http://localhost:3000',
    maxParallelSessions: 3,
    timeoutPerShard: 120000,

    // Design-specific configuration
    diagramFormats: ['mermaid', 'plantuml'],
    architecturePatterns: ['microservices', 'mvc', 'clean-architecture'],
    complexityLevel: ComplexityLevel.COMPLEX,
    includeImplementationGuidance: true,

    // Agent settings
    agent: 'design-architect',
    outputFormat: 'markdown',
    analysisDepth: 'comprehensive'
  })

  // Process system design
  const result = await designWorkflow.process({
    identifier: 'https://github.com/company/project/pull/123',
    type: SourceType.GITHUB_PR,
    designScope: DesignScope.SYSTEM,
    requirements: [
      'High availability',
      'Horizontal scalability',
      'Security compliance',
      'Performance optimization'
    ],
    outputFormats: ['mermaid', 'markdown']
  })

  // Use the results
  console.log(`Generated ${result.diagrams.length} architecture diagrams`)
  console.log(`Identified ${result.specifications.length} components`)
  console.log(`Created ${result.recommendations.length} recommendations`)

  // Process diagrams
  for (const diagram of result.diagrams) {
    console.log(`\n## ${diagram.title}`)
    console.log(diagram.content)
  }

  // Process recommendations by priority
  const criticalRecommendations = result.recommendations.filter(r => r.priority === 'critical')
  console.log(`\nCritical recommendations: ${criticalRecommendations.length}`)

  return result
}
```

### Creating a Custom Workflow Type

```typescript
// 1. Define types
interface CustomInput extends WorkflowInput {
  customField: string
}

interface CustomResult extends WorkflowResult {
  customData: any[]
}

// 2. Create processor
class CustomWorkflowProcessor extends WorkflowProcessor<CustomInput, CustomResult> {
  // Implementation...
}

// 3. Add to factory
export class WorkflowFactory {
  static createCustomWorkflow(config: CustomConfig): CustomWorkflowProcessor {
    // Factory implementation...
  }
}

// 4. Use the workflow
const customWorkflow = WorkflowFactory.createCustomWorkflow(config)
const result = await customWorkflow.process(input)
```

This extension guide demonstrates how the modular architecture enables easy addition of new workflow types while maintaining consistency and reusing core components. The pattern can be repeated for any number of workflow types (implementation, testing, deployment, etc.).