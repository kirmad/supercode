<template>
  <div
    :class="[
      'comment-thread-card',
      `status-${threadStatus}`,
      { collapsed: isCollapsed, inline: inline }
    ]"
  >
    <!-- Thread Header -->
    <div class="thread-header" @click="toggleCollapsed">
      <div class="thread-meta">
        <Icon :name="getStatusIcon(threadStatus)" :size="16" />
        <span class="thread-title">{{ threadTitle }}</span>
        <span :class="['status-badge', threadStatus]">
          {{ threadStatus }}
        </span>
        <span class="response-count">{{ responses.length }} response{{ responses.length !== 1 ? 's' : '' }}</span>
        <button
          v-if="threadStatus !== 'dismissed'"
          @click.stop="showReplyInput"
          class="reply-button"
          title="Reply"
        >
          <Icon name="message-square" :size="14" />
        </button>
      </div>

      <div class="thread-actions">
        <button
          @click.stop="toggleCollapsed"
          class="action-button collapse"
          :title="isCollapsed ? 'Expand thread' : 'Collapse thread'"
        >
          <Icon :name="isCollapsed ? 'chevron-down' : 'chevron-up'" :size="14" />
        </button>
      </div>
    </div>

    <!-- Original Comment Context -->
    <div v-if="!isCollapsed" class="original-comment">
      <div class="comment-context">
        <Icon name="file-code" :size="14" />
        <span class="file-path">{{ getFileName(originalComment.file) }}</span>
        <span class="line-range">L{{ originalComment.lines.start }}-{{ originalComment.lines.end }}</span>
      </div>

      <div class="original-message">
        <Icon :name="getCommentTypeIcon(originalComment.type)" :size="16" />
        <div class="message-content">
          <div class="message-header">
            <span class="comment-type">{{ getCommentTypeLabel(originalComment.type) }}</span>
            <span :class="['severity-badge', originalComment.severity]">
              {{ originalComment.severity }}
            </span>
          </div>
          <div class="message-text">{{ originalComment.message }}</div>
        </div>
      </div>

      <!-- Code Context (if available) -->
      <div v-if="codeContext" class="code-context">
        <div class="code-header">
          <Icon name="code" :size="14" />
          <span>Code Context</span>
        </div>
        <pre class="code-snippet"><code>{{ codeContext }}</code></pre>
      </div>
    </div>

    <!-- Thread Responses -->
    <div v-if="!isCollapsed" class="thread-responses">
      <TransitionGroup name="response-slide">
        <div
          v-for="response in responses"
          :key="response.id"
          :class="['response-item', `author-${response.author.type}`]"
        >
          <div class="response-header">
            <div class="author-info">
              <Icon :name="response.author.type === 'ai' ? 'bot' : 'user'" :size="16" />
              <span class="author-name">{{ response.author.name }}</span>
              <span class="response-time">{{ formatTime(response.createdAt) }}</span>
            </div>
          </div>

          <div class="response-content">
            {{ response.content }}
          </div>
        </div>
      </TransitionGroup>

      <!-- AI Typing Indicator -->
      <div v-if="isAITyping" class="ai-typing">
        <div class="typing-header">
          <Icon name="bot" :size="16" />
          <span class="author-name">AI Assistant</span>
          <span class="typing-indicator">is typing...</span>
        </div>
        <div class="typing-animation">
          <div class="typing-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>

      <!-- Streaming AI Response -->
      <div v-if="streamingResponse" class="streaming-response">
        <div class="response-header">
          <div class="author-info">
            <Icon name="bot" :size="16" />
            <span class="author-name">AI Assistant</span>
            <span class="response-time">now</span>
          </div>
        </div>
        <div class="response-content streaming">
          {{ streamingResponse }}
          <span class="cursor">|</span>
        </div>
      </div>
    </div>

    <!-- User Input Section -->
    <div v-if="!isCollapsed && threadStatus !== 'dismissed' && showReply" class="user-input-section">
      <div class="input-container">
        <textarea
          v-model="userInput"
          ref="inputRef"
          class="input-field"
          placeholder="Type your response or question..."
          rows="3"
          @keydown.ctrl.enter="submitResponse"
          @keydown.meta.enter="submitResponse"
          @input="adjustTextareaHeight"
          :disabled="isSubmitting || threadStatus === 'dismissed'"
        />

      </div>
    </div>

    <!-- Quick Actions (for resolved/dismissed threads) -->
    <div v-if="!isCollapsed && (threadStatus === 'resolved' || threadStatus === 'dismissed')" class="quick-actions">
      <ActionButton
        v-if="threadStatus === 'resolved'"
        @click="reopenThread"
        variant="ghost"
        size="small"
      >
        <Icon name="rotate-ccw" />
        Reopen Thread
      </ActionButton>
      <ActionButton
        v-if="threadStatus === 'dismissed'"
        @click="reopenThread"
        variant="ghost"
        size="small"
      >
        <Icon name="refresh-cw" />
        Restore Thread
      </ActionButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { type SavedComment, type CommentResponse } from '../../types/CodeReview'
import Icon from '../Icon.vue'
import ActionButton from '../shared/ActionButton.vue'

// Component props
interface Props {
  originalComment: SavedComment
  responses?: CommentResponse[]
  threadStatus?: 'open' | 'resolved' | 'dismissed'
  isAITyping?: boolean
  streamingResponse?: string
  codeContext?: string
  inline?: boolean
  collapsed?: boolean
  userName?: string
}

const props = withDefaults(defineProps<Props>(), {
  responses: () => [],
  threadStatus: 'open',
  isAITyping: false,
  streamingResponse: '',
  codeContext: '',
  inline: false,
  collapsed: false,
  userName: 'User'
})

// Component emits
const emit = defineEmits<{
  'user-response': [content: string]
  'status-change': [status: 'open' | 'resolved' | 'dismissed']
  'toggle-collapsed': [collapsed: boolean]
}>()

// Local state
const userInput = ref('')
const isSubmitting = ref(false)
const isCollapsed = ref(props.collapsed)
const showReply = ref(false)
const inputRef = ref<HTMLTextAreaElement | null>(null)

// Computed properties
const threadTitle = computed(() => {
  const typeLabel = getCommentTypeLabel(props.originalComment.type)
  const fileName = getFileName(props.originalComment.file)
  return `${typeLabel} in ${fileName}`
})

const responses = computed(() => props.responses || [])

// Methods
function showReplyInput() {
  showReply.value = !showReply.value
  if (showReply.value) {
    nextTick(() => {
      inputRef.value?.focus()
    })
  }
}
function getFileName(path: string): string {
  return path.split('/').pop() || path
}

function getCommentTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    issue: 'alert-triangle',
    bug: 'bug',
    error: 'x-circle',
    warning: 'alert-circle',
    suggestion: 'lightbulb',
    improvement: 'trending-up',
    refactor: 'refresh-cw',
    praise: 'thumbs-up',
    performance: 'zap',
    security: 'shield',
    style: 'palette',
    documentation: 'file-text',
    test: 'check-square',
    question: 'help-circle',
    note: 'message-circle',
    todo: 'clock'
  }
  return icons[type] || 'info'
}

function getCommentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    issue: 'Issue',
    bug: 'Bug',
    error: 'Error',
    warning: 'Warning',
    suggestion: 'Suggestion',
    improvement: 'Improvement',
    refactor: 'Refactor',
    praise: 'Good Practice',
    performance: 'Performance',
    security: 'Security',
    style: 'Code Style',
    documentation: 'Documentation',
    test: 'Testing',
    question: 'Question',
    note: 'Note',
    todo: 'TODO'
  }
  return labels[type] || type
}

function getStatusIcon(status: string): string {
  const icons = {
    open: 'message-circle',
    resolved: 'check-circle',
    dismissed: 'x-circle'
  }
  return icons[status as keyof typeof icons] || 'circle'
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMinutes < 1) {
    return 'now'
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`
  } else if (diffHours < 24) {
    return `${diffHours}h ago`
  } else if (diffDays < 7) {
    return `${diffDays}d ago`
  } else {
    return date.toLocaleDateString()
  }
}

function toggleCollapsed(): void {
  isCollapsed.value = !isCollapsed.value
  emit('toggle-collapsed', isCollapsed.value)
}

function resolveThread(): void {
  emit('status-change', 'resolved')
}

function reopenThread(): void {
  emit('status-change', 'open')
}

function dismissThread(): void {
  emit('status-change', 'dismissed')
}

async function submitResponse(): Promise<void> {
  if (!userInput.value.trim() || isSubmitting.value) return

  isSubmitting.value = true
  try {
    emit('user-response', userInput.value.trim())
    userInput.value = ''

    // Reset textarea height
    await nextTick()
    adjustTextareaHeight()
  } catch (error) {
    console.error('Failed to submit response:', error)
  } finally {
    isSubmitting.value = false
  }
}

function adjustTextareaHeight(): void {
  if (inputRef.value) {
    inputRef.value.style.height = 'auto'
    inputRef.value.style.height = `${Math.max(inputRef.value.scrollHeight, 60)}px`
  }
}

// Watchers
watch(() => props.collapsed, (newValue) => {
  isCollapsed.value = newValue
})

// Focus input when thread is opened
watch(() => props.threadStatus, (newStatus, oldStatus) => {
  if (oldStatus !== 'open' && newStatus === 'open') {
    nextTick(() => {
      if (inputRef.value && !isCollapsed.value) {
        inputRef.value.focus()
      }
    })
  }
})

// Auto-expand when AI starts typing
watch(() => props.isAITyping, (isTyping) => {
  if (isTyping && isCollapsed.value) {
    isCollapsed.value = false
    emit('toggle-collapsed', false)
  }
})

// Auto-expand when streaming response starts
watch(() => props.streamingResponse, (response) => {
  if (response && isCollapsed.value) {
    isCollapsed.value = false
    emit('toggle-collapsed', false)
  }
})

// Lifecycle
onMounted(() => {
  if (inputRef.value) {
    adjustTextareaHeight()
  }
})

// Keyboard shortcuts
function handleKeyDown(event: KeyboardEvent): void {
  // Escape to collapse thread
  if (event.key === 'Escape' && !isCollapsed.value) {
    toggleCollapsed()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
.comment-thread-card {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 0.5rem;
  transition: all 0.3s ease;
  overflow: hidden;
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.18);
  margin-bottom: 0.5rem;
}

.comment-thread-card.inline {
  margin: 0.5rem 0;
  border-radius: 0.5rem;
}

.comment-thread-card.collapsed {
  border-radius: 0.5rem;
}

/* Status-specific styling */
.comment-thread-card.status-open {
  border-left: 3px solid var(--info-color);
}

.comment-thread-card.status-resolved {
  border-left: 3px solid var(--success-color);
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.03) 0%, transparent 100%);
}

.comment-thread-card.status-dismissed {
  border-left: 3px solid var(--text-tertiary);
  background: linear-gradient(135deg, rgba(100, 116, 139, 0.03) 0%, transparent 100%);
  opacity: 0.7;
}

/* Thread Header */
.thread-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  cursor: pointer;
  transition: background 0.2s ease;
}

.thread-header:hover {
  background: rgba(255, 255, 255, 0.08);
}

.thread-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  min-width: 0;
}

.thread-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
  min-width: 0;
  word-break: break-word;
}

.status-badge {
  padding: 0.125rem 0.375rem;
  border-radius: 1rem;
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-badge.open {
  background: var(--info-bg);
  color: var(--info-color);
}

.status-badge.resolved {
  background: var(--success-bg);
  color: var(--success-color);
}

.status-badge.dismissed {
  background: var(--glass-bg-darker);
  color: var(--text-tertiary);
}

.response-count {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  background: var(--glass-bg-darker);
  padding: 0.25rem 0.5rem;
  border-radius: 1rem;
}

.thread-actions {
  display: flex;
  gap: 0.375rem;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.thread-header:hover .thread-actions {
  opacity: 1;
}

.action-button {
  padding: 0.375rem;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 0.375rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-button:hover {
  background: var(--glass-bg-hover);
  transform: translateY(-1px);
}

.action-button.resolve:hover {
  border-color: var(--success-color);
  color: var(--success-color);
}

.action-button.reopen:hover {
  border-color: var(--info-color);
  color: var(--info-color);
}

.action-button.dismiss:hover {
  border-color: var(--error-color);
  color: var(--error-color);
}

.reply-button {
  padding: 0.25rem 0.5rem;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 0.375rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-left: 0.5rem;
}

.reply-button:hover {
  background: var(--glass-bg-hover);
  border-color: var(--primary-color);
  color: var(--primary-color);
  transform: translateY(-1px);
}

/* Original Comment */
.original-comment {
  padding: 0 1rem 0.5rem 1rem;
  border-bottom: 1px solid var(--border-subtle);
}

.comment-context {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-tertiary);
  margin-bottom: 0.75rem;
}

.file-path {
  font-family: 'Monaco', 'Courier New', monospace;
}

.line-range {
  font-family: 'Monaco', 'Courier New', monospace;
  font-weight: 500;
}

.original-message {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.message-content {
  flex: 1;
  min-width: 0;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.comment-type {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.severity-badge {
  padding: 0.125rem 0.375rem;
  border-radius: 1rem;
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
}

.severity-badge.high {
  background: var(--error-bg);
  color: var(--error-color);
}

.severity-badge.medium {
  background: var(--warning-bg);
  color: var(--warning-color);
}

.severity-badge.low {
  background: var(--info-bg);
  color: var(--info-color);
}

.message-text {
  font-size: 0.875rem;
  color: var(--text-primary);
  line-height: 1.5;
}

/* Code Context */
.code-context {
  margin-top: 0.75rem;
}

.code-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.code-snippet {
  background: var(--code-bg);
  padding: 0.75rem;
  border-radius: 0.375rem;
  overflow-x: auto;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--text-primary);
}

/* Thread Responses */
.thread-responses {
  padding: 1rem 1rem 0.25rem 1rem;
  border-bottom: 1px solid var(--border-subtle);
}

.response-item {
  margin-bottom: 0.5rem;
  padding: 0.75rem;
  background: var(--glass-bg-darker);
  border-radius: 0.5rem;
  border: 1px solid var(--border-subtle);
}

.response-item.author-user {
  background: var(--primary-alpha-5);
  border-color: var(--primary-alpha-20);
}

.response-item.author-ai {
  background: var(--glass-bg-darker);
  border-color: var(--border-subtle);
}

.response-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.author-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.author-name {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.response-time {
  font-size: 0.625rem;
  color: var(--text-tertiary);
}

.response-content {
  font-size: 0.875rem;
  color: var(--text-primary);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

/* AI Typing Indicator */
.ai-typing {
  padding: 0.75rem;
  background: var(--glass-bg-darker);
  border-radius: 0.5rem;
  border: 1px solid var(--border-subtle);
  margin-bottom: 1rem;
}

.typing-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.typing-indicator {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  font-style: italic;
}

.typing-animation {
  display: flex;
  align-items: center;
  padding: 0.5rem 0;
}

.typing-dots {
  display: flex;
  gap: 0.25rem;
}

.typing-dots span {
  width: 6px;
  height: 6px;
  background: var(--text-tertiary);
  border-radius: 50%;
  animation: typing-bounce 1.4s infinite ease-in-out;
}

.typing-dots span:nth-child(1) {
  animation-delay: -0.32s;
}

.typing-dots span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes typing-bounce {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

/* Streaming Response */
.streaming-response {
  padding: 0.75rem;
  background: var(--glass-bg-darker);
  border-radius: 0.5rem;
  border: 1px solid var(--border-subtle);
  margin-bottom: 1rem;
}

.response-content.streaming {
  position: relative;
}

.cursor {
  animation: cursor-blink 1s infinite;
  color: var(--primary-color);
}

@keyframes cursor-blink {
  0%, 50% {
    opacity: 1;
  }
  51%, 100% {
    opacity: 0;
  }
}

/* User Input Section */
.user-input-section {
  padding: 0.5rem 1rem 0.75rem 1rem;
}

.input-container {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.input-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.input-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.input-field-container {
  position: relative;
}

.input-field {
  width: 100%;
  padding: 0.75rem;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  resize: none;
  transition: all 0.2s ease;
  font-family: inherit;
  line-height: 1.5;
  min-height: 60px;
}

.input-field:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px var(--primary-alpha-10);
}

.input-field:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.input-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.5rem;
}

.char-count {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.submit-button {
  min-width: 80px;
}

.input-hint {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

/* Quick Actions */
.quick-actions {
  padding: 0.5rem 1rem 0.75rem 1rem;
  display: flex;
  justify-content: center;
}

/* Response Transitions */
.response-slide-enter-active {
  transition: all 0.3s ease;
}

.response-slide-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

/* CSS Variables */
:root {
  --code-bg: rgba(30, 30, 30, 0.5);
  --primary-alpha-5: rgba(99, 102, 241, 0.05);
  --primary-alpha-10: rgba(99, 102, 241, 0.1);
  --primary-alpha-20: rgba(99, 102, 241, 0.2);

  /* Semantic colors */
  --error-bg: rgba(239, 68, 68, 0.1);
  --error-color: #ef4444;
  --warning-bg: rgba(245, 158, 11, 0.1);
  --warning-color: #f59e0b;
  --info-bg: rgba(59, 130, 246, 0.1);
  --info-color: #3b82f6;
  --success-bg: rgba(34, 197, 94, 0.1);
  --success-color: #22c55e;
}

/* Responsive */
@media (max-width: 768px) {
  .thread-header {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }

  .thread-actions {
    opacity: 1;
    justify-content: flex-end;
  }

  .original-message {
    flex-direction: column;
    gap: 0.5rem;
  }

  .response-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }

  .input-actions {
    flex-direction: column;
    gap: 0.5rem;
    align-items: stretch;
  }

  .submit-button {
    width: 100%;
  }
}
</style>