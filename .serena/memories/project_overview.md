# SuperCode Project Overview

## Purpose
SuperCode is an AI coding agent optimized for large repositories with better GitHub Copilot support. It's a fork of OpenCode with enhancements for:
- Large repository performance optimizations
- Better GitHub Copilot integration
- Terminal-first design
- Client/server architecture

## Tech Stack
- **Primary Language**: TypeScript
- **Runtime**: Bun (1.2.19+)
- **Server Framework**: Hono (for HTTP API)
- **Package Manager**: Bun
- **UI Framework**: Solid.js (for web interface)
- **Architecture**: Client/Server with TUI and Web interfaces

## Project Structure
- `packages/opencode/` - Main SuperCode implementation
  - `src/server/server.ts` - Main HTTP API server
  - `src/server/web-*` - Web interface routes and templates
- `sdks/vscode/` - VSCode extension
- `packages/tui/` - Terminal User Interface (Go)
- `web-client/` - React-based web client

## Key Components
1. **HTTP API Server** - Comprehensive REST API for all SuperCode functionality
2. **Terminal Interface (TUI)** - Go-based terminal application
3. **Web Interface** - Multi-tab web interface including API client
4. **VSCode Extension** - Current basic terminal integration
5. **Various SDKs** - JavaScript, Go, etc.

## Current VSCode Extension Capabilities
- Opens SuperCode terminal with random port
- Integrates with current file context
- Supports file reference injection (@file syntax)
- Basic commands: open terminal, open new terminal, add filepath

## Development Requirements
- Bun runtime
- Golang 1.24.x for TUI components
- Node.js for additional tooling