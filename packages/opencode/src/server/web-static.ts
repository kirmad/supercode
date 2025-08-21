import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

export function getWebAppJS(): string {
  try {
    // Get the correct path to the static directory
    // In development: packages/opencode/src/server/static/app.js
    // In production: packages/opencode/dist/server/static/app.js
    let staticDir: string
    
    if (typeof __filename !== 'undefined') {
      // CommonJS environment
      staticDir = join(dirname(__filename), "static")
    } else {
      // ES modules environment (fallback)
      const currentDir = dirname(fileURLToPath(import.meta.url))
      staticDir = join(currentDir, "static")
    }
    
    const jsPath = join(staticDir, "app.js")
    return readFileSync(jsPath, "utf-8")
  } catch (error) {
    console.error("Failed to load web app JavaScript:", error)
    console.error(`Tried to load from: ${error instanceof Error ? (error as any).path || 'unknown path' : 'unknown'}`)
    
    // Fallback to a simple error message
    return `
      console.error('Failed to load web interface JavaScript');
      console.error('Error: ${error instanceof Error ? error.message.replace(/'/g, "\\'") : String(error)}');
      document.body.innerHTML = '<div style="padding: 20px; font-family: monospace;"><h1>JavaScript failed to load</h1><p>Check server logs for details</p></div>';
    `
  }
}