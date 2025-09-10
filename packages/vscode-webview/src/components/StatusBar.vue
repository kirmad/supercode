<template>
  <div class="status-bar">
    <div class="status-line">
      <span class="connection-status">{{ statusConfig.dot }}</span>
      <span class="status-text">{{ statusConfig.text }}</span>
    </div>
    <div v-if="modelInfo" class="model-info">
      {{ modelInfo.name }} ({{ modelInfo.provider }})
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ConnectionStatus, StatusConfig, ModelInfo } from '../types'

interface Props {
  status: ConnectionStatus
  port: number
  modelInfo?: ModelInfo
}

const props = defineProps<Props>()

const statusConfig = computed((): StatusConfig => {
  const configs: Record<ConnectionStatus, StatusConfig> = {
    disconnected: { dot: '⚪', text: 'Disconnected', enabled: false },
    connecting: { dot: '🟡', text: 'Connecting...', enabled: false },
    connected: { dot: '🟢', text: `Connected (port ${props.port})`, enabled: true },
    error: { dot: '🔴', text: 'Connection Error', enabled: false }
  }
  
  return configs[props.status] || configs.disconnected
})
</script>

<style scoped>
.status-bar {
  padding: 8px 16px;
  background: var(--vscode-statusBar-background);
  color: var(--vscode-statusBar-foreground);
  border-bottom: 1px solid var(--vscode-statusBar-border);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.status-line {
  display: flex;
  align-items: center;
  gap: 8px;
}

.connection-status {
  font-size: 12px;
}

.status-text {
  font-size: 12px;
  font-family: var(--vscode-editor-font-family, 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace);
}

.model-info {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  font-family: var(--vscode-editor-font-family, 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace);
  opacity: 0.8;
}
</style>