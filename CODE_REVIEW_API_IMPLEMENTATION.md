# Code Review File I/O API Implementation

## Overview

Extended the OpenCode server with comprehensive file I/O capabilities for code review persistence. This implementation provides a complete REST API for managing code reviews with local JSON file storage.

## Files Created/Modified

### 1. `/packages/opencode/src/server/file-routes.ts` (NEW)
- Complete implementation of review file I/O API
- Follows existing OpenCode server patterns and conventions
- Uses Zod schemas for type validation
- Comprehensive error handling and logging

### 2. `/packages/opencode/src/server/server.ts` (MODIFIED)
- Added import for `createFileRoutes`
- Integrated file routes into main server app
- Follows existing route integration patterns

## API Endpoints Implemented

### 1. POST `/reviews/save`
- **Purpose**: Save a code review to local JSON file
- **Request Body**: Complete `SavedCodeReview` object
- **Response**: `{ success: boolean, id: string, filename: string }`
- **Features**:
  - Auto-generates timestamped filenames (`review-{id}-{timestamp}.json`)
  - Updates metadata timestamps
  - Creates reviews directory if it doesn't exist
  - Comprehensive validation using Zod schemas

### 2. GET `/reviews`
- **Purpose**: List all saved reviews with metadata
- **Response**: Array of `ReviewMetadata` objects
- **Features**:
  - Returns lightweight metadata only (id, title, timestamps, status, version, filename)
  - Sorted by `updatedAt` descending (most recent first)
  - Handles corrupted/invalid files gracefully
  - Efficient - doesn't load full review content

### 3. GET `/reviews/:id`
- **Purpose**: Load a specific review by ID
- **Response**: Complete `SavedCodeReview` object or 404
- **Features**:
  - Finds review file by ID prefix matching
  - Full Zod validation of loaded data
  - Proper error handling for missing/corrupted files

### 4. DELETE `/reviews/:id`
- **Purpose**: Delete a review by ID
- **Response**: `{ success: boolean }` or 404
- **Features**:
  - Safely removes file from filesystem
  - Returns 404 for non-existent reviews
  - Proper error handling and logging

### 5. POST `/reviews/:id/comments/:commentId/respond`
- **Purpose**: Add user response to a comment thread
- **Request Body**: `{ content: string, author: { type, name }, sessionId?: string }`
- **Response**: `{ success: boolean, responseId: string }`
- **Features**:
  - Finds and updates specific comment in review
  - Generates unique response IDs
  - Updates comment and review timestamps
  - Increments review version number
  - Saves updated review with new filename

## TypeScript Type Definitions

All interfaces implemented as Zod schemas for runtime validation:

```typescript
interface SavedCodeReview {
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
    diffFiles: any[]
  }
  analysis: {
    insights: any[]
    hunks: any[]
    aiSessionId?: string
  }
  comments: SavedComment[]
}

interface SavedComment {
  id: string
  threadId: string
  parentId?: string
  sessionId?: string
  status: 'open' | 'pending' | 'resolved' | 'dismissed'
  createdAt: string
  updatedAt: string
  file: string
  lines: { start: number; end: number }
  type: 'issue' | 'suggestion' | 'praise'
  severity: 'high' | 'medium' | 'low'
  message: string
  fixCode?: string
  author: { type: 'ai' | 'user'; name: string }
  responses: CommentResponse[]
}

interface CommentResponse {
  id: string
  author: { type: 'ai' | 'user'; name: string }
  content: string
  createdAt: string
  sessionId?: string
}
```

## File Storage Structure

- **Location**: `{project_root}/reviews/` directory
- **Filename Format**: `review-{id}-{timestamp}.json`
- **Content**: Pretty-printed JSON with 2-space indentation
- **Auto-Creation**: Reviews directory created automatically if missing

## Features & Best Practices

### Error Handling
- Comprehensive try-catch blocks
- Proper HTTP status codes (200, 400, 404)
- Structured error responses
- Detailed logging for debugging

### Security & Validation
- Full Zod schema validation on all inputs
- Path sanitization for file operations
- Proper error message sanitization
- No path traversal vulnerabilities

### Performance
- Efficient metadata-only listing
- File-based storage for simplicity
- Minimal memory usage for large reviews
- Graceful handling of corrupted files

### Consistency
- Follows existing OpenCode patterns exactly
- Uses same logging, error handling, and route structures
- Compatible with existing server architecture
- Proper OpenAPI documentation with `describeRoute`

### Maintainability
- Clear separation of concerns
- Reusable helper functions
- Comprehensive documentation
- Type-safe implementation

## Integration Notes

The implementation integrates seamlessly with the existing OpenCode server:

1. **Import Pattern**: Follows exact same pattern as other route modules
2. **Route Registration**: Added to main server app alongside existing routes
3. **Error Handling**: Uses existing `NamedError` system
4. **Logging**: Uses existing `Log` system with service-specific logger
5. **Project Context**: Uses `Instance.directory` for project-relative paths

## Testing

Created comprehensive test script (`test-review-api.js`) that verifies:
- Review saving and loading
- Comment response functionality
- Error handling for missing reviews
- File cleanup and deletion
- End-to-end workflow validation

## Future Enhancements

Potential improvements that could be added:
- Review versioning and history
- Bulk operations (import/export)
- Search and filtering capabilities
- Review templates and validation rules
- Integration with git hooks
- Backup and restore functionality

## Summary

This implementation provides a complete, production-ready file I/O system for code review persistence that integrates seamlessly with the existing OpenCode architecture while following all established patterns and best practices.