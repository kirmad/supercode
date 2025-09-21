<template>
  <button
    :class="buttonClasses"
    :disabled="disabled || loading"
    :title="title"
    @click="handleClick"
  >
    <!-- Loading Spinner -->
    <div v-if="loading" class="button-spinner"></div>

    <!-- Icon Slot or Prop -->
    <div v-if="(icon || $slots.icon) && !loading" class="button-icon">
      <slot v-if="$slots.icon" name="icon"></slot>
      <component v-else-if="icon" :is="icon" />
    </div>

    <!-- Button Content -->
    <span v-if="$slots.default" class="button-content">
      <slot></slot>
    </span>

    <!-- Glow Effect for Special Buttons -->
    <div v-if="hasGlow" class="button-glow"></div>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'primary' | 'success' | 'ghost' | 'secondary' | 'icon' | 'pill'
  size?: 'small' | 'medium' | 'large'
  disabled?: boolean
  loading?: boolean
  title?: string
  icon?: any
  hasGlow?: boolean
  fullWidth?: boolean
  customClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'medium',
  disabled: false,
  loading: false,
  hasGlow: false,
  fullWidth: false,
  customClass: ''
})

const emit = defineEmits(['click'])

const buttonClasses = computed(() => {
  const classes = ['action-button']

  // Add variant class
  classes.push(`action-button--${props.variant}`)

  // Add size class
  classes.push(`action-button--${props.size}`)

  // Add state classes
  if (props.disabled) classes.push('action-button--disabled')
  if (props.loading) classes.push('action-button--loading')
  if (props.fullWidth) classes.push('action-button--full-width')
  if (props.hasGlow) classes.push('action-button--glow')

  // Add custom class if provided
  if (props.customClass) classes.push(props.customClass)

  return classes
})

const handleClick = (event: MouseEvent) => {
  if (!props.disabled && !props.loading) {
    emit('click', event)
  }
}
</script>

<style scoped>
/* Base Button Styles */
.action-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: none;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  overflow: hidden;
  font-family: inherit;
}

/* Size Variants */
.action-button--small {
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
}

.action-button--medium {
  padding: 0.625rem 1.25rem;
  font-size: 0.875rem;
}

.action-button--large {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
}

/* Primary Variant */
.action-button--primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.action-button--primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

/* Success Variant */
.action-button--success {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
}

.action-button--success:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

/* Ghost Variant */
.action-button--ghost {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
}

.action-button--ghost:hover:not(:disabled) {
  background: var(--glass-bg, rgba(255, 255, 255, 0.03));
  border-color: var(--glass-border, rgba(255, 255, 255, 0.12));
}

/* Secondary Variant */
.action-button--secondary {
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
}

.action-button--secondary:hover:not(:disabled) {
  background: var(--glass-bg, rgba(255, 255, 255, 0.03));
  transform: translateY(-1px);
}

/* Icon Button Variant */
.action-button--icon {
  padding: 0.5rem;
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
  border-radius: 8px;
  min-width: auto;
}

.action-button--icon:hover:not(:disabled) {
  background: var(--glass-bg, rgba(255, 255, 255, 0.03));
  transform: translateY(-1px);
}

/* Pill Variant */
.action-button--pill {
  padding: 0.375rem 0.75rem;
  border-radius: 20px;
  font-size: 0.75rem;
  background: var(--glass-bg, rgba(255, 255, 255, 0.03));
  color: var(--text-primary);
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.08));
}

.action-button--pill:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

/* Disabled State */
.action-button:disabled,
.action-button--disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
}

/* Loading State */
.action-button--loading {
  cursor: wait;
}

/* Full Width */
.action-button--full-width {
  width: 100%;
}

/* Button Content */
.button-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

/* Button Icon */
.button-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Loading Spinner */
.button-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Glow Effect */
.button-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, transparent 70%);
  transform: translate(-50%, -50%);
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.action-button--glow:hover .button-glow {
  opacity: 1;
}

/* Ripple Effect */
.action-button::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.3);
  transform: translate(-50%, -50%);
  transition: width 0.6s, height 0.6s;
  pointer-events: none;
}

.action-button:active::after {
  width: 300px;
  height: 300px;
}

.action-button:active {
  transform: scale(0.98);
}
</style>