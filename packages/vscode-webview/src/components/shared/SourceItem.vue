<template>
  <div class="source-item" :class="{ 'source-item--loading': isLoading || isLoadingRelated }">
    <div class="source-icon">
      <svg v-if="source.type === 'workitem'" width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15M9 5C9 6.10457 9.89543 7 11 7H13C14.1046 7 15 6.10457 15 5M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5M12 11L9 14L10.5 14L9.5 17L15 11.5L12.5 11.5L13.5 9L12 11Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <svg v-else-if="source.type === 'pullrequest'" width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M18 21C19.6569 21 21 19.6569 21 18C21 16.3431 19.6569 15 18 15C16.3431 15 15 16.3431 15 18C15 19.6569 16.3431 21 18 21ZM18 21V9C18 7.34315 16.6569 6 15 6H12M6 9C7.65685 9 9 7.65685 9 6C9 4.34315 7.65685 3 6 3C4.34315 3 3 4.34315 3 6C3 7.65685 4.34315 9 6 9ZM6 9V21M12 6L9 3M12 6L9 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>

    <div class="source-content">
      <div class="source-header">
        <span class="source-title" :title="source.title">{{ source.title }}</span>
        <span v-if="source.state" class="source-state" :class="`state-${normalizeState(source.state)}`">
          {{ source.state }}
        </span>
      </div>

      <div v-if="source.description" class="source-description">
        {{ truncatedDescription }}
      </div>

      <div class="source-metadata">
        <span v-if="source.type === 'workitem'" class="metadata-item">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M12 2V6M12 18V22M4 12H8M16 12H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
          </svg>
          WI #{{ source.metadata.workItemId }}
        </span>
        <span v-else-if="source.type === 'pullrequest'" class="metadata-item">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M4 7H20M9 12H15M7 17H17" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
          </svg>
          PR #{{ source.metadata.pullRequestId }}
        </span>
        <span v-if="source.assignedTo || source.metadata.author" class="metadata-item">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="3" stroke="currentColor" stroke-width="1.5"/>
            <path d="M16 16C16 14.8954 14.2091 14 12 14C9.79086 14 8 14.8954 8 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          {{ source.assignedTo || source.metadata.author }}
        </span>
      </div>

      <!-- Collapsible Related Items for Work Items -->
      <CollapsibleRelatedItems
        v-if="source.type === 'workitem'"
        :parent-task="parentTaskProp"
        :related-tasks="relatedTasksProp"
        :related-p-rs="relatedPRsProp"
        @selection-changed="handleSelectionChanged"
      />
    </div>

    <div class="source-actions">
      <button
        @click="$emit('view', source)"
        class="action-button icon-button"
        title="View details"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M15 12C15 13.6569 13.6569 15 12 15C10.3431 15 9 13.6569 9 12C9 10.3431 10.3431 9 12 9C13.6569 9 15 10.3431 15 12Z" stroke="currentColor" stroke-width="1.5"/>
          <path d="M2.45825 12C3.73253 7.94288 7.52281 5 12 5C16.4772 5 20.2675 7.94288 21.5418 12C20.2675 16.0571 16.4772 19 12 19C7.52281 19 3.73253 16.0571 2.45825 12Z" stroke="currentColor" stroke-width="1.5"/>
        </svg>
      </button>
      <button
        @click="$emit('remove', source)"
        class="action-button icon-button danger"
        title="Remove source"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <!-- Loading overlay -->
    <div v-if="isLoading || isLoadingRelated" class="loading-overlay">
      <div class="spinner"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch, nextTick } from 'vue'
import type { ADOSource } from '../../services/ADOSourceService'
import CollapsibleRelatedItems from './CollapsibleRelatedItems.vue'
import { htmlToPlainText } from '../../utils/htmlToMarkdown'

interface Props {
  source: ADOSource
  isLoading?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  remove: [source: ADOSource]
  view: [source: ADOSource]
  selectionChanged: [source: ADOSource, selectedRelated: any]
  contentUpdated: [source: ADOSource, content: string]
}>()

const isLoadingRelated = ref(false)
const relatedData = ref<{
  parentTask?: any
  childTasks?: any[]
  linkedPRs?: any[]
} | null>(null)

const truncatedDescription = computed(() => {
  if (!props.source.description) return ''
  // Convert HTML to plain text for display
  const plainText = htmlToPlainText(props.source.description)
  const maxLength = 100
  if (plainText.length <= maxLength) return plainText
  return plainText.substring(0, maxLength) + '...'
})

// Computed properties for related items to ensure reactivity
const parentTaskProp = computed(() => {
  const task = relatedData.value?.parentTask
  console.log('[SourceItem] parentTaskProp computed:', task)
  return task
})

const relatedTasksProp = computed(() => {
  const tasks = relatedData.value?.childTasks || []
  console.log('[SourceItem] relatedTasksProp computed:', tasks.length, 'tasks')
  return tasks
})

const relatedPRsProp = computed(() => {
  // Make a defensive copy to ensure reactivity
  const prs = relatedData.value?.linkedPRs ? [...relatedData.value.linkedPRs] : []
  console.log('[SourceItem] relatedPRsProp computed:', {
    count: prs.length,
    prs: prs,
    relatedDataExists: !!relatedData.value,
    linkedPRsExists: !!relatedData.value?.linkedPRs,
    originalLength: relatedData.value?.linkedPRs?.length,
    isArray: Array.isArray(prs),
    firstPR: prs[0]
  })
  return prs
})

// Watch for changes to relatedData to debug reactivity
watch(relatedData, (newVal, oldVal) => {
  console.log('[SourceItem] relatedData changed:', {
    oldHadPRs: oldVal?.linkedPRs?.length || 0,
    newHasPRs: newVal?.linkedPRs?.length || 0,
    newPRs: newVal?.linkedPRs
  })
}, { deep: true })

function normalizeState(state: string): string {
  return state.toLowerCase().replace(/\s+/g, '-')
}

async function handleSelectionChanged(selected: any) {
  console.log('[SourceItem] handleSelectionChanged received:', {
    sourceId: props.source.id,
    hasParentTask: !!selected?.parentTask,
    parentTaskDetails: selected?.parentTask,
    tasksCount: selected?.tasks?.length || 0,
    prsCount: selected?.prs?.length || 0,
    fullSelectedObject: selected
  })

  emit('selectionChanged', props.source, selected)

  // Construct content based on selected items
  await constructContent(selected)
}

// Construct content based on selected related items
async function constructContent(selectedRelated?: any) {
  if (props.source.type !== 'workitem') {
    return
  }

  console.log('[SourceItem] constructContent called with:', {
    sourceId: props.source.id,
    selectedRelated: selectedRelated ? {
      parentTask: selectedRelated.parentTask ? 'present' : 'undefined',
      tasks: selectedRelated.tasks?.length || 0,
      prs: selectedRelated.prs?.length || 0
    } : 'undefined'
  })

  try {
    // Import services
    const { ADOSourceService } = await import('../../services/ADOSourceService')
    const { ADOContentService } = await import('../../services/ADOContentService')

    const adoService = new ADOSourceService()

    // Check if service is initialized
    if (!adoService.isReady()) {
      const { getADOCredentials } = await import('../../config/ado.config')
      const creds = getADOCredentials()
      if (creds.organization && creds.project && creds.pat) {
        await adoService.initialize(creds)
      } else {
        console.warn('ADO service not initialized')
        return
      }
    }

    // Create content service and construct content
    const contentService = new ADOContentService(adoService)
    const content = await contentService.constructContent(props.source, selectedRelated)

    // Update the source content and emit the update
    props.source.content = content
    emit('contentUpdated', props.source, content)
  } catch (error) {
    console.error('Failed to construct content:', error)
  }
}

// Fetch related data for work items
async function fetchRelatedData() {
  if (props.source.type !== 'workitem' || !props.source.metadata.workItemId) {
    return
  }

  isLoadingRelated.value = true
  try {
    // Import ADO services
    const { ADOSourceService } = await import('../../services/ADOSourceService')
    const { ADORelatedDataService } = await import('../../services/ADORelatedDataService')
    const adoService = new ADOSourceService()

    // Check if service is initialized
    if (!adoService.isReady()) {
      // Try to initialize with cached credentials
      const { getADOCredentials } = await import('../../config/ado.config')
      const creds = getADOCredentials()
      if (creds.organization && creds.project && creds.pat) {
        await adoService.initialize(creds)
      } else {
        console.warn('ADO service not initialized, skipping related data fetch')
        return
      }
    }

    // Create related data service and fetch data
    const relatedService = new ADORelatedDataService(adoService)

    // Clear cache for this work item to ensure fresh data (especially after fixing PR regex)
    relatedService.clearCache(props.source.metadata.workItemId)

    const data = await relatedService.getWorkItemRelatedData(props.source.metadata.workItemId)

    console.log('[SourceItem] Received related data from service:', {
      hasParentTask: !!data.parentTask,
      parentTaskId: data.parentTask?.id,
      parentTaskTitle: data.parentTask?.title,
      childTasksCount: data.childTasks?.length || 0,
      linkedPRsCount: data.linkedPullRequests?.length || 0,
      linkedPRsRaw: data.linkedPullRequests,
      fullServiceData: JSON.stringify(data)
    })

    // Transform data to match our component format
    const transformedPRs = (data.linkedPullRequests || []).map(pr => ({
      pullRequestId: pr.pullRequestId,
      title: pr.title,
      status: pr.status,
      repository: pr.repository  // Include repository ID for fetching PR details
    }))

    console.log('[SourceItem] Transformed PRs:', {
      originalCount: data.linkedPullRequests?.length || 0,
      transformedCount: transformedPRs.length,
      transformedData: transformedPRs
    })

    // Use Vue's reactive assignment to ensure proper updates
    relatedData.value = {
      parentTask: data.parentTask || undefined,
      childTasks: data.childTasks || [],
      linkedPRs: transformedPRs || []
    }

    // Force Vue to recognize the update
    console.log('[SourceItem] Force checking relatedData.value.linkedPRs:', {
      directAccess: relatedData.value.linkedPRs,
      viaSpread: {...relatedData.value}.linkedPRs,
      count: relatedData.value.linkedPRs?.length
    })

    // Wait for Vue to update the DOM
    await nextTick()

    console.log('[SourceItem] After nextTick, checking computed props:', {
      parentTask: parentTaskProp.value,
      relatedTasks: relatedTasksProp.value?.length,
      relatedPRs: relatedPRsProp.value?.length,
      relatedPRsData: relatedPRsProp.value
    })

    console.log('[SourceItem] Set relatedData.value:', {
      hasParentTask: !!relatedData.value.parentTask,
      parentTaskDetails: relatedData.value.parentTask,
      childTasksCount: relatedData.value.childTasks?.length || 0,
      linkedPRsCount: relatedData.value.linkedPRs?.length || 0,
      linkedPRsDetails: relatedData.value.linkedPRs,
      fullRelatedData: relatedData.value
    })

    // Explicitly log what we'll pass as props
    console.log('[SourceItem] Props to be passed to CollapsibleRelatedItems:', {
      parentTask: relatedData.value?.parentTask,
      relatedTasks: relatedData.value?.childTasks,
      relatedPRs: relatedData.value?.linkedPRs,
      relatedPRsType: Array.isArray(relatedData.value?.linkedPRs) ? 'array' : typeof relatedData.value?.linkedPRs
    })
  } catch (error) {
    console.error('Failed to fetch related data:', error)
  } finally {
    isLoadingRelated.value = false
  }
}

onMounted(async () => {
  // Fetch related data first, then construct content with it
  await fetchRelatedData()
  // Don't auto-construct content here - wait for user selection
  // The content will be constructed when:
  // 1. User manually selects/deselects items (handleSelectionChanged)
  // 2. CollapsibleRelatedItems emits initial selection after mounting
})
</script>

<style scoped>
@import '../../styles/shared/variables.css';

.source-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.source-item:hover {
  background: var(--glass-hover);
  border-color: rgba(99, 102, 241, 0.3);
  transform: translateY(-1px);
}

.source-item--loading {
  opacity: 0.6;
  pointer-events: none;
}

.source-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  min-width: 32px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1));
  border-radius: 6px;
  color: #8b5cf6;
}

.source-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.source-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.source-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
}

.source-state {
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  background: rgba(99, 102, 241, 0.1);
  color: #8b5cf6;
  border: 1px solid rgba(99, 102, 241, 0.2);
}

.source-state.state-active,
.source-state.state-in-progress {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
  border-color: rgba(34, 197, 94, 0.2);
}

.source-state.state-new {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
  border-color: rgba(59, 130, 246, 0.2);
}

.source-state.state-resolved,
.source-state.state-completed,
.source-state.state-merged {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
  border-color: rgba(16, 185, 129, 0.2);
}

.source-state.state-abandoned,
.source-state.state-closed {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.2);
}

.source-description {
  font-size: 0.75rem;
  color: var(--text-secondary);
  line-height: 1.4;
  margin: 0.125rem 0;
}

.source-metadata {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.25rem;
}

.metadata-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.7rem;
  color: var(--text-muted);
}

.metadata-item svg {
  opacity: 0.5;
}

.source-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-button:hover {
  background: var(--glass-bg);
  border-color: var(--glass-border);
  color: var(--text-primary);
}

.action-button.danger:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(2px);
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(99, 102, 241, 0.3);
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>