#!/usr/bin/env bun
/**
 * Example: Monitor PR Build Status
 *
 * This script demonstrates how to monitor the build status of a pull request,
 * including gating builds that must pass before the PR can be merged.
 *
 * Usage:
 *   bun run examples/monitor-pr-builds.ts <repository> <pr-id>
 *
 * Example:
 *   bun run examples/monitor-pr-builds.ts MyRepo 1234
 */

import { AzureDevOpsClient } from '../src/index.js';
import { PolicyStatus } from '../src/index.js';

// Configuration from environment or defaults
const config = {
  organization: process.env['AZURE_DEVOPS_ORG'] || 'your-org',
  project: process.env['AZURE_DEVOPS_PROJECT'] || 'your-project',
  pat: process.env['AZURE_DEVOPS_PAT'] || '',
};

// Get command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: bun run monitor-pr-builds.ts <repository> <pr-id>');
  console.error('Example: bun run monitor-pr-builds.ts MyRepo 1234');
  process.exit(1);
}

const repositoryId = args[0];
const prId = parseInt(args[1], 10);

if (isNaN(prId)) {
  console.error('Error: PR ID must be a number');
  process.exit(1);
}

// Check for required configuration
if (!config.pat) {
  console.error('Error: AZURE_DEVOPS_PAT environment variable is required');
  console.error('Set it in your .env file or environment');
  process.exit(1);
}

async function main() {
  const client = new AzureDevOpsClient(config);

  console.log(`\n🔍 Monitoring PR #${prId} in repository: ${repositoryId}`);
  console.log(`   Organization: ${config.organization}`);
  console.log(`   Project: ${config.project}`);
  console.log('─'.repeat(60));

  try {
    // Step 1: Get PR build summary
    console.log('\n📊 PR Build Summary:');
    const summary = await client.builds.getPrBuildSummary(repositoryId, prId);

    console.log(`   Total Policies: ${summary.totalPolicies}`);
    console.log(`   Approved Builds: ${summary.approvedBuilds}`);
    console.log(`   Failed Builds: ${summary.failedBuilds}`);
    console.log(`   Running Builds: ${summary.runningBuilds}`);
    console.log(`   Expired Builds: ${summary.expiredBuilds}`);
    console.log(`   Blocking Builds: ${summary.blockingBuilds}`);
    console.log(`   Can Complete: ${summary.canComplete ? '✅ Yes' : '❌ No'}`);

    // Step 2: Get gating builds details
    console.log('\n🚦 Gating Builds:');
    const gatingBuilds = await client.builds.getPrGatingBuilds(repositoryId, prId);

    if (gatingBuilds.length === 0) {
      console.log('   No gating builds found for this PR');
      return;
    }

    // Display each gating build
    for (const gatingBuild of gatingBuilds) {
      console.log(`\n   📦 ${gatingBuild.policyName}`);
      console.log(`      Build ID: ${gatingBuild.buildId}`);
      console.log(`      Status: ${getPolicyStatusName(gatingBuild.status)}`);
      console.log(`      Blocking: ${gatingBuild.isBlocking ? '🚫 Yes' : '✅ No'}`);
      console.log(`      Expired: ${gatingBuild.isExpired ? '⚠️ Yes' : '✅ No'}`);

      if (gatingBuild.build) {
        console.log(`      Build Status: ${gatingBuild.build.status || 'Unknown'}`);
        console.log(`      Build Result: ${gatingBuild.build.result || 'In Progress'}`);

        if (gatingBuild.build.finishTime) {
          console.log(`      Finished: ${new Date(gatingBuild.build.finishTime).toLocaleString()}`);
        }
      }
    }

    // Step 3: Check for expired builds that need requeueing
    const expiredBuilds = gatingBuilds.filter(gb => gb.isExpired && gb.isBlocking);
    if (expiredBuilds.length > 0) {
      console.log('\n⚠️  Expired Blocking Builds Found:');
      for (const expired of expiredBuilds) {
        console.log(`   - ${expired.policyName} (Build #${expired.buildId})`);
      }

      console.log('\n💡 Tip: You can requeue expired builds using:');
      console.log('   await client.builds.requeueExpiredBuilds(repositoryId, prId);');
    }

    // Step 4: Monitor running builds (optional)
    const runningBuilds = gatingBuilds.filter(gb =>
      gb.build?.status === 'inProgress' || gb.build?.status === 'notStarted'
    );

    if (runningBuilds.length > 0) {
      console.log('\n🔄 Monitoring Running Builds:');
      console.log('   (Press Ctrl+C to stop monitoring)\n');

      // Monitor each running build
      for (const runningBuild of runningBuilds) {
        if (runningBuild.buildId) {
          console.log(`   Monitoring ${runningBuild.policyName} (Build #${runningBuild.buildId})...`);

          try {
            const completedBuild = await client.builds.monitorBuild(runningBuild.buildId, {
              pollInterval: 10000, // Check every 10 seconds
              maxRetries: 60, // Monitor for up to 10 minutes
              onStatusChange: (build) => {
                console.log(`     Status Update: ${build.status} - ${build.result || 'In Progress'}`);
              }
            });

            console.log(`   ✅ Build completed with result: ${completedBuild.result}`);
          } catch (error: any) {
            console.log(`   ❌ Error monitoring build: ${error.message}`);
          }
        }
      }

      // Re-fetch summary after monitoring
      console.log('\n📊 Updated PR Build Summary:');
      const updatedSummary = await client.builds.getPrBuildSummary(repositoryId, prId);
      console.log(`   Can Complete: ${updatedSummary.canComplete ? '✅ Yes' : '❌ No'}`);
    }

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);

    if (error.message.includes('404')) {
      console.error('\n💡 Possible issues:');
      console.error('   - Check that the repository name is correct');
      console.error('   - Verify the PR ID exists');
      console.error('   - Ensure your PAT has access to the project');
    }

    process.exit(1);
  }
}

function getPolicyStatusName(status: PolicyStatus): string {
  const statusNames: Record<PolicyStatus, string> = {
    [PolicyStatus.NotSet]: '⚪ Not Set',
    [PolicyStatus.Queued]: '🔵 Queued',
    [PolicyStatus.Approved]: '✅ Approved',
    [PolicyStatus.Rejected]: '❌ Rejected',
    [PolicyStatus.Running]: '🔄 Running',
    [PolicyStatus.Broken]: '🔴 Broken',
  };

  return statusNames[status] || `Unknown (${status})`;
}

// Run the main function
main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});