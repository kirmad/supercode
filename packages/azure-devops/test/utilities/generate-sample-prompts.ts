#!/usr/bin/env bun

/**
 * Generate sample prompts for multiple work items
 */

import { WorkItemContextGenerator, AzureDevOpsClient } from '../../src/index.js';
import * as fs from 'fs/promises';

// Environment variable configuration
const organization = process.env['AZURE_DEVOPS_ORG'];
const project = process.env['AZURE_DEVOPS_PROJECT'];
const pat = process.env['AZURE_DEVOPS_PAT'];

if (!organization) {
  throw new Error('AZURE_DEVOPS_ORG environment variable is required');
}
if (!project) {
  throw new Error('AZURE_DEVOPS_PROJECT environment variable is required');
}
if (!pat) {
  throw new Error('AZURE_DEVOPS_PAT environment variable is required');
}

const config = {
  organization,
  project,
  pat
};

async function generateSamplePrompts() {
  const client = new AzureDevOpsClient(config);
  const generator = new WorkItemContextGenerator(config);

  console.log('🚀 GENERATING SAMPLE PROMPTS FOR WORK ITEMS');
  console.log('=' .repeat(60));
  console.log(`Organization: ${config.organization}`);
  console.log(`Project: ${config.project}`);
  console.log(`Started: ${new Date().toISOString()}\n`);

  try {
    // Get some work items to use as examples
    console.log('📋 Fetching work items...');
    const workItems = await client.workItems.getWorkItemsAssignedToUser();

    // Also get some tagged work items for variety
    const bugItems = await client.workItems.getWorkItemsWithTag('bug');

    // Select a few different work items
    const selectedItems = [
      ...workItems.slice(0, 2),  // First 2 assigned items
      ...bugItems.slice(0, 1)     // First bug item
    ].slice(0, 3); // Ensure we only have 3 total

    console.log(`Found ${workItems.length} assigned items and ${bugItems.length} bug items`);
    console.log(`Generating prompts for ${selectedItems.length} work items...\n`);

    const prompts: { id: number; title: string; prompt: string }[] = [];

    // Generate prompts for each selected work item
    for (const item of selectedItems) {
      console.log(`\n📝 Processing Work Item #${item.id}`);
      console.log(`   Title: ${item.fields['System.Title']}`);
      console.log(`   Type: ${item.fields['System.WorkItemType']}`);
      console.log(`   State: ${item.fields['System.State']}`);

      try {
        console.log('   Generating context...');

        // Generate prompt with moderate detail
        const prompt = await generator.generatePrompt(item.id, {
          includePRChanges: true,
          includePRComments: false,  // Keep false to reduce size
          includeRelatedPRs: false,  // Keep false for faster generation
          maxRelatedItems: 5,
          maxPRsPerWorkItem: 2
        });

        prompts.push({
          id: item.id,
          title: item.fields['System.Title'],
          prompt
        });

        console.log(`   ✅ Generated ${prompt.length} characters`);
        console.log(`   ✅ ${prompt.split('\n').length} lines`);

        // Save individual prompt file
        const filename = `prompt-workitem-${item.id}.txt`;
        await fs.writeFile(filename, prompt);
        console.log(`   💾 Saved to ${filename}`);

      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`   ❌ Failed to generate prompt: ${errorMessage}`);
      }
    }

    // Create a combined output file with all prompts
    console.log('\n\n📄 CREATING COMBINED OUTPUT FILE...');

    let combinedOutput = '═'.repeat(80) + '\n';
    combinedOutput += '                    AZURE DEVOPS WORK ITEM PROMPTS\n';
    combinedOutput += '═'.repeat(80) + '\n\n';
    combinedOutput += `Generated: ${new Date().toISOString()}\n`;
    combinedOutput += `Organization: ${config.organization}\n`;
    combinedOutput += `Project: ${config.project}\n`;
    combinedOutput += `Total Prompts: ${prompts.length}\n\n`;

    for (const { id, title, prompt } of prompts) {
      combinedOutput += '═'.repeat(80) + '\n';
      combinedOutput += `WORK ITEM #${id}\n`;
      combinedOutput += '═'.repeat(80) + '\n';
      combinedOutput += `Title: ${title}\n`;
      combinedOutput += `Characters: ${prompt.length}\n`;
      combinedOutput += `Lines: ${prompt.split('\n').length}\n`;
      combinedOutput += '-'.repeat(80) + '\n\n';
      combinedOutput += prompt;
      combinedOutput += '\n\n';
    }

    combinedOutput += '═'.repeat(80) + '\n';
    combinedOutput += '                           END OF PROMPTS\n';
    combinedOutput += '═'.repeat(80) + '\n';

    // Save combined output
    const combinedFilename = 'all-prompts-combined.txt';
    await fs.writeFile(combinedFilename, combinedOutput);
    console.log(`\n💾 All prompts saved to ${combinedFilename}`);

    // Create a summary file
    let summaryOutput = 'WORK ITEM PROMPT GENERATION SUMMARY\n';
    summaryOutput += '=' .repeat(40) + '\n\n';
    summaryOutput += `Date: ${new Date().toISOString()}\n`;
    summaryOutput += `Organization: ${config.organization}\n`;
    summaryOutput += `Project: ${config.project}\n\n`;
    summaryOutput += 'Generated Prompts:\n';
    summaryOutput += '-'.repeat(40) + '\n';

    for (const { id, title, prompt } of prompts) {
      const lines = prompt.split('\n');
      const previewLines = lines.slice(0, 15).join('\n');

      summaryOutput += `\n📋 Work Item #${id}\n`;
      summaryOutput += `Title: ${title}\n`;
      summaryOutput += `Size: ${prompt.length} characters, ${lines.length} lines\n`;
      summaryOutput += `Preview:\n`;
      summaryOutput += '```\n';
      summaryOutput += previewLines;
      summaryOutput += '\n... [' + (lines.length - 15) + ' more lines]\n';
      summaryOutput += '```\n';
      summaryOutput += '-'.repeat(40) + '\n';
    }

    summaryOutput += '\nFiles Generated:\n';
    for (const { id } of prompts) {
      summaryOutput += `  - prompt-workitem-${id}.txt\n`;
    }
    summaryOutput += `  - ${combinedFilename}\n`;
    summaryOutput += `  - prompt-summary.txt (this file)\n`;

    await fs.writeFile('prompt-summary.txt', summaryOutput);
    console.log(`💾 Summary saved to prompt-summary.txt`);

    // Display summary
    console.log('\n\n📊 GENERATION COMPLETE!');
    console.log('=' .repeat(60));
    console.log(`✅ Generated ${prompts.length} prompts`);
    console.log(`✅ Total characters: ${prompts.reduce((sum, p) => sum + p.prompt.length, 0)}`);
    console.log(`✅ Files created: ${prompts.length + 2}`);
    console.log('\nFiles:');
    for (const { id } of prompts) {
      console.log(`  📄 prompt-workitem-${id}.txt`);
    }
    console.log(`  📄 ${combinedFilename}`);
    console.log(`  📄 prompt-summary.txt`);

  } catch (error: unknown) {
    console.error('\n❌ Error:', error);
    if (error && typeof error === 'object' && 'response' in error && error.response && typeof error.response === 'object' && 'text' in error.response && typeof error.response.text === 'function') {
      try {
        console.error('Response:', await error.response.text());
      } catch (responseError) {
        console.error('Could not read response text:', responseError);
      }
    }
  }
}

// Run the generator
generateSamplePrompts().catch(console.error);
// Export for test runner
export async function runTest() {
  console.log('This is a utility file, not a test');
  return Promise.resolve();
}
