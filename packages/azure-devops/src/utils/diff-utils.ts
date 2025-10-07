/**
 * Diff generation utilities for Azure DevOps integration
 *
 * This module provides utilities for generating unified diff format compatible
 * with git diff output, specifically designed for Azure DevOps pull request
 * file comparisons.
 */

/**
 * Represents a diff hunk with line range information and diff lines
 */
export interface DiffHunk {
  /** Starting line number in the old file */
  oldStart: number;
  /** Number of lines in the old file for this hunk */
  oldLength: number;
  /** Starting line number in the new file */
  newStart: number;
  /** Number of lines in the new file for this hunk */
  newLength: number;
  /** Array of diff lines with prefixes (+, -, or space) */
  lines: string[];
}

/**
 * Configuration options for diff generation
 */
export interface DiffOptions {
  /** Number of context lines to include around changes (default: 3) */
  contextLines?: number;
  /** Whether to include file headers in the diff output (default: true) */
  includeHeaders?: boolean;
  /** Custom file path to use in headers (overrides detected path) */
  customPath?: string;
}

/**
 * Generates a unified diff format string comparing old and new content
 *
 * This function creates a git-compatible unified diff format that can be used
 * for displaying file changes in Azure DevOps pull requests or other diff viewers.
 *
 * @param oldContent - The original file content (null for new files)
 * @param newContent - The modified file content (null for deleted files)
 * @param filePath - The file path to display in diff headers
 * @param options - Optional configuration for diff generation
 * @returns A unified diff format string
 *
 * @example
 * ```typescript
 * const oldCode = "console.log('hello');\n";
 * const newCode = "console.log('hello world');\n";
 * const diff = generateUnifiedDiff(oldCode, newCode, "/src/app.js");
 * console.log(diff);
 * // Output:
 * // diff --git a/src/app.js b/src/app.js
 * // --- a/src/app.js
 * // +++ b/src/app.js
 * // @@ -1,1 +1,1 @@
 * // -console.log('hello');
 * // +console.log('hello world');
 * ```
 */
export function generateUnifiedDiff(
  oldContent: string | null,
  newContent: string | null,
  filePath: string,
  options: DiffOptions = {}
): string {
  const {
    contextLines = 3,
    includeHeaders = true,
    customPath = filePath
  } = options;

  const oldLines = oldContent ? oldContent.split('\n') : [];
  const newLines = newContent ? newContent.split('\n') : [];

  let diff = '';

  if (includeHeaders) {
    diff += `diff --git a${customPath} b${customPath}\n`;
  }

  if (!oldContent && !newContent) {
    // Both contents are null - can't generate diff, return placeholder
    if (includeHeaders) {
      diff += `--- a${customPath}\n+++ b${customPath}\n`;
    }
    diff += `@@ File unavailable @@\n`;
  } else if (!oldContent && newContent) {
    // New file - show all content
    if (includeHeaders) {
      diff += `new file mode 100644\n`;
      diff += `--- /dev/null\n+++ b${customPath}\n`;
    }
    diff += `@@ -0,0 +1,${newLines.length} @@\n`;
    for (const line of newLines) {
      diff += `+${line}\n`;
    }
  } else if (oldContent && !newContent) {
    // Deleted file - show all removed content
    if (includeHeaders) {
      diff += `deleted file mode 100644\n`;
      diff += `--- a${customPath}\n+++ /dev/null\n`;
    }
    diff += `@@ -1,${oldLines.length} +0,0 @@\n`;
    for (const line of oldLines) {
      diff += `-${line}\n`;
    }
  } else if (oldContent && newContent) {
    // Modified file - generate proper unified diff
    if (includeHeaders) {
      diff += `--- a${customPath}\n+++ b${customPath}\n`;
    }

    // Generate diff hunks with configurable context lines
    const hunks = generateDiffHunks(oldLines, newLines, contextLines);

    for (const hunk of hunks) {
      diff += `@@ -${hunk.oldStart},${hunk.oldLength} +${hunk.newStart},${hunk.newLength} @@\n`;
      for (const line of hunk.lines) {
        diff += `${line}\n`;
      }
    }
  }

  return diff;
}

/**
 * Generates diff hunks for modified files with configurable context
 *
 * This function performs a line-by-line comparison and groups changes into
 * logical hunks with surrounding context lines for better readability.
 *
 * @param oldLines - Array of lines from the original file
 * @param newLines - Array of lines from the modified file
 * @param contextLines - Number of context lines to include around changes
 * @returns Array of diff hunks containing the changes
 *
 * @example
 * ```typescript
 * const oldLines = ["line1", "line2", "line3"];
 * const newLines = ["line1", "modified line2", "line3"];
 * const hunks = generateDiffHunks(oldLines, newLines, 1);
 * // Returns hunks with 1 line of context around the change
 * ```
 */
export function generateDiffHunks(
  oldLines: string[],
  newLines: string[],
  contextLines: number = 3
): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  const maxLines = Math.max(oldLines.length, newLines.length);

  let currentHunk: DiffHunk | null = null;
  let oldLineNum = 1;
  let newLineNum = 1;

  // Simple line-by-line comparison
  for (let i = 0; i < maxLines; i++) {
    const oldLine = i < oldLines.length ? oldLines[i] : undefined;
    const newLine = i < newLines.length ? newLines[i] : undefined;

    const isDifferent = oldLine !== newLine;

    if (isDifferent) {
      // Start new hunk if needed
      if (!currentHunk) {
        const contextStart = Math.max(0, i - contextLines);
        currentHunk = {
          oldStart: contextStart + 1,
          newStart: contextStart + 1,
          oldLength: 0,
          newLength: 0,
          lines: []
        };

        // Add context lines before diff
        for (let ctx = contextStart; ctx < i; ctx++) {
          if (ctx < oldLines.length && ctx < newLines.length) {
            currentHunk.lines.push(` ${oldLines[ctx]}`);
            currentHunk.oldLength++;
            currentHunk.newLength++;
          }
        }
      }

      // Add changed lines
      if (oldLine !== undefined && newLine !== undefined) {
        // Line changed
        currentHunk.lines.push(`-${oldLine}`);
        currentHunk.lines.push(`+${newLine}`);
        currentHunk.oldLength++;
        currentHunk.newLength++;
      } else if (oldLine !== undefined) {
        // Line deleted
        currentHunk.lines.push(`-${oldLine}`);
        currentHunk.oldLength++;
      } else if (newLine !== undefined) {
        // Line added
        currentHunk.lines.push(`+${newLine}`);
        currentHunk.newLength++;
      }
    } else if (currentHunk && oldLine !== undefined) {
      // Add context line to current hunk
      currentHunk.lines.push(` ${oldLine}`);
      currentHunk.oldLength++;
      currentHunk.newLength++;

      // Check if we should close this hunk (after specified context lines)
      const recentContextLines = currentHunk.lines.slice(-contextLines).filter(l => l.startsWith(' ')).length;
      if (recentContextLines >= contextLines && i < maxLines - 1) {
        hunks.push(currentHunk);
        currentHunk = null;
      }
    }

    if (oldLine !== undefined) oldLineNum++;
    if (newLine !== undefined) newLineNum++;
  }

  // Add final hunk if exists
  if (currentHunk) {
    hunks.push(currentHunk);
  }

  // If no hunks but files are different, create a single hunk
  if (hunks.length === 0 && oldLines.length !== newLines.length) {
    hunks.push({
      oldStart: 1,
      oldLength: oldLines.length,
      newStart: 1,
      newLength: newLines.length,
      lines: [
        ...oldLines.map(line => `-${line}`),
        ...newLines.map(line => `+${line}`)
      ]
    });
  }

  return hunks;
}

/**
 * Escapes special regular expression characters in a string
 *
 * This utility function is used when working with file paths or content
 * that needs to be used in regular expressions for string replacement.
 *
 * @param string - The string to escape
 * @returns The escaped string safe for use in regular expressions
 *
 * @example
 * ```typescript
 * const escaped = escapeRegExp("file[1].js");
 * // Returns: "file\\[1\\]\\.js"
 * ```
 */
export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Calculates basic diff statistics for a given diff string
 *
 * @param diffContent - The unified diff content to analyze
 * @returns Statistics about the diff including additions, deletions, and total changes
 *
 * @example
 * ```typescript
 * const stats = calculateDiffStats(diffString);
 * console.log(`+${stats.additions} -${stats.deletions}`);
 * ```
 */
export function calculateDiffStats(diffContent: string): {
  additions: number;
  deletions: number;
  changes: number;
} {
  const lines = diffContent.split('\n');
  let additions = 0;
  let deletions = 0;

  for (const line of lines) {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      additions++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      deletions++;
    }
  }

  return {
    additions,
    deletions,
    changes: additions + deletions
  };
}

/**
 * Normalizes file paths for consistent diff header formatting
 *
 * Ensures file paths are properly formatted for git-style diff headers,
 * handling leading slashes and path separators consistently.
 *
 * @param filePath - The file path to normalize
 * @returns The normalized file path
 *
 * @example
 * ```typescript
 * const normalized = normalizeFilePath("\\src\\app.js");
 * // Returns: "/src/app.js"
 * ```
 */
export function normalizeFilePath(filePath: string): string {
  // Convert backslashes to forward slashes
  let normalized = filePath.replace(/\\/g, '/');

  // Ensure leading slash
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }

  return normalized;
}

/**
 * Validates whether content represents a binary file
 *
 * Performs basic heuristic checks to determine if content is likely binary
 * and should not be processed as text for diff generation.
 *
 * @param content - The file content to check
 * @returns True if content appears to be binary
 *
 * @example
 * ```typescript
 * if (isBinaryContent(fileContent)) {
 *   console.log("Binary file detected, skipping text diff");
 * }
 * ```
 */
export function isBinaryContent(content: string | null): boolean {
  if (!content) return false;

  // Check for null bytes (common in binary files)
  if (content.includes('\0')) return true;

  // Check for very high ratio of non-printable characters
  const nonPrintableCount = (content.match(/[\x00-\x08\x0E-\x1F\x7F-\xFF]/g) || []).length;
  const ratio = nonPrintableCount / content.length;

  return ratio > 0.3; // If more than 30% non-printable, likely binary
}

/**
 * Splits content into lines while preserving line ending information
 *
 * This function is useful when you need to maintain information about
 * original line endings when processing diff content.
 *
 * @param content - The content to split into lines
 * @returns Object containing lines array and detected line ending type
 *
 * @example
 * ```typescript
 * const result = splitLinesWithEndings("line1\r\nline2\n");
 * // Returns: { lines: ["line1", "line2"], lineEnding: "mixed" }
 * ```
 */
export function splitLinesWithEndings(content: string): {
  lines: string[];
  lineEnding: 'lf' | 'crlf' | 'mixed' | 'none';
} {
  const lines = content.split(/\r?\n/);

  // Detect line ending type
  const hasCRLF = content.includes('\r\n');
  const hasLF = content.includes('\n') && !content.replace(/\r\n/g, '').includes('\n');

  let lineEnding: 'lf' | 'crlf' | 'mixed' | 'none';
  if (hasCRLF && hasLF) {
    lineEnding = 'mixed';
  } else if (hasCRLF) {
    lineEnding = 'crlf';
  } else if (content.includes('\n')) {
    lineEnding = 'lf';
  } else {
    lineEnding = 'none';
  }

  return { lines, lineEnding };
}

/**
 * Generates a compact diff summary for quick overview
 *
 * Creates a brief summary of changes without the full diff content,
 * useful for displaying change summaries in UI components.
 *
 * @param oldContent - The original file content
 * @param newContent - The modified file content
 * @param filePath - The file path
 * @returns A compact summary of the changes
 *
 * @example
 * ```typescript
 * const summary = generateDiffSummary(oldCode, newCode, "/src/app.js");
 * // Returns: { type: "modified", filePath: "/src/app.js", stats: {...} }
 * ```
 */
export function generateDiffSummary(
  oldContent: string | null,
  newContent: string | null,
  filePath: string
): {
  type: 'added' | 'deleted' | 'modified' | 'unchanged';
  filePath: string;
  stats: {
    additions: number;
    deletions: number;
    changes: number;
  };
} {
  let type: 'added' | 'deleted' | 'modified' | 'unchanged';

  if (!oldContent && newContent) {
    type = 'added';
  } else if (oldContent && !newContent) {
    type = 'deleted';
  } else if (oldContent === newContent) {
    type = 'unchanged';
  } else {
    type = 'modified';
  }

  // Calculate stats only for modified files
  let stats = { additions: 0, deletions: 0, changes: 0 };
  if (type === 'modified' && oldContent && newContent) {
    const diff = generateUnifiedDiff(oldContent, newContent, filePath, { includeHeaders: false });
    stats = calculateDiffStats(diff);
  } else if (type === 'added' && newContent) {
    const lines = newContent.split('\n');
    stats = { additions: lines.length, deletions: 0, changes: lines.length };
  } else if (type === 'deleted' && oldContent) {
    const lines = oldContent.split('\n');
    stats = { additions: 0, deletions: lines.length, changes: lines.length };
  }

  return {
    type,
    filePath: normalizeFilePath(filePath),
    stats
  };
}