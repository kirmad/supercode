import { Hono } from "hono"
import { cors } from "hono/cors"
import { validator as zValidator } from "hono-openapi/zod"
import { describeRoute } from "hono-openapi"
import { resolver } from "hono-openapi/zod"
import { z } from "zod"
import { FileService } from "../services/file-service"
import { Log } from "../util/log"
import { NamedError } from "../util/error"

export function createFileOperationsRoutes() {
  const app = new Hono()
  const log = Log.create({ service: "file-operations-routes" })

  // Enable CORS for all file routes
  app.use("/*", cors({
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

  // Write file content
  app.post(
    "/api/files/write",
    describeRoute({
      description: "Write content to a file",
      operationId: "files.write",
      responses: {
        200: {
          description: "File written successfully",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  success: z.boolean(),
                  path: z.string(),
                  size: z.number(),
                }).openapi({
                  ref: "FileWriteResponse",
                }),
              ),
            },
          },
        },
        400: {
          description: "Bad request",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  error: z.string(),
                  details: z.string().optional(),
                }).openapi({
                  ref: "FileError",
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
        path: z.string().min(1).openapi({ description: "File path relative to project root" }),
        content: z.string().openapi({ description: "File content to write" }),
      }),
    ),
    async (c) => {
      try {
        const { path, content } = c.req.valid("json")

        log.info("writing file", { path, size: content.length })

        await FileService.writeFile(path, content)

        return c.json({
          success: true,
          path,
          size: content.length,
        })
      } catch (error) {
        log.error("failed to write file", { error })
        if (error instanceof NamedError) {
          return c.json({ error: error.message, details: error.toObject().data }, { status: 400 })
        }
        return c.json(
          { error: "Failed to write file", details: String(error) },
          { status: 500 }
        )
      }
    },
  )

  // Read file content
  app.get(
    "/api/files/read",
    describeRoute({
      description: "Read content from a file",
      operationId: "files.read",
      responses: {
        200: {
          description: "File content",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  path: z.string(),
                  content: z.string(),
                  size: z.number(),
                }).openapi({
                  ref: "FileReadResponse",
                }),
              ),
            },
          },
        },
        404: {
          description: "File not found",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  error: z.string(),
                  details: z.string().optional(),
                }).openapi({
                  ref: "FileError",
                }),
              ),
            },
          },
        },
      },
    }),
    zValidator(
      "query",
      z.object({
        path: z.string().min(1).openapi({ description: "File path relative to project root" }),
      }),
    ),
    async (c) => {
      try {
        const { path } = c.req.valid("query")

        log.info("reading file", { path })

        const content = await FileService.readFile(path)

        return c.json({
          path,
          content,
          size: content.length,
        })
      } catch (error) {
        log.error("failed to read file", { error })
        if (error instanceof NamedError) {
          const status = error.name === "NotFound" ? 404 : 400
          return c.json({ error: error.message, details: error.toObject().data }, { status })
        }
        return c.json(
          { error: "Failed to read file", details: String(error) },
          { status: 500 }
        )
      }
    },
  )

  // List directory contents
  app.get(
    "/api/files/list",
    describeRoute({
      description: "List contents of a directory",
      operationId: "files.list",
      responses: {
        200: {
          description: "Directory contents",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  path: z.string(),
                  entries: z.array(
                    z.object({
                      name: z.string(),
                      path: z.string(),
                      type: z.enum(["file", "directory"]),
                      size: z.number().optional(),
                      modified: z.string().optional(),
                    })
                  ),
                }).openapi({
                  ref: "FileListResponse",
                }),
              ),
            },
          },
        },
        404: {
          description: "Directory not found",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  error: z.string(),
                  details: z.string().optional(),
                }).openapi({
                  ref: "FileError",
                }),
              ),
            },
          },
        },
      },
    }),
    zValidator(
      "query",
      z.object({
        path: z.string().default("").openapi({ description: "Directory path relative to project root (empty for root)" }),
      }),
    ),
    async (c) => {
      try {
        const { path } = c.req.valid("query")
        const dirPath = path || "."

        log.info("listing directory", { path: dirPath })

        const entries = await FileService.listDirectory(dirPath)

        // Convert Date objects to ISO strings for JSON serialization
        const serializedEntries = entries.map(entry => ({
          ...entry,
          modified: entry.modified?.toISOString(),
        }))

        return c.json({
          path: dirPath,
          entries: serializedEntries,
        })
      } catch (error) {
        log.error("failed to list directory", { error })
        if (error instanceof NamedError) {
          const status = error.name === "NotFound" ? 404 : 400
          return c.json({ error: error.message, details: error.toObject().data }, { status })
        }
        return c.json(
          { error: "Failed to list directory", details: String(error) },
          { status: 500 }
        )
      }
    },
  )

  // Delete file or directory
  app.delete(
    "/api/files/delete",
    describeRoute({
      description: "Delete a file or directory",
      operationId: "files.delete",
      responses: {
        200: {
          description: "File or directory deleted successfully",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  success: z.boolean(),
                  path: z.string(),
                  type: z.enum(["file", "directory"]),
                }).openapi({
                  ref: "FileDeleteResponse",
                }),
              ),
            },
          },
        },
        404: {
          description: "File or directory not found",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  error: z.string(),
                  details: z.string().optional(),
                }).openapi({
                  ref: "FileError",
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
        path: z.string().min(1).openapi({ description: "Path to file or directory to delete" }),
        type: z.enum(["file", "directory"]).openapi({ description: "Type of item to delete" }),
      }),
    ),
    async (c) => {
      try {
        const { path, type } = c.req.valid("json")

        log.info("deleting item", { path, type })

        if (type === "directory") {
          await FileService.deleteDirectory(path)
        } else {
          await FileService.deleteFile(path)
        }

        return c.json({
          success: true,
          path,
          type,
        })
      } catch (error) {
        log.error("failed to delete item", { error })
        if (error instanceof NamedError) {
          const status = error.name === "NotFound" ? 404 : 400
          return c.json({ error: error.message, details: error.toObject().data }, { status })
        }
        return c.json(
          { error: "Failed to delete item", details: String(error) },
          { status: 500 }
        )
      }
    },
  )

  // Create directory
  app.post(
    "/api/files/mkdir",
    describeRoute({
      description: "Create a directory",
      operationId: "files.mkdir",
      responses: {
        200: {
          description: "Directory created successfully",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  success: z.boolean(),
                  path: z.string(),
                  recursive: z.boolean(),
                }).openapi({
                  ref: "FileMkdirResponse",
                }),
              ),
            },
          },
        },
        400: {
          description: "Bad request",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  error: z.string(),
                  details: z.string().optional(),
                }).openapi({
                  ref: "FileError",
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
        path: z.string().min(1).openapi({ description: "Directory path to create" }),
        recursive: z.boolean().default(true).openapi({ description: "Create parent directories if they don't exist" }),
      }),
    ),
    async (c) => {
      try {
        const { path, recursive } = c.req.valid("json")

        log.info("creating directory", { path, recursive })

        await FileService.createDirectory(path, recursive)

        return c.json({
          success: true,
          path,
          recursive,
        })
      } catch (error) {
        log.error("failed to create directory", { error })
        if (error instanceof NamedError) {
          return c.json({ error: error.message, details: error.toObject().data }, { status: 400 })
        }
        return c.json(
          { error: "Failed to create directory", details: String(error) },
          { status: 500 }
        )
      }
    },
  )

  // Check if file/directory exists
  app.get(
    "/api/files/exists",
    describeRoute({
      description: "Check if a file or directory exists",
      operationId: "files.exists",
      responses: {
        200: {
          description: "Existence check result",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  path: z.string(),
                  exists: z.boolean(),
                  type: z.enum(["file", "directory"]).optional(),
                  size: z.number().optional(),
                  modified: z.string().optional(),
                  created: z.string().optional(),
                }).openapi({
                  ref: "FileExistsResponse",
                }),
              ),
            },
          },
        },
        400: {
          description: "Bad request",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  error: z.string(),
                  details: z.string().optional(),
                }).openapi({
                  ref: "FileError",
                }),
              ),
            },
          },
        },
      },
    }),
    zValidator(
      "query",
      z.object({
        path: z.string().min(1).openapi({ description: "Path to check" }),
      }),
    ),
    async (c) => {
      try {
        const { path } = c.req.valid("query")

        log.info("checking existence", { path })

        const exists = await FileService.exists(path)

        let stats: any = {}
        if (exists) {
          try {
            const statResult = await FileService.stat(path)
            stats = {
              type: statResult.type,
              size: statResult.size,
              modified: statResult.modified.toISOString(),
              created: statResult.created.toISOString(),
            }
          } catch {
            // Ignore stat errors, just return exists: true
          }
        }

        return c.json({
          path,
          exists,
          ...stats,
        })
      } catch (error) {
        log.error("failed to check existence", { error })
        if (error instanceof NamedError) {
          return c.json({ error: error.message, details: error.toObject().data }, { status: 400 })
        }
        return c.json(
          { error: "Failed to check existence", details: String(error) },
          { status: 500 }
        )
      }
    },
  )

  return app
}