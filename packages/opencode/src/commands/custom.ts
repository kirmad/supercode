import { promises as fs } from "fs"
import path from "path"
import { execSync } from "child_process"
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
      // First replace arguments
      let processedContent = content.replace(/\$ARGUMENTS/g, parsed.args || "")
      
      // Then process file includes
      processedContent = await processFileIncludes(processedContent, parsed.filePath)
      
      // Finally process shell commands
      processedContent = await processShellCommands(processedContent)
      
      return processedContent
    } catch (error) {
      const commandRef = parsed.namespace ? `${parsed.namespace}:${parsed.command}` : parsed.command
      throw new Error(`Command not found: ${commandRef}`)
    }
  }

  async function processFileIncludes(content: string, commandFilePath: string): Promise<string> {
    // Regex to match @<filepath> patterns - matches common file path characters
    const fileIncludeRegex = /@([a-zA-Z0-9_./\-]+)/g
    
    let processedContent = content
    let match
    
    // Get the directory of the command file for relative path resolution
    const commandDir = path.dirname(commandFilePath)
    
    while ((match = fileIncludeRegex.exec(content)) !== null) {
      const [fullMatch, filePath] = match
      
      try {
        // Resolve the file path relative to the command file directory
        const resolvedPath = path.resolve(commandDir, filePath)
        
        // Read the file content
        const fileContent = await fs.readFile(resolvedPath, "utf-8")
        
        // Replace the @<filepath> with the file content
        processedContent = processedContent.replace(fullMatch, fileContent)
      } catch (error) {
        // On error, replace with error message
        const errorMsg = `[Error including file '${filePath}': ${error instanceof Error ? error.message : 'Unknown error'}]`
        processedContent = processedContent.replace(fullMatch, errorMsg)
      }
    }
    
    return processedContent
  }

  async function processShellCommands(content: string): Promise<string> {
    // Regex to match !`command` patterns
    const shellCommandRegex = /!`([^`]+)`/g
    
    let processedContent = content
    let match
    
    while ((match = shellCommandRegex.exec(content)) !== null) {
      const [fullMatch, command] = match
      
      try {
        const output = executeShellCommand(command.trim())
        processedContent = processedContent.replace(fullMatch, output)
      } catch (error) {
        // On error, replace with error message or leave original
        const errorMsg = `[Error executing '${command}': ${error instanceof Error ? error.message : 'Unknown error'}]`
        processedContent = processedContent.replace(fullMatch, errorMsg)
      }
    }
    
    return processedContent
  }

  function executeShellCommand(command: string): string {
    try {
      // Execute with timeout and capture output
      const output = execSync(command, {
        encoding: 'utf8',
        timeout: 60000, // 1 minute timeout
        maxBuffer: 1024 * 1024, // 1MB max output
        stdio: 'pipe'
      })
      
      // Strip trailing newlines for cleaner output
      return output.replace(/\n+$/, '')
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Command failed: ${error.message}`)
      }
      throw new Error('Command execution failed')
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