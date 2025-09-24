#!/usr/bin/env bun

/**
 * Test for Azure DevOps Build Client
 * Tests build management APIs and PR build monitoring functionality
 */

import { AzureDevOpsClient } from '../../src/index.js';
import type { Build, Policy } from '../../src/interfaces/build.js';
import type { PrGatingBuild } from '../../src/clients/build-client.js';
import { getAzureDevOpsConfig } from '../config.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// Test configuration - update these based on your ADO instance
const TEST_REPOSITORY_ID = process.env['TEST_REPOSITORY_ID'] || 'supercode';
const TEST_PR_ID = parseInt(process.env['TEST_PR_ID'] || '1234', 10);
const TEST_BUILD_DEFINITION_ID = parseInt(process.env['TEST_BUILD_DEFINITION_ID'] || '1', 10);

interface TestResult {
  name: string;
  timestamp: string;
  success: boolean;
  result?: any;
  error?: string;
}

class TestRunner {
  private client: AzureDevOpsClient;
  private config: ReturnType<typeof getAzureDevOpsConfig>;
  private testResults: TestResult[] = [];
  private artifactsDir: string;

  constructor() {
    this.config = getAzureDevOpsConfig();
    this.client = new AzureDevOpsClient(this.config);
    this.artifactsDir = path.join(process.cwd(), 'test-artifacts');
  }

  private async saveTestResult(testName: string, result: any, error?: any) {
    this.testResults.push({
      name: testName,
      timestamp: new Date().toISOString(),
      success: !error,
      result: result,
      error: error?.message || error
    });

    console.log(`${error ? '❌' : '✅'} ${testName}`);
    if (error) {
      console.log(`   Error: ${error.message || error}`);
    }
  }

  private async runTest(testName: string, testFn: () => Promise<any>) {
    try {
      console.log(`\nRunning: ${testName}`);
      const result = await testFn();
      await this.saveTestResult(testName, result);
      return result;
    } catch (error: any) {
      await this.saveTestResult(testName, null, error);
      console.warn(`Test failed: ${testName}`, error.message);
    }
  }

  async testGetBuilds() {
    return this.runTest('getBuilds', async () => {
      const builds = await this.client.builds.getBuilds({
        top: 10,
        queryOrder: 'finishTimeDescending'
      });

      if (!Array.isArray(builds)) {
        throw new Error('Expected builds to be an array');
      }

      if (builds.length > 0) {
        const build = builds[0];
        console.log('   Sample build:', {
          id: build.id,
          buildNumber: build.buildNumber,
          status: build.status,
          result: build.result
        });
      }

      return { buildsFound: builds.length };
    });
  }

  async testGetBuild() {
    return this.runTest('getBuild', async () => {
      // First get a list of builds to get a valid ID
      const builds = await this.client.builds.getBuilds({ top: 1 });

      if (builds.length === 0) {
        console.warn('   No builds found to test getBuild');
        return { skipped: true, reason: 'No builds available' };
      }

      const buildId = builds[0].id;
      const build = await this.client.builds.getBuild(buildId);

      if (build.id !== buildId) {
        throw new Error(`Expected build ID ${buildId}, got ${build.id}`);
      }

      return {
        id: build.id,
        buildNumber: build.buildNumber,
        status: build.status,
        result: build.result
      };
    });
  }

  async testGetPrBuilds() {
    return this.runTest('getPrBuilds', async () => {
      try {
        const builds = await this.client.builds.getPrBuilds(TEST_REPOSITORY_ID, TEST_PR_ID);

        if (!Array.isArray(builds)) {
          throw new Error('Expected builds to be an array');
        }

        console.log(`   Found ${builds.length} builds for PR #${TEST_PR_ID}`);

        return {
          prId: TEST_PR_ID,
          buildsFound: builds.length
        };
      } catch (error: any) {
        if (error.message.includes('404')) {
          return { skipped: true, reason: 'Repository or PR not found' };
        }
        throw error;
      }
    });
  }

  async testGetPrPolicies() {
    return this.runTest('getPrPolicies', async () => {
      try {
        const policies = await this.client.builds.getPrPolicies(TEST_REPOSITORY_ID, TEST_PR_ID);

        if (!Array.isArray(policies)) {
          throw new Error('Expected policies to be an array');
        }

        const buildPolicies = policies.filter(p => p.isBuildPolicy);
        const otherPolicies = policies.filter(p => !p.isBuildPolicy);

        console.log(`   Found ${policies.length} policies (${buildPolicies.length} build, ${otherPolicies.length} other)`);

        return {
          prId: TEST_PR_ID,
          totalPolicies: policies.length,
          buildPolicies: buildPolicies.length,
          otherPolicies: otherPolicies.length
        };
      } catch (error: any) {
        if (error.message.includes('404')) {
          return { skipped: true, reason: 'Repository or PR not found' };
        }
        throw error;
      }
    });
  }

  async testGetPrBuildPolicies() {
    return this.runTest('getPrBuildPolicies', async () => {
      try {
        const policies = await this.client.builds.getPrBuildPolicies(TEST_REPOSITORY_ID, TEST_PR_ID);

        if (!Array.isArray(policies)) {
          throw new Error('Expected policies to be an array');
        }

        // All returned policies should be build policies
        const nonBuildPolicies = policies.filter(p => !p.isBuildPolicy);
        if (nonBuildPolicies.length > 0) {
          throw new Error(`Expected all policies to be build policies, found ${nonBuildPolicies.length} non-build policies`);
        }

        console.log(`   Found ${policies.length} build policies for PR #${TEST_PR_ID}`);

        return {
          prId: TEST_PR_ID,
          buildPoliciesFound: policies.length
        };
      } catch (error: any) {
        if (error.message.includes('404')) {
          return { skipped: true, reason: 'Repository or PR not found' };
        }
        throw error;
      }
    });
  }

  async testRequeueExpiredBuilds() {
    return this.runTest('requeueExpiredBuilds', async () => {
      try {
        // First, check what expired builds exist (dry run)
        const policies = await this.client.builds.getPrBuildPolicies(TEST_REPOSITORY_ID, TEST_PR_ID);

        const expiredPolicies = policies.filter(p =>
          p.buildIsExpired &&
          p.status !== 2 // Not approved
        );

        console.log(`   Found ${expiredPolicies.length} expired builds for PR #${TEST_PR_ID}`);

        if (expiredPolicies.length > 0) {
          console.log('   Expired builds (not requeueing in test):');
          expiredPolicies.forEach((policy: Policy) => {
            console.log(`     - ${policy.name} (Build #${policy.buildId})`);
          });
        }

        return {
          prId: TEST_PR_ID,
          expiredBuilds: expiredPolicies.length,
          dryRun: true
        };
      } catch (error: any) {
        if (error.message.includes('404')) {
          return { skipped: true, reason: 'Repository or PR not found' };
        }
        throw error;
      }
    });
  }

  async testGetPrGatingBuilds() {
    return this.runTest('getPrGatingBuilds', async () => {
      try {
        const gatingBuilds = await this.client.builds.getPrGatingBuilds(TEST_REPOSITORY_ID, TEST_PR_ID);

        if (!Array.isArray(gatingBuilds)) {
          throw new Error('Expected gating builds to be an array');
        }

        console.log(`   Found ${gatingBuilds.length} gating builds for PR #${TEST_PR_ID}`);

        if (gatingBuilds.length > 0) {
          gatingBuilds.forEach((gb: PrGatingBuild) => {
            console.log(`     - ${gb.policyName}: Build #${gb.buildId} (${gb.isBlocking ? 'Blocking' : 'Non-blocking'})`);
          });
        }

        return {
          prId: TEST_PR_ID,
          gatingBuildsFound: gatingBuilds.length,
          builds: gatingBuilds.map(gb => ({
            policyName: gb.policyName,
            buildId: gb.buildId,
            status: gb.status,
            isBlocking: gb.isBlocking
          }))
        };
      } catch (error: any) {
        if (error.message.includes('404')) {
          return { skipped: true, reason: 'Repository or PR not found' };
        }
        throw error;
      }
    });
  }

  async testGetPrBuildSummary() {
    return this.runTest('getPrBuildSummary', async () => {
      try {
        const summary = await this.client.builds.getPrBuildSummary(TEST_REPOSITORY_ID, TEST_PR_ID);

        console.log('   PR Build Summary:');
        console.log(`     - Total Policies: ${summary.totalPolicies}`);
        console.log(`     - Can Complete: ${summary.canComplete}`);
        console.log(`     - Approved Builds: ${summary.approvedBuilds}`);
        console.log(`     - Failed Builds: ${summary.failedBuilds}`);
        console.log(`     - Running Builds: ${summary.runningBuilds}`);
        console.log(`     - Expired Builds: ${summary.expiredBuilds}`);

        return summary;
      } catch (error: any) {
        if (error.message.includes('404')) {
          return { skipped: true, reason: 'Repository or PR not found' };
        }
        throw error;
      }
    });
  }

  async runAll() {
    console.log('\n🚀 Starting BuildClient E2E Tests');
    console.log(`   Organization: ${this.config.organization}`);
    console.log(`   Project: ${this.config.project}`);
    console.log(`   Repository: ${TEST_REPOSITORY_ID}`);
    console.log(`   PR ID: ${TEST_PR_ID}`);
    console.log('=' .repeat(60));

    // Skip tests if no PAT configured
    if (!this.config.pat) {
      console.warn('⚠️  Skipping BuildClient tests: No PAT configured');
      return;
    }

    // Run all tests
    await this.testGetBuilds();
    await this.testGetBuild();
    await this.testGetPrBuilds();
    await this.testGetPrPolicies();
    await this.testGetPrBuildPolicies();
    await this.testRequeueExpiredBuilds();
    await this.testGetPrGatingBuilds();
    await this.testGetPrBuildSummary();

    // Save results
    await this.saveResults();
  }

  private async saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Save detailed JSON results
    const jsonResults = {
      timestamp: new Date().toISOString(),
      organization: this.config.organization,
      project: this.config.project,
      repository: TEST_REPOSITORY_ID,
      prId: TEST_PR_ID,
      tests: this.testResults
    };

    const jsonPath = path.join(this.artifactsDir, `build-client-test-${timestamp}.json`);
    await fs.writeFile(jsonPath, JSON.stringify(jsonResults, null, 2));
    console.log(`\n📄 Test results saved to: ${jsonPath}`);

    // Save summary
    const passed = this.testResults.filter(t => t.success).length;
    const failed = this.testResults.filter(t => !t.success).length;

    const summary = [
      `Build Client Test Summary - ${new Date().toISOString()}`,
      `Organization: ${this.config.organization}`,
      `Project: ${this.config.project}`,
      '',
      'Test Results:',
      ...this.testResults.map(t => `  ${t.success ? '✅' : '❌'} ${t.name}`),
      '',
      `Total Tests: ${this.testResults.length}`,
      `Passed: ${passed}`,
      `Failed: ${failed}`
    ].join('\n');

    const summaryPath = path.join(this.artifactsDir, 'build-client-test-summary.txt');
    await fs.writeFile(summaryPath, summary);
    console.log(`📄 Summary saved to: ${summaryPath}`);

    console.log('\n' + '=' .repeat(60));
    console.log(`📊 Test Summary: ${passed}/${this.testResults.length} passed`);

    if (failed > 0) {
      console.log(`⚠️  ${failed} tests failed`);
      process.exit(1);
    }
  }
}

// Export default function for the test runner
export default async function runTest() {
  const runner = new TestRunner();
  await runner.runAll();
}

// Also allow direct execution
if (import.meta.main) {
  runTest().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}