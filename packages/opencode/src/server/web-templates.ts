import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"

export function getWebAppHTML(baseUrl: string): string {
  try {
    // Get the correct path to the templates directory
    // In development: packages/opencode/src/server/templates/web-app.html
    // In production: packages/opencode/dist/server/templates/web-app.html
    let templatesDir: string
    
    if (typeof __filename !== 'undefined') {
      // CommonJS environment
      templatesDir = join(dirname(__filename), "templates")
    } else {
      // ES modules environment (fallback)
      const currentDir = dirname(fileURLToPath(import.meta.url))
      templatesDir = join(currentDir, "templates")
    }
    
    const templatePath = join(templatesDir, "web-app.html")
    let htmlContent = readFileSync(templatePath, "utf-8")
    
    // Perform template substitution
    htmlContent = htmlContent.replace(/\{\{BASE_URL\}\}/g, baseUrl)
    
    return htmlContent
  } catch (error) {
    console.error("Failed to load web app template:", error)
    console.error(`Tried to load from: ${error instanceof Error ? (error as any).path || 'unknown path' : 'unknown'}`)
    
    // Fallback to a simple error page
    return `
      <!DOCTYPE html>
      <html>
        <head><title>Error Loading Web Interface</title></head>
        <body style="padding: 20px; font-family: monospace;">
          <h1>Failed to load web interface</h1>
          <p>Template file not found</p>
          <p>Error: ${error instanceof Error ? error.message : String(error)}</p>
          <p>Check server logs for details</p>
        </body>
      </html>
    `
  }
}

export function getChatAppHTML(baseUrl: string): string {
  try {
    // Get the correct path to the templates directory
    // In development: packages/opencode/src/server/templates/chat-app.html
    // In production: packages/opencode/dist/server/templates/chat-app.html
    let templatesDir: string
    
    if (typeof __filename !== 'undefined') {
      // CommonJS environment
      templatesDir = join(dirname(__filename), "templates")
    } else {
      // ES modules environment (fallback)
      const currentDir = dirname(fileURLToPath(import.meta.url))
      templatesDir = join(currentDir, "templates")
    }
    
    const templatePath = join(templatesDir, "chat-app.html")
    let htmlContent = readFileSync(templatePath, "utf-8")
    
    // Perform template substitution
    htmlContent = htmlContent.replace(/\{\{BASE_URL\}\}/g, baseUrl)
    
    return htmlContent
  } catch (error) {
    console.error("Failed to load chat app template:", error)
    console.error(`Tried to load from: ${error instanceof Error ? (error as any).path || 'unknown path' : 'unknown'}`)
    
    // Fallback to a simple error page
    return `
      <!DOCTYPE html>
      <html>
        <head><title>Error Loading Chat Interface</title></head>
        <body style="padding: 20px; font-family: monospace;">
          <h1>Failed to load chat interface</h1>
          <p>Chat template file not found</p>
          <p>Error: ${error instanceof Error ? error.message : String(error)}</p>
          <p>Check server logs for details</p>
        </body>
      </html>
    `
  }
}