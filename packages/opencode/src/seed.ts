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
    // First, try to find seeds folder in package installation (for published package)
    try {
      // Get the directory where this script is located
      const scriptDir = path.dirname(new URL(import.meta.url).pathname)
      // Try multiple possible locations relative to the compiled binary
      const possiblePaths = [
        path.join(scriptDir, "..", "seeds"),     // Development: packages/opencode/seeds
        path.join(scriptDir, "..", "..", "seeds"), // Platform package: next to binary
        path.join(scriptDir, "..", "..", "..", "seeds"), // Alternative location
      ]
      
      for (const seedsPath of possiblePaths) {
        try {
          const stats = await fs.stat(seedsPath)
          if (stats.isDirectory()) {
            log.info("found seeds folder in package", { path: seedsPath })
            return seedsPath
          }
        } catch {
          // Try next location
          continue
        }
      }
    } catch {
      // Not found in package, continue with project search
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