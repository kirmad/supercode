# OpenCode Development Guide

## Getting Started

### Prerequisites

Before you begin development, ensure you have the following installed:

- **Bun**: Package manager and runtime (v1.2.19 or later)
- **Go**: For TUI components (v1.24.x)
- **Node.js**: For compatibility (v22.x recommended)
- **Git**: Version control

### Initial Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/sst/opencode.git
   cd opencode
   ```

2. **Install Dependencies**
   ```bash
   bun install
   ```

3. **Run Development Server**
   ```bash
   bun dev
   ```

4. **Type Check (Optional)**
   ```bash
   bun run typecheck
   ```

## Development Workflow

### Project Structure Understanding

Familiarize yourself with the project structure:
- **`/packages/opencode/`**: Main CLI application
- **`/cloud/`**: Cloud infrastructure and services
- **`/infra/`**: Infrastructure as Code (SST)
- **`/packages/tui/`**: Terminal UI components
- **`/sdks/`**: Platform-specific SDKs

### Development Commands

```bash
# Start development server
bun dev

# Type checking across all packages
bun run typecheck

# Generate SDK clients
bun run generate

# Run specific package
bun run --filter=opencode dev
```

## Core Development Areas

### 1. CLI Commands (`packages/opencode/src/cli/cmd/`)

#### Adding a New Command

1. **Create Command File**
   ```typescript
   // packages/opencode/src/cli/cmd/my-command.ts
   import { Command } from "./cmd.js"
   
   export const myCommand = new Command("my-command")
     .description("Description of my command")
     .option("-f, --flag", "Flag description")
     .action(async (options) => {
       // Command implementation
       console.log("Executing my command", options)
     })
   ```

2. **Register Command**
   ```typescript
   // packages/opencode/src/cli/cmd/cmd.ts
   import { myCommand } from "./my-command.js"
   
   export const program = new Command("opencode")
     .addCommand(myCommand)
     // ... other commands
   ```

#### Command Development Best Practices

- **Error Handling**: Use try-catch blocks and provide meaningful error messages
- **Validation**: Validate inputs using Zod schemas
- **Logging**: Use the built-in logging system for debug information
- **Progress Indicators**: Show progress for long-running operations

### 2. Development Tools (`packages/opencode/src/tool/`)

#### Creating a New Tool

1. **Implement Tool Interface**
   ```typescript
   // packages/opencode/src/tool/my-tool.ts
   import { ToolSchema } from "./registry.js"
   import { z } from "zod"
   
   export const MyToolSchema = ToolSchema.extend({
     name: z.literal("my-tool"),
     parameters: z.object({
       input: z.string(),
       options: z.record(z.any()).optional()
     })
   })
   
   export async function myTool(params: z.infer<typeof MyToolSchema>["parameters"]) {
     // Tool implementation
     return {
       success: true,
       result: "Tool execution result"
     }
   }
   ```

2. **Register Tool**
   ```typescript
   // packages/opencode/src/tool/registry.ts
   import { myTool, MyToolSchema } from "./my-tool.js"
   
   export const tools = {
     "my-tool": {
       schema: MyToolSchema,
       execute: myTool
     },
     // ... other tools
   }
   ```

#### Tool Development Guidelines

- **Schema Definition**: Define clear Zod schemas for parameters
- **Error Handling**: Return structured error responses
- **Performance**: Optimize for fast execution
- **Testing**: Write unit tests for tool functionality

### 3. AI Agent Development (`packages/opencode/src/agent/`)

#### Extending Agent Capabilities

1. **Context Management**
   ```typescript
   // packages/opencode/src/agent/context.ts
   export interface AgentContext {
     session: SessionData
     tools: ToolRegistry
     memory: ConversationMemory
   }
   
   export function enhanceContext(context: AgentContext): AgentContext {
     // Add custom context enhancements
     return {
       ...context,
       customData: "enhanced context"
     }
   }
   ```

2. **Tool Integration**
   ```typescript
   // packages/opencode/src/agent/agent.ts
   export class Agent {
     async executeWithTool(toolName: string, params: any) {
       const tool = this.toolRegistry.get(toolName)
       if (!tool) {
         throw new Error(`Tool ${toolName} not found`)
       }
       
       return await tool.execute(params)
     }
   }
   ```

### 4. TUI Development (`packages/tui/`)

#### Adding New Themes

1. **Create Theme File**
   ```json
   // packages/tui/internal/theme/themes/my-theme.json
   {
     "name": "My Theme",
     "author": "Your Name",
     "colors": {
       "background": "#1a1a1a",
       "foreground": "#ffffff",
       "primary": "#007acc",
       "secondary": "#666666",
       "accent": "#ff6b6b",
       "error": "#ff4444",
       "warning": "#ffbb33",
       "success": "#00c851"
     }
   }
   ```

2. **Theme Registration**
   - Theme files are automatically discovered
   - No manual registration required

#### TUI Component Development

- **Use Go**: TUI components are primarily written in Go
- **Theme Integration**: Ensure components respect theme colors
- **Responsive Design**: Design for various terminal sizes
- **Keyboard Navigation**: Implement intuitive keyboard shortcuts

### 5. Cloud Services (`cloud/`)

#### Database Schema Updates

1. **Create Migration**
   ```typescript
   // cloud/core/src/schema/new-table.sql.ts
   import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"
   
   export const newTable = sqliteTable("new_table", {
     id: text("id").primaryKey(),
     name: text("name").notNull(),
     createdAt: integer("created_at", { mode: "timestamp" }).notNull()
   })
   ```

2. **Generate Migration**
   ```bash
   cd cloud/core
   bun run drizzle-kit generate
   ```

#### API Endpoint Development

1. **Define Route**
   ```typescript
   // cloud/core/src/api/my-endpoint.ts
   import { Hono } from "hono"
   import { zValidator } from "@hono/zod-validator"
   import { z } from "zod"
   
   const app = new Hono()
   
   const requestSchema = z.object({
     name: z.string(),
     value: z.number()
   })
   
   app.post("/my-endpoint", 
     zValidator("json", requestSchema),
     async (c) => {
       const data = c.req.valid("json")
       // Process request
       return c.json({ success: true, data })
     }
   )
   
   export default app
   ```

## Testing

### Unit Testing

```typescript
// tests/unit/my-tool.test.ts
import { describe, it, expect } from "bun:test"
import { myTool } from "../src/tool/my-tool.js"

describe("myTool", () => {
  it("should execute successfully", async () => {
    const result = await myTool({ input: "test" })
    expect(result.success).toBe(true)
  })
})
```

### Integration Testing

```typescript
// tests/integration/api.test.ts
import { describe, it, expect } from "bun:test"
import { app } from "../src/api/app.js"

describe("API Integration", () => {
  it("should handle requests", async () => {
    const response = await app.request("/api/test", {
      method: "POST",
      body: JSON.stringify({ test: "data" }),
      headers: { "Content-Type": "application/json" }
    })
    
    expect(response.status).toBe(200)
  })
})
```

### Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/unit/my-tool.test.ts

# Run with coverage
bun test --coverage
```

## Code Quality

### Linting and Formatting

```bash
# Format code (using Prettier)
bun run format

# Lint code
bun run lint

# Type checking
bun run typecheck
```

### Code Style Guidelines

1. **TypeScript**: Use strict TypeScript settings
2. **Naming**: Use camelCase for variables, PascalCase for types
3. **Imports**: Use relative imports within packages, absolute for cross-package
4. **Error Handling**: Use Result types or proper try-catch blocks
5. **Documentation**: Add JSDoc comments for public APIs

### Git Workflow

1. **Branch Naming**: Use descriptive branch names (`feature/my-feature`, `fix/bug-description`)
2. **Commit Messages**: Follow conventional commit format
3. **Pull Requests**: Include description, testing notes, and breaking changes
4. **Code Review**: All changes require code review

## Debugging

### Debug Mode

```bash
# Run with debug logging
DEBUG=* bun dev

# Debug specific components
DEBUG=opencode:agent bun dev
DEBUG=opencode:tools bun dev
```

### Development Tools

1. **Debug Commands**: Use `packages/opencode/src/cli/cmd/debug/` for debugging utilities
2. **LSP Integration**: Leverage Language Server Protocol for debugging
3. **File Watching**: Use built-in file watching for development
4. **Snapshots**: Create and analyze system snapshots

### Common Debug Scenarios

1. **Tool Execution Issues**
   ```bash
   bun dev debug tool --name my-tool --params '{"input": "test"}'
   ```

2. **LSP Problems**
   ```bash
   bun dev debug lsp --language typescript
   ```

3. **File System Issues**
   ```bash
   bun dev debug file --path /path/to/file
   ```

## Deployment

### Local Development

```bash
# Start development server
bun dev

# Start with specific configuration
NODE_ENV=development bun dev
```

### Infrastructure Deployment

```bash
# Deploy to development stage
bun run sst deploy --stage dev

# Deploy to production
bun run sst deploy --stage production
```

### Environment Variables

```bash
# Required for cloud services
export STRIPE_SECRET_KEY=your_stripe_key
export GITHUB_CLIENT_ID=your_github_client_id
export GITHUB_CLIENT_SECRET=your_github_client_secret
```

## Contributing Guidelines

### Before Contributing

1. **Check Issues**: Look for existing issues or create a new one
2. **Fork Repository**: Create a fork for your changes
3. **Local Setup**: Follow the setup instructions above
4. **Branch Creation**: Create a feature branch from `dev`

### Contribution Types

**Accepted Contributions:**
- Bug fixes
- LLM performance improvements
- New provider support
- Environment-specific fixes
- Standard behavior implementations
- Documentation improvements

**Not Accepted:**
- Core architectural changes (requires design discussion)
- Breaking changes without approval
- Features without corresponding issues

### Pull Request Process

1. **Create Branch**: `git checkout -b feature/my-feature`
2. **Make Changes**: Implement your feature or fix
3. **Test Changes**: Run tests and ensure they pass
4. **Commit Changes**: Use conventional commit messages
5. **Push Branch**: `git push origin feature/my-feature`
6. **Create PR**: Submit pull request with description
7. **Address Feedback**: Respond to code review comments
8. **Merge**: PR will be merged after approval

### Code Review Criteria

- **Functionality**: Does the code work as intended?
- **Quality**: Is the code well-written and maintainable?
- **Testing**: Are there appropriate tests?
- **Documentation**: Is the code documented?
- **Performance**: Does it impact performance negatively?
- **Security**: Are there any security concerns?

## Getting Help

### Resources

- **Documentation**: Check the `docs/` directory
- **Issues**: Browse GitHub issues for common problems
- **Discord**: Join the OpenCode Discord community
- **Code Examples**: Look at existing implementations

### Common Questions

1. **"How do I add a new command?"** - See CLI Commands section above
2. **"How do I create a custom tool?"** - See Development Tools section above
3. **"How do I debug issues?"** - See Debugging section above
4. **"How do I contribute?"** - See Contributing Guidelines section above

### Support Channels

- **GitHub Issues**: For bugs and feature requests
- **Discord**: For general discussion and help
- **Documentation**: For detailed guides and references
- **Code Comments**: For implementation-specific questions