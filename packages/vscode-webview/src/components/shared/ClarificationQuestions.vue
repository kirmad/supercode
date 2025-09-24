<template>
  <div class="clarification-questions">
    <SectionHeader
      :title="title"
      :badge="questions.length"
      variant="modern"
    />

    <div class="questions-list">
      <div
        v-for="(question, index) in questions"
        :key="question.id"
        class="question-item"
      >
        <div class="question-header">
          <span class="question-number">{{ index + 1 }}.</span>
          <span class="question-text">{{ question.text }}</span>
          <span v-if="question.required" class="required-indicator">*</span>
        </div>

        <!-- Multiple Choice Options -->
        <div v-if="question.options && question.options.length > 0" class="question-options">
          <label
            v-for="option in question.options"
            :key="option.value"
            class="option-label"
            :class="{ 'selected': localAnswers[question.id] === option.value }"
          >
            <input
              type="radio"
              :name="`question-${question.id}`"
              :value="option.value"
              v-model="localAnswers[question.id]"
              @change="handleAnswerChange(question.id, option.value)"
              class="option-input"
            />
            <span class="option-radio"></span>
            <span class="option-text">{{ option.label }}</span>
          </label>
        </div>

        <!-- Text Input -->
        <div v-else class="question-input-container">
          <CharacterLimitInput
            v-model="localAnswers[question.id]"
            :placeholder="question.placeholder || 'Your answer...'"
            :multiline="question.multiline"
            :rows="question.rows || 2"
            :max-length="question.maxLength"
            :show-character-count="question.showCharacterCount !== false"
            @update:model-value="(value) => handleAnswerChange(question.id, value)"
          />
        </div>
      </div>
    </div>

    <div v-if="showActions" class="clarification-actions">
      <ActionButton
        @click="handleSubmit"
        :disabled="!allRequiredAnswered"
        variant="primary"
        size="medium"
      >
        {{ submitLabel }}
      </ActionButton>
      <ActionButton
        v-if="showSkip"
        @click="handleSkip"
        variant="ghost"
        size="medium"
      >
        Skip for now
      </ActionButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import SectionHeader from './SectionHeader.vue'
import CharacterLimitInput from './CharacterLimitInput.vue'
import ActionButton from './ActionButton.vue'

export interface ClarificationQuestion {
  id: string
  text: string
  type?: 'text' | 'choice'
  options?: Array<{ label: string; value: string }>
  placeholder?: string
  required?: boolean
  multiline?: boolean
  rows?: number
  maxLength?: number
  showCharacterCount?: boolean
  answer?: string
}

interface Props {
  questions: ClarificationQuestion[]
  title?: string
  submitLabel?: string
  showActions?: boolean
  showSkip?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Clarification Needed',
  submitLabel: 'Continue Enhancement',
  showActions: true,
  showSkip: false
})

const emit = defineEmits(['submit', 'skip', 'answer-change'])

const localAnswers = ref<Record<string, string>>({})

// Initialize answers from questions
watch(() => props.questions, (newQuestions) => {
  newQuestions.forEach(q => {
    if (q.answer && !localAnswers.value[q.id]) {
      localAnswers.value[q.id] = q.answer
    }
  })
}, { immediate: true })

const allRequiredAnswered = computed(() => {
  return props.questions
    .filter(q => q.required !== false)
    .every(q => localAnswers.value[q.id] && localAnswers.value[q.id].trim() !== '')
})

function handleAnswerChange(questionId: string, value: string) {
  localAnswers.value[questionId] = value
  emit('answer-change', { questionId, value })
}

function handleSubmit() {
  if (!allRequiredAnswered.value) return

  const answers = props.questions.map(q => ({
    ...q,
    answer: localAnswers.value[q.id] || ''
  }))

  emit('submit', answers)
}

function handleSkip() {
  emit('skip')
}
</script>

<style scoped>
.clarification-questions {
  width: 100%;
}

.questions-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1rem;
}

.question-item {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  padding: 1rem;
  transition: all 0.2s ease;
}

.question-item:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.1);
}

.question-header {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  align-items: flex-start;
}

.question-number {
  font-weight: 600;
  color: var(--primary-color);
  min-width: 20px;
}

.question-text {
  color: var(--text-primary);
  flex: 1;
  line-height: 1.5;
}

.required-indicator {
  color: var(--error-color);
  font-size: 1.2rem;
  line-height: 1;
}

.question-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-left: 1.5rem;
}

.option-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  padding: 0.75rem;
  border-radius: 6px;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.option-label:hover {
  background: var(--glass-bg);
  border-color: var(--glass-border);
}

.option-label.selected {
  background: rgba(102, 126, 234, 0.1);
  border-color: var(--primary-color);
}

.option-input {
  display: none;
}

.option-radio {
  width: 18px;
  height: 18px;
  border: 2px solid var(--glass-border);
  border-radius: 50%;
  position: relative;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.option-label:hover .option-radio {
  border-color: var(--primary-color);
}

.option-label.selected .option-radio {
  border-color: var(--primary-color);
  background: var(--primary-color);
}

.option-label.selected .option-radio::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 6px;
  height: 6px;
  background: white;
  border-radius: 50%;
}

.option-text {
  color: var(--text-primary);
  font-size: 0.9rem;
}

.question-input-container {
  margin-left: 1.5rem;
}

.clarification-actions {
  margin-top: 1rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

/* Animations */
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.question-item {
  animation: slideIn 0.3s ease-out;
}

.question-item:nth-child(2) {
  animation-delay: 0.1s;
}

.question-item:nth-child(3) {
  animation-delay: 0.2s;
}

.question-item:nth-child(4) {
  animation-delay: 0.3s;
}

.question-item:nth-child(5) {
  animation-delay: 0.4s;
}
</style>