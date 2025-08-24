import { Global } from "../global"
import { Log } from "../util/log"
import path from "path"
import { z } from "zod"
import { data } from "./models-macro" with { type: "macro" }
import { Installation } from "../installation"

export namespace ModelsDev {
  const log = Log.create({ service: "models.dev" })
  const filepath = path.join(Global.Path.cache, "models.json")

  export const Model = z
    .object({
      id: z.string(),
      name: z.string(),
      release_date: z.string(),
      attachment: z.boolean(),
      reasoning: z.boolean(),
      temperature: z.boolean(),
      tool_call: z.boolean(),
      cost: z.object({
        input: z.number(),
        output: z.number(),
        cache_read: z.number().optional(),
        cache_write: z.number().optional(),
      }),
      limit: z.object({
        context: z.number(),
        output: z.number(),
        input: z.number().optional(),
      }),
      options: z.record(z.any()),
    })
    .openapi({
      ref: "Model",
    })
  export type Model = z.infer<typeof Model>

  export const Provider = z
    .object({
      api: z.string().optional(),
      name: z.string(),
      env: z.array(z.string()),
      id: z.string(),
      npm: z.string().optional(),
      models: z.record(Model),
    })
    .openapi({
      ref: "Provider",
    })

  export type Provider = z.infer<typeof Provider>

  /**
   * GitHub Copilot model overrides - replaces token limits and names at runtime
   * with correct values for GitHub Copilot models
   */
  function getGitHubCopilotModelOverrides(): Record<string, { output: number; contextWindow: number; input?: number; name?: string }> {
    return {
      "gpt-4.1": { output: 16384, contextWindow: 128000, input: 128_000, name: "GPT-4.1 - 0x" },
      "gpt-5-mini": { output: 64000, contextWindow: 128000, input: 128_000, name: "GPT-5 Mini - 0x" },
      "gpt-5": { output: 64000, contextWindow: 128000, input: 128_000, name: "GPT-5 - 1x" },
      "gpt-3.5-turbo": { output: 4096, contextWindow: 16384, input: 12288, name: "GPT-3.5 Turbo - 0x" },
      "gpt-3.5-turbo-0613": { output: 4096, contextWindow: 16384, input: 12288, name: "GPT-3.5 Turbo (June 2023) - 0x" },
      "gpt-4o-mini": { output: 4096, contextWindow: 16384, input: 12_288, name: "GPT-4o Mini - 0x" },
      "gpt-4o-mini-2024-07-18": { output: 4096, contextWindow: 16384, input: 12_288, name: "GPT-4o Mini (July 2024) - 0x" },
      "gpt-4": { output: 4096, contextWindow: 32768, input: 32_768, name: "GPT-4 - 0x" },
      "gpt-4-0613": { output: 4096, contextWindow: 32768, input: 32_768, name: "GPT-4 (June 2023) - 0x" },
      "gpt-4-0125-preview": { output: 4096, contextWindow: 68096, input: 64_000, name: "GPT-4 Turbo Preview (Jan 2024) - 0x" },
      "gpt-4o": { output: 4096, contextWindow: 68096, input: 64_000, name: "GPT-4o - 0x" },
      "gpt-4o-2024-11-20": { output: 16384, contextWindow: 80384, input: 64_000, name: "GPT-4o (November 2024) - 0x" },
      "gpt-4o-2024-05-13": { output: 4096, contextWindow: 68096, input: 64_000, name: "GPT-4o (May 2024) - 0x" },
      "gpt-4-o-preview": { output: 4096, contextWindow: 68096, input: 64_000, name: "GPT-4o Preview - 0x" },
      "gpt-4o-2024-08-06": { output: 16384, contextWindow: 80384, input: 64_000, name: "GPT-4o (August 2024) - 0x" },
      "o3-mini": { output: 100000, contextWindow: 164000, input: 64_000, name: "o3-mini - 0.33x" },
      "o3-mini-2025-01-31": { output: 100000, contextWindow: 164000, input: 64_000, name: "o3-mini (January 2025) - 0.33x" },
      "o3-mini-paygo": { output: 100000, contextWindow: 164000, input: 64_000, name: "o3-mini Pay-as-you-go - 0.33x" },
      "claude-3.5-sonnet": { output: 8192, contextWindow: 90000, input: 90_000, name: "Claude 3.5 Sonnet - 1x" },
      "claude-3.7-sonnet": { output: 16384, contextWindow: 106384, input: 90_000, name: "Claude 3.7 Sonnet - 1x" },
      "claude-3.7-sonnet-thought": { output: 16384, contextWindow: 106384, input: 90_000, name: "Claude 3.7 Sonnet with Thought - 1.25x" },
      "claude-sonnet-4": { output: 16000, contextWindow: 128000, input: 128_000, name: "Claude Sonnet 4 - 1x" },
      "claude-opus-4": { output: 16000, contextWindow: 80000, input: 80_000, name: "Claude Opus 4 - 10x" },
      "claude-opus-41": { output: 16000, contextWindow: 80000, input: 80_000, name: "Claude Opus 4.1 - 10x" },
      "gemini-2.0-flash-001": { output: 8192, contextWindow: 136192, input: 128_000, name: "Gemini 2.0 Flash - 0.25x" },
      "gemini-2.5-pro": { output: 64000, contextWindow: 128000, input: 128_000, name: "Gemini 2.5 Pro - 1x" },
      "o3": { output: 16384, contextWindow: 128000, input: 128_000, name: "o3 - 1x" },
      "o3-2025-04-16": { output: 16384, contextWindow: 128000, input: 128_000, name: "o3 (April 2025) - 1x" },
      "o4-mini": { output: 16384, contextWindow: 128000, input: 128_000, name: "o4-mini - 0.33x" },
      "o4-mini-2025-04-16": { output: 100000, contextWindow: 128000, input: 128_000, name: "o4-mini (April 2025) - 0.33x" },
      "gpt-4.1-2025-04-14": { output: 16384, contextWindow: 128000, input: 128_000, name: "GPT-4.1 (April 2025) - 0x" },
      "gpt-4.1-oswe-control": { output: 16384, contextWindow: 128000, input: 128_000, name: "GPT-4.1 OSWE Control - 0x" },
      "gpt-5-mini-oswe-control": { output: 64000, contextWindow: 128000, input: 128_000, name: "GPT-5 Mini OSWE Control - 0x" }
    }
  }

  /**
   * Applies GitHub Copilot model limit overrides at runtime
   */
  function applyGitHubCopilotOverrides(providers: Record<string, Provider>): Record<string, Provider> {
    const overrides = getGitHubCopilotModelOverrides()
    
    // Apply overrides to github-copilot provider if it exists
    if (providers["github-copilot"]) {
      const githubCopilotProvider = providers["github-copilot"]
      
      for (const [modelId, model] of Object.entries(githubCopilotProvider.models)) {
        if (overrides[modelId]) {
          const override = overrides[modelId]
          
          // Update the model limits with correct values
          model.limit = {
            context: override.contextWindow,
            output: override.output,
            input: override.input
          }
          
          // Update the model name if override is provided
          if (override.name) {
            model.name = override.name
          }
          
          log.info("applied GitHub Copilot model override", {
            modelId,
            contextWindow: override.contextWindow,
            output: override.output,
            name: override.name || model.name
          })
        }
      }
    }

    return providers
  }

  export async function get() {
    refresh()
    const file = Bun.file(filepath)
    const result = await file.json().catch(() => {})
    let providers: Record<string, Provider>
    
    if (result) {
      providers = result as Record<string, Provider>
    } else {
      const json = await data()
      providers = JSON.parse(json) as Record<string, Provider>
    }
    
    // Apply GitHub Copilot model limit overrides at runtime
    return applyGitHubCopilotOverrides(providers)
  }

  export async function refresh() {
    const file = Bun.file(filepath)
    log.info("refreshing", {
      file,
    })
    const result = await fetch("https://models.dev/api.json", {
      headers: {
        "User-Agent": Installation.USER_AGENT,
      },
    }).catch((e) => {
      log.error("Failed to fetch models.dev", {
        error: e,
      })
    })
    if (result && result.ok) await Bun.write(file, await result.text())
  }
}

setInterval(() => ModelsDev.refresh(), 60 * 1000 * 60).unref()
