#!/usr/bin/env bun

/**
 * Generate enhanced prompts with PR details
 * Shows file changes and PR summaries as requested
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

async function generateFinalEnhancedPrompts() {
  const generator = new WorkItemContextGenerator(config);

  console.log('🚀 GENERATING ENHANCED PROMPTS WITH PR DETAILS');
  console.log('=' .repeat(60));
  console.log('Showing file changes and PR summaries as requested');
  console.log('=' .repeat(60));

  // Use work items we know have PRs from our earlier search
  const workItemIds = [4277689, 4195539, 4186107];

  const prompts: string[] = [];
  const summaries: string[] = [];

  for (const workItemId of workItemIds) {
    try {
      console.log(`\n📋 Processing Work Item #${workItemId}...`);

      // Generate the prompt with full PR context
      const prompt = await generator.generatePrompt(workItemId, {
        includePRChanges: true,
        includePRComments: true,
        includeRelatedPRs: false,  // Focus on direct PRs
        maxPRsPerWorkItem: 10
      });

      // Save individual prompt
      const fileName = `enhanced-prompt-${workItemId}.txt`;
      await fs.writeFile(fileName, prompt, 'utf-8');

      prompts.push(prompt);

      // Analyze PR content in prompt
      const lines = prompt.split('\n');
      const prSection = prompt.indexOf('### Pull Requests');
      const hasPRs = prSection > -1;

      let prCount = 0;
      let fileChangeCount = 0;
      let prTitles: string[] = [];

      if (hasPRs) {
        // Count PRs
        const prMatches = prompt.match(/#### PR #(\d+): (.+)/g);
        if (prMatches) {
          prCount = prMatches.length;
          prTitles = prMatches.map(m => {
            const match = m.match(/#### PR #\d+: (.+)/);
            return match ? match[1] : '';
          }).filter(t => t);
        }

        // Count file changes
        const fileMatches = prompt.match(/\s+[➕📝❌🔄🔧📋]\s+`[^`]+`/g);
        fileChangeCount = fileMatches ? fileMatches.length : 0;
      }

      const summary = `
📋 Work Item #${workItemId}
Title: ${lines.find(l => l.startsWith('## Work Item #'))?.split(': ')[1] || 'Unknown'}
Size: ${prompt.length.toLocaleString()} characters, ${lines.length} lines
Pull Requests: ${prCount > 0 ? `✅ ${prCount} PRs` : '❌ No PRs'}${prCount > 0 ? `
  ${prTitles.map(t => `  - ${t}`).join('\n')}
  Total file changes: ${fileChangeCount}` : ''}
Saved to: ${fileName}`;

      summaries.push(summary);
      console.log(summary);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`\n❌ Error processing work item ${workItemId}:`, errorMessage);
      summaries.push(`
📋 Work Item #${workItemId}
Error: ${errorMessage}`);
    }
  }

  // Create combined file
  const combinedContent = `════════════════════════════════════════════════════════════════════════════════
                    AZURE DEVOPS WORK ITEM PROMPTS WITH PR DETAILS
════════════════════════════════════════════════════════════════════════════════

Generated: ${new Date().toISOString()}
Organization: ${config.organization}
Project: ${config.project}
Total Prompts: ${prompts.length}

The prompts below include detailed PR information including:
- File changes with change type indicators (➕ add, 📝 edit, ❌ delete, etc.)
- PR descriptions and summaries
- Change statistics
- Recent discussion highlights

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

This generation includes the requested PR details:
- File changes grouped by directory
- Change type indicators for different file operations
- PR descriptions and summaries
- Discussion highlights from PR comments

Generated Prompts:
----------------------------------------
${summaries.join('\n')}

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
generateFinalEnhancedPrompts().catch(console.error);
// Export for test runner
export async function runTest() {
  console.log('This is a utility file, not a test');
  return Promise.resolve();
}
