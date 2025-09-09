#!/usr/bin/env node

/**
 * Build script that prepares the Vite output for VS Code extension consumption
 * This script runs after Vite build and generates the necessary files for the extension
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, '..', 'dist')
const outputDir = join(__dirname, '..', 'vscode-output')

// Ensure dist directory exists
if (!existsSync(distDir)) {
  console.error('❌ Dist directory not found. Run "npm run build" first.')
  process.exit(1)
}

try {
  // Read the built files
  const jsFile = join(distDir, 'webview.js')
  const cssFile = join(distDir, 'style.css')
  
  let jsContent = ''
  let cssContent = ''
  
  if (existsSync(jsFile)) {
    jsContent = readFileSync(jsFile, 'utf-8')
  } else {
    console.error('❌ webview.js not found in dist/')
    process.exit(1)
  }
  
  if (existsSync(cssFile)) {
    cssContent = readFileSync(cssFile, 'utf-8')
  }
  
  // Generate the HTML template function that the VS Code extension can use
  const htmlTemplate = `
/**
 * Generated webview content for SuperCode VS Code extension
 * This file is auto-generated from the Vite build process
 */

export function getWebviewContent(port) {
  return \`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SuperCode</title>
    <style>
        ${cssContent.replace(/`/g, '\\`').replace(/\$/g, '\\$')}
    </style>
</head>
<body>
    <div id="app"></div>
    <script>
        // VS Code API setup
        const vscode = acquireVsCodeApi();
        window.vscode = vscode;
        window.supercodePort = \${port};
        
        // Inject the built JavaScript
        ${jsContent.replace(/`/g, '\\`').replace(/\$/g, '\\$')}
    </script>
</body>
</html>\`;
}
`
  
  // Ensure output directory exists
  import('fs').then(fs => {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }
    
    // Write the template file
    const outputFile = join(outputDir, 'webview-content.js')
    writeFileSync(outputFile, htmlTemplate)
    
    console.log('✅ VS Code webview content generated successfully!')
    console.log(`📁 Output: ${outputFile}`)
    console.log('🔗 Import this in your VS Code extension:')
    console.log('   import { getWebviewContent } from "./packages/vscode-webview/vscode-output/webview-content.js"')
  })
  
} catch (error) {
  console.error('❌ Build failed:', error)
  process.exit(1)
}