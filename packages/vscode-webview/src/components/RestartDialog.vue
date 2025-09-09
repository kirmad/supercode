<template>
  <div class="restart-dialog-overlay">
    <div class="restart-dialog">
      <p class="dialog-message">{{ message }}</p>
      <div class="dialog-buttons">
        <button 
          class="restart-button"
          @click="$emit('restart')"
        >
          Restart
        </button>
        <button 
          class="ignore-button"
          @click="$emit('ignore')"
        >
          Ignore
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  message: string
}

interface Emits {
  (event: 'restart'): void
  (event: 'ignore'): void
}

defineProps<Props>()
defineEmits<Emits>()
</script>

<style scoped>
.restart-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.restart-dialog {
  background: var(--vscode-inputValidation-warningBackground);
  border: 1px solid var(--vscode-inputValidation-warningBorder);
  border-radius: 4px;
  padding: 1rem;
  max-width: 400px;
  margin: 1rem;
}

.dialog-message {
  color: var(--vscode-inputValidation-warningForeground);
  margin-bottom: 1rem;
  text-align: center;
}

.dialog-buttons {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.restart-button {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  padding: 6px 12px;
  border-radius: 2px;
  cursor: pointer;
}

.restart-button:hover {
  background: var(--vscode-button-hoverBackground);
}

.ignore-button {
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
  border: none;
  padding: 6px 12px;
  border-radius: 2px;
  cursor: pointer;
}

.ignore-button:hover {
  opacity: 0.8;
}
</style>