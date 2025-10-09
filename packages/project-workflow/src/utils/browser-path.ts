/**
 * Browser-compatible path utilities module
 * Provides the same functionality as Node.js's path module for web environments
 */

/**
 * Join path segments with forward slashes
 * @param segments - Path segments to join
 * @returns Joined path with normalized separators
 */
export function join(...segments: string[]): string {
  if (segments.length === 0) {
    return '.';
  }

  // Filter out empty segments and normalize separators
  const filteredSegments = segments
    .filter(segment => segment && segment.length > 0)
    .map(segment => segment.replace(/\\/g, '/'));

  if (filteredSegments.length === 0) {
    return '.';
  }

  let joined = filteredSegments.join('/');

  // Normalize multiple slashes to single slash
  joined = joined.replace(/\/+/g, '/');

  // Handle relative path normalization
  return normalize(joined);
}

/**
 * Get directory name from path
 * @param path - Input path
 * @returns Directory portion of the path
 */
export function dirname(path: string): string {
  if (!path || typeof path !== 'string') {
    return '.';
  }

  // Normalize separators to forward slashes
  const normalizedPath = path.replace(/\\/g, '/');

  // Remove trailing slashes except for root
  const trimmed = normalizedPath.replace(/\/+$/, '') || '/';

  // Find last slash
  const lastSlashIndex = trimmed.lastIndexOf('/');

  if (lastSlashIndex === -1) {
    // No slash found, return current directory
    return '.';
  }

  if (lastSlashIndex === 0) {
    // Root directory
    return '/';
  }

  // Return everything before the last slash
  return trimmed.substring(0, lastSlashIndex);
}

/**
 * Get relative path from one path to another
 * @param from - Source path
 * @param to - Target path
 * @returns Relative path from 'from' to 'to'
 */
export function relative(from: string, to: string): string {
  if (!from || !to || typeof from !== 'string' || typeof to !== 'string') {
    throw new Error('Both from and to paths must be non-empty strings');
  }

  // Normalize both paths
  const normalizedFrom = normalize(from.replace(/\\/g, '/'));
  const normalizedTo = normalize(to.replace(/\\/g, '/'));

  if (normalizedFrom === normalizedTo) {
    return '';
  }

  // Split paths into segments
  const fromSegments = normalizedFrom.split('/').filter(seg => seg.length > 0);
  const toSegments = normalizedTo.split('/').filter(seg => seg.length > 0);

  // Handle absolute vs relative paths
  const fromIsAbsolute = normalizedFrom.startsWith('/');
  const toIsAbsolute = normalizedTo.startsWith('/');

  if (fromIsAbsolute !== toIsAbsolute) {
    // Can't create relative path between absolute and relative paths
    return normalizedTo;
  }

  // Find common prefix
  let commonLength = 0;
  const minLength = Math.min(fromSegments.length, toSegments.length);

  for (let i = 0; i < minLength; i++) {
    if (fromSegments[i] === toSegments[i]) {
      commonLength++;
    } else {
      break;
    }
  }

  // Calculate steps up from 'from' directory
  const stepsUp = fromSegments.length - commonLength;
  const stepsUpArray = new Array(stepsUp).fill('..');

  // Get remaining segments from 'to' path
  const remainingToSegments = toSegments.slice(commonLength);

  // Combine steps up and remaining segments
  const relativeSegments = [...stepsUpArray, ...remainingToSegments];

  if (relativeSegments.length === 0) {
    return '.';
  }

  return relativeSegments.join('/');
}

/**
 * Check if path is absolute
 * @param path - Path to check
 * @returns True if path is absolute, false otherwise
 */
export function isAbsolute(path: string): boolean {
  if (!path || typeof path !== 'string') {
    return false;
  }

  // Unix/Linux absolute path (starts with /)
  if (path.startsWith('/')) {
    return true;
  }

  // Windows absolute path (starts with drive letter like C:\ or C:/)
  if (/^[a-zA-Z]:[\\\/]/.test(path)) {
    return true;
  }

  // UNC path (starts with \\ or //)
  if (path.startsWith('\\\\') || path.startsWith('//')) {
    return true;
  }

  return false;
}

/**
 * Normalize a path by resolving '..' and '.' segments
 * @param path - Path to normalize
 * @returns Normalized path
 */
function normalize(path: string): string {
  if (!path || typeof path !== 'string') {
    return '.';
  }

  // Handle empty path
  if (path.length === 0) {
    return '.';
  }

  const isAbsolutePath = path.startsWith('/');
  const endsWithSlash = path.endsWith('/');

  // Split into segments and filter out empty ones
  const segments = path.split('/').filter(segment => segment.length > 0);
  const normalizedSegments: string[] = [];

  for (const segment of segments) {
    if (segment === '..') {
      // Go up one directory
      if (normalizedSegments.length > 0 && normalizedSegments[normalizedSegments.length - 1] !== '..') {
        normalizedSegments.pop();
      } else if (!isAbsolutePath) {
        // Only add '..' for relative paths
        normalizedSegments.push('..');
      }
    } else if (segment !== '.') {
      // Skip '.' (current directory) segments
      normalizedSegments.push(segment);
    }
  }

  // Reconstruct the path
  let result = normalizedSegments.join('/');

  if (isAbsolutePath) {
    result = '/' + result;
  }

  if (result.length === 0) {
    result = '.';
  }

  // Restore trailing slash if original had one and result is not root
  if (endsWithSlash && result !== '/' && result !== '.') {
    result += '/';
  }

  return result;
}

/**
 * Get the base name (file name) from a path
 * @param path - Input path
 * @param ext - Optional extension to remove
 * @returns Base name of the path
 */
export function basename(path: string, ext?: string): string {
  if (!path || typeof path !== 'string') {
    return '';
  }

  // Normalize separators to forward slashes
  const normalizedPath = path.replace(/\\/g, '/');

  // Remove trailing slashes
  const trimmed = normalizedPath.replace(/\/+$/, '');

  if (trimmed.length === 0) {
    return '';
  }

  // Find last slash
  const lastSlashIndex = trimmed.lastIndexOf('/');
  const baseName = lastSlashIndex === -1 ? trimmed : trimmed.substring(lastSlashIndex + 1);

  // Remove extension if provided
  if (ext && baseName.endsWith(ext)) {
    return baseName.substring(0, baseName.length - ext.length);
  }

  return baseName;
}

/**
 * Get the extension of a path
 * @param path - Input path
 * @returns File extension including the dot, or empty string if no extension
 */
export function extname(path: string): string {
  if (!path || typeof path !== 'string') {
    return '';
  }

  const base = basename(path);
  const lastDotIndex = base.lastIndexOf('.');

  if (lastDotIndex === -1 || lastDotIndex === 0) {
    return '';
  }

  return base.substring(lastDotIndex);
}

/**
 * Resolve path segments into an absolute path
 * @param segments - Path segments to resolve
 * @returns Resolved absolute path
 */
export function resolve(...segments: string[]): string {
  let resolvedPath = '';
  let resolvedAbsolute = false;

  // Process segments from right to left
  for (let i = segments.length - 1; i >= 0 && !resolvedAbsolute; i--) {
    const segment = segments[i];

    if (!segment || typeof segment !== 'string') {
      continue;
    }

    const normalizedSegment = segment.replace(/\\/g, '/');

    if (isAbsolute(normalizedSegment)) {
      resolvedPath = normalizedSegment;
      resolvedAbsolute = true;
    } else {
      resolvedPath = normalizedSegment + (resolvedPath ? '/' + resolvedPath : '');
    }
  }

  // If we don't have an absolute path, make it relative to current directory
  if (!resolvedAbsolute) {
    resolvedPath = './' + resolvedPath;
  }

  return normalize(resolvedPath);
}

// Default export with all functions
export default {
  join,
  dirname,
  relative,
  isAbsolute,
  basename,
  extname,
  resolve,
  normalize
};