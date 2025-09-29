/**
 * SuperCode WebSocket Client
 * WebSocket-based implementation of the SuperCode SDK Client
 */

import { SSEMessage } from '../types/SuperCodeTypes';
import { WebSocketClient } from './WebSocketClient';

export interface SuperCodeWebSocketClientConfig {
  baseUrl: string;
  port: number;
  timeout: number;
  sessionId?: string;
  directory?: string;
}

export type SSEMessageHandler = (message: SSEMessage) => void;
export type SSEErrorHandler = (error: Error) => void;
export type SSEOpenHandler = () => void;

export class SuperCodeWebSocketClient {
  private wsClient: WebSocketClient;
  private config: SuperCodeWebSocketClientConfig;
  private handlers: {
    message: Set<SSEMessageHandler>;
    error: Set<SSEErrorHandler>;
    open: Set<SSEOpenHandler>;
  } = {
    message: new Set(),
    error: new Set(),
    open: new Set(),
  };
  private eventUnsubscribers: (() => void)[] = [];
  private connected = false;
  private connectingPromise: Promise<void> | null = null;

  constructor(config: SuperCodeWebSocketClientConfig) {
    this.config = config;
    
    // Create WebSocket client with proper URL (server expects connections at root, not /ws)
    const wsUrl = `ws://localhost:${config.port}`;
    this.wsClient = new WebSocketClient({
      url: wsUrl,
      sessionId: config.sessionId,
      directory: config.directory || '',
      autoReconnect: true,
      reconnectDelay: 1000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
    });
  }

  /**
   * Initialize WebSocket connection with race condition protection
   */
  private async ensureConnected(): Promise<void> {
    // If already connected, return immediately
    if (this.connected && this.wsClient.isConnected) {
      return;
    }

    // If a connection is in progress, wait for it
    if (this.connectingPromise) {
      return this.connectingPromise;
    }

    // Start a new connection
    this.connectingPromise = (async () => {
      try {
        // Double-check in case another thread connected while we were waiting
        if (!this.connected || !this.wsClient.isConnected) {
          await this.wsClient.connect();
          
          // Wait a bit for the connection to stabilize
          await new Promise(resolve => setTimeout(resolve, 100));
          
          this.connected = true;
          
          // Notify open handlers
          this.handlers.open.forEach(handler => {
            try {
              handler();
            } catch (error) {
              console.error('Error in open handler:', error);
            }
          });
        }
      } finally {
        this.connectingPromise = null;
      }
    })();

    return this.connectingPromise;
  }

  /**
   * Test connection to SuperCode server with retry logic
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.ensureConnected();
      await this.wsClient.ping();
      return true;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * Wait for connection to be established
   * Used by UI to ensure server is ready before proceeding
   */
  async waitForConnection(maxRetries: number = 10, retryDelay: number = 1000): Promise<boolean> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        if (await this.testConnection()) {
          console.log(`✅ Connection established after ${i + 1} attempts`);
          return true;
        }
      } catch (error) {
        console.log(`Connection attempt ${i + 1}/${maxRetries} failed:`, error);
      }
      
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    console.error(`Failed to establish connection after ${maxRetries} attempts`);
    return false;
  }

  /**
   * Get server health status
   */
  async getHealth(): Promise<{ healthy: boolean; details?: unknown }> {
    try {
      await this.ensureConnected();
      const config = await this.wsClient.request('GET', '/config');
      return { healthy: true, details: config };
    } catch (error) {
      return { healthy: false, details: { error: error instanceof Error ? error.message : 'Unknown error' } };
    }
  }

  /**
   * Send a message using WebSocket
   */
  async sendMessage(_sessionId: string, content: string, _messageId?: string): Promise<void> {
    try {
      await this.ensureConnected();
      
      // Clear, append, and submit prompt sequence
      await this.wsClient.request('POST', '/tui/clear-prompt', { body: {} });
      await this.wsClient.request('POST', '/tui/append-prompt', { body: { text: content } });
      await this.wsClient.request('POST', '/tui/submit-prompt', { body: {} });
    } catch (error) {
      console.error('Failed to send message via WebSocket:', error);
      throw new Error(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear the current prompt
   */
  async clearPrompt(): Promise<void> {
    try {
      await this.ensureConnected();
      await this.wsClient.request('POST', '/tui/clear-prompt', { body: {} });
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
      await this.ensureConnected();
      await this.wsClient.request('POST', '/tui/append-prompt', { body: { text } });
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
      await this.ensureConnected();
      await this.wsClient.request('POST', '/tui/submit-prompt', { body: {} });
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
      await this.ensureConnected();
      await this.wsClient.request('POST', '/tui/cancel-prompt', { body: {} });
      console.log('Cancellation request sent successfully');
    } catch (error) {
      console.error('Failed to cancel prompt:', error);
      throw new Error(`Failed to cancel prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear the current session
   */
  async clearSession(): Promise<void> {
    try {
      await this.ensureConnected();
      await this.wsClient.request('POST', '/tui/clear-session', { body: {} });
      console.log('Session clear request sent successfully');
    } catch (error) {
      console.error('Failed to clear session:', error);
      throw new Error(`Failed to clear session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Subscribe to events using WebSocket
   */
  async subscribeToEvents(): Promise<void> {
    try {
      await this.ensureConnected();
      console.log('🔌 Starting WebSocket event subscription...');
      
      // Wait a bit more to ensure the connection is fully ready
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Verify connection is still active
      if (!this.wsClient.isConnected) {
        throw new Error('WebSocket connection lost during event subscription');
      }
      
      // IMPORTANT: We use a special internal listener that doesn't send subscribe messages
      // This keeps the server's subscriptions.size === 0, allowing us to receive ALL Bus events
      
      // Set up a raw event listener that intercepts all events
      // We manually add to the eventListeners map without triggering the subscription logic
      const handleAllEvents = (eventData: { event: string; data: any }) => {
        try {
          // Log all events to see what we're getting
          console.log('🔔 WebSocket raw event received:', eventData.event, eventData.data);

          // Convert WebSocket event to SSE message format
          // Map 'data' to 'properties' to match the expected SSE format
          const sseMessage: SSEMessage = {
            type: eventData.event || 'message',
            properties: eventData.data,  // Map data to properties
            data: eventData.data,  // Keep data as well for compatibility
            timestamp: Date.now()
          };

          // Notify all message handlers
          this.handlers.message.forEach(handler => {
            try {
              handler(sseMessage);
            } catch (error) {
              console.error('Error in message handler:', error);
            }
          });

          console.log('📨 WebSocket event converted to SSE:', sseMessage.type);
        } catch (error) {
          console.error('Failed to process WebSocket event:', error);
          
          // Notify error handlers
          this.handlers.error.forEach(handler => {
            handler(error as Error);
          });
        }
      };
      
      // Directly access the WebSocketClient's internal event listener map
      // to add our handler without triggering a subscribe message
      if (!(this.wsClient as any).eventListeners) {
        (this.wsClient as any).eventListeners = new Map();
      }
      
      const eventListeners = (this.wsClient as any).eventListeners as Map<string, Set<(data: any) => void>>;
      
      // Add to wildcard listeners without sending subscribe
      if (!eventListeners.has('*')) {
        eventListeners.set('*', new Set());
      }
      eventListeners.get('*')!.add(handleAllEvents);
      
      // Store the unsubscriber
      this.eventUnsubscribers.push(() => {
        const listeners = eventListeners.get('*');
        if (listeners) {
          listeners.delete(handleAllEvents);
          if (listeners.size === 0) {
            eventListeners.delete('*');
          }
        }
      });
      
      console.log('✅ WebSocket event subscription established (receiving all Bus events via wildcard)');
    } catch (error) {
      console.error('Failed to subscribe to events:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from events
   */
  unsubscribeFromEvents(): void {
    this.eventUnsubscribers.forEach(unsubscribe => unsubscribe());
    this.eventUnsubscribers = [];
    console.log('WebSocket event subscriptions cleared');
  }

  /**
   * Check if event stream is connected
   */
  isEventStreamConnected(): boolean {
    return this.wsClient.isConnected;
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
   * Create a new session
   */
  async createSession(title?: string): Promise<unknown> {
    try {
      await this.ensureConnected();
      const session = await this.wsClient.request('POST', '/session', {
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
      await this.ensureConnected();
      const sessions = await this.wsClient.request('GET', '/session');
      return Array.isArray(sessions) ? sessions : [];
    } catch (error) {
      throw new Error(`Failed to get sessions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get session messages
   */
  async getSessionMessages(sessionId: string): Promise<unknown[]> {
    try {
      await this.ensureConnected();
      const messages = await this.wsClient.request('GET', `/session/${sessionId}/message`);
      return Array.isArray(messages) ? messages : [];
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
      await this.ensureConnected();
      await this.wsClient.request('DELETE', `/session/${sessionId}`);
    } catch (error) {
      throw new Error(`Failed to delete session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get available AI providers
   */
  async getProviders(): Promise<unknown> {
    try {
      await this.ensureConnected();
      const providers = await this.wsClient.request('GET', '/config/providers');
      return providers;
    } catch (error) {
      throw new Error(`Failed to get providers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current model/provider information
   */
  async getCurrentModel(): Promise<{ name: string; provider: string; modelId?: string; version?: string }> {
    try {
      await this.ensureConnected();
      const modelData = await this.wsClient.request('GET', '/tui/get-model');

      if (modelData && ((modelData as any).modelName || (modelData as any).modelID)) {
        const modelName = (modelData as any).modelName || (modelData as any).modelID || 'Unknown Model';
        const providerName = (modelData as any).providerName || (modelData as any).providerID || 'Unknown Provider';
        const modelId = (modelData as any).modelID || undefined;
        const providerId = (modelData as any).providerID || undefined;

        return {
          name: modelName,
          provider: providerId || providerName,
          modelId: modelId,
          version: ''
        };
      }

      return {
        name: 'Model Unavailable',
        provider: '',
        modelId: undefined,
        version: ''
      };
    } catch (error) {
      console.error('Failed to get current model:', error);
      return {
        name: 'Model Unavailable',
        provider: '',
        modelId: undefined,
        version: ''
      };
    }
  }

  /**
   * Get current agent information
   */
  async getCurrentAgent(): Promise<{ name: string; description?: string }> {
    try {
      await this.ensureConnected();
      console.log('🔍 Fetching current agent via WebSocket...');
      
      const agentData = await this.wsClient.request('GET', '/tui/get-agent');
      console.log('📋 Agent data from WebSocket:', agentData);
      
      if (agentData) {
        const agentName = (agentData as any).name || 
                         (agentData as any).agentName || 
                         (agentData as any).displayName || '';
        const agentDescription = (agentData as any).description || 
                                (agentData as any).desc || '';
        
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
      console.error('❌ Failed to get current agent:', error);
      return {
        name: 'Agent Unavailable',
        description: ''
      };
    }
  }

  /**
   * Set current model
   */
  async setModel(providerID: string, modelID: string): Promise<boolean> {
    try {
      await this.ensureConnected();
      const result = await this.wsClient.request('POST', '/tui/set-model', {
        body: {
          providerID,
          modelID,
        }
      });
      return result === true || (result as any).success === true;
    } catch (error) {
      console.error('Failed to set model:', error);
      throw new Error(`Failed to set model: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get available agents
   */
  async getAvailableAgents(): Promise<unknown[]> {
    try {
      await this.ensureConnected();
      console.log('🔍 Fetching available agents via WebSocket...');
      
      const agents = await this.wsClient.request('GET', '/agent');
      console.log('📋 Agents data from WebSocket:', agents);
      
      if (Array.isArray(agents)) {
        return agents;
      }
      
      console.warn('⚠️ Unexpected agent data format:', agents);
      return [];
    } catch (error) {
      console.error('❌ Failed to get available agents:', error);
      throw new Error(`Failed to get available agents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Set current agent
   */
  async setAgent(agentId: string): Promise<boolean> {
    try {
      await this.ensureConnected();
      const result = await this.wsClient.request('POST', '/tui/set-agent', {
        body: {
          agentName: agentId,
        }
      });
      return result === true || (result as any).success === true;
    } catch (error) {
      console.error('Failed to set agent:', error);
      throw new Error(`Failed to set agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current output style
   */
  async getCurrentOutputStyle(): Promise<{ name: string; description?: string }> {
    try {
      await this.ensureConnected();
      console.log('🎨 Fetching current output style via WebSocket...');

      const styleData = await this.wsClient.request('GET', '/tui/get-output-style');
      console.log('📋 Output style data from WebSocket:', styleData);

      if (styleData && (styleData as any).styleName) {
        const styleName = (styleData as any).styleName || 'default';

        // Map style names to descriptions
        const styleDescriptions: Record<string, string> = {
          'default': 'Concise and direct responses',
          'explanatory': 'Educational insights with helpful explanations',
          'learning': 'Learning-focused with detailed explanations'
        };

        const result = {
          name: styleName,
          description: styleDescriptions[styleName] || ''
        };

        console.log('✅ Output style info retrieved:', result);
        return result;
      }

      console.warn('⚠️ No valid output style found in response:', styleData);
      return {
        name: 'default',
        description: 'Concise and direct responses'
      };
    } catch (error) {
      console.error('❌ Failed to get current output style:', error);
      return {
        name: 'default',
        description: 'Concise and direct responses'
      };
    }
  }

  /**
   * Set current output style
   */
  async setOutputStyle(styleName: string): Promise<boolean> {
    try {
      await this.ensureConnected();
      console.log('🎨 Setting output style via WebSocket:', styleName);

      const result = await this.wsClient.request('POST', '/tui/update-output-style', {
        body: {
          styleName,
        }
      });

      console.log('📋 Set output style result:', result);
      return result === true || (result as any).success === true;
    } catch (error) {
      console.error('Failed to set output style:', error);
      throw new Error(`Failed to set output style: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get available output styles
   */
  async getAvailableOutputStyles(): Promise<Array<{ id: string; name: string; description: string }>> {
    try {
      await this.ensureConnected();
      console.log('🎨 Fetching available output styles...');

      // Since there's no dedicated endpoint for available styles, return the hardcoded list
      // This matches the styles available in the OpenCode system
      const styles = [
        {
          id: 'default',
          name: 'Default',
          description: 'Concise and direct responses'
        },
        {
          id: 'explanatory',
          name: 'Explanatory',
          description: 'Educational insights with helpful explanations'
        },
        {
          id: 'learning',
          name: 'Learning',
          description: 'Learning-focused with detailed explanations'
        }
      ];

      console.log('✅ Available output styles:', styles);
      return styles;
    } catch (error) {
      console.error('❌ Failed to get available output styles:', error);
      // Return default styles even on error
      return [
        {
          id: 'default',
          name: 'Default',
          description: 'Concise and direct responses'
        }
      ];
    }
  }

  /**
   * Get current token usage
   */
  async getTokenUsage(): Promise<{ used: number; max: number; percentage: number }> {
    try {
      await this.ensureConnected();
      
      const sessions = await this.getSessions();
      const sessionsData = sessions as any[];
      
      console.log('Found sessions for token usage:', sessionsData.length);
      
      if (sessionsData && sessionsData.length > 0) {
        const recentSession = sessionsData[0];
        console.log('Recent session ID for tokens:', recentSession.id);
        
        const messages = await this.getSessionMessages(recentSession.id);
        const messagesData = messages as any[];
        
        console.log('Found messages for token analysis:', messagesData.length);
        
        let contextWindow = 128000;
        try {
          const modelInfo = await this.getCurrentModel();
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
        
        let totalTokens = 0;
        
        for (const message of messagesData) {
          if (message.info?.role === 'assistant' && message.info?.tokens) {
            const tokens = message.info.tokens;
            console.log('Processing assistant message tokens:', tokens);
            
            const messageTokens = (tokens.input || 0) + 
                                  (tokens.cache?.write || 0) + 
                                  (tokens.cache?.read || 0) + 
                                  (tokens.output || 0) + 
                                  (tokens.reasoning || 0);
            
            if (tokens.output > 0) {
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
    
    if (formatted.endsWith('.0K')) {
      formatted = formatted.replace('.0K', 'K');
    }
    if (formatted.endsWith('.0M')) {
      formatted = formatted.replace('.0M', 'M');
    }
    
    return formatted;
  }

  /**
   * Get formatted token usage string
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
   * Get currently active session
   */
  async getActiveSession(): Promise<{ sessionID?: string; sessionInfo?: any } | null> {
    try {
      await this.ensureConnected();
      const activeSessionData = await this.wsClient.request('GET', '/tui/active-session');
      
      if (activeSessionData && (activeSessionData as any).sessionID) {
        return activeSessionData as any;
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
      connected: this.wsClient.isConnected,
      eventStream: this.wsClient.isConnected
    };
  }

  /**
   * Get all custom commands
   */
  async getCustomCommands(sessionId?: string): Promise<unknown[]> {
    try {
      await this.ensureConnected();
      let path = '/custom-commands';
      if (sessionId) {
        path += `?sessionId=${encodeURIComponent(sessionId)}`;
      }
      
      const commands = await this.wsClient.request('GET', path);
      return Array.isArray(commands) ? commands : [];
    } catch (error) {
      console.error('Failed to get custom commands via WebSocket:', error);
      return [];
    }
  }

  /**
   * Get custom command completions for auto-complete
   */
  async getCustomCommandCompletions(prefix: string, sessionId?: string): Promise<unknown[]> {
    try {
      await this.ensureConnected();
      let path = `/custom-commands/complete?prefix=${encodeURIComponent(prefix)}`;
      if (sessionId) {
        path += `&sessionId=${encodeURIComponent(sessionId)}`;
      }
      
      const commands = await this.wsClient.request('GET', path);
      return Array.isArray(commands) ? commands : [];
    } catch (error) {
      console.error('Failed to get custom command completions via WebSocket:', error);
      return [];
    }
  }

  /**
   * Get flag suggestions for command auto-completion
   */
  async getFlagSuggestions(input: string, prefix: string, sessionId?: string): Promise<unknown[]> {
    try {
      await this.ensureConnected();
      let path = `/flag-suggestions?input=${encodeURIComponent(input)}&prefix=${encodeURIComponent(prefix)}`;
      if (sessionId) {
        path += `&sessionId=${encodeURIComponent(sessionId)}`;
      }
      
      const suggestions = await this.wsClient.request('GET', path);
      return Array.isArray(suggestions) ? suggestions : [];
    } catch (error) {
      console.error('Failed to get flag suggestions via WebSocket:', error);
      return [];
    }
  }

  /**
   * Disconnect WebSocket with proper cleanup
   */
  async disconnect(): Promise<void> {
    try {
      // Clear all event subscriptions first
      this.unsubscribeFromEvents();
      
      // Clear connection promise to prevent race conditions
      this.connectingPromise = null;
      
      // Disconnect the WebSocket client
      if (this.wsClient) {
        await this.wsClient.disconnect();
      }
      
      // Reset connection state
      this.connected = false;
      
      // Clear all handlers
      this.handlers.message.clear();
      this.handlers.error.clear();
      this.handlers.open.clear();
    } catch (error) {
      console.error('Error during disconnect:', error);
      // Force reset state even if disconnect fails
      this.connected = false;
      this.connectingPromise = null;
    }
  }
}