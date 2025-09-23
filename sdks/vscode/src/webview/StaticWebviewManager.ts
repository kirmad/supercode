import * as vscode from 'vscode';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Webview content provider using separate static files
 * This is much cleaner than concatenating strings!
 */
export class StaticWebviewManager {
  private static htmlTemplate: string | null = null;
  private static lastModified: number = 0;
  
  /**
   * Get webview content using separate static files (HTML, CSS, JS)
   */
  public static getWebviewContent(
    port: number,
    context: vscode.ExtensionContext,
    webview: vscode.Webview,
    adoSettings?: any
  ): string {
    try {
      // Load HTML template (with caching)
      const htmlTemplate = this.loadHtmlTemplate(context);
      if (!htmlTemplate) {
        return this.getFallbackContent(port);
      }
      
      // Get URIs for static resources using asWebviewUri
      const cssUri = webview.asWebviewUri(
        vscode.Uri.joinPath(context.extensionUri, 'static', 'webview.css')
      );
      
      const scriptUri = webview.asWebviewUri(
        vscode.Uri.joinPath(context.extensionUri, 'static', 'webview.js')
      );
      
      // Prepare ADO settings JSON for injection
      const adoSettingsJson = adoSettings
        ? JSON.stringify(adoSettings).replace(/'/g, '&#39;').replace(/"/g, '&quot;')
        : '{}';

      // Replace placeholders in HTML template
      return htmlTemplate
        .replace(/\{\{port\}\}/g, port.toString())
        .replace(/\{\{cssUri\}\}/g, cssUri.toString())
        .replace(/\{\{scriptUri\}\}/g, scriptUri.toString())
        .replace(/\{\{cspSource\}\}/g, webview.cspSource)
        .replace(/\{\{adoSettings\}\}/g, adoSettingsJson);
        
    } catch (error) {
      console.error('[StaticWebviewManager] Failed to load static files:', error);
      return this.getFallbackContent(port);
    }
  }
  
  /**
   * Get webview options with proper localResourceRoots for static files
   */
  public static getWebviewOptions(context: vscode.ExtensionContext): vscode.WebviewOptions {
    return {
      enableScripts: true,
      localResourceRoots: [
        // Allow access to the static files directory
        vscode.Uri.joinPath(context.extensionUri, 'static')
      ]
    };
  }
  
  /**
   * Get webview panel options
   */
  public static getWebviewPanelOptions(): vscode.WebviewPanelOptions {
    return {
      enableFindWidget: true,
      retainContextWhenHidden: true
    };
  }
  
  /**
   * Load HTML template with caching
   */
  private static loadHtmlTemplate(context: vscode.ExtensionContext): string | null {
    const htmlPath = join(
      context.extensionPath, 
      'static', 
      'index.html'
    );
    
    if (!existsSync(htmlPath)) {
      console.info('[StaticWebviewManager] HTML template not found at:', htmlPath);
      return null;
    }
    
    try {
      const stats = require('fs').statSync(htmlPath);
      const modified = stats.mtime.getTime();
      
      // Use cached content if file hasn't changed
      if (this.htmlTemplate && modified <= this.lastModified) {
        return this.htmlTemplate;
      }
      
      // Load and cache the template
      this.htmlTemplate = readFileSync(htmlPath, 'utf-8');
      this.lastModified = modified;
      
      console.info('[StaticWebviewManager] Loaded HTML template from static files');
      return this.htmlTemplate;
      
    } catch (error) {
      console.error('[StaticWebviewManager] Error loading HTML template:', error);
      return null;
    }
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
          border: 1px solid var(--vscode-inputValidation-errorBorder);
          color: var(--vscode-inputValidation-errorForeground);
          padding: 16px;
          border-radius: 4px;
          margin: 20px 0;
        }
        code {
          background: var(--vscode-textBlockQuote-background);
          padding: 2px 4px;
          border-radius: 2px;
        }
    </style>
</head>
<body>
    <div class="error">
        <h3>⚠️ Static Webview Files Not Found</h3>
        <p>The Vite-compiled static files are missing.</p>
        <p><strong>To fix this:</strong></p>
        <ol style="text-align: left; display: inline-block;">
            <li>Navigate to: <code>packages/vscode-webview/</code></li>
            <li>Run: <code>npm install</code></li>
            <li>Build: <code>npm run build:static</code></li>
            <li>Reload the VS Code extension</li>
        </ol>
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
    this.lastModified = 0;
  }
}