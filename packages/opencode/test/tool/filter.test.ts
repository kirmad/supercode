import { describe, test, expect } from "bun:test"
import { ToolFilter } from "../../src/tool/filter"

describe("ToolFilter", () => {
  describe("resolveToolConfig and isToolEnabled", () => {
    test("agent tools are the base configuration", () => {
      const config: ToolFilter.ToolConfig = {
        agent: {
          tools: {
            read: true,
            write: false,
            bash: true,
          },
        },
      }

      const resolution = ToolFilter.resolveToolConfig(config)
      expect(ToolFilter.isToolEnabled("read", resolution)).toBe(true)
      expect(ToolFilter.isToolEnabled("write", resolution)).toBe(false)
      expect(ToolFilter.isToolEnabled("bash", resolution)).toBe(true)
      expect(ToolFilter.isToolEnabled("TodoRead", resolution)).toBe(true)
      expect(ToolFilter.isToolEnabled("TodoWrite", resolution)).toBe(true)
    })

    test("command tools completely replace agent tools when specified", () => {
      const config: ToolFilter.ToolConfig = {
        agent: {
          tools: {
            read: true,
            write: false,
            bash: true,
            edit: true,
          },
        },
        command: {
          allowedTools: ["write", "bash"],
        },
      }

      const resolution = ToolFilter.resolveToolConfig(config)
      // Command replaces agent config entirely - only write and bash are enabled
      expect(ToolFilter.isToolEnabled("write", resolution)).toBe(true)
      expect(ToolFilter.isToolEnabled("bash", resolution)).toBe(true)
      expect(ToolFilter.isToolEnabled("read", resolution)).toBe(false) // Not in command's allowed list
      expect(ToolFilter.isToolEnabled("edit", resolution)).toBe(false) // Not in command's allowed list
    })

    test("flag tools modify command and agent tools", () => {
      const config: ToolFilter.ToolConfig = {
        agent: {
          tools: {
            read: true,
            write: false,
            bash: true,
          },
        },
        command: {
          allowedTools: ["write", "bash"],
        },
        flags: {
          denyTools: ["bash"],
        },
      }

      const resolution = ToolFilter.resolveToolConfig(config)
      expect(ToolFilter.isToolEnabled("bash", resolution)).toBe(false)
      expect(ToolFilter.isToolEnabled("write", resolution)).toBe(true)
    })

    test("input tools override all other configurations", () => {
      const config: ToolFilter.ToolConfig = {
        agent: {
          tools: {
            read: true,
            write: false,
          },
        },
        command: {
          allowedTools: ["write"],
        },
        flags: {
          denyTools: ["write"],
        },
        input: {
          write: true, // This should win
        },
      }

      const resolution = ToolFilter.resolveToolConfig(config)
      expect(ToolFilter.isToolEnabled("write", resolution)).toBe(true)
    })

    test("allowedTools disables all other tools", () => {
      const config: ToolFilter.ToolConfig = {
        agent: {
          tools: {
            read: true,
            write: true,
            bash: true,
            edit: true,
          },
          allowedTools: ["read", "write"],
        },
      }

      const resolution = ToolFilter.resolveToolConfig(config)
      expect(ToolFilter.isToolEnabled("read", resolution)).toBe(true)
      expect(ToolFilter.isToolEnabled("write", resolution)).toBe(true)
      expect(ToolFilter.isToolEnabled("bash", resolution)).toBe(false)
      expect(ToolFilter.isToolEnabled("edit", resolution)).toBe(false)
    })
  })

  describe("parseToolPatterns", () => {
    test("parses comma-separated patterns", () => {
      const patterns = ToolFilter.parseToolPatterns("read, write, bash")
      expect(patterns).toEqual(["read", "write", "bash"])
    })

    test("parses patterns with parentheses", () => {
      const patterns = ToolFilter.parseToolPatterns("read, Bash(git add:*), write")
      expect(patterns).toEqual(["read", "Bash(git add:*)", "write"])
    })

    test("handles newlines and spaces", () => {
      const patterns = ToolFilter.parseToolPatterns("read\nwrite  bash")
      expect(patterns).toEqual(["read", "write", "bash"])
    })

    test("handles array input", () => {
      const patterns = ToolFilter.parseToolPatterns(["read", "write", "bash"])
      expect(patterns).toEqual(["read", "write", "bash"])
    })

    test("preserves complex bash patterns", () => {
      const patterns = ToolFilter.parseToolPatterns(
        "Bash(git add:*), Bash(npm install:*), context7_*, read"
      )
      expect(patterns).toEqual([
        "Bash(git add:*)",
        "Bash(npm install:*)",
        "context7_*",
        "read",
      ])
    })
  })

  describe("matchesPattern", () => {
    test("matches exact tool names", () => {
      expect(ToolFilter.matchesPattern("read", "read")).toBe(true)
      expect(ToolFilter.matchesPattern("read", "write")).toBe(false)
    })

    test("matches bash command patterns", () => {
      expect(ToolFilter.matchesPattern("bash", "Bash(git add:*)")).toBe(true)
      expect(ToolFilter.matchesPattern("read", "Bash(git add:*)")).toBe(false)
    })

    test("matches wildcard patterns", () => {
      expect(ToolFilter.matchesPattern("context7_resolve", "context7_*")).toBe(true)
      expect(ToolFilter.matchesPattern("context7_get", "context7_*")).toBe(true)
      expect(ToolFilter.matchesPattern("mcp_context7", "context7_*")).toBe(false)
    })

    test("case insensitive matching for simple patterns", () => {
      expect(ToolFilter.matchesPattern("read", "READ")).toBe(true)
      expect(ToolFilter.matchesPattern("READ", "read")).toBe(true)
    })
  })

  describe("isToolEnabled", () => {
    test("returns true for explicitly enabled tools", () => {
      const resolution: ToolFilter.ToolResolution = {
        base: { read: true, write: false }
      }
      expect(ToolFilter.isToolEnabled("read", resolution)).toBe(true)
      expect(ToolFilter.isToolEnabled("write", resolution)).toBe(false)
    })

    test("returns true for tools not in config (default enabled)", () => {
      const resolution: ToolFilter.ToolResolution = {
        base: { read: true }
      }
      expect(ToolFilter.isToolEnabled("bash", resolution)).toBe(true)
    })

    test("matches against patterns", () => {
      const resolution: ToolFilter.ToolResolution = {
        base: {
          "context7_*": true,
          "Bash(git:*)": false,
        }
      }
      expect(ToolFilter.isToolEnabled("context7_resolve", resolution)).toBe(true)
      expect(ToolFilter.isToolEnabled("bash", resolution)).toBe(false)
    })

    test("exact match takes precedence over pattern", () => {
      const resolution: ToolFilter.ToolResolution = {
        base: {
          "context7_*": true,
          "context7_resolve": false, // Specific override
        }
      }
      expect(ToolFilter.isToolEnabled("context7_resolve", resolution)).toBe(false)
      expect(ToolFilter.isToolEnabled("context7_get", resolution)).toBe(true)
    })
  })

  describe("Always-allowed tools", () => {
    test("TodoRead and TodoWrite are always enabled", () => {
      const config: ToolFilter.ToolConfig = {
        command: {
          allowedTools: ["read", "write"],
        },
        flags: {
          denyTools: ["*"],
          allowedTools: ["grep"],
        },
      }

      const resolution = ToolFilter.resolveToolConfig(config)
      // Even though flags deny all and only allow grep, TodoRead and TodoWrite are still enabled
      expect(ToolFilter.isToolEnabled("TodoRead", resolution)).toBe(true)
      expect(ToolFilter.isToolEnabled("TodoWrite", resolution)).toBe(true)
      expect(ToolFilter.isToolEnabled("grep", resolution)).toBe(true)
      expect(ToolFilter.isToolEnabled("read", resolution)).toBe(false)
      expect(ToolFilter.isToolEnabled("write", resolution)).toBe(false)
    })

    test("isToolEnabled always returns true for TodoRead and TodoWrite", () => {
      const resolution: ToolFilter.ToolResolution = {
        base: {
          "read": false,
          "write": false,
          "*": false, // Even with wildcard deny-all
        }
      }
      
      expect(ToolFilter.isToolEnabled("TodoRead", resolution)).toBe(true)
      expect(ToolFilter.isToolEnabled("TodoWrite", resolution)).toBe(true)
      expect(ToolFilter.isToolEnabled("read", resolution)).toBe(false)
    })
  })

  describe("Integration scenarios", () => {
    test("command with allowed-tools and deny-tools", () => {
      const config: ToolFilter.ToolConfig = {
        command: {
          allowedTools: ["read", "write", "edit", "Bash(git status:*)", "Bash(git diff:*)"],
          denyTools: ["webfetch"],
        },
      }

      const resolution = ToolFilter.resolveToolConfig(config)
      expect(ToolFilter.isToolEnabled("read", resolution)).toBe(true)
      expect(ToolFilter.isToolEnabled("write", resolution)).toBe(true)
      expect(ToolFilter.isToolEnabled("edit", resolution)).toBe(true)
      expect(ToolFilter.isToolEnabled("Bash(git status:*)", resolution)).toBe(true)
      expect(ToolFilter.isToolEnabled("Bash(git diff:*)", resolution)).toBe(true)
      expect(ToolFilter.isToolEnabled("webfetch", resolution)).toBe(false)
    })

    test("flag overrides command configuration", () => {
      const config: ToolFilter.ToolConfig = {
        command: {
          allowedTools: ["read", "write", "bash"],
        },
        flags: {
          denyTools: ["bash", "webfetch"],
          allowedTools: ["read", "write"],
        },
      }

      const resolution = ToolFilter.resolveToolConfig(config)
      expect(ToolFilter.isToolEnabled("read", resolution)).toBe(true)
      expect(ToolFilter.isToolEnabled("write", resolution)).toBe(true)
      expect(ToolFilter.isToolEnabled("bash", resolution)).toBe(false)
      expect(ToolFilter.isToolEnabled("webfetch", resolution)).toBe(false)
    })

    test("complex precedence scenario", () => {
      const config: ToolFilter.ToolConfig = {
        agent: {
          tools: {
            read: true,
            write: true,
            edit: true,
            bash: true,
          },
          allowedTools: ["read", "write", "edit"], // bash is disabled
        },
        command: {
          allowedTools: ["read", "write", "bash"], // tries to enable bash
        },
        flags: {
          denyTools: ["write"], // denies write
        },
        input: {
          edit: false, // explicitly disables edit
        },
      }

      const resolution = ToolFilter.resolveToolConfig(config)
      // Flag precedence: flags deny write
      expect(ToolFilter.isToolEnabled("write", resolution)).toBe(false)
      // Input precedence: explicitly disables edit
      expect(ToolFilter.isToolEnabled("edit", resolution)).toBe(false)
      // Command enabled bash, not overridden by flag
      expect(ToolFilter.isToolEnabled("bash", resolution)).toBe(true)
      // Read is allowed everywhere
      expect(ToolFilter.isToolEnabled("read", resolution)).toBe(true)
    })
  })
})