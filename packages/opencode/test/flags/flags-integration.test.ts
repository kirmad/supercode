import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { Flags } from "../../src/flags/flags"
import { promises as fs } from "fs"
import path from "path"
import { Instance } from "../../src/project/instance"

const fixturePath = path.join(__dirname, "../fixtures/flags-integration")

describe("Flags Integration Tests", () => {
  beforeEach(async () => {
    // Create test fixture directory structure
    await fs.mkdir(path.join(fixturePath, ".opencode", "flags"), { recursive: true })
    await fs.mkdir(path.join(fixturePath, ".opencode", "flags", "build"), { recursive: true })
    await fs.mkdir(path.join(fixturePath, ".opencode", "flags", "test"), { recursive: true })
    await fs.mkdir(path.join(fixturePath, ".opencode", "flags", "dev"), { recursive: true })
  })

  afterEach(async () => {
    try {
      await fs.rm(fixturePath, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  test("complex scenario with multiple flags and placements", async () => {
    // Create various flags with different configurations
    await fs.writeFile(
      path.join(fixturePath, ".opencode", "flags", "expert.md"),
      `---
description: "Expert developer mode"
placement: "before"
---
You are an expert software developer with 10+ years of experience.`
    )

    await fs.writeFile(
      path.join(fixturePath, ".opencode", "flags", "verbose.md"),
      `---
description: "Verbose explanations"
placement: "replace"
---
with detailed step-by-step explanations`
    )

    await fs.writeFile(
      path.join(fixturePath, ".opencode", "flags", "quality.md"),
      `---
description: "Quality requirements"
placement: "after"
---
Ensure the code follows best practices:
- Use TypeScript
- Add proper error handling
- Include unit tests
- Follow SOLID principles`
    )

    await fs.writeFile(
      path.join(fixturePath, ".opencode", "flags", "build", "optimization.md"),
      `---
description: "Build optimization instructions"
signature: "--build:opt"
placement: "after"
---
Optimize the build:
- Enable tree shaking
- Minimize bundle size
- Use production builds`
    )

    await Instance.provide(fixturePath, async () => {
      const input = "--expert implement --verbose authentication system --quality --build:optimization"
      const result = await Flags.processFlagReferences(input)
      
      const expected = `You are an expert software developer with 10+ years of experience.

implement with detailed step-by-step explanations authentication system

Ensure the code follows best practices:
- Use TypeScript
- Add proper error handling
- Include unit tests
- Follow SOLID principles

Optimize the build:
- Enable tree shaking
- Minimize bundle size
- Use production builds`

      expect(result).toBe(expected)
    })
  })

  test("real-world development workflow flags", async () => {
    // Create flags that might be used in a real development workflow
    await fs.writeFile(
      path.join(fixturePath, ".opencode", "flags", "typescript.md"),
      `---
description: "Use TypeScript"
placement: "after"
---
Use TypeScript with strict mode enabled.`
    )

    await fs.writeFile(
      path.join(fixturePath, ".opencode", "flags", "test", "unit.md"),
      `---
description: "Include unit tests"
placement: "after"
---
Include comprehensive unit tests using Jest or similar testing framework.`
    )

    await fs.writeFile(
      path.join(fixturePath, ".opencode", "flags", "dev", "hot-reload.md"),
      `---
description: "Enable hot reloading"
placement: "after"
---
Set up hot reloading for development.`
    )

    await Instance.provide(fixturePath, async () => {
      const input = "Create a React component --typescript --test:unit --dev:hot-reload"
      const result = await Flags.processFlagReferences(input)
      
      expect(result).toContain("Create a React component")
      expect(result).toContain("Use TypeScript with strict mode enabled.")
      expect(result).toContain("Include comprehensive unit tests using Jest")
      expect(result).toContain("Set up hot reloading for development.")
    })
  })

  test("flags with file includes and shell commands", async () => {
    // Create supporting files
    await fs.writeFile(
      path.join(fixturePath, ".opencode", "flags", "project-info.txt"),
      "Project: My Awesome App\nVersion: 1.0.0"
    )

    await fs.writeFile(
      path.join(fixturePath, ".opencode", "flags", "context.md"),
      `---
description: "Project context"
placement: "before"
---
Project Information:
@project-info.txt

Current timestamp: !\`date +%Y-%m-%d\`

Environment: !\`echo $NODE_ENV\`
`
    )

    await fs.writeFile(
      path.join(fixturePath, ".opencode", "flags", "summary.md"),
      `---
description: "Add summary"
placement: "after"
---
Working directory: !\`pwd\`
File count: !\`find . -type f | wc -l\``
    )

    await Instance.provide(fixturePath, async () => {
      const input = "--context create new feature --summary"
      const result = await Flags.processFlagReferences(input)
      
      expect(result).toContain("Project Information:")
      expect(result).toContain("Project: My Awesome App")
      expect(result).toContain("Version: 1.0.0")
      expect(result).toContain("create new feature")
      expect(result).toContain("Working directory:")
      expect(result).toContain("File count:")
    })
  })

  test("error handling in complex scenarios", async () => {
    // Create flags with various error conditions
    await fs.writeFile(
      path.join(fixturePath, ".opencode", "flags", "good.md"),
      "This works fine."
    )

    await fs.writeFile(
      path.join(fixturePath, ".opencode", "flags", "bad-include.md"),
      "Include: @nonexistent-file.txt"
    )

    await fs.writeFile(
      path.join(fixturePath, ".opencode", "flags", "bad-command.md"),
      "Command: !`invalidcommandthatdoesnotexist`"
    )

    await Instance.provide(fixturePath, async () => {
      const input = "--good implement --bad-include auth --bad-command --nonexistent"
      const result = await Flags.processFlagReferences(input)
      
      // Should process the good flag
      expect(result).toContain("This works fine.")
      
      // Should handle missing file gracefully
      expect(result).toContain("[Error including file 'nonexistent-file.txt':")
      
      // Should handle bad shell command gracefully
      expect(result).toContain("[Error executing 'invalidcommandthatdoesnotexist':")
      
      // Should leave nonexistent flag as-is
      expect(result).toContain("--nonexistent")
    })
  })

  test("hierarchical namespace support", async () => {
    // Create nested namespace structure
    await fs.mkdir(path.join(fixturePath, ".opencode", "flags", "build", "webpack"), { recursive: true })
    await fs.mkdir(path.join(fixturePath, ".opencode", "flags", "test", "e2e"), { recursive: true })

    await fs.writeFile(
      path.join(fixturePath, ".opencode", "flags", "build", "webpack", "dev.md"),
      `---
description: "Webpack dev configuration"
---
Configure Webpack for development with source maps and hot reloading.`
    )

    await fs.writeFile(
      path.join(fixturePath, ".opencode", "flags", "test", "e2e", "cypress.md"),
      `---
description: "Cypress E2E tests"
---
Set up Cypress for end-to-end testing.`
    )

    await Instance.provide(fixturePath, async () => {
      const input = "Setup project --build:webpack:dev --test:e2e:cypress"
      const result = await Flags.processFlagReferences(input)
      
      expect(result).toContain("Setup project")
      expect(result).toContain("Configure Webpack for development")
      expect(result).toContain("Set up Cypress for end-to-end testing")
    })
  })

  test("flag precedence and ordering", async () => {
    await fs.writeFile(
      path.join(fixturePath, ".opencode", "flags", "before1.md"),
      `---
placement: "before"
---
Before 1`
    )

    await fs.writeFile(
      path.join(fixturePath, ".opencode", "flags", "before2.md"),
      `---
placement: "before"
---
Before 2`
    )

    await fs.writeFile(
      path.join(fixturePath, ".opencode", "flags", "after1.md"),
      `---
placement: "after"
---
After 1`
    )

    await fs.writeFile(
      path.join(fixturePath, ".opencode", "flags", "after2.md"),
      `---
placement: "after"
---
After 2`
    )

    await Instance.provide(fixturePath, async () => {
      const input = "--before2 --before1 main content --after1 --after2"
      const result = await Flags.processFlagReferences(input)
      
      // Before flags should appear in reverse order (to maintain logical flow)
      expect(result).toBe("Before 2\n\nBefore 1\n\nmain content\n\nAfter 1\n\nAfter 2")
    })
  })

  test("mixed single and multi-word flags", async () => {
    await fs.writeFile(
      path.join(fixturePath, ".opencode", "flags", "v.md"),
      "Short verbose flag"
    )

    await fs.writeFile(
      path.join(fixturePath, ".opencode", "flags", "verbose-mode.md"),
      "Long verbose mode flag"
    )

    await fs.writeFile(
      path.join(fixturePath, ".opencode", "flags", "build", "prod-optimized.md"),
      "Production optimized build"
    )

    await Instance.provide(fixturePath, async () => {
      const input = "Build --v --verbose-mode --build:prod-optimized"
      const result = await Flags.processFlagReferences(input)
      
      expect(result).toContain("Build")
      expect(result).toContain("Short verbose flag")
      expect(result).toContain("Long verbose mode flag")
      expect(result).toContain("Production optimized build")
    })
  })
})