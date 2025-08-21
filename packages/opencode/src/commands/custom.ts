import { promises as fs } from "fs"
import path from "path"
import { App } from "../app/app"

export namespace CustomCommands {
  export interface ParsedCommand {
    isCustomCommand: boolean
    namespace?: string
    command?: string  
    args?: string
    filePath?: string
  }

  const NAMESPACED_COMMAND_REGEX = /^\/([a-zA-Z0-9_-]+):([a-zA-Z0-9_:-]+)(\s+.*)?$/
  const ROOT_COMMAND_REGEX = /^\/([a-zA-Z0-9_-]+)(\s+.*)?$/

  export function parseCommand(input: string): ParsedCommand {
    const trimmed = input.trim()
    
    // Try namespaced command first (e.g., /sc:implement)
    const namespacedMatch = trimmed.match(NAMESPACED_COMMAND_REGEX)
    if (namespacedMatch) {
      const [, namespace, command, argsString] = namespacedMatch
      const args = argsString?.trim() || ""
      
      return {
        isCustomCommand: true,
        namespace,
        command,
        args,
        filePath: getCommandPath(namespace, command)
      }
    }
    
    // Try root-level command (e.g., /bolo)
    const rootMatch = trimmed.match(ROOT_COMMAND_REGEX)
    if (rootMatch) {
      const [, command, argsString] = rootMatch
      const args = argsString?.trim() || ""
      
      return {
        isCustomCommand: true,
        command,
        args,
        filePath: getRootCommandPath(command)
      }
    }
    
    return { isCustomCommand: false }
  }

  export async function executeCommand(input: string): Promise<string | null> {
    const parsed = parseCommand(input)
    
    if (!parsed.isCustomCommand || !parsed.filePath) {
      return null
    }
    
    try {
      const content = await fs.readFile(parsed.filePath, "utf-8")
      return content.replace(/\$ARGUMENTS/g, parsed.args || "")
    } catch (error) {
      const commandRef = parsed.namespace ? `${parsed.namespace}:${parsed.command}` : parsed.command
      throw new Error(`Command not found: ${commandRef}`)
    }
  }

  function getCommandPath(namespace: string, command: string): string {
    try {
      const app = App.info()
      const commandsDir = path.join(app.path.root, ".opencode", "commands")
      return path.join(commandsDir, namespace, `${command}.md`)
    } catch (error) {
      // Fallback for testing or when app context is not available
      const commandsDir = path.join(process.cwd(), ".opencode", "commands")
      return path.join(commandsDir, namespace, `${command}.md`)
    }
  }

  function getRootCommandPath(command: string): string {
    try {
      const app = App.info()
      const commandsDir = path.join(app.path.root, ".opencode", "commands")
      return path.join(commandsDir, `${command}.md`)
    } catch (error) {
      // Fallback for testing or when app context is not available
      const commandsDir = path.join(process.cwd(), ".opencode", "commands")
      return path.join(commandsDir, `${command}.md`)
    }
  }
}