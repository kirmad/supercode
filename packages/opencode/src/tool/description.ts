import { App } from "../app/app"
import { Filesystem } from "../util/filesystem"
import path from "path"
import os from "os"

// Cache for loaded description overrides
const descriptionCache = new Map<string, string>()

export namespace ToolDescription {
  /**
   * Load a tool description with override support
   * Priority: project .opencode/prompts/tools/ -> global ~/.opencode/prompts/tools/ -> built-in
   */
  export async function loadDescription(toolName: string, builtInDescription: string): Promise<string> {
    const cacheKey = toolName
    if (descriptionCache.has(cacheKey)) {
      return descriptionCache.get(cacheKey)!
    }

    const { cwd, root } = App.info().path
    
    // Try both .md and .txt extensions for overrides
    const extensions = ['.md', '.txt']
    
    // Check project-level override
    for (const ext of extensions) {
      const projectDescriptionFile = path.join(".opencode", "prompts", "tools", toolName + ext)
      const projectMatches = await Filesystem.findUp(projectDescriptionFile, cwd, root)
      if (projectMatches.length > 0) {
        try {
          const content = await Bun.file(projectMatches[0]).text()
          descriptionCache.set(cacheKey, content)
          return content
        } catch (error) {
          // Fall through to check next extension or global override
          continue
        }
      }
    }

    // Check global override
    for (const ext of extensions) {
      const globalDescriptionPath = path.join(os.homedir(), ".opencode", "prompts", "tools", toolName + ext)
      try {
        if (await Bun.file(globalDescriptionPath).exists()) {
          const content = await Bun.file(globalDescriptionPath).text()
          descriptionCache.set(cacheKey, content)
          return content
        }
      } catch (error) {
        // Fall through to next extension
        continue
      }
    }

    // Use built-in description
    descriptionCache.set(cacheKey, builtInDescription)
    return builtInDescription
  }

  /**
   * Load MCP tool description with override support
   * Uses format: <server-name>_<tool-name>.md/txt
   */
  export async function loadMCPDescription(serverName: string, toolName: string, builtInDescription: string): Promise<string> {
    const mcpToolName = `${serverName}_${toolName}`
    return loadDescription(mcpToolName, builtInDescription)
  }

  /**
   * Clear the description cache (useful for testing or hot-reloading)
   */
  export function clearCache() {
    descriptionCache.clear()
  }
}