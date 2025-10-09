/**
 * Manual test with workspace preservation to see generated files
 * Shows actual review files, diffs, and agent comments
 *
 * ENHANCED: Now includes ADO comment publishing and replying tests
 * - Runs the standard review workflow first
 * - After review completes, tests publishing the first AI comment to ADO
 * - Tests replying to the published comment
 * - Provides comprehensive results and verification instructions
 */

import { createReviewWorkflow, processReview } from '../src/index.ts'
import { ADOContentSource } from '../src/sources/ado-content-source.ts'
import { WorkflowFactory } from '../src/core/workflow-factory.ts'
import { GitApiClient } from '../src/core/git-client.ts'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

// Configuration matching the original script
const ADO_CONFIG = {
  organization: 'skype',
  project: 'scc',
  repository: 'sync_calling_concore-teamsscheduler',
  pullRequestId: 1279282,
  pat: process.env.AZURE_DEVOPS_PAT || process.env.ADO_PAT
}

const TEST_PR_URL = `https://${ADO_CONFIG.organization}.visualstudio.com/${ADO_CONFIG.project}/_git/${ADO_CONFIG.repository}/pullrequest/${ADO_CONFIG.pullRequestId}`

// Git configuration for testing git diff reviews
const GIT_CONFIG = {
  repositoryPath: process.cwd(), // Current directory (should be supercode repo)
  baseUrl: 'http://localhost:3000'
}

// Operation subscription test configuration
const OPERATION_SUBSCRIPTION_CONFIG = {
  enabled: true,
  tags: ['review-insight', 'hunk', 'comment'],
  baseUrl: 'http://localhost:3000'
}

async function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] [${level}] ${message}`)
}

/**
 * Test operation subscription functionality
 * Sets up real-time event monitoring during review processing
 */
async function testOperationSubscription() {
  await log('🔄 Testing Operation Subscription functionality')
  await log('==============================================')

  try {
    // Create workflow factory for operation subscription
    const factory = new WorkflowFactory({
      baseUrl: OPERATION_SUBSCRIPTION_CONFIG.baseUrl,
      adoCredentials: {
        pat: ADO_CONFIG.pat,
        organization: ADO_CONFIG.organization
      }
    })

    // Create operation subscriber
    const operationSubscriber = factory.createOperationSubscriber()

    // Test metrics
    const subscriptionMetrics = {
      eventsReceived: 0,
      eventsByType: {},
      firstEventTime: null,
      lastEventTime: null,
      sessionEvents: new Map(),
      totalDataCount: 0
    }

    // Start listening for WebSocket events
    await log('🎧 Starting WebSocket listener...')
    await operationSubscriber.startListening()

    if (!operationSubscriber.isListening()) {
      throw new Error('Failed to start WebSocket listener')
    }
    await log('✅ WebSocket listener started successfully')

    // Subscribe to review workflow topic with real-time event logging
    const topicId = 'operation-subscription-test-topic'
    const subscriptionId = operationSubscriber.subscribe(
      topicId,
      OPERATION_SUBSCRIPTION_CONFIG.tags,
      (data, metadata) => {
        // Real-time event logging
        const timestamp = new Date().toISOString()
        subscriptionMetrics.eventsReceived++

        if (!subscriptionMetrics.firstEventTime) {
          subscriptionMetrics.firstEventTime = timestamp
        }
        subscriptionMetrics.lastEventTime = timestamp

        // Count events by type
        for (const tag of Object.keys(data)) {
          subscriptionMetrics.eventsByType[tag] = (subscriptionMetrics.eventsByType[tag] || 0) + data[tag].length
          subscriptionMetrics.totalDataCount += data[tag].length
        }

        // Track session events
        if (metadata.sessionId) {
          if (!subscriptionMetrics.sessionEvents.has(metadata.sessionId)) {
            subscriptionMetrics.sessionEvents.set(metadata.sessionId, 0)
          }
          subscriptionMetrics.sessionEvents.set(
            metadata.sessionId,
            subscriptionMetrics.sessionEvents.get(metadata.sessionId) + 1
          )
        }

        console.log(`\n🔔 [${timestamp}] REAL-TIME EVENT`)
        console.log(`   Topic: ${metadata.topicId}`)
        console.log(`   Session: ${metadata.sessionId}`)
        console.log(`   Source: ${metadata.source}`)
        console.log(`   Has New Data: ${metadata.hasNewData}`)
        console.log(`   Tags: ${Object.keys(data).join(', ')}`)

        // Show sample data for each tag
        for (const [tag, values] of Object.entries(data)) {
          console.log(`   ${tag}: ${values.length} items`)
          if (values.length > 0) {
            // Show first item as sample
            const sample = values[0].length > 100 ? values[0].substring(0, 100) + '...' : values[0]
            console.log(`     Sample: "${sample}"`)
          }
        }
        console.log(`   Total Events: ${subscriptionMetrics.eventsReceived}`)
      }
    )

    await log(`✅ Subscribed to topic "${topicId}" with subscription ID: ${subscriptionId}`)
    await log(`🏷️ Monitoring tags: ${OPERATION_SUBSCRIPTION_CONFIG.tags.join(', ')}`)

    // Add test session to topic to simulate workflow integration
    const testSessionId = 'test-session-' + Date.now()
    operationSubscriber.addSessionToTopic(topicId, testSessionId)
    await log(`➕ Added test session "${testSessionId}" to topic`)

    // Show subscription status
    const activeSubscriptions = operationSubscriber.getActiveSubscriptions()
    await log(`📊 Active subscriptions: ${activeSubscriptions.length}`)
    activeSubscriptions.forEach((sub, i) => {
      console.log(`   ${i+1}. Topic: ${sub.topicId}, Tags: ${sub.tags.join(',')}, Sessions: ${sub.sessionCount}`)
    })

    // Show topic sessions
    const topicSessions = operationSubscriber.getTopicSessions(topicId)
    await log(`📋 Topic sessions: ${topicSessions.join(', ')}`)

    // Get subscriber status
    const status = operationSubscriber.getStatus()
    await log('🔍 Subscriber Status:')
    console.log(JSON.stringify(status, null, 2))

    return {
      operationSubscriber,
      subscriptionId,
      topicId,
      metrics: subscriptionMetrics,
      cleanup: async () => {
        try {
          await log('🧹 Cleaning up operation subscription...')

          // Remove test session
          operationSubscriber.removeSessionFromTopic(topicId, testSessionId)
          await log(`➖ Removed test session "${testSessionId}" from topic`)

          // Unsubscribe
          const unsubscribed = operationSubscriber.unsubscribe(subscriptionId)
          await log(`🔕 Unsubscribed from topic: ${unsubscribed}`)

          // Stop listening
          operationSubscriber.stopListening()
          await log('⏹️ Stopped WebSocket listener')

          // Final metrics
          await log('📈 Final Subscription Metrics:')
          console.log(`   Total Events: ${subscriptionMetrics.eventsReceived}`)
          console.log(`   Event Types: ${JSON.stringify(subscriptionMetrics.eventsByType)}`)
          console.log(`   Total Data Items: ${subscriptionMetrics.totalDataCount}`)
          console.log(`   Session Count: ${subscriptionMetrics.sessionEvents.size}`)

          if (subscriptionMetrics.firstEventTime && subscriptionMetrics.lastEventTime) {
            const duration = new Date(subscriptionMetrics.lastEventTime) - new Date(subscriptionMetrics.firstEventTime)
            console.log(`   Event Duration: ${duration}ms`)
            if (duration > 0) {
              const frequency = subscriptionMetrics.eventsReceived / (duration / 1000)
              console.log(`   Event Frequency: ${frequency.toFixed(2)} events/second`)
            }
          }

        } catch (cleanupError) {
          await log(`⚠️ Cleanup error: ${cleanupError.message}`, 'WARN')
        }
      }
    }

  } catch (error) {
    await log(`❌ Operation subscription test failed: ${error.message}`, 'ERROR')
    throw error
  }
}

/**
 * Test git repository discovery and validate git diff scenarios
 */
async function testGitRepository() {
  await log('🔄 Testing Git repository discovery and validation')
  await log('===============================================')

  try {
    // Test git client initialization
    const gitClient = new GitApiClient(GIT_CONFIG.baseUrl, GIT_CONFIG.repositoryPath)

    // Validate repository
    await log('🔍 Validating git repository...')
    await gitClient.validateRepository()
    await log('✅ Git repository validation successful')

    // Get repository status
    const status = await gitClient.getStatus()
    await log(`📊 Repository Status:`)
    console.log(`   Current branch: ${status.branch}`)
    console.log(`   Staged files: ${status.staged.length}`)
    console.log(`   Modified files: ${status.modified.length}`)
    console.log(`   Untracked files: ${status.untracked.length}`)
    console.log(`   Ahead: ${status.ahead} commits`)
    console.log(`   Behind: ${status.behind} commits`)

    // Get recent commits
    const commits = await gitClient.getCommits(5)
    await log(`📝 Recent commits (${commits.commits.length}):`)
    commits.commits.forEach((commit, i) => {
      console.log(`   ${i+1}. ${commit.shortHash} - ${commit.subject} (${commit.author})`)
    })

    // Get branches
    const branches = await gitClient.getBranches()
    await log(`🌿 Available branches (${branches.branches.length}):`)
    branches.branches.slice(0, 10).forEach((branch, i) => {
      const current = branch === branches.current ? ' (current)' : ''
      console.log(`   ${i+1}. ${branch}${current}`)
    })

    return {
      status,
      commits: commits.commits,
      branches: branches.branches,
      currentBranch: branches.current,
      repositoryPath: GIT_CONFIG.repositoryPath
    }

  } catch (error) {
    await log(`❌ Git repository test failed: ${error.message}`, 'ERROR')
    throw error
  }
}

/**
 * Test git diff scenarios and determine which are available
 */
async function determineAvailableGitScenarios(gitInfo) {
  await log('🔄 Determining available git diff scenarios')
  await log('============================================')

  const availableScenarios = []

  try {
    const gitClient = new GitApiClient(GIT_CONFIG.baseUrl, GIT_CONFIG.repositoryPath)

    // Test 1: Staged files
    if (gitInfo.status.staged.length > 0) {
      await log(`✅ Staged files scenario available (${gitInfo.status.staged.length} files)`)
      availableScenarios.push({
        type: 'staged',
        description: `Review ${gitInfo.status.staged.length} staged files`,
        config: { type: 'staged', repositoryPath: GIT_CONFIG.repositoryPath }
      })
    } else {
      await log('⚠️ No staged files available for testing')
    }

    // Test 2: Unpushed changes
    if (gitInfo.status.ahead > 0) {
      await log(`✅ Unpushed changes scenario available (${gitInfo.status.ahead} commits ahead)`)
      availableScenarios.push({
        type: 'unpushed',
        description: `Review ${gitInfo.status.ahead} unpushed commits`,
        config: { type: 'unpushed', repositoryPath: GIT_CONFIG.repositoryPath }
      })
    } else {
      await log('⚠️ No unpushed changes available for testing')
    }

    // Test 3: Single commit (use latest commit)
    if (gitInfo.commits.length > 0) {
      const latestCommit = gitInfo.commits[0]
      await log(`✅ Single commit scenario available (${latestCommit.shortHash})`)
      availableScenarios.push({
        type: 'commit',
        description: `Review commit: ${latestCommit.shortHash} - ${latestCommit.subject}`,
        config: { type: 'commit', repositoryPath: GIT_CONFIG.repositoryPath, commit: latestCommit.hash }
      })
    }

    // Test 4: Commit range (use last 2 commits if available)
    if (gitInfo.commits.length >= 2) {
      const fromCommit = gitInfo.commits[1]
      const toCommit = gitInfo.commits[0]
      await log(`✅ Commit range scenario available (${fromCommit.shortHash}..${toCommit.shortHash})`)
      availableScenarios.push({
        type: 'commit-range',
        description: `Review commits: ${fromCommit.shortHash}..${toCommit.shortHash}`,
        config: {
          type: 'commit-range',
          repositoryPath: GIT_CONFIG.repositoryPath,
          fromCommit: fromCommit.hash,
          toCommit: toCommit.hash
        }
      })
    }

    // Test 5: Branch diff (compare current branch with main/master if different)
    const currentBranch = gitInfo.currentBranch
    const possibleBaseBranches = ['main', 'master', 'dev', 'develop']
    const availableBaseBranch = possibleBaseBranches.find(branch =>
      gitInfo.branches.includes(branch) && branch !== currentBranch
    )

    if (availableBaseBranch && currentBranch !== availableBaseBranch) {
      await log(`✅ Branch diff scenario available (${availableBaseBranch}..${currentBranch})`)
      availableScenarios.push({
        type: 'branch-diff',
        description: `Review branch diff: ${availableBaseBranch} → ${currentBranch}`,
        config: {
          type: 'branch-diff',
          repositoryPath: GIT_CONFIG.repositoryPath,
          fromBranch: availableBaseBranch,
          toBranch: currentBranch
        }
      })
    } else {
      await log(`⚠️ No suitable base branch found for branch diff (current: ${currentBranch})`)
    }

    await log(`📊 Found ${availableScenarios.length} available git diff scenarios`)
    availableScenarios.forEach((scenario, i) => {
      console.log(`   ${i+1}. ${scenario.type}: ${scenario.description}`)
    })

    return availableScenarios

  } catch (error) {
    await log(`❌ Failed to determine git scenarios: ${error.message}`, 'ERROR')
    throw error
  }
}

/**
 * Test git diff review workflow with a specific scenario
 */
async function testGitDiffReview(scenario, subscriptionTest = null) {
  await log(`🔄 Testing Git diff review: ${scenario.type}`)
  await log(`📝 ${scenario.description}`)
  await log('=======================================')

  try {
    // Create git review input
    const reviewInput = {
      type: 'git',
      identifier: `${scenario.type}-${Date.now()}`,
      metadata: {
        gitDiffType: scenario.type,
        repositoryPath: scenario.config.repositoryPath
      }
    }

    // Create review configuration for git
    const config = {
      baseUrl: GIT_CONFIG.baseUrl,
      // Note: No ADO credentials needed for git workflows
      autoCleanup: false,  // PRESERVE WORKSPACE for inspection
      saveVersions: true,  // SAVE VERSION HISTORY
      operationSubscription: OPERATION_SUBSCRIPTION_CONFIG,
      sharding: {
        strategy: 'file_boundary',
        targetTokens: 8000,
        maxTokens: 12000,
        minTokens: 2000,
        preserveBoundaries: true
      },
      processing: {
        batchSize: 2,
        retryAttempts: 3,
        retryDelay: 1000,
        timeout: 30000
      },
      aggregation: {
        outputFormat: 'json',
        includeMetadata: true,
        includeStatistics: true,
        sortResults: true
      }
    }

    await log('🚀 Creating git workflow factory...')
    const factory = new WorkflowFactory({
      baseUrl: GIT_CONFIG.baseUrl
      // No ADO credentials required for git workflows
    })

    await log('⚙️ Creating git review workflow...')

    // Create full end-to-end git workflow
    const workflow = factory.createGitReviewWorkflow(scenario.config, config)

    await log('🔄 Processing full git review workflow...')
    const startTime = Date.now()

    // Run the complete workflow: fetch → shard → process → aggregate → generate files
    const result = await workflow.process(reviewInput, config)

    const endTime = Date.now()
    const processingTime = endTime - startTime

    await log(`✅ Git review workflow completed successfully in ${processingTime}ms`)
    await log(`📊 Results: ${result.insights?.length || 0} insights, ${result.hunks?.length || 0} hunks, ${result.comments?.length || 0} comments`)

    // Show workspace location
    if (result.workspace) {
      await log(`📁 Workspace preserved at: ${result.workspace}`)
    }

    // Show sample insights
    if (result.insights && result.insights.length > 0) {
      await log(`💡 Sample insights:`)
      result.insights.slice(0, 3).forEach((insight, i) => {
        console.log(`   ${i+1}. [${insight.type}/${insight.severity}] ${insight.description}`)
      })
    }

    // Show sample hunks
    if (result.hunks && result.hunks.length > 0) {
      await log(`🔧 Sample hunks:`)
      result.hunks.slice(0, 3).forEach((hunk, i) => {
        console.log(`   ${i+1}. ${hunk.file} (${hunk.category}): ${hunk.description}`)
      })
    }

    // Show sample comments
    if (result.comments && result.comments.length > 0) {
      await log(`💬 Sample comments:`)
      result.comments.slice(0, 3).forEach((comment, i) => {
        console.log(`   ${i+1}. ${comment.file}:${comment.lineStart} [${comment.severity}] ${comment.message}`)
      })
    }

    return {
      success: true,
      scenario: scenario.type,
      description: scenario.description,
      result,
      processingTime,
      metadata: {
        insights: result.insights?.length || 0,
        hunks: result.hunks?.length || 0,
        comments: result.comments?.length || 0,
        files: result.metadata?.processingStats?.totalFiles || 0,
        workspace: result.workspace
      }
    }

  } catch (error) {
    await log(`❌ Git diff review failed: ${error.message}`, 'ERROR')
    return {
      success: false,
      scenario: scenario.type,
      error: error.message,
      processingTime: 0
    }
  }
}

/**
 * Test all available git diff scenarios
 */
async function testAllGitScenarios(subscriptionTest = null) {
  await log('🔄 Testing all available Git diff scenarios')
  await log('==========================================')

  try {
    // First, test git repository and get info
    const gitInfo = await testGitRepository()

    // Determine available scenarios
    const availableScenarios = await determineAvailableGitScenarios(gitInfo)

    if (availableScenarios.length === 0) {
      await log('⚠️ No git diff scenarios available for testing', 'WARN')
      return {
        success: false,
        message: 'No git scenarios available',
        gitInfo
      }
    }

    // Test each scenario
    const results = []
    for (const scenario of availableScenarios) {
      await log(`\n${'='.repeat(60)}`)
      try {
        const result = await testGitDiffReview(scenario, subscriptionTest)
        results.push(result)

        if (result.success) {
          await log(`✅ ${scenario.type} scenario completed successfully`)
        } else {
          await log(`❌ ${scenario.type} scenario failed: ${result.error}`, 'ERROR')
        }
      } catch (scenarioError) {
        await log(`💥 ${scenario.type} scenario crashed: ${scenarioError.message}`, 'ERROR')
        results.push({
          success: false,
          scenario: scenario.type,
          error: scenarioError.message
        })
      }
    }

    const successfulTests = results.filter(r => r.success).length
    const totalTests = results.length

    await log(`\n📊 Git scenario testing summary: ${successfulTests}/${totalTests} successful`)

    return {
      success: successfulTests > 0,
      gitInfo,
      availableScenarios,
      results,
      summary: {
        total: totalTests,
        successful: successfulTests,
        failed: totalTests - successfulTests
      }
    }

  } catch (error) {
    await log(`💥 Git scenario testing failed: ${error.message}`, 'ERROR')
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Test ADO comment publishing and replying functionality
 * Runs after the main review workflow to test real AI-generated comments
 */
async function testADOCommentWorkflow(reviewResult) {
  await log('🔄 Testing ADO comment publishing and replying functionality')
  await log('============================================================')

  if (!reviewResult.workspace) {
    await log('❌ No workspace found in review result, skipping ADO comment tests', 'ERROR')
    return { success: false, message: 'No workspace available' }
  }

  if (!reviewResult.comments || reviewResult.comments.length === 0) {
    await log('❌ No AI comments found in review result, skipping ADO comment tests', 'ERROR')
    return { success: false, message: 'No AI comments available' }
  }

  try {
    // Initialize ADO content source for comment operations
    const adoConfig = {
      baseUrl: 'http://localhost:3000'
    }
    const adoSource = new ADOContentSource(adoConfig)

    // Validate that the OpenCode server is available
    await log('🔍 Checking OpenCode server availability...')
    try {
      const healthCheck = await fetch('http://localhost:3000/health', { method: 'GET', timeout: 5000 })
      if (!healthCheck.ok) {
        await log('⚠️ OpenCode server health check failed - tests may fail', 'WARN')
      }
    } catch (serverError) {
      await log('⚠️ OpenCode server not accessible - make sure "bun dev" is running', 'WARN')
      await log(`Server check error: ${serverError.message}`, 'DEBUG')
    }

    // Find the first AI comment (usually starts with ai-0 or similar pattern)
    let firstAIComment = reviewResult.comments.find(comment =>
      comment.id && (
        comment.id.startsWith('ai-0') ||
        comment.id.includes('ai-0-') ||
        comment.author?.type === 'ai'
      )
    )

    if (!firstAIComment) {
      await log('❌ No suitable AI comment found for publishing (looking for ai-0-* pattern)', 'ERROR')
      await log(`📋 Available comments: ${reviewResult.comments.map(c => c.id).join(', ')}`)

      // Try to find any AI comment as fallback
      const anyAIComment = reviewResult.comments.find(comment => comment.author?.type === 'ai')
      if (anyAIComment) {
        await log(`🔄 Fallback: Found AI comment with different pattern: ${anyAIComment.id}`)
        firstAIComment = anyAIComment
      } else {
        return { success: false, message: 'No AI comments found in review results' }
      }
    }

    await log(`🎯 Selected AI comment for testing: ${firstAIComment.id}`)
    await log(`📝 Comment content: "${firstAIComment.message.substring(0, 100)}..."`)
    await log(`📂 Comment file: ${firstAIComment.file}:${firstAIComment.startLine}-${firstAIComment.endLine}`)

    // Test 1: Publish the AI comment to ADO
    await log('\n📤 Test 1: Publishing AI comment to ADO...')

    // Build the full workspace path for comment lookup (matches WorkspaceManager logic)
    const fullWorkspacePath = path.join(os.tmpdir(), 'project-workflow', reviewResult.workspace)
    await log(`📂 Using workspace path: ${fullWorkspacePath}`)

    // Verify workspace files exist
    try {
      const reviewResultsPath = path.join(fullWorkspacePath, 'review-results.json')
      await fs.access(reviewResultsPath)
      await log(`✅ Found review-results.json at: ${reviewResultsPath}`)
    } catch (error) {
      await log(`⚠️ Could not access review-results.json: ${error.message}`, 'WARN')
    }

    // // Create the expected .supercode-project directory structure for the publishing API
    // // Find the supercode root directory by looking for the git root or go up until we find packages/
    // let supercodeRoot = process.cwd()
    // const fsSyncModule = await import('fs')
    // while (supercodeRoot !== path.dirname(supercodeRoot)) {
    //   if (fsSyncModule.existsSync(path.join(supercodeRoot, 'packages', 'opencode')) ||
    //       fsSyncModule.existsSync(path.join(supercodeRoot, '.git'))) {
    //     break
    //   }
    //   supercodeRoot = path.dirname(supercodeRoot)
    // }
    // const expectedWorkspacePath = path.join(supercodeRoot, '.supercode-project', 'adhoc', 'reviews', reviewResult.workspace)
    // await log(`🔍 Using supercode root: ${supercodeRoot}`)
    // await log(`📁 Expected workspace path: ${expectedWorkspacePath}`)

    // try {
    //   // Create the directory structure
    //   await fs.mkdir(path.dirname(expectedWorkspacePath), { recursive: true })

    //   // Always copy files instead of symlink to ensure API can find them
    //   await fs.mkdir(expectedWorkspacePath, { recursive: true })

    //   // Copy key files that the API needs
    //   const filesToCopy = ['review-results.json', 'review-index.json']
    //   for (const fileName of filesToCopy) {
    //     try {
    //       const sourceFile = path.join(fullWorkspacePath, fileName)
    //       const destFile = path.join(expectedWorkspacePath, fileName)
    //       await fs.copyFile(sourceFile, destFile)
    //       await log(`📋 Copied ${fileName} to expected location`)
    //     } catch (copyError) {
    //       await log(`⚠️ Failed to copy ${fileName}: ${copyError.message}`, 'WARN')
    //     }
    //   }
    //   await log(`✅ Set up workspace files at ${expectedWorkspacePath}`)
    // } catch (setupError) {
    //   await log(`⚠️ Failed to set up expected workspace structure: ${setupError.message}`, 'WARN')
    // }

    // Use the new publishDirectComment method with message, file, and line info
    const publishResult = await adoSource.publishDirectComment(
      TEST_PR_URL,
      firstAIComment.message,
      firstAIComment.file,
      firstAIComment.startLine || firstAIComment.lineStart,
      firstAIComment.endLine || firstAIComment.lineEnd,
      fullWorkspacePath  // Full path to the workspace for JSON updates
    )

    await log(`📊 Publish result: ${JSON.stringify(publishResult, null, 2)}`)

    if (!publishResult.success) {
      await log(`❌ Failed to publish AI comment: ${publishResult.message}`, 'ERROR')
      return {
        success: false,
        message: `Comment publishing failed: ${publishResult.message}`,
        publishResult
      }
    }

    await log('✅ AI comment published successfully to ADO!')
    await log(`🧵 ADO Thread ID: ${publishResult.adoThreadId}`)
    await log(`💬 ADO Comment ID: ${publishResult.adoCommentId}`)

    // Test 2: Reply to the published comment thread
    // Check if we got a thread ID from the response, or read it from the updated review index
    let threadIdForReply = publishResult.adoThreadId

    if (!threadIdForReply) {
      await log('🔍 Thread ID not in response, checking updated review index...')
      try {
        // Read the updated review index to get the thread ID
        const updatedIndexPath = path.join(fullWorkspacePath, 'review-index.json')
        const updatedIndexContent = await fs.readFile(updatedIndexPath, 'utf-8')
        const updatedIndex = JSON.parse(updatedIndexContent)

        // Find the published comment in the ADO comments section
        // Try multiple strategies to find the matching comment
        let publishedComment = null

        // Strategy 1: Look for exact ID match
        publishedComment = updatedIndex.adoComments?.find(comment =>
          comment.id === firstAIComment.id ||
          (comment.originalId && comment.originalId === firstAIComment.id)
        )

        // Strategy 2: Look for comments with publishedToADO flag
        if (!publishedComment) {
          publishedComment = updatedIndex.adoComments?.find(comment =>
            comment.publishedToADO === true
          )
        }

        // Strategy 3: Look for comments with matching file and line info that have thread IDs
        if (!publishedComment && firstAIComment.file && firstAIComment.startLine) {
          publishedComment = updatedIndex.adoComments?.find(comment =>
            comment.file === firstAIComment.file &&
            comment.startLine === firstAIComment.startLine &&
            comment.endLine === firstAIComment.endLine &&
            (comment.adoThreadId || comment.threadId)
          )
        }

        // Strategy 4: Look for the most recent comment with a thread ID
        if (!publishedComment) {
          const commentsWithThreadId = updatedIndex.adoComments?.filter(comment => comment.adoThreadId || comment.threadId) || []
          if (commentsWithThreadId.length > 0) {
            // Sort by timestamp or use the last one
            publishedComment = commentsWithThreadId[commentsWithThreadId.length - 1]
            await log(`🔄 Using most recent comment with thread ID: ${publishedComment.id}`)
          }
        }

        if (publishedComment && (publishedComment.adoThreadId || publishedComment.threadId)) {
          threadIdForReply = publishedComment.adoThreadId || publishedComment.threadId
          await log(`✅ Found thread ID in updated review index: ${threadIdForReply}`)
          await log(`📋 Comment details: ID=${publishedComment.id}, File=${publishedComment.file}, Lines=${publishedComment.startLine}-${publishedComment.endLine}`)
        } else {
          await log('❌ No thread ID found in updated review index', 'WARN')
          // Debug: Log all available comments for troubleshooting
          if (updatedIndex.adoComments) {
            await log(`🔍 Available ADO comments: ${updatedIndex.adoComments.length}`)
            updatedIndex.adoComments.forEach((comment, i) => {
              console.log(`   ${i+1}. ID: ${comment.id}, File: ${comment.file}, ThreadID: ${comment.adoThreadId || comment.threadId || 'none'}`)
            })
          }
        }
      } catch (indexError) {
        await log(`⚠️ Failed to read updated review index: ${indexError.message}`, 'WARN')
      }
    }

    if (threadIdForReply) {
      await log('\n💬 Test 2: Replying to the published comment...')
      const replyContent = `Automated test reply created at ${new Date().toISOString()}\n\nThis is a test reply to validate the ADO comment replying functionality. The original AI comment has been successfully published and this reply confirms the end-to-end workflow is working correctly.`

      const replyResult = await adoSource.replyToComment(
        TEST_PR_URL,
        threadIdForReply,
        replyContent,
        fullWorkspacePath  // Full path to where we copied the files
      )

      await log(`📊 Reply result: ${JSON.stringify(replyResult, null, 2)}`)

      if (!replyResult.success) {
        await log(`❌ Failed to reply to comment: ${replyResult.message}`, 'ERROR')
        return {
          success: false,
          message: `Comment reply failed: ${replyResult.message}`,
          publishResult,
          replyResult
        }
      }

      await log('✅ Reply posted successfully!')
      await log(`💬 Reply Comment ID: ${replyResult.adoCommentId}`)

      return {
        success: true,
        message: 'ADO comment workflow completed successfully',
        publishResult,
        replyResult,
        testedComment: firstAIComment
      }

    } else {
      await log('⚠️ No thread ID available for reply test (neither in response nor review index)', 'WARN')
      return {
        success: true,
        message: 'Comment published but reply test skipped (no thread ID available)',
        publishResult,
        testedComment: firstAIComment
      }
    }

  } catch (error) {
    await log(`💥 ADO comment workflow failed: ${error.message}`, 'ERROR')
    if (error.stack) {
      await log(`Stack trace: ${error.stack}`, 'DEBUG')
    }
    return {
      success: false,
      message: `ADO workflow error: ${error.message}`,
      error: error.message
    }
  }
}

async function testWithFilePreservation(testMode = 'both') {
  await log(`🧪 Testing with file preservation (mode: ${testMode})`)

  // Initialize operation subscription for real-time monitoring
  let subscriptionTest = null
  try {
    await log('\n🚀 Setting up operation subscription for real-time monitoring...')
    subscriptionTest = await testOperationSubscription()
    await log('✅ Operation subscription ready for real-time events\n')
  } catch (subscriptionError) {
    await log(`⚠️ Operation subscription setup failed: ${subscriptionError.message}`, 'WARN')
    await log('   Continuing with review workflow without real-time monitoring...')
  }

  let gitResult = null
  let adoResult = null

  try {
    // Test ADO workflow if configured and requested
    if ((testMode === 'both' || testMode === 'ado') && process.env.AZURE_DEVOPS_PAT) {
      await log('\n' + '='.repeat(80))
      await log('🔄 Testing ADO PR Review Workflow')
      await log('='.repeat(80))

      const reviewInput = {
        type: 'ado-pr',
        identifier: TEST_PR_URL,
        source: TEST_PR_URL
      }

      const config = {
        baseUrl: 'http://localhost:3000',  // Enable server for operation subscription
        adoCredentials: {
          pat: ADO_CONFIG.pat,
          organization: ADO_CONFIG.organization
        },
        autoCleanup: false,  // PRESERVE WORKSPACE
        saveVersions: true,  // SAVE VERSION HISTORY
        // ENABLE operation subscription for real-time monitoring
        operationSubscription: OPERATION_SUBSCRIPTION_CONFIG,
        sharding: {
          strategy: 'file_boundary',
          targetTokens: 8000,
          maxTokens: 12000,
          minTokens: 2000,
          preserveBoundaries: true
        },
        processing: {
          batchSize: 2,
          retryAttempts: 3,
          retryDelay: 1000,
          timeout: 30000
        },
        aggregation: {
          outputFormat: 'json',
          includeMetadata: true,
          includeStatistics: true,
          sortResults: true
        }
      }

      await log('🔄 Processing real ADO PR with workspace preservation...')
      const startTime = Date.now()

      // This will test the full pipeline: fetch → shard → process → aggregate
      adoResult = await processReview(reviewInput, config)

      const endTime = Date.now()
      const processingTime = endTime - startTime

      await log(`✅ ADO PR processed successfully in ${processingTime}ms`)
      await log(`📊 Results: ${adoResult.insights?.length || 0} insights, ${adoResult.hunks?.length || 0} hunks, ${adoResult.comments?.length || 0} comments`)

      // Show workspace location
      if (adoResult.workspace) {
        await log(`📁 Workspace preserved at: ${adoResult.workspace}`)
      }

      // Show sample insights
      if (adoResult.insights && adoResult.insights.length > 0) {
        await log(`💡 Sample insights:`)
        adoResult.insights.slice(0, 3).forEach((insight, i) => {
          console.log(`   ${i+1}. [${insight.type}/${insight.severity}] ${insight.description}`)
        })
      }

      // Show sample hunks
      if (adoResult.hunks && adoResult.hunks.length > 0) {
        await log(`🔧 Sample hunks:`)
        adoResult.hunks.slice(0, 3).forEach((hunk, i) => {
          console.log(`   ${i+1}. ${hunk.file} (${hunk.category}): ${hunk.description}`)
        })
      }

      // Show sample comments
      if (adoResult.comments && adoResult.comments.length > 0) {
        await log(`💬 Sample comments:`)
        adoResult.comments.slice(0, 3).forEach((comment, i) => {
          console.log(`   ${i+1}. ${comment.file}:${comment.lineStart} [${comment.severity}] ${comment.message}`)
        })
      }

      // Test ADO comment publishing and replying functionality
      await log('\n' + '='.repeat(80))
      const adoCommentResult = await testADOCommentWorkflow(adoResult)
      // Test new review workflow file access methods
      if (adoResult.workspace) {
        await log('\n' + '='.repeat(80))
        try {
          // Import WorkspaceManager for testing the new methods
          const { WorkspaceManager } = await import('../src/core/workspace-manager.ts')
          
          // Create a workspace manager instance (simulating file operations client)
          const workspaceManager = new WorkspaceManager()
          // Set the current workspace to the one created by the review
          workspaceManager.currentWorkspacePath = adoResult.workspace
          
          const reviewMethodsResult = await testReviewWorkflowFileMethods(workspaceManager, adoResult.workspace)
          adoResult.reviewMethodsTest = reviewMethodsResult
          
        } catch (methodTestError) {
          await log(`⚠️ Review workflow methods test failed: ${methodTestError.message}`, 'WARN')
          adoResult.reviewMethodsTest = { success: false, error: methodTestError.message }
        }
      }

      // Add ADO test results to the main result
      adoResult.adoCommentTest = adoCommentResult

      // Add operation subscription test results
      if (subscriptionTest) {
        adoResult.operationSubscriptionTest = {
          subscriptionId: subscriptionTest.subscriptionId,
          topicId: subscriptionTest.topicId,
          metrics: subscriptionTest.metrics
        }
      }
    } else if (testMode === 'ado' || (testMode === 'both' && !process.env.AZURE_DEVOPS_PAT)) {
      await log('⚠️ ADO testing requested but AZURE_DEVOPS_PAT not found, skipping ADO tests', 'WARN')
    }

    // Test Git workflow if requested
    if (testMode === 'both' || testMode === 'git') {
      await log('\n' + '='.repeat(80))
      await log('🔄 Testing Git Diff Review Workflow')
      await log('='.repeat(80))

      gitResult = await testAllGitScenarios(subscriptionTest)

      if (gitResult.success) {
        await log('✅ Git diff testing completed successfully')
      } else {
        await log(`❌ Git diff testing failed: ${gitResult.error || 'Unknown error'}`, 'ERROR')
      }
    }

    // Return combined results
    return {
      success: true,
      testMode,
      adoResult,
      gitResult,
      hasBoth: !!(adoResult && gitResult),
      summary: {
        ado: adoResult ? {
          success: !!adoResult.success,
          insights: adoResult.insights?.length || 0,
          hunks: adoResult.hunks?.length || 0,
          comments: adoResult.comments?.length || 0,
          workspace: adoResult.workspace
        } : null,
        git: gitResult ? {
          success: gitResult.success,
          scenarios: gitResult.summary?.total || 0,
          successful: gitResult.summary?.successful || 0,
          failed: gitResult.summary?.failed || 0
        } : null
      }
    }

  } catch (error) {
    await log(`❌ Test failed: ${error.message}`, 'ERROR')
    if (error.stack) {
      await log(`Stack trace: ${error.stack}`, 'DEBUG')
    }
    throw error
  } finally {
    // Clean up operation subscription
    if (subscriptionTest && subscriptionTest.cleanup) {
      try {
        await log('\n🧹 Cleaning up operation subscription...')
        await subscriptionTest.cleanup()
      } catch (cleanupError) {
        await log(`⚠️ Operation subscription cleanup failed: ${cleanupError.message}`, 'WARN')
      }
    }
  }
}

/**
 * Test all new review workflow file access methods
 */
async function testReviewWorkflowFileMethods(workspaceManager, workspacePath) {
  await log('🔄 Testing Review Workflow File Access Methods')
  await log('============================================')

  const results = {
    getReviewIndex: null,
    getReviewResults: null,
    getVersionFiles: null,
    getVersionFilesForPath: null,
    getAllVersionFiles: null,
    checkReviewFiles: null
  }

  try {
    // Test 1: getReviewIndex()
    await log('📄 Testing getReviewIndex()...')
    try {
      const reviewIndex = await workspaceManager.getReviewIndex()
      if (reviewIndex) {
        await log(`✅ getReviewIndex() success - Found review index with ${reviewIndex.totalFiles || 0} files`)
        await log(`   PR: ${reviewIndex.pullRequest?.id || 'N/A'} - ${reviewIndex.pullRequest?.title || 'N/A'}`)
        await log(`   ADO Comments: ${reviewIndex.adoComments?.length || 0}`)
        results.getReviewIndex = { success: true, data: reviewIndex }
      } else {
        await log('⚠️ getReviewIndex() returned null - review-index.json not found')
        results.getReviewIndex = { success: false, message: 'File not found' }
      }
    } catch (error) {
      await log(`❌ getReviewIndex() failed: ${error.message}`, 'ERROR')
      results.getReviewIndex = { success: false, error: error.message }
    }

    // Test 2: getReviewResults()
    await log('📄 Testing getReviewResults()...')
    try {
      const reviewResults = await workspaceManager.getReviewResults()
      if (reviewResults) {
        await log(`✅ getReviewResults() success - Found ${reviewResults.insights?.length || 0} insights`)
        await log(`   Hunks: ${reviewResults.hunks?.length || 0}`)
        await log(`   Comments: ${reviewResults.comments?.length || 0}`)
        results.getReviewResults = { success: true, data: reviewResults }
      } else {
        await log('⚠️ getReviewResults() returned null - review-results.json not found')
        results.getReviewResults = { success: false, message: 'File not found' }
      }
    } catch (error) {
      await log(`❌ getReviewResults() failed: ${error.message}`, 'ERROR')
      results.getReviewResults = { success: false, error: error.message }
    }

    // Test 3: getVersionFiles()
    await log('📁 Testing getVersionFiles()...')
    try {
      const versionFiles = await workspaceManager.getVersionFiles()
      await log(`✅ getVersionFiles() success - Found ${versionFiles.length} version files`)
      if (versionFiles.length > 0) {
        await log(`   Sample files: ${versionFiles.slice(0, 5).join(', ')}`)
        if (versionFiles.length > 5) {
          await log(`   ... and ${versionFiles.length - 5} more`)
        }
      }
      results.getVersionFiles = { success: true, count: versionFiles.length, files: versionFiles }
    } catch (error) {
      await log(`❌ getVersionFiles() failed: ${error.message}`, 'ERROR')
      results.getVersionFiles = { success: false, error: error.message }
    }

    // Test 4: getVersionFilesForPath() - Test with the first file if we have version files
    await log('📂 Testing getVersionFilesForPath()...')
    try {
      let testFilePath = 'test/example.js' // Default test path
      
      // If we have actual version files, use the first one to determine a real path
      if (results.getVersionFiles?.files?.length > 0) {
        const firstVersionFile = results.getVersionFiles.files[0]
        // Extract base name by removing extensions
        if (firstVersionFile.endsWith('.local')) {
          testFilePath = firstVersionFile.slice(0, -6).replace(/_/g, '/')
        } else if (firstVersionFile.endsWith('.remote')) {
          testFilePath = firstVersionFile.slice(0, -7).replace(/_/g, '/')
        } else if (firstVersionFile.endsWith('.diff')) {
          testFilePath = firstVersionFile.slice(0, -5).replace(/_/g, '/')
        }
      }

      const versionContent = await workspaceManager.getVersionFilesForPath(testFilePath)
      await log(`✅ getVersionFilesForPath('${testFilePath}') success`)
      await log(`   Local: ${versionContent.local ? 'Found' : 'Not found'}`)
      await log(`   Remote: ${versionContent.remote ? 'Found' : 'Not found'}`)
      await log(`   Diff: ${versionContent.diff ? 'Found' : 'Not found'}`)
      
      results.getVersionFilesForPath = { 
        success: true, 
        testPath: testFilePath,
        hasLocal: !!versionContent.local,
        hasRemote: !!versionContent.remote,
        hasDiff: !!versionContent.diff
      }
    } catch (error) {
      await log(`❌ getVersionFilesForPath() failed: ${error.message}`, 'ERROR')
      results.getVersionFilesForPath = { success: false, error: error.message }
    }

    // Test 5: getAllVersionFiles()
    await log('📚 Testing getAllVersionFiles()...')
    try {
      const allVersionFiles = await workspaceManager.getAllVersionFiles()
      await log(`✅ getAllVersionFiles() success - Found ${allVersionFiles.length} file groups`)
      
      let totalVersions = 0
      for (let i = 0; i < allVersionFiles.length; i++) {
        const fileGroup = allVersionFiles[i]
        if (i < 3) { // Show details for first 3 files
          const versions = []
          if (fileGroup.local) versions.push('local')
          if (fileGroup.remote) versions.push('remote')
          if (fileGroup.diff) versions.push('diff')
          totalVersions += versions.length

          await log(`   ${i+1}. ${fileGroup.filePath} (${versions.join(', ')})`)
        }
      }
      
      if (allVersionFiles.length > 3) {
        await log(`   ... and ${allVersionFiles.length - 3} more files`)
      }
      
      results.getAllVersionFiles = { 
        success: true, 
        fileGroups: allVersionFiles.length,
        totalVersions: totalVersions,
        sample: allVersionFiles.slice(0, 3).map(f => ({
          filePath: f.filePath,
          hasLocal: !!f.local,
          hasRemote: !!f.remote,
          hasDiff: !!f.diff
        }))
      }
    } catch (error) {
      await log(`❌ getAllVersionFiles() failed: ${error.message}`, 'ERROR')
      results.getAllVersionFiles = { success: false, error: error.message }
    }

    // Test 6: checkReviewFiles()
    await log('🔍 Testing checkReviewFiles()...')
    try {
      const reviewFileStatus = await workspaceManager.checkReviewFiles()
      await log(`✅ checkReviewFiles() success`)
      await log(`   Review Index: ${reviewFileStatus.hasReviewIndex ? 'Found' : 'Not found'}`)
      await log(`   Review Results: ${reviewFileStatus.hasReviewResults ? 'Found' : 'Not found'}`)
      await log(`   Version Files: ${reviewFileStatus.hasVersionFiles ? `Found (${reviewFileStatus.versionFileCount})` : 'Not found'}`)
      
      results.checkReviewFiles = { success: true, status: reviewFileStatus }
    } catch (error) {
      await log(`❌ checkReviewFiles() failed: ${error.message}`, 'ERROR')
      results.checkReviewFiles = { success: false, error: error.message }
    }

    // Summary
    const successCount = Object.values(results).filter(r => r?.success).length
    const totalTests = Object.keys(results).length
    
    await log(`\n📊 Review Workflow File Methods Test Summary: ${successCount}/${totalTests} successful`)
    
    console.log('\n=== REVIEW WORKFLOW FILE METHODS TEST RESULTS ===')
    console.log(JSON.stringify(results, null, 2))

    return {
      success: successCount > 0,
      results,
      summary: {
        total: totalTests,
        successful: successCount,
        failed: totalTests - successCount
      }
    }

  } catch (error) {
    await log(`💥 Review workflow file methods test failed: ${error.message}`, 'ERROR')
    return {
      success: false,
      error: error.message,
      results
    }
  }
}

async function runManualTest(testMode = 'git') {
  const startTime = Date.now()

  try {
    await log('🚀 Starting manual test with file preservation')
    await log(`🎯 Test mode: ${testMode}`)

    if (testMode.includes('ado') && process.env.AZURE_DEVOPS_PAT) {
      await log(`🎯 ADO PR URL: ${TEST_PR_URL}`)
    }

    if (testMode.includes('git')) {
      await log(`🎯 Git repository: ${GIT_CONFIG.repositoryPath}`)
    }

    const result = await testWithFilePreservation(testMode)

    const endTime = Date.now()
    const totalTime = endTime - startTime

    await log(`🎉 Manual test completed! Total time: ${totalTime}ms`)

    // Show the final result summary
    console.log('\n' + '='.repeat(80))
    console.log('=== FINAL RESULTS SUMMARY ===')
    console.log('='.repeat(80))

    console.log(`\nTest Mode: ${result.testMode}`)
    console.log(`Overall Success: ${result.success}`)
    console.log(`Total Processing Time: ${totalTime}ms`)

    // ADO Results
    if (result.adoResult) {
      console.log('\n--- ADO Workflow Results ---')
      console.log(JSON.stringify({
        success: result.summary.ado.success,
        insights: result.summary.ado.insights,
        hunks: result.summary.ado.hunks,
        comments: result.summary.ado.comments,
        workspace: result.summary.ado.workspace,
        adoCommentTest: {
          success: result.adoResult.adoCommentTest?.success || false,
          message: result.adoResult.adoCommentTest?.message || 'No ADO test performed',
          publishedComment: result.adoResult.adoCommentTest?.testedComment?.id || null,
          adoThreadId: result.adoResult.adoCommentTest?.publishResult?.adoThreadId || null,
          replySuccess: result.adoResult.adoCommentTest?.replyResult?.success || false
        },
        operationSubscription: {
          enabled: !!result.adoResult.operationSubscriptionTest,
          eventsReceived: result.adoResult.operationSubscriptionTest?.metrics?.eventsReceived || 0,
          eventTypes: Object.keys(result.adoResult.operationSubscriptionTest?.metrics?.eventsByType || {}),
          totalDataCount: result.adoResult.operationSubscriptionTest?.metrics?.totalDataCount || 0
        }
      }, null, 2))
    }

    // Git Results
    if (result.gitResult) {
      console.log('\n--- Git Workflow Results ---')
      console.log(JSON.stringify({
        success: result.summary.git.success,
        totalScenarios: result.summary.git.scenarios,
        successfulScenarios: result.summary.git.successful,
        failedScenarios: result.summary.git.failed,
        availableScenarios: result.gitResult.availableScenarios?.map(s => ({
          type: s.type,
          description: s.description
        })) || [],
        results: result.gitResult.results?.map(r => ({
          scenario: r.scenario,
          success: r.success,
          error: r.error,
          metadata: r.metadata
        })) || []
      }, null, 2))
    }

    // Verification instructions
    console.log('\n' + '='.repeat(80))
    console.log('=== VERIFICATION INSTRUCTIONS ===')
    console.log('='.repeat(80))

    if (result.adoResult?.adoCommentTest?.success) {
      console.log('\n📋 ADO Manual Verification Steps:')
      console.log('1. Visit the PR URL in your browser: ' + TEST_PR_URL)
      console.log('2. Look for the published AI comment in the PR thread')
      console.log('3. Verify the automated reply appears in the comment thread')
      console.log('4. Comments should be identifiable by their content and timestamp')

      if (result.adoResult.adoCommentTest.publishResult?.adoThreadId) {
        console.log(`5. Check ADO thread ID: ${result.adoResult.adoCommentTest.publishResult.adoThreadId}`)
      }

      if (result.adoResult.workspace) {
        console.log(`6. Inspect preserved workspace: ${result.adoResult.workspace}`)
      }
    }

    if (result.gitResult?.success) {
      console.log('\n📋 Git Workflow Verification:')
      console.log('✅ Git diff scenarios tested successfully')
      console.log(`📊 ${result.summary.git.successful}/${result.summary.git.scenarios} scenarios passed`)

      if (result.gitResult.availableScenarios) {
        console.log('\n🔍 Tested Git Scenarios:')
        result.gitResult.availableScenarios.forEach((scenario, i) => {
          const testResult = result.gitResult.results?.find(r => r.scenario === scenario.type)
          const status = testResult?.success ? '✅' : '❌'
          console.log(`   ${i+1}. ${status} ${scenario.type}: ${scenario.description}`)
          if (testResult && !testResult.success && testResult.error) {
            console.log(`      Error: ${testResult.error}`)
          }
        })
      }
    }

    // Common issues and troubleshooting
    console.log('\n🔧 Troubleshooting:')
    console.log('Make sure:')
    console.log('1. OpenCode server is running (bun dev)')
    console.log('2. Server is accessible at http://localhost:3000')

    if (testMode.includes('ado')) {
      console.log('3. AZURE_DEVOPS_PAT environment variable is set for ADO tests')
      console.log('4. ADO credentials have proper permissions for the test repository')
    }

    if (testMode.includes('git')) {
      console.log('3. Current directory is a valid git repository with commit history')
      console.log('4. Git repository has various diff scenarios available (commits, branches, etc.)')
    }

    return result

  } catch (error) {
    await log(`💥 Manual test failed: ${error.message}`, 'ERROR')
    if (error.stack) {
      await log(`Stack trace: ${error.stack}`, 'DEBUG')
    }
    process.exit(1)
  }
}

// Run test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  // Parse command line arguments
  const args = process.argv.slice(2)
  let testMode = 'git' // Default to git testing only

  // Check for test mode argument
  if (args.length > 0) {
    const modeArg = args[0].toLowerCase()
    if (['git', 'ado', 'both'].includes(modeArg)) {
      testMode = modeArg
    } else {
      console.log('Usage: bun test/manual-test-with-files.js [git|ado|both]')
      console.log('  git  - Test git diff scenarios only (default)')
      console.log('  ado  - Test ADO PR workflow only')
      console.log('  both - Test both git and ADO workflows')
      process.exit(1)
    }
  }

  console.log(`Starting manual test with mode: ${testMode}`)
  runManualTest(testMode)
}

export {
  runManualTest,
  testWithFilePreservation,
  testADOCommentWorkflow,
  testOperationSubscription,
  testGitRepository,
  testAllGitScenarios,
  testGitDiffReview,
  determineAvailableGitScenarios,
  ADO_CONFIG,
  GIT_CONFIG,
  TEST_PR_URL,
  OPERATION_SUBSCRIPTION_CONFIG
}