#!/usr/bin/env bun

/**
 * Simple test for work item generation
 */

import { WorkItemContextGenerator } from '../../src/index.js';
import { validateConfig, getAzureDevOpsConfig } from '../config.js';

async function testSimple() {
  console.log('🚀 Starting Simple Generation test');

  // Validate configuration first
  if (!validateConfig()) {
    process.exit(1);
  }

  const generator = new WorkItemContextGenerator(getAzureDevOpsConfig());

  // Test with a work item that has NO PRs first to isolate the issue
  const workItemId = 4276915; // This one has no PRs from our earlier test

  console.log(`Testing work item #${workItemId} (no PRs)...`);

  try {
      const prompt = await generator.generatePrompt(workItemId);

    console.log(`✅ Success! Generated ${prompt.length} characters`);
    console.log('\nFirst 500 characters:');
    console.log(prompt.substring(0, 500));

  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
    console.error('Full error:', error);
    console.error('Stack:', error.stack);
  }
}

// Export for test runner
export async function runTest() {
  return testSimple();
}

// Allow direct execution
if (import.meta.main) {
  testSimple()
    .then(() => {
      console.log('\n🎉 Test complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}