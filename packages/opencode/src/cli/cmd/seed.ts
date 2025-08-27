import { cmd } from "./cmd"
import { SeedInstaller } from "../../seed"
import { UI } from "../ui"

/**
 * Report installation results
 */
function reportInstallationResults(results: Record<string, {copied: string[], skipped: string[], targetDir: string}>) {
  let totalCopied = 0
  let totalSkipped = 0
  
  for (const [type, result] of Object.entries(results)) {
    if (result.copied.length > 0) {
      console.log(`\n📁 ${type.toUpperCase()} (${result.targetDir}):`)
      result.copied.forEach(file => {
        console.log(`  ✅ ${file}`)
      })
      totalCopied += result.copied.length
    }
    
    if (result.skipped.length > 0) {
      console.log(`\n📁 ${type.toUpperCase()} (skipped - already exist):`)
      result.skipped.forEach(file => {
        console.log(`  ⏭️  ${file}`)
      })
      totalSkipped += result.skipped.length
    }
  }
  
  console.log(`\n📊 Summary: ${totalCopied} copied, ${totalSkipped} skipped`)
}

export const SeedCommand = cmd({
  command: "seed",
  describe: "Manage OpenCode seeds (commands, flags, agents, prompts)",
  builder: (yargs) => {
    return yargs
      .command({
        command: "install",
        describe: "Install seeds from the seeds folder",
        handler: async () => {
          try {
            console.log("🌱 Installing seeds...")
            const results = await SeedInstaller.installSeeds()
            
            if (results) {
              reportInstallationResults(results)
            } else {
              console.log("No seeds folder found or no seeds to install")
            }
            
            await SeedInstaller.markSeedsInstalled()
            UI.success("Seeds installation completed")
          } catch (error) {
            UI.error(`Failed to install seeds: ${error instanceof Error ? error.message : error}`)
            process.exitCode = 1
          }
        },
      })
      .command({
        command: "reinstall",
        describe: "Reinstall seeds (force overwrite existing)",
        handler: async () => {
          try {
            console.log("🌱 Reinstalling seeds...")
            const results = await SeedInstaller.installSeeds()
            
            if (results) {
              reportInstallationResults(results)
            } else {
              console.log("No seeds folder found or no seeds to install")
            }
            
            await SeedInstaller.markSeedsInstalled()
            UI.success("Seeds reinstallation completed")
          } catch (error) {
            UI.error(`Failed to reinstall seeds: ${error instanceof Error ? error.message : error}`)
            process.exitCode = 1
          }
        },
      })
      .command({
        command: "status",
        describe: "Check seed installation status",
        handler: async () => {
          try {
            const installed = await SeedInstaller.areSeedsInstalled()
            if (installed) {
              UI.success("Seeds are installed")
            } else {
              UI.info("Seeds are not installed. Run 'supercode seed install' to install them.")
            }
          } catch (error) {
            UI.error(`Failed to check seed status: ${error instanceof Error ? error.message : error}`)
            process.exitCode = 1
          }
        },
      })
      .demandCommand()
      .help()
  },
  handler: () => {},
})