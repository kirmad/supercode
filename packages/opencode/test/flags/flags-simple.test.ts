import { describe, expect, test, beforeAll, afterAll } from "bun:test"
import { Flags } from "../../src/flags/flags"
import { promises as fs } from "fs"
import path from "path"

const projectRoot = path.resolve(__dirname, "../../../..")
const flagsDir = path.join(projectRoot, ".opencode", "flags")

describe("Flags Functionality", () => {
  beforeAll(async () => {
    // Create flags in the actual project directory for testing
    await fs.mkdir(flagsDir, { recursive: true })
    await fs.mkdir(path.join(flagsDir, "build"), { recursive: true })
    
    // Create test flags
    await fs.writeFile(
      path.join(flagsDir, "verbose.md"),
      "Provide detailed explanations."
    )
    
    await fs.writeFile(
      path.join(flagsDir, "before.md"),
      `---
description: "Before placement"
placement: "before"
---
Context: Expert mode.`
    )
    
    await fs.writeFile(
      path.join(flagsDir, "after.md"),
      `---
description: "After placement"
placement: "after"
---
Include tests.`
    )
    
    await fs.writeFile(
      path.join(flagsDir, "build", "verbose.md"),
      `---
description: "Verbose build"
---
Show detailed build output.`
    )
  })

  afterAll(async () => {
    // Clean up test flags
    try {
      await fs.unlink(path.join(flagsDir, "verbose.md"))
      await fs.unlink(path.join(flagsDir, "before.md"))
      await fs.unlink(path.join(flagsDir, "after.md"))
      await fs.unlink(path.join(flagsDir, "build", "verbose.md"))
      await fs.rmdir(path.join(flagsDir, "build"))
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  test("parses flag references correctly", () => {
    const references = Flags.parseFlagReferences("--verbose --build:debug implement auth")
    expect(references).toHaveLength(2)
    expect(references[0].flag.flag).toBe("verbose")
    expect(references[1].flag.namespace).toBe("build")
    expect(references[1].flag.flag).toBe("debug")
  })

  test("processes replace placement (default)", async () => {
    const result = await Flags.processFlagReferences("Please --verbose implement auth")
    expect(result).toBe("Please Provide detailed explanations. implement auth")
  })

  test("processes before placement", async () => {
    const result = await Flags.processFlagReferences("--before implement auth")
    expect(result).toBe("Context: Expert mode.\n\nimplement auth")
  })

  test("processes after placement", async () => {
    const result = await Flags.processFlagReferences("implement auth --after")
    expect(result).toBe("implement auth\n\nInclude tests.")
  })

  test("processes namespaced flags", async () => {
    const result = await Flags.processFlagReferences("--build:verbose create component")
    expect(result).toBe("Show detailed build output. create component")
  })

  test("handles missing flags gracefully", async () => {
    const result = await Flags.processFlagReferences("--nonexistent flag test")
    expect(result).toBe("--nonexistent flag test")
  })

  test("processes multiple flags with mixed placements", async () => {
    const result = await Flags.processFlagReferences("--before implement --verbose --after")
    expect(result).toBe("Context: Expert mode.\n\nimplement Provide detailed explanations.\n\nInclude tests.")
  })

  test("gets flag info correctly", async () => {
    const info = await Flags.getFlagInfo(undefined, "before")
    expect(info).not.toBe(null)
    expect(info?.metadata.placement).toBe("before")
    expect(info?.content).toBe("Context: Expert mode.")
  })

  test("gets namespaced flag info correctly", async () => {
    const info = await Flags.getFlagInfo("build", "verbose")
    expect(info).not.toBe(null)
    expect(info?.metadata.description).toBe("Verbose build")
    expect(info?.content).toBe("Show detailed build output.")
  })
})