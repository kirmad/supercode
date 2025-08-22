import { describeRoute } from "hono-openapi"
import { Hono } from "hono"
import { resolver, validator as zValidator } from "hono-openapi/zod"
import { z } from "zod"
import { DebugLogs } from "../session/debug-logs"

export function createDebugLogsRoutes() {
  const app = new Hono()

  return app
    .get(
      "/debug-logs",
      describeRoute({
        description: "Get all debug logs across all sessions",
        operationId: "debugLogs.getAll",
        responses: {
          200: {
            description: "All debug logs",
            content: {
              "application/json": {
                schema: resolver(z.record(z.string(), DebugLogs.DebugLogEntry.array())),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json(DebugLogs.getAllSessionLogs())
      },
    )
    .get(
      "/debug-logs/:sessionID",
      describeRoute({
        description: "Get debug logs for a specific session",
        operationId: "debugLogs.getSession",
        responses: {
          200: {
            description: "Session debug logs",
            content: {
              "application/json": {
                schema: resolver(DebugLogs.DebugLogEntry.array()),
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
        return c.json(DebugLogs.getLogs(params.sessionID, query.limit))
      },
    )
    .delete(
      "/debug-logs/:sessionID",
      describeRoute({
        description: "Clear debug logs for a specific session",
        operationId: "debugLogs.clearSession",
        responses: {
          200: {
            description: "Successfully cleared session debug logs",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
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
      async (c) => {
        const params = c.req.valid("param")
        DebugLogs.clearLogs(params.sessionID)
        return c.json(true)
      },
    )
}