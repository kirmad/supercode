import fs from "fs/promises"
import path from "path"
import { Log } from "../util/log"

const log = Log.create({ service: "template-finder" })

/**
 * Template finder system - locates HTML template files in both development and production
 * Based on the seed system pattern for robust asset discovery
 */
export namespace TemplateFinder {
  
  /**
   * Find a specific asset directory (templates, static, etc.) in the project or package installation
   */
  export async function findAssetDirectory(assetType: string): Promise<string | null> {
    // For compiled binaries, we need special handling
    try {
      const possiblePaths: string[] = []

      // Platform packages that might contain our assets
      const platformPackages = [
        "supercode-darwin-arm64",
        "supercode-linux-x64",
        "supercode-linux-arm64",
        "supercode-windows-x64",
        "supercode-darwin-x64",
        "supercode-darwin-x64-baseline",
        "supercode-linux-x64-baseline"
      ]

      // Method 1: Use process.execPath (most reliable for actual executable location)
      // This gives us the path to the actual executable (e.g., C:\CustomPath\supercode.exe)
      if (process.execPath) {
        const execPath = process.execPath
        const execDir = path.dirname(execPath)

        log.debug("using process.execPath for binary location", { execPath, execDir })

        for (const pkg of platformPackages) {
          // Search patterns relative to the executable
          possiblePaths.push(
            // Direct in same directory
            path.join(execDir, assetType),
            // Direct node_modules relative to binary
            path.join(execDir, "node_modules", "@kirmad", pkg, assetType),
            path.join(execDir, "node_modules", "@kirmad", "supercode", "node_modules", "@kirmad", pkg, assetType),
            // One level up (common for bin directories)
            path.join(execDir, "..", assetType),
            path.join(execDir, "..", "node_modules", "@kirmad", pkg, assetType),
            path.join(execDir, "..", "node_modules", "@kirmad", "supercode", "node_modules", "@kirmad", pkg, assetType),
            // Two levels up (for nested bin directories)
            path.join(execDir, "..", "..", assetType),
            path.join(execDir, "..", "..", "node_modules", "@kirmad", pkg, assetType),
            path.join(execDir, "..", "..", "node_modules", "@kirmad", "supercode", "node_modules", "@kirmad", pkg, assetType)
          )
        }
      }

      // Method 2: Use process.argv[0] as fallback (might be the runtime or wrapper)
      if (process.argv[0] && process.argv[0] !== process.execPath) {
        const argvPath = process.argv[0]
        const argvDir = path.dirname(argvPath)

        log.debug("using process.argv[0] as additional search location", { argvPath, argvDir })

        for (const pkg of platformPackages) {
          possiblePaths.push(
            path.join(argvDir, "node_modules", "@kirmad", pkg, assetType),
            path.join(argvDir, "node_modules", "@kirmad", "supercode", "node_modules", "@kirmad", pkg, assetType),
            path.join(argvDir, "..", "node_modules", "@kirmad", pkg, assetType),
            path.join(argvDir, "..", "node_modules", "@kirmad", "supercode", "node_modules", "@kirmad", pkg, assetType),
            path.join(argvDir, "..", "..", "node_modules", "@kirmad", pkg, assetType),
            path.join(argvDir, "..", "..", "node_modules", "@kirmad", "supercode", "node_modules", "@kirmad", pkg, assetType)
          )
        }
      }

      // Method 3: Search from current working directory
      const cwd = process.cwd()
      log.debug("searching from current working directory", { cwd })

      // Search in current directory and up to 3 parent directories
      let searchDir = cwd
      for (let i = 0; i < 4; i++) {
        for (const pkg of platformPackages) {
          possiblePaths.push(
            path.join(searchDir, "node_modules", "@kirmad", pkg, assetType),
            path.join(searchDir, "node_modules", "@kirmad", "supercode", "node_modules", "@kirmad", pkg, assetType)
          )
        }
        const parentDir = path.dirname(searchDir)
        if (parentDir === searchDir) break // Reached root
        searchDir = parentDir
      }

      // Method 4: Windows-specific global locations
      if (process.platform === "win32") {
        // Try APPDATA location
        const appData = process.env["APPDATA"]
        if (appData) {
          log.debug("searching Windows APPDATA location", { appData })
          for (const pkg of platformPackages) {
            possiblePaths.push(
              path.join(appData, "npm", "node_modules", "@kirmad", pkg, assetType),
              path.join(appData, "npm", "node_modules", "@kirmad", "supercode", "node_modules", "@kirmad", pkg, assetType)
            )
          }
        }

        // Try PROGRAMFILES locations
        const programFiles = process.env["PROGRAMFILES"]
        if (programFiles) {
          log.debug("searching Windows PROGRAMFILES location", { programFiles })
          for (const pkg of platformPackages) {
            possiblePaths.push(
              path.join(programFiles, "nodejs", "node_modules", "@kirmad", pkg, assetType),
              path.join(programFiles, "nodejs", "node_modules", "@kirmad", "supercode", "node_modules", "@kirmad", pkg, assetType)
            )
          }
        }
      }
      
      // Method 5: Use import.meta.url (works for development)
      try {
        const scriptPath = new URL(import.meta.url).pathname
        const scriptDir = path.dirname(scriptPath)

        // Skip if it's a virtual Bun filesystem path
        if (!scriptPath.includes('$bunfs')) {
          log.debug("searching based on script location", { scriptPath, scriptDir })
          possiblePaths.push(
            path.join(scriptDir, assetType),           // Same directory as template-finder.ts
            path.join(scriptDir, "..", "server", assetType), // Development path from src/
            path.join(scriptDir, "..", "..", assetType), // Alternative
          )
        }
      } catch (error) {
        log.debug("import.meta.url not available", { error: error instanceof Error ? error.message : error })
      }

      // Log all paths we're about to search (with better formatting)
      log.debug("searching for assets", {
        assetType,
        totalPaths: possiblePaths.length,
        execPath: process.execPath,
        argv0: process.argv[0],
        cwd: process.cwd(),
        platform: process.platform,
        arch: process.arch
      })
      
      // Store all valid paths with their modification times to find the most recent
      const validPaths: Array<{ path: string; mtime: Date }> = []

      // Remove duplicates and resolve paths
      const uniquePaths = [...new Set(possiblePaths.map(p => path.resolve(p)))]

      log.debug("checking unique paths", {
        uniquePathCount: uniquePaths.length,
        first10Paths: uniquePaths.slice(0, 10)
      })

      for (const assetPath of uniquePaths) {
        try {
          const stats = await fs.stat(assetPath)
          if (stats.isDirectory()) {
            validPaths.push({ path: assetPath, mtime: stats.mtime })
            log.info("✅ FOUND asset folder", { assetType, path: assetPath, mtime: stats.mtime })
          }
        } catch (error) {
          // Only log verbose debug for first few failures to avoid spam
          if (uniquePaths.indexOf(assetPath) < 5) {
            log.debug("path not found", {
              assetPath,
              error: error instanceof Error ? error.message : "Unknown error"
            })
          }
        }
      }
      
      // Return the most recently modified asset directory (likely the latest version)
      if (validPaths.length > 0) {
        const mostRecent = validPaths.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())[0]
        log.info("found asset folder in package", { assetType, path: mostRecent.path, mtime: mostRecent.mtime, totalFound: validPaths.length })
        return mostRecent.path
      }
    } catch (error) {
      log.debug("error in package asset search", { error })
    }
    
    // Fall back to searching upward from current directory (for development)
    let currentDir = process.cwd()
    
    for (let i = 0; i < 5; i++) { // Limit search depth
      // Try multiple common asset locations
      const assetPaths = [
        path.join(currentDir, "packages", "opencode", "src", "server", assetType),
        path.join(currentDir, "src", "server", assetType),
        path.join(currentDir, assetType)
      ]
      
      for (const assetPath of assetPaths) {
        try {
          const stats = await fs.stat(assetPath)
          if (stats.isDirectory()) {
            log.info("found asset folder in project", { assetType, path: assetPath })
            return assetPath
          }
        } catch {
          // Directory doesn't exist, continue searching
        }
      }
      
      const parentDir = path.dirname(currentDir)
      if (parentDir === currentDir) break // Reached root
      currentDir = parentDir
    }
    
    return null
  }
  
  /**
   * Find the templates directory
   */
  export async function findTemplatesDirectory(): Promise<string | null> {
    return findAssetDirectory("templates")
  }
  
  /**
   * Find the static directory
   */
  export async function findStaticDirectory(): Promise<string | null> {
    return findAssetDirectory("static")
  }
  
  /**
   * Get the path to a specific file within an asset directory
   */
  export async function getAssetPath(assetType: string, fileName: string): Promise<string | null> {
    const assetDir = await findAssetDirectory(assetType)
    if (!assetDir) {
      log.error("asset directory not found", { assetType })
      return null
    }
    
    const filePath = path.join(assetDir, fileName)
    
    try {
      await fs.access(filePath)
      return filePath
    } catch {
      log.error("asset file not found", { filePath, fileName, assetType })
      return null
    }
  }
  
  /**
   * Get the path to a specific template file
   */
  export async function getTemplatePath(templateName: string): Promise<string | null> {
    return getAssetPath("templates", templateName)
  }
  
  /**
   * Get the path to a specific static file
   */
  export async function getStaticPath(fileName: string): Promise<string | null> {
    return getAssetPath("static", fileName)
  }
  
  /**
   * Read an asset file with error handling
   */
  export async function readAsset(assetType: string, fileName: string): Promise<string | null> {
    const filePath = await getAssetPath(assetType, fileName)
    if (!filePath) {
      return null
    }
    
    try {
      const content = await fs.readFile(filePath, "utf-8")
      log.debug("asset read successfully", { fileName, assetType, filePath })
      return content
    } catch (error) {
      log.error("failed to read asset", { fileName, assetType, filePath, error })
      return null
    }
  }
  
  /**
   * Read a template file with error handling
   */
  export async function readTemplate(templateName: string): Promise<string | null> {
    return readAsset("templates", templateName)
  }
  
  /**
   * Read a static file with error handling
   */
  export async function readStatic(fileName: string): Promise<string | null> {
    return readAsset("static", fileName)
  }
}