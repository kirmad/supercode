<template>
  <div
    :class="[
      'inline-comment-thread',
      `context-${contextType}`,
      { expanded: isExpanded, replying: isReplying }
    ]"
  >
    <!-- Thread Toggle Button -->
    <div class="thread-toggle" @click="toggleExpanded">
      <Icon :name="contextType === 'hunk' ? 'git-branch' : 'message-circle'" :size="14" />
      <span class="thread-count">{{ responses.length }}</span>
      <Icon
        :name="isExpanded ? 'chevron-up' : 'chevron-down'"
        :size="12"
        class="expand-icon"
      />
    </div>

    <!-- Expanded Thread Content -->
    <div v-if="isExpanded" class="thread-content">
      <!-- Context Summary -->
      <div class="context-summary">
        <Icon :name="contextType === 'hunk' ? 'git-branch' : 'message-circle'" :size="14" />
        <span class="context-label">
          {{ contextType === 'hunk' ? 'Code Change Discussion' : 'Comment Thread' }}
        </span>
        <span class="file-location">{{ fileName }}:{{ lines.start }}-{{ lines.end }}</span>
      </div>

      <!-- Original Context -->
      <div class="original-context">
        <div class="context-text">{{ originalMessage }}</div>
      </div>

      <!-- Responses -->
      <div v-if="responses.length > 0" class="responses-list">
        <div
          v-for="response in responses"
          :key="response.id"
          :class="['response', `author-${response.author.type}`]"
        >
          <div class="response-header">
            <Icon :name="response.author.type === 'ai' ? 'bot' : 'user'" :size="12" />
            <span class="author">{{ response.author.name }}</span>
            <span class="time">{{ formatTime(response.createdAt) }}</span>
          </div>
          <div class="response-content">{{ response.content }}</div>
        </div>
      </div>

      <!-- AI Processing States -->
      <div v-if="isAITyping" class="ai-processing">
        <Icon name="bot" :size="12" />
        <span class="processing-text">{{ contextType === 'hunk' ? 'Explaining change...' : 'Typing...' }}</span>
        <div class="processing-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>

      <div v-if="streamingResponse" class="streaming-response">
        <Icon name="bot" :size="12" />
        <span class="streaming-content">{{ streamingResponse }}<span class="cursor">|</span></span>
      </div>

      <!-- Reply Input -->
      <div v-if="isReplying" class="reply-input">
        <textarea
          v-model="replyText"
          ref="replyInputRef"
          class="reply-textarea"
          :placeholder="contextType === 'hunk' ? 'Ask about this change...' : 'Add a response...'"
          rows="2"
          @keydown.ctrl.enter="submitReply"
          @keydown.meta.enter="submitReply"
          @keydown.esc="cancelReply"
        ></textarea>
        <div class="reply-actions">
          <button
            @click="submitReply"
            :disabled="!replyText.trim() || isSubmitting"
            class="reply-submit"
          >
            <Icon v-if="!isSubmitting" :name="contextType === 'hunk' ? 'help-circle' : 'send'" :size="12" />
            {{ isSubmitting ? (contextType === 'hunk' ? 'Asking...' : 'Sending...') : (contextType === 'hunk' ? 'Ask' : 'Reply') }}
          </button>
          <button @click="cancelReply" class="reply-cancel">Cancel</button>
        </div>
      </div>

      <!-- Thread Actions -->
      <div v-if="!isReplying" class="thread-actions">
        <button @click="startReply" class="action-btn reply-btn">
          <Icon :name="contextType === 'hunk' ? 'help-circle' : 'message-circle'" :size="12" />
          {{ contextType === 'hunk' ? 'Ask Question' : 'Reply' }}
        </button>
        <button
          v-if="status === 'open'"
          @click="resolveThread"
          class="action-btn resolve-btn"
        >
          <Icon name="check" :size="12" />
          Resolve
        </button>
        <button
          v-if="status === 'resolved'"
          @click="reopenThread"
          class="action-btn reopen-btn"
        >
          <Icon name="rotate-ccw" :size="12" />
          Reopen
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { type CommentResponse } from '../../types/CodeReview'
import Icon from '../Icon.vue'

// Component props
interface Props {
  contextType: 'comment' | 'hunk'
  originalMessage: string
  fileName: string
  lines: { start: number; end: number }
  responses?: CommentResponse[]
  status?: 'open' | 'resolved' | 'dismissed'
  isAITyping?: boolean
  streamingResponse?: string
  expanded?: boolean
  userName?: string
}

const props = withDefaults(defineProps<Props>(), {
  responses: () => [],
  status: 'open',
  isAITyping: false,
  streamingResponse: '',
  expanded: false,
  userName: 'User'
})

// Component emits
const emit = defineEmits<{
  'toggle-expanded': [expanded: boolean]
  'user-response': [content: string]
  'status-change': [status: 'open' | 'resolved' | 'dismissed']
}>()

// Local state
const isExpanded = ref(props.expanded)
const isReplying = ref(false)
const replyText = ref('')
const isSubmitting = ref(false)
const replyInputRef = ref<HTMLTextAreaElement | null>(null)

// Computed properties
const responses = computed(() => props.responses || [])

// Methods
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
    return `${diffMinutes}m`
  } else if (diffHours < 24) {
    return `${diffHours}h`
  } else if (diffDays < 7) {
    return `${diffDays}d`
  } else {
    return date.toLocaleDateString()
  }
}

function toggleExpanded(): void {
  isExpanded.value = !isExpanded.value
  emit('toggle-expanded', isExpanded.value)
}

function startReply(): void {
  isReplying.value = true
  nextTick(() => {
    if (replyInputRef.value) {
      replyInputRef.value.focus()
    }
  })
}

function cancelReply(): void {
  isReplying.value = false
  replyText.value = ''
}

async function submitReply(): Promise<void> {
  if (!replyText.value.trim() || isSubmitting.value) return

  isSubmitting.value = true
  try {
    emit('user-response', replyText.value.trim())
    replyText.value = ''
    isReplying.value = false
  } catch (error) {
    console.error('Failed to submit reply:', error)
  } finally {
    isSubmitting.value = false
  }
}

function resolveThread(): void {
  emit('status-change', 'resolved')
}

function reopenThread(): void {
  emit('status-change', 'open')
}

// Watchers
watch(() => props.expanded, (newValue) => {
  isExpanded.value = newValue
})

// Auto-expand when AI starts typing
watch(() => props.isAITyping, (isTyping) => {
  if (isTyping && !isExpanded.value) {
    isExpanded.value = true
    emit('toggle-expanded', true)
  }
})

// Auto-expand when streaming response starts
watch(() => props.streamingResponse, (response) => {
  if (response && !isExpanded.value) {
    isExpanded.value = true
    emit('toggle-expanded', true)
  }
})
</script>

<style scoped>
.inline-comment-thread {
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 0.5rem;
  margin: 0.25rem 0;
  transition: all 0.2s ease;
}

.inline-comment-thread.context-hunk {
  border-left: 3px solid var(--primary-color);
}

.inline-comment-thread.context-comment {
  border-left: 3px solid var(--info-color);
}

.inline-comment-thread.expanded {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* Thread Toggle */
.thread-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  transition: background 0.2s ease;
}

.thread-toggle:hover {
  background: var(--glass-bg-hover);
}

.thread-count {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--glass-bg-darker);
  padding: 0.125rem 0.375rem;
  border-radius: 1rem;
  min-width: 1.25rem;
  text-align: center;
}

.expand-icon {
  color: var(--text-tertiary);
  margin-left: auto;
}

/* Thread Content */
.thread-content {
  padding: 0.75rem;
  border-top: 1px solid var(--border-subtle);
}

.context-summary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  font-size: 0.75rem;
}

.context-label {
  font-weight: 600;
  color: var(--text-secondary);
}

.file-location {
  color: var(--text-tertiary);
  font-family: 'Monaco', 'Courier New', monospace;
  margin-left: auto;
}

.original-context {
  background: var(--glass-bg-darker);
  padding: 0.5rem;
  border-radius: 0.375rem;
  margin-bottom: 0.75rem;
}

.context-text {
  font-size: 0.875rem;
  color: var(--text-primary);
  line-height: 1.4;
}

/* Responses */
.responses-list {
  margin-bottom: 0.75rem;
}

.response {
  margin-bottom: 0.5rem;
  padding: 0.5rem;
  border-radius: 0.375rem;
  border: 1px solid var(--border-subtle);
}

.response.author-user {
  background: var(--primary-alpha-5);
  border-color: var(--primary-alpha-20);
}

.response.author-ai {
  background: var(--glass-bg-darker);
}

.response-header {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-bottom: 0.375rem;
  font-size: 0.75rem;
}

.author {
  font-weight: 600;
  color: var(--text-secondary);
}

.time {
  color: var(--text-tertiary);
  margin-left: auto;
}

.response-content {
  font-size: 0.875rem;
  color: var(--text-primary);
  line-height: 1.4;
  white-space: pre-wrap;
}

/* AI Processing */
.ai-processing {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: var(--glass-bg-darker);
  border-radius: 0.375rem;
  margin-bottom: 0.75rem;
}

.processing-text {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  font-style: italic;
}

.processing-dots {
  display: flex;
  gap: 0.125rem;
  margin-left: auto;
}

.processing-dots span {
  width: 4px;
  height: 4px;
  background: var(--text-tertiary);
  border-radius: 50%;
  animation: processing-bounce 1.4s infinite ease-in-out;
}

.processing-dots span:nth-child(1) {
  animation-delay: -0.32s;
}

.processing-dots span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes processing-bounce {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}

.streaming-response {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.5rem;
  background: var(--glass-bg-darker);
  border-radius: 0.375rem;
  margin-bottom: 0.75rem;
}

.streaming-content {
  font-size: 0.875rem;
  color: var(--text-primary);
  line-height: 1.4;
  flex: 1;
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

/* Reply Input */
.reply-input {
  margin-bottom: 0.75rem;
}

.reply-textarea {
  width: 100%;
  padding: 0.5rem;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 0.375rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  resize: vertical;
  min-height: 60px;
  font-family: inherit;
  line-height: 1.4;
  margin-bottom: 0.5rem;
}

.reply-textarea:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px var(--primary-alpha-10);
}

.reply-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.reply-submit {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.reply-submit:hover:not(:disabled) {
  background: var(--primary-color-dark);
  transform: translateY(-1px);
}

.reply-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.reply-cancel {
  padding: 0.375rem 0.75rem;
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: 0.375rem;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.reply-cancel:hover {
  background: var(--glass-bg-hover);
}

/* Thread Actions */
.thread-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  background: var(--glass-bg);
}

.action-btn:hover {
  background: var(--glass-bg-hover);
  transform: translateY(-1px);
}

.reply-btn {
  color: var(--primary-color);
  border-color: var(--primary-color);
}

.reply-btn:hover {
  background: var(--primary-alpha-5);
}

.resolve-btn {
  color: var(--success-color);
  border-color: var(--success-color);
}

.resolve-btn:hover {
  background: var(--success-bg);
}

.reopen-btn {
  color: var(--info-color);
  border-color: var(--info-color);
}

.reopen-btn:hover {
  background: var(--info-bg);
}

/* CSS Variables */
:root {
  --primary-alpha-5: rgba(99, 102, 241, 0.05);
  --primary-alpha-10: rgba(99, 102, 241, 0.1);
  --primary-alpha-20: rgba(99, 102, 241, 0.2);
  --primary-color-dark: #6366f1;

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
  .thread-content {
    padding: 0.5rem;
  }

  .context-summary {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }

  .file-location {
    margin-left: 0;
  }

  .thread-actions {
    flex-direction: column;
  }

  .action-btn {
    justify-content: center;
  }
}
</style>