<template>
  <div
    :class="[
      'glass-card',
      variant,
      { 'hoverable': hoverable },
      customClass
    ]"
    :style="customStyle"
  >
    <!-- Optional Header Slot -->
    <div v-if="$slots.header" class="glass-card-header">
      <slot name="header"></slot>
    </div>

    <!-- Main Content Slot -->
    <div class="glass-card-content">
      <slot></slot>
    </div>

    <!-- Optional Footer Slot -->
    <div v-if="$slots.footer" class="glass-card-footer">
      <slot name="footer"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'default' | 'minimal' | 'premium' | 'compact'
  hoverable?: boolean
  padding?: string
  borderRadius?: string
  background?: string
  customClass?: string
  customStyle?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  hoverable: false,
  padding: '1rem',
  borderRadius: '12px',
  customClass: '',
  customStyle: () => ({})
})

const computedStyle = computed(() => ({
  padding: props.padding,
  borderRadius: props.borderRadius,
  ...(props.background && { background: props.background }),
  ...props.customStyle
}))
</script>

<style scoped>
/* Glass Card Base Styles */
.glass-card {
  background: var(--glass-bg, rgba(255, 255, 255, 0.03));
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
  border-radius: 12px;
  box-shadow: var(--glass-shadow, 0 8px 32px 0 rgba(0, 0, 0, 0.37));
  padding: 1rem;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

/* Hoverable Variant */
.glass-card.hoverable:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.4);
}

/* Minimal Variant */
.glass-card.minimal {
  padding: 0.5rem;
  background: var(--glass-bg, rgba(255, 255, 255, 0.02));
}

/* Premium Variant */
.glass-card.premium {
  background: linear-gradient(135deg, var(--glass-bg, rgba(255, 255, 255, 0.03)) 0%, rgba(16, 185, 129, 0.05) 100%);
  border: 1px solid var(--success-glow, rgba(16, 185, 129, 0.3));
}

.glass-card.premium::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--success-color, #10b981), transparent);
  animation: shimmer 3s infinite;
}

/* Compact Variant */
.glass-card.compact {
  padding: 0.75rem;
}

/* Header and Footer Styles */
.glass-card-header {
  margin-bottom: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
}

.glass-card-content {
  position: relative;
}

.glass-card-footer {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
}

/* Animations */
@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}
</style>