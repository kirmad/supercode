import { join, basename } from "path"
import { readdir, readFile, stat } from "fs/promises"
import { existsSync } from "fs"
import matter from "gray-matter"
import { homedir } from "os"

export interface CustomCommand {
  name: string
  description?: string
  namespace?: string
  fullName: string  // includes namespace if present
  usage?: string
  arguments?: string[]
}

interface FrontMatter {
  command?: string
  category?: string
  purpose?: string
  arguments?: string[]
  usage?: string
  [key: string]: any
}

/**
 * Parses a markdown file with YAML frontmatter to extract command metadata
 */
async function parseCommandFile(filePath: string): Promise<CustomCommand | null> {
  try {
    const content = await readFile(filePath, 'utf-8')
    
    // Parse frontmatter using gray-matter
    let parsed: matter.GrayMatterFile<string>
    try {
      parsed = matter(content)
    } catch (e) {
      console.error(`Failed to parse frontmatter in ${filePath}:`, e)
      return null
    }
    
    const frontMatter = parsed.data as FrontMatter
    
    // Extract command name from filename or frontmatter
    const fileName = basename(filePath, '.md')
    const commandName = frontMatter.command || fileName
    
    // Build arguments list from frontmatter
    let args: string[] = []
    if (frontMatter.arguments && Array.isArray(frontMatter.arguments)) {
      args = frontMatter.arguments
    }
    
    // Extract description from frontmatter or content
    let description = frontMatter.purpose || frontMatter['description']
    if (!description) {
      // Try to extract from markdown content (first paragraph)
      const firstParagraph = parsed.content.split('\n\n')[0]?.trim()
      if (firstParagraph && !firstParagraph.startsWith('#')) {
        description = firstParagraph
      }
    }
    
    return {
      name: commandName,
      description,
      usage: frontMatter.usage,
      arguments: args,
      namespace: undefined,  // Will be set by caller based on directory structure
      fullName: commandName  // Will be updated by caller if namespaced
    }
  } catch (e) {
    console.error(`Error parsing command file ${filePath}:`, e)
    return null
  }
}

/**
 * Recursively scans a directory for custom command files
 */
async function scanCommandsDirectory(dir: string, namespace?: string): Promise<CustomCommand[]> {
  const commands: CustomCommand[] = []
  
  if (!existsSync(dir)) {
    return commands
  }
  
  try {
    const entries = await readdir(dir)
    
    for (const entry of entries) {
      const fullPath = join(dir, entry)
      const stats = await stat(fullPath)
      
      if (stats.isDirectory()) {
        // Recursively scan subdirectory with namespace
        const subNamespace = namespace ? `${namespace}:${entry}` : entry
        const subCommands = await scanCommandsDirectory(fullPath, subNamespace)
        commands.push(...subCommands)
      } else if (entry.endsWith('.md')) {
        // Parse markdown file
        const command = await parseCommandFile(fullPath)
        if (command) {
          // Set namespace and update full name
          command.namespace = namespace
          command.fullName = namespace ? `${namespace}:${command.name}` : command.name
          commands.push(command)
        }
      }
    }
  } catch (e) {
    console.error(`Error scanning commands directory ${dir}:`, e)
  }
  
  return commands
}

/**
 * Loads all custom commands from built-in defaults, global, and project-specific directories
 */
export async function loadCustomCommands(projectPath?: string): Promise<CustomCommand[]> {
  const commandMap = new Map<string, CustomCommand>() // To handle overrides

  // Built-in default commands directory
  const builtinDir = join(__dirname, '..', 'commands', 'defaults')
  const builtinCommands = await scanCommandsDirectory(builtinDir)
  for (const cmd of builtinCommands) {
    commandMap.set(cmd.fullName, cmd)
  }

  // Global commands directory (overrides built-in)
  const globalDir = join(homedir(), '.config', 'supercode', 'commands')
  const globalCommands = await scanCommandsDirectory(globalDir)
  for (const cmd of globalCommands) {
    commandMap.set(cmd.fullName, cmd) // Overrides built-in if exists
  }

  // Project-specific commands directory (overrides built-in and global)
  if (projectPath) {
    const projectDir = join(projectPath, '.opencode', 'commands')
    const projectCommands = await scanCommandsDirectory(projectDir)
    for (const cmd of projectCommands) {
      commandMap.set(cmd.fullName, cmd) // Overrides global and built-in if exists
    }
  }

  // Convert map back to array
  return Array.from(commandMap.values())
}

/**
 * Filters commands based on a search prefix (for auto-completion)
 */
export function filterCommands(commands: CustomCommand[], prefix: string): CustomCommand[] {
  const lowerPrefix = prefix.toLowerCase()
  
  return commands.filter(cmd => {
    return cmd.fullName.toLowerCase().startsWith(lowerPrefix) ||
           cmd.name.toLowerCase().startsWith(lowerPrefix) ||
           (cmd.description && cmd.description.toLowerCase().includes(lowerPrefix))
  }).sort((a, b) => {
    // Sort by relevance: exact name match first, then full name match, then description match
    const aNameMatch = a.name.toLowerCase().startsWith(lowerPrefix)
    const bNameMatch = b.name.toLowerCase().startsWith(lowerPrefix)
    
    if (aNameMatch && !bNameMatch) return -1
    if (!aNameMatch && bNameMatch) return 1
    
    const aFullMatch = a.fullName.toLowerCase().startsWith(lowerPrefix)
    const bFullMatch = b.fullName.toLowerCase().startsWith(lowerPrefix)
    
    if (aFullMatch && !bFullMatch) return -1
    if (!aFullMatch && bFullMatch) return 1
    
    // Finally sort alphabetically
    return a.fullName.localeCompare(b.fullName)
  })
}