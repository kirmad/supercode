#!/usr/bin/env bun

/**
 * Test the Work Item Context Generator API
 */

import { WorkItemContextGenerator } from '../../src/index.js';
import { TEST_CONFIG, validateConfig, getAzureDevOpsConfig } from '../config.js';
import * as fs from 'fs/promises';
import * as path from 'path';


async function testContextGenerator() {
  console.log('🚀 Starting Context Generator test');

  // Validate configuration first
  if (!validateConfig()) {
    process.exit(1);
  }

  const generator = new WorkItemContextGenerator(getAzureDevOpsConfig());

  console.log('🚀 WORK ITEM CONTEXT GENERATOR - TEST');
  console.log('=' .repeat(60));
  console.log(`Organization: ${TEST_CONFIG.organization}`);
  console.log(`Project: ${TEST_CONFIG.project}`);
  console.log(`Started: ${new Date().toISOString()}\n`);

  try {
    // Test with a known work item
    const workItemId = 4190965; // A work item we know exists

    console.log(`📋 Generating context for Work Item #${workItemId}`);
    console.log('Please wait, gathering all related information...\n');

    // Generate comprehensive context
    const context = await generator.generateContext(workItemId, {
      includePRChanges: true,
      includePRComments: true,
      includeRelatedPRs: false, // Set to false to speed up the test
      maxRelatedItems: 5,
      maxPRsPerWorkItem: 3
    });

    console.log('✅ Context Generated Successfully!\n');
    console.log('📊 CONTEXT SUMMARY');
    console.log('=' .repeat(60));
    console.log(`Work Item: #${context.workItem.id} - ${context.workItem.fields['System.Title']}`);
    console.log(`Type: ${context.workItem.fields['System.WorkItemType']}`);
    console.log(`State: ${context.workItem.fields['System.State']}`);
    console.log(`Comments: ${context.comments.length}`);
    console.log(`Parent: ${context.parentWorkItem ? '#' + context.parentWorkItem.id : 'None'}`);
    console.log(`Children: ${context.childWorkItems.length}`);
    console.log(`Related: ${context.relatedWorkItems.length}`);
    console.log(`Linked PRs: ${context.linkedPullRequests.length}`);
    console.log(`Related PRs: ${context.relatedPullRequests.length}`);

    // Show some details about linked PRs
    if (context.linkedPullRequests.length > 0) {
      console.log('\n🔗 LINKED PULL REQUESTS:');
      for (const prContext of context.linkedPullRequests) {
        const pr = prContext.pullRequest;
        console.log(`  - PR #${pr.pullRequestId}: ${pr.title}`);
        console.log(`    Repository: ${prContext.repository.name}`);
        console.log(`    Status: ${pr.status}`);
        if (prContext.changedFiles) {
          console.log(`    Changed Files: ${prContext.changedFiles.length}`);
        }
        if (prContext.comments) {
          const totalComments = prContext.comments.reduce((sum, t) => sum + (t.comments?.length || 0), 0);
          console.log(`    Comments: ${totalComments}`);
        }
      }
    }

    // Generate and display the prompt
    console.log('\n\n📝 GENERATING COMPREHENSIVE PROMPT...');
    console.log('=' .repeat(60));

    const prompt = await generator.generatePrompt(workItemId, {
      includePRChanges: true,
      includePRComments: false, // Keep false to reduce output size
      includeRelatedPRs: false
    });

    // Display first part of the prompt
    const promptLines = prompt.split('\n');
    const previewLines = 50;
    console.log('\n📄 GENERATED PROMPT (First ' + previewLines + ' lines):');
    console.log('-'.repeat(60));
    console.log(promptLines.slice(0, previewLines).join('\n'));

    if (promptLines.length > previewLines) {
      console.log('\n... [' + (promptLines.length - previewLines) + ' more lines]');
    }

    console.log('\n-'.repeat(60));
    console.log(`✅ Total prompt length: ${prompt.length} characters`);
    console.log(`✅ Total lines: ${promptLines.length}`);

    // Save the full prompt to a file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = path.join(TEST_CONFIG.artifactsDir, `work-item-${workItemId}-context-${timestamp}.md`);
    await fs.writeFile(outputFile, prompt);
    console.log(`\n💾 Full prompt saved to: ${outputFile}`);

  } catch (error) {
    console.error('\n❌ Error:', error);
    if (error instanceof Error && 'response' in error) {
      const httpError = error as Error & { response?: { status?: number; text?: () => Promise<string> } };
      if (httpError.response) {
        console.error('Response status:', httpError.response.status);
        if (httpError.response.text) {
          console.error('Response body:', await httpError.response.text());
        }
      }
    }
  }

  console.log('\n' + '=' .repeat(60));
  console.log('✅ Test completed!');
}

// Export for test runner
export async function runTest() {
  return testContextGenerator();
}

// Allow direct execution
if (import.meta.main) {
  testContextGenerator()
    .then(() => {
      console.log('\n🎉 Test complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}