<template>
  <div v-if="show" class="selector-dropdown">
    <div class="selector-overlay" @click="$emit('close')"></div>
    <div class="selector-content">
      <div class="selector-header">
        <span>Select Output Style</span>
        <button class="close-button" @click="$emit('close')">×</button>
      </div>
      <div class="selector-body">
        <div v-if="loading" class="loading">Loading output styles...</div>
        <div v-else-if="styles.length === 0" class="no-items">No output styles available</div>
        <div v-else class="style-list">
          <div
            v-for="style in styles"
            :key="style.id"
            class="style-item"
            :class="{
              'selected': currentStyle && currentStyle.name === style.name,
              'selecting': selectingStyle === style.id
            }"
            @click="handleSelect(style)"
          >
            <div class="style-header">
              <div class="style-name">{{ style.name }}</div>
              <div v-if="style.id === 'default'" class="default-badge">default</div>
            </div>
            <div class="style-description">{{ style.description || 'No description available' }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface OutputStyle {
  id: string
  name: string
  description: string
}

// Props
const props = defineProps<{
  show: boolean
  styles: OutputStyle[]
  loading: boolean
  currentStyle?: { name: string; description?: string } | null
}>()

// Emits
const emit = defineEmits<{
  'close': []
  'select': [style: OutputStyle]
}>()

// Local state
const selectingStyle = ref<string | null>(null)

// Methods
const handleSelect = async (style: OutputStyle) => {
  selectingStyle.value = style.id

  emit('select', style)

  // Reset selecting state after a delay
  setTimeout(() => {
    selectingStyle.value = null
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

.style-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.style-item {
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.style-item:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: #333;
}

.style-item.selected {
  background: rgba(0, 102, 255, 0.1);
  border-color: #0066ff;
}

.style-item.selecting {
  opacity: 0.6;
  pointer-events: none;
}

.style-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.style-name {
  font-weight: 500;
  color: var(--text-primary, #e0e0e0);
}

.default-badge {
  padding: 2px 6px;
  font-size: 0.625rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-radius: 3px;
  font-weight: 500;
  background: rgba(0, 102, 255, 0.15);
  color: #4da6ff;
}

.style-description {
  font-size: 0.75rem;
  color: #999;
  line-height: 1.4;
}
</style>