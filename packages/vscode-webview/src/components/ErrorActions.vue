<template>
  <div class="error-actions">
    <h4>⚠️ SuperCode Connection Failed</h4>
    <p class="error-description">
      The SuperCode process has stopped or failed to start. This could be due to:
      <br>• Port conflict or permission issues
      <br>• SuperCode not installed or not in PATH  
      <br>• Missing project configuration
    </p>
    <div class="action-buttons">
      <button 
        class="restart-button"
        @click="$emit('restart')"
        :disabled="isRetrying"
      >
        🔄 {{ isRetrying ? 'Restarting...' : 'Restart Process' }}
      </button>
      <button 
        class="retry-button"
        @click="handleRetry"
        :disabled="isRetrying"
      >
        ↻ {{ isRetrying ? 'Retrying...' : 'Retry Connection' }}
      </button>
    </div>
    <p class="help-text">
      Check the VS Code Output panel for detailed error logs.
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Emits {
  (event: 'retry'): void
  (event: 'restart'): void
}

const emit = defineEmits<Emits>()

const isRetrying = ref(false)

function handleRetry() {
  isRetrying.value = true
  emit('retry')
  
  // Reset the retrying state after a delay
  setTimeout(() => {
    isRetrying.value = false
  }, 3000)
}
</script>

<style scoped>
.error-actions {
  text-align: center;
  margin: 1rem;
  padding: 1rem;
  background: var(--vscode-inputValidation-errorBackground);
  border: 1px solid var(--vscode-inputValidation-errorBorder);
  border-radius: 4px;
}

h4 {
  color: var(--vscode-inputValidation-errorForeground);
  margin: 0 0 0.5rem 0;
}

.error-description {
  color: var(--vscode-inputValidation-errorForeground);
  margin-bottom: 1rem;
  font-size: 13px;
  line-height: 1.4;
}

.action-buttons {
  margin-top: 1rem;
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
}

.restart-button {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  padding: 8px 16px;
  border-radius: 3px;
  cursor: pointer;
  font-weight: 500;
}

.restart-button:hover:not(:disabled) {
  background: var(--vscode-button-hoverBackground);
}

.retry-button {
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
  border: none;
  padding: 8px 16px;
  border-radius: 3px;
  cursor: pointer;
}

.retry-button:hover:not(:disabled) {
  opacity: 0.8;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.help-text {
  color: var(--vscode-descriptionForeground);
  margin-top: 1rem;
  font-size: 11px;
  opacity: 0.8;
}
</style>