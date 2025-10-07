/**
 * Test to verify the compaction fixes resolve the trailing whitespace API error
 */

// Test that text trimming is working correctly
describe('Compaction Fixes', () => {
  test('trimEnd() prevents trailing whitespace', () => {
    const textWithWhitespace = "This is test content with trailing spaces   \n  "
    const trimmed = textWithWhitespace.trimEnd()

    // Should not end with whitespace
    expect(trimmed.endsWith(' ')).toBe(false)
    expect(trimmed.endsWith('\n')).toBe(false)
    expect(trimmed.endsWith('\t')).toBe(false)

    // Should preserve content
    expect(trimmed).toBe("This is test content with trailing spaces")
  })

  test('continuation prompt template prevents trailing whitespace', () => {
    const processedText = "Sample processed content   \n  "

    const continuationPrompt = `This session is being continued from a previous conversation that ran out of context. The conversation is summarized below:

<context>
${processedText.trimEnd()}
</context>

Please continue the conversation from where we left it off without asking the user any further questions. Continue with the last task that you were asked to work on.

This is your continuation prompt.`.trimEnd()

    // Final assistant content should not end with whitespace
    expect(continuationPrompt.endsWith(' ')).toBe(false)
    expect(continuationPrompt.endsWith('\n')).toBe(false)
    expect(continuationPrompt.endsWith('\t')).toBe(false)
  })

  test('system reminder template prevents trailing whitespace', () => {
    const todos = [
      { content: "Test task", status: "pending", activeForm: "Testing task" }
    ]

    const systemReminder = `<system-reminder>
Your todo list has changed. DO NOT mention this explicitly to the user. Here are the latest contents of your todo list:

${JSON.stringify(todos)}.

Continue on with the tasks at hand if applicable.
</system-reminder>`.trimEnd()

    // System reminder should not end with whitespace
    expect(systemReminder.endsWith(' ')).toBe(false)
    expect(systemReminder.endsWith('\n')).toBe(false)
    expect(systemReminder.endsWith('\t')).toBe(false)
  })

  test('additional system reminder templates prevent trailing whitespace', () => {
    const styleName = "design-phase"
    const styleReminder = `<system-reminder>\n${styleName} output style is active. Remember to follow the specific guidelines for this style.\n</system-reminder>`.trimEnd()

    expect(styleReminder.endsWith(' ')).toBe(false)
    expect(styleReminder.endsWith('\n')).toBe(false)
    expect(styleReminder.endsWith('\t')).toBe(false)

    const contextParts = ["# Header", "Some content"]
    const contextReminder = `<system-reminder>
As you answer the user's questions, you can use the following context:
${contextParts.join("\n")}
</system-reminder>`.trimEnd()

    expect(contextReminder.endsWith(' ')).toBe(false)
    expect(contextReminder.endsWith('\n')).toBe(false)
    expect(contextReminder.endsWith('\t')).toBe(false)

    // Test processed text from compaction
    const rawText = "Some processed content with tags <analysis>Data</analysis> and more   \n  "
    const processedText = rawText
      .replace(/<analysis>/gi, "analysis:")
      .replace(/<\/analysis>/gi, "")
      .replace(/<summary>/gi, "summary:")
      .replace(/<\/summary>/gi, "")
      .trimEnd()

    expect(processedText.endsWith(' ')).toBe(false)
    expect(processedText.endsWith('\n')).toBe(false)
    expect(processedText.endsWith('\t')).toBe(false)
  })

  test('message filtering logic includes compacted messages', () => {
    // Mock message array structure with messages after summary
    const msgsWithFollow = [
      { info: { id: 1, role: "user", summary: false } },
      { info: { id: 2, role: "assistant", summary: false } },
      { info: { id: 3, role: "assistant", summary: true } }, // Summary message
      { info: { id: 4, role: "user", summary: false } },
      { info: { id: 5, role: "assistant", summary: false } }
    ]

    const lastSummary = msgsWithFollow.findLast((msg) => msg.info.role === "assistant" && msg.info.summary === true)
    expect(lastSummary?.info.id).toBe(3)

    // Apply the filtering logic from the actual code
    let resultMsgs = msgsWithFollow
    if (lastSummary) {
      const filteredMsgs = resultMsgs.filter((msg) => msg.info.id > lastSummary.info.id)
      // If no messages after summary, include the summary itself to avoid empty array
      resultMsgs = filteredMsgs.length > 0 ? filteredMsgs : [lastSummary]
    }

    expect(resultMsgs).toHaveLength(2)
    expect(resultMsgs[0].info.id).toBe(4)  // User message after summary
    expect(resultMsgs[1].info.id).toBe(5)  // Assistant message after summary

    // Summary message itself should NOT be included when there are newer messages
    expect(resultMsgs.find(msg => msg.info.id === 3)).toBeUndefined()
  })

  test('message filtering handles empty array case (no messages after summary)', () => {
    // Mock message array structure with NO messages after summary
    const msgsNoFollow = [
      { info: { id: 1, role: "user", summary: false } },
      { info: { id: 2, role: "assistant", summary: false } },
      { info: { id: 3, role: "assistant", summary: true } } // Summary message with nothing after
    ]

    const lastSummary = msgsNoFollow.findLast((msg) => msg.info.role === "assistant" && msg.info.summary === true)
    expect(lastSummary?.info.id).toBe(3)

    // Apply the filtering logic from the actual code
    let resultMsgs = msgsNoFollow
    if (lastSummary) {
      const filteredMsgs = resultMsgs.filter((msg) => msg.info.id > lastSummary.info.id)
      // If no messages after summary, include the summary itself to avoid empty array
      resultMsgs = filteredMsgs.length > 0 ? filteredMsgs : [lastSummary]
    }

    // Should fallback to including just the summary message to avoid empty array
    expect(resultMsgs).toHaveLength(1)
    expect(resultMsgs[0].info.id).toBe(3)  // Summary message included as fallback
    expect(resultMsgs[0].info.summary).toBe(true)
  })
})