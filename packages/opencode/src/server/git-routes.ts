import "zod-openapi/extend"
import { Hono } from "hono"
import { describeRoute } from "hono-openapi"
import { resolver, validator as zValidator } from "hono-openapi/zod"
import { z } from "zod"
import { exec } from "child_process"
import { promisify } from "util"
import { writeFile, mkdtemp, rm } from "fs/promises"
import { join } from "path"
import { tmpdir } from "os"
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

const GitContentDiffSchema = z.object({
  oldContent: z.string().nullable(),
  newContent: z.string().nullable(),
  filePath: z.string(),
  changeType: z.string().optional(), // add, delete, modify
}).openapi({ ref: "GitContentDiffRequest" })


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

        // Get file stats using --numstat for accurate full paths
        const { stdout: stats } = await execAsync(`${diffCommand} --numstat`, {
          maxBuffer: 1024 * 1024,
        })

        // Parse file stats
        const files: Array<{ path: string; additions: number; deletions: number }> = []
        const statLines = stats.split('\n').filter(line => line.trim() && line.includes('\t'))

        for (const line of statLines) {
          const parts = line.split('\t')
          if (parts.length >= 3) {
            const additions = parseInt(parts[0]) || 0
            const deletions = parseInt(parts[1]) || 0
            const filePath = parts[2]
            files.push({
              path: filePath,
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

  // Generate optimized diff from file contents using git diff tools
  gitApp.post(
    "/content-diff",
    describeRoute({
      description: "Generate optimized git diff from file contents using git diff tools",
      operationId: "git.contentDiff",
      responses: {
        200: {
          description: "Optimized git diff output",
          content: {
            "application/json": {
              schema: resolver(z.object({
                diff: z.string(),
                stats: z.object({
                  additions: z.number(),
                  deletions: z.number(),
                  changes: z.number(),
                }),
              })),
            },
          },
        },
      },
    }),
    zValidator("json", GitContentDiffSchema),
    async (c) => {
      try {
        const body = c.req.valid("json")
        const { oldContent, newContent, filePath, changeType } = body

        log.info(`Generating content diff for ${filePath}, changeType: ${changeType}`, {
          oldContentLength: oldContent ? oldContent.length : 'null',
          newContentLength: newContent ? newContent.length : 'null'
        })

        // Validate input
        if (!oldContent && !newContent) {
          return c.json({
            diff: `diff --git a${filePath} b${filePath}\n--- a${filePath}\n+++ b${filePath}\n@@ -0,0 +0,0 @@\n[No content provided for comparison]\n`,
            stats: { additions: 0, deletions: 0, changes: 0 }
          })
        }

        if (oldContent === newContent) {
          return c.json({
            diff: `diff --git a${filePath} b${filePath}\n--- a${filePath}\n+++ b${filePath}\n@@ -0,0 +0,0 @@\n[Files are identical]\n`,
            stats: { additions: 0, deletions: 0, changes: 0 }
          })
        }

        // Create temporary directory for diff generation
        const tempDir = await mkdtemp(join(tmpdir(), 'git-diff-'))
        log.debug(`Created temp directory: ${tempDir}`)

        try {
          let diff = ""
          let additions = 0
          let deletions = 0

          const fileName = filePath.split('/').pop() || 'file'
          const oldFilePath = join(tempDir, `old-${fileName}`)
          const newFilePath = join(tempDir, `new-${fileName}`)

          // Escape function for regex
          function escapeRegExp(string: string): string {
            return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          }

          // Handle different change types
          if (changeType === 'add') {
            // For added files: diff /dev/null to new file
            if (newContent !== null) {
              await writeFile(newFilePath, newContent, 'utf8')
              log.debug(`Wrote new file for add: ${newFilePath} (${newContent.length} chars)`)

              const gitCommand = `git diff --no-index /dev/null "${newFilePath}" || true`
              log.debug(`Executing git command: ${gitCommand}`)

              const { stdout, stderr } = await execAsync(gitCommand, {
                cwd: tempDir,
                maxBuffer: 10 * 1024 * 1024,
              })

              log.debug(`Git command output length: ${stdout.length}, stderr: ${stderr || 'none'}`)

              diff = stdout.replace(/\/dev\/null/g, `a${filePath}`)
                        .replace(new RegExp(escapeRegExp(newFilePath), 'g'), `b${filePath}`)
                        .replace(/^diff --git.*$/m, `diff --git a${filePath} b${filePath}`)

              // Count additions from diff lines
              const lines = diff.split('\n')
              for (const line of lines) {
                if (line.startsWith('+') && !line.startsWith('+++')) {
                  additions++
                }
              }
              log.debug(`Processed add diff: ${diff.length} chars, ${additions} additions`)
            }
          } else if (changeType === 'delete') {
            // For deleted files: diff old file to /dev/null
            if (oldContent !== null) {
              await writeFile(oldFilePath, oldContent, 'utf8')
              log.debug(`Wrote old file for delete: ${oldFilePath} (${oldContent.length} chars)`)

              const gitCommand = `git diff --no-index "${oldFilePath}" /dev/null || true`
              log.debug(`Executing git command: ${gitCommand}`)

              const { stdout, stderr } = await execAsync(gitCommand, {
                cwd: tempDir,
                maxBuffer: 10 * 1024 * 1024,
              })

              log.debug(`Git command output length: ${stdout.length}, stderr: ${stderr || 'none'}`)

              diff = stdout.replace(new RegExp(escapeRegExp(oldFilePath), 'g'), `a${filePath}`)
                        .replace(/\/dev\/null/g, `b${filePath}`)
                        .replace(/^diff --git.*$/m, `diff --git a${filePath} b${filePath}`)

              // Count deletions from diff lines
              const lines = diff.split('\n')
              for (const line of lines) {
                if (line.startsWith('-') && !line.startsWith('---')) {
                  deletions++
                }
              }
              log.debug(`Processed delete diff: ${diff.length} chars, ${deletions} deletions`)
            }
          } else {
            // For modified files: diff old to new
            if (oldContent !== null && newContent !== null) {
              await writeFile(oldFilePath, oldContent, 'utf8')
              await writeFile(newFilePath, newContent, 'utf8')
              log.debug(`Wrote files for modify: old=${oldFilePath} (${oldContent.length} chars), new=${newFilePath} (${newContent.length} chars)`)

              const gitCommand = `git diff --no-index "${oldFilePath}" "${newFilePath}" || true`
              log.debug(`Executing git command: ${gitCommand}`)

              const { stdout, stderr } = await execAsync(gitCommand, {
                cwd: tempDir,
                maxBuffer: 10 * 1024 * 1024,
              })

              log.debug(`Git command output length: ${stdout.length}, stderr: ${stderr || 'none'}`)

              diff = stdout.replace(new RegExp(escapeRegExp(oldFilePath), 'g'), `a${filePath}`)
                        .replace(new RegExp(escapeRegExp(newFilePath), 'g'), `b${filePath}`)
                        .replace(/^diff --git.*$/m, `diff --git a${filePath} b${filePath}`)

              // Count additions and deletions from diff
              const lines = diff.split('\n')
              for (const line of lines) {
                if (line.startsWith('+') && !line.startsWith('+++')) {
                  additions++
                } else if (line.startsWith('-') && !line.startsWith('---')) {
                  deletions++
                }
              }
              log.debug(`Processed modify diff: ${diff.length} chars, +${additions} -${deletions}`)
            }
          }

          log.info(`Generated diff for ${filePath}: ${diff.length} chars, +${additions} -${deletions} changes`)

          return c.json({
            diff,
            stats: {
              additions,
              deletions,
              changes: additions + deletions,
            },
          })

        } finally {
          // Cleanup temporary files
          try {
            await rm(tempDir, { recursive: true, force: true })
          } catch (cleanupError) {
            log.warn("Failed to cleanup temp directory", { tempDir, error: cleanupError })
          }
        }
      } catch (error) {
        log.error("Failed to generate content diff", error as Record<string, any>)
        return c.json({ error: "Failed to generate content diff" }, 500)
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