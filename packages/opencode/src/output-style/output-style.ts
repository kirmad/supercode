import { z } from "zod"
import { Config } from "../config/config"
import { Filesystem } from "../util/filesystem"
import { Global } from "../global"
import { Instance } from "../project/instance"
import path from "path"
import { fileURLToPath } from "url"

export namespace OutputStyle {
  export const Info = z
    .object({
      name: z.string(),
      description: z.string().optional(),
      builtIn: z.boolean(),
      promptFile: z.string(),
    })
    .openapi({
      ref: "OutputStyle",
    })
  export type Info = z.infer<typeof Info>

  const BUILT_IN_STYLES: Record<string, Info> = {
    explanatory: {
      name: "explanatory",
      description: "Educational insights with helpful explanations",
      builtIn: true,
      promptFile: "explanatory.md",
    },
    learning: {
      name: "learning",
      description: "Learning-focused with detailed explanations",
      builtIn: true,
      promptFile: "learning.md",
    },
  }

  const state = new Map<string, Info>()
  let initialized = false

  async function loadCustomStyles() {
    // Clear non-built-in styles
    for (const [key, value] of state) {
      if (!value.builtIn) {
        state.delete(key)
      }
    }

    // Try to check project-level custom outputs if context is available
    try {
      const projectOutputDir = path.join(".opencode", "custom-outputs")
      const projectMatches = await Filesystem.findUp(projectOutputDir, Instance.directory, Instance.worktree)
      if (projectMatches.length > 0) {
        const outputDir = projectMatches[0]
        try {
          const files = await Array.fromAsync(
            new Bun.Glob("*.md").scan({
              cwd: outputDir,
              absolute: false,
              onlyFiles: true,
            })
          )
          for (const file of files) {
            const name = path.basename(file, ".md")
            if (!BUILT_IN_STYLES[name]) {
              state.set(name, {
                name,
                description: `Custom output style from ${file}`,
                builtIn: false,
                promptFile: file,
              })
            }
          }
        } catch (error) {
          // Ignore errors loading custom styles
        }
      }
    } catch (error) {
      // Context not available yet, skip project-level styles
    }

    // Check global custom outputs
    const globalOutputDir = path.join(Global.Path.config, "custom-outputs")
    try {
      const files = await Array.fromAsync(
        new Bun.Glob("*.md").scan({
          cwd: globalOutputDir,
          absolute: false,
          onlyFiles: true,
        })
      )
      for (const file of files) {
        const name = path.basename(file, ".md")
        if (!BUILT_IN_STYLES[name] && !state.has(name)) {
          state.set(name, {
            name,
            description: `Global custom output style from ${file}`,
            builtIn: false,
            promptFile: file,
          })
        }
      }
    } catch (error) {
      // Ignore errors loading custom styles
    }
  }

  async function init() {
    if (initialized) return

    // Load built-in styles
    for (const [key, value] of Object.entries(BUILT_IN_STYLES)) {
      state.set(key, value)
    }
    // Load custom styles
    await loadCustomStyles()
    initialized = true
  }

  export async function get(name: string): Promise<Info | undefined> {
    await init() // Ensure initialization

    // Special handling for default
    if (name === "default") {
      return {
        name: "default",
        description: "Concise and direct responses",
        builtIn: true,
        promptFile: "default.md", // This won't be used, but kept for compatibility
      }
    }

    await loadCustomStyles() // Refresh custom styles
    return state.get(name)
  }

  export async function list(): Promise<Info[]> {
    await init() // Ensure initialization
    await loadCustomStyles() // Refresh custom styles

    // Always include default as an available option
    const defaultStyle: Info = {
      name: "default",
      description: "Concise and direct responses",
      builtIn: true,
      promptFile: "default.md", // This won't be used, but kept for compatibility
    }

    return [defaultStyle, ...Array.from(state.values())]
  }

  /**
   * Load the output style prompt content
   * Priority: project .opencode/custom-outputs/ -> global ~/.opencode/custom-outputs/ -> built-in package files
   */
  export async function loadPrompt(styleName: string): Promise<string | undefined> {
    // Default style doesn't have additional prompt content
    if (styleName === "default") {
      return undefined
    }

    const style = await get(styleName)
    if (!style) {
      return undefined
    }

    // Try to check project-level custom outputs if context is available
    try {
      const cwd = Instance.directory
      const root = Instance.worktree

      // Check project-level custom outputs first (even for built-in style names)
      const projectOutputFile = path.join(".opencode", "custom-outputs", style.promptFile)
      const projectMatches = await Filesystem.findUp(projectOutputFile, cwd, root)
      if (projectMatches.length > 0) {
        try {
          return await Bun.file(projectMatches[0]).text()
        } catch (error) {
          // Fall through to next priority
        }
      }
    } catch (error) {
      // Context not available, skip project-level check
    }

    // Check global custom outputs second
    const globalOutputPath = path.join(Global.Path.config, "custom-outputs", style.promptFile)
    try {
      if (await Bun.file(globalOutputPath).exists()) {
        return await Bun.file(globalOutputPath).text()
      }
    } catch (error) {
      // Fall through to built-in
    }

    // For built-in styles, load from packaged files
    if (style.builtIn) {
      try {
        // Get the directory of the current module
        const __filename = fileURLToPath(import.meta.url)
        const __dirname = path.dirname(__filename)

        // Navigate to the session/output-styles directory
        const builtInPath = path.join(__dirname, "..", "session", "output-styles", style.promptFile)

        if (await Bun.file(builtInPath).exists()) {
          return await Bun.file(builtInPath).text()
        }
      } catch (error) {
        console.error(`Failed to load built-in style ${styleName}:`, error)
      }
    }

    return undefined
  }

  /**
   * Get the default output style based on configuration
   */
  export async function getDefault(): Promise<string> {
    const config = await Config.get()
    return config.outputStyle || "default"
  }
}