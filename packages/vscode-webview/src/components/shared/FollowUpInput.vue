<template>
  <div class="follow-up-input">
    <SectionHeader
      v-if="showHeader"
      :title="headerTitle"
      :badge="suggestions.length"
      variant="minimal"
    />

    <div class="suggestions-container">
      <transition-group name="fade-slide">
        <button
          v-for="suggestion in suggestions"
          :key="suggestion.id"
          class="suggestion-chip"
          :class="{ 'active': selectedId === suggestion.id }"
          @click="handleSuggestionClick(suggestion)"
        >
          <span v-if="suggestion.icon" class="chip-icon">{{ suggestion.icon }}</span>
          <span class="chip-text">{{ suggestion.text }}</span>
          <span v-if="suggestion.badge" class="chip-badge">{{ suggestion.badge }}</span>
        </button>
      </transition-group>
    </div>

    <div v-if="showCustomInput" class="custom-input-container">
      <CharacterLimitInput
        v-model="customText"
        :placeholder="customPlaceholder"
        :multiline="multiline"
        :rows="rows"
        :max-length="maxLength"
        :show-character-count="showCharacterCount"
        @enter="handleSubmit"
        @meta-enter="handleSubmit"
      >
        <template #actions>
          <ActionButton
            @click="handleSubmit"
            :disabled="!canSubmit"
            variant="primary"
            size="small"
          >
            {{ submitLabel }}
          </ActionButton>
        </template>
      </CharacterLimitInput>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import SectionHeader from './SectionHeader.vue'
import CharacterLimitInput from './CharacterLimitInput.vue'
import ActionButton from './ActionButton.vue'

export interface FollowUpSuggestion {
  id: string
  text: string
  icon?: string
  badge?: string
  value?: any
}

interface Props {
  suggestions: FollowUpSuggestion[]
  headerTitle?: string
  showHeader?: boolean
  showCustomInput?: boolean
  customPlaceholder?: string
  submitLabel?: string
  multiline?: boolean
  rows?: number
  maxLength?: number
  showCharacterCount?: boolean
  allowEmpty?: boolean
  modelValue?: string
}

const props = withDefaults(defineProps<Props>(), {
  headerTitle: 'Follow-up Options',
  showHeader: true,
  showCustomInput: true,
  customPlaceholder: 'Or type your own follow-up...',
  submitLabel: 'Submit',
  multiline: false,
  rows: 2,
  maxLength: 500,
  showCharacterCount: true,
  allowEmpty: false,
  modelValue: ''
})

const emit = defineEmits([
  'select',
  'submit',
  'update:modelValue',
  'custom-submit'
])

const selectedId = ref<string | null>(null)
const customText = ref(props.modelValue)

const canSubmit = computed(() => {
  return props.allowEmpty || (customText.value && customText.value.trim().length > 0)
})

function handleSuggestionClick(suggestion: FollowUpSuggestion) {
  selectedId.value = suggestion.id
  emit('select', suggestion)

  // Auto-fill custom input if desired
  if (props.showCustomInput) {
    customText.value = suggestion.text
    emit('update:modelValue', suggestion.text)
  }
}

function handleSubmit() {
  if (!canSubmit.value) return

  const submission = {
    text: customText.value,
    isCustom: !selectedId.value,
    suggestionId: selectedId.value
  }

  emit('submit', submission)
  emit('custom-submit', customText.value)

  // Clear after submission
  customText.value = ''
  selectedId.value = null
  emit('update:modelValue', '')
}

watch(() => props.modelValue, (newValue) => {
  customText.value = newValue
})

watch(customText, (newValue) => {
  emit('update:modelValue', newValue)
})
</script>

<style scoped>
.follow-up-input {
  width: 100%;
}

.suggestions-container {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.suggestion-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 20px;
  color: var(--text-primary);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.suggestion-chip::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.1) 0%,
    transparent 50%,
    transparent 100%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
}

.suggestion-chip:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--primary-color);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.1);
}

.suggestion-chip:hover::before {
  opacity: 1;
}

.suggestion-chip.active {
  background: rgba(102, 126, 234, 0.1);
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.chip-icon {
  font-size: 0.9rem;
  opacity: 0.8;
}

.chip-text {
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chip-badge {
  padding: 0.125rem 0.375rem;
  background: rgba(102, 126, 234, 0.2);
  border-radius: 8px;
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--primary-color);
}

.custom-input-container {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--glass-border);
}

/* Animations */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.suggestion-chip:hover::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.1),
    transparent
  );
  animation: shimmer 0.6s ease-in-out;
}
</style>