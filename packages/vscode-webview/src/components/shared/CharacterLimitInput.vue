<template>
  <div class="character-limit-input">
    <div v-if="label || $slots.label" class="input-header">
      <div class="input-label-group">
        <div v-if="icon || $slots.icon" class="label-icon">
          <slot name="icon">
            <component v-if="icon" :is="icon" />
          </slot>
        </div>
        <label v-if="label" class="input-label">{{ label }}</label>
        <slot name="label"></slot>
        <div v-if="$slots.stats" class="inline-stats">
          <slot name="stats"></slot>
        </div>
      </div>
      <div v-if="$slots.actions" class="input-actions">
        <slot name="actions"></slot>
      </div>
    </div>

    <div class="input-wrapper">
      <component
        :is="multiline ? 'textarea' : 'input'"
        v-model="internalValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :rows="rows"
        :type="type"
        :class="['character-input', { 'has-error': hasError }]"
        @input="handleInput"
        @keydown="handleKeydown"
        @focus="$emit('focus', $event)"
        @blur="$emit('blur', $event)"
      />

      <div v-if="showCharacterCount || showProgress || $slots['footer-actions']" class="input-footer">
        <div class="footer-left">
          <div v-if="showProgress" class="char-indicator">
            <div
              class="char-progress"
              :class="progressClass"
              :style="{ width: progressPercentage + '%' }"
            ></div>
          </div>
          <span v-if="showCharacterCount" class="input-hint">
            <template v-if="characterCount > 0">
              {{ characterCount }}{{ maxLength ? `/${maxLength}` : '' }} {{ characterLabel }}
            </template>
            <template v-else>
              {{ emptyHint }}
            </template>
          </span>
        </div>
        <slot name="footer-actions"></slot>
      </div>
    </div>

    <div v-if="error" class="input-error">
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'

interface Props {
  modelValue: string
  label?: string
  placeholder?: string
  icon?: any
  multiline?: boolean
  rows?: number
  type?: string
  maxLength?: number
  showCharacterCount?: boolean
  showProgress?: boolean
  characterLabel?: string
  emptyHint?: string
  disabled?: boolean
  readonly?: boolean
  error?: string
  progressThresholds?: {
    low: number
    medium: number
    high: number
  }
  enterKeyHint?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: '',
  multiline: false,
  rows: 3,
  type: 'text',
  maxLength: 0,
  showCharacterCount: true,
  showProgress: false,
  characterLabel: 'characters',
  emptyHint: 'Cmd/Ctrl + Enter',
  disabled: false,
  readonly: false,
  progressThresholds: () => ({
    low: 100,
    medium: 300,
    high: 500
  })
})

const emit = defineEmits([
  'update:modelValue',
  'input',
  'keydown',
  'enter',
  'meta-enter',
  'ctrl-enter',
  'focus',
  'blur'
])

const internalValue = ref(props.modelValue)

const characterCount = computed(() => internalValue.value.length)

const hasError = computed(() => {
  if (props.error) return true
  if (props.maxLength > 0 && characterCount.value > props.maxLength) return true
  return false
})

const progressPercentage = computed(() => {
  if (!props.showProgress) return 0

  const target = props.maxLength || props.progressThresholds.high
  return Math.min((characterCount.value / target) * 100, 100)
})

const progressClass = computed(() => {
  const count = characterCount.value
  const thresholds = props.progressThresholds

  if (props.maxLength && count > props.maxLength) return 'over-limit'
  if (count >= thresholds.high) return 'high'
  if (count >= thresholds.medium) return 'medium'
  return 'low'
})

function handleInput(event: Event) {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement
  internalValue.value = target.value
  emit('update:modelValue', internalValue.value)
  emit('input', event)
}

function handleKeydown(event: KeyboardEvent) {
  emit('keydown', event)

  if (event.key === 'Enter') {
    if (event.metaKey) {
      emit('meta-enter', event)
    } else if (event.ctrlKey) {
      emit('ctrl-enter', event)
    } else if (!props.multiline) {
      emit('enter', event)
    }
  }
}

watch(() => props.modelValue, (newValue) => {
  if (newValue !== internalValue.value) {
    internalValue.value = newValue
  }
})
</script>

<style scoped>
.character-limit-input {
  width: 100%;
}

.input-header {
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
  display: flex;
  align-items: center;
}

.input-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.inline-stats {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
  margin-right: 0.5rem;
}

.input-actions {
  display: flex;
  gap: 0.5rem;
}

.input-wrapper {
  position: relative;
}

.character-input {
  width: 100%;
  padding: 0.75rem;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 0.875rem;
  line-height: 1.5;
  resize: vertical;
  transition: all 0.3s ease;
}

input.character-input {
  resize: none;
}

.character-input:hover:not(:disabled) {
  border-color: rgba(102, 126, 234, 0.3);
  background: rgba(0, 0, 0, 0.25);
}

.character-input:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  background: rgba(0, 0, 0, 0.3);
}

.character-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.character-input.has-error {
  border-color: var(--error-color);
}

.character-input.has-error:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}

.character-input::placeholder {
  color: var(--text-muted);
  opacity: 0.6;
}

.input-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.5rem;
  gap: 0.75rem;
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
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

.char-progress.low {
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
}

.char-progress.medium {
  background: linear-gradient(90deg, #f59e0b 0%, #f97316 100%);
}

.char-progress.high {
  background: linear-gradient(90deg, #10b981 0%, #059669 100%);
}

.char-progress.over-limit {
  background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%);
}

.input-hint {
  font-size: 0.7rem;
  color: var(--text-secondary);
  opacity: 0.7;
  white-space: nowrap;
}

.input-error {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--error-color);
}
</style>