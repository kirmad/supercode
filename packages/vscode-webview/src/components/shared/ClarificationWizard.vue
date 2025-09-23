<template>
  <div class="clarification-wizard sleek" :class="{ 'streaming': isStreaming }">
    <!-- Sleek Header Bar -->
    <div class="wizard-header">
      <div class="header-left">
        <svg class="header-icon" width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <circle cx="12" cy="17" r="0.5" fill="currentColor"/>
        </svg>
        <h3 class="header-title">Refine Your Prompt</h3>
        <span class="header-count">{{ answeredCount }} of {{ questions.length }} answered</span>
      </div>
      <button v-if="answeredCount > 0" @click="showEnhancedPreview = !showEnhancedPreview" class="preview-btn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.5"/>
          <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/>
        </svg>
        Preview
      </button>
    </div>

    <!-- Progress Indicator -->
    <div class="progress-indicator">
      <div
        v-for="(q, i) in questions"
        :key="q.id"
        class="progress-dot"
        :class="{
          'active': i === currentQuestionIndex,
          'completed': q.answer || q.customAnswer
        }"
        @click="currentQuestionIndex = i"
      >
        {{ i + 1 }}
      </div>
    </div>

    <!-- Question Content -->
    <div class="question-content">
      <div class="question-slider" :style="{ transform: `translateX(-${currentQuestionIndex * 100}%)` }">
        <div
          v-for="(question, index) in questions"
          :key="question.id"
          class="question-card"
          :class="{ 'active': index === currentQuestionIndex }"
        >
          <div class="question-header">
            <span class="question-number">{{ String(index + 1).padStart(2, '0') }}</span>
            <h4 class="question-text">{{ question.text }}</h4>
          </div>

          <div class="answer-options">
            <label
              v-for="option in question.options"
              :key="option.value"
              class="option-item"
              :class="{ 'selected': question.answer === option.value }"
            >
              <input
                type="radio"
                :name="`q-${question.id}`"
                :value="option.value"
                v-model="question.answer"
                @change="handleAnswerChange(question, option.value)"
              />
              <span class="option-radio"></span>
              <span class="option-label">{{ option.label }}</span>
            </label>

            <button
              @click="toggleCustomAnswer(question.id)"
              class="custom-btn"
              :class="{ 'active': showCustomAnswers[question.id] }"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M12 20h9m-11-1l4-4m-4 4v-4m0 4l-4-4" stroke="currentColor" stroke-width="2"/>
              </svg>
              Write Custom Answer
            </button>

            <transition name="fade">
              <textarea
                v-if="showCustomAnswers[question.id]"
                v-model="question.customAnswer"
                @input="handleCustomAnswerChange(question)"
                placeholder="Enter your custom answer..."
                class="custom-input"
                rows="2"
              />
            </transition>
          </div>
        </div>
      </div>
    </div>

    <!-- Navigation -->
    <div class="navigation">
      <button
        @click="previousQuestion"
        :disabled="currentQuestionIndex === 0"
        class="nav-btn secondary"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2"/>
        </svg>
        Back
      </button>

      <span class="nav-counter">
        {{ String(currentQuestionIndex + 1).padStart(2, '0') }} / {{ String(questions.length).padStart(2, '0') }}
      </span>

      <button
        @click="nextQuestion"
        :disabled="currentQuestionIndex === questions.length - 1"
        class="nav-btn primary"
      >
        Next
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2"/>
        </svg>
      </button>
    </div>

    <!-- Actions -->
    <div class="actions">
      <button @click="skipQuestions" class="action-btn secondary">
        Skip Questions
      </button>
      <button
        @click="submitAnswers"
        :disabled="answeredCount === 0"
        class="action-btn ghost"
      >
        Continue with {{ answeredCount }} answer{{ answeredCount !== 1 ? 's' : '' }}
      </button>
    </div>

    <!-- Enhanced Preview -->
    <transition name="fade">
      <div v-if="showEnhancedPreview && enhancedContext" class="preview-panel">
        <h4>Enhanced Context Preview</h4>
        <pre>{{ enhancedContext }}</pre>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { ClarificationQuestion as BaseClarificationQuestion } from '../../services/PromptEnhancementService'

// Extend the base type to add customAnswer for local UI state
interface ClarificationQuestion extends BaseClarificationQuestion {
  customAnswer?: string
}

interface Props {
  questions: ClarificationQuestion[]
  isStreaming?: boolean
}

interface Emits {
  (e: 'submit', data: { questions: ClarificationQuestion[], answers: ClarificationQuestion[] }): void
  (e: 'skip'): void
}

const props = withDefaults(defineProps<Props>(), {
  questions: () => [],
  isStreaming: false
})

const emit = defineEmits<Emits>()

// State
const currentQuestionIndex = ref(0)
const showCustomAnswers = ref<Record<string, boolean>>({})
const showEnhancedPreview = ref(false)

// Computed
const answeredCount = computed(() => {
  return props.questions.filter(q => q.answer || q.customAnswer).length
})

// Progress percentage - currently unused but kept for future progress indicator
// const progressPercentage = computed(() => {
//   if (props.questions.length === 0) return 0
//   return Math.round((answeredCount.value / props.questions.length) * 100)
// })

const enhancedContext = computed(() => {
  const answered = props.questions.filter(q => q.answer || q.customAnswer)
  if (answered.length === 0) return ''

  return answered.map(q => {
    const answer = q.customAnswer || q.options?.find(o => o.value === q.answer)?.label || q.answer
    return `${q.text}\n→ ${answer}`
  }).join('\n\n')
})

// Methods
function handleAnswerChange(question: ClarificationQuestion, value: string) {
  question.answer = value
  if (question.customAnswer) {
    question.customAnswer = ''
    showCustomAnswers.value[question.id] = false
  }
}

function handleCustomAnswerChange(question: ClarificationQuestion) {
  if (question.customAnswer && question.customAnswer.trim()) {
    question.answer = undefined
  }
}

function toggleCustomAnswer(questionId: string) {
  showCustomAnswers.value[questionId] = !showCustomAnswers.value[questionId]
}

function nextQuestion() {
  if (currentQuestionIndex.value < props.questions.length - 1) {
    currentQuestionIndex.value++
  }
}

function previousQuestion() {
  if (currentQuestionIndex.value > 0) {
    currentQuestionIndex.value--
  }
}

function submitAnswers() {
  // Filter questions that have been answered and normalize the answer field
  const answers = props.questions
    .filter(q => q.answer || q.customAnswer)
    .map(q => ({
      ...q,
      // Ensure we have a single 'answer' field for the service
      answer: q.customAnswer || q.answer
    }))

  emit('submit', {
    questions: props.questions,
    answers
  })
}

function skipQuestions() {
  emit('skip')
}

// Initialize
onMounted(() => {
  // Auto-focus first question
  if (props.questions.length > 0) {
    currentQuestionIndex.value = 0
  }
})
</script>

<style scoped>
/* Sleek and compact design */
.clarification-wizard.sleek {
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  overflow: hidden;
}

/* Compact header */
.wizard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: rgba(139, 92, 246, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.header-icon {
  color: #a78bfa;
  flex-shrink: 0;
}

.header-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.header-count {
  font-size: 0.75rem;
  color: var(--text-secondary);
  opacity: 0.7;
}

.preview-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.preview-btn:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.12);
}

/* Progress indicator */
.progress-indicator {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.progress-dot {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 0.7rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.progress-dot.active {
  background: rgba(139, 92, 246, 0.1);
  border-color: #a78bfa;
  color: #a78bfa;
}

.progress-dot.completed {
  background: rgba(139, 92, 246, 0.05);
  border-color: rgba(139, 92, 246, 0.3);
}

.progress-dot:hover {
  background: rgba(255, 255, 255, 0.04);
}

/* Question content */
.question-content {
  padding: 1rem;
  min-height: 200px;
  overflow: hidden;
  position: relative;
}

.question-slider {
  display: flex;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
}

.question-card {
  min-width: 100%;
  flex-shrink: 0;
  opacity: 0.5;
  transition: opacity 0.3s ease;
}

.question-card.active {
  opacity: 1;
}

.question-header {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.question-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: rgba(139, 92, 246, 0.08);
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #a78bfa;
  flex-shrink: 0;
}

.question-text {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
  margin: 0;
  padding-top: 0.125rem;
  line-height: 1.4;
}

/* Answer options */
.answer-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-left: 2.5rem;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.option-item:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.1);
}

.option-item.selected {
  background: rgba(139, 92, 246, 0.08);
  border-color: rgba(139, 92, 246, 0.3);
}

.option-item input {
  display: none;
}

.option-radio {
  width: 14px;
  height: 14px;
  border: 1.5px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  position: relative;
  flex-shrink: 0;
}

.option-item.selected .option-radio {
  border-color: #a78bfa;
}

.option-item.selected .option-radio::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 6px;
  height: 6px;
  background: #a78bfa;
  border-radius: 50%;
}

.option-label {
  font-size: 0.8rem;
  color: var(--text-primary);
}

/* Custom answer */
.custom-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.625rem;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s ease;
  margin-top: 0.25rem;
}

.custom-btn:hover,
.custom-btn.active {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.12);
  color: var(--text-primary);
}

.custom-input {
  width: 100%;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 0.8rem;
  resize: none;
  margin-top: 0.5rem;
  animation: slideDown 0.2s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
    margin-top: 0;
  }
  to {
    opacity: 1;
    max-height: 100px;
    margin-top: 0.5rem;
  }
}

/* Navigation */
.navigation {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nav-btn.secondary {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--text-secondary);
}

.nav-btn.secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.12);
}

.nav-btn.primary {
  background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%);
  border: 1px solid transparent;
  color: white;
}

.nav-btn.primary:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.nav-counter {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 500;
}

/* Actions */
.actions {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: rgba(255, 255, 255, 0.01);
}

.action-btn {
  flex: 1;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn.secondary {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--text-secondary);
}

.action-btn.secondary:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.12);
}

.action-btn.ghost {
  background: rgba(139, 92, 246, 0.08);
  border: 1px solid rgba(139, 92, 246, 0.2);
  color: #a78bfa;
}

.action-btn.ghost:hover:not(:disabled) {
  background: rgba(139, 92, 246, 0.12);
  border-color: rgba(139, 92, 246, 0.3);
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Preview panel */
.preview-panel {
  padding: 1rem;
  background: rgba(139, 92, 246, 0.03);
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.preview-panel h4 {
  font-size: 0.75rem;
  font-weight: 600;
  color: #a78bfa;
  margin: 0 0 0.5rem 0;
}

.preview-panel pre {
  font-size: 0.75rem;
  color: var(--text-secondary);
  white-space: pre-wrap;
  margin: 0;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Responsive */
@media (max-width: 640px) {
  .clarification-wizard.sleek {
    border-radius: 0;
    border-left: none;
    border-right: none;
  }

  .question-content {
    padding: 0.75rem;
    min-height: 150px;
  }

  .answer-options {
    margin-left: 0;
  }

  .question-header {
    gap: 0.5rem;
  }
}
</style>