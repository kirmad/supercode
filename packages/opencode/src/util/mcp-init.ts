import { Config } from "../config/config"
import { MCP } from "../mcp"
import { Log } from "./log"

/**
 * Early MCP server initialization utility
 * Initializes MCP servers early in the application lifecycle so they're ready when needed
 */
export namespace McpInit {
  const log = Log.create({ service: "mcp-init" })

  export interface InitResult {
    successful: string[]
    failed: string[]
    total: number
  }

  /**
   * Initialize MCP servers early and return results
   * This function is safe to call multiple times and won't block application startup on failures
   */
  export async function initialize(): Promise<InitResult> {
    try {
      const config = await Config.get()
      const configuredServers = Object.keys(config.mcp ?? {})
      
      if (configuredServers.length === 0) {
        log.debug("No MCP servers configured")
        return { successful: [], failed: [], total: 0 }
      }

      log.info("Initializing MCP servers...", { servers: configuredServers })
      
      // Initialize clients - this triggers the actual connection/startup
      const clients = await MCP.clients()
      const successfulServers = Object.keys(clients)
      const failedServers = configuredServers.filter(server => !successfulServers.includes(server))
      
      const result: InitResult = {
        successful: successfulServers,
        failed: failedServers,
        total: configuredServers.length
      }

      if (successfulServers.length > 0) {
        log.info("MCP servers initialized successfully", { 
          successful: successfulServers,
          total: configuredServers.length 
        })
      }
      
      if (failedServers.length > 0) {
        log.warn("Some MCP servers failed to initialize", { 
          failed: failedServers,
          successful: successfulServers.length,
          total: configuredServers.length 
        })
      }

      return result
      
    } catch (error) {
      log.warn("Error during MCP server initialization", { error })
      // Return safe defaults on error - don't throw to avoid blocking startup
      return { successful: [], failed: [], total: 0 }
    }
  }

  /**
   * Initialize MCP servers with fire-and-forget semantics
   * Logs results but doesn't return them - use for background initialization
   */
  export async function initializeInBackground(): Promise<void> {
    // Fire and forget - don't await or throw errors
    initialize().catch((error) => {
      log.error("Background MCP initialization failed", { error })
    })
  }
}