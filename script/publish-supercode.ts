#!/usr/bin/env bun

import { $ } from "bun"

console.log("=== Publishing Supercode ===\n")

const snapshot = process.env["OPENCODE_SNAPSHOT"] === "true"
const version = snapshot
  ? `0.0.0-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}`
  : process.env["OPENCODE_VERSION"]
if (!version) {
  throw new Error("OPENCODE_VERSION is required")
}
process.env["OPENCODE_VERSION"] = version
console.log("Version:", version)

// Update all package.json files with the new version
const pkgjsons = await Array.fromAsync(
  new Bun.Glob("**/package.json").scan({
    absolute: true,
  }),
).then((arr) => arr.filter((x) => !x.includes("node_modules") && !x.includes("dist")))

const tree = await $`git add . && git write-tree`.text().then((x) => x.trim())
for (const file of pkgjsons) {
  let pkg = await Bun.file(file).text()
  pkg = pkg.replaceAll(/"version": "[^"]+"/g, `"version": "${version}"`)
  console.log("Updated:", file)
  await Bun.file(file).write(pkg)
}
await $`bun install`

console.log("\n=== Building Supercode ===\n")

// Build and publish platform-specific packages
await import(`../packages/opencode/script/publish-supercode.ts`)

const dir = new URL("..", import.meta.url).pathname
process.chdir(dir)

if (!snapshot) {
  // Commit and tag
  await $`git commit -am "release: v${version}"`
  await $`git tag v${version}`
  await $`git fetch origin`
  
  // Try to merge any upstream changes
  await $`git cherry-pick HEAD..origin/dev`.nothrow()
  
  // Push to origin
  await $`git push origin HEAD --tags --no-verify --force`

  // Get previous release for changelog
  const previous = await fetch("https://api.github.com/repos/kirmad/supercode/releases/latest")
    .then((res) => {
      if (!res.ok) return null
      return res.json()
    })
    .then((data) => data?.tag_name || null)

  let notes = "## What's Changed\n\n"
  
  if (previous) {
    console.log("Finding commits between", previous, "and HEAD")
    const commits = await fetch(`https://api.github.com/repos/kirmad/supercode/compare/${previous}...HEAD`)
      .then((res) => res.json())
      .then((data) => data.commits || [])

    const raw = commits.map((commit: any) => `- ${commit.commit.message.split("\n").join(" ")}`)
    console.log(raw)

    notes += raw
      .filter((x: string) => {
        const lower = x.toLowerCase()
        return (
          !lower.includes("release:") &&
          !lower.includes("ignore:") &&
          !lower.includes("chore:") &&
          !lower.includes("ci:") &&
          !lower.includes("wip:") &&
          !lower.includes("docs:") &&
          !lower.includes("doc:")
        )
      })
      .join("\n") || "- Various improvements and bug fixes"
  } else {
    notes += "First release of Supercode!\n\n"
    notes += "- Fork of OpenCode with enhanced features\n"
    notes += "- Auto-update functionality\n"
    notes += "- Multi-platform support\n"
  }

  notes += "\n\n## Installation\n\n"
  notes += "```bash\n"
  notes += "npm install -g @kirmad/supercode\n"
  notes += "# or\n"
  notes += "bun install -g @kirmad/supercode\n"
  notes += "```\n"

  // Create GitHub release
  await $`gh release create v${version} --title "v${version}" --notes ${notes} ./packages/opencode/dist/*.zip`
}

if (snapshot) {
  // Handle snapshot releases
  await $`git checkout -b snapshot-${version}`
  await $`git commit --allow-empty -m "Snapshot release v${version}"`
  await $`git tag v${version}`
  await $`git push origin v${version} --no-verify`
  await $`git checkout dev`
  await $`git branch -D snapshot-${version}`
  
  // Restore original package.json files
  for (const file of pkgjsons) {
    await $`git checkout ${tree} ${file}`
  }
}

console.log("\n=== Supercode Published Successfully! ===")