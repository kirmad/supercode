<template>
  <div class="review-list-manager">
    <!-- Header with Search and Actions -->
    <GlassCard :elevation="1" :hoverable="false" class="header-card">
      <div class="header-content">
        <div class="header-title">
          <Icon name="git-compare" />
          <h3>Saved Reviews</h3>
          <span v-if="filteredReviews.length > 0" class="review-count">
            {{ filteredReviews.length }} review{{ filteredReviews.length !== 1 ? 's' : '' }}
          </span>
        </div>

        <div class="header-actions">
          <!-- Search Input -->
          <div class="search-container">
            <Icon name="search" class="search-icon" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search reviews..."
              class="search-input"
              @keydown.escape="searchQuery = ''"
            />
            <button
              v-if="searchQuery"
              @click="searchQuery = ''"
              class="clear-search"
              title="Clear search"
            >
              <Icon name="x" :size="14" />
            </button>
          </div>

          <!-- New Review Button -->
          <ActionButton
            @click="createNewReview"
            variant="primary"
            size="medium"
            class="new-review-button"
          >
            <Icon name="plus" />
            New Review
          </ActionButton>
        </div>
      </div>

      <!-- Filters -->
      <div class="filters-section">
        <div class="filter-group">
          <label class="filter-label">Status:</label>
          <div class="filter-buttons">
            <button
              v-for="status in statusFilters"
              :key="status.id"
              @click="selectedStatus = status.id"
              :class="['filter-button', { active: selectedStatus === status.id }]"
            >
              <Icon :name="status.icon" :size="14" />
              {{ status.label }}
              <span v-if="getStatusCount(status.id) > 0" class="filter-count">
                {{ getStatusCount(status.id) }}
              </span>
            </button>
          </div>
        </div>

        <div class="filter-group">
          <label class="filter-label">Type:</label>
          <div class="filter-buttons">
            <button
              v-for="type in typeFilters"
              :key="type.id"
              @click="selectedType = type.id"
              :class="['filter-button', { active: selectedType === type.id }]"
            >
              <Icon :name="type.icon" :size="14" />
              {{ type.label }}
              <span v-if="getTypeCount(type.id) > 0" class="filter-count">
                {{ getTypeCount(type.id) }}
              </span>
            </button>
          </div>
        </div>

        <div class="filter-group">
          <label class="filter-label">Sort:</label>
          <select v-model="sortBy" class="sort-select">
            <option value="updatedAt">Last Updated</option>
            <option value="createdAt">Date Created</option>
            <option value="title">Title</option>
            <option value="status">Status</option>
          </select>
        </div>
      </div>
    </GlassCard>

    <!-- Loading State -->
    <TransitionGroup name="fade">
      <div v-if="isLoading" key="loading" class="loading-section">
        <GlassCard :elevation="1" :hoverable="false">
          <div class="loading-content">
            <Icon name="loader" class="spinning" />
            <span>Loading reviews...</span>
          </div>
        </GlassCard>
      </div>
    </TransitionGroup>

    <!-- Reviews List -->
    <div v-if="!isLoading" class="reviews-list">
      <TransitionGroup name="fade-scale">
        <GlassCard
          v-for="review in sortedReviews"
          :key="review.id"
          :elevation="1"
          :hoverable="true"
          class="review-item"
          @click="loadReview(review)"
        >
          <div class="review-header">
            <div class="review-title-section">
              <h4 class="review-title">{{ review.title }}</h4>
              <div class="review-meta">
                <span :class="['status-badge', review.status]">
                  <Icon :name="getStatusIcon(review.status)" :size="12" />
                  {{ review.status }}
                </span>
                <span class="review-type">
                  <Icon :name="getTypeIcon(review.type)" :size="12" />
                  {{ getTypeLabel(review.type) }}
                </span>
                <span class="review-date">
                  {{ formatDate(review.updatedAt) }}
                </span>
              </div>
            </div>

            <div class="review-actions" @click.stop>
              <button
                @click="duplicateReview(review)"
                class="action-button duplicate"
                title="Duplicate review"
              >
                <Icon name="copy" :size="14" />
              </button>
              <button
                @click="showDeleteConfirmation(review)"
                class="action-button delete"
                title="Delete review"
              >
                <Icon name="trash-2" :size="14" />
              </button>
            </div>
          </div>

          <div class="review-details">
            <div class="review-info">
              <div class="info-item">
                <Icon name="file-code" :size="14" />
                <span>{{ review.commentsCount }} comment{{ review.commentsCount !== 1 ? 's' : '' }}</span>
              </div>
              <div class="info-item">
                <Icon name="git-commit" :size="14" />
                <span>{{ review.hunksCount }} change{{ review.hunksCount !== 1 ? 's' : '' }}</span>
              </div>
              <div v-if="review.version > 1" class="info-item">
                <Icon name="layers" :size="14" />
                <span>v{{ review.version }}</span>
              </div>
            </div>

            <div v-if="review.description" class="review-description">
              {{ truncateText(review.description, 100) }}
            </div>
          </div>
        </GlassCard>
      </TransitionGroup>

      <!-- Empty State -->
      <div v-if="filteredReviews.length === 0 && !isLoading" class="empty-state">
        <GlassCard :elevation="1" :hoverable="false">
          <div class="empty-content">
            <Icon name="inbox" class="empty-icon" />
            <h3>{{ searchQuery ? 'No matching reviews' : 'No saved reviews yet' }}</h3>
            <p v-if="searchQuery">
              Try adjusting your search or filters to find reviews.
            </p>
            <p v-else>
              Create your first code review to get started.
            </p>
            <ActionButton
              v-if="!searchQuery"
              @click="createNewReview"
              variant="primary"
              size="medium"
              class="empty-action"
            >
              <Icon name="plus" />
              Create New Review
            </ActionButton>
          </div>
        </GlassCard>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <Teleport to="body">
      <div v-if="showDeleteModal" class="modal-overlay" @click="hideDeleteConfirmation">
        <GlassCard
          :elevation="3"
          class="delete-modal"
          @click.stop
        >
          <div class="modal-header">
            <Icon name="alert-triangle" class="warning-icon" />
            <h3>Delete Review</h3>
          </div>

          <div class="modal-content">
            <p>Are you sure you want to delete the review "<strong>{{ reviewToDelete?.title }}</strong>"?</p>
            <p class="warning-text">This action cannot be undone.</p>
          </div>

          <div class="modal-actions">
            <ActionButton
              @click="hideDeleteConfirmation"
              variant="secondary"
              size="medium"
            >
              Cancel
            </ActionButton>
            <ActionButton
              @click="confirmDelete"
              variant="primary"
              size="medium"
              class="delete-confirm"
              :loading="isDeleting"
            >
              <Icon v-if="!isDeleting" name="trash-2" />
              Delete Review
            </ActionButton>
          </div>
        </GlassCard>
      </div>
    </Teleport>

    <!-- Toast Notifications -->
    <Teleport to="body">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="['toast', toast.type]"
        >
          <Icon :name="getToastIcon(toast.type)" :size="16" />
          <span>{{ toast.message }}</span>
        </div>
      </TransitionGroup>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ReviewPersistenceService, type PersistenceCallbacks } from '../../services/ReviewPersistenceService'
import { type ReviewMetadata, type SavedCodeReview } from '../../types/CodeReview'
import GlassCard from '../shared/GlassCard.vue'
import ActionButton from '../shared/ActionButton.vue'
import Icon from '../Icon.vue'

// Component props
interface Props {
  persistenceService?: ReviewPersistenceService
}

const props = defineProps<Props>()

// Component emits
const emit = defineEmits<{
  'review-selected': [review: SavedCodeReview]
  'new-review': []
  'review-loaded': [review: SavedCodeReview]
  'review-deleted': [reviewId: string]
}>()

// State
const reviews = ref<ReviewMetadata[]>([])
const isLoading = ref(false)
const searchQuery = ref('')
const selectedStatus = ref('all')
const selectedType = ref('all')
const sortBy = ref('updatedAt')

// Delete modal state
const showDeleteModal = ref(false)
const reviewToDelete = ref<ReviewMetadata | null>(null)
const isDeleting = ref(false)

// Toast notifications
const toasts = ref<Array<{ id: string; type: 'success' | 'error' | 'info'; message: string }>>([])

// Filter options
const statusFilters = [
  { id: 'all', label: 'All', icon: 'filter' },
  { id: 'draft', label: 'Draft', icon: 'edit-3' },
  { id: 'active', label: 'Active', icon: 'activity' },
  { id: 'completed', label: 'Completed', icon: 'check-circle' },
  { id: 'archived', label: 'Archived', icon: 'archive' }
]

const typeFilters = [
  { id: 'all', label: 'All', icon: 'filter' },
  { id: 'branches', label: 'Branches', icon: 'git-branch' },
  { id: 'commit', label: 'Commit', icon: 'git-commit' },
  { id: 'diff', label: 'Diff', icon: 'file-diff' },
  { id: 'staged', label: 'Staged', icon: 'git-merge' }
]

// Service instance
const persistenceService = ref<ReviewPersistenceService | null>(null)

// Computed properties
const filteredReviews = computed(() => {
  let filtered = reviews.value

  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(review =>
      review.title.toLowerCase().includes(query) ||
      (review.description && review.description.toLowerCase().includes(query))
    )
  }

  // Filter by status
  if (selectedStatus.value !== 'all') {
    filtered = filtered.filter(review => review.status === selectedStatus.value)
  }

  // Filter by type
  if (selectedType.value !== 'all') {
    filtered = filtered.filter(review => review.type === selectedType.value)
  }

  return filtered
})

const sortedReviews = computed(() => {
  const sorted = [...filteredReviews.value]

  sorted.sort((a, b) => {
    switch (sortBy.value) {
      case 'updatedAt':
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      case 'createdAt':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      case 'title':
        return a.title.localeCompare(b.title)
      case 'status':
        return a.status.localeCompare(b.status)
      default:
        return 0
    }
  })

  return sorted
})

// Methods
function getStatusCount(status: string): number {
  if (status === 'all') return reviews.value.length
  return reviews.value.filter(review => review.status === status).length
}

function getTypeCount(type: string): number {
  if (type === 'all') return reviews.value.length
  return reviews.value.filter(review => review.type === type).length
}

function getStatusIcon(status: string): string {
  const icons = {
    draft: 'edit-3',
    active: 'activity',
    completed: 'check-circle',
    archived: 'archive'
  }
  return icons[status as keyof typeof icons] || 'circle'
}

function getTypeIcon(type: string): string {
  const icons = {
    branches: 'git-branch',
    commit: 'git-commit',
    diff: 'file-diff',
    staged: 'git-merge'
  }
  return icons[type as keyof typeof icons] || 'file'
}

function getTypeLabel(type: string): string {
  const labels = {
    branches: 'Branch Compare',
    commit: 'Commit Review',
    diff: 'Diff Review',
    staged: 'Staged Changes'
  }
  return labels[type as keyof typeof labels] || type
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return 'Today'
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return `${diffDays} days ago`
  } else {
    return date.toLocaleDateString()
  }
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength).trim() + '...'
}

async function loadReviews(): Promise<void> {
  if (!persistenceService.value) return

  isLoading.value = true
  try {
    const reviewList = await persistenceService.value.listReviews()
    reviews.value = reviewList
  } catch (error) {
    console.error('Failed to load reviews:', error)
    showToast('error', 'Failed to load reviews')
  } finally {
    isLoading.value = false
  }
}

async function loadReview(reviewMetadata: ReviewMetadata): Promise<void> {
  if (!persistenceService.value) return

  try {
    const review = await persistenceService.value.loadReview(reviewMetadata.id)
    emit('review-selected', review)
    emit('review-loaded', review)
    showToast('success', `Loaded review: ${review.metadata.title}`)
  } catch (error) {
    console.error('Failed to load review:', error)
    showToast('error', 'Failed to load review')
  }
}

function createNewReview(): void {
  emit('new-review')
}

async function duplicateReview(reviewMetadata: ReviewMetadata): Promise<void> {
  if (!persistenceService.value) return

  try {
    const originalReview = await persistenceService.value.loadReview(reviewMetadata.id)

    // Create duplicated review with new ID and modified title
    const duplicatedReview = {
      ...originalReview,
      id: undefined, // Will generate new ID
      metadata: {
        ...originalReview.metadata,
        title: `${originalReview.metadata.title} (Copy)`,
        status: 'draft' as const,
        version: 1
      }
    }

    // Convert back to save format
    const reviewResult = persistenceService.value.convertToReviewResult(originalReview)

    await persistenceService.value.saveReview(
      reviewResult,
      { title: duplicatedReview.metadata.title, status: 'draft' },
      originalReview.source,
      originalReview.analysis
    )

    await loadReviews() // Refresh list
    showToast('success', 'Review duplicated successfully')
  } catch (error) {
    console.error('Failed to duplicate review:', error)
    showToast('error', 'Failed to duplicate review')
  }
}

function showDeleteConfirmation(review: ReviewMetadata): void {
  reviewToDelete.value = review
  showDeleteModal.value = true
}

function hideDeleteConfirmation(): void {
  showDeleteModal.value = false
  reviewToDelete.value = null
  isDeleting.value = false
}

async function confirmDelete(): Promise<void> {
  if (!reviewToDelete.value || !persistenceService.value) return

  isDeleting.value = true
  try {
    await persistenceService.value.deleteReview(reviewToDelete.value.id)
    await loadReviews() // Refresh list
    emit('review-deleted', reviewToDelete.value.id)
    showToast('success', 'Review deleted successfully')
    hideDeleteConfirmation()
  } catch (error) {
    console.error('Failed to delete review:', error)
    showToast('error', 'Failed to delete review')
    isDeleting.value = false
  }
}

function showToast(type: 'success' | 'error' | 'info', message: string): void {
  const id = Date.now().toString()
  toasts.value.push({ id, type, message })

  setTimeout(() => {
    const index = toasts.value.findIndex(toast => toast.id === id)
    if (index > -1) {
      toasts.value.splice(index, 1)
    }
  }, 5000)
}

function getToastIcon(type: string): string {
  const icons = {
    success: 'check-circle',
    error: 'x-circle',
    info: 'info'
  }
  return icons[type as keyof typeof icons] || 'info'
}

// Lifecycle
onMounted(async () => {
  if (props.persistenceService) {
    persistenceService.value = props.persistenceService
  } else {
    persistenceService.value = new ReviewPersistenceService()
  }

  // Set up callbacks
  const callbacks: PersistenceCallbacks = {
    onReviewSaved: (reviewId, filename) => {
      console.log('Review saved:', reviewId, filename)
      loadReviews() // Refresh list
    },
    onReviewDeleted: (reviewId) => {
      console.log('Review deleted:', reviewId)
      loadReviews() // Refresh list
    },
    onError: (error) => {
      console.error('Persistence error:', error)
      showToast('error', error)
    }
  }

  persistenceService.value.setCallbacks(callbacks)
  await loadReviews()
})

onUnmounted(() => {
  if (persistenceService.value) {
    persistenceService.value.cleanup()
  }
})
</script>

<style scoped>
.review-list-manager {
  padding: 1.5rem;
  max-width: 100%;
  animation: fadeIn 0.3s ease;
}

/* Header */
.header-card {
  margin-bottom: 1.5rem;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-title h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.review-count {
  font-size: 0.875rem;
  color: var(--text-secondary);
  background: var(--glass-bg);
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  border: 1px solid var(--border-subtle);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.search-container {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  color: var(--text-tertiary);
  pointer-events: none;
}

.search-input {
  padding: 0.625rem 1rem 0.625rem 2.5rem;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  transition: all 0.2s ease;
  min-width: 250px;
}

.search-input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px var(--primary-alpha-10);
}

.clear-search {
  position: absolute;
  right: 0.5rem;
  padding: 0.25rem;
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: 0.25rem;
  transition: all 0.2s ease;
}

.clear-search:hover {
  background: var(--glass-bg-hover);
  color: var(--text-secondary);
}

/* Filters */
.filters-section {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  align-items: center;
  padding-top: 1rem;
  border-top: 1px solid var(--border-subtle);
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.filter-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  min-width: max-content;
}

.filter-buttons {
  display: flex;
  gap: 0.5rem;
}

.filter-button {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 1.5rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.filter-button:hover {
  background: var(--glass-bg-hover);
  border-color: var(--primary-color);
}

.filter-button.active {
  background: var(--primary-gradient);
  border-color: transparent;
  color: white;
}

.filter-count {
  padding: 0.125rem 0.375rem;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 1rem;
  font-size: 0.625rem;
  font-weight: 600;
}

.sort-select {
  padding: 0.375rem 0.75rem;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 0.375rem;
  font-size: 0.75rem;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.sort-select:focus {
  outline: none;
  border-color: var(--primary-color);
}

/* Loading */
.loading-section {
  margin-bottom: 1.5rem;
}

.loading-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  color: var(--text-secondary);
}

/* Reviews List */
.reviews-list {
  display: grid;
  gap: 1rem;
}

.review-item {
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 1.25rem;
}

.review-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px var(--shadow-color);
}

.review-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.review-title-section {
  flex: 1;
  min-width: 0;
}

.review-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.5rem 0;
  word-break: break-word;
}

.review-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 0.25rem;
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

.review-type,
.review-date {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.review-actions {
  display: flex;
  gap: 0.5rem;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.review-item:hover .review-actions {
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

.action-button.duplicate:hover {
  border-color: var(--info-color);
  color: var(--info-color);
}

.action-button.delete:hover {
  border-color: var(--error-color);
  color: var(--error-color);
}

.review-details {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.review-info {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.review-description {
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

/* Empty State */
.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
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

.empty-content h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.empty-content p {
  font-size: 0.875rem;
  max-width: 300px;
  line-height: 1.5;
  margin: 0;
}

.empty-action {
  margin-top: 0.5rem;
}

/* Delete Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

.delete-modal {
  min-width: 400px;
  max-width: 90vw;
}

.modal-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.warning-icon {
  color: var(--warning-color);
}

.modal-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.modal-content {
  margin-bottom: 1.5rem;
}

.modal-content p {
  font-size: 0.875rem;
  color: var(--text-primary);
  margin: 0 0 0.5rem 0;
  line-height: 1.5;
}

.warning-text {
  color: var(--text-secondary) !important;
  font-style: italic;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.delete-confirm {
  background: var(--error-gradient) !important;
}

/* Toast Notifications */
.toast {
  position: fixed;
  top: 1rem;
  right: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 0.5rem;
  color: var(--text-primary);
  box-shadow: 0 4px 12px var(--shadow-color);
  z-index: 1001;
  min-width: 250px;
  backdrop-filter: blur(10px);
}

.toast.success {
  border-left: 3px solid var(--success-color);
}

.toast.error {
  border-left: 3px solid var(--error-color);
}

.toast.info {
  border-left: 3px solid var(--info-color);
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

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-scale-enter-active {
  transition: all 0.3s ease;
}

.fade-scale-enter-from {
  opacity: 0;
  transform: scale(0.95);
}

.toast-enter-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

/* Responsive */
@media (max-width: 768px) {
  .review-list-manager {
    padding: 1rem;
  }

  .header-content {
    flex-direction: column;
    align-items: stretch;
  }

  .filters-section {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }

  .filter-group {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .filter-buttons {
    flex-wrap: wrap;
  }

  .search-input {
    min-width: auto;
    width: 100%;
  }

  .review-header {
    flex-direction: column;
    gap: 0.75rem;
  }

  .review-actions {
    opacity: 1;
    align-self: flex-end;
  }

  .delete-modal {
    min-width: auto;
    margin: 1rem;
  }

  .modal-actions {
    flex-direction: column;
  }
}
</style>