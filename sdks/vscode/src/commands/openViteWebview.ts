import * as vscode from 'vscode';
import { SuperCodeWebviewManagerVite } from '../webview/SuperCodeWebviewManagerVite';

let webviewManager: SuperCodeWebviewManagerVite | undefined;

/**
 * Command to open a new SuperCode webview with Vite-based interface
 * This demonstrates the new Vite-compiled web interface functionality
 */
export function registerOpenViteWebviewCommand(context: vscode.ExtensionContext) {
  // Initialize the Vite webview manager
  if (!webviewManager) {
    webviewManager = new SuperCodeWebviewManagerVite(context);
  }

  // Register the command
  const command = vscode.commands.registerCommand('supercode.openViteWebview', async () => {
    try {
      await webviewManager!.openNewWebview();
      
      // Show information message about the new interface
      vscode.window.showInformationMessage(
        'SuperCode Vite Interface opened! This uses the new Vite-compiled web interface.',
        'View Documentation'
      ).then(selection => {
        if (selection === 'View Documentation') {
          vscode.env.openExternal(vscode.Uri.parse('https://github.com/kirmad/supercode/tree/dev/packages/vscode-webview'));
        }
      });
      
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open SuperCode Vite interface: ${error}`);
    }
  });

  context.subscriptions.push(command);

  // Clean up on extension deactivation
  context.subscriptions.push({
    dispose: () => {
      if (webviewManager) {
        webviewManager.dispose();
        webviewManager = undefined;
      }
    }
  });
}

/**
 * Get the current webview manager instance (for testing or advanced usage)
 */
export function getWebviewManager(): SuperCodeWebviewManagerVite | undefined {
  return webviewManager;
}