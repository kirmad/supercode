import { z } from "zod"
import { Tool } from "./tool"
import { ToolDescription } from "./description"

export const InvalidTool = Tool.define("invalid", async () => ({
  description: await ToolDescription.loadDescription("invalid", "Do not use"),
  parameters: z.object({
    tool: z.string(),
    error: z.string(),
  }),
  async execute(params) {
    return {
      title: "Invalid Tool",
      output: `The arguments provided to the tool are invalid: ${params.error}`,
      metadata: {},
    }
  },
}))
