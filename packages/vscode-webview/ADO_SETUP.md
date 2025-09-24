# Azure DevOps Integration Setup

## Prerequisites

1. An Azure DevOps organization
2. A project with work items and/or pull requests
3. A Personal Access Token (PAT) with appropriate permissions

## Setup Instructions

### 1. Generate a Personal Access Token

1. Navigate to https://dev.azure.com/{your-organization}/_usersSettings/tokens
2. Click "New Token"
3. Give it a descriptive name (e.g., "SuperCode Integration")
4. Select the following scopes:
   - **Work Items**: Read
   - **Code**: Read
   - **Pull Request**: Read
5. Click "Create" and copy the token (you won't be able to see it again)

### 2. Configure Environment Variables

1. Copy the sample environment file:
   ```bash
   cp .env.sample .env
   ```

2. Edit `.env` and add your credentials:
   ```env
   AZURE_DEVOPS_ORG=your-organization-name
   AZURE_DEVOPS_PROJECT=your-project-name
   AZURE_DEVOPS_PAT=your-personal-access-token
   ```

   **Important**:
   - For `AZURE_DEVOPS_ORG`, use only the organization name, not the full URL
   - Example: If your URL is `https://dev.azure.com/mycompany`, use `mycompany`

### 3. Restart the Development Server

After configuring your `.env` file, restart the development server:

```bash
bun run dev
```

## Using the Source Manager

Once configured, you can use the Source Manager in the Prompt Generation tab:

### Adding Work Items
1. Enter a work item ID in the "Work Item ID" input
2. Click "Add Work Item"
3. The work item details will be fetched and displayed

### Adding Pull Requests
1. Switch to the "Pull Request" tab
2. Enter either:
   - A pull request URL (e.g., `https://dev.azure.com/org/project/_git/repo/pullrequest/123`)
   - A pull request ID (e.g., `123`)
3. Click "Add PR"

### Loading "My Work Items"
1. Switch to the "My Work" tab
2. Click "Load My Work Items"
3. All work items assigned to you will be loaded

## Troubleshooting

### "Azure DevOps credentials not configured"

This error means the environment variables are not being loaded properly. Check:

1. Your `.env` file is in the correct location (`packages/vscode-webview/.env`)
2. All three required variables are set (AZURE_DEVOPS_ORG, AZURE_DEVOPS_PROJECT, AZURE_DEVOPS_PAT)
3. The development server was restarted after adding the `.env` file
4. Check the browser console for more detailed error messages

### Authentication Errors

If you get authentication errors:
1. Verify your PAT hasn't expired
2. Ensure the PAT has the required scopes (Work Items: Read, Code: Read, Pull Request: Read)
3. Check that the organization and project names are correct

### Network Errors

If you can't connect to Azure DevOps:
1. Check your internet connection
2. Verify your organization allows API access
3. Check if there are any firewall or proxy settings blocking the connection

## Security Notes

- Never commit your `.env` file to version control
- The `.env` file is already in `.gitignore` to prevent accidental commits
- Personal Access Tokens should be treated as passwords
- Regularly rotate your PATs for security
- Use tokens with minimal required permissions