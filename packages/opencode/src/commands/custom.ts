import { promises as fs } from "fs"
import path from "path"
import { execSync } from "child_process"
import matter from "gray-matter"
import { Instance } from "../project/instance"
import { Global } from "../global"
import { Filesystem } from "../util/filesystem"

export namespace CustomCommands {

  export interface ParsedCommand {
    isCustomCommand: boolean
    namespace?: string
    command?: string  
    args?: string
    filePath?: string
  }

  export interface CommandMetadata {
    description?: string
    "argument-hint"?: string
    "allowed-tools"?: string | string[]
    "deny-tools"?: string | string[]
    "output-style"?: string
    [key: string]: any
  }

  export interface CommandInfo {
    metadata: CommandMetadata
    content: string
  }

  const NAMESPACED_COMMAND_REGEX = /^\/([a-zA-Z0-9_-]+):([a-zA-Z0-9_:-]+)(\s+.*)?$/
  const ROOT_COMMAND_REGEX = /^\/([a-zA-Z0-9_-]+)(\s+.*)?$/

  function parseFrontMatter(content: string): { metadata: CommandMetadata; content: string } {
    const parsed = matter(content)
    
    // Use the parsed data directly - gray-matter handles all the YAML parsing
    // Commands use hyphenated keys (allowed-tools, deny-tools) in the metadata interface
    const metadata: CommandMetadata = parsed.data as CommandMetadata

    return { metadata, content: parsed.content }
  }

  export async function getCommandInfo(input: string): Promise<CommandInfo | null> {
    const parsed = await parseCommand(input)
    
    if (!parsed.isCustomCommand || !parsed.filePath) {
      return null
    }
    
    try {
      const content = await fs.readFile(parsed.filePath, "utf-8")
      const { metadata, content: markdownContent } = parseFrontMatter(content)
      
      return { metadata, content: markdownContent }
    } catch (error) {
      return null
    }
  }

  export async function parseCommand(input: string): Promise<ParsedCommand> {
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
        filePath: await getCommandPath(namespace, command)
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
        filePath: await getRootCommandPath(command)
      }
    }
    
    return { isCustomCommand: false }
  }

  export interface CommandExecutionResult {
    content: string
    allowedTools?: string[]
    denyTools?: string[]
    outputStyle?: string
  }

  export async function executeCommand(input: string): Promise<CommandExecutionResult | null> {
    const parsed = await parseCommand(input)
    
    if (!parsed.isCustomCommand || !parsed.filePath) {
      return null
    }
    
    try {
      const content = await fs.readFile(parsed.filePath, "utf-8")
      
      // Parse front matter and get the actual content without front matter
      const { metadata, content: markdownContent } = parseFrontMatter(content)
      
      // First replace arguments
      let processedContent = markdownContent.replace(/\$ARGUMENTS/g, parsed.args || "")
      
      // Then process file includes
      processedContent = await processFileIncludes(processedContent, parsed.filePath)
      
      // Finally process shell commands
      processedContent = await processShellCommands(processedContent)
      
      // Extract tool configuration from metadata
      const result: CommandExecutionResult = {
        content: processedContent
      }

      // Process allowed-tools
      if (metadata["allowed-tools"]) {
        result.allowedTools = Array.isArray(metadata["allowed-tools"])
          ? metadata["allowed-tools"]
          : String(metadata["allowed-tools"]).split(/[,\s]+/).filter(Boolean)
      }

      // Process deny-tools
      if (metadata["deny-tools"]) {
        result.denyTools = Array.isArray(metadata["deny-tools"])
          ? metadata["deny-tools"]
          : String(metadata["deny-tools"]).split(/[,\s]+/).filter(Boolean)
      }

      // Process output-style
      if (metadata["output-style"]) {
        result.outputStyle = String(metadata["output-style"]).trim()
      }
      
      return result
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

  async function getCommandPath(namespace: string, command: string): Promise<string> {
    const paths = await getCommandPaths(namespace, command)
    // Return the first existing path, preferring project over global
    for (const cmdPath of paths) {
      try {
        await fs.access(cmdPath)
        return cmdPath
      } catch (error) {
        // File doesn't exist, continue to next path
      }
    }
    // Return project path as fallback (for error messages)
    return paths[0]
  }

  async function getCommandPaths(namespace: string, command: string): Promise<string[]> {
    const paths: string[] = []
    
    try {
      // Project-specific paths (using same approach as .opencode/command)
      // This will search up from Instance.directory to Instance.worktree
      const projectPaths = await Filesystem.findUp(
        path.join(".opencode", "commands", namespace, `${command}.md`),
        Instance.directory,
        Instance.worktree
      )
      // Add all found project paths (they're already in priority order)
      paths.push(...projectPaths)
    } catch (error) {
      // Fallback to current working directory when Instance is not available
      const projectCommandsDir = path.join(process.cwd(), ".opencode", "commands")
      paths.push(path.join(projectCommandsDir, namespace, `${command}.md`))
    }
    
    // Global path
    const globalCommandsDir = path.join(Global.Path.config, "commands")
    paths.push(path.join(globalCommandsDir, namespace, `${command}.md`))
    
    return paths
  }

  async function getRootCommandPath(command: string): Promise<string> {
    const paths = await getRootCommandPaths(command)
    // Return the first existing path, preferring project over global
    for (const cmdPath of paths) {
      try {
        await fs.access(cmdPath)
        return cmdPath
      } catch (error) {
        // File doesn't exist, continue to next path
      }
    }
    // Return project path as fallback (for error messages)
    return paths[0]
  }

  async function getRootCommandPaths(command: string): Promise<string[]> {
    const paths: string[] = []
    
    try {
      // Project-specific paths (using same approach as .opencode/command)
      const projectPaths = await Filesystem.findUp(
        path.join(".opencode", "commands", `${command}.md`),
        Instance.directory,
        Instance.worktree
      )
      // Add all found project paths (they're already in priority order)
      paths.push(...projectPaths)
    } catch (error) {
      // Fallback to current working directory when Instance is not available
      const projectCommandsDir = path.join(process.cwd(), ".opencode", "commands")
      paths.push(path.join(projectCommandsDir, `${command}.md`))
    }
    
    // Global path
    const globalCommandsDir = path.join(Global.Path.config, "commands")
    paths.push(path.join(globalCommandsDir, `${command}.md`))
    
    return paths
  }
}