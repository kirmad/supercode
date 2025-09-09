<template>
  <div class="input-area">
    <textarea
      ref="messageInput"
      v-model="messageText"
      placeholder="Ask SuperCode something..."
      :disabled="disabled"
      @keydown="handleKeydown"
      rows="3"
    />
    <button
      :disabled="disabled || !messageText.trim()"
      @click="sendMessage"
    >
      Send
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'

interface Props {
  disabled: boolean
}

interface Emits {
  (event: 'sendMessage', text: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const messageText = ref('')
const messageInput = ref<HTMLTextAreaElement>()

function handleKeydown(event: KeyboardEvent) {
  // Send on Ctrl/Cmd + Enter
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    sendMessage()
  }
}

function sendMessage() {
  const text = messageText.value.trim()
  if (!text || props.disabled) return
  
  emit('sendMessage', text)
  messageText.value = ''
  
  // Reset textarea height
  nextTick(() => {
    if (messageInput.value) {
      messageInput.value.style.height = 'auto'
    }
  })
}
</script>

<style scoped>
.input-area {
  padding: 16px;
  border-top: 1px solid var(--vscode-panel-border);
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

textarea {
  flex: 1;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border);
  border-radius: 4px;
  padding: 8px 12px;
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  resize: vertical;
  min-height: 60px;
  max-height: 200px;
}

textarea:focus {
  outline: none;
  border-color: var(--vscode-focusBorder);
}

textarea:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  border-radius: 4px;
  padding: 8px 16px;
  cursor: pointer;
  font-family: var(--vscode-font-family);
  white-space: nowrap;
  height: fit-content;
}

button:hover:not(:disabled) {
  background: var(--vscode-button-hoverBackground);
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>