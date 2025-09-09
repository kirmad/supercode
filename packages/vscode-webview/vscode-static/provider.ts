import * as vscode from 'vscode';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Webview content provider using separate static files
 * This is much cleaner than concatenating strings!
 */
export class StaticWebviewProvider {
  private static htmlTemplate: string | null = null;
  
  /**
   * Get webview content using separate static files
   */
  public static getWebviewContent(
    port: number, 
    context: vscode.ExtensionContext,
    webview: vscode.Webview
  ): string {
    try {
      // Load HTML template (cached)
      if (!this.htmlTemplate) {
        const htmlPath = join(context.extensionPath, '..', '..', 'packages', 'vscode-webview', 'vscode-static', 'index.html');
        this.htmlTemplate = readFileSync(htmlPath, 'utf-8');
      }
      
      // Get URIs for static resources
      const cssUri = webview.asWebviewUri(
        vscode.Uri.joinPath(context.extensionUri, '..', '..', 'packages', 'vscode-webview', 'vscode-static', 'webview.css')
      );
      
      const scriptUri = webview.asWebviewUri(
        vscode.Uri.joinPath(context.extensionUri, '..', '..', 'packages', 'vscode-webview', 'vscode-static', 'webview.js')
      );
      
      // Replace placeholders in HTML template
      return this.htmlTemplate
        .replace(/\{\{port\}\}/g, port.toString())
        .replace(/\{\{cssUri\}\}/g, cssUri.toString())
        .replace(/\{\{scriptUri\}\}/g, scriptUri.toString())
        .replace(/\{\{cspSource\}\}/g, webview.cspSource);
        
    } catch (error) {
      console.error('[StaticWebviewProvider] Failed to load static files:', error);
      return this.getFallbackContent(port);
    }
  }
  
  /**
   * Get webview options with proper localResourceRoots
   */
  public static getWebviewOptions(context: vscode.ExtensionContext): vscode.WebviewOptions {
    return {
      enableScripts: true,
      localResourceRoots: [
        // Allow access to the static files directory
        vscode.Uri.joinPath(context.extensionUri, '..', '..', 'packages', 'vscode-webview', 'vscode-static')
      ]
    };
  }
  
  /**
   * Fallback content when static files are not available
   */
  private static getFallbackContent(port: number): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SuperCode</title>
    <style>
        body { 
          font-family: var(--vscode-font-family); 
          background: var(--vscode-editor-background); 
          color: var(--vscode-foreground);
          padding: 20px;
          text-align: center;
        }
        .error { 
          background: var(--vscode-inputValidation-errorBackground);
          padding: 16px;
          border-radius: 4px;
          margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="error">
        <h3>⚠️ Static Files Not Found</h3>
        <p>Run <code>npm run build:static</code> in packages/vscode-webview/</p>
        <p><strong>Port:</strong> ${port}</p>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        window.vscode = vscode;
        window.supercodePort = ${port};
        vscode.postMessage({ command: 'requestStatus' });
    </script>
</body>
</html>`;
  }
  
  /**
   * Clear template cache (useful for development)
   */
  public static clearCache(): void {
    this.htmlTemplate = null;
  }
}
