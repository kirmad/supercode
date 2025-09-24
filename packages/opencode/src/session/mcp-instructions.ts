import * as path from "node:path"
import * as os from "node:os"
import * as fs from "node:fs/promises"
import { Instance } from "../project/instance"
import { Filesystem } from "../util/filesystem"

/**
 * MCP instruction loader for dynamically including MCP-specific instructions
 * based on active MCP servers in the current session
 */

export namespace MCPInstructions {

  /**
   * Detect active MCP servers from available tools
   * This uses standard patterns to identify MCP servers based on tool prefixes
   */
  export function detectActiveMCPServers(availableTools: string[]): string[] {
    const activeMCPs = new Set<string>()

    // Standard pattern: <server-name>_<tool-name>
    // The MCP module uses single underscore for tool naming
    for (const tool of availableTools) {
      const underscoreIndex = tool.indexOf("_")
      if (underscoreIndex > 0) {
        const serverName = tool.substring(0, underscoreIndex)
        activeMCPs.add(serverName)
      }
    }

    return Array.from(activeMCPs)
  }

  /**
   * Get available MCP instruction files from a directory
   */
  async function getAvailableInstructionFiles(dirPath: string): Promise<string[]> {
    const files: string[] = []
    try {
      const entries = await fs.readdir(dirPath)
      for (const entry of entries) {
        if (entry.endsWith('.md')) {
          files.push(entry)
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
    }
    return files
  }

  /**
   * Load MCP instruction file with override support
   * Priority: project .opencode/mcp-instructions/ -> global ~/.opencode/mcp-instructions/
   * Looks for files named <mcpName>.md in the mcp-instructions directory
   */
  async function loadMCPInstruction(mcpName: string): Promise<string | null> {
    const cwd = Instance.directory
    const root = Instance.worktree

    // Try different filename patterns for the MCP
    const possibleFileNames = [
      `${mcpName}.md`,                    // exact match: context7.md
      `${mcpName.replace(/-/g, '_')}.md`, // underscores: sequential_thinking.md
      `${mcpName.replace(/_/g, '-')}.md`, // hyphens: sequential-thinking.md
    ]

    for (const fileName of possibleFileNames) {
      // Check project-level MCP instruction
      const projectInstructionFile = path.join(".opencode", "mcp-instructions", fileName)
      const projectMatches = await Filesystem.findUp(projectInstructionFile, cwd, root)
      if (projectMatches.length > 0) {
        try {
          return await Bun.file(projectMatches[0]).text()
        } catch (error) {
          // Continue to next filename pattern
        }
      }

      // Check global MCP instruction
      const globalInstructionPath = path.join(os.homedir(), ".opencode", "mcp-instructions", fileName)
      try {
        if (await Bun.file(globalInstructionPath).exists()) {
          return await Bun.file(globalInstructionPath).text()
        }
      } catch (error) {
        // Continue to next filename pattern
      }
    }

    return null
  }

  /**
   * Load all MCP instructions for active servers
   * Returns formatted text ready to be included in the system prompt
   * Now checks MCP tools directly with ToolFilter
   */
  export async function loadMCPInstructions(toolResolution: any): Promise<string> {
    // Import MCP dynamically to avoid circular dependencies
    const { MCP } = await import("../mcp")
    const { ToolFilter } = await import("../tool/filter")

    const activeMCPs = new Set<string>()

    // Check which MCP tools are enabled
    for (const [key] of Object.entries(await MCP.tools())) {
      if (!ToolFilter.isToolEnabled(key, toolResolution)) continue

      // Extract MCP server name from tool key (<server-name>_<tool-name>)
      // The MCP module uses single underscore, not double underscore
      const underscoreIndex = key.indexOf("_")
      if (underscoreIndex > 0) {
        const serverName = key.substring(0, underscoreIndex)
        activeMCPs.add(serverName)
      }
    }

    if (activeMCPs.size === 0) {
      return ""
    }

    const instructions: string[] = []

    // Add header
    instructions.push("")
    instructions.push("# MCP Server Instructions")
    instructions.push("")
    instructions.push("The following MCP servers have provided instructions for how to use their tools and resources:")
    instructions.push("")

    // Load instructions for each active MCP
    for (const mcpName of activeMCPs) {
      const instruction = await loadMCPInstruction(mcpName)
      if (instruction) {
        instructions.push(instruction.trim())
        instructions.push("")
      }
    }

    return instructions.join("\n")
  }

  /**
   * Get the list of available MCP instruction files
   * Scans the mcp-instructions directories to find all available instruction files
   */
  export async function listAvailableMCPInstructions(): Promise<string[]> {
    const availableFiles = new Set<string>()
    const cwd = Instance.directory
    const root = Instance.worktree

    // Check project-level instructions
    const projectDir = path.join(".opencode", "mcp-instructions")
    const projectDirMatches = await Filesystem.findUp(projectDir, cwd, root)
    if (projectDirMatches.length > 0) {
      const files = await getAvailableInstructionFiles(projectDirMatches[0])
      files.forEach(f => availableFiles.add(f))
    }

    // Check global instructions directory
    const globalDir = path.join(os.homedir(), ".opencode", "mcp-instructions")
    const globalFiles = await getAvailableInstructionFiles(globalDir)
    globalFiles.forEach(f => availableFiles.add(f))

    // Return list of available instruction files (without .md extension for cleaner output)
    return Array.from(availableFiles).map(f => f.replace(/\.md$/, ''))
  }
}