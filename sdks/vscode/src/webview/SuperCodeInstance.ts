import * as vscode from 'vscode';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';

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

  constructor(
    private instanceId: string,
    private port: number,
    private context: vscode.ExtensionContext,
    private onDispose: () => void
  ) {}

  /**
   * Initializes the SuperCode instance by creating webview and spawning process
   */
  public async initialize(): Promise<void> {
    try {
      console.log(`[SuperCode-${this.getShortId()}] Initializing instance on port ${this.port}`);
      
      this.createWebviewPanel();
      this.sendMessageToWebview('system', `🚀 Launching SuperCode on port ${this.port}...`);
      
      await this.spawnSuperCodeProcess();
      this.sendMessageToWebview('system', '✅ Process started, establishing connection...');
      
      await this.establishConnection();
      this.sendMessageToWebview('system', '🎉 Connected! SuperCode is ready.');
      
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
      let serverStarted = false;
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
            serverStarted = true;
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
        await this.checkHealth();
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
    
    // Send initial file context if available
    const activeFile = this.getActiveFile();
    if (activeFile) {
      try {
        await this.appendPrompt(`In ${activeFile}`);
      } catch (error) {
        console.log(`[SuperCode-${this.getShortId()}] Failed to send initial context:`, error);
        // Don't fail the connection for this
      }
    }
  }

  /**
   * Starts periodic health checks
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.checkHealth();
        if (this.connectionStatus !== ConnectionStatus.CONNECTED) {
          this.setConnectionStatus(ConnectionStatus.CONNECTED);
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
    // Try multiple endpoints to find one that works
    const healthEndpoints = [
      '/project/current',  // Most lightweight endpoint
      '/config',           // Configuration endpoint  
      '/web/',             // Web interface
    ];
    
    let lastError: Error | undefined;
    let detailedErrors: string[] = [];
    
    // First, check if the port is even listening
    try {
      const basicConnection = await fetch(`http://localhost:${this.port}/`, {
        method: 'GET',
        signal: AbortSignal.timeout(1000)
      });
      console.log(`[SuperCode-${this.getShortId()}] Basic connection test: ${basicConnection.status}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`[SuperCode-${this.getShortId()}] Basic connection failed: ${errorMsg}`);
      detailedErrors.push(`Basic connection: ${errorMsg}`);
    }
    
    for (const endpoint of healthEndpoints) {
      try {
        console.log(`[SuperCode-${this.getShortId()}] Health check: http://localhost:${this.port}${endpoint}`);
        
        const response = await fetch(`http://localhost:${this.port}${endpoint}`, {
          method: 'GET',
          signal: AbortSignal.timeout(3000),
          headers: {
            'Accept': 'application/json, text/html, */*',
            'User-Agent': 'VS Code Extension'
          }
        });
        
        console.log(`[SuperCode-${this.getShortId()}] Health check response: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
          console.log(`[SuperCode-${this.getShortId()}] Health check successful with endpoint: ${endpoint}`);
          
          // Log some response details for debugging
          const contentType = response.headers.get('content-type');
          console.log(`[SuperCode-${this.getShortId()}] Response content-type: ${contentType}`);
          
          // Try to read a bit of the response for debugging
          try {
            const responseClone = response.clone();
            const text = await responseClone.text();
            const preview = text.length > 200 ? text.substring(0, 200) + '...' : text;
            console.log(`[SuperCode-${this.getShortId()}] Response preview: ${preview}`);
          } catch (readError) {
            console.log(`[SuperCode-${this.getShortId()}] Could not read response body:`, readError);
          }
          
          return; // Success!
        }
        
        lastError = new Error(`${endpoint}: ${response.status} ${response.statusText}`);
        detailedErrors.push(`${endpoint}: ${response.status} ${response.statusText}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log(`[SuperCode-${this.getShortId()}] Health check error for ${endpoint}: ${errorMsg}`);
        lastError = error instanceof Error ? error : new Error(String(error));
        detailedErrors.push(`${endpoint}: ${errorMsg}`);
      }
    }
    
    // If we get here, all endpoints failed
    const diagnosticInfo = [
      `Port: ${this.port}`,
      `Process PID: ${this.process?.pid || 'unknown'}`,
      `Process killed: ${this.process?.killed || 'unknown'}`,
      `Working directory: ${process.cwd()}`,
      `Errors: ${detailedErrors.join('; ')}`
    ].join(' | ');
    
    console.error(`[SuperCode-${this.getShortId()}] Complete diagnostic: ${diagnosticInfo}`);
    
    if (lastError instanceof Error) {
      if (lastError.name === 'AbortError') {
        throw new Error(`Health check timeout after 3 seconds. ${diagnosticInfo}`);
      }
      if (lastError.message.includes('ECONNREFUSED') || lastError.message.includes('fetch failed')) {
        throw new Error(`SuperCode TUI not responding - connection refused. Check external terminal window for SuperCode status. ${diagnosticInfo}`);
      }
      if (lastError.message.includes('ENOTFOUND')) {
        throw new Error(`DNS resolution failed for localhost. ${diagnosticInfo}`);
      }
      if (lastError.message.includes('EADDRINUSE')) {
        throw new Error(`Port ${this.port} is already in use. ${diagnosticInfo}`);
      }
    }
    
    throw new Error(`All health check endpoints failed. ${diagnosticInfo}`);
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
      this.sendMessageToWebview('system', 'Attempting to reconnect...');
      
      // Try to reconnect without spawning a new process first
      await this.establishConnection();
      
      this.sendMessageToWebview('system', 'Reconnected successfully!');
    } catch (error) {
      console.error('Reconnection failed:', error);
      this.setConnectionStatus(ConnectionStatus.ERROR);
      this.sendMessageToWebview('error', `Reconnection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
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
      this.sendMessageToWebview('system', 'Restarting SuperCode instance...');
      
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

      // Spawn new external process and establish connection
      await this.spawnSuperCodeProcess();
      await this.establishConnection();
      this.startHealthCheck();
      
      this.sendMessageToWebview('system', 'SuperCode instance restarted successfully!');
      
    } catch (error) {
      console.error('Process restart failed:', error);
      this.setConnectionStatus(ConnectionStatus.ERROR);
      this.sendMessageToWebview('error', `Restart failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sends a prompt to the SuperCode instance
   */
  private async appendPrompt(text: string): Promise<void> {
    await fetch(`http://localhost:${this.port}/tui/append-prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });
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
   * Sends a message to the SuperCode instance via API
   */
  private async sendMessageToSuperCode(text: string): Promise<void> {
    if (this.connectionStatus !== ConnectionStatus.CONNECTED) {
      this.sendMessageToWebview('error', 'Not connected to SuperCode instance');
      return;
    }

    try {
      // Step 1: Append the prompt text
      const appendResponse = await fetch(`http://localhost:${this.port}/tui/append-prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(10000)
      });

      if (!appendResponse.ok) {
        throw new Error(`Failed to append prompt: ${appendResponse.status} ${appendResponse.statusText}`);
      }

      // Step 2: Submit the prompt to trigger processing
      const submitResponse = await fetch(`http://localhost:${this.port}/tui/submit-prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(30000) // 30 second timeout for processing
      });

      if (!submitResponse.ok) {
        throw new Error(`Failed to submit prompt: ${submitResponse.status} ${submitResponse.statusText}`);
      }

      // Send success message to webview (actual response will come through TUI)
      this.sendMessageToWebview('system', 'Message sent to SuperCode. Processing...');
      
    } catch (error) {
      console.error('Failed to send message to SuperCode:', error);
      this.sendMessageToWebview('error', `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sends a message to the webview for display
   */
  private sendMessageToWebview(type: 'assistant' | 'error' | 'system', content: string): void {
    if (this.panel && this.panel.webview) {
      try {
        this.panel.webview.postMessage({
          command: 'addMessage',
          type: type,
          content: content
        });
      } catch (error) {
        console.error(`[SuperCode-${this.getShortId()}] Failed to send message to webview:`, error);
      }
    } else {
      console.log(`[SuperCode-${this.getShortId()}] Webview not ready, message: ${type}: ${content}`);
    }
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
                        addMessage(message.type, message.content);
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