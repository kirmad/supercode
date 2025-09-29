<template>
  <div class="plan-generation-tab" data-testid="plan-generation-tab">
    <!-- Modern Input Card -->
    <GlassCard hoverable custom-class="input-card">
      <div class="input-header modern">
        <div class="input-label-group">
          <div class="label-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15M9 5C9 6.10457 9.89543 7 11 7H13C14.1046 7 15 6.10457 15 5M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
            </svg>
          </div>
          <label class="input-label modern">Project Vision</label>
          <div class="inline-stats" v-if="designThoughts.length > 0">
            <span class="stat-badge">{{ designThoughts.length }} thoughts</span>
          </div>
        </div>
        <div class="input-actions">
          <ActionButton
            v-if="originalPrompt && !isGenerating"
            @click="clearPlan"
            variant="icon"
            title="Clear"
            custom-class="clear-btn"
          >
            <template #icon>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </template>
          </ActionButton>
        </div>
      </div>
      <div class="enhanced-input-wrapper" :class="{ 'is-processing': isGenerating }">
        <CharacterLimitInput
          v-model="originalPrompt"
          placeholder="Describe your project vision and requirements..."
          :disabled="isGenerating"
          :multiline="true"
          :rows="3"
          :max-length="500"
          :show-progress="true"
          :show-character-count="true"
          @meta-enter="handleGeneratePlan"
          @ctrl-enter="handleGeneratePlan"
        >
          <!-- Custom footer content slot -->
          <template #footer-actions>
            <div class="input-footer-actions">
              <!-- Plan Generation Trigger Button -->
              <transition name="fade">
                <button
                  v-if="originalPrompt && !isGenerating && !planSpecification"
                  @click="handleGeneratePlan"
                  class="footer-generate-trigger"
                  :title="`Generate Plan (${isMac ? 'Cmd' : 'Ctrl'} + Enter)`"
                  type="button"
                >
                  <svg class="trigger-icon" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15M9 5C9 6.10457 9.89543 7 11 7H13C14.1046 7 15 6.10457 15 5M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </button>
              </transition>

              <!-- Processing Indicator -->
              <transition name="fade">
                <div v-if="isGenerating" class="footer-processing-indicator">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" class="processing-spinner">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" opacity="0.9"/>
                  </svg>
                  <span class="processing-text">Generating plan...</span>
                </div>
              </transition>
            </div>
          </template>
        </CharacterLimitInput>
      </div>
    </GlassCard>

    <!-- Source Management Section -->
    <div class="section-container sources-section">
      <SourceManager
        ref="sourceManagerRef"
        v-model="sources"
        :credentials="adoCredentials"
        @sources-changed="handleSourcesChanged"
      />
    </div>

    <!-- Modern Design Thoughts Section -->
    <transition name="slide-fade">
      <DesignThoughtsList
        v-if="designThoughts.length > 0"
        :thoughts="designThoughts"
        :expanded="thoughtsExpanded"
        :show-pulse="isGenerating"
        @toggle-expand="thoughtsExpanded = !thoughtsExpanded"
      />
    </transition>

    <!-- Modern Plan Specification Section -->
    <transition name="scale-fade">
      <div v-if="planSpecification" class="section-container specification-section" data-testid="specification-section">
        <div class="section-header">
          <div class="header-left">
            <div class="pulse-dot" :class="{ 'active': true }"></div>
            <h3 class="section-title">Design Specification</h3>
            <div class="badge minimal confidence-badge" :class="`confidence-${planSpecification.metadata.confidence}`">
              <span class="badge-icon">🎯</span>
              <span class="badge-label">{{ planSpecification.metadata.confidence }}</span>
            </div>
          </div>
          <div class="header-actions">
            <button class="expand-button" @click="specificationExpanded = !specificationExpanded" :class="{ 'rotated': !specificationExpanded }">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </div>

        <transition name="expand">
          <div v-show="specificationExpanded">
            <!-- Modern Quick Actions -->
            <div class="quick-actions modern">
              <ActionButton
                @click="copySpecification"
                variant="pill"
                title="Copy Specification"
                custom-class="action-pill-primary"
              >
                <template #icon>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M5 15H4C2.89543 15 2 14.1046 2 13V4C2 2.89543 2.89543 2 4 2H13C14.1046 2 15 2.89543 15 4V5" stroke="currentColor" stroke-width="1.5"/>
                  </svg>
                </template>
                Copy
              </ActionButton>
              <ActionButton
                @click="sendToImplementation"
                variant="success"
                size="small"
                custom-class="action-pill"
              >
                <template #icon>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                  </svg>
                </template>
                Implement
              </ActionButton>
              <ActionButton
                @click="regeneratePlan"
                variant="icon"
                title="Regenerate Plan"
              >
                <template #icon>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M1 4V10H7M23 20V14H17M20.49 9C19.79 5.91 16.99 3.5 13.5 3.5C9.36 3.5 6 6.86 6 11C6 11.49 6.03 11.97 6.07 12.45M3.51 15C4.21 18.09 7.01 20.5 10.5 20.5C14.64 20.5 18 17.14 18 13C18 12.51 17.97 12.03 17.93 11.55" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </template>
              </ActionButton>
            </div>

            <div class="specification-content modern">
              <div class="content-wrapper">
                <MarkdownRenderer
                  :content="planSpecification.specification"
                  :show-copy-button="false"
                  :enable-mermaid="true"
                  :enable-syntax-highlight="true"
                  custom-class="plan-specification-markdown"
                />
              </div>
            </div>

            <div class="specification-footer modern">
              <MetricGroup
                :metrics="[
                  { value: planSpecification.metadata.complexity, label: 'complexity', format: 'text' },
                  { value: planSpecification.metadata.estimatedEffort, label: 'effort', format: 'text' },
                  { value: designThoughts.length, label: 'thoughts', format: 'number' }
                ]"
                compact
                show-dividers
              />
            </div>
          </div>
        </transition>
      </div>
    </transition>

    <!-- Follow-up Suggestions Section -->
    <transition name="slide-fade">
      <div v-if="planSpecification && !isGenerating" class="section-container follow-up-section">
        <FollowUpInput
          v-model="followUpSuggestion"
          :suggestions="followUpSuggestions"
          :show-header="true"
          header-title="Refine Plan"
          @submit="handleFollowUp"
        />
      </div>
    </transition>

    <!-- Streamlined Action Section -->
    <transition name="fade">
      <div v-if="planSpecification && !isGenerating" class="action-section modern streamlined">
        <ActionButton
          @click="startNewPlan"
          variant="secondary"
          size="medium"
        >
          <template #icon>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 4V20M4 12H20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </template>
          New Plan
        </ActionButton>
      </div>
    </transition>

    <!-- Modern Progress Indicator -->
    <transition name="fade">
      <ProgressBar
        v-if="isGenerating"
        :percentage="progressPercentage"
        :label="currentPhase"
        variant="modern"
        show-glow
      />
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick, onBeforeUnmount } from 'vue'
import { PlanGenerationService } from '../../services/PlanGenerationService'
import { SuperCodeWebSocketClient } from '../../services/SuperCodeWebSocketClient'
import type { DesignThought, DesignSpecification } from '../../types/plan-generation'
import type { ADOSource } from '../../services/ADOSourceService'

// Import shared components
import GlassCard from '../shared/GlassCard.vue'
import ActionButton from '../shared/ActionButton.vue'
import ProgressBar from '../shared/ProgressBar.vue'
import MetricGroup from '../shared/MetricGroup.vue'
import DesignThoughtsList from './plan/DesignThoughtsList.vue'
import CharacterLimitInput from '../shared/CharacterLimitInput.vue'
import MarkdownRenderer from '../shared/MarkdownRenderer.vue'
import FollowUpInput from '../shared/FollowUpInput.vue'
import SourceManager from '../shared/SourceManager.vue'

// Computed for platform detection
const isMac = computed(() => navigator.platform.toUpperCase().indexOf('MAC') >= 0)

// Props
const props = defineProps<{
  modelValue?: any
  sessionId?: string | null
  wsClient?: SuperCodeWebSocketClient
  taskData?: any
  modelInfo?: { name: string; provider: string; version?: string } | null
  adoCredentials?: {
    organization?: string
    project?: string
    pat?: string
  }
}>()

// Emits
const emit = defineEmits(['update-task', 'send-to-implementation'])

// Template refs
const sourceManagerRef = ref<InstanceType<typeof SourceManager> | null>(null)

// State
const originalPrompt = ref('')
const planSpecification = ref<DesignSpecification | null>(null)
const isGenerating = ref(false)
const designThoughts = ref<DesignThought[]>([])
const thoughtsExpanded = ref(true)
const specificationExpanded = ref(true)
const progressPercentage = ref(0)
const currentPhase = ref('')
const error = ref<string | null>(null)
const sources = ref<ADOSource[]>([])

// Follow-up state
const followUpSuggestion = ref('')
const followUpSuggestions = computed(() => {
  const suggestions = []
  if (planSpecification.value) {
    suggestions.push(
      { id: '1', text: 'Add technical details', icon: '🔧' },
      { id: '2', text: 'Add risk mitigation', icon: '🛡️' },
      { id: '3', text: 'Add timeline estimates', icon: '⏱️' },
      { id: '4', text: 'Add resource requirements', icon: '👥' }
    )
  }
  return suggestions
})

// ADO Credentials - load from props or environment
const adoCredentials = computed(() => {
  if (props.adoCredentials) {
    return props.adoCredentials
  }
  return undefined
})

// Plan Generation Service
let planService: PlanGenerationService | null = null

// Track processed content across streaming updates to avoid duplicates
const processedContent = new Set<string>()

// Methods
async function handleGeneratePlan() {
  if (!originalPrompt.value || isGenerating.value) return

  // Initialize plan service if not already done
  if (!planService) {
    planService = new PlanGenerationService(props.wsClient)
    setupPlanCallbacks()
  }

  // Clear any previous session data in the service to ensure clean state
  planService.clear()
  processedContent.clear() // Clear processed content for new generation

  isGenerating.value = true
  progressPercentage.value = 0
  currentPhase.value = 'Initializing plan generation...'
  designThoughts.value = []
  planSpecification.value = null
  error.value = null

  try {
    // Extract provider and model from modelInfo prop or use defaults
    const providerId = props.modelInfo?.provider || 'anthropic'
    const modelId = props.modelInfo?.name || 'claude-3-5-sonnet-latest'

    console.log('[PlanGenerationTab] Calling planService.generatePlan with prompt:', originalPrompt.value);
    console.log('[PlanGenerationTab] Using provider:', providerId, 'model:', modelId);

    // Collect selected related items from all sources
    const selectedRelatedItems: any = {}
    if (sourceManagerRef.value) {
      for (const source of sources.value) {
        const selectedItems = sourceManagerRef.value.getSelectedRelatedItems?.(source.id || '')
        if (selectedItems) {
          selectedRelatedItems[source.id || ''] = selectedItems
        }
      }
    }
    console.log('[PlanGenerationTab] Selected related items:', selectedRelatedItems);

    // Use real AI plan generation with SuperCode
    const result = await planService.generatePlan(
      originalPrompt.value,
      providerId,
      modelId,
      sources.value, // Pass sources for context
      selectedRelatedItems, // Pass selected related items
      '/design-phase' // Use design-phase command for plan generation
    )

    console.log('[PlanGenerationTab] Plan generation result:', result);

    if (result.specification) {
      console.log('[PlanGenerationTab] Setting plan specification:', result.specification.specification.length, 'chars');
      planSpecification.value = result.specification
      designThoughts.value = result.thoughts

      progressPercentage.value = 100
      currentPhase.value = 'Plan generation complete!'

      // Minimize thoughts section when plan is complete
      thoughtsExpanded.value = false

      // Save to task data
      emit('update-task', {
        planSpecification: planSpecification.value,
        originalPrompt: originalPrompt.value,
        designThoughts: designThoughts.value
      })
    } else {
      console.warn('[PlanGenerationTab] Plan generation returned no specification')
      currentPhase.value = 'Plan generation completed without specification'
      progressPercentage.value = 100
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Plan generation failed'
    console.error('Plan generation failed:', err)
    currentPhase.value = 'Plan generation failed'
  } finally {
    isGenerating.value = false
  }
}

function clearPlan() {
  originalPrompt.value = ''
  planSpecification.value = null
  designThoughts.value = []
  thoughtsExpanded.value = true
  specificationExpanded.value = true
  progressPercentage.value = 0
  currentPhase.value = ''
  followUpSuggestion.value = ''
  sources.value = []
}

function handleSourcesChanged(newSources: ADOSource[]) {
  sources.value = newSources
}

async function copySpecification() {
  if (!planSpecification.value) return

  try {
    await navigator.clipboard.writeText(planSpecification.value.specification)
    // Could add a toast notification here
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

async function regeneratePlan() {
  if (!planService) {
    planService = new PlanGenerationService(props.wsClient)
    setupPlanCallbacks()
  }

  planSpecification.value = null
  designThoughts.value = []
  error.value = null

  isGenerating.value = true
  progressPercentage.value = 0
  currentPhase.value = 'Regenerating plan with alternative approach...'

  try {
    const result = await planService.generatePlan(
      originalPrompt.value,
      props.modelInfo?.provider || 'anthropic',
      props.modelInfo?.name || 'claude-3-5-sonnet-latest',
      sources.value,
      undefined,
      '/design-phase'
    )

    if (result.specification) {
      planSpecification.value = result.specification
      designThoughts.value = result.thoughts

      progressPercentage.value = 100
      currentPhase.value = 'Plan regeneration complete!'

      // Save to task data
      emit('update-task', {
        planSpecification: planSpecification.value,
        originalPrompt: originalPrompt.value,
        designThoughts: designThoughts.value
      })
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Plan regeneration failed'
    console.error('Plan regeneration failed:', err)
    currentPhase.value = 'Plan regeneration failed'
  } finally {
    isGenerating.value = false
  }
}

async function handleFollowUp() {
  console.log('[PlanGenerationTab] handleFollowUp called');
  console.log('[PlanGenerationTab] followUpSuggestion:', followUpSuggestion.value);

  if (!followUpSuggestion.value.trim() || isGenerating.value) {
    console.log('[PlanGenerationTab] Early return - empty suggestion or already generating');
    return
  }

  // Initialize plan service if not already done
  if (!planService) {
    console.log('[PlanGenerationTab] Creating new PlanGenerationService');
    planService = new PlanGenerationService(props.wsClient)
    setupPlanCallbacks()
  }

  // Check if we have an active session
  const hasActiveSession = planService.getCurrentSessionId()

  if (!hasActiveSession) {
    console.warn('[PlanGenerationTab] No active session for follow-up suggestion');
    error.value = 'No active session. Please generate a plan first.'
    return
  }

  isGenerating.value = true
  progressPercentage.value = 0
  currentPhase.value = 'Applying follow-up suggestions...'
  error.value = null

  // Expand the thoughts section to show new thoughts
  thoughtsExpanded.value = true

  try {
    console.log('[PlanGenerationTab] Sending follow-up suggestion to existing session');

    // Send follow-up suggestion to existing session
    const result = await planService.sendFollowUpMessage(followUpSuggestion.value)

    console.log('[PlanGenerationTab] Follow-up plan result:', result);

    if (result.specification) {
      // Update the plan specification with the new version
      console.log('[PlanGenerationTab] Updating planSpecification.value with:', result.specification.specification.length, 'chars');

      planSpecification.value = result.specification

      // Append new design thoughts to existing ones
      if (result.thoughts && result.thoughts.length > 0) {
        designThoughts.value = [...designThoughts.value, ...result.thoughts]
      }

      progressPercentage.value = 100
      currentPhase.value = 'Follow-up applied successfully!'

      // Clear the follow-up input
      followUpSuggestion.value = ''

      // Save to task data
      emit('update-task', {
        planSpecification: planSpecification.value,
        originalPrompt: originalPrompt.value,
        designThoughts: designThoughts.value
      })
    }
  } catch (err) {
    console.error('[PlanGenerationTab] Follow-up failed with error:', err);
    error.value = err instanceof Error ? err.message : 'Follow-up plan generation failed'
    currentPhase.value = 'Follow-up plan generation failed'
  } finally {
    isGenerating.value = false
  }
}

function sendToImplementation() {
  if (!planSpecification.value) return

  emit('send-to-implementation', {
    specification: planSpecification.value.specification,
    originalPrompt: originalPrompt.value,
    metadata: planSpecification.value.metadata,
    designThoughts: designThoughts.value
  })
}

function startNewPlan() {
  clearPlan()
  if (planService) {
    planService.clear()
  }
}

// Setup plan service callbacks
function setupPlanCallbacks() {
  if (!planService) return

  // Real-time design thoughts updates callback
  planService.onDesignThoughtUpdated((thoughts) => {
    console.log('[PlanGenerationTab] Design thoughts update received:', thoughts.length, 'thoughts')
    designThoughts.value = thoughts
    // Update progress based on design thoughts
    progressPercentage.value = Math.min(10 + (thoughts.length * 8), 80)
    currentPhase.value = `Generating plan... (${thoughts.length} thoughts captured)`

    // Mark older thoughts as completed and newest as in-progress
    thoughts.forEach((thought, index) => {
      if (index < thoughts.length - 1) {
        thought.status = 'completed'
      } else {
        thought.status = 'in-progress'
      }
    })
  })
}

// Lifecycle Hooks
onMounted(async () => {
  // Initialize plan service
  planService = new PlanGenerationService(props.wsClient)
  setupPlanCallbacks()
})

onBeforeUnmount(() => {
  // Clean up plan service
  if (planService) {
    planService.clear()
  }
})

// Watch for external task data updates
watch(() => props.taskData, (newData) => {
  if (newData?.originalPrompt) {
    originalPrompt.value = newData.originalPrompt
  }
  if (newData?.planSpecification) {
    planSpecification.value = newData.planSpecification
  }
  if (newData?.designThoughts) {
    designThoughts.value = newData.designThoughts
  }

  // Watch for streaming updates
  if (newData?.streamingUpdate && planService) {
    const update = newData.streamingUpdate
    console.log('[PlanGenerationTab] Received streaming update:', update.type, 'with content length:', update.content?.length);

    if (update.type === 'message.part.updated' && update.content) {
      console.log('[PlanGenerationTab] Processing streaming design thoughts from message.part.updated');

      // Process the streaming content for design thoughts updates
      // Use the persistent processedContent Set to avoid duplicates across multiple chunks
      planService.processStreamingDesignThoughts(update.content, processedContent)
    }
  }
}, { deep: true })
</script>

<style scoped>
/* Import shared variables and animations */
@import '../../styles/shared/variables.css';
@import '../../styles/shared/animations.css';

/* Main Container */
.plan-generation-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 1rem;
  gap: 1rem;
  overflow-y: auto;
  background: linear-gradient(180deg, var(--bg-primary) 0%, rgba(26, 26, 26, 0.95) 100%);
  position: relative;
}

/* Input Card - Prevent layout shifts */
.input-card {
  position: relative;
  z-index: 5;
}

/* Input Section */
.input-header.modern {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  position: relative;
}

.input-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
  position: relative;
  z-index: 10;
}

.input-actions .clear-btn {
  margin-left: 0.25rem;
}

.input-label-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 0 1 auto;
  min-width: 0;
}

.label-icon {
  opacity: 0.5;
}

.input-label.modern {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Specification Section */
.section-header {
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
  gap: 0.5rem;
}

.section-title {
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.badge.minimal {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.375rem;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: 600;
}

.confidence-badge.confidence-very-high {
  background: rgba(34, 197, 94, 0.15);
  border-color: rgba(34, 197, 94, 0.3);
  color: #22c55e;
}

.confidence-badge.confidence-high {
  background: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.3);
  color: #3b82f6;
}

.confidence-badge.confidence-medium {
  background: rgba(245, 158, 11, 0.15);
  border-color: rgba(245, 158, 11, 0.3);
  color: #f59e0b;
}

.confidence-badge.confidence-low {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

.badge-icon {
  font-size: 0.75rem;
}

.badge-label {
  text-transform: uppercase;
  letter-spacing: 0.02em;
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
  background: #8b5cf6;
  border-radius: 50%;
  flex-shrink: 0;
}

.pulse-dot.active {
  animation: pulse 2s infinite;
}

.quick-actions.modern {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem;
  margin-bottom: 0.75rem;
}

.specification-content {
  padding: 0;
  margin-bottom: 1rem;
  position: relative;
}

.specification-content.modern {
  background: transparent;
  border: none;
}

.content-wrapper {
  width: 100%;
  position: relative;
}

/* Plan specification markdown specific styling */
.plan-specification-markdown {
  padding: 1.5rem;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.2) 100%);
  border-radius: 12px;
  border: 1px solid rgba(139, 92, 246, 0.1);
  position: relative;
  overflow: hidden;
}

.plan-specification-markdown::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, #8b5cf6, #7c3aed, #8b5cf6);
  background-size: 200% 100%;
  animation: shimmer 3s linear infinite;
}

/* Action Section */
.action-section.modern {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-top: auto;
  padding-top: 1rem;
}

.action-section.streamlined {
  margin-top: 1rem;
  padding-top: 0.5rem;
}

/* Utility Classes */
.inline-stats {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
  margin-right: 0.5rem;
}

.stat-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.625rem;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--text-secondary);
  transition: all 0.2s ease;
  white-space: nowrap;
}

/* Section Containers */
.section-container {
  width: 100%;
  margin-bottom: 0.75rem;
}

/* Enhanced Input Wrapper */
.enhanced-input-wrapper {
  position: relative;
  transition: all 0.3s ease;
}

.enhanced-input-wrapper.is-processing {
  pointer-events: none;
}

.enhanced-input-wrapper.is-processing :deep(.character-input) {
  opacity: 0.6;
  background: rgba(0, 0, 0, 0.3);
  border-color: var(--primary-color);
  animation: pulse-border 1.5s ease-in-out infinite;
}

/* Input Footer Actions */
.input-footer-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Footer Generation Trigger */
.footer-generate-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 8px;
  background: rgba(139, 92, 246, 0.1);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  outline: none;
  animation: fadeIn 0.2s ease;
}

.footer-generate-trigger:hover {
  background: rgba(139, 92, 246, 0.15);
  border-color: rgba(139, 92, 246, 0.3);
  transform: translateY(-1px);
}

.footer-generate-trigger:active {
  transform: translateY(0);
}

.trigger-icon {
  color: rgba(139, 92, 246, 0.7);
  transition: color 0.15s ease;
}

.footer-generate-trigger:hover .trigger-icon {
  color: rgba(139, 92, 246, 0.9);
}

/* Footer Processing Indicator */
.footer-processing-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 2px 0;
  animation: fadeIn 0.2s ease;
}

.processing-spinner {
  animation: spin 1.5s linear infinite;
  color: rgba(139, 92, 246, 0.7);
}

.processing-text {
  font-size: 0.7rem;
  color: rgba(139, 92, 246, 0.7);
  font-weight: 500;
}

/* Transitions */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s ease;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateX(-20px);
  opacity: 0;
}

.scale-fade-enter-active,
.scale-fade-leave-active {
  transition: all 0.4s ease;
}

.scale-fade-enter-from,
.scale-fade-leave-to {
  transform: scale(0.95);
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  max-height: 800px;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}

/* Animations */
@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(139, 92, 246, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(139, 92, 246, 0);
  }
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

@keyframes pulse-border {
  0%, 100% {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }
  50% {
    border-color: rgba(139, 92, 246, 0.6);
    box-shadow: 0 0 0 6px rgba(139, 92, 246, 0.05);
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Reduced motion for accessibility */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
</style>