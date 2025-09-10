import * as vscode from 'vscode';
import { SuperCodeInstanceStatic } from '../webview/SuperCodeInstanceStatic';

let staticInstances = new Map<string, SuperCodeInstanceStatic>();
let usedPorts = new Set<number>();

/**
 * Commands to open SuperCode webviews using static files approach
 * This demonstrates hosting HTML, CSS, and JS as separate files (best practice!)
 */
export function registerOpenStaticWebviewCommand(context: vscode.ExtensionContext) {
  // Register the static webview command
  const staticCommand = vscode.commands.registerCommand('supercode.openStaticWebview', async () => {
    try {
      const instanceId = generateInstanceId();
      const port = allocatePort();
      
      const instance = new SuperCodeInstanceStatic(
        instanceId,
        port,
        context,
        () => onInstanceDisposed(instanceId)
      );
      
      staticInstances.set(instanceId, instance);
      usedPorts.add(port);
      
      await instance.initialize();
      
      // Show information message about the static files approach
      vscode.window.showInformationMessage(
        'SuperCode Static Interface opened! This uses separate HTML, CSS, and JS files - much cleaner than string concatenation!',
        'View Documentation',
        'Compare Approaches'
      ).then(selection => {
        if (selection === 'View Documentation') {
          vscode.env.openExternal(vscode.Uri.parse('https://github.com/kirmad/supercode/tree/dev/packages/vscode-webview#static-files-approach'));
        } else if (selection === 'Compare Approaches') {
          vscode.window.showInformationMessage(
            'Static Files vs String Concatenation:\n\n' +
            '✅ Static: Clean separation, better CSP, easier debugging\n' +
            '❌ Concat: Messy strings, security risks, maintenance issues\n\n' +
            'VS Code recommends using localResourceRoots + asWebviewUri for hosting static files.'
          );
        }
      });
      
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open SuperCode Static interface: ${error}`);
    }
  });

  // Register the connect to existing command
  const connectCommand = vscode.commands.registerCommand('supercode.connectToExisting', async () => {
    try {
      // Prompt user for port number
      const portString = await vscode.window.showInputBox({
        prompt: 'Enter the port number of the existing SuperCode instance',
        placeHolder: 'e.g., 25716',
        validateInput: (value: string) => {
          const port = parseInt(value);
          if (isNaN(port) || port < 1024 || port > 65535) {
            return 'Please enter a valid port number (1024-65535)';
          }
          if (usedPorts.has(port)) {
            return 'This port is already being used by another webview instance';
          }
          return null;
        }
      });

      if (!portString) {
        return; // User cancelled
      }

      const port = parseInt(portString);
      
      try {
        const instanceId = generateInstanceId();
        
        const instance = new SuperCodeInstanceStatic(
          instanceId,
          port,
          context,
          () => onInstanceDisposed(instanceId),
          true // Connect to existing instance instead of spawning new process
        );
        
        staticInstances.set(instanceId, instance);
        usedPorts.add(port);
        
        await instance.initialize();
        
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to connect to SuperCode instance on port ${port}: ${error}`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to connect to SuperCode instance: ${error}`);
    }
  });

  context.subscriptions.push(staticCommand, connectCommand);

  // Clean up on extension deactivation
  context.subscriptions.push({
    dispose: () => {
      for (const instance of staticInstances.values()) {
        instance.dispose();
      }
      staticInstances.clear();
      usedPorts.clear();
    }
  });
}

/**
 * Generates a unique instance ID
 */
function generateInstanceId(): string {
  return `supercode-static-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Allocates an available port for a new SuperCode instance
 */
function allocatePort(): number {
  const minPort = 16384;
  const maxPort = 65535;
  let attempts = 0;
  const maxAttempts = 100;

  while (attempts < maxAttempts) {
    const port = Math.floor(Math.random() * (maxPort - minPort + 1)) + minPort;
    
    if (!usedPorts.has(port)) {
      return port;
    }
    
    attempts++;
  }

  throw new Error('Unable to allocate available port for SuperCode instance');
}

/**
 * Handles instance disposal cleanup
 */
function onInstanceDisposed(instanceId: string): void {
  const instance = staticInstances.get(instanceId);
  if (instance) {
    usedPorts.delete(instance.getPort());
    staticInstances.delete(instanceId);
  }
}

/**
 * Get all active static instances (for testing or advanced usage)
 */
export function getStaticInstances(): SuperCodeInstanceStatic[] {
  return Array.from(staticInstances.values());
}