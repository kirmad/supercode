import { promises as fs } from "fs"
import path from "path"
import { execSync } from "child_process"
import { App } from "../app/app"
import { Global } from "../global"

export namespace Flags {
  export interface ParsedFlag {
    isFlagReference: boolean
    namespace?: string
    flag?: string
    fullMatch?: string
    filePath?: string
  }

  export interface FlagMetadata {
    description?: string
    signature?: string
    placement?: "replace" | "before" | "after"
    [key: string]: any
  }

  export interface FlagInfo {
    metadata: FlagMetadata
    content: string
  }

  export interface FlagReference {
    flag: ParsedFlag
    startIndex: number
    endIndex: number
  }

  const NAMESPACED_FLAG_REGEX = /--([a-zA-Z0-9_-]+):([a-zA-Z0-9_:-]+)/g
  const ROOT_FLAG_REGEX = /--([a-zA-Z0-9_-]+)/g

  function parseFrontMatter(content: string): { metadata: FlagMetadata; content: string } {
    const frontMatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/
    const match = content.match(frontMatterRegex)
    
    if (!match) {
      return { metadata: { placement: "replace" }, content }
    }

    const [, yamlContent, markdownContent] = match
    const metadata: FlagMetadata = { placement: "replace" }

    // Simple YAML parser for basic key-value pairs
    const lines = yamlContent.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      
      const colonIndex = trimmed.indexOf(':')
      if (colonIndex === -1) continue
      
      const key = trimmed.substring(0, colonIndex).trim()
      let value = trimmed.substring(colonIndex + 1).trim()
      
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      
      metadata[key] = value
    }

    return { metadata, content: markdownContent }
  }

  export async function getFlagInfo(namespace: string | undefined, flag: string): Promise<FlagInfo | null> {
    const filePath = await getFlagPath(namespace, flag)
    
    try {
      const content = await fs.readFile(filePath, "utf-8")
      const { metadata, content: markdownContent } = parseFrontMatter(content)
      
      return { metadata, content: markdownContent }
    } catch (error) {
      return null
    }
  }

  export async function parseFlag(flagText: string): Promise<ParsedFlag> {
    // Try namespaced flag first (e.g., --build:verbose)
    const namespacedMatch = flagText.match(/^--([a-zA-Z0-9_-]+):([a-zA-Z0-9_:-]+)$/)
    if (namespacedMatch) {
      const [fullMatch, namespace, flag] = namespacedMatch
      
      return {
        isFlagReference: true,
        namespace,
        flag,
        fullMatch,
        filePath: await getFlagPath(namespace, flag)
      }
    }
    
    // Try root-level flag (e.g., --verbose)
    const rootMatch = flagText.match(/^--([a-zA-Z0-9_-]+)$/)
    if (rootMatch) {
      const [fullMatch, flag] = rootMatch
      
      return {
        isFlagReference: true,
        flag,
        fullMatch,
        filePath: await getFlagPath(undefined, flag)
      }
    }
    
    return { isFlagReference: false }
  }

  export async function parseFlagReferences(input: string): Promise<FlagReference[]> {
    const references: FlagReference[] = []
    
    // First find all namespaced flags
    const namespacedMatches = [...input.matchAll(NAMESPACED_FLAG_REGEX)]
    for (const match of namespacedMatches) {
      if (match.index !== undefined) {
        const flagText = match[0]
        const parsedFlag = await parseFlag(flagText)
        if (parsedFlag.isFlagReference) {
          references.push({
            flag: parsedFlag,
            startIndex: match.index,
            endIndex: match.index + flagText.length
          })
        }
      }
    }
    
    // Then find root-level flags that don't overlap with namespaced ones
    const rootMatches = [...input.matchAll(ROOT_FLAG_REGEX)]
    for (const match of rootMatches) {
      if (match.index !== undefined) {
        const flagText = match[0]
        const startIndex = match.index
        const endIndex = match.index + flagText.length
        
        // Check if this overlaps with any namespaced flag
        const overlaps = references.some(ref => 
          (startIndex >= ref.startIndex && startIndex < ref.endIndex) ||
          (endIndex > ref.startIndex && endIndex <= ref.endIndex)
        )
        
        if (!overlaps) {
          const parsedFlag = await parseFlag(flagText)
          if (parsedFlag.isFlagReference) {
            references.push({
              flag: parsedFlag,
              startIndex,
              endIndex
            })
          }
        }
      }
    }
    
    // Sort references by position (earliest first)
    references.sort((a, b) => a.startIndex - b.startIndex)
    
    return references
  }

  export async function processFlagReferences(input: string): Promise<string> {
    const references = await parseFlagReferences(input)
    
    if (references.length === 0) {
      return input
    }
    
    // Process flags and collect their content based on placement
    const beforeContent: string[] = []
    const afterContent: string[] = []
    let processedInput = input
    
    // Process in reverse order to maintain correct indices
    for (let i = references.length - 1; i >= 0; i--) {
      const reference = references[i]
      const { flag } = reference
      
      try {
        const flagInfo = await getFlagInfo(flag.namespace, flag.flag!)
        
        if (flagInfo) {
          // Process the flag content (handle $ARGUMENTS, file includes, shell commands)
          let processedContent = flagInfo.content
          
          // For now, we'll use empty string for $ARGUMENTS in flags
          // This could be enhanced later to support arguments
          processedContent = processedContent.replace(/\$ARGUMENTS/g, "")
          
          // Process file includes and shell commands like commands do
          if (flag.filePath) {
            processedContent = await processFileIncludes(processedContent, flag.filePath)
          }
          processedContent = await processShellCommands(processedContent)
          
          const placement = flagInfo.metadata.placement || "replace"
          
          if (placement === "before") {
            beforeContent.unshift(processedContent)
            // Remove flag reference from input
            processedInput = processedInput.slice(0, reference.startIndex) + 
                           processedInput.slice(reference.endIndex)
          } else if (placement === "after") {
            afterContent.push(processedContent)
            // Remove flag reference from input
            processedInput = processedInput.slice(0, reference.startIndex) + 
                           processedInput.slice(reference.endIndex)
          } else { // placement === "replace"
            // Replace flag reference with content
            processedInput = processedInput.slice(0, reference.startIndex) + 
                           processedContent + 
                           processedInput.slice(reference.endIndex)
          }
        } else {
          // Flag not found, could log warning or leave as-is
          // For now, we'll leave the flag reference in place
        }
      } catch (error) {
        // On error, leave flag reference in place
        console.warn(`Error processing flag ${flag.fullMatch}:`, error)
      }
    }
    
    // Combine content based on placement
    const parts: string[] = []
    
    if (beforeContent.length > 0) {
      parts.push(beforeContent.join('\n\n'))
    }
    
    if (processedInput.trim()) {
      parts.push(processedInput.trim())
    }
    
    if (afterContent.length > 0) {
      parts.push(afterContent.join('\n\n'))
    }
    
    return parts.join('\n\n')
  }

  async function processFileIncludes(content: string, flagFilePath: string): Promise<string> {
    // Regex to match @<filepath> patterns - matches common file path characters
    const fileIncludeRegex = /@([a-zA-Z0-9_./\-]+)/g
    
    let processedContent = content
    let match
    
    // Get the directory of the flag file for relative path resolution
    const flagDir = path.dirname(flagFilePath)
    
    while ((match = fileIncludeRegex.exec(content)) !== null) {
      const [fullMatch, filePath] = match
      
      try {
        // Resolve the file path relative to the flag file directory
        const resolvedPath = path.resolve(flagDir, filePath)
        
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

  async function getFlagPath(namespace: string | undefined, flag: string): Promise<string> {
    const paths = getFlagPaths(namespace, flag)
    // Return the first existing path, preferring project over global
    for (const flagPath of paths) {
      try {
        await fs.access(flagPath)
        return flagPath
      } catch (error) {
        // File doesn't exist, continue to next path
      }
    }
    // Return project path as fallback (for error messages)
    return paths[0]
  }

  function getFlagPaths(namespace: string | undefined, flag: string): string[] {
    const paths: string[] = []
    
    try {
      const app = App.info()
      // Project-specific paths (higher priority)
      const projectFlagsDir = path.join(app.path.root, ".opencode", "flags")
      if (namespace) {
        paths.push(path.join(projectFlagsDir, namespace, `${flag}.md`))
      } else {
        paths.push(path.join(projectFlagsDir, `${flag}.md`))
      }
      
      // Global paths
      const globalFlagsDir = path.join(Global.Path.config, "flags")
      if (namespace) {
        paths.push(path.join(globalFlagsDir, namespace, `${flag}.md`))
      } else {
        paths.push(path.join(globalFlagsDir, `${flag}.md`))
      }
    } catch (error) {
      // Fallback for testing or when app context is not available
      const flagsDir = path.join(process.cwd(), ".opencode", "flags")
      if (namespace) {
        paths.push(path.join(flagsDir, namespace, `${flag}.md`))
      } else {
        paths.push(path.join(flagsDir, `${flag}.md`))
      }
    }
    
    return paths
  }
}