import { describeRoute } from "hono-openapi"
import { Hono } from "hono"
import { resolver } from "hono-openapi/zod"
import { z } from "zod"
import { Config } from "../config/config"
import { MCP } from "../mcp"

/**
 * MCP API endpoints for TUI integration
 * This is a new file to avoid modifying existing server.ts
 */
export function createMCPRoutes() {
  const app = new Hono()

  return app.get(
    "/config/mcp",
    describeRoute({
      description: "List all MCP servers and their status",
      operationId: "config.mcp",
      responses: {
        200: {
          description: "List of MCP servers with status",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  servers: z.array(
                    z.object({
                      name: z.string(),
                      type: z.enum(["local", "remote"]),
                      enabled: z.boolean(),
                      connected: z.boolean(),
                      url: z.string().optional(),
                      command: z.array(z.string()).optional(),
                    })
                  ),
                }),
              ),
            },
          },
        },
      },
    }),
    async (c) => {
      const config = await Config.get()
      const configuredServers = config.mcp ?? {}
      const connectedClients = await MCP.clients()
      
      const servers = Object.entries(configuredServers).map(([name, serverConfig]) => ({
        name,
        type: serverConfig.type,
        enabled: serverConfig.enabled !== false,
        connected: name in connectedClients,
        url: serverConfig.type === "remote" ? serverConfig.url : undefined,
        command: serverConfig.type === "local" ? serverConfig.command : undefined,
      }))
      
      return c.json({ servers })
    },
  )
}