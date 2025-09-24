# BuildClient API Documentation

The BuildClient provides comprehensive functionality for managing Azure DevOps builds and PR build policies. It enables you to query builds, manage build policies, and requeue expired builds.

## Features

- 🏗️ **Build Management**: Query, filter, and manage builds
- 📋 **Build Policies**: Get and analyze PR build policies
- ⏰ **Expired Build Detection**: Identify and requeue expired builds
- 🔄 **Build Operations**: Queue, cancel, and retry builds
- 🎯 **PR Integration**: Get builds associated with pull requests

## Installation

The BuildClient is included in the `@supercode/azure-devops` package:

```typescript
import { AzureDevOpsClient } from '@supercode/azure-devops';

const client = new AzureDevOpsClient({
  organization: 'your-org',
  project: 'your-project',
  pat: 'your-personal-access-token'
});

// Access build functionality through client.builds
const builds = await client.builds.getBuilds();
```

## API Reference

### getBuilds(options)

Get builds with flexible filtering options.

```typescript
const builds = await client.builds.getBuilds({
  top: 10,
  queryOrder: 'finishTimeDescending',
  statusFilter: 'completed',
  resultFilter: 'succeeded',
  branchName: 'refs/heads/main'
});
```

**Options:**
- `branchName`: Filter by branch
- `buildNumber`: Specific build number
- `definitions`: Comma-separated definition IDs
- `maxBuildsPerDefinition`: Limit per definition
- `queryOrder`: Sort order (finishTimeDescending, queueTimeAscending, etc.)
- `statusFilter`: Build status filter
- `resultFilter`: Build result filter
- `top`: Maximum number of results
- `repositoryId`: Repository identifier

### getBuild(buildId)

Get detailed information about a specific build.

```typescript
const build = await client.builds.getBuild(12345);
console.log(`Build ${build.buildNumber}: ${build.status}`);
```

### getPrBuilds(repositoryId, pullRequestId)

Get all builds associated with a pull request.

```typescript
const prBuilds = await client.builds.getPrBuilds('my-repo', 100);
for (const build of prBuilds) {
  console.log(`Build ${build.id}: ${build.result}`);
}
```

### getPrPolicies(repositoryId, pullRequestId)

Get all policies (including build policies) for a pull request.

```typescript
const policies = await client.builds.getPrPolicies('my-repo', 100);

for (const policy of policies) {
  console.log(`${policy.name}: ${policy.status}`);
  if (policy.isBuildPolicy && policy.buildIsExpired) {
    console.log(`  ⚠️ Build ${policy.buildId} is expired!`);
  }
}
```

### getPrBuildPolicies(repositoryId, pullRequestId)

Get only build policies for a pull request.

```typescript
const buildPolicies = await client.builds.getPrBuildPolicies('my-repo', 100);
const expiredPolicies = buildPolicies.filter(p => p.buildIsExpired);
```

### requeueBuild(evaluationId, projectId)

Requeue a single build via its policy evaluation.

```typescript
const requeued = await client.builds.requeueBuild(evaluationId, projectId);
console.log(`Requeued build at ${requeued.timestamp}`);
```

### requeueExpiredBuilds(repositoryId, pullRequestId)

Automatically identify and requeue all expired builds for a PR.

```typescript
const requeuedBuilds = await client.builds.requeueExpiredBuilds('my-repo', 100);
console.log(`Requeued ${requeuedBuilds.length} expired builds`);
```

### cancelBuild(buildId)

Cancel a running build.

```typescript
const cancelled = await client.builds.cancelBuild(12345);
console.log(`Build ${cancelled.id} is now ${cancelled.status}`);
```

### queueBuild(definitionId, sourceBranch?, parameters?)

Queue a new build.

```typescript
const newBuild = await client.builds.queueBuild(
  42,                    // Definition ID
  'refs/heads/feature',  // Optional branch
  { myParam: 'value' }   // Optional parameters
);
console.log(`Queued build ${newBuild.buildNumber}`);
```

### updateBuild(buildId, options)

Update or retry a build.

```typescript
// Retry a build
const retried = await client.builds.updateBuild(12345, {
  forceRetry: true
});
```

## Use Cases

### 1. Monitor Build Health

```typescript
async function monitorBuildHealth() {
  const builds = await client.builds.getBuilds({
    top: 20,
    queryOrder: 'finishTimeDescending'
  });

  const stats = {
    total: builds.length,
    succeeded: builds.filter(b => b.result === 'succeeded').length,
    failed: builds.filter(b => b.result === 'failed').length,
    inProgress: builds.filter(b => b.status === 'inProgress').length
  };

  console.log('Build Health:', stats);
}
```

### 2. Auto-Requeue Expired PR Builds

```typescript
async function maintainPrBuilds(repositoryId: string, prId: number) {
  // Check policies
  const policies = await client.builds.getPrBuildPolicies(repositoryId, prId);

  // Find expired builds
  const expired = policies.filter(p =>
    p.buildIsExpired &&
    p.status !== PolicyStatus.Approved
  );

  if (expired.length > 0) {
    console.log(`Found ${expired.length} expired builds, requeueing...`);
    const requeued = await client.builds.requeueExpiredBuilds(repositoryId, prId);
    console.log(`Successfully requeued ${requeued.length} builds`);
  }
}
```

### 3. Build Performance Analysis

```typescript
async function analyzeBuildPerformance(definitionId: number) {
  const builds = await client.builds.getBuilds({
    definitions: definitionId.toString(),
    statusFilter: 'completed',
    top: 50,
    queryOrder: 'finishTimeDescending'
  });

  const durations = builds
    .filter(b => b.startTime && b.finishTime)
    .map(b => {
      const start = new Date(b.startTime!).getTime();
      const finish = new Date(b.finishTime!).getTime();
      return (finish - start) / 1000 / 60; // minutes
    });

  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  console.log(`Average build duration: ${avgDuration.toFixed(2)} minutes`);
}
```

## Error Handling

The BuildClient provides detailed error messages for common scenarios:

```typescript
try {
  const builds = await client.builds.getPrBuilds('repo', 123);
} catch (error: any) {
  if (error.message.includes('TF401019')) {
    console.error('Repository not found or no access');
  } else if (error.message.includes('TF401175')) {
    console.error('Branch deleted - PR may be completed');
  } else {
    console.error('API Error:', error.message);
  }
}
```

## Testing

The package includes comprehensive E2E tests for the BuildClient:

```bash
# Run build client tests
bun test test/suites/build-client.test.ts

# Run specific test
bun test test/suites/build-client.test.ts -t "getBuilds"
```

## Configuration

Configure the client with your Azure DevOps credentials:

```typescript
const config = {
  organization: process.env.AZURE_DEVOPS_ORG,
  project: process.env.AZURE_DEVOPS_PROJECT,
  pat: process.env.AZURE_DEVOPS_PAT,
  apiVersion: '7.1' // Optional, defaults to 7.1
};

const client = new AzureDevOpsClient(config);
```

## Security Notes

- Never hardcode credentials in your code
- Use environment variables or secure vaults for PAT tokens
- Ensure your PAT has appropriate permissions:
  - Build (Read & Execute)
  - Code (Read)
  - Pull Request (Read)
  - Policy (Read)

## Limitations

- The HierarchyQuery API used for policies is internal and may change
- Build requeueing requires appropriate permissions
- Some operations may fail if branches are deleted after PR completion

## Contributing

The BuildClient is part of the @supercode/azure-devops package. Contributions are welcome!

## License

MIT