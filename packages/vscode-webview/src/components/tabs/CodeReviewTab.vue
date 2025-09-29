<template>
  <div class="code-review-tab">
    <!-- Input Section -->
    <div class="review-input-section">
      <GlassCard :elevation="1" :hoverable="false" class="input-card">
        <h3 class="section-title">
          <Icon name="git-compare" />
          Code Review Request
        </h3>

        <div class="input-options">
          <!-- Review Type Selection -->
          <div class="review-type-selector">
            <label class="input-label">Review Type:</label>
            <div class="type-buttons">
              <button
                v-for="type in reviewTypes"
                :key="type.id"
                @click="selectedReviewType = type.id"
                :class="['type-button', { active: selectedReviewType === type.id }]"
              >
                <Icon :name="type.icon" />
                {{ type.label }}
              </button>
            </div>
          </div>

          <!-- Branch/Commit Input -->
          <div v-if="selectedReviewType === 'branches'" class="branch-inputs">
            <div class="input-group">
              <label class="input-label">Source Branch:</label>
              <select v-model="sourceBranch" class="text-input">
                <option value="">Select a branch...</option>
                <option v-for="branch in availableBranches" :key="branch" :value="branch">
                  {{ branch }} {{ branch === currentBranch ? '(current)' : '' }}
                </option>
              </select>
            </div>
            <div class="input-group">
              <label class="input-label">Target Branch:</label>
              <select v-model="targetBranch" class="text-input">
                <option value="">Select a branch...</option>
                <option v-for="branch in availableBranches" :key="branch" :value="branch">
                  {{ branch }} {{ branch === 'main' || branch === 'master' ? '(default)' : '' }}
                </option>
              </select>
            </div>
          </div>

          <div v-else-if="selectedReviewType === 'commit'" class="commit-input">
            <div class="input-group">
              <label class="input-label">Select Commit:</label>
              <select v-model="commitHash" class="text-input">
                <option value="">Select a commit...</option>
                <option v-for="commit in recentCommits" :key="commit.hash" :value="commit.hash">
                  {{ commit.shortHash }} - {{ commit.subject }} ({{ commit.date }})
                </option>
              </select>
            </div>
            <div class="input-group" v-if="commitHash">
              <label class="input-label">Or enter hash directly:</label>
              <input
                v-model="commitHash"
                type="text"
                class="text-input"
                placeholder="abc123def..."
                @keydown.enter="startReview"
              />
            </div>
          </div>

          <div v-else-if="selectedReviewType === 'diff'" class="diff-input">
            <div class="input-group">
              <label class="input-label">Paste Git Diff:</label>
              <textarea
                v-model="customDiff"
                class="diff-textarea"
                placeholder="Paste your git diff here..."
                rows="8"
              />
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="action-buttons">
            <ActionButton
              @click="startReview"
              :disabled="!canStartReview || isReviewing"
              variant="primary"
              size="large"
              class="review-button"
            >
              <Icon v-if="isReviewing" name="spinner" class="spinning" />
              <Icon v-else name="play-circle" />
              {{ isReviewing ? 'Reviewing...' : 'Start Review' }}
            </ActionButton>

            <ActionButton
              v-if="isReviewing"
              @click="cancelReview"
              variant="secondary"
              size="large"
              class="cancel-button"
            >
              <Icon name="x-circle" />
              Cancel
            </ActionButton>
          </div>
        </div>
      </GlassCard>
    </div>

    <!-- Progress Section -->
    <TransitionGroup name="fade">
      <div v-if="progressMessage" key="progress" class="progress-section">
        <GlassCard :elevation="1" :hoverable="false">
          <div class="progress-content">
            <Icon name="loader" class="spinning" />
            <span class="progress-message">{{ progressMessage }}</span>
          </div>
        </GlassCard>
      </div>
    </TransitionGroup>

    <!-- Insights Section -->
    <TransitionGroup name="slide-up">
      <div v-if="insights.length > 0" key="insights" class="insights-section">
        <GlassCard :elevation="1" :hoverable="false">
          <h3 class="section-title collapsible" @click="insightsCollapsed = !insightsCollapsed">
            <Icon :name="insightsCollapsed ? 'chevron-right' : 'chevron-down'" class="collapse-icon" />
            <Icon name="zap" />
            Review Insights ({{ insights.length }})
          </h3>

          <div v-show="!insightsCollapsed" class="insights-grid">
            <TransitionGroup name="fade-scale">
              <div
                v-for="(insight, index) in insights"
                :key="index"
                :class="['insight-card', `severity-${insight.severity}`, `type-${insight.type}`]"
              >
                <div class="insight-header">
                  <Icon :name="getInsightIcon(insight.type)" />
                  <span class="insight-type">{{ insight.type }}</span>
                  <span :class="['severity-badge', insight.severity]">
                    {{ insight.severity }}
                  </span>
                </div>
                <div class="insight-message">{{ insight.message }}</div>
              </div>
            </TransitionGroup>
          </div>
        </GlassCard>
      </div>
    </TransitionGroup>

    <!-- Review Results Section -->
    <TransitionGroup name="slide-up">
      <div v-if="reviewResult" key="results" class="results-section">
        <!-- Hunks Overview -->
        <GlassCard :elevation="1" :hoverable="false" class="hunks-section">
          <h3 class="section-title collapsible" @click="hunksCollapsed = !hunksCollapsed">
            <Icon :name="hunksCollapsed ? 'chevron-right' : 'chevron-down'" class="collapse-icon" />
            <Icon name="git-commit" />
            Change Hunks ({{ reviewResult.hunks.length }})
          </h3>

          <div v-show="!hunksCollapsed" class="hunks-list">
            <div
              v-for="(hunk, index) in reviewResult.hunks"
              :key="index"
              :class="['hunk-card', { 'needs-attention': hunk.needsAttention }]"
              @click="scrollToFile(hunk.file, hunk.start)"
            >
              <div class="hunk-header">
                <div class="hunk-file">
                  <Icon name="file-code" />
                  {{ hunk.file }}
                </div>
                <div class="hunk-meta">
                  <span :class="['category-badge', hunk.category]">
                    {{ hunk.category }}
                  </span>
                  <span :class="['risk-badge', hunk.risk]">
                    {{ hunk.risk }} risk
                  </span>
                  <span v-if="hunk.needsAttention" class="attention-badge">
                    <Icon name="alert-triangle" />
                    Needs Attention
                  </span>
                </div>
              </div>
              <div class="hunk-description">
                {{ hunk.description }}
              </div>
              <div class="hunk-lines">
                Lines {{ hunk.start }}-{{ hunk.end }}
              </div>
            </div>
          </div>
        </GlassCard>

        <!-- Diff Viewer with Comments -->
        <GlassCard :elevation="1" :hoverable="false" class="diff-viewer-section">
          <h3 class="section-title">
            <Icon name="code" />
            Code Changes & Comments
          </h3>

          <!-- View Mode Toggle -->
          <div class="view-mode-toggle">
            <button
              v-for="mode in viewModes"
              :key="mode.id"
              @click="selectedViewMode = mode.id"
              :class="['mode-button', { active: selectedViewMode === mode.id }]"
            >
              <Icon :name="mode.icon" />
              {{ mode.label }}
            </button>
          </div>

          <!-- Diff Content -->
          <div class="diff-content">
            <DiffViewer
              v-if="currentDiffFiles.length > 0"
              ref="diffViewerRef"
              :files="currentDiffFiles"
              :comments="reviewResult.comments"
              :hunks="reviewResult.hunks"
              :viewMode="selectedViewMode"
              @comment-click="handleCommentClick"
            />
            <div v-else class="no-diff-message">
              <Icon name="file-x" />
              <p>No diff data available. Please provide a diff or select branches to compare.</p>
            </div>
          </div>
        </GlassCard>

        <!-- Comments Summary -->
        <GlassCard :elevation="1" :hoverable="false" class="comments-section">
          <h3 class="section-title">
            <Icon name="message-square" />
            Review Comments ({{ reviewResult.comments.length }})
          </h3>

          <!-- Comment Filters -->
          <div class="comment-filters">
            <button
              v-for="filter in commentFilters"
              :key="filter.id"
              @click="selectedCommentFilter = filter.id"
              :class="['filter-button', { active: selectedCommentFilter === filter.id }]"
            >
              {{ filter.label }}
              <span class="filter-count">{{ getFilteredComments(filter.id).length }}</span>
            </button>
          </div>

          <!-- Comments List -->
          <div class="comments-list">
            <TransitionGroup name="fade">
              <CommentCard
                v-for="comment in filteredComments"
                :key="`${comment.file}-${comment.lines.start}`"
                :comment="comment"
                @click="scrollToComment(comment)"
                @apply-fix="applyFix(comment)"
              />
            </TransitionGroup>
          </div>
        </GlassCard>
      </div>
    </TransitionGroup>

    <!-- Empty State -->
    <div v-if="!isReviewing && !reviewResult && insights.length === 0" class="empty-state">
      <GlassCard :elevation="1" :hoverable="false">
        <div class="empty-content">
          <Icon name="code-review" class="empty-icon" />
          <h3>Ready to Review Code</h3>
          <p>Select a review type above and provide the necessary information to start your code review.</p>
        </div>
      </GlassCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { CodeReviewService, ReviewInsight, ReviewResult, DiffFile, Comment } from '../../services/CodeReviewService'
import GlassCard from '../shared/GlassCard.vue'
import ActionButton from '../shared/ActionButton.vue'
import Icon from '../Icon.vue'
import DiffViewer from '../review/DiffViewer.vue'
import CommentCard from '../review/CommentCard.vue'

// Collapse states
const insightsCollapsed = ref(false)
const hunksCollapsed = ref(false)

// Component refs
const diffViewerRef = ref<InstanceType<typeof DiffViewer> | null>(null)

// Props
interface Props {
  taskData?: any
  wsClient?: any // SuperCodeWebSocketClient instance - matches prop name from parent
}

const props = defineProps<Props>()

// Service instance - use the client passed from parent
const reviewService = ref<CodeReviewService | null>(null)

// Review types
const reviewTypes = [
  { id: 'branches', label: 'Compare Branches', icon: 'git-branch' },
  { id: 'commit', label: 'Review Commit', icon: 'git-commit' },
  { id: 'diff', label: 'Review Diff', icon: 'file-diff' }
]

// View modes
const viewModes = [
  { id: 'unified', label: 'Unified', icon: 'align-left' },
  { id: 'split', label: 'Side-by-Side', icon: 'columns' }
]

// Comment filters
const commentFilters = [
  { id: 'all', label: 'All' },
  { id: 'issues', label: 'Issues' },
  { id: 'suggestions', label: 'Suggestions' },
  { id: 'praise', label: 'Praise' },
  { id: 'high', label: 'High Severity' }
]

// State
const selectedReviewType = ref('branches')
const selectedViewMode = ref('unified')
const selectedCommentFilter = ref('all')

const sourceBranch = ref('')
const targetBranch = ref('main')
const commitHash = ref('')
const customDiff = ref('')

const isReviewing = ref(false)
const progressMessage = ref('')
const insights = ref<ReviewInsight[]>([])
const reviewResult = ref<ReviewResult | null>(null)
const currentDiffFiles = ref<DiffFile[]>([])

// Git data
const availableBranches = ref<string[]>([])
const currentBranch = ref('')
const recentCommits = ref<Array<{ hash: string; shortHash: string; subject: string; author: string; date: string }>>([])
const gitStatus = ref<any>(null)

// Computed
const canStartReview = computed(() => {
  switch (selectedReviewType.value) {
    case 'branches':
      return sourceBranch.value && targetBranch.value
    case 'commit':
      return commitHash.value
    case 'diff':
      return customDiff.value
    default:
      return false
  }
})

const filteredComments = computed(() => {
  if (!reviewResult.value) return []
  return getFilteredComments(selectedCommentFilter.value)
})

// Methods
function getFilteredComments(filterId: string) {
  if (!reviewResult.value) return []

  const comments = reviewResult.value.comments

  switch (filterId) {
    case 'all':
      return comments
    case 'issues':
      return comments.filter(c => c.type === 'issue')
    case 'suggestions':
      return comments.filter(c => c.type === 'suggestion')
    case 'praise':
      return comments.filter(c => c.type === 'praise')
    case 'high':
      return comments.filter(c => c.severity === 'high')
    default:
      return comments
  }
}

function getInsightIcon(type: string) {
  const icons: Record<string, string> = {
    security: 'shield-alert',
    bug: 'bug',
    performance: 'activity',
    quality: 'star',
    pattern: 'layers'
  }
  return icons[type] || 'info'
}

async function startReview() {
  if (!canStartReview.value || isReviewing.value || !reviewService.value) return

  insights.value = []
  reviewResult.value = null
  isReviewing.value = true

  const options: any = {}

  switch (selectedReviewType.value) {
    case 'branches':
      options.sourceBranch = sourceBranch.value
      options.targetBranch = targetBranch.value
      break
    case 'commit':
      options.commitHash = commitHash.value
      break
    case 'diff':
      options.diff = customDiff.value
      break
  }

  await reviewService.value.startReview(options)
}

function cancelReview() {
  if (!reviewService.value) return
  reviewService.value.cancelReview()
  isReviewing.value = false
  progressMessage.value = ''
}

function scrollToFile(file: string, line: number) {
  // First, select the file in the diff viewer
  if (diffViewerRef.value) {
    const fileSelected = diffViewerRef.value.selectFile(file)
    if (fileSelected) {
      // Wait a tick for the DOM to update after file selection
      nextTick(() => {
        const element = document.querySelector(`[data-file="${file}"][data-line="${line}"]`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })

          // Add highlight effect
          element.classList.add('highlight-line')
          setTimeout(() => {
            element.classList.remove('highlight-line')
          }, 2000)
        }
      })
    }
  }
}

function scrollToComment(comment: Comment) {
  scrollToFile(comment.file, comment.lines.start)
}

function handleCommentClick(comment: Comment) {
  // Handle comment click in diff viewer
  console.log('Comment clicked:', comment)
}

function applyFix(comment: Comment) {
  if (!comment.fixCode) return

  // Implement fix application
  console.log('Applying fix for comment:', comment)
  // This would integrate with the editor to apply the suggested fix
}

async function fetchGitData() {
  if (!reviewService.value) return

  try {
    // Fetch branches
    const branchData = await reviewService.value.fetchGitBranches()
    availableBranches.value = branchData.branches
    currentBranch.value = branchData.current

    // Set default source branch to current branch
    if (!sourceBranch.value && currentBranch.value) {
      sourceBranch.value = currentBranch.value
    }

    // Fetch recent commits
    recentCommits.value = await reviewService.value.fetchRecentCommits(20)

    // Fetch git status
    gitStatus.value = await reviewService.value.fetchGitStatus()
  } catch (error) {
    console.error('Failed to fetch git data:', error)
  }
}

// Lifecycle
onMounted(async () => {
  if (props.wsClient) {
    reviewService.value = new CodeReviewService(props.wsClient)

    // Set up callbacks
    reviewService.value.setCallbacks({
      onInsightReceived: (insight) => {
        insights.value.push(insight)
      },
      onReviewComplete: (result) => {
        reviewResult.value = result
        isReviewing.value = false
        progressMessage.value = ''

        // If we have diff files from the review, update them
        if (result && reviewService.value) {
          const files = reviewService.value.getCurrentFiles()
          if (files && files.length > 0) {
            currentDiffFiles.value = files
          }
        }
      },
      onProgressUpdate: (message) => {
        progressMessage.value = message
      },
      onError: (error) => {
        console.error('Review error:', error)
        isReviewing.value = false
        progressMessage.value = ''
      }
    })

    // Fetch git data on mount
    await fetchGitData()
  }
})

onUnmounted(() => {
  // Cleanup if needed
  if (reviewService.value) {
    reviewService.value.cancelReview()
  }
})

</script>

<style scoped>
.code-review-tab {
  padding: 1.5rem;
  max-width: 100%;
  animation: fadeIn 0.3s ease;
}

/* Input Section */
.review-input-section {
  margin-bottom: 2rem;
}

.input-card {
  padding: 1.5rem;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 1.5rem;
}

.section-title.collapsible {
  cursor: pointer;
  user-select: none;
  transition: opacity 0.2s ease;
}

.section-title.collapsible:hover {
  opacity: 0.8;
}

.collapse-icon {
  transition: transform 0.3s ease;
  flex-shrink: 0;
}

.input-options {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.review-type-selector {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.input-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
  display: block;
}

.type-buttons {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.type-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.type-button:hover {
  background: var(--glass-bg-hover);
  border-color: var(--primary-color);
  transform: translateY(-1px);
}

.type-button.active {
  background: var(--primary-gradient);
  border-color: transparent;
  color: white;
}

.branch-inputs,
.commit-input {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.input-group {
  flex: 1;
  min-width: 200px;
}

.text-input {
  width: 100%;
  padding: 0.625rem 1rem;
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

.diff-textarea {
  width: 100%;
  padding: 1rem;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 0.5rem;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.75rem;
  color: var(--text-primary);
  resize: vertical;
  transition: all 0.2s ease;
}

.diff-textarea:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px var(--primary-alpha-10);
}

.action-buttons {
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;
}

/* Progress Section */
.progress-section {
  margin-bottom: 1.5rem;
}

.progress-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  color: var(--text-secondary);
}

.progress-message {
  font-size: 0.875rem;
}

/* Insights Section */
.insights-section {
  margin-bottom: 1.5rem;
}

.insights-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}

.insight-card {
  padding: 1rem;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 0.5rem;
  transition: all 0.2s ease;
}

.insight-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--shadow-color);
}

.insight-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.insight-type {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-secondary);
  flex: 1;
}

.severity-badge {
  padding: 0.25rem 0.5rem;
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

.insight-message {
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--text-primary);
}

.insight-card.type-security {
  border-left: 3px solid var(--error-color);
}

.insight-card.type-bug {
  border-left: 3px solid var(--warning-color);
}

.insight-card.type-performance {
  border-left: 3px solid var(--info-color);
}

.insight-card.type-quality {
  border-left: 3px solid var(--success-color);
}

.insight-card.type-pattern {
  border-left: 3px solid var(--primary-color);
}

/* Hunks Section */
.hunks-section {
  margin-bottom: 1.5rem;
}

.hunks-list {
  display: grid;
  gap: 1rem;
  margin-top: 1rem;
}

.hunk-card {
  padding: 1rem;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.hunk-card:hover {
  background: var(--glass-bg-hover);
  transform: translateX(4px);
}

.hunk-card.needs-attention {
  border-left: 3px solid var(--warning-color);
  background: var(--warning-alpha-5);
}

.hunk-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}

.hunk-file {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
}

.hunk-meta {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.category-badge,
.risk-badge,
.attention-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
}

.category-badge {
  background: var(--primary-alpha-10);
  color: var(--primary-color);
}

.risk-badge.high {
  background: var(--error-alpha-10);
  color: var(--error-color);
}

.risk-badge.medium {
  background: var(--warning-alpha-10);
  color: var(--warning-color);
}

.risk-badge.low {
  background: var(--success-alpha-10);
  color: var(--success-color);
}

.attention-badge {
  background: var(--warning-bg);
  color: var(--warning-color);
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.hunk-description {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
}

.hunk-lines {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  font-family: 'Monaco', 'Courier New', monospace;
}

/* Diff Viewer Section */
.diff-viewer-section {
  margin-bottom: 1.5rem;
}

.view-mode-toggle {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.mode-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 0.375rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.mode-button:hover {
  background: var(--glass-bg-hover);
  border-color: var(--primary-color);
}

.mode-button.active {
  background: var(--primary-gradient);
  border-color: transparent;
  color: white;
}

.diff-content {
  margin-top: 1rem;
}

.no-diff-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem;
  text-align: center;
  color: var(--text-tertiary);
}

.no-diff-message svg {
  width: 48px;
  height: 48px;
  opacity: 0.5;
}

/* Comments Section */
.comments-section {
  margin-bottom: 1.5rem;
}

.comment-filters {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.filter-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
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

.comments-list {
  display: grid;
  gap: 1rem;
  margin-top: 1rem;
}

/* Empty State */
.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
}

.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem;
  text-align: center;
  color: var(--text-secondary);
}

.empty-icon {
  width: 64px;
  height: 64px;
  opacity: 0.3;
}

/* Highlight effect for scrolled-to lines */
:deep(.highlight-line) {
  animation: highlight-flash 2s ease-out;
}

@keyframes highlight-flash {
  0% {
    background: rgba(155, 135, 245, 0.3);
    box-shadow: 0 0 10px rgba(155, 135, 245, 0.5);
  }
  50% {
    background: rgba(155, 135, 245, 0.2);
    box-shadow: 0 0 5px rgba(155, 135, 245, 0.3);
  }
  100% {
    background: transparent;
    box-shadow: none;
  }
}

.empty-content h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
}

.empty-content p {
  font-size: 0.875rem;
  max-width: 400px;
  line-height: 1.5;
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

.slide-up-enter-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.fade-scale-enter-active {
  transition: all 0.3s ease;
}

.fade-scale-enter-from {
  opacity: 0;
  transform: scale(0.95);
}
</style>