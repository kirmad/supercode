#!/usr/bin/env bun

/**
 * Test enhanced prompt generation with detailed error logging
 */

import { WorkItemContextGenerator, AzureDevOpsClient } from '../../src/index.js';
import { validateConfig, getAzureDevOpsConfig } from '../config.js';
import * as fs from 'fs/promises';

async function testWithDetailedLogging() {
  console.log('🚀 Starting Detailed Generation test');

  // Validate configuration first
  if (!validateConfig()) {
    process.exit(1);
  }

  const generator = new WorkItemContextGenerator(getAzureDevOpsConfig());

  console.log('🚀 TESTING ENHANCED PROMPT GENERATION');
  console.log('=' .repeat(60));

  // Test with a work item that has PRs
  const workItemId = 4277689;

  try {
    console.log(`\n📋 Testing Work Item #${workItemId}...`);

    // First, just get the work item details
    console.log('Step 1: Getting work item details...');
    const client = new AzureDevOpsClient(getAzureDevOpsConfig());
    const wiDetails = await client.workItems.getWorkItemDetails(workItemId);
    console.log('  ✅ Work item retrieved');
    console.log(`  Title: ${wiDetails.workItem.fields['System.Title']}`);

    // Check for PR relations
    const prRelations = (wiDetails.workItem.relations || []).filter((r: any) =>
      r.rel === 'ArtifactLink' && r.url?.includes('PullRequestId')
    );
    console.log(`  PR Relations found: ${prRelations.length}`);

    if (prRelations.length > 0) {
      console.log('\nStep 2: Processing PR relations...');

      for (const relation of prRelations.slice(0, 1)) { // Just test first PR
        console.log(`  Processing: ${relation.url}`);

        // Extract repo and PR ID
        const parts = relation.url.replace('vstfs:///Git/PullRequestId/', '').split('%2F');
        const repoId = parts[1];
        const prId = parseInt(parts[2]);

        console.log(`    Repo ID: ${repoId}`);
        console.log(`    PR ID: ${prId}`);

        // Get PR details
        console.log('  Step 2a: Getting PR details...');
        try {
          const pr = await client.pullRequests.getPullRequest(repoId, prId);
          console.log(`    ✅ PR #${pr.pullRequestId}: ${pr.title}`);
        } catch (err: any) {
          console.error(`    ❌ Failed to get PR: ${err.message}`);
        }

        // Get PR changes
        console.log('  Step 2b: Getting PR changes...');
        try {
          const changes = await client.pullRequests.getPullRequestChanges(repoId, prId);
          console.log(`    ✅ Changes retrieved: ${changes.changes.length} files`);
          if (changes.changes.length > 0) {
            console.log('    First few changes:');
            changes.changes.slice(0, 3).forEach(c => {
              console.log(`      - ${c.changeType}: ${c.item.path}`);
            });
          }
        } catch (err) {
          const error = err as Error;
          console.error(`    ❌ Failed to get changes: ${error.message}`);
          console.error('    Stack:', error.stack);
        }
      }
    }

    console.log('\nStep 3: Generating full prompt...');
    const prompt = await generator.generatePrompt(workItemId);
    console.log(`  ✅ Prompt generated: ${prompt.length} characters`);

    // Save the prompt
    const fileName = `detailed-test-prompt-${workItemId}.txt`;
    await fs.writeFile(fileName, prompt, 'utf-8');
    console.log(`  📄 Saved to: ${fileName}`);

  } catch (error: any) {
    console.error(`\n❌ ERROR: ${error.message}`);
    console.error('Stack trace:', error.stack);
  }
}

// Export for test runner
export async function runTest() {
  return testWithDetailedLogging();
}

// Allow direct execution
if (import.meta.main) {
  testWithDetailedLogging()
    .then(() => {
      console.log('\n🎉 Test complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}