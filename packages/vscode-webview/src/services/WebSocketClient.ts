/**
 * WebSocket Client for vscode-webview
 * Provides WebSocket-based communication with the OpenCode server
 */

import type { 
  WSRequestType, 
  WSResponseType, 
  WSEventType, 
  WSErrorType, 
  WSControlType,
  WSMessageType 
} from '../types/websocket';

export interface WebSocketClientOptions {
  url: string;
  sessionId?: string;
  directory?: string;
  autoReconnect?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

interface PendingRequest {
  resolve: (data: any) => void;
  reject: (error: any) => void;
  timeout: number;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private options: Required<WebSocketClientOptions>;
  private pendingRequests = new Map<string, PendingRequest>();
  private eventListeners = new Map<string, Set<(data: any) => void>>();
  private reconnectAttempts = 0;
  private reconnectTimeout: number | null = null;
  private heartbeatInterval: number | null = null;
  private messageCounter = 0;
  private isClosing = false;
  private connectionPromise: Promise<void> | null = null;
  private connectionResolver: (() => void) | null = null;
  private connectionRejector: ((error: Error) => void) | null = null;

  constructor(options: WebSocketClientOptions) {
    this.options = {
      url: options.url,
      sessionId: options.sessionId || '',
      directory: options.directory || '',
      autoReconnect: options.autoReconnect ?? true,
      reconnectDelay: options.reconnectDelay ?? 1000,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 10,
      heartbeatInterval: options.heartbeatInterval ?? 30000,
    };
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      this.connectionResolver = resolve;
      this.connectionRejector = reject;

      try {
        // Build connection URL with parameters
        const url = new URL(this.options.url);
        if (this.options.directory) {
          url.searchParams.set('directory', this.options.directory);
        }
        if (this.options.sessionId) {
          url.searchParams.set('sessionId', this.options.sessionId);
        }

        console.log('🔌 Connecting to WebSocket:', url.toString());

        // Create WebSocket connection
        this.ws = new WebSocket(url.toString());

        this.ws.onopen = () => {
          console.log('✅ WebSocket connected');
          this.reconnectAttempts = 0;
          this.setupHeartbeat();
          if (this.connectionResolver) {
            this.connectionResolver();
            this.connectionResolver = null;
            this.connectionRejector = null;
          }
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          if (this.connectionRejector) {
            this.connectionRejector(new Error('WebSocket connection failed'));
            this.connectionResolver = null;
            this.connectionRejector = null;
            this.connectionPromise = null;
          }
        };

        this.ws.onclose = (event) => {
          console.log('🔌 WebSocket closed', { code: event.code, reason: event.reason });
          this.cleanup();
          this.connectionPromise = null;
          
          if (this.options.autoReconnect && !this.isClosing) {
            this.attemptReconnect();
          }
        };
      } catch (error) {
        console.error('❌ Failed to create WebSocket:', error);
        if (this.connectionRejector) {
          this.connectionRejector(error as Error);
          this.connectionResolver = null;
          this.connectionRejector = null;
          this.connectionPromise = null;
        }
      }
    });

    return this.connectionPromise;
  }

  /**
   * Disconnect from WebSocket server
   */
  async disconnect(): Promise<void> {
    this.isClosing = true;
    this.cleanup();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.connectionPromise = null;
  }

  /**
   * Send API request over WebSocket
   */
  async request<T = any>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    params?: {
      query?: Record<string, any>;
      body?: any;
      headers?: Record<string, string>;
    }
  ): Promise<T> {
    // Ensure connected
    if (!this.isConnected && !this.connectionPromise) {
      await this.connect();
    }
    
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const id = this.generateId();
      const request: WSRequestType = {
        type: 'request',
        id,
        method,
        path,
        params,
        timestamp: Date.now(),
      };

      // Set up timeout
      const timeout = window.setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Request timeout'));
      }, 30000); // 30 second timeout

      // Store pending request
      this.pendingRequests.set(id, { resolve, reject, timeout });

      // Send request
      this.ws.send(JSON.stringify(request));
    });
  }

  /**
   * Subscribe to events
   */
  on(event: string, listener: (data: any) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
      
      // Send subscribe message
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const control: WSControlType = {
          type: 'control',
          action: 'subscribe',
          data: { events: [event] },
          timestamp: Date.now(),
        };
        this.ws.send(JSON.stringify(control));
      }
    }

    this.eventListeners.get(event)!.add(listener);

    // Return unsubscribe function
    return () => {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        listeners.delete(listener);
        
        if (listeners.size === 0) {
          this.eventListeners.delete(event);
          
          // Send unsubscribe message
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const control: WSControlType = {
              type: 'control',
              action: 'unsubscribe',
              data: { events: [event] },
              timestamp: Date.now(),
            };
            this.ws.send(JSON.stringify(control));
          }
        }
      }
    };
  }

  /**
   * Send ping message
   */
  async ping(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const id = this.generateId();
      const control: WSControlType = {
        type: 'control',
        action: 'ping',
        id,
        timestamp: Date.now(),
      };

      // Set up timeout
      const timeout = window.setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Ping timeout'));
      }, 5000);

      // Store pending request
      this.pendingRequests.set(id, {
        resolve,
        reject,
        timeout,
      });

      this.ws.send(JSON.stringify(control));
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: string) {
    try {
      const message = JSON.parse(data) as WSMessageType;

      switch (message.type) {
        case 'response':
          this.handleResponse(message);
          break;
        case 'event':
          this.handleEvent(message);
          break;
        case 'error':
          this.handleError(message);
          break;
        case 'control':
          this.handleControl(message);
          break;
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  /**
   * Handle response message
   */
  private handleResponse(response: WSResponseType) {
    const pending = response.id ? this.pendingRequests.get(response.id) : null;
    
    if (pending) {
      window.clearTimeout(pending.timeout);
      this.pendingRequests.delete(response.id!);
      
      if (response.error) {
        pending.reject(response.error);
      } else {
        pending.resolve(response.data);
      }
    }
  }

  /**
   * Handle event message
   */
  private handleEvent(event: WSEventType) {
    const listeners = this.eventListeners.get(event.event);
    
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event.data);
        } catch (error) {
          console.error('Event listener error:', error);
        }
      });
    }

    // Also emit to wildcard listeners
    const wildcardListeners = this.eventListeners.get('*');
    if (wildcardListeners) {
      wildcardListeners.forEach(listener => {
        try {
          listener({ event: event.event, data: event.data });
        } catch (error) {
          console.error('Wildcard listener error:', error);
        }
      });
    }
  }

  /**
   * Handle error message
   */
  private handleError(error: WSErrorType) {
    const pending = error.id ? this.pendingRequests.get(error.id) : null;
    
    if (pending) {
      window.clearTimeout(pending.timeout);
      this.pendingRequests.delete(error.id!);
      pending.reject(error.error);
    } else {
      console.error('WebSocket error:', error.error);
    }
  }

  /**
   * Handle control message
   */
  private handleControl(control: WSControlType) {
    if (control.action === 'pong' && control.id) {
      const pending = this.pendingRequests.get(control.id);
      
      if (pending) {
        window.clearTimeout(pending.timeout);
        this.pendingRequests.delete(control.id);
        pending.resolve(control.data);
      }
    }
  }

  /**
   * Setup heartbeat
   */
  private setupHeartbeat() {
    if (this.heartbeatInterval) {
      window.clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = window.setInterval(async () => {
      try {
        await this.ping();
      } catch (error) {
        console.error('Heartbeat failed:', error);
        // Connection might be dead, trigger reconnect
        if (this.ws) {
          this.ws.close();
        }
      }
    }, this.options.heartbeatInterval);
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.options.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.options.maxReconnectAttempts})`);

    this.reconnectTimeout = window.setTimeout(() => {
      this.connectionPromise = null;
      this.connect().catch(error => {
        console.error('Reconnect failed:', error);
      });
    }, delay);
  }

  /**
   * Cleanup resources
   */
  private cleanup() {
    if (this.heartbeatInterval) {
      window.clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.reconnectTimeout) {
      window.clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Reject all pending requests
    this.pendingRequests.forEach(pending => {
      window.clearTimeout(pending.timeout);
      pending.reject(new Error('Connection closed'));
    });
    this.pendingRequests.clear();
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `req-${++this.messageCounter}-${Date.now()}`;
  }

  /**
   * Get WebSocket state
   */
  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}