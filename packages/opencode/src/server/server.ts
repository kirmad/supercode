import { Log } from "../util/log"
import { Bus } from "../bus"
import { describeRoute, generateSpecs, openAPISpecs } from "hono-openapi"
import path from "node:path"
import fs from "node:fs/promises"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { streamSSE } from "hono/streaming"
import { Session } from "../session"
import { resolver, validator as zValidator } from "hono-openapi/zod"
import { z } from "zod"
import { Provider } from "../provider/provider"
import { mapValues } from "remeda"
import { NamedError } from "../util/error"
import { ModelsDev } from "../provider/models"
import { Ripgrep } from "../file/ripgrep"
import { Config } from "../config/config"
import { File } from "../file"
import { LSP } from "../lsp"
import { MessageV2 } from "../session/message-v2"
import { callTui, TuiRoute } from "./tui"
import { Permission } from "../permission"
import { Instance } from "../project/instance"
import { Agent } from "../agent/agent"
import { Auth } from "../auth"
import { createMCPRoutes } from "./mcp-api"
import { createWebRoutes } from "./web-routes"
import { createDebugLogsRoutes } from "./debug-logs-routes"
import { createHttpLogsRoutes } from "./http-logs-routes"
import { createGitRoutes } from "./git-routes"
import { createFileRoutes } from "./file-routes"
import { Command } from "../command"
import { Global } from "../global"
import { ProjectRoute } from "./project"
import { generateText } from "ai"
import { ToolRegistry } from "../tool/registry"
import { WebSocketHandler } from "./websocket-handler"

const ERRORS = {
  400: {
    description: "Bad request",
    content: {
      "application/json": {
        schema: resolver(
          z
            .object({
              data: z.record(z.string(), z.any()),
            })
            .openapi({
              ref: "Error",
            }),
        ),
      },
    },
  },
} as const

export namespace Server {
  const log = Log.create({ service: "server" })

  export const Event = {
    Connected: Bus.event("server.connected", z.object({})),
    ModelChanged: Bus.event("tui.model.changed", z.object({
      providerID: z.string(),
      modelID: z.string(),
      providerName: z.string().optional(),
      modelName: z.string().optional(),
    })),
    AgentChanged: Bus.event("tui.agent.changed", z.object({
      agentName: z.string(),
      displayName: z.string().optional(),
    })),
    OutputStyleChanged: Bus.event("tui.output.style.changed", z.object({
      styleName: z.string(),
      description: z.string().optional(),
    })),
  }

  const app = new Hono()
  
  // Enable CORS for browser integration
  app.use('*', cors({
    origin: (origin) => {
      if (origin?.startsWith('http://localhost:')) return origin
      if (origin?.startsWith('http://127.0.0.1:')) return origin
      if (origin?.startsWith('http://0.0.0.0:')) return origin
      
      // Allow VSCode webview origins
      if (origin?.startsWith('vscode-webview://')) return origin
      
      // Allow null origin for local development
      if (origin === null || origin === undefined) return origin
      
      return null
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Accept', 'Authorization'],
    credentials: true
  }))
  
  export const App = app
    .onError((err, c) => {
      log.error("failed", {
        error: err,
      })
      if (err instanceof NamedError) {
        return c.json(err.toObject(), {
          status: 400,
        })
      }
      return c.json(new NamedError.Unknown({ message: err.toString() }).toObject(), {
        status: 400,
      })
    })
    .use(async (c, next) => {
      const skipLogging = c.req.path === "/log"
      if (!skipLogging) {
        log.info("request", {
          method: c.req.method,
          path: c.req.path,
        })
      }
      const start = Date.now()
      await next()
      if (!skipLogging) {
        log.info("response", {
          duration: Date.now() - start,
        })
      }
    })
    .use(async (c, next) => {
      const directory = c.req.query("directory") ?? process.cwd()
      return Instance.provide(directory, async () => {
        return next()
      })
    })
    .use(zValidator("query", z.object({ directory: z.string().optional() })))
    .get(
      "/doc",
      openAPISpecs(app, {
        documentation: {
          info: {
            title: "supercode",
            version: "0.0.3",
            description: "supercode api",
          },
          openapi: "3.1.1",
        },
      }),
    )
    .route("/project", ProjectRoute)
    .get(
      "/event",
      describeRoute({
        description: "Get events",
        operationId: "event.subscribe",
        responses: {
          200: {
            description: "Event stream",
            content: {
              "text/event-stream": {
                schema: resolver(
                  Bus.payloads().openapi({
                    ref: "Event",
                  }),
                ),
              },
            },
          },
        },
      }),
      async (c) => {
        log.info("event connected")
        return streamSSE(c, async (stream) => {
          stream.writeSSE({
            data: JSON.stringify({
              type: "server.connected",
              properties: {},
            }),
          })
          const unsub = Bus.subscribeAll(async (event) => {
            await stream.writeSSE({
              data: JSON.stringify(event),
            })
          })
          await new Promise<void>((resolve) => {
            stream.onAbort(() => {
              unsub()
              resolve()
              log.info("event disconnected")
            })
          })
        })
      },
    )
    .get(
      "/config",
      describeRoute({
        description: "Get config info",
        operationId: "config.get",
        responses: {
          200: {
            description: "Get config info",
            content: {
              "application/json": {
                schema: resolver(Config.Info),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json(await Config.get())
      },
    )
    .get(
      "/output-styles",
      describeRoute({
        description: "Get available output styles",
        operationId: "outputStyles.list",
        responses: {
          200: {
            description: "List of output styles",
            content: {
              "application/json": {
                schema: resolver(
                  z
                    .object({
                      styles: z.array(
                        z.object({
                          name: z.string(),
                          description: z.string().optional(),
                          builtIn: z.boolean(),
                        })
                      ),
                    })
                    .openapi({
                      ref: "OutputStylesList",
                    }),
                ),
              },
            },
          },
        },
      }),
      async (c) => {
        const { OutputStyle } = await import("../output-style/output-style")
        const styles = await OutputStyle.list()
        return c.json({ styles })
      },
    )
    .post(
      "/output-style/set",
      describeRoute({
        description: "Set output style",
        operationId: "outputStyle.set",
        responses: {
          200: {
            description: "Output style updated",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    success: z.boolean(),
                  }),
                ),
              },
            },
          },
        },
      }),
      zValidator(
        "json",
        z.object({
          outputStyle: z.string(),
        }),
      ),
      async (c) => {
        const { outputStyle } = c.req.valid("json")
        const config = await Config.get()
        config.outputStyle = outputStyle

        // Save to config file
        const configPath = path.join(Global.Path.config, "opencode.jsonc")
        await fs.mkdir(path.dirname(configPath), { recursive: true })
        await fs.writeFile(
          configPath,
          JSON.stringify(config, null, 2),
          "utf-8"
        )

        // Emit output style changed event for external listeners
        const { OutputStyle } = await import("../output-style/output-style")
        const styles = await OutputStyle.list()
        const selectedStyle = styles.find(s => s.name === outputStyle)
        await Bus.publish(Server.Event.OutputStyleChanged, {
          styleName: outputStyle,
          description: selectedStyle?.description
        })

        return c.json({ success: true })
      },
    )
    .get(
      "/path",
      describeRoute({
        description: "Get the current path",
        operationId: "path.get",
        responses: {
          200: {
            description: "Path",
            content: {
              "application/json": {
                schema: resolver(
                  z
                    .object({
                      state: z.string(),
                      config: z.string(),
                      worktree: z.string(),
                      directory: z.string(),
                    })
                    .openapi({
                      ref: "Path",
                    }),
                ),
              },
            },
          },
        },
      }),
      async (c) => {
        return c.json({
          state: Global.Path.state,
          config: Global.Path.config,
          worktree: Instance.worktree,
          directory: Instance.directory,
        })
      },
    )
    .get(
      "/session",
      describeRoute({
        description: "List all sessions",
        operationId: "session.list",
        responses: {
          200: {
            description: "List of sessions",
            content: {
              "application/json": {
                schema: resolver(Session.Info.array()),
              },
            },
          },
        },
      }),
      async (c) => {
        const sessions = await Array.fromAsync(Session.list())
        sessions.sort((a, b) => b.time.updated - a.time.updated)
        return c.json(sessions)
      },
    )
    .get(
      "/session/:id",
      describeRoute({
        description: "Get session",
        operationId: "session.get",
        responses: {
          200: {
            description: "Get session",
            content: {
              "application/json": {
                schema: resolver(Session.Info),
              },
            },
          },
        },
      }),
      zValidator(
        "param",
        z.object({
          id: z.string(),
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").id
        const session = await Session.get(sessionID)
        return c.json(session)
      },
    )
    .get(
      "/session/:id/children",
      describeRoute({
        description: "Get a session's children",
        operationId: "session.children",
        responses: {
          200: {
            description: "List of children",
            content: {
              "application/json": {
                schema: resolver(Session.Info.array()),
              },
            },
          },
        },
      }),
      zValidator(
        "param",
        z.object({
          id: z.string(),
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").id
        const session = await Session.children(sessionID)
        return c.json(session)
      },
    )
    .post(
      "/session",
      describeRoute({
        description: "Create a new session",
        operationId: "session.create",
        responses: {
          ...ERRORS,
          200: {
            description: "Successfully created session",
            content: {
              "application/json": {
                schema: resolver(Session.Info),
              },
            },
          },
        },
      }),
      zValidator(
        "json",
        z
          .object({
            parentID: z.string().optional(),
            title: z.string().optional(),
            outputStyle: z.string().optional(),
          })
          .optional(),
      ),
      async (c) => {
        const body = c.req.valid("json") ?? {}
        const session = await Session.create(body.parentID, body.title)

        // Note: outputStyle is not stored in the session itself,
        // but can be passed when sending messages to the session
        // This allows clients to specify a preferred outputStyle at session creation
        // which they can then use when sending the first message

        return c.json(session)
      },
    )
    .delete(
      "/session/:id",
      describeRoute({
        description: "Delete a session and all its data",
        operationId: "session.delete",
        responses: {
          200: {
            description: "Successfully deleted session",
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
          id: z.string(),
        }),
      ),
      async (c) => {
        await Session.remove(c.req.valid("param").id)
        return c.json(true)
      },
    )
    .patch(
      "/session/:id",
      describeRoute({
        description: "Update session properties",
        operationId: "session.update",
        responses: {
          200: {
            description: "Successfully updated session",
            content: {
              "application/json": {
                schema: resolver(Session.Info),
              },
            },
          },
        },
      }),
      zValidator(
        "param",
        z.object({
          id: z.string(),
        }),
      ),
      zValidator(
        "json",
        z.object({
          title: z.string().optional(),
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").id
        const updates = c.req.valid("json")

        const updatedSession = await Session.update(sessionID, (session) => {
          if (updates.title !== undefined) {
            session.title = updates.title
          }
        })

        return c.json(updatedSession)
      },
    )
    .post(
      "/session/:id/init",
      describeRoute({
        description: "Analyze the app and create an AGENTS.md file",
        operationId: "session.init",
        responses: {
          200: {
            description: "200",
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
          id: z.string().openapi({ description: "Session ID" }),
        }),
      ),
      zValidator(
        "json",
        z.object({
          messageID: z.string(),
          providerID: z.string(),
          modelID: z.string(),
          outputStyle: z.string().optional(),
        }),
      ),
      async (c) => {
        const sessionID = c.req.valid("param").id
        const body = c.req.valid("json")
        await Session.initialize({ ...body, sessionID })
        return c.json(true)
      },
    )
    .post(
      "/session/:id/abort",
      describeRoute({
        description: "Abort a session",
        operationId: "session.abort",
        responses: {
          200: {
            description: "Aborted session",
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
          id: z.string(),
        }),
      ),
      async (c) => {
        return c.json(Session.abort(c.req.valid("param").id))
      },
    )
    .post(
      "/session/:id/share",
      describeRoute({
        description: "Share a session",
        operationId: "session.share",
        responses: {
          200: {
            description: "Successfully shared session",
            content: {
              "application/json": {
                schema: resolver(Session.Info),
              },
            },
          },
        },
      }),
      zValidator(
        "param",
        z.object({
          id: z.string(),
        }),
      ),
      async (c) => {
        const id = c.req.valid("param").id
        await Session.share(id)
        const session = await Session.get(id)
        return c.json(session)
      },
    )
    .delete(
      "/session/:id/share",
      describeRoute({
        description: "Unshare the session",
        operationId: "session.unshare",
        responses: {
          200: {
            description: "Successfully unshared session",
            content: {
              "application/json": {
                schema: resolver(Session.Info),
              },
            },
          },
        },
      }),
      zValidator(
        "param",
        z.object({
          id: z.string(),
        }),
      ),
      async (c) => {
        const id = c.req.valid("param").id
        await Session.unshare(id)
        const session = await Session.get(id)
        return c.json(session)
      },
    )
    .post(
      "/session/:id/summarize",
      describeRoute({
        description: "Summarize the session",
        operationId: "session.summarize",
        responses: {
          200: {
            description: "Summarized session",
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
          id: z.string().openapi({ description: "Session ID" }),
        }),
      ),
      zValidator(
        "json",
        z.object({
          providerID: z.string(),
          modelID: z.string(),
          outputStyle: z.string().optional(),
        }),
      ),
      async (c) => {
        const id = c.req.valid("param").id
        const body = c.req.valid("json")
        await Session.summarize({ ...body, sessionID: id })
        return c.json(true)
      },
    )
    .get(
      "/session/:id/message",
      describeRoute({
        description: "List messages for a session",
        operationId: "session.messages",
        responses: {
          200: {
            description: "List of messages",
            content: {
              "application/json": {
                schema: resolver(
                  z
                    .object({
                      info: MessageV2.Info,
                      parts: MessageV2.Part.array(),
                    })
                    .array(),
                ),
              },
            },
          },
        },
      }),
      zValidator(
        "param",
        z.object({
          id: z.string().openapi({ description: "Session ID" }),
        }),
      ),
      async (c) => {
        const messages = await Session.messages(c.req.valid("param").id)
        return c.json(messages)
      },
    )
    .get(
      "/session/:id/message/:messageID",
      describeRoute({
        description: "Get a message from a session",
        operationId: "session.message",
        responses: {
          200: {
            description: "Message",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    info: MessageV2.Info,
                    parts: MessageV2.Part.array(),
                  }),
                ),
              },
            },
          },
        },
      }),
      zValidator(
        "param",
        z.object({
          id: z.string().openapi({ description: "Session ID" }),
          messageID: z.string().openapi({ description: "Message ID" }),
        }),
      ),
      async (c) => {
        const params = c.req.valid("param")
        const message = await Session.getMessage(params.id, params.messageID)
        return c.json(message)
      },
    )
    .post(
      "/session/:id/message",
      describeRoute({
        description: "Create and send a new message to a session",
        operationId: "session.prompt",
        responses: {
          200: {
            description: "Created message",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    info: MessageV2.Assistant,
                    parts: MessageV2.Part.array(),
                  }),
                ),
              },
            },
          },
        },
      }),
      zValidator(
        "param",
        z.object({
          id: z.string().openapi({ description: "Session ID" }),
        }),
      ),
      zValidator("json", Session.PromptInput.omit({ sessionID: true })),
      async (c) => {
        const sessionID = c.req.valid("param").id
        const body = c.req.valid("json")
        const msg = await Session.prompt({ ...body, sessionID })
        return c.json(msg)
      },
    )
    .post(
      "/session/:id/command",
      describeRoute({
        description: "Send a new command to a session",
        operationId: "session.command",
        responses: {
          200: {
            description: "Created message",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    info: MessageV2.Assistant,
                    parts: MessageV2.Part.array(),
                  }),
                ),
              },
            },
          },
        },
      }),
      zValidator(
        "param",
        z.object({
          id: z.string().openapi({ description: "Session ID" }),
        }),
      ),
      zValidator("json", Session.CommandInput.omit({ sessionID: true })),
      async (c) => {
        const sessionID = c.req.valid("param").id
        const body = c.req.valid("json")
        const msg = await Session.command({ ...body, sessionID })
        return c.json(msg)
      },
    )
    .post(
      "/session/:id/shell",
      describeRoute({
        description: "Run a shell command",
        operationId: "session.shell",
        responses: {
          200: {
            description: "Created message",
            content: {
              "application/json": {
                schema: resolver(MessageV2.Assistant),
              },
            },
          },
        },
      }),
      zValidator(
        "param",
        z.object({
          id: z.string().openapi({ description: "Session ID" }),
        }),
      ),
      zValidator("json", Session.ShellInput.omit({ sessionID: true })),
      async (c) => {
        const sessionID = c.req.valid("param").id
        const body = c.req.valid("json")
        const msg = await Session.shell({ ...body, sessionID })
        return c.json(msg)
      },
    )
    .post(
      "/session/:id/revert",
      describeRoute({
        description: "Revert a message",
        operationId: "session.revert",
        responses: {
          200: {
            description: "Updated session",
            content: {
              "application/json": {
                schema: resolver(Session.Info),
              },
            },
          },
        },
      }),
      zValidator(
        "param",
        z.object({
          id: z.string(),
        }),
      ),
      zValidator("json", Session.RevertInput.omit({ sessionID: true })),
      async (c) => {
        const id = c.req.valid("param").id
        log.info("revert", c.req.valid("json"))
        const session = await Session.revert({ sessionID: id, ...c.req.valid("json") })
        return c.json(session)
      },
    )
    .post(
      "/session/:id/unrevert",
      describeRoute({
        description: "Restore all reverted messages",
        operationId: "session.unrevert",
        responses: {
          200: {
            description: "Updated session",
            content: {
              "application/json": {
                schema: resolver(Session.Info),
              },
            },
          },
        },
      }),
      zValidator(
        "param",
        z.object({
          id: z.string(),
        }),
      ),
      async (c) => {
        const id = c.req.valid("param").id
        const session = await Session.unrevert({ sessionID: id })
        return c.json(session)
      },
    )
    .post(
      "/session/:id/permissions/:permissionID",
      describeRoute({
        description: "Respond to a permission request",
        responses: {
          200: {
            description: "Permission processed successfully",
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
          id: z.string(),
          permissionID: z.string(),
        }),
      ),
      zValidator("json", z.object({ response: Permission.Response })),
      async (c) => {
        const params = c.req.valid("param")
        const id = params.id
        const permissionID = params.permissionID
        Permission.respond({ sessionID: id, permissionID, response: c.req.valid("json").response })
        return c.json(true)
      },
    )
    .get(
      "/command",
      describeRoute({
        description: "List all commands",
        operationId: "command.list",
        responses: {
          200: {
            description: "List of commands",
            content: {
              "application/json": {
                schema: resolver(Command.Info.array()),
              },
            },
          },
        },
      }),
      async (c) => {
        const commands = await Command.list()
        return c.json(commands)
      },
    )
    .get(
      "/custom-commands",
      describeRoute({
        description: "List all custom commands",
        operationId: "customCommand.list",
        parameters: [
          {
            name: "sessionId",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Optional session ID to determine project context",
          },
        ],
        responses: {
          200: {
            description: "List of custom commands",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      description: { type: "string" },
                      namespace: { type: "string" },
                      fullName: { type: "string" },
                      usage: { type: "string" },
                      arguments: { 
                        type: "array",
                        items: { type: "string" }
                      },
                    },
                    required: ["name", "fullName"],
                  },
                },
              },
            },
          },
        },
      }),
      async (c) => {
        const { loadCustomCommands } = await import("../custom-commands/index.ts")
        const sessionId = c.req.query("sessionId")
        
        try {
          // Get project path from session if available, otherwise use current working directory
          let projectPath: string | undefined
          if (sessionId) {
            // Try to get project path from session context
            // This is a simplified approach - in a real implementation you might 
            // want to track the working directory per session
            projectPath = process.cwd()
          } else {
            // Fallback to current working directory for direct API access
            projectPath = process.cwd()
          }
          
          const commands = await loadCustomCommands(projectPath)
          return c.json(commands)
        } catch (error) {
          console.error("Failed to load custom commands:", error)
          return c.json([])
        }
      },
    )
    .get(
      "/custom-commands/complete",
      describeRoute({
        description: "Get custom command completions for auto-completion",
        operationId: "customCommand.complete",
        parameters: [
          {
            name: "prefix",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Command prefix to filter by",
          },
          {
            name: "sessionId",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Optional session ID to determine project context",
          },
        ],
        responses: {
          200: {
            description: "Filtered list of custom commands for completion",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      description: { type: "string" },
                      namespace: { type: "string" },
                      fullName: { type: "string" },
                      usage: { type: "string" },
                      arguments: { 
                        type: "array",
                        items: { type: "string" }
                      },
                    },
                    required: ["name", "fullName"],
                  },
                },
              },
            },
          },
        },
      }),
      async (c) => {
        const { loadCustomCommands, filterCommands } = await import("../custom-commands/index.ts")
        const prefix = c.req.query("prefix") || ""
        const sessionId = c.req.query("sessionId")
        
        try {
          // Get project path from session if available, otherwise use current working directory
          let projectPath: string | undefined
          if (sessionId) {
            projectPath = process.cwd()
          } else {
            // Fallback to current working directory for direct API access
            projectPath = process.cwd()
          }
          
          const commands = await loadCustomCommands(projectPath)
          const filtered = filterCommands(commands, prefix)
          
          // Limit to 10 results for performance
          return c.json(filtered.slice(0, 10))
        } catch (error) {
          console.error("Failed to get command completions:", error)
          return c.json([])
        }
      },
    )
    .get(
      "/flag-suggestions",
      describeRoute({
        description: "Get flag suggestions for command auto-completion",
        operationId: "flagSuggestions.get",
        parameters: [
          {
            name: "input",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Current input text to determine command context",
          },
          {
            name: "prefix",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Flag prefix to filter suggestions (e.g., '--ve' for '--verbose')",
          },
          {
            name: "sessionId",
            in: "query",
            required: false,
            schema: { type: "string" },
            description: "Optional session ID for context",
          },
        ],
        responses: {
          200: {
            description: "List of flag suggestions",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      flag: { type: "string", description: "The flag itself (e.g., '--verbose')" },
                      shortFlag: { type: "string", description: "Short version if available (e.g., '-v')" },
                      description: { type: "string", description: "Description of what the flag does" },
                      valueType: { type: "string", description: "Type of value expected" },
                      category: { type: "string", description: "Category for grouping" },
                      example: { type: "string", description: "Example usage" },
                    },
                    required: ["flag", "description"],
                  },
                },
              },
            },
          },
        },
      }),
      async (c) => {
        const { getFlagSuggestions } = await import("../flag-suggestions/index.ts")
        const input = c.req.query("input") || ""
        const prefix = c.req.query("prefix") || ""
        
        try {
          const suggestions = await getFlagSuggestions(input, prefix)
          
          // Limit to 15 results for performance
          return c.json(suggestions.slice(0, 15))
        } catch (error) {
          console.error("Failed to get flag suggestions:", error)
          return c.json([])
        }
      },
    )
    .get(
      "/config/providers",
      describeRoute({
        description: "List all providers",
        operationId: "config.providers",
        responses: {
          200: {
            description: "List of providers",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    providers: ModelsDev.Provider.array(),
                    default: z.record(z.string(), z.string()),
                  }),
                ),
              },
            },
          },
        },
      }),
      async (c) => {
        const providers = await Provider.list().then((x) => mapValues(x, (item) => item.info))
        return c.json({
          providers: Object.values(providers),
          default: mapValues(providers, (item) => Provider.sort(Object.values(item.models))[0].id),
        })
      },
    )
    .get(
      "/find",
      describeRoute({
        description: "Find text in files",
        operationId: "find.text",
        responses: {
          200: {
            description: "Matches",
            content: {
              "application/json": {
                schema: resolver(Ripgrep.Match.shape.data.array()),
              },
            },
          },
        },
      }),
      zValidator(
        "query",
        z.object({
          pattern: z.string(),
        }),
      ),
      async (c) => {
        const pattern = c.req.valid("query").pattern
        const result = await Ripgrep.search({
          cwd: Instance.directory,
          pattern,
          limit: 10,
        })
        return c.json(result)
      },
    )
    .get(
      "/find/file",
      describeRoute({
        description: "Find files",
        operationId: "find.files",
        responses: {
          200: {
            description: "File paths",
            content: {
              "application/json": {
                schema: resolver(z.string().array()),
              },
            },
          },
        },
      }),
      zValidator(
        "query",
        z.object({
          query: z.string(),
        }),
      ),
      async (c) => {
        const query = c.req.valid("query").query
        const result = await Ripgrep.files({
          cwd: Instance.directory,
          query,
          limit: 10,
        })
        return c.json(result)
      },
    )
    .get(
      "/find/symbol",
      describeRoute({
        description: "Find workspace symbols",
        operationId: "find.symbols",
        responses: {
          200: {
            description: "Symbols",
            content: {
              "application/json": {
                schema: resolver(LSP.Symbol.array()),
              },
            },
          },
        },
      }),
      zValidator(
        "query",
        z.object({
          query: z.string(),
        }),
      ),
      async (c) => {
        const query = c.req.valid("query").query
        const result = await LSP.workspaceSymbol(query)
        return c.json(result)
      },
    )
    .get(
      "/file",
      describeRoute({
        description: "List files and directories",
        operationId: "file.list",
        responses: {
          200: {
            description: "Files and directories",
            content: {
              "application/json": {
                schema: resolver(File.Node.array()),
              },
            },
          },
        },
      }),
      zValidator(
        "query",
        z.object({
          path: z.string(),
        }),
      ),
      async (c) => {
        const path = c.req.valid("query").path
        const content = await File.list(path)
        return c.json(content)
      },
    )
    .get(
      "/file/content",
      describeRoute({
        description: "Read a file",
        operationId: "file.read",
        responses: {
          200: {
            description: "File content",
            content: {
              "application/json": {
                schema: resolver(File.Content),
              },
            },
          },
        },
      }),
      zValidator(
        "query",
        z.object({
          path: z.string(),
        }),
      ),
      async (c) => {
        const path = c.req.valid("query").path
        const content = await File.read(path)
        return c.json(content)
      },
    )
    .get(
      "/file/status",
      describeRoute({
        description: "Get file status",
        operationId: "file.status",
        responses: {
          200: {
            description: "File status",
            content: {
              "application/json": {
                schema: resolver(File.Info.array()),
              },
            },
          },
        },
      }),
      async (c) => {
        const content = await File.status()
        return c.json(content)
      },
    )
    .post(
      "/log",
      describeRoute({
        description: "Write a log entry to the server logs",
        operationId: "app.log",
        responses: {
          200: {
            description: "Log entry written successfully",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
        },
      }),
      zValidator(
        "json",
        z.object({
          service: z.string().openapi({ description: "Service name for the log entry" }),
          level: z.enum(["debug", "info", "error", "warn"]).openapi({ description: "Log level" }),
          message: z.string().openapi({ description: "Log message" }),
          extra: z
            .record(z.string(), z.any())
            .optional()
            .openapi({ description: "Additional metadata for the log entry" }),
        }),
      ),
      async (c) => {
        const { service, level, message, extra } = c.req.valid("json")
        const logger = Log.create({ service })

        switch (level) {
          case "debug":
            logger.debug(message, extra)
            break
          case "info":
            logger.info(message, extra)
            break
          case "error":
            logger.error(message, extra)
            break
          case "warn":
            logger.warn(message, extra)
            break
        }

        return c.json(true)
      },
    )
    .get(
      "/agent",
      describeRoute({
        description: "List all agents",
        operationId: "app.agents",
        responses: {
          200: {
            description: "List of agents",
            content: {
              "application/json": {
                schema: resolver(Agent.Info.array()),
              },
            },
          },
        },
      }),
      async (c) => {
        const modes = await Agent.list()
        return c.json(modes)
      },
    )
    .post(
      "/tui/append-prompt",
      describeRoute({
        description: "Append prompt to the TUI",
        operationId: "tui.appendPrompt",
        responses: {
          200: {
            description: "Prompt processed successfully",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
        },
      }),
      zValidator(
        "json",
        z.object({
          text: z.string(),
        }),
      ),
      async (c) => c.json(await callTui(c)),
    )
    .post(
      "/tui/open-help",
      describeRoute({
        description: "Open the help dialog",
        operationId: "tui.openHelp",
        responses: {
          200: {
            description: "Help dialog opened successfully",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
        },
      }),
      async (c) => c.json(await callTui(c)),
    )
    .post(
      "/tui/open-sessions",
      describeRoute({
        description: "Open the session dialog",
        operationId: "tui.openSessions",
        responses: {
          200: {
            description: "Session dialog opened successfully",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
        },
      }),
      async (c) => c.json(await callTui(c)),
    )
    .post(
      "/tui/open-themes",
      describeRoute({
        description: "Open the theme dialog",
        operationId: "tui.openThemes",
        responses: {
          200: {
            description: "Theme dialog opened successfully",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
        },
      }),
      async (c) => c.json(await callTui(c)),
    )
    .post(
      "/tui/open-models",
      describeRoute({
        description: "Open the model dialog",
        operationId: "tui.openModels",
        responses: {
          200: {
            description: "Model dialog opened successfully",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
        },
      }),
      async (c) => c.json(await callTui(c)),
    )
    .post(
      "/tui/submit-prompt",
      describeRoute({
        description: "Submit the prompt",
        operationId: "tui.submitPrompt",
        responses: {
          200: {
            description: "Prompt submitted successfully",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
        },
      }),
      async (c) => c.json(await callTui(c)),
    )
    .post(
      "/tui/clear-prompt",
      describeRoute({
        description: "Clear the prompt",
        operationId: "tui.clearPrompt",
        responses: {
          200: {
            description: "Prompt cleared successfully",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
        },
      }),
      async (c) => c.json(await callTui(c)),
    )
    .post(
      "/tui/cancel-prompt",
      describeRoute({
        description: "Cancel the currently running prompt",
        operationId: "tui.cancelPrompt",
        responses: {
          200: {
            description: "Prompt cancellation signal sent successfully",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
        },
      }),
      async (c) => c.json(await callTui(c)),
    )
    .post(
      "/tui/clear-session",
      describeRoute({
        description: "Clear the current TUI session",
        operationId: "tui.clearSession",
        responses: {
          200: {
            description: "Session cleared successfully",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
        },
      }),
      async (c) => c.json(await callTui(c)),
    )
    .post(
      "/tui/execute-command",
      describeRoute({
        description: "Execute a TUI command (e.g. agent_cycle)",
        operationId: "tui.executeCommand",
        responses: {
          200: {
            description: "Command executed successfully",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
        },
      }),
      zValidator(
        "json",
        z.object({
          command: z.string(),
        }),
      ),
      async (c) => c.json(await callTui(c)),
    )
    .get(
      "/tui/get-model",
      describeRoute({
        description: "Get currently selected model in TUI",
        operationId: "tui.getModel",
        responses: {
          200: {
            description: "Current model information",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    providerID: z.string(),
                    modelID: z.string(),
                    providerName: z.string().optional(),
                    modelName: z.string().optional(),
                  }).optional(),
                ),
              },
            },
          },
        },
      }),
      async (c) => {
        // Call TUI to get current model
        const result = await callTui(c)
        return c.json(result)
      },
    )
    .get(
      "/tui/get-agent",
      describeRoute({
        description: "Get currently selected agent in TUI",
        operationId: "tui.getAgent",
        responses: {
          200: {
            description: "Current agent information",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    agentName: z.string(),
                    displayName: z.string().optional(),
                  }).optional(),
                ),
              },
            },
          },
        },
      }),
      async (c) => {
        // Call TUI to get current agent
        const result = await callTui(c)
        return c.json(result)
      },
    )
    .get(
      "/tui/active-session",
      describeRoute({
        description: "Get currently active session in TUI",
        operationId: "tui.getActiveSession",
        responses: {
          200: {
            description: "Current active session information",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    sessionID: z.string().optional(),
                    sessionInfo: Session.Info.optional(),
                  }).optional(),
                ),
              },
            },
          },
        },
      }),
      async (c) => {
        // Call TUI to get current active session
        const result = await callTui(c)
        return c.json(result)
      },
    )
    .post(
      "/tui/set-model",
      describeRoute({
        description: "Set current model in TUI (external control)",
        operationId: "tui.setModel",
        responses: {
          200: {
            description: "Model set command sent to TUI",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
        },
      }),
      zValidator(
        "json",
        z.object({
          providerID: z.string(),
          modelID: z.string(),
        }),
      ),
      async (c) => {
        // Send command to TUI to change model
        // This will trigger TUI to update its model and call notify-model-changed
        const result = await callTui(c)
        return c.json(result)
      },
    )
    .post(
      "/tui/set-agent",
      describeRoute({
        description: "Set current agent in TUI (external control)",
        operationId: "tui.setAgent",
        responses: {
          200: {
            description: "Agent set command sent to TUI",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
        },
      }),
      zValidator(
        "json",
        z.object({
          agentName: z.string(),
        }),
      ),
      async (c) => {
        // Send command to TUI to change agent  
        // This will trigger TUI to update its agent and call notify-agent-changed
        const result = await callTui(c)
        return c.json(result)
      },
    )
    .post(
      "/tui/notify-model-changed",
      describeRoute({
        description: "Internal API: TUI notifies server that model has changed",
        operationId: "tui.notifyModelChanged",
        responses: {
          200: {
            description: "Model change notification processed",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
        },
      }),
      zValidator(
        "json",
        z.object({
          providerID: z.string(),
          modelID: z.string(),
          providerName: z.string().optional(),
          modelName: z.string().optional(),
        }),
      ),
      async (c) => {
        const body = c.req.valid("json")
        
        // Update server's understanding of current model
        const currentSelection = Instance.state(() => ({
          model: undefined as { providerID: string; modelID: string; providerName?: string; modelName?: string } | undefined,
        }))()
        
        currentSelection.model = {
          providerID: body.providerID,
          modelID: body.modelID,
          providerName: body.providerName,
          modelName: body.modelName,
        }
        
        // Emit model changed event for external listeners
        await Bus.publish(Server.Event.ModelChanged, body)
        
        return c.json(true)
      },
    )
    .post(
      "/tui/notify-agent-changed",
      describeRoute({
        description: "Internal API: TUI notifies server that agent has changed",
        operationId: "tui.notifyAgentChanged",
        responses: {
          200: {
            description: "Agent change notification processed",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
        },
      }),
      zValidator(
        "json",
        z.object({
          agentName: z.string(),
          displayName: z.string().optional(),
        }),
      ),
      async (c) => {
        const body = c.req.valid("json")
        
        // Update server's understanding of current agent
        const currentSelection = Instance.state(() => ({
          agent: undefined as { agentName: string; displayName?: string } | undefined,
        }))()
        
        currentSelection.agent = {
          agentName: body.agentName,
          displayName: body.displayName,
        }
        
        // Emit agent changed event for external listeners
        await Bus.publish(Server.Event.AgentChanged, body)
        
        return c.json(true)
      },
    )
    .post(
      "/tui/update-output-style",
      describeRoute({
        description: "Update the output style in TUI",
        operationId: "tui.updateOutputStyle",
        responses: {
          200: {
            description: "Output style updated successfully",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
        },
      }),
      zValidator(
        "json",
        z.object({
          styleName: z.string(),
        }),
      ),
      async (c) => c.json(await callTui(c)),
    )
    .get(
      "/tui/get-output-style",
      describeRoute({
        description: "Get the current output style from TUI",
        operationId: "tui.getOutputStyle",
        responses: {
          200: {
            description: "Current output style retrieved",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    styleName: z.string(),
                  }),
                ),
              },
            },
          },
        },
      }),
      async (c) => c.json(await callTui(c)),
    )
    .post(
      "/tui/show-toast",
      describeRoute({
        description: "Show a toast notification in the TUI",
        operationId: "tui.showToast",
        responses: {
          200: {
            description: "Toast notification shown successfully",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
        },
      }),
      zValidator(
        "json",
        z.object({
          title: z.string().optional(),
          message: z.string(),
          variant: z.enum(["info", "success", "warning", "error"]),
        }),
      ),
      async (c) => c.json(await callTui(c)),
    )
    .route("/tui/control", TuiRoute)
    .route("/web", createWebRoutes())
    .route("/git", createGitRoutes())
    .route("/", createFileRoutes())
    .route("/", createMCPRoutes())
    .route("/", createDebugLogsRoutes())
    .route("/", createHttpLogsRoutes())
    .put(
      "/auth/:id",
      describeRoute({
        description: "Set authentication credentials",
        operationId: "auth.set",
        responses: {
          200: {
            description: "Successfully set authentication credentials",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...ERRORS,
        },
      }),
      zValidator(
        "param",
        z.object({
          id: z.string(),
        }),
      ),
      zValidator("json", Auth.Info),
      async (c) => {
        const id = c.req.valid("param").id
        const info = c.req.valid("json")
        await Auth.set(id, info)
        return c.json(true)
      },
    )
    .get(
      "/websocket/connections",
      describeRoute({
        description: "Get active WebSocket connections",
        operationId: "websocket.connections",
        responses: {
          200: {
            description: "List of active WebSocket connections",
            content: {
              "application/json": {
                schema: resolver(
                  z.array(
                    z.object({
                      id: z.string(),
                      sessionId: z.string().optional(),
                      directory: z.string().optional(),
                      subscriptions: z.array(z.string()),
                      authenticated: z.boolean(),
                      lastActivity: z.number(),
                    })
                  )
                ),
              },
            },
          },
        },
      }),
      async (c) => {
        const connections = WebSocketHandler.getAllConnections()
        return c.json(connections)
      },
    )
    .get(
      "/websocket/connection/:id",
      describeRoute({
        description: "Get specific WebSocket connection info",
        operationId: "websocket.connection",
        responses: {
          200: {
            description: "WebSocket connection info",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    id: z.string(),
                    sessionId: z.string().optional(),
                    directory: z.string().optional(),
                    subscriptions: z.array(z.string()),
                    authenticated: z.boolean(),
                    lastActivity: z.number(),
                  }).nullable()
                ),
              },
            },
          },
        },
      }),
      zValidator(
        "param",
        z.object({
          id: z.string(),
        }),
      ),
      async (c) => {
        const connectionId = c.req.valid("param").id
        const info = WebSocketHandler.getConnectionInfo(connectionId)
        return c.json(info)
      },
    )
    .post(
      describeRoute({
        description: "Generate text using AI with specified provider, model, prompts and tools",
        operationId: "completions.generateText",
        responses: {
          200: {
            description: "Successfully generated text response",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    text: z.string(),
                    usage: z.object({
                      promptTokens: z.number(),
                      completionTokens: z.number(),
                      totalTokens: z.number(),
                    }).optional(),
                    finishReason: z.enum(["stop", "length", "content-filter", "tool-calls", "error", "other", "unknown"]).optional(),
                  }).openapi({
                    ref: "GenerateTextResponse",
                  }),
                ),
              },
            },
          },
          ...ERRORS,
        },
      }),
      zValidator(
        "json",
        z.object({
          provider: z.string().optional().default("github-copilot").openapi({ description: "AI provider ID (defaults to github-copilot)" }),
          model: z.string().optional().openapi({ description: "Model ID (defaults to small model for provider)" }),
          messages: z.array(
            z.object({
              role: z.enum(["system", "user", "assistant"]),
              content: z.string(),
            })
          ).openapi({ description: "Array of message objects with role and content" }),
          tools: z.union([
            z.literal("*"),
            z.array(z.string()),
          ]).optional().default([]).openapi({ description: "Tools to make available ('*' for all or array of tool IDs)" }),
          maxTokens: z.number().optional().openapi({ description: "Maximum tokens to generate" }),
        }),
      ),
      async (c) => {
        try {
          const body = c.req.valid("json")
          
          // Get or default provider
          const providerID = body.provider || "github-copilot"
          
          // Get provider
          const provider = await Provider.getProvider(providerID)
          if (!provider) {
            return c.json({ error: `Provider '${providerID}' not found` }, 400)
          }
          
          // Get or default model
          let modelID = body.model
          if (!modelID) {
            const smallModel = await Provider.getSmallModel(providerID)
            if (smallModel) {
              modelID = smallModel.modelID
            } else {
              // Fallback to first available model
              const firstModel = Object.keys(provider.info.models)[0]
              if (!firstModel) {
                return c.json({ error: `No models available for provider '${providerID}'` }, 400)
              }
              modelID = firstModel
            }
          }
          
          // Get the model
          const model = await Provider.getModel(providerID, modelID)
          if (!model) {
            return c.json({ error: `Model '${modelID}' not found for provider '${providerID}'` }, 400)
          }
          
          // Get available tools
          let tools = undefined
          if (body.tools && (body.tools === "*" || (Array.isArray(body.tools) && body.tools.length > 0))) {
            if (body.tools === "*") {
              // Get all available tools
              const allTools = await ToolRegistry.tools(providerID, modelID)
              tools = allTools
                .filter(tool => tool.parameters && typeof tool.parameters === 'object')
                .map(tool => ({
                  type: "function" as const,
                  function: {
                    name: tool.id,
                    description: tool.description || `Tool: ${tool.id}`,
                    parameters: tool.parameters,
                  }
                }))
            } else if (Array.isArray(body.tools)) {
              // Get specific tools
              const allTools = await ToolRegistry.tools(providerID, modelID)
              tools = allTools
                .filter(tool => body.tools.includes(tool.id) && tool.parameters && typeof tool.parameters === 'object')
                .map(tool => ({
                  type: "function" as const,
                  function: {
                    name: tool.id,
                    description: tool.description || `Tool: ${tool.id}`,
                    parameters: tool.parameters,
                  }
                }))
            }
          }
          
          // Prepare generation options
          const generateOptions: any = {
            model: model.language,
            messages: body.messages,
          }
          
          if (tools && tools.length > 0) {
            generateOptions.tools = tools
          }
          
          if (body.maxTokens) {
            generateOptions.maxTokens = body.maxTokens
          }
          
          // Generate text
          const result = await generateText(generateOptions)
          
          return c.json({
            text: result.text,
            usage: result.usage ? {
              promptTokens: result.usage.inputTokens || 0,
              completionTokens: result.usage.outputTokens || 0,
              totalTokens: (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0),
            } : undefined,
            finishReason: result.finishReason,
          })
          
        } catch (error) {
          log.error("generate-text failed", { error })
          if (error instanceof NamedError) {
            return c.json(error.toObject(), { status: 400 })
          }
          return c.json(new NamedError.Unknown({ message: String(error) }).toObject(), { status: 400 })
        }
      },
    )

  export async function openapi() {
    const result = await generateSpecs(App, {
      documentation: {
        info: {
          title: "supercode",
          version: "1.0.0",
          description: "supercode api",
        },
        openapi: "3.1.1",
      },
    })
    return result
  }

  export function listen(opts: { port: number; hostname: string }) {
    // Initialize WebSocket handler with the app before starting server
    WebSocketHandler.initialize(App)
    
    const server = Bun.serve({
      port: opts.port,
      hostname: opts.hostname,
      idleTimeout: 0,
      fetch: (req, server) => {
        // Check if this is a WebSocket upgrade request
        if (server && server.upgrade && server.upgrade(req, {
          data: {
            connectionId: "", // Will be set in open handler
            directory: new URL(req.url).searchParams.get("directory") || process.cwd(),
            sessionId: req.headers.get("x-session-id") || undefined,
          },
        })) {
          return // Return nothing if upgrade was successful
        }

        // Otherwise handle as normal HTTP request
        return App.fetch(req)
      },
      websocket: {
        open: WebSocketHandler.handleOpen.bind(WebSocketHandler),
        message: WebSocketHandler.handleMessage.bind(WebSocketHandler),
        close: WebSocketHandler.handleClose.bind(WebSocketHandler),
        // Configure WebSocket settings
        maxPayloadLength: 16 * 1024 * 1024, // 16MB max message size
        idleTimeout: 120, // 2 minutes idle timeout
        backpressureLimit: 1024 * 1024, // 1MB backpressure limit
        closeOnBackpressureLimit: false,
        perMessageDeflate: true, // Enable compression
      },
    })
    
    log.info("Server started with WebSocket support", {
      port: opts.port,
      hostname: opts.hostname,
      websocket: true,
    })
    
    return server
  }
}
