import { Hono } from "hono"
import { describeRoute } from "hono-openapi"
import { resolver } from "hono-openapi/zod"
import { z } from "zod"

// Import the web app templates and static assets
import { getWebAppHTML } from "./web-templates"
import { getWebAppJS } from "./web-static"

export function createWebRoutes() {
  const webApp = new Hono()

  // Main web app route - serves the multi-tab interface
  webApp.get(
    "/",
    describeRoute({
      description: "Web application with multi-tab interface including API client",
      operationId: "web.app",
      responses: {
        200: {
          description: "Web application HTML",
          content: {
            "text/html": {
              schema: resolver(z.string()),
            },
          },
        },
      },
    }),
    async (c) => {
      const baseUrl = `${c.req.url.split('/web')[0]}`
      c.header("Cache-Control", "no-cache, no-store, must-revalidate")
      c.header("Pragma", "no-cache")
      c.header("Expires", "0")
      return c.html(getWebAppHTML(baseUrl))
    }
  )

  // Static JavaScript file for the web app
  webApp.get(
    "/static/app.js",
    describeRoute({
      description: "Static JavaScript for web application",
      operationId: "web.js",
      responses: {
        200: {
          description: "JavaScript file",
          content: {
            "application/javascript": {
              schema: resolver(z.string()),
            },
          },
        },
      },
    }),
    async (c) => {
      c.header("Cache-Control", "no-cache, no-store, must-revalidate")
      c.header("Pragma", "no-cache")
      c.header("Expires", "0")
      return new Response(getWebAppJS(), {
        headers: {
          "Content-Type": "application/javascript",
        },
      })
    }
  )

  // API for getting application info (used by the web interface)
  webApp.get(
    "/api/info",
    describeRoute({
      description: "Get web application info",
      operationId: "web.info", 
      responses: {
        200: {
          description: "Application info",
          content: {
            "application/json": {
              schema: resolver(
                z.object({
                  name: z.string(),
                  version: z.string(),
                  description: z.string(),
                  apiBaseUrl: z.string(),
                })
              ),
            },
          },
        },
      },
    }),
    async (c) => {
      const baseUrl = `${c.req.url.split('/web')[0]}`
      return c.json({
        name: "SuperCode Web Interface",
        version: "1.0.0",
        description: "Multi-tab web interface for SuperCode API",
        apiBaseUrl: baseUrl,
      })
    }
  )

  return webApp
}