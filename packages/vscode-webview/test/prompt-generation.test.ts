/**
 * Playwright tests for Prompt Generation Tab
 * Tests the new prompt enhancement functionality with AI-powered research
 */

import { test, expect, Page, BrowserContext, chromium } from '@playwright/test';

// Test configuration
const WEBVIEW_URL = process.env.WEBVIEW_URL || 'http://localhost:5173';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:8881';

test.describe('Prompt Generation Tab Tests', () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeAll(async () => {
    // Create browser context with viewport
    context = await chromium.launchPersistentContext('', {
      viewport: { width: 1280, height: 720 },
      headless: process.env.HEADLESS === 'true',
      devtools: process.env.DEVTOOLS === 'true',
    });
  });

  test.beforeEach(async () => {
    page = await context.newPage();

    // Enable console logging
    page.on('console', msg => {
      if (process.env.DEBUG) {
        console.log(`PAGE LOG: ${msg.type()} - ${msg.text()}`);
      }
    });

    // Log page errors
    page.on('pageerror', error => {
      console.error(`PAGE ERROR: ${error.message}`);
    });

    // Navigate to the webview
    await page.goto(WEBVIEW_URL, { waitUntil: 'networkidle' });

    // Navigate to workflow interface
    await page.click('a[href="/workflow"]');
    await page.waitForSelector('.workflow-interface', { timeout: 5000 });
  });

  test.afterEach(async () => {
    if (page && !page.isClosed()) {
      await page.close();
    }
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should display Prompt Generation tab in navigation', async () => {
    // Check if Prompt Generation tab exists
    const promptTab = await page.locator('.tab-button:has-text("Prompt Generation")');
    await expect(promptTab).toBeVisible();

    // Verify it's the first tab
    const tabs = await page.locator('.tab-button').all();
    const firstTabText = await tabs[0].textContent();
    expect(firstTabText).toContain('Prompt Generation');
  });

  test('should navigate to Prompt Generation tab', async () => {
    // Click on Prompt Generation tab
    await page.click('.tab-button:has-text("Prompt Generation")');

    // Verify tab is active
    const activeTab = await page.locator('.tab-button.active');
    await expect(activeTab).toHaveText('Prompt Generation');

    // Verify tab content is displayed
    await expect(page.locator('.prompt-generation-tab')).toBeVisible();
    await expect(page.locator('.tab-title:has-text("Prompt Enhancement")')).toBeVisible();
  });

  test('should display all UI elements correctly', async () => {
    // Navigate to Prompt Generation tab
    await page.click('.tab-button:has-text("Prompt Generation")');
    await page.waitForSelector('.prompt-generation-tab');

    // Check header section
    await expect(page.locator('.tab-title')).toHaveText('Prompt Enhancement');
    await expect(page.locator('.tab-description')).toContainText('Transform your initial prompt');

    // Check input section
    await expect(page.locator('.input-label')).toHaveText('Initial Prompt');
    await expect(page.locator('.prompt-input')).toBeVisible();
    await expect(page.locator('.char-count')).toHaveText('0 characters');
    await expect(page.locator('.hint')).toContainText('Press Cmd/Ctrl + Enter to enhance');

    // Check action button
    const enhanceButton = page.locator('.action-button.primary.large');
    await expect(enhanceButton).toBeVisible();
    await expect(enhanceButton).toHaveText(/Enhance Prompt/);
    await expect(enhanceButton).toBeDisabled(); // Should be disabled when input is empty
  });

  test('should enable enhance button when prompt is entered', async () => {
    await page.click('.tab-button:has-text("Prompt Generation")');
    await page.waitForSelector('.prompt-generation-tab');

    const promptInput = page.locator('.prompt-input');
    const enhanceButton = page.locator('.action-button.primary.large');

    // Initially disabled
    await expect(enhanceButton).toBeDisabled();

    // Type a prompt
    await promptInput.fill('Create a user authentication system with JWT tokens');

    // Button should be enabled
    await expect(enhanceButton).toBeEnabled();

    // Character count should update
    await expect(page.locator('.char-count')).toContainText('47 characters');
  });

  test('should show research items during enhancement', async () => {
    await page.click('.tab-button:has-text("Prompt Generation")');
    await page.waitForSelector('.prompt-generation-tab');

    // Enter a prompt
    await page.locator('.prompt-input').fill('Build a React component for file upload');

    // Click enhance button
    await page.click('.action-button.primary.large:has-text("Enhance Prompt")');

    // Wait for research section to appear
    await page.waitForSelector('.research-section', { timeout: 10000 });

    // Check research items
    const researchItems = page.locator('.research-item');
    await expect(researchItems).toHaveCount(4, { timeout: 15000 });

    // Verify research item structure
    const firstItem = researchItems.first();
    await expect(firstItem.locator('.research-title')).toBeVisible();
    await expect(firstItem.locator('.research-details')).toBeVisible();

    // Wait for at least one item to complete
    await page.waitForSelector('.research-item.completed', { timeout: 15000 });

    // Check for findings
    await expect(page.locator('.research-findings')).toBeVisible({ timeout: 15000 });
  });

  test('should show clarification questions for ambiguous prompts', async () => {
    await page.click('.tab-button:has-text("Prompt Generation")');
    await page.waitForSelector('.prompt-generation-tab');

    // Enter an ambiguous prompt
    await page.locator('.prompt-input').fill('API integration');

    // Click enhance button
    await page.click('.action-button.primary.large:has-text("Enhance Prompt")');

    // Wait for clarification section
    await page.waitForSelector('.clarification-section', { timeout: 15000 });

    // Check clarification questions
    await expect(page.locator('.section-title:has-text("Clarification Needed")')).toBeVisible();

    const questions = page.locator('.clarification-item');
    const questionCount = await questions.count();
    expect(questionCount).toBeGreaterThan(0);

    // Check for API type question
    await expect(page.locator('.question-text:has-text("What type of API")')).toBeVisible();

    // Check for options
    const options = page.locator('.option-label');
    await expect(options).toHaveCount(4, { timeout: 10000 });
    await expect(options.first()).toContainText('REST API');

    // Continue button should be disabled initially
    const continueButton = page.locator('.action-button.primary:has-text("Continue Enhancement")');
    await expect(continueButton).toBeDisabled();
  });

  test('should enable continue button after answering clarifications', async () => {
    await page.click('.tab-button:has-text("Prompt Generation")');
    await page.waitForSelector('.prompt-generation-tab');

    // Enter an ambiguous prompt
    await page.locator('.prompt-input').fill('API integration');
    await page.click('.action-button.primary.large:has-text("Enhance Prompt")');

    // Wait for clarifications
    await page.waitForSelector('.clarification-section', { timeout: 15000 });

    // Answer the question
    await page.click('.option-label:has-text("REST API")');

    // Continue button should be enabled
    const continueButton = page.locator('.action-button.primary:has-text("Continue Enhancement")');
    await expect(continueButton).toBeEnabled();

    // Click continue
    await continueButton.click();

    // Should show progress
    await expect(page.locator('.progress-section')).toBeVisible({ timeout: 5000 });
  });

  test('should generate and display enhanced prompt', async () => {
    await page.click('.tab-button:has-text("Prompt Generation")');
    await page.waitForSelector('.prompt-generation-tab');

    // Enter a simple prompt
    await page.locator('.prompt-input').fill('Create a React component for displaying user profiles with avatar, name, and bio');

    // Click enhance button
    await page.click('.action-button.primary.large:has-text("Enhance Prompt")');

    // Wait for enhancement to complete
    await page.waitForSelector('.enhanced-section', { timeout: 20000 });

    // Check enhanced prompt section
    await expect(page.locator('.section-title:has-text("Enhanced Prompt")')).toBeVisible();
    await expect(page.locator('.enhanced-text')).toBeVisible();

    // Check metadata
    await expect(page.locator('.metadata-item:has-text("Enhancements Applied")')).toBeVisible();
    await expect(page.locator('.metadata-item:has-text("Research Sources")')).toBeVisible();
    await expect(page.locator('.metadata-item:has-text("Context Added")')).toBeVisible();

    // Check action buttons
    await expect(page.locator('.action-button:has-text("Copy")')).toBeVisible();
    await expect(page.locator('.action-button:has-text("Regenerate")')).toBeVisible();
    await expect(page.locator('.action-button.primary.large:has-text("Send to Implementation")')).toBeVisible();
  });

  test('should copy enhanced prompt to clipboard', async () => {
    await page.click('.tab-button:has-text("Prompt Generation")');
    await page.waitForSelector('.prompt-generation-tab');

    // Generate an enhanced prompt
    await page.locator('.prompt-input').fill('Simple task manager app');
    await page.click('.action-button.primary.large:has-text("Enhance Prompt")');
    await page.waitForSelector('.enhanced-section', { timeout: 20000 });

    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-write', 'clipboard-read']);

    // Click copy button
    await page.click('.action-button:has-text("Copy")');

    // Verify clipboard content (if supported by browser)
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('Original Request');
    expect(clipboardText).toContain('Simple task manager app');
  });

  test('should regenerate enhanced prompt', async () => {
    await page.click('.tab-button:has-text("Prompt Generation")');
    await page.waitForSelector('.prompt-generation-tab');

    // Generate initial enhanced prompt
    await page.locator('.prompt-input').fill('Todo list application');
    await page.click('.action-button.primary.large:has-text("Enhance Prompt")');
    await page.waitForSelector('.enhanced-section', { timeout: 20000 });

    // Get initial enhanced prompt text
    const initialText = await page.locator('.enhanced-text').textContent();

    // Click regenerate
    await page.click('.action-button:has-text("Regenerate")');

    // Wait for new enhancement
    await page.waitForSelector('.progress-section', { timeout: 5000 });
    await page.waitForSelector('.enhanced-section', { timeout: 20000 });

    // Verify prompt was regenerated (text should be different or at minimum present)
    const regeneratedText = await page.locator('.enhanced-text').textContent();
    expect(regeneratedText).toBeTruthy();
  });

  test('should clear prompt and reset state', async () => {
    await page.click('.tab-button:has-text("Prompt Generation")');
    await page.waitForSelector('.prompt-generation-tab');

    // Enter prompt and enhance
    await page.locator('.prompt-input').fill('Chat application with real-time messaging');
    await page.click('.action-button.primary.large:has-text("Enhance Prompt")');
    await page.waitForSelector('.research-section', { timeout: 10000 });

    // Clear button should be visible
    await expect(page.locator('.action-button:has-text("Clear")')).toBeVisible();

    // Click clear
    await page.click('.action-button:has-text("Clear")');

    // Verify state is reset
    await expect(page.locator('.prompt-input')).toHaveValue('');
    await expect(page.locator('.char-count')).toHaveText('0 characters');
    await expect(page.locator('.research-section')).not.toBeVisible();
    await expect(page.locator('.enhanced-section')).not.toBeVisible();
    await expect(page.locator('.action-button.primary.large')).toBeDisabled();
  });

  test('should send enhanced prompt to implementation tab', async () => {
    await page.click('.tab-button:has-text("Prompt Generation")');
    await page.waitForSelector('.prompt-generation-tab');

    // Generate enhanced prompt
    await page.locator('.prompt-input').fill('User dashboard with charts');
    await page.click('.action-button.primary.large:has-text("Enhance Prompt")');
    await page.waitForSelector('.enhanced-section', { timeout: 20000 });

    // Click send to implementation
    await page.click('.action-button.primary.large:has-text("Send to Implementation")');

    // Should switch to Implement tab
    await page.waitForSelector('.tab-button.active:has-text("Implement")', { timeout: 5000 });

    // Verify we're on the Implement tab
    const activeTab = await page.locator('.tab-button.active').textContent();
    expect(activeTab).toContain('Implement');
  });

  test('should show progress indicator during enhancement', async () => {
    await page.click('.tab-button:has-text("Prompt Generation")');
    await page.waitForSelector('.prompt-generation-tab');

    // Enter prompt
    await page.locator('.prompt-input').fill('E-commerce product catalog');

    // Click enhance
    await page.click('.action-button.primary.large:has-text("Enhance Prompt")');

    // Check for progress indicator
    await expect(page.locator('.progress-section')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.progress-bar')).toBeVisible();
    await expect(page.locator('.progress-text')).toBeVisible();

    // Check for spinning icon in button
    await expect(page.locator('.action-button.primary.large.disabled:has-text("Enhancing")')).toBeVisible();
    await expect(page.locator('.action-button .spinning')).toBeVisible();

    // Wait for completion
    await page.waitForSelector('.enhanced-section', { timeout: 20000 });

    // Progress should be hidden
    await expect(page.locator('.progress-section')).not.toBeVisible();
  });

  test('should handle keyboard shortcut for enhancement', async () => {
    await page.click('.tab-button:has-text("Prompt Generation")');
    await page.waitForSelector('.prompt-generation-tab');

    const promptInput = page.locator('.prompt-input');

    // Focus and type in input
    await promptInput.focus();
    await promptInput.fill('Social media feed component');

    // Press Cmd+Enter (or Ctrl+Enter)
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${modifier}+Enter`);

    // Should trigger enhancement
    await expect(page.locator('.progress-section')).toBeVisible({ timeout: 5000 });
    await page.waitForSelector('.research-section', { timeout: 10000 });
  });

  test('should handle empty prompt validation', async () => {
    await page.click('.tab-button:has-text("Prompt Generation")');
    await page.waitForSelector('.prompt-generation-tab');

    // Try to enhance without entering prompt
    const enhanceButton = page.locator('.action-button.primary.large');
    await expect(enhanceButton).toBeDisabled();

    // Enter and then clear prompt
    const promptInput = page.locator('.prompt-input');
    await promptInput.fill('test');
    await expect(enhanceButton).toBeEnabled();

    await promptInput.clear();
    await expect(enhanceButton).toBeDisabled();
  });

  test('should preserve prompt after tab switch', async () => {
    await page.click('.tab-button:has-text("Prompt Generation")');
    await page.waitForSelector('.prompt-generation-tab');

    // Enter a prompt
    const testPrompt = 'Real-time collaboration tool';
    await page.locator('.prompt-input').fill(testPrompt);

    // Switch to another tab
    await page.click('.tab-button:has-text("Plan")');
    await page.waitForSelector('.plan-tab');

    // Switch back to Prompt Generation
    await page.click('.tab-button:has-text("Prompt Generation")');
    await page.waitForSelector('.prompt-generation-tab');

    // Prompt should be preserved
    await expect(page.locator('.prompt-input')).toHaveValue(testPrompt);
  });

  test('should handle very long prompts', async () => {
    await page.click('.tab-button:has-text("Prompt Generation")');
    await page.waitForSelector('.prompt-generation-tab');

    // Create a very long prompt
    const longPrompt = 'Create a comprehensive project management system with the following features: ' +
      'task creation and assignment, project timelines, Gantt charts, resource allocation, ' +
      'budget tracking, time logging, milestone management, dependency tracking, ' +
      'team collaboration tools including comments and mentions, file attachments, ' +
      'email notifications, Slack integration, calendar synchronization, ' +
      'advanced reporting and analytics, custom fields and workflows, ' +
      'role-based access control, audit logs, API for third-party integrations, ' +
      'mobile applications for iOS and Android, offline mode support, ' +
      'data export in multiple formats, automated backups, and multi-language support.';

    await page.locator('.prompt-input').fill(longPrompt);

    // Check character count updates correctly
    const charCount = await page.locator('.char-count').textContent();
    expect(parseInt(charCount!)).toBeGreaterThan(600);

    // Should still be able to enhance
    await expect(page.locator('.action-button.primary.large')).toBeEnabled();

    // Enhance the long prompt
    await page.click('.action-button.primary.large:has-text("Enhance Prompt")');
    await page.waitForSelector('.research-section', { timeout: 15000 });
  });

  test('should show appropriate research for technical prompts', async () => {
    await page.click('.tab-button:has-text("Prompt Generation")');
    await page.waitForSelector('.prompt-generation-tab');

    // Enter a technical prompt
    await page.locator('.prompt-input').fill('Implement WebSocket server with authentication');
    await page.click('.action-button.primary.large:has-text("Enhance Prompt")');

    // Wait for research
    await page.waitForSelector('.research-section', { timeout: 10000 });
    await page.waitForSelector('.research-item.completed', { timeout: 15000 });

    // Check for relevant findings
    const findings = page.locator('.research-findings .finding');
    const findingsCount = await findings.count();
    expect(findingsCount).toBeGreaterThan(0);

    // Verify technical context
    const findingsText = await findings.allTextContents();
    const hasRelevantContent = findingsText.some(text =>
      text.includes('WebSocket') ||
      text.includes('TypeScript') ||
      text.includes('infrastructure')
    );
    expect(hasRelevantContent).toBe(true);
  });
});

// Integration tests with WebSocket
test.describe('Prompt Generation WebSocket Integration', () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeAll(async () => {
    context = await chromium.launchPersistentContext('', {
      viewport: { width: 1280, height: 720 },
      headless: process.env.HEADLESS === 'true',
    });
  });

  test.beforeEach(async () => {
    page = await context.newPage();
    await page.goto(WEBVIEW_URL, { waitUntil: 'networkidle' });
    await page.click('a[href="/workflow"]');
    await page.waitForSelector('.workflow-interface', { timeout: 5000 });
  });

  test.afterEach(async () => {
    if (page && !page.isClosed()) {
      await page.close();
    }
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should use WebSocket client when available', async () => {
    // Navigate to Prompt Generation tab
    await page.click('.tab-button:has-text("Prompt Generation")');
    await page.waitForSelector('.prompt-generation-tab');

    // Check if WebSocket is connected (status bar should show connection)
    const connectionStatus = await page.locator('.connection-status').getAttribute('class');
    const isConnected = connectionStatus?.includes('connected');

    if (isConnected) {
      // If connected, enhancement should use real AI
      await page.locator('.prompt-input').fill('Create a REST API');
      await page.click('.action-button.primary.large:has-text("Enhance Prompt")');

      // Real enhancement might take longer
      await page.waitForSelector('.enhanced-section', { timeout: 30000 });

      // Enhanced prompt should have more sophisticated content
      const enhancedText = await page.locator('.enhanced-text').textContent();
      expect(enhancedText).toContain('Technical Context');
      expect(enhancedText).toContain('Implementation Requirements');
    }
  });

  test('should fallback to simulation when WebSocket unavailable', async () => {
    // Disconnect WebSocket if possible
    await page.evaluate(() => {
      // Force disconnect any WebSocket connections
      if ((window as any).wsClient) {
        (window as any).wsClient.disconnect();
      }
    });

    // Navigate to Prompt Generation tab
    await page.click('.tab-button:has-text("Prompt Generation")');
    await page.waitForSelector('.prompt-generation-tab');

    // Enhancement should still work with simulation
    await page.locator('.prompt-input').fill('Basic form validation');
    await page.click('.action-button.primary.large:has-text("Enhance Prompt")');

    // Should show research (simulated)
    await page.waitForSelector('.research-section', { timeout: 10000 });

    // Should complete enhancement
    await page.waitForSelector('.enhanced-section', { timeout: 20000 });
  });
});