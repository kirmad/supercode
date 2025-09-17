<template>
  <div class="plan-tab">
    <div class="tab-header">
      <h2 class="tab-title">Planning Phase</h2>
      <p class="tab-description">
        Breaking down your task into manageable steps and creating a comprehensive plan.
      </p>
    </div>

    <div class="plan-container">
      <!-- Task Overview -->
      <section class="task-overview">
        <h3 class="section-title">Task Overview</h3>
        <div class="task-card">
          <p class="task-text">{{ taskData?.description || 'No task description provided.' }}</p>
          <div class="task-meta">
            <span class="meta-item">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/>
                <path d="M8 4V8L10 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              Created {{ formatTime(taskData?.timestamp) }}
            </span>
            <span class="meta-item status" :class="taskData?.status">
              {{ taskData?.status || 'planning' }}
            </span>
          </div>
        </div>
      </section>

      <!-- AI Analysis -->
      <section class="ai-analysis">
        <h3 class="section-title">AI Analysis</h3>
        <div class="analysis-content" v-if="!isAnalyzing">
          <div class="analysis-item" v-for="item in analysisItems" :key="item.id">
            <div class="item-icon" :class="item.type">
              <svg v-if="item.type === 'scope'" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/>
                <circle cx="10" cy="10" r="3" stroke="currentColor" stroke-width="1.5"/>
              </svg>
              <svg v-else-if="item.type === 'complexity'" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M4 4L16 16M16 4L4 16" stroke="currentColor" stroke-width="1.5"/>
              </svg>
              <svg v-else width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 2L12 8H18L13 12L15 18L10 14L5 18L7 12L2 8H8L10 2Z" stroke="currentColor" stroke-width="1.5"/>
              </svg>
            </div>
            <div class="item-content">
              <h4 class="item-title">{{ item.title }}</h4>
              <p class="item-description">{{ item.description }}</p>
            </div>
          </div>
        </div>
        <div v-else class="analysis-loading">
          <div class="loading-spinner"></div>
          <p>Analyzing task requirements...</p>
        </div>
      </section>

      <!-- Generated Plan -->
      <section class="generated-plan">
        <div class="section-header">
          <h3 class="section-title">
            Generated Plan
            <span v-if="selectedSteps.length > 0" class="selection-count">
              ({{ selectedSteps.length }} selected)
            </span>
          </h3>
          <div class="header-actions">
            <button
              v-if="planSteps.length > 0"
              class="select-all-btn"
              @click="toggleAllSteps"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.5"/>
                <path v-if="selectedSteps.length === planSteps.length" d="M4 8L6.5 10.5L12 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              {{ selectedSteps.length === planSteps.length ? 'Deselect All' : 'Select All' }}
            </button>
            <button class="regenerate-btn" @click="regeneratePlan" :disabled="isGenerating">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 8C2 11.3137 4.68629 14 8 14C11.3137 14 14 11.3137 14 8C14 4.68629 11.3137 2 8 2C5.79086 2 3.8395 3.11477 2.71204 4.82198" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M2 2V5H5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              Regenerate
            </button>
          </div>
        </div>

        <div class="plan-steps" v-if="!isGenerating && planSteps.length > 0">
          <div
            v-for="(step, index) in planSteps"
            :key="step.id"
            class="plan-step"
            :class="{ completed: step.completed, active: step.active, selected: selectedSteps.includes(step.id) }"
            @click="toggleStepSelection(step.id)"
          >
            <div class="step-number">
              <span v-if="!selectedSteps.includes(step.id)">{{ index + 1 }}</span>
              <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 8L6.5 10.5L12 5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="step-content">
              <h4 class="step-title">{{ step.title }}</h4>
              <p class="step-description">{{ step.description }}</p>
              <div class="step-files" v-if="step.files?.length">
                <span class="files-label">Files:</span>
                <span v-for="file in step.files" :key="file" class="file-tag">
                  {{ file }}
                </span>
              </div>
            </div>
            <div class="step-actions">
              <button class="step-action" @click="editStep(step)" title="Edit">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M11 2L14 5L5 14L2 14L2 11L11 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                </svg>
              </button>
              <button class="step-action" @click="removeStep(step)" title="Remove">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.5"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div v-else-if="isGenerating" class="plan-loading">
          <div class="loading-spinner"></div>
          <p>Generating execution plan...</p>
        </div>

        <div v-else class="plan-empty">
          <p>No plan generated yet. Click "Generate Plan" to start.</p>
        </div>
      </section>

      <!-- Action Buttons -->
      <div class="action-buttons">
        <button class="btn btn-secondary" @click="savePlan" :disabled="planSteps.length === 0">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 2H10L13 5V14H3V2Z" stroke="currentColor" stroke-width="1.5"/>
            <path d="M10 2V5H13" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          Save Plan
        </button>
        <button class="btn btn-primary" @click="startImplementation" :disabled="planSteps.length === 0">
          Start Implementation
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8L13 8M13 8L9 4M13 8L9 12" stroke="currentColor" stroke-width="1.5"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'

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
const isAnalyzing = ref(false)
const isGenerating = ref(false)
const analysisItems = ref([
  {
    id: 1,
    type: 'scope',
    title: 'Task Scope',
    description: 'Multi-page workflow interface with tab navigation'
  },
  {
    id: 2,
    type: 'complexity',
    title: 'Complexity',
    description: 'Medium - Requires component architecture and state management'
  },
  {
    id: 3,
    type: 'requirements',
    title: 'Key Requirements',
    description: 'Vue 3 components, SuperCode SDK integration, standalone mode support'
  }
])

const selectedSteps = ref<number[]>([])
const planSteps = ref([
  {
    id: 1,
    title: 'Set up routing infrastructure',
    description: 'Install vue-router and configure basic routing for the workflow pages',
    files: ['main.ts', 'router/index.ts'],
    completed: false,
    active: true
  },
  {
    id: 2,
    title: 'Create WorkflowInterface component',
    description: 'Build the main container component with header, tabs, and content area',
    files: ['WorkflowInterface.vue'],
    completed: false,
    active: false
  },
  {
    id: 3,
    title: 'Implement tab components',
    description: 'Create PlanTab, ImplementTab, and ReviewTab components with skeleton content',
    files: ['PlanTab.vue', 'ImplementTab.vue', 'ReviewTab.vue'],
    completed: false,
    active: false
  },
  {
    id: 4,
    title: 'Integrate SuperCode SDK',
    description: 'Connect to SuperCode backend for task processing and response handling',
    files: ['services/supercode.ts'],
    completed: false,
    active: false
  }
])

// Methods
const formatTime = (timestamp: string) => {
  if (!timestamp) return 'just now'
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

const toggleStepSelection = (stepId: number) => {
  const index = selectedSteps.value.indexOf(stepId)
  if (index > -1) {
    selectedSteps.value.splice(index, 1)
  } else {
    selectedSteps.value.push(stepId)
  }
}

const toggleAllSteps = () => {
  if (selectedSteps.value.length === planSteps.value.length) {
    selectedSteps.value = []
  } else {
    selectedSteps.value = planSteps.value.map(step => step.id)
  }
}

const regeneratePlan = async () => {
  isGenerating.value = true
  selectedSteps.value = [] // Clear selections when regenerating
  // TODO: Call SuperCode API to regenerate plan
  setTimeout(() => {
    isGenerating.value = false
  }, 2000)
}

const editStep = (step: any) => {
  // TODO: Implement step editing
  console.log('Editing step:', step)
}

const removeStep = (step: any) => {
  const index = planSteps.value.findIndex(s => s.id === step.id)
  if (index > -1) {
    planSteps.value.splice(index, 1)
    // Also remove from selected steps
    const selectedIndex = selectedSteps.value.indexOf(step.id)
    if (selectedIndex > -1) {
      selectedSteps.value.splice(selectedIndex, 1)
    }
  }
}

const savePlan = () => {
  // TODO: Save plan to backend
  console.log('Saving plan...', planSteps.value)
}

const startImplementation = () => {
  // Use selected steps if any, otherwise use all steps
  const stepsToImplement = selectedSteps.value.length > 0
    ? planSteps.value.filter(step => selectedSteps.value.includes(step.id))
    : planSteps.value

  emit('update-task', {
    status: 'implementing',
    plan: stepsToImplement,
    selectedSteps: selectedSteps.value
  })
  // TODO: Navigate to Implement tab
}

// Lifecycle
onMounted(() => {
  // TODO: Load any existing plan data
})

// Watchers
watch(() => props.taskData, (newData) => {
  if (newData?.description) {
    // TODO: Trigger AI analysis when new task is received
  }
})
</script>

<style scoped>
.plan-tab {
  max-width: 900px;
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
  margin: 0 0 1rem;
  color: var(--text-primary);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.selection-count {
  font-size: 0.875rem;
  color: var(--accent-color);
  font-weight: normal;
  margin-left: 0.5rem;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.select-all-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
}

.select-all-btn:hover {
  color: var(--text-primary);
  border-color: var(--accent-color);
  background: rgba(0, 102, 255, 0.05);
}

/* Task Overview */
.task-overview {
  margin-bottom: 2rem;
}

.task-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  padding: 1rem;
}

.task-text {
  margin: 0 0 1rem;
  line-height: 1.5;
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.meta-item.status {
  padding: 0.25rem 0.5rem;
  background: rgba(0, 102, 255, 0.1);
  color: var(--accent-color);
  border-radius: 0.25rem;
  font-weight: 500;
}

/* AI Analysis */
.ai-analysis {
  margin-bottom: 2rem;
}

.analysis-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.analysis-item {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
}

.item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 0.375rem;
  flex-shrink: 0;
}

.item-icon.scope {
  background: rgba(0, 255, 127, 0.1);
  color: #00ff7f;
}

.item-icon.complexity {
  background: rgba(255, 165, 0, 0.1);
  color: #ffa500;
}

.item-icon.requirements {
  background: rgba(0, 102, 255, 0.1);
  color: var(--accent-color);
}

.item-content {
  flex: 1;
}

.item-title {
  font-weight: 600;
  margin: 0 0 0.25rem;
}

.item-description {
  color: var(--text-secondary);
  margin: 0;
  font-size: 0.875rem;
}

/* Generated Plan */
.generated-plan {
  margin-bottom: 2rem;
}

.regenerate-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.regenerate-btn:hover:not(:disabled) {
  color: var(--text-primary);
  border-color: var(--accent-color);
}

.regenerate-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.plan-steps {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.plan-step {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  transition: all 0.2s;
  cursor: pointer;
  position: relative;
}

.plan-step:hover {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.1);
}

.plan-step.active {
  border-color: var(--accent-color);
}

.plan-step.selected {
  border-color: var(--accent-color);
  background: rgba(0, 102, 255, 0.1);
  box-shadow: 0 0 0 1px var(--accent-color) inset;
}

.plan-step.completed {
  opacity: 0.7;
}

.step-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--accent-color);
  color: white;
  border-radius: 50%;
  font-weight: 600;
  flex-shrink: 0;
  transition: all 0.2s;
}

.plan-step.selected .step-number {
  background: var(--accent-color);
  transform: scale(1.1);
}

.step-content {
  flex: 1;
}

.step-title {
  font-weight: 600;
  margin: 0 0 0.25rem;
}

.step-description {
  color: var(--text-secondary);
  margin: 0 0 0.5rem;
  font-size: 0.875rem;
}

.step-files {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.files-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.file-tag {
  padding: 0.125rem 0.5rem;
  background: rgba(0, 102, 255, 0.1);
  color: var(--accent-color);
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-family: monospace;
}

.step-actions {
  display: flex;
  gap: 0.5rem;
}

.step-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.step-action:hover {
  color: var(--text-primary);
  border-color: var(--accent-color);
}

/* Loading States */
.analysis-loading,
.plan-loading,
.plan-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  color: var(--text-secondary);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color);
  border-top-color: var(--accent-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Action Buttons */
.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
}

.btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
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