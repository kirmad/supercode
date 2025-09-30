<template>
  <Teleport to="body">
    <div v-if="isVisible" class="modal-overlay" @click="handleOverlayClick">
      <GlassCard
        :elevation="3"
        class="save-dialog"
        @click.stop
      >
        <!-- Dialog Header -->
        <div class="dialog-header">
          <div class="header-content">
            <Icon name="save" class="header-icon" />
            <h3 class="dialog-title">{{ isEditing ? 'Update Review' : 'Save Review' }}</h3>
          </div>
          <button
            @click="closeDialog"
            class="close-button"
            title="Close dialog"
          >
            <Icon name="x" :size="16" />
          </button>
        </div>

        <!-- Dialog Content -->
        <div class="dialog-content">
          <!-- Title Section -->
          <div class="form-section">
            <label class="form-label" for="review-title">
              <Icon name="edit-3" :size="14" />
              Review Title
            </label>
            <div class="title-input-container">
              <input
                id="review-title"
                ref="titleInputRef"
                v-model="formData.title"
                type="text"
                class="text-input"
                placeholder="Enter a descriptive title..."
                maxlength="100"
                @keydown.enter="handleTitleEnter"
                @input="validateForm"
              />
              <button
                v-if="canAutoGenerateTitle"
                @click="autoGenerateTitle"
                class="auto-generate-button"
                title="Auto-generate title from review content"
                :disabled="isGeneratingTitle"
              >
                <Icon v-if="isGeneratingTitle" name="loader" class="spinning" :size="14" />
                <Icon v-else name="zap" :size="14" />
                {{ isGeneratingTitle ? 'Generating...' : 'Auto' }}
              </button>
            </div>
            <div class="form-hint">
              <span class="char-count">{{ formData.title.length }}/100</span>
              <span class="hint-text">A descriptive title helps you find this review later</span>
            </div>
          </div>

          <!-- Status Section -->
          <div class="form-section">
            <label class="form-label">
              <Icon name="activity" :size="14" />
              Status
            </label>
            <div class="status-buttons">
              <button
                v-for="status in statusOptions"
                :key="status.id"
                @click="formData.status = status.id"
                :class="['status-button', { active: formData.status === status.id }]"
              >
                <Icon :name="status.icon" :size="16" />
                <div class="status-info">
                  <span class="status-name">{{ status.label }}</span>
                  <span class="status-description">{{ status.description }}</span>
                </div>
              </button>
            </div>
          </div>

          <!-- Review Summary -->
          <div v-if="reviewSummary" class="form-section">
            <label class="form-label">
              <Icon name="info" :size="14" />
              Review Summary
            </label>
            <div class="summary-card">
              <div class="summary-stats">
                <div class="stat-item">
                  <Icon name="file-code" :size="16" />
                  <span class="stat-label">Comments</span>
                  <span class="stat-value">{{ reviewSummary.commentsCount }}</span>
                </div>
                <div class="stat-item">
                  <Icon name="git-commit" :size="16" />
                  <span class="stat-label">Changes</span>
                  <span class="stat-value">{{ reviewSummary.hunksCount }}</span>
                </div>
                <div class="stat-item">
                  <Icon name="zap" :size="16" />
                  <span class="stat-label">Insights</span>
                  <span class="stat-value">{{ reviewSummary.insightsCount }}</span>
                </div>
              </div>
              <div v-if="reviewSummary.source" class="summary-source">
                <Icon :name="getSourceIcon(reviewSummary.source.type)" :size="14" />
                <span class="source-type">{{ getSourceLabel(reviewSummary.source.type) }}</span>
                <span class="source-detail">{{ getSourceDetail(reviewSummary.source) }}</span>
              </div>
            </div>
          </div>

          <!-- Error Display -->
          <div v-if="errorMessage" class="error-section">
            <div class="error-message">
              <Icon name="alert-circle" :size="16" />
              <span>{{ errorMessage }}</span>
            </div>
          </div>

          <!-- Success Display -->
          <div v-if="successMessage" class="success-section">
            <div class="success-message">
              <Icon name="check-circle" :size="16" />
              <span>{{ successMessage }}</span>
            </div>
          </div>
        </div>

        <!-- Dialog Actions -->
        <div class="dialog-actions">
          <ActionButton
            @click="closeDialog"
            variant="secondary"
            size="medium"
            :disabled="isSaving"
          >
            Cancel
          </ActionButton>

          <ActionButton
            @click="saveReview"
            variant="primary"
            size="medium"
            :disabled="!isFormValid || isSaving"
            :loading="isSaving"
            class="save-button"
          >
            <Icon v-if="!isSaving" name="save" />
            {{ isSaving ? 'Saving...' : (isEditing ? 'Update Review' : 'Save Review') }}
          </ActionButton>
        </div>

        <!-- Keyboard Shortcuts Help -->
        <div class="shortcuts-hint">
          <div class="shortcut-item">
            <kbd>Ctrl+Enter</kbd>
            <span>Save review</span>
          </div>
          <div class="shortcut-item">
            <kbd>Esc</kbd>
            <span>Cancel</span>
          </div>
        </div>
      </GlassCard>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import GlassCard from '../shared/GlassCard.vue'
import ActionButton from '../shared/ActionButton.vue'
import Icon from '../Icon.vue'

// Component props
interface ReviewSource {
  type: 'branches' | 'commit' | 'diff' | 'staged'
  sourceBranch?: string
  targetBranch?: string
  commitHash?: string
  customDiff?: string
}

interface ReviewSummary {
  commentsCount: number
  hunksCount: number
  insightsCount: number
  source?: ReviewSource
}

interface SaveData {
  title: string
  status: 'draft' | 'active' | 'completed' | 'archived'
}

interface Props {
  isVisible: boolean
  initialTitle?: string
  initialStatus?: 'draft' | 'active' | 'completed' | 'archived'
  reviewSummary?: ReviewSummary
  isEditing?: boolean
  canAutoGenerateTitle?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isVisible: false,
  initialTitle: '',
  initialStatus: 'draft',
  isEditing: false,
  canAutoGenerateTitle: true
})

// Component emits
const emit = defineEmits<{
  'save': [data: SaveData]
  'close': []
  'auto-generate-title': []
}>()

// Form state
const formData = ref<SaveData>({
  title: '',
  status: 'draft'
})

// UI state
const isSaving = ref(false)
const isGeneratingTitle = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const titleInputRef = ref<HTMLInputElement | null>(null)

// Status options
const statusOptions = [
  {
    id: 'draft' as const,
    label: 'Draft',
    description: 'Work in progress, not ready for review',
    icon: 'edit-3'
  },
  {
    id: 'active' as const,
    label: 'Active',
    description: 'Ready for review and discussion',
    icon: 'activity'
  },
  {
    id: 'completed' as const,
    label: 'Completed',
    description: 'Review finished, all issues addressed',
    icon: 'check-circle'
  },
  {
    id: 'archived' as const,
    label: 'Archived',
    description: 'Historical record, no longer active',
    icon: 'archive'
  }
]

// Computed properties
const isFormValid = computed(() => {
  return formData.value.title.trim().length > 0 &&
         formData.value.title.trim().length <= 100
})

// Methods
function validateForm(): void {
  errorMessage.value = ''

  if (formData.value.title.length > 100) {
    errorMessage.value = 'Title must be 100 characters or less'
  }
}

function getSourceIcon(type: string): string {
  const icons = {
    branches: 'git-branch',
    commit: 'git-commit',
    diff: 'file-diff',
    staged: 'git-merge'
  }
  return icons[type as keyof typeof icons] || 'file'
}

function getSourceLabel(type: string): string {
  const labels = {
    branches: 'Branch Compare',
    commit: 'Commit Review',
    diff: 'Diff Review',
    staged: 'Staged Changes'
  }
  return labels[type as keyof typeof labels] || type
}

function getSourceDetail(source: ReviewSource): string {
  switch (source.type) {
    case 'branches':
      return `${source.sourceBranch} → ${source.targetBranch}`
    case 'commit':
      return source.commitHash?.substring(0, 8) || 'Unknown commit'
    case 'diff':
      return 'Custom diff'
    case 'staged':
      return 'Staged changes'
    default:
      return ''
  }
}

async function autoGenerateTitle(): Promise<void> {
  if (!props.canAutoGenerateTitle || isGeneratingTitle.value) return

  isGeneratingTitle.value = true
  errorMessage.value = ''

  try {
    emit('auto-generate-title')

    // Simulate auto-generation delay
    await new Promise(resolve => setTimeout(resolve, 1500))

    // Generate title based on review summary
    let generatedTitle = 'Code Review'

    if (props.reviewSummary?.source) {
      const source = props.reviewSummary.source
      switch (source.type) {
        case 'branches':
          generatedTitle = `Review: ${source.sourceBranch} → ${source.targetBranch}`
          break
        case 'commit':
          generatedTitle = `Review: Commit ${source.commitHash?.substring(0, 8)}`
          break
        case 'diff':
          generatedTitle = 'Review: Custom Diff'
          break
        case 'staged':
          generatedTitle = 'Review: Staged Changes'
          break
      }
    }

    // Add comment count if available
    if (props.reviewSummary?.commentsCount) {
      generatedTitle += ` (${props.reviewSummary.commentsCount} comments)`
    }

    // Add timestamp to make it unique
    const now = new Date()
    const timestamp = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
    generatedTitle += ` - ${timestamp}`

    formData.value.title = generatedTitle
    validateForm()

  } catch (error) {
    console.error('Failed to auto-generate title:', error)
    errorMessage.value = 'Failed to generate title automatically'
  } finally {
    isGeneratingTitle.value = false
  }
}

function handleTitleEnter(event: KeyboardEvent): void {
  // Prevent form submission on Enter, but allow Ctrl+Enter for save
  if (!event.ctrlKey && !event.metaKey) {
    event.preventDefault()
  }
}

async function saveReview(): Promise<void> {
  if (!isFormValid.value || isSaving.value) return

  isSaving.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    emit('save', {
      title: formData.value.title.trim(),
      status: formData.value.status
    })

    successMessage.value = props.isEditing ? 'Review updated successfully!' : 'Review saved successfully!'

    // Auto-close after brief delay
    setTimeout(() => {
      closeDialog()
    }, 1500)

  } catch (error) {
    console.error('Failed to save review:', error)
    errorMessage.value = 'Failed to save review. Please try again.'
    isSaving.value = false
  }
}

function closeDialog(): void {
  if (isSaving.value) return

  // Reset form and state
  errorMessage.value = ''
  successMessage.value = ''
  isGeneratingTitle.value = false

  emit('close')
}

function handleOverlayClick(event: MouseEvent): void {
  // Only close if clicking directly on overlay, not on dialog content
  if (event.target === event.currentTarget) {
    closeDialog()
  }
}

// Keyboard shortcuts
function handleKeyDown(event: KeyboardEvent): void {
  if (!props.isVisible) return

  if (event.key === 'Escape') {
    event.preventDefault()
    closeDialog()
  } else if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    saveReview()
  }
}

// Watchers
watch(() => props.isVisible, async (isVisible) => {
  if (isVisible) {
    // Reset form with initial values
    formData.value = {
      title: props.initialTitle || '',
      status: props.initialStatus || 'draft'
    }

    errorMessage.value = ''
    successMessage.value = ''

    // Focus title input after dialog opens
    await nextTick()
    if (titleInputRef.value) {
      titleInputRef.value.focus()
      titleInputRef.value.select()
    }
  }
})

// Lifecycle
onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
/* Modal Overlay */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
  backdrop-filter: blur(4px);
}

/* Save Dialog */
.save-dialog {
  min-width: 500px;
  max-width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Dialog Header */
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-subtle);
}

.header-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-icon {
  color: var(--primary-color);
}

.dialog-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.close-button {
  padding: 0.375rem;
  background: transparent;
  border: 1px solid var(--border-subtle);
  border-radius: 0.375rem;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-button:hover {
  background: var(--glass-bg-hover);
  border-color: var(--error-color);
  color: var(--error-color);
}

/* Dialog Content */
.dialog-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

/* Form Sections */
.form-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.form-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
}

/* Title Input */
.title-input-container {
  position: relative;
  display: flex;
  gap: 0.5rem;
}

.text-input {
  flex: 1;
  padding: 0.75rem 1rem;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  transition: all 0.2s ease;
}

.text-input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px var(--primary-alpha-10);
}

.auto-generate-button {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.75rem 1rem;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.auto-generate-button:hover:not(:disabled) {
  background: var(--glass-bg-hover);
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.auto-generate-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.form-hint {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.char-count {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  font-family: 'Monaco', 'Courier New', monospace;
}

.hint-text {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  flex: 1;
}

/* Status Buttons */
.status-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.status-button {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.status-button:hover {
  background: var(--glass-bg-hover);
  border-color: var(--primary-color);
  transform: translateY(-2px);
}

.status-button.active {
  background: var(--primary-alpha-10);
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px var(--primary-alpha-10);
}

.status-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
}

.status-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
}

.status-description {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  line-height: 1.4;
}

/* Summary Card */
.summary-card {
  padding: 1rem;
  background: var(--glass-bg-darker);
  border: 1px solid var(--border-subtle);
  border-radius: 0.5rem;
}

.summary-stats {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 120px;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  flex: 1;
}

.stat-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
}

.summary-source {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-subtle);
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.source-type {
  font-weight: 600;
}

.source-detail {
  color: var(--text-tertiary);
  font-family: 'Monaco', 'Courier New', monospace;
}

/* Error and Success Messages */
.error-section,
.success-section {
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  margin: -0.5rem 0 0.5rem 0;
}

.error-section {
  background: var(--error-alpha-10);
  border: 1px solid var(--error-alpha-20);
}

.success-section {
  background: var(--success-alpha-10);
  border: 1px solid var(--success-alpha-20);
}

.error-message,
.success-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.error-message {
  color: var(--error-color);
}

.success-message {
  color: var(--success-color);
}

/* Dialog Actions */
.dialog-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  padding-top: 1rem;
  border-top: 1px solid var(--border-subtle);
}

.save-button {
  min-width: 140px;
}

/* Keyboard Shortcuts */
.shortcuts-hint {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border-subtle);
}

.shortcut-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

kbd {
  padding: 0.25rem 0.5rem;
  background: var(--glass-bg-darker);
  border: 1px solid var(--border-subtle);
  border-radius: 0.25rem;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.625rem;
  color: var(--text-secondary);
}

/* Animations */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

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
  --primary-alpha-10: rgba(99, 102, 241, 0.1);
  --primary-alpha-20: rgba(99, 102, 241, 0.2);
  --error-alpha-10: rgba(239, 68, 68, 0.1);
  --error-alpha-20: rgba(239, 68, 68, 0.2);
  --success-alpha-10: rgba(34, 197, 94, 0.1);
  --success-alpha-20: rgba(34, 197, 94, 0.2);
}

/* Responsive */
@media (max-width: 768px) {
  .save-dialog {
    min-width: auto;
    margin: 1rem;
    max-height: calc(100vh - 2rem);
  }

  .status-buttons {
    grid-template-columns: 1fr;
  }

  .summary-stats {
    flex-direction: column;
    gap: 0.75rem;
  }

  .stat-item {
    min-width: auto;
  }

  .dialog-actions {
    flex-direction: column;
    gap: 0.5rem;
  }

  .save-button {
    width: 100%;
  }

  .shortcuts-hint {
    flex-direction: column;
    gap: 0.5rem;
  }

  .title-input-container {
    flex-direction: column;
  }

  .auto-generate-button {
    align-self: flex-start;
  }
}
</style>