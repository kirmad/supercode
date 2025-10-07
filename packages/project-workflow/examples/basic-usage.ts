#!/usr/bin/env bun
/**
 * Basic Usage Example for Project Workflow
 * Demonstrates how to use the modular sharded review system
 * Extracted from scripts/sharded-review-parallel.js
 */

import {
  WorkflowFactory,
  createReviewWorkflow,
  processReview,
  processReviewBatch,
  type ReviewInput,
  type ReviewConfig,
  WorkflowType
} from '../src/index.js'

// Configure logging for demo
process.env.DEBUG = 'ProjectWorkflow:*'

/**
 * Example 1: Simple review processing using convenience function
 */
async function exampleSimpleReview() {
  console.log('\n=== Example 1: Simple Review Processing ===')

  // Define the PR to review (from original script examples)
  const reviewInput: ReviewInput = {
    identifier: 'https://dev.azure.com/MicrosoftIT/OneITVSO/_git/supercode/pullrequest/2084',
    type: 'pull_request'
  }

  try {
    // Use the convenience function with default configuration
    const result = await processReview(reviewInput)

    console.log(`✅ Review completed successfully!`)
    console.log(`📊 Results: ${result.insights.length} insights, ${result.hunks.length} hunks, ${result.comments.length} comments`)
    console.log(`⏱️  Processing time: ${result.metadata.processingStats.totalProcessingTime}ms`)

    // Display sample insights
    if (result.insights.length > 0) {
      console.log('\n📋 Sample insights:')
      result.insights.slice(0, 3).forEach((insight, i) => {
        console.log(`  ${i + 1}. [${insight.severity}] ${insight.type}: ${insight.content.substring(0, 100)}...`)
      })
    }

  } catch (error) {
    console.error('❌ Review failed:', error)
  }
}

/**
 * Example 2: Custom configuration with factory
 */
async function exampleCustomConfiguration() {
  console.log('\n=== Example 2: Custom Configuration ===')

  // Create factory with custom configuration
  const factory = new WorkflowFactory({
    baseUrl: process.env.OPENCODE_BASE_URL || 'http://localhost:3001',
    adoCredentials: {
      personalAccessToken: process.env.ADO_PAT || process.env.AZURE_DEVOPS_PAT
    },
    defaults: {
      agent: 'code-reviewer',
      maxParallelSessions: 2, // Reduced for this example
      optimalTokensPerShard: 6000, // Smaller shards for demo
      maxTokensPerShard: 10000,
      includeFilePatterns: ['**/*.ts', '**/*.js'], // Only TypeScript and JavaScript
      excludeFilePatterns: ['**/node_modules/**', '**/dist/**']
    }
  })

  // Create review workflow with custom overrides
  const workflow = factory.createReviewWorkflow({
    saveVersions: true, // Save versions for inspection
    autoCleanup: false // Keep workspace for debugging
  })

  const reviewInput: ReviewInput = {
    identifier: 'https://dev.azure.com/MicrosoftIT/OneITVSO/_git/supercode/pullrequest/2084',
    type: 'pull_request'
  }

  try {
    console.log('🚀 Starting review with custom configuration...')
    const result = await workflow.process(reviewInput)

    console.log(`✅ Custom review completed!`)
    console.log(`📁 Workspace preserved at: ${result.workspace}`)
    console.log(`📊 Processing stats:`, result.metadata.processingStats)

  } catch (error) {
    console.error('❌ Custom review failed:', error)
  }
}

/**
 * Example 3: Batch processing multiple PRs
 */
async function exampleBatchProcessing() {
  console.log('\n=== Example 3: Batch Processing ===')

  // Multiple PRs to process (using the same one for demo)
  const reviewInputs: ReviewInput[] = [
    {
      identifier: 'https://dev.azure.com/MicrosoftIT/OneITVSO/_git/supercode/pullrequest/2084',
      type: 'pull_request'
    }
    // Add more PRs here for real batch processing
  ]

  try {
    console.log(`🚀 Starting batch processing of ${reviewInputs.length} reviews...`)

    const results = await processReviewBatch(reviewInputs, {
      maxConcurrency: 2,
      optimalTokensPerShard: 6000
    })

    console.log(`✅ Batch processing completed!`)
    console.log(`📊 Processed ${results.length} reviews successfully`)

    // Summary statistics
    const totalInsights = results.reduce((sum, r) => sum + r.insights.length, 0)
    const totalComments = results.reduce((sum, r) => sum + r.comments.length, 0)
    const totalTime = results.reduce((sum, r) => sum + r.metadata.processingStats.totalProcessingTime, 0)

    console.log(`📈 Totals: ${totalInsights} insights, ${totalComments} comments, ${totalTime}ms processing time`)

  } catch (error) {
    console.error('❌ Batch processing failed:', error)
  }
}

/**
 * Example 4: Using individual components for advanced use cases
 */
async function exampleAdvancedUsage() {
  console.log('\n=== Example 4: Advanced Component Usage ===')

  try {
    // Create factory from environment
    const factory = WorkflowFactory.createFromEnvironment()

    // Get workflow metadata
    const supportedTypes = factory.getSupportedWorkflowTypes()
    console.log('📋 Supported workflow types:', supportedTypes)

    // Create multiple workflows for comparison
    const workflows = factory.createWorkflowBatch(WorkflowType.REVIEW, 2, {
      optimalTokensPerShard: 5000
    })

    console.log(`🔧 Created ${workflows.length} workflow instances`)

    // Get processing status from one workflow
    const status = workflows[0].getProcessingStatus()
    console.log('📊 Workflow status:', status)

    console.log('✅ Advanced usage example completed!')

  } catch (error) {
    console.error('❌ Advanced usage failed:', error)
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Project Workflow Examples')
  console.log('Modular system extracted from scripts/sharded-review-parallel.js')
  console.log('=' * 60)

  // Check environment
  if (!process.env.ADO_PAT && !process.env.OPENCODE_BASE_URL) {
    console.log('⚠️  Using default configuration with hardcoded PAT token')
  }

  try {
    // Run examples sequentially
    await exampleSimpleReview()
    await exampleCustomConfiguration()
    await exampleBatchProcessing()
    await exampleAdvancedUsage()

    console.log('\n🎉 All examples completed successfully!')

  } catch (error) {
    console.error('\n💥 Example execution failed:', error)
    process.exit(1)
  }
}

// Command line argument parsing
const args = process.argv.slice(2)

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: bun examples/basic-usage.ts [options]

Options:
  --help, -h     Show this help message
  --simple       Run only the simple review example
  --custom       Run only the custom configuration example
  --batch        Run only the batch processing example
  --advanced     Run only the advanced usage example

Environment Variables:
  OPENCODE_BASE_URL  Base URL for OpenCode server (default: http://localhost:3001)
  ADO_PAT           Azure DevOps Personal Access Token
  DEBUG             Enable debug logging (use ProjectWorkflow:* for all logs)

Examples:
  bun examples/basic-usage.ts
  bun examples/basic-usage.ts --simple
  DEBUG=ProjectWorkflow:* bun examples/basic-usage.ts --custom
`)
  process.exit(0)
}

// Run specific examples based on arguments
if (args.includes('--simple')) {
  exampleSimpleReview().catch(console.error)
} else if (args.includes('--custom')) {
  exampleCustomConfiguration().catch(console.error)
} else if (args.includes('--batch')) {
  exampleBatchProcessing().catch(console.error)
} else if (args.includes('--advanced')) {
  exampleAdvancedUsage().catch(console.error)
} else {
  // Run all examples
  main().catch(console.error)
}