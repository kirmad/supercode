import { describe, expect, test } from "bun:test"
import { CustomCommands } from "../../src/commands/custom"
import { promises as fs } from "fs"
import path from "path"
import { Instance } from "../../src/project/instance"

// Use the current working directory for testing
const testDir = process.cwd()

describe("CustomCommands.executeCommand Integration", () => {
  test("executes custom command with shell commands", async () => {
    // Create test command file in the current project
    const commandsDir = path.join(testDir, ".opencode", "commands")
    await fs.mkdir(commandsDir, { recursive: true })
    
    const testCommandPath = path.join(commandsDir, "integration-test.md")
    await fs.writeFile(
      testCommandPath,
      "Current directory: !`pwd`\nEcho test: !`echo integration-test`"
    )

    try {
      await Instance.provide(testDir, async () => {
        const result = await CustomCommands.executeCommand("/integration-test")
        expect(result).toContain("Current directory:")
        expect(result).toContain("Echo test: integration-test")
      })
    } finally {
      // Cleanup
      await fs.unlink(testCommandPath).catch(() => {})
    }
  })

  test("handles arguments and shell commands together", async () => {
    // Create test command file
    const commandsDir = path.join(testDir, ".opencode", "commands") 
    await fs.mkdir(commandsDir, { recursive: true })
    
    const testCommandPath = path.join(commandsDir, "args-shell-test.md")
    await fs.writeFile(
      testCommandPath,
      "Arguments: $ARGUMENTS\nDirectory: !`pwd`"
    )

    try {
      await Instance.provide(testDir, async () => {
        const result = await CustomCommands.executeCommand("/args-shell-test hello world")
        expect(result).toContain("Arguments: hello world")
        expect(result).toContain("Directory:")
      })
    } finally {
      // Cleanup
      await fs.unlink(testCommandPath).catch(() => {})
    }
  })
})