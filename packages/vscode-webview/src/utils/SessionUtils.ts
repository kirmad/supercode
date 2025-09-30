/**
 * Session utility functions for managing AI sessions in comment threads
 */

import type { SessionConfig } from '../services/SessionManager'

/**
 * Create a session configuration for comment threading
 */
export function createCommentSessionConfig(
  commentId: string,
  projectId: string = 'vscode-webview',
  providerId: string = 'anthropic',
  modelId: string = 'claude-3-5-sonnet-latest'
): SessionConfig {
  return {
    directory: '.',
    projectID: `${projectId}-comment-${commentId}`,
    providerID: providerId,
    modelID: modelId
  }
}

/**
 * Validate session configuration
 */
export function validateSessionConfig(config: SessionConfig): boolean {
  return !!(
    config.projectID &&
    config.providerID &&
    config.modelID &&
    typeof config.projectID === 'string' &&
    typeof config.providerID === 'string' &&
    typeof config.modelID === 'string'
  )
}

/**
 * Extract session ID from various response formats
 */
export function extractSessionId(response: any): string | null {
  if (!response) return null

  // Check common session ID properties
  return response.id ||
         response.sessionId ||
         response.sessionID ||
         response.session_id ||
         null
}

/**
 * Check if a session ID is valid
 */
export function isValidSessionId(sessionId: string | null | undefined): boolean {
  return !!(sessionId && typeof sessionId === 'string' && sessionId.trim().length > 0)
}

/**
 * Generate a unique session identifier for comment threads
 */
export function generateCommentSessionId(commentId: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substr(2, 9)
  return `comment-session-${commentId}-${timestamp}-${random}`
}