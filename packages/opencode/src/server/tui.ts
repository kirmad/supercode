import { Hono, type Context } from "hono"
import { AsyncQueue } from "../util/queue"

interface Request {
  path: string
  body: any
}

const request = new AsyncQueue<Request>()
const response = new AsyncQueue<any>()

export async function callTui(ctx: Context) {
  let body = {}
  // Handle GET requests (like /tui/status) that don't have a body
  if (ctx.req.method !== "GET") {
    body = await ctx.req.json()
  }
  request.push({
    path: ctx.req.path,
    body,
  })
  return response.next()
}

// Helper function to send notifications to TUI without HTTP context
export async function sendToTUI(path: string, body: any = {}) {
  request.push({
    path,
    body,
  })
  return response.next()
}

// Helper function to get the current output style from TUI
export async function getTUIOutputStyle(): Promise<string | undefined> {
  try {
    const result = await sendToTUI("/tui/get-output-style")
    if (result && typeof result === "object" && "styleName" in result) {
      return result.styleName as string
    }
  } catch (err) {
    // Silently fail if TUI is not available
  }
  return undefined
}

export const TuiRoute = new Hono()
  .get("/next", async (c) => {
    const req = await request.next()
    return c.json(req)
  })
  .post("/response", async (c) => {
    let body = {}
    try {
      body = await c.req.json()
    } catch (e) {
      // If parsing fails or body is null/empty, treat as empty object
      body = {}
    }
    response.push(body)
    return c.json(true)
  })
