import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { Flags } from "../../src/flags/flags"
import { promises as fs } from "fs"
import path from "path"
import { App } from "../../src/app/app"

const fixturePath = path.join(__dirname, "../fixtures/flags-test")

describe("Flags.parseFlag", () => {
  test("parses namespaced flag", () => {
    const result = Flags.parseFlag("--build:verbose")
    expect(result).toMatchObject({
      isFlagReference: true,
      namespace: "build",
      flag: "verbose",
      fullMatch: "--build:verbose"
    })
  })

  test("parses root flag", () => {
    const result = Flags.parseFlag("--verbose")
    expect(result).toMatchObject({
      isFlagReference: true,
      flag: "verbose",
      fullMatch: "--verbose"
    })
  })

  test("ignores non-flag input", () => {
    const result = Flags.parseFlag("regular text")
    expect(result).toMatchObject({
      isFlagReference: false
    })
  })

  test("ignores single dash", () => {
    const result = Flags.parseFlag("-v")
    expect(result).toMatchObject({
      isFlagReference: false
    })
  })
})

describe("Flags.parseFlagReferences", () => {
  test("finds single root flag", () => {
    const references = Flags.parseFlagReferences("Please --verbose implement auth")
    expect(references).toHaveLength(1)
    expect(references[0].flag.flag).toBe("verbose")
    expect(references[0].startIndex).toBe(7)
    expect(references[0].endIndex).toBe(16)
  })

  test("finds single namespaced flag", () => {
    const references = Flags.parseFlagReferences("--build:verbose create component")
    expect(references).toHaveLength(1)
    expect(references[0].flag.namespace).toBe("build")
    expect(references[0].flag.flag).toBe("verbose")
    expect(references[0].startIndex).toBe(0)
    expect(references[0].endIndex).toBe(15)
  })

  test("finds multiple flags", () => {
    const references = Flags.parseFlagReferences("--verbose --build:debug implement auth")
    expect(references).toHaveLength(2)
    expect(references[0].flag.flag).toBe("verbose")
    expect(references[1].flag.namespace).toBe("build")
    expect(references[1].flag.flag).toBe("debug")
  })

  test("handles overlapping patterns correctly", () => {
    const references = Flags.parseFlagReferences("--build:verbose-test create")
    expect(references).toHaveLength(1)
    expect(references[0].flag.namespace).toBe("build")
    expect(references[0].flag.flag).toBe("verbose-test")
  })

  test("finds no flags in regular text", () => {
    const references = Flags.parseFlagReferences("regular text with no flags")
    expect(references).toHaveLength(0)
  })

  test("sorts flags by position", () => {
    const references = Flags.parseFlagReferences("implement --second auth --first")
    expect(references).toHaveLength(2)
    expect(references[0].flag.flag).toBe("second")
    expect(references[1].flag.flag).toBe("first")
  })
})

describe("Flags.processFlagReferences", () => {
  beforeEach(async () => {
    // Create test fixture directory
    await fs.mkdir(path.join(fixturePath, ".opencode", "flags"), { recursive: true })
    await fs.mkdir(path.join(fixturePath, ".opencode", "flags", "build"), { recursive: true })
  })

  afterEach(async () => {
    // Clean up test fixtures
    try {
      await fs.rm(fixturePath, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  test("replaces flag with content (default behavior)", async () => {
    await fs.writeFile(
      path.join(fixturePath, ".opencode", "flags", "verbose.md"),
      "Provide detailed explanations for all steps."
    )

    await App.provide({ cwd: fixturePath }, async () => {
      const result = await Flags.processFlagReferences("Please --verbose implement auth")
      expect(result).toBe("Please Provide detailed explanations for all steps. implement auth")
    })
  })

  test("places flag content before prompt", async () => {
    await fs.writeFile(
      path.join(fixturePath, ".opencode", "flags", "context.md"),
      `---
placement: "before"
---
You are an expert developer.`
    )

    await App.provide({ cwd: fixturePath }, async () => {
      const result = await Flags.processFlagReferences("--context implement auth")
      expect(result).toBe("You are an expert developer.\n\nimplement auth")
    })
  })

  test("places flag content after prompt", async () => {
    await fs.writeFile(
      path.join(fixturePath, ".opencode", "flags", "quality.md"),
      `---
placement: "after"
---
Ensure code follows best practices.`
    )

    await App.provide({ cwd: fixturePath }, async () => {
      const result = await Flags.processFlagReferences("implement auth --quality")
      expect(result).toBe("implement auth\n\nEnsure code follows best practices.")
    })
  })

  test("handles namespaced flags", async () => {
    await fs.writeFile(
      path.join(fixturePath, ".opencode", "flags", "build", "verbose.md"),
      "Show detailed build output."
    )

    await App.provide({ cwd: fixturePath }, async () => {
      const result = await Flags.processFlagReferences("--build:verbose create component")
      expect(result).toBe("Show detailed build output. create component")
    })
  })

  test("processes multiple flags with different placements", async () => {
    await fs.writeFile(
      path.join(fixturePath, ".opencode", "flags", "before.md"),
      `---
placement: "before"
---
Context: Expert mode.`
    )

    await fs.writeFile(
      path.join(fixturePath, ".opencode", "flags", "after.md"),
      `---
placement: "after"
---
Include tests.`
    )

    await fs.writeFile(
      path.join(fixturePath, ".opencode", "flags", "replace.md"),
      "with detailed docs"
    )

    await App.provide({ cwd: fixturePath }, async () => {
      const result = await Flags.processFlagReferences("--before implement --replace --after")
      expect(result).toBe("Context: Expert mode.\n\nimplement with detailed docs\n\nInclude tests.")
    })
  })

  test("handles missing flags gracefully", async () => {
    await App.provide({ cwd: fixturePath }, async () => {
      const result = await Flags.processFlagReferences("--nonexistent flag test")
      expect(result).toBe("--nonexistent flag test")
    })
  })

  test("processes $ARGUMENTS placeholder (empty in flags)", async () => {
    await fs.writeFile(
      path.join(fixturePath, ".opencode", "flags", "template.md"),
      "Arguments were: $ARGUMENTS (should be empty)"
    )

    await App.provide({ cwd: fixturePath }, async () => {
      const result = await Flags.processFlagReferences("--template test")
      expect(result).toBe("Arguments were:  (should be empty) test")
    })
  })

  test("processes file includes", async () => {
    // Create a file to include
    await fs.writeFile(
      path.join(fixturePath, ".opencode", "flags", "included.txt"),
      "This is included content."
    )

    await fs.writeFile(
      path.join(fixturePath, ".opencode", "flags", "includer.md"),
      "Content: @included.txt"
    )

    await App.provide({ cwd: fixturePath }, async () => {
      const result = await Flags.processFlagReferences("--includer test")
      expect(result).toBe("Content: This is included content. test")
    })
  })

  test("processes shell commands", async () => {
    await fs.writeFile(
      path.join(fixturePath, ".opencode", "flags", "shell.md"),
      "Current dir: !`pwd`"
    )

    await App.provide({ cwd: fixturePath }, async () => {
      const result = await Flags.processFlagReferences("--shell test")
      expect(result).toContain("Current dir:")
      expect(result).toContain("test")
    })
  })

  test("handles shell command errors", async () => {
    await fs.writeFile(
      path.join(fixturePath, ".opencode", "flags", "error.md"),
      "This fails: !`nonexistentcommand`"
    )

    await App.provide({ cwd: fixturePath }, async () => {
      const result = await Flags.processFlagReferences("--error test")
      expect(result).toContain("[Error executing 'nonexistentcommand':")
      expect(result).toContain("test")
    })
  })

  test("handles file include errors", async () => {
    await fs.writeFile(
      path.join(fixturePath, ".opencode", "flags", "badinclude.md"),
      "Content: @nonexistent.txt"
    )

    await App.provide({ cwd: fixturePath }, async () => {
      const result = await Flags.processFlagReferences("--badinclude test")
      expect(result).toContain("[Error including file 'nonexistent.txt':")
      expect(result).toContain("test")
    })
  })
})

describe("Flags.getFlagInfo", () => {
  beforeEach(async () => {
    await fs.mkdir(path.join(fixturePath, ".opencode", "flags", "nested"), { recursive: true })
  })

  afterEach(async () => {
    try {
      await fs.rm(fixturePath, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  test("reads root flag info", async () => {
    await fs.writeFile(
      path.join(fixturePath, ".opencode", "flags", "test.md"),
      `---
description: "Test flag"
signature: "--test"
placement: "before"
---
Test content`
    )

    await App.provide({ cwd: fixturePath }, async () => {
      const info = await Flags.getFlagInfo(undefined, "test")
      expect(info).toMatchObject({
        metadata: {
          description: "Test flag",
          signature: "--test",
          placement: "before"
        },
        content: "Test content"
      })
    })
  })

  test("reads namespaced flag info", async () => {
    await fs.writeFile(
      path.join(fixturePath, ".opencode", "flags", "nested", "flag.md"),
      `---
description: "Nested flag"
---
Nested content`
    )

    await App.provide({ cwd: fixturePath }, async () => {
      const info = await Flags.getFlagInfo("nested", "flag")
      expect(info).toMatchObject({
        metadata: {
          description: "Nested flag",
          placement: "replace" // default
        },
        content: "Nested content"
      })
    })
  })

  test("returns null for missing flag", async () => {
    await App.provide({ cwd: fixturePath }, async () => {
      const info = await Flags.getFlagInfo(undefined, "nonexistent")
      expect(info).toBe(null)
    })
  })

  test("handles file without front matter", async () => {
    await fs.writeFile(
      path.join(fixturePath, ".opencode", "flags", "simple.md"),
      "Just content, no front matter"
    )

    await App.provide({ cwd: fixturePath }, async () => {
      const info = await Flags.getFlagInfo(undefined, "simple")
      expect(info).toMatchObject({
        metadata: {
          placement: "replace" // default
        },
        content: "Just content, no front matter"
      })
    })
  })
})