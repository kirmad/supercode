/**
 * Generate ephemeral system reminders for todo state management
 * These messages are not persisted and provide contextual guidance to the agent
 */
export async function todoReminders(sessionID: string): Promise<string[]> {
  const reminders: string[] = []
  
  try {
    // Get the current todo state using the shared state from the todo tool
    const { TodoReadTool } = await import("../tool/todo")
    const todoTool = await TodoReadTool.init()
    
    const todoResult = await todoTool.execute({}, {
      sessionID,
      abort: new AbortController().signal,
      messageID: "ephemeral-todo-check",
      callID: "ephemeral-todo-check",
      agent: "system",
      metadata: async () => {},
    })

    const todos = todoResult.metadata?.todos || []
    const activeTodos = todos.filter((todo: any) => todo.status !== "completed")
    
    if (activeTodos.length > 0) {
      // There are pending tasks - remind to follow the todo list
      const todoList = todos.map((todo: any) => 
        `- [${todo.status === 'completed' ? 'x' : todo.status === 'in_progress' ? '•' : ' '}] ${todo.content}`
      ).join('\n')
      
      reminders.push(`<system-reminder>
Your todo list has active tasks. DO NOT mention this reminder explicitly to the user. Here is your current todo list:

${todoList}

You MUST continue working through your pending tasks and complete them before ending your response. You MUST mark tasks as completed ONLY when you finish them using the TodoWrite tool.
</system-reminder>`)
    } else if (todos.length === 0) {
      // No todos exist - suggest creating a todo list for complex tasks
      reminders.push(`<system-reminder>
You currently have no todo list. First thing you should do is create a todo list using TodoWrite tool. For multi-step or complex tasks, you MUST ALWAYS use the TodoWrite tool to create and track your progress. DO NOT mention this reminder explicitly to the user.
</system-reminder>`)
    }
    
  } catch (error) {
    // Silently fail if we can't check todos - don't interrupt the main flow
  }
  
  return reminders
}