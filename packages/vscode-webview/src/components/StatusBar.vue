<template>
  <div class="status-bar">
    <span class="connection-status">{{ statusConfig.dot }}</span>
    <span class="status-text">{{ statusConfig.text }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ConnectionStatus, StatusConfig } from '../types'

interface Props {
  status: ConnectionStatus
  port: number
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
  align-items: center;
  gap: 8px;
}

.connection-status {
  font-size: 12px;
}

.status-text {
  font-size: 12px;
}
</style>