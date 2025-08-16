# OpenCode Documentation

Welcome to the OpenCode documentation! This directory contains comprehensive guides and references for understanding, developing, and contributing to OpenCode.

## Documentation Overview

### 📁 Available Documents

- **[Project Structure](./project-structure.md)** - Complete overview of the repository organization and component layout
- **[Architecture](./architecture.md)** - System architecture, data flow, and technology stack details
- **[Development Guide](./development-guide.md)** - Comprehensive guide for developers working on OpenCode

## Quick Navigation

### For New Contributors
1. Start with [Project Structure](./project-structure.md) to understand the codebase
2. Review [Architecture](./architecture.md) to understand system design
3. Follow [Development Guide](./development-guide.md) for setup and development workflow

### For System Understanding
- **High-level Overview**: [Architecture](./architecture.md)
- **Code Organization**: [Project Structure](./project-structure.md)
- **Component Details**: [Development Guide](./development-guide.md)

### For Development Work
- **Getting Started**: [Development Guide - Getting Started](./development-guide.md#getting-started)
- **Adding Features**: [Development Guide - Core Development Areas](./development-guide.md#core-development-areas)
- **Testing**: [Development Guide - Testing](./development-guide.md#testing)
- **Contributing**: [Development Guide - Contributing Guidelines](./development-guide.md#contributing-guidelines)

## OpenCode Overview

OpenCode is an AI coding agent built for the terminal, designed as a 100% open source alternative to Claude Code. Key features include:

- **Provider Agnostic**: Works with Anthropic, OpenAI, Google, or local models
- **Terminal Focus**: Built by terminal power users with TUI emphasis
- **Client/Server Architecture**: Enables remote control from mobile apps
- **Extensible**: Plugin system for custom tools and integrations

## Project Structure Summary

```
opencode/
├── cloud/              # Cloud infrastructure and services
├── docs/               # This documentation directory
├── infra/              # Infrastructure as Code (SST)
├── packages/           # Core application packages
│   ├── opencode/       # Main CLI application
│   ├── tui/           # Terminal UI components
│   ├── sdk/           # Multi-language SDKs
│   └── web/           # Web interface
└── sdks/              # Platform-specific SDKs
```

## Technology Stack

- **Runtime**: Bun (JavaScript/TypeScript)
- **Secondary**: Go (TUI components)
- **Web Framework**: Hono
- **Infrastructure**: SST v3 with Cloudflare
- **Database**: Drizzle ORM
- **AI Integration**: Provider-agnostic AI library

## Quick Start

```bash
# Clone repository
git clone https://github.com/sst/opencode.git
cd opencode

# Install dependencies
bun install

# Start development server
bun dev
```

## Contributing

OpenCode welcomes contributions! Please see the [Development Guide](./development-guide.md#contributing-guidelines) for detailed contribution guidelines.

**Accepted Contributions:**
- Bug fixes
- LLM performance improvements
- New provider support
- Environment-specific fixes
- Documentation improvements

**Note**: Core architectural changes require design discussion with the team.

## Support

- **Discord**: [Join the OpenCode community](https://opencode.ai/discord)
- **GitHub Issues**: [Report bugs or request features](https://github.com/sst/opencode/issues)
- **Documentation**: Browse this docs directory for detailed guides

## External Resources

- **Main Website**: [opencode.ai](https://opencode.ai)
- **Online Documentation**: [opencode.ai/docs](https://opencode.ai/docs)
- **GitHub Repository**: [github.com/sst/opencode](https://github.com/sst/opencode)
- **Community Discord**: [opencode.ai/discord](https://opencode.ai/discord)

---

*This documentation is maintained alongside the codebase. If you find outdated information or want to contribute improvements, please submit a pull request.*