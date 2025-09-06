# Supercode Release Process

This document describes the release process for the Supercode fork of OpenCode.

## Auto-Update Mechanism

The auto-update feature works by checking GitHub releases from the `kirmad/supercode` repository. When a new release is available, users will be prompted to update.

The auto-update logic is located in:
- `packages/opencode/src/installation/index.ts` - Checks for latest releases
- `packages/opencode/src/cli/cmd/tui.ts` - Triggers auto-update check on startup

## Creating a Release

### Method 1: Using GitHub Actions (Recommended)

1. Go to [GitHub Actions](https://github.com/kirmad/supercode/actions)
2. Click on "Release Supercode" workflow
3. Click "Run workflow"
4. Enter the version number (e.g., `1.0.0`)
5. Optionally mark as pre-release
6. Click "Run workflow"

The workflow will:
- Build binaries for all platforms
- Create a GitHub release with release notes
- Upload distribution files
- Optionally publish to npm

### Method 2: Using the Release Script

Run the release script from the repository root:

```bash
./script/release-supercode.sh <version>
```

Example:
```bash
./script/release-supercode.sh 1.0.0
```

This will:
1. Update version in all package.json files
2. Commit the changes
3. Create a git tag
4. Push to GitHub
5. Trigger the GitHub Actions workflow

### Method 3: Manual Release

1. Update version in package.json files:
   ```bash
   # Update all package.json files to new version
   find . -name "package.json" -not -path "*/node_modules/*" | \
     xargs sed -i 's/"version": "[^"]*"/"version": "1.0.0"/'
   ```

2. Commit and tag:
   ```bash
   git add -A
   git commit -m "release: v1.0.0"
   git tag v1.0.0
   git push origin dev --tags
   ```

3. Create GitHub release:
   ```bash
   gh release create v1.0.0 \
     --title "v1.0.0" \
     --generate-notes \
     --target dev
   ```

## Version Numbering

We follow semantic versioning (MAJOR.MINOR.PATCH):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes

Pre-release versions use the format: `X.Y.Z-alpha.N` or `X.Y.Z-beta.N`

## Release Checklist

Before creating a release:

- [ ] All tests pass
- [ ] Code has been reviewed
- [ ] Documentation is updated
- [ ] CHANGELOG is updated (if applicable)
- [ ] Version numbers are consistent
- [ ] No uncommitted changes

## Auto-Update Testing

To test auto-update locally:

1. Create a test release on GitHub
2. Install an older version of supercode
3. Run `opencode` and verify it detects the update
4. Confirm the update installs correctly

## Troubleshooting

### Auto-update not working

1. Check if releases exist: 
   ```bash
   gh api repos/kirmad/supercode/releases/latest
   ```

2. Verify the installation method:
   ```bash
   opencode --version
   ```

3. Check auto-update is enabled in config:
   ```bash
   cat ~/.config/opencode/opencode.json | grep autoupdate
   ```

### Release workflow fails

1. Check GitHub Actions logs
2. Ensure all secrets are configured:
   - `GITHUB_TOKEN` (automatic)
   - `NPM_TOKEN` (if publishing to npm)

## Distribution Channels

Supercode can be installed via:

1. **curl** (recommended):
   ```bash
   curl -fsSL https://raw.githubusercontent.com/kirmad/supercode/dev/install | bash
   ```

2. **npm**:
   ```bash
   npm install -g @kirmad/supercode
   ```

3. **bun**:
   ```bash
   bun install -g @kirmad/supercode
   ```

4. **Direct download**: From GitHub releases page

## Notes for Fork Maintenance

Since this is a fork of OpenCode:
- Keep upstream changes mergeable by minimizing core file modifications
- Create new files rather than modifying existing ones when possible
- Document any divergence from upstream in FORK_CHANGES.md
- Regularly merge upstream changes to stay current