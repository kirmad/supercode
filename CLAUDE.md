# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ CRITICAL: Fork Management & Upstream Merge Strategy

**This is a forked repository that periodically merges upstream changes. All development must follow merge-friendly practices.**

### Core Principles for Development
1. **MINIMIZE existing code modifications** - Avoid changing upstream files whenever possible
2. **CREATE NEW FILES** - Write new functionality in separate files rather than modifying existing ones
3. **USE EXTENSION PATTERNS** - Extend existing functionality through imports, plugins, or composition
4. **AVOID CORE FILE CHANGES** - Never modify core architecture files unless absolutely necessary

### Merge-Safe Development Patterns

#### ✅ PREFERRED: New Files & Extensions
```bash
# Create new tools
packages/opencode/src/tool/my-custom-tool.ts
packages/opencode/src/tool/my-custom-tool.txt

# Create new CLI commands  
packages/opencode/src/cli/cmd/my-command.ts

# Add new utilities
packages/opencode/src/util/my-utility.ts

# Create custom configurations
config/my-custom-config.ts
scripts/my-custom-script.ts
```

#### ✅ SAFE: Registry Extensions
```typescript
// Extend existing registries by importing and adding to arrays
import { MyCustomTool } from "./my-custom-tool.js"

// In registry files, prefer appending to arrays rather than modifying existing entries
```

#### ⚠️ AVOID: Core File Modifications
```bash
# These files should rarely be modified to avoid merge conflicts:
packages/opencode/src/tool/registry.ts  # Only add new tools to arrays
packages/opencode/src/cli/cmd/cmd.ts    # Only add new commands 
packages/opencode/src/server/server.ts  # Avoid unless critical
packages/opencode/src/agent/agent.ts    # Avoid unless critical
```

#### ⚠️ INFRASTRUCTURE: Additive Changes Only
```bash
# ALLOWED: Additive package changes (new dependencies, scripts)
package.json (root)          # ✅ Add new dependencies/scripts
packages/*/package.json      # ✅ Add new dependencies/scripts

# AVOID: Structural changes that conflict with upstream
bun.lock                     # ⚠️ Will be regenerated, conflicts expected
sst.config.ts               # ⚠️ Avoid unless critical
infra/                      # ⚠️ Avoid unless critical  
cloud/core/                 # ⚠️ Avoid unless critical
```

### Safe Customization Strategies

1. **Plugin Pattern**: Create plugins in `packages/plugin/src/` 
2. **Tool Extensions**: Add new tools without modifying existing tool registry logic
3. **Command Extensions**: Add new CLI commands in separate files
4. **Configuration Overlays**: Create custom config files that extend base configurations
5. **Utility Modules**: Write reusable utilities in new files under `src/util/`

### Pre-Merge Checklist
Before merging upstream changes:
1. ✅ Most changes are in new files
2. ✅ Existing file modifications are minimal and well-documented  
3. ✅ Package.json changes are additive only (new deps/scripts)
4. ✅ Custom functionality is easily separable from upstream code
5. ✅ All custom code follows existing patterns and conventions
6. ✅ Lock files can be regenerated if conflicts occur

## Common Development Commands

### Development & Testing
```bash
# Start development server (main entry point)
bun dev

# Type checking across all packages  
bun run typecheck

# Install dependencies
bun install

# Generate SDK clients (after API changes)
bun run generate

# Run tests
bun test

# Run specific package in development
bun run --filter=opencode dev
```

### TUI Development (Go components)
```bash
# Navigate to TUI package
cd packages/tui

# Build Go components
go build ./cmd/opencode

# Run Go tests
go test ./...
```

### Cloud Infrastructure
```bash
# Deploy to development stage
bun run sst deploy --stage dev

# Deploy to production  
bun run sst deploy --stage production
```

## Architecture Overview

OpenCode is a client/server AI coding agent with the following key components:

### Core Packages Structure
- **`packages/opencode/`** - Main CLI application and server
  - `src/cli/cmd/` - CLI command definitions
  - `src/tool/` - Development tools (bash, edit, grep, etc.)
  - `src/agent/` - AI agent engine and context management
  - `src/server/` - HTTP server and API endpoints
  - `src/session/` - Session management and message handling
- **`packages/tui/`** - Terminal UI components (Go)
- **`cloud/`** - Cloud infrastructure and services
- **`sdks/`** - Platform-specific SDKs (Go, JavaScript, VS Code)

### Tool Registry System
The tool registry (`packages/opencode/src/tool/registry.ts`) manages available development tools:
- **File Operations**: read, write, edit, multiedit, ls, glob, grep
- **Execution**: bash, task
- **Utilities**: todo (read/write), webfetch, patch
- Tools are provider-specific (OpenAI, Google, etc.) with parameter sanitization

### Session & Agent Architecture  
- Sessions managed in `packages/opencode/src/session/`
- AI providers supported: Anthropic, OpenAI, Google, local models
- Context management with conversation memory
- Tool integration with dynamic selection and execution

### Client/Server Architecture
- **Server Layer**: Hono-based HTTP server with WebSocket support
- **Client Layer**: TUI (primary), VS Code extension, future mobile apps
- **Cloud Layer**: Authentication, billing, user management via SST/Cloudflare

## Key Development Patterns

### Adding New CLI Commands
1. Create command file in `packages/opencode/src/cli/cmd/`
2. Use yargs `CommandModule` interface with `cmd()` helper
3. Register in main command router
4. Follow existing patterns for error handling and validation

### Creating New Tools
1. Implement tool in `packages/opencode/src/tool/`
2. Define Zod schema for parameters
3. Add to `ALL` array in `registry.ts`
4. Include provider-specific parameter transformations
5. Add permission checks in `enabled()` function

### TUI Theme Development
- Themes located in `packages/tui/internal/theme/themes/`
- JSON format with color definitions
- Auto-discovered, no manual registration needed
- Support for 25+ existing themes

### Database Schema Changes
1. Define schema in `cloud/core/src/schema/`
2. Use Drizzle ORM with SQLite
3. Generate migrations: `cd cloud/core && bun run drizzle-kit generate`

## Important Implementation Details

### Provider Support
- **Multi-provider**: Anthropic (recommended), OpenAI, Google, local models
- **Parameter handling**: Provider-specific sanitization (see `registry.ts:sanitizeGeminiParameters`)
- **Model restrictions**: Some tools disabled for specific models (e.g., Qwen)

### Permission System
- File edit permissions: edit, write, patch tools
- Bash execution permissions: granular command control  
- WebFetch permissions: external HTTP access
- Permission checks in `ToolRegistry.enabled()`

### Technology Stack
- **Runtime**: Bun (primary), Go (TUI), Node.js (compatibility)
- **Web Framework**: Hono with Zod validation
- **Database**: Drizzle ORM with SQL
- **Infrastructure**: SST v3 on Cloudflare Workers
- **Authentication**: OpenAuth with GitHub Copilot integration

### File Organization
- **Monorepo**: Bun workspaces with dependency catalog
- **TypeScript**: Strict settings across packages
- **Package Manager**: Bun 1.2.19+ required
- **Build System**: No transpilation, direct TypeScript execution

## Testing Strategy

### Test Locations
- Unit tests: `packages/opencode/test/`
- Fixtures: `packages/opencode/test/fixtures/`
- Go tests: `packages/tui/` (standard Go testing)

### Test Commands
```bash
# All tests
bun test

# Specific test file
bun test packages/opencode/test/tool/tool.test.ts

# With coverage
bun test --coverage
```

## Code Quality Standards

### TypeScript Configuration
- Strict TypeScript settings enforced
- Catalog-based dependency management
- Relative imports within packages, absolute for cross-package

### Development Tools
- **Prettier**: Code formatting (semi: false, printWidth: 120)
- **ESLint**: Linting (where configured)
- **Type checking**: `bun run typecheck` across all packages

## Common Development Workflows

### API Client Generation
After making changes to `packages/opencode/src/server/server.ts`:
1. Contact OpenCode team for Stainless SDK generation
2. Run `bun run generate` to update clients

### Local Development Setup
1. Ensure Bun and Go 1.24.x installed
2. Run `bun install` from repository root
3. Start development with `bun dev`
4. TUI will be available for testing

### Debugging Commands
```bash
# Debug with logging
DEBUG=* bun dev

# Component-specific debugging  
DEBUG=opencode:agent bun dev
DEBUG=opencode:tools bun dev

# Debug tools
bun dev debug tool --name my-tool --params '{"input": "test"}'
bun dev debug lsp --language typescript
bun dev debug file --path /path/to/file
```

This codebase emphasizes terminal-first development, provider-agnostic AI integration, and a plugin-extensible architecture suitable for rapid AI coding agent development.