import * as vscode from 'vscode';
import * as path from 'path';
import { readFileSync, existsSync } from 'fs';

/**
 * Manages Vite-compiled webview content for SuperCode
 * This replaces the hardcoded HTML approach with compiled Vite output
 */
export class ViteWebviewManager {
  private static compiledContent: string | null = null;
  private static lastModified: number = 0;

  /**
   * Gets the webview content from the compiled Vite output
   * Falls back to a basic HTML template if Vite output is not available
   */
  public static getWebviewContent(port: number, context: vscode.ExtensionContext): string {
    try {
      // Try to load the compiled Vite output
      const viteOutput = this.loadViteOutput(context);
      if (viteOutput) {
        return viteOutput.replace('${port}', port.toString());
      }
    } catch (error) {
      console.warn('[ViteWebviewManager] Failed to load Vite output, falling back to basic template:', error);
    }

    // Fallback to a basic template
    return this.getFallbackContent(port);
  }

  /**
   * Loads the compiled Vite output
   */
  private static loadViteOutput(context: vscode.ExtensionContext): string | null {
    const viteOutputPath = path.join(
      context.extensionPath,
      '..',
      '..',
      'packages',
      'vscode-webview',
      'vscode-output',
      'webview-content.js'
    );

    if (!existsSync(viteOutputPath)) {
      console.info('[ViteWebviewManager] Vite output not found at:', viteOutputPath);
      return null;
    }

    try {
      const stats = require('fs').statSync(viteOutputPath);
      const modified = stats.mtime.getTime();

      // Use cached content if file hasn't changed
      if (this.compiledContent && modified <= this.lastModified) {
        return this.compiledContent;
      }

      // Load and cache the content
      const content = readFileSync(viteOutputPath, 'utf-8');
      
      // Execute the module to get the getWebviewContent function
      const module = { exports: {} };
      const exports = module.exports;
      
      // Use Function constructor to safely evaluate the module
      const moduleFunc = new Function('module', 'exports', content);
      moduleFunc(module, exports);
      
      if (typeof (exports as any).getWebviewContent === 'function') {
        this.compiledContent = (exports as any).getWebviewContent('${port}');
        this.lastModified = modified;
        console.info('[ViteWebviewManager] Loaded Vite-compiled webview content');
        return this.compiledContent;
      } else {
        console.warn('[ViteWebviewManager] getWebviewContent function not found in Vite output');
        return null;
      }
    } catch (error) {
      console.error('[ViteWebviewManager] Error loading Vite output:', error);
      return null;
    }
  }

  /**
   * Basic fallback template when Vite output is not available
   * This provides essential functionality while the full Vite build is being set up
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
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            margin: 0;
            padding: 20px;
            text-align: center;
        }
        .fallback-container {
            max-width: 600px;
            margin: 0 auto;
            padding: 2rem;
        }
        .status {
            background: var(--vscode-inputValidation-warningBackground);
            border: 1px solid var(--vscode-inputValidation-warningBorder);
            padding: 1rem;
            border-radius: 4px;
            margin-bottom: 2rem;
        }
        .instructions {
            background: var(--vscode-editor-inactiveSelectionBackground);
            padding: 1rem;
            border-radius: 4px;
            text-align: left;
            line-height: 1.5;
        }
        code {
            background: var(--vscode-textBlockQuote-background);
            padding: 2px 4px;
            border-radius: 2px;
            font-family: var(--vscode-editor-font-family);
        }
    </style>
</head>
<body>
    <div class="fallback-container">
        <div class="status">
            <h3>⚠️ Development Mode - Vite Output Not Found</h3>
            <p>SuperCode is running with basic webview fallback.</p>
            <p><strong>Port:</strong> ${port}</p>
        </div>
        
        <div class="instructions">
            <h4>To enable the full Vite-based interface:</h4>
            <ol>
                <li>Navigate to the webview package:
                    <br><code>cd packages/vscode-webview</code>
                </li>
                <li>Install dependencies:
                    <br><code>npm install</code>
                </li>
                <li>Build for VS Code:
                    <br><code>npm run build:vscode</code>
                </li>
                <li>Restart the VS Code extension</li>
            </ol>
            
            <p><strong>Development:</strong> Use <code>npm run dev</code> in the webview package to develop the interface with hot reload.</p>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        // Basic VS Code integration for fallback mode
        console.log('SuperCode Webview Fallback - Port:', ${port});
        
        // Request initial status
        vscode.postMessage({ command: 'requestStatus' });
    </script>
</body>
</html>`;
  }

  /**
   * Clears the cached content (useful for development)
   */
  public static clearCache(): void {
    this.compiledContent = null;
    this.lastModified = 0;
  }
}