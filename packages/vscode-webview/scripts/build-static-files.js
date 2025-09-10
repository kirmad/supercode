#!/usr/bin/env node

/**
 * Build script that generates separate static files for VS Code webview consumption
 * This approach hosts HTML, CSS, and JS as separate files instead of concatenating
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, '..', 'dist')
const staticDir = join(__dirname, '..', 'vscode-static')

// Ensure dist directory exists
if (!existsSync(distDir)) {
  console.error('❌ Dist directory not found. Run "npm run build" first.')
  process.exit(1)
}

try {
  // Ensure output directory exists
  if (!existsSync(staticDir)) {
    mkdirSync(staticDir, { recursive: true })
  }

  // Copy built JS and CSS files directly
  const jsFile = join(distDir, 'webview.js')
  const cssFile = join(distDir, 'style.css')
  
  if (existsSync(jsFile)) {
    copyFileSync(jsFile, join(staticDir, 'webview.js'))
    console.log('✅ Copied webview.js')
  } else {
    console.error('❌ webview.js not found in dist/')
    process.exit(1)
  }
  
  if (existsSync(cssFile)) {
    copyFileSync(cssFile, join(staticDir, 'webview.css'))
    console.log('✅ Copied webview.css')
  } else {
    console.log('⚠️  No CSS file found, creating empty one')
    writeFileSync(join(staticDir, 'webview.css'), '/* No styles generated */')
  }
  
  // Create the HTML template file
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SuperCode</title>
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src {{cspSource}}; script-src {{cspSource}} 'unsafe-inline'; connect-src http://localhost:* ws://localhost:*;">
    <link href="{{cssUri}}" rel="stylesheet" />
</head>
<body>
    <div id="app"></div>
    <script>
        // VS Code API setup
        const vscode = acquireVsCodeApi();
        window.vscode = vscode;
        window.supercodePort = {{port}};
    </script>
    <script src="{{scriptUri}}"></script>
</body>
</html>`

  writeFileSync(join(staticDir, 'index.html'), htmlContent)
  console.log('✅ Generated index.html template')
  
  // Create the TypeScript helper for VS Code extension
  const helperContent = `import * as vscode from 'vscode';
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
        .replace(/\\{\\{port\\}\\}/g, port.toString())
        .replace(/\\{\\{cssUri\\}\\}/g, cssUri.toString())
        .replace(/\\{\\{scriptUri\\}\\}/g, scriptUri.toString())
        .replace(/\\{\\{cspSource\\}\\}/g, webview.cspSource);
        
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
    return \`<!DOCTYPE html>
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
        <p><strong>Port:</strong> \${port}</p>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        window.vscode = vscode;
        window.supercodePort = \${port};
        vscode.postMessage({ command: 'requestStatus' });
    </script>
</body>
</html>\`;
  }
  
  /**
   * Clear template cache (useful for development)
   */
  public static clearCache(): void {
    this.htmlTemplate = null;
  }
}
`

  writeFileSync(join(staticDir, 'provider.ts'), helperContent)
  console.log('✅ Generated TypeScript provider')
  
  console.log('🎉 Static webview files generated successfully!')
  console.log(`📁 Output directory: ${staticDir}`)
  console.log('📋 Files created:')
  console.log('   - index.html (HTML template)')
  console.log('   - webview.js (Vue application)')  
  console.log('   - webview.css (Compiled styles)')
  console.log('   - provider.ts (VS Code integration helper)')
  console.log('')
  console.log('🔗 Usage in VS Code extension:')
  console.log('   import { StaticWebviewProvider } from "./packages/vscode-webview/vscode-static/provider"')
  console.log('   panel.webview.html = StaticWebviewProvider.getWebviewContent(port, context, panel.webview)')
  
} catch (error) {
  console.error('❌ Build failed:', error)
  process.exit(1)
}