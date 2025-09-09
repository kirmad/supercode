import * as vscode from 'vscode';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { ViteWebviewManager } from './ViteWebviewManager';
import { ConnectionStatus } from './SuperCodeInstance';

/**
 * SuperCode instance that uses Vite-compiled webview content
 * This is a composition-based approach that wraps the original functionality
 * with Vite-based webview content generation
 */
export class SuperCodeInstanceVite {
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
   * Initializes the SuperCode instance with Vite webview content
   */
  public async initialize(): Promise<void> {
    try {
      console.log(`[SuperCode-Vite-${this.getShortId()}] Initializing instance on port ${this.port}`);
      
      this.createWebviewPanel();
      this.sendMessageToWebview('system', `🚀 Launching SuperCode with Vite interface on port ${this.port}...`);
      
      // Note: For now, we're only setting up the Vite webview interface
      // The process spawning logic can be copied from SuperCodeInstance if needed
      
      this.setConnectionStatus(ConnectionStatus.CONNECTED);
      this.sendMessageToWebview('system', '✅ Vite webview interface ready!');
      
      console.log(`[SuperCode-Vite-${this.getShortId()}] Vite interface initialization complete`);
      
    } catch (error) {
      console.error(`[SuperCode-Vite-${this.getShortId()}] Initialization failed:`, error);
      this.setConnectionStatus(ConnectionStatus.ERROR);
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
      console.log(`[SuperCode-Vite-${this.getShortId()}] Terminating external process (PID: ${this.process.pid})`);
      this.process.kill('SIGTERM');
    }

    if (this.panel) {
      this.panel.dispose();
    }

    this.onDispose();
  }

  /**
   * Creates the webview panel with Vite-compiled content
   */
  private createWebviewPanel(): void {
    this.panel = vscode.window.createWebviewPanel(
      'supercodeViteWebview',
      `SuperCode Vite ${this.getShortId()}`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(this.context.extensionPath, 'src/webview/templates'))
        ]
      }
    );

    // Set Vite-compiled HTML content
    this.panel.webview.html = ViteWebviewManager.getWebviewContent(this.port, this.context);

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

    this.panel.title = `${statusEmoji[this.connectionStatus]} SuperCode Vite ${this.getShortId()}`;
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
        this.sendMessageToWebview('system', `[Vite Demo] Received: ${message.text}`);
        break;
      
      case 'requestStatus':
        this.sendStatusUpdate();
        break;
        
      case 'retry':
        this.sendMessageToWebview('system', 'Retry functionality to be implemented...');
        break;
        
      case 'restart':
        this.sendMessageToWebview('system', 'Restart functionality to be implemented...');
        break;
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
        console.error(`[SuperCode-Vite-${this.getShortId()}] Failed to send message to webview:`, error);
      }
    } else {
      console.log(`[SuperCode-Vite-${this.getShortId()}] Webview not ready, message: ${type}: ${content}`);
    }
  }

  /**
   * Gets a short ID for display purposes
   */
  private getShortId(): string {
    return this.instanceId.split('-').pop() || this.instanceId;
  }
}

// Re-export the ConnectionStatus enum for convenience
export { ConnectionStatus } from './SuperCodeInstance';