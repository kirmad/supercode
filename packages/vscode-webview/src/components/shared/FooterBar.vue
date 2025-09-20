<template>
  <footer class="footer-bar">
    <div class="input-wrapper">
      <!-- Command completion dropdown -->
      <div v-if="showCommandCompletion" class="command-completion-dropdown">
        <div class="command-completion-list">
          <div
            v-for="(command, index) in filteredCommands"
            :key="command.name"
            class="command-completion-item"
            :class="{ selected: selectedCommandIndex === index }"
            @click="selectCommand(command)"
            @mouseenter="selectedCommandIndex = index"
          >
            <div class="command-name">{{ command.name }}</div>
            <div class="command-description">{{ command.description }}</div>
          </div>
        </div>
      </div>

      <textarea
        ref="messageInput"
        v-model="localInput"
        class="input-field"
        :placeholder="placeholder"
        @keydown.enter.prevent="handleSubmit"
        @keydown.shift.enter.prevent="localInput += '\n'"
        @keydown="handleCommandKeydown"
        @input="handleCommandInput"
        :disabled="disabled"
      />
      <div class="input-actions">
        <slot name="actions">
          <button
            class="submit-btn"
            @click="handleSubmit"
            :disabled="!localInput.trim() || disabled"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M2 8L14 8M14 8L10 4M14 8L10 12" stroke="currentColor" stroke-width="2"/>
            </svg>
          </button>
        </slot>
      </div>
    </div>

    <div class="footer-info">
      <div class="footer-left">
        <div class="status-badge">
          <span class="status-dot" :class="connectionStatus"></span>
          <span class="status-text">{{ statusText }}</span>
          <span v-if="port" class="port">:{{ port }}</span>
        </div>
      </div>
      <div class="footer-actions">
        <button
          v-if="modelInfo"
          class="model-btn-footer"
          @click="$emit('toggle-model-selector')"
          :title="'Model: ' + modelInfo.name"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/>
            <path d="M10 6V10L13 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span class="btn-label">{{ modelInfo.name }}</span>
        </button>
        <button
          v-if="agentInfo"
          class="agent-btn-footer"
          @click="$emit('toggle-agent-selector')"
          :title="'Agent: ' + agentInfo.name"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="6" r="3" stroke="currentColor" stroke-width="1.5"/>
            <path d="M3 18C3 15.2386 5.23858 13 8 13H12C14.7614 13 17 15.2386 17 18" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          <span class="btn-label">{{ agentInfo.name }}</span>
        </button>
        <button
          v-if="outputStyleInfo"
          class="output-style-btn-footer"
          @click="$emit('toggle-output-style-selector')"
          :title="'Output Style: ' + outputStyleInfo.name"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
            <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/>
            <path d="M7 7H13M7 10H13M7 13H10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span class="btn-label">{{ outputStyleInfo.name }}</span>
        </button>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { ConnectionStatus, ModelInfo } from '../../types'

// Props
const props = defineProps<{
  modelValue: string
  placeholder?: string
  disabled?: boolean
  connectionStatus: ConnectionStatus
  modelInfo?: ModelInfo | null
  agentInfo?: { name: string; description?: string; id?: string } | null
  outputStyleInfo?: { name: string; description?: string } | null
  port?: number
  commands?: Array<{ name: string; description: string }>
}>()

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: string]
  'submit': [value: string]
  'toggle-model-selector': []
  'toggle-agent-selector': []
  'toggle-output-style-selector': []
}>()

// Local state
const localInput = ref(props.modelValue)
const messageInput = ref<HTMLTextAreaElement>()
const showCommandCompletion = ref(false)
const selectedCommandIndex = ref(0)
const commandQuery = ref('')

// Watch for external changes
watch(() => props.modelValue, (newValue) => {
  localInput.value = newValue
})

// Watch for local changes
watch(localInput, (newValue) => {
  emit('update:modelValue', newValue)
})

// Computed properties
const statusText = computed(() => {
  switch (props.connectionStatus) {
    case 'connected': return 'Connected'
    case 'connecting': return 'Connecting...'
    case 'error': return 'Error'
    default: return 'Disconnected'
  }
})

const filteredCommands = computed(() => {
  if (!props.commands || !commandQuery.value) return []
  const query = commandQuery.value.toLowerCase()
  return props.commands.filter(cmd =>
    cmd.name.toLowerCase().includes(query) ||
    cmd.description.toLowerCase().includes(query)
  ).slice(0, 10)
})

// Methods
const handleSubmit = () => {
  const trimmedInput = localInput.value.trim()
  if (!trimmedInput || props.disabled) return

  emit('submit', trimmedInput)
  localInput.value = ''
}

const handleCommandInput = (e: Event) => {
  const input = e.target as HTMLTextAreaElement
  const value = input.value

  // Check if input starts with /
  if (value.startsWith('/')) {
    const parts = value.split(' ')
    const commandPart = parts[0].substring(1) // Remove the leading /

    if (commandPart.length > 0) {
      commandQuery.value = commandPart
      showCommandCompletion.value = true
      selectedCommandIndex.value = 0
    } else {
      showCommandCompletion.value = false
    }
  } else {
    showCommandCompletion.value = false
  }
}

const handleCommandKeydown = (e: KeyboardEvent) => {
  if (!showCommandCompletion.value) return

  if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedCommandIndex.value = Math.max(0, selectedCommandIndex.value - 1)
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedCommandIndex.value = Math.min(filteredCommands.value.length - 1, selectedCommandIndex.value + 1)
  } else if (e.key === 'Tab' && filteredCommands.value.length > 0) {
    e.preventDefault()
    selectCommand(filteredCommands.value[selectedCommandIndex.value])
  } else if (e.key === 'Escape') {
    showCommandCompletion.value = false
  }
}

const selectCommand = (command: { name: string; description: string }) => {
  const parts = localInput.value.split(' ')
  parts[0] = `/${command.name}`
  localInput.value = parts.join(' ')
  showCommandCompletion.value = false
  messageInput.value?.focus()
}

// Expose focus method
defineExpose({
  focus: () => messageInput.value?.focus()
})
</script>

<style scoped>
.footer-bar {
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding: 0.75rem;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(10px);
}

.input-wrapper {
  position: relative;
  margin-bottom: 0.5rem;
}

.command-completion-dropdown {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  margin-bottom: 0.5rem;
  background: rgba(30, 30, 30, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.375rem;
  overflow: hidden;
  backdrop-filter: blur(10px);
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.4);
  z-index: 100;
}

.command-completion-list {
  max-height: 200px;
  overflow-y: auto;
  padding: 0.25rem;
}

.command-completion-item {
  padding: 0.5rem 0.75rem;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.command-completion-item:hover,
.command-completion-item.selected {
  background: rgba(0, 102, 255, 0.1);
}

.command-name {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-primary, #e0e0e0);
  margin-bottom: 0.125rem;
}

.command-description {
  font-size: 0.7rem;
  color: var(--text-secondary, #999);
  opacity: 0.8;
}

.input-field {
  width: 100%;
  min-height: 48px;
  padding: 0.625rem;
  padding-right: 3rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0.375rem;
  color: var(--text-primary, #e0e0e0);
  font-family: inherit;
  font-size: 0.8125rem;
  resize: vertical;
  transition: all 0.15s ease;
}

.input-field:focus {
  outline: none;
  border-color: rgba(0, 102, 255, 0.5);
  background: rgba(255, 255, 255, 0.05);
}

.input-field:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.input-actions {
  position: absolute;
  right: 0.5rem;
  top: 0.625rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--accent-color, #0066ff);
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.submit-btn:hover:not(:disabled) {
  background: var(--accent-hover, #0052cc);
  transform: scale(1.05);
}

.submit-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.footer-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.75rem;
}

.footer-left {
  display: flex;
  align-items: center;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: var(--text-secondary, #999);
  font-size: 0.75rem;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #666;
}

.status-dot.connected {
  background: #00ff88;
}

.status-dot.connecting {
  background: #ffaa00;
}

.status-dot.disconnected,
.status-dot.error {
  background: #ff4444;
}

.status-text {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.port {
  font-size: 0.7rem;
  opacity: 0.7;
}

.footer-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.model-btn-footer, .agent-btn-footer, .output-style-btn-footer {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0.25rem;
  color: var(--text-secondary, #999);
  font-size: 0.7rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.model-btn-footer:hover, .agent-btn-footer:hover, .output-style-btn-footer:hover {
  border-color: rgba(0, 102, 255, 0.5);
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary, #e0e0e0);
}

.btn-label {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>