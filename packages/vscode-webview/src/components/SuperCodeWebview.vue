<template>
  <div class="supercode-container">
    <StatusBar 
      :status="connectionStatus" 
      :port="currentPort"
      :model-info="modelInfo"
    />
    
    <ContextWindow 
      :used-tokens="tokenUsage.used"
      :max-tokens="tokenUsage.max"
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
import { ref, onMounted, computed, onUnmounted } from 'vue'
import StatusBar from './StatusBar.vue'
import MessagesList from './MessagesList.vue'
import InputArea from './InputArea.vue'
import RestartDialog from './RestartDialog.vue'
import ContextWindow from './ContextWindow.vue'
import { SuperCodeSDKClient, type SSEMessage } from '../services/SuperCodeSDKClient'
import type { Message, ConnectionStatus, WebviewMessage, StatusUpdate, AddMessage, OfferRestart, ModelInfo, TokenUsage } from '../types'

// Reactive state
const connectionStatus = ref<ConnectionStatus>('disconnected' as ConnectionStatus)
const currentPort = ref<number>(25716) // Default SuperCode port
const messages = ref<Message[]>([])
const showRestartDialog = ref(false)
const restartDialogMessage = ref('')
const modelInfo = ref<ModelInfo | undefined>({
  name: 'Claude 3.5 Sonnet',
  provider: 'Anthropic',
  version: 'claude-3-5-sonnet-20241022'
})
const tokenUsage = ref<TokenUsage>({
  used: 25900,
  max: 38000,
  percentage: 68
})

// SuperCode SDK Client
let sdkClient: SuperCodeSDKClient | null = null

// Computed properties
const isConnected = computed(() => connectionStatus.value === 'connected')

// Message handling
async function handleSendMessage(text: string) {
  // Add user message to local state
  addMessage('user', text)
  
  // Send directly to SuperCode server using SDK
  if (sdkClient && connectionStatus.value === 'connected') {
    try {
      await sdkClient.sendMessage('default-session', text)
    } catch (error) {
      console.error('Failed to send message:', error)
      addMessage('error', `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  } else {
    // Fallback to VS Code extension if available
    if (window.vscode) {
      window.vscode.postMessage({
        command: 'sendMessage',
        text: text
      })
    } else {
      addMessage('error', 'Not connected to SuperCode server')
    }
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

// SuperCode SDK functions
async function initializeSDKClient() {
  try {
    connectionStatus.value = 'connecting'
    
    sdkClient = new SuperCodeSDKClient({
      baseUrl: `http://localhost:${currentPort.value}`,
      port: currentPort.value,
      timeout: 10000
    })

    // Test connection
    const isConnected = await sdkClient.testConnection()
    if (!isConnected) {
      throw new Error('Failed to connect to SuperCode server')
    }

    // Set up SSE message handler
    sdkClient.onMessage(handleSSEMessage)
    sdkClient.onError(handleSSEError)
    sdkClient.onOpen(() => {
      console.log('SSE connection established')
    })

    // Subscribe to events
    await sdkClient.subscribeToEvents()
    
    connectionStatus.value = 'connected'
    console.log('SuperCode SDK client initialized and connected')
  } catch (error) {
    console.error('Failed to initialize SuperCode SDK client:', error)
    connectionStatus.value = 'error'
    addMessage('error', `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

function handleSSEMessage(message: SSEMessage) {
  console.log('Received SSE message:', message)
  
  // Handle different message types
  switch (message.type) {
    case 'message':
      if (message.data && message.data.content) {
        addMessage('assistant', message.data.content)
      }
      break
    case 'chunk':
      // Handle streaming responses
      if (message.data && message.data.content) {
        // For simplicity, append to last assistant message or create new one
        const lastMessage = messages.value[messages.value.length - 1]
        if (lastMessage && lastMessage.type === 'assistant' && message.data.messageId === lastMessage.id) {
          lastMessage.content += message.data.content
        } else {
          addMessage('assistant', message.data.content)
        }
      }
      break
    case 'error':
      addMessage('error', message.data?.message || 'Unknown error occurred')
      break
    default:
      console.log('Unhandled SSE message type:', message.type)
  }
}

function handleSSEError(error: Error) {
  console.error('SSE error:', error)
  addMessage('error', `Connection error: ${error.message}`)
  connectionStatus.value = 'error'
}

function cleanupSDKClient() {
  if (sdkClient) {
    sdkClient.unsubscribeFromEvents()
    sdkClient = null
  }
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
onMounted(async () => {
  // Set up VS Code message listener
  if (typeof window !== 'undefined') {
    window.addEventListener('message', handleVsCodeMessage)
    
    // Set port from global if available
    if (window.supercodePort) {
      currentPort.value = window.supercodePort
    }
    
    // Try to initialize standalone SDK client first
    await initializeSDKClient()
    
    // If SDK client failed, fallback to VS Code extension
    if (connectionStatus.value !== 'connected' && window.vscode) {
      window.vscode.postMessage({ command: 'requestStatus' })
    }
  }
})

onUnmounted(() => {
  // Clean up SDK client
  cleanupSDKClient()
  
  // Remove VS Code message listener
  if (typeof window !== 'undefined') {
    window.removeEventListener('message', handleVsCodeMessage)
  }
})
</script>

<style scoped>
.supercode-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  font-family: var(--vscode-editor-font-family, 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace);
  font-size: var(--vscode-editor-font-size, 13px);
  line-height: 1.6;
  color: var(--vscode-editor-foreground, #d4d4d4);
  background: var(--vscode-editor-background, #1e1e1e);
  position: relative;
}

.supercode-container * {
  box-sizing: border-box;
}

/* Ensure proper terminal-like spacing and typography */
.supercode-container {
  --terminal-spacing: 16px;
  --terminal-line-height: 1.6;
  --terminal-font-size: 13px;
}
</style>