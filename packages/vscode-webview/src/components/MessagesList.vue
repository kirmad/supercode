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
  background: var(--vscode-editor-background);
  font-family: var(--vscode-editor-font-family, 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace);
}

.connecting-message {
  text-align: center;
  color: var(--vscode-descriptionForeground);
  margin-top: 2rem;
  font-family: var(--vscode-editor-font-family, 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace);
}

.message {
  margin-bottom: 12px;
  padding: 12px 16px;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
  font-family: var(--vscode-editor-font-family, 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace);
  font-size: 13px;
  border-left: 3px solid transparent;
}

.message.user {
  background: var(--vscode-editor-selectionBackground, rgba(173, 214, 255, 0.1));
  border-left-color: var(--vscode-focusBorder, #0078d4);
  color: var(--vscode-editor-foreground);
}

.message.user::before {
  content: '> ';
  color: var(--vscode-descriptionForeground);
  opacity: 0.7;
}

.message.assistant {
  background: var(--vscode-editor-background);
  border: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.2));
  border-left-color: var(--vscode-charts-green, #4CAF50);
  color: var(--vscode-editor-foreground);
  border-radius: 3px;
}

.message.error {
  background: var(--vscode-inputValidation-errorBackground, rgba(244, 67, 54, 0.1));
  color: var(--vscode-inputValidation-errorForeground, #f44336);
  border: 1px solid var(--vscode-inputValidation-errorBorder, #f44336);
  border-left-color: var(--vscode-inputValidation-errorBorder, #f44336);
  border-radius: 3px;
}

.message.error::before {
  content: '❌ ';
}

.message.system {
  background: var(--vscode-editor-inactiveSelectionBackground, rgba(128, 128, 128, 0.1));
  color: var(--vscode-descriptionForeground);
  text-align: center;
  font-style: italic;
  border-left-color: var(--vscode-descriptionForeground);
  opacity: 0.9;
}
</style>