# SuperCode Development Commands

## Main Development Commands
```bash
# Start development server
bun dev

# Type checking across all packages
bun run typecheck

# Generate SDK clients (after API changes)
bun run generate

# Install dependencies
bun install
```

## VSCode Extension Development
```bash
# In sdks/vscode/ directory:
bun run compile         # Compile extension
bun run watch:esbuild   # Watch for changes
bun run package         # Package for production
bun run check-types     # Type checking
bun run lint            # Lint code
```

## Project-wide Scripts
```bash
# Root package.json scripts:
bun dev                 # Run opencode in development mode
bun run typecheck       # Type check all packages
bun run generate        # Generate SDK clients
```

## Testing & Quality
```bash
# VSCode extension:
bun run pretest         # Prepare tests
bun run test            # Run tests
```

## System Commands (Darwin/macOS)
- `git` - Standard Git operations
- `ls`, `cd`, `pwd` - Standard file operations
- `find`, `grep` - File search (prefer `rg` when available)
- `bun` - Primary package manager and runtime