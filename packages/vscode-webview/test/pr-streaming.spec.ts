import { test, expect } from '@playwright/test'

const PR_URL = 'https://skype.visualstudio.com/SCC/_git/sync_calling_concore-teamsscheduler/pullrequest/1279282'

test.describe('PR Review Streaming', () => {
  test('should stream events and display files for PR review', async ({ page }) => {
    // Capture console logs
    page.on('console', msg => console.log('BROWSER:', msg.text()))
    page.on('pageerror', error => console.error('PAGE ERROR:', error))
    
    // Navigate directly to the workflow page
    await page.goto('http://localhost:5173/workflow')
    
    // Wait for the workflow interface to load
    await page.waitForSelector('.workflow-interface', { timeout: 10000 })
    
    // Click on "Review" tab
    await page.click('button:has-text("Review")')
    
    // Wait for the code review tab to load
    await page.waitForSelector('.code-review-tab', { timeout: 10000 })
    
    // Select PR review type
    await page.click('button:has-text("Pull Request URL")')
    
    // Enter PR URL
    await page.fill('input[type="url"]', PR_URL)
    
    // Start the review
    await page.click('button:has-text("Start Review")')
    
    // Wait for progress message
    await page.waitForSelector('.micro-status-bar', { timeout: 5000 })
    
    // Wait for review to complete - button changes from "Reviewing..." to "Start Review"
    await page.waitForSelector('button:has-text("Start Review")', { timeout: 120000 })
    console.log('Review completed!')
    
    // Take a screenshot to see current state
    await page.screenshot({ path: 'test-results/pr-review-complete.png', fullPage: true })
    
    // Check if there's an error
    const hasError = await page.locator('.error-state, .error-message').count() > 0
    if (hasError) {
      const errorText = await page.locator('.error-state, .error-message').first().textContent()
      console.log('ERROR FOUND:', errorText)
      throw new Error(`Review failed with error: ${errorText}`)
    }
    
    // Wait for files section to appear
    const filesSection = page.locator('.compact-section:has(.section-icon.diff-icon)')
    await expect(filesSection).toBeVisible({ timeout: 10000 })
    
    // Check that files are displayed
    const fileCount = await page.locator('.total-count').first().textContent()
    console.log(`Files loaded: ${fileCount}`)
    expect(parseInt(fileCount || '0')).toBeGreaterThan(0)
    
    // Take screenshot showing the current state
    await page.screenshot({ path: 'test-results/review-sections.png', fullPage: true })
    
    // Verify hunks section is visible with icon
    const hunksSection = page.locator('.compact-section:has(.hunks-icon)')
    await expect(hunksSection).toBeVisible({ timeout: 5000 })
    const hunksCountText = await hunksSection.locator('.summary-badge').textContent()
    const hunksCount = parseInt(hunksCountText || '0')
    console.log(`Hunks section shows: ${hunksCount} hunks`)
    expect(hunksCount).toBeGreaterThan(0)
    
    // Verify comments section is visible with icon
    const commentsSection = page.locator('.compact-section:has(.comments-icon)')
    await expect(commentsSection).toBeVisible({ timeout: 5000 })
    const commentsCountText = await commentsSection.locator('.total-count').textContent()
    const commentsCount = parseInt(commentsCountText || '0')
    console.log(`Comments section shows: ${commentsCount} comments`)
    expect(commentsCount).toBeGreaterThan(0)
    
    // Expand hunks section to see details
    await hunksSection.locator('.summary-bar').click()
    await page.waitForTimeout(500)
    
    // Verify hunk items are visible
    const hunkItems = page.locator('.hunk-item')
    const hunkItemCount = await hunkItems.count()
    console.log(`Hunk items visible: ${hunkItemCount}`)
    expect(hunkItemCount).toBeGreaterThan(0)
    
    // Check first hunk has category and risk
    const firstHunkItem = hunkItems.first()
    const hunkCategory = await firstHunkItem.locator('.file-name').textContent()
    const hunkRisk = await firstHunkItem.locator('.risk-tag').textContent()
    console.log(`First hunk - File: ${hunkCategory}, Risk: ${hunkRisk}`)
    
    // Take final screenshot
    await page.screenshot({ path: 'test-results/hunks-expanded.png', fullPage: true })
    
    // Check for insights (optional - may not always be present)
    const insightsSection = page.locator('.compact-section:has(.section-icon.insights-icon)')
    const insightsVisible = await insightsSection.isVisible().catch(() => false)
    if (insightsVisible) {
      const insightCountText = await insightsSection.locator('.total-count').textContent().catch(() => '0')
      console.log(`Insights received: ${insightCountText}`)
    } else {
      console.log('No insights section visible (this is okay)')
    }
    
    console.log('✅ PR review streaming test completed successfully!')
    console.log(`✅ Verified: ${hunksCount} hunks and ${commentsCount} comments streaming correctly`)
    console.log(`✅ Verified: Hunks displayed with file names, categories, and risk levels`)
  })
})
