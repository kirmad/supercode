import { Global } from "../global"
import { Filesystem } from "../util/filesystem"
import { Config } from "../config/config"

import { Instance } from "../project/instance"
import path from "path"
import os from "os"
import { $ } from "bun"

import PROMPT_ANTHROPIC from "./prompt/anthropic.txt"
import PROMPT_ANTHROPIC_STYLED from "./prompt/anthropic-styled.txt"
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
  "anthropic-styled.txt": PROMPT_ANTHROPIC_STYLED,
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

  export async function header(modelID: string) {
    // Check for specific Anthropic models (Sonnet or Opus)
    if (modelID.includes("sonnet") || modelID.includes("opus")) {
      const prompt = await SystemPrompt.loadPrompt("anthropic_spoof.txt")
      return [prompt.trim()]
    }
    return []
  }

  /**
   * Replace template placeholders in prompt text
   */
  async function processTemplate(prompt: string): Promise<string> {
    // Currently no template processing needed
    // All dynamic content is added via concatenation
    return prompt
  }

  export async function provider(modelID: string, outputStyle?: string) {
    let promptFile = "qwen.txt"

    // Choose the appropriate base prompt based on model
    if (modelID.includes("gpt-5")) promptFile = "codex.txt"
    else if (modelID.includes("gpt-") || modelID.includes("o1") || modelID.includes("o3")) promptFile = "beast.txt"
    else if (modelID.includes("gemini-")) promptFile = "gemini.txt"
    else if (modelID.includes("claude")) {
      // For Anthropic models, use the styled prompt if output style is active
      if (outputStyle && outputStyle !== "default") {
        promptFile = "anthropic-styled.txt"
      } else {
        promptFile = "anthropic.txt"
      }
    }

    let prompt = await SystemPrompt.loadPrompt(promptFile)
    const processedPrompt = await processTemplate(prompt)

    return [processedPrompt]
  }

  export async function getGitStatus() {
    try {
      const cwd = Instance.directory
      const project = Instance.project

      if (project.vcs !== "git") {
        return ""
      }

      // Get current branch
      const currentBranch = await $`git branch --show-current`
        .quiet()
        .nothrow()
        .cwd(cwd)
        .text()
        .then((x) => x.trim())
        .catch(() => "")

      // Get main/master branch
      const mainBranch = await $`git symbolic-ref refs/remotes/origin/HEAD`
        .quiet()
        .nothrow()
        .cwd(cwd)
        .text()
        .then((x) => x.replace("refs/remotes/origin/", "").trim())
        .catch(async () => {
          // Fallback to checking if main or master exists
          const branches = await $`git branch -a`
            .quiet()
            .nothrow()
            .cwd(cwd)
            .text()
            .then((x) => x.trim())
            .catch(() => "")

          if (branches.includes("main")) return "main"
          if (branches.includes("master")) return "master"
          return "main"
        })

      // Get status
      const status = await $`git status --porcelain`
        .quiet()
        .nothrow()
        .cwd(cwd)
        .text()
        .then((x) => x.trim())
        .catch(() => "")

      // Get recent commits
      const commits = await $`git log --oneline -5`
        .quiet()
        .nothrow()
        .cwd(cwd)
        .text()
        .then((x) => x.trim())
        .catch(() => "")

      const statusLines = status ? status.split("\n").filter(Boolean) : []

      return [
        ``,
        ``,
        `gitStatus: This is the git status at the start of the conversation. Note that this status is a snapshot in time, and will not update during the conversation.`,
        `Current branch: ${currentBranch || "unknown"}`,
        ``,
        `Main branch (you will usually use this for PRs): ${mainBranch}`,
        ``,
        `Status:`,
        statusLines.length > 0 ? statusLines.join("\n") : "(clean)",
        ``,
        `Recent commits:`,
        commits || "(no commits)"
      ].join("\n")
    } catch (error) {
      return ""
    }
  }

  export async function environment() {
    const project = Instance.project
    const gitStatus = await getGitStatus()

    return [
      [
        `Here is useful information about the environment you are running in:`,
        `<env>`,
        `Working directory: ${Instance.directory}`,
        `Is directory a git repo: ${project.vcs === "git" ? "Yes" : "No"}`,
        `Platform: ${process.platform}`,
        `OS Version: ${os.type()} ${os.release()}`,
        `Today's date: ${new Date().toISOString().slice(0, 10)}`,
        `</env>`,
        gitStatus,
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

  /**
   * Collect and process .instructions.md files
   * Traverses from current directory up to repository root, collecting all <filename>.instructions.md files
   * Applies instructions in reverse order: root first, then each child level, ending with current directory
   */
  export async function instructions() {
    const project = Instance.project
    const paths = new Set<string>()
    
    // If not in a git repo, just look in current directory using Filesystem.globUp
    const stop = project.vcs === "git" ? Instance.worktree : Instance.directory
    
    try {
      const matches = await Filesystem.globUp("*.instructions.md", Instance.directory, stop)
      matches.forEach((path) => paths.add(path))
    } catch (error) {
      // Ignore glob errors
    }
    
    // Convert paths to array and sort for consistent ordering
    // Sort by path length (shorter = higher in directory tree = should come first)
    const sortedPaths = Array.from(paths).sort((a, b) => a.length - b.length)
    
    // Load content from all instruction files
    const found = sortedPaths.map((p) =>
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
