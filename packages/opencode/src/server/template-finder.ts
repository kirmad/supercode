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
      
      // Method 1: Detect compiled Bun binary by checking argv[0] and virtual filesystem
      const isCompiledBun = process.argv[0] === 'bun' || 
                           (import.meta.url && import.meta.url.includes('$bunfs'))
      
      if (isCompiledBun) {
        // For compiled Bun binaries, try to find templates relative to where the binary likely is
        // The binary is usually installed in node_modules/@kirmad/supercode-platform/bin/
        // We need to look for the templates folder at node_modules/@kirmad/supercode-platform/templates/

        const platformPackages = [
          "supercode-darwin-arm64",
          "supercode-linux-x64",
          "supercode-linux-arm64",
          "supercode-windows-x64",
          "supercode-darwin-x64",
          "supercode-darwin-x64-baseline",
          "supercode-linux-x64-baseline"
        ]

        // First try to use the actual binary location if available
        if (process.argv[0]) {
          const binaryPath = process.argv[0]
          const binaryDir = path.dirname(binaryPath)

          // Search relative to the binary location
          for (const pkg of platformPackages) {
            // Direct installation relative to binary
            possiblePaths.push(
              path.join(binaryDir, "node_modules", "@kirmad", pkg, assetType),
              path.join(binaryDir, "node_modules", "@kirmad", "supercode", "node_modules", "@kirmad", pkg, assetType),
              // One level up from binary (common for global installs)
              path.join(binaryDir, "..", "node_modules", "@kirmad", pkg, assetType),
              path.join(binaryDir, "..", "node_modules", "@kirmad", "supercode", "node_modules", "@kirmad", pkg, assetType),
              // Two levels up (for bin directories)
              path.join(binaryDir, "..", "..", "node_modules", "@kirmad", pkg, assetType),
              path.join(binaryDir, "..", "..", "node_modules", "@kirmad", "supercode", "node_modules", "@kirmad", pkg, assetType)
            )
          }
        }

        // Also search from current working directory as fallback
        const cwd = process.cwd()

        // Search in current directory and up to 3 parent directories
        let searchDir = cwd
        for (let i = 0; i < 4; i++) {
          for (const pkg of platformPackages) {
            possiblePaths.push(path.join(searchDir, "node_modules", "@kirmad", pkg, assetType))
          }
          const parentDir = path.dirname(searchDir)
          if (parentDir === searchDir) break // Reached root
          searchDir = parentDir
        }
        
        // Also try some common global locations and Windows-specific paths
        possiblePaths.push(
          path.join(cwd, "..", "..", assetType), // From global bin directory
          path.join(cwd, "..", assetType),       // Alternative global structure
        )
        
        // Windows-specific: try to find templates relative to the wrapper script location
        // On Windows, global packages are often in %APPDATA%\npm\node_modules
        if (process.platform === "win32") {
          const appData = process.env["APPDATA"]
          if (appData) {
            for (const pkg of platformPackages) {
              // Direct installation in global node_modules
              possiblePaths.push(path.join(appData, "npm", "node_modules", "@kirmad", pkg, assetType))
              
              // Nested installation inside main package (common pattern)
              possiblePaths.push(path.join(appData, "npm", "node_modules", "@kirmad", "supercode", "node_modules", "@kirmad", pkg, assetType))
            }
          }
          
          // Also try relative to where npm global binaries are installed
          const npmGlobalBin = path.dirname(process.execPath)
          for (const pkg of platformPackages) {
            possiblePaths.push(
              path.join(npmGlobalBin, "..", "node_modules", "@kirmad", pkg, assetType),
              path.join(npmGlobalBin, "node_modules", "@kirmad", pkg, assetType),
              // Nested pattern
              path.join(npmGlobalBin, "..", "node_modules", "@kirmad", "supercode", "node_modules", "@kirmad", pkg, assetType),
              path.join(npmGlobalBin, "node_modules", "@kirmad", "supercode", "node_modules", "@kirmad", pkg, assetType)
            )
          }
        }
        
        log.debug("detected compiled Bun binary, trying npm package paths", { cwd, isCompiledBun, platform: process.platform, arch: process.arch })
      } else {
        // Method 2: Use actual binary path (for normal compiled binaries)
        if (process.argv[0]) {
          const binaryPath = process.argv[0]
          const binaryDir = path.dirname(binaryPath)

          // Common patterns for platform packages:
          // Binary: /some/path/node_modules/@kirmad/supercode-platform/bin/supercode
          // Assets:  /some/path/node_modules/@kirmad/supercode-platform/assetType/
          possiblePaths.push(
            path.join(binaryDir, "..", assetType), // bin/supercode -> ../assetType
            path.join(binaryDir, "..", "..", assetType), // Alternative depth
          )

          // Windows: Handle non-standard npm installations
          // The binary might be at: C:\CustomPath\supercode.exe
          // Templates at: C:\CustomPath\node_modules\@kirmad\supercode\node_modules\@kirmad\supercode-windows-x64\templates\
          if (process.platform === "win32") {
            const platformPackages = [
              "supercode-windows-x64",
              "supercode-darwin-arm64",
              "supercode-linux-x64",
              "supercode-linux-arm64",
              "supercode-darwin-x64",
              "supercode-darwin-x64-baseline",
              "supercode-linux-x64-baseline"
            ]

            for (const pkg of platformPackages) {
              // Direct installation relative to binary
              possiblePaths.push(
                path.join(binaryDir, "node_modules", "@kirmad", pkg, assetType),
                path.join(binaryDir, "node_modules", "@kirmad", "supercode", "node_modules", "@kirmad", pkg, assetType),
                // One level up from binary (common for global installs)
                path.join(binaryDir, "..", "node_modules", "@kirmad", pkg, assetType),
                path.join(binaryDir, "..", "node_modules", "@kirmad", "supercode", "node_modules", "@kirmad", pkg, assetType),
                // Two levels up (for bin directories)
                path.join(binaryDir, "..", "..", "node_modules", "@kirmad", pkg, assetType),
                path.join(binaryDir, "..", "..", "node_modules", "@kirmad", "supercode", "node_modules", "@kirmad", pkg, assetType)
              )
            }
          }

          log.debug("trying binary-based paths", { binaryPath, binaryDir })
        }
      }
      
      // Method 3: Use import.meta.url (works for development)
      try {
        const scriptPath = new URL(import.meta.url).pathname
        const scriptDir = path.dirname(scriptPath)
        
        // Skip if it's a virtual Bun filesystem path
        if (!scriptPath.includes('$bunfs')) {
          possiblePaths.push(
            path.join(scriptDir, assetType),           // Same directory as template-finder.ts
            path.join(scriptDir, "..", "server", assetType), // Development path from src/
            path.join(scriptDir, "..", "..", assetType), // Alternative
          )
          log.debug("trying script-based paths", { scriptPath, scriptDir })
        }
      } catch {
        // import.meta.url might not work in all environments
      }
      
      log.debug("searching for assets in paths", { assetType, possiblePaths })
      
      // Store all valid paths with their modification times to find the most recent
      const validPaths: Array<{ path: string; mtime: Date }> = []
      
      for (const assetPath of possiblePaths) {
        try {
          const resolvedPath = path.resolve(assetPath)
          const stats = await fs.stat(resolvedPath)
          if (stats.isDirectory()) {
            validPaths.push({ path: resolvedPath, mtime: stats.mtime })
            log.debug("found asset folder", { assetType, path: resolvedPath, mtime: stats.mtime })
          }
        } catch (error) {
          log.debug("path not found", { assetPath, error: error instanceof Error ? error.message : error })
          continue
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