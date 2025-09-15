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

### Configuration

#### Provider Management

SuperCode includes a powerful provider management system that allows you to control which AI providers are available for use. By default, **only GitHub Copilot is enabled** to provide a secure, curated experience.

##### Default Configuration

```json
{
  "approved_providers": ["github-copilot"]
}
```

##### Configuration Options

Create an `opencode.json` file in your project root or home directory to customize provider access:

**Enable specific providers:**
```json
{
  "approved_providers": ["github-copilot", "openai", "anthropic"]
}
```

**Enable all providers:**
```json
{
  "approved_providers": null
}
```

**Advanced configuration (combine allow and deny lists):**
```json
{
  "approved_providers": ["github-copilot", "openai", "anthropic", "google"],
  "disabled_providers": ["google"]
}
```

##### Available Providers

SuperCode supports 40+ AI providers including:
- `github-copilot` (default) - GitHub Copilot models
- `openai` - GPT-4, GPT-3.5, and other OpenAI models
- `anthropic` - Claude models
- `google` - Gemini models
- `amazon-bedrock` - AWS Bedrock models
- And many more...

##### Configuration Precedence

1. **disabled_providers** always takes precedence (blocks providers even if approved)
2. **approved_providers** defines the allowed list (when set)
3. When `approved_providers` is `null`, all providers are allowed (except disabled ones)

##### Examples

**Security-focused setup (GitHub Copilot only):**
```json
{
  "approved_providers": ["github-copilot"]
}
```

**Multi-provider development:**
```json
{
  "approved_providers": ["github-copilot", "openai", "anthropic"],
  "model": "github-copilot/gpt-4o"
}
```

**Enterprise setup (all providers with exclusions):**
```json
{
  "approved_providers": null,
  "disabled_providers": ["some-internal-provider"]
}
```

To see available models: `supercode models`
To manage authentication: `supercode auth login`

### Tool Filtering

SuperCode provides fine-grained control over tool access through flags, commands, and agent configurations. This allows you to restrict or expand tool availability based on security requirements or specific workflows.

#### Quick Examples

**Safe Mode Flag** (`.opencode/flags/safe-mode.md`):
```yaml
---
description: Restrict to read-only operations
deny-tools: write, edit, bash
allowed-tools: read, grep, glob
---
```
Usage: `--safe-mode analyze this code`

**Security Command** (`.opencode/commands/security.md`):
```yaml
---
description: Security audit mode
allowed-tools: read, grep, glob
deny-tools: write, edit, bash
---
```
Usage: `/security check for vulnerabilities`

See [Tool Filtering Documentation](docs/TOOL-FILTERING.md) for complete details.

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
