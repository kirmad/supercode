/**
 * Flag suggestions module for providing context-aware flag completions
 * Uses the existing flag system from .opencode/flags/ directory
 */

import { promises as fs } from "fs"
import path from "path"
import matter from "gray-matter"
import { Instance } from "../project/instance"
import { Global } from "../global"

export interface FlagSuggestion {
  flag: string            // The flag itself (e.g., "--verbose", "--safe-mode")
  description: string     // Description of what the flag does
  namespace?: string      // Namespace if it's a namespaced flag (e.g., "out" for "--out:genui")
  category?: string       // Category for grouping
  metadata?: any          // Additional metadata from the flag file
}

/**
 * Get all available flag suggestions from .opencode/flags/ directory
 * @param input The current input text (for context)
 * @param prefix The flag prefix being typed (e.g., "--ve" for "--verbose")
 * @returns Array of flag suggestions
 */
export async function getFlagSuggestions(
  _input: string,
  prefix: string = ""
): Promise<FlagSuggestion[]> {
  const suggestions: FlagSuggestion[] = []
  
  // Get flag directories to search
  const flagDirs = getFlagDirectories()
  
  for (const dir of flagDirs) {
    try {
      // Read both root level and namespaced flags
      await readFlagsFromDirectory(dir, suggestions)
    } catch (error) {
      // Directory might not exist, that's okay
      continue
    }
  }
  
  // Filter by prefix if provided
  if (prefix && prefix.startsWith("--")) {
    const searchPrefix = prefix.toLowerCase()
    return suggestions.filter(s => 
      s.flag.toLowerCase().startsWith(searchPrefix)
    )
  }
  
  return suggestions
}

/**
 * Get directories to search for flag files
 */
function getFlagDirectories(): string[] {
  const dirs: string[] = []
  
  try {
    // Project-specific flags (highest priority)
    const projectFlagsDir = path.join(Instance.worktree, ".opencode", "flags")
    dirs.push(projectFlagsDir)
    
    // Global flags
    const globalFlagsDir = path.join(Global.Path.config, "flags")
    dirs.push(globalFlagsDir)
  } catch (error) {
    // Fallback for testing or when app context is not available
    const fallbackFlagsDir = path.join(process.cwd(), ".opencode", "flags")
    dirs.push(fallbackFlagsDir)
  }
  
  return dirs
}

/**
 * Read flag files from a directory and add to suggestions
 */
async function readFlagsFromDirectory(
  dir: string,
  suggestions: FlagSuggestion[]
): Promise<void> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      
      if (entry.isDirectory()) {
        // This is a namespace directory
        await readNamespacedFlags(fullPath, entry.name, suggestions)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        // This is a root-level flag file
        const flagName = entry.name.replace('.md', '')
        const suggestion = await parseFlagFile(fullPath, flagName)
        if (suggestion) {
          suggestions.push(suggestion)
        }
      }
    }
  } catch (error) {
    // Directory doesn't exist or can't be read
    return
  }
}

/**
 * Read namespaced flags from a namespace directory
 */
async function readNamespacedFlags(
  dir: string,
  namespace: string,
  suggestions: FlagSuggestion[]
): Promise<void> {
  try {
    const files = await fs.readdir(dir)
    
    for (const file of files) {
      if (file.endsWith('.md')) {
        const flagName = file.replace('.md', '')
        const fullPath = path.join(dir, file)
        const suggestion = await parseFlagFile(fullPath, flagName, namespace)
        if (suggestion) {
          suggestions.push(suggestion)
        }
      }
    }
  } catch (error) {
    // Namespace directory doesn't exist or can't be read
    return
  }
}

/**
 * Parse a flag markdown file and extract suggestion information
 */
async function parseFlagFile(
  filePath: string,
  flagName: string,
  namespace?: string
): Promise<FlagSuggestion | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const { data: metadata, content: markdownContent } = matter(content)
    
    // Build the full flag name
    const flag = namespace ? `--${namespace}:${flagName}` : `--${flagName}`
    
    // Extract description from metadata or first line of content
    let description = metadata['description'] || metadata['signature'] || ''
    if (!description && markdownContent) {
      // Try to get first non-empty line as description
      const firstLine = markdownContent.split('\n').find(line => line.trim() && !line.startsWith('#'))
      if (firstLine) {
        description = firstLine.trim()
      }
    }
    
    // If still no description, use a default
    if (!description) {
      description = namespace ? `${namespace}:${flagName} flag` : `${flagName} flag`
    }
    
    return {
      flag,
      description,
      namespace,
      category: metadata['category'] || (namespace ? 'namespaced' : 'root'),
      metadata
    }
  } catch (error) {
    // Can't read or parse file
    return null
  }
}

/**
 * Filter flag suggestions by prefix
 * @param suggestions Array of flag suggestions
 * @param prefix The prefix to filter by
 * @returns Filtered array of flag suggestions
 */
export function filterFlagSuggestions(
  suggestions: FlagSuggestion[],
  prefix: string
): FlagSuggestion[] {
  if (!prefix || !prefix.startsWith("--")) {
    return suggestions
  }
  
  const lowerPrefix = prefix.toLowerCase()
  return suggestions.filter(s =>
    s.flag.toLowerCase().startsWith(lowerPrefix)
  )
}