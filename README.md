<p align="center">
  <a href="https://github.com/kirmad/supercode">
    <picture>
      <source srcset="packages/web/src/assets/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/web/src/assets/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/web/src/assets/logo-ornate-light.svg" alt="supercode logo">
    </picture>
  </a>
</p>
<p align="center">AI coding agent, optimized for large repos with better GitHub Copilot support.</p>
<p align="center">
  <a href="https://github.com/kirmad/supercode"><img alt="GitHub" src="https://img.shields.io/github/stars/kirmad/supercode?style=flat-square" /></a>
  <a href="https://github.com/kirmad/supercode/releases"><img alt="Release" src="https://img.shields.io/github/v/release/kirmad/supercode?style=flat-square" /></a>
  <a href="https://github.com/kirmad/supercode/actions"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/kirmad/supercode/ci.yml?style=flat-square&branch=main" /></a>
</p>

---

### Installation

```bash
npm i -g @kirmad/supercode@latest        # or bun/pnpm/yarn
```

> [!TIP]
> SuperCode is optimized for large repositories with better GitHub Copilot support.

#### Installation Directory

SuperCode respects the following priority order for the installation path:

1. `$SUPERCODE_INSTALL_DIR` - Custom installation directory
2. `$XDG_BIN_DIR` - XDG Base Directory Specification compliant path
3. `$HOME/bin` - Standard user binary directory (if exists or can be created)
4. `$HOME/.supercode/bin` - Default fallback

```bash
# Examples for custom installations
SUPERCODE_INSTALL_DIR=/usr/local/bin
XDG_BIN_DIR=$HOME/.local/bin
```

### Documentation

For more info on how to configure SuperCode, see the [project documentation](https://github.com/kirmad/supercode/docs) or check the original OpenCode docs for additional reference.

### Contributing

SuperCode welcomes contributions focused on:

- Large repository performance optimizations
- Better GitHub Copilot integration features
- Bug fixes and stability improvements
- Support for additional AI providers
- Documentation improvements
- Environment-specific optimizations

To run SuperCode locally you need:

- Bun
- Golang 1.24.x

And run:

```bash
$ bun install
$ bun dev
```

#### Development Notes

**API Client**: After making changes to the TypeScript API endpoints in `packages/opencode/src/server/server.ts`, you may need to regenerate SDK clients for proper functionality.

### FAQ

#### How is SuperCode different from other AI coding agents?

SuperCode is specifically optimized for working with large repositories with better GitHub Copilot support. Key features include:

- **Large Repository Optimization**: Enhanced performance when working with monorepos and complex codebases
- **Better GitHub Copilot Support**: Improved integration with GitHub Copilot for superior AI-assisted development
- **Multi-provider Support**: Works with Anthropic, OpenAI, Google, and local models
- **Terminal-First Design**: Built by terminal enthusiasts for developers who love command-line workflows
- **Client/Server Architecture**: Flexible deployment options, including remote access capabilities

---

**Community** [GitHub Discussions](https://github.com/kirmad/supercode/discussions) | [Issues](https://github.com/kirmad/supercode/issues)

---

## Acknowledgments

SuperCode is a fork of [OpenCode](https://github.com/sst/opencode), optimized for use with large repositories and better GitHub Copilot support. We thank the original OpenCode team for creating an excellent foundation for AI-powered terminal-based coding agents.
