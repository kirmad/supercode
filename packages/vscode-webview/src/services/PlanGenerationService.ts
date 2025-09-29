/**
 * Plan Generation Service
 * Handles intelligent plan generation with design thoughts and specifications
 * Connects to real SuperCode client on port 25716 and parses XML responses
 */

import { SuperCodeWebSocketClient } from './SuperCodeWebSocketClient';
import { XMLParser } from '../utils/XMLUtils';
import {
  SessionManager,
  type SessionConfig,
  type MessagePayload,
  type StreamingCallbacks
} from './SessionManager';
import type {
  DesignThought,
  DesignSpecification,
  DesignMetadata,
  PlanGenerationResult,
  PlanGenerationOptions,
  PlanGenerationProgress
} from '../types/plan-generation';

/**
 * Extended XML Parser for plan generation with design thought processing
 */
class PlanXMLParser extends XMLParser {
  /**
   * Process streaming design thoughts from text content
   * Handles partial XML and real-time updates with deduplication
   */
  public processStreamingDesignThoughts(
    textContent: string,
    processedContent?: Set<string>
  ): {
    thoughts: DesignThought[];
    updatedProcessedContent: Set<string>;
  } {
    const thoughts: DesignThought[] = [];
    const localProcessed = processedContent || new Set<string>();

    // Extract all design-thought tags
    const thoughtRegex = /<design-thought[^>]*>([\s\S]*?)<\/design-thought>/g;
    let match;

    while ((match = thoughtRegex.exec(textContent)) !== null) {
      const fullMatch = match[0];
      const content = match[1].trim();

      // Filter out instruction examples
      if (this.isInstructionExample(content)) {
        console.log('[PlanXMLParser] Skipping instruction example:', content.substring(0, 50) + '...');
        continue;
      }

      // Create a unique key for this thought based on its content
      const contentKey = content;

      // Check against global processed set to avoid duplicates
      if (this.getGlobalProcessedResearch().has(contentKey)) {
        console.log('[PlanXMLParser] Skipping duplicate design thought:', content.substring(0, 50) + '...');
        continue;
      }

      // Parse attributes
      const typeMatch = /type="([^"]+)"/.exec(fullMatch);
      const priorityMatch = /priority="([^"]+)"/.exec(fullMatch);

      const designThought: DesignThought = {
        id: `thought-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        type: (typeMatch?.[1] || 'exploration') as DesignThought['type'],
        priority: (priorityMatch?.[1] || 'medium') as DesignThought['priority'],
        content: content,
        timestamp: Date.now(),
        status: 'completed'
      };

      // Mark as processed in global set to prevent duplicates
      this.getGlobalProcessedResearch().add(contentKey);
      localProcessed.add(contentKey);

      thoughts.push(designThought);

      console.log('[PlanXMLParser] Processed design thought:', designThought.type, '-', content.substring(0, 80) + '...');
    }

    return { thoughts, updatedProcessedContent: localProcessed };
  }

  /**
   * Parse design specification and metadata from XML
   * Handles nested content and metadata tags
   */
  public parseDesignSpecification(content: string): DesignSpecification | null {
    const specBlocks = this.parseXMLContent(content, 'design-specification');

    if (specBlocks.length === 0) {
      console.warn('[PlanXMLParser] No <design-specification> XML tags found in response');
      return null;
    }

    const block = specBlocks[0];

    // Parse metadata
    const metadataMatch = /<metadata>([\s\S]*?)<\/metadata>/s.exec(block);
    let metadata: DesignMetadata = {
      timestamp: Date.now(),
      confidence: 'medium',
      complexity: 'moderate',
      estimatedEffort: 'Unknown',
      risks: [],
      dependencies: []
    };

    if (metadataMatch) {
      const metadataContent = metadataMatch[1];

      // Parse confidence
      const confidenceMatch = /<confidence>([^<]+)<\/confidence>/.exec(metadataContent);
      if (confidenceMatch) {
        metadata.confidence = confidenceMatch[1] as DesignMetadata['confidence'];
      }

      // Parse complexity
      const complexityMatch = /<complexity>([^<]+)<\/complexity>/.exec(metadataContent);
      if (complexityMatch) {
        metadata.complexity = complexityMatch[1] as DesignMetadata['complexity'];
      }

      // Parse estimated effort
      const effortMatch = /<estimated-effort>([^<]+)<\/estimated-effort>/.exec(metadataContent);
      if (effortMatch) {
        metadata.estimatedEffort = effortMatch[1];
      }

      // Parse risks (comma-separated or nested)
      const risksMatch = /<risks>([^<]+)<\/risks>/.exec(metadataContent);
      if (risksMatch) {
        metadata.risks = risksMatch[1].split(',').map(r => r.trim()).filter(r => r);
      }

      // Parse dependencies (comma-separated or nested)
      const depsMatch = /<dependencies>([^<]+)<\/dependencies>/.exec(metadataContent);
      if (depsMatch) {
        metadata.dependencies = depsMatch[1].split(',').map(d => d.trim()).filter(d => d);
      }

      // Parse technologies
      const techMatch = /<technologies>([^<]+)<\/technologies>/.exec(metadataContent);
      if (techMatch) {
        metadata.technologies = techMatch[1].split(',').map(t => t.trim()).filter(t => t);
      }

      // Parse patterns
      const patternsMatch = /<patterns>([^<]+)<\/patterns>/.exec(metadataContent);
      if (patternsMatch) {
        metadata.patterns = patternsMatch[1].split(',').map(p => p.trim()).filter(p => p);
      }

      // Parse domains
      const domainsMatch = /<domains>([^<]+)<\/domains>/.exec(metadataContent);
      if (domainsMatch) {
        metadata.domains = domainsMatch[1].split(',').map(d => d.trim()).filter(d => d);
      }
    }

    // Parse specification content - try nested <specification> tag first, then fallback to direct content
    const specMatch = /<specification>([\s\S]*?)<\/specification>/.exec(block);
    let specification = '';

    if (specMatch) {
      // Content is nested in <specification> tag
      specification = specMatch[1].trim();
    } else {
      // Content might be directly in the design-specification block
      // Remove metadata section and get the remaining content
      const cleanedBlock = block.replace(/<metadata>[\s\S]*?<\/metadata>/g, '').trim();
      specification = cleanedBlock;
    }

    console.log('[PlanXMLParser] Parsed design specification length:', specification.length);
    console.log('[PlanXMLParser] First 200 chars of specification:', specification.substring(0, 200));

    return { specification, metadata };
  }

  /**
   * Check if content is an instruction example rather than real design thought
   */
  private isInstructionExample(content: string): boolean {
    return content.includes('exploration|architecture|integration|dependency|pattern|decision|constraint') ||
      content.includes('critical|high|medium|low') ||
      content.includes('Send each thought immediately') ||
      content.includes('don\'t wait until the end') ||
      content.includes('IMMEDIATELY as you discover') ||
      content.includes('tags IMMEDIATELY') ||
      content.includes('analyzing design decisions') ||
      content.includes('Stream design thoughts in real-time') ||
      content.length < 20; // Very short content is likely not real thoughts
  }
}

export class PlanGenerationService {
  private wsClient: SuperCodeWebSocketClient | null = null;
  private readonly port = 25716; // SuperCode is running on this port
  private thoughts: DesignThought[] = [];
  private specification: DesignSpecification | null = null;
  private onDesignThoughtUpdate?: (thoughts: DesignThought[]) => void;
  private onPlanComplete?: (result: PlanGenerationResult) => void;
  private isProcessing: boolean = false;
  // Session manager for handling session lifecycle
  private sessionManager: SessionManager;
  // XML parser instance with design thought support
  private xmlParser: PlanXMLParser;

  constructor(wsClient?: SuperCodeWebSocketClient) {
    this.xmlParser = new PlanXMLParser();
    this.sessionManager = new SessionManager(this.port);
    if (wsClient) {
      this.wsClient = wsClient;
      this.setupWebSocketListeners();
    } else {
      this.initializeClient();
    }
  }

  private initializeClient() {
    this.wsClient = new SuperCodeWebSocketClient({
      baseUrl: `http://localhost:${this.port}`,
      port: this.port,
      timeout: 30000,
      sessionId: undefined,
      directory: undefined
    });
    this.setupWebSocketListeners();
  }

  /**
   * Setup WebSocket event listeners for streaming updates
   */
  private setupWebSocketListeners() {
    if (!this.wsClient) return;

    // Listen for message part updates (streaming)
    (this.wsClient as any).onMessagePartUpdate = (part: any) => {
      this.handleWebSocketMessagePart(part);
    };
  }

  /**
   * Handle WebSocket message parts for real-time updates
   */
  private handleWebSocketMessagePart(part: any) {
    // Use SessionManager to check if message should be processed
    if (!this.sessionManager.shouldProcessMessage(part)) {
      const partSessionId = part.sessionId || part.sessionID;
      console.log('[PlanGenerationService] Ignoring message from different session:', partSessionId, '!==', this.sessionManager.getCurrentSessionId());
      return;
    }

    const partSessionId = part.sessionId || part.sessionID;
    console.log('[PlanGenerationService] Received WebSocket message part for current session:', partSessionId);

    // Extract text content from various possible locations
    const textContent = part?.text || part?.content || part?.properties?.text || part?.properties?.content || '';

    if (textContent && typeof textContent === 'string') {
      // Process design thoughts immediately from the part
      const result = this.xmlParser.processStreamingDesignThoughts(textContent);
      // Add new design thoughts
      for (const thought of result.thoughts) {
        this.thoughts.push(thought);
        // Trigger real-time update callback
        if (this.onDesignThoughtUpdate) {
          console.log('[PlanGenerationService] Real-time design thought:', thought.type, '-', thought.content.substring(0, 80) + '...');
          this.onDesignThoughtUpdate([...this.thoughts]); // Send copy of array
        }
      }
    }
  }

  /**
   * Set callback for design thought updates
   */
  public onDesignThoughtUpdated(callback: (thoughts: DesignThought[]) => void) {
    this.onDesignThoughtUpdate = callback;
  }

  /**
   * Set callback for plan completion
   */
  public onPlanCompleted(callback: (result: PlanGenerationResult) => void) {
    this.onPlanComplete = callback;
  }

  /**
   * Process streaming design thoughts from text content
   * Made public to allow external components to feed streaming content
   */
  public processStreamingDesignThoughts(textContent: string, processedContent?: Set<string>): void {
    const result = this.xmlParser.processStreamingDesignThoughts(textContent, processedContent);

    // Add new design thoughts
    for (const thought of result.thoughts) {
      this.thoughts.push(thought);

      // Trigger real-time update callback
      if (this.onDesignThoughtUpdate) {
        console.log('[PlanGenerationService] Real-time design thought:', thought.type, '-', thought.content.substring(0, 80) + '...');
        this.onDesignThoughtUpdate([...this.thoughts]); // Send copy of array
      }
    }
  }

  /**
   * Process streaming response from SuperCode
   */
  private async processStreamingResponse(response: Response, sources?: any[]): Promise<PlanGenerationResult> {
    const startTime = Date.now();
    this.thoughts = [];
    let processedThoughtContent = new Set<string>(); // Track processed thoughts to avoid duplicates

    // Setup streaming callbacks to process content in real-time
    const streamingCallbacks: StreamingCallbacks = {
      onChunk: (chunk: string) => {
        // Process design thoughts from the chunk immediately
        const chunkResult = this.xmlParser.processStreamingDesignThoughts(chunk, processedThoughtContent);
        for (const thought of chunkResult.thoughts) {
          this.thoughts.push(thought);
          if (this.onDesignThoughtUpdate) {
            console.log('[PlanGenerationService] Real-time design thought:', thought.type, '-', thought.content.substring(0, 80) + '...');
            this.onDesignThoughtUpdate([...this.thoughts]);
          }
        }
        processedThoughtContent = chunkResult.updatedProcessedContent;
      },
      onMessagePart: (part: any) => {
        // Process structured message parts
        if (part && part.text && typeof part.text === 'string') {
          const partResult = this.xmlParser.processStreamingDesignThoughts(part.text, processedThoughtContent);
          for (const thought of partResult.thoughts) {
            this.thoughts.push(thought);
            if (this.onDesignThoughtUpdate) {
              console.log('[PlanGenerationService] Real-time design thought from part:', thought.type, '-', thought.content.substring(0, 80) + '...');
              this.onDesignThoughtUpdate([...this.thoughts]);
            }
          }
          processedThoughtContent = partResult.updatedProcessedContent;
        }
      },
      onComplete: (fullContent: string) => {
        console.log('[PlanGenerationService] Streaming complete, received', fullContent.length, 'characters');
      },
      onError: (error: Error) => {
        console.error('[PlanGenerationService] Streaming error:', error);
      }
    };

    // Use SessionManager to process the streaming response
    const fullContent = await this.sessionManager.processStreamingResponse(response, {
      includeSessionFilter: true,
      callbacks: streamingCallbacks
    });

    // Final processing of complete response
    let textContent = fullContent;

    // Try to extract text from JSON structure if present
    try {
      // Check if the full content is a complete JSON response
      const jsonResponse = JSON.parse(fullContent);
      textContent = '';

      // Extract the text content from the message parts
      if (jsonResponse.parts && Array.isArray(jsonResponse.parts)) {
        for (const part of jsonResponse.parts) {
          if (part.type === 'text' && part.text) {
            textContent += part.text;
          }
        }
      }

      // If no text extracted from parts, use original content
      if (!textContent) {
        textContent = fullContent;
      }
    } catch (parseError) {
      // Not JSON, use as-is
      console.log('[PlanGenerationService] Response is not JSON, processing as text');
    }

    // Parse any remaining design thoughts from the complete text
    const newThoughts = this.parseDesignThoughts(textContent);
    if (newThoughts.length > 0) {
      // Only add thoughts not already present
      for (const thought of newThoughts) {
        if (!this.thoughts.some(existing => existing.id === thought.id)) {
          this.thoughts.push(thought);
        }
      }
      if (this.onDesignThoughtUpdate) {
        this.onDesignThoughtUpdate(this.thoughts);
      }
    }

    // Parse the final design specification
    const specResult = this.xmlParser.parseDesignSpecification(textContent);
    if (specResult) {
      this.specification = specResult;
      console.log('[PlanGenerationService] Successfully parsed design specification:', this.specification.specification.length, 'chars');
    } else {
      console.error('[PlanGenerationService] Failed to parse design specification from response');
      console.log('[PlanGenerationService] Text content length:', textContent.length);
      console.log('[PlanGenerationService] Contains <design-specification>?', textContent.includes('<design-specification>'));

      // If no XML was generated, use the text content as fallback
      if (!this.specification && textContent.length > 0) {
        console.warn('[PlanGenerationService] Using fallback: AI response as specification');
        this.specification = {
          specification: textContent,
          metadata: {
            timestamp: Date.now(),
            confidence: 'medium',
            complexity: 'moderate',
            estimatedEffort: 'Unknown',
            risks: [],
            dependencies: []
          }
        };
      }
    }

    const result: PlanGenerationResult = {
      thoughts: this.thoughts,
      specification: this.specification,
      processingTime: Date.now() - startTime
    };

    // Trigger completion callback
    if (this.onPlanComplete) {
      this.onPlanComplete(result);
    }

    return result;
  }

  /**
   * Parse design thoughts from complete text (fallback for non-streaming)
   */
  private parseDesignThoughts(content: string): DesignThought[] {
    const thoughts: DesignThought[] = [];
    const regex = /<design-thought\s+type="([^"]+)"\s+priority="([^"]+)">([^<]+)<\/design-thought>/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      thoughts.push({
        id: `thought-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        type: match[1] as DesignThought['type'],
        priority: match[2] as DesignThought['priority'],
        content: match[3].trim(),
        timestamp: Date.now(),
        status: 'completed'
      });
    }

    return thoughts;
  }

  /**
   * Generate a plan using the real SuperCode client
   */
  public async generatePlan(
    originalPrompt: string,
    providerId: string = 'anthropic',
    modelId: string = 'claude-3-5-sonnet-latest',
    sources?: any[],
    selectedRelatedItems?: Record<string, any>,
    planCommand: string = '/plan'
  ): Promise<PlanGenerationResult> {
    console.log('[PlanGenerationService] generatePlan called with:', {
      originalPrompt: originalPrompt.substring(0, 100) + '...',
      providerId,
      modelId,
      sources: sources?.length || 0,
      selectedRelatedItems: selectedRelatedItems ? Object.keys(selectedRelatedItems).length : 0
    });

    // Clear global processed set for new plan generation session
    this.xmlParser.clearDuplicationTracking();
    this.thoughts = []; // Clear previous thoughts
    this.specification = null; // Clear previous specification
    this.sessionManager.clearSession(); // Clear previous session ID to start fresh
    console.log('[PlanGenerationService] Cleared duplicate tracking and session data for new plan generation');

    try {
      if (!this.wsClient) {
        console.log('[PlanGenerationService] Initializing WebSocket client...');
        this.initializeClient();
      }

      // Use the custom command for plan generation
      let fullPrompt = `${planCommand} ${originalPrompt}`;

      // Add context sources if provided
      if (sources && sources.length > 0) {
        console.log('[PlanGenerationService] Adding sources to prompt:', sources.length, 'sources');
        fullPrompt += '\n\n## Context Sources\n';
        fullPrompt += 'The following sources provide additional context for this plan:\n\n';

        for (const source of sources) {
          if (source.content) {
            fullPrompt += source.content;
            fullPrompt += '\n\n';
          } else {
            // Fallback to basic info if no content
            fullPrompt += `### ${source.title}\n`;
            if (source.type) fullPrompt += `Type: ${source.type}\n`;
            if (source.state) fullPrompt += `State: ${source.state}\n`;
            if (source.description) {
              fullPrompt += '\n**Description:**\n' + source.description + '\n';
            }
            fullPrompt += '\n---\n\n';
          }
        }

        fullPrompt += 'Use the above context sources to better understand the requirements and provide more accurate planning.\n';
      }

      console.log('[PlanGenerationService] Full prompt length:', fullPrompt.length, 'characters');

      // Create new session
      console.log('[PlanGenerationService] Creating new session with provider:', providerId, 'model:', modelId);

      const sessionConfig: SessionConfig = {
        directory: '.',  // Use current directory since we're in browser context
        projectID: 'vscode-webview',
        providerID: providerId,
        modelID: modelId
      };

      const sessionId = await this.sessionManager.createSession(sessionConfig);
      console.log('[PlanGenerationService] Created new session and set as current:', sessionId);
      console.log('[PlanGenerationService] Session tracking initialized - will only accept events with sessionID:', sessionId);

      // Create the request payload
      const requestPayload: MessagePayload = {
        parts: [
          {
            type: 'text',
            text: fullPrompt
          }
        ],
        providerID: providerId,
        modelID: modelId
      };

      // Send request to SuperCode session's message endpoint
      const response = await this.sessionManager.sendMessageToSession(sessionId, requestPayload);

      // Process the streaming response
      return await this.processStreamingResponse(response, sources);

    } catch (error) {
      console.error('Error generating plan with SuperCode:', error);

      // No fallback - throw error if SuperCode is not available
      throw new Error(`SuperCode connection failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please ensure SuperCode is running on port ${this.port}`);
    }
  }

  /**
   * Clear the current plan generation session
   */
  public clear() {
    this.thoughts = [];
    this.specification = null;
    // Clear the global processed research set for new sessions
    this.xmlParser.clearDuplicationTracking();
    this.sessionManager.clearSession(); // Clear session tracking
  }

  /**
   * Get the current session ID
   */
  public getCurrentSessionId(): string | null {
    return this.sessionManager.getCurrentSessionId();
  }

  /**
   * Send follow-up message to an existing session
   */
  public async sendFollowUpMessage(
    followUpMessage: string
  ): Promise<PlanGenerationResult> {
    if (!this.sessionManager.hasActiveSession()) {
      throw new Error('No active session to send follow-up message to');
    }

    const currentSessionId = this.sessionManager.getCurrentSessionId();
    console.log('[PlanGenerationService] Sending follow-up message to session:', currentSessionId);
    console.log('[PlanGenerationService] Follow-up:', followUpMessage);

    try {
      // Send the follow-up message to the existing session
      const requestPayload: MessagePayload = {
        parts: [
          {
            type: 'text',
            text: followUpMessage
          }
        ]
      };

      // Send request to the existing session's message endpoint
      const response = await this.sessionManager.sendMessage(requestPayload);

      // Process the streaming response
      return await this.processStreamingResponse(response);

    } catch (error) {
      console.error('Error sending follow-up message:', error);
      throw new Error(`Failed to send follow-up message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Cancel ongoing plan generation
   */
  public cancelGeneration() {
    this.isProcessing = false;
  }

  /**
   * Check if plan generation is in progress
   */
  public isGenerating(): boolean {
    return this.isProcessing;
  }

  /**
   * Get current thoughts
   */
  public getCurrentThoughts(): DesignThought[] {
    return [...this.thoughts];
  }

  /**
   * Get current specification
   */
  public getCurrentSpecification(): DesignSpecification | null {
    return this.specification;
  }
}