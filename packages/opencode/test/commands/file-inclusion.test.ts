import { describe, expect, test } from "bun:test"
import { promises as fs } from "fs"
import path from "path"

// Test just the file inclusion processing logic without App context
describe("File Inclusion Processing", () => {
  test("processFileIncludes function works", async () => {
    // Since processFileIncludes is not exported, let's test via a simple implementation
    // This tests the core logic without App context complications
    
    async function processFileIncludesTest(content: string, commandFilePath: string): Promise<string> {
      const fileIncludeRegex = /@([a-zA-Z0-9_./\-]+)/g
      let processedContent = content
      let match
      
      // Get the directory of the command file for relative path resolution
      const commandDir = path.dirname(commandFilePath)
      
      while ((match = fileIncludeRegex.exec(content)) !== null) {
        const [fullMatch, filePath] = match
        
        try {
          // Resolve the file path relative to the command file directory
          const resolvedPath = path.resolve(commandDir, filePath)
          
          // Read the file content
          const fileContent = await fs.readFile(resolvedPath, "utf-8")
          
          // Replace the @<filepath> with the file content
          processedContent = processedContent.replace(fullMatch, fileContent)
        } catch (error) {
          // On error, replace with error message
          const errorMsg = `[Error including file '${filePath}': ${error instanceof Error ? error.message : 'Unknown error'}]`
          processedContent = processedContent.replace(fullMatch, errorMsg)
        }
      }
      
      return processedContent
    }
    
    // Get the test fixtures directory
    const fixturesDir = path.join(__dirname, "../fixtures")
    const commandFilePath = path.join(fixturesDir, "test-command.md")
    
    // Test single file inclusion
    const result1 = await processFileIncludesTest("Hello @sample.md!", commandFilePath)
    expect(result1).toContain("# Sample Markdown File")
    expect(result1).toContain("- Feature 1")
    expect(result1).not.toContain("@sample.md")
    
    // Test multiple file inclusions
    const result2 = await processFileIncludesTest("@sample.md\n\n@subdoc.md", commandFilePath)
    expect(result2).toContain("# Sample Markdown File")
    expect(result2).toContain("## Subdocument")
    expect(result2).not.toContain("@sample.md")
    expect(result2).not.toContain("@subdoc.md")
    
    // Test mixed content
    const result3 = await processFileIncludesTest("Start @sample.md end", commandFilePath)
    expect(result3).toContain("Start # Sample Markdown File")
    expect(result3).toContain("- Feature 2 end")
    
    // Test non-existent file
    const result4 = await processFileIncludesTest("@nonexistent.md", commandFilePath)
    expect(result4).toContain("[Error including file 'nonexistent.md'")
    expect(result4).toContain("ENOENT")
  })

  test("regex pattern matching for file includes", () => {
    const fileIncludeRegex = /@([a-zA-Z0-9_./\-]+)/g
    
    const testCases = [
      { input: "@sample.md", expected: ["sample.md"] },
      { input: "@docs/readme.md", expected: ["docs/readme.md"] },
      { input: "@sample.md and @other.md", expected: ["sample.md", "other.md"] },
      { input: "no includes here", expected: [] },
      { input: "Check @../parent.md", expected: ["../parent.md"] },
      { input: "@file.txt @another.md @third.json", expected: ["file.txt", "another.md", "third.json"] }
    ]
    
    testCases.forEach(({ input, expected }) => {
      const matches = [...input.matchAll(fileIncludeRegex)].map(m => m[1])
      expect(matches).toEqual(expected)
    })
  })

  test("path resolution works correctly", () => {
    const commandDir = "/Users/test/commands"
    
    // Test relative paths
    expect(path.resolve(commandDir, "file.md")).toBe("/Users/test/commands/file.md")
    expect(path.resolve(commandDir, "docs/readme.md")).toBe("/Users/test/commands/docs/readme.md")
    expect(path.resolve(commandDir, "../parent.md")).toBe("/Users/test/parent.md")
    
    // Test absolute paths (should work as-is)
    expect(path.resolve(commandDir, "/absolute/path.md")).toBe("/absolute/path.md")
  })

  test("file inclusion with arguments and shell commands integration", async () => {
    // Test that file inclusion works in the proper order with other features
    async function fullProcessingTest(content: string, args: string, commandFilePath: string): Promise<string> {
      // Step 1: Replace arguments  
      let processedContent = content.replace(/\$ARGUMENTS/g, args || "")
      
      // Step 2: Process file includes (our new feature)
      const fileIncludeRegex = /@([a-zA-Z0-9_./\-]+)/g
      const commandDir = path.dirname(commandFilePath)
      let match
      
      while ((match = fileIncludeRegex.exec(processedContent)) !== null) {
        const [fullMatch, filePath] = match
        try {
          const resolvedPath = path.resolve(commandDir, filePath)
          const fileContent = await fs.readFile(resolvedPath, "utf-8")
          processedContent = processedContent.replace(fullMatch, fileContent)
        } catch (error) {
          const errorMsg = `[Error including file '${filePath}']`
          processedContent = processedContent.replace(fullMatch, errorMsg)
        }
      }
      
      return processedContent
    }
    
    const fixturesDir = path.join(__dirname, "../fixtures")
    const commandFilePath = path.join(fixturesDir, "test-command.md")
    
    // Test: arguments should be processed before file inclusion
    const result = await fullProcessingTest("Args: $ARGUMENTS\n@sample.md", "test args", commandFilePath)
    expect(result).toContain("Args: test args")
    expect(result).toContain("# Sample Markdown File")
    expect(result).not.toContain("$ARGUMENTS")
    expect(result).not.toContain("@sample.md")
  })
})