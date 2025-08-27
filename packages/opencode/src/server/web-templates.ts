import { TemplateFinder } from "./template-finder"

export async function getWebAppHTML(): Promise<string> {
  try {
    // Use the robust template finder to locate the template
    const htmlContent = await TemplateFinder.readTemplate("web-app.html")
    
    if (!htmlContent) {
      throw new Error("Template content not found")
    }
    
    // No template substitution needed - using dynamic configuration with window.location
    return htmlContent
  } catch (error) {
    console.error("Failed to load web app template:", error)
    
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

export async function getChatAppHTML(): Promise<string> {
  try {
    // Use the robust template finder to locate the template
    const htmlContent = await TemplateFinder.readTemplate("chat-app.html")
    
    if (!htmlContent) {
      throw new Error("Template content not found")
    }
    
    // No template substitution needed - using dynamic configuration with window.location
    return htmlContent
  } catch (error) {
    console.error("Failed to load chat app template:", error)
    
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