#!/usr/bin/env bun

const dir = new URL("..", import.meta.url).pathname
process.chdir(dir)
import { $ } from "bun"

const dry = process.env["OPENCODE_DRY"] === "true"
const version = process.env["OPENCODE_VERSION"]!
const snapshot = process.env["OPENCODE_SNAPSHOT"] === "true"

console.log(`Publishing @kirmad/supercode ${version}`)

const GOARCH: Record<string, string> = {
  arm64: "arm64",
  x64: "amd64",
  "x64-baseline": "amd64",
}

const targets = [
  ["windows", "x64"],
  ["linux", "arm64"],
  ["linux", "x64"],
  ["linux", "x64-baseline"],
  ["darwin", "x64"],
  ["darwin", "x64-baseline"],
  ["darwin", "arm64"],
]

await $`rm -rf dist`

const optionalDependencies: Record<string, string> = {}
const npmTag = snapshot ? "snapshot" : "latest"

// Check for npm authentication
const homeNpmrc = `${process.env["HOME"]}/.npmrc`
const hasHomeNpmrc = await Bun.file(homeNpmrc).exists()

// First publish SDK and plugin packages so they're available as dependencies
console.log("Publishing SDK and plugin packages first...")
// Skip SDK/plugin publishing if they already exist
const skipSdkPlugin = process.env["SKIP_SDK_PLUGIN"] === "true"
if (!dry && !skipSdkPlugin) {
  // Publish SDK - copy to temp directory to avoid workspace config issues
  console.log("Publishing @kirmad/supercode-sdk")
  await $`mkdir -p ./dist/@kirmad/supercode-sdk-temp`
  await $`cp -r ../sdk/js/* ./dist/@kirmad/supercode-sdk-temp/`
  // Copy npmrc if it exists, otherwise create from env var
  if (hasHomeNpmrc) {
    await $`cp ${homeNpmrc} ./dist/@kirmad/supercode-sdk-temp/.npmrc`
  } else if (process.env["NPM_CONFIG_TOKEN"] || process.env["NPM_TOKEN"]) {
    await $`cd ./dist/@kirmad/supercode-sdk-temp && echo "//registry.npmjs.org/:_authToken=${process.env["NPM_CONFIG_TOKEN"] || process.env["NPM_TOKEN"]}" > .npmrc`
  }
  await $`cd ./dist/@kirmad/supercode-sdk-temp && npm publish --access public --tag ${npmTag}`
  
  // Publish plugin - copy to temp directory to avoid workspace config issues  
  console.log("Publishing @kirmad/supercode-plugin")
  await $`mkdir -p ./dist/@kirmad/supercode-plugin-temp`
  await $`cp -r ../plugin/* ./dist/@kirmad/supercode-plugin-temp/`
  if (hasHomeNpmrc) {
    await $`cp ${homeNpmrc} ./dist/@kirmad/supercode-plugin-temp/.npmrc`
  } else if (process.env["NPM_CONFIG_TOKEN"] || process.env["NPM_TOKEN"]) {
    await $`cd ./dist/@kirmad/supercode-plugin-temp && echo "//registry.npmjs.org/:_authToken=${process.env["NPM_CONFIG_TOKEN"] || process.env["NPM_TOKEN"]}" > .npmrc`
  }
  await $`cd ./dist/@kirmad/supercode-plugin-temp && npm publish --access public --tag ${npmTag}`
}

for (const [os, arch] of targets) {
  console.log(`Building ${os}-${arch}`)
  const name = `@kirmad/supercode-${os}-${arch}`
  await $`mkdir -p dist/${name}/bin`
  
  // Build TUI
  await $`CGO_ENABLED=0 GOOS=${os} GOARCH=${GOARCH[arch]} go build -ldflags="-s -w -X main.Version=${version}" -o ../opencode/dist/${name}/bin/tui ../tui/cmd/opencode/main.go`.cwd(
    "../tui",
  )
  
  // Build supercode binary with embedded TUI
  await $`bun build --define OPENCODE_TUI_PATH="'../../../dist/${name}/bin/tui'" --define OPENCODE_VERSION="'${version}'" --compile --target=bun-${os}-${arch} --outfile=dist/${name}/bin/supercode ./src/index.ts`
  
  // Run smoke test if it matches current platform
  if (
    process.platform === (os === "windows" ? "win32" : os) &&
    (process.arch === arch || (process.arch === "x64" && arch === "x64-baseline"))
  ) {
    console.log(`Smoke test: running dist/${name}/bin/supercode --version`)
    await $`./dist/${name}/bin/supercode --version`
  }
  
  // Remove TUI binary (it's embedded now)
  await $`rm -rf ./dist/${name}/bin/tui`
  
  // Copy necessary assets
  await $`cp -r ./seeds ./dist/${name}/seeds 2>/dev/null || true`
  await $`cp -r ./src/server/templates ./dist/${name}/templates 2>/dev/null || true`
  await $`cp -r ./src/server/static ./dist/${name}/static 2>/dev/null || true`
  
  // Create package.json for platform package
  await Bun.file(`dist/${name}/package.json`).write(
    JSON.stringify(
      {
        name,
        version,
        description: `Supercode platform binary for ${os}-${arch}`,
        os: [os === "windows" ? "win32" : os],
        cpu: [arch],
        bin: {
          supercode: os === "windows" ? "./bin/supercode.exe" : "./bin/supercode"
        },
        publishConfig: {
          access: "public"
        }
      },
      null,
      2,
    ),
  )
  
  // Check if Windows binary needs renaming (Bun might have already added .exe)
  if (os === "windows") {
    const exeExists = await $`test -f dist/${name}/bin/supercode.exe`.nothrow()
    const binExists = await $`test -f dist/${name}/bin/supercode`.nothrow()
    
    if (binExists.exitCode === 0 && exeExists.exitCode !== 0) {
      await $`mv dist/${name}/bin/supercode dist/${name}/bin/supercode.exe`
    }
  }
  
  // Publish platform package to npm
  if (!dry) {
    // Configure npm authentication - copy from home or use env var
    if (hasHomeNpmrc) {
      await $`cp ${homeNpmrc} dist/${name}/.npmrc`
    } else if (process.env["NPM_CONFIG_TOKEN"] || process.env["NPM_TOKEN"]) {
      await $`cd dist/${name} && echo "//registry.npmjs.org/:_authToken=${process.env["NPM_CONFIG_TOKEN"] || process.env["NPM_TOKEN"]}" > .npmrc`
    }
    await $`cd dist/${name} && chmod -R 755 . && npm publish --access public --tag ${npmTag}`
  }
  
  optionalDependencies[name] = version
}

// Create main package
await $`mkdir -p ./dist/@kirmad/supercode`
await $`cp -r ./bin ./dist/@kirmad/supercode/bin`

// Create postinstall script
await Bun.file(`./dist/@kirmad/supercode/postinstall.mjs`).write(`#!/usr/bin/env node
import { platform, arch } from 'os';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const os = platform() === 'win32' ? 'windows' : platform();
const architecture = arch() === 'x64' ? 'x64' : 'arm64';
const packageName = \`@kirmad/supercode-\${os}-\${architecture}\`;

console.log(\`Installing platform-specific binary: \${packageName}\`);

try {
  const binPath = join(process.cwd(), 'node_modules', packageName, 'bin', os === 'windows' ? 'supercode.exe' : 'supercode');
  if (!existsSync(binPath)) {
    execSync(\`npm install \${packageName}@\${process.env.npm_package_version}\`, { stdio: 'inherit' });
  }
} catch (error) {
  console.error('Failed to install platform-specific binary:', error.message);
  process.exit(1);
}
`)

// Create main package.json
await Bun.file(`./dist/@kirmad/supercode/package.json`).write(
  JSON.stringify(
    {
      name: "@kirmad/supercode",
      version,
      description: "Supercode - The AI coding agent built for the terminal",
      bin: {
        "supercode": "./bin/supercode.js",
      },
      scripts: {
        postinstall: "node ./postinstall.mjs",
      },
      optionalDependencies,
      keywords: ["ai", "coding", "assistant", "terminal", "cli", "opencode", "supercode"],
      author: "kirmad",
      license: "MIT",
      repository: {
        type: "git",
        url: "https://github.com/kirmad/supercode.git"
      },
      bugs: {
        url: "https://github.com/kirmad/supercode/issues"
      },
      homepage: "https://github.com/kirmad/supercode",
      publishConfig: {
        access: "public"
      }
    },
    null,
    2,
  ),
)

// Publish main package
if (!dry) {
  // Configure npm authentication - copy from home or use env var
  if (hasHomeNpmrc) {
    await $`cp ${homeNpmrc} ./dist/@kirmad/supercode/.npmrc`
  } else if (process.env["NPM_CONFIG_TOKEN"] || process.env["NPM_TOKEN"]) {
    await $`cd ./dist/@kirmad/supercode && echo "//registry.npmjs.org/:_authToken=${process.env["NPM_CONFIG_TOKEN"] || process.env["NPM_TOKEN"]}" > .npmrc`
  }
  await $`cd ./dist/@kirmad/supercode && npm publish --access public --tag ${npmTag}`
}

// Create zip files for GitHub release
if (!snapshot) {
  const zipFiles: string[] = []
  
  for (const key of Object.keys(optionalDependencies)) {
    const zipName = key.replace(/^@[^/]+\//, '')
    const [, os] = key.split('-')  // Fixed: os is at index 1, not 2
    const binName = os === "windows" ? "supercode.exe" : "supercode"
    
    console.log(`Creating ${zipName}.zip from ${key}/bin - looking for ${binName} (os: ${os})`)
    await $`cd dist/${key}/bin && zip -r ../../../${zipName}.zip ${binName}`
    zipFiles.push(`../../${zipName}.zip`)
  }

  // Create GitHub release with zip files
  if (!dry && zipFiles.length > 0) {
    console.log(`Creating GitHub release v${version} with ${zipFiles.length} assets`)
    
    try {
      // Create the release
      await $`gh release create v${version} --title "v${version}" --notes "Release v${version}" --repo kirmad/supercode`
      
      // Upload all zip files as assets
      for (const zipFile of zipFiles) {
        console.log(`Uploading ${zipFile} to release`)
        await $`gh release upload v${version} ${zipFile} --repo kirmad/supercode --clobber`
      }
      
      console.log(`GitHub release v${version} created successfully with ${zipFiles.length} assets`)
    } catch (error) {
      console.error("Failed to create GitHub release:", error)
      // Don't fail the entire publish if release creation fails
    }
  }
}

console.log("Supercode packages published successfully!")