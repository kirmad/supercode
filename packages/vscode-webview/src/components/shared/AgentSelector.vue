<template>
  <div v-if="show" class="selector-dropdown">
    <div class="selector-overlay" @click="$emit('close')"></div>
    <div class="selector-content">
      <div class="selector-header">
        <span>Select Agent</span>
        <button class="close-button" @click="$emit('close')">×</button>
      </div>
      <div class="selector-body">
        <div v-if="loading" class="loading">Loading agents...</div>
        <div v-else-if="agents.length === 0" class="no-items">No agents available</div>
        <div v-else class="agent-list">
          <div
            v-for="agent in agents"
            :key="agent.id"
            class="agent-item"
            :class="{
              'selected': currentAgent && currentAgent.name === agent.name,
              'selecting': selectingAgent === agent.id
            }"
            @click="handleSelect(agent)"
          >
            <div class="agent-header">
              <div class="agent-name">{{ agent.name }}</div>
              <div class="agent-badges">
                <span class="agent-mode-badge" :class="agent.mode">{{ agent.mode }}</span>
                <span v-if="agent.builtIn" class="built-in-badge">built-in</span>
              </div>
            </div>
            <div class="agent-description">{{ agent.description || 'No description available' }}</div>
            <div class="agent-permissions">
              <div class="permission-group">
                <span class="permission-label">Edit:</span>
                <span class="permission-value" :class="agent.permission.edit">{{ agent.permission.edit }}</span>
              </div>
              <div class="permission-group">
                <span class="permission-label">Bash:</span>
                <span class="permission-value" :class="typeof agent.permission.bash === 'string' ? agent.permission.bash : 'custom'">
                  {{ typeof agent.permission.bash === 'string' ? agent.permission.bash : 'custom' }}
                </span>
              </div>
              <div v-if="agent.permission.webfetch" class="permission-group">
                <span class="permission-label">WebFetch:</span>
                <span class="permission-value" :class="agent.permission.webfetch">{{ agent.permission.webfetch }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface AvailableAgent {
  id: string
  name: string
  description?: string
  mode: string
  builtIn: boolean
  permission: {
    edit: string
    bash: Record<string, string> | string
    webfetch?: string
  }
  tools: Record<string, boolean>
}

// Props
const props = defineProps<{
  show: boolean
  agents: AvailableAgent[]
  loading: boolean
  currentAgent?: { name: string; description?: string; id?: string } | null
}>()

// Emits
const emit = defineEmits<{
  'close': []
  'select': [agent: AvailableAgent]
}>()

// Local state
const selectingAgent = ref<string | null>(null)

// Methods
const handleSelect = async (agent: AvailableAgent) => {
  selectingAgent.value = agent.id

  emit('select', agent)

  // Reset selecting state after a delay
  setTimeout(() => {
    selectingAgent.value = null
  }, 500)
}
</script>

<style scoped>
.selector-dropdown {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 80px;
}

.selector-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
}

.selector-content {
  position: relative;
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 6px;
  min-width: 320px;
  max-width: 500px;
  max-height: 60vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.selector-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #333;
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  color: #999;
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  transition: all 0.15s ease;
}

.close-button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.selector-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.loading,
.no-items {
  padding: 24px;
  text-align: center;
  color: #666;
}

.agent-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.agent-item {
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.agent-item:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: #333;
}

.agent-item.selected {
  background: rgba(0, 102, 255, 0.1);
  border-color: #0066ff;
}

.agent-item.selecting {
  opacity: 0.6;
  pointer-events: none;
}

.agent-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.agent-name {
  font-weight: 500;
  color: var(--text-primary, #e0e0e0);
}

.agent-badges {
  display: flex;
  gap: 6px;
}

.agent-mode-badge,
.built-in-badge {
  padding: 2px 6px;
  font-size: 0.625rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-radius: 3px;
  font-weight: 500;
}

.agent-mode-badge.primary,
.agent-mode-badge.all {
  background: rgba(0, 102, 255, 0.15);
  color: #4da6ff;
}

.agent-mode-badge.custom {
  background: rgba(0, 102, 255, 0.15);
  color: #4da6ff;
}

.built-in-badge {
  background: rgba(255, 153, 0, 0.15);
  color: #ff9900;
}

.agent-description {
  font-size: 0.75rem;
  color: #999;
  margin-bottom: 8px;
  line-height: 1.4;
}

.agent-permissions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.permission-group {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.625rem;
}

.permission-label {
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.permission-value {
  padding: 2px 5px;
  border-radius: 3px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.permission-value.allow {
  background: rgba(0, 255, 136, 0.15);
  color: #00ff88;
}

.permission-value.deny {
  background: rgba(255, 68, 68, 0.15);
  color: #ff4444;
}

.permission-value.custom {
  background: rgba(255, 153, 0, 0.15);
  color: #ff9900;
}
</style>