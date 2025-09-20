#!/usr/bin/env bun

/**
 * Comprehensive test for PR details including commits, diffs, and branch information
 * This test fetches complete PR context and logs it to a file
 */

import { WorkItemContextGenerator } from '../../src/work-item-context-generator.js';
import { TEST_CONFIG, validateConfig, getAzureDevOpsConfig } from '../config.js';
import * as fs from 'fs/promises';
import * as path from 'path';

async function testPRDetails() {
  console.log('🚀 Starting comprehensive PR details test');
  console.log('=' .repeat(80));

  // Validate configuration first
  if (!validateConfig()) {
    process.exit(1);
  }

  const generator = new WorkItemContextGenerator(getAzureDevOpsConfig());

  // Test work items that have PRs (use from config or defaults)
  const testWorkItems = TEST_CONFIG.testWorkItems.all;

  const allResults: string[] = [];
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputFile = path.join(TEST_CONFIG.artifactsDir, `pr-details-${timestamp}.txt`);

  allResults.push('COMPREHENSIVE PR DETAILS TEST REPORT');
  allResults.push('=' .repeat(80));
  allResults.push(`Generated: ${new Date().toISOString()}`);
  allResults.push(`Organization: ${TEST_CONFIG.organization}`);
  allResults.push(`Project: ${TEST_CONFIG.project}`);
  allResults.push('');

  for (const workItemId of testWorkItems) {
    console.log(`\n📋 Processing Work Item #${workItemId}...`);
    allResults.push('');
    allResults.push('=' .repeat(80));
    allResults.push(`WORK ITEM #${workItemId}`);
    allResults.push('=' .repeat(80));

    try {
      // Generate context with all PR details enabled
      const context = await generator.generateContext(workItemId, {
        includePRChanges: true,
        includePRComments: true,
        includePRCommits: true,
        includePRDiffs: true,
        includeRelatedPRs: true,
        maxRelatedItems: 5,
        maxPRsPerWorkItem: 3
      });

      // Log work item basic info
      allResults.push(`\nTitle: ${context.workItem.fields['System.Title']}`);
      allResults.push(`Type: ${context.workItem.fields['System.WorkItemType']}`);
      allResults.push(`State: ${context.workItem.fields['System.State']}`);
      allResults.push(`Assigned To: ${context.workItem.fields['System.AssignedTo']?.displayName || 'Unassigned'}`);

      // Process linked PRs
      if (context.linkedPullRequests.length > 0) {
        allResults.push(`\n### LINKED PULL REQUESTS (${context.linkedPullRequests.length})`);

        for (const prContext of context.linkedPullRequests) {
          const pr = prContext.pullRequest;
          allResults.push('\n' + '-'.repeat(60));
          allResults.push(`\n#### PR #${pr.pullRequestId}: ${pr.title}`);

          // Basic PR info
          allResults.push(`\n**Basic Information:**`);
          allResults.push(`- Status: ${pr.status}`);
          allResults.push(`- Created by: ${pr.createdBy.displayName}`);
          allResults.push(`- Created: ${new Date(pr.creationDate).toISOString()}`);
          allResults.push(`- Repository: ${prContext.repository.name}`);

          // Branch information
          if (prContext.sourceBranch && prContext.targetBranch) {
            allResults.push(`\n**Branch Details:**`);
            allResults.push(`- Source Branch: ${prContext.sourceBranch}`);
            allResults.push(`- Target Branch: ${prContext.targetBranch}`);
            allResults.push(`- Merge Status: ${pr.mergeStatus || 'notSet'}`);
          }

          // Commits
          if (prContext.commits && prContext.commits.length > 0) {
            allResults.push(`\n**Commits (${prContext.commits.length} total):**`);

            for (const commit of prContext.commits) {
              allResults.push(`\n  Commit: ${commit.commitId}`);
              allResults.push(`  Author: ${commit.author?.name} <${commit.author?.email}>`);
              allResults.push(`  Date: ${commit.author?.date}`);
              allResults.push(`  Message: ${commit.comment}`);

              if (commit.changeCounts) {
                const changes: string[] = [];
                if (commit.changeCounts.Add) changes.push(`+${commit.changeCounts.Add}`);
                if (commit.changeCounts.Edit) changes.push(`~${commit.changeCounts.Edit}`);
                if (commit.changeCounts.Delete) changes.push(`-${commit.changeCounts.Delete}`);
                if (changes.length > 0) {
                  allResults.push(`  Changes: ${changes.join(', ')}`);
                }
              }
            }
          }

          // Changed files
          if (prContext.changedFiles && prContext.changedFiles.length > 0) {
            allResults.push(`\n**Changed Files (${prContext.changedFiles.length} files):**`);

            // Group by directory
            const filesByDir = new Map<string, typeof prContext.changedFiles>();
            for (const file of prContext.changedFiles) {
              const dir = file.path.substring(0, file.path.lastIndexOf('/')) || '/';
              if (!filesByDir.has(dir)) {
                filesByDir.set(dir, []);
              }
              filesByDir.get(dir)!.push(file);
            }

            for (const [dir, files] of filesByDir) {
              allResults.push(`\n  📁 ${dir}/`);
              for (const file of files) {
                const filename = file.path.substring(file.path.lastIndexOf('/') + 1);
                const icon = getChangeIcon(file.changeType);
                allResults.push(`    ${icon} ${filename} (${file.changeType})`);
              }
            }
          }

          // Diffs (if available)
          if (prContext.diffs && Object.keys(prContext.diffs).length > 0) {
            allResults.push(`\n**File Diffs (${Object.keys(prContext.diffs).length} files with diffs):**`);

            for (const [filePath, diff] of Object.entries(prContext.diffs)) {
              const filename = filePath.substring(filePath.lastIndexOf('/') + 1);
              allResults.push(`\n  📄 ${filename}:`);
              allResults.push('  ```diff');

              const diffLines = diff.split('\n').slice(0, 30);
              for (const line of diffLines) {
                allResults.push('  ' + line);
              }

              if (diff.split('\n').length > 30) {
                allResults.push('  ... [diff truncated]');
              }
              allResults.push('  ```');
            }
          }

          // Comments/Discussions
          if (prContext.comments && prContext.comments.length > 0) {
            const totalComments = prContext.comments.reduce((sum, t) => sum + (t.comments?.length || 0), 0);
            allResults.push(`\n**Discussions: ${prContext.comments.length} threads, ${totalComments} comments**`);

            // Show first few threads
            const maxThreads = 3;
            for (let i = 0; i < Math.min(prContext.comments.length, maxThreads); i++) {
              const thread = prContext.comments[i];
              if (thread.comments && thread.comments.length > 0) {
                const firstComment = thread.comments[0];
                allResults.push(`\n  Thread ${i + 1}:`);
                allResults.push(`  - Status: ${thread.status}`);
                allResults.push(`  - Author: ${firstComment.author?.displayName}`);
                allResults.push(`  - Comment: ${firstComment.content.substring(0, 200)}${firstComment.content.length > 200 ? '...' : ''}`);
              }
            }
          }

          // PR Description
          if (pr.description) {
            allResults.push(`\n**PR Description:**`);
            const cleanDesc = pr.description.replace(/<[^>]*>/g, '').trim();
            const descLines = cleanDesc.split('\n').slice(0, 10);
            for (const line of descLines) {
              if (line.trim()) {
                allResults.push(`> ${line}`);
              }
            }
            if (cleanDesc.split('\n').length > 10) {
              allResults.push('> ... [description truncated]');
            }
          }
        }
      } else {
        allResults.push('\n### No linked pull requests found');
      }

      // Log related PRs summary
      if (context.relatedPullRequests && context.relatedPullRequests.length > 0) {
        allResults.push(`\n### RELATED PULL REQUESTS (${context.relatedPullRequests.length} from related work items)`);
        for (const prContext of context.relatedPullRequests) {
          const pr = prContext.pullRequest;
          allResults.push(`- PR #${pr.pullRequestId}: ${pr.title} (${pr.status})`);
        }
      }

    } catch (error: any) {
      console.error(`❌ Error processing work item ${workItemId}:`, error.message);
      allResults.push(`\nERROR: ${error.message}`);
    }
  }

  // Write to file
  allResults.push('');
  allResults.push('=' .repeat(80));
  allResults.push('END OF REPORT');
  allResults.push('=' .repeat(80));

  const content = allResults.join('\n');
  await fs.writeFile(outputFile, content, 'utf-8');

  console.log('\n' + '=' .repeat(80));
  console.log('✅ Test completed successfully!');
  console.log(`📄 Full details written to: ${outputFile}`);
  console.log('=' .repeat(80));

  // Also create a summary in console
  console.log('\nSummary:');
  for (const workItemId of testWorkItems) {
    const workItemSection = allResults.join('\n').match(new RegExp(`WORK ITEM #${workItemId}[\\s\\S]*?(?=WORK ITEM #|END OF REPORT)`));
    if (workItemSection) {
      const prCount = (workItemSection[0].match(/PR #\d+:/g) || []).length;
      console.log(`  - Work Item #${workItemId}: ${prCount} PR(s) found`);
    }
  }

  return outputFile;
}

function getChangeIcon(changeType: string): string {
  switch (changeType?.toLowerCase()) {
    case 'add': return '➕';
    case 'edit': return '📝';
    case 'delete': return '❌';
    case 'rename': return '🔄';
    default: return '📋';
  }
}

// Run the test
// Export for test runner
export async function runTest() {
  return testPRDetails();
}

// Allow direct execution
if (import.meta.main) {
  testPRDetails()
    .then(outputFile => {
      console.log(`\n🎉 Test complete! Results saved to:\n${outputFile}`);
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}