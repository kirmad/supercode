import { Hono } from "hono"
import { describeRoute } from "hono-openapi"
import { resolver, validator as zValidator } from "hono-openapi/zod"
import { z } from "zod"
import path from "node:path"
import fs from "node:fs/promises"
import { NamedError } from "../util/error"
import { Log } from "../util/log"
import { Instance } from "../project/instance"

const log = Log.create({ service: "file-routes" })

// TypeScript interfaces as Zod schemas
const CommentResponse = z.object({
  id: z.string(),
  author: z.object({
    type: z.enum(["ai", "user"]),
    name: z.string(),
  }),
  content: z.string(),
  createdAt: z.string(),
  sessionId: z.string().optional(),
})

const SavedComment = z.object({
  id: z.string(),
  threadId: z.string(),
  parentId: z.string().optional(),
  sessionId: z.string().optional(),
  status: z.enum(["open", "pending", "resolved", "dismissed"]),
  createdAt: z.string(),
  updatedAt: z.string(),
  file: z.string(),
  lines: z.object({
    start: z.number(),
    end: z.number(),
  }),
  type: z.enum(["issue", "suggestion", "praise"]),
  severity: z.enum(["high", "medium", "low"]),
  message: z.string(),
  fixCode: z.string().optional(),
  author: z.object({
    type: z.enum(["ai", "user"]),
    name: z.string(),
  }),
  responses: z.array(CommentResponse),
})

const SavedCodeReview = z.object({
  id: z.string(),
  metadata: z.object({
    title: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    status: z.enum(["draft", "active", "completed", "archived"]),
    version: z.number(),
  }),
  source: z.object({
    type: z.enum(["branches", "commit", "diff", "staged"]),
    sourceBranch: z.string().optional(),
    targetBranch: z.string().optional(),
    commitHash: z.string().optional(),
    customDiff: z.string().optional(),
    diffContent: z.string(),
    diffFiles: z.array(z.any()),
  }),
  analysis: z.object({
    insights: z.array(z.any()),
    hunks: z.array(z.any()),
    aiSessionId: z.string().optional(),
  }),
  comments: z.array(SavedComment),
})

const ReviewMetadata = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: z.enum(["draft", "active", "completed", "archived"]),
  version: z.number(),
  filename: z.string(),
})

// Helper functions
async function ensureReviewsDirectory(): Promise<string> {
  const reviewsDir = path.join(Instance.directory, "reviews")
  try {
    await fs.access(reviewsDir)
  } catch {
    await fs.mkdir(reviewsDir, { recursive: true })
    log.info("Created reviews directory", { path: reviewsDir })
  }
  return reviewsDir
}

function generateReviewFilename(id: string): string {
  const timestamp = Date.now()
  return `review-${id}-${timestamp}.json`
}

async function saveReviewToFile(review: z.infer<typeof SavedCodeReview>): Promise<void> {
  const reviewsDir = await ensureReviewsDirectory()
  const filename = generateReviewFilename(review.id)
  const filepath = path.join(reviewsDir, filename)

  try {
    await fs.writeFile(filepath, JSON.stringify(review, null, 2), "utf-8")
    log.info("Saved review to file", { id: review.id, filepath })
  } catch (error) {
    log.error("Failed to save review", { id: review.id, error })
    throw new NamedError.Unknown({ message: `Failed to save review: ${error}` })
  }
}

async function loadReviewFromFile(id: string): Promise<z.infer<typeof SavedCodeReview> | null> {
  const reviewsDir = await ensureReviewsDirectory()

  try {
    const files = await fs.readdir(reviewsDir)
    const reviewFile = files.find(file => file.startsWith(`review-${id}-`) && file.endsWith('.json'))

    if (!reviewFile) {
      return null
    }

    const filepath = path.join(reviewsDir, reviewFile)
    const content = await fs.readFile(filepath, "utf-8")
    const parsed = JSON.parse(content)

    // Validate the structure
    const review = SavedCodeReview.parse(parsed)
    return review
  } catch (error) {
    log.error("Failed to load review", { id, error })
    return null
  }
}

async function listAllReviews(): Promise<z.infer<typeof ReviewMetadata>[]> {
  const reviewsDir = await ensureReviewsDirectory()

  try {
    const files = await fs.readdir(reviewsDir)
    const reviewFiles = files.filter(file => file.startsWith('review-') && file.endsWith('.json'))

    const reviews: z.infer<typeof ReviewMetadata>[] = []

    for (const file of reviewFiles) {
      try {
        const filepath = path.join(reviewsDir, file)
        const content = await fs.readFile(filepath, "utf-8")
        const parsed = JSON.parse(content)

        // Extract metadata
        const review = SavedCodeReview.parse(parsed)
        reviews.push({
          id: review.id,
          title: review.metadata.title,
          createdAt: review.metadata.createdAt,
          updatedAt: review.metadata.updatedAt,
          status: review.metadata.status,
          version: review.metadata.version,
          filename: file,
        })
      } catch (error) {
        log.warn("Failed to parse review file", { file, error })
        // Continue with other files
      }
    }

    // Sort by updatedAt descending
    reviews.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

    return reviews
  } catch (error) {
    log.error("Failed to list reviews", { error })
    throw new NamedError.Unknown({ message: `Failed to list reviews: ${error}` })
  }
}

async function deleteReviewFile(id: string): Promise<boolean> {
  const reviewsDir = await ensureReviewsDirectory()

  try {
    const files = await fs.readdir(reviewsDir)
    const reviewFile = files.find(file => file.startsWith(`review-${id}-`) && file.endsWith('.json'))

    if (!reviewFile) {
      return false
    }

    const filepath = path.join(reviewsDir, reviewFile)
    await fs.unlink(filepath)
    log.info("Deleted review file", { id, filepath })
    return true
  } catch (error) {
    log.error("Failed to delete review", { id, error })
    throw new NamedError.Unknown({ message: `Failed to delete review: ${error}` })
  }
}

async function updateReviewInFile(review: z.infer<typeof SavedCodeReview>): Promise<void> {
  // Delete old file and create new one to ensure filename consistency
  await deleteReviewFile(review.id)
  await saveReviewToFile(review)
}

export function createFileRoutes() {
  return new Hono()
    // Save a review to local JSON file
    .post(
      "/reviews/save",
      describeRoute({
        description: "Save a code review to local JSON file",
        operationId: "reviews.save",
        responses: {
          200: {
            description: "Review saved successfully",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    success: z.boolean(),
                    id: z.string(),
                    filename: z.string(),
                  })
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
                  })
                ),
              },
            },
          },
        },
      }),
      zValidator("json", SavedCodeReview),
      async (c) => {
        try {
          const review = c.req.valid("json")

          // Update metadata
          review.metadata.updatedAt = new Date().toISOString()

          await saveReviewToFile(review)
          const filename = generateReviewFilename(review.id)

          return c.json({
            success: true,
            id: review.id,
            filename,
          })
        } catch (error) {
          log.error("Save review failed", { error })
          if (error instanceof NamedError) {
            return c.json({ error: error.message }, 400)
          }
          return c.json({ error: `Failed to save review: ${error}` }, 400)
        }
      }
    )

    // List all saved reviews with metadata
    .get(
      "/reviews",
      describeRoute({
        description: "List all saved code reviews with metadata",
        operationId: "reviews.list",
        responses: {
          200: {
            description: "List of review metadata",
            content: {
              "application/json": {
                schema: resolver(z.array(ReviewMetadata)),
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
                  })
                ),
              },
            },
          },
        },
      }),
      async (c) => {
        try {
          const reviews = await listAllReviews()
          return c.json(reviews)
        } catch (error) {
          log.error("List reviews failed", { error })
          if (error instanceof NamedError) {
            return c.json({ error: error.message }, 400)
          }
          return c.json({ error: `Failed to list reviews: ${error}` }, 400)
        }
      }
    )

    // Load a specific review by ID
    .get(
      "/reviews/:id",
      describeRoute({
        description: "Load a specific code review by ID",
        operationId: "reviews.get",
        responses: {
          200: {
            description: "Review data",
            content: {
              "application/json": {
                schema: resolver(SavedCodeReview),
              },
            },
          },
          404: {
            description: "Review not found",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    error: z.string(),
                  })
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
                  })
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
        })
      ),
      async (c) => {
        try {
          const { id } = c.req.valid("param")
          const review = await loadReviewFromFile(id)

          if (!review) {
            return c.json({ error: "Review not found" }, 404)
          }

          return c.json(review)
        } catch (error) {
          log.error("Get review failed", { error })
          if (error instanceof NamedError) {
            return c.json({ error: error.message }, 400)
          }
          return c.json({ error: `Failed to get review: ${error}` }, 400)
        }
      }
    )

    // Delete a review
    .delete(
      "/reviews/:id",
      describeRoute({
        description: "Delete a code review by ID",
        operationId: "reviews.delete",
        responses: {
          200: {
            description: "Review deleted successfully",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    success: z.boolean(),
                  })
                ),
              },
            },
          },
          404: {
            description: "Review not found",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    error: z.string(),
                  })
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
                  })
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
        })
      ),
      async (c) => {
        try {
          const { id } = c.req.valid("param")
          const deleted = await deleteReviewFile(id)

          if (!deleted) {
            return c.json({ error: "Review not found" }, 404)
          }

          return c.json({ success: true })
        } catch (error) {
          log.error("Delete review failed", { error })
          if (error instanceof NamedError) {
            return c.json({ error: error.message }, 400)
          }
          return c.json({ error: `Failed to delete review: ${error}` }, 400)
        }
      }
    )

    // Add user response to comment thread
    .post(
      "/reviews/:id/comments/:commentId/respond",
      describeRoute({
        description: "Add user response to a comment thread in a review",
        operationId: "reviews.addCommentResponse",
        responses: {
          200: {
            description: "Response added successfully",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    success: z.boolean(),
                    responseId: z.string(),
                  })
                ),
              },
            },
          },
          404: {
            description: "Review or comment not found",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    error: z.string(),
                  })
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
                  })
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
          commentId: z.string(),
        })
      ),
      zValidator(
        "json",
        z.object({
          content: z.string(),
          author: z.object({
            type: z.enum(["ai", "user"]),
            name: z.string(),
          }),
          sessionId: z.string().optional(),
        })
      ),
      async (c) => {
        try {
          const { id, commentId } = c.req.valid("param")
          const { content, author, sessionId } = c.req.valid("json")

          const review = await loadReviewFromFile(id)
          if (!review) {
            return c.json({ error: "Review not found" }, 404)
          }

          // Find the comment
          const comment = review.comments.find(c => c.id === commentId)
          if (!comment) {
            return c.json({ error: "Comment not found" }, 404)
          }

          // Generate response ID
          const responseId = `response-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

          // Create new response
          const response = {
            id: responseId,
            author,
            content,
            createdAt: new Date().toISOString(),
            sessionId,
          }

          // Add response to comment
          comment.responses.push(response)
          comment.updatedAt = new Date().toISOString()

          // Update review metadata
          review.metadata.updatedAt = new Date().toISOString()
          review.metadata.version += 1

          // Save updated review
          await updateReviewInFile(review)

          return c.json({
            success: true,
            responseId,
          })
        } catch (error) {
          log.error("Add comment response failed", { error })
          if (error instanceof NamedError) {
            return c.json({ error: error.message }, 400)
          }
          return c.json({ error: `Failed to add response: ${error}` }, 400)
        }
      }
    )
}