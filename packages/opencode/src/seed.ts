import fs from "fs/promises"
import path from "path"
import { Global } from "./global"
import { Log } from "./util/log"

const log = Log.create({ service: "seed-installer" })

/**
 * Simple seed system - copies seed files from the seeds folder to global location
 */
export namespace SeedInstaller {
  
  /**
   * Install seeds from the project's seeds folder to global config
   */
  export async function installSeeds(): Promise<Record<string, {copied: string[], skipped: string[], targetDir: string}> | null> {
    try {
      log.info("installing seeds from seeds folder")
      
      // Find the seeds folder in the project root
      const seedsFolder = await findSeedsFolder()
      if (!seedsFolder) {
        log.info("no seeds folder found, skipping installation")
        return null
      }
      
      // Copy each seed type and collect results
      const results = {
        commands: await copySeeds(seedsFolder, "commands", path.join(Global.Path.config, "commands")),
        flags: await copySeeds(seedsFolder, "flags", path.join(Global.Path.config, "flags")),  
        prompts: await copySeeds(seedsFolder, "prompts", path.join(Global.Path.config, "prompts")),
        configs: await copySeeds(seedsFolder, "configs", path.join(Global.Path.config, "configs"))
      }
      
      log.info("seeds installation completed")
      return results
      
    } catch (error) {
      log.error("failed to install seeds", { error })
      // Don't throw - seed installation should be optional
      return null
    }
  }
  
  /**
   * Find the seeds folder in the project or package installation
   */
  async function findSeedsFolder(): Promise<string | null> {
    // For compiled binaries, prioritize process.argv[0] over import.meta.url
    try {
      const possiblePaths: string[] = []
      
      // Method 1: Use actual binary path (most reliable for compiled binaries)
      if (process.argv[0]) {
        const binaryPath = process.argv[0]
        const binaryDir = path.dirname(binaryPath)
        
        // Common patterns for platform packages:
        // Binary: /some/path/node_modules/@kirmad/supercode-platform/bin/supercode
        // Seeds:  /some/path/node_modules/@kirmad/supercode-platform/seeds/
        possiblePaths.push(
          path.join(binaryDir, "..", "seeds"), // bin/supercode -> ../seeds
          path.join(binaryDir, "..", "..", "seeds"), // Alternative depth
        )
        
        log.debug("trying binary-based paths", { binaryPath, binaryDir })
      }
      
      // Method 2: Use import.meta.url (works for development)
      try {
        const scriptPath = new URL(import.meta.url).pathname
        const scriptDir = path.dirname(scriptPath)
        possiblePaths.push(
          path.join(scriptDir, "..", "seeds"),     // Development
          path.join(scriptDir, "..", "..", "seeds"), // Alternative
        )
        log.debug("trying script-based paths", { scriptPath, scriptDir })
      } catch {
        // import.meta.url might not work in all environments
      }
      
      log.debug("searching for seeds in paths", { possiblePaths })
      
      for (const seedsPath of possiblePaths) {
        try {
          const resolvedPath = path.resolve(seedsPath)
          const stats = await fs.stat(resolvedPath)
          if (stats.isDirectory()) {
            log.info("found seeds folder in package", { path: resolvedPath })
            return resolvedPath
          }
        } catch (error) {
          log.debug("path not found", { seedsPath, error: error instanceof Error ? error.message : error })
          continue
        }
      }
    } catch (error) {
      log.debug("error in package seed search", { error })
    }
    
    // Fall back to searching upward from current directory (for development)
    let currentDir = process.cwd()
    
    for (let i = 0; i < 5; i++) { // Limit search depth
      const seedsPath = path.join(currentDir, "seeds")
      
      try {
        const stats = await fs.stat(seedsPath)
        if (stats.isDirectory()) {
          log.info("found seeds folder in project", { path: seedsPath })
          return seedsPath
        }
      } catch {
        // Directory doesn't exist, continue searching
      }
      
      const parentDir = path.dirname(currentDir)
      if (parentDir === currentDir) break // Reached root
      currentDir = parentDir
    }
    
    return null
  }
  
  /**
   * Copy seeds of a specific type (with recursive directory support)
   */
  async function copySeeds(seedsFolder: string, type: string, targetDir: string): Promise<{copied: string[], skipped: string[], targetDir: string}> {
    const sourceDir = path.join(seedsFolder, type)
    const result = { copied: [] as string[], skipped: [] as string[], targetDir }
    
    try {
      // Check if source directory exists
      const stats = await fs.stat(sourceDir)
      if (!stats.isDirectory()) return result
      
      // Create target directory
      await fs.mkdir(targetDir, { recursive: true })
      
      // Recursively copy all files and directories
      await copyRecursively(sourceDir, targetDir, result, type)
      
    } catch (error) {
      log.debug("seed type directory not found", { type, sourceDir })
    }
    
    return result
  }
  
  /**
   * Recursively copy directory contents
   */
  async function copyRecursively(
    sourceDir: string, 
    targetDir: string, 
    result: {copied: string[], skipped: string[]}, 
    type: string,
    relativePath: string = ""
  ) {
    const files = await fs.readdir(sourceDir)
    
    for (const file of files) {
      const sourcePath = path.join(sourceDir, file)
      const targetPath = path.join(targetDir, file)
      const relativeFilePath = relativePath ? `${relativePath}/${file}` : file
      
      try {
        const stats = await fs.stat(sourcePath)
        
        if (stats.isDirectory()) {
          // Create directory and recurse
          await fs.mkdir(targetPath, { recursive: true })
          await copyRecursively(sourcePath, targetPath, result, type, relativeFilePath)
        } else {
          // Copy file if it doesn't exist
          const targetExists = await fs.access(targetPath).then(() => true).catch(() => false)
          
          if (!targetExists) {
            await fs.copyFile(sourcePath, targetPath)
            result.copied.push(relativeFilePath)
            log.info("copied seed", { type, file: relativeFilePath, from: sourcePath, to: targetPath })
          } else {
            result.skipped.push(relativeFilePath)
            log.debug("seed already exists, skipping", { type, file: relativeFilePath })
          }
        }
      } catch (error) {
        log.warn("failed to copy seed item", { type, file: relativeFilePath, error })
      }
    }
  }
  
  
  /**
   * Check if seeds have been installed
   */
  export async function areSeedsInstalled(): Promise<boolean> {
    try {
      const markerFile = path.join(Global.Path.config, ".seeds-installed")
      await fs.access(markerFile)
      return true
    } catch {
      return false
    }
  }
  
  /**
   * Mark seeds as installed
   */
  export async function markSeedsInstalled() {
    const markerFile = path.join(Global.Path.config, ".seeds-installed")
    await fs.writeFile(markerFile, new Date().toISOString())
  }
  
  /**
   * Install seeds if not already installed
   */
  export async function installSeedsOnce() {
    const alreadyInstalled = await areSeedsInstalled()
    
    if (!alreadyInstalled) {
      await installSeeds()
      await markSeedsInstalled()
      log.info("seeds installed for the first time")
    } else {
      log.debug("seeds already installed, skipping")
    }
  }
}