/**
 * Code Review TypeScript interfaces matching the server schema
 */

import { Comment, DiffFile, ReviewInsight, Hunk } from '../services/CodeReviewService'

export interface CommentResponse {
  id: string
  author: { type: 'ai' | 'user'; name: string }
  content: string
  createdAt: string
  sessionId?: string
}

export interface SavedComment extends Omit<Comment, 'id'> {
  id: string
  threadId: string
  parentId?: string
  sessionId?: string
  status: 'open' | 'pending' | 'resolved' | 'dismissed'
  createdAt: string
  updatedAt: string
  author: { type: 'ai' | 'user'; name: string }
  responses: CommentResponse[]
}

export interface SavedCodeReview {
  id: string
  metadata: {
    title: string
    createdAt: string
    updatedAt: string
    status: 'draft' | 'active' | 'completed' | 'archived'
    version: number
  }
  source: {
    type: 'branches' | 'commit' | 'diff' | 'staged'
    sourceBranch?: string
    targetBranch?: string
    commitHash?: string
    customDiff?: string
    diffContent: string
    diffFiles: DiffFile[]
  }
  analysis: {
    insights: ReviewInsight[]
    hunks: Hunk[]
    aiSessionId?: string
  }
  comments: SavedComment[]
}

export interface ReviewMetadata {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  status: 'draft' | 'active' | 'completed' | 'archived'
  version: number
  filename: string
  type: 'branches' | 'commit' | 'diff' | 'staged'
  commentsCount: number
  hunksCount: number
  description?: string
}

export interface ThreadContext {
  commentId?: string
  hunkId?: string
  file: string
  lines: { start: number; end: number }
  originalMessage: string
  codeSnippet?: string
  contextType: 'comment' | 'hunk'
}

export interface CommentThreadInfo {
  threadId: string
  sessionId?: string
  context: ThreadContext
  responses: CommentResponse[]
  isActive: boolean
}

export interface SavedHunk extends Hunk {
  id: string
  threadId?: string
  sessionId?: string
  status?: 'open' | 'resolved' | 'dismissed'
  responses?: CommentResponse[]
}

export interface HunkThreadInfo {
  threadId: string
  sessionId?: string
  context: ThreadContext
  responses: CommentResponse[]
  isActive: boolean
}

export type ThreadInfo = CommentThreadInfo | HunkThreadInfo

export interface InlineThreadState {
  threadId: string
  contextType: 'comment' | 'hunk'
  isExpanded: boolean
  isReplying: boolean
}