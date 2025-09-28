/**
 * Session Management Service
 * Handles session lifecycle, messaging, and state management for SuperCode integration
 */

export interface SessionConfig {
  directory?: string;
  projectID: string;
  providerID: string;
  modelID: string;
}

export interface MessagePayload {
  parts: Array<{
    type: string;
    text: string;
  }>;
  providerID?: string;
  modelID?: string;
}

export interface SessionInfo {
  id: string;
  createdAt: number;
  config: SessionConfig;
}

export interface StreamingCallbacks {
  onChunk?: (chunk: string, sessionId: string) => void;
  onMessagePart?: (part: any, sessionId: string) => void;
  onComplete?: (fullContent: string, sessionId: string) => void;
  onError?: (error: Error, sessionId: string) => void;
}

export interface StreamingOptions {
  sessionId?: string;  // If not provided, uses current session
  includeSessionFilter?: boolean;  // Whether to filter messages by session (default: true)
  callbacks?: StreamingCallbacks;
}

/**
 * SessionManager handles all session-related operations for SuperCode integration
 */
export class SessionManager {
  private currentSessionId: string | null = null;
  private readonly port: number;
  private readonly baseUrl: string;
  private sessionHistory: Map<string, SessionInfo> = new Map();

  constructor(port: number = 25716) {
    this.port = port;
    this.baseUrl = `http://localhost:${this.port}`;
  }

  /**
   * Creates a new session with the specified configuration
   */
  public async createSession(config: SessionConfig): Promise<string> {
    console.log('[SessionManager] Creating new session with config:', {
      ...config,
      directory: config.directory || '.'
    });

    const response = await fetch(`${this.baseUrl}/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        directory: config.directory || '.',
        projectID: config.projectID,
        providerID: config.providerID,
        modelID: config.modelID
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.statusText}`);
    }

    const sessionData = await response.json();
    const sessionId = sessionData.id || sessionData.sessionId;

    if (!sessionId) {
      console.error('[SessionManager] Session creation response missing ID:', sessionData);
      throw new Error('Session creation response missing ID');
    }

    // Update current session and store in history
    this.currentSessionId = sessionId;
    this.sessionHistory.set(sessionId, {
      id: sessionId,
      createdAt: Date.now(),
      config
    });

    console.log('[SessionManager] Session created successfully:', sessionId);
    return sessionId;
  }

  /**
   * Sends a message to a specific session
   */
  public async sendMessageToSession(
    sessionId: string,
    payload: MessagePayload
  ): Promise<Response> {
    console.log('[SessionManager] Sending message to session:', sessionId);
    console.log('[SessionManager] Message payload size:', JSON.stringify(payload).length, 'chars');

    const response = await fetch(`${this.baseUrl}/session/${sessionId}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Failed to send message to session ${sessionId}: ${response.statusText}`);
    }

    return response;
  }

  /**
   * Sends a message to the current session
   */
  public async sendMessage(payload: MessagePayload): Promise<Response> {
    if (!this.currentSessionId) {
      throw new Error('No active session. Create a session first.');
    }

    return this.sendMessageToSession(this.currentSessionId, payload);
  }

  /**
   * Gets the current session ID
   */
  public getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Sets the current session ID (for session restoration)
   */
  public setCurrentSessionId(sessionId: string | null): void {
    this.currentSessionId = sessionId;
    if (sessionId) {
      console.log('[SessionManager] Current session set to:', sessionId);
    } else {
      console.log('[SessionManager] Current session cleared');
    }
  }

  /**
   * Checks if a message belongs to the current session
   */
  public isCurrentSessionMessage(message: any): boolean {
    if (!this.currentSessionId) {
      return false;
    }

    // Check both sessionId and sessionID for compatibility
    const messageSessionId = message.sessionId || message.sessionID;
    return messageSessionId === this.currentSessionId;
  }

  /**
   * Clears the current session
   */
  public clearSession(): void {
    this.currentSessionId = null;
    console.log('[SessionManager] Session cleared');
  }

  /**
   * Gets session history
   */
  public getSessionHistory(): Map<string, SessionInfo> {
    return new Map(this.sessionHistory);
  }

  /**
   * Clears session history
   */
  public clearHistory(): void {
    this.sessionHistory.clear();
    console.log('[SessionManager] Session history cleared');
  }

  /**
   * Gets information about a specific session
   */
  public getSessionInfo(sessionId: string): SessionInfo | undefined {
    return this.sessionHistory.get(sessionId);
  }

  /**
   * Checks if there's an active session
   */
  public hasActiveSession(): boolean {
    return this.currentSessionId !== null;
  }

  /**
   * Gets the base URL for the SuperCode server
   */
  public getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Gets the port number
   */
  public getPort(): number {
    return this.port;
  }

  /**
   * Process a streaming response from the server
   * Handles both complete and partial responses with session filtering
   */
  public async processStreamingResponse(
    response: Response,
    options?: StreamingOptions
  ): Promise<string> {
    const targetSessionId = options?.sessionId || this.currentSessionId;
    const includeSessionFilter = options?.includeSessionFilter ?? true;
    const callbacks = options?.callbacks;

    if (!targetSessionId && includeSessionFilter) {
      throw new Error('No session ID available for filtering');
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body available');
    }

    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Notify chunk callback
        if (callbacks?.onChunk && targetSessionId) {
          callbacks.onChunk(chunk, targetSessionId);
        }

        // Try to parse complete JSON lines from buffer
        const lines = buffer.split('\n');
        // Keep the last incomplete line in buffer
        buffer = lines[lines.length - 1];

        // Process all complete lines
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          try {
            // Handle Server-Sent Events format (data: prefix)
            let jsonStr = line;
            if (line.startsWith('data: ')) {
              jsonStr = line.slice(6);
            }

            const jsonData = JSON.parse(jsonStr);

            // Check session filtering
            if (includeSessionFilter) {
              const messageSessionId = jsonData.sessionId || jsonData.sessionID;
              if (messageSessionId && messageSessionId !== targetSessionId) {
                console.log('[SessionManager] Filtering out message from different session:', messageSessionId, '!==', targetSessionId);
                continue;
              }
            }

            // Process message parts
            if (jsonData.parts && Array.isArray(jsonData.parts)) {
              for (const part of jsonData.parts) {
                if (part.type === 'text' && part.text) {
                  fullContent += part.text;

                  // Notify message part callback
                  if (callbacks?.onMessagePart && targetSessionId) {
                    callbacks.onMessagePart(part, targetSessionId);
                  }
                }
              }
            } else if (jsonData.text) {
              fullContent += jsonData.text;

              // Notify as a message part
              if (callbacks?.onMessagePart && targetSessionId) {
                callbacks.onMessagePart({ type: 'text', text: jsonData.text }, targetSessionId);
              }
            }

            // Also handle the entire JSON object as a message part for WebSocket compatibility
            if (callbacks?.onMessagePart && targetSessionId) {
              callbacks.onMessagePart(jsonData, targetSessionId);
            }
          } catch (parseError) {
            // Not valid JSON, treat as plain text
            if (line && !line.startsWith('data: [DONE]')) {
              fullContent += line;
              if (callbacks?.onChunk && targetSessionId) {
                callbacks.onChunk(line, targetSessionId);
              }
            }
          }
        }
      }

      // Process any remaining buffer content
      if (buffer.trim()) {
        try {
          let jsonStr = buffer;
          if (buffer.startsWith('data: ')) {
            jsonStr = buffer.slice(6);
          }
          const jsonData = JSON.parse(jsonStr);

          // Apply same processing as above
          if (!includeSessionFilter || !jsonData.sessionId || jsonData.sessionId === targetSessionId) {
            if (jsonData.parts && Array.isArray(jsonData.parts)) {
              for (const part of jsonData.parts) {
                if (part.type === 'text' && part.text) {
                  fullContent += part.text;
                  if (callbacks?.onMessagePart && targetSessionId) {
                    callbacks.onMessagePart(part, targetSessionId);
                  }
                }
              }
            } else if (jsonData.text) {
              fullContent += jsonData.text;
              if (callbacks?.onMessagePart && targetSessionId) {
                callbacks.onMessagePart({ type: 'text', text: jsonData.text }, targetSessionId);
              }
            }
          }
        } catch {
          // Treat as plain text if not JSON
          if (buffer && !buffer.startsWith('data: [DONE]')) {
            fullContent += buffer;
          }
        }
      }

      // Notify completion
      if (callbacks?.onComplete && targetSessionId) {
        callbacks.onComplete(fullContent, targetSessionId);
      }

      return fullContent;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (callbacks?.onError && targetSessionId) {
        callbacks.onError(err, targetSessionId);
      }
      throw err;
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Send a message and process the streaming response
   */
  public async sendMessageWithStreaming(
    payload: MessagePayload,
    options?: StreamingOptions
  ): Promise<string> {
    const sessionId = options?.sessionId || this.currentSessionId;
    if (!sessionId) {
      throw new Error('No active session. Create a session first.');
    }

    const response = await this.sendMessageToSession(sessionId, payload);
    return this.processStreamingResponse(response, {
      ...options,
      sessionId
    });
  }

  /**
   * Filter a WebSocket message part by session
   * Returns true if the message should be processed, false otherwise
   */
  public shouldProcessMessage(message: any, sessionId?: string): boolean {
    const targetSession = sessionId || this.currentSessionId;
    if (!targetSession) {
      return true; // No filtering if no session specified
    }

    const messageSessionId = message.sessionId || message.sessionID;
    if (!messageSessionId) {
      return true; // Process messages without session ID
    }

    return messageSessionId === targetSession;
  }
}