import { Ripgrep } from "../file/ripgrep"
import { Global } from "../global"
import { Filesystem } from "../util/filesystem"
import { Config } from "../config/config"

import { Instance } from "../project/instance"
import path from "path"
import os from "os"

import PROMPT_ANTHROPIC from "./prompt/anthropic.txt"
import PROMPT_ANTHROPIC_WITHOUT_TODO from "./prompt/qwen.txt"
import PROMPT_BEAST from "./prompt/beast.txt"
import PROMPT_GEMINI from "./prompt/gemini.txt"
import PROMPT_ANTHROPIC_SPOOF from "./prompt/anthropic_spoof.txt"
import PROMPT_SUMMARIZE from "./prompt/summarize.txt"
import PROMPT_TITLE from "./prompt/title.txt"
import PROMPT_CODEX from "./prompt/codex.txt"

// Cache for loaded prompt overrides
const promptCache = new Map<string, string>()

// Import additional prompts used in session/index.ts
import PROMPT_INITIALIZE from "./prompt/initialize.txt"
import PROMPT_PLAN from "./prompt/plan.txt"
import PROMPT_COMPACTION from "./prompt/compaction.txt"

// Built-in prompt mapping
const BUILT_IN_PROMPTS = {
  "anthropic.txt": PROMPT_ANTHROPIC,
  "qwen.txt": PROMPT_ANTHROPIC_WITHOUT_TODO,
  "beast.txt": PROMPT_BEAST,
  "gemini.txt": PROMPT_GEMINI,
  "anthropic_spoof.txt": PROMPT_ANTHROPIC_SPOOF,
  "summarize.txt": PROMPT_SUMMARIZE,
  "title.txt": PROMPT_TITLE,
  "codex.txt": PROMPT_CODEX,
  "initialize.txt": PROMPT_INITIALIZE,
  "plan.txt": PROMPT_PLAN,
  "compaction.txt": PROMPT_COMPACTION,
} as const


export namespace SystemPrompt {
  /**
   * Load a prompt with override support
   * Priority: project .opencode/prompt/ -> global ~/.opencode/prompt/ -> built-in
   */
  export async function loadPrompt(filename: string): Promise<string> {
    const cacheKey = filename
    if (promptCache.has(cacheKey)) {
      return promptCache.get(cacheKey)!
    }

    const cwd = Instance.directory
    const root = Instance.worktree
    
    // Check project-level override
    const projectPromptFile = path.join(".opencode", "prompt", filename)
    const projectMatches = await Filesystem.findUp(projectPromptFile, cwd, root)
    if (projectMatches.length > 0) {
      try {
        const content = await Bun.file(projectMatches[0]).text()
        promptCache.set(cacheKey, content)
        return content
      } catch (error) {
        // Fall through to check global override
      }
    }

    // Check global override
    const globalPromptPath = path.join(os.homedir(), ".opencode", "prompt", filename)
    try {
      if (await Bun.file(globalPromptPath).exists()) {
        const content = await Bun.file(globalPromptPath).text()
        promptCache.set(cacheKey, content)
        return content
      }
    } catch (error) {
      // Fall through to built-in
    }

    // Use built-in prompt
    const builtIn = BUILT_IN_PROMPTS[filename as keyof typeof BUILT_IN_PROMPTS]
    if (builtIn) {
      promptCache.set(cacheKey, builtIn)
      return builtIn
    }

    throw new Error(`Unknown prompt file: ${filename}`)
  }

  export async function header(providerID: string) {
    if (providerID.includes("anthropic")) {
      const prompt = await SystemPrompt.loadPrompt("anthropic_spoof.txt")
      return [prompt.trim()]
    }
    return []
  }

  export async function provider(modelID: string) {
    if (modelID.includes("gpt-5")) return [await SystemPrompt.loadPrompt("codex.txt")]
    if (modelID.includes("gpt-") || modelID.includes("o1") || modelID.includes("o3")) return [await SystemPrompt.loadPrompt("beast.txt")]
    if (modelID.includes("gemini-")) return [await SystemPrompt.loadPrompt("gemini.txt")]
    if (modelID.includes("claude")) return [await SystemPrompt.loadPrompt("anthropic.txt")]
    return [await SystemPrompt.loadPrompt("qwen.txt")]
  }

  export async function environment() {
    const project = Instance.project
    return [
      [
        `Here is some useful information about the environment you are running in:`,
        `<env>`,
        `  Working directory: ${Instance.directory}`,
        `  Is directory a git repo: ${project.vcs === "git" ? "yes" : "no"}`,
        `  Platform: ${process.platform}`,
        `  Today's date: ${new Date().toDateString()}`,
        `</env>`,
        `<project>`,
        `  ${
          project.vcs === "git"
            ? await Ripgrep.tree({
                cwd: Instance.directory,
                limit: 200,
              })
            : ""
        }`,
        `</project>`,
      ].join("\n"),
    ]
  }

  const LOCAL_RULE_FILES = [
    "AGENTS.md",
    "CLAUDE.md",
    "CONTEXT.md", // deprecated
  ]
  const GLOBAL_RULE_FILES = [
    path.join(Global.Path.config, "AGENTS.md"),
    path.join(os.homedir(), ".claude", "CLAUDE.md"),
  ]

  export async function custom() {
    const config = await Config.get()
    const paths = new Set<string>()

    for (const localRuleFile of LOCAL_RULE_FILES) {
      const matches = await Filesystem.findUp(localRuleFile, Instance.directory, Instance.worktree)
      if (matches.length > 0) {
        matches.forEach((path) => paths.add(path))
        break
      }
    }

    for (const globalRuleFile of GLOBAL_RULE_FILES) {
      if (await Bun.file(globalRuleFile).exists()) {
        paths.add(globalRuleFile)
        break
      }
    }

    if (config.instructions) {
      for (let instruction of config.instructions) {
        if (instruction.startsWith("~/")) {
          instruction = path.join(os.homedir(), instruction.slice(2))
        }
        let matches: string[] = []
        if (path.isAbsolute(instruction)) {
          matches = await Array.fromAsync(
            new Bun.Glob(path.basename(instruction)).scan({
              cwd: path.dirname(instruction),
              absolute: true,
              onlyFiles: true,
            }),
          ).catch(() => [])
        } else {
          matches = await Filesystem.globUp(instruction, Instance.directory, Instance.worktree).catch(() => [])
        }
        matches.forEach((path) => paths.add(path))
      }
    }

    const found = Array.from(paths).map((p) =>
      Bun.file(p)
        .text()
        .catch(() => ""),
    )
    return Promise.all(found).then((result) => result.filter(Boolean))
  }

  export async function summarize(providerID: string) {
    switch (providerID) {
      case "anthropic":
        const spoofPrompt = await SystemPrompt.loadPrompt("anthropic_spoof.txt")
        const summarizePrompt = await SystemPrompt.loadPrompt("summarize.txt")
        return [spoofPrompt.trim(), summarizePrompt]
      default:
        return [await SystemPrompt.loadPrompt("summarize.txt")]
    }
  }

  export async function title(providerID: string) {
    switch (providerID) {
      case "anthropic":
        const spoofPrompt = await SystemPrompt.loadPrompt("anthropic_spoof.txt")
        const titlePrompt = await SystemPrompt.loadPrompt("title.txt")
        return [spoofPrompt.trim(), titlePrompt]
      default:
        return [await SystemPrompt.loadPrompt("title.txt")]
    }
  }
}
