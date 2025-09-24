<template>
  <div class="implement-tab">
    <div class="tab-header">
      <h2 class="tab-title">Implementation</h2>
      <p class="tab-description">
        SuperCode is working on your task. Watch the progress in real-time.
      </p>
    </div>

    <div class="implement-container">
      <!-- Implementation Status -->
      <section class="implementation-status">
        <div class="status-card">
          <div class="status-indicator" :class="implementationStatus">
            <svg v-if="implementationStatus === 'running'" class="status-icon spinning" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2V6M12 18V22M4.93 4.93L7.76 7.76M16.24 16.24L19.07 19.07M2 12H6M18 12H22M4.93 19.07L7.76 16.24M16.24 7.76L19.07 4.93" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <svg v-else-if="implementationStatus === 'completed'" class="status-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <svg v-else-if="implementationStatus === 'error'" class="status-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
              <path d="M12 8V12M12 16H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <svg v-else class="status-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
              <path d="M12 6V12L16 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="status-info">
            <h3 class="status-title">{{ statusTitle }}</h3>
            <p class="status-message">{{ statusMessage }}</p>
            <div class="progress-bar" v-if="implementationStatus === 'running'">
              <div class="progress-fill" :style="{ width: `${progress}%` }"></div>
            </div>
          </div>
          <div class="status-actions">
            <button class="action-btn" @click="pauseImplementation" v-if="implementationStatus === 'running'">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="5" y="4" width="2" height="8" fill="currentColor"/>
                <rect x="9" y="4" width="2" height="8" fill="currentColor"/>
              </svg>
              Pause
            </button>
            <button class="action-btn" @click="resumeImplementation" v-else-if="implementationStatus === 'paused'">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M5 3L13 8L5 13V3Z" fill="currentColor"/>
              </svg>
              Resume
            </button>
            <button class="action-btn danger" @click="stopImplementation" v-if="['running', 'paused'].includes(implementationStatus)">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="4" y="4" width="8" height="8" fill="currentColor"/>
              </svg>
              Stop
            </button>
          </div>
        </div>
      </section>

      <!-- SuperCode Response Stream -->
      <section class="response-stream">
        <div class="stream-header">
          <h3 class="section-title">SuperCode Output</h3>
          <div class="stream-controls">
            <button class="control-btn" @click="toggleAutoScroll" :class="{ active: autoScroll }">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 3L8 13M8 13L4 9M8 13L12 9" stroke="currentColor" stroke-width="1.5"/>
              </svg>
              Auto-scroll
            </button>
            <button class="control-btn" @click="clearOutput">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 4H13M5 4V2H11V4M6 7V12M10 7V12M4 4L5 14H11L12 4" stroke="currentColor" stroke-width="1.5"/>
              </svg>
              Clear
            </button>
          </div>
        </div>

        <div class="stream-content" ref="streamContent" @scroll="handleScroll">
          <div v-for="(message, index) in outputMessages" :key="index" class="output-message" :class="message.type">
            <div class="message-header">
              <span class="message-type">{{ message.type }}</span>
              <span class="message-time">{{ formatTime(message.timestamp) }}</span>
            </div>
            <div class="message-content">
              <pre v-if="message.type === 'code'"><code>{{ message.content }}</code></pre>
              <p v-else>{{ message.content }}</p>
            </div>
            <div class="message-actions" v-if="message.actions">
              <button v-for="action in message.actions" :key="action.id"
                      class="message-action-btn"
                      @click="handleMessageAction(action)">
                {{ action.label }}
              </button>
            </div>
          </div>

          <div v-if="isStreaming" class="streaming-indicator">
            <span class="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </span>
            SuperCode is thinking...
          </div>
        </div>
      </section>

      <!-- File Changes -->
      <section class="file-changes">
        <div class="section-header">
          <h3 class="section-title">File Changes</h3>
          <span class="change-count">{{ fileChanges.length }} files</span>
        </div>

        <div class="changes-list">
          <div v-for="file in fileChanges" :key="file.path" class="file-change" :class="file.status">
            <div class="file-icon">
              <svg v-if="file.status === 'created'" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 3V13M3 8H13" stroke="currentColor" stroke-width="1.5"/>
              </svg>
              <svg v-else-if="file.status === 'modified'" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M11 2L14 5L5 14L2 14L2 11L11 2Z" stroke="currentColor" stroke-width="1.5"/>
              </svg>
              <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.5"/>
              </svg>
            </div>
            <div class="file-info">
              <span class="file-path">{{ file.path }}</span>
              <span class="file-stats">{{ file.additions }}+ / {{ file.deletions }}-</span>
            </div>
            <button class="view-btn" @click="viewFile(file)">
              View
            </button>
          </div>
        </div>
      </section>

      <!-- Action Controls -->
      <div class="action-controls">
        <button class="btn btn-secondary" @click="exportChanges">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2L8 10M8 2L5 5M8 2L11 5" stroke="currentColor" stroke-width="1.5"/>
            <path d="M2 10V14H14V10" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          Export Changes
        </button>
        <button class="btn btn-primary" @click="proceedToReview" :disabled="implementationStatus !== 'completed'">
          Review Changes
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8L13 8M13 8L9 4M13 8L9 12" stroke="currentColor" stroke-width="1.5"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'

// Props
const props = defineProps({
  taskData: {
    type: Object,
    default: () => ({})
  }
})

// Emits
const emit = defineEmits(['update-task'])

// State
const implementationStatus = ref('running') // idle, running, paused, completed, error
const progress = ref(35)
const autoScroll = ref(true)
const isStreaming = ref(true)
const streamContent = ref<HTMLElement>()

const statusTitle = ref('Implementation in Progress')
const statusMessage = ref('SuperCode is working on your task...')

const outputMessages = ref([
  {
    type: 'info',
    content: 'Starting implementation of workflow interface...',
    timestamp: new Date().toISOString()
  },
  {
    type: 'action',
    content: 'Installing vue-router dependency...',
    timestamp: new Date().toISOString()
  },
  {
    type: 'code',
    content: `npm install vue-router@^4.5.0`,
    timestamp: new Date().toISOString()
  },
  {
    type: 'success',
    content: 'Successfully installed vue-router',
    timestamp: new Date().toISOString()
  },
  {
    type: 'action',
    content: 'Creating WorkflowInterface component...',
    timestamp: new Date().toISOString()
  },
  {
    type: 'code',
    content: `<template>
  <div class="workflow-interface">
    <!-- Component implementation -->
  </div>
</template>`,
    timestamp: new Date().toISOString()
  }
])

const fileChanges = ref([
  {
    path: 'src/components/WorkflowInterface.vue',
    status: 'created',
    additions: 250,
    deletions: 0
  },
  {
    path: 'src/components/tabs/PlanTab.vue',
    status: 'created',
    additions: 180,
    deletions: 0
  },
  {
    path: 'src/router/index.ts',
    status: 'created',
    additions: 45,
    deletions: 0
  },
  {
    path: 'package.json',
    status: 'modified',
    additions: 1,
    deletions: 0
  }
])

// Methods
const formatTime = (timestamp: string) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const pauseImplementation = () => {
  implementationStatus.value = 'paused'
  statusTitle.value = 'Implementation Paused'
  statusMessage.value = 'Click Resume to continue the implementation.'
}

const resumeImplementation = () => {
  implementationStatus.value = 'running'
  statusTitle.value = 'Implementation in Progress'
  statusMessage.value = 'SuperCode is working on your task...'
}

const stopImplementation = () => {
  implementationStatus.value = 'idle'
  statusTitle.value = 'Implementation Stopped'
  statusMessage.value = 'The implementation has been stopped.'
  isStreaming.value = false
}

const toggleAutoScroll = () => {
  autoScroll.value = !autoScroll.value
}

const clearOutput = () => {
  outputMessages.value = []
}

const handleScroll = () => {
  if (!streamContent.value) return
  const { scrollTop, scrollHeight, clientHeight } = streamContent.value
  const isAtBottom = scrollHeight - scrollTop - clientHeight < 10

  if (!isAtBottom && autoScroll.value) {
    autoScroll.value = false
  }
}

const handleMessageAction = (action: any) => {
  console.log('Handling action:', action)
}

const viewFile = (file: any) => {
  console.log('Viewing file:', file)
}

const exportChanges = () => {
  console.log('Exporting changes...')
}

const proceedToReview = () => {
  emit('update-task', {
    status: 'reviewing',
    changes: fileChanges.value
  })
}

// Auto-scroll when new messages arrive
const scrollToBottom = async () => {
  if (autoScroll.value && streamContent.value) {
    await nextTick()
    streamContent.value.scrollTop = streamContent.value.scrollHeight
  }
}

// Simulate implementation progress
let progressInterval: number

onMounted(() => {
  progressInterval = setInterval(() => {
    if (implementationStatus.value === 'running' && progress.value < 90) {
      progress.value += Math.random() * 5
    }
    if (progress.value >= 90) {
      implementationStatus.value = 'completed'
      statusTitle.value = 'Implementation Complete'
      statusMessage.value = 'All tasks have been successfully implemented.'
      isStreaming.value = false
      clearInterval(progressInterval)
    }
  }, 2000) as any

  scrollToBottom()
})

onUnmounted(() => {
  clearInterval(progressInterval)
})
</script>

<style scoped>
.implement-tab {
  max-width: 1000px;
  margin: 0 auto;
}

.tab-header {
  margin-bottom: 2rem;
}

.tab-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
  color: var(--text-primary);
}

.tab-description {
  color: var(--text-secondary);
  margin: 0;
}

.section-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

/* Status Card */
.implementation-status {
  margin-bottom: 2rem;
}

.status-card {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 1.5rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
}

.status-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-indicator.running {
  background: rgba(0, 102, 255, 0.1);
  color: var(--accent-color);
}

.status-indicator.completed {
  background: rgba(0, 255, 127, 0.1);
  color: #00ff7f;
}

.status-indicator.error {
  background: rgba(255, 0, 0, 0.1);
  color: #ff4444;
}

.status-indicator.idle,
.status-indicator.paused {
  background: rgba(255, 165, 0, 0.1);
  color: #ffa500;
}

.status-icon.spinning {
  animation: spin 2s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.status-info {
  flex: 1;
}

.status-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0 0 0.25rem;
}

.status-message {
  color: var(--text-secondary);
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
}

.progress-bar {
  height: 4px;
  background: var(--border-color);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent-color);
  transition: width 0.3s ease;
}

.status-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: var(--bg-primary);
  border-color: var(--accent-color);
}

.action-btn.danger {
  color: #ff4444;
  border-color: #ff4444;
}

.action-btn.danger:hover {
  background: rgba(255, 68, 68, 0.1);
}

/* Response Stream */
.response-stream {
  margin-bottom: 2rem;
}

.stream-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.stream-controls {
  display: flex;
  gap: 0.5rem;
}

.control-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.75rem;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.control-btn:hover,
.control-btn.active {
  color: var(--text-primary);
  border-color: var(--accent-color);
}

.control-btn.active {
  background: rgba(0, 102, 255, 0.1);
}

.stream-content {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  padding: 1rem;
  min-height: 300px;
  max-height: 400px;
  overflow-y: auto;
}

.output-message {
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.output-message:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.75rem;
}

.message-type {
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  font-weight: 500;
  text-transform: uppercase;
}

.output-message.info .message-type {
  background: rgba(0, 102, 255, 0.1);
  color: var(--accent-color);
}

.output-message.action .message-type {
  background: rgba(255, 165, 0, 0.1);
  color: #ffa500;
}

.output-message.success .message-type {
  background: rgba(0, 255, 127, 0.1);
  color: #00ff7f;
}

.output-message.error .message-type {
  background: rgba(255, 68, 68, 0.1);
  color: #ff4444;
}

.output-message.code .message-type {
  background: rgba(139, 69, 255, 0.1);
  color: #8b45ff;
}

.message-time {
  color: var(--text-secondary);
}

.message-content p {
  margin: 0;
  line-height: 1.5;
}

.message-content pre {
  margin: 0;
  padding: 0.5rem;
  background: var(--bg-secondary);
  border-radius: 0.25rem;
  overflow-x: auto;
}

.message-content code {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 0.875rem;
}

.streaming-indicator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.typing-dots {
  display: flex;
  gap: 0.25rem;
}

.typing-dots span {
  width: 6px;
  height: 6px;
  background: var(--text-secondary);
  border-radius: 50%;
  animation: typing 1.4s infinite;
}

.typing-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.5;
  }
  30% {
    transform: translateY(-10px);
    opacity: 1;
  }
}

/* File Changes */
.file-changes {
  margin-bottom: 2rem;
}

.change-count {
  padding: 0.25rem 0.5rem;
  background: var(--bg-secondary);
  border-radius: 0.25rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.changes-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.file-change {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  transition: all 0.2s;
}

.file-change:hover {
  border-color: var(--accent-color);
}

.file-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 0.375rem;
  flex-shrink: 0;
}

.file-change.created .file-icon {
  background: rgba(0, 255, 127, 0.1);
  color: #00ff7f;
}

.file-change.modified .file-icon {
  background: rgba(0, 102, 255, 0.1);
  color: var(--accent-color);
}

.file-change.deleted .file-icon {
  background: rgba(255, 68, 68, 0.1);
  color: #ff4444;
}

.file-info {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.file-path {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 0.875rem;
}

.file-stats {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.view-btn {
  padding: 0.25rem 0.75rem;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 0.25rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.view-btn:hover {
  color: var(--text-primary);
  border-color: var(--accent-color);
}

/* Action Controls */
.action-controls {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 2rem;
}

.btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-primary);
}

.btn-secondary:hover:not(:disabled) {
  border-color: var(--accent-color);
  background: rgba(0, 102, 255, 0.1);
}

.btn-primary {
  background: var(--accent-color);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-hover);
}
</style>