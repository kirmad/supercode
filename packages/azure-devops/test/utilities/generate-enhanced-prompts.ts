#!/usr/bin/env bun

/**
 * Generate enhanced prompts for work items with linked PRs
 * Shows detailed PR information including file changes
 */

import { WorkItemContextGenerator } from '../../src/index.js';
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

async function generateEnhancedPrompts() {
  const generator = new WorkItemContextGenerator(config);

  console.log('🚀 GENERATING ENHANCED PROMPTS WITH PR DETAILS');
  console.log('=' .repeat(60));

  // Work items found to have linked PRs
  const workItemIds = [4195539, 4277689, 4186107];

  const prompts: string[] = [];
  const summaries: string[] = [];

  for (const workItemId of workItemIds) {
    try {
      console.log(`\n📋 Processing Work Item #${workItemId}...`);

      // Generate the prompt with full context
      const prompt = await generator.generatePrompt(workItemId);

      // Save individual prompt
      const fileName = `enhanced-prompt-${workItemId}.txt`;
      await fs.writeFile(fileName, prompt, 'utf-8');

      prompts.push(prompt);

      // Create summary info
      const lines = prompt.split('\n');
      const title = lines.find(l => l.startsWith('## Work Item #'))?.replace('## Work Item #', '').trim() || '';
      const prSection = prompt.indexOf('### Pull Requests');
      const hasPRs = prSection > -1;

      let prCount = 0;
      let fileChangeCount = 0;

      if (hasPRs) {
        // Count PRs and file changes
        const prMatches = prompt.match(/#### PR #\d+:/g);
        prCount = prMatches ? prMatches.length : 0;

        // Count file changes
        const fileMatches = prompt.match(/\s+[➕📝❌🔄🔧📋]\s+`[^`]+`/g);
        fileChangeCount = fileMatches ? fileMatches.length : 0;
      }

      const summary = {
        id: workItemId,
        title: title.substring(0, 100),
        size: prompt.length,
        lines: lines.length,
        hasPRs,
        prCount,
        fileChangeCount
      };

      summaries.push(`
📋 Work Item #${workItemId}
Title: ${summary.title}${summary.title.length >= 100 ? '...' : ''}
Size: ${summary.size.toLocaleString()} characters, ${summary.lines} lines
Pull Requests: ${summary.prCount > 0 ? `✅ ${summary.prCount} PRs with ${summary.fileChangeCount} file changes` : '❌ No PRs'}
Saved to: ${fileName}
`);

      console.log(`✅ Generated prompt: ${summary.size.toLocaleString()} chars, ${summary.lines} lines`);
      if (summary.prCount > 0) {
        console.log(`   Found ${summary.prCount} linked PRs with ${summary.fileChangeCount} file changes`);
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Error processing work item ${workItemId}:`, errorMessage);
      summaries.push(`
📋 Work Item #${workItemId}
Error: ${errorMessage}
`);
    }
  }

  // Create combined file with all prompts
  const combinedContent = `════════════════════════════════════════════════════════════════════════════════
                    AZURE DEVOPS WORK ITEM PROMPTS WITH PR DETAILS
════════════════════════════════════════════════════════════════════════════════

Generated: ${new Date().toISOString()}
Organization: ${config.organization}
Project: ${config.project}
Total Prompts: ${prompts.length}

${prompts.map((prompt, i) => `
════════════════════════════════════════════════════════════════════════════════
WORK ITEM #${workItemIds[i]}
════════════════════════════════════════════════════════════════════════════════
${prompt}
`).join('\n')}

════════════════════════════════════════════════════════════════════════════════
                           END OF PROMPTS
════════════════════════════════════════════════════════════════════════════════
`;

  await fs.writeFile('enhanced-prompts-combined.txt', combinedContent, 'utf-8');

  // Create summary file
  const summaryContent = `ENHANCED PROMPT GENERATION SUMMARY
========================================

Date: ${new Date().toISOString()}
Organization: ${config.organization}
Project: ${config.project}

Generated Prompts:
----------------------------------------
${summaries.join('')}

Files Generated:
${workItemIds.map(id => `  - enhanced-prompt-${id}.txt`).join('\n')}
  - enhanced-prompts-combined.txt
  - enhanced-prompt-summary.txt (this file)
`;

  await fs.writeFile('enhanced-prompt-summary.txt', summaryContent, 'utf-8');

  console.log('\n' + '=' .repeat(60));
  console.log('✅ GENERATION COMPLETE');
  console.log('=' .repeat(60));
  console.log(`Generated ${prompts.length} enhanced prompts with PR details`);
  console.log('\nOutput files:');
  console.log('  - enhanced-prompts-combined.txt (all prompts)');
  console.log('  - enhanced-prompt-summary.txt (summary)');
  workItemIds.forEach(id => {
    console.log(`  - enhanced-prompt-${id}.txt (individual)`);
  });
}

// Run the generation
generateEnhancedPrompts().catch(console.error);
// Export for test runner
export async function runTest() {
  console.log('This is a utility file, not a test');
  return Promise.resolve();
}
