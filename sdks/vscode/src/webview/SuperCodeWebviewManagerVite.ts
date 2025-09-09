import * as vscode from 'vscode';
import { SuperCodeInstanceVite } from './SuperCodeInstanceVite';

/**
 * Enhanced webview manager that uses Vite-compiled web interface
 * This replaces SuperCodeWebviewManager with Vite-based webview support
 */
export class SuperCodeWebviewManagerVite {
  private instances = new Map<string, SuperCodeInstanceVite>();
  private usedPorts = new Set<number>();
  
  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Opens a new SuperCode webview tab with Vite-compiled interface
   */
  public async openNewWebview(): Promise<void> {
    const instanceId = this.generateInstanceId();
    const port = this.allocatePort();
    
    try {
      const instance = new SuperCodeInstanceVite(
        instanceId,
        port,
        this.context,
        () => this.onInstanceDisposed(instanceId)
      );
      
      this.instances.set(instanceId, instance);
      this.usedPorts.add(port);
      
      await instance.initialize();
      
    } catch (error) {
      this.usedPorts.delete(port);
      console.error('Failed to create SuperCode instance with Vite interface:', error);
      vscode.window.showErrorMessage(`Failed to create SuperCode instance: ${error}`);
    }
  }

  /**
   * Gets all active instances
   */
  public getInstances(): SuperCodeInstanceVite[] {
    return Array.from(this.instances.values());
  }

  /**
   * Closes all instances and cleans up resources
   */
  public dispose(): void {
    for (const instance of this.instances.values()) {
      instance.dispose();
    }
    this.instances.clear();
    this.usedPorts.clear();
  }

  /**
   * Generates a unique instance ID
   */
  private generateInstanceId(): string {
    return `supercode-vite-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Allocates an available port for a new SuperCode instance
   */
  private allocatePort(): number {
    const minPort = 16384;
    const maxPort = 65535;
    let attempts = 0;
    const maxAttempts = 100;

    while (attempts < maxAttempts) {
      const port = Math.floor(Math.random() * (maxPort - minPort + 1)) + minPort;
      
      if (!this.usedPorts.has(port)) {
        return port;
      }
      
      attempts++;
    }

    throw new Error('Unable to allocate available port for SuperCode instance');
  }

  /**
   * Handles instance disposal cleanup
   */
  private onInstanceDisposed(instanceId: string): void {
    const instance = this.instances.get(instanceId);
    if (instance) {
      this.usedPorts.delete(instance.getPort());
      this.instances.delete(instanceId);
    }
  }
}