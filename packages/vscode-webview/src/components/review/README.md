# Review Management Components

This directory contains UI components for enhanced review management and comment interaction in the vscode-webview package.

## Components

### 1. ReviewListManager.vue

A comprehensive review management interface that provides:

**Features:**
- List all saved reviews with metadata (title, date, status, type)
- Search and filter reviews by status, date, and type
- Load selected review into the main review interface
- Delete reviews with confirmation modal
- Create new review button/action
- Duplicate existing reviews
- Real-time updates and toast notifications

**Props:**
- `persistenceService?: ReviewPersistenceService` - Persistence service instance

**Events:**
- `review-selected: [review: SavedCodeReview]` - When a review is selected for loading
- `new-review: []` - When user wants to create a new review
- `review-loaded: [review: SavedCodeReview]` - When a review is successfully loaded
- `review-deleted: [reviewId: string]` - When a review is deleted

**Usage:**
```vue
<ReviewListManager
  :persistence-service="persistenceService"
  @review-selected="handleReviewSelected"
  @new-review="handleNewReview"
  @review-loaded="handleReviewLoaded"
  @review-deleted="handleReviewDeleted"
/>
```

### 2. CommentThreadCard.vue

An enhanced comment card that displays comment threads with AI responses:

**Features:**
- Display comment thread with all responses
- User input field for responding to AI comments
- Thread status management (open/resolved/dismissed)
- AI typing indicator during response generation
- Collapsible thread view for long conversations
- Real-time streaming response display
- Keyboard shortcuts (Escape to collapse, Ctrl+Enter to send)

**Props:**
- `originalComment: SavedComment` - The original AI comment
- `responses?: CommentResponse[]` - Array of thread responses
- `threadStatus?: 'open' | 'resolved' | 'dismissed'` - Current thread status
- `isAITyping?: boolean` - Whether AI is currently typing
- `streamingResponse?: string` - Current streaming AI response
- `codeContext?: string` - Code context for the comment
- `inline?: boolean` - Whether displayed inline
- `collapsed?: boolean` - Initial collapsed state
- `userName?: string` - Current user name

**Events:**
- `user-response: [content: string]` - When user submits a response
- `status-change: [status: 'open' | 'resolved' | 'dismissed']` - When thread status changes
- `toggle-collapsed: [collapsed: boolean]` - When collapse state changes

**Usage:**
```vue
<CommentThreadCard
  :original-comment="comment"
  :responses="threadResponses"
  :thread-status="threadStatus"
  :is-ai-typing="isAITyping"
  :streaming-response="streamingResponse"
  :code-context="codeContext"
  @user-response="handleUserResponse"
  @status-change="handleStatusChange"
  @toggle-collapsed="handleToggleCollapsed"
/>
```

### 3. ReviewSaveDialog.vue

A modal dialog for saving reviews with enhanced UX:

**Features:**
- Modal dialog for saving reviews
- Title input with auto-generation from review type
- Status selection (draft/active/completed/archived)
- Review summary display with statistics
- Save confirmation and error handling
- Keyboard shortcuts (Ctrl+Enter to save, Escape to cancel)
- Form validation and character limits

**Props:**
- `isVisible: boolean` - Whether dialog is visible
- `initialTitle?: string` - Initial title value
- `initialStatus?: 'draft' | 'active' | 'completed' | 'archived'` - Initial status
- `reviewSummary?: ReviewSummary` - Summary data to display
- `isEditing?: boolean` - Whether editing existing review
- `canAutoGenerateTitle?: boolean` - Whether auto-generation is available

**Events:**
- `save: [data: SaveData]` - When user saves the review
- `close: []` - When dialog is closed
- `auto-generate-title: []` - When auto-generation is requested

**Usage:**
```vue
<ReviewSaveDialog
  :is-visible="showSaveDialog"
  :initial-title="currentTitle"
  :initial-status="currentStatus"
  :review-summary="reviewSummary"
  :is-editing="isEditingReview"
  @save="handleSave"
  @close="handleClose"
  @auto-generate-title="handleAutoGenerateTitle"
/>
```

## Integration with Services

These components integrate with the following services:

### ReviewPersistenceService
- Save/load/delete reviews
- List all saved reviews
- Add comment responses to threads

### CommentThreadingService
- Create and manage comment threads
- Handle AI conversation management
- Track thread responses and status

## Design System Compliance

All components follow the existing design patterns:

- **Glass Card Design**: Modern glass-card styling with backdrop blur
- **Color Scheme**: Consistent with existing theme variables
- **Typography**: Matching font sizes and weights
- **Animations**: Smooth transitions and loading states
- **Accessibility**: Proper ARIA labels and keyboard navigation
- **Responsive**: Mobile-friendly design with adaptive layouts

## Key Features

### Modern UX Patterns
- Toast notifications for user feedback
- Loading states and progress indicators
- Smooth animations and transitions
- Keyboard shortcuts for power users
- Real-time updates and streaming content

### Performance Optimizations
- Efficient component composition
- Proper Vue 3 reactivity patterns
- Minimal re-renders with computed properties
- Lazy loading and virtualization where appropriate

### Error Handling
- Graceful error recovery
- User-friendly error messages
- Validation and input sanitization
- Network failure handling

## CSS Custom Properties

The components use CSS custom properties for theming:

```css
--glass-bg: Background for glass cards
--glass-bg-hover: Hover state background
--glass-bg-darker: Darker glass background
--border-subtle: Subtle border color
--text-primary: Primary text color
--text-secondary: Secondary text color
--text-tertiary: Tertiary text color
--primary-color: Primary brand color
--success-color: Success state color
--warning-color: Warning state color
--error-color: Error state color
--info-color: Info state color
```

## Browser Support

Components are compatible with:
- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+

## Dependencies

- Vue 3.3+
- Existing shared components (GlassCard, ActionButton, Icon)
- Review services (ReviewPersistenceService, CommentThreadingService)
- TypeScript type definitions from types/CodeReview.ts