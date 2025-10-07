// This file exists only to verify TypeScript type checking for the CommandExecutionResult fixes
import { CustomCommands } from "../../src/commands/custom"

// Mock test to verify type checking works correctly
async function testTypeChecking() {
  // This would compile correctly if types are right
  const result = await CustomCommands.executeCommand("/test-command")

  // These should now be type-safe after our fixes
  if (result) {
    const content: string = result.content
    const allowedTools: string[] | undefined = result.allowedTools
    const denyTools: string[] | undefined = result.denyTools
    const outputStyle: string | undefined = result.outputStyle

    // Use variables to avoid TS6133 warnings
    console.log({ content, allowedTools, denyTools, outputStyle })
  }

  // This is how the tests should check content (what we fixed)
  if (result?.content) {
    // This should work without type errors
    const containsTest = result.content.includes("test")
    console.log(containsTest)
  }
}

export { testTypeChecking }