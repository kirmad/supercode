<template>
  <div class="prompt-generation-tab" data-testid="prompt-generation-tab">
    <!-- Modern Input Card -->
    <div class="input-card glass">
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
          <button v-if="initialPrompt && !isEnhancing" @click="clearPrompt" class="icon-button ghost" title="Clear">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="input-wrapper">
        <textarea
          v-model="initialPrompt"
          placeholder="What would you like to create today?"
          class="prompt-input modern"
          data-testid="prompt-input"
          :disabled="isEnhancing"
          @keydown.enter.meta="handleEnhance"
          @keydown.enter.ctrl="handleEnhance"
        />
        <div class="input-footer modern">
          <div class="char-indicator">
            <div class="char-progress" :style="{ width: Math.min((initialPrompt.length / 500) * 100, 100) + '%' }"></div>
          </div>
          <span class="input-hint">{{ initialPrompt.length > 0 ? `${initialPrompt.length} characters` : 'Cmd/Ctrl + Enter' }}</span>
        </div>
      </div>
    </div>

    <!-- Modern Research Section -->
    <transition name="slide-fade">
      <div v-if="researchItems.length > 0" class="research-card glass minimal">
        <div class="card-header">
          <div class="header-left">
            <div class="pulse-dot"></div>
            <h3 class="section-title modern">Live Research</h3>
            <span class="badge minimal">{{ researchItems.length }}</span>
          </div>
          <button @click="researchExpanded = !researchExpanded" class="expand-button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" :class="{ rotated: !researchExpanded }">
              <path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
        <transition name="expand">
          <div v-show="researchExpanded"
               class="research-items-container modern"
               ref="researchContainer"
               @scroll="handleScroll">
            <div class="research-items modern">
              <transition-group name="list-slide">
                <div
                  v-for="item in researchItems"
                  :key="item.id"
                  class="research-item modern"
                >
                  <div class="item-indicator" :class="`type-${item.type}`"></div>
                  <div class="item-content">
                    <div class="item-meta">
                      <span class="item-type">{{ item.type }}</span>
                      <span class="item-priority-badge" :class="`priority-${item.priority}`">
                        {{ item.priority }}
                      </span>
                    </div>
                    <p class="item-text">{{ item.content }}</p>
                  </div>
                </div>
              </transition-group>
            </div>
          </div>
        </transition>
      </div>
    </transition>

    <!-- Clarification Questions Section -->
    <div v-if="clarificationQuestions.length > 0" class="clarification-section">
      <h3 class="section-title">Clarification Needed</h3>
      <div class="clarification-items">
        <div
          v-for="(question, index) in clarificationQuestions"
          :key="question.id"
          class="clarification-item"
        >
          <div class="question-header">
            <span class="question-number">{{ index + 1 }}.</span>
            <span class="question-text">{{ question.text }}</span>
          </div>
          <div v-if="question.options && question.options.length > 0" class="question-options">
            <label
              v-for="option in question.options"
              :key="option.value"
              class="option-label"
            >
              <input
                type="radio"
                :name="`question-${question.id}`"
                :value="option.value"
                v-model="question.answer"
                class="option-input"
              />
              <span class="option-text">{{ option.label }}</span>
            </label>
          </div>
          <div v-else class="question-input-container">
            <input
              v-model="question.answer"
              type="text"
              placeholder="Your answer..."
              class="question-input"
            />
          </div>
        </div>
      </div>
      <div class="clarification-actions">
        <button
          @click="submitClarifications"
          :disabled="!allQuestionsAnswered"
          class="action-button primary"
        >
          Continue Enhancement
        </button>
      </div>
    </div>

    <!-- Modern Enhanced Prompt Section -->
    <transition name="scale-fade">
      <div v-if="enhancedPrompt" class="enhanced-card glass premium" data-testid="enhanced-section">
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
          <button @click="copyEnhancedPrompt" class="action-pill primary" title="Copy">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.5"/>
              <path d="M5 15H4C2.89543 15 2 14.1046 2 13V4C2 2.89543 2.89543 2 4 2H13C14.1046 2 15 2.89543 15 4V5" stroke="currentColor" stroke-width="1.5"/>
            </svg>
            <span>Copy</span>
          </button>
          <button @click="sendToImplementation" class="action-pill success">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
            </svg>
            <span>Implement</span>
          </button>
          <button @click="sendToPlan" class="action-pill ghost">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15M9 5C9 6.10457 9.89543 7 11 7H13C14.1046 7 15 6.10457 15 5M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5" stroke="currentColor" stroke-width="1.5"/>
            </svg>
            <span>Plan</span>
          </button>
          <button @click="regeneratePrompt" class="icon-button ghost" title="Regenerate">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M1 4V10H7M23 20V14H17M20.49 9C19.79 5.91 16.99 3.5 13.5 3.5C9.36 3.5 6 6.86 6 11C6 11.49 6.03 11.97 6.07 12.45M3.51 15C4.21 18.09 7.01 20.5 10.5 20.5C14.64 20.5 18 17.14 18 13C18 12.51 17.97 12.03 17.93 11.55" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>

        <div class="enhanced-content modern">
          <div class="content-wrapper">
            <pre class="enhanced-text modern" data-testid="enhanced-text">{{ enhancedPrompt }}</pre>
          </div>
        </div>

        <div class="enhanced-footer modern">
          <div class="metric-group">
            <div class="metric-item compact">
              <span class="metric-value">{{ enhancementCount }}</span>
              <span class="metric-label"> enhancements</span>
            </div>
            <div class="metric-divider"></div>
            <div class="metric-item compact">
              <span class="metric-value">{{ researchSourceCount }}</span>
              <span class="metric-label"> sources</span>
            </div>
            <div class="metric-divider"></div>
            <div class="metric-item compact">
              <span class="metric-value">+{{ contextAddedPercentage }}%</span>
              <span class="metric-label"> context</span>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- Follow-up Suggestions Section -->
    <transition name="slide-fade">
      <div v-if="enhancedPrompt && !isEnhancing" class="follow-up-section glass">
        <div class="follow-up-header">
          <div class="follow-up-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 4V20M4 12H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
            </svg>
          </div>
          <label class="follow-up-label">Add Follow-up Suggestions</label>
        </div>
        <div class="follow-up-input-wrapper">
          <textarea
            v-model="followUpSuggestion"
            placeholder="Add more details or refinements to enhance further..."
            class="follow-up-input"
            @keydown.enter.meta="handleFollowUp"
            @keydown.enter.ctrl="handleFollowUp"
            rows="2"
          />
          <button
            @click="handleFollowUp"
            :disabled="!followUpSuggestion.trim()"
            class="follow-up-button"
            title="Apply follow-up"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M5 12H19M12 5L19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
        <div class="follow-up-hint">Press Cmd/Ctrl + Enter to apply</div>
      </div>
    </transition>

    <!-- Modern Action Section -->
    <div class="action-section modern">
      <button
        v-if="!enhancedPrompt && !isEnhancing"
        @click="handleEnhance"
        :disabled="!initialPrompt"
        class="enhance-button modern"
        data-testid="enhance-button"
      >
        <div class="button-content">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" opacity="0.9"/>
          </svg>
          <span>Enhance with AI</span>
        </div>
        <div class="button-glow"></div>
      </button>

      <button
        v-if="isEnhancing"
        class="enhance-button modern processing"
        disabled
      >
        <div class="button-content">
          <div class="spinner"></div>
          <span>Processing...</span>
        </div>
      </button>

      <button
        v-if="enhancedPrompt && !isEnhancing"
        @click="startNewPrompt"
        class="secondary-button modern"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M12 4V20M4 12H20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>New Prompt</span>
      </button>
    </div>

    <!-- Modern Progress Indicator -->
    <transition name="fade">
      <div v-if="isEnhancing" class="progress-section modern">
        <div class="progress-track">
          <div class="progress-fill modern" :style="{ width: progressPercentage + '%' }">
            <div class="progress-glow"></div>
          </div>
        </div>
        <div class="progress-text modern">{{ currentPhase }}</div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick, onBeforeUnmount } from 'vue'
import { PromptEnhancementService } from '../../services/PromptEnhancementService'
import { SuperCodeWebSocketClient } from '../../services/SuperCodeWebSocketClient'
import { ClarificationQuestion, EnhancedPromptMetadata, ResearchItem } from '../../types/prompt-generation'

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
/* Modern Variables */
:root {
  --glass-bg: rgba(255, 255, 255, 0.03);
  --glass-border: rgba(255, 255, 255, 0.08);
  --glass-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
  --glow-color: rgba(0, 102, 255, 0.4);
  --success-color: #10b981;
  --success-glow: rgba(16, 185, 129, 0.3);
}

/* Modern Base Styles */
.prompt-generation-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 1rem;
  gap: 1rem;
  overflow-y: auto;
  background: linear-gradient(180deg, var(--bg-primary) 0%, rgba(26, 26, 26, 0.95) 100%);
}

/* Glassmorphism */
.glass {
  background: var(--glass-bg);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow);
}

/* Modern Header */
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

.header-stats {
  display: flex;
  gap: 1rem;
}

.stat-item {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 1.25rem;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.stat-label {
  font-size: 0.65rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.7;
}

/* Modern Input Card */
.input-card {
  border-radius: 12px;
  padding: 1rem;
  transition: all 0.3s ease;
}

.input-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.4);
}

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

/* Inline Stats Badges */
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

.prompt-input.modern {
  width: 100%;
  min-height: 80px;
  max-height: 200px;
  padding: 0.75rem;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  color: var(--text-primary);
  font-family: 'SF Mono', 'Cascadia Code', monospace;
  font-size: 0.875rem;
  line-height: 1.5;
  resize: vertical;
  transition: all 0.3s ease;
}

.prompt-input.modern:focus {
  outline: none;
  border-color: var(--glow-color);
  box-shadow: 0 0 0 3px rgba(0, 102, 255, 0.1);
  background: rgba(0, 0, 0, 0.3);
}

.input-footer.modern {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.5rem;
}

.char-indicator {
  flex: 1;
  height: 2px;
  background: var(--glass-border);
  border-radius: 1px;
  overflow: hidden;
  margin-right: 0.75rem;
}

.char-progress {
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  transition: width 0.3s ease;
}

.input-hint {
  font-size: 0.7rem;
  color: var(--text-secondary);
  opacity: 0.7;
}

/* Modern Research Card */
.research-card {
  border-radius: 12px;
  padding: 0.75rem;
  transition: all 0.3s ease;
}

.research-card.minimal {
  padding: 0.5rem;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  cursor: pointer;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  background: #10b981;
  border-radius: 50%;
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

.section-title.modern {
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

.expand-button svg.rotated {
  transform: rotate(180deg);
}

.research-items-container.modern {
  max-height: 180px;
  overflow-y: auto;
  padding: 0.5rem;
  margin-top: 0.5rem;
}

.research-items.modern {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.research-item.modern {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  transition: all 0.2s ease;
}

.research-item.modern:hover {
  background: rgba(0, 0, 0, 0.3);
  transform: translateX(2px);
}

.item-indicator {
  width: 3px;
  background: var(--glass-border);
  border-radius: 2px;
  flex-shrink: 0;
}

.item-indicator.type-analysis {
  background: linear-gradient(180deg, #3b82f6 0%, #2563eb 100%);
}

.item-indicator.type-pattern {
  background: linear-gradient(180deg, #a855f7 0%, #9333ea 100%);
}

.item-indicator.type-requirement {
  background: linear-gradient(180deg, #ec4899 0%, #db2777 100%);
}

.item-indicator.type-best-practice {
  background: linear-gradient(180deg, #22c55e 0%, #16a34a 100%);
}

.item-content {
  flex: 1;
  min-width: 0;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-bottom: 0.25rem;
}

.item-type {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-secondary);
  opacity: 0.7;
}

.item-priority-badge {
  font-size: 0.625rem;
  font-weight: 600;
  padding: 0.125rem 0.375rem;
  border-radius: 8px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-left: auto;
  transition: all 0.2s ease;
}

.item-priority-badge.priority-high {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

.item-priority-badge.priority-medium {
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: #f59e0b;
}

.item-priority-badge.priority-low {
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #10b981;
}

.research-item:hover .item-priority-badge {
  transform: scale(1.05);
}

.item-text {
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--text-primary);
  margin: 0;
  opacity: 0.9;
}

/* Modern Enhanced Card */
.enhanced-card.premium {
  border-radius: 16px;
  padding: 1.25rem;
  background: linear-gradient(135deg, var(--glass-bg) 0%, rgba(16, 185, 129, 0.05) 100%);
  border: 1px solid var(--success-glow);
  position: relative;
  overflow: hidden;
}

.enhanced-card.premium::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--success-color), transparent);
  animation: shimmer 3s infinite;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.enhanced-header.modern {
  display: flex;
  justify-content: space-between;
  align-items: center;
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

.quick-actions.modern {
  display: flex;
  gap: 0.5rem;
}

.enhanced-content.modern {
  margin: 1rem 0;
}

.content-wrapper {
  max-height: 300px;
  overflow-y: auto;
  padding: 0.75rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
}

.enhanced-text.modern {
  font-family: 'SF Mono', 'Cascadia Code', monospace;
  font-size: 0.8rem;
  line-height: 1.5;
  color: var(--text-primary);
  white-space: pre-wrap;
  margin: 0;
}

.enhanced-footer.modern {
  padding-top: 1rem;
  border-top: 1px solid var(--glass-border);
}

.metric-group {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
}

.metric-item.compact {
  text-align: center;
}

.metric-item.compact .metric-value {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.metric-item.compact .metric-label {
  font-size: 0.65rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  opacity: 0.7;
}

.metric-divider {
  width: 1px;
  height: 20px;
  background: var(--glass-border);
}

/* Modern Buttons */
.icon-button {
  padding: 0.5rem;
  background: transparent;
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-button:hover {
  background: var(--glass-bg);
  transform: translateY(-1px);
}

.icon-button.ghost {
  border-color: transparent;
}

.icon-button.ghost:hover {
  background: var(--glass-bg);
  border-color: var(--glass-border);
}

.icon-button.primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  color: white;
}

.icon-button.success {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border: none;
  color: white;
}

.action-pill {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-pill:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.action-pill.primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  color: white;
}

.action-pill.success {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border: none;
  color: white;
}

.action-pill.ghost {
  background: transparent;
  border-color: var(--glass-border);
}

/* Modern Enhance Button */
.enhance-button.modern {
  position: relative;
  padding: 0.75rem 1.5rem;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.3s ease;
  overflow: hidden;
}

.enhance-button.modern:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 12px 24px rgba(102, 126, 234, 0.4);
}

.enhance-button.modern:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.button-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  position: relative;
  z-index: 1;
}

.button-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, transparent 70%);
  transform: translate(-50%, -50%);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.enhance-button.modern:hover .button-glow {
  opacity: 1;
}

.secondary-button.modern {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  background: transparent;
  color: var(--text-primary);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.secondary-button.modern:hover {
  background: var(--glass-bg);
  transform: translateY(-1px);
}

/* Spinner */
.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Modern Progress */
.progress-section.modern {
  margin-top: 0.5rem;
}

.progress-track {
  height: 3px;
  background: var(--glass-border);
  border-radius: 2px;
  overflow: hidden;
  position: relative;
}

.progress-fill.modern {
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  transition: width 0.3s ease;
  position: relative;
}

.progress-glow {
  position: absolute;
  right: 0;
  top: 50%;
  width: 20px;
  height: 10px;
  background: white;
  filter: blur(8px);
  transform: translateY(-50%);
  animation: glow 1s ease-in-out infinite;
}

@keyframes glow {
  0%, 100% {
    opacity: 0.3;
  }
  50% {
    opacity: 1;
  }
}

.progress-text.modern {
  font-size: 0.7rem;
  color: var(--text-secondary);
  margin-top: 0.375rem;
  text-align: center;
  opacity: 0.8;
}

/* Animations */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s ease;
}

.slide-fade-enter-from {
  transform: translateY(-10px);
  opacity: 0;
}

.slide-fade-leave-to {
  transform: translateY(10px);
  opacity: 0;
}

.scale-fade-enter-active,
.scale-fade-leave-active {
  transition: all 0.3s ease;
}

.scale-fade-enter-from {
  transform: scale(0.95);
  opacity: 0;
}

.scale-fade-leave-to {
  transform: scale(1.05);
  opacity: 0;
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  max-height: 300px;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}

.list-slide-enter-active,
.list-slide-leave-active,
.list-slide-move {
  transition: all 0.3s ease;
}

.list-slide-enter-from {
  transform: translateX(-20px);
  opacity: 0;
}

.list-slide-leave-to {
  transform: translateX(20px);
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Action Section */
.action-section.modern {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-top: 0.5rem;
}

/* Keep minimal old styles for clarification section */
.clarification-section {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  padding: 1rem;
}

.section-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.75rem;
}

.clarification-items {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.clarification-item {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  padding: 1rem;
}

.question-header {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.question-number {
  font-weight: 600;
  color: var(--accent-color);
}

.question-text {
  color: var(--text-primary);
}

.question-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.option-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 0.25rem;
  transition: background-color 0.2s;
}

.option-label:hover {
  background: var(--bg-secondary);
}

.option-input {
  accent-color: var(--accent-color);
}

.question-input-container {
  width: 100%;
}

.question-input {
  width: 100%;
  padding: 0.5rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.25rem;
  color: var(--text-primary);
  font-size: 0.9rem;
}

.question-input:focus {
  outline: none;
  border-color: var(--accent-color);
}

.clarification-actions {
  margin-top: 1rem;
  display: flex;
  justify-content: flex-end;
}

.action-button.primary {
  background: var(--accent-color);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.action-button.primary:hover:not(:disabled) {
  opacity: 0.9;
}

.action-button.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ==================== Enhanced Micro-Interactions ==================== */

/* Enhanced card hover effects */
.enhanced-prompt-card {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.enhanced-prompt-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 30px rgba(139, 92, 246, 0.2);
}

/* Button ripple effects */
button {
  position: relative;
  overflow: hidden;
  transform-style: preserve-3d;
}

button::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  transform: translate(-50%, -50%);
  transition: width 0.6s, height 0.6s;
  pointer-events: none;
}

button:active::after {
  width: 300px;
  height: 300px;
}

button:active {
  transform: scale(0.98);
}

/* Input field focus effects */
.input-wrapper input:focus,
.input-wrapper textarea:focus {
  transform: translateY(-1px);
  box-shadow: 0 8px 20px rgba(139, 92, 246, 0.15);
}

/* Card hover lift effect */
.input-card,
.research-card {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.input-card:hover,
.research-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.15);
}

/* Research item hover effect */
.research-item {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  position: relative;
}

.research-item:hover {
  transform: translateX(4px);
  background: rgba(139, 92, 246, 0.08);
  border-color: rgba(139, 92, 246, 0.3);
}

.research-item::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: linear-gradient(180deg, #8b5cf6, #ec4899);
  opacity: 0;
  transition: opacity 0.3s;
}

.research-item:hover::before {
  opacity: 1;
}

/* Copy button micro-interaction */
.copy-button {
  transition: all 0.2s ease;
}

.copy-button:hover {
  transform: scale(1.1) rotate(5deg);
}

.copy-button:active {
  transform: scale(0.95) rotate(-5deg);
}

/* Stat value animations */
.stat-value {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: inline-block;
}

.stat-item:hover .stat-value {
  transform: scale(1.15);
  color: #8b5cf6;
}

/* Loading skeleton */
@keyframes skeleton {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.skeleton {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.05) 25%,
    rgba(255, 255, 255, 0.1) 50%,
    rgba(255, 255, 255, 0.05) 75%
  );
  background-size: 200% 100%;
  animation: skeleton 1.5s infinite;
  border-radius: 8px;
}

/* Success animation */
@keyframes success-pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.9;
  }
}

.success-animation {
  animation: success-pulse 0.5s ease;
}

/* Error shake animation */
@keyframes error-shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
  20%, 40%, 60%, 80% { transform: translateX(2px); }
}

.error-animation {
  animation: error-shake 0.5s ease;
}

/* Badge animation on update */
@keyframes badge-bounce {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}

.badge.minimal {
  transition: all 0.3s ease;
}

/* Icon animations */
.icon-button svg,
.label-icon svg,
.header-icon svg {
  transition: transform 0.3s ease;
}

.icon-button:hover svg {
  transform: rotate(10deg) scale(1.1);
}

/* Header icon glow */
.header-icon {
  transition: filter 0.3s ease;
}

.header-section:hover .header-icon {
  filter: drop-shadow(0 0 8px rgba(139, 92, 246, 0.5));
}

/* Custom scrollbar styling */
.research-items-container::-webkit-scrollbar {
  width: 6px;
}

.research-items-container::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.research-items-container::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #8b5cf6, #ec4899);
  border-radius: 3px;
  transition: background 0.3s;
}

.research-items-container::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #9f6ffa, #f06ba5);
}

/* Progress bar animation */
@keyframes progress-flow {
  0% {
    background-position: 0% 50%;
  }
  100% {
    background-position: 100% 50%;
  }
}

.char-progress {
  background: linear-gradient(90deg, #8b5cf6, #ec4899, #8b5cf6);
  background-size: 200% 100%;
  animation: progress-flow 2s linear infinite;
}

/* Gradient text animation */
@keyframes gradient-text {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

.tab-title.modern {
  background: linear-gradient(135deg, #8b5cf6, #ec4899, #8b5cf6);
  background-size: 200% 200%;
  animation: gradient-text 3s ease infinite;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* Focus visible styles for accessibility */
button:focus-visible,
input:focus-visible,
textarea:focus-visible {
  outline: 2px solid #8b5cf6;
  outline-offset: 2px;
}

/* Smooth transitions for all interactive elements */
* {
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

/* Follow-up Section Styles */
.follow-up-section {
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 12px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(20px);
}

.follow-up-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.follow-up-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  color: #667eea;
}

.follow-up-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.follow-up-input-wrapper {
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
}

.follow-up-input {
  flex: 1;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  padding: 0.75rem;
  color: var(--text-primary);
  font-size: 0.9rem;
  font-family: inherit;
  resize: vertical;
  transition: all 0.2s ease;
  min-height: 60px;
}

.follow-up-input:hover {
  border-color: rgba(102, 126, 234, 0.3);
  background: rgba(255, 255, 255, 0.04);
}

.follow-up-input:focus {
  outline: none;
  border-color: #667eea;
  background: rgba(255, 255, 255, 0.05);
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.follow-up-input::placeholder {
  color: var(--text-muted);
  opacity: 0.6;
}

.follow-up-button {
  padding: 0.75rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  min-width: 44px;
  height: 44px;
}

.follow-up-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.follow-up-button:active:not(:disabled) {
  transform: translateY(0);
}

.follow-up-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.follow-up-hint {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 0.5rem;
  opacity: 0.7;
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