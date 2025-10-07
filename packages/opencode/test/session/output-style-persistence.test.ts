import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { Session } from "../../src/session"
import { Storage } from "../../src/storage/storage"
import { Instance } from "../../src/project/instance"
import { Identifier } from "../../src/id/id"

describe("Session Output Style Persistence", () => {
  let sessionID: string
  let projectID: string

  beforeEach(async () => {
    // Create a test project and session
    projectID = "test-project-id"
    sessionID = Identifier.ascending("session")

    // Set up test project
    await Instance.provide("/tmp/test", async () => {
      // Create a test session
      await Session.createNext({
        id: sessionID,
        directory: "/tmp/test",
        title: "Test Session",
      })
    })
  })

  afterEach(async () => {
    // Clean up test data
    try {
      await Storage.remove(["session", projectID, sessionID])
      await Storage.remove(["project", projectID])
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  it("should persist output style to session when set via custom command", async () => {
    await Instance.provide("/tmp/test", async () => {
      // Initial session should not have output style
      const initialSession = await Session.get(sessionID)
      expect(initialSession.outputStyle).toBeUndefined()

      // Simulate setting output style via custom command
      const messageID = Identifier.ascending("message")
      await Session.prompt({
        sessionID,
        messageID,
        model: {
          providerID: "anthropic",
          modelID: "claude-3-5-sonnet-20241022",
        },
        outputStyle: "explanatory", // Setting custom output style
        parts: [{
          id: Identifier.ascending("part"),
          type: "text",
          text: "Test message with custom output style",
        }],
      })

      // Session should now have the output style persisted
      const updatedSession = await Session.get(sessionID)
      expect(updatedSession.outputStyle).toBe("explanatory")
    })
  })

  it("should use session's persisted output style for subsequent replies", async () => {
    await Instance.provide("/tmp/test", async () => {
      // First, set an output style
      await Session.update(sessionID, (draft) => {
        draft.outputStyle = "learning"
      })

      // Now prompt without specifying output style
      const messageID = Identifier.ascending("message")
      await Session.prompt({
        sessionID,
        messageID,
        model: {
          providerID: "anthropic",
          modelID: "claude-3-5-sonnet-20241022",
        },
        // No outputStyle specified - should use session's stored value
        parts: [{
          id: Identifier.ascending("part"),
          type: "text",
          text: "Test message without specifying output style",
        }],
      })

      // Verify the session still has the output style
      const session = await Session.get(sessionID)
      expect(session.outputStyle).toBe("learning")
    })
  })

  it("should preserve output style through session compaction", async () => {
    await Instance.provide("/tmp/test", async () => {
      // Set output style in session
      await Session.update(sessionID, (draft) => {
        draft.outputStyle = "explanatory"
      })

      // Perform compaction
      await Session.enhanced_summarize({
        sessionID,
        providerID: "anthropic",
        modelID: "claude-3-5-sonnet-20241022",
      })

      // Verify output style is still preserved after compaction
      const session = await Session.get(sessionID)
      expect(session.outputStyle).toBe("explanatory")
    })
  })

  it("should override session output style when new style is provided", async () => {
    await Instance.provide("/tmp/test", async () => {
      // Set initial output style
      await Session.update(sessionID, (draft) => {
        draft.outputStyle = "learning"
      })

      // Now set a different output style via custom command
      const messageID = Identifier.ascending("message")
      await Session.prompt({
        sessionID,
        messageID,
        model: {
          providerID: "anthropic",
          modelID: "claude-3-5-sonnet-20241022",
        },
        outputStyle: "explanatory", // Override with different style
        parts: [{
          id: Identifier.ascending("part"),
          type: "text",
          text: "Test message with new output style",
        }],
      })

      // Session should now have the new output style
      const updatedSession = await Session.get(sessionID)
      expect(updatedSession.outputStyle).toBe("explanatory")
    })
  })
})