# SuperCode

Cross-platform AI coding agent built for the terminal.

## Development

To install dependencies:

```bash
bun install
```

To run in development:

```bash
bun run dev
```

## Publishing

Quick release commands:

```bash
# Patch release (bug fixes)
bun run release

# Minor release (new features)  
bun run release:minor

# Major release (breaking changes)
bun run release:major
```

See [RELEASE.md](./RELEASE.md) for detailed release process.

## Scripts

- `bun run dev` - Start development server
- `bun run typecheck` - Run TypeScript type checking
- `bun run publish` - Publish to npm (manual)
- `bun run release` - Bump version and publish (automated)

This project was created using `bun init` in bun v1.2.12. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
