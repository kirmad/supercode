import * as vscode from 'vscode';
import { SuperCodeInstanceStatic } from '../webview/SuperCodeInstanceStatic';

export interface TuiInstance {
  terminal?: vscode.Terminal;
  webview?: SuperCodeInstanceStatic;
  port: number;
  isConnected: boolean;
  method: 'static' | 'terminal';
}

interface PortInfo {
  port: number;
  timestamp: number; // When this port was created
}

class TuiInstanceManager {
  private instances = new Map<string, TuiInstance>();
  private persistentPorts = new Map<number, PortInfo>(); // Track TUI ports with timestamps
  private focusedStaticInstanceId: string | null = null; // Track which static instance is focused

  /**
   * Register a new terminal-based TUI instance
   */
  registerTerminalInstance(terminal: vscode.Terminal, port: number): void {
    this.instances.set(terminal.name, {
      terminal,
      port,
      isConnected: false,
      method: 'terminal'
    });
    this.persistentPorts.set(port, { port, timestamp: Date.now() });
  }

  /**
   * Register a new static webview-based TUI instance
   */
  registerStaticInstance(instanceId: string, webview: SuperCodeInstanceStatic, port: number): void {
    this.instances.set(instanceId, {
      webview,
      port,
      isConnected: false,
      method: 'static'
    });
    this.persistentPorts.set(port, { port, timestamp: Date.now() });
  }

  /**
   * Mark an instance as connected
   */
  markConnected(instanceId: string): void {
    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.isConnected = true;
    }
  }

  /**
   * Get a connected TUI instance if available
   */
  getConnectedInstance(preferredMethod?: 'static' | 'terminal'): TuiInstance | null {
    // Find connected instances and check their validity
    for (const [id, instance] of this.instances) {
      let isValid = false;
      
      if (instance.method === 'terminal' && instance.terminal) {
        // Check if terminal still exists in VS Code
        isValid = vscode.window.terminals.find(t => t.name === instance.terminal!.name) !== undefined;
      } else if (instance.method === 'static' && instance.webview) {
        // For static instances, check if webview panel is still valid
        isValid = instance.webview.getConnectionStatus() !== undefined;
      }
      
      if (isValid && instance.isConnected) {
        // If no preference or matches preference, return it
        if (!preferredMethod || instance.method === preferredMethod) {
          return instance;
        }
      } else if (!isValid) {
        // Clean up invalid instances
        this.instances.delete(id);
      }
    }
    
    return null;
  }

  /**
   * Check if a TUI instance is accessible (ping the port)
   * Tests both /app and /config endpoints as specified
   */
  async isInstanceAccessible(port: number): Promise<boolean> {
    try {
      // Test /app endpoint first
      const appResponse = await fetch(`http://localhost:${port}/app`, { 
        signal: AbortSignal.timeout(2000) 
      });
      if (appResponse.ok) {
        return true;
      }

      // Test /config endpoint as fallback
      const configResponse = await fetch(`http://localhost:${port}/config`, { 
        signal: AbortSignal.timeout(2000) 
      });
      return configResponse.ok;
    } catch {
      return false;
    }
  }

  /**
   * Open SuperCode with the correct logic:
   * 1. Always remove existing windows first
   * 2. Find the newest accessible TUI port and connect to it
   * 3. Only create new TUI if no accessible ports exist
   */
  async openSuperCode(
    createInstanceFn: () => Promise<TuiInstance>,
    connectToExistingFn?: (port: number) => Promise<TuiInstance>
  ): Promise<TuiInstance> {
    console.log('OpenSuperCode: Starting logic...');

    // Step 1: Always remove existing windows first
    console.log('OpenSuperCode: Removing existing windows...');
    this.closeAllActiveInstances();

    // Step 2: Look at all persistent ports from newest to oldest
    const sortedPorts = Array.from(this.persistentPorts.entries())
      .sort((a, b) => b[1].timestamp - a[1].timestamp) // Sort by timestamp, newest first
      .map(([port, _]) => port);

    console.log(`OpenSuperCode: Checking ${sortedPorts.length} persistent ports in order:`, sortedPorts);

    // Step 3: Test each port for accessibility
    for (const port of sortedPorts) {
      console.log(`OpenSuperCode: Testing port ${port}...`);
      const isAccessible = await this.isInstanceAccessible(port);
      
      if (isAccessible && connectToExistingFn) {
        console.log(`OpenSuperCode: Found accessible TUI on port ${port}, connecting...`);
        return await connectToExistingFn(port);
      } else if (!isAccessible) {
        console.log(`OpenSuperCode: Port ${port} is dead, removing from persistent ports`);
        // Clean up dead persistent ports
        this.persistentPorts.delete(port);
      }
    }

    // Step 4: No accessible ports found, create new TUI
    console.log('OpenSuperCode: No accessible ports found, creating new TUI...');
    return await createInstanceFn();
  }

  /**
   * Close all active instances (webviews and terminals)
   */
  private closeAllActiveInstances(): void {
    for (const [id, instance] of this.instances) {
      if (instance.method === 'static' && instance.webview) {
        console.log(`Disposing webview instance ${id}`);
        instance.webview.dispose();
      } else if (instance.method === 'terminal' && instance.terminal) {
        console.log(`Disposing terminal instance ${id}`);
        instance.terminal.dispose();
      }
    }
    // Clear the instances map, but keep persistent ports
    this.instances.clear();
  }

  /**
   * Remove a specific instance but keep the port in persistent storage
   */
  removeInstance(instanceId: string): void {
    this.instances.delete(instanceId);
    // Keep the port in persistentPorts so we can reconnect later
  }

  /**
   * Completely remove a port (when TUI is actually dead)
   */
  removePersistentPort(port: number): void {
    this.persistentPorts.delete(port);
  }

  /**
   * Clean up all instances
   */
  dispose(): void {
    this.instances.clear();
    this.persistentPorts.clear();
  }

  /**
   * Get all active instances (for debugging)
   */
  getActiveInstances(): TuiInstance[] {
    return Array.from(this.instances.values());
  }

  /**
   * Get all persistent ports (for debugging)
   */
  getPersistentPorts(): number[] {
    return Array.from(this.persistentPorts.keys());
  }

  /**
   * Set the focused static instance
   */
  setFocusedStaticInstance(instanceId: string): void {
    this.focusedStaticInstanceId = instanceId;
  }

  /**
   * Get the currently focused static instance
   */
  getFocusedStaticInstance(): SuperCodeInstanceStatic | null {
    if (!this.focusedStaticInstanceId) {
      return null;
    }
    
    const instance = this.instances.get(this.focusedStaticInstanceId);
    if (instance && instance.method === 'static' && instance.webview) {
      return instance.webview;
    }
    
    // Instance no longer exists, clear the focus
    this.focusedStaticInstanceId = null;
    return null;
  }

  /**
   * Clear the focused static instance
   */
  clearFocusedStaticInstance(): void {
    this.focusedStaticInstanceId = null;
  }
}

export const tuiManager = new TuiInstanceManager();