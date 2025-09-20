# Azure DevOps Integration Tests

This directory contains integration tests for the Azure DevOps work item and pull request context generation system.

## 🔒 Security First

**IMPORTANT**: Never commit credentials to source control!

## Setup

### 1. Configure Credentials

Copy the sample configuration file and add your credentials:

```bash
cp .env.sample .env.test
```

Edit `.env.test` and add your Azure DevOps credentials:

```bash
# Your Azure DevOps organization name
AZURE_DEVOPS_ORG=your-organization

# Your Azure DevOps project name
AZURE_DEVOPS_PROJECT=your-project

# Your Azure DevOps Personal Access Token (PAT)
AZURE_DEVOPS_PAT=your-personal-access-token
```

### 2. Generate Personal Access Token (PAT)

1. Go to: `https://dev.azure.com/{your-organization}/_usersSettings/tokens`
2. Click "New Token"
3. Select these scopes:
   - Work Items (Read)
   - Code (Read)
   - Pull Request (Read)
4. Copy the token and add it to your `.env.test` file

## Running Tests

### Run all tests
```bash
bun test
```

### Run specific test suite
```bash
bun test pr-details         # Test PR details including commits and diffs
bun test work-item-context  # Test work item context generation
bun test generate-prompts   # Generate comprehensive prompts
```

### Using environment variables directly
```bash
AZURE_DEVOPS_PAT=your-token AZURE_DEVOPS_ORG=your-org bun test
```

## Test Structure

```
test/
├── config.ts              # Secure configuration management
├── index.ts               # Main test runner
├── test-pr-details.ts     # PR details test suite
├── test-work-item-context.ts  # Work item context test
├── test-generate-prompts.ts   # Prompt generation test
└── README.md              # This file

test-artifacts/            # Generated test outputs (gitignored)
├── pr-details-*.txt       # PR detail reports
├── prompt-*.txt           # Generated prompts
└── test-summary-*.json    # Test execution summaries
```

## Available Test Suites

### PR Details Test
Tests comprehensive PR information retrieval including:
- Commit history
- File changes and diffs
- Branch information
- Comments and discussions

### Work Item Context Test
Tests work item context generation including:
- Related work items (parent, children, related)
- Linked pull requests
- Comments and updates
- Full context assembly

### Generate Prompts Test
Tests prompt generation for AI context including:
- Work item details formatting
- PR information summary
- Related items context
- Formatted output generation

## Test Artifacts

All test outputs are saved to the `test-artifacts/` directory with timestamps.
This directory is gitignored to prevent accidental commits of sensitive data.

## Troubleshooting

### Missing Credentials Error
If you see "AZURE_DEVOPS_PAT environment variable is not set":
1. Create `.env.test` file with your credentials
2. Or set environment variables directly

### Permission Errors
Ensure your PAT has the required scopes:
- Work Items (Read)
- Code (Read)
- Pull Request (Read)

### Network Errors
- Check your organization and project names are correct
- Verify PAT is still valid (they expire)
- Ensure you have network access to Azure DevOps

## Security Best Practices

1. **Never commit `.env.test` or any file with credentials**
2. **Use environment variables in CI/CD pipelines**
3. **Rotate PATs regularly**
4. **Use minimal required permissions**
5. **The `.gitignore` file excludes sensitive files**

## CI/CD Integration

For CI/CD pipelines, set these as secrets:
- `AZURE_DEVOPS_PAT`
- `AZURE_DEVOPS_ORG`
- `AZURE_DEVOPS_PROJECT`

Example GitHub Actions:
```yaml
- name: Run tests
  env:
    AZURE_DEVOPS_PAT: ${{ secrets.AZURE_DEVOPS_PAT }}
    AZURE_DEVOPS_ORG: ${{ secrets.AZURE_DEVOPS_ORG }}
    AZURE_DEVOPS_PROJECT: ${{ secrets.AZURE_DEVOPS_PROJECT }}
  run: bun test
```