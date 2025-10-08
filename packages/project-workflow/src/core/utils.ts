/**
 * Utility functions for the Project Workflow system
 */

import { SourceType } from '../types/index.js'

/**
 * Estimate token count for text content
 * Based on the approximation used in the original script: ~4 characters per token
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Detect source type from identifier format
 */
export function detectSourceType(identifier: string): SourceType | null {
  // ADO PR URL pattern (both dev.azure.com and visualstudio.com)
  if ((identifier.includes('visualstudio.com') || identifier.includes('dev.azure.com')) && identifier.includes('pullrequest')) {
    return SourceType.ADO_PR
  }

  // GitHub PR URL pattern
  if (identifier.includes('github.com') && identifier.includes('/pull/')) {
    return SourceType.GITHUB_PR
  }

  // Git commit hash pattern (7-40 hex characters or HEAD references)
  if (/^[a-f0-9]{7,40}$/i.test(identifier) || identifier.startsWith('HEAD')) {
    return SourceType.GIT
  }

  // Git repository URL pattern (but not PR)
  if (identifier.includes('github.com') && identifier.endsWith('.git')) {
    return SourceType.GIT
  }

  // Local file path pattern
  if (identifier.startsWith('/') || identifier.startsWith('./') || identifier.startsWith('../')) {
    return SourceType.LOCAL
  }

  return null
}

/**
 * Parse ADO PR URL to extract components
 */
export function parseADOUrl(url: string): {
  organization: string
  project: string
  repository: string
  pullRequestId: string
} | null {
  // Parse ADO PR URL patterns:
  // https://dev.azure.com/MicrosoftIT/OneITVSO/_git/supercode/pullrequest/2084
  // https://skype.visualstudio.com/SCC/_git/sync_calling_concore-teamsscheduler/pullrequest/1279282

  // dev.azure.com pattern
  let azureRegex = /https:\/\/dev\.azure\.com\/([^\/]+)\/([^\/]+)\/_git\/([^\/]+)\/pullrequest\/(\d+)/
  let match = url.match(azureRegex)

  if (match) {
    return {
      organization: match[1],
      project: match[2],
      repository: match[3],
      pullRequestId: match[4]
    }
  }

  // visualstudio.com pattern - handle different formats
  const vstudioRegex = /https:\/\/(.+)\.visualstudio\.com\/([^\/]+)\/_git\/([^\/]+)\/pullrequest\/(\d+)/
  match = url.match(vstudioRegex)

  if (match) {
    return {
      organization: match[1],
      project: match[2],
      repository: match[3],
      pullRequestId: match[4]
    }
  }

  // Handle DefaultCollection pattern: https://microsoft.visualstudio.com/DefaultCollection/Project/_git/repo/pullrequest/456
  const defaultCollectionRegex = /https:\/\/(.+)\.visualstudio\.com\/DefaultCollection\/([^\/]+)\/_git\/([^\/]+)\/pullrequest\/(\d+)/
  match = url.match(defaultCollectionRegex)

  if (match) {
    return {
      organization: match[1],
      project: match[2],
      repository: match[3],
      pullRequestId: match[4]
    }
  }

  return null
}

/**
 * Check if identifier is an ADO PR URL
 */
export function isADOUrl(input: string): boolean {
  return (input.includes('visualstudio.com') || input.includes('dev.azure.com')) && input.includes('pullrequest')
}

/**
 * Check if identifier is a GitHub PR URL
 */
export function isGitHubUrl(input: string): boolean {
  return input.includes('github.com') && input.includes('/pull/')
}

/**
 * Check if identifier is a Git commit hash
 */
export function isGitCommit(identifier: string): boolean {
  return /^[a-f0-9]{7,40}$/i.test(identifier) || identifier.startsWith('HEAD')
}

/**
 * Sanitize file name for safe file system usage
 */
export function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
}

/**
 * Generate unique ID for comments and other entities
 */
export function generateId(prefix: string = '', timestamp: boolean = true): string {
  const randomPart = Math.random().toString(36).substring(2, 15)
  const timePart = timestamp ? Date.now().toString(36) : ''
  return prefix ? `${prefix}-${timePart}-${randomPart}` : `${timePart}-${randomPart}`
}

/**
 * Create a stable hash from a string (simple implementation)
 */
export function createHash(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36)
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  // Handle negative values
  if (bytes < 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`
  }

  const totalSeconds = milliseconds / 1000
  const minutes = Math.floor(totalSeconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${Math.floor(totalSeconds % 60)}s`
  } else if (minutes > 0) {
    return `${minutes}m ${Math.floor(totalSeconds % 60)}s`
  } else {
    // Show fractional seconds for durations less than a minute
    if (totalSeconds % 1 !== 0) {
      return `${totalSeconds}s`
    } else {
      return `${Math.floor(totalSeconds)}s`
    }
  }
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    attempts?: number
    delay?: number
    backoff?: number
    shouldRetry?: (error: Error) => boolean
  } = {}
): Promise<T> {
  const {
    attempts = 3,
    delay = 1000,
    backoff = 2,
    shouldRetry = () => true
  } = options

  let lastError: Error
  let currentDelay = delay

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      if (attempt === attempts || !shouldRetry(lastError)) {
        throw lastError
      }

      await sleep(currentDelay)
      currentDelay *= backoff
    }
  }

  throw lastError!
}

/**
 * Create a logger with consistent formatting
 */
export function createLogger(prefix: string = '') {
  const log = (level: string, message: string, ...args: any[]) => {
    const timestamp = new Date().toISOString()
    const logPrefix = prefix ? `[${prefix}]` : ''
    console.log(`[${timestamp}] [${level}] ${logPrefix} ${message}`, ...args)
  }

  return {
    debug: (message: string, ...args: any[]) => {}, //log('DEBUG', message, ...args),
    info: (message: string, ...args: any[]) => log('INFO', message, ...args),
    warn: (message: string, ...args: any[]) => log('WARN', message, ...args),
    error: (message: string, ...args: any[]) => log('ERROR', message, ...args)
  }
}

// ========== Error Classes ==========

/**
 * Base error class for workflow operations
 */
export class WorkflowError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message)
    this.name = this.constructor.name
  }
}

/**
 * Validation error for invalid input or configuration
 */
export class ValidationError extends WorkflowError {
  constructor(message: string, code?: string) {
    super(message, code || 'VALIDATION_ERROR')
  }
}

/**
 * Processing error during workflow execution
 */
export class ProcessingError extends WorkflowError {
  constructor(message: string, code?: string) {
    super(message, code || 'PROCESSING_ERROR')
  }
}

/**
 * Content source error for content fetching issues
 */
export class ContentSourceError extends WorkflowError {
  constructor(message: string, code?: string) {
    super(message, code || 'CONTENT_SOURCE_ERROR')
  }
}

/**
 * Sharding error for content sharding issues
 */
export class ShardingError extends WorkflowError {
  constructor(message: string, code?: string) {
    super(message, code || 'SHARDING_ERROR')
  }
}

/**
 * Aggregation error for result aggregation issues
 */
export class AggregationError extends WorkflowError {
  constructor(message: string, code?: string) {
    super(message, code || 'AGGREGATION_ERROR')
  }
}