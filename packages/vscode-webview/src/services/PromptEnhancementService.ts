/**
 * Prompt Enhancement Service
 * Handles intelligent prompt enhancement with research and analysis
 * Connects to real SuperCode client on port 25716 and parses XML responses
 */

import { SuperCodeWebSocketClient } from './SuperCodeWebSocketClient';

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
}

export interface EnhancementResult {
  enhancedPrompt: string;
  metadata: EnhancedPromptMetadata;
  researchItems: ResearchItem[];
  clarificationQuestions?: ClarificationQuestion[];
  processingTime: number;
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
    // Filter out messages from other sessions
    if (this.currentSessionId && part.sessionId !== this.currentSessionId) {
      console.log('[PromptEnhancementService] Ignoring message from different session:', part.sessionId, '!==', this.currentSessionId);
      return;
    }

    console.log('[PromptEnhancementService] Received WebSocket message part for current session:', part);

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
  private async processStreamingResponse(response: Response): Promise<EnhancementResult> {
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

      return {
        enhancedPrompt: this.enhancedPrompt,
        metadata: this.metadata || {
          complexity: 'moderate',
          domains: [],
          technologies: [],
          patterns: []
        },
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
    modelId: string = 'claude-3-5-sonnet-latest'
  ): Promise<EnhancementResult> {
    console.log('[PromptEnhancementService] enhancePrompt called with:', {
      originalPrompt,
      clarificationAnswers,
      providerId,
      modelId
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

      // Prepare the prompt with XML generation instructions
      let fullPrompt = `Generate an enhanced prompt with XML formatting.

IMPORTANT INSTRUCTIONS:
1. Send <research-update> tags IMMEDIATELY as you discover each insight - don't wait until the end
2. Stream research findings in real-time as you analyze different aspects
3. Each research update should be sent as soon as it's discovered
4. After all research, provide the final <enhanced-prompt> with complete specification

REQUIRED XML FORMAT:
- <research-update type="analysis|pattern|requirement|best-practice" priority="high|medium|low">Send each finding immediately as discovered</research-update>
- <enhanced-prompt><metadata>...</metadata><content>Complete enhanced specification</content></enhanced-prompt>
- <clarification-needed>...</clarification-needed> if clarification is needed

STREAMING PROCESS:
1. Start analyzing and immediately output research updates
2. Don't accumulate findings - stream each one as you discover it
3. Continue streaming updates throughout your analysis
4. Finally provide the complete enhanced prompt

Original prompt to enhance:
${originalPrompt}`;

      console.log('[PromptEnhancementService] Full prompt to send:', fullPrompt);
      if (clarificationAnswers && clarificationAnswers.length > 0) {
        fullPrompt += '\n\nClarification Answers:\n';
        for (const qa of clarificationAnswers) {
          fullPrompt += `- ${qa.text}: ${qa.answer}\n`;
        }
      }

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
      return await this.processStreamingResponse(response);

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
    },
    providerId: string = 'anthropic',
    modelId: string = 'claude-3-5-sonnet-latest'
  ): Promise<EnhancementResult> {
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

      // Construct the follow-up prompt that includes context
      // Use the same XML format as the initial enhancement for consistency
      const followUpPrompt = `/enhance I have an original prompt: "${context.originalPrompt}"

You previously enhanced it to: "${context.currentEnhancedPrompt}"

The user has provided additional suggestions: "${context.followUpSuggestion}"

Please update the enhanced prompt to incorporate these follow-up suggestions while:
1. Maintaining the structure and quality of the current enhanced prompt
2. Adding the new requirements/refinements from the follow-up
3. Ensuring consistency and completeness
4. Providing any additional research insights needed for the new suggestions

Previous research context has ${context.previousResearch.length} items that should be considered.

IMPORTANT: Format your response using the same XML structure as before:
- Use <research-update> tags for any new research insights
- Use <enhanced-prompt> tag with <metadata> and <content> for the updated prompt
- Stream research findings in real-time as you discover them`;

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

      // Process the streaming response
      const reader = messageResponse.body?.getReader();
      const decoder = new TextDecoder();
      let enhancedText = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                // Process different message types
                if (data.type === 'content' && data.text) {
                  enhancedText += data.text;

                  // Extract and process any inline research updates
                  this.processStreamingResearch(data.text);
                } else if (data.type === 'message.complete') {
                  // Message is complete
                  break;
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      }

      // Process the enhanced prompt
      this.enhancedPrompt = enhancedText.trim();

      // Extract metadata from the enhanced prompt if present
      this.metadata = this.extractMetadata(this.enhancedPrompt);

      const result: EnhancementResult = {
        enhancedPrompt: this.enhancedPrompt,
        metadata: this.metadata,
        researchItems: this.researchItems.filter(item =>
          // Only return new research items from this follow-up
          !context.previousResearch.some(prev => prev.id === item.id)
        ),
        clarificationQuestions: []
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