<template>
  <div class="supercode-container">
    <StatusBar 
      :status="connectionStatus" 
      :port="currentPort" 
    />
    
    <MessagesList 
      :messages="messages"
      :status="connectionStatus"
    />
    
    <InputArea 
      :disabled="!isConnected"
      @send-message="handleSendMessage"
    />
    
    <RestartDialog 
      v-if="showRestartDialog"
      :message="restartDialogMessage"
      @restart="handleRestart"
      @ignore="hideRestartDialog"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import StatusBar from './StatusBar.vue'
import MessagesList from './MessagesList.vue'
import InputArea from './InputArea.vue'
import RestartDialog from './RestartDialog.vue'
import type { Message, ConnectionStatus, WebviewMessage, StatusUpdate, AddMessage, OfferRestart } from '../types'

// Reactive state
const connectionStatus = ref<ConnectionStatus>('disconnected' as ConnectionStatus)
const currentPort = ref<number>(0)
const messages = ref<Message[]>([])
const showRestartDialog = ref(false)
const restartDialogMessage = ref('')

// Computed properties
const isConnected = computed(() => connectionStatus.value === 'connected')

// Message handling
function handleSendMessage(text: string) {
  // Add user message to local state
  addMessage('user', text)
  
  // Send to VS Code extension
  if (window.vscode) {
    window.vscode.postMessage({
      command: 'sendMessage',
      text: text
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
}

function handleRestart() {
  hideRestartDialog()
  if (window.vscode) {
    window.vscode.postMessage({ command: 'restart' })
  }
}

function hideRestartDialog() {
  showRestartDialog.value = false
  restartDialogMessage.value = ''
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
    
    case 'offerRestart': {
      const restartMsg = message as OfferRestart
      restartDialogMessage.value = restartMsg.message
      showRestartDialog.value = true
      break
    }
  }
}

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
  }
})
</script>

<style scoped>
.supercode-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  line-height: 1.5;
  color: var(--vscode-foreground);
  background: var(--vscode-editor-background);
}
</style>