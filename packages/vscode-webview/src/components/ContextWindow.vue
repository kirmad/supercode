<template>
  <div class="context-window">
    <span class="context-info">{{ contextInfo }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  usedTokens?: number
  maxTokens?: number
}

const props = withDefaults(defineProps<Props>(), {
  usedTokens: 0,
  maxTokens: 38000
})

const contextInfo = computed(() => {
  const used = formatTokens(props.usedTokens)
  const max = formatTokens(props.maxTokens)
  return `${used}/${max}`
})

function formatTokens(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`
  }
  return tokens.toString()
}
</script>

<style scoped>
.context-window {
  position: absolute;
  top: 8px;
  right: 16px;
  z-index: 100;
}

.context-info {
  font-family: var(--vscode-editor-font-family, 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace);
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
  background: var(--vscode-editor-background);
  padding: 4px 8px;
  border-radius: 3px;
  border: 1px solid var(--vscode-panel-border);
}
</style>