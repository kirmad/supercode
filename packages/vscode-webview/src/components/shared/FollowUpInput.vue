<template>
  <div class="follow-up-input">
    <SectionHeader
      v-if="showHeader && suggestions.length > 0"
      :title="headerTitle"
      :badge="suggestions.length"
      variant="minimal"
      custom-class="compact-header"
    />

    <div class="suggestions-container" v-if="suggestions.length > 0">
      <transition-group name="fade-slide">
        <button
          v-for="suggestion in suggestions"
          :key="suggestion.id"
          class="suggestion-chip"
          :class="{ 'active': selectedId === suggestion.id }"
          @click="handleSuggestionClick(suggestion)"
          :title="suggestion.text"
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
/* Compact and clean styling */
.follow-up-input {
  width: 100%;
}

.suggestions-container {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-bottom: 0.75rem;
}

/* Compact suggestion chips */
.suggestion-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.625rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
  overflow: hidden;
}

/* Subtle hover effect */
.suggestion-chip:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.12);
  color: var(--text-primary);
  transform: translateY(-1px);
}

/* Active state - minimal but clear */
.suggestion-chip.active {
  background: rgba(139, 92, 246, 0.08);
  border-color: rgba(139, 92, 246, 0.3);
  color: #a78bfa;
}

.suggestion-chip.active .chip-icon {
  color: #a78bfa;
}

/* Compact icon */
.chip-icon {
  font-size: 0.8rem;
  opacity: 0.7;
  transition: opacity 0.15s ease;
}

.suggestion-chip:hover .chip-icon {
  opacity: 0.9;
}

/* Clean text */
.chip-text {
  max-width: 150px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.01em;
}

/* Minimal badge */
.chip-badge {
  padding: 0.1rem 0.3rem;
  background: rgba(139, 92, 246, 0.12);
  border-radius: 6px;
  font-size: 0.625rem;
  font-weight: 600;
  color: #a78bfa;
  margin-left: 0.125rem;
}

/* Clean separator */
.custom-input-container {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

/* Smooth animations */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

/* Remove excessive effects for cleaner look */
.suggestion-chip::before,
.suggestion-chip::after {
  display: none;
}

/* Mobile responsiveness */
@media (max-width: 640px) {
  .suggestions-container {
    gap: 0.25rem;
  }

  .suggestion-chip {
    padding: 0.2rem 0.5rem;
    font-size: 0.7rem;
  }

  .chip-icon {
    font-size: 0.75rem;
  }

  .chip-text {
    max-width: 120px;
  }
}

/* Compact header styling */
:deep(.compact-header) {
  margin-bottom: 0.5rem !important;
  padding-bottom: 0.25rem !important;
}
</style>