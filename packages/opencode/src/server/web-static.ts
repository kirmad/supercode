import { TemplateFinder } from "./template-finder"

export async function getWebAppJS(): Promise<string> {
  try {
    // Use the robust template finder to locate the JavaScript file
    const jsContent = await TemplateFinder.readStatic("app.js")
    
    if (!jsContent) {
      throw new Error("Static JavaScript content not found")
    }
    
    return jsContent
  } catch (error) {
    console.error("Failed to load web app JavaScript:", error)
    
    // Fallback to a simple error message
    return `
      console.error('Failed to load web interface JavaScript');
      console.error('Error: ${error instanceof Error ? error.message.replace(/'/g, "\\'") : String(error)}');
      document.body.innerHTML = '<div style="padding: 20px; font-family: monospace;"><h1>JavaScript failed to load</h1><p>Check server logs for details</p></div>';
    `
  }
}