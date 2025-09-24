<template>
  <div class="clarification-display-container" :class="{ 'expanded': expanded }">
    <div class="clarification-header" @click="$emit('toggle-expand')">
      <div class="header-left">
        <div class="pulse-dot" :class="{ 'active': showPulse && !reviewMode && isProcessing }"></div>
        <h3 class="section-title">{{ title }}</h3>
        <span v-if="questions.length > 0" class="badge minimal">
          {{ answeredCount }}/{{ questions.length }}
        </span>
        <span v-if="reviewMode" class="status-badge answered">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Answered
        </span>
      </div>
      <button v-if="collapsible" class="expand-button" :class="{ 'rotated': !expanded }">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>

    <transition name="expand">
      <div v-show="expanded" class="clarification-content">
        <!-- Answer mode with horizontal scrolling -->
        <div v-if="!reviewMode" class="answer-interface">
          <!-- Progress indicator -->
          <div class="progress-indicator">
            <div
              v-for="(question, index) in questions"
              :key="question.id"
              class="progress-dot"
              :class="{
                'active': currentQuestionIndex === index,
                'completed': question.answer || question.customAnswer
              }"
              @click="goToQuestion(index)"
            >
              <span v-if="question.answer || question.customAnswer">✓</span>
            </div>
          </div>

          <!-- Questions carousel -->
          <div class="questions-carousel">
            <div
              class="questions-track"
              :style="{ transform: `translateX(-${currentQuestionIndex * 100}%)` }"
            >
              <div
                v-for="(question, index) in questions"
                :key="question.id"
                class="question-slide"
              >
                <div class="question-card">
                  <div class="question-header">
                    <span class="question-number">Question {{ index + 1 }} of {{ questions.length }}</span>
                  </div>

                  <div class="question-text">{{ question.text }}</div>

                  <!-- Options for choice questions -->
                  <div v-if="question.options && question.options.length > 0" class="answer-options">
                    <button
                      v-for="option in question.options"
                      :key="option.value"
                      class="option-button"
                      :class="{ 'selected': question.answer === option.value }"
                      @click="selectOption(question, option.value)"
                      :disabled="isProcessing"
                    >
                      <span class="option-letter">{{ option.value }}</span>
                      <span class="option-label">{{ option.label }}</span>
                    </button>
                  </div>

                  <!-- Text input for text questions -->
                  <div v-if="!question.options || question.options.length === 0" class="text-answer">
                    <textarea
                      v-model="question.answer"
                      @keydown.enter.prevent="handleTextAnswer(question)"
                      placeholder="Type your answer and press Enter..."
                      :disabled="isProcessing"
                      class="answer-input"
                      rows="3"
                      ref="textInput"
                    />
                    <div class="input-hint">Press Enter to continue</div>
                  </div>

                  <!-- Custom answer option for choice questions -->
                  <div v-if="question.options && question.options.length > 0" class="custom-answer-section">
                    <button
                      @click="enableCustomAnswer(question)"
                      class="custom-answer-toggle"
                      :class="{ 'active': showCustomAnswers[question.id] }"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M12 20h9m-11-1l4-4m-4 4v-4m0 4l-4-4" stroke="currentColor" stroke-width="2"/>
                      </svg>
                      Or type a custom answer
                    </button>

                    <div v-if="showCustomAnswers[question.id]" class="custom-text-input">
                      <textarea
                        v-model="question.customAnswer"
                        @keydown.enter.prevent="handleCustomAnswer(question)"
                        placeholder="Type your custom answer and press Enter..."
                        :disabled="isProcessing"
                        class="answer-input custom"
                        rows="2"
                        ref="customInput"
                      />
                      <div class="input-hint">Press Enter to continue</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Navigation controls -->
          <div class="navigation-controls">
            <button
              @click="previousQuestion"
              :disabled="currentQuestionIndex === 0"
              class="nav-icon-button"
              title="Previous question"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>

            <div class="nav-center">
              <button
                v-if="currentQuestionIndex === questions.length - 1 && answeredCount > 0"
                @click="submitAnswers"
                :disabled="isProcessing"
                class="submit-button"
              >
                Submit {{ answeredCount }} Answer{{ answeredCount !== 1 ? 's' : '' }}
              </button>
              <span v-else class="question-counter">
                {{ currentQuestionIndex + 1 }} / {{ questions.length }}
              </span>
            </div>

            <div class="nav-right">
              <button
                @click="nextQuestion"
                :disabled="currentQuestionIndex >= questions.length - 1"
                class="nav-icon-button"
                title="Next question"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <button
                @click="skipQuestions"
                :disabled="isProcessing"
                class="skip-text-button"
                title="Skip all questions"
              >
                Skip All
              </button>
            </div>
          </div>
        </div>

        <!-- Review mode after submission -->
        <div v-else class="review-mode">
          <div class="review-grid">
            <div
              v-for="question in questions"
              :key="question.id"
              class="review-item"
            >
              <div class="review-question">{{ question.text }}</div>
              <div class="review-answer">
                <span class="answer-prefix">→</span>
                <span>{{ getAnswerText(question) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import type { ClarificationQuestion as BaseClarificationQuestion } from '../../services/PromptEnhancementService'

// Extend the base type to add customAnswer for local UI state
interface ClarificationQuestion extends BaseClarificationQuestion {
  customAnswer?: string
}

interface Props {
  questions: ClarificationQuestion[]
  title?: string
  expanded?: boolean
  collapsible?: boolean
  showPulse?: boolean
  isProcessing?: boolean
  reviewMode?: boolean
}

interface Emits {
  (e: 'toggle-expand'): void
  (e: 'submit', data: { questions: ClarificationQuestion[], answers: ClarificationQuestion[] }): void
  (e: 'skip'): void
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Clarification Questions',
  expanded: true,
  collapsible: true,
  showPulse: true,
  isProcessing: false,
  reviewMode: false
})

const emit = defineEmits<Emits>()

// Local state
const currentQuestionIndex = ref(0)
const showCustomAnswers = ref<Record<string, boolean>>({})
const textInput = ref<HTMLTextAreaElement | null>(null)
const customInput = ref<HTMLTextAreaElement | null>(null)

// Computed
const answeredCount = computed(() => {
  return props.questions.filter(q => q.answer || q.customAnswer).length
})

const currentQuestion = computed(() => {
  return props.questions[currentQuestionIndex.value]
})

// Methods
function goToQuestion(index: number) {
  currentQuestionIndex.value = index
  focusCurrentInput()
}

function previousQuestion() {
  if (currentQuestionIndex.value > 0) {
    currentQuestionIndex.value--
    focusCurrentInput()
  }
}

function nextQuestion() {
  if (currentQuestionIndex.value < props.questions.length - 1) {
    currentQuestionIndex.value++
    focusCurrentInput()
  }
}

function selectOption(question: ClarificationQuestion, value: string) {
  question.answer = value
  question.customAnswer = undefined
  showCustomAnswers.value[question.id] = false

  // Automatically move to next question
  setTimeout(() => {
    if (currentQuestionIndex.value < props.questions.length - 1) {
      nextQuestion()
    }
  }, 300)
}

function handleTextAnswer(question: ClarificationQuestion) {
  if (question.answer && question.answer.trim()) {
    // Move to next question
    if (currentQuestionIndex.value < props.questions.length - 1) {
      nextQuestion()
    }
  }
}

function enableCustomAnswer(question: ClarificationQuestion) {
  showCustomAnswers.value[question.id] = !showCustomAnswers.value[question.id]
  if (showCustomAnswers.value[question.id]) {
    // Clear the selected option when switching to custom
    question.answer = undefined
    // Focus the custom input after DOM update
    nextTick(() => {
      if (customInput.value) {
        customInput.value.focus()
      }
    })
  }
}

function handleCustomAnswer(question: ClarificationQuestion) {
  if (question.customAnswer && question.customAnswer.trim()) {
    // Move answer from customAnswer to answer field
    question.answer = question.customAnswer
    // Move to next question
    if (currentQuestionIndex.value < props.questions.length - 1) {
      nextQuestion()
    }
  }
}

function focusCurrentInput() {
  nextTick(() => {
    const question = currentQuestion.value
    if (!question) return

    // Focus text input if it's a text question or custom answer is enabled
    if (!question.options || question.options.length === 0) {
      if (textInput.value) {
        textInput.value.focus()
      }
    } else if (showCustomAnswers.value[question.id]) {
      if (customInput.value) {
        customInput.value.focus()
      }
    }
  })
}

function getAnswerText(question: ClarificationQuestion): string {
  if (question.customAnswer) {
    return question.customAnswer
  }

  if (question.answer && question.options) {
    const option = question.options.find(opt => opt.value === question.answer)
    return option?.label || question.answer
  }

  return question.answer || 'Not answered'
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

// Watch for expanded state to focus input when opened
watch(() => props.expanded, (newVal) => {
  if (newVal && !props.reviewMode) {
    focusCurrentInput()
  }
})
</script>

<style scoped>
/* Container styling matching ResearchItemsList */
.clarification-display-container {
  width: 100%;
  transition: all 0.3s ease;
}

.clarification-display-container.expanded {
  /* Remove shadow for cleaner look */
}

/* Header styling - match Research section */
.clarification-header {
  padding: 0.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  background: #8b5cf6;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}

.section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.badge.minimal {
  padding: 0.125rem 0.375rem;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-badge.answered {
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.2);
  color: #4ade80;
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

/* Content area */
.clarification-content {
  padding: 1rem;
  padding-top: 0.75rem;
}

/* Progress indicator */
.progress-indicator {
  display: flex;
  justify-content: center;
  gap: 0.375rem;
  margin-bottom: 1.25rem;
}

.progress-dot {
  width: 6px;
  height: 6px;
  background: var(--glass-border);
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 5px;
  color: white;
  opacity: 0.5;
}

.progress-dot.active {
  width: 20px;
  background: linear-gradient(90deg, #8b5cf6, #a78bfa);
  border-radius: 10px;
  opacity: 1;
}

.progress-dot.completed {
  background: #8b5cf6;
  width: 12px;
  height: 12px;
  opacity: 0.8;
}

/* Questions carousel */
.questions-carousel {
  overflow: hidden;
  margin-bottom: 1.5rem;
}

.questions-track {
  display: flex;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.question-slide {
  min-width: 100%;
  padding: 0 0.5rem;
}

.question-card {
  background: transparent;
  border: none;
  padding: 0.75rem 0;
  min-height: 240px;
  display: flex;
  flex-direction: column;
}

.question-header {
  margin-bottom: 1.25rem;
}

.question-number {
  font-size: 0.65rem;
  color: var(--text-secondary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.6;
}

.question-text {
  font-size: 0.875rem;
  color: var(--text-primary);
  line-height: 1.5;
  margin-bottom: 1.5rem;
  font-weight: 400;
  opacity: 0.95;
}

/* Answer options */
.answer-options {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.option-button {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.875rem 1.125rem;
  background: rgba(0, 0, 0, 0.15);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
  color: var(--text-primary);
  position: relative;
  overflow: hidden;
}

.option-button:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.2);
  border-color: rgba(139, 92, 246, 0.3);
  transform: translateX(4px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.option-button.selected {
  background: rgba(139, 92, 246, 0.1);
  border-color: rgba(139, 92, 246, 0.35);
  box-shadow: 0 0 0 1px rgba(139, 92, 246, 0.15) inset;
}

.option-button.selected::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(180deg, #8b5cf6, #a78bfa);
}

.option-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.option-letter {
  min-width: 28px;
  padding: 0.25rem 0.5rem;
  background: rgba(139, 92, 246, 0.08);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 600;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
  color: #a78bfa;
  flex-shrink: 0;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.option-button.selected .option-letter {
  background: rgba(139, 92, 246, 0.2);
  border-color: rgba(139, 92, 246, 0.4);
  color: #c4b5fd;
}

.option-label {
  font-size: 0.8125rem;
  font-weight: 400;
  flex: 1;
  line-height: 1.4;
  opacity: 0.95;
}

/* Text answer */
.text-answer {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.answer-input {
  width: 100%;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 0.875rem;
  font-family: inherit;
  resize: vertical;
  transition: all 0.2s ease;
}

.answer-input:focus {
  outline: none;
  border-color: rgba(139, 92, 246, 0.3);
  background: rgba(255, 255, 255, 0.04);
}

.answer-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.answer-input.custom {
  margin-top: 0.75rem;
}

.input-hint {
  font-size: 0.7rem;
  color: var(--text-secondary);
  margin-top: 0.5rem;
  opacity: 0.7;
}

/* Custom answer section */
.custom-answer-section {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.custom-answer-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.625rem;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.custom-answer-toggle:hover {
  background: rgba(255, 255, 255, 0.02);
  border-color: rgba(255, 255, 255, 0.12);
  color: var(--text-primary);
}

.custom-answer-toggle.active {
  background: rgba(139, 92, 246, 0.08);
  border-color: rgba(139, 92, 246, 0.3);
  color: #a78bfa;
}

.custom-text-input {
  animation: slideDown 0.3s ease;
}

@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 150px;
  }
}

/* Navigation controls */
.navigation-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.nav-icon-button {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 50%;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.nav-icon-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.15);
  transform: scale(1.05);
}

.nav-icon-button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.nav-center {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  justify-content: center;
}

.question-counter {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.submit-button {
  padding: 0.625rem 1.25rem;
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  border: none;
  border-radius: 8px;
  color: white;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.submit-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
}

.submit-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.skip-text-button {
  padding: 0.375rem 0.625rem;
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.skip-text-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.02);
  border-color: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}

.skip-text-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Review mode */
.review-mode {
  padding: 0.5rem 0;
}

.review-grid {
  display: grid;
  gap: 0.75rem;
}

.review-item {
  padding: 0.875rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  transition: all 0.2s ease;
}

.review-item:hover {
  background: rgba(255, 255, 255, 0.03);
}

.review-question {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  margin-bottom: 0.375rem;
}

.review-answer {
  font-size: 0.875rem;
  color: var(--text-primary);
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.answer-prefix {
  color: #8b5cf6;
  font-weight: 600;
  flex-shrink: 0;
}

/* Expand transition */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  max-height: 500px;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>