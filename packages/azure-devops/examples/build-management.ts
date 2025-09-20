#!/usr/bin/env bun

/**
 * Example: Azure DevOps Build Management
 *
 * This script demonstrates how to use the BuildClient to:
 * - Get builds for a project
 * - Get build details
 * - Get PR build policies
 * - Requeue expired builds
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { AzureDevOpsClient } from '../src/index.js';

// Load environment variables
config({ path: resolve(process.cwd(), '.env') });

// Configuration
const ADO_CONFIG = {
  organization: process.env['AZURE_DEVOPS_ORG'] || '',
  project: process.env['AZURE_DEVOPS_PROJECT'] || '',
  pat: process.env['AZURE_DEVOPS_PAT'] || ''
};

// Validate configuration
if (!ADO_CONFIG.pat || !ADO_CONFIG.organization || !ADO_CONFIG.project) {
  console.error('❌ Missing required environment variables:');
  console.error('   AZURE_DEVOPS_ORG');
  console.error('   AZURE_DEVOPS_PROJECT');
  console.error('   AZURE_DEVOPS_PAT');
  process.exit(1);
}

async function demonstrateBuildManagement() {
  console.log('🚀 Azure DevOps Build Management Demo\n');
  console.log(`Organization: ${ADO_CONFIG.organization}`);
  console.log(`Project: ${ADO_CONFIG.project}\n`);

  // Initialize client
  const client = new AzureDevOpsClient(ADO_CONFIG);

  try {
    // 1. Get recent builds
    console.log('📦 Getting recent builds...');
    const builds = await client.builds.getBuilds({
      top: 5,
      queryOrder: 'finishTimeDescending'
    });

    if (builds.length === 0) {
      console.log('No builds found');
      return;
    }

    console.log(`Found ${builds.length} builds:\n`);

    for (const build of builds) {
      console.log(`  Build #${build.buildNumber}`);
      console.log(`    ID: ${build.id}`);
      console.log(`    Status: ${build.status || 'Unknown'}`);
      console.log(`    Result: ${build.result || 'In Progress'}`);
      console.log(`    Branch: ${build.sourceBranch}`);
      console.log(`    Definition: ${build.definition?.name || 'Unknown'}`);
      console.log(`    Requested By: ${build.requestedBy?.displayName || 'Unknown'}`);
      console.log('');
    }

    // 2. Get details of the most recent build
    if (builds.length > 0) {
      const buildId = builds[0].id;
      console.log(`\n📋 Getting details for build ${buildId}...`);

      const buildDetails = await client.builds.getBuild(buildId);
      console.log('Build Details:');
      console.log(`  Build Number: ${buildDetails.buildNumber}`);
      console.log(`  Queue Time: ${buildDetails.queueTime || 'N/A'}`);
      console.log(`  Start Time: ${buildDetails.startTime || 'Not started'}`);
      console.log(`  Finish Time: ${buildDetails.finishTime || 'Not finished'}`);
      console.log(`  Source Version: ${buildDetails.sourceVersion || 'Unknown'}`);
      console.log(`  Reason: ${buildDetails.reason || 'Manual'}`);
    }

    // 3. Example: Get PR build policies (requires valid repository and PR ID)
    const REPO_NAME = process.env['TEST_REPOSITORY'] || 'your-repo-name';
    const PR_ID = parseInt(process.env['TEST_PR_ID'] || '0');

    if (PR_ID > 0) {
      console.log(`\n🔍 Checking build policies for PR #${PR_ID}...`);

      try {
        const policies = await client.builds.getPrBuildPolicies(REPO_NAME, PR_ID);

        if (policies.length === 0) {
          console.log('No build policies found for this PR');
        } else {
          console.log(`Found ${policies.length} build policies:`);

          for (const policy of policies) {
            console.log(`\n  Policy: ${policy.name}`);
            console.log(`    Status: ${getStatusName(policy.status)}`);
            console.log(`    Blocking: ${policy.isBlocking ? 'Yes' : 'No'}`);
            console.log(`    Build ID: ${policy.buildId || 'None'}`);
            console.log(`    Expired: ${policy.buildIsExpired ? 'Yes' : 'No'}`);

            if (policy.buildIsExpired && policy.status !== 2) {
              console.log(`    ⚠️  This build needs to be requeued!`);
            }
          }

          // Check for expired builds
          const expiredPolicies = policies.filter(p =>
            p.buildIsExpired && p.status !== 2 // Not approved
          );

          if (expiredPolicies.length > 0) {
            console.log(`\n⏰ Found ${expiredPolicies.length} expired builds`);
            console.log('To requeue them, uncomment the following code:');
            console.log('// const requeuedBuilds = await client.builds.requeueExpiredBuilds(REPO_NAME, PR_ID);');
            console.log('// console.log(`Requeued ${requeuedBuilds.length} builds`);');
          }
        }
      } catch (error: any) {
        console.error(`Could not get policies for PR #${PR_ID}: ${error.message}`);
      }
    } else {
      console.log('\n📌 To test PR build policies, set these environment variables:');
      console.log('   TEST_REPOSITORY=your-repo-name');
      console.log('   TEST_PR_ID=123');
    }

    // 4. Example: Queue a new build (commented out for safety)
    console.log('\n🏗️ To queue a new build, you can use:');
    console.log('// const newBuild = await client.builds.queueBuild(');
    console.log('//   definitionId,        // Build definition ID');
    console.log('//   "refs/heads/main",   // Branch');
    console.log('//   { param: "value" }   // Optional parameters');
    console.log('// );');

    // 5. Example: Cancel a running build (commented out for safety)
    console.log('\n🛑 To cancel a running build, you can use:');
    console.log('// const cancelledBuild = await client.builds.cancelBuild(buildId);');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

function getStatusName(status: number): string {
  switch (status) {
    case 0: return 'Not Set';
    case 1: return 'Queued';
    case 2: return 'Approved';
    case 3: return 'Rejected';
    case 4: return 'Running';
    case 5: return 'Broken';
    default: return `Unknown (${status})`;
  }
}

// Run the demo
demonstrateBuildManagement();