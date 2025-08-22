#!/usr/bin/env bun

// Script to bump version and publish to npm
// Usage: bun run version-and-publish [patch|minor|major]

const dir = new URL("..", import.meta.url).pathname
process.chdir(dir)
import { $ } from "bun"
import pkg from "../package.json"

const versionType = process.argv[2] || "patch"
const validTypes = ["patch", "minor", "major"]

// Show help
if (versionType === "--help" || versionType === "-h") {
  console.log(`
📦 Version and Publish Script

Usage:
  bun run version-and-publish [patch|minor|major]

Examples:
  bun run release              # Bump patch version (0.5.16 → 0.5.17)
  bun run release:minor        # Bump minor version (0.5.16 → 0.6.0)  
  bun run release:major        # Bump major version (0.5.16 → 1.0.0)

What it does:
  1. Increments version in package.json
  2. Runs typecheck to ensure code quality
  3. Publishes to npm with all platform binaries
  4. Creates git commit with version bump
  5. Shows next steps for pushing to git

Current version: ${pkg.version}
`)
  process.exit(0)
}

if (!validTypes.includes(versionType)) {
  console.error(`❌ Invalid version type: ${versionType}`)
  console.error(`✅ Valid types: ${validTypes.join(", ")}`)
  console.error(`💡 Use --help for more information`)
  process.exit(1)
}

function incrementVersion(currentVersion: string, type: string): string {
  const [major, minor, patch] = currentVersion.split(".").map(Number)
  
  switch (type) {
    case "major":
      return `${major + 1}.0.0`
    case "minor":
      return `${major}.${minor + 1}.0`
    case "patch":
      return `${major}.${minor}.${patch + 1}`
    default:
      throw new Error(`Unknown version type: ${type}`)
  }
}

async function main() {
  const currentVersion = pkg.version
  const newVersion = incrementVersion(currentVersion, versionType)
  
  console.log(`📦 Bumping version: ${currentVersion} → ${newVersion} (${versionType})`)
  
  // Update package.json version
  const packageJsonPath = "package.json"
  const packageContent = await Bun.file(packageJsonPath).text()
  const updatedContent = packageContent.replace(
    `"version": "${currentVersion}"`,
    `"version": "${newVersion}"`
  )
  
  await Bun.file(packageJsonPath).write(updatedContent)
  console.log(`✅ Updated package.json version to ${newVersion}`)
  
  // Run typecheck before publishing
  console.log("🔍 Running typecheck...")
  try {
    await $`bun run typecheck`
    console.log("✅ Typecheck passed")
  } catch (error) {
    console.error("❌ Typecheck failed:", error)
    
    // Revert version change
    await Bun.file(packageJsonPath).write(packageContent)
    console.log("🔄 Reverted version change")
    process.exit(1)
  }
  
  // Publish with the new version
  console.log(`🚀 Publishing version ${newVersion}...`)
  
  try {
    await $`OPENCODE_VERSION=${newVersion} bun run script/publish.ts`
    console.log(`🎉 Successfully published ${pkg.name}@${newVersion}`)
    
    // Create git commit with the version bump
    console.log("📝 Creating git commit...")
    await $`git add package.json`
    await $`git commit -m "chore: bump version to ${newVersion}

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"`
    
    console.log("✅ Git commit created")
    console.log(`
🎯 Next steps:
   • Push to git: git push origin dev
   • Test installation: npm install -g ${pkg.name}@${newVersion}
   • Verify: supercode --version
`)
    
  } catch (error) {
    console.error("❌ Publishing failed:", error)
    
    // Revert version change
    await Bun.file(packageJsonPath).write(packageContent)
    console.log("🔄 Reverted version change")
    process.exit(1)
  }
}

main().catch(console.error)