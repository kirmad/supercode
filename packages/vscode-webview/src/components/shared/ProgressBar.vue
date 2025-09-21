<template>
  <div v-if="visible" class="progress-container" :class="variant">
    <div class="progress-track">
      <div
        class="progress-fill"
        :style="{ width: percentage + '%' }"
      >
        <div v-if="showGlow" class="progress-glow"></div>
      </div>
    </div>
    <div v-if="label" class="progress-label">{{ label }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  percentage: number
  label?: string
  variant?: 'default' | 'modern' | 'gradient' | 'character'
  visible?: boolean
  showGlow?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  percentage: 0,
  variant: 'default',
  visible: true,
  showGlow: true
})

const clampedPercentage = computed(() => {
  return Math.max(0, Math.min(100, props.percentage))
})
</script>

<style scoped>
/* Container */
.progress-container {
  margin: 0.5rem 0;
}

.progress-container.modern {
  margin-top: 0.5rem;
}

/* Track */
.progress-track {
  height: 3px;
  background: var(--glass-border, rgba(255, 255, 255, 0.08));
  border-radius: 2px;
  overflow: hidden;
  position: relative;
}

.progress-container.character .progress-track {
  height: 2px;
  border-radius: 1px;
}

/* Fill */
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  transition: width 0.3s ease;
  position: relative;
}

.progress-container.gradient .progress-fill {
  background: linear-gradient(90deg, #667eea, #764ba2, #667eea);
  background-size: 200% 100%;
  animation: progress-flow 2s linear infinite;
}

.progress-container.character .progress-fill {
  background: linear-gradient(90deg, #8b5cf6, #ec4899, #8b5cf6);
  background-size: 200% 100%;
  animation: progress-flow 2s linear infinite;
}

/* Glow Effect */
.progress-glow {
  position: absolute;
  right: 0;
  top: 50%;
  width: 20px;
  height: 10px;
  background: white;
  filter: blur(8px);
  transform: translateY(-50%);
  animation: glow 1s ease-in-out infinite;
}

/* Label */
.progress-label {
  font-size: 0.7rem;
  color: var(--text-secondary);
  margin-top: 0.375rem;
  text-align: center;
  opacity: 0.8;
}

.progress-container.modern .progress-label {
  text-align: center;
}

/* Animations */
@keyframes glow {
  0%, 100% {
    opacity: 0.3;
  }
  50% {
    opacity: 1;
  }
}

@keyframes progress-flow {
  0% {
    background-position: 0% 50%;
  }
  100% {
    background-position: 100% 50%;
  }
}
</style>