#!/usr/bin/env bun

/**
 * Test enhanced prompt generation for a single work item with PRs
 */

import { WorkItemContextGenerator } from '../../src/index.js';
import { TEST_CONFIG, validateConfig, getAzureDevOpsConfig } from '../config.js';
import * as fs from 'fs/promises';

async function testEnhancedGeneration() {
  console.log('🚀 Starting Enhanced Generation test');

  // Validate configuration first
  if (!validateConfig()) {
    process.exit(1);
  }

  const generator = new WorkItemContextGenerator(getAzureDevOpsConfig());

  console.log('🚀 TESTING ENHANCED PROMPT GENERATION WITH PR DETAILS');
  console.log('=' .repeat(60));

  // Test with work item that has multiple PRs
  const workItemId = 4277689; // This has 2 PRs

  try {
    console.log(`\n📋 Generating prompt for Work Item #${workItemId}...`);

    // Generate the prompt with full context
    const prompt = await generator.generatePrompt(workItemId);

    // Save the prompt
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${TEST_CONFIG.artifactsDir}/test-enhanced-prompt-${workItemId}-${timestamp}.txt`;
    await fs.writeFile(fileName, prompt, 'utf-8');

    // Display summary
    const lines = prompt.split('\n');
    console.log(`✅ Generated prompt: ${prompt.length.toLocaleString()} chars, ${lines.length} lines`);

    // Check for PR sections
    const prSection = prompt.indexOf('### Pull Requests');
    if (prSection > -1) {
      const prMatches = prompt.match(/#### PR #\d+:/g);
      const prCount = prMatches ? prMatches.length : 0;

      const fileMatches = prompt.match(/\s+[➕📝❌🔄🔧📋]\s+`[^`]+`/g);
      const fileChangeCount = fileMatches ? fileMatches.length : 0;

      console.log(`   Found ${prCount} linked PRs with ${fileChangeCount} file changes`);

      // Extract and show first few file changes
      if (fileMatches && fileMatches.length > 0) {
        console.log('\n   Sample file changes:');
        fileMatches.slice(0, 5).forEach(match => {
          console.log(`     ${match.trim()}`);
        });
        if (fileMatches.length > 5) {
          console.log(`     ... and ${fileMatches.length - 5} more files`);
        }
      }
    }

    console.log(`\n📄 Prompt saved to: ${fileName}`);

    // Also show a preview of the PR section
    const prSectionStart = prompt.indexOf('### Pull Requests');
    if (prSectionStart > -1) {
      const prSectionEnd = prompt.indexOf('\n## ', prSectionStart);
      const prSection = prompt.substring(prSectionStart, prSectionEnd > -1 ? prSectionEnd : prompt.length);

      // Show first 50 lines of PR section
      const prLines = prSection.split('\n').slice(0, 50);
      console.log('\n' + '=' .repeat(60));
      console.log('PREVIEW OF PR SECTION:');
      console.log('=' .repeat(60));
      console.log(prLines.join('\n'));
      if (prSection.split('\n').length > 50) {
        console.log('... [truncated for display]');
      }
    }

  } catch (error: any) {
    console.error(`❌ Error:`, error.message);
    console.error(error.stack);
  }
}

// Export for test runner
export async function runTest() {
  return testEnhancedGeneration();
}

// Allow direct execution
if (import.meta.main) {
  testEnhancedGeneration()
    .then(() => {
      console.log('\n🎉 Test complete!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}