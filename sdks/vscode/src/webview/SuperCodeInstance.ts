import * as vscode from 'vscode';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { SuperCodeSDKClient, SuperCodeSDKClientConfig } from '../services/SuperCodeSDKClient';
import { Message, ToolCall, SSEMessage } from '../types/SuperCodeTypes';

export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error'
}


/**
 * Represents a single SuperCode instance with webview panel
 */
export class SuperCodeInstance {
  private panel: vscode.WebviewPanel | undefined;
  private process: ChildProcess | undefined;
  private connectionStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private healthCheckInterval: NodeJS.Timeout | undefined;
  private sdkClient: SuperCodeSDKClient;
  private messages: Message[] = [];
  private toolCalls: Map<string, ToolCall> = new Map();
  private currentSessionId: string | undefined;

  constructor(
    private instanceId: string,
    private port: number,
    private context: vscode.ExtensionContext,
    private onDispose: () => void
  ) {
    // Initialize SDK client
    const sdkConfig: SuperCodeSDKClientConfig = {
      baseUrl: `http://localhost:${this.port}`,
      port: this.port,
      timeout: 10000
    };
    
    this.sdkClient = new SuperCodeSDKClient(sdkConfig);
    this.setupSSEHandlers();
  }

  /**
   * Initializes the SuperCode instance by creating webview and spawning process
   */
  public async initialize(): Promise<void> {
    try {
      console.log(`[SuperCode-${this.getShortId()}] Initializing instance on port ${this.port}`);
      
      this.createWebviewPanel();
      this.sendLegacyMessageToWebview('system', `🚀 Connecting to SuperCode server on port ${this.port}...`);
      
      // Skip spawning process for testing - connect to existing server on port 25716
      if (this.port === 25716) {
        this.sendLegacyMessageToWebview('system', '✅ Connecting to hosted SuperCode server...');
      } else {
        await this.spawnSuperCodeProcess();
        this.sendLegacyMessageToWebview('system', '✅ Process started, establishing connection...');
      }
      
      await this.establishConnection();
      this.sendLegacyMessageToWebview('system', '🎉 Connected! SuperCode is ready.');
      
      this.startHealthCheck();
      console.log(`[SuperCode-${this.getShortId()}] Initialization complete`);
      
    } catch (error) {
      console.error(`[SuperCode-${this.getShortId()}] Initialization failed:`, error);
      this.setConnectionStatus(ConnectionStatus.ERROR);
      
      // Don't send individual error message - let the error state handler show the professional error UI
      // this.sendMessageToWebview('error', `Failed to start SuperCode: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Log detailed error for debugging but don't expose to user
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[SuperCode-${this.getShortId()}] Detailed error: ${errorMessage}`);
      
      // Don't re-throw to avoid duplicate error handling
    }
  }

  /**
   * Gets the port number for this instance
   */
  public getPort(): number {
    return this.port;
  }

  /**
   * Gets the current connection status
   */
  public getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Disposes of all resources associated with this instance
   */
  public dispose(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    if (this.sdkClient.isEventStreamConnected()) {
      console.log(`[SuperCode-${this.getShortId()}] Closing SSE connection`);
      this.sdkClient.unsubscribeFromEvents();
    }

    if (this.process && !this.process.killed) {
      console.log(`[SuperCode-${this.getShortId()}] Terminating external process (PID: ${this.process.pid})`);
      this.process.kill('SIGTERM');
    }

    if (this.panel) {
      this.panel.dispose();
    }

    this.onDispose();
  }

  /**
   * Creates the webview panel for this instance
   */
  private createWebviewPanel(): void {
    this.panel = vscode.window.createWebviewPanel(
      'supercodeWebview',
      `SuperCode ${this.getShortId()}`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(this.context.extensionPath, 'src/webview/templates'))
        ]
      }
    );

    // Set initial HTML content
    this.panel.webview.html = this.getWebviewContent();

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(
      (message) => this.handleWebviewMessage(message),
      undefined,
      this.context.subscriptions
    );

    // Handle panel disposal
    this.panel.onDidDispose(
      () => {
        this.panel = undefined;
        this.dispose();
      },
      null,
      this.context.subscriptions
    );

    this.updatePanelTitle();
  }

  /**
   * Spawns the SuperCode process externally
   */
  private async spawnSuperCodeProcess(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`[SuperCode-${this.getShortId()}] Spawning external SuperCode process on port ${this.port}`);
      console.log(`[SuperCode-${this.getShortId()}] Working directory: ${process.cwd()}`);
      console.log(`[SuperCode-${this.getShortId()}] Command: supercode --port ${this.port} --hostname 127.0.0.1`);
      
      // Launch SuperCode TUI in a visible external terminal window on all platforms
      const platform = process.platform;
      const workingDir = process.cwd().replace(/'/g, "'\\''"); // Escape single quotes
      const supercodeCommand = `supercode --port ${this.port} --hostname 127.0.0.1`;
      
      let terminalCommand: string[] = [];
      let terminalExecutable: string = '';
      
      if (platform === 'darwin') {
        // macOS: Use Terminal.app with open command (non-blocking)
        // Create a temporary script file that Terminal can execute with TUI
        const tempScript = `/tmp/supercode-${this.port}.sh`;
        require('fs').writeFileSync(tempScript, `#!/bin/bash\ncd '${workingDir}'\nexec ${supercodeCommand}`);
        require('fs').chmodSync(tempScript, 0o755);
        
        terminalExecutable = 'open';
        terminalCommand = ['-a', 'Terminal', tempScript];
        
      } else if (platform === 'win32') {
        // Windows: Use cmd.exe in a new window
        terminalExecutable = 'cmd';
        terminalCommand = ['/c', 'start', 'cmd', '/k', `cd /d "${process.cwd()}" && ${supercodeCommand}`];
        
      } else {
        // Linux and other Unix-like systems: Try common terminal emulators
        const terminals = ['gnome-terminal', 'konsole', 'xfce4-terminal', 'x-terminal-emulator', 'xterm'];
        
        // Try to find an available terminal
        for (const terminal of terminals) {
          try {
            // Test if terminal exists
            require('child_process').execSync(`which ${terminal}`, { stdio: 'ignore' });
            terminalExecutable = terminal;
            break;
          } catch (error) {
            // Terminal not found, try next
            continue;
          }
        }
        
        if (terminalExecutable === 'gnome-terminal') {
          terminalCommand = ['--', 'bash', '-c', `cd '${workingDir}' && exec ${supercodeCommand}`];
        } else if (terminalExecutable === 'konsole') {
          terminalCommand = ['-e', 'bash', '-c', `cd '${workingDir}' && exec ${supercodeCommand}`];
        } else if (terminalExecutable === 'xfce4-terminal') {
          terminalCommand = ['-e', `bash -c "cd '${workingDir}' && exec ${supercodeCommand}"`];
        } else if (terminalExecutable === 'xterm') {
          terminalCommand = ['-e', 'bash', '-c', `cd '${workingDir}' && exec ${supercodeCommand}`];
        } else {
          // Fallback to xterm if no other terminal found
          terminalExecutable = 'xterm';
          terminalCommand = ['-e', 'bash', '-c', `cd '${workingDir}' && exec ${supercodeCommand}`];
        }
      }
      
      console.log(`[SuperCode-${this.getShortId()}] Launching external terminal: ${terminalExecutable} ${terminalCommand.join(' ')}`);
      
      this.process = spawn(terminalExecutable, terminalCommand, {
        env: {
          ...process.env,
          SUPERCODE_CALLER: 'vscode',
          _EXTENSION_SUPERCODE_PORT: this.port.toString(),
        },
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      if (!this.process.pid) {
        reject(new Error('Failed to start SuperCode process - no PID'));
        return;
      }

      const launchMethod = `external ${platform === 'darwin' ? 'Terminal' : platform === 'win32' ? 'Command Prompt' : 'terminal'} window`;
      console.log(`[SuperCode-${this.getShortId()}] SuperCode launched via ${launchMethod} with PID: ${this.process.pid}`);
      
      let hasResolved = false;
      let stdout = '';
      let stderr = '';
      let serverPort: number | null = null;

      // Handle process events
      this.process.on('error', (error) => {
        console.error(`[SuperCode-${this.getShortId()}] Process error:`, error);
        if (!hasResolved) {
          hasResolved = true;
          // Provide more specific error messages
          if (error.message.includes('ENOENT')) {
            reject(new Error('SuperCode command not found. Please ensure SuperCode is installed and in your PATH.'));
          } else {
            reject(new Error(`Failed to spawn SuperCode: ${error.message}`));
          }
        }
      });

      this.process.on('exit', (code, signal) => {
        console.log(`[SuperCode-${this.getShortId()}] ${launchMethod} launcher process exited with code ${code}, signal ${signal}`);
        if (stdout) console.log(`[SuperCode-${this.getShortId()}] Final stdout: ${stdout}`);
        if (stderr) console.log(`[SuperCode-${this.getShortId()}] Final stderr: ${stderr}`);
        
        if (!hasResolved) {
          if (code === 0) {
            // Terminal launcher exiting with code 0 means the external terminal was launched successfully
            // The actual SuperCode server is now running in the external terminal window
            console.log(`[SuperCode-${this.getShortId()}] External terminal launched successfully, SuperCode should be starting in ${launchMethod}`);
            hasResolved = true;
            resolve(); // Continue with connection attempts - SuperCode is running in external terminal
          } else {
            hasResolved = true;
            const errorDetails = stderr || stdout || `Exit code: ${code}`;
            reject(new Error(`Failed to launch external terminal: ${errorDetails}`));
          }
        }
        // Note: Since SuperCode is running in external terminal, we can't monitor its process directly
        // Connection monitoring will be handled through health checks
      });

      // Capture and log output for debugging
      if (this.process.stdout) {
        this.process.stdout.on('data', (data) => {
          const output = data.toString();
          stdout += output;
          console.log(`[SuperCode-${this.getShortId()}] stdout:`, output);
          
          // Check for server startup indicators
          if (output.includes('server listening') || output.includes('listening on') || output.includes(`port ${this.port}`)) {
            console.log(`[SuperCode-${this.getShortId()}] Server startup detected in output`);
          }
          
          // Try to extract actual port from output
          const portMatch = output.match(/(?:port|listening on).*?(\d+)/i);
          if (portMatch) {
            serverPort = parseInt(portMatch[1]);
            console.log(`[SuperCode-${this.getShortId()}] Detected server port: ${serverPort}`);
            if (serverPort !== this.port) {
              console.warn(`[SuperCode-${this.getShortId()}] Warning: Detected port ${serverPort} differs from requested port ${this.port}`);
            }
          }
        });
      }

      if (this.process.stderr) {
        this.process.stderr.on('data', (data) => {
          const output = data.toString();
          stderr += output;
          console.error(`[SuperCode-${this.getShortId()}] stderr:`, output);
          
          // Check for common error patterns
          if (output.includes('EADDRINUSE')) {
            console.error(`[SuperCode-${this.getShortId()}] Port ${this.port} is already in use!`);
          }
          if (output.includes('EACCES')) {
            console.error(`[SuperCode-${this.getShortId()}] Permission denied for port ${this.port}`);
          }
          if (output.includes('authentication') || output.includes('login')) {
            console.error(`[SuperCode-${this.getShortId()}] Authentication issue detected`);
          }
        });
      }

      // Log launcher status - SuperCode TUI is now running in external terminal
      setTimeout(() => {
        console.log(`[SuperCode-${this.getShortId()}] External terminal should now be visible with SuperCode TUI`);
        console.log(`[SuperCode-${this.getShortId()}] SuperCode TUI will serve API at http://127.0.0.1:${this.port} once initialized`);
      }, 1000);

      // Give the terminal launcher time to complete, then resolve
      setTimeout(() => {
        if (!hasResolved) {
          hasResolved = true;
          console.log(`[SuperCode-${this.getShortId()}] Terminal launcher completed, proceeding with connection attempts`);
          resolve(); // Proceed to connection phase - SuperCode should be starting in external terminal
        }
      }, 2000); // Reduced delay since we just need terminal launch confirmation
    });
  }

  /**
   * Establishes connection with the SuperCode instance
   */
  private async establishConnection(): Promise<void> {
    this.setConnectionStatus(ConnectionStatus.CONNECTING);

    // SuperCode TUI needs more time to initialize than serve mode
    // TUI startup + MCP server initialization takes ~8-10 seconds
    const maxAttempts = 30; // More attempts for TUI initialization
    const retryDelay = 1000;  // Longer delay between attempts for TUI mode
    
    let connected = false;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`[SuperCode-${this.getShortId()}] Connection attempt ${attempt}/${maxAttempts}`);
        const isConnected = await this.sdkClient.testConnection();
        if (!isConnected) {
          throw new Error('Failed to connect to SuperCode');
        }
        connected = true;
        console.log(`[SuperCode-${this.getShortId()}] Successfully connected on attempt ${attempt}`);
        break;
      } catch (error) {
        console.log(`[SuperCode-${this.getShortId()}] Connection attempt ${attempt}/${maxAttempts} failed:`, error instanceof Error ? error.message : error);
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
    
    if (!connected) {
      throw new Error(`Failed to connect to SuperCode TUI after ${maxAttempts} attempts (${maxAttempts * retryDelay / 1000}s timeout). SuperCode TUI may need more time to initialize or project setup. Check the external terminal window for status.`);
    }
    
    this.setConnectionStatus(ConnectionStatus.CONNECTED);
    
    // Establish SSE connection for real-time updates
    await this.sdkClient.subscribeToEvents();
    
    // Create or get current session
    if (!this.currentSessionId) {
      await this.createSession();
    }
  }

  /**
   * Sets up SSE event handlers
   */
  private setupSSEHandlers(): void {
    this.sdkClient.onMessage((message: SSEMessage) => {
      this.handleSSEMessage(message);
    });
    
    this.sdkClient.onOpen(() => {
      console.log(`[SuperCode-${this.getShortId()}] SSE connection established`);
    });
    
    this.sdkClient.onError((error) => {
      console.error(`[SuperCode-${this.getShortId()}] SSE connection error:`, error);
    });
  }

  /**
   * Handles incoming SSE messages
   */
  private handleSSEMessage(message: SSEMessage): void {
    console.log(`[SuperCode-${this.getShortId()}] SSE message:`, message.type, message);

    switch (message.type) {
      case 'message_start':
        this.handleMessageStart(message.data);
        break;
      
      case 'message_delta':
        this.handleMessageDelta(message.data);
        break;
      
      case 'message_end':
        this.handleMessageEnd(message.data);
        break;
      
      case 'tool_call_start':
        this.handleToolCallStart(message.data);
        break;
      
      case 'tool_call_result':
        this.handleToolCallResult(message.data);
        break;
      
      case 'tool_call_metadata':
        this.handleToolCallMetadata(message.data);
        break;
      
      case 'session_created':
        this.currentSessionId = message.data.id;
        console.log(`[SuperCode-${this.getShortId()}] Session created:`, this.currentSessionId);
        break;
      
      default:
        console.warn(`[SuperCode-${this.getShortId()}] Unknown SSE message type:`, message.type);
    }
  }

  /**
   * Handles message start events
   */
  private handleMessageStart(data: any): void {
    const message: Message = {
      id: data.id,
      role: data.role || 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      streaming: true
    };

    this.messages.push(message);
    this.sendMessageToWebview('addMessage', { message });
  }

  /**
   * Handles message delta events (streaming content updates)
   */
  private handleMessageDelta(data: any): void {
    const messageIndex = this.messages.findIndex(m => m.id === data.id);
    if (messageIndex !== -1) {
      this.messages[messageIndex].content += data.content || '';
      this.sendMessageToWebview('updateMessage', { 
        id: data.id, 
        content: this.messages[messageIndex].content 
      });
    }
  }

  /**
   * Handles message end events
   */
  private handleMessageEnd(data: any): void {
    const messageIndex = this.messages.findIndex(m => m.id === data.id);
    if (messageIndex !== -1) {
      this.messages[messageIndex].streaming = false;
      this.messages[messageIndex].content = data.content || this.messages[messageIndex].content;
      this.sendMessageToWebview('messageComplete', { 
        id: data.id, 
        content: this.messages[messageIndex].content 
      });
    }
  }

  /**
   * Handles tool call start events
   */
  private handleToolCallStart(data: any): void {
    const toolCall: ToolCall = {
      id: data.id,
      name: data.name,
      parameters: data.parameters,
      state: 'running',
      start_time: Date.now(),
      expanded: false
    };

    this.toolCalls.set(data.id, toolCall);
    this.sendMessageToWebview('addToolCall', { toolCall });
  }

  /**
   * Handles tool call result events
   */
  private handleToolCallResult(data: any): void {
    const toolCall = this.toolCalls.get(data.id);
    if (toolCall) {
      toolCall.state = data.error ? 'error' : 'completed';
      toolCall.result = data.result;
      toolCall.error = data.error;
      toolCall.end_time = Date.now();

      this.toolCalls.set(data.id, toolCall);
      this.sendMessageToWebview('updateToolCall', { toolCall });
    }
  }

  /**
   * Handles tool call metadata updates (streaming tool execution)
   */
  private handleToolCallMetadata(data: any): void {
    const toolCall = this.toolCalls.get(data.id);
    if (toolCall) {
      toolCall.metadata = { ...toolCall.metadata, ...data.metadata };
      this.toolCalls.set(data.id, toolCall);
      this.sendMessageToWebview('updateToolCall', { toolCall });
    }
  }

  /**
   * Creates a new session
   */
  private async createSession(): Promise<void> {
    try {
      const session = await this.sdkClient.createSession(`VSCode Session ${new Date().toLocaleTimeString()}`);
      const sessionData = session as any;
      this.currentSessionId = sessionData.data?.id || sessionData.id;
      console.log(`[SuperCode-${this.getShortId()}] Created session:`, this.currentSessionId);
      
    } catch (error) {
      console.error(`[SuperCode-${this.getShortId()}] Failed to create session:`, error);
    }
  }

  /**
   * Starts periodic health checks
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const connected = await this.sdkClient.testConnection();
        if (connected && this.connectionStatus !== ConnectionStatus.CONNECTED) {
          this.setConnectionStatus(ConnectionStatus.CONNECTED);
        } else if (!connected) {
          this.setConnectionStatus(ConnectionStatus.ERROR);
        }
      } catch (error) {
        this.setConnectionStatus(ConnectionStatus.ERROR);
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Checks if the SuperCode instance is healthy
   */
  private async checkHealth(): Promise<void> {
    try {
      const isHealthy = await this.sdkClient.testConnection();
      if (!isHealthy) {
        const health = await this.sdkClient.getHealth();
        throw new Error(`Health check failed: ${JSON.stringify(health.details)}`);
      }
    } catch (error) {
      const diagnosticInfo = [
        `Port: ${this.port}`,
        `Process PID: ${this.process?.pid || 'unknown'}`,
        `Process killed: ${this.process?.killed || 'unknown'}`,
        `Working directory: ${process.cwd()}`
      ].join(' | ');
      
      console.error(`[SuperCode-${this.getShortId()}] Health check failed: ${diagnosticInfo}`);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Health check timeout. ${diagnosticInfo}`);
        }
        if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
          throw new Error(`SuperCode not responding. Check external terminal. ${diagnosticInfo}`);
        }
      }
      
      throw error;
    }
  }

  /**
   * Attempts to reconnect to a failed SuperCode instance
   */
  public async reconnect(): Promise<void> {
    if (this.connectionStatus === ConnectionStatus.CONNECTING) {
      return; // Already attempting to connect
    }

    try {
      this.setConnectionStatus(ConnectionStatus.CONNECTING);
      this.sendLegacyMessageToWebview('system', 'Attempting to reconnect...');
      
      // Try to reconnect without spawning a new process first
      await this.establishConnection();
      
      this.sendLegacyMessageToWebview('system', 'Reconnected successfully!');
    } catch (error) {
      console.error('Reconnection failed:', error);
      this.setConnectionStatus(ConnectionStatus.ERROR);
      this.sendLegacyMessageToWebview('error', `Reconnection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Offer to restart the SuperCode process
      this.offerProcessRestart();
    }
  }

  /**
   * Offers to restart the SuperCode process
   */
  private offerProcessRestart(): void {
    if (this.panel) {
      this.panel.webview.postMessage({
        command: 'offerRestart',
        message: 'SuperCode instance may have crashed. Would you like to restart it?'
      });
    }
  }

  /**
   * Restarts the SuperCode process
   */
  public async restart(): Promise<void> {
    try {
      this.setConnectionStatus(ConnectionStatus.CONNECTING);
      this.sendLegacyMessageToWebview('system', 'Restarting SuperCode instance...');
      
      // Terminate existing process if it exists
      if (this.process && !this.process.killed) {
        console.log(`[SuperCode-${this.getShortId()}] Terminating existing process for restart`);
        this.process.kill('SIGTERM');
        // Wait a moment for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 1000));
        this.process = undefined;
      }

      // Stop health checks temporarily
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = undefined;
      }

      // Close existing SSE connection
      if (this.sdkClient.isEventStreamConnected()) {
        this.sdkClient.unsubscribeFromEvents();
      }

      // Spawn new external process and establish connection
      await this.spawnSuperCodeProcess();
      await this.establishConnection();
      this.startHealthCheck();
      
      this.sendLegacyMessageToWebview('system', 'SuperCode instance restarted successfully!');
      
    } catch (error) {
      console.error('Process restart failed:', error);
      this.setConnectionStatus(ConnectionStatus.ERROR);
      this.sendLegacyMessageToWebview('error', `Restart failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }


  /**
   * Sets the connection status and updates UI
   */
  private setConnectionStatus(status: ConnectionStatus): void {
    this.connectionStatus = status;
    this.updatePanelTitle();
    this.sendStatusUpdate();
  }

  /**
   * Updates the panel title with connection status
   */
  private updatePanelTitle(): void {
    if (!this.panel) return;

    const statusEmoji = {
      [ConnectionStatus.DISCONNECTED]: '⚪',
      [ConnectionStatus.CONNECTING]: '🟡', 
      [ConnectionStatus.CONNECTED]: '🟢',
      [ConnectionStatus.ERROR]: '🔴'
    };

    this.panel.title = `${statusEmoji[this.connectionStatus]} SuperCode ${this.getShortId()}`;
  }

  /**
   * Sends status update to webview
   */
  private sendStatusUpdate(): void {
    if (this.panel) {
      this.panel.webview.postMessage({
        command: 'statusUpdate',
        status: this.connectionStatus,
        port: this.port
      });
    }
  }

  /**
   * Handles messages received from the webview
   */
  private async handleWebviewMessage(message: any): Promise<void> {
    switch (message.command) {
      case 'sendMessage':
        await this.sendMessageToSuperCode(message.text);
        break;
      
      case 'requestStatus':
        this.sendStatusUpdate();
        break;
        
      case 'retry':
        await this.reconnect();
        break;
        
      case 'restart':
        await this.restart();
        break;
    }
  }

  /**
   * Sends a message to the SuperCode instance via Session API
   */
  private async sendMessageToSuperCode(text: string): Promise<void> {
    if (this.connectionStatus !== ConnectionStatus.CONNECTED) {
      this.sendLegacyMessageToWebview('error', 'Not connected to SuperCode instance');
      return;
    }

    if (!this.currentSessionId) {
      this.sendLegacyMessageToWebview('error', 'No active session');
      return;
    }

    try {
      // Add user message to local storage
      const userMessage: Message = {
        id: this.generateMessageId(),
        role: 'user',
        content: text,
        timestamp: new Date().toISOString()
      };
      
      this.messages.push(userMessage);
      this.sendMessageToWebview('addMessage', { message: userMessage });

      // Send prompt to SuperCode using SDK client
      await this.sdkClient.sendMessage(this.currentSessionId, text, userMessage.id);

      // Response will come through SSE events
      console.log(`[SuperCode-${this.getShortId()}] Message sent to session:`, this.currentSessionId);
      
    } catch (error) {
      console.error('Failed to send message to SuperCode:', error);
      this.sendLegacyMessageToWebview('error', `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generates a unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  /**
   * Sends a message to the webview for display
   */
  private sendMessageToWebview(command: string, data?: any): void {
    if (this.panel && this.panel.webview) {
      try {
        this.panel.webview.postMessage({
          command,
          ...data
        });
      } catch (error) {
        console.error(`[SuperCode-${this.getShortId()}] Failed to send message to webview:`, error);
      }
    } else {
      console.log(`[SuperCode-${this.getShortId()}] Webview not ready, command: ${command}`, data);
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  private sendLegacyMessageToWebview(type: 'assistant' | 'error' | 'system', content: string): void {
    this.sendMessageToWebview('addMessage', { type, content });
  }

  /**
   * Gets the HTML content for the webview
   */
  private getWebviewContent(): string {
    // TODO: Load from template file
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SuperCode</title>
        <style>
            body {
                font-family: var(--vscode-font-family);
                font-size: var(--vscode-font-size);
                line-height: 1.5;
                color: var(--vscode-foreground);
                background: var(--vscode-editor-background);
                margin: 0;
                padding: 0;
                height: 100vh;
                display: flex;
                flex-direction: column;
            }
            .supercode-container {
                display: flex;
                flex-direction: column;
                height: 100%;
            }
            .status-bar {
                padding: 8px 16px;
                background: var(--vscode-statusBar-background);
                color: var(--vscode-statusBar-foreground);
                border-bottom: 1px solid var(--vscode-statusBar-border);
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .connection-status {
                font-size: 12px;
            }
            .status-text {
                font-size: 12px;
            }
            .chat-messages {
                flex: 1;
                padding: 16px;
                overflow-y: auto;
                min-height: 0;
            }
            .input-area {
                padding: 16px;
                border-top: 1px solid var(--vscode-panel-border);
                display: flex;
                gap: 8px;
            }
            #messageInput {
                flex: 1;
                background: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 1px solid var(--vscode-input-border);
                border-radius: 4px;
                padding: 8px 12px;
                font-family: var(--vscode-font-family);
                font-size: var(--vscode-font-size);
                resize: vertical;
                min-height: 60px;
            }
            #messageInput:focus {
                outline: none;
                border-color: var(--vscode-focusBorder);
            }
            #sendButton {
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                border-radius: 4px;
                padding: 8px 16px;
                cursor: pointer;
                font-family: var(--vscode-font-family);
            }
            #sendButton:hover {
                background: var(--vscode-button-hoverBackground);
            }
            #sendButton:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            .message {
                margin-bottom: 16px;
                padding: 8px;
                border-radius: 4px;
            }
            .message.user {
                background: var(--vscode-editor-selectionBackground);
                margin-left: 20%;
            }
            .message.assistant {
                background: var(--vscode-editor-background);
                border: 1px solid var(--vscode-panel-border);
                margin-right: 20%;
            }
            .message.error {
                background: var(--vscode-inputValidation-errorBackground);
                color: var(--vscode-inputValidation-errorForeground);
                border: 1px solid var(--vscode-inputValidation-errorBorder);
                margin-right: 20%;
            }
            .message.system {
                background: var(--vscode-editor-inactiveSelectionBackground);
                color: var(--vscode-descriptionForeground);
                text-align: center;
                font-style: italic;
            }
            .connecting-message {
                text-align: center;
                color: var(--vscode-descriptionForeground);
                margin-top: 2rem;
            }

            /* Streaming message styles */
            .message.streaming {
                position: relative;
            }
            
            .streaming-cursor {
                animation: blink 1s infinite;
                color: var(--vscode-foreground);
                margin-left: 2px;
            }
            
            @keyframes blink {
                0%, 50% { opacity: 1; }
                51%, 100% { opacity: 0; }
            }

            /* Tool call styles */
            .tool-call {
                margin-bottom: 16px;
                border: 1px solid var(--vscode-panel-border);
                border-radius: 8px;
                background: var(--vscode-editor-background);
                overflow: hidden;
            }

            .tool-call--pending {
                border-left: 4px solid #ffa500;
            }

            .tool-call--running {
                border-left: 4px solid #007acc;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }

            .tool-call--completed {
                border-left: 4px solid #4caf50;
            }

            .tool-call--error {
                border-left: 4px solid #f44336;
                background: rgba(244, 67, 54, 0.05);
            }

            .tool-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                background: var(--vscode-editor-inactiveSelectionBackground);
                border-bottom: 1px solid var(--vscode-panel-border);
            }

            .tool-info {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .tool-icon {
                font-size: 16px;
            }

            .tool-name {
                font-family: var(--vscode-editor-font-family, 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace);
                font-weight: 500;
                color: var(--vscode-foreground);
            }

            .tool-state {
                font-size: 14px;
                padding: 2px 6px;
                border-radius: 4px;
                font-weight: 500;
            }

            .tool-state.running {
                background: rgba(0, 122, 204, 0.1);
                color: #007acc;
            }

            .tool-state.completed {
                background: rgba(76, 175, 80, 0.1);
                color: #4caf50;
            }

            .tool-state.error {
                background: rgba(244, 67, 54, 0.1);
                color: #f44336;
            }

            .tool-actions {
                display: flex;
                gap: 4px;
            }

            .tool-expand {
                background: none;
                border: 1px solid var(--vscode-button-border);
                color: var(--vscode-foreground);
                padding: 4px 8px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                transition: background-color 0.2s;
            }

            .tool-expand:hover {
                background: var(--vscode-button-hoverBackground);
            }

            .tool-content {
                padding: 16px;
            }

            .tool-parameters, .tool-result, .tool-error, .tool-metadata {
                margin-bottom: 12px;
            }

            .tool-parameters strong, .tool-result strong, .tool-error strong, .tool-metadata strong {
                color: var(--vscode-foreground);
                display: block;
                margin-bottom: 4px;
            }

            .tool-parameters pre, .tool-result pre, .tool-metadata pre {
                background: var(--vscode-textCodeBlock-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: 4px;
                padding: 8px;
                font-family: var(--vscode-editor-font-family, 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace);
                font-size: 12px;
                overflow-x: auto;
                margin: 0;
            }

            .tool-progress {
                color: var(--vscode-descriptionForeground);
                font-style: italic;
                animation: pulse 2s infinite;
            }

            .tool-error {
                color: var(--vscode-errorForeground);
                background: var(--vscode-inputValidation-errorBackground);
                border: 1px solid var(--vscode-inputValidation-errorBorder);
                border-radius: 4px;
                padding: 8px;
            }

            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }
        </style>
    </head>
    <body>
        <div class="supercode-container">
            <div class="status-bar">
                <span class="connection-status" id="statusDot">⚪</span>
                <span class="status-text" id="statusText">Initializing...</span>
            </div>
            <div class="chat-messages" id="messages">
                <div class="connecting-message">
                    <p>Launching external SuperCode process...</p>
                    <p>Port: ${this.port}</p>
                    <p style="font-size: 12px; opacity: 0.7;">SuperCode will run outside VS Code and connect via API</p>
                </div>
            </div>
            <div class="input-area">
                <textarea id="messageInput" placeholder="Ask SuperCode something..." disabled></textarea>
                <button id="sendButton" disabled>Send</button>
            </div>
        </div>

        <script>
            const vscode = acquireVsCodeApi();
            const statusDot = document.getElementById('statusDot');
            const statusText = document.getElementById('statusText');
            const messages = document.getElementById('messages');
            const messageInput = document.getElementById('messageInput');
            const sendButton = document.getElementById('sendButton');

            // Handle messages from extension
            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.command) {
                    case 'statusUpdate':
                        updateStatus(message.status, message.port);
                        break;
                    case 'addMessage':
                        if (message.message) {
                            addStreamingMessage(message.message);
                        } else {
                            addMessage(message.type, message.content);
                        }
                        break;
                    case 'updateMessage':
                        updateStreamingMessage(message.id, message.content);
                        break;
                    case 'messageComplete':
                        completeStreamingMessage(message.id, message.content);
                        break;
                    case 'addToolCall':
                        addToolCall(message.toolCall);
                        break;
                    case 'updateToolCall':
                        updateToolCall(message.toolCall);
                        break;
                    case 'offerRestart':
                        showRestartOffer(message.message);
                        break;
                }
            });

            // Update connection status
            function updateStatus(status, port) {
                const statusConfig = {
                    disconnected: { dot: '⚪', text: 'Disconnected', enabled: false },
                    connecting: { dot: '🟡', text: 'Connecting...', enabled: false },
                    connected: { dot: '🟢', text: \`Connected (port \${port})\`, enabled: true },
                    error: { dot: '🔴', text: 'Connection Error', enabled: false }
                };

                const config = statusConfig[status];
                if (config) {
                    statusDot.textContent = config.dot;
                    statusText.textContent = config.text;
                    messageInput.disabled = !config.enabled;
                    sendButton.disabled = !config.enabled;

                    if (status === 'connected') {
                        messages.innerHTML = '<div style="text-align: center; color: var(--vscode-descriptionForeground); margin-top: 2rem;"><p>SuperCode is ready! Start chatting below.</p></div>';
                    } else if (status === 'error') {
                        showErrorActions();
                    }
                }

                // Show error actions
                function showErrorActions() {
                    const errorActionsDiv = document.createElement('div');
                    errorActionsDiv.id = 'errorActions';
                    errorActionsDiv.style.cssText = 'text-align: center; margin: 1rem; padding: 1rem; background: var(--vscode-inputValidation-errorBackground); border: 1px solid var(--vscode-inputValidation-errorBorder); border-radius: 4px;';
                    errorActionsDiv.innerHTML = \`
                        <h4 style="color: var(--vscode-inputValidation-errorForeground); margin: 0 0 0.5rem 0;">⚠️ SuperCode Connection Failed</h4>
                        <p style="color: var(--vscode-inputValidation-errorForeground); margin-bottom: 1rem; font-size: 13px;">
                            The SuperCode process has stopped or failed to start. This could be due to:
                            <br>• Port conflict or permission issues
                            <br>• SuperCode not installed or not in PATH
                            <br>• Missing project configuration
                        </p>
                        <div style="margin-top: 1rem;">
                            <button id="restartButton" style="background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 8px 16px; margin: 0 4px; border-radius: 3px; cursor: pointer; font-weight: 500;">🔄 Restart Process</button>
                            <button id="retryButton" style="background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; padding: 8px 16px; margin: 0 4px; border-radius: 3px; cursor: pointer;">↻ Retry Connection</button>
                        </div>
                        <p style="color: var(--vscode-descriptionForeground); margin-top: 1rem; font-size: 11px; opacity: 0.8;">
                            Check the VS Code Output panel for detailed error logs.
                        </p>
                    \`;
                    
                    // Remove existing error actions
                    const existing = document.getElementById('errorActions');
                    if (existing) existing.remove();
                    
                    messages.innerHTML = ''; // Clear other messages for clean error state
                    messages.appendChild(errorActionsDiv);
                    
                    // Add event listeners
                    document.getElementById('retryButton').addEventListener('click', () => {
                        // Update UI to show retry in progress
                        errorActionsDiv.innerHTML = '<p style="color: var(--vscode-descriptionForeground); margin: 1rem;">🔄 Retrying connection...</p>';
                        vscode.postMessage({ command: 'retry' });
                    });
                    
                    document.getElementById('restartButton').addEventListener('click', () => {
                        // Update UI to show restart in progress
                        errorActionsDiv.innerHTML = '<p style="color: var(--vscode-descriptionForeground); margin: 1rem;">🔄 Restarting SuperCode process...</p>';
                        vscode.postMessage({ command: 'restart' });
                    });
                }

                // Show restart offer
                function showRestartOffer(message) {
                    const offerDiv = document.createElement('div');
                    offerDiv.style.cssText = 'text-align: center; margin: 1rem; padding: 1rem; background: var(--vscode-inputValidation-warningBackground); border-radius: 4px;';
                    offerDiv.innerHTML = \`
                        <p style="color: var(--vscode-inputValidation-warningForeground); margin-bottom: 1rem;">\${message}</p>
                        <button onclick="this.parentElement.remove(); vscode.postMessage({ command: 'restart' });" 
                                style="background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 6px 12px; margin: 0 4px; border-radius: 2px; cursor: pointer;">
                            Restart
                        </button>
                        <button onclick="this.parentElement.remove();" 
                                style="background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: none; padding: 6px 12px; margin: 0 4px; border-radius: 2px; cursor: pointer;">
                            Ignore
                        </button>
                    \`;
                    messages.appendChild(offerDiv);
                }
            }

            // Send message
            sendButton.addEventListener('click', sendMessage);
            messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    sendMessage();
                }
            });

            function sendMessage() {
                const text = messageInput.value.trim();
                if (!text) return;

                // Add user message to chat
                addMessage('user', text);
                messageInput.value = '';

                // Send to extension
                vscode.postMessage({
                    command: 'sendMessage',
                    text: text
                });
            }

            function addMessage(type, content) {
                const messageDiv = document.createElement('div');
                messageDiv.className = \`message \${type}\`;
                messageDiv.textContent = content;
                messages.appendChild(messageDiv);
                messages.scrollTop = messages.scrollHeight;
            }

            // Streaming message functions
            function addStreamingMessage(message) {
                const messageDiv = document.createElement('div');
                messageDiv.id = \`message-\${message.id}\`;
                messageDiv.className = \`message \${message.role}\`;
                
                if (message.role === 'user') {
                    messageDiv.textContent = message.content;
                } else {
                    // For assistant messages, add cursor for streaming
                    const contentSpan = document.createElement('span');
                    contentSpan.className = 'message-content';
                    contentSpan.textContent = message.content;
                    
                    const cursor = document.createElement('span');
                    cursor.className = 'streaming-cursor';
                    cursor.textContent = '▎';
                    
                    messageDiv.appendChild(contentSpan);
                    if (message.streaming) {
                        messageDiv.appendChild(cursor);
                        messageDiv.classList.add('streaming');
                    }
                }
                
                messages.appendChild(messageDiv);
                messages.scrollTop = messages.scrollHeight;
            }

            function updateStreamingMessage(messageId, content) {
                const messageDiv = document.getElementById(\`message-\${messageId}\`);
                if (messageDiv) {
                    const contentSpan = messageDiv.querySelector('.message-content');
                    if (contentSpan) {
                        contentSpan.textContent = content;
                    } else {
                        messageDiv.textContent = content;
                    }
                    messages.scrollTop = messages.scrollHeight;
                }
            }

            function completeStreamingMessage(messageId, content) {
                const messageDiv = document.getElementById(\`message-\${messageId}\`);
                if (messageDiv) {
                    const contentSpan = messageDiv.querySelector('.message-content');
                    if (contentSpan) {
                        contentSpan.textContent = content;
                    } else {
                        messageDiv.textContent = content;
                    }
                    
                    // Remove streaming cursor and class
                    const cursor = messageDiv.querySelector('.streaming-cursor');
                    if (cursor) {
                        cursor.remove();
                    }
                    messageDiv.classList.remove('streaming');
                    messages.scrollTop = messages.scrollHeight;
                }
            }

            // Tool call functions
            function addToolCall(toolCall) {
                const toolDiv = document.createElement('div');
                toolDiv.id = \`tool-\${toolCall.id}\`;
                toolDiv.className = \`tool-call tool-call--\${toolCall.state}\`;
                
                toolDiv.innerHTML = \`
                    <div class="tool-header">
                        <div class="tool-info">
                            <span class="tool-icon">\${getToolIcon(toolCall.name)}</span>
                            <span class="tool-name">\${toolCall.name}</span>
                            <span class="tool-state \${toolCall.state}">\${getStateIcon(toolCall.state)}</span>
                        </div>
                        <div class="tool-actions">
                            <button class="tool-expand" onclick="toggleToolExpanded('\${toolCall.id}')">
                                \${toolCall.expanded ? '⬆️' : '⬇️'}
                            </button>
                        </div>
                    </div>
                    <div class="tool-content" style="display: \${toolCall.expanded ? 'block' : 'none'}">
                        <div class="tool-parameters">
                            <strong>Parameters:</strong>
                            <pre>\${JSON.stringify(toolCall.parameters, null, 2)}</pre>
                        </div>
                        \${toolCall.state === 'running' ? '<div class="tool-progress">⏳ Running...</div>' : ''}
                        \${toolCall.result ? \`<div class="tool-result"><strong>Result:</strong><pre>\${JSON.stringify(toolCall.result, null, 2)}</pre></div>\` : ''}
                        \${toolCall.error ? \`<div class="tool-error"><strong>Error:</strong> \${toolCall.error}</div>\` : ''}
                    </div>
                \`;
                
                messages.appendChild(toolDiv);
                messages.scrollTop = messages.scrollHeight;
            }

            function updateToolCall(toolCall) {
                const toolDiv = document.getElementById(\`tool-\${toolCall.id}\`);
                if (toolDiv) {
                    // Update state class
                    toolDiv.className = \`tool-call tool-call--\${toolCall.state}\`;
                    
                    // Update state icon
                    const stateSpan = toolDiv.querySelector('.tool-state');
                    if (stateSpan) {
                        stateSpan.textContent = getStateIcon(toolCall.state);
                        stateSpan.className = \`tool-state \${toolCall.state}\`;
                    }
                    
                    // Update content
                    const contentDiv = toolDiv.querySelector('.tool-content');
                    if (contentDiv) {
                        contentDiv.innerHTML = \`
                            <div class="tool-parameters">
                                <strong>Parameters:</strong>
                                <pre>\${JSON.stringify(toolCall.parameters, null, 2)}</pre>
                            </div>
                            \${toolCall.state === 'running' ? '<div class="tool-progress">⏳ Running...</div>' : ''}
                            \${toolCall.result ? \`<div class="tool-result"><strong>Result:</strong><pre>\${JSON.stringify(toolCall.result, null, 2)}</pre></div>\` : ''}
                            \${toolCall.error ? \`<div class="tool-error"><strong>Error:</strong> \${toolCall.error}</div>\` : ''}
                            \${toolCall.metadata ? \`<div class="tool-metadata"><strong>Metadata:</strong><pre>\${JSON.stringify(toolCall.metadata, null, 2)}</pre></div>\` : ''}
                        \`;
                    }
                    
                    messages.scrollTop = messages.scrollHeight;
                }
            }

            function getToolIcon(toolName) {
                const icons = {
                    'read': '📖',
                    'write': '✏️',
                    'edit': '✂️',
                    'bash': '💻',
                    'grep': '🔍',
                    'todo-read': '📋',
                    'todo-write': '✅'
                };
                return icons[toolName] || '🛠️';
            }

            function getStateIcon(state) {
                const icons = {
                    'pending': '⏳',
                    'running': '🔄',
                    'completed': '✅',
                    'error': '❌'
                };
                return icons[state] || '⚪';
            }

            function toggleToolExpanded(toolId) {
                const toolDiv = document.getElementById(\`tool-\${toolId}\`);
                if (toolDiv) {
                    const contentDiv = toolDiv.querySelector('.tool-content');
                    const expandButton = toolDiv.querySelector('.tool-expand');
                    
                    if (contentDiv.style.display === 'none') {
                        contentDiv.style.display = 'block';
                        expandButton.textContent = '⬆️';
                    } else {
                        contentDiv.style.display = 'none';
                        expandButton.textContent = '⬇️';
                    }
                }
            }

            // Request initial status
            vscode.postMessage({ command: 'requestStatus' });
        </script>
    </body>
    </html>`;
  }

  /**
   * Gets a short ID for display purposes
   */
  private getShortId(): string {
    return this.instanceId.split('-').pop() || this.instanceId;
  }

  /**
   * Gets the active file reference (reused from extension.ts logic)
   */
  private getActiveFile(): string | undefined {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) return;

    const document = activeEditor.document;
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) return;

    const relativePath = vscode.workspace.asRelativePath(document.uri);
    let filepathWithAt = `@${relativePath}`;

    const selection = activeEditor.selection;
    if (!selection.isEmpty) {
      const startLine = selection.start.line + 1;
      const endLine = selection.end.line + 1;

      if (startLine === endLine) {
        filepathWithAt += `#L${startLine}`;
      } else {
        filepathWithAt += `#L${startLine}-${endLine}`;
      }
    }

    return filepathWithAt;
  }
}