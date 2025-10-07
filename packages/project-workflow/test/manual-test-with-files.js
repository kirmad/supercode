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

async function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] [${level}] ${message}`)
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

async function testWithFilePreservation() {
  await log('🧪 Testing with file preservation to see generated review files')

  try {
    const reviewInput = {
      type: 'ado-pr',
      identifier: TEST_PR_URL,
      source: TEST_PR_URL
    }

    const config = {
      // baseUrl: 'http://localhost:3000',  // Comment out to use local file system
      adoCredentials: {
        pat: ADO_CONFIG.pat,
        organization: ADO_CONFIG.organization
      },
      autoCleanup: false,  // PRESERVE WORKSPACE
      saveVersions: true,  // SAVE VERSION HISTORY
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
    const result = await processReview(reviewInput, config)

    const endTime = Date.now()
    const processingTime = endTime - startTime

    await log(`✅ ADO PR processed successfully in ${processingTime}ms`)
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

    // NEW: Test ADO comment publishing and replying functionality
    await log('\n' + '='.repeat(80))
    const adoResult = await testADOCommentWorkflow(result)

    // Add ADO test results to the main result
    result.adoCommentTest = adoResult

    return result

  } catch (error) {
    await log(`❌ Test failed: ${error.message}`, 'ERROR')
    if (error.stack) {
      await log(`Stack trace: ${error.stack}`, 'DEBUG')
    }
    throw error
  }
}

async function runManualTest() {
  const startTime = Date.now()

  try {
    await log('🚀 Starting manual test with file preservation')
    await log(`🎯 Testing against ADO PR: ${TEST_PR_URL}`)

    const result = await testWithFilePreservation()

    const endTime = Date.now()
    const totalTime = endTime - startTime

    await log(`🎉 Manual test completed! Total time: ${totalTime}ms`)
    await log('✅ Check the workspace directory for generated files')

    // Show the final result summary
    console.log('\n=== FINAL RESULTS ===')
    console.log('Review Results:')
    console.log(JSON.stringify({
      success: result.success,
      metadata: {
        totalFiles: result.metadata?.processingStats?.totalShards || 0,
        processingTime: result.metadata?.processingStats?.totalProcessingTime || 0
      },
      statistics: {
        insights: result.insights?.length || 0,
        hunks: result.hunks?.length || 0,
        comments: result.comments?.length || 0
      },
      workspace: result.workspace
    }, null, 2))

    console.log('\nADO Comment Test Results:')
    console.log(JSON.stringify({
      adoTestSuccess: result.adoCommentTest?.success || false,
      adoTestMessage: result.adoCommentTest?.message || 'No ADO test performed',
      publishedComment: result.adoCommentTest?.testedComment?.id || null,
      adoThreadId: result.adoCommentTest?.publishResult?.adoThreadId || null,
      replySuccess: result.adoCommentTest?.replyResult?.success || false
    }, null, 2))

    // Show verification instructions
    if (result.adoCommentTest?.success) {
      console.log('\n📋 Manual Verification Steps:')
      console.log('1. Visit the PR URL in your browser: ' + TEST_PR_URL)
      console.log('2. Look for the published AI comment in the PR thread')
      console.log('3. Verify the automated reply appears in the comment thread')
      console.log('4. Comments should be identifiable by their content and timestamp')

      if (result.adoCommentTest.publishResult?.adoThreadId) {
        console.log(`5. Check ADO thread ID: ${result.adoCommentTest.publishResult.adoThreadId}`)
      }
    } else {
      console.log('\n⚠️ ADO Comment Test Issues:')
      console.log('Make sure:')
      console.log('1. OpenCode server is running (bun dev)')
      console.log('2. Server has access to ADO API')
      console.log('3. Review generated AI comments successfully')
      console.log('4. Workspace files are preserved and accessible')
    }

  } catch (error) {
    await log(`💥 Manual test failed: ${error.message}`, 'ERROR')
    process.exit(1)
  }
}

// Run test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runManualTest()
}

export {
  runManualTest,
  testWithFilePreservation,
  testADOCommentWorkflow,
  ADO_CONFIG,
  TEST_PR_URL
}