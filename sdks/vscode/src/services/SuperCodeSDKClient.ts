// Use official SDK from local build
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
      const { createOpencodeClient } = await import('@kirmad/supercode-sdk');
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
      await client.tui.clearPrompt();
      await client.tui.appendPrompt({
        body: { text: content }
      });
      await client.tui.submitPrompt();
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
      const client = await this.ensureClient();
      const messages = await client.session.messages({
        path: { id: sessionId }
      });
      return (messages as { data?: unknown[] }).data || [];
    } catch (error) {
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
   * Get available AI providers (if available in SDK)
   */
  async getProviders(): Promise<unknown> {
    try {
      const client = await this.ensureClient();
      // This might need to be implemented depending on what's available in the SDK
      const config = await client.config.get();
      return (config as { data?: unknown }).data || {};
    } catch (error) {
      throw new Error(`Failed to get providers: ${error instanceof Error ? error.message : 'Unknown error'}`);
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