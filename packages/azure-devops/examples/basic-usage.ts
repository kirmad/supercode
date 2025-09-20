#!/usr/bin/env bun

/**
 * Basic usage example for Azure DevOps Work Item Context Generator
 *
 * This example demonstrates how to:
 * 1. Initialize the context generator
 * 2. Generate context for a work item
 * 3. Create a formatted prompt
 */

import { WorkItemContextGenerator } from '../src/work-item-context-generator.js';

// Configuration - use environment variables in production
const config = {
  organization: process.env['AZURE_DEVOPS_ORG'] || 'your-org',
  project: process.env['AZURE_DEVOPS_PROJECT'] || 'your-project',
  pat: process.env['AZURE_DEVOPS_PAT'] || 'your-personal-access-token'
};

async function main() {
  // Initialize the generator
  const generator = new WorkItemContextGenerator(config);

  // Work item ID to process
  const workItemId = 123456; // Replace with your work item ID

  try {
    console.log('🚀 Generating context for Work Item #' + workItemId);

    // Generate context with all features enabled
    const context = await generator.generateContext(workItemId, {
      includePRChanges: true,
      includePRComments: true,
      includePRCommits: true,
      includePRDiffs: false, // Set to true if you need diffs
      includeRelatedPRs: true,
      maxRelatedItems: 5,
      maxPRsPerWorkItem: 3
    });

    // Generate a formatted prompt
    const prompt = generator.formatContextAsPrompt(context);

    // Output the prompt
    console.log('\n' + '='.repeat(80));
    console.log('Generated Prompt:');
    console.log('='.repeat(80));
    console.log(prompt);

    // You can also access individual parts of the context
    console.log('\n📊 Summary:');
    console.log(`- Title: ${context.workItem.fields['System.Title']}`);
    console.log(`- State: ${context.workItem.fields['System.State']}`);
    console.log(`- Linked PRs: ${context.linkedPullRequests.length}`);
    console.log(`- Child Items: ${context.childWorkItems.length}`);
    console.log(`- Related Items: ${context.relatedWorkItems.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run if executed directly
if (import.meta.main) {
  main();
}