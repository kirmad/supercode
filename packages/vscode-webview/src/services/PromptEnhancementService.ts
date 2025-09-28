/**
 * Prompt Enhancement Service
 * Handles intelligent prompt enhancement with research and analysis
 * Connects to real SuperCode client on port 25716 and parses XML responses
 */

import { SuperCodeWebSocketClient } from './SuperCodeWebSocketClient';
import type { ADOSource } from './ADOSourceService';
import { ADOSourceService } from './ADOSourceService';
import { ADOContentService, type SelectedItems } from './ADOContentService';
import { XMLParser } from '../utils/XMLUtils';
import {
  SessionManager,
  type SessionConfig,
  type MessagePayload,
  type StreamingCallbacks
} from './SessionManager';

export interface ResearchItem {
  id: string;
  type: 'analysis' | 'pattern' | 'requirement' | 'best-practice' | 'clarification';
  priority: 'high' | 'medium' | 'low';
  content: string;
  timestamp: number;
  status: 'pending' | 'in-progress' | 'completed';
}

export interface ClarificationQuestion {
  id: string;
  text: string;
  options: Array<{
    value: string;
    label: string;
  }>;
  answer?: string;
}

export interface EnhancedPromptMetadata {
  complexity: 'simple' | 'moderate' | 'complex';
  domains: string[];
  technologies: string[];
  patterns: string[];
  sources?: string[]; // Track which sources were used
}

export interface EnhancementResult {
  enhancedPrompt: string;
  metadata: EnhancedPromptMetadata;
  researchItems: ResearchItem[];
  clarificationQuestions?: ClarificationQuestion[];
  processingTime: number;
}

export interface EnhancementOptions {
  originalPrompt: string;
  clarificationAnswers?: ClarificationQuestion[];
  providerId?: string;
  modelId?: string;
  sources?: ADOSource[];
  selectedRelatedItems?: Record<string, SelectedItems>;
}

export interface EnhancementProgress {
  phase: string;
  percentage: number;
  currentItem?: string;
}

export class PromptEnhancementService {
  private wsClient: SuperCodeWebSocketClient | null = null;
  private readonly port = 25716; // SuperCode is running on this port
  private researchItems: ResearchItem[] = [];
  private clarificationQuestions: ClarificationQuestion[] = [];
  private enhancedPrompt: string = '';
  private metadata: EnhancedPromptMetadata | null = null;
  private onResearchUpdate?: (items: ResearchItem[]) => void;
  private onClarificationNeeded?: (questions: ClarificationQuestion[]) => void;
  private isProcessing: boolean = false;
  // Session manager for handling session lifecycle
  private sessionManager: SessionManager;
  // XML parser instance with deduplication support
  private xmlParser: XMLParser;

  constructor(wsClient?: SuperCodeWebSocketClient) {
    this.xmlParser = new XMLParser();
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
      console.log('[PromptEnhancementService] Ignoring message from different session:', partSessionId, '!==', this.sessionManager.getCurrentSessionId());
      return;
    }

    const partSessionId = part.sessionId || part.sessionID;
    console.log('[PromptEnhancementService] Received WebSocket message part for current session:', partSessionId);

    // Extract text content from various possible locations
    const textContent = part?.text || part?.content || part?.properties?.text || part?.properties?.content || '';

    if (textContent && typeof textContent === 'string') {
      // Process research updates immediately from the part
      const result = this.xmlParser.processStreamingResearch(textContent);
      // Add new research items
      for (const item of result.items) {
        this.researchItems.push(item);
        // Trigger real-time update callback
        if (this.onResearchUpdate) {
          console.log('[PromptEnhancementService] Real-time research:', item.type, '-', item.content.substring(0, 80) + '...');
          this.onResearchUpdate([...this.researchItems]); // Send copy of array
        }
      }
    }
  }

  /**
   * Set callback for research updates
   */
  public onResearchItemUpdate(callback: (items: ResearchItem[]) => void) {
    this.onResearchUpdate = callback;
  }

  /**
   * Set callback for clarification questions
   */
  public onClarificationRequest(callback: (questions: ClarificationQuestion[]) => void) {
    this.onClarificationNeeded = callback;
  }


  /**
   * Process streaming clarification questions from text content
   */
  public processStreamingClarifications(textContent: string): void {
    const result = this.xmlParser.processStreamingClarifications(textContent, this.clarificationQuestions);

    // Update our questions list
    this.clarificationQuestions = result.questions;

    // Trigger callback for new questions
    if (result.newQuestions.length > 0 && this.onClarificationNeeded) {
      for (const question of result.newQuestions) {
        console.log('[PromptEnhancementService] Real-time clarification:', question.text);
      }
      this.onClarificationNeeded([...this.clarificationQuestions]);
    }
  }


  /**
   * Process streaming research updates from text content
   * Made public to allow external components to feed streaming content
   */
  public processStreamingResearch(textContent: string, processedContent?: Set<string>): void {
    const result = this.xmlParser.processStreamingResearch(textContent, processedContent);

    // Add new research items
    for (const item of result.items) {
      this.researchItems.push(item);

      // Trigger real-time update callback
      if (this.onResearchUpdate) {
        console.log('[PromptEnhancementService] Real-time research:', item.type, '-', item.content.substring(0, 80) + '...');
        this.onResearchUpdate([...this.researchItems]); // Send copy of array
      }
    }
  }

  /**
   * Process streaming response from SuperCode
   */
  private async processStreamingResponse(response: Response, sources?: ADOSource[]): Promise<EnhancementResult> {
    const startTime = Date.now();
    this.researchItems = [];
    this.clarificationQuestions = [];
    let processedResearchContent = new Set<string>(); // Track processed research to avoid duplicates

    // Setup streaming callbacks to process content in real-time
    const streamingCallbacks: StreamingCallbacks = {
      onChunk: (chunk: string) => {
        // Process research updates from the chunk immediately
        const chunkResult = this.xmlParser.processStreamingResearch(chunk, processedResearchContent);
        for (const item of chunkResult.items) {
          this.researchItems.push(item);
          if (this.onResearchUpdate) {
            console.log('[PromptEnhancementService] Real-time research:', item.type, '-', item.content.substring(0, 80) + '...');
            this.onResearchUpdate([...this.researchItems]);
          }
        }
        processedResearchContent = chunkResult.updatedProcessedContent;

        // Also process streaming clarification questions
        this.processStreamingClarifications(chunk);
      },
      onMessagePart: (part: any) => {
        // Process structured message parts
        if (part && part.text && typeof part.text === 'string') {
          const partResult = this.xmlParser.processStreamingResearch(part.text, processedResearchContent);
          for (const item of partResult.items) {
            this.researchItems.push(item);
            if (this.onResearchUpdate) {
              console.log('[PromptEnhancementService] Real-time research from part:', item.type, '-', item.content.substring(0, 80) + '...');
              this.onResearchUpdate([...this.researchItems]);
            }
          }
          processedResearchContent = partResult.updatedProcessedContent;

          // Process clarifications from message parts
          this.processStreamingClarifications(part.text);
        }
      },
      onComplete: (fullContent: string) => {
        console.log('[PromptEnhancementService] Streaming complete, received', fullContent.length, 'characters');
      },
      onError: (error: Error) => {
        console.error('[PromptEnhancementService] Streaming error:', error);
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
      console.log('[PromptEnhancementService] Response is not JSON, processing as text');
    }

    // Parse any remaining research updates from the complete text
    const newResearchItems = this.xmlParser.parseResearchUpdates(textContent);
    if (newResearchItems.length > 0) {
      // Only add items not already present
      for (const item of newResearchItems) {
        if (!this.researchItems.some(existing => existing.id === item.id)) {
          this.researchItems.push(item);
        }
      }
      if (this.onResearchUpdate) {
        this.onResearchUpdate(this.researchItems);
      }
    }

    // Parse clarification questions from complete response
    const newQuestions = this.xmlParser.parseClarificationQuestions(textContent);
    if (newQuestions.length > 0) {
      this.clarificationQuestions = newQuestions;
      if (this.onClarificationNeeded) {
        this.onClarificationNeeded(this.clarificationQuestions);
      }
    }

    // Parse the final enhanced prompt
    const enhancedResult = this.xmlParser.parseEnhancedPrompt(textContent);

    if (enhancedResult) {
      this.enhancedPrompt = enhancedResult.prompt;
      this.metadata = enhancedResult.metadata;
      console.log('[PromptEnhancementService] Successfully parsed enhanced prompt:', this.enhancedPrompt.length, 'chars');
    } else {
      console.error('[PromptEnhancementService] Failed to parse enhanced prompt from response');
      console.log('[PromptEnhancementService] Text content length:', textContent.length);
      console.log('[PromptEnhancementService] Contains <enhanced-prompt>?', textContent.includes('<enhanced-prompt>'));
      console.log('[PromptEnhancementService] Contains backtick XML?', textContent.includes('`<enhanced-prompt>`'));

      // If no XML was generated, use the original prompt as fallback
      if (!this.enhancedPrompt && textContent.length > 0) {
        console.warn('[PromptEnhancementService] Using fallback: AI response as enhanced prompt');
        this.enhancedPrompt = textContent;
      }
    }

    // Add sources to metadata if provided
    const finalMetadata = this.metadata || {
      complexity: 'moderate',
      domains: [],
      technologies: [],
      patterns: []
    };

    if (sources && sources.length > 0) {
      finalMetadata.sources = sources.map(s => s.title);
    }

    return {
      enhancedPrompt: this.enhancedPrompt,
      metadata: finalMetadata,
      researchItems: this.researchItems,
      clarificationQuestions: this.clarificationQuestions.length > 0 ? this.clarificationQuestions : undefined,
      processingTime: Date.now() - startTime
    };
  }

  /**
   * Enhance a prompt using the real SuperCode client
   */
  public async enhancePrompt(
    originalPrompt: string,
    clarificationAnswers?: ClarificationQuestion[],
    providerId: string = 'anthropic',
    modelId: string = 'claude-3-5-sonnet-latest',
    sources?: ADOSource[],
    selectedRelatedItems?: Record<string, SelectedItems>,
    enhancementCommand: string = '/enhance-prompt'
  ): Promise<EnhancementResult> {
    console.log('[PromptEnhancementService] enhancePrompt called with:', {
      originalPrompt: originalPrompt.substring(0, 100) + '...',
      clarificationAnswers: clarificationAnswers?.length || 0,
      providerId,
      modelId,
      sources: sources?.length || 0,
      selectedRelatedItems: selectedRelatedItems ? Object.keys(selectedRelatedItems).map(key => ({
        sourceId: key,
        parentTask: selectedRelatedItems[key]?.parentTask ? 'present' : 'none',
        tasks: selectedRelatedItems[key]?.tasks?.length || 0,
        prs: selectedRelatedItems[key]?.prs?.length || 0
      })) : 'none'
    });

    // Clear global processed set for new enhancement session
    this.xmlParser.clearDuplicationTracking();
    this.researchItems = []; // Clear previous research items
    this.sessionManager.clearSession(); // Clear previous session ID to start fresh
    console.log('[PromptEnhancementService] Cleared duplicate tracking and session data for new enhancement');

    try {
      if (!this.wsClient) {
        console.log('[PromptEnhancementService] Initializing WebSocket client...');
        this.initializeClient();
      }

      // Use the custom command for prompt enhancement
      // The command and output style handle all the formatting instructions
      let fullPrompt = `${enhancementCommand} ${originalPrompt}`;

      // Add clarification answers if provided
      if (clarificationAnswers && clarificationAnswers.length > 0) {
        fullPrompt += '\n\nClarification Answers:\n';
        for (const qa of clarificationAnswers) {
          fullPrompt += `- ${qa.text}: ${qa.answer}\n`;
        }
      }

      // Add context sources if provided
      if (sources && sources.length > 0) {
        console.log('[PromptEnhancementService] Adding sources to prompt:', sources.length, 'sources');
        fullPrompt += '\n\n## Context Sources\n';
        fullPrompt += 'The following sources provide additional context for this prompt:\n\n';

        // Construct content for each source
        for (const source of sources) {
          try {
            // Check if content already exists or needs to be constructed
            if (!source.content || (source.type === 'workitem' && selectedRelatedItems)) {
              // Initialize ADO services if needed to construct content
              const adoService = new ADOSourceService();

              // Check if service is initialized
              if (!adoService.isReady()) {
                // Try to initialize with cached credentials
                const { getADOCredentials } = await import('../config/ado.config');
                const creds = getADOCredentials();
                if (creds.organization && creds.project && creds.pat) {
                  await adoService.initialize(creds);

                  // Create content service and construct content
                  const contentService = new ADOContentService(adoService);
                  // Get the selected items for this specific source
                  const sourceRelatedItems = selectedRelatedItems?.[source.id || ''];
                  const constructedContent = await contentService.constructContent(source, sourceRelatedItems);

                  // Update source with constructed content
                  source.content = constructedContent;
                  console.log('[PromptEnhancementService] Constructed content for source:', source.title, 'with related items:', sourceRelatedItems);
                } else {
                  console.warn('[PromptEnhancementService] ADO credentials not available, using basic content');
                }
              } else {
                // Service is ready, construct content
                const contentService = new ADOContentService(adoService);
                // Get the selected items for this specific source
                const sourceRelatedItems = selectedRelatedItems?.[source.id || ''];
                const constructedContent = await contentService.constructContent(source, sourceRelatedItems);
                source.content = constructedContent;
                console.log('[PromptEnhancementService] Constructed content for source:', source.title, 'with related items:', sourceRelatedItems);
              }
            }

            // Add the content to the prompt
            if (source.content) {
              // The content already includes title, type, and state from ADOContentService
              // Just add the full content directly
              fullPrompt += source.content;
              fullPrompt += '\n\n';
            } else {
              // Fallback to basic info if no content
              fullPrompt += `### ${source.title}\n`;
              fullPrompt += `Type: ${source.type === 'workitem' ? 'Work Item' : 'Pull Request'}\n`;
              if (source.state) fullPrompt += `State: ${source.state}\n`;
              if (source.description) {
                fullPrompt += '\n**Description:**\n' + source.description + '\n';
              }
              fullPrompt += '\n---\n\n';
            }
          } catch (error) {
            console.error('[PromptEnhancementService] Error constructing content for source:', source.title, error);
            // Add basic info if content construction fails
            fullPrompt += `### ${source.title}\n`;
            fullPrompt += `Type: ${source.type === 'workitem' ? 'Work Item' : 'Pull Request'}\n`;
            if (source.state) fullPrompt += `State: ${source.state}\n`;
            if (source.description) {
              fullPrompt += '\n' + source.description + '\n';
            }
            fullPrompt += '\n---\n\n';
          }
        }

        fullPrompt += 'Use the above context sources to better understand the requirements and provide more accurate enhancement.\n';
      }

      console.log('[PromptEnhancementService] Full prompt length:', fullPrompt.length, 'characters');

      // Only create a new session if we don't have clarification answers
      // If we have clarification answers, they should be sent via sendClarificationAnswers() to the existing session
      let sessionId: string;

      if (!clarificationAnswers || clarificationAnswers.length === 0) {
        console.log('[PromptEnhancementService] Creating new session with provider:', providerId, 'model:', modelId);

        const sessionConfig: SessionConfig = {
          directory: '.',  // Use current directory since we're in browser context
          projectID: 'vscode-webview',
          providerID: providerId,
          modelID: modelId
        };

        sessionId = await this.sessionManager.createSession(sessionConfig);
        console.log('[PromptEnhancementService] Created new session and set as current:', sessionId);
        console.log('[PromptEnhancementService] Session tracking initialized - will only accept events with sessionID:', sessionId);
      } else {
        // This shouldn't happen as clarification answers should be sent via sendClarificationAnswers()
        console.warn('[PromptEnhancementService] WARNING: enhancePrompt called with clarification answers. Use sendClarificationAnswers() instead.');
        throw new Error('Clarification answers should be sent via sendClarificationAnswers() to the existing session');
      }

      // Create the request payload using the custom command as a message
      const requestPayload: MessagePayload = {
        parts: [
          {
            type: 'text',
            // Send prompt directly without command prefix for better XML generation
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
      console.error('Error enhancing prompt with SuperCode:', error);

      // No fallback - throw error if SuperCode is not available
      throw new Error(`SuperCode connection failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please ensure SuperCode is running on port ${this.port}`);
    }
  }


  /**
   * Clear the current enhancement session
   */
  public clear() {
    this.researchItems = [];
    this.clarificationQuestions = [];
    this.enhancedPrompt = '';
    this.metadata = null;
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
   * Send clarification answers to an existing session
   */
  public async sendClarificationAnswers(
    clarificationAnswers: ClarificationQuestion[]
  ): Promise<EnhancementResult> {
    if (!this.sessionManager.hasActiveSession()) {
      throw new Error('No active session to send clarification answers to');
    }

    const currentSessionId = this.sessionManager.getCurrentSessionId();
    console.log('[PromptEnhancementService] Sending clarification answers to session:', currentSessionId);
    console.log('[PromptEnhancementService] Answers:', JSON.stringify(clarificationAnswers, null, 2));

    try {
      // Format the clarification answers as a response with full context
      let answerText = 'Here are my answers to your clarification questions:\n\n';
      for (const qa of clarificationAnswers) {
        // Get the full answer text - either the direct answer or the label of the selected option
        let fullAnswer = qa.answer || '';

        // If the answer is an option value (like "a", "b", "c"), get the full label text
        if (qa.options && qa.options.length > 0) {
          const selectedOption = qa.options.find(opt => opt.value === qa.answer);
          if (selectedOption) {
            fullAnswer = selectedOption.label;
          }
        }

        answerText += `**${qa.text}**\n${fullAnswer}\n\n`;
      }

      // Send the answers as a message to the existing session
      const requestPayload: MessagePayload = {
        parts: [
          {
            type: 'text',
            text: answerText
          }
        ]
      };

      // Send request to the existing session's message endpoint
      const response = await this.sessionManager.sendMessage(requestPayload);

      // Process the streaming response
      return await this.processStreamingResponse(response);

    } catch (error) {
      console.error('Error sending clarification answers:', error);
      throw new Error(`Failed to send clarification answers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Send follow-up suggestion to an existing session
   */
  public async sendFollowUpSuggestion(
    followUpSuggestion: string
  ): Promise<EnhancementResult> {
    if (!this.sessionManager.hasActiveSession()) {
      throw new Error('No active session to send follow-up suggestion to');
    }

    const currentSessionId = this.sessionManager.getCurrentSessionId();
    console.log('[PromptEnhancementService] Sending follow-up suggestion to session:', currentSessionId);
    console.log('[PromptEnhancementService] Follow-up:', followUpSuggestion);

    try {
      // Send the follow-up suggestion as a message to the existing session
      const requestPayload: MessagePayload = {
        parts: [
          {
            type: 'text',
            text: followUpSuggestion
          }
        ]
      };

      // Send request to the existing session's message endpoint
      const response = await this.sessionManager.sendMessage(requestPayload);

      // Process the streaming response
      return await this.processStreamingResponse(response);

    } catch (error) {
      console.error('Error sending follow-up suggestion:', error);
      throw new Error(`Failed to send follow-up suggestion: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Regenerate the enhanced prompt with a different approach
   */
  public async regeneratePrompt(originalPrompt: string, clarificationAnswers?: ClarificationQuestion[]): Promise<EnhancementResult> {
    this.clear();
    // Add a variation instruction to get different results
    const variedPrompt = `${originalPrompt}\n\n[Note: Please provide an alternative approach or perspective for this implementation.]`;
    return this.enhancePrompt(variedPrompt, clarificationAnswers);
  }

  /**
   * Enhance prompt with follow-up suggestions
   */
  public async enhanceWithFollowUp(
    context: {
      originalPrompt: string;
      currentEnhancedPrompt: string;
      followUpSuggestion: string;
      previousResearch: ResearchItem[];
      sources?: ADOSource[];
    },
    providerId: string = 'anthropic',
    modelId: string = 'claude-3-5-sonnet-latest',
    enhancementCommand: string = '/enhance-prompt'
  ): Promise<EnhancementResult> {
    const startTime = Date.now();

    try {
      // Clear session tracking for new follow-up session
      this.sessionManager.clearSession();
      // Don't clear existing research - we want to append to it
      this.isProcessing = true;

      // Create a new session for the follow-up enhancement
      console.log('[PromptEnhancementService] Creating new session for follow-up with provider:', providerId, 'model:', modelId);

      const sessionConfig: SessionConfig = {
        directory: '.',  // Use current directory since we're in browser context
        projectID: 'vscode-webview',
        providerID: providerId,
        modelID: modelId
      };

      const sessionId = await this.sessionManager.createSession(sessionConfig);
      console.log('[PromptEnhancementService] Follow-up session created and set as current:', sessionId);

      // Use the custom command for follow-up enhancement
      // Construct the follow-up context as part of the command
      const followUpPrompt = `${enhancementCommand}
## Follow-up Enhancement Request

### Original Prompt
${context.originalPrompt}

### Previously Enhanced Version
${context.currentEnhancedPrompt}

### Additional Requirements
${context.followUpSuggestion}

### Context
- Previous research items: ${context.previousResearch.length}
- Please incorporate the follow-up suggestions while maintaining the quality and structure of the current enhanced prompt
- Add any new research insights needed for the additional requirements`;

      // Send the follow-up enhancement request
      const messagePayload: MessagePayload = {
        parts: [
          {
            type: 'text',
            text: followUpPrompt
          }
        ],
        providerID: providerId,
        modelID: modelId
      };

      // Process streaming response using SessionManager with real-time callbacks
      let processedResearchContent = new Set<string>();

      const streamingCallbacks: StreamingCallbacks = {
        onChunk: (chunk: string) => {
          // Process streaming research from the chunk immediately
          const followUpResult = this.xmlParser.processStreamingResearch(chunk, processedResearchContent);
          for (const item of followUpResult.items) {
            this.researchItems.push(item);
            if (this.onResearchUpdate) {
              console.log('[PromptEnhancementService] Real-time research:', item.type, '-', item.content.substring(0, 80) + '...');
              this.onResearchUpdate([...this.researchItems]);
            }
          }
          processedResearchContent = followUpResult.updatedProcessedContent;
        },
        onMessagePart: (part: any) => {
          // Process structured message parts
          if (part && part.text && typeof part.text === 'string') {
            const partResult = this.xmlParser.processStreamingResearch(part.text, processedResearchContent);
            for (const item of partResult.items) {
              this.researchItems.push(item);
              if (this.onResearchUpdate) {
                console.log('[PromptEnhancementService] Follow-up real-time research from part:', item.type, '-', item.content.substring(0, 80) + '...');
                this.onResearchUpdate([...this.researchItems]);
              }
            }
            processedResearchContent = partResult.updatedProcessedContent;
          }
        },
        onComplete: (fullContent: string) => {
          console.log('[PromptEnhancementService] Follow-up streaming complete, received', fullContent.length, 'characters');
        },
        onError: (error: Error) => {
          console.error('[PromptEnhancementService] Follow-up streaming error:', error);
        }
      };

      const fullContent = await this.sessionManager.sendMessageWithStreaming(messagePayload, {
        sessionId,
        includeSessionFilter: true,
        callbacks: streamingCallbacks
      });

      // Process the complete response exactly like the initial enhancement
      let textContent = '';
      let isAssistantMessage = false;

      try {
        // Parse the accumulated content as JSON streaming response
        const lines = fullContent.split('\n');
        for (const line of lines) {
          if (line.trim()) {
            try {
              // Handle SSE format (data: prefix)
              let jsonStr = line;
              if (line.startsWith('data: ')) {
                jsonStr = line.slice(6);
              }

              const jsonResponse = JSON.parse(jsonStr);

              // Check if this is an assistant message (not user message)
              // Assistant messages typically have role: 'assistant' or come after user messages
              if (jsonResponse.role === 'assistant' || jsonResponse.sender === 'assistant') {
                isAssistantMessage = true;
              } else if (jsonResponse.role === 'user' || jsonResponse.sender === 'user') {
                isAssistantMessage = false;
                continue; // Skip user messages
              }

              // Extract text content from message parts (only from assistant messages)
              if (jsonResponse.parts && Array.isArray(jsonResponse.parts)) {
                // This is likely the assistant's response
                for (const part of jsonResponse.parts) {
                  if (part.type === 'text' && part.text) {
                    // Only accumulate if we're past any user message
                    // Follow-up responses might include the user prompt first
                    if (!part.text.includes('/enhance-prompt')) {
                      textContent = part.text; // Use the latest text (overwrite previous)
                    }
                  }
                }
              } else if (jsonResponse.text && isAssistantMessage) {
                // Direct text property from assistant
                textContent = jsonResponse.text;
              }
            } catch {
              // Not valid JSON line, continue
            }
          }
        }
      } catch (parseError) {
        console.warn('Failed to parse as JSON, treating as text:', parseError);
        textContent = fullContent;
      }

      // If no text content extracted, use the full content
      if (!textContent) {
        textContent = fullContent;
      }

      console.log('[PromptEnhancementService] Follow-up: Extracted text content length:', textContent.length);
      console.log('[PromptEnhancementService] Follow-up: Text preview:', textContent.substring(0, 500));
      console.log('[PromptEnhancementService] Follow-up: Contains enhanced-prompt tag?', textContent.includes('<enhanced-prompt>'));
      console.log('[PromptEnhancementService] Follow-up: Contains content tag?', textContent.includes('<content>'));

      // Process the enhanced prompt - parse the XML response
      const enhancedResult = this.xmlParser.parseEnhancedPrompt(textContent.trim());

      if (enhancedResult) {
        this.enhancedPrompt = enhancedResult.prompt;
        this.metadata = enhancedResult.metadata;
        console.log('[PromptEnhancementService] Follow-up: Successfully parsed enhanced prompt:', this.enhancedPrompt.length, 'chars');
      } else {
        console.warn('[PromptEnhancementService] Follow-up: Failed to parse XML, using raw text as fallback');
        this.enhancedPrompt = textContent.trim();
      }

      const result: EnhancementResult = {
        enhancedPrompt: this.enhancedPrompt,
        metadata: this.metadata || {
          complexity: 'moderate',
          domains: [],
          technologies: [],
          patterns: []
        },
        researchItems: this.researchItems.filter(item =>
          // Only return new research items from this follow-up
          !context.previousResearch.some(prev => prev.id === item.id)
        ),
        clarificationQuestions: [],
        processingTime: Date.now() - startTime
      };

      return result;

    } catch (error) {
      console.error('Error enhancing with follow-up:', error);
      throw new Error(`Follow-up enhancement failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Cancel ongoing enhancement
   */
  public cancelEnhancement() {
    this.isProcessing = false;
  }

  /**
   * Check if enhancement is in progress
   */
  public isEnhancing(): boolean {
    return this.isProcessing;
  }

}