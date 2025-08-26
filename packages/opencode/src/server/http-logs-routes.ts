import { describeRoute } from "hono-openapi"
import { Hono } from "hono"
import { resolver, validator as zValidator } from "hono-openapi/zod"
import { z } from "zod"
import { HttpFileLogger } from "../session/http-file-logger"
import { promises as fs } from "fs"
import path from "path"
import { Log } from "../util/log"

const log = Log.create({ service: "http-logs-routes" })

// Define the HTTP log entry schema
const HttpLogEntrySchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  sessionID: z.string(),
  messageID: z.string(),
  direction: z.enum(["request", "response"]),
  providerID: z.string(),
  modelID: z.string(),
  data: z.object({
    type: z.enum(["raw_http_request", "raw_http_response"]),
    url: z.string(),
    method: z.string(),
    headers: z.record(z.string(), z.string()).optional(),
    requestHeaders: z.record(z.string(), z.string()).optional(),
    responseHeaders: z.record(z.string(), z.string()).optional(),
    body: z.string().optional(),
    requestBody: z.string().optional(),
    responseBody: z.string().optional(),
    status: z.number().optional(),
    statusText: z.string().optional(),
    duration: z.number().optional(),
    bodySize: z.number().optional(),
    requestBodySize: z.number().optional(),
    responseBodySize: z.number().optional(),
  })
})

export type HttpLogEntry = z.infer<typeof HttpLogEntrySchema>

export namespace HttpLogs {
  /**
   * Read all HTTP log entries from the log directory
   */
  export async function getAllLogs(): Promise<HttpLogEntry[]> {
    const logDir = HttpFileLogger.getLogDir()
    if (!logDir) {
      log.debug("HTTP logging not enabled or log directory not available")
      return []
    }

    try {
      const files = await fs.readdir(logDir)
      const logFiles = files.filter(file => file.endsWith('.jsonl'))
      
      const allLogs: HttpLogEntry[] = []
      
      for (const file of logFiles) {
        const filePath = path.join(logDir, file)
        try {
          const content = await fs.readFile(filePath, 'utf-8')
          const lines = content.split('\n').filter(line => line.trim())
          
          for (const line of lines) {
            try {
              const entry = JSON.parse(line)
              // Validate the entry against our schema
              const validatedEntry = HttpLogEntrySchema.safeParse(entry)
              if (validatedEntry.success) {
                allLogs.push(validatedEntry.data)
              } else {
                log.warn("Invalid HTTP log entry found", { file, error: validatedEntry.error })
              }
            } catch (parseError) {
              log.warn("Failed to parse HTTP log line", { file, line, error: parseError })
            }
          }
        } catch (fileError) {
          log.warn("Failed to read HTTP log file", { file, error: fileError })
        }
      }
      
      // Sort by timestamp for chronological order
      allLogs.sort((a, b) => a.timestamp - b.timestamp)
      
      log.debug("Loaded HTTP logs", { count: allLogs.length, files: logFiles.length })
      return allLogs
      
    } catch (error) {
      log.error("Failed to read HTTP logs directory", { logDir, error })
      return []
    }
  }

  /**
   * Get logs for a specific session
   */
  export async function getSessionLogs(sessionID: string, limit?: number): Promise<HttpLogEntry[]> {
    const allLogs = await getAllLogs()
    const sessionLogs = allLogs.filter(log => log.sessionID === sessionID)
    
    if (limit && limit > 0) {
      return sessionLogs.slice(-limit) // Return last N entries
    }
    
    return sessionLogs
  }

  /**
   * Get logs for a specific provider
   */
  export async function getProviderLogs(providerID: string, limit?: number): Promise<HttpLogEntry[]> {
    const allLogs = await getAllLogs()
    const providerLogs = allLogs.filter(log => log.providerID === providerID)
    
    if (limit && limit > 0) {
      return providerLogs.slice(-limit) // Return last N entries
    }
    
    return providerLogs
  }

  /**
   * Clear HTTP logs (delete all log files)
   */
  export async function clearAllLogs(): Promise<void> {
    const logDir = HttpFileLogger.getLogDir()
    if (!logDir) {
      return
    }

    try {
      const files = await fs.readdir(logDir)
      const logFiles = files.filter(file => file.endsWith('.jsonl'))
      
      for (const file of logFiles) {
        const filePath = path.join(logDir, file)
        await fs.unlink(filePath)
      }
      
      log.info("Cleared all HTTP logs", { deletedFiles: logFiles.length })
    } catch (error) {
      log.error("Failed to clear HTTP logs", { logDir, error })
      throw error
    }
  }
}

export function createHttpLogsRoutes() {
  const app = new Hono()

  return app
    .get(
      "/http-logs",
      describeRoute({
        description: "Get all HTTP request/response logs",
        operationId: "httpLogs.getAll",
        responses: {
          200: {
            description: "All HTTP logs",
            content: {
              "application/json": {
                schema: resolver(HttpLogEntrySchema.array()),
              },
            },
          },
        },
      }),
      zValidator(
        "query",
        z
          .object({
            limit: z.coerce.number().optional(),
            provider: z.string().optional(),
          })
          .optional(),
      ),
      async (c) => {
        const query = c.req.valid("query") || {}
        
        if (query.provider) {
          const logs = await HttpLogs.getProviderLogs(query.provider, query.limit)
          return c.json(logs)
        } else {
          const logs = await HttpLogs.getAllLogs()
          const limitedLogs = query.limit && query.limit > 0 
            ? logs.slice(-query.limit) 
            : logs
          return c.json(limitedLogs)
        }
      },
    )
    .get(
      "/http-logs/:sessionID",
      describeRoute({
        description: "Get HTTP logs for a specific session",
        operationId: "httpLogs.getSession",
        responses: {
          200: {
            description: "Session HTTP logs",
            content: {
              "application/json": {
                schema: resolver(HttpLogEntrySchema.array()),
              },
            },
          },
        },
      }),
      zValidator(
        "param",
        z.object({
          sessionID: z.string(),
        }),
      ),
      zValidator(
        "query",
        z
          .object({
            limit: z.coerce.number().optional(),
          })
          .optional(),
      ),
      async (c) => {
        const params = c.req.valid("param")
        const query = c.req.valid("query") || {}
        const logs = await HttpLogs.getSessionLogs(params.sessionID, query.limit)
        return c.json(logs)
      },
    )
    .delete(
      "/http-logs",
      describeRoute({
        description: "Clear all HTTP logs",
        operationId: "httpLogs.clearAll",
        responses: {
          200: {
            description: "Successfully cleared all HTTP logs",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
        },
      }),
      async (c) => {
        await HttpLogs.clearAllLogs()
        return c.json(true)
      },
    )
}