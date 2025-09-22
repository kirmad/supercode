<template>
  <div class="related-items">
    <button
      @click="toggleExpanded"
      class="related-items-toggle"
      :class="{ 'related-items-toggle--expanded': isExpanded }"
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
        <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span class="toggle-label">Related Items</span>
      <span class="item-count" v-if="totalCount > 0">({{ totalCount }})</span>
    </button>

    <transition name="slide">
      <div v-if="isExpanded" class="related-items-content">
        <!-- Parent Task Section -->
        <div v-if="parentTask" class="related-section">
          <div class="section-header">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M12 6V18M6 12H18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.7"/>
            </svg>
            <span class="section-title">Parent Task</span>
          </div>
          <label class="related-item">
            <input
              type="checkbox"
              :checked="selectedItems.parentTask"
              @change="toggleSelection('parentTask')"
              class="item-checkbox"
            >
            <span class="item-content">
              <span class="item-id">#{{ parentTask.id }}</span>
              <span class="item-title">{{ parentTask.title }}</span>
              <span class="item-state" :class="`state-${normalizeState(parentTask.state)}`">
                {{ parentTask.state }}
              </span>
            </span>
          </label>
        </div>

        <!-- Related Tasks Section -->
        <div v-if="relatedTasks && relatedTasks.length > 0" class="related-section">
          <div class="section-header">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M16 3H21V8M8 21H3V16M21 3L14 10M3 21L10 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>
            </svg>
            <span class="section-title">Related Tasks</span>
          </div>
          <label v-for="task in relatedTasks" :key="task.id" class="related-item">
            <input
              type="checkbox"
              :checked="selectedItems.tasks[task.id]"
              @change="toggleSelection('tasks', task.id)"
              class="item-checkbox"
            >
            <span class="item-content">
              <span class="item-id">#{{ task.id }}</span>
              <span class="item-title">{{ task.title }}</span>
              <span class="item-state" :class="`state-${normalizeState(task.state)}`">
                {{ task.state }}
              </span>
            </span>
          </label>
        </div>

        <!-- Related Pull Requests Section -->
        <div v-if="relatedPRs && relatedPRs.length > 0" class="related-section">
          <div class="section-header">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M18 21C19.6569 21 21 19.6569 21 18C21 16.3431 19.6569 15 18 15C16.3431 15 15 16.3431 15 18C15 19.6569 16.3431 21 18 21ZM18 21V9C18 7.34315 16.6569 6 15 6H12M6 9C7.65685 9 9 7.65685 9 6C9 4.34315 7.65685 3 6 3C4.34315 3 3 4.34315 3 6C3 7.65685 4.34315 9 6 9ZM6 9V21M12 6L9 3M12 6L9 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>
            </svg>
            <span class="section-title">Pull Requests</span>
          </div>
          <label v-for="pr in relatedPRs" :key="pr.pullRequestId" class="related-item">
            <input
              type="checkbox"
              :checked="selectedItems.prs[pr.pullRequestId]"
              @change="toggleSelection('prs', pr.pullRequestId)"
              class="item-checkbox"
            >
            <span class="item-content">
              <span class="item-id">PR #{{ pr.pullRequestId }}</span>
              <span class="item-title">{{ pr.title }}</span>
              <span class="item-state" :class="`state-${normalizeState(pr.status)}`">
                {{ pr.status }}
              </span>
            </span>
          </label>
        </div>

        <!-- No Related Items -->
        <div v-if="totalCount === 0" class="no-items">
          <span>No related items found</span>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'

interface RelatedTask {
  id: number
  title: string
  state: string
}

interface RelatedPR {
  pullRequestId: number
  title: string
  status: string
  repository?: string  // Repository ID for fetching PR details
}

interface Props {
  parentTask?: RelatedTask
  relatedTasks?: RelatedTask[]
  relatedPRs?: RelatedPR[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  selectionChanged: [selected: {
    parentTask?: RelatedTask
    tasks: RelatedTask[]
    prs: RelatedPR[]
  }]
}>()

const isExpanded = ref(false)

// Initialize with default selected state
const selectedItems = ref({
  parentTask: true, // Parent task is selected by default when it exists
  tasks: {} as Record<number, boolean>,
  prs: {} as Record<number, boolean>
})

// Ensure tasks and prs objects are always initialized
if (!selectedItems.value.tasks) {
  selectedItems.value.tasks = {}
}
if (!selectedItems.value.prs) {
  selectedItems.value.prs = {}
}

const totalCount = computed(() => {
  let count = 0
  if (props.parentTask) count++
  if (props.relatedTasks) count += props.relatedTasks.length
  if (props.relatedPRs) count += props.relatedPRs.length

  // Enhanced logging to debug PR issue
  const prDebug = {
    hasRelatedPRs: !!props.relatedPRs,
    relatedPRsCount: props.relatedPRs?.length || 0,
    relatedPRsType: Array.isArray(props.relatedPRs) ? 'array' : typeof props.relatedPRs,
    relatedPRsValue: props.relatedPRs,
    firstPR: props.relatedPRs?.[0],
    relatedPRsStringified: JSON.stringify(props.relatedPRs)
  }

  console.log('[CollapsibleRelatedItems] totalCount computed - PR Debug:', prDebug)
  console.log('[CollapsibleRelatedItems] totalCount computed - Summary:', {
    hasParentTask: !!props.parentTask,
    relatedTasksCount: props.relatedTasks?.length || 0,
    total: count
  })

  return count
})

function toggleExpanded() {
  isExpanded.value = !isExpanded.value
}

function normalizeState(state: string): string {
  return state.toLowerCase().replace(/\s+/g, '-')
}

function toggleSelection(type: string, id?: number) {
  if (type === 'parentTask') {
    selectedItems.value.parentTask = !selectedItems.value.parentTask
  } else if (type === 'tasks' && id !== undefined) {
    selectedItems.value.tasks[id] = !selectedItems.value.tasks[id]
  } else if (type === 'prs' && id !== undefined) {
    selectedItems.value.prs[id] = !selectedItems.value.prs[id]
  }
  emitSelection()
}

function emitSelection() {
  console.log('[CollapsibleRelatedItems] emitSelection called:', {
    hasParentTaskProp: !!props.parentTask,
    parentTaskPropValue: props.parentTask,
    isParentTaskSelected: selectedItems.value.parentTask,
    hasRelatedTasks: !!props.relatedTasks,
    tasksCount: props.relatedTasks?.length || 0,
    hasPRs: !!props.relatedPRs,
    prsCount: props.relatedPRs?.length || 0
  })

  const selected = {
    parentTask: selectedItems.value.parentTask && props.parentTask ? props.parentTask : undefined,
    tasks: props.relatedTasks?.filter(t => selectedItems.value.tasks[t.id]) || [],
    prs: props.relatedPRs?.filter(pr => selectedItems.value.prs[pr.pullRequestId]) || []
  }

  console.log('[CollapsibleRelatedItems] Emitting selection (detailed):', {
    hasParentTask: !!selected.parentTask,
    parentTaskValue: selected.parentTask,
    tasksCount: selected.tasks.length,
    tasksValue: selected.tasks,
    prsCount: selected.prs.length,
    prsValue: selected.prs,
    fullSelectedObject: selected
  })

  emit('selectionChanged', selected)
}

// Initialize all items as selected by default
onMounted(() => {
  console.log('[CollapsibleRelatedItems] onMounted - ALL PROPS:', {
    allPropsKeys: Object.keys(props),
    parentTask: props.parentTask,
    relatedTasks: props.relatedTasks,
    relatedPrs: props.relatedPrs,
    relatedPRs: props.relatedPRs,
    hasParentTask: !!props.parentTask,
    hasRelatedTasks: !!props.relatedTasks,
    hasRelatedPrs: !!props.relatedPrs,
    hasRelatedPRs: !!props.relatedPRs,
    fullProps: {...props}
  })

  // Select parent task by default if it exists
  if (props.parentTask) {
    console.log('[CollapsibleRelatedItems] Setting parent task as selected')
    selectedItems.value.parentTask = true
  }
  // Select all child tasks by default
  if (props.relatedTasks) {
    props.relatedTasks.forEach(task => {
      selectedItems.value.tasks[task.id] = true
    })
  }
  // Select all PRs by default
  if (props.relatedPRs) {
    props.relatedPRs.forEach(pr => {
      selectedItems.value.prs[pr.pullRequestId] = true
    })
  }

  // Only emit if we have any data
  if (props.parentTask || props.relatedTasks?.length || props.relatedPRs?.length) {
    console.log('[CollapsibleRelatedItems] Emitting initial selection from onMounted')
    emitSelection()
  } else {
    console.log('[CollapsibleRelatedItems] No data available at mount time, skipping initial emit')
  }
})

// Watch all props together for coordinated updates
watch(
  () => ({
    parentTask: props.parentTask,
    tasksCount: props.relatedTasks?.length || 0,
    prsCount: props.relatedPRs?.length || 0
  }),
  (newVal, oldVal) => {
    console.log('[CollapsibleRelatedItems] Props summary changed:', {
      old: oldVal,
      new: newVal,
      dataArrived: !oldVal.parentTask && newVal.parentTask ||
                   oldVal.tasksCount === 0 && newVal.tasksCount > 0 ||
                   oldVal.prsCount === 0 && newVal.prsCount > 0
    })
  }
)

// Watch for prop changes and update selections
watch(() => props.parentTask, (newParentTask, oldParentTask) => {
  console.log('[CollapsibleRelatedItems] parentTask prop changed:', {
    oldValue: oldParentTask,
    newValue: newParentTask,
    hasNewParentTask: !!newParentTask
  })

  if (newParentTask && !oldParentTask) {
    // Parent task just arrived, select it by default
    console.log('[CollapsibleRelatedItems] Parent task arrived, selecting it by default')
    selectedItems.value.parentTask = true
    // Emit the selection with the new parent task
    emitSelection()
  }
})

watch(() => props.relatedTasks, (newTasks, oldTasks) => {
  console.log('[CollapsibleRelatedItems] relatedTasks prop changed:', {
    oldCount: oldTasks?.length || 0,
    newCount: newTasks?.length || 0,
    hasNewTasks: !!newTasks
  })

  if (newTasks && newTasks.length > 0) {
    let addedNew = false

    // Check if this is the first time tasks are arriving (oldTasks was empty/undefined)
    const isFirstArrival = !oldTasks || oldTasks.length === 0

    newTasks.forEach(task => {
      if (!(task.id in selectedItems.value.tasks)) {
        console.log('[CollapsibleRelatedItems] Selecting new task by default:', task.id, task.title)
        selectedItems.value.tasks[task.id] = true
        addedNew = true
      }
    })

    // Emit selection if tasks just arrived or new ones were added
    if (addedNew || isFirstArrival) {
      console.log('[CollapsibleRelatedItems] Tasks updated, emitting selection:', {
        isFirstArrival,
        addedNew,
        totalTasks: newTasks.length
      })
      emitSelection()
    }
  }
})

watch(() => props.relatedPRs, (newPRs, oldPRs) => {
  console.log('[CollapsibleRelatedItems] relatedPRs WATCHER FIRED:', {
    oldCount: oldPRs?.length || 0,
    newCount: newPRs?.length || 0,
    hasNewPRs: !!newPRs,
    newPRsValue: newPRs,
    propsRelatedPRs: props.relatedPRs
  })

  if (newPRs && newPRs.length > 0) {
    let addedNew = false

    // Check if this is the first time PRs are arriving (oldPRs was empty/undefined)
    const isFirstArrival = !oldPRs || oldPRs.length === 0

    newPRs.forEach(pr => {
      if (!(pr.pullRequestId in selectedItems.value.prs)) {
        console.log('[CollapsibleRelatedItems] Selecting new PR by default:', pr.pullRequestId, pr.title)
        selectedItems.value.prs[pr.pullRequestId] = true
        addedNew = true
      }
    })

    // Emit selection if PRs just arrived or new ones were added
    if (addedNew || isFirstArrival) {
      console.log('[CollapsibleRelatedItems] PRs updated, emitting selection:', {
        isFirstArrival,
        addedNew,
        totalPRs: newPRs.length
      })
      emitSelection()
    }
  }
})
</script>

<style scoped>
@import '../../styles/shared/variables.css';

.related-items {
  margin-top: 0.5rem;
  border-top: 1px solid var(--glass-border);
  padding-top: 0.5rem;
}

.related-items-toggle {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  width: 100%;
  padding: 0.25rem 0;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.75rem;
  transition: color 0.2s ease;
}

.related-items-toggle:hover {
  color: var(--text-primary);
}

.related-items-toggle svg {
  transition: transform 0.2s ease;
}

.related-items-toggle--expanded svg {
  transform: rotate(90deg);
}

.toggle-label {
  font-weight: 500;
  letter-spacing: 0.025em;
}

.item-count {
  color: var(--text-muted);
  font-weight: 400;
}

.related-items-content {
  margin-top: 0.5rem;
  padding-left: 1rem;
}

.related-section {
  margin-bottom: 0.75rem;
}

.related-section:last-child {
  margin-bottom: 0;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-bottom: 0.375rem;
  color: var(--text-muted);
}

.section-title {
  font-size: 0.7rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.related-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.related-item:hover {
  opacity: 0.8;
}

.item-checkbox {
  width: 14px;
  height: 14px;
  min-width: 14px;
  cursor: pointer;
  accent-color: #8b5cf6;
}

.item-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.725rem;
  flex: 1;
  min-width: 0;
}

.item-id {
  color: #8b5cf6;
  font-weight: 500;
  white-space: nowrap;
}

.item-title {
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.item-state {
  padding: 0.0625rem 0.25rem;
  border-radius: 3px;
  font-size: 0.65rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  white-space: nowrap;
  background: rgba(99, 102, 241, 0.1);
  color: #8b5cf6;
  border: 1px solid rgba(99, 102, 241, 0.2);
}

.item-state.state-active,
.item-state.state-in-progress {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
  border-color: rgba(34, 197, 94, 0.2);
}

.item-state.state-new {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
  border-color: rgba(59, 130, 246, 0.2);
}

.item-state.state-resolved,
.item-state.state-completed,
.item-state.state-merged {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
  border-color: rgba(16, 185, 129, 0.2);
}

.item-state.state-abandoned,
.item-state.state-closed {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.2);
}

.no-items {
  color: var(--text-muted);
  font-size: 0.725rem;
  font-style: italic;
  padding: 0.5rem 0;
}

/* Slide transition */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>