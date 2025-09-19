<template>
  <div class="plan-tab">
    <!-- Messages area -->
    <div class="messages" ref="messagesContainer">
      <div
        v-for="message in messages"
        :key="message.id"
        :class="['message', message.type]"
      >
        <div v-if="message.type === 'user'" class="user-message">
          <div class="user-line">
            <span class="user-prefix">></span>
            <span class="user-content">{{ message.content }}</span>
          </div>
        </div>
        <div v-else-if="message.type === 'assistant'" class="assistant-message">
          <div class="assistant-content" v-html="formatMessageContent(message.content)"></div>
          <!-- Model and timestamp info -->
          <div class="assistant-footer">
            {{ (modelInfo?.name || 'Model') + ' (' + new Date(message.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) + ')' }}
          </div>
        </div>
        <div v-else-if="message.type === 'system'" class="system-message">
          {{ message.content }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick, computed } from 'vue'
import type { ModelInfo } from '../../types'

interface Message {
  id: string
  type: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

// Props
const props = defineProps({
  taskData: {
    type: Object,
    default: () => ({})
  },
  modelInfo: {
    type: Object as () => ModelInfo | null,
    default: null
  }
})

// Emits
const emit = defineEmits(['update-task', 'regenerate-plan'])

// State
const messages = ref<Message[]>([])
const messagesContainer = ref<HTMLElement | null>(null)

// Computed
const modelInfo = computed(() => props.modelInfo)

// Methods
function formatMessageContent(content: string): string {
  // Convert markdown-style formatting to HTML
  let formatted = content
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>')

  // Handle code blocks
  formatted = formatted.replace(/```([\s\S]*?)```/g, (match, code) => {
    return `<pre><code>${code.trim()}</code></pre>`
  })

  return formatted
}

function addMessage(type: Message['type'], content: string) {
  const message: Message = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2)}`,
    type,
    content,
    timestamp: Date.now()
  }
  messages.value.push(message)
  scrollToBottom()
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

// Lifecycle
onMounted(() => {
  // Messages will be populated from props.taskData.messages via watcher
  console.log('PlanTab mounted with taskData:', props.taskData)
})

// Watchers
watch(() => props.taskData?.messages, (newMessages) => {
  if (newMessages && Array.isArray(newMessages)) {
    // Simply replace the messages array with the new one
    messages.value = newMessages.map(msg => ({
      id: msg.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      type: msg.type,
      content: msg.content,
      timestamp: msg.timestamp || Date.now()
    }))
    scrollToBottom()
  }
}, { deep: true, immediate: true })
</script>

<style scoped>
.plan-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 1rem;
}

/* Messages area */
.messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Message styles */
.message {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* User messages */
.user-message {
  margin: 0.5rem 0;
}

.user-line {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  color: var(--text-primary);
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  font-size: 0.9rem;
  line-height: 1.6;
}

.user-prefix {
  color: var(--accent-color);
  font-weight: 600;
  user-select: none;
  flex-shrink: 0;
}

.user-content {
  word-break: break-word;
  flex: 1;
}

/* Assistant messages */
.assistant-message {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  padding: 1rem;
  margin: 0.5rem 0;
}

.assistant-content {
  color: var(--text-primary);
  line-height: 1.6;
  font-size: 0.9rem;
}

.assistant-content code {
  background: rgba(0, 102, 255, 0.1);
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  font-size: 0.85em;
  color: var(--accent-color);
}

.assistant-content pre {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  padding: 0.75rem;
  margin: 0.75rem 0;
  overflow-x: auto;
}

.assistant-content pre code {
  background: none;
  padding: 0;
  color: var(--text-primary);
  font-size: 0.875rem;
}

.assistant-content strong {
  font-weight: 600;
  color: var(--text-primary);
}

.assistant-content em {
  font-style: italic;
}

.assistant-footer {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-color);
  font-size: 0.75rem;
  color: var(--text-secondary);
  display: flex;
  justify-content: flex-end;
}

/* System messages */
.system-message {
  padding: 0.5rem 1rem;
  background: rgba(255, 165, 0, 0.1);
  border-left: 3px solid rgba(255, 165, 0, 0.5);
  color: var(--text-secondary);
  font-size: 0.875rem;
  line-height: 1.5;
  margin: 0.5rem 0;
}
</style>