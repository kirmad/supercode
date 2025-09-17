<template>
  <div v-if="show" class="selector-dropdown">
    <div class="selector-overlay" @click="$emit('close')"></div>
    <div class="selector-content">
      <div class="selector-header">
        <span>Select Model</span>
        <button class="close-button" @click="$emit('close')">×</button>
      </div>
      <div class="selector-body">
        <div v-if="loading" class="loading">Loading models...</div>
        <div v-else-if="models.length === 0" class="no-items">No models available</div>
        <div v-else class="model-list">
          <div
            v-for="model in models"
            :key="`${model.provider}-${model.id}`"
            class="model-item"
            :class="{
              'selected': currentModel && currentModel.name === model.name,
              'selecting': selectingModel === `${model.provider}-${model.id}`
            }"
            @click="handleSelect(model)"
          >
            <div class="model-name">{{ model.name }}</div>
            <div class="model-provider">{{ model.provider }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { ModelInfo } from '../../types'

interface AvailableModel {
  id: string
  name: string
  provider: string
  capabilities?: string[]
}

// Props
const props = defineProps<{
  show: boolean
  models: AvailableModel[]
  loading: boolean
  currentModel?: ModelInfo | null
}>()

// Emits
const emit = defineEmits<{
  'close': []
  'select': [model: AvailableModel]
}>()

// Local state
const selectingModel = ref<string | null>(null)

// Methods
const handleSelect = async (model: AvailableModel) => {
  const selectionKey = `${model.provider}-${model.id}`
  selectingModel.value = selectionKey

  emit('select', model)

  // Reset selecting state after a delay
  setTimeout(() => {
    selectingModel.value = null
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

.model-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.model-item {
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.model-item:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: #333;
}

.model-item.selected {
  background: rgba(0, 102, 255, 0.1);
  border-color: #0066ff;
}

.model-item.selecting {
  opacity: 0.6;
  pointer-events: none;
}

.model-name {
  font-weight: 500;
  margin-bottom: 4px;
  color: var(--text-primary, #e0e0e0);
}

.model-provider {
  font-size: 0.75rem;
  color: #666;
}
</style>