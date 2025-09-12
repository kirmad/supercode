// Use official SDK - relative import for development, switch to '@kirmad/supercode-sdk/client' when publishing
import { SSEMessage } from '../types/SuperCodeTypes';

// Type imports for SDK
type OpencodeClient = any; // Will be properly typed after dynamic import

export interface SuperCodeSDKClientConfig {
  baseUrl: string;
  port: number;
  timeout: number;
}

export type SSEMessageHandler = (message: SSEMessage) => void;
export type SSEErrorHandler = (error: Error) => void;
export type SSEOpenHandler = () => void;

export class SuperCodeSDKClient {
  private client: OpencodeClient | null = null;
  private clientInitialized: Promise<void>;
  private sseSubscription: unknown = null;
  private handlers: {
    message: Set<SSEMessageHandler>;
    error: Set<SSEErrorHandler>;
    open: Set<SSEOpenHandler>;
  } = {
    message: new Set(),
    error: new Set(),
    open: new Set(),
  };

  constructor(private config: SuperCodeSDKClientConfig) {
    // Initialize client asynchronously
    this.clientInitialized = this.initializeClient();
  }

  private async initializeClient(): Promise<void> {
    try {
      // Use relative import for development in monorepo, but structure for easy switch to published package
      const { createOpencodeClient } = await import('../../../sdk/js/dist/client.js');
      this.client = createOpencodeClient({
        baseUrl: `http://localhost:${this.config.port}`,
      });
    } catch (error) {
      console.error('Failed to initialize SDK client:', error);
      throw new Error(`Failed to initialize SuperCode SDK: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async ensureClient(): Promise<OpencodeClient> {
    await this.clientInitialized;
    if (!this.client) {
      throw new Error('SDK client not initialized');
    }
    return this.client;
  }

  /**
   * Test connection to SuperCode server
   */
  async testConnection(): Promise<boolean> {
    try {
      const client = await this.ensureClient();
      await client.config.get();
      return true;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * Get server health status
   */
  async getHealth(): Promise<{ healthy: boolean; details?: unknown }> {
    try {
      const client = await this.ensureClient();
      const config = await client.config.get();
      return { healthy: true, details: config };
    } catch (error) {
      return { healthy: false, details: { error: error instanceof Error ? error.message : 'Unknown error' } };
    }
  }

  /**
   * Send a message using the official SDK (RECOMMENDED APPROACH)
   */
  async sendMessage(_sessionId: string, content: string, _messageId?: string): Promise<void> {
    try {
      const client = await this.ensureClient();
      // Use the official SDK methods - same endpoints but with proper typing and error handling
      await client.tui.clearPrompt({
        body: {}
      });
      await client.tui.appendPrompt({
        body: { text: content }
      });
      await client.tui.submitPrompt({
        body: {}
      });
    } catch (error) {
      console.error('Failed to send message via SDK:', error);
      throw new Error(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear the current prompt
   */
  async clearPrompt(): Promise<void> {
    try {
      const client = await this.ensureClient();
      await client.tui.clearPrompt({
        body: {}
      });
    } catch (error) {
      console.error('Failed to clear prompt:', error);
      throw new Error(`Failed to clear prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Add text to the current prompt
   */
  async addPrompt(text: string): Promise<void> {
    try {
      const client = await this.ensureClient();
      await client.tui.appendPrompt({
        body: { text }
      });
    } catch (error) {
      console.error('Failed to add prompt:', error);
      throw new Error(`Failed to add prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Submit the current prompt to trigger agent response
   */
  async submitPrompt(): Promise<void> {
    try {
      const client = await this.ensureClient();
      await client.tui.submitPrompt({
        body: {}
      });
    } catch (error) {
      console.error('Failed to submit prompt:', error);
      throw new Error(`Failed to submit prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Cancel the currently running prompt
   */
  async cancelPrompt(): Promise<void> {
    try {
      // Use direct HTTP call since the generated client method may not be properly available
      const response = await fetch(`${this.config.baseUrl}/tui/cancel-prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      console.log('Cancellation request sent successfully');
    } catch (error) {
      console.error('Failed to cancel prompt:', error);
      throw new Error(`Failed to cancel prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Subscribe to SSE events using the official SDK
   */
  async subscribeToEvents(): Promise<void> {
    try {
      const client = await this.ensureClient();
      console.log('Starting SSE subscription via official SDK...');
      
      // Use the official SDK's SSE subscription with proper event handler
      this.sseSubscription = await client.event.subscribe({
        onSseEvent: (event: any) => {
          try {
            console.log('SDK SSE event received:', event);
            // The event object contains { data, event, id, retry }
            // We need the data property which contains the actual message
            const data: SSEMessage = event.data;
            this.handlers.message.forEach(handler => handler(data));
          } catch (error) {
            console.error('Failed to process SDK SSE event:', error, event);
          }
        },
        onSseError: (error: any) => {
          console.error('SDK SSE error:', error);
          this.handlers.error.forEach(handler => handler(new Error(`SSE error: ${error.message || error}`)));
        }
      });
      
      // Start consuming the stream to activate the subscription
      if (this.sseSubscription && (this.sseSubscription as any).stream) {
        console.log('✅ Starting to consume SSE stream...');
        // We don't need to await this - it runs in the background
        this.consumeStream();
      }

      console.log('✅ SDK SSE subscription established');

    } catch (error) {
      console.error('Failed to subscribe to events via SDK:', error);
      throw error;
    }
  }

  /**
   * Consume the SSE stream in the background
   */
  private async consumeStream(): Promise<void> {
    try {
      const subscription = this.sseSubscription as any;
      if (subscription && subscription.stream) {
        // Iterate through the async generator
        for await (const data of subscription.stream) {
          console.log('Stream data received:', data);
          // Data is already processed by onSseEvent, but we can add additional handling here if needed
        }
      }
    } catch (error) {
      console.error('Stream consumption error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.handlers.error.forEach(handler => handler(new Error(`Stream error: ${errorMessage}`)));
    }
  }

  /**
   * Unsubscribe from SSE events
   */
  unsubscribeFromEvents(): void {
    if (this.sseSubscription) {
      console.log('Closing SDK SSE subscription...');
      const subscription = this.sseSubscription as any;
      if (subscription && typeof subscription.close === 'function') {
        subscription.close();
      }
      this.sseSubscription = null;
    }
  }

  /**
   * Check if SSE is connected
   */
  isEventStreamConnected(): boolean {
    return this.sseSubscription !== null;
  }

  /**
   * Add message handler
   */
  onMessage(handler: SSEMessageHandler): void {
    this.handlers.message.add(handler);
  }

  /**
   * Remove message handler
   */
  offMessage(handler: SSEMessageHandler): void {
    this.handlers.message.delete(handler);
  }

  /**
   * Add error handler
   */
  onError(handler: SSEErrorHandler): void {
    this.handlers.error.add(handler);
  }

  /**
   * Remove error handler
   */
  offError(handler: SSEErrorHandler): void {
    this.handlers.error.delete(handler);
  }

  /**
   * Add open handler
   */
  onOpen(handler: SSEOpenHandler): void {
    this.handlers.open.add(handler);
  }

  /**
   * Remove open handler
   */
  offOpen(handler: SSEOpenHandler): void {
    this.handlers.open.delete(handler);
  }

  /**
   * Create a new session (if needed)
   */
  async createSession(title?: string): Promise<unknown> {
    try {
      const client = await this.ensureClient();
      const session = await client.session.create({
        body: {
          title: title || `VSCode Session ${new Date().toLocaleTimeString()}`
        }
      });
      return session;
    } catch (error) {
      throw new Error(`Failed to create session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all sessions
   */
  async getSessions(): Promise<unknown[]> {
    try {
      const client = await this.ensureClient();
      const sessions = await client.session.list();
      return (sessions as { data?: unknown[] }).data || [];
    } catch (error) {
      throw new Error(`Failed to get sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get session messages
   */
  async getSessionMessages(sessionId: string): Promise<unknown[]> {
    try {
      const response = await fetch(`http://localhost:${this.config.port}/session/${sessionId}/message`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const messages = await response.json();
      const result = Array.isArray(messages) ? messages : [];
      return result;
    } catch (error) {
      console.error('Failed to get session messages:', error);
      throw new Error(`Failed to get session messages: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      const client = await this.ensureClient();
      await client.session.delete({
        path: { id: sessionId }
      });
    } catch (error) {
      throw new Error(`Failed to delete session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get available AI providers
   */
  async getProviders(): Promise<unknown> {
    try {
      const client = await this.ensureClient();
      const response = await fetch(`http://localhost:${this.config.port}/config/providers`);
      const providers = await response.json();
      return providers;
    } catch (error) {
      throw new Error(`Failed to get providers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current model/provider information using new TUI API
   */
  async getCurrentModel(): Promise<{ name: string; provider: string; version?: string }> {
    try {
      const response = await fetch(`http://localhost:${this.config.port}/tui/get-model`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const modelData = await response.json();
      
      if (modelData && (modelData.modelName || modelData.modelID)) {
        const modelName = modelData.modelName || modelData.modelID || 'Unknown Model';
        const providerName = modelData.providerName || modelData.providerID || 'Unknown Provider';
        
        return {
          name: modelName,
          provider: providerName,
          version: ''
        };
      }
      
      return {
        name: 'Model Unavailable',
        provider: '',
        version: ''
      };
    } catch (error) {
      console.error('Failed to get current model:', error);
      return {
        name: 'Model Unavailable',
        provider: '',
        version: ''
      };
    }
  }

  /**
   * Get current agent information using new TUI API
   */
  async getCurrentAgent(): Promise<{ name: string; description?: string }> {
    try {
      console.log('🔍 Fetching current agent from /tui/get-agent API...');
      
      // Use the new TUI API endpoint
      const response = await fetch(`http://localhost:${this.config.port}/tui/get-agent`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const agentData = await response.json();
      console.log('📋 Agent data from TUI API:', agentData);
      
      // Handle different possible response formats
      let agentName = '';
      let agentDescription = '';
      
      if (agentData) {
        // Try different possible field names that TUI might use
        agentName = agentData.name || agentData.agentName || agentData.displayName || '';
        agentDescription = agentData.description || agentData.desc || '';
        
        // If we found a valid agent name, return it
        if (agentName && agentName.trim()) {
          const result = {
            name: agentName,
            description: agentDescription
          };
          
          console.log('✅ Agent info retrieved:', result);
          return result;
        }
      }
      
      console.warn('⚠️ No valid agent name found in response:', agentData);
      return {
        name: 'Agent Unavailable',
        description: ''
      };
    } catch (error) {
      console.error('❌ Failed to get current agent from TUI API:', error);
      return {
        name: 'Agent Unavailable',
        description: ''
      };
    }
  }

  /**
   * Set current model in TUI
   */
  async setModel(providerID: string, modelID: string): Promise<boolean> {
    try {
      const response = await fetch(`http://localhost:${this.config.port}/tui/set-model`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          providerID,
          modelID,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result === true || result.success === true;
    } catch (error) {
      console.error('Failed to set model:', error);
      throw new Error(`Failed to set model: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get available agents using the proper /agent endpoint
   */
  async getAvailableAgents(): Promise<unknown[]> {
    try {
      console.log('🔍 Fetching available agents from /agent API...');
      
      // Use the proper agent endpoint that returns Agent.Info.array()
      const response = await fetch(`http://localhost:${this.config.port}/agent`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const agents = await response.json();
      console.log('📋 Agents data from /agent API:', agents);
      
      // The /agent endpoint directly returns an array of Agent.Info objects
      if (Array.isArray(agents)) {
        return agents;
      }
      
      console.warn('⚠️ Unexpected agent data format:', agents);
      return [];
    } catch (error) {
      console.error('❌ Failed to get available agents from /agent API:', error);
      throw new Error(`Failed to get available agents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Set current agent in TUI
   */
  async setAgent(agentId: string): Promise<boolean> {
    try {
      const response = await fetch(`http://localhost:${this.config.port}/tui/set-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentName: agentId,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      return result === true || result.success === true;
    } catch (error) {
      console.error('Failed to set agent:', error);
      throw new Error(`Failed to set agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current token usage information using TUI approach
   */
  async getTokenUsage(): Promise<{ used: number; max: number; percentage: number }> {
    try {
      const client = await this.ensureClient();
      
      // Get recent sessions to find the active one
      const sessions = await this.getSessions();
      const sessionsData = sessions as any[];
      
      console.log('Found sessions for token usage:', sessionsData.length);
      
      if (sessionsData && sessionsData.length > 0) {
        // Get the most recent session
        const recentSession = sessionsData[0];
        console.log('Recent session ID for tokens:', recentSession.id);
        
        // Get ALL messages from the session to sum tokens (TUI approach)
        const messages = await this.getSessionMessages(recentSession.id);
        const messagesData = messages as any[];
        
        console.log('Found messages for token analysis:', messagesData.length);
        
        // Get current model's context window limit
        let contextWindow = 128000; // Default fallback
        try {
          const modelInfo = await this.getCurrentModel();
          // Try to get context window from providers config
          const providers = await this.getProviders();
          const providersData = providers as any;
          
          if (providersData?.providers) {
            for (const provider of providersData.providers) {
              if (provider.models) {
                for (const [modelKey, modelData] of Object.entries(provider.models)) {
                  if (modelData && typeof modelData === 'object' && 'limit' in modelData) {
                    const limit = (modelData as any).limit;
                    if (limit && limit.context) {
                      contextWindow = limit.context;
                      console.log('Found context window from model config:', contextWindow);
                      break;
                    }
                  }
                }
              }
            }
          }
        } catch (error) {
          console.warn('Could not get model context window, using default:', error);
        }
        
        // Sum ALL tokens from ALL assistant messages (TUI approach)
        let totalTokens = 0;
        
        for (const message of messagesData) {
          if (message.info?.role === 'assistant' && message.info?.tokens) {
            const tokens = message.info.tokens;
            console.log('Processing assistant message tokens:', tokens);
            
            // TUI logic: tokens = input + cache.write + cache.read + output + reasoning
            const messageTokens = (tokens.input || 0) + 
                                  (tokens.cache?.write || 0) + 
                                  (tokens.cache?.read || 0) + 
                                  (tokens.output || 0) + 
                                  (tokens.reasoning || 0);
            
            if (tokens.output > 0) {
              // For summary messages, only use output tokens
              if (message.info.summary) {
                totalTokens = tokens.output;
              } else {
                totalTokens = messageTokens;
              }
            }
          }
        }
        
        console.log('Total session tokens:', totalTokens, 'Context window:', contextWindow);
        
        if (totalTokens > 0) {
          const percentage = contextWindow > 0 ? Math.round((totalTokens / contextWindow) * 100) : 0;
          return { 
            used: totalTokens, 
            max: contextWindow, 
            percentage 
          };
        }
      }
      
      // No token usage data found
      console.log('No token usage data found in sessions');
      return { used: -1, max: -1, percentage: -1 };
    } catch (error) {
      console.error('Failed to get token usage:', error);
      return { used: -1, max: -1, percentage: -1 };
    }
  }

  /**
   * Format tokens using TUI formatting logic
   */
  private formatTokens(tokens: number): string {
    let formatted = '';
    
    if (tokens >= 1_000_000) {
      formatted = (tokens / 1_000_000).toFixed(1) + 'M';
    } else if (tokens >= 1_000) {
      formatted = (tokens / 1_000).toFixed(1) + 'K';
    } else {
      formatted = tokens.toString();
    }
    
    // Remove .0 suffix if present (TUI logic)
    if (formatted.endsWith('.0K')) {
      formatted = formatted.replace('.0K', 'K');
    }
    if (formatted.endsWith('.0M')) {
      formatted = formatted.replace('.0M', 'M');
    }
    
    return formatted;
  }

  /**
   * Get formatted token usage string like TUI: "26k/38%"
   */
  async getFormattedTokenUsage(): Promise<string> {
    try {
      const tokenData = await this.getTokenUsage();
      
      if (tokenData.used === -1 || tokenData.max === -1) {
        return 'Context Unavailable';
      }
      
      const formattedTokens = this.formatTokens(tokenData.used);
      return `${formattedTokens}/${tokenData.percentage}%`;
    } catch (error) {
      console.error('Failed to format token usage:', error);
      return 'Context Unavailable';
    }
  }

  /**
   * Get currently active session in TUI
   */
  async getActiveSession(): Promise<{ sessionID?: string; sessionInfo?: any } | null> {
    try {
      const response = await fetch(`http://localhost:${this.config.port}/tui/active-session`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const activeSessionData = await response.json();
      
      if (activeSessionData && activeSessionData.sessionID) {
        return activeSessionData;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Failed to get active session:', error);
      return null;
    }
  }

  /**
   * Get connection status
   */
  getStatus(): {
    connected: boolean;
    eventStream: boolean;
  } {
    return {
      connected: true, // We can add more sophisticated connection checking if needed
      eventStream: this.isEventStreamConnected()
    };
  }
}