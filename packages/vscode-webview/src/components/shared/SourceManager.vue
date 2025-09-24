<template>
  <div class="source-manager">
    <!-- Header -->
    <div class="source-header clean" @click="toggleExpanded">
      <div class="header-left">
        <div class="header-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" opacity="0.7"/>
          </svg>
        </div>
        <h3 class="section-title">Context Sources</h3>
        <span v-if="sources.length > 0" class="badge minimal">{{ sources.length }}</span>
      </div>
      <div class="header-right">
        <button
          v-if="sources.length > 0 && expanded"
          @click.stop="clearAllSources"
          class="clear-button"
          title="Clear all sources"
        >
          Clear All
        </button>
        <button class="expand-button" :class="{ 'rotated': !expanded }" @click.stop="toggleExpanded">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Add Source Section -->
    <div v-if="expanded" class="add-source-section">
      <div class="input-tabs">
        <button
          @click="inputMode = 'workitem'"
          :class="['tab-button', { active: inputMode === 'workitem' }]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15M9 5C9 6.10457 9.89543 7 11 7H13C14.1046 7 15 6.10457 15 5M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          Work Item
        </button>
        <button
          @click="inputMode = 'pullrequest'"
          :class="['tab-button', { active: inputMode === 'pullrequest' }]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M18 21C19.6569 21 21 19.6569 21 18C21 16.3431 19.6569 15 18 15C16.3431 15 15 16.3431 15 18C15 19.6569 16.3431 21 18 21ZM18 21V9C18 7.34315 16.6569 6 15 6H12M6 9C7.65685 9 9 7.65685 9 6C9 4.34315 7.65685 3 6 3C4.34315 3 3 4.34315 3 6C3 7.65685 4.34315 9 6 9ZM6 9V21M12 6L9 3M12 6L9 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Pull Request
        </button>
        <button
          @click="inputMode = 'mywork'"
          :class="['tab-button', { active: inputMode === 'mywork' }]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="3" stroke="currentColor" stroke-width="1.5"/>
            <path d="M16 16C16 14.8954 14.2091 14 12 14C9.79086 14 8 14.8954 8 16V20H16V16Z" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          My Work
        </button>
      </div>

      <!-- Work Item Input -->
      <div v-if="inputMode === 'workitem'" class="input-group">
        <input
          v-model="workItemInput"
          @keyup.enter="addWorkItem"
          type="text"
          placeholder="Enter work item ID (e.g., 12345)"
          class="source-input"
          :disabled="isLoading"
        />
        <button
          @click="addWorkItem"
          :disabled="!workItemInput || isLoading"
          class="add-button"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          Add
        </button>
      </div>

      <!-- Pull Request Input -->
      <div v-if="inputMode === 'pullrequest'" class="input-group">
        <input
          v-model="prInput"
          @keyup.enter="addPullRequest"
          type="text"
          placeholder="Enter PR URL or ID"
          class="source-input"
          :disabled="isLoading"
        />
        <button
          @click="addPullRequest"
          :disabled="!prInput || isLoading"
          class="add-button"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          Add
        </button>
      </div>

      <!-- My Work Items -->
      <div v-if="inputMode === 'mywork'" class="my-work-section">
        <button
          @click="loadMyWorkItems"
          :disabled="isLoading"
          class="load-button"
        >
          <svg v-if="!isLoading" width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M4 4V10H10M20 20V14H14M20.49 9C19.79 5.91 16.99 3.5 13.5 3.5C9.36 3.5 6 6.86 6 11C6 11.49 6.03 11.97 6.07 12.45M3.51 15C4.21 18.09 7.01 20.5 10.5 20.5C14.64 20.5 18 17.14 18 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <div v-else class="spinner"></div>
          {{ isLoading ? 'Loading...' : 'Load My Work Items' }}
        </button>

        <div v-if="myWorkItems.length > 0" class="work-items-list">
          <div
            v-for="item in myWorkItems"
            :key="`wi-${item.metadata.workItemId}`"
            @click="selectWorkItem(item)"
            class="work-item-option"
            :class="{ selected: isSourceAdded(item.id) }"
          >
            <div class="item-checkbox">
              <svg v-if="isSourceAdded(item.id)" width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <span class="item-id">#{{ item.metadata.workItemId }}</span>
            <span class="item-title">{{ item.title }}</span>
            <span v-if="item.state" class="item-state">{{ item.state }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Error Message -->
    <div v-if="error && expanded" class="error-message">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
        <path d="M12 8V12M12 16H12.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      {{ error }}
    </div>

    <!-- Sources List -->
    <div v-if="sources.length > 0 && expanded" class="sources-list">
      <SourceItem
        v-for="source in sources"
        :key="source.id"
        :source="source"
        @remove="removeSource"
        @view="viewSource"
        @selection-changed="handleSourceSelectionChanged"
        @content-updated="handleSourceContentUpdated"
      />
    </div>

    <!-- Empty State -->
    <div v-else-if="!isLoading && expanded" class="empty-state">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" stroke-width="1" opacity="0.3"/>
      </svg>
      <p>No sources added yet</p>
      <span>Add work items or pull requests to provide context</span>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading && sources.length === 0 && expanded" class="loading-state">
      <div class="spinner-large"></div>
      <p>Loading sources...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, toRaw } from 'vue'
import { ADOSourceService, type ADOSource, type ADOCredentials } from '../../services/ADOSourceService'
import SourceItem from './SourceItem.vue'

interface Props {
  modelValue: ADOSource[]
  credentials?: ADOCredentials
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => []
})

const emit = defineEmits<{
  'update:modelValue': [sources: ADOSource[]]
  'source-added': [source: ADOSource]
  'source-removed': [source: ADOSource]
  'sources-changed': [sources: ADOSource[]]
  'selection-changed': [source: ADOSource, selected: any]
}>()

// State
const sources = ref<ADOSource[]>(props.modelValue)
const inputMode = ref<'workitem' | 'pullrequest' | 'mywork'>('workitem')
const workItemInput = ref('')
const prInput = ref('')
const isLoading = ref(false)
const error = ref<string | null>(null)
const myWorkItems = ref<ADOSource[]>([])
const expanded = ref(true)

// Service instance
const adoService = new ADOSourceService()

// Methods
async function initializeService() {
  try {
    // Try to get credentials from props or environment
    let creds = props.credentials;

    if (!creds || !creds.organization || !creds.project || !creds.pat) {
      // Try to load from environment through config
      const { getADOCredentials } = await import('../../config/ado.config')
      const envCreds = getADOCredentials()
      console.log('[SourceManager] Loaded credentials from environment:', {
        hasOrg: !!envCreds.organization,
        hasProject: !!envCreds.project,
        hasPat: !!envCreds.pat
      })

      if (envCreds.organization && envCreds.project && envCreds.pat) {
        creds = envCreds as ADOCredentials
      }
    }

    if (creds && creds.organization && creds.project && creds.pat) {
      await adoService.initialize(creds)
      console.log('[SourceManager] ADO service initialized successfully')
    } else {
      throw new Error('Missing required Azure DevOps credentials (organization, project, PAT)')
    }
  } catch (err) {
    console.error('Failed to initialize ADO service:', err)
    error.value = `Azure DevOps credentials not configured. Please ensure AZURE_DEVOPS_ORG, AZURE_DEVOPS_PROJECT, and AZURE_DEVOPS_PAT are set in your .env file.`
  }
}

async function addWorkItem() {
  if (!workItemInput.value || isLoading.value) return

  const workItemId = parseInt(workItemInput.value.replace(/\D/g, ''))
  if (isNaN(workItemId)) {
    error.value = 'Invalid work item ID. Please enter a numeric ID.'
    return
  }

  isLoading.value = true
  error.value = null

  try {
    const source = await adoService.getWorkItem(workItemId)

    // Check if already added
    if (sources.value.some(s => s.id === source.id)) {
      error.value = 'This work item is already added'
      return
    }

    sources.value.push(source)
    workItemInput.value = ''
    emit('source-added', source)
    emit('update:modelValue', sources.value)
    emit('sources-changed', sources.value)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to add work item'
  } finally {
    isLoading.value = false
  }
}

async function addPullRequest() {
  if (!prInput.value || isLoading.value) return

  isLoading.value = true
  error.value = null

  try {
    const source = await adoService.getPullRequest(prInput.value)

    // Check if already added
    if (sources.value.some(s => s.id === source.id)) {
      error.value = 'This pull request is already added'
      return
    }

    sources.value.push(source)
    prInput.value = ''
    emit('source-added', source)
    emit('update:modelValue', sources.value)
    emit('sources-changed', sources.value)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to add pull request'
  } finally {
    isLoading.value = false
  }
}

async function loadMyWorkItems() {
  console.log('[SourceManager] loadMyWorkItems called')
  if (isLoading.value) {
    console.log('[SourceManager] Already loading, skipping')
    return
  }

  isLoading.value = true
  error.value = null

  try {
    // Check if service is initialized
    if (!adoService.isReady()) {
      console.log('[SourceManager] ADO service not ready, initializing...')
      await initializeService()

      if (!adoService.isReady()) {
        throw new Error('Failed to initialize Azure DevOps service')
      }
    }

    console.log('[SourceManager] Calling adoService.getMyWorkItems()...')
    myWorkItems.value = await adoService.getMyWorkItems()
    console.log('[SourceManager] Received work items:', myWorkItems.value.length)

    if (myWorkItems.value.length === 0) {
      error.value = 'No work items assigned to you'
    }
  } catch (err) {
    console.error('[SourceManager] Error loading work items:', err)
    error.value = err instanceof Error ? err.message : 'Failed to load work items'
    myWorkItems.value = []
  } finally {
    isLoading.value = false
  }
}

function selectWorkItem(item: ADOSource) {
  if (isSourceAdded(item.id)) {
    // Remove if already added
    removeSource(item)
  } else {
    // Add the work item
    sources.value.push(item)
    emit('source-added', item)
    emit('update:modelValue', sources.value)
    emit('sources-changed', sources.value)
  }
}

function isSourceAdded(sourceId: string): boolean {
  return sources.value.some(s => s.id === sourceId)
}

function removeSource(source: ADOSource) {
  const index = sources.value.findIndex(s => s.id === source.id)
  if (index > -1) {
    sources.value.splice(index, 1)
    adoService.removeSource(source.id)
    emit('source-removed', source)
    emit('update:modelValue', sources.value)
    emit('sources-changed', sources.value)
  }
}

function clearAllSources() {
  sources.value = []
  adoService.clearCache()
  emit('update:modelValue', sources.value)
  emit('sources-changed', sources.value)
}

function viewSource(source: ADOSource) {
  if (source.url) {
    // In VS Code, this would open in the browser
    window.open(source.url, '_blank')
  }
}

// Store selected related items for each source
const selectedRelatedItems = ref<Map<string, any>>(new Map())

// Export method to get selected items for a source
function getSelectedRelatedItems(sourceId: string): any {
  console.log('[SourceManager] getSelectedRelatedItems called for source:', sourceId)

  const items = selectedRelatedItems.value.get(sourceId)
  console.log('[SourceManager] Raw items from Map:', {
    sourceId,
    hasItems: !!items,
    itemsType: typeof items,
    hasParentTask: !!items?.parentTask,
    parentTaskValue: items?.parentTask,
    tasksLength: items?.tasks?.length || 0,
    prsLength: items?.prs?.length || 0
  })

  if (!items) {
    console.log('[SourceManager] No items found for source:', sourceId)
    return null
  }

  // Return a deep clone to ensure plain data
  const plainItems = JSON.parse(JSON.stringify(items))
  console.log('[SourceManager] Returning cloned items for source:', sourceId, {
    hasParentTask: !!plainItems?.parentTask,
    parentTaskValue: plainItems?.parentTask,
    tasksCount: plainItems?.tasks?.length || 0,
    prsCount: plainItems?.prs?.length || 0,
    fullPlainItems: plainItems
  })

  return plainItems
}

// Expose the method to parent components
defineExpose({
  getSelectedRelatedItems
})

function handleSourceSelectionChanged(source: ADOSource, selected: any) {
  console.log('[SourceManager] handleSourceSelectionChanged received:', {
    sourceId: source.id,
    selectedType: typeof selected,
    selectedIsProxy: selected?.constructor?.name,
    hasParentTask: !!selected?.parentTask,
    parentTaskValue: selected?.parentTask,
    tasksLength: selected?.tasks?.length || 0,
    prsLength: selected?.prs?.length || 0
  })

  // Unwrap Vue reactive proxy to get plain data before storing
  const plainData = toRaw(selected) || selected
  // Deep clone to ensure complete data extraction from any nested proxies
  const clonedData = JSON.parse(JSON.stringify(plainData))

  console.log('[SourceManager] After cloning - storing selected items for source:', source.id, {
    hasParentTask: !!clonedData?.parentTask,
    parentTaskValue: clonedData?.parentTask,
    tasksCount: clonedData?.tasks?.length || 0,
    prsCount: clonedData?.prs?.length || 0,
    fullClonedData: clonedData
  })

  // Store the cloned plain data for this source
  selectedRelatedItems.value.set(source.id, clonedData)

  // Verify what was stored
  const stored = selectedRelatedItems.value.get(source.id)
  console.log('[SourceManager] Verification - what was actually stored:', {
    sourceId: source.id,
    storedHasParentTask: !!stored?.parentTask,
    storedParentTaskValue: stored?.parentTask,
    storedTasksCount: stored?.tasks?.length || 0,
    storedPRsCount: stored?.prs?.length || 0
  })

  emit('selection-changed', source, clonedData)
}

function handleSourceContentUpdated(source: ADOSource, content: string) {
  // Update the source content in our local array
  const index = sources.value.findIndex(s => s.id === source.id)
  if (index > -1) {
    sources.value[index].content = content
    emit('update:modelValue', sources.value)
    emit('sources-changed', sources.value)
  }
}

function toggleExpanded() {
  expanded.value = !expanded.value
}

// Watch for external changes
watch(() => props.modelValue, (newValue) => {
  sources.value = newValue
}, { deep: true })

// Initialize on mount
onMounted(async () => {
  await initializeService()
})
</script>

<style scoped>
@import '../../styles/shared/variables.css';

.source-manager {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* Clean header style matching Research section */
.source-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  cursor: pointer;
  user-select: none;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.section-title {
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.badge.minimal {
  padding: 0.125rem 0.375rem;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: 600;
}

.expand-button {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.25rem;
  transition: all 0.3s ease;
}

.expand-button svg {
  transition: transform 0.3s ease;
}

.expand-button.rotated svg {
  transform: rotate(180deg);
}

.expand-button:hover {
  color: var(--text-primary);
}

.pulse-dot {
  width: 8px;
  height: 8px;
  background: #10b981;
  border-radius: 50%;
  flex-shrink: 0;
}

.pulse-dot.active {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(16, 185, 129, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
  }
}

.clear-button {
  padding: 0.2rem 0.4rem;
  background: transparent;
  border: 1px solid var(--glass-border);
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.clear-button:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.add-source-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.input-tabs {
  display: flex;
  gap: 0.25rem;
  padding: 0.25rem;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 6px;
}

.tab-button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: transparent;
  border: none;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-button:hover {
  background: var(--glass-hover);
  color: var(--text-primary);
}

.tab-button.active {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15));
  color: #8b5cf6;
}

.input-group {
  display: flex;
  gap: 0.5rem;
}

.source-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 6px;
  font-size: 0.875rem;
  color: var(--text-primary);
  transition: all 0.2s ease;
}

.source-input:focus {
  outline: none;
  border-color: rgba(99, 102, 241, 0.5);
  background: var(--glass-hover);
}

.source-input::placeholder {
  color: var(--text-muted);
}

.add-button,
.load-button {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border: none;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.add-button:hover:not(:disabled),
.load-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.add-button:disabled,
.load-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.load-button {
  width: 100%;
  justify-content: center;
}

.my-work-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.work-items-list {
  max-height: 200px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.25rem;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 6px;
}

.work-item-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem;
  background: transparent;
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.work-item-option:hover {
  background: var(--glass-hover);
}

.work-item-option.selected {
  background: rgba(99, 102, 241, 0.1);
}

.item-checkbox {
  width: 14px;
  height: 14px;
  border: 1px solid var(--glass-border);
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.work-item-option.selected .item-checkbox {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border-color: #6366f1;
}

.item-checkbox svg {
  color: white;
}

.item-id {
  color: var(--text-muted);
  font-weight: 500;
}

.item-title {
  flex: 1;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-state {
  padding: 0.125rem 0.25rem;
  background: rgba(99, 102, 241, 0.1);
  border-radius: 3px;
  font-size: 0.65rem;
  color: #8b5cf6;
  text-transform: uppercase;
}

.sources-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
}

.empty-state svg {
  margin-bottom: 0.75rem;
  color: var(--text-muted);
}

.empty-state p {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
  margin: 0 0 0.25rem;
}

.empty-state span {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
}

.loading-state p {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-top: 0.75rem;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 6px;
  color: #ef4444;
  font-size: 0.75rem;
}

.spinner,
.spinner-large {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinner-large {
  width: 24px;
  height: 24px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>