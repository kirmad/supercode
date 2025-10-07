# Migration Strategy

## 🎯 Migration Overview

This document outlines the strategy for migrating from the existing `scripts/sharded-review-parallel.js` to the new Project Workflow Module while maintaining backward compatibility and enabling seamless adoption.

## 🚀 Migration Principles

1. **Zero Downtime**: Existing scripts continue to work during migration
2. **Incremental Adoption**: Components can be migrated piece by piece
3. **Backward Compatibility**: Original API remains functional
4. **Risk Mitigation**: Rollback capability at each phase
5. **Performance Preservation**: Maintain or improve existing performance

## 📅 Migration Timeline

### Phase 1: Foundation (Week 1-2)
- Create module structure and core interfaces
- Set up build and test infrastructure
- Implement basic type definitions
- Create development environment

### Phase 2: Core Implementation (Week 3-4)
- Extract and implement content source abstractions
- Build sharding strategies
- Develop processing engine
- Create workspace management

### Phase 3: Review Workflow (Week 5-6)
- Implement review-specific components
- Extract XML parsing and aggregation logic
- Create review workflow processor
- Add comprehensive testing

### Phase 4: Integration & Migration (Week 7-8)
- Create factory and public API
- Migrate existing script to use new module
- Update VSCode extension integration
- Performance testing and optimization

### Phase 5: Extension & Cleanup (Week 9-10)
- Add new workflow types (design, implement)
- Remove deprecated code
- Documentation and training
- Production deployment

## 🔄 Detailed Migration Steps

### Step 1: Parallel Development

**Objective**: Create new module alongside existing script without breaking changes.

**Actions**:
```bash
# Create new module structure
mkdir -p packages/project-workflow
cd packages/project-workflow

# Initialize package.json
npm init -y

# Set up TypeScript configuration
touch tsconfig.json

# Create source structure
mkdir -p src/{core,review,sources,types,factory}
mkdir -p test/{unit,integration}
mkdir -p docs
```

**Validation**:
- ✅ New module builds successfully
- ✅ Existing script continues to work unchanged
- ✅ No impact on production systems

### Step 2: Extract ADO Integration

**Objective**: Move ADO API logic to reusable content source.

**Current State** (in `scripts/sharded-review-parallel.js`):
```javascript
async function fetchADOPullRequest(organization, project, repository, pullRequestId, saveDirectory) {
  // 100+ lines of ADO-specific logic
}

function parseADOUrl(url) {
  // URL parsing logic
}

function getADOCredentials() {
  // Credential management
}
```

**Target State** (new `packages/project-workflow/src/sources/ADOContentSource.ts`):
```typescript
export class ADOContentSource implements IContentSource {
  async fetchContent(identifier: string, options?: ContentFetchOptions): Promise<SourceContent>
  validateIdentifier(identifier: string): boolean
  getSourceType(): SourceType
}
```

**Migration Process**:
1. Copy ADO logic to new ADOContentSource class
2. Adapt to use interface contracts
3. Add type safety and error handling
4. Create unit tests for new implementation
5. Update original script to use new class (optional for this phase)

**Validation**:
- ✅ ADOContentSource passes all tests
- ✅ Can fetch same data as original implementation
- ✅ Performance is equivalent or better

### Step 3: Extract Sharding Logic

**Objective**: Move intelligent sharding to reusable strategy.

**Current State**:
```javascript
// Smart sharding based on file boundaries and token limits (lines 228-260)
const targetTokensPerShard = CONFIG.OPTIMAL_TOKENS_PER_SHARD;
const shards = [];
let currentShard = [];
let currentShardTokens = 0;
// ... complex sharding logic
```

**Target State**:
```typescript
export class FileBoundaryShardingStrategy implements IShardingStrategy {
  async createShards(content: SourceContent, config: ShardingConfig): Promise<Shard[]>
  estimateShardCount(content: SourceContent, config: ShardingConfig): number
}
```

**Migration Process**:
1. Extract sharding algorithm from original script
2. Implement IShardingStrategy interface
3. Add configuration validation
4. Create comprehensive tests with various content sizes
5. Ensure identical shard creation to original

**Validation**:
- ✅ Produces identical shards to original algorithm
- ✅ Handles edge cases (empty files, large files, etc.)
- ✅ Configuration validation works correctly

### Step 4: Extract Processing Engine

**Objective**: Move parallel processing logic to reusable engine.

**Current State**:
```javascript
async function processShardsBatched(workspace, shards) {
  // Batched parallel processing with session management
}

async function generateShardXMLWithSession(workspace, shardIndex) {
  // Individual shard processing with cleanup
}
```

**Target State**:
```typescript
export class ProcessingEngine implements IProcessingEngine {
  async processShards(shards: Shard[], processor: ShardProcessor, config: ProcessingConfig): Promise<ShardResult[]>
  getStatus(): ProcessingStatus
  cancel(): Promise<void>
}
```

**Migration Process**:
1. Extract session management logic
2. Implement batching and parallel processing
3. Add retry logic and error handling
4. Create cancellation support
5. Add progress monitoring

**Validation**:
- ✅ Identical performance to original implementation
- ✅ Proper error handling and recovery
- ✅ Session cleanup works correctly
- ✅ Resource usage within acceptable limits

### Step 5: Extract Result Aggregation

**Objective**: Move XML parsing and JSON aggregation to reusable aggregator.

**Current State**:
```javascript
function parseXMLToJSON(xmlContent, shardIndex) {
  // Complex XML parsing with regex patterns
}

async function aggregateResults(workspace, results, indexData) {
  // Result combination and threading
}
```

**Target State**:
```typescript
export class ReviewResultAggregator implements IResultAggregator<ReviewResult> {
  async aggregateResults(results: ShardResult[], metadata: SourceMetadata, config: AggregationConfig): Promise<ReviewResult>
  validateShardResult(result: ShardResult): boolean
}
```

**Migration Process**:
1. Extract XML parsing patterns
2. Implement comment threading logic
3. Add result validation
4. Create comprehensive test cases with various XML formats
5. Ensure output format compatibility

**Validation**:
- ✅ Produces identical JSON output to original
- ✅ Comment threading works correctly
- ✅ Handles malformed XML gracefully
- ✅ Statistics calculation is accurate

### Step 6: Create Unified Workflow

**Objective**: Combine all components into cohesive workflow processor.

**Current State**:
```javascript
async function runParallelShardedReview(input) {
  // 200+ lines orchestrating the entire workflow
}
```

**Target State**:
```typescript
export class ReviewWorkflowProcessor extends WorkflowProcessor<ReviewInput, ReviewResult> {
  async process(input: ReviewInput, config: WorkflowConfig): Promise<ReviewResult>
}

export class WorkflowFactory {
  static createReviewWorkflow(config: ReviewConfig): ReviewWorkflowProcessor
}
```

**Migration Process**:
1. Create base WorkflowProcessor class
2. Implement ReviewWorkflowProcessor
3. Create WorkflowFactory for easy instantiation
4. Add configuration validation and defaults
5. Implement comprehensive error handling

**Validation**:
- ✅ End-to-end workflow produces identical results
- ✅ Configuration is properly validated
- ✅ Error handling is comprehensive
- ✅ Performance meets or exceeds original

### Step 7: Update Existing Script

**Objective**: Migrate original script to use new module.

**Current Implementation**:
```javascript
// scripts/sharded-review-parallel.js (850+ lines)
// All logic embedded in single file
```

**Target Implementation**:
```javascript
// scripts/sharded-review-parallel.js (simplified)
import { WorkflowFactory, SourceType } from '@opencode/project-workflow'

async function runParallelShardedReview(input) {
  const reviewWorkflow = WorkflowFactory.createReviewWorkflow({
    baseUrl: CONFIG.BASE_URL,
    maxParallelSessions: CONFIG.MAX_PARALLEL_SESSIONS,
    optimalTokensPerShard: CONFIG.OPTIMAL_TOKENS_PER_SHARD,
    // ... other config
  })

  const result = await reviewWorkflow.process({
    identifier: input,
    type: isADOUrl(input) ? SourceType.ADO_PR : SourceType.GIT
  })

  return result
}
```

**Migration Process**:
1. Add dependency on new module
2. Replace internal logic with module calls
3. Maintain CLI interface compatibility
4. Add feature flags for rollback capability
5. Update logging and error handling

**Validation**:
- ✅ CLI interface remains identical
- ✅ Output format is unchanged
- ✅ Performance is equivalent or better
- ✅ Error messages are preserved or improved

## 🧪 Testing Strategy

### Regression Testing

**Test Matrix**:
| Test Case | Original Script | New Module | Validation |
|-----------|----------------|------------|------------|
| ADO PR processing | ✅ | ✅ | Output comparison |
| Git commit processing | ✅ | ✅ | Output comparison |
| Large file handling | ✅ | ✅ | Performance metrics |
| Error scenarios | ✅ | ✅ | Error consistency |
| Parallel processing | ✅ | ✅ | Resource usage |

**Automated Validation**:
```bash
# Run comparison tests
npm run test:migration

# Performance benchmarks
npm run benchmark:compare

# Memory usage comparison
npm run test:memory
```

### A/B Testing Framework

Deploy both implementations in parallel to compare results:

```typescript
// A/B testing configuration
const TEST_CONFIG = {
  enable: process.env.AB_TEST_ENABLED === 'true',
  trafficSplit: 0.1, // 10% to new implementation
  comparisonMetrics: [
    'processing_time',
    'memory_usage',
    'success_rate',
    'output_similarity'
  ]
}

async function runABTest(input: string) {
  if (!TEST_CONFIG.enable) {
    return await runOriginalImplementation(input)
  }

  const useNewImplementation = Math.random() < TEST_CONFIG.trafficSplit

  if (useNewImplementation) {
    try {
      const result = await runNewImplementation(input)
      // Log success metrics
      return result
    } catch (error) {
      // Fallback to original on error
      logger.warn('New implementation failed, falling back', { error })
      return await runOriginalImplementation(input)
    }
  } else {
    return await runOriginalImplementation(input)
  }
}
```

## 🔄 VSCode Extension Integration

### Current Integration

The VSCode extension currently uses the CLI script:

```typescript
// In vscode-webview
import { exec } from 'child_process'

async function runReview(prUrl: string) {
  return new Promise((resolve, reject) => {
    exec(`node scripts/sharded-review-parallel.js ${prUrl}`, (error, stdout) => {
      if (error) reject(error)
      else resolve(JSON.parse(stdout))
    })
  })
}
```

### Target Integration

Direct module usage for better performance and error handling:

```typescript
// In vscode-webview
import { WorkflowFactory, SourceType } from '@opencode/project-workflow'

class ReviewService {
  private workflow = WorkflowFactory.createReviewWorkflow({
    baseUrl: this.config.apiUrl,
    maxParallelSessions: 3,
    optimalTokensPerShard: 7000,
    agent: 'code-reviewer'
  })

  async runReview(prUrl: string): Promise<ReviewResult> {
    return await this.workflow.process({
      identifier: prUrl,
      type: SourceType.ADO_PR,
      metadata: {
        includeComments: true,
        saveVersions: true
      }
    })
  }

  async cancelReview(): Promise<void> {
    // Direct cancellation support
    await this.workflow.cancel()
  }

  getReviewProgress(): ProcessingStatus {
    // Real-time progress monitoring
    return this.workflow.getStatus()
  }
}
```

### Migration Process

1. **Phase 1**: Keep existing CLI integration, add new module as optional
2. **Phase 2**: Add feature flag to switch between implementations
3. **Phase 3**: Enable A/B testing with metrics collection
4. **Phase 4**: Full migration to direct module usage
5. **Phase 5**: Remove CLI integration and feature flags

## 📊 Performance Migration

### Performance Benchmarks

Establish baseline performance metrics:

```typescript
interface PerformanceBenchmark {
  scenario: string
  fileCount: number
  totalTokens: number
  originalTime: number
  newTime: number
  memoryUsage: number
  successRate: number
}

const BENCHMARK_SCENARIOS: PerformanceBenchmark[] = [
  {
    scenario: 'small_pr',
    fileCount: 5,
    totalTokens: 15000,
    originalTime: 0, // To be measured
    newTime: 0,
    memoryUsage: 0,
    successRate: 0
  },
  {
    scenario: 'medium_pr',
    fileCount: 25,
    totalTokens: 75000,
    originalTime: 0,
    newTime: 0,
    memoryUsage: 0,
    successRate: 0
  },
  {
    scenario: 'large_pr',
    fileCount: 100,
    totalTokens: 300000,
    originalTime: 0,
    newTime: 0,
    memoryUsage: 0,
    successRate: 0
  }
]
```

### Performance Validation Gates

Each migration phase must meet performance criteria:

```typescript
const PERFORMANCE_GATES = {
  processingTime: {
    degradationThreshold: 0.1, // Max 10% slower
    improvementTarget: 0.05    // Target 5% improvement
  },
  memoryUsage: {
    maxIncrease: 0.2,          // Max 20% memory increase
    target: -0.1               // Target 10% reduction
  },
  successRate: {
    minimum: 0.99              // Min 99% success rate
  }
}

function validatePerformance(original: Metrics, new: Metrics): ValidationResult {
  const results = {
    passed: true,
    violations: [] as string[]
  }

  // Check processing time
  const timeChange = (new.processingTime - original.processingTime) / original.processingTime
  if (timeChange > PERFORMANCE_GATES.processingTime.degradationThreshold) {
    results.passed = false
    results.violations.push(`Processing time increased by ${(timeChange * 100).toFixed(1)}%`)
  }

  // Check memory usage
  const memoryChange = (new.memoryUsage - original.memoryUsage) / original.memoryUsage
  if (memoryChange > PERFORMANCE_GATES.memoryUsage.maxIncrease) {
    results.passed = false
    results.violations.push(`Memory usage increased by ${(memoryChange * 100).toFixed(1)}%`)
  }

  // Check success rate
  if (new.successRate < PERFORMANCE_GATES.successRate.minimum) {
    results.passed = false
    results.violations.push(`Success rate ${(new.successRate * 100).toFixed(1)}% below minimum`)
  }

  return results
}
```

## 🚨 Risk Mitigation

### Rollback Strategy

**Immediate Rollback** (< 5 minutes):
```bash
# Feature flag rollback
export USE_NEW_WORKFLOW=false

# Package version rollback
npm install @opencode/project-workflow@previous-version

# Environment variable rollback
export WORKFLOW_IMPLEMENTATION=original
```

**Systematic Rollback** (< 30 minutes):
1. Disable new module in configuration
2. Restart affected services
3. Validate system functionality
4. Monitor error rates and performance

### Risk Assessment Matrix

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Performance degradation | Medium | High | A/B testing, performance gates |
| Output format changes | Low | High | Comprehensive regression tests |
| Memory leaks | Low | Medium | Memory monitoring, automated tests |
| Integration failures | Medium | Medium | Staged rollout, feature flags |
| Data corruption | Very Low | Very High | Read-only operations, validation |

### Monitoring and Alerts

```typescript
const MIGRATION_ALERTS = {
  errorRate: {
    threshold: 0.01,  // 1% error rate
    action: 'immediate_rollback'
  },
  performanceDegradation: {
    threshold: 0.2,   // 20% slower
    action: 'investigate_and_rollback'
  },
  memoryLeak: {
    threshold: 1.5,   // 50% memory increase
    action: 'immediate_rollback'
  }
}

function setupMigrationMonitoring() {
  // Error rate monitoring
  setInterval(() => {
    const errorRate = getErrorRate()
    if (errorRate > MIGRATION_ALERTS.errorRate.threshold) {
      triggerAlert('HIGH_ERROR_RATE', { errorRate })
      if (MIGRATION_ALERTS.errorRate.action === 'immediate_rollback') {
        initiateRollback()
      }
    }
  }, 60000) // Check every minute

  // Performance monitoring
  setInterval(() => {
    const currentPerf = getCurrentPerformance()
    const baselinePerf = getBaselinePerformance()
    const degradation = (currentPerf - baselinePerf) / baselinePerf

    if (degradation > MIGRATION_ALERTS.performanceDegradation.threshold) {
      triggerAlert('PERFORMANCE_DEGRADATION', { degradation })
    }
  }, 300000) // Check every 5 minutes
}
```

## 📈 Success Metrics

### Migration Success Criteria

**Technical Metrics**:
- ✅ Zero data loss during migration
- ✅ ≤ 5% performance degradation
- ✅ ≥ 99% functional compatibility
- ✅ 100% test coverage for migrated components
- ✅ Zero critical bugs in production

**Business Metrics**:
- ✅ No user-facing service interruptions
- ✅ Maintained review quality and accuracy
- ✅ Improved development velocity for new features
- ✅ Reduced technical debt and maintenance burden

**Quality Metrics**:
- ✅ Code coverage ≥ 90%
- ✅ Documentation completeness ≥ 95%
- ✅ Performance test coverage ≥ 80%
- ✅ Security review passed
- ✅ Accessibility compliance maintained

### Post-Migration Validation

**30-Day Validation Period**:
- Monitor all metrics daily
- Weekly performance reviews
- User feedback collection
- Bug tracking and resolution
- Performance optimization opportunities

**Success Declaration Criteria**:
1. All technical metrics met for 30 consecutive days
2. No critical issues reported
3. Performance is stable or improved
4. Development team feedback is positive
5. No rollback requests from stakeholders

## 🎓 Training and Documentation

### Developer Training Plan

**Week 1**: Introduction to new architecture
- Overview of module design principles
- Interface-based development concepts
- Factory pattern usage

**Week 2**: Hands-on development
- Creating new workflow types
- Extending existing components
- Testing strategies and best practices

**Week 3**: Advanced topics
- Performance optimization techniques
- Error handling and debugging
- Production deployment considerations

### Documentation Updates

1. **API Documentation**: Complete reference with examples
2. **Architecture Guide**: Design decisions and patterns
3. **Migration Guide**: Step-by-step migration instructions
4. **Troubleshooting Guide**: Common issues and solutions
5. **Performance Guide**: Optimization techniques and monitoring

This migration strategy ensures a smooth transition from the existing script to the new modular architecture while maintaining system reliability and enabling future extensibility.