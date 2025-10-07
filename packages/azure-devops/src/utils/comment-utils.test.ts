/**
 * Test suite for ADO comment utility functions
 */

import {
  generateStableAdoId,
  extractSeverityFromContent,
  cleanCommentContent,
  processADOComment,
  type CommentSeverity,
  type ADOComment
} from './comment-utils';

describe('generateStableAdoId', () => {
  it('should generate ID with comment ID and timestamp when both are available', () => {
    const comment = {
      id: 123,
      publishedDate: '2023-10-01T10:00:00Z',
      content: 'Test comment'
    };

    const result = generateStableAdoId(comment, 456);
    const expectedTimestamp = new Date('2023-10-01T10:00:00Z').getTime();
    expect(result).toBe(`ado-123-${expectedTimestamp}`);
  });

  it('should generate ID with comment ID only when timestamp is not available', () => {
    const comment = {
      id: 123,
      content: 'Test comment'
    };

    const result = generateStableAdoId(comment, 456);
    expect(result).toBe('ado-123');
  });

  it('should generate hash-based ID when comment ID is not available', () => {
    const comment = {
      publishedDate: '2023-10-01T10:00:00Z',
      content: 'Test comment for hashing'
    };

    const result = generateStableAdoId(comment, 456);
    expect(result).toMatch(/^ado-456-\d+$/);
  });

  it('should generate consistent hash-based IDs for same input', () => {
    const comment = {
      publishedDate: '2023-10-01T10:00:00Z',
      content: 'Test comment'
    };

    const result1 = generateStableAdoId(comment, 456);
    const result2 = generateStableAdoId(comment, 456);
    expect(result1).toBe(result2);
  });

  it('should handle empty comment object', () => {
    const comment = {};

    const result = generateStableAdoId(comment, 456);
    expect(result).toMatch(/^ado-456-\d+$/);
  });
});

describe('extractSeverityFromContent', () => {
  it('should extract high severity from HTML markup', () => {
    const content = '<span>Severity</span><span>high</span>';
    const result = extractSeverityFromContent(content);
    expect(result).toBe('high');
  });

  it('should extract medium severity from HTML markup', () => {
    const content = '<span>Severity</span><span>medium</span>';
    const result = extractSeverityFromContent(content);
    expect(result).toBe('medium');
  });

  it('should extract low severity from HTML markup', () => {
    const content = '<span>Severity</span><span>low</span>';
    const result = extractSeverityFromContent(content);
    expect(result).toBe('low');
  });

  it('should detect high severity from keywords', () => {
    const testCases = [
      'This is a critical error in the code',
      'Security vulnerability detected',
      'Error: undefined variable'
    ];

    testCases.forEach(content => {
      const result = extractSeverityFromContent(content);
      expect(result).toBe('high');
    });
  });

  it('should detect medium severity from keywords', () => {
    const testCases = [
      'Warning: potential issue found',
      'There is an issue with this implementation'
    ];

    testCases.forEach(content => {
      const result = extractSeverityFromContent(content);
      expect(result).toBe('medium');
    });
  });

  it('should default to medium severity for generic content', () => {
    const content = 'This is a generic comment without specific severity indicators';
    const result = extractSeverityFromContent(content);
    expect(result).toBe('medium');
  });

  it('should be case insensitive', () => {
    const content = 'CRITICAL ERROR IN CODE';
    const result = extractSeverityFromContent(content);
    expect(result).toBe('high');
  });
});

describe('cleanCommentContent', () => {
  it('should remove HTML tags', () => {
    const content = '<p>This is a <strong>comment</strong> with <em>HTML</em></p>';
    const result = cleanCommentContent(content);
    expect(result).toBe('This is a comment with HTML');
  });

  it('should remove small tags and styling', () => {
    const content = '<p>Main content</p><small>Disclaimer text</small>';
    const result = cleanCommentContent(content);
    expect(result).toBe('Main content');
  });

  it('should remove feedback tables', () => {
    const content = 'Main comment<table><tr><td>Rate this</td></tr></table>';
    const result = cleanCommentContent(content);
    expect(result).toBe('Main comment');
  });

  it('should normalize line endings and remove excessive blank lines', () => {
    const content = 'Line 1\r\n\r\n\r\nLine 2\n\n\nLine 3';
    const result = cleanCommentContent(content);
    expect(result).toBe('Line 1\nLine 2\nLine 3');
  });

  it('should preserve code blocks', () => {
    const content = 'Review comment\n```typescript\nconst x = 1;\n```\nMore text';
    const result = cleanCommentContent(content);
    expect(result).toBe('Review comment\n```typescript\nconst x = 1;\n```\nMore text');
  });

  it('should stop at AI-generated content disclaimers', () => {
    const content = 'Main comment\nAI-generated content may be incorrect\nFooter text';
    const result = cleanCommentContent(content);
    expect(result).toBe('Main comment');
  });

  it('should stop at suggested code sections', () => {
    const content = 'Review feedback\nHere is the suggested code:\ncode block';
    const result = cleanCommentContent(content);
    expect(result).toBe('Review feedback');
  });

  it('should stop at rating sections', () => {
    const content = 'Comment text\nRate this:\nFooter';
    const result = cleanCommentContent(content);
    expect(result).toBe('Comment text');
  });

  it('should handle empty content', () => {
    const content = '';
    const result = cleanCommentContent(content);
    expect(result).toBe('');
  });

  it('should handle content with only HTML tags', () => {
    const content = '<p></p><small></small>';
    const result = cleanCommentContent(content);
    expect(result).toBe('');
  });
});

describe('processADOComment', () => {
  it('should process a complete ADO comment', () => {
    const comment: ADOComment = {
      id: 123,
      content: '<p>This is a <strong>critical security issue</strong></p>',
      publishedDate: '2023-10-01T10:00:00Z',
      author: { displayName: 'John Doe' }
    };

    const result = processADOComment(comment, 456);

    const expectedTimestamp = new Date('2023-10-01T10:00:00Z').getTime();
    expect(result).toEqual({
      id: `ado-123-${expectedTimestamp}`,
      severity: 'high',
      cleanContent: 'This is a critical security issue',
      threadId: 456,
      adoCommentId: 123,
      publishedDate: '2023-10-01T10:00:00Z',
      author: 'John Doe'
    });
  });

  it('should handle comment with missing optional fields', () => {
    const comment: ADOComment = {
      content: 'Simple comment'
    };

    const result = processADOComment(comment, 789);

    expect(result.id).toMatch(/^ado-789-\d+$/);
    expect(result.severity).toBe('medium');
    expect(result.cleanContent).toBe('Simple comment');
    expect(result.threadId).toBe(789);
    expect(result.adoCommentId).toBeUndefined();
    expect(result.publishedDate).toBeUndefined();
    expect(result.author).toBeUndefined();
  });

  it('should handle empty comment object', () => {
    const comment: ADOComment = {};

    const result = processADOComment(comment, 999);

    expect(result.id).toMatch(/^ado-999-\d+$/);
    expect(result.severity).toBe('medium');
    expect(result.cleanContent).toBe('');
    expect(result.threadId).toBe(999);
  });
});

describe('Type Safety', () => {
  it('should enforce CommentSeverity type', () => {
    const severities: CommentSeverity[] = ['low', 'medium', 'high'];

    severities.forEach(severity => {
      expect(['low', 'medium', 'high']).toContain(severity);
    });
  });

  it('should handle ADOComment interface correctly', () => {
    const comment: ADOComment = {
      id: 123,
      threadId: 456,
      content: 'Test content',
      publishedDate: '2023-10-01T10:00:00Z',
      lastUpdatedDate: '2023-10-01T11:00:00Z',
      author: {
        displayName: 'Test User'
      }
    };

    expect(comment.id).toBe(123);
    expect(comment.author?.displayName).toBe('Test User');
  });
});