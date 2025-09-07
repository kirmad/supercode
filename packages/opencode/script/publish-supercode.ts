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
  
  // Rename binary for Windows
  if (os === "windows") {
    await $`mv dist/${name}/bin/supercode dist/${name}/bin/supercode.exe`
  }
  
  // Publish platform package to npm
  if (!dry) {
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
  await $`cd ./dist/@kirmad/supercode && npm publish --access public --tag ${npmTag}`
}

// Create zip files for GitHub release
if (!snapshot) {
  for (const key of Object.keys(optionalDependencies)) {
    const zipName = key.replace(/^@[^/]+\//, '')
    const [, , os] = key.split('-')
    const binName = os === "windows" ? "supercode.exe" : "supercode"
    await $`cd dist/${key}/bin && zip -r ../../../${zipName}.zip ${binName}`
  }
}

console.log("Supercode packages published successfully!")