<template>
  <div
    :class="[
      'comment-card',
      `type-${comment.type}`,
      `severity-${comment.severity}`,
      { inline: inline }
    ]"
    @click="handleClick"
  >
    <!-- Header -->
    <div class="comment-header">
      <div class="comment-meta">
        <Icon :name="getTypeIcon(comment.type)" :size="16" />
        <span class="comment-type">{{ getTypeLabel(comment.type) }}</span>
        <span :class="['severity-badge', comment.severity]">
          {{ comment.severity }}
        </span>
      </div>
      <div class="comment-location">
        <Icon name="file-code" :size="12" />
        <span class="file-path">{{ getFileName(comment.file) }}</span>
        <span class="line-range">L{{ comment.lines.start }}-{{ comment.lines.end }}</span>
      </div>
    </div>

    <!-- Message -->
    <div class="comment-message">
      {{ cleanMessage }}
    </div>

    <!-- Fix Code (if available) -->
    <div v-if="comment.fixCode" class="comment-fix">
      <div class="fix-header">
        <Icon name="tool" :size="14" />
        <span>Suggested Fix</span>
        <button
          @click.stop="copyFix"
          class="copy-button"
          :title="copySuccess ? 'Copied!' : 'Copy code'"
        >
          <Icon :name="copySuccess ? 'check' : 'copy'" :size="14" />
        </button>
      </div>
      <pre class="fix-code"><code v-html="highlightFixCode(comment.fixCode)"></code></pre>

      <!-- Apply Fix Button -->
      <button
        v-if="comment.severity === 'high' || comment.fixCode"
        @click.stop="applyFix"
        :disabled="isApplying"
        class="apply-fix-button"
      >
        <Icon v-if="isApplying" name="spinner" :size="14" class="spinning" />
        <Icon v-else name="tool" :size="14" />
        {{ isApplying ? 'Applying...' : 'Apply Fix' }}
      </button>
    </div>

    <!-- Actions (for non-inline mode) -->
    <div v-if="!inline" class="comment-actions">
      <button
        @click.stop="navigateToCode"
        class="action-button navigate"
        title="Go to code"
      >
        <Icon name="arrow-right" :size="14" />
        Go to Code
      </button>

      <button
        v-if="comment.fixCode && comment.severity === 'high'"
        @click.stop="applyFix"
        :disabled="isApplying"
        class="action-button apply"
      >
        <Icon v-if="isApplying" name="spinner" :size="14" class="spinning" />
        <Icon v-else name="tool" :size="14" />
        Apply Fix
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import Icon from '../Icon.vue'
import type { Comment } from '../../services/CodeReviewService'

interface Props {
  comment: Comment
  inline?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  click: []
  'apply-fix': []
  'navigate': []
}>()

const isApplying = ref(false)
const copySuccess = ref(false)

// Clean up any markup in the message
const cleanMessage = computed(() => {
  // Remove any keyword-style markup that might be in the message
  return props.comment.message
    .replace(/<keyword[^>]*>/g, '')
    .replace(/<\/keyword>/g, '')
    .replace(/\[keyword[^\]]*\]/g, '')
    .replace(/\[\/keyword\]/g, '')
})

function getTypeIcon(type: string): string {
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

function getTypeLabel(type: string): string {
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

function getFileName(path: string): string {
  return path.split('/').pop() || path
}

function handleClick() {
  if (!props.inline) {
    emit('click')
  }
}

function navigateToCode() {
  emit('navigate')
  emit('click')
}

async function applyFix() {
  if (!props.comment.fixCode || isApplying.value) return

  isApplying.value = true
  emit('apply-fix')

  // Simulate applying fix
  setTimeout(() => {
    isApplying.value = false
  }, 1500)
}

async function copyFix() {
  if (!props.comment.fixCode) return

  try {
    await navigator.clipboard.writeText(props.comment.fixCode)
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
    }, 2000)
  } catch (error) {
    console.error('Failed to copy code:', error)
  }
}

function highlightFixCode(code: string): string {
  // First, clean up any existing markup that might be in the code
  // Remove any keyword-style tags that might be present
  let cleanCode = code
    .replace(/<keyword[^>]*>/g, '')
    .replace(/<\/keyword>/g, '')
    .replace(/\[keyword[^\]]*\]/g, '')
    .replace(/\[\/keyword\]/g, '')

  // Now just escape HTML to prevent XSS and display issues
  // We'll skip syntax highlighting for now to avoid conflicts
  return cleanCode
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
</script>

<style scoped>
.comment-card {
  padding: 1rem;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 0.5rem;
  transition: all 0.2s ease;
  cursor: pointer;
}

.comment-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--shadow-color);
}

.comment-card.inline {
  cursor: default;
  margin: 0.5rem 0;
  border-radius: 0.375rem;
}

.comment-card.inline:hover {
  transform: none;
  box-shadow: none;
}

/* Type-specific styling with unique colors */
.comment-card.type-issue {
  border-left: 3px solid #ef4444; /* Red */
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, transparent 100%);
}

.comment-card.type-bug {
  border-left: 3px solid #dc2626; /* Dark Red */
  background: linear-gradient(135deg, rgba(220, 38, 38, 0.05) 0%, transparent 100%);
}

.comment-card.type-error {
  border-left: 3px solid #b91c1c; /* Darker Red */
  background: linear-gradient(135deg, rgba(185, 28, 28, 0.05) 0%, transparent 100%);
}

.comment-card.type-warning {
  border-left: 3px solid #f59e0b; /* Amber */
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, transparent 100%);
}

.comment-card.type-suggestion {
  border-left: 3px solid #fbbf24; /* Yellow */
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.05) 0%, transparent 100%);
}

.comment-card.type-improvement {
  border-left: 3px solid #10b981; /* Emerald */
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, transparent 100%);
}

.comment-card.type-refactor {
  border-left: 3px solid #8b5cf6; /* Violet */
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, transparent 100%);
}

.comment-card.type-praise {
  border-left: 3px solid #22c55e; /* Green */
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, transparent 100%);
}

.comment-card.type-performance {
  border-left: 3px solid #ec4899; /* Pink */
  background: linear-gradient(135deg, rgba(236, 72, 153, 0.05) 0%, transparent 100%);
}

.comment-card.type-security {
  border-left: 3px solid #f97316; /* Orange */
  background: linear-gradient(135deg, rgba(249, 115, 22, 0.05) 0%, transparent 100%);
}

.comment-card.type-style {
  border-left: 3px solid #6366f1; /* Indigo */
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, transparent 100%);
}

.comment-card.type-documentation {
  border-left: 3px solid #06b6d4; /* Cyan */
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.05) 0%, transparent 100%);
}

.comment-card.type-test {
  border-left: 3px solid #14b8a6; /* Teal */
  background: linear-gradient(135deg, rgba(20, 184, 166, 0.05) 0%, transparent 100%);
}

.comment-card.type-question {
  border-left: 3px solid #a855f7; /* Purple */
  background: linear-gradient(135deg, rgba(168, 85, 247, 0.05) 0%, transparent 100%);
}

.comment-card.type-note {
  border-left: 3px solid #64748b; /* Slate */
  background: linear-gradient(135deg, rgba(100, 116, 139, 0.05) 0%, transparent 100%);
}

.comment-card.type-todo {
  border-left: 3px solid #0ea5e9; /* Sky */
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.05) 0%, transparent 100%);
}

/* Severity-specific styling */
.comment-card.severity-high {
  background: var(--error-alpha-5);
}

.comment-card.severity-medium {
  background: var(--warning-alpha-5);
}

/* Header */
.comment-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}

.comment-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.comment-type {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
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

.comment-location {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.file-path {
  font-family: 'Monaco', 'Courier New', monospace;
}

.line-range {
  font-family: 'Monaco', 'Courier New', monospace;
  font-weight: 500;
}

/* Message */
.comment-message {
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--text-primary);
  margin-bottom: 1rem;
}

/* Fix Code */
.comment-fix {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-subtle);
}

.fix-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.fix-header span {
  flex: 1;
}

.copy-button {
  padding: 0.25rem 0.5rem;
  background: var(--glass-bg-darker);
  border: 1px solid var(--border-subtle);
  border-radius: 0.25rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.copy-button:hover {
  background: var(--glass-bg-hover);
  color: var(--text-primary);
}

.fix-code {
  background: var(--code-bg);
  padding: 1rem;
  border-radius: 0.375rem;
  overflow-x: auto;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.75rem;
  line-height: 1.6;
  margin-bottom: 1rem;
}

.fix-code code {
  white-space: pre-wrap;
  word-break: break-word;
}

.apply-fix-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--error-gradient);
  border: none;
  border-radius: 0.375rem;
  color: white;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.apply-fix-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px var(--error-shadow);
}

.apply-fix-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Actions */
.comment-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-subtle);
}

.action-button {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: var(--glass-bg-darker);
  border: 1px solid var(--border-subtle);
  border-radius: 0.375rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-button:hover {
  background: var(--glass-bg-hover);
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.action-button.navigate {
  background: var(--primary-alpha-10);
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.action-button.apply {
  background: var(--error-alpha-10);
  border-color: var(--error-color);
  color: var(--error-color);
}

.action-button.apply:hover:not(:disabled) {
  background: var(--error-gradient);
  border-color: transparent;
  color: white;
}

/* Syntax Highlighting */
.fix-code :deep(.keyword) {
  color: var(--syntax-keyword);
  font-weight: 600;
}

.fix-code :deep(.string) {
  color: var(--syntax-string);
}

.fix-code :deep(.comment) {
  color: var(--syntax-comment);
  font-style: italic;
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
  --code-bg: rgba(30, 30, 30, 0.5);
  --error-shadow: rgba(239, 68, 68, 0.3);
  --error-gradient: linear-gradient(135deg, #ef4444, #dc2626);
  --error-alpha-5: rgba(239, 68, 68, 0.05);
  --error-alpha-10: rgba(239, 68, 68, 0.1);
  --warning-alpha-5: rgba(245, 158, 11, 0.05);
  --warning-alpha-10: rgba(245, 158, 11, 0.1);
  --success-alpha-5: rgba(34, 197, 94, 0.05);
  --success-alpha-10: rgba(34, 197, 94, 0.1);
  --primary-alpha-10: rgba(99, 102, 241, 0.1);

  /* Semantic colors */
  --error-bg: rgba(239, 68, 68, 0.1);
  --error-color: #ef4444;
  --warning-bg: rgba(245, 158, 11, 0.1);
  --warning-color: #f59e0b;
  --info-bg: rgba(59, 130, 246, 0.1);
  --info-color: #3b82f6;
  --success-bg: rgba(34, 197, 94, 0.1);
  --success-color: #22c55e;

  /* Syntax colors */
  --syntax-keyword: #569cd6;
  --syntax-string: #ce9178;
  --syntax-comment: #6a9955;
}

/* Responsive */
@media (max-width: 768px) {
  .comment-card {
    padding: 0.75rem;
  }

  .comment-header {
    flex-direction: column;
    gap: 0.5rem;
  }

  .comment-actions {
    flex-direction: column;
  }

  .action-button {
    width: 100%;
    justify-content: center;
  }
}
</style>