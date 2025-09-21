<template>
  <div class="prompt-generation-tab" data-testid="prompt-generation-tab">
    <!-- Modern Input Card -->
    <GlassCard hoverable custom-class="input-card">
      <div class="input-header modern">
        <div class="input-label-group">
          <div class="label-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2V6M12 18V22M4.93 4.93L7.76 7.76M16.24 16.24L19.07 19.07M2 12H6M18 12H22M4.93 19.07L7.76 16.24M16.24 7.76L19.07 4.93" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
            </svg>
          </div>
          <label class="input-label modern">Your Vision</label>
          <div class="inline-stats" v-if="researchItems.length > 0">
            <span class="stat-badge">{{ researchItems.length }} insights</span>
          </div>
        </div>
        <div class="input-actions">
          <ActionButton
            v-if="initialPrompt && !isEnhancing"
            @click="clearPrompt"
            variant="icon"
            title="Clear"
          >
            <template #icon>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </template>
          </ActionButton>
        </div>
      </div>
      <CharacterLimitInput
        v-model="initialPrompt"
        placeholder="What would you like to create today?"
        :disabled="isEnhancing"
        :multiline="true"
        :rows="3"
        :max-length="500"
        :show-progress="true"
        @meta-enter="handleEnhance"
        @ctrl-enter="handleEnhance"
      />
    </GlassCard>

    <!-- Modern Research Section -->
    <transition name="slide-fade">
      <ResearchItemsList
        v-if="researchItems.length > 0"
        :items="researchItems"
        :expanded="researchExpanded"
        @toggle-expand="researchExpanded = !researchExpanded"
      />
    </transition>

    <!-- Clarification Questions Section -->
    <ClarificationQuestions
      v-if="clarificationQuestions.length > 0"
      :questions="clarificationQuestions"
      @submit="submitClarifications"
    />

    <!-- Modern Enhanced Prompt Section -->
    <transition name="scale-fade">
      <GlassCard v-if="enhancedPrompt" variant="premium" custom-class="enhanced-card" data-testid="enhanced-section">
        <div class="enhanced-header modern">
          <div class="header-content">
            <div class="success-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <h3 class="section-title modern">Enhanced Specification</h3>
          </div>
        </div>

        <!-- Modern Quick Actions -->
        <div class="quick-actions modern">
          <ActionButton
            @click="copyEnhancedPrompt"
            variant="pill"
            title="Copy"
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
            @click="sendToPlan"
            variant="pill"
            custom-class="action-pill-ghost"
          >
            <template #icon>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15M9 5C9 6.10457 9.89543 7 11 7H13C14.1046 7 15 6.10457 15 5M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5" stroke="currentColor" stroke-width="1.5"/>
            </svg>
            </template>
            Plan
          </ActionButton>
          <ActionButton
            @click="regeneratePrompt"
            variant="icon"
            title="Regenerate"
          >
            <template #icon>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M1 4V10H7M23 20V14H17M20.49 9C19.79 5.91 16.99 3.5 13.5 3.5C9.36 3.5 6 6.86 6 11C6 11.49 6.03 11.97 6.07 12.45M3.51 15C4.21 18.09 7.01 20.5 10.5 20.5C14.64 20.5 18 17.14 18 13C18 12.51 17.97 12.03 17.93 11.55" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </template>
          </ActionButton>
        </div>

        <div class="enhanced-content modern">
          <div class="content-wrapper">
            <pre class="enhanced-text modern" data-testid="enhanced-text">{{ enhancedPrompt }}</pre>
          </div>
        </div>

        <div class="enhanced-footer modern">
          <MetricGroup
            :metrics="[
              { value: enhancementCount, label: 'enhancements', format: 'number' },
              { value: researchSourceCount, label: 'sources', format: 'number' },
              { value: `+${contextAddedPercentage}%`, label: 'context', format: 'text' }
            ]"
            compact
            show-dividers
          />
        </div>
      </GlassCard>
    </transition>

    <!-- Follow-up Suggestions Section -->
    <transition name="slide-fade">
      <GlassCard v-if="enhancedPrompt && !isEnhancing" custom-class="follow-up-section">
        <FollowUpInput
          v-model="followUpSuggestion"
          :suggestions="followUpSuggestions"
          :show-header="true"
          header-title="Follow-up Options"
          @submit="handleFollowUp"
        />
      </GlassCard>
    </transition>

    <!-- Modern Action Section -->
    <div class="action-section modern">
      <ActionButton
        v-if="!enhancedPrompt && !isEnhancing"
        @click="handleEnhance"
        :disabled="!initialPrompt"
        variant="primary"
        size="large"
        has-glow
        custom-class="enhance-button-modern"
        data-testid="enhance-button"
      >
        <template #icon>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" opacity="0.9"/>
          </svg>
        </template>
        Enhance with AI
      </ActionButton>

      <ActionButton
        v-if="isEnhancing"
        variant="primary"
        size="large"
        disabled
        loading
        custom-class="enhance-button-modern"
      >
        Processing...
      </ActionButton>

      <ActionButton
        v-if="enhancedPrompt && !isEnhancing"
        @click="startNewPrompt"
        variant="secondary"
        size="medium"
      >
        <template #icon>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 4V20M4 12H20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </template>
        New Prompt
      </ActionButton>
    </div>

    <!-- Modern Progress Indicator -->
    <transition name="fade">
      <ProgressBar
        v-if="isEnhancing"
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
import { PromptEnhancementService } from '../../services/PromptEnhancementService'
import { SuperCodeWebSocketClient } from '../../services/SuperCodeWebSocketClient'
import { ClarificationQuestion, EnhancedPromptMetadata, ResearchItem } from '../../types/prompt-generation'

// Import shared components
import GlassCard from '../shared/GlassCard.vue'
import ActionButton from '../shared/ActionButton.vue'
import ProgressBar from '../shared/ProgressBar.vue'
import MetricGroup from '../shared/MetricGroup.vue'
import ResearchItemsList from '../shared/ResearchItemsList.vue'
import CharacterLimitInput from '../shared/CharacterLimitInput.vue'
import SectionHeader from '../shared/SectionHeader.vue'
import ClarificationQuestions from '../shared/ClarificationQuestions.vue'
import FollowUpInput from '../shared/FollowUpInput.vue'

interface Props {
  modelValue: any
  sessionId: string | null
  wsClient: SuperCodeWebSocketClient
  taskData?: any
  modelInfo?: { name: string; provider: string; version?: string } | null
}

// Composition API Interfaces
interface ResearchItem {
  id: string
  type: 'analysis' | 'pattern' | 'requirement' | 'best-practice' | 'clarification'
  priority: 'high' | 'medium' | 'low'
  content: string
  timestamp: number
  status: 'pending' | 'in-progress' | 'completed'
}

interface ClarificationQuestion {
  id: string
  text: string
  type: 'text' | 'choice'
  options?: Array<{ label: string; value: string }>
  answer?: string
}

interface EnhancedPromptMetadata {
  complexity?: string
  domains?: string[]
  technologies?: string[]
  patterns?: string[]
}

// Props
const props = defineProps<{
  modelValue: any
  sessionId: string | null
  wsClient: SuperCodeWebSocketClient
  taskData?: any
  modelInfo?: { name: string; provider: string; version?: string } | null
}>()

// Emits
const emit = defineEmits(['update-task', 'send-to-implementation', 'send-to-plan'])

// Template refs
const researchContainer = ref<HTMLElement | null>(null)

// State
const initialPrompt = ref('')
const enhancedPrompt = ref('')
const enhancedMetadata = ref<EnhancedPromptMetadata | null>(null)
const isEnhancing = ref(false)
const researchItems = ref<ResearchItem[]>([])
const clarificationQuestions = ref<ClarificationQuestion[]>([])
const clarificationAnswers = ref<ClarificationQuestion[]>([])
const progressPercentage = ref(0)
const currentPhase = ref('')
const processingTime = ref(0)
const error = ref<string | null>(null)
const researchExpanded = ref(true)

// Autoscroll state
const userHasScrolled = ref(false)
const isNearBottom = ref(true)

// Follow-up state
const followUpSuggestion = ref('')
const followUpSuggestions = computed(() => {
  const suggestions = []
  if (enhancedPrompt.value) {
    suggestions.push(
      { id: '1', text: 'Add more technical details', icon: '🔧' },
      { id: '2', text: 'Include performance requirements', icon: '⚡' },
      { id: '3', text: 'Specify user experience goals', icon: '🎨' },
      { id: '4', text: 'Add security considerations', icon: '🛡️' }
    )
  }
  return suggestions
})
const followUpHistory = ref<string[]>([])

// Metrics for display
const enhancementCount = ref(0)
const researchSourceCount = ref(0)
const contextAddedPercentage = ref(0)

// Computed
const allQuestionsAnswered = computed(() => {
  return clarificationQuestions.value.every(q => q.answer && q.answer.trim() !== '')
})

// Enhancement Service
let enhancementService: PromptEnhancementService | null = null

// Methods
async function handleEnhance() {
  if (!initialPrompt.value || isEnhancing.value) return

  // Initialize enhancement service if not already done
  if (!enhancementService) {
    enhancementService = new PromptEnhancementService(props.wsClient)
    setupEnhancementCallbacks()
  }

  isEnhancing.value = true
  progressPercentage.value = 0
  currentPhase.value = 'Initializing enhancement process...'
  researchItems.value = []
  clarificationQuestions.value = []
  enhancedPrompt.value = ''
  error.value = null

  try {
    // Extract provider and model from modelInfo prop or use defaults
    const providerId = props.modelInfo?.provider || 'anthropic'
    const modelId = props.modelInfo?.modelId || 'claude-3-5-sonnet-latest'

    console.log('[PromptGenerationTab] Calling enhancementService.enhancePrompt with prompt:', initialPrompt.value);
    console.log('[PromptGenerationTab] Using provider:', providerId, 'model:', modelId);

    // Use real AI enhancement with SuperCode
    const result = await enhancementService.enhancePrompt(
      initialPrompt.value,
      clarificationAnswers.value.length > 0 ? clarificationAnswers.value : undefined,
      providerId,
      modelId
    )

    console.log('[PromptGenerationTab] Enhancement result:', result);
    console.log('[PromptGenerationTab] Result structure:', {
      hasClarifications: !!(result.clarificationQuestions && result.clarificationQuestions.length > 0),
      hasEnhancedPrompt: !!result.enhancedPrompt,
      hasMetadata: !!result.metadata,
      hasResearchItems: !!(result.researchItems && result.researchItems.length > 0)
    });

    if (result.clarificationQuestions && result.clarificationQuestions.length > 0) {
      console.log('[PromptGenerationTab] Setting clarification questions:', result.clarificationQuestions);
      clarificationQuestions.value = result.clarificationQuestions
      currentPhase.value = 'Clarification needed'
    } else if (result.enhancedPrompt) {
      console.log('[PromptGenerationTab] Setting enhanced prompt:', result.enhancedPrompt);
      console.log('[PromptGenerationTab] Setting metadata:', result.metadata);
      enhancedPrompt.value = result.enhancedPrompt
      enhancedMetadata.value = result.metadata
      researchItems.value = result.researchItems

      // Calculate display metrics
      if (result.metadata) {
        enhancementCount.value = (result.metadata.technologies?.length || 0) + (result.metadata.patterns?.length || 0)
        researchSourceCount.value = result.researchItems?.length || 0
      } else {
        enhancementCount.value = result.researchItems?.length || 0
        researchSourceCount.value = result.researchItems?.length || 0
      }

      if (initialPrompt.value.length > 0) {
        contextAddedPercentage.value = Math.round((enhancedPrompt.value.length / initialPrompt.value.length - 1) * 100)
      }

      progressPercentage.value = 100
      currentPhase.value = 'Enhancement complete!'

      // Minimize research section when enhancement is complete
      researchExpanded.value = false

      // Save to task data
      emit('update-task', {
        enhancedPrompt: enhancedPrompt.value,
        originalPrompt: initialPrompt.value,
        research: researchItems.value,
        clarifications: clarificationQuestions.value
      })
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Enhancement failed'
    console.error('Enhancement failed:', err)
    currentPhase.value = 'Enhancement failed'
  } finally {
    isEnhancing.value = false
  }
}


async function submitClarifications() {
  if (!allQuestionsAnswered.value) return

  // Store the answered questions for the next enhancement
  clarificationAnswers.value = [...clarificationQuestions.value]

  // Clear the current questions as they've been answered
  clarificationQuestions.value = []

  // Re-run enhancement with clarifications
  await handleEnhance()
}


function clearPrompt() {
  initialPrompt.value = ''
  enhancedPrompt.value = ''
  researchItems.value = []
  clarificationQuestions.value = []
  progressPercentage.value = 0
  currentPhase.value = ''
  followUpSuggestion.value = ''
  followUpHistory.value = []
}

async function copyEnhancedPrompt() {
  if (!enhancedPrompt.value) return

  try {
    await navigator.clipboard.writeText(enhancedPrompt.value)
    // Could add a toast notification here
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

// Check if user is near the bottom of the scroll container
function checkIfNearBottom() {
  if (!researchContainer.value) return true

  const container = researchContainer.value
  const threshold = 50 // pixels from bottom
  const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight

  return distanceFromBottom <= threshold
}

// Handle user scroll events
function handleScroll() {
  if (!researchContainer.value) return

  // Check if user is near the bottom
  isNearBottom.value = checkIfNearBottom()

  // If user scrolled back to bottom, resume autoscroll
  if (isNearBottom.value) {
    userHasScrolled.value = false
  } else {
    // User has scrolled away from bottom
    userHasScrolled.value = true
  }
}

// Smart autoscroll function
function scrollToLatestResearch() {
  if (!researchContainer.value || !researchExpanded.value) return

  // Only autoscroll if user hasn't manually scrolled or is near bottom
  if (!userHasScrolled.value || isNearBottom.value) {
    nextTick(() => {
      const container = researchContainer.value
      if (container) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        })
        // Reset the scroll flag since we're at bottom now
        userHasScrolled.value = false
        isNearBottom.value = true
      }
    })
  }
}

async function regeneratePrompt() {
  if (!enhancementService) {
    enhancementService = new PromptEnhancementService(props.wsClient)
    setupEnhancementCallbacks()
  }

  enhancedPrompt.value = ''
  clarificationAnswers.value = []
  researchItems.value = []
  error.value = null

  isEnhancing.value = true
  progressPercentage.value = 0
  currentPhase.value = 'Regenerating with alternative approach...'

  try {
    const result = await enhancementService.regeneratePrompt(initialPrompt.value)

    enhancedPrompt.value = result.enhancedPrompt
    enhancedMetadata.value = result.metadata
    researchItems.value = result.researchItems

    // Calculate display metrics
    enhancementCount.value = (result.metadata?.technologies?.length || 0) + (result.metadata?.patterns?.length || 0)
    researchSourceCount.value = result.researchItems?.length || 0

    if (initialPrompt.value.length > 0) {
      contextAddedPercentage.value = Math.round((enhancedPrompt.value.length / initialPrompt.value.length - 1) * 100)
    }

    progressPercentage.value = 100
    currentPhase.value = 'Regeneration complete!'

    // Save to task data
    emit('update-task', {
      enhancedPrompt: enhancedPrompt.value,
      originalPrompt: initialPrompt.value,
      research: researchItems.value,
      clarifications: []
    })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Regeneration failed'
    console.error('Regeneration failed:', err)
    currentPhase.value = 'Regeneration failed'
  } finally {
    isEnhancing.value = false
  }
}

async function handleFollowUp() {
  console.log('[PromptGenerationTab] handleFollowUp called');
  console.log('[PromptGenerationTab] followUpSuggestion:', followUpSuggestion.value);
  console.log('[PromptGenerationTab] isEnhancing:', isEnhancing.value);

  if (!followUpSuggestion.value.trim() || isEnhancing.value) {
    console.log('[PromptGenerationTab] Early return - empty suggestion or already enhancing');
    return
  }

  // Initialize enhancement service if not already done
  if (!enhancementService) {
    console.log('[PromptGenerationTab] Creating new PromptEnhancementService');
    enhancementService = new PromptEnhancementService(props.wsClient)
    setupEnhancementCallbacks()
  }

  // Store the follow-up in history
  followUpHistory.value.push(followUpSuggestion.value)

  isEnhancing.value = true
  progressPercentage.value = 0
  currentPhase.value = 'Applying follow-up suggestions...'
  error.value = null

  // Don't clear research items, but expand the section to show new items
  researchExpanded.value = true

  try {
    // Extract provider and model from modelInfo prop or use defaults
    const providerId = props.modelInfo?.provider || 'anthropic'
    const modelId = props.modelInfo?.modelId || 'claude-3-5-sonnet-latest'

    console.log('[PromptGenerationTab] Applying follow-up suggestion:', followUpSuggestion.value);
    console.log('[PromptGenerationTab] Using provider:', providerId, 'model:', modelId);

    // Create a combined prompt that includes the original, enhanced, and follow-up
    const combinedContext = {
      originalPrompt: initialPrompt.value,
      currentEnhancedPrompt: enhancedPrompt.value,
      followUpSuggestion: followUpSuggestion.value,
      previousResearch: researchItems.value
    }

    // Call the enhancement service with the follow-up context
    const result = await enhancementService.enhanceWithFollowUp(
      combinedContext,
      providerId,
      modelId
    )

    console.log('[PromptGenerationTab] Follow-up enhancement result:', result);

    if (result.enhancedPrompt) {
      // Update the enhanced prompt with the new version
      enhancedPrompt.value = result.enhancedPrompt
      enhancedMetadata.value = result.metadata

      // Append new research items to existing ones
      if (result.researchItems && result.researchItems.length > 0) {
        researchItems.value = [...researchItems.value, ...result.researchItems]
      }

      // Calculate updated metrics
      if (result.metadata) {
        enhancementCount.value = (result.metadata.technologies?.length || 0) + (result.metadata.patterns?.length || 0)
        researchSourceCount.value = researchItems.value.length
      }

      if (initialPrompt.value.length > 0) {
        contextAddedPercentage.value = Math.round((enhancedPrompt.value.length / initialPrompt.value.length - 1) * 100)
      }

      progressPercentage.value = 100
      currentPhase.value = 'Follow-up applied successfully!'

      // Clear the follow-up input
      followUpSuggestion.value = ''

      // Save to task data
      emit('update-task', {
        enhancedPrompt: enhancedPrompt.value,
        originalPrompt: initialPrompt.value,
        research: researchItems.value,
        clarifications: clarificationQuestions.value,
        followUpHistory: followUpHistory.value
      })
    }
  } catch (err) {
    console.error('[PromptGenerationTab] Follow-up failed with error:', err);
    console.error('[PromptGenerationTab] Error stack:', err instanceof Error ? err.stack : 'No stack trace');
    error.value = err instanceof Error ? err.message : 'Follow-up enhancement failed'
    currentPhase.value = 'Follow-up enhancement failed'
  } finally {
    isEnhancing.value = false
    console.log('[PromptGenerationTab] handleFollowUp completed, isEnhancing set to false');
  }
}

function sendToImplementation() {
  if (!enhancedPrompt.value) return

  emit('send-to-implementation', {
    prompt: enhancedPrompt.value,
    originalPrompt: initialPrompt.value,
    metadata: enhancedMetadata.value,
    research: researchItems.value
  })
}

function sendToPlan() {
  if (!enhancedPrompt.value) return

  emit('send-to-plan', {
    prompt: enhancedPrompt.value,
    originalPrompt: initialPrompt.value,
    metadata: enhancedMetadata.value,
    research: researchItems.value
  })
}

function startNewPrompt() {
  clearPrompt()
  // Reset all state for a fresh start
  enhancementCount.value = 0
  researchSourceCount.value = 0
  contextAddedPercentage.value = 0
  if (enhancementService) {
    enhancementService.clear()
  }
}


// Setup enhancement service callbacks
function setupEnhancementCallbacks() {
  if (!enhancementService) return

  // Real-time research updates callback
  enhancementService.onResearchUpdate = (items) => {
    console.log('[PromptGenerationTab] Research update received:', items.length, 'items')
    researchItems.value = items
    // Update progress based on research items
    progressPercentage.value = Math.min(10 + (items.length * 5), 70)
    currentPhase.value = `Researching... (${items.length} insights discovered)`

    // Smart autoscroll to show latest research
    scrollToLatestResearch()

    // Mark older items as completed and newest as in-progress
    items.forEach((item, index) => {
      if (index < items.length - 1) {
        item.status = 'completed'
      } else {
        item.status = 'in-progress'
      }
    })

    // Auto-scroll to show latest research
    nextTick(() => {
      scrollToLatestResearch()
    })
  }

  enhancementService.onResearchItemUpdate((items) => {
    researchItems.value = items
    // Update progress based on research items
    progressPercentage.value = Math.min(10 + (items.length * 5), 70)
    currentPhase.value = `Researching... (${items.length} insights discovered)`

    // Smart autoscroll to show latest research
    scrollToLatestResearch()
  })

  enhancementService.onClarificationNeeded = (questions) => {
    clarificationQuestions.value = questions
    currentPhase.value = 'Clarification required'
  }

  enhancementService.onProgressUpdate = (phase, percentage) => {
    currentPhase.value = phase
    progressPercentage.value = percentage
  }
}

// Lifecycle Hooks
onMounted(() => {
  // Initialize enhancement service (will use real SuperCode if available, fallback to simulation)
  enhancementService = new PromptEnhancementService(props.wsClient)
  setupEnhancementCallbacks()
})

onBeforeUnmount(() => {
  // Clean up enhancement service
  if (enhancementService) {
    enhancementService.clear()
  }
})

// Watch for external task data updates
watch(() => props.taskData, (newData) => {
  if (newData?.initialPrompt) {
    initialPrompt.value = newData.initialPrompt
  }
  if (newData?.enhancedPrompt) {
    enhancedPrompt.value = newData.enhancedPrompt
    enhancedMetadata.value = newData.metadata
  }
  if (newData?.research) {
    researchItems.value = newData.research
  }

  // NEW: Watch for streaming updates
  if (newData?.streamingUpdate && enhancementService) {
    const update = newData.streamingUpdate
    console.log('[PromptGenerationTab] Received streaming update:', update.type, 'with content length:', update.content?.length);

    if (update.type === 'message.part.updated' && update.content) {
      console.log('[PromptGenerationTab] Processing streaming research from message.part.updated');

      // Track processed content to avoid duplicates
      const processedContent = new Set<string>()

      // Process the streaming content for research updates
      enhancementService.processStreamingResearch(update.content, processedContent)
    }
  }
}, { deep: true })
</script>

<style scoped>
/* Import shared variables and animations */
@import '../../styles/shared/variables.css';
@import '../../styles/shared/animations.css';

/* This component has been refactored to use shared components.
   Most styles have been moved to:
   - GlassCard.vue
   - ActionButton.vue
   - ProgressBar.vue
   - MetricGroup.vue
   - ResearchItemsList.vue
   - CharacterLimitInput.vue
   - SectionHeader.vue
   - ClarificationQuestions.vue
   - FollowUpInput.vue
*/

/* Main Container */
.prompt-generation-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 1rem;
  gap: 1rem;
  overflow-y: auto;
  background: linear-gradient(180deg, var(--bg-primary) 0%, rgba(26, 26, 26, 0.95) 100%);
}

/* Header Section */
.header-section.modern {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--glass-border);
  margin-bottom: 0.5rem;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 10px;
  color: white;
}

.tab-title.modern {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -0.02em;
}

.tab-subtitle {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin: 0;
  opacity: 0.8;
}

/* Input Section */
.input-header.modern {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.input-label-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
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

/* Enhanced Section */
.enhanced-header.modern {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.quick-actions.modern {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.success-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border-radius: 8px;
  color: white;
}

.enhanced-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
}

.enhanced-content {
  padding: 1.5rem 1rem 1rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  border: 1px solid rgba(16, 185, 129, 0.2);
  margin-bottom: 1rem;
}

.enhanced-text {
  color: var(--text-primary);
  font-size: 0.875rem;
  line-height: 1.6;
  margin: 0;
}

/* Action Section */
.action-section.modern {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-top: auto;
  padding-top: 1rem;
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

.stat-badge.success {
  background: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.2);
  color: #10b981;
}

/* Transition Classes */
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

/* Visual Enhancements */
.enhanced-card {
  position: relative;
  overflow: visible;
}

.enhanced-card::before {
  content: '';
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  background: linear-gradient(45deg, #10b981, #059669, #10b981);
  border-radius: 12px;
  opacity: 0.3;
  z-index: -1;
  animation: glow 3s ease-in-out infinite;
}

@keyframes glow {
  0%, 100% {
    opacity: 0.3;
  }
  50% {
    opacity: 0.6;
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