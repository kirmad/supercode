<template>
  <div class="supercode-simple">
    <!-- Status indicator -->
    <div class="status-bar" :class="connectionStatus">
      <span class="status-dot"></span>
      <span class="status-text">
        {{ statusText }}
        <span v-if="currentPort" class="port">:{{ currentPort }}</span>
      </span>
    </div>
    
    <!-- Messages area -->
    <div class="messages" ref="messagesContainer">
      <div
        v-for="message in messages"
        :key="message.id"
        :class="['message', message.type]"
      >
        {{ message.content }}
      </div>
    </div>
    
    <!-- Input area -->
    <div class="input-area">
      <div class="input-wrapper">
        <span class="prompt">></span>
        <input
          v-model="inputText"
          @keyup.enter="sendMessage"
          :disabled="!isConnected"
          placeholder="Type your message..."
          class="input-field"
          ref="inputField"
        >
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, nextTick, watch } from 'vue'
import type { Message, ConnectionStatus, WebviewMessage, StatusUpdate, AddMessage } from '../types'

// Reactive state
const connectionStatus = ref<ConnectionStatus>('disconnected' as ConnectionStatus)
const currentPort = ref<number>(0)
const messages = ref<Message[]>([])
const inputText = ref('')
const messagesContainer = ref<HTMLElement>()
const inputField = ref<HTMLInputElement>()

// Computed properties
const isConnected = computed(() => connectionStatus.value === 'connected')
const statusText = computed(() => {
  switch (connectionStatus.value) {
    case 'connected': return 'Connected'
    case 'connecting': return 'Connecting...'
    case 'error': return 'Error'
    default: return 'Disconnected'
  }
})

// Message handling
function sendMessage() {
  if (!inputText.value.trim() || !isConnected.value) return
  
  const message = inputText.value.trim()
  inputText.value = ''
  
  // Add user message to local state
  addMessage('user', message)
  
  // Send to VS Code extension
  if (window.vscode) {
    window.vscode.postMessage({
      command: 'sendMessage',
      text: message
    })
  }
}

function addMessage(type: Message['type'], content: string) {
  messages.value.push({
    id: Date.now().toString() + Math.random().toString(36).substring(2),
    type,
    content,
    timestamp: Date.now()
  })
  
  // Auto-scroll to bottom
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

// VS Code message handling
function handleVsCodeMessage(event: MessageEvent) {
  const message = event.data as WebviewMessage
  
  switch (message.command) {
    case 'statusUpdate': {
      const statusMsg = message as StatusUpdate
      connectionStatus.value = statusMsg.status
      currentPort.value = statusMsg.port
      break
    }
    
    case 'addMessage': {
      const msgData = message as AddMessage
      addMessage(msgData.type, msgData.content)
      break
    }
  }
}

// Auto-focus input when connected
watch(isConnected, (connected) => {
  if (connected) {
    nextTick(() => {
      inputField.value?.focus()
    })
  }
})

// Lifecycle
onMounted(() => {
  // Set up VS Code message listener
  if (typeof window !== 'undefined') {
    window.addEventListener('message', handleVsCodeMessage)
    
    // Set port from global if available
    if (window.supercodePort) {
      currentPort.value = window.supercodePort
    }
    
    // Request initial status
    if (window.vscode) {
      window.vscode.postMessage({ command: 'requestStatus' })
    }
    
    // Focus input
    nextTick(() => {
      inputField.value?.focus()
    })
  }
})
</script>

<style scoped>
.supercode-simple {
  display: flex;
  flex-direction: column;
  height: 100vh;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.4;
  color: #e8e6e3;
  background: #181818;
}

.status-bar {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  border-bottom: 1px solid #333;
  background: #1a1a1a;
  font-size: 12px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 8px;
}

.status-bar.connected .status-dot { background: #00ff00; }
.status-bar.connecting .status-dot { background: #ffff00; }
.status-bar.error .status-dot { background: #ff0000; }
.status-bar.disconnected .status-dot { background: #666; }

.port {
  color: #888;
  font-size: 11px;
}

.messages {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  scroll-behavior: smooth;
}

.message {
  margin-bottom: 8px;
  word-wrap: break-word;
}

.message.user {
  color: #4fc3f7;
}

.message.assistant {
  color: #e8e6e3;
}

.message.system {
  color: #81c784;
  font-style: italic;
}

.message.error {
  color: #f48fb1;
}

.input-area {
  border-top: 1px solid #333;
  background: #1a1a1a;
}

.input-wrapper {
  display: flex;
  align-items: center;
  padding: 12px 16px;
}

.prompt {
  color: #4fc3f7;
  margin-right: 8px;
  font-weight: bold;
}

.input-field {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #e8e6e3;
  font-family: inherit;
  font-size: inherit;
}

.input-field::placeholder {
  color: #666;
}

.input-field:disabled {
  color: #444;
}

/* Scrollbar styling */
.messages::-webkit-scrollbar {
  width: 6px;
}

.messages::-webkit-scrollbar-track {
  background: #1a1a1a;
}

.messages::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 3px;
}

.messages::-webkit-scrollbar-thumb:hover {
  background: #444;
}
</style>