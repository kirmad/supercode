import "zod-openapi/extend"
import { Hono } from "hono"
import { describeRoute } from "hono-openapi"
import { resolver, validator as zValidator } from "hono-openapi/zod"
import { z } from "zod"
import { exec } from "child_process"
import { promisify } from "util"
import { Log } from "../util/log"

const execAsync = promisify(exec)
const log = Log.create({ service: "git-routes" })

// Schema definitions
const GitDiffSchema = z.object({
  sourceBranch: z.string().optional(),
  targetBranch: z.string().optional(),
  commitHash: z.string().optional(),
  staged: z.boolean().optional(),
}).openapi({ ref: "GitDiffRequest" })

const GitFileContentSchema = z.object({
  path: z.string(),
  ref: z.string().optional(), // branch, commit, or HEAD
}).openapi({ ref: "GitFileContentRequest" })

const GitStatusSchema = z.object({
  branch: z.string(),
  ahead: z.number(),
  behind: z.number(),
  modified: z.array(z.string()),
  staged: z.array(z.string()),
  untracked: z.array(z.string()),
})

const GitDiffResponseSchema = z.object({
  diff: z.string(),
  files: z.array(z.object({
    path: z.string(),
    additions: z.number(),
    deletions: z.number(),
  })),
})

export function createGitRoutes() {
  const gitApp = new Hono()

  // Get git diff
  gitApp.post(
    "/diff",
    describeRoute({
      description: "Get git diff for branches, commits, or working directory",
      operationId: "git.diff",
      responses: {
        200: {
          description: "Git diff output",
          content: {
            "application/json": {
              schema: resolver(GitDiffResponseSchema),
            },
          },
        },
      },
    }),
    zValidator("json", GitDiffSchema),
    async (c) => {
      try {
        const body = c.req.valid("json")
        let diffCommand = "git diff"

        if (body.staged) {
          diffCommand = "git diff --cached"
        } else if (body.sourceBranch && body.targetBranch) {
          diffCommand = `git diff ${body.targetBranch}...${body.sourceBranch}`
        } else if (body.commitHash) {
          diffCommand = `git diff ${body.commitHash}^ ${body.commitHash}`
        }

        // Get the diff
        const { stdout: diff } = await execAsync(diffCommand, {
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        })

        // Get file stats
        const { stdout: stats } = await execAsync(`${diffCommand} --stat`, {
          maxBuffer: 1024 * 1024,
        })

        // Parse file stats
        const files: Array<{ path: string; additions: number; deletions: number }> = []
        const statLines = stats.split('\n').filter(line => line.includes('|'))

        for (const line of statLines) {
          const match = line.match(/^\s*(.+?)\s+\|\s+(\d+)\s+([\+\-]+)/)
          if (match) {
            const [, filePath] = match
            const additions = (match[3].match(/\+/g) || []).length
            const deletions = (match[3].match(/\-/g) || []).length
            files.push({
              path: filePath.trim(),
              additions,
              deletions,
            })
          }
        }

        return c.json({
          diff,
          files,
        })
      } catch (error) {
        log.error("Failed to get git diff", error as Record<string, any>)
        return c.json({ error: "Failed to get git diff" }, 500)
      }
    }
  )

  // Get file content at specific revision
  gitApp.post(
    "/file",
    describeRoute({
      description: "Get file content at specific git revision",
      operationId: "git.file",
      responses: {
        200: {
          description: "File content",
          content: {
            "application/json": {
              schema: resolver(z.object({
                content: z.string(),
                exists: z.boolean(),
              })),
            },
          },
        },
      },
    }),
    zValidator("json", GitFileContentSchema),
    async (c) => {
      try {
        const body = c.req.valid("json")
        const ref = body.ref || "HEAD"

        try {
          const { stdout } = await execAsync(`git show ${ref}:${body.path}`, {
            maxBuffer: 10 * 1024 * 1024,
          })

          return c.json({
            content: stdout,
            exists: true,
          })
        } catch {
          // File doesn't exist at this revision
          return c.json({
            content: "",
            exists: false,
          })
        }
      } catch (error) {
        log.error("Failed to get file content", error as Record<string, any>)
        return c.json({ error: "Failed to get file content" }, 500)
      }
    }
  )

  // Get git status
  gitApp.get(
    "/status",
    describeRoute({
      description: "Get current git status",
      operationId: "git.status",
      responses: {
        200: {
          description: "Git status",
          content: {
            "application/json": {
              schema: resolver(GitStatusSchema),
            },
          },
        },
      },
    }),
    async (c) => {
      try {
        // Get current branch
        const { stdout: branch } = await execAsync("git branch --show-current")

        // Get ahead/behind info
        let ahead = 0, behind = 0
        try {
          const { stdout: revList } = await execAsync(`git rev-list --left-right --count origin/${branch.trim()}...HEAD`)
          const [behindStr, aheadStr] = revList.trim().split('\t')
          behind = parseInt(behindStr) || 0
          ahead = parseInt(aheadStr) || 0
        } catch {
          // Branch might not have upstream
        }

        // Get file statuses
        const { stdout: statusOutput } = await execAsync("git status --porcelain")
        const lines = statusOutput.split('\n').filter(line => line.trim())

        const modified: string[] = []
        const staged: string[] = []
        const untracked: string[] = []

        for (const line of lines) {
          const status = line.substring(0, 2)
          const file = line.substring(3)

          if (status === '??') {
            untracked.push(file)
          } else if (status[0] !== ' ' && status[0] !== '?') {
            staged.push(file)
          } else if (status[1] !== ' ' && status[1] !== '?') {
            modified.push(file)
          }
        }

        return c.json({
          branch: branch.trim(),
          ahead,
          behind,
          modified,
          staged,
          untracked,
        })
      } catch (error) {
        log.error("Failed to get git status", error as Record<string, any>)
        return c.json({ error: "Failed to get git status" }, 500)
      }
    }
  )

  // Get list of branches
  gitApp.get(
    "/branches",
    describeRoute({
      description: "Get list of git branches",
      operationId: "git.branches",
      responses: {
        200: {
          description: "List of branches",
          content: {
            "application/json": {
              schema: resolver(z.object({
                current: z.string(),
                branches: z.array(z.string()),
              })),
            },
          },
        },
      },
    }),
    async (c) => {
      try {
        const { stdout: branchesOutput } = await execAsync("git branch -a")
        const lines = branchesOutput.split('\n').filter(line => line.trim())

        let current = ""
        const branches: string[] = []

        for (const line of lines) {
          const branch = line.trim()
          if (branch.startsWith('*')) {
            current = branch.substring(2)
            branches.push(current)
          } else if (!branch.includes('HEAD ->')) {
            branches.push(branch)
          }
        }

        return c.json({
          current,
          branches,
        })
      } catch (error) {
        log.error("Failed to get branches", error as Record<string, any>)
        return c.json({ error: "Failed to get branches" }, 500)
      }
    }
  )

  // Get recent commits
  gitApp.get(
    "/commits",
    describeRoute({
      description: "Get recent commits",
      operationId: "git.commits",
      responses: {
        200: {
          description: "List of commits",
          content: {
            "application/json": {
              schema: resolver(z.object({
                commits: z.array(z.object({
                  hash: z.string(),
                  shortHash: z.string(),
                  subject: z.string(),
                  author: z.string(),
                  date: z.string(),
                })),
              })),
            },
          },
        },
      },
    }),
    zValidator("query", z.object({
      limit: z.string().optional(),
      branch: z.string().optional(),
    })),
    async (c) => {
      try {
        const query = c.req.valid("query")
        const limit = query.limit || "20"
        const branch = query.branch || "HEAD"

        const { stdout } = await execAsync(
          `git log ${branch} -${limit} --pretty=format:"%H|%h|%s|%an|%ad" --date=relative`
        )

        const commits = stdout.split('\n').filter(line => line).map(line => {
          const [hash, shortHash, subject, author, date] = line.split('|')
          return { hash, shortHash, subject, author, date }
        })

        return c.json({ commits })
      } catch (error) {
        log.error("Failed to get commits", error as Record<string, any>)
        return c.json({ error: "Failed to get commits" }, 500)
      }
    }
  )

  return gitApp
}