# Task Completion Workflow

## When a Task is Completed

### 1. Code Quality Checks
```bash
# Type checking
bun run typecheck

# Linting (for VSCode extension)
cd sdks/vscode && bun run lint

# Code formatting (automatic via Prettier)
```

### 2. Testing
```bash
# VSCode extension testing
cd sdks/vscode && bun run test

# Ensure no compilation errors
bun run compile
```

### 3. Build Verification
```bash
# For VSCode extension changes:
cd sdks/vscode && bun run package

# For API changes, regenerate SDKs:
bun run generate
```

### 4. Documentation Updates
- Update relevant documentation if adding new features
- Update AGENTS.md if adding new capabilities
- Ensure OpenAPI documentation is current for API changes

### 5. Version Management
- Check if version bumps are needed
- Update package.json versions appropriately
- Consider impact on dependent packages

### 6. Integration Testing
- Test VSCode extension with actual SuperCode server
- Verify API endpoints work as expected
- Test web interface integration if applicable

## Specific for VSCode Extension Development
1. Compile and package the extension
2. Test with actual VSCode instance
3. Verify terminal integration works
4. Test file context features
5. Ensure proper error handling