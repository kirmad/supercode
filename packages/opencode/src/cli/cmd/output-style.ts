import { cmd } from "./cmd"
import * as prompts from "@clack/prompts"
import { UI } from "../ui"
import { Config } from "../../config/config"
import { OutputStyle } from "../../output-style/output-style"
import { Global } from "../../global"
import { Instance } from "../../project/instance"
import path from "path"
import fs from "fs/promises"

const OutputStyleListCommand = cmd({
  command: "list",
  aliases: ["ls"],
  describe: "list available output styles",
  async handler() {
    await Instance.provide(process.cwd(), async () => {
      UI.empty()
      prompts.intro("Available output styles")

      const styles = await OutputStyle.list()
      const config = await Config.get()
      const currentStyle = config.outputStyle || "default"

      for (const style of styles) {
        const isCurrent = style.name === currentStyle
        const marker = isCurrent ? " (current)" : ""
        const typeIndicator = style.builtIn ? "[built-in]" : "[custom]"

        console.log(`  ${typeIndicator} ${style.name}${marker}`)
        if (style.description) {
          console.log(`      ${style.description}`)
        }
      }

      prompts.outro("Use 'opencode output-style set <name>' to change")
    })
  }
})

const OutputStyleSetCommand = cmd({
  command: "set <name>",
  describe: "set the output style",
  builder(yargs) {
    return yargs.positional("name", {
      describe: "output style name",
      type: "string",
      demandOption: true,
    })
  },
  async handler(args) {
    await Instance.provide(process.cwd(), async () => {
      UI.empty()
      prompts.intro("Set output style")

      // Verify the style exists
      const style = await OutputStyle.get(args.name)
      if (!style) {
        prompts.outro(`Output style '${args.name}' not found`)
        process.exit(1)
      }

      // Update the config
      const configPath = path.join(Global.Path.config, "opencode.jsonc")
      let config: any = {}

      try {
        const content = await fs.readFile(configPath, "utf-8")
        config = JSON.parse(content.replace(/\/\/.*$/gm, "")) // Strip comments
      } catch {
        // Config doesn't exist yet
      }

      config.outputStyle = args.name

      await fs.writeFile(
        configPath,
        JSON.stringify(config, null, 2),
        "utf-8"
      )

      prompts.outro(`Output style set to '${args.name}'`)
    })
  }
})

const OutputStyleGetCommand = cmd({
  command: "get",
  describe: "get the current output style",
  async handler() {
    await Instance.provide(process.cwd(), async () => {
      UI.empty()
      const config = await Config.get()
      const currentStyle = config.outputStyle || "default"
      console.log(currentStyle)
    })
  }
})

const OutputStyleCreateCommand = cmd({
  command: "create <name>",
  describe: "create a custom output style",
  builder(yargs) {
    return yargs
      .positional("name", {
        describe: "output style name",
        type: "string",
        demandOption: true,
      })
      .option("global", {
        describe: "create globally",
        type: "boolean",
        default: false,
      })
  },
  async handler(args) {
    await Instance.provide(process.cwd(), async () => {
      UI.empty()
      prompts.intro("Create custom output style")

      const description = await prompts.text({
        message: "Description",
        placeholder: "Brief description of this output style",
      })
      if (prompts.isCancel(description)) throw new UI.CancelledError()

      const template = await prompts.select({
        message: "Base template",
        options: [
          { label: "Default (concise)", value: "default" },
          { label: "Explanatory (educational)", value: "explanatory" },
          { label: "Learning (detailed)", value: "learning" },
        ],
      })
      if (prompts.isCancel(template)) throw new UI.CancelledError()

      // Determine output directory
      const outputDir = args.global
        ? path.join(Global.Path.config, "custom-outputs")
        : path.join(Instance.worktree || process.cwd(), ".opencode", "custom-outputs")

      // Create directory if it doesn't exist
      await fs.mkdir(outputDir, { recursive: true })

      // Load template
      const templateStyle = await OutputStyle.get(template)
      let templateContent = ""
      if (templateStyle) {
        const content = await OutputStyle.loadPrompt(template)
        if (content) {
          templateContent = content
        }
      }

      // Customize the template with the description
      const customContent = templateContent.replace(
        /# Output Style: .*/,
        `# Output Style: ${args.name}\n${description || ""}`
      )

      // Write the custom style file
      const outputPath = path.join(outputDir, `${args.name}.md`)
      await fs.writeFile(outputPath, customContent, "utf-8")

      prompts.outro(`Custom output style '${args.name}' created at ${outputPath}`)
    })
  }
})

export const OutputStyleCommand = cmd({
  command: "output-style",
  aliases: ["style"],
  describe: "manage output styles",
  builder: (yargs) =>
    yargs
      .command(OutputStyleListCommand)
      .command(OutputStyleSetCommand)
      .command(OutputStyleGetCommand)
      .command(OutputStyleCreateCommand)
      .demandCommand(),
  async handler() {},
})