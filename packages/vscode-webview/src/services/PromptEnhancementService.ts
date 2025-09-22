/**
 * Prompt Enhancement Service
 * Handles intelligent prompt enhancement with research and analysis
 * Connects to real SuperCode client on port 25716 and parses XML responses
 */

import { SuperCodeWebSocketClient } from './SuperCodeWebSocketClient';
import type { ADOSource } from './ADOSourceService';
import { ADOSourceService } from './ADOSourceService';
import { ADOContentService, type SelectedItems } from './ADOContentService';

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
  // Global set to track all processed research content across the entire session
  private globalProcessedResearch: Set<string> = new Set();
  // Track the current active session ID for filtering messages
  private currentSessionId: string | null = null;

  constructor(wsClient?: SuperCodeWebSocketClient) {
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
    // Filter out messages from other sessions (check both sessionId and sessionID for compatibility)
    const partSessionId = part.sessionId || part.sessionID;
    if (this.currentSessionId && partSessionId !== this.currentSessionId) {
      console.log('[PromptEnhancementService] Ignoring message from different session:', partSessionId, '!==', this.currentSessionId);
      return;
    }

    console.log('[PromptEnhancementService] Received WebSocket message part for current session:', partSessionId);

    // Extract text content from various possible locations
    const textContent = part?.text || part?.content || part?.properties?.text || part?.properties?.content || '';

    if (textContent && typeof textContent === 'string') {
      // Process research updates immediately from the part
      const processedContent = new Set<string>();
      this.processStreamingResearch(textContent, processedContent);
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
   * Parse XML content from the response
   */
  private parseXMLContent(content: string, tag: string): string[] {
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'g');
    const matches: string[] = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      matches.push(match[1].trim());
    }

    return matches;
  }

  /**
   * Parse research updates from XML
   */
  private parseResearchUpdates(content: string): ResearchItem[] {
    const items: ResearchItem[] = [];
    const regex = /<research-update\s+type="([^"]+)"\s+priority="([^"]+)">([^<]+)<\/research-update>/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      items.push({
        id: `research-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        type: match[1] as ResearchItem['type'],
        priority: match[2] as ResearchItem['priority'],
        content: match[3].trim(),
        timestamp: Date.now(),
        status: 'completed'
      });
    }

    return items;
  }

  /**
   * Parse clarification questions from XML
   */
  private parseClarificationQuestions(content: string): ClarificationQuestion[] {
    const questions: ClarificationQuestion[] = [];
    const clarificationBlocks = this.parseXMLContent(content, 'clarification-needed');

    for (const block of clarificationBlocks) {
      const questionRegex = /<question\s+id="([^"]+)">\s*<text>([^<]+)<\/text>\s*<options>([^<]+)<\/options>\s*<\/question>/g;
      let match;

      while ((match = questionRegex.exec(block)) !== null) {
        const optionRegex = /<option\s+value="([^"]+)">([^<]+)<\/option>/g;
        const options: Array<{ value: string; label: string }> = [];
        let optionMatch;

        while ((optionMatch = optionRegex.exec(match[3])) !== null) {
          options.push({
            value: optionMatch[1],
            label: optionMatch[2].trim()
          });
        }

        questions.push({
          id: match[1],
          text: match[2].trim(),
          options
        });
      }
    }

    return questions;
  }

  /**
   * Parse enhanced prompt and metadata from XML
   */
  private parseEnhancedPrompt(content: string): { prompt: string; metadata: EnhancedPromptMetadata } | null {
    const enhancedBlocks = this.parseXMLContent(content, 'enhanced-prompt');

    if (enhancedBlocks.length === 0) {
      console.warn('[PromptEnhancementService] No <enhanced-prompt> XML tags found in response');
      console.warn('[PromptEnhancementService] Response preview:', content.substring(0, 500));
      return null;
    }

    const block = enhancedBlocks[0];

    // Parse metadata
    const metadataMatch = /<metadata>([^<]+)<\/metadata>/s.exec(block);
    let metadata: EnhancedPromptMetadata = {
      complexity: 'moderate',
      domains: [],
      technologies: [],
      patterns: []
    };

    if (metadataMatch) {
      const metadataContent = metadataMatch[1];

      // Parse complexity
      const complexityMatch = /<complexity>([^<]+)<\/complexity>/.exec(metadataContent);
      if (complexityMatch) {
        metadata.complexity = complexityMatch[1] as EnhancedPromptMetadata['complexity'];
      }

      // Parse domains
      const domainsMatch = /<domains>([^<]+)<\/domains>/.exec(metadataContent);
      if (domainsMatch) {
        metadata.domains = domainsMatch[1].split(',').map(d => d.trim());
      }

      // Parse technologies
      const techMatch = /<technologies>([^<]+)<\/technologies>/.exec(metadataContent);
      if (techMatch) {
        metadata.technologies = techMatch[1].split(',').map(t => t.trim());
      }

      // Parse patterns
      const patternsMatch = /<patterns>([^<]+)<\/patterns>/.exec(metadataContent);
      if (patternsMatch) {
        metadata.patterns = patternsMatch[1].split(',').map(p => p.trim());
      }
    }

    // Parse content - try nested <content> tag first, then fallback to direct content
    const contentMatch = /<content>([\s\S]*?)<\/content>/.exec(block);
    let prompt = '';

    if (contentMatch) {
      // Content is nested in <content> tag
      prompt = contentMatch[1].trim();
    } else {
      // Content might be directly in the enhanced-prompt block
      // Remove metadata section and get the remaining content
      const cleanedBlock = block.replace(/<metadata>[\s\S]*?<\/metadata>/g, '').trim();
      prompt = cleanedBlock;
    }

    console.log('[PromptEnhancementService] Parsed enhanced prompt length:', prompt.length);
    console.log('[PromptEnhancementService] First 200 chars of prompt:', prompt.substring(0, 200));

    return { prompt, metadata };
  }

  /**
   * Process streaming research updates from text content
   * Made public to allow external components to feed streaming content
   */
  public processStreamingResearch(textContent: string, processedContent?: Set<string>): void {
    // Use global set for deduplication across all streaming updates
    // This prevents the same research item from appearing multiple times
    // when message.part.updated events contain accumulating text

    // Extract all research-update tags
    const researchRegex = /<research-update[^>]*>([\s\S]*?)<\/research-update>/g;
    let match;

    while ((match = researchRegex.exec(textContent)) !== null) {
      const fullMatch = match[0];
      const content = match[1].trim();

      // Filter out instruction examples from the prompt
      // These are not real research items but examples in the instructions
      const isInstructionExample =
        content.includes('analysis|pattern|requirement|best-practice') ||
        content.includes('high|medium|low') ||
        content.includes('Send each finding immediately') ||
        content.includes('don\'t wait until the end') ||
        content.includes('IMMEDIATELY as you discover') ||
        content.includes('tags IMMEDIATELY') ||
        content.includes('discovering insights as I analyze') ||
        content.includes('Stream research findings in real-time') ||
        content.length < 20; // Very short content is likely not real research

      if (isInstructionExample) {
        console.log('[PromptEnhancementService] Skipping instruction example:', content.substring(0, 50) + '...');
        continue;
      }

      // Create a unique key for this research item based on its content
      // Using the full content ensures proper deduplication
      const contentKey = content;

      // Check against global processed set
      if (this.globalProcessedResearch.has(contentKey)) {
        console.log('[PromptEnhancementService] Skipping duplicate research:', content.substring(0, 50) + '...');
        continue; // Skip already processed
      }

      // Parse attributes
      const typeMatch = /type="([^"]+)"/.exec(fullMatch);
      const priorityMatch = /priority="([^"]+)"/.exec(fullMatch);

      const researchItem: ResearchItem = {
        id: `research-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        type: (typeMatch?.[1] || 'analysis') as ResearchItem['type'],
        priority: (priorityMatch?.[1] || 'medium') as ResearchItem['priority'],
        content: content,
        timestamp: Date.now(),
        status: 'completed'
      };

      // Mark as processed in global set to prevent duplicates
      this.globalProcessedResearch.add(contentKey);

      // Also add to local set if provided (for compatibility)
      if (processedContent) {
        processedContent.add(contentKey);
      }

      // Add to research items
      this.researchItems.push(researchItem);

      // Trigger real-time update callback
      if (this.onResearchUpdate) {
        console.log('[PromptEnhancementService] Real-time research:', researchItem.type, '-', content.substring(0, 80) + '...');
        this.onResearchUpdate([...this.researchItems]); // Send copy of array
      }
    }
  }

  /**
   * Process streaming response from SuperCode
   */
  private async processStreamingResponse(response: Response, sources?: ADOSource[]): Promise<EnhancementResult> {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    const processedResearchContent = new Set<string>(); // Track processed research to avoid duplicates

    if (!reader) {
      throw new Error('No response body available');
    }

    const startTime = Date.now();
    this.researchItems = [];
    this.clarificationQuestions = [];

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullContent += chunk;

        // Try to process research updates from the chunk immediately
        // This handles both raw text and JSON-wrapped text
        this.processStreamingResearch(chunk, processedResearchContent);

        // Also try to parse as JSON for structured responses
        try {
          const lines = fullContent.split('\n');
          for (const line of lines) {
            if (line.trim()) {
              try {
                const jsonResponse = JSON.parse(line);
                if (jsonResponse.parts && Array.isArray(jsonResponse.parts)) {
                  for (const part of jsonResponse.parts) {
                    if (part.type === 'text' && part.text) {
                      // Process streaming research updates immediately
                      this.processStreamingResearch(part.text, processedResearchContent);
                    }
                  }
                }
              } catch {
                // Not valid JSON line, continue
              }
            }
          }
        } catch (e) {
          // Continue accumulating
        }
      }

      // Final processing of complete response
      let textContent = '';
      try {
        const jsonResponse = JSON.parse(fullContent);

        // Extract the text content from the message parts
        if (jsonResponse.parts && Array.isArray(jsonResponse.parts)) {
          for (const part of jsonResponse.parts) {
            if (part.type === 'text' && part.text) {
              textContent += part.text;
            }
          }
        }
      } catch (parseError) {
        console.warn('Failed to parse as JSON, treating as text:', parseError);
        textContent = fullContent;
      }

      // Parse research updates from the text content
      const newResearchItems = this.parseResearchUpdates(textContent);
      if (newResearchItems.length > 0) {
        this.researchItems.push(...newResearchItems);
        if (this.onResearchUpdate) {
          this.onResearchUpdate(this.researchItems);
        }
      }

      // Parse clarification questions
      const newQuestions = this.parseClarificationQuestions(textContent);
      if (newQuestions.length > 0) {
        this.clarificationQuestions = newQuestions;
        if (this.onClarificationNeeded) {
          this.onClarificationNeeded(this.clarificationQuestions);
        }
      }

      // Parse the final enhanced prompt
      const enhancedResult = this.parseEnhancedPrompt(textContent);

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
    } finally {
      reader.releaseLock();
    }
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
    this.globalProcessedResearch.clear();
    this.researchItems = []; // Clear previous research items
    this.currentSessionId = null; // Clear previous session ID to start fresh
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

      // Always create a new session for each enhancement
      console.log('[PromptEnhancementService] Creating new session with provider:', providerId, 'model:', modelId);
      const newSessionResponse = await fetch(`http://localhost:${this.port}/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          directory: '.',  // Use current directory since we're in browser context
          projectID: 'vscode-webview',
          providerID: providerId,
          modelID: modelId
        })
      });

      if (!newSessionResponse.ok) {
        throw new Error(`Failed to create session: ${newSessionResponse.statusText}`);
      }

      const newSession = await newSessionResponse.json();
      const sessionId = newSession.id;
      this.currentSessionId = sessionId; // Track the current session
      console.log('[PromptEnhancementService] Created new session and set as current:', sessionId);
      console.log('[PromptEnhancementService] Session tracking initialized - will only accept events with sessionID:', sessionId);

      // Create the request payload using the custom command as a message
      const requestPayload = {
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
      const response = await fetch(`http://localhost:${this.port}/session/${sessionId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) {
        throw new Error(`SuperCode request failed: ${response.statusText}`);
      }

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
    this.globalProcessedResearch.clear();
    this.currentSessionId = null; // Clear session tracking
  }

  /**
   * Get the current session ID
   */
  public getCurrentSessionId(): string | null {
    return this.currentSessionId;
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
      this.currentSessionId = null;
      // Don't clear existing research - we want to append to it
      this.isProcessing = true;

      // Create a new session for the follow-up enhancement
      console.log('[PromptEnhancementService] Creating new session for follow-up with provider:', providerId, 'model:', modelId);
      const sessionResponse = await fetch(`http://localhost:${this.port}/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          directory: '.',  // Use current directory since we're in browser context
          projectID: 'vscode-webview',
          providerID: providerId,
          modelID: modelId
        })
      });

      if (!sessionResponse.ok) {
        throw new Error(`Failed to create session: ${sessionResponse.statusText}`);
      }

      const sessionData = await sessionResponse.json();
      console.log('[PromptEnhancementService] Session creation response:', sessionData);

      // The API returns 'id' not 'sessionId'
      const sessionId = sessionData.id || sessionData.sessionId;

      if (!sessionId) {
        console.error('[PromptEnhancementService] Session creation response missing ID:', sessionData);
        throw new Error('Session creation response missing ID');
      }

      this.currentSessionId = sessionId; // Track the current session for follow-up
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
      const messageResponse = await fetch(`http://localhost:${this.port}/session/${sessionId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parts: [
            {
              type: 'text',
              text: followUpPrompt
            }
          ],
          providerID: providerId,
          modelID: modelId
        })
      });

      if (!messageResponse.ok) {
        throw new Error(`Failed to send follow-up message: ${messageResponse.statusText}`);
      }

      // Process the streaming response - similar to processStreamingResponse
      const reader = messageResponse.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      const processedResearchContent = new Set<string>();

      if (reader) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            fullContent += chunk;

            // Process streaming research from the chunk immediately
            this.processStreamingResearch(chunk, processedResearchContent);

            // Try to parse as JSON for structured responses
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));

                  // Process different message types
                  if (data.type === 'content' && data.text) {
                    // Extract and process any inline research updates
                    this.processStreamingResearch(data.text, processedResearchContent);
                  } else if (data.type === 'message.part.updated' && data.text) {
                    // Handle accumulated text updates
                    this.processStreamingResearch(data.text, processedResearchContent);
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      }

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
      const enhancedResult = this.parseEnhancedPrompt(textContent.trim());

      if (enhancedResult) {
        this.enhancedPrompt = enhancedResult.prompt;
        this.metadata = enhancedResult.metadata;
        console.log('[PromptEnhancementService] Follow-up: Successfully parsed enhanced prompt:', this.enhancedPrompt.length, 'chars');
      } else {
        console.warn('[PromptEnhancementService] Follow-up: Failed to parse XML, using raw text as fallback');
        this.enhancedPrompt = enhancedText.trim();
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