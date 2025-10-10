/**
 * Operation Subscriber - Real-time workflow monitoring
 * Manages subscriptions, session tracking, and XML tag aggregation
 */

import { generateId, createLogger } from './utils.js'
import { XMLTagParser } from './xml-tag-parser.js'
import { WebSocketClientAdapter } from './websocket-client-adapter.js'
import type {
  OperationSubscription,
  SubscriptionConfig,
  SubscriptionInfo,
  TopicRegistry,
  ExtractedTagData,
  NotificationMetadata,
  OperationCallback,
  SuperCodeWebSocketEvent,
  ProcessedMessage,
  CustomEventType,
  CustomEventData,
  CustomEventCallback,
  GenericEventData,
  GenericEventCallback
} from '../types/index.js'
import { OperationSubscriptionError } from '../types/index.js'
import type { IOperationSubscriber } from './interfaces.js'

/**
 * Operation Subscriber implementation
 * Provides real-time monitoring of workflow operations through WebSocket events
 */
export class OperationSubscriber implements IOperationSubscriber {
  private logger = createLogger('OperationSubscriber')
  private wsClient: WebSocketClientAdapter
  private xmlParser: XMLTagParser
  private subscriptions = new Map<string, OperationSubscription>()
  private topics: TopicRegistry = {}
  private _isListening = false

  constructor(private config: SubscriptionConfig) {
    this.logger.debug('Creating OperationSubscriber', {
      baseUrl: config.baseUrl,
      enableLogging: config.enableLogging
    })

    // Initialize XML parser
    this.xmlParser = new XMLTagParser()

    // Initialize WebSocket client
    const wsUrl = this.buildWebSocketUrl(config.baseUrl)
    this.wsClient = new WebSocketClientAdapter({
      url: wsUrl,
      autoReconnect: true,
      reconnectDelay: config.reconnectInterval || 1000,
      maxReconnectAttempts: config.maxRetries || 10,
      heartbeatInterval: config.heartbeatInterval || 30000
    })

    this.setupEventHandlers()
  }

  /**
   * Build WebSocket URL from base URL
   */
  private buildWebSocketUrl(baseUrl: string): string {
    try {
      const url = new URL(baseUrl)
      const port = url.port || (url.protocol === 'https:' ? '443' : '3000')
      return `ws://localhost:${port}`
    } catch (error) {
      this.logger.warn('Failed to parse base URL, using default', { baseUrl, error })
      return 'ws://localhost:3000'
    }
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupEventHandlers(): void {
    // Handle WebSocket events
    this.wsClient.onEvent((event) => {
      this.handleWebSocketEvent(event)
    })

    // Handle connection errors
    this.wsClient.onError((error) => {
      this.logger.error('WebSocket error', { error })
    })

    // Handle connection events
    this.wsClient.onOpen(() => {
      this.logger.info('WebSocket connection established')
    })

    this.wsClient.onClose(() => {
      this.logger.info('WebSocket connection closed')
    })
  }

  /**
   * Subscribe to workflow events for a specific topic
   */
  subscribe(topicId: string, tags: string[], callback: OperationCallback): string {
    const subscriptionId = generateId('subscription')

    // Validate tag names
    const validatedTags = this.xmlParser.validateTagNames(tags)
    if (validatedTags.length === 0) {
      throw new OperationSubscriptionError(
        'No valid tag names provided',
        { topicId, providedTags: tags }
      )
    }

    // Create subscription
    const subscription: OperationSubscription = {
      id: subscriptionId,
      topicId,
      tags: validatedTags,
      callback,
      eventType: 'xml-tag',
      createdAt: new Date().toISOString(),
      isActive: true
    }

    // Store subscription
    this.subscriptions.set(subscriptionId, subscription)

    // Initialize topic if needed
    if (!this.topics[topicId]) {
      this.topics[topicId] = {
        sessions: new Set(),
        subscriptions: new Map(),
        aggregatedData: {},
        customEvents: [],
        lastUpdate: new Date().toISOString()
      }
    }

    // Add subscription to topic
    this.topics[topicId].subscriptions.set(subscriptionId, subscription)

    this.logger.info('Subscription created', {
      subscriptionId,
      topicId,
      tags: validatedTags,
      totalSubscriptions: this.subscriptions.size
    })

    return subscriptionId
  }

  /**
   * Subscribe to custom events with type safety
   *
   * Note: The callback receives GenericEventData<TPayload> with structure:
   * { type: 'custom', data: CustomEventData<TPayload> }
   * To access the payload, use: eventData.data.payload
   */
  subscribeToCustomEvents<TPayload>(
    topicId: string,
    eventTypes: CustomEventType<TPayload>[],
    callback: (eventData: GenericEventData<TPayload>, metadata: NotificationMetadata) => void
  ): string {
    const subscriptionId = generateId('custom-subscription')

    // Create subscription
    const subscription: OperationSubscription = {
      id: subscriptionId,
      topicId,
      tags: [], // Empty for custom events
      genericCallback: callback as GenericEventCallback,
      eventType: 'custom',
      customEventTypes: eventTypes,
      createdAt: new Date().toISOString(),
      isActive: true
    }

    // Store subscription
    this.subscriptions.set(subscriptionId, subscription)

    // Initialize topic if needed
    if (!this.topics[topicId]) {
      this.topics[topicId] = {
        sessions: new Set(),
        subscriptions: new Map(),
        aggregatedData: {},
        customEvents: [],
        lastUpdate: new Date().toISOString()
      }
    }

    // Add subscription to topic
    this.topics[topicId].subscriptions.set(subscriptionId, subscription)

    this.logger.info('Custom event subscription created', {
      subscriptionId,
      topicId,
      eventTypes: eventTypes.map(et => et.name),
      totalSubscriptions: this.subscriptions.size
    })

    return subscriptionId
  }

  /**
   * Emit a custom event with type safety
   */
  emitCustomEvent<TPayload>(
    topicId: string,
    eventType: CustomEventType<TPayload>,
    payload: TPayload,
    sessionId?: string
  ): void {
    // Create custom event data
    const eventData: CustomEventData<TPayload> = {
      eventType,
      payload,
      timestamp: new Date().toISOString(),
      sessionId
    }

    // Initialize topic if needed
    if (!this.topics[topicId]) {
      this.topics[topicId] = {
        sessions: new Set(),
        subscriptions: new Map(),
        aggregatedData: {},
        customEvents: [],
        lastUpdate: new Date().toISOString()
      }
    }

    // Store event in topic
    this.topics[topicId].customEvents.push(eventData)
    this.topics[topicId].lastUpdate = new Date().toISOString()

    // Find subscriptions interested in this event type
    const interestedSubscriptions = Array.from(this.topics[topicId].subscriptions.values())
      .filter(sub => {
        return sub.eventType === 'custom' &&
               sub.customEventTypes?.some(et => et.name === eventType.name)
      })

    // Create notification metadata
    const metadata: NotificationMetadata = {
      topicId,
      sessionId,
      timestamp: eventData.timestamp,
      source: 'complete',
      hasNewData: true
    }

    // Notify interested subscribers
    interestedSubscriptions.forEach(subscription => {
      try {
        if (subscription.genericCallback) {
          const genericEvent: GenericEventData<TPayload> = {
            type: 'custom',
            data: eventData
          }
          subscription.genericCallback(genericEvent, metadata)
        }
      } catch (error) {
        this.logger.error('Error in custom event callback', {
          error,
          subscriptionId: subscription.id,
          topicId,
          eventType: eventType.name
        })
      }
    })

    this.logger.info('Custom event emitted', {
      topicId,
      eventType: eventType.name,
      sessionId,
      interestedSubscriptions: interestedSubscriptions.length
    })
  }

  /**
   * Get custom events for a topic with optional filtering
   */
  getCustomEvents<TPayload>(
    topicId: string,
    eventType?: CustomEventType<TPayload>
  ): CustomEventData<TPayload>[] {
    const topic = this.topics[topicId]
    if (!topic) {
      return []
    }

    let events = topic.customEvents

    // Filter by event type if provided
    if (eventType) {
      events = events.filter(event => event.eventType.name === eventType.name)
    }

    return events as CustomEventData<TPayload>[]
  }

  /**
   * Unsubscribe from a topic
   */
  unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId)
    if (!subscription) {
      this.logger.warn('Subscription not found for unsubscribe', { subscriptionId })
      return false
    }

    const { topicId } = subscription

    // Remove from subscriptions
    this.subscriptions.delete(subscriptionId)

    // Remove from topic
    if (this.topics[topicId]) {
      this.topics[topicId].subscriptions.delete(subscriptionId)

      // Clean up topic if no more subscriptions
      if (this.topics[topicId].subscriptions.size === 0) {
        delete this.topics[topicId]
        this.logger.debug('Topic cleaned up (no subscriptions)', { topicId })
      }
    }

    this.logger.info('Subscription removed', {
      subscriptionId,
      topicId,
      remainingSubscriptions: this.subscriptions.size
    })

    return true
  }

  /**
   * Add a session to a topic for event filtering
   */
  addSessionToTopic(topicId: string, sessionId: string): void {
    if (!this.topics[topicId]) {
      this.topics[topicId] = {
        sessions: new Set(),
        subscriptions: new Map(),
        aggregatedData: {},
        customEvents: [],
        lastUpdate: new Date().toISOString()
      }
    }

    this.topics[topicId].sessions.add(sessionId)

    this.logger.debug('Session added to topic', {
      topicId,
      sessionId,
      totalSessions: this.topics[topicId].sessions.size
    })
  }

  /**
   * Remove a session from a topic
   */
  removeSessionFromTopic(topicId: string, sessionId: string): void {
    if (this.topics[topicId]) {
      this.topics[topicId].sessions.delete(sessionId)

      this.logger.debug('Session removed from topic', {
        topicId,
        sessionId,
        remainingSessions: this.topics[topicId].sessions.size
      })
    }
  }

  /**
   * Start listening for WebSocket events
   */
  async startListening(): Promise<void> {
    if (this._isListening) {
      this.logger.debug('Already listening')
      return
    }

    try {
      await this.wsClient.connect()
      this._isListening = true

      this.logger.info('Operation subscriber started listening', {
        connected: this.wsClient.connected,
        subscriptions: this.subscriptions.size,
        topics: Object.keys(this.topics).length
      })
    } catch (error) {
      this.logger.error('Failed to start listening', { error })
      throw new OperationSubscriptionError(
        'Failed to establish WebSocket connection',
        { originalError: error }
      )
    }
  }

  /**
   * Stop listening and cleanup resources
   */
  stopListening(): void {
    this._isListening = false

    this.wsClient.disconnect().catch(error => {
      this.logger.error('Error during WebSocket disconnect', { error })
    })

    this.logger.info('Operation subscriber stopped listening')
  }

  /**
   * Get information about active subscriptions
   */
  getActiveSubscriptions(): SubscriptionInfo[] {
    return Array.from(this.subscriptions.values()).map(subscription => {
      const topic = this.topics[subscription.topicId]
      const dataCount = topic ?
        Object.values(topic.aggregatedData).reduce((sum, values) => sum + values.length, 0) : 0

      return {
        id: subscription.id,
        topicId: subscription.topicId,
        tags: [...subscription.tags],
        sessionCount: topic?.sessions.size || 0,
        dataCount,
        lastUpdate: topic?.lastUpdate || subscription.createdAt
      }
    })
  }

  /**
   * Get session IDs associated with a topic
   */
  getTopicSessions(topicId: string): string[] {
    const topic = this.topics[topicId]
    return topic ? Array.from(topic.sessions) : []
  }

  /**
   * Check if the subscriber is actively listening
   */
  isListening(): boolean {
    return this._isListening && this.wsClient.connected
  }

  /**
   * Handle incoming WebSocket events
   */
  private async handleWebSocketEvent(event: SuperCodeWebSocketEvent): Promise<void> {
    try {
      this.logger.debug('Processing WebSocket event', {
        event: event.event,
        eventType: event.type,
        hasData: !!event.data,
        dataKeys: event.data ? Object.keys(event.data) : []
      })

      // Convert to processed message
      const processedMessage = WebSocketClientAdapter.convertToProcessedMessage(event)
      if (!processedMessage) {
        this.logger.debug('Skipping event - convertToProcessedMessage returned null', {
          event: event.event,
          sessionIdExtracted: WebSocketClientAdapter.extractSessionId(event),
          rawEventData: event.data
        })
        return // Skip events without valid message structure
      }

      this.logger.debug('Converted to processed message', {
        sessionId: processedMessage.sessionId,
        role: processedMessage.role,
        contentLength: processedMessage.content?.length || 0,
        isPartial: processedMessage.isPartial
      })

      // Filter agent messages only
      if (!WebSocketClientAdapter.isAgentMessage(event)) {
        this.logger.debug('Skipping event - not an agent message', {
          event: event.event,
          sessionId: processedMessage.sessionId,
          role: processedMessage.role
        })
        return
      }

      this.logger.debug('Event identified as agent message', {
        sessionId: processedMessage.sessionId,
        contentPreview: processedMessage.content?.substring(0, 100)
      })

      // Find relevant topics for this session
      const relevantTopics = this.findTopicsForSession(processedMessage.sessionId)

      if (relevantTopics.length === 0) {
        // No topics interested in this session
        return
      }

      // Process each relevant topic
      for (const topicId of relevantTopics) {
        await this.processTopicMessage(topicId, processedMessage)
      }

    } catch (error) {
      this.logger.error('Error processing WebSocket event', {
        error,
        event: event.event,
        hasData: !!event.data
      })
    }
  }

  /**
   * Find topics that are interested in a specific session
   */
  private findTopicsForSession(sessionId: string): string[] {
    const relevantTopics: string[] = []

    for (const [topicId, topic] of Object.entries(this.topics)) {
      if (topic.sessions.has(sessionId)) {
        relevantTopics.push(topicId)
      }
    }

    return relevantTopics
  }

  /**
   * Process message for a specific topic
   */
  private async processTopicMessage(topicId: string, message: ProcessedMessage): Promise<void> {
    const topic = this.topics[topicId]
    if (!topic || topic.subscriptions.size === 0) {
      return
    }

    // Get all tags that any subscription is interested in
    const allTags = this.getTopicTags(topicId)
    if (allTags.length === 0) {
      return
    }

    // Extract XML tags from message content
    const parsingResult = this.xmlParser.extractTags(message.content, allTags)

    if (Object.keys(parsingResult.tagData).length === 0) {
      // No relevant tags found
      return
    }

    // Aggregate with existing data
    const aggregatedData = this.xmlParser.aggregateTagData(
      topic.aggregatedData,
      parsingResult.tagData
    )

    // Check if there's new data
    const hasNewData = this.xmlParser.hasNewData(topic.aggregatedData, aggregatedData)

    if (hasNewData) {
      // Update topic data
      topic.aggregatedData = aggregatedData
      topic.lastUpdate = new Date().toISOString()

      // Create notification metadata
      const metadata: NotificationMetadata = {
        topicId,
        sessionId: message.sessionId,
        timestamp: message.timestamp,
        source: message.isPartial ? 'partial' : 'complete',
        hasNewData: true
      }

      // Notify relevant subscriptions
      this.notifyTopicSubscribers(topicId, aggregatedData, metadata)

      this.logger.debug('Topic data updated', {
        topicId,
        sessionId: message.sessionId,
        extractedTags: Object.keys(parsingResult.tagData),
        totalValues: Object.values(aggregatedData).reduce((sum, values) => sum + values.length, 0),
        hasNewData,
        isPartial: message.isPartial
      })
    }
  }

  /**
   * Get all tags that any subscription in a topic is interested in
   */
  private getTopicTags(topicId: string): string[] {
    const topic = this.topics[topicId]
    if (!topic) return []

    const allTags = new Set<string>()

    for (const subscription of topic.subscriptions.values()) {
      subscription.tags.forEach(tag => allTags.add(tag))
    }

    return Array.from(allTags)
  }

  /**
   * Notify all subscribers of a topic
   */
  private notifyTopicSubscribers(
    topicId: string,
    aggregatedData: ExtractedTagData,
    metadata: NotificationMetadata
  ): void {
    const topic = this.topics[topicId]
    if (!topic) return

    for (const subscription of topic.subscriptions.values()) {
      try {
        if (subscription.eventType === 'xml-tag') {
          // Handle XML tag subscriptions (legacy and new generic)
          const filteredData: ExtractedTagData = {}
          for (const tag of subscription.tags) {
            if (aggregatedData[tag]) {
              filteredData[tag] = aggregatedData[tag]
            }
          }

          // Only notify if there's relevant data
          if (Object.keys(filteredData).length > 0) {
            // Call legacy callback if present
            if (subscription.callback) {
              subscription.callback(filteredData, metadata)
            }

            // Call generic callback if present
            if (subscription.genericCallback) {
              const genericEvent: GenericEventData = {
                type: 'xml-tag',
                data: filteredData
              }
              subscription.genericCallback(genericEvent, metadata)
            }
          }
        }
        // Custom events are handled in emitCustomEvent method

      } catch (error) {
        this.logger.error('Error in subscription callback', {
          error,
          subscriptionId: subscription.id,
          topicId
        })
      }
    }
  }

  /**
   * Get subscriber status for debugging
   */
  getStatus(): {
    isListening: boolean
    wsStatus: any
    subscriptions: number
    topics: number
    totalSessions: number
  } {
    const totalSessions = Object.values(this.topics)
      .reduce((sum, topic) => sum + topic.sessions.size, 0)

    return {
      isListening: this._isListening,
      wsStatus: this.wsClient.getStatus(),
      subscriptions: this.subscriptions.size,
      topics: Object.keys(this.topics).length,
      totalSessions
    }
  }
}