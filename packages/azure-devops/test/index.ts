#!/usr/bin/env bun

/**
 * Main test runner for Azure DevOps integration tests
 *
 * Usage:
 *   bun test                    # Run all tests
 *   bun test pr-details         # Run PR details test
 *   bun test work-item-context  # Run work item context test
 *   bun test generate-prompts   # Run prompt generation test
 */

import * as path from 'path';
import * as fs from 'fs/promises';

// Test configurations
const TEST_CONFIG = {
  organization: process.env['AZURE_DEVOPS_ORG'] || '',
  project: process.env['AZURE_DEVOPS_PROJECT'] || '',
  pat: process.env['AZURE_DEVOPS_PAT'] || '',
  artifactsDir: path.join(process.cwd(), 'test-artifacts'),
  testDir: path.join(process.cwd(), 'test')
};

// Available test suites
const TEST_SUITES = {
  'pr-details': {
    name: 'PR Details Test',
    file: './suites/test-pr-details.ts',
    description: 'Comprehensive test for PR details including commits, diffs, and branches'
  },
  'context-generator': {
    name: 'Context Generator Test',
    file: './suites/test-context-generator.ts',
    description: 'Test work item context generation with all related data'
  },
  'enhanced-generation': {
    name: 'Enhanced Generation Test',
    file: './suites/test-enhanced-generation.ts',
    description: 'Test enhanced prompt generation with PR details'
  },
  'generate-prompts': {
    name: 'Generate Prompts Utility',
    file: './utilities/generate-sample-prompts.ts',
    description: 'Generate comprehensive prompts for multiple work items'
  }
};

async function ensureDirectories() {
  await fs.mkdir(TEST_CONFIG.artifactsDir, { recursive: true });
  console.log(`✅ Test artifacts directory ready: ${TEST_CONFIG.artifactsDir}`);
}

async function runTest(suiteName: string) {
  const suite = TEST_SUITES[suiteName as keyof typeof TEST_SUITES];
  if (!suite) {
    console.error(`❌ Unknown test suite: ${suiteName}`);
    console.log('Available suites:', Object.keys(TEST_SUITES).join(', '));
    process.exit(1);
  }

  console.log(`\n🚀 Running ${suite.name}`);
  console.log(`📝 ${suite.description}`);
  console.log('=' .repeat(80));

  try {
    // Set environment for test
    process.env['AZURE_DEVOPS_ORG'] = TEST_CONFIG.organization;
    process.env['AZURE_DEVOPS_PROJECT'] = TEST_CONFIG.project;
    process.env['AZURE_DEVOPS_PAT'] = TEST_CONFIG.pat;
    process.env['TEST_ARTIFACTS_DIR'] = TEST_CONFIG.artifactsDir;

    // Import and run the test
    const testModule = await import(suite.file);
    if (testModule.default) {
      await testModule.default(TEST_CONFIG);
    } else if (testModule.runTest) {
      await testModule.runTest(TEST_CONFIG);
    } else {
      console.error(`❌ Test module ${suite.file} doesn't export a default or runTest function`);
      process.exit(1);
    }

    console.log(`\n✅ ${suite.name} completed successfully`);
  } catch (error: any) {
    console.error(`\n❌ ${suite.name} failed:`, error.message);
    process.exit(1);
  }
}

async function runAllTests() {
  console.log('🎯 Running all Azure DevOps integration tests');
  console.log('=' .repeat(80));

  const results: { suite: string; status: 'passed' | 'failed'; error?: string }[] = [];

  for (const [suiteName, suite] of Object.entries(TEST_SUITES)) {
    try {
      await runTest(suiteName);
      results.push({ suite: suite.name, status: 'passed' });
    } catch (error: any) {
      results.push({ suite: suite.name, status: 'failed', error: error.message });
    }
  }

  // Print summary
  console.log('\n' + '=' .repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('=' .repeat(80));

  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;

  for (const result of results) {
    const icon = result.status === 'passed' ? '✅' : '❌';
    console.log(`${icon} ${result.suite}: ${result.status.toUpperCase()}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }

  console.log('\n' + '-'.repeat(40));
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('-'.repeat(40));

  // Save summary to file
  const summaryPath = path.join(TEST_CONFIG.artifactsDir, `test-summary-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  await fs.writeFile(summaryPath, JSON.stringify(results, null, 2));
  console.log(`\n📄 Summary saved to: ${summaryPath}`);

  process.exit(failed > 0 ? 1 : 0);
}

// Main execution
async function main() {
  await ensureDirectories();

  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === 'all') {
    await runAllTests();
  } else {
    await runTest(args[0]);
  }
}

// Run the main function
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export { TEST_CONFIG, TEST_SUITES };