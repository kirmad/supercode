import * as vscode from 'vscode';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { StaticWebviewManager } from './StaticWebviewManager';
import { ConnectionStatus } from './ConnectionStatus';

/**
 * SuperCode instance that uses static files approach (HTML + CSS + JS files)
 * This demonstrates the clean, modern way to build webviews without string concatenation
 */
export class SuperCodeInstanceStatic {
  private panel: vscode.WebviewPanel | undefined;
  private process: ChildProcess | undefined;
  private connectionStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private healthCheckInterval: NodeJS.Timeout | undefined;
  private connectToExisting: boolean = false;

  constructor(
    private instanceId: string,
    private port: number,
    private context: vscode.ExtensionContext,
    private onDispose: () => void,
    connectToExisting: boolean = false
  ) {
    this.connectToExisting = connectToExisting;
  }

  /**
   * Initializes the SuperCode instance with static file webview content
   */
  public async initialize(): Promise<void> {
    try {
      console.log(`[SuperCode-Static-${this.getShortId()}] Initializing instance on port ${this.port}`);
      
      this.createWebviewPanel();
      
      if (this.connectToExisting) {
        this.sendMessageToWebview('system', `🔗 Connecting to existing SuperCode instance on port ${this.port}...`);
        
        await this.establishConnection();
        this.sendMessageToWebview('system', '🎉 Connected to existing SuperCode instance!');
      } else {
        this.sendMessageToWebview('system', `🚀 Launching SuperCode with static files on port ${this.port}...`);
        
        await this.spawnSuperCodeProcess();
        this.sendMessageToWebview('system', '✅ Process started, establishing connection...');
        
        await this.establishConnection();
        this.sendMessageToWebview('system', '🎉 Connected! SuperCode is ready.');
      }
      
      this.startHealthCheck();
      console.log(`[SuperCode-Static-${this.getShortId()}] Static interface initialization complete`);
      
    } catch (error) {
      console.error(`[SuperCode-Static-${this.getShortId()}] Initialization failed:`, error);
      this.setConnectionStatus(ConnectionStatus.ERROR);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const action = this.connectToExisting ? 'connect to' : 'start';
      this.sendMessageToWebview('error', `Failed to ${action} SuperCode: ${errorMessage}`);
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
      console.log(`[SuperCode-Static-${this.getShortId()}] Terminating external process (PID: ${this.process.pid})`);
      this.process.kill('SIGTERM');
    }

    if (this.panel) {
      this.panel.dispose();
    }

    this.onDispose();
  }

  /**
   * Creates the webview panel using static files approach
   */
  private createWebviewPanel(): void {
    this.panel = vscode.window.createWebviewPanel(
      'supercodeStaticWebview',
      `SuperCode Static ${this.getShortId()}`,
      vscode.ViewColumn.Beside,
      {
        ...StaticWebviewManager.getWebviewPanelOptions(),
        ...StaticWebviewManager.getWebviewOptions(this.context)
      }
    );

    // Set HTML content using static files (much cleaner!)
    this.panel.webview.html = StaticWebviewManager.getWebviewContent(
      this.port, 
      this.context, 
      this.panel.webview
    );

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

    this.panel.title = `${statusEmoji[this.connectionStatus]} SuperCode Static ${this.getShortId()}`;
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
        if (this.connectionStatus === ConnectionStatus.CONNECTED) {
          await this.sendMessageToSuperCode(message.text);
        } else {
          this.sendMessageToWebview('error', 'SuperCode is not connected');
        }
        break;
      
      case 'requestStatus':
        this.sendStatusUpdate();
        break;
        
      case 'retry':
        if (this.connectionStatus === ConnectionStatus.ERROR) {
          try {
            await this.establishConnection();
            this.sendMessageToWebview('system', 'Connection restored!');
          } catch (error) {
            this.sendMessageToWebview('error', 'Retry failed. Please check external terminal.');
          }
        }
        break;
        
      case 'restart':
        this.sendMessageToWebview('system', 'Restarting SuperCode...');
        await this.restartProcess();
        break;
    }
  }

  /**
   * Restarts the SuperCode process
   */
  private async restartProcess(): Promise<void> {
    try {
      // Stop health check
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      // Kill existing process
      if (this.process && !this.process.killed) {
        this.process.kill('SIGTERM');
      }

      this.setConnectionStatus(ConnectionStatus.CONNECTING);
      
      // Respawn and reconnect
      await this.spawnSuperCodeProcess();
      await this.establishConnection();
      this.startHealthCheck();
      
      this.sendMessageToWebview('system', 'SuperCode restarted successfully!');
      
    } catch (error) {
      console.error('Process restart failed:', error);
      this.setConnectionStatus(ConnectionStatus.ERROR);
      this.sendMessageToWebview('error', `Restart failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
        console.error(`[SuperCode-Static-${this.getShortId()}] Failed to send message to webview:`, error);
      }
    } else {
      console.log(`[SuperCode-Static-${this.getShortId()}] Webview not ready, message: ${type}: ${content}`);
    }
  }

  /**
   * Gets a short ID for display purposes
   */
  private getShortId(): string {
    return this.instanceId.split('-').pop() || this.instanceId;
  }

  /**
   * Spawns the SuperCode process in an external terminal
   */
  private async spawnSuperCodeProcess(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`[SuperCode-Static-${this.getShortId()}] Spawning external SuperCode process on port ${this.port}`);
      console.log(`[SuperCode-Static-${this.getShortId()}] Working directory: ${process.cwd()}`);
      console.log(`[SuperCode-Static-${this.getShortId()}] Command: supercode --port ${this.port} --hostname 127.0.0.1`);
      
      // Launch SuperCode TUI in a visible external terminal window
      const platform = process.platform;
      const workingDir = process.cwd().replace(/'/g, "'\\''"); // Escape single quotes
      const supercodeCommand = `supercode --port ${this.port} --hostname 127.0.0.1`;
      
      let terminalCommand: string[] = [];
      let terminalExecutable: string = '';
      
      if (platform === 'darwin') {
        // macOS: Use Terminal.app with open command
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
        // Linux: Try common terminal emulators
        const terminals = ['gnome-terminal', 'konsole', 'xfce4-terminal', 'x-terminal-emulator', 'xterm'];
        
        for (const terminal of terminals) {
          try {
            require('child_process').execSync(`which ${terminal}`, { stdio: 'ignore' });
            terminalExecutable = terminal;
            break;
          } catch (error) {
            continue;
          }
        }
        
        if (terminalExecutable === 'gnome-terminal') {
          terminalCommand = ['--', 'bash', '-c', `cd '${workingDir}' && exec ${supercodeCommand}`];
        } else {
          terminalExecutable = terminalExecutable || 'xterm';
          terminalCommand = ['-e', 'bash', '-c', `cd '${workingDir}' && exec ${supercodeCommand}`];
        }
      }
      
      console.log(`[SuperCode-Static-${this.getShortId()}] Launching external terminal: ${terminalExecutable} ${terminalCommand.join(' ')}`);
      
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

      console.log(`[SuperCode-Static-${this.getShortId()}] SuperCode launched with PID: ${this.process.pid}`);
      
      let hasResolved = false;

      this.process.on('error', (error) => {
        console.error(`[SuperCode-Static-${this.getShortId()}] Process error:`, error);
        if (!hasResolved) {
          hasResolved = true;
          if (error.message.includes('ENOENT')) {
            reject(new Error('SuperCode command not found. Please ensure SuperCode is installed and in your PATH.'));
          } else {
            reject(new Error(`Failed to spawn SuperCode: ${error.message}`));
          }
        }
      });

      this.process.on('exit', (code) => {
        console.log(`[SuperCode-Static-${this.getShortId()}] Process exited with code: ${code}`);
        if (code !== null && code !== 0 && !hasResolved) {
          hasResolved = true;
          reject(new Error(`SuperCode process exited with code ${code}`));
        }
      });

      // Resolve immediately after spawning - connection will be established separately
      setTimeout(() => {
        if (!hasResolved) {
          hasResolved = true;
          resolve();
        }
      }, 2000);
    });
  }

  /**
   * Establishes connection to the SuperCode instance
   */
  private async establishConnection(): Promise<void> {
    this.setConnectionStatus(ConnectionStatus.CONNECTING);

    const maxAttempts = 30;
    const retryDelay = 1000;
    
    let connected = false;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`[SuperCode-Static-${this.getShortId()}] Connection attempt ${attempt}/${maxAttempts}`);
        await this.checkHealth();
        connected = true;
        console.log(`[SuperCode-Static-${this.getShortId()}] Successfully connected on attempt ${attempt}`);
        break;
      } catch (error) {
        console.log(`[SuperCode-Static-${this.getShortId()}] Connection attempt ${attempt}/${maxAttempts} failed:`, error instanceof Error ? error.message : error);
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
    
    if (!connected) {
      throw new Error(`Failed to connect to SuperCode TUI after ${maxAttempts} attempts. Check the external terminal window.`);
    }
    
    this.setConnectionStatus(ConnectionStatus.CONNECTED);
    
    // Send initial file context if available (same as original implementation)
    const activeFile = this.getActiveFile();
    if (activeFile) {
      try {
        await this.appendPrompt(`In ${activeFile}`);
      } catch (error) {
        console.log(`[SuperCode-Static-${this.getShortId()}] Failed to send initial context:`, error);
        // Don't fail the connection for this
      }
    }
  }

  /**
   * Checks if SuperCode is healthy and responding
   */
  private async checkHealth(): Promise<void> {
    // Try multiple endpoints to find one that works (same as original implementation)
    const healthEndpoints = [
      '/project/current',  // Most lightweight endpoint
      '/config',           // Configuration endpoint  
      '/web/',             // Web interface
    ];
    
    let lastError: Error | undefined;
    let detailedErrors: string[] = [];
    
    for (const endpoint of healthEndpoints) {
      try {
        console.log(`[SuperCode-Static-${this.getShortId()}] Health check: http://localhost:${this.port}${endpoint}`);
        
        const response = await fetch(`http://localhost:${this.port}${endpoint}`, {
          method: 'GET',
          signal: AbortSignal.timeout(3000),
          headers: {
            'Accept': 'application/json, text/html, */*',
            'User-Agent': 'VS Code Extension'
          }
        });

        if (response.ok) {
          console.log(`[SuperCode-Static-${this.getShortId()}] Health check successful: ${endpoint} returned ${response.status}`);
          return; // Success!
        }

        const errorMsg = `${endpoint} returned ${response.status} ${response.statusText}`;
        console.log(`[SuperCode-Static-${this.getShortId()}] ${errorMsg}`);
        detailedErrors.push(errorMsg);
        lastError = new Error(errorMsg);

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log(`[SuperCode-Static-${this.getShortId()}] ${endpoint} failed: ${errorMsg}`);
        detailedErrors.push(`${endpoint}: ${errorMsg}`);
        lastError = error instanceof Error ? error : new Error(errorMsg);
      }
    }
    
    // If we get here, all endpoints failed
    const diagnosticInfo = `Tried endpoints: ${healthEndpoints.join(', ')}. Errors: ${detailedErrors.join(' | ')}`;
    throw new Error(`All health check endpoints failed. ${diagnosticInfo}`);
  }

  /**
   * Starts periodic health checking
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.checkHealth();
        if (this.connectionStatus !== ConnectionStatus.CONNECTED) {
          this.setConnectionStatus(ConnectionStatus.CONNECTED);
        }
      } catch (error) {
        console.warn(`[SuperCode-Static-${this.getShortId()}] Health check failed:`, error);
        if (this.connectionStatus === ConnectionStatus.CONNECTED) {
          this.setConnectionStatus(ConnectionStatus.ERROR);
        }
      }
    }, 10000); // Check every 10 seconds
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
   * Sends a message to SuperCode with proper submission (same as original implementation)
   */
  private async sendMessageToSuperCode(text: string): Promise<void> {
    if (this.connectionStatus !== ConnectionStatus.CONNECTED) {
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
   * Gets the currently active file with line selection info
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

// Re-export the ConnectionStatus enum for convenience
export { ConnectionStatus } from './ConnectionStatus';