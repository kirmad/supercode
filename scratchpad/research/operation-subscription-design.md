# Operation Subscription System Design

## 📋 Overview

Based on comprehensive research of vscode-webview patterns and project-workflow architecture, this document outlines the design for an Operation Subscription system that enables real-time monitoring of workflow operations through WebSocket communication.

## 🎯 Requirements Summary

1. **Topic Subscription**: Subscribe/unsubscribe to topics with XML tag filtering
2. **Session Management**: Add/remove sessionIds to/from topics
3. **WebSocket Communication**: Listen to SuperCode agent responses via WebSocket
4. **XML Tag Processing**: Parse and aggregate XML tags across sessions
5. **De-duplication**: Send only new/changed data to subscribers
6. **Workflow Integration**: Use workflow ID as topic ID, auto-subscribe sessions
7. **Review Workflow Support**: Stream `review-insight`, `hunk`, `comment` tags

## 🏗️ Architecture Design

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Operation Subscription                   │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │ Subscription    │  │   WebSocket     │  │    XML      │  │
│  │   Manager       │◄─┤   Listener      │◄─┤   Parser    │  │
│  └─────────────────┘  └─────────────────┘  └─────────────┘  │
│           │                     │                   │       │
│           ▼                     ▼                   ▼       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐  │
│  │    Topic        │  │    Session      │  │    Data     │  │
│  │   Registry      │  │   Tracker       │  │ Aggregator  │  │
│  └─────────────────┘  └─────────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   Subscriber    │
                    │   Callbacks     │
                    └─────────────────┘
```

### 1. Core Interface Design

```typescript
// src/core/interfaces.ts - Add this interface
export interface IOperationSubscriber {
  // Primary subscription methods
  subscribe(topicId: string, tags: string[], callback: OperationCallback): string
  unsubscribe(subscriptionId: string): boolean

  // Session management
  addSessionToTopic(topicId: string, sessionId: string): void
  removeSessionFromTopic(topicId: string, sessionId: string): void

  // Lifecycle management
  startListening(): Promise<void>
  stopListening(): void

  // Status and debugging
  getActiveSubscriptions(): SubscriptionInfo[]
  getTopicSessions(topicId: string): string[]
  isListening(): boolean
}
```

### 2. Type System Design

```typescript
// src/types/index.ts - Add these types

export interface OperationSubscription {
  id: string                    // Unique subscription ID
  topicId: string              // Workflow/operation ID
  tags: string[]               // XML tags to monitor
  callback: OperationCallback  // Notification callback
  createdAt: string           // ISO timestamp
  isActive: boolean           // Subscription status
}

export interface SubscriptionConfig {
  baseUrl: string              // SuperCode server URL
  reconnectInterval?: number   // WebSocket reconnect interval (ms)
  maxRetries?: number         // Max reconnection attempts
  enableLogging?: boolean     // Enable debug logging
  heartbeatInterval?: number  // WebSocket ping interval (ms)
}

export interface TopicRegistry {
  [topicId: string]: {
    sessions: Set<string>                    // Active session IDs
    subscriptions: Map<string, OperationSubscription>  // Active subscriptions
    aggregatedData: ExtractedTagData        // Current aggregated data
    lastUpdate: string                      // Last update timestamp
  }
}

export interface ExtractedTagData {
  [tagName: string]: string[]  // Tag name -> array of unique values
}

export interface SubscriptionInfo {
  id: string
  topicId: string
  tags: string[]
  sessionCount: number
  dataCount: number
  lastUpdate: string
}

export type OperationCallback = (data: ExtractedTagData, metadata: NotificationMetadata) => void

export interface NotificationMetadata {
  topicId: string
  sessionId?: string
  timestamp: string
  source: 'partial' | 'complete'
  hasNewData: boolean
}

// WebSocket integration types
export interface WebSocketConfig {
  url: string
  sessionId?: string
  directory?: string
  autoReconnect?: boolean
  reconnectDelay?: number
  maxReconnectAttempts?: number
  heartbeatInterval?: number
}

// Message processing types
export interface ProcessedMessage {
  sessionId: string
  role: 'assistant' | 'user' | 'system'
  content: string
  isPartial: boolean
  timestamp: string
}
```

### 3. Implementation Strategy

#### A. WebSocket Client Integration
```typescript
// src/core/operation-subscriber.ts - Core implementation
export class OperationSubscriber implements IOperationSubscriber {
  private wsClient: WebSocketClient
  private subscriptions = new Map<string, OperationSubscription>()
  private topics: TopicRegistry = {}
  private xmlParser: XMLTagParser
  private logger: Logger
  private isActive = false

  constructor(private config: SubscriptionConfig) {
    this.logger = createLogger('OperationSubscriber')
    this.xmlParser = new XMLTagParser(this.logger)
    this.initializeWebSocketClient()
  }

  private initializeWebSocketClient(): void {
    const wsUrl = `ws://localhost:${this.extractPort(this.config.baseUrl)}`
    this.wsClient = new WebSocketClient({
      url: wsUrl,
      autoReconnect: true,
      reconnectDelay: this.config.reconnectInterval || 1000,
      maxReconnectAttempts: this.config.maxRetries || 10,
      heartbeatInterval: this.config.heartbeatInterval || 30000,
    })
  }
}
```

#### B. Message Processing Pipeline
```typescript
private async handleWebSocketEvent(eventData: { event: string; data: any }): Promise<void> {
  try {
    // 1. Convert to standardized message format
    const processedMessage = this.convertToProcessedMessage(eventData)

    // 2. Filter agent messages only
    if (!this.isAgentMessage(processedMessage)) {
      return
    }

    // 3. Find relevant topics for this session
    const relevantTopics = this.findTopicsForSession(processedMessage.sessionId)

    // 4. Process each relevant topic
    for (const topicId of relevantTopics) {
      await this.processTopicMessage(topicId, processedMessage)
    }
  } catch (error) {
    this.logger.error('Error processing WebSocket event', { error, eventData })
  }
}

private async processTopicMessage(topicId: string, message: ProcessedMessage): Promise<void> {
  const topic = this.topics[topicId]
  if (!topic) return

  // Extract XML tags for this topic
  const newTagData = this.xmlParser.extractTags(message.content, this.getTopicTags(topicId))

  // Aggregate with existing data
  const aggregatedData = this.aggregateTagData(topic.aggregatedData, newTagData)

  // Check if there's new data
  const hasNewData = this.hasNewData(topic.aggregatedData, aggregatedData)

  if (hasNewData) {
    // Update topic data
    topic.aggregatedData = aggregatedData
    topic.lastUpdate = new Date().toISOString()

    // Notify all subscribers
    this.notifyTopicSubscribers(topicId, aggregatedData, {
      topicId,
      sessionId: message.sessionId,
      timestamp: message.timestamp,
      source: message.isPartial ? 'partial' : 'complete',
      hasNewData: true
    })
  }
}
```

#### C. XML Tag Processing
```typescript
export class XMLTagParser {
  constructor(private logger: Logger) {}

  extractTags(content: string, tags: string[]): ExtractedTagData {
    const result: ExtractedTagData = {}

    for (const tag of tags) {
      const matches = this.parseXMLTag(content, tag)
      if (matches.length > 0) {
        result[tag] = matches
      }
    }

    return result
  }

  private parseXMLTag(content: string, tagName: string): string[] {
    // Handle both self-closing and paired tags
    const regex = new RegExp(
      `<${tagName}(?:\\s[^>]*)?(?:/>|>([\\s\\S]*?)<\\/${tagName}>)`,
      'g'
    )

    const matches: string[] = []
    let match: RegExpExecArray | null

    while ((match = regex.exec(content)) !== null) {
      // For self-closing tags, content might be in attributes
      // For paired tags, content is in match[1]
      const tagContent = match[1] || this.extractAttributeContent(match[0])

      if (tagContent && tagContent.trim()) {
        matches.push(tagContent.trim())
      }
    }

    return matches
  }

  private extractAttributeContent(tagMatch: string): string {
    // Extract content from attributes if it's a self-closing tag
    const contentMatch = tagMatch.match(/content=["']([^"']+)["']/)
    return contentMatch ? contentMatch[1] : ''
  }
}
```

#### D. Data Aggregation with De-duplication
```typescript
private aggregateTagData(existing: ExtractedTagData, newData: ExtractedTagData): ExtractedTagData {
  const result: ExtractedTagData = { ...existing }

  for (const [tag, values] of Object.entries(newData)) {
    if (result[tag]) {
      // Merge and deduplicate
      const combined = [...result[tag], ...values]
      result[tag] = Array.from(new Set(combined))
    } else {
      result[tag] = [...values]
    }
  }

  return result
}

private hasNewData(oldData: ExtractedTagData, newData: ExtractedTagData): boolean {
  for (const [tag, values] of Object.entries(newData)) {
    const oldValues = oldData[tag] || []

    // Check if any new values were added
    if (values.length !== oldValues.length) {
      return true
    }

    // Check if any values are different (order doesn't matter)
    const oldSet = new Set(oldValues)
    const hasNewValue = values.some(value => !oldSet.has(value))

    if (hasNewValue) {
      return true
    }
  }

  return false
}
```

## 🔧 Integration Points

### 1. Factory Integration
```typescript
// src/core/workflow-factory.ts - Extend existing factory
export class WorkflowFactory {
  private operationSubscriber?: IOperationSubscriber

  createOperationSubscriber(config?: Partial<SubscriptionConfig>): IOperationSubscriber {
    if (!this.operationSubscriber) {
      const fullConfig: SubscriptionConfig = {
        baseUrl: this.config.baseUrl || 'http://localhost:3000',
        reconnectInterval: 1000,
        maxRetries: 10,
        enableLogging: true,
        heartbeatInterval: 30000,
        ...config
      }

      this.operationSubscriber = new OperationSubscriber(fullConfig)
    }

    return this.operationSubscriber
  }
}
```

### 2. Workflow Processor Integration
```typescript
// src/review/review-workflow-processor.ts - Extend for review workflow
export class ReviewWorkflowProcessor implements IWorkflowProcessor<ReviewInput, ReviewResult> {
  async process(input: ReviewInput, config?: Partial<WorkflowConfig>): Promise<ReviewResult> {
    const workflowId = generateId('review-workflow')
    let subscriptionId: string | undefined

    try {
      // Set up operation subscription if enabled
      if (config?.operationSubscription?.enabled) {
        const subscriber = this.factory.createOperationSubscriber()
        await subscriber.startListening()

        subscriptionId = subscriber.subscribe(
          workflowId,
          config.operationSubscription.tags || ['review-insight', 'hunk', 'comment'],
          (data, metadata) => {
            this.handleRealtimeUpdates(data, metadata)
          }
        )
      }

      // Enhanced session processing with topic registration
      const engine = this.factory.createSessionProcessingEngine({
        ...this.sessionConfig,
        operationSubscriber: this.factory.createOperationSubscriber(),
        topicId: workflowId
      })

      // Process workflow...
      const result = await this.processWorkflow(input, config, workflowId)

      return result
    } finally {
      // Clean up subscription
      if (subscriptionId) {
        const subscriber = this.factory.createOperationSubscriber()
        subscriber.unsubscribe(subscriptionId)
      }
    }
  }

  private handleRealtimeUpdates(data: ExtractedTagData, metadata: NotificationMetadata): void {
    this.logger.info('Real-time operation update', {
      topicId: metadata.topicId,
      tagCounts: Object.fromEntries(
        Object.entries(data).map(([tag, values]) => [tag, values.length])
      ),
      hasNewData: metadata.hasNewData,
      source: metadata.source
    })
  }
}
```

### 3. Session Engine Integration
```typescript
// src/review/session-processing-engine.ts - Extend for automatic session registration
export class SessionProcessingEngine implements IProcessingEngine {
  private operationSubscriber?: IOperationSubscriber
  private topicId?: string

  constructor(
    config: SessionConfig & {
      operationSubscriber?: IOperationSubscriber
      topicId?: string
    }
  ) {
    // ... existing initialization
    this.operationSubscriber = config.operationSubscriber
    this.topicId = config.topicId
  }

  protected async createSession(shardIndex: number): Promise<string> {
    const sessionId = await super.createSession(shardIndex)

    // Auto-register session with topic
    if (this.operationSubscriber && this.topicId) {
      this.operationSubscriber.addSessionToTopic(this.topicId, sessionId)
    }

    return sessionId
  }

  protected async cleanupSession(sessionId: string): Promise<void> {
    // Auto-deregister session from topic
    if (this.operationSubscriber && this.topicId) {
      this.operationSubscriber.removeSessionFromTopic(this.topicId, sessionId)
    }

    await super.cleanupSession(sessionId)
  }
}
```

## 🧪 Testing Strategy

### 1. Unit Tests
```typescript
// test/core/operation-subscriber.test.ts
describe('OperationSubscriber', () => {
  let subscriber: OperationSubscriber
  let mockWebSocketClient: jest.Mocked<WebSocketClient>

  beforeEach(() => {
    mockWebSocketClient = createMockWebSocketClient()
    subscriber = new OperationSubscriber({
      baseUrl: 'http://localhost:3000',
      enableLogging: false
    })
  })

  test('should subscribe to topic with tags', () => {
    const callback = jest.fn()
    const subscriptionId = subscriber.subscribe('topic1', ['tag1', 'tag2'], callback)

    expect(subscriptionId).toBeDefined()
    expect(subscriber.getActiveSubscriptions()).toHaveLength(1)
  })

  test('should aggregate XML tags across sessions', async () => {
    // Test XML parsing and aggregation logic
  })

  test('should only notify when new data is available', async () => {
    // Test de-duplication logic
  })
})
```

### 2. Integration Tests
```typescript
// test/integration/operation-subscription-e2e.test.ts
describe('Operation Subscription E2E', () => {
  test('should receive real-time updates during review workflow', async () => {
    // Test with actual workflow and WebSocket server
  })
})
```

## 📝 Implementation Plan

1. **Core Types** - Add interfaces and types to existing files
2. **XML Parser** - Implement robust XML parsing with streaming support
3. **WebSocket Client** - Adapt SuperCodeWebSocketClient patterns
4. **Operation Subscriber** - Main class implementation
5. **Factory Integration** - Extend existing factory pattern
6. **Workflow Integration** - Add to review processor and session engine
7. **Testing** - Comprehensive unit and integration tests
8. **Manual Testing** - Update test script for validation

## 🎯 Success Criteria

- ✅ Real-time XML tag streaming from agent responses
- ✅ Proper de-duplication of tag data across sessions
- ✅ Automatic session registration with workflow topics
- ✅ Clean integration with existing architecture
- ✅ Comprehensive test coverage
- ✅ Manual test validation with actual review workflow