#!/usr/bin/env node

// Cross-platform Node.js wrapper for supercode binary
// This enables proper npm global installation on Windows

import { execFileSync } from "child_process"
import { createRequire } from "module"
import fs from "fs"
import path from "path"
import os from "os"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

function detectPlatformAndArch() {
  // Map platform names
  let platform
  switch (os.platform()) {
    case "darwin":
      platform = "darwin"
      break
    case "linux":
      platform = "linux"
      break
    case "win32":
      platform = "windows"
      break
    default:
      platform = os.platform()
      break
  }

  // Map architecture names
  let arch
  switch (os.arch()) {
    case "x64":
      arch = "x64"
      break
    case "arm64":
      arch = "arm64"
      break
    case "arm":
      arch = "arm"
      break
    default:
      arch = os.arch()
      break
  }

  return { platform, arch }
}

function findBinary() {
  // Check for explicit environment variable
  if (process.env.OPENCODE_BIN_PATH) {
    if (fs.existsSync(process.env.OPENCODE_BIN_PATH)) {
      return process.env.OPENCODE_BIN_PATH
    }
  }

  const { platform, arch } = detectPlatformAndArch()
  const packageName = `@kirmad/supercode-${platform}-${arch}`
  const binary = platform === "windows" ? "supercode.exe" : "supercode"

  try {
    // Use require.resolve to find the package
    const packageJsonPath = require.resolve(`${packageName}/package.json`)
    const packageDir = path.dirname(packageJsonPath)
    const binaryPath = path.join(packageDir, "bin", binary)

    if (!fs.existsSync(binaryPath)) {
      throw new Error(`Binary not found at ${binaryPath}`)
    }

    return binaryPath
  } catch (error) {
    console.error(`It seems that your package manager failed to install the right version of the supercode CLI for your platform. You can try manually installing the "${packageName}" package`)
    process.exit(1)
  }
}

function main() {
  try {
    const binaryPath = findBinary()
    
    // Execute the binary with all arguments, inheriting stdio
    const result = execFileSync(binaryPath, process.argv.slice(2), {
      stdio: "inherit",
      windowsHide: false
    })
    
    process.exit(0)
  } catch (error) {
    if (error.code === "ENOENT") {
      console.error("supercode binary not found. Please reinstall the package.")
      process.exit(1)
    } else if (error.status !== undefined) {
      // Exit with the same code as the binary
      process.exit(error.status)
    } else {
      console.error("Failed to execute supercode:", error.message)
      process.exit(1)
    }
  }
}

main()