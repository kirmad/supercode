<template>
  <div class="code-review-tab">
    <!-- Review Content -->
    <div class="review-content">
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
            <div v-if="isLoadingGitData" class="loading-state">
              <Icon name="loader" class="spinning" />
              <span>Loading git data...</span>
            </div>
            <div v-else-if="gitDataError" class="error-state">
              <Icon name="alert-circle" />
              <span>{{ gitDataError }}</span>
              <button @click="fetchGitData" class="retry-button">
                <Icon name="refresh-cw" />
                Retry
              </button>
            </div>
            <div v-else class="branch-selection">
              <div class="input-group">
                <label class="input-label">Source Branch:</label>
                <select v-model="sourceBranch" class="text-input" :disabled="availableBranches.length === 0">
                  <option value="">Select a branch...</option>
                  <option v-for="branch in availableBranches" :key="branch" :value="branch">
                    {{ branch }} {{ branch === currentBranch ? '(current)' : '' }}
                  </option>
                </select>
              </div>
              <div class="input-group">
                <label class="input-label">Target Branch:</label>
                <select v-model="targetBranch" class="text-input" :disabled="availableBranches.length === 0">
                  <option value="">Select a branch...</option>
                  <option v-for="branch in availableBranches" :key="branch" :value="branch">
                    {{ branch }} {{ branch === 'main' || branch === 'master' ? '(default)' : '' }}
                  </option>
                </select>
              </div>
            </div>
          </div>

          <div v-else-if="selectedReviewType === 'commit'" class="commit-input">
            <div v-if="isLoadingGitData" class="loading-state">
              <Icon name="loader" class="spinning" />
              <span>Loading commits...</span>
            </div>
            <div v-else-if="gitDataError" class="error-state">
              <Icon name="alert-circle" />
              <span>{{ gitDataError }}</span>
              <button @click="fetchGitData" class="retry-button">
                <Icon name="refresh-cw" />
                Retry
              </button>
            </div>
            <div v-else class="commit-selection">
              <div class="input-group">
                <label class="input-label">Select Commit:</label>
                <select v-model="commitHash" class="text-input" :disabled="recentCommits.length === 0">
                  <option value="">{{ recentCommits.length === 0 ? 'No commits found' : 'Select a commit...' }}</option>
                  <option v-for="commit in recentCommits" :key="commit.hash" :value="commit.hash">
                    {{ commit.shortHash }} - {{ commit.subject }} ({{ commit.date }})
                  </option>
                </select>
              </div>
              <div class="input-group">
                <label class="input-label">Or enter hash directly:</label>
                <input
                  v-model="commitHash"
                  type="text"
                  class="text-input"
                  placeholder="abc123def456..."
                  @keydown.enter="startReview"
                />
              </div>
            </div>
          </div>

          <div v-else-if="selectedReviewType === 'pr'" class="pr-input">
            <div class="input-group">
              <label class="input-label">Pull Request URL:</label>
              <input
                v-model="pullRequestUrl"
                type="url"
                class="text-input"
                placeholder="https://github.com/owner/repo/pull/123 or https://dev.azure.com/org/project/_git/repo/pullrequest/123"
                @keydown.enter="startReview"
              />
              <p class="input-help">
                Supports Azure DevOps pull request URLs
              </p>
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

    <!-- Micro Status Bar -->
    <TransitionGroup name="fade">
      <div v-if="progressMessage || insights.length > 0 || hunks.length > 0 || comments.length > 0" key="status" class="micro-status-bar">
        <!-- Progress with micro icons -->
        <div v-if="progressMessage" class="status-group">
          <Icon name="loader" class="micro-icon spinning" />
          <span class="micro-text">{{ progressMessage.replace('Loading ', '').replace('Processing ', '') }}</span>
        </div>

        <!-- Review Status Icons with counts -->
        <div class="status-icons">
          <div
            v-if="insights.length > 0 || isLoadingInsights"
            :class="['status-icon-group', { active: !insightsCollapsed, loading: isLoadingInsights }]"
            @click="insightsCollapsed = !insightsCollapsed"
          >
            <Icon name="zap" class="micro-icon pulse" />
            <span class="micro-count">{{ insights.length }}</span>
            <div v-if="insights.length > 0" class="severity-dots">
              <span v-if="insights.filter(i => i.severity === 'high').length > 0" class="dot high"></span>
              <span v-if="insights.filter(i => i.severity === 'medium').length > 0" class="dot medium"></span>
              <span v-if="insights.filter(i => i.severity === 'low').length > 0" class="dot low"></span>
            </div>
          </div>

          <div
            v-if="hunks.length > 0 || isLoadingHunks"
            :class="['status-icon-group', { active: !hunksCollapsed, loading: isLoadingHunks }]"
            @click="hunksCollapsed = !hunksCollapsed"
          >
            <Icon name="git-commit" class="micro-icon pulse" />
            <span class="micro-count">{{ hunks.length }}</span>
            <div v-if="hunks.length > 0" class="risk-dots">
              <span v-if="hunks.filter(h => h.risk === 'high').length > 0" class="dot high"></span>
              <span v-if="hunks.filter(h => h.risk === 'medium').length > 0" class="dot medium"></span>
              <span v-if="hunks.filter(h => h.risk === 'low').length > 0" class="dot low"></span>
            </div>
          </div>

          <div
            v-if="displayFiles.length > 0"
            :class="['status-icon-group', { active: !diffViewerCollapsed }]"
            @click="diffViewerCollapsed = !diffViewerCollapsed"
          >
            <Icon name="code" class="micro-icon" />
            <span class="micro-count">{{ displayFiles.length }}</span>
          </div>

          <div
            v-if="comments.length > 0 || isLoadingComments"
            :class="['status-icon-group', { loading: isLoadingComments }]"
          >
            <Icon name="message-square" class="micro-icon" />
            <span class="micro-count">{{ comments.length }}</span>
          </div>
        </div>
      </div>
    </TransitionGroup>

    <!-- Insights Section - Compact with Summary -->
    <TransitionGroup name="slide-up">
      <div v-if="insights.length > 0 || isLoadingInsights" key="insights" class="compact-section">
        <div class="section-card" @click="insightsCollapsed = !insightsCollapsed">
          <!-- Always visible summary bar -->
          <div class="summary-bar">
            <div class="section-indicator">
              <Icon name="zap" class="section-icon insights-icon" />
              <div v-if="insights.length > 0" class="severity-dots">
                <span v-if="insights.filter(i => i.severity === 'high').length > 0" class="dot high"></span>
                <span v-if="insights.filter(i => i.severity === 'medium').length > 0" class="dot medium"></span>
                <span v-if="insights.filter(i => i.severity === 'low').length > 0" class="dot low"></span>
              </div>
            </div>

            <div class="latest-status">
              <Icon v-if="isLoadingInsights" name="loader" class="spinning status-loader" />
              <span v-if="isLoadingInsights" class="status-text">Analyzing code patterns...</span>
              <span v-else-if="insights.length > 0" class="latest-message">
                {{ insights[insights.length - 1].message }}
              </span>
            </div>
            <div v-if="insights.length > 0 && !isLoadingInsights" class="summary-count">
              <span class="summary-badge">{{ insights.length }}</span>
            </div>

            <Icon :name="insightsCollapsed ? 'chevron-right' : 'chevron-down'" class="collapse-arrow" />
          </div>

          <!-- Expandable content -->
          <div v-show="!insightsCollapsed" class="section-content">
            <div class="insights-list">
              <TransitionGroup name="fade-scale">
                <div
                  v-for="(insight, index) in insights"
                  :key="index"
                  :class="['insight-item', `severity-${insight.severity}`]"
                >
                  <Icon :name="getInsightIcon(insight.type)" class="item-icon" />
                  <div class="item-content">
                    <span class="item-message">{{ insight.message }}</span>
                    <span :class="['severity-tag', insight.severity]">{{ insight.severity }}</span>
                  </div>
                </div>
              </TransitionGroup>
            </div>
          </div>
        </div>
      </div>
    </TransitionGroup>

    <!-- Hunks Section - Compact with Summary -->
    <TransitionGroup name="slide-up">
      <div v-if="hunks.length > 0 || isLoadingHunks" key="hunks" class="compact-section">
        <div class="section-card" @click="hunksCollapsed = !hunksCollapsed">
          <!-- Always visible summary bar -->
          <div class="summary-bar">
            <div class="section-indicator">
              <Icon name="git-commit" class="section-icon hunks-icon" />
              <div v-if="hunks.length > 0" class="risk-dots">
                <span v-if="hunks.filter(h => h.risk === 'high').length > 0" class="dot high"></span>
                <span v-if="hunks.filter(h => h.risk === 'medium').length > 0" class="dot medium"></span>
                <span v-if="hunks.filter(h => h.risk === 'low').length > 0" class="dot low"></span>
              </div>
            </div>

            <div class="latest-status">
              <Icon v-if="isLoadingHunks" name="loader" class="spinning status-loader" />
              <span v-if="isLoadingHunks" class="status-text">Reviewing code changes...</span>
              <span v-else-if="hunks.length > 0" class="latest-message">
                {{ hunks[hunks.length - 1].file.split('/').pop() }}: {{ hunks[hunks.length - 1].description }}
              </span>
            </div>
            <div v-if="hunks.length > 0 && !isLoadingHunks" class="summary-count">
              <span class="summary-badge">{{ hunks.length }}</span>
            </div>

            <Icon :name="hunksCollapsed ? 'chevron-right' : 'chevron-down'" class="collapse-arrow" />
          </div>

          <!-- Expandable content -->
          <div v-show="!hunksCollapsed" class="section-content">
            <div class="hunks-list">
              <TransitionGroup name="slide-fade">
                <div
                  v-for="hunk in hunks"
                  :key="`${hunk.file}-${hunk.start}-${hunk.end}`"
                  :class="['hunk-item', { 'needs-attention': hunk.needsAttention }]"
                  @click="scrollToFile(hunk.file, hunk.start)"
                >
                  <Icon name="file-code" class="item-icon" />
                  <div class="item-content">
                    <div class="item-header">
                      <span class="file-name">{{ hunk.file.split('/').pop() }}</span>
                      <span :class="['risk-tag', hunk.risk]">{{ hunk.risk }}</span>
                    </div>
                    <span class="item-message">{{ hunk.description }}</span>
                    <span class="line-info">Lines {{ hunk.start }}-{{ hunk.end }}</span>
                  </div>
                </div>
              </TransitionGroup>
            </div>
          </div>
        </div>
      </div>
    </TransitionGroup>

    <!-- Diff Viewer Section - Compact with Summary -->
      <TransitionGroup name="slide-up">
        <div v-if="displayFiles.length > 0" key="diff-viewer" class="compact-section">
          <div class="section-card section-card--seamless">
            <!-- Always visible summary bar -->
            <div class="summary-bar" @click="diffViewerCollapsed = !diffViewerCollapsed">
              <div class="section-indicator">
                <Icon name="code" class="section-icon diff-icon" />
                <div class="count-details">
                  <span class="total-count">{{ displayFiles.length }}</span>
                  <div class="breakdown-counts">
                    <span class="count-item files">files</span>
                  </div>
                </div>
              </div>

              <div class="latest-status">
                <span class="latest-message">
                  {{ displayFiles.length }} file{{ displayFiles.length !== 1 ? 's' : '' }} ready for review
                </span>
              </div>

              <Icon :name="diffViewerCollapsed ? 'chevron-right' : 'chevron-down'" class="collapse-arrow" />
            </div>

            <!-- Expandable content -->
            <div v-show="!diffViewerCollapsed" class="section-content diff-content" @click.stop>
              <!-- Diff Content -->
              <div class="diff-content">
                <DiffViewer
                  ref="diffViewerRef"
                  :files="displayFiles"
                  :comments="comments"
                  :hunks="hunks"
                  :viewMode="selectedViewMode as 'unified' | 'split'"
                  :content-mode="contentDisplayMode"
                  :threading-service="threadingService as any"
                  :threads="getAllThreads()"
                  :is-hunk-ai-typing="isHunkAITyping"
                  :get-hunk-streaming-response="getHunkStreamingResponse"
                  v-model:selectedFileIndex="selectedFileIndex"
                  @update:content-mode="contentDisplayMode = $event"
                  @update:view-mode="selectedViewMode = $event"
                  @comment-click="handleCommentClick"
                  @hunk-question="handleHunkQuestion"
                  @comment-reply="handleCommentReply"
                />
              </div>
            </div>
          </div>
        </div>
      </TransitionGroup>

      <!-- Comments Section - Compact with Summary -->
      <TransitionGroup name="slide-up">
        <div v-if="comments.length > 0 || isLoadingComments" key="comments" class="compact-section">
          <div class="section-card">
            <!-- Always visible summary bar -->
            <div class="summary-bar" @click="commentsCollapsed = !commentsCollapsed">
              <div class="section-indicator">
                <Icon name="message-square" class="section-icon comments-icon" />
                <div class="count-details">
                  <span class="total-count">{{ comments.length }}</span>
                  <div v-if="comments.length > 0" class="breakdown-counts">
                    <span v-if="comments.filter(c => c.type === 'issue').length > 0" class="count-item issue">
                      {{ comments.filter(c => c.type === 'issue').length }}I
                    </span>
                    <span v-if="comments.filter(c => c.type === 'suggestion').length > 0" class="count-item suggestion">
                      {{ comments.filter(c => c.type === 'suggestion').length }}S
                    </span>
                    <span v-if="comments.filter(c => c.type === 'praise').length > 0" class="count-item praise">
                      {{ comments.filter(c => c.type === 'praise').length }}P
                    </span>
                  </div>
                </div>
              </div>

              <div class="latest-status">
                <Icon v-if="isLoadingComments" name="loader" class="spinning status-loader" />
                <span v-if="isLoadingComments" class="status-text">Generating feedback...</span>
                <span v-else-if="comments.length > 0" class="latest-message">
                  {{ comments.length }} comment{{ comments.length !== 1 ? 's' : '' }} available
                </span>
              </div>

              <Icon :name="commentsCollapsed ? 'chevron-right' : 'chevron-down'" class="collapse-arrow" />
            </div>

            <!-- Expandable comments content -->
            <div v-show="!commentsCollapsed" class="section-content" @click.stop>
              <TransitionGroup name="fade">
                <CommentThreadCard
                  v-for="comment in filteredComments"
                  :key="`thread-${comment.file}-${comment.lines.start}`"
                  :original-comment="convertToSavedComment(comment)"
                  :responses="getThreadResponses(comment)"
                  :thread-status="getThreadStatus(comment)"
                  :code-context="getCodeContext(comment)"
                  :is-a-i-typing="isAITyping(comment)"
                  :streaming-response="getStreamingResponse(comment)"
                  @user-response="handleUserResponse(comment, $event)"
                  @status-change="handleThreadStatusChange(comment, $event)"
                  @toggle-collapsed="handleThreadToggle(comment, $event)"
                />
              </TransitionGroup>
            </div>
          </div>
        </div>
      </TransitionGroup>

      <!-- Empty State -->
      <div v-if="!isReviewing && !reviewResult && insights.length === 0 && hunks.length === 0 && comments.length === 0" class="empty-state">
        <GlassCard :elevation="1" :hoverable="false">
          <div class="empty-content">
            <Icon name="code-review" class="empty-icon" />
            <h3>Ready to Review Code</h3>
            <p>Select a review type above and provide the necessary information to start your code review.</p>
          </div>
        </GlassCard>
      </div>
    </div>

    <!-- Save Review Dialog -->
    <ReviewSaveDialog
      v-if="showSaveDialog"
      :is-visible="showSaveDialog"
      :review-result="reviewResult"
      :insights="insights"
      @save="handleManualSave as any"
      @cancel="showSaveDialog = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { ProjectWorkflowService, ReviewInsight, ReviewResult, DiffFile, Comment } from '../../services/ProjectWorkflowService'
import { CommentThreadingService } from '../../services/CommentThreadingService'
// import { type SavedCodeReview } from '../../types/CodeReview'
import GlassCard from '../shared/GlassCard.vue'
import ActionButton from '../shared/ActionButton.vue'
// import ProgressBar from '../shared/ProgressBar.vue' // Unused
import Icon from '../Icon.vue'
import DiffViewer from '../review/DiffViewer.vue'
import CommentThreadCard from '../review/CommentThreadCard.vue'
import ReviewSaveDialog from '../review/ReviewSaveDialog.vue'

// Collapse states
const insightsCollapsed = ref(true)
const hunksCollapsed = ref(true)
const commentsCollapsed = ref(true)
const diffViewerCollapsed = ref(false) // Auto-collapse when review starts

// Component refs
const diffViewerRef = ref<InstanceType<typeof DiffViewer> | null>(null)

// Props
interface Props {
  taskData?: any
  wsClient?: any // SuperCodeWebSocketClient instance - matches prop name from parent
}

const props = defineProps<Props>()

// Service instances
const reviewService = ref<ProjectWorkflowService | null>(null)
const threadingService = ref<CommentThreadingService | null>(null)

// Threading state for reactivity
const threadUpdateTrigger = ref(0)

// AI processing states for each thread
const aiTypingThreads = ref<Set<string>>(new Set())
const streamingResponses = ref<Map<string, string>>(new Map())

// Selected file index for DiffViewer
const selectedFileIndex = ref(0)

// Review types
const reviewTypes = [
  { id: 'branches', label: 'Compare Branches', icon: 'git-branch' },
  { id: 'commit', label: 'Review Commit', icon: 'git-commit' },
  { id: 'pr', label: 'Pull Request URL', icon: 'git-pull-request' },
  { id: 'diff', label: 'Review Diff', icon: 'file-diff' }
]

// View modes - moved to DiffViewer component
// Comment filters - unused for now

// Save dialog state (keeping for potential future use)
const showSaveDialog = ref(false)
const savedReviewsCount = ref(0)
// const autoSaveEnabled = ref(true) // Unused
// const lastSaveTime = ref<Date | null>(null) // Unused
const hasUnsavedChanges = ref(false)

// Review state
const selectedReviewType = ref('branches')
const selectedViewMode = ref('unified')
const selectedCommentFilter = ref('all')

const sourceBranch = ref('')
const targetBranch = ref('main')
const commitHash = ref('')
const customDiff = ref('')
const pullRequestUrl = ref('')

const isReviewing = ref(false)
const progressMessage = ref('')
const insights = ref<ReviewInsight[]>([])
const hunks = ref<any[]>([])
const comments = ref<Comment[]>([])
const reviewResult = ref<ReviewResult | null>(null)
// File state - both arrays are kept in sync for consistent UI during streaming and after completion
// versionFiles is the primary source, populated immediately on onFilesReady and enriched on onReviewComplete
const currentDiffFiles = ref<DiffFile[]>([])  // Legacy, kept for backward compatibility
const versionFiles = ref<DiffFile[]>([])  // Primary file array
const contentDisplayMode = ref<'diff' | 'local' | 'remote'>('diff')

// Loading states
const isLoadingFiles = ref(false)
const isLoadingInsights = ref(false)
const isLoadingHunks = ref(false)
const isLoadingComments = ref(false)

// Git data
const availableBranches = ref<string[]>([])
const currentBranch = ref('')
const recentCommits = ref<Array<{ hash: string; shortHash: string; subject: string; author: string; date: string }>>([])
const gitStatus = ref<any>(null)

// Loading states
const isLoadingGitData = ref(false)
const gitDataError = ref<string | null>(null)

// Computed
const canStartReview = computed(() => {
  switch (selectedReviewType.value) {
    case 'branches':
      return sourceBranch.value && targetBranch.value
    case 'commit':
      return commitHash.value
    case 'pr':
      return pullRequestUrl.value && isValidUrl(pullRequestUrl.value)
    case 'diff':
      return customDiff.value
    default:
      return false
  }
})

// Helper function to validate pull request URL (supports Azure DevOps and GitHub)
function isValidUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)

    // Check if it's an Azure DevOps URL (dev.azure.com or .visualstudio.com)
    const isADOUrl = (urlObj.hostname === 'dev.azure.com' || urlObj.hostname.endsWith('.visualstudio.com'))
                     && url.includes('/_git/') && url.includes('/pullrequest/')

    return isADOUrl
  } catch {
    return false
  }
}

const filteredComments = computed(() => {
  return getFilteredComments(selectedCommentFilter.value)
})

const displayFiles = computed(() => {
  return versionFiles.value.length > 0 ? versionFiles.value : currentDiffFiles.value
})

// Content availability computeds moved to DiffViewer


// Save state computed properties (currently unused)
// const currentReviewInfo = computed(() => {
//   if (!reviewService.value) return null
//   return reviewService.value.getCurrentReviewInfo()
// })

// Methods
function getFilteredComments(filterId: string) {
  const allComments = comments.value // Use progressive array instead of reviewResult

  switch (filterId) {
    case 'all':
      return allComments
    case 'issues':
      return allComments.filter(c => c.type === 'issue')
    case 'suggestions':
      return allComments.filter(c => c.type === 'suggestion')
    case 'praise':
      return allComments.filter(c => c.type === 'praise')
    case 'high':
      return allComments.filter(c => c.severity === 'high')
    default:
      return allComments
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
  hunks.value = []
  comments.value = []
  reviewResult.value = null
  isReviewing.value = true
  isLoadingFiles.value = true
  isLoadingInsights.value = true
  isLoadingHunks.value = true
  isLoadingComments.value = true
  // Auto-collapse diff viewer when review starts to save space
  diffViewerCollapsed.value = true

  const options: any = {}

  switch (selectedReviewType.value) {
    case 'branches':
      options.sourceBranch = sourceBranch.value
      options.targetBranch = targetBranch.value
      break
    case 'commit':
      options.commitHash = commitHash.value
      break
    case 'pr':
      options.pullRequestUrl = pullRequestUrl.value
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
  insights.value = []
  hunks.value = []
  comments.value = []
  isLoadingFiles.value = false
  isLoadingInsights.value = false
  isLoadingHunks.value = false
  isLoadingComments.value = false
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

// Unused function - kept for potential future use
// function scrollToComment(comment: Comment) {
//   scrollToFile(comment.file, comment.lines.start)
// }

function handleCommentClick(comment: Comment) {
  // Handle comment click in diff viewer
  console.log('Comment clicked:', comment)
}


// Unused function - kept for potential future use
// function applyFix(comment: Comment) {
//   if (!comment.fixCode) return
//
//   // Implement fix application
//   console.log('Applying fix for comment:', comment)
//   // This would integrate with the editor to apply the suggested fix
// }

async function fetchGitData() {
  if (!reviewService.value) return

  isLoadingGitData.value = true
  gitDataError.value = null

  try {
    console.log('[CodeReviewTab] Starting git data fetch...')

    // Fetch branches
    console.log('[CodeReviewTab] Fetching branches...')
    const branchData = await reviewService.value.fetchGitBranches()
    availableBranches.value = branchData.branches
    currentBranch.value = branchData.current
    console.log('[CodeReviewTab] Branches fetched:', branchData)

    // Set default source branch to current branch
    if (!sourceBranch.value && currentBranch.value) {
      sourceBranch.value = currentBranch.value
    }

    // Fetch recent commits
    console.log('[CodeReviewTab] Fetching commits...')
    recentCommits.value = await reviewService.value.fetchRecentCommits(20)
    console.log('[CodeReviewTab] Commits fetched:', recentCommits.value.length)

    // Fetch git status
    console.log('[CodeReviewTab] Fetching git status...')
    gitStatus.value = await reviewService.value.fetchGitStatus()
    console.log('[CodeReviewTab] Git status fetched:', gitStatus.value)

    console.log('[CodeReviewTab] Git data fetch completed successfully')
  } catch (error) {
    console.error('[CodeReviewTab] Failed to fetch git data:', error)
    gitDataError.value = error instanceof Error ? error.message : 'Failed to load git data'

    // Set some fallback data to allow basic functionality
    if (availableBranches.value.length === 0) {
      availableBranches.value = ['main', 'master', 'develop']
      currentBranch.value = 'main'
      if (!sourceBranch.value) {
        sourceBranch.value = 'main'
      }
    }
  } finally {
    isLoadingGitData.value = false
  }
}

// Unused methods - kept for potential future use when persistence is re-enabled
// function handleReviewSelected(review: SavedCodeReview): void {
//   // Switch to current review tab and load the review
//   activeTab.value = 'current'
//   if (reviewService.value) {
//     reviewService.value.loadSavedReview(review.id!)
//   }
// }

// function handleNewReview(): void {
//   // Switch to current review tab for new review
//   activeTab.value = 'current'
//   clearCurrentReview()
// }

// function handleReviewLoaded(review: SavedCodeReview): void {
//   console.log('Review loaded:', review.metadata.title)
//   updateSaveState()
// }

// function handleReviewDeleted(reviewId: string): void {
//   console.log('Review deleted:', reviewId)
//   updateSavedReviewsCount()
// }

// Unused function - kept for potential future use
// function clearCurrentReview(): void {
//   reviewResult.value = null
//   insights.value = []
//   currentDiffFiles.value = []
//   lastSaveTime.value = null
//   hasUnsavedChanges.value = false
// }

// Unused function - kept for potential future use
// function updateSaveState(): void {
//   if (reviewService.value) {
//     const info = reviewService.value.getCurrentReviewInfo()
//     // Note: getCurrentReviewInfo returns limited info, save features are disabled
//     // lastSaveTime.value = info.lastSaveTime
//     // hasUnsavedChanges.value = info.hasUnsavedChanges
//     // autoSaveEnabled.value = info.autoSaveEnabled
//     console.log('Review info:', info)
//   }
// }

async function updateSavedReviewsCount(): Promise<void> {
  // Review persistence is disabled
  savedReviewsCount.value = 0
  // if (reviewService.value) {
  //   const reviews = await reviewService.value.getSavedReviews()
  //   savedReviewsCount.value = reviews.length
  // }
}

// Unused functions removed - toggleAutoSave, formatSaveTime

async function handleManualSave(saveData: any): Promise<void> {
  if (!reviewService.value) return

  // Review persistence is disabled
  console.log('Save requested but persistence is disabled:', saveData)
  showSaveDialog.value = false
  
  // try {
  //   const savedId = await reviewService.value.saveReview(
  //     saveData.title,
  //     saveData.description,
  //     saveData.status
  //   )
  //
  //   if (savedId) {
  //     showSaveDialog.value = false
  //     updateSaveState()
  //     updateSavedReviewsCount()
  //   }
  // } catch (error) {
  //   console.error('Failed to save review:', error)
  // }
}

// Threading integration methods
function convertToSavedComment(comment: Comment): any {
  return {
    id: `${comment.file}-${comment.lines.start}-${comment.lines.end}`,
    file: comment.file,
    lines: comment.lines,
    type: comment.type,
    severity: comment.severity,
    message: comment.message,
    fixCode: comment.fixCode,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}

function getThreadResponses(comment: Comment): any[] {
  if (!threadingService.value) return []
  // Access the reactive trigger to ensure updates
  threadUpdateTrigger.value
  const threadId = `${comment.file}-${comment.lines.start}-${comment.lines.end}`
  const thread = threadingService.value.getThread(threadId)
  return thread?.responses || []
}

function getThreadStatus(comment: Comment): 'open' | 'resolved' | 'dismissed' {
  if (!threadingService.value) return 'open'
  const threadId = `${comment.file}-${comment.lines.start}-${comment.lines.end}`
  const thread = threadingService.value.getThread(threadId)
  return (thread as any)?.status || 'open'
}

function isAITyping(comment: Comment): boolean {
  const threadId = `${comment.file}-${comment.lines.start}-${comment.lines.end}`
  return aiTypingThreads.value.has(threadId)
}

function getStreamingResponse(comment: Comment): string {
  const threadId = `${comment.file}-${comment.lines.start}-${comment.lines.end}`
  return streamingResponses.value.get(threadId) || ''
}

// Hunk-specific AI state functions
function isHunkAITyping(hunk: any): boolean {
  const threadId = `${hunk.file}-hunk-${hunk.start}-${hunk.end}`
  return aiTypingThreads.value.has(threadId)
}

function getHunkStreamingResponse(hunk: any): string {
  const threadId = `${hunk.file}-hunk-${hunk.start}-${hunk.end}`
  return streamingResponses.value.get(threadId) || ''
}

function getCodeContext(comment: Comment): string {
  // Try to get code context from the diff files
  const file = currentDiffFiles.value.find(f => f.path === comment.file)
  if (!file?.patches) return ''

  // Find the patch that contains the comment lines
  for (const patch of file.patches) {
    if (comment.lines.start >= patch.newStart &&
        comment.lines.start <= patch.newStart + patch.lines.length) {
      // Return a snippet of the patch around the comment
      const startIndex = Math.max(0, comment.lines.start - patch.newStart - 2)
      const endIndex = Math.min(patch.lines.length, comment.lines.start - patch.newStart + 3)
      return patch.lines.slice(startIndex, endIndex).join('\n')
    }
  }

  return ''
}

function getAllThreads() {
  // Include threadUpdateTrigger to make this reactive
  threadUpdateTrigger.value
  if (!threadingService.value) return []
  return threadingService.value.getAllThreads()
}

async function handleHunkQuestion(hunk: any, question: string): Promise<void> {
  if (!reviewService.value) return

  console.log('[CodeReviewTab] Handling hunk question:', question, 'for hunk:', hunk)

  try {
    // Use the new addHunkResponse method which handles thread creation/management
    await reviewService.value.addHunkResponse(hunk, question, 'User')

    // Force reactivity update
    threadUpdateTrigger.value++
    console.log('[CodeReviewTab] Hunk question handled successfully')
  } catch (error) {
    console.error('Failed to handle hunk question:', error)
  }
}

async function handleCommentReply(comment: Comment, reply: string): Promise<void> {
  if (!threadingService.value) return

  try {
    const savedComment = convertToSavedComment(comment)

    // Find or create thread for this comment
    await threadingService.value.findOrCreateThreadForComment(savedComment, reply)

    // Force reactivity update
    threadUpdateTrigger.value++
  } catch (error) {
    console.error('Failed to handle comment reply:', error)
  }
}

async function handleUserResponse(comment: Comment, content: string): Promise<void> {
  if (!reviewService.value) return

  // Use the new addCommentResponse method which handles thread creation/management
  await reviewService.value.addCommentResponse(comment, content, 'User')
}

async function handleThreadStatusChange(
  comment: Comment,
  status: 'open' | 'resolved' | 'dismissed'
): Promise<void> {
  if (!reviewService.value) return

  const threadId = `${comment.file}-${comment.lines.start}-${comment.lines.end}`
  await reviewService.value.updateThreadStatus(threadId, status)
}

function handleThreadToggle(comment: Comment, collapsed: boolean): void {
  console.log('Thread toggled:', comment.file, collapsed)
}

// Lifecycle
onMounted(async () => {
  if (props.wsClient) {
    // Initialize services
    reviewService.value = new ProjectWorkflowService(props.wsClient)

    // Initialize threading first
    reviewService.value.initializeCommentThreading()

    // Use the threading service from the review service
    threadingService.value = reviewService.value.getThreadingService()

    // Set up callbacks
    reviewService.value.setCallbacks({
      onInsightReceived: (insight) => {
        insights.value.push(insight)
        if (isLoadingInsights.value) {
          isLoadingInsights.value = false
        }
        console.log('[CodeReviewTab] Insight received:', insight.type, insight.severity)
      },
      onHunkReceived: (hunk) => {
        hunks.value.push(hunk)
        if (isLoadingHunks.value) {
          isLoadingHunks.value = false
        }
        console.log('[CodeReviewTab] Hunk received:', hunk.file, hunk.start, hunk.end)
      },
      onCommentReceived: (comment) => {
        comments.value.push(comment)
        if (isLoadingComments.value) {
          isLoadingComments.value = false
        }
        console.log('[CodeReviewTab] Comment received:', comment.file, comment.type)
      },
      onReviewComplete: (result, filesWithVersions) => {
        reviewResult.value = result
        isReviewing.value = false
        progressMessage.value = ''
        hasUnsavedChanges.value = true
        isLoadingFiles.value = false
        isLoadingInsights.value = false
        isLoadingHunks.value = false
        isLoadingComments.value = false

        // Merge hunks - add any from result that weren't received progressively
        const existingHunkIds = new Set(hunks.value.map(h => `${h.file}-${h.start}-${h.end}`))
        const newHunks = result.hunks.filter(h => !existingHunkIds.has(`${h.file}-${h.start}-${h.end}`))
        hunks.value.push(...newHunks)

        // Merge comments - add any from result that weren't received progressively
        const existingCommentIds = new Set(comments.value.map(c => `${c.file}-${c.lines.start}-${c.lines.end}`))
        const newComments = result.comments.filter(c => !existingCommentIds.has(`${c.file}-${c.lines.start}-${c.lines.end}`))
        comments.value.push(...newComments)

        // Merge version-enriched files with existing files
        if (filesWithVersions && filesWithVersions.length > 0) {
          // Update versionFiles with enriched data, preserving any files already loaded
          const enrichedMap = new Map(filesWithVersions.map(f => [f.path || f.fileName, f]))
          versionFiles.value = versionFiles.value.map(f => {
            const enriched = enrichedMap.get(f.path || f.fileName)
            return enriched ? { ...f, ...enriched } : f
          })
          // Also add any new files from enriched data
          const existingPaths = new Set(versionFiles.value.map(f => f.path || f.fileName))
          const newFiles = filesWithVersions.filter(f => !existingPaths.has(f.path || f.fileName))
          versionFiles.value.push(...newFiles)

          currentDiffFiles.value = versionFiles.value
        } else if (result && reviewService.value) {
          const files = reviewService.value.getCurrentFiles()
          if (files && files.length > 0) {
            // Merge with existing files
            const fileMap = new Map(files.map(f => [f.path || f.fileName, f]))
            versionFiles.value = versionFiles.value.map(f => {
              const updated = fileMap.get(f.path || f.fileName)
              return updated ? { ...f, ...updated } : f
            })
            currentDiffFiles.value = versionFiles.value
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
        isLoadingFiles.value = false
      },
      onFilesReady: (files) => {
        console.log('[CodeReviewTab] Files ready:', files.length)
        currentDiffFiles.value = files
        versionFiles.value = files  // Populate versionFiles immediately for consistent UI
        isLoadingFiles.value = false
        progressMessage.value = 'Processing review...'
      },
      onThreadCreated: (threadInfo) => {
        console.log('Thread created in UI:', threadInfo.threadId)
        // Start AI typing indicator
        aiTypingThreads.value.add(threadInfo.threadId)
        // Trigger reactive update for thread display
        threadUpdateTrigger.value++
      },
      onResponseReceived: (response, threadId) => {
        console.log('Response received in UI:', threadId, response)
        // Stop AI typing when response is received
        if (response.author.type === 'ai') {
          aiTypingThreads.value.delete(threadId)
          streamingResponses.value.delete(threadId)
        }
        // Trigger reactive update for thread display
        threadUpdateTrigger.value++
      },
      onAIResponseChunk: (chunk, threadId) => {
        // Handle streaming AI response chunks
        console.log('AI chunk received:', threadId, chunk.substring(0, 50) + '...')
        // Stop typing indicator and start streaming
        aiTypingThreads.value.delete(threadId)
        // Update streaming response
        const current = streamingResponses.value.get(threadId) || ''
        streamingResponses.value.set(threadId, current + chunk)
        // Trigger reactive update
        threadUpdateTrigger.value++
      },
      onAIResponseComplete: (_fullContent, threadId) => {
        console.log('AI response complete:', threadId)
        // Clear streaming and typing states
        aiTypingThreads.value.delete(threadId)
        streamingResponses.value.delete(threadId)
        // Trigger reactive update for final response
        threadUpdateTrigger.value++
      }
    })

    // Fetch initial data
    await Promise.all([
      fetchGitData(),
      updateSavedReviewsCount()
    ])
  }
})

onUnmounted(() => {
  // Cleanup resources
  if (reviewService.value) {
    reviewService.value.cancelReview()
    reviewService.value.cleanup()
  }
  if (threadingService.value) {
    threadingService.value.cleanup()
  }
})

</script>

<style scoped>
.code-review-tab {
  padding: 0.75rem;
  max-width: 100%;
  animation: fadeIn 0.3s ease;
}


/* Content Sections */
.review-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  animation: fadeIn 0.3s ease;
}

/* Professional Input Section */
.review-input-section {
  margin-bottom: 1.5rem;
}

.input-card {
  padding: 1rem;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 0.5rem;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  transition: all 0.2s ease;
}

.input-card:hover {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  border-color: var(--primary-color);
  transform: translateY(-1px);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 1.5rem;
  letter-spacing: -0.025em;
}

.section-title.collapsible {
  cursor: pointer;
  user-select: none;
  transition: opacity 0.2s ease;
}

.section-title.collapsible:hover {
  opacity: 0.8;
}

/* Ultra Compact Titles */
.compact-title {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
  padding: 0.5rem 0;
}

.compact-title.collapsible {
  cursor: pointer;
  user-select: none;
  transition: opacity 0.2s ease;
}

.compact-title.collapsible:hover {
  opacity: 0.8;
}

.collapse-icon {
  transition: transform 0.3s ease;
  flex-shrink: 0;
  font-size: 0.75rem;
}

.input-options {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.review-type-selector {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.input-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
  display: block;
  letter-spacing: -0.025em;
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
  padding: 0.75rem 1rem;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}

.type-button:hover {
  background: var(--glass-bg-hover);
  border-color: var(--primary-color);
  transform: translateY(-1px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.type-button.active {
  background: var(--primary-gradient);
  border-color: transparent;
  color: white;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.branch-inputs,
.commit-input,
.pr-input {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.loading-state,
.error-state {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 0.5rem;
  width: 100%;
}

.loading-state {
  color: var(--text-secondary);
}

.error-state {
  color: var(--error-color);
  background: var(--error-alpha-5);
  border-color: var(--error-color);
}

.retry-button {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  background: var(--error-color);
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-left: auto;
}

.retry-button:hover {
  background: var(--error-color-dark);
  transform: translateY(-1px);
}

.branch-selection,
.commit-selection {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  width: 100%;
}

.input-help {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  margin-top: 0.375rem;
  line-height: 1.4;
}

.input-group {
  flex: 1;
  min-width: 200px;
}

.text-input {
  width: 100%;
  padding: 0.75rem 1rem;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}

.text-input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px var(--primary-alpha-10), 0 4px 6px -1px rgba(0, 0, 0, 0.1);
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

/* Progress Section - Ultra Compact */
.progress-section {
  margin-bottom: 0.5rem;
}

.compact-progress {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  background: var(--glass-bg);
  border-radius: 0.375rem;
  border: 1px solid var(--border-subtle);
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.progress-text {
  font-size: 0.75rem;
  font-weight: 500;
}

.progress-indicators {
  display: flex;
  gap: 0.25rem;
  margin-left: auto;
}

.indicator {
  font-size: 0.75rem;
  opacity: 0.4;
  transition: opacity 0.3s ease;
}

.indicator.done {
  opacity: 1;
}

.progress-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem;
  color: var(--text-secondary);
}

.progress-message {
  font-size: 0.875rem;
}

/* Insights Section */
.insights-section {
  margin-bottom: 0.5rem;
}

.insights-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.insight-card {
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 0.375rem;
  transition: all 0.2s ease;
  backdrop-filter: blur(8px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  margin-bottom: 0.375rem;
}

.insight-card:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.16);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.insight-header {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-bottom: 0.5rem;
}

.insight-type {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-secondary);
  flex: 1;
}

.severity-badge {
  padding: 0.125rem 0.375rem;
  border-radius: 0.75rem;
  font-size: 0.5rem;
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
  font-size: 0.75rem;
  line-height: 1.4;
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
  margin-bottom: 0.5rem;
}

.hunks-list {
  display: grid;
  gap: 0.25rem;
  margin-top: 0.5rem;
}

.hunk-card {
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(8px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  margin-bottom: 0.375rem;
}

.hunk-card:hover {
  background: rgba(255, 255, 255, 0.16);
  transform: translateX(4px);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.16);
}

.hunk-card.needs-attention {
  border-left: 3px solid var(--warning-color);
  background: var(--warning-alpha-5);
}

.hunk-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.5rem;
}

.hunk-file {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-primary);
}

.hunk-meta {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
}

.category-badge,
.risk-badge,
.attention-badge {
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.5rem;
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
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-bottom: 0.375rem;
}

.hunk-lines {
  font-size: 0.625rem;
  color: var(--text-tertiary);
  font-family: 'Monaco', 'Courier New', monospace;
}

/* Diff Viewer Section */
.diff-viewer-section {
  margin-bottom: 0.5rem;
}

.view-mode-toggle {
  display: flex;
  gap: 0.375rem;
  margin-bottom: 0.5rem;
}

.mode-button {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 0.25rem;
  font-size: 0.625rem;
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

.mode-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.mode-button:disabled:hover {
  transform: none;
}

.controls-row {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin-bottom: 0.5rem;
  padding: 0.75rem;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 0.375rem;
  flex-wrap: wrap;
}

.content-mode-selector {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.mode-label {
  font-size: 0.625rem;
  font-weight: 500;
  color: var(--text-secondary);
  white-space: nowrap;
}

.mode-buttons {
  display: flex;
  gap: 0.5rem;
}

.diff-content {
  margin-top: 0.5rem;
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
  margin-bottom: 0.5rem;
}

.comment-filters {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;
}

.filter-button {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 1rem;
  font-size: 0.625rem;
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
  padding: 0.075rem 0.25rem;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 0.75rem;
  font-size: 0.5rem;
  font-weight: 600;
}

.comments-list {
  display: grid;
  gap: 0.375rem;
  margin-top: 0.5rem;
}

/* Professional Empty State */
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
  gap: 1.5rem;
  padding: 3rem;
  text-align: center;
  color: var(--text-secondary);
  background: var(--glass-bg);
  border-radius: 0.75rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  border: 1px solid var(--border-subtle);
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
  letter-spacing: -0.025em;
}

.empty-content p {
  font-size: 1rem;
  max-width: 400px;
  line-height: 1.6;
  color: var(--text-secondary);
}

/* Animations */
/* Professional Animations */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.section-card {
  animation: slideInUp 0.3s ease;
}

.status-icon-group {
  animation: scaleIn 0.2s ease;
}

@keyframes spinning {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
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

.fade-scale-leave-active {
  transition: all 0.3s ease;
}

.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

/* Section loader icon */
.section-loader {
  margin-left: auto;
  color: var(--primary-color);
  font-size: 1rem;
}

/* Compact loader */
.compact-loader {
  margin-left: auto;
  color: var(--primary-color);
  font-size: 0.75rem;
}

/* Loading more indicator */
.loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
  opacity: 0.8;
}

/* Compact Summary Styles */
.section-summary {
  padding: 0.5rem 0.75rem;
  border-top: 1px solid var(--border-subtle);
  background: var(--glass-bg);
}

.summary-content {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.summary-stats {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.stat-item {
  padding: 0.1rem 0.375rem;
  border-radius: 0.75rem;
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: lowercase;
}

.stat-item.high {
  background: var(--error-alpha-10);
  color: var(--error-color);
}

.stat-item.medium {
  background: var(--warning-alpha-10);
  color: var(--warning-color);
}

.stat-item.low {
  background: var(--success-alpha-10);
  color: var(--success-color);
}

.stat-item.attention {
  background: var(--warning-bg);
  color: var(--warning-color);
}

.latest-insight,
.latest-hunk {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.insight-icon,
.hunk-icon {
  color: var(--primary-color);
  flex-shrink: 0;
}

.insight-preview,
.hunk-preview {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.8;
}

/* Slide-fade transition for hunks */
.slide-fade-enter-active {
  transition: all 0.3s ease;
}

.slide-fade-leave-active {
  transition: all 0.2s ease;
}

.slide-fade-enter-from {
  transform: translateY(-10px);
  opacity: 0;
}

.slide-fade-leave-to {
  transform: translateY(10px);
  opacity: 0;
}

/* Prevent layout shift - min heights for sections */
.insights-grid,
.hunks-list,
.comments-list {
  min-height: 60px;
  transition: min-height 0.3s ease;
}

.insights-section,
.hunks-section,
.comments-section {
  transition: all 0.3s ease;
}

/* Smooth height transitions */
.insights-grid > *,
.hunks-list > *,
.comments-list > * {
  transition: all 0.3s ease;
}

/* Ultra Compact UI Styles */

/* Professional Card Sections */
.compact-section {
  margin-bottom: 0.5rem;
}

.section-card {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 0.5rem;
  overflow: hidden;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 8px 0 rgba(0, 0, 0, 0.2), 0 1px 3px 0 rgba(0, 0, 0, 0.12);
}

.section-card:hover {
  border-color: rgba(99, 102, 241, 0.6);
  background: rgba(255, 255, 255, 0.12);
  box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.25), 0 2px 6px -1px rgba(0, 0, 0, 0.18);
  transform: translateY(-1px);
}

/* Professional Summary Bar */
.summary-bar {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.875rem 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  min-height: 3.5rem;
}

.summary-bar:hover {
  background: var(--glass-bg-hover);
}

.section-indicator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

.section-icon {
  font-size: 1.125rem;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 0.5rem;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
}

.insights-icon {
  color: var(--warning-color);
  background: var(--warning-alpha-10);
}

.hunks-icon {
  color: var(--info-color);
  background: var(--info-alpha-10);
}

.diff-icon {
  color: var(--primary-color);
  background: var(--primary-alpha-10);
}

.comments-icon {
  color: var(--success-color);
  background: var(--success-alpha-10);
}

/* Count Details Layout */
.count-details {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  align-items: flex-start;
}

.total-count {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
  letter-spacing: -0.025em;
}

.breakdown-counts {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.count-item {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.count-item.high {
  background: var(--error-alpha-10);
  color: var(--error-color);
}

.count-item.medium {
  background: var(--warning-alpha-10);
  color: var(--warning-color);
}

.count-item.low {
  background: var(--success-alpha-10);
  color: var(--success-color);
}

.count-item.attention {
  background: var(--warning-bg);
  color: var(--warning-color);
}

.count-item.issue {
  background: var(--error-alpha-10);
  color: var(--error-color);
}

.count-item.suggestion {
  background: var(--info-bg);
  color: var(--info-color);
}

.count-item.praise {
  background: var(--success-alpha-10);
  color: var(--success-color);
}

.count-item.files {
  background: var(--primary-alpha-10);
  color: var(--primary-color);
}

.latest-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-self: start;
  min-width: 0;
  flex: 1;
}

.summary-count {
  display: flex;
  align-items: center;
  justify-self: end;
}

.summary-badge {
  padding: 0.25rem 0.75rem;
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(99, 102, 241, 1);
  backdrop-filter: blur(4px);
}

.latest-message {
  font-size: 0.875rem;
  color: var(--text-secondary);
  word-wrap: break-word;
  overflow-wrap: break-word;
  line-height: 1.4;
}

.status-loader {
  font-size: 0.875rem;
  color: var(--primary-color);
  flex-shrink: 0;
}

.status-text {
  font-size: 0.875rem;
  color: var(--primary-color);
  font-style: italic;
  animation: pulse 2s ease-in-out infinite;
  line-height: 1.2;
}

.latest-message {
  font-size: 0.875rem;
  color: var(--text-secondary);
  line-height: 1.4;
  word-wrap: break-word;
  overflow-wrap: break-word;
  font-weight: 400;
}

.collapse-arrow {
  font-size: 0.875rem;
  color: var(--text-tertiary);
  transition: all 0.3s ease;
  flex-shrink: 0;
  justify-self: end;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 0.5rem;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
}

.collapse-arrow:hover {
  background: var(--glass-bg-hover);
  color: var(--text-secondary);
  transform: scale(1.05);
}

/* Professional Section Content */
.section-content {
  padding: 0 1rem 1rem;
  background: rgba(0, 0, 0, 0.15);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.diff-content {
  padding: 0.75rem;
}

/* Lists */
.insights-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

/* Items */
.insight-item,
.hunk-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 0.5rem;
  transition: all 0.2s ease;
  font-size: 0.875rem;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  margin-bottom: 0.75rem;
}

.insight-item:hover,
.hunk-item:hover {
  background: var(--glass-bg-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  border-color: var(--primary-color);
}

.insight-item.severity-high {
  border-left: 4px solid var(--error-color);
  background: linear-gradient(to right, var(--error-alpha-5), var(--glass-bg));
}

.insight-item.severity-medium {
  border-left: 4px solid var(--warning-color);
  background: linear-gradient(to right, var(--warning-alpha-5), var(--glass-bg));
}

.insight-item.severity-low {
  border-left: 4px solid var(--success-color);
  background: linear-gradient(to right, var(--success-alpha-5), var(--glass-bg));
}

.hunk-item.needs-attention {
  border-left: 3px solid var(--warning-color);
  background: var(--warning-alpha-5);
}

.item-icon {
  font-size: 0.75rem;
  color: var(--primary-color);
  flex-shrink: 0;
}

.item-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.file-name {
  font-weight: 500;
  color: var(--text-primary);
}

.item-message {
  color: var(--text-secondary);
  line-height: 1.4;
  font-weight: 400;
}

.line-info {
  font-size: 0.625rem;
  color: var(--text-tertiary);
  font-family: 'Monaco', 'Courier New', monospace;
}

/* Tags */
.severity-tag,
.risk-tag {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  flex-shrink: 0;
  letter-spacing: 0.025em;
}

.severity-tag.high,
.risk-tag.high {
  background: var(--error-alpha-10);
  color: var(--error-color);
}

.severity-tag.medium,
.risk-tag.medium {
  background: var(--warning-alpha-10);
  color: var(--warning-color);
}

.severity-tag.low,
.risk-tag.low {
  background: var(--success-alpha-10);
  color: var(--success-color);
}

/* Professional Status Bar */
.micro-status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.5rem;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 0.75rem;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  transition: all 0.2s ease;
}

.micro-status-bar:hover {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  transform: translateY(-1px);
}

.status-group {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: var(--text-secondary);
}

.status-icons {
  display: flex;
  gap: 0.375rem;
}

.status-icon-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}

.status-icon-group:hover {
  background: var(--glass-bg-hover);
  border-color: var(--primary-color);
  transform: translateY(-1px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.status-icon-group.active {
  background: var(--primary-alpha-10);
  border-color: var(--primary-color);
  color: var(--primary-color);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.status-icon-group.loading .micro-icon {
  animation: pulse 1.5s ease-in-out infinite;
}

.micro-icon {
  font-size: 0.75rem;
  transition: all 0.2s ease;
}

.micro-icon.pulse {
  animation: pulse 2s ease-in-out infinite;
}

.micro-icon.spinning {
  animation: spinning 1s linear infinite;
}

.micro-count {
  font-size: 0.625rem;
  font-weight: 600;
  min-width: 1rem;
  text-align: center;
}

.micro-text {
  font-size: 0.75rem;
  font-weight: 500;
}

/* Severity/Risk Dots */
.severity-dots,
.risk-dots {
  display: flex;
  gap: 0.25rem;
  align-items: center;
}

.dot {
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 50%;
  animation: dotPulse 2s ease-in-out infinite;
  flex-shrink: 0;
}

.dot.high {
  background: var(--error-color);
  animation-delay: 0s;
}

.dot.medium {
  background: var(--warning-color);
  animation-delay: 0.3s;
}

.dot.low {
  background: var(--success-color);
  animation-delay: 0.6s;
}

/* Minimal Sections */
.minimal-section {
  margin-bottom: 0.375rem;
}

/* Minimal Insights */
.minimal-insights {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.micro-insight {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 0.25rem;
  transition: all 0.2s ease;
  font-size: 0.75rem;
}

.micro-insight:hover {
  background: var(--glass-bg-hover);
  transform: translateX(2px);
}

.micro-insight.severity-high {
  border-left: 2px solid var(--error-color);
}

.micro-insight.severity-medium {
  border-left: 2px solid var(--warning-color);
}

.micro-insight.severity-low {
  border-left: 2px solid var(--success-color);
}

.insight-micro-icon {
  font-size: 0.75rem;
  color: var(--primary-color);
  flex-shrink: 0;
}

.insight-micro-text {
  flex: 1;
  color: var(--text-primary);
  line-height: 1.3;
}

.micro-severity {
  font-size: 0.5rem;
  font-weight: 600;
  text-transform: uppercase;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  flex-shrink: 0;
}

.micro-severity.high {
  background: var(--error-alpha-10);
  color: var(--error-color);
}

.micro-severity.medium {
  background: var(--warning-alpha-10);
  color: var(--warning-color);
}

.micro-severity.low {
  background: var(--success-alpha-10);
  color: var(--success-color);
}

/* Minimal Hunks */
.minimal-hunks {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.micro-hunk {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.75rem;
}

.micro-hunk:hover {
  background: var(--glass-bg-hover);
  transform: translateX(2px);
}

.micro-hunk.needs-attention {
  border-left: 2px solid var(--warning-color);
  background: var(--warning-alpha-5);
}

.hunk-micro-icon {
  font-size: 0.75rem;
  color: var(--primary-color);
  flex-shrink: 0;
}

.hunk-micro-file {
  font-weight: 500;
  color: var(--text-primary);
  min-width: 4rem;
  flex-shrink: 0;
}

.hunk-micro-desc {
  flex: 1;
  color: var(--text-secondary);
  line-height: 1.3;
}

.micro-risk {
  font-size: 0.5rem;
  font-weight: 600;
  text-transform: uppercase;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  flex-shrink: 0;
}

.micro-risk.high {
  background: var(--error-alpha-10);
  color: var(--error-color);
}

.micro-risk.medium {
  background: var(--warning-alpha-10);
  color: var(--warning-color);
}

.micro-risk.low {
  background: var(--success-alpha-10);
  color: var(--success-color);
}

/* Minimal Diff Viewer */
.minimal-diff-viewer {
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 0.375rem;
  padding: 0.5rem;
}

.minimal-diff-content {
  margin-top: 0.375rem;
}

/* Minimal Comments */
.minimal-comments {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

/* Microanimations */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

@keyframes dotPulse {
  0%, 100% {
    opacity: 0.6;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.2);
  }
}

@keyframes statusGlow {
  0%, 100% {
    box-shadow: 0 0 5px transparent;
  }
  50% {
    box-shadow: 0 0 10px var(--primary-alpha-10);
  }
}

.status-icon-group.active {
  animation: statusGlow 3s ease-in-out infinite;
}

/* Enhanced hover effects */
.micro-insight:hover .insight-micro-icon,
.micro-hunk:hover .hunk-micro-icon {
  transform: scale(1.1);
  animation: pulse 1s ease-in-out infinite;
}

/* =============================================
   PROFESSIONAL RESPONSIVE DESIGN
   ============================================= */

@media (max-width: 768px) {
  .code-review-tab {
    padding: var(--pro-space-4);
  }

  .summary-bar {
    grid-template-columns: auto 1fr;
    gap: var(--pro-space-3);
    padding: var(--pro-space-4);
  }

  .collapse-arrow {
    grid-column: 2;
    justify-self: end;
  }

  .micro-status-bar {
    flex-direction: column;
    gap: var(--pro-space-3);
    align-items: stretch;
  }

  .status-icons {
    justify-content: space-around;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .section-card {
    border-width: 2px;
  }

  .status-icon-group {
    border-width: 2px;
  }
}

/* Seamless Section Card - Blends with page background */
.section-card--seamless {
  background: transparent !important;
  border: none !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
}

.section-card--seamless:hover {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  transform: none !important;
}

.section-card--seamless .summary-bar {
  border-bottom: none !important;
  background: transparent !important;
}

.section-card--seamless .summary-bar:hover {
  background: var(--glass-bg-hover) !important;
  border-radius: 0.5rem !important;
}

.section-card--seamless .section-content {
  background: transparent !important;
  border-top: none !important;
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}


/* Loading States - Legacy (keeping for compatibility) */
/* Professional Loading States */
.loading-states {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1rem;
  padding: 1.5rem;
  background: var(--glass-bg);
  border-radius: 0.75rem;
  border: 1px solid var(--border-subtle);
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}

.loading-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
  transition: all 0.3s ease;
}

.loading-item.completed {
  color: var(--success-color);
  opacity: 0.7;
}

.loading-icon {
  font-size: 1rem;
}

.loading-item.completed .loading-icon {
  filter: grayscale(1);
}
</style>