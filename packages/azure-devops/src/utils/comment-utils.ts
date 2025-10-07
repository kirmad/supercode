/**
 * Utility functions for ADO comment processing
 * Provides stable ID generation, severity extraction, and content cleaning for Azure DevOps comments
 */

/**
 * Severity levels for ADO comments
 */
export type CommentSeverity = 'low' | 'medium' | 'high';

/**
 * Generate a stable, unique ID for ADO comments
 * Uses ADO comment ID if available, otherwise creates a hash from thread ID, timestamp, and content
 *
 * @param comment - The ADO comment object containing id, publishedDate, and content
 * @param threadId - The ADO thread ID this comment belongs to
 * @returns A stable string ID that can be used consistently across sessions
 *
 * @example
 * ```typescript
 * const comment = { id: 123, publishedDate: '2023-10-01T10:00:00Z', content: 'Review comment' };
 * const id = generateStableAdoId(comment, 456);
 * // Returns: "ado-123-1696161600000" or "ado-456-{hash}" for fallback
 * ```
 */
export function generateStableAdoId(comment: any, threadId: number): string {
  // Use ADO comment ID if available, otherwise use thread ID + timestamp hash
  if (comment?.id) {
    // For unique identification within threads, include timestamp when available
    if (comment.publishedDate) {
      const timestamp = new Date(comment.publishedDate).getTime();
      return `ado-${comment.id}-${timestamp}`;
    }
    return `ado-${comment.id}`;
  }

  // Fallback: create hash from thread ID, timestamp, and content
  const hashInput = `${threadId}-${comment?.publishedDate || new Date().toISOString()}-${comment?.content?.substring(0, 50) || ''}`;
  const simpleHash = hashInput.split('').reduce((hash, char) => {
    return ((hash << 5) - hash + char.charCodeAt(0)) & 0xffffffff;
  }, 0);

  return `ado-${threadId}-${Math.abs(simpleHash)}`;
}

/**
 * Extract severity level from Azure DevOps comment content
 * Analyzes comment content for severity indicators and keywords
 *
 * @param content - The comment content to analyze
 * @returns The extracted severity level ('low', 'medium', or 'high')
 *
 * @example
 * ```typescript
 * const severity1 = extractSeverityFromContent('This is a critical security issue');
 * // Returns: 'high'
 *
 * const severity2 = extractSeverityFromContent('Minor warning about code style');
 * // Returns: 'medium'
 *
 * const severity3 = extractSeverityFromContent('<span>Severity</span><span>high</span>');
 * // Returns: 'high'
 * ```
 */
export function extractSeverityFromContent(content: string): CommentSeverity {
  const lowerContent = content.toLowerCase();

  // Check for explicit severity markup (HTML format)
  if (lowerContent.includes('severity</span><span') && lowerContent.includes('high')) {
    return 'high';
  } else if (lowerContent.includes('severity</span><span') && lowerContent.includes('medium')) {
    return 'medium';
  } else if (lowerContent.includes('severity</span><span') && lowerContent.includes('low')) {
    return 'low';
  }

  // Default severity based on content keywords
  if (lowerContent.includes('error') || lowerContent.includes('critical') || lowerContent.includes('security')) {
    return 'high';
  } else if (lowerContent.includes('warning') || lowerContent.includes('issue')) {
    return 'medium';
  }

  return 'medium'; // Default
}

/**
 * Clean HTML content and extract meaningful text from ADO comments
 * Removes HTML tags, styling, system messages, and formats the content for display
 *
 * @param content - The raw comment content (may contain HTML)
 * @returns Cleaned and formatted comment text
 *
 * @example
 * ```typescript
 * const raw = '<p>This is a <strong>comment</strong></p><small>AI-generated content</small>';
 * const cleaned = cleanCommentContent(raw);
 * // Returns: 'This is a comment'
 *
 * const withCode = 'Review comment\n```typescript\nconst x = 1;\n```\nFooter text';
 * const cleaned2 = cleanCommentContent(withCode);
 * // Returns: 'Review comment\n```typescript\nconst x = 1;\n```'
 * ```
 */
export function cleanCommentContent(content: string): string {
  // Remove HTML tags and excessive styling
  let cleaned = content
    .replace(/<small[^>]*>.*?<\/small>/gi, '') // Remove small tags with styling
    .replace(/<table[^>]*>.*?<\/table>/gi, '') // Remove feedback tables
    .replace(/<p[^>]*><small[^>]*>.*?<\/small><\/p>/gi, '') // Remove disclaimer paragraphs
    .replace(/<[^>]*>/g, '') // Remove all remaining HTML tags
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\n\s*\n/g, '\n') // Remove excessive blank lines
    .trim();

  // Extract main content before code suggestions
  const lines = cleaned.split('\n');
  const mainContent = [];
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      mainContent.push(line);
    } else if (inCodeBlock || line.trim().length === 0) {
      mainContent.push(line);
    } else if (line.includes('Here is the suggested code:') ||
               line.includes('AI-generated content may be incorrect') ||
               line.includes('Rate this:') ||
               line.includes('Learn more about')) {
      break; // Stop at suggestion or footer content
    } else {
      mainContent.push(line);
    }
  }

  return mainContent.join('\n').trim();
}

/**
 * Utility interface for ADO comment data
 */
export interface ADOComment {
  id?: number;
  threadId?: number;
  content?: string;
  publishedDate?: string;
  lastUpdatedDate?: string;
  author?: {
    displayName?: string;
  };
}

/**
 * Utility interface for processed comment data
 */
export interface ProcessedComment {
  id: string;
  severity: CommentSeverity;
  cleanContent: string;
  threadId?: number;
  adoCommentId?: number;
  publishedDate?: string;
  author?: string;
}

/**
 * Process a raw ADO comment into a standardized format
 * Combines all utility functions to create a clean, processed comment object
 *
 * @param comment - Raw ADO comment data
 * @param threadId - The thread ID this comment belongs to
 * @returns Processed comment with stable ID, extracted severity, and cleaned content
 *
 * @example
 * ```typescript
 * const rawComment = {
 *   id: 123,
 *   content: '<p>This is a <strong>critical issue</strong></p>',
 *   publishedDate: '2023-10-01T10:00:00Z',
 *   author: { displayName: 'John Doe' }
 * };
 *
 * const processed = processADOComment(rawComment, 456);
 * // Returns: {
 * //   id: 'ado-123-1696161600000',
 * //   severity: 'high',
 * //   cleanContent: 'This is a critical issue',
 * //   threadId: 456,
 * //   adoCommentId: 123,
 * //   publishedDate: '2023-10-01T10:00:00Z',
 * //   author: 'John Doe'
 * // }
 * ```
 */
export function processADOComment(comment: ADOComment, threadId: number): ProcessedComment {
  return {
    id: generateStableAdoId(comment, threadId),
    severity: extractSeverityFromContent(comment.content || ''),
    cleanContent: cleanCommentContent(comment.content || ''),
    threadId,
    adoCommentId: comment.id,
    publishedDate: comment.publishedDate,
    author: comment.author?.displayName
  };
}