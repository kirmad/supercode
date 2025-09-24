<template>
  <div class="review-tab">
    <div class="tab-header">
      <h2 class="tab-title">Review Changes</h2>
      <p class="tab-description">
        Review and approve the changes made by SuperCode before applying them to your codebase.
      </p>
    </div>

    <div class="review-container">
      <!-- Summary Statistics -->
      <section class="summary-stats">
        <div class="stat-card">
          <div class="stat-icon files">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" stroke="currentColor" stroke-width="2"/>
              <path d="M14 2V8H20" stroke="currentColor" stroke-width="2"/>
            </svg>
          </div>
          <div class="stat-info">
            <span class="stat-value">{{ totalFiles }}</span>
            <span class="stat-label">Files Changed</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon additions">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="stat-info">
            <span class="stat-value">{{ totalAdditions }}</span>
            <span class="stat-label">Lines Added</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon deletions">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M5 12H19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="stat-info">
            <span class="stat-value">{{ totalDeletions }}</span>
            <span class="stat-label">Lines Removed</span>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon quality">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M9 11L12 14L22 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M21 12V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3H16" stroke="currentColor" stroke-width="2"/>
            </svg>
          </div>
          <div class="stat-info">
            <span class="stat-value">{{ qualityScore }}%</span>
            <span class="stat-label">Quality Score</span>
          </div>
        </div>
      </section>

      <!-- File Review List -->
      <section class="file-review">
        <div class="section-header">
          <h3 class="section-title">Changed Files</h3>
          <div class="filter-controls">
            <button
              v-for="filter in filters"
              :key="filter.id"
              class="filter-btn"
              :class="{ active: activeFilter === filter.id }"
              @click="activeFilter = filter.id"
            >
              {{ filter.label }}
              <span class="filter-count">{{ filter.count }}</span>
            </button>
          </div>
        </div>

        <div class="files-list">
          <div
            v-for="file in filteredFiles"
            :key="file.path"
            class="file-item"
            :class="{ expanded: file.expanded }"
          >
            <div class="file-header" @click="toggleFileExpansion(file)">
              <div class="file-info">
                <input
                  type="checkbox"
                  v-model="file.approved"
                  @click.stop
                  class="file-checkbox"
                />
                <div class="file-icon" :class="file.status">
                  <svg v-if="file.status === 'created'" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 3V13M3 8H13" stroke="currentColor" stroke-width="1.5"/>
                  </svg>
                  <svg v-else-if="file.status === 'modified'" width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M11 2L14 5L5 14L2 14L2 11L11 2Z" stroke="currentColor" stroke-width="1.5"/>
                  </svg>
                  <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.5"/>
                  </svg>
                </div>
                <span class="file-path">{{ file.path }}</span>
              </div>
              <div class="file-meta">
                <span class="file-changes">
                  <span class="additions">+{{ file.additions }}</span>
                  <span class="deletions">-{{ file.deletions }}</span>
                </span>
                <svg class="expand-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </div>
            </div>

            <div v-if="file.expanded" class="file-preview">
              <div class="preview-toolbar">
                <div class="view-mode">
                  <button
                    v-for="mode in viewModes"
                    :key="mode.id"
                    class="mode-btn"
                    :class="{ active: file.viewMode === mode.id }"
                    @click="file.viewMode = mode.id"
                  >
                    {{ mode.label }}
                  </button>
                </div>
                <div class="preview-actions">
                  <button class="preview-action" @click="viewFullFile(file)">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M6 2H4C2.89543 2 2 2.89543 2 4V12C2 13.1046 2.89543 14 4 14H12C13.1046 14 14 13.1046 14 12V10" stroke="currentColor" stroke-width="1.5"/>
                      <path d="M11 2H14V5" stroke="currentColor" stroke-width="1.5"/>
                      <path d="M14 2L8 8" stroke="currentColor" stroke-width="1.5"/>
                    </svg>
                    Full View
                  </button>
                </div>
              </div>
              <div class="preview-content">
                <pre><code>{{ getFilePreview(file) }}</code></pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- AI Suggestions -->
      <section class="ai-suggestions" v-if="suggestions.length > 0">
        <h3 class="section-title">AI Recommendations</h3>
        <div class="suggestions-list">
          <div v-for="suggestion in suggestions" :key="suggestion.id" class="suggestion-card" :class="suggestion.type">
            <div class="suggestion-icon">
              <svg v-if="suggestion.type === 'warning'" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 2L2 18H18L10 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                <path d="M10 12V8M10 15H10.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              <svg v-else-if="suggestion.type === 'improvement'" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/>
                <path d="M10 6V10L13 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              <svg v-else width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/>
                <path d="M10 6V10M10 14H10.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </div>
            <div class="suggestion-content">
              <h4 class="suggestion-title">{{ suggestion.title }}</h4>
              <p class="suggestion-description">{{ suggestion.description }}</p>
              <div class="suggestion-actions" v-if="suggestion.actions">
                <button
                  v-for="action in suggestion.actions"
                  :key="action.id"
                  class="suggestion-action"
                  @click="handleSuggestionAction(action)"
                >
                  {{ action.label }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Review Actions -->
      <div class="review-actions">
        <div class="action-group">
          <button class="btn btn-secondary" @click="selectAll">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="3" y="3" width="10" height="10" rx="1" stroke="currentColor" stroke-width="1.5"/>
              <path d="M6 8L7.5 9.5L10 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Select All
          </button>
          <button class="btn btn-secondary" @click="deselectAll">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="3" y="3" width="10" height="10" rx="1" stroke="currentColor" stroke-width="1.5"/>
            </svg>
            Deselect All
          </button>
        </div>
        <div class="action-group">
          <button class="btn btn-secondary" @click="requestChanges">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 8C2 11.3137 4.68629 14 8 14C11.3137 14 14 11.3137 14 8C14 4.68629 11.3137 2 8 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M2 2V5H5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Request Changes
          </button>
          <button class="btn btn-primary" @click="applyChanges" :disabled="!hasApprovedFiles">
            Apply {{ approvedCount }} Changes
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M5 8L7 10L11 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

// Props
const props = defineProps({
  taskData: {
    type: Object,
    default: () => ({})
  }
})

// Emits
const emit = defineEmits(['update-task'])

// State
const activeFilter = ref('all')
const filters = ref([
  { id: 'all', label: 'All', count: 6 },
  { id: 'created', label: 'Created', count: 3 },
  { id: 'modified', label: 'Modified', count: 2 },
  { id: 'deleted', label: 'Deleted', count: 1 }
])

const viewModes = [
  { id: 'unified', label: 'Unified' },
  { id: 'split', label: 'Split' },
  { id: 'inline', label: 'Inline' }
]

const files = ref([
  {
    path: 'src/components/WorkflowInterface.vue',
    status: 'created',
    additions: 250,
    deletions: 0,
    approved: true,
    expanded: false,
    viewMode: 'unified',
    content: `<template>
  <div class="workflow-interface">
    <!-- New workflow interface implementation -->
  </div>
</template>`
  },
  {
    path: 'src/components/tabs/PlanTab.vue',
    status: 'created',
    additions: 180,
    deletions: 0,
    approved: true,
    expanded: false,
    viewMode: 'unified',
    content: `<template>
  <div class="plan-tab">
    <!-- Planning phase implementation -->
  </div>
</template>`
  },
  {
    path: 'src/router/index.ts',
    status: 'created',
    additions: 45,
    deletions: 0,
    approved: true,
    expanded: false,
    viewMode: 'unified',
    content: `import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // Route definitions
  ]
})`
  },
  {
    path: 'package.json',
    status: 'modified',
    additions: 1,
    deletions: 0,
    approved: false,
    expanded: false,
    viewMode: 'unified',
    content: `{
  "dependencies": {
    "vue": "^3.5.0",
+   "vue-router": "^4.5.0",
    "@kirmad/supercode-sdk": "latest"
  }
}`
  }
])

const suggestions = ref([
  {
    id: 1,
    type: 'warning',
    title: 'Missing Error Handling',
    description: 'Consider adding error boundaries to handle component failures gracefully.',
    actions: [
      { id: 'add', label: 'Add Error Handling' },
      { id: 'ignore', label: 'Ignore' }
    ]
  },
  {
    id: 2,
    type: 'improvement',
    title: 'Performance Optimization',
    description: 'Large components could benefit from code splitting for better load times.',
    actions: [
      { id: 'optimize', label: 'Optimize' },
      { id: 'later', label: 'Do Later' }
    ]
  }
])

// Computed
const totalFiles = computed(() => files.value.length)
const totalAdditions = computed(() => files.value.reduce((sum, f) => sum + f.additions, 0))
const totalDeletions = computed(() => files.value.reduce((sum, f) => sum + f.deletions, 0))
const qualityScore = computed(() => 94) // Simulated quality score

const filteredFiles = computed(() => {
  if (activeFilter.value === 'all') return files.value
  return files.value.filter(f => f.status === activeFilter.value)
})

const approvedCount = computed(() => files.value.filter(f => f.approved).length)
const hasApprovedFiles = computed(() => approvedCount.value > 0)

// Methods
const toggleFileExpansion = (file: any) => {
  file.expanded = !file.expanded
}

const getFilePreview = (file: any) => {
  // Return a preview of the file content
  return file.content || '// File content preview not available'
}

const viewFullFile = (file: any) => {
  console.log('Opening full view for:', file.path)
}

const selectAll = () => {
  files.value.forEach(f => f.approved = true)
}

const deselectAll = () => {
  files.value.forEach(f => f.approved = false)
}

const requestChanges = () => {
  console.log('Requesting changes...')
  // TODO: Open dialog to specify what changes are needed
}

const applyChanges = () => {
  const approvedFiles = files.value.filter(f => f.approved)
  console.log('Applying changes to:', approvedFiles)
  emit('update-task', {
    status: 'applied',
    appliedFiles: approvedFiles
  })
}

const handleSuggestionAction = (action: any) => {
  console.log('Handling suggestion action:', action)
}
</script>

<style scoped>
.review-tab {
  max-width: 1100px;
  margin: 0 auto;
}

.tab-header {
  margin-bottom: 2rem;
}

.tab-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
  color: var(--text-primary);
}

.tab-description {
  color: var(--text-secondary);
  margin: 0;
}

.section-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

/* Summary Statistics */
.summary-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 0.375rem;
  flex-shrink: 0;
}

.stat-icon.files {
  background: rgba(0, 102, 255, 0.1);
  color: var(--accent-color);
}

.stat-icon.additions {
  background: rgba(0, 255, 127, 0.1);
  color: #00ff7f;
}

.stat-icon.deletions {
  background: rgba(255, 68, 68, 0.1);
  color: #ff4444;
}

.stat-icon.quality {
  background: rgba(139, 69, 255, 0.1);
  color: #8b45ff;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-top: 0.25rem;
}

/* File Review */
.file-review {
  margin-bottom: 2rem;
}

.filter-controls {
  display: flex;
  gap: 0.5rem;
}

.filter-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-btn:hover,
.filter-btn.active {
  color: var(--text-primary);
  border-color: var(--accent-color);
}

.filter-btn.active {
  background: rgba(0, 102, 255, 0.1);
}

.filter-count {
  padding: 0.125rem 0.375rem;
  background: var(--bg-primary);
  border-radius: 0.25rem;
  font-size: 0.75rem;
}

.files-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.file-item {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  overflow: hidden;
  transition: all 0.2s;
}

.file-item.expanded {
  border-color: var(--accent-color);
}

.file-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  cursor: pointer;
  user-select: none;
}

.file-header:hover {
  background: var(--bg-primary);
}

.file-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
}

.file-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.file-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 0.25rem;
  flex-shrink: 0;
}

.file-icon.created {
  background: rgba(0, 255, 127, 0.1);
  color: #00ff7f;
}

.file-icon.modified {
  background: rgba(0, 102, 255, 0.1);
  color: var(--accent-color);
}

.file-icon.deleted {
  background: rgba(255, 68, 68, 0.1);
  color: #ff4444;
}

.file-path {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 0.875rem;
}

.file-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.file-changes {
  display: flex;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-family: monospace;
}

.additions {
  color: #00ff7f;
}

.deletions {
  color: #ff4444;
}

.expand-icon {
  color: var(--text-secondary);
  transition: transform 0.2s;
}

.file-item.expanded .expand-icon {
  transform: rotate(180deg);
}

.file-preview {
  border-top: 1px solid var(--border-color);
}

.preview-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0.75rem;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-color);
}

.view-mode {
  display: flex;
  gap: 0.25rem;
}

.mode-btn {
  padding: 0.25rem 0.75rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 0.25rem;
  color: var(--text-secondary);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.mode-btn:hover {
  color: var(--text-primary);
  background: var(--bg-secondary);
}

.mode-btn.active {
  color: var(--text-primary);
  background: var(--bg-secondary);
  border-color: var(--border-color);
}

.preview-actions {
  display: flex;
  gap: 0.5rem;
}

.preview-action {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 0.25rem;
  color: var(--text-secondary);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.preview-action:hover {
  color: var(--text-primary);
  border-color: var(--accent-color);
}

.preview-content {
  padding: 1rem;
  max-height: 300px;
  overflow: auto;
}

.preview-content pre {
  margin: 0;
}

.preview-content code {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 0.875rem;
  line-height: 1.5;
}

/* AI Suggestions */
.ai-suggestions {
  margin-bottom: 2rem;
}

.suggestions-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.suggestion-card {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
}

.suggestion-card.warning {
  border-color: #ffa500;
  background: rgba(255, 165, 0, 0.05);
}

.suggestion-card.improvement {
  border-color: var(--accent-color);
  background: rgba(0, 102, 255, 0.05);
}

.suggestion-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 0.375rem;
  flex-shrink: 0;
}

.suggestion-card.warning .suggestion-icon {
  background: rgba(255, 165, 0, 0.1);
  color: #ffa500;
}

.suggestion-card.improvement .suggestion-icon {
  background: rgba(0, 102, 255, 0.1);
  color: var(--accent-color);
}

.suggestion-content {
  flex: 1;
}

.suggestion-title {
  font-weight: 600;
  margin: 0 0 0.25rem;
}

.suggestion-description {
  color: var(--text-secondary);
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
}

.suggestion-actions {
  display: flex;
  gap: 0.5rem;
}

.suggestion-action {
  padding: 0.25rem 0.75rem;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 0.25rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.suggestion-action:hover {
  color: var(--text-primary);
  border-color: var(--accent-color);
}

/* Review Actions */
.review-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-top: 2rem;
}

.action-group {
  display: flex;
  gap: 0.5rem;
}

.btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border-radius: 0.5rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-primary);
}

.btn-secondary:hover:not(:disabled) {
  border-color: var(--accent-color);
  background: rgba(0, 102, 255, 0.1);
}

.btn-primary {
  background: var(--accent-color);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-hover);
}
</style>