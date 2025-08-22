# Release Process

This document describes how to release new versions of `@kirmad/supercode`.

## Quick Release Commands

The project includes automated scripts for version bumping and publishing:

```bash
# Patch release (0.5.16 → 0.5.17) - for bug fixes
bun run release

# Minor release (0.5.16 → 0.6.0) - for new features  
bun run release:minor

# Major release (0.5.16 → 1.0.0) - for breaking changes
bun run release:major

# Custom version type
bun run version-and-publish [patch|minor|major]

# Show help
bun run version-and-publish --help
```

## What the Release Script Does

1. **Version Bump**: Automatically increments the version in `package.json`
2. **Quality Check**: Runs `bun run typecheck` to ensure code quality
3. **Multi-Platform Build**: Compiles binaries for all supported platforms:
   - Windows x64
   - Linux arm64, x64, x64-baseline  
   - macOS x64, x64-baseline, arm64
4. **NPM Publish**: Publishes main package + all platform-specific packages
5. **Git Commit**: Creates a commit with the version bump
6. **Next Steps**: Shows commands to push to git and test installation

## Manual Release Process

If you need to release manually:

```bash
# 1. Update version in package.json
# 2. Run typecheck
bun run typecheck

# 3. Publish with specific version
OPENCODE_VERSION=0.5.17 bun run publish

# 4. Commit and push
git add package.json
git commit -m "chore: bump version to 0.5.17"
git push origin dev
```

## Platform-Specific Packages

The release process publishes these packages:

- `@kirmad/supercode` - Main package with Node.js wrapper
- `@kirmad/supercode-windows-x64` - Windows 64-bit binary
- `@kirmad/supercode-linux-arm64` - Linux ARM64 binary
- `@kirmad/supercode-linux-x64` - Linux x64 binary  
- `@kirmad/supercode-linux-x64-baseline` - Linux x64 baseline binary
- `@kirmad/supercode-darwin-x64` - macOS Intel binary
- `@kirmad/supercode-darwin-x64-baseline` - macOS Intel baseline binary
- `@kirmad/supercode-darwin-arm64` - macOS Apple Silicon binary

## Testing Releases

After publishing, test the release:

```bash
# Test global installation
npm install -g @kirmad/supercode@latest

# Verify version
supercode --version

# Test functionality
supercode --help
```

## Rollback

If a release has issues:

```bash
# Deprecate the problematic version
npm deprecate @kirmad/supercode@0.5.17 "Issue with Windows PATH integration"

# Publish a fixed version
bun run release
```