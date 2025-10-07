/**
 * Example: Using the CommentService for ADO Pull Request Comments
 *
 * This example demonstrates how to use the CommentService to interact
 * with Azure DevOps pull request comments in various ways.
 */

import { CommentService } from '../src/services/comment-service.js';
import type { AzureDevOpsConfig } from '../src/interfaces/index.js';

// Example configuration
const config: AzureDevOpsConfig = {
  organization: 'your-org',
  project: 'your-project',
  pat: process.env.ADO_PAT || 'your-personal-access-token'
};

async function main() {
  const commentService = new CommentService(config);

  const repositoryId = 'your-repo-id';
  const pullRequestId = 123;

  console.log('=== CommentService Usage Examples ===\n');

  // Example 1: Publish a general comment
  console.log('1. Publishing a general comment...');
  try {
    const generalComment = await commentService.publishComment(repositoryId, pullRequestId, {
      content: 'This pull request looks good overall! 👍',
      status: 'active'
    });
    console.log(`✅ Published general comment with thread ID: ${generalComment.id}`);
    console.log(`   Stable ID: ${generalComment.stableId}\n`);
  } catch (error) {
    console.log(`❌ Failed to publish general comment: ${error}\n`);
  }

  // Example 2: Publish a code comment on a specific line
  console.log('2. Publishing a code comment...');
  try {
    const threadContext = commentService.createThreadContext({
      filePath: '/src/utils/helper.ts',
      startLine: 42,
      column: 5
    });

    const codeComment = await commentService.publishComment(repositoryId, pullRequestId, {
      content: 'Consider using `const` instead of `let` here for better immutability.',
      threadContext,
      status: 'active'
    });
    console.log(`✅ Published code comment with thread ID: ${codeComment.id}`);
    console.log(`   File: ${threadContext.filePath}, Line: ${threadContext.rightFileStart?.line}\n`);
  } catch (error) {
    console.log(`❌ Failed to publish code comment: ${error}\n`);
  }

  // Example 3: Publish an AI-generated comment with stable ID
  console.log('3. Publishing an AI-generated comment...');
  try {
    const aiComment = await commentService.publishComment(repositoryId, pullRequestId, {
      content: `## AI Code Review - Security Analysis

**Severity**: High

This function has a potential security vulnerability:
- Input validation is missing on line 25
- SQL injection risk detected
- Recommendation: Add proper input sanitization

*This is an AI-generated security review*`,
      stableId: 'ai-security-review-001',
      isAIGenerated: true,
      status: 'active'
    });
    console.log(`✅ Published AI comment with stable ID: ${aiComment.stableId}\n`);
  } catch (error) {
    console.log(`❌ Failed to publish AI comment: ${error}\n`);
  }

  // Example 4: Poll for new comments
  console.log('4. Polling for new comments...');
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours
    const pollResult = await commentService.pollForNewComments(repositoryId, pullRequestId, {
      since,
      maxComments: 10,
      includeAIGenerated: true,
      includeSystemComments: false
    });

    console.log(`✅ Found ${pollResult.newComments.length} new comments (${pollResult.totalProcessed} total processed)`);
    pollResult.newComments.forEach((comment, index) => {
      console.log(`   ${index + 1}. ${comment.author}: ${comment.cleanContent.substring(0, 100)}...`);
      console.log(`      Severity: ${comment.severity}, ID: ${comment.id}`);
    });
    console.log('');
  } catch (error) {
    console.log(`❌ Failed to poll comments: ${error}\n`);
  }

  // Example 5: Reply to a thread
  console.log('5. Replying to a thread...');
  try {
    // You would get this threadId from polling or from a published comment
    const threadId = 456; // Example thread ID

    const reply = await commentService.replyToThread(
      repositoryId,
      pullRequestId,
      threadId,
      'Thanks for the feedback! I\'ll make those changes.'
    );
    console.log(`✅ Added reply with comment ID: ${reply.id}\n`);
  } catch (error) {
    console.log(`❌ Failed to reply to thread: ${error}\n`);
  }

  // Example 6: Get all comments in processed format
  console.log('6. Getting all processed comments...');
  try {
    const allComments = await commentService.getAllComments(repositoryId, pullRequestId);

    console.log(`✅ Retrieved ${allComments.length} comment threads:`);
    allComments.forEach((threadComments, index) => {
      console.log(`   Thread ${index + 1} (ID: ${threadComments.threadId}): ${threadComments.comments.length} comments`);
      threadComments.comments.forEach((comment, commentIndex) => {
        const preview = comment.cleanContent.substring(0, 80).replace(/\n/g, ' ');
        console.log(`     ${commentIndex + 1}. ${comment.author}: ${preview}...`);
      });
    });
    console.log('');
  } catch (error) {
    console.log(`❌ Failed to get all comments: ${error}\n`);
  }

  // Example 7: Find comments by stable ID
  console.log('7. Finding comments by stable ID...');
  try {
    const aiComments = await commentService.findCommentsByStableId(
      repositoryId,
      pullRequestId,
      'ai-security-review'
    );

    console.log(`✅ Found ${aiComments.length} AI security review comments:`);
    aiComments.forEach((comment, index) => {
      console.log(`   ${index + 1}. ${comment.id}: ${comment.cleanContent.substring(0, 100)}...`);
      console.log(`      Severity: ${comment.severity}`);
    });
    console.log('');
  } catch (error) {
    console.log(`❌ Failed to find comments by stable ID: ${error}\n`);
  }

  // Example 8: Update thread status
  console.log('8. Updating thread status...');
  try {
    const threadId = 456; // Example thread ID

    const updatedThread = await commentService.updateThreadStatus(
      repositoryId,
      pullRequestId,
      threadId,
      'fixed'
    );
    console.log(`✅ Updated thread ${threadId} status to: ${updatedThread.status}\n`);
  } catch (error) {
    console.log(`❌ Failed to update thread status: ${error}\n`);
  }

  console.log('=== CommentService Examples Complete ===');
}

// Run the examples
if (import.meta.main) {
  main().catch(console.error);
}

export { main as runCommentServiceExamples };