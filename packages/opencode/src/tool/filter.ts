import { Wildcard } from "../util/wildcard"

export namespace ToolFilter {
  /**
   * Tools that should always be allowed regardless of configuration
   * These are essential for proper operation
   */
  const ALWAYS_ALLOWED_TOOLS = [
    "TodoRead",
    "TodoWrite",
  ]

  /**
   * Represents tool filtering configuration from various sources
   */
  export interface ToolConfig {
    agent?: {
      tools?: Record<string, boolean>
      allowedTools?: string[]
      denyTools?: string[]
    }
    command?: {
      allowedTools?: string[]
      denyTools?: string[]
    }
    flags?: {
      allowedTools?: string[]
      denyTools?: string[]
    }
    input?: Record<string, boolean>
  }

  /**
   * Tool resolution result containing separate configurations
   */
  export interface ToolResolution {
    // Base configuration from agent or default
    base: Record<string, boolean>
    // Override configuration from command (if specified)
    command?: {
      allowedTools?: string[]
      denyTools?: string[]
    }
    // Modifications from flags (if specified)
    flags?: {
      allowedTools?: string[]
      denyTools?: string[]
    }
    // Explicit user input overrides
    input?: Record<string, boolean>
  }

  /**
   * Resolves tool configuration without merging, maintaining separation of concerns
   */
  export function resolveToolConfig(config: ToolConfig): ToolResolution {
    const resolution: ToolResolution = {
      base: {}
    }

    // Start with agent configuration as base
    if (config.agent) {
      // First, apply explicit tool configuration if present
      if (config.agent.tools) {
        Object.assign(resolution.base, config.agent.tools)
      }

      // Then add allowed tools if present (additive)
      if (config.agent.allowedTools) {
        for (const tool of config.agent.allowedTools) {
          resolution.base[tool] = true
        }
      }

      // Apply agent deny list if present (subtractive)
      if (config.agent.denyTools) {
        for (const tool of config.agent.denyTools) {
          resolution.base[tool] = false
        }
      }
    }

    // Command configuration (if present, replaces agent config)
    if (config.command?.allowedTools || config.command?.denyTools) {
      resolution.command = config.command
    }

    // Flag configuration (modifies existing config)
    if (config.flags?.allowedTools || config.flags?.denyTools) {
      resolution.flags = config.flags
    }

    // User input overrides
    if (config.input) {
      resolution.input = config.input
    }

    return resolution
  }

  /**
   * Checks if a tool is enabled based on resolved configuration
   * Handles the precedence: input > flags > command > agent
   */
  export function isToolEnabled(toolId: string, resolution: ToolResolution): boolean {
    // Always allow essential tools
    if (ALWAYS_ALLOWED_TOOLS.includes(toolId)) {
      return true
    }

    // Check user input first (highest precedence)
    if (resolution.input && toolId in resolution.input) {
      return resolution.input[toolId]
    }

    // Determine effective configuration based on command and flags
    let effectiveConfig = resolution.base
    let isRestrictiveMode = resolution.base["*"] === false

    // If command specifies tools, it replaces agent configuration
    if (resolution.command) {
      if (resolution.command.allowedTools && !resolution.command.denyTools) {
        // Command with only allowedTools is restrictive
        effectiveConfig = {}
        for (const pattern of resolution.command.allowedTools) {
          effectiveConfig[pattern] = true
        }
        effectiveConfig["*"] = false
        isRestrictiveMode = true
      } else if (resolution.command.allowedTools && resolution.command.denyTools) {
        // Command with both allowed and deny - still restrictive
        effectiveConfig = {}
        for (const pattern of resolution.command.allowedTools) {
          effectiveConfig[pattern] = true
        }
        for (const pattern of resolution.command.denyTools) {
          effectiveConfig[pattern] = false
        }
        effectiveConfig["*"] = false
        isRestrictiveMode = true
      } else if (resolution.command.denyTools) {
        // Command with only denyTools
        effectiveConfig = { ...resolution.base }
        for (const pattern of resolution.command.denyTools) {
          effectiveConfig[pattern] = false
        }
      }
    }

    // Apply flag modifications
    if (resolution.flags) {
      const hasDenyAll = resolution.flags.denyTools?.includes("*")
      
      if (hasDenyAll && resolution.flags.allowedTools) {
        // Restrictive mode: deny all, allow specific
        effectiveConfig = {}
        effectiveConfig["*"] = false
        for (const pattern of resolution.flags.allowedTools) {
          effectiveConfig[pattern] = true
        }
        isRestrictiveMode = true
      } else if (resolution.flags.allowedTools && !resolution.flags.denyTools) {
        // Additive mode: add allowed tools
        for (const pattern of resolution.flags.allowedTools) {
          effectiveConfig[pattern] = true
        }
      } else if (resolution.flags.denyTools && !hasDenyAll) {
        // Subtractive mode: remove specific tools
        for (const pattern of resolution.flags.denyTools) {
          effectiveConfig[pattern] = false
        }
      }
    }

    // Check exact match first
    if (toolId in effectiveConfig) {
      return effectiveConfig[toolId]
    }

    // Check pattern matches
    for (const [pattern, enabled] of Object.entries(effectiveConfig)) {
      if (pattern !== "*" && matchesPattern(toolId, pattern)) {
        return enabled
      }
    }

    // Default based on mode
    return !isRestrictiveMode
  }

  /**
   * Parses tool patterns from allowed-tools and deny-tools strings
   */
  export function parseToolPatterns(patterns: string | string[]): string[] {
    if (typeof patterns === "string") {
      const result: string[] = []
      let current = ""
      let parenDepth = 0
      
      for (let i = 0; i < patterns.length; i++) {
        const char = patterns[i]
        
        if (char === "(") {
          parenDepth++
          current += char
        } else if (char === ")") {
          parenDepth--
          current += char
        } else if ((char === "," || char === " " || char === "\n") && parenDepth === 0) {
          if (current.trim()) {
            result.push(current.trim())
            current = ""
          }
        } else {
          current += char
        }
      }
      
      if (current.trim()) {
        result.push(current.trim())
      }
      
      return result
    }
    
    return patterns
  }

  /**
   * Checks if a tool ID matches a pattern
   */
  export function matchesPattern(toolId: string, pattern: string): boolean {
    // Handle Bash command patterns like "Bash(git add:*)"
    if (pattern.startsWith("Bash(") && pattern.endsWith(")")) {
      if (toolId !== "bash") return false
      // For now, we'll need to handle this at the bash tool level
      return true
    }
    
    // Handle MCP tool patterns like "context7_*"
    if (pattern.includes("*") || pattern.includes("?")) {
      return Wildcard.match(toolId, pattern)
    }
    
    // Direct match (case insensitive)
    return toolId.toLowerCase() === pattern.toLowerCase()
  }
}