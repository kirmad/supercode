/**
 * Secure test configuration for Azure DevOps integration tests
 *
 * IMPORTANT: Never commit credentials to source control!
 * Use environment variables or a .env file for sensitive data.
 */

import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
function loadEnvironment() {
  const envPath = path.join(process.cwd(), '.env.test');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value && !process.env[key]) {
        process.env[key] = value.trim();
      }
    });
  }
}

loadEnvironment();

// Test configuration with secure credential handling
export const TEST_CONFIG = {
  // Organization and project (MUST use environment variables)
  organization: process.env['AZURE_DEVOPS_ORG'] || '',
  project: process.env['AZURE_DEVOPS_PROJECT'] || '',

  // Personal Access Token (sensitive - MUST use environment variable)
  pat: process.env['AZURE_DEVOPS_PAT'] || '',

  // Test directories
  artifactsDir: path.join(process.cwd(), 'test-artifacts'),
  testDir: path.join(process.cwd(), 'test'),

  // Test data
  testWorkItems: {
    withPRs: [4277689, 4186107],
    withoutPRs: [4195539],
    all: [4277689, 4195539, 4186107]
  }
};

// Validate configuration
export function validateConfig(): boolean {
  const errors: string[] = [];

  if (!TEST_CONFIG.pat) {
    errors.push('❌ AZURE_DEVOPS_PAT environment variable is not set');
  }

  if (!TEST_CONFIG.organization) {
    errors.push('❌ AZURE_DEVOPS_ORG environment variable is not set');
  }

  if (!TEST_CONFIG.project) {
    errors.push('❌ AZURE_DEVOPS_PROJECT environment variable is not set');
  }

  if (errors.length > 0) {
    console.error('\n⚠️  Configuration Errors:');
    errors.forEach(err => console.error(err));
    console.error('\n📝 To fix this, create a .env.test file or set environment variables:');
    console.error('   AZURE_DEVOPS_PAT=your-personal-access-token');
    console.error('   AZURE_DEVOPS_ORG=your-organization');
    console.error('   AZURE_DEVOPS_PROJECT=your-project');
    console.error('\n🔒 Never commit credentials to source control!');
    return false;
  }

  return true;
}

// Helper to get Azure DevOps config for clients
export function getAzureDevOpsConfig() {
  return {
    organization: TEST_CONFIG.organization,
    project: TEST_CONFIG.project,
    pat: TEST_CONFIG.pat
  };
}