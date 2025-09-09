<template>
  <div class="chat-messages" ref="messagesContainer">
    <!-- Initial connecting state -->
    <div v-if="messages.length === 0" class="connecting-message">
      <p v-if="status === 'connecting'">Launching external SuperCode process...</p>
      <p v-else-if="status === 'connected'">SuperCode is ready! Start chatting below.</p>
      <p v-else-if="status === 'error'">
        <ErrorActions @retry="handleRetry" @restart="handleRestart" />
      </p>
      <p v-else>Initializing...</p>
    </div>
    
    <!-- Messages -->
    <div
      v-for="message in messages"
      :key="message.id"
      :class="['message', message.type]"
    >
      {{ message.content }}
    </div>
    
    <!-- Error state when connection fails -->
    <ErrorActions 
      v-if="status === 'error' && messages.length > 0"
      @retry="handleRetry" 
      @restart="handleRestart" 
    />
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import ErrorActions from './ErrorActions.vue'
import type { Message, ConnectionStatus } from '../types'

interface Props {
  messages: Message[]
  status: ConnectionStatus
}

const props = defineProps<Props>()

const messagesContainer = ref<HTMLElement>()

// Auto-scroll to bottom when new messages are added
watch(() => props.messages.length, async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
})

function handleRetry() {
  if (window.vscode) {
    window.vscode.postMessage({ command: 'retry' })
  }
}

function handleRestart() {
  if (window.vscode) {
    window.vscode.postMessage({ command: 'restart' })
  }
}
</script>

<style scoped>
.chat-messages {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  min-height: 0;
}

.connecting-message {
  text-align: center;
  color: var(--vscode-descriptionForeground);
  margin-top: 2rem;
}

.message {
  margin-bottom: 16px;
  padding: 8px;
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-word;
}

.message.user {
  background: var(--vscode-editor-selectionBackground);
  margin-left: 20%;
}

.message.assistant {
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border);
  margin-right: 20%;
}

.message.error {
  background: var(--vscode-inputValidation-errorBackground);
  color: var(--vscode-inputValidation-errorForeground);
  border: 1px solid var(--vscode-inputValidation-errorBorder);
  margin-right: 20%;
}

.message.system {
  background: var(--vscode-editor-inactiveSelectionBackground);
  color: var(--vscode-descriptionForeground);
  text-align: center;
  font-style: italic;
}
</style>