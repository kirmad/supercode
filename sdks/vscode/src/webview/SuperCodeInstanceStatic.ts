import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import { StaticWebviewManager } from './StaticWebviewManager';
import { ConnectionStatus } from './ConnectionStatus';
import { tuiManager } from '../utils/tuiInstanceManager';

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
   * Now waits for connection before opening UI to avoid race conditions
   */
  public async initialize(): Promise<void> {
    try {
      console.log(`[SuperCode-Static-${this.getShortId()}] Initializing instance on port ${this.port}`);
      
      // First establish the connection BEFORE creating the webview
      if (this.connectToExisting) {
        console.log(`[SuperCode-Static-${this.getShortId()}] Connecting to existing SuperCode instance on port ${this.port}...`);
        
        // Show progress notification while connecting
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: `Connecting to SuperCode on port ${this.port}...`,
          cancellable: false
        }, async () => {
          await this.establishConnectionWithoutPanel();
        });
        
        // Now that we're connected, create the webview panel
        this.createWebviewPanel();
        this.sendMessageToWebview('system', '🎉 Connected to existing SuperCode instance!');
      } else {
        console.log(`[SuperCode-Static-${this.getShortId()}] Launching SuperCode on port ${this.port}...`);
        
        // Show progress notification while spawning and connecting
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: `Starting SuperCode on port ${this.port}...`,
          cancellable: false
        }, async (progress) => {
          progress.report({ message: 'Spawning process...' });
          await this.spawnSuperCodeProcess();
          
          progress.report({ message: 'Establishing connection...' });
          await this.establishConnectionWithoutPanel();
        });
        
        // Now that we're connected, create the webview panel
        this.createWebviewPanel();
        this.sendMessageToWebview('system', '🎉 Connected! SuperCode is ready.');
      }
      
      this.startHealthCheck();
      console.log(`[SuperCode-Static-${this.getShortId()}] Static interface initialization complete`);
      
    } catch (error) {
      console.error(`[SuperCode-Static-${this.getShortId()}] Initialization failed:`, error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const action = this.connectToExisting ? 'connect to' : 'start';
      
      // Show error message to user
      const result = await vscode.window.showErrorMessage(
        `Failed to ${action} SuperCode: ${errorMessage}`,
        'Retry',
        'Cancel'
      );
      
      if (result === 'Retry') {
        // Retry initialization
        await this.initialize();
      } else {
        // Clean up and dispose
        this.dispose();
        throw error;
      }
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
   * Reveals the webview panel if it exists
   */
  public reveal(): void {
    if (this.panel) {
      this.panel.reveal();
    }
  }

  /**
   * Adds a prompt to the webview input field
   * This sends a message to the HTML to add text to the input bar
   * @param text - The text to add
   * @param variant - 'clearAndAdd' to clear existing text, 'appendWithSpacing' to add with line spacing
   */
  public addPromptToInput(text: string, variant: 'clearAndAdd' | 'appendWithSpacing' = 'clearAndAdd'): void {
    if (this.panel && this.panel.webview) {
      try {
        this.panel.webview.postMessage({
          command: 'addPrompt',
          text: text,
          variant: variant
        });
        console.log(`[SuperCode-Static-${this.getShortId()}] Sent addPrompt (${variant}) to webview: ${text}`);
      } catch (error) {
        console.error(`[SuperCode-Static-${this.getShortId()}] Failed to send addPrompt to webview:`, error);
      }
    } else {
      console.log(`[SuperCode-Static-${this.getShortId()}] Webview not ready for addPrompt (${variant}): ${text}`);
    }
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
        // Clear focus tracking when panel is disposed
        tuiManager.clearFocusedStaticInstance();
        this.panel = undefined;
        this.dispose();
      },
      null,
      this.context.subscriptions
    );

    // Handle panel visibility changes to track focus
    this.panel.onDidChangeViewState(
      (e) => {
        if (e.webviewPanel.active || e.webviewPanel.visible) {
          // Panel is now active/visible - set it as focused
          tuiManager.setFocusedStaticInstance(this.instanceId);
          console.log(`[SuperCode-Static-${this.getShortId()}] Panel became active/visible - set as focused instance`);
        } else {
          // Panel is no longer active/visible - check if we were the focused instance
          const currentFocused = tuiManager.getFocusedStaticInstance();
          if (currentFocused === this) {
            tuiManager.clearFocusedStaticInstance();
            console.log(`[SuperCode-Static-${this.getShortId()}] Panel lost focus - cleared focused instance`);
          }
        }
      },
      null,
      this.context.subscriptions
    );

    // Set as focused initially if this is the only/first instance
    tuiManager.setFocusedStaticInstance(this.instanceId);
    console.log(`[SuperCode-Static-${this.getShortId()}] Initial focus set for new panel`);

    // Update panel with current connection status (should be CONNECTED since we connect first now)
    this.updatePanelTitle();
    this.sendStatusUpdate();
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
    if (!this.panel) {
      return;
    }

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
   * 
   * Supports configurable terminal settings via VS Code settings:
   * - supercode.terminal.windows.preferWezTerm: Prefer WezTerm over cmd on Windows
   * - supercode.terminal.windows.weztermPath: Custom WezTerm path
   * - supercode.terminal.windows.weztermArgs: Custom WezTerm arguments with placeholders
   * - supercode.terminal.macOS.terminal: Terminal app preference (Terminal/iTerm2)  
   * - supercode.terminal.linux.terminal: Linux terminal preference
   * - supercode.terminal.workingDirectory: Working directory preference (workspace/current)
   */
  private async spawnSuperCodeProcess(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Get settings
      const config = vscode.workspace.getConfiguration('supercode');
      const workingDirSetting = config.get<string>('terminal.workingDirectory', 'workspace');
      
      // Determine working directory based on settings
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || process.cwd();
      const workingDirectory = workingDirSetting === 'workspace' ? workspaceFolder : process.cwd();
      
      console.log(`[SuperCode-Static-${this.getShortId()}] Spawning external SuperCode process on port ${this.port}`);
      console.log(`[SuperCode-Static-${this.getShortId()}] Working directory: ${workingDirectory}`);
      console.log(`[SuperCode-Static-${this.getShortId()}] Command: supercode --port ${this.port} --hostname 127.0.0.1`);
      
      // Launch SuperCode TUI in a visible external terminal window
      const platform = process.platform;
      const workingDir = workingDirectory.replace(/'/g, "'\\''"); // Escape single quotes for Unix
      const supercodeCommand = `supercode --port ${this.port} --hostname 127.0.0.1`;
      
      let terminalCommand: string[] = [];
      let terminalExecutable: string = '';
      
      if (platform === 'darwin') {
        // macOS: Use configured terminal or default to Terminal.app
        const terminalApp = config.get<string>('terminal.macOS.terminal', 'Terminal');
        const tempScript = `/tmp/supercode-${this.port}.sh`;
        require('fs').writeFileSync(tempScript, `#!/bin/bash\ncd '${workingDir}'\nexec ${supercodeCommand}`);
        require('fs').chmodSync(tempScript, 0o755);
        
        terminalExecutable = 'open';
        terminalCommand = ['-a', terminalApp, tempScript];
      } else if (platform === 'win32') {
        // Windows: Use WezTerm with configurable settings
        const preferWezTerm = config.get<boolean>('terminal.windows.preferWezTerm', true);
        const customWeztermPath = config.get<string>('terminal.windows.weztermPath', '');
        const weztermPreferEgl = config.get<boolean>('terminal.windows.weztermPreferEgl', false);
        const weztermArgs = config.get<string[]>('terminal.windows.weztermArgs', 
          ['start', '--cwd', '{workspaceFolder}', '--', 'cmd', '/c', '{command}']);
        
        const escapedWorkingDir = workingDirectory.replace(/"/g, '\\"');
        let weztermPath = '';
        
        if (preferWezTerm) {
          if (customWeztermPath) {
            // Use custom path if provided
            try {
              require('fs').accessSync(customWeztermPath);
              weztermPath = customWeztermPath;
            } catch (error) {
              console.log(`[SuperCode-Static-${this.getShortId()}] Custom WezTerm path not accessible: ${customWeztermPath}`);
            }
          }
          
          if (!weztermPath) {
            // Auto-detect WezTerm in common locations
            const weztermPaths = [
              process.env.PROGRAMFILES + '\\WezTerm\\wezterm-gui.exe',
              process.env['PROGRAMFILES(X86)'] + '\\WezTerm\\wezterm-gui.exe',
              process.env.LOCALAPPDATA + '\\Microsoft\\WindowsApps\\wezterm-gui.exe',
              'wezterm-gui.exe', // Try PATH
            ].filter(Boolean); // Remove undefined values
            
            for (const path of weztermPaths) {
              try {
                require('fs').accessSync(path as string);
                weztermPath = path as string;
                break;
              } catch (error) {
                continue;
              }
            }
          }
        }
        
        if (weztermPath) {
          // Use WezTerm with configurable arguments
          terminalExecutable = weztermPath;
          
          // Build the command arguments
          let cmdArgs = weztermArgs.map(arg => 
            arg.replace('{workspaceFolder}', `"${escapedWorkingDir}"`)
               .replace('{command}', supercodeCommand)
          );
          
          // Add EGL preference flag if enabled
          if (weztermPreferEgl) {
            cmdArgs = ['--config', 'prefer_egl=true', ...cmdArgs];
          }
          
          terminalCommand = cmdArgs;
        } else {
          // Fallback to cmd.exe in a new window
          terminalExecutable = 'cmd';
          terminalCommand = ['/c', 'start', 'cmd', '/k', `cd /d "${escapedWorkingDir}" && ${supercodeCommand}`];
        }
      } else {
        // Linux: Use configured terminal or auto-detect
        const preferredTerminal = config.get<string>('terminal.linux.terminal', 'auto');
        
        if (preferredTerminal !== 'auto') {
          // Use specific terminal if configured
          try {
            require('child_process').execSync(`which ${preferredTerminal}`, { stdio: 'ignore' });
            terminalExecutable = preferredTerminal;
          } catch (error) {
            console.log(`[SuperCode-Static-${this.getShortId()}] Configured terminal not found: ${preferredTerminal}, falling back to auto-detection`);
          }
        }
        
        if (!terminalExecutable) {
          // Auto-detect terminal emulators
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
   * Establishes connection to the SuperCode instance without requiring panel
   * Used during initialization before the webview is created
   */
  private async establishConnectionWithoutPanel(): Promise<void> {
    // Store initial connection status
    this.connectionStatus = ConnectionStatus.CONNECTING;

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
    
    // Set connection status without updating panel (since it doesn't exist yet)
    this.connectionStatus = ConnectionStatus.CONNECTED;
    
    // Send initial file context if available
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
        method: 'Post',
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
    if (!activeEditor) {
      return;
    }

    const document = activeEditor.document;
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) {
      return;
    }
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