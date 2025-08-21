import { describe, expect, test } from "bun:test"
import { CustomCommands } from "../../src/commands/custom"
import { promises as fs } from "fs"
import path from "path"
import { App } from "../../src/app/app"

const fixturePath = path.join(__dirname, "../fixtures/custom-commands")

describe("CustomCommands.parseCommand", () => {
  test("parses namespaced command", () => {
    const result = CustomCommands.parseCommand("/sc:implement create a button")
    expect(result).toMatchObject({
      isCustomCommand: true,
      namespace: "sc",
      command: "implement",
      args: "create a button"
    })
  })

  test("parses root command", () => {
    const result = CustomCommands.parseCommand("/bolo hello world")
    expect(result).toMatchObject({
      isCustomCommand: true,
      command: "bolo",
      args: "hello world"
    })
  })

  test("ignores non-command input", () => {
    const result = CustomCommands.parseCommand("regular text")
    expect(result).toMatchObject({
      isCustomCommand: false
    })
  })
})

describe("CustomCommands.executeCommand", () => {
  test("replaces $ARGUMENTS placeholder", async () => {
    // Create test command file first
    await fs.mkdir(path.join(fixturePath, ".opencode", "commands"), { recursive: true })
    await fs.writeFile(
      path.join(fixturePath, ".opencode", "commands", "test.md"),
      "Hello $ARGUMENTS!"
    )

    await App.provide({ cwd: fixturePath }, async () => {
      const result = await CustomCommands.executeCommand("/test world")
      expect(result).toBe("Hello world!")
    })
  })

  test("executes shell commands", async () => {
    // Create test command file with shell commands
    await fs.mkdir(path.join(fixturePath, ".opencode", "commands"), { recursive: true })
    await fs.writeFile(
      path.join(fixturePath, ".opencode", "commands", "shell-test.md"),
      "Current directory: !`pwd`\nDate: !`date +%Y-%m-%d`\nEcho: !`echo Hello Shell`"
    )

    await App.provide({ cwd: fixturePath }, async () => {
      const result = await CustomCommands.executeCommand("/shell-test")
      expect(result).toContain("Current directory:")
      expect(result).toContain("Date:")
      expect(result).toContain("Echo: Hello Shell")
    })
  })

  test("handles shell command errors gracefully", async () => {
    // Create test command file with invalid shell command
    await fs.mkdir(path.join(fixturePath, ".opencode", "commands"), { recursive: true })
    await fs.writeFile(
      path.join(fixturePath, ".opencode", "commands", "error-test.md"),
      "This will fail: !`invalidcommandthatdoesnotexist`"
    )

    await App.provide({ cwd: fixturePath }, async () => {
      const result = await CustomCommands.executeCommand("/error-test")
      expect(result).toContain("[Error executing")
      expect(result).toContain("invalidcommandthatdoesnotexist")
    })
  })

  test("combines $ARGUMENTS and shell commands", async () => {
    // Create test command file combining both features
    await fs.mkdir(path.join(fixturePath, ".opencode", "commands"), { recursive: true })
    await fs.writeFile(
      path.join(fixturePath, ".opencode", "commands", "combined-test.md"),
      "Arguments: $ARGUMENTS\nDirectory: !`pwd`\nEcho args: !`echo \"$ARGUMENTS\"`"
    )

    await App.provide({ cwd: fixturePath }, async () => {
      const result = await CustomCommands.executeCommand("/combined-test hello world")
      expect(result).toContain("Arguments: hello world")
      expect(result).toContain("Directory:")
      // Note: The shell command won't see $ARGUMENTS as it's already replaced
      expect(result).toContain("Echo args:")
    })
  })

  test("handles multiple shell commands", async () => {
    // Create test command file with multiple shell commands
    await fs.mkdir(path.join(fixturePath, ".opencode", "commands"), { recursive: true })
    await fs.writeFile(
      path.join(fixturePath, ".opencode", "commands", "multiple-test.md"),
      "First: !`echo first`\nSecond: !`echo second`\nThird: !`echo third`"
    )

    await App.provide({ cwd: fixturePath }, async () => {
      const result = await CustomCommands.executeCommand("/multiple-test")
      expect(result).toBe("First: first\nSecond: second\nThird: third")
    })
  })
})