# OpenCode Project Structure

## Overview

OpenCode is a monorepo containing an AI coding agent built for the terminal. This document provides a comprehensive guide to the project's structure, components, and organization.

## Repository Layout

```
opencode/
├── cloud/              # Cloud infrastructure and services
├── docs/               # Project documentation
├── infra/              # Infrastructure as Code (SST)
├── packages/           # Core application packages
├── sdks/               # Platform-specific SDKs
├── node_modules/       # Dependencies
├── package.json        # Workspace configuration
├── tsconfig.json       # TypeScript configuration
├── sst.config.ts       # SST infrastructure config
├── bunfig.toml         # Bun package manager config
└── opencode.json       # Project-specific configuration
```

## Core Directories

### `/cloud/` - Cloud Infrastructure

Contains cloud services, APIs, and infrastructure components.

```
cloud/
├── core/               # Core cloud services
│   ├── src/
│   │   ├── schema/     # Database schema definitions
│   │   ├── drizzle/    # Database ORM and types
│   │   └── util/       # Shared utilities
│   ├── migrations/     # Database migrations
│   ├── package.json    # Core dependencies
│   └── tsconfig.json   # TypeScript config
├── function/           # Serverless functions
├── web/                # Cloud web interface
└── package.json        # Cloud workspace config
```

**Key Components:**
- **Database Schema**: Account, billing, workspace, user, key schemas
- **Business Logic**: Account management, billing, workspace operations
- **Utilities**: Logging, pricing calculations, function helpers

### `/packages/` - Core Application

Contains the main application logic and supporting packages.

```
packages/
├── opencode/           # Main CLI application
│   ├── src/
│   │   ├── cli/        # Command-line interface
│   │   ├── tool/       # Development tools
│   │   ├── agent/      # AI agent functionality
│   │   ├── auth/       # Authentication systems
│   │   ├── session/    # Session management
│   │   ├── server/     # TUI server
│   │   ├── app/        # Application core
│   │   ├── bus/        # Event bus system
│   │   ├── config/     # Configuration management
│   │   ├── file/       # File operations
│   │   ├── format/     # Code formatting
│   │   ├── lsp/        # Language Server Protocol
│   │   └── mcp/        # Model Context Protocol
│   └── script/         # Build and utility scripts
├── function/           # Shared function utilities
├── plugin/             # Plugin system
├── sdk/                # Multi-language SDKs
├── tui/                # Terminal UI components
└── web/                # Web interface
```

**Key Features:**
- **CLI Commands**: auth, debug, generate, models, run, serve, stats, tui, upgrade
- **Development Tools**: bash, edit, glob, grep, ls, multiedit, patch, read, test, todo
- **Language Support**: LSP integration, file watching, ripgrep integration
- **Authentication**: GitHub Copilot integration, token management

### `/infra/` - Infrastructure as Code

SST-based infrastructure definitions and deployment configurations.

```
infra/
├── app.ts              # Application infrastructure
├── cloud.ts            # Cloud services configuration
└── stage.ts            # Stage-specific configurations
```

**Components:**
- **App Configuration**: Main application infrastructure setup
- **Cloud Services**: Authentication, gateway, and API configurations
- **Stage Management**: Production, development, and testing environments

### `/sdks/` - Platform SDKs

Platform-specific software development kits and extensions.

```
sdks/
└── vscode/             # VS Code extension
    ├── src/            # Extension source code
    ├── package.json    # Extension manifest
    └── tsconfig.json   # TypeScript configuration
```

## Package Structure

### Main Application (`packages/opencode/`)

The core CLI application with the following key modules:

#### CLI Layer (`src/cli/`)
- **bootstrap.ts**: Application initialization
- **ui.ts**: User interface components
- **cmd/**: Command implementations
  - **agent.ts**: AI agent commands
  - **auth.ts**: Authentication commands
  - **debug/**: Debugging utilities
  - **generate.ts**: Code generation
  - **models.ts**: Model management
  - **run.ts**: Execution commands
  - **serve.ts**: Server commands
  - **stats.ts**: Statistics and analytics
  - **tui.ts**: Terminal UI commands
  - **upgrade.ts**: Update functionality

#### Tool Layer (`src/tool/`)
Development tools and utilities:
- **bash.ts**: Shell command execution
- **edit.ts**: File editing operations
- **glob.ts**: File pattern matching
- **grep.ts**: Text search functionality
- **ls.ts**: Directory listing
- **multiedit.ts**: Multi-file editing
- **read.ts**: File reading operations
- **test.ts**: Testing utilities
- **todo.ts**: Task management

#### Core Systems
- **agent/**: AI agent implementation
- **auth/**: Authentication and authorization
- **session/**: Session state management
- **server/**: TUI server implementation
- **lsp/**: Language Server Protocol integration
- **mcp/**: Model Context Protocol support

### TUI Package (`packages/tui/`)

Terminal user interface with theme support:

```
packages/tui/
└── internal/
    └── theme/
        └── themes/     # Color themes (25+ themes)
            ├── aura.json
            ├── catppuccin.json
            ├── dracula.json
            ├── github.json
            ├── gruvbox.json
            ├── monokai.json
            ├── nord.json
            ├── opencode.json
            └── ...
```

## Configuration Files

### Root Configuration
- **package.json**: Workspace definition with dependency catalog
- **tsconfig.json**: TypeScript configuration extending Bun presets
- **sst.config.ts**: Infrastructure configuration
- **bunfig.toml**: Bun package manager settings
- **opencode.json**: Project-specific configuration

### Package-Specific Configurations
Each package contains:
- **package.json**: Package dependencies and scripts
- **tsconfig.json**: TypeScript compilation settings
- **sst-env.d.ts**: SST environment type definitions (where applicable)

## Dependencies

### Workspace Catalog
Centralized dependency management through workspace catalog:

```json
{
  "catalog": {
    "@hono/zod-validator": "0.4.2",
    "@types/node": "22.13.9",
    "@tsconfig/node22": "22.0.2",
    "ai": "5.0.8",
    "hono": "4.7.10",
    "typescript": "5.8.2",
    "zod": "3.25.76",
    "remeda": "2.26.0"
  }
}
```

### Key Technologies
- **Runtime**: Bun (v1.2.19)
- **Language**: TypeScript 5.8.2
- **Web Framework**: Hono 4.7.10
- **AI Integration**: AI library 5.0.8
- **Validation**: Zod 3.25.76
- **Infrastructure**: SST 3.17.8
- **Database**: Drizzle ORM
- **Cloud**: Cloudflare Workers

## Development Workflow

### Scripts
- **dev**: Run development server
- **typecheck**: Type checking across all packages
- **generate**: Generate SDK clients
- **postinstall**: Setup git hooks

### Build Process
1. **Type Checking**: Distributed across packages
2. **Code Generation**: Stainless SDK generation
3. **Infrastructure**: SST deployment pipeline
4. **Package Management**: Bun workspace coordination

## Navigation Guide

- **Getting Started**: See root `README.md`
- **CLI Usage**: `packages/opencode/src/cli/`
- **Tool Development**: `packages/opencode/src/tool/`
- **Cloud Services**: `cloud/core/src/`
- **Infrastructure**: `infra/`
- **Themes**: `packages/tui/internal/theme/themes/`
- **SDKs**: `packages/sdk/`