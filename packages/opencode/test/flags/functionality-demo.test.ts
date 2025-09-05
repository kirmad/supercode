import { describe, test, expect } from "bun:test"
import { Flags } from "../../src/flags/flags"
import { Instance } from "../../src/project/instance"

describe("Flags Functionality Demo", () => {
  test("demonstrates flag parsing functionality", async () => {
    // Test basic flag parsing
    const rootFlag = await Flags.parseFlag("--verbose")
    expect(rootFlag.isFlagReference).toBe(true)
    expect(rootFlag.flag).toBe("verbose")

    const namespacedFlag = await Flags.parseFlag("--build:verbose")
    expect(namespacedFlag.isFlagReference).toBe(true)
    expect(namespacedFlag.namespace).toBe("build")
    expect(namespacedFlag.flag).toBe("verbose")

    // Test flag reference parsing in text
    const references = await Flags.parseFlagReferences("--verbose implement --build:debug auth")
    expect(references).toHaveLength(2)
    expect(references[0].flag.flag).toBe("verbose")
    expect(references[1].flag.namespace).toBe("build")
    expect(references[1].flag.flag).toBe("debug")
  })

  test("demonstrates working flag processing with real flags", async () => {
    // This test uses actual flags created in the project directory
    await Instance.provide("/Users/kirmadi/git/supercode", async () => {
      // Test basic replacement
      const result1 = await Flags.processFlagReferences("--verbose test")
      expect(result1).toContain("Provide detailed explanations")
      
      // Test before placement
      const result2 = await Flags.processFlagReferences("--before test")
      expect(result2).toContain("Context: Expert mode")
      expect(result2).toContain("test")
      
      // Test namespaced flag
      const result3 = await Flags.processFlagReferences("--build:verbose test")
      expect(result3).toContain("Show detailed build output")
    })
  })

  test("demonstrates flag info retrieval", async () => {
    await Instance.provide("/Users/kirmadi/git/supercode", async () => {
      const info = await Flags.getFlagInfo(undefined, "before")
      expect(info).not.toBe(null)
      expect(info!.metadata.placement).toBe("before")
      
      const namespacedInfo = await Flags.getFlagInfo("build", "verbose")
      expect(namespacedInfo).not.toBe(null)
      expect(namespacedInfo!.metadata.description).toBe("Verbose build")
    })
  })

  test("handles non-existent flags gracefully", async () => {
    await Instance.provide("/Users/kirmadi/git/supercode", async () => {
      const result = await Flags.processFlagReferences("--nonexistent test")
      expect(result).toBe("--nonexistent test")
      
      const info = await Flags.getFlagInfo(undefined, "nonexistent")
      expect(info).toBe(null)
    })
  })
})