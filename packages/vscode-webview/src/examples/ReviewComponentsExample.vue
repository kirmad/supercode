<template>
  <div class="review-components-example">
    <!-- Review List Manager -->
    <section v-if="currentView === 'list'" class="review-list-section">
      <ReviewListManager
        :persistence-service="persistenceService"
        @review-selected="handleReviewSelected"
        @new-review="handleNewReview"
        @review-loaded="handleReviewLoaded"
        @review-deleted="handleReviewDeleted"
      />
    </section>

    <!-- Review Details View -->
    <section v-if="currentView === 'details'" class="review-details-section">
      <div class="review-header">
        <ActionButton
          @click="backToList"
          variant="ghost"
          size="medium"
        >
          <Icon name="arrow-left" />
          Back to Reviews
        </ActionButton>

        <div class="review-title">
          <h2>{{ selectedReview?.metadata.title }}</h2>
          <div class="review-meta">
            <span :class="['status-badge', selectedReview?.metadata.status]">
              {{ selectedReview?.metadata.status }}
            </span>
            <span class="updated-date">
              Updated {{ formatDate(selectedReview?.metadata.updatedAt) }}
            </span>
          </div>
        </div>

        <ActionButton
          @click="showSaveDialog = true"
          variant="primary"
          size="medium"
        >
          <Icon name="save" />
          Save Changes
        </ActionButton>
      </div>

      <!-- Comment Threads -->
      <div class="comment-threads">
        <h3>
          <Icon name="message-square" />
          Comments & Discussions
        </h3>

        <div class="threads-list">
          <CommentThreadCard
            v-for="comment in selectedReview?.comments"
            :key="comment.id"
            :original-comment="comment"
            :responses="comment.responses"
            :thread-status="getThreadStatus(comment)"
            :is-ai-typing="isAITyping && currentTypingThread === comment.threadId"
            :streaming-response="streamingResponse && currentTypingThread === comment.threadId ? streamingResponse : ''"
            :code-context="getCodeContext(comment)"
            :user-name="currentUserName"
            @user-response="(content) => handleUserResponse(comment.threadId, content)"
            @status-change="(status) => handleThreadStatusChange(comment.id, status)"
            @toggle-collapsed="(collapsed) => handleThreadCollapsed(comment.id, collapsed)"
          />
        </div>

        <!-- Empty State -->
        <div v-if="!selectedReview?.comments.length" class="empty-comments">
          <GlassCard :elevation="1" :hoverable="false">
            <div class="empty-content">
              <Icon name="message-square" class="empty-icon" />
              <h4>No comments yet</h4>
              <p>This review doesn't have any comments or discussions.</p>
            </div>
          </GlassCard>
        </div>
      </div>
    </section>

    <!-- Save Dialog -->
    <ReviewSaveDialog
      :is-visible="showSaveDialog"
      :initial-title="selectedReview?.metadata.title"
      :initial-status="selectedReview?.metadata.status"
      :review-summary="getReviewSummary()"
      :is-editing="true"
      :can-auto-generate-title="false"
      @save="handleSaveReview"
      @close="showSaveDialog = false"
    />

    <!-- Loading Overlay -->
    <div v-if="isLoading" class="loading-overlay">
      <GlassCard :elevation="2" class="loading-card">
        <div class="loading-content">
          <Icon name="loader" class="spinning" />
          <span>{{ loadingMessage }}</span>
        </div>
      </GlassCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ReviewPersistenceService } from '../services/ReviewPersistenceService'
import { CommentThreadingService } from '../services/CommentThreadingService'
import { SuperCodeWebSocketClient } from '../services/SuperCodeWebSocketClient'
import { type SavedCodeReview, type SavedComment, type CommentResponse } from '../types/CodeReview'
import ReviewListManager from '../components/review/ReviewListManager.vue'
import CommentThreadCard from '../components/review/CommentThreadCard.vue'
import ReviewSaveDialog from '../components/review/ReviewSaveDialog.vue'
import GlassCard from '../components/shared/GlassCard.vue'
import ActionButton from '../components/shared/ActionButton.vue'
import Icon from '../components/Icon.vue'

// Services
const wsClient = ref<SuperCodeWebSocketClient | null>(null)
const persistenceService = ref<ReviewPersistenceService | null>(null)
const threadingService = ref<CommentThreadingService | null>(null)

// State
const currentView = ref<'list' | 'details'>('list')
const selectedReview = ref<SavedCodeReview | null>(null)
const showSaveDialog = ref(false)
const isLoading = ref(false)
const loadingMessage = ref('')

// AI Response State
const isAITyping = ref(false)
const streamingResponse = ref('')
const currentTypingThread = ref<string | null>(null)

// User State
const currentUserName = ref('User')

// Computed
const reviewSummary = computed(() => {
  if (!selectedReview.value) return undefined

  return {
    commentsCount: selectedReview.value.comments.length,
    hunksCount: selectedReview.value.analysis.hunks.length,
    insightsCount: selectedReview.value.analysis.insights.length,
    source: selectedReview.value.source
  }
})

// Methods
function formatDate(dateString?: string): string {
  if (!dateString) return 'Unknown'

  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return 'today'
  } else if (diffDays === 1) {
    return 'yesterday'
  } else if (diffDays < 7) {
    return `${diffDays} days ago`
  } else {
    return date.toLocaleDateString()
  }
}

function getThreadStatus(comment: SavedComment): 'open' | 'resolved' | 'dismissed' {
  return comment.status === 'resolved' ? 'resolved' :
         comment.status === 'dismissed' ? 'dismissed' : 'open'
}

function getCodeContext(comment: SavedComment): string {
  // In a real implementation, this would fetch the actual code
  return `// Code context for ${comment.file} lines ${comment.lines.start}-${comment.lines.end}`
}

function getReviewSummary() {
  if (!selectedReview.value) return undefined

  return {
    commentsCount: selectedReview.value.comments.length,
    hunksCount: selectedReview.value.analysis.hunks.length,
    insightsCount: selectedReview.value.analysis.insights.length,
    source: selectedReview.value.source
  }
}

// Event Handlers
function handleReviewSelected(review: SavedCodeReview): void {
  console.log('Review selected:', review.id)
  selectedReview.value = review
  currentView.value = 'details'
}

function handleNewReview(): void {
  console.log('Creating new review')
  currentView.value = 'list' // In real implementation, would go to review creation
}

function handleReviewLoaded(review: SavedCodeReview): void {
  console.log('Review loaded:', review.id)
  selectedReview.value = review
  currentView.value = 'details'
}

function handleReviewDeleted(reviewId: string): void {
  console.log('Review deleted:', reviewId)
  if (selectedReview.value?.id === reviewId) {
    selectedReview.value = null
    currentView.value = 'list'
  }
}

function backToList(): void {
  currentView.value = 'list'
  selectedReview.value = null
}

async function handleUserResponse(threadId: string, content: string): Promise<void> {
  if (!threadingService.value) return

  try {
    isLoading.value = true
    loadingMessage.value = 'Sending response...'

    // Add user response to thread
    await threadingService.value.addUserResponseToThread(threadId, content, currentUserName.value)

    // Simulate AI typing
    isAITyping.value = true
    currentTypingThread.value = threadId

    // Simulate streaming response (in real implementation, this would come from the service)
    setTimeout(() => {
      isAITyping.value = false
      streamingResponse.value = 'Thank you for your response. I understand your concern about...'

      // Simulate streaming text
      let currentText = ''
      const fullResponse = 'Thank you for your response. I understand your concern about the implementation. Let me clarify the approach and suggest some improvements.'

      const interval = setInterval(() => {
        if (currentText.length < fullResponse.length) {
          currentText += fullResponse[currentText.length]
          streamingResponse.value = currentText
        } else {
          clearInterval(interval)
          setTimeout(() => {
            streamingResponse.value = ''
            currentTypingThread.value = null
          }, 1000)
        }
      }, 50)
    }, 2000)

  } catch (error) {
    console.error('Failed to handle user response:', error)
  } finally {
    isLoading.value = false
  }
}

function handleThreadStatusChange(commentId: string, status: 'open' | 'resolved' | 'dismissed'): void {
  console.log('Thread status changed:', commentId, status)

  if (selectedReview.value) {
    const comment = selectedReview.value.comments.find(c => c.id === commentId)
    if (comment) {
      comment.status = status
    }
  }
}

function handleThreadCollapsed(commentId: string, collapsed: boolean): void {
  console.log('Thread collapsed state changed:', commentId, collapsed)
}

async function handleSaveReview(data: { title: string; status: 'draft' | 'active' | 'completed' | 'archived' }): Promise<void> {
  if (!persistenceService.value || !selectedReview.value) return

  try {
    isLoading.value = true
    loadingMessage.value = 'Saving review...'

    // Update review metadata
    selectedReview.value.metadata.title = data.title
    selectedReview.value.metadata.status = data.status
    selectedReview.value.metadata.updatedAt = new Date().toISOString()

    // Convert back to ReviewResult format for saving
    const reviewResult = persistenceService.value.convertToReviewResult(selectedReview.value)

    await persistenceService.value.saveReview(
      reviewResult,
      { title: data.title, status: data.status },
      selectedReview.value.source,
      selectedReview.value.analysis,
      selectedReview.value.id
    )

    showSaveDialog.value = false
  } catch (error) {
    console.error('Failed to save review:', error)
  } finally {
    isLoading.value = false
  }
}

// Lifecycle
onMounted(async () => {
  try {
    // Initialize WebSocket client (mock for example)
    wsClient.value = new SuperCodeWebSocketClient()

    // Initialize services
    persistenceService.value = new ReviewPersistenceService()
    threadingService.value = new CommentThreadingService(wsClient.value)

    // Set up threading service callbacks
    threadingService.value.setCallbacks({
      onThreadCreated: (threadInfo) => {
        console.log('Thread created:', threadInfo.threadId)
      },
      onResponseReceived: (response, threadId) => {
        console.log('Response received:', response, threadId)

        // Update the review with new response
        if (selectedReview.value) {
          const comment = selectedReview.value.comments.find(c => c.threadId === threadId)
          if (comment) {
            comment.responses.push(response)
          }
        }
      },
      onAIResponseChunk: (chunk, threadId) => {
        if (currentTypingThread.value === threadId) {
          streamingResponse.value += chunk
        }
      },
      onAIResponseComplete: (fullContent, threadId) => {
        console.log('AI response complete:', fullContent, threadId)
        streamingResponse.value = ''
        currentTypingThread.value = null
      },
      onError: (error, threadId) => {
        console.error('Threading error:', error, threadId)
        isAITyping.value = false
        streamingResponse.value = ''
        currentTypingThread.value = null
      }
    })

  } catch (error) {
    console.error('Failed to initialize services:', error)
  }
})

onUnmounted(() => {
  // Cleanup services
  if (threadingService.value) {
    threadingService.value.cleanup()
  }
  if (persistenceService.value) {
    persistenceService.value.cleanup()
  }
})
</script>

<style scoped>
.review-components-example {
  height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
}

/* Review List Section */
.review-list-section {
  flex: 1;
  overflow-y: auto;
}

/* Review Details Section */
.review-details-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.review-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--glass-bg);
  backdrop-filter: blur(10px);
}

.review-title {
  flex: 1;
  min-width: 0;
}

.review-title h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.5rem 0;
  word-break: break-word;
}

.review-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 1rem;
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-badge.draft {
  background: var(--warning-bg);
  color: var(--warning-color);
}

.status-badge.active {
  background: var(--info-bg);
  color: var(--info-color);
}

.status-badge.completed {
  background: var(--success-bg);
  color: var(--success-color);
}

.status-badge.archived {
  background: var(--glass-bg-darker);
  color: var(--text-tertiary);
}

.updated-date {
  font-size: 0.875rem;
  color: var(--text-tertiary);
}

/* Comment Threads */
.comment-threads {
  flex: 1;
  padding: 1.5rem;
  overflow-y: auto;
}

.comment-threads h3 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 1.5rem 0;
}

.threads-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Empty State */
.empty-comments {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
  text-align: center;
  color: var(--text-secondary);
}

.empty-icon {
  width: 48px;
  height: 48px;
  opacity: 0.3;
}

.empty-content h4 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.empty-content p {
  font-size: 0.875rem;
  margin: 0;
  line-height: 1.5;
}

/* Loading Overlay */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
  backdrop-filter: blur(2px);
}

.loading-card {
  min-width: 200px;
}

.loading-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  color: var(--text-primary);
}

/* Animations */
@keyframes spinning {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.spinning {
  animation: spinning 1s linear infinite;
}

/* CSS Variables */
:root {
  --warning-bg: rgba(245, 158, 11, 0.1);
  --warning-color: #f59e0b;
  --info-bg: rgba(59, 130, 246, 0.1);
  --info-color: #3b82f6;
  --success-bg: rgba(34, 197, 94, 0.1);
  --success-color: #22c55e;
}

/* Responsive */
@media (max-width: 768px) {
  .review-header {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }

  .review-title {
    order: -1;
  }

  .comment-threads {
    padding: 1rem;
  }

  .threads-list {
    gap: 0.75rem;
  }
}
</style>