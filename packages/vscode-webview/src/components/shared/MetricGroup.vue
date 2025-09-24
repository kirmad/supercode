<template>
  <div class="metric-group" :class="variant">
    <div
      v-for="(metric, index) in metrics"
      :key="metric.id || index"
      class="metric-item"
      :class="[metric.class, { 'compact': compact }]"
    >
      <span class="metric-value" :class="metric.valueClass">
        {{ formatValue(metric.value, metric.format) }}
      </span>
      <span class="metric-label">{{ metric.label }}</span>
    </div>
    <div
      v-if="showDividers && metrics.length > 1"
      v-for="i in metrics.length - 1"
      :key="`divider-${i}`"
      class="metric-divider"
      :style="{ left: `${(100 / metrics.length) * i}%` }"
    ></div>
  </div>
</template>

<script setup lang="ts">
interface Metric {
  id?: string
  value: string | number
  label: string
  format?: 'number' | 'percentage' | 'text' | 'prefix'
  class?: string
  valueClass?: string
}

interface Props {
  metrics: Metric[]
  variant?: 'default' | 'centered' | 'spaced'
  compact?: boolean
  showDividers?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  compact: false,
  showDividers: true
})

const formatValue = (value: string | number, format?: string): string => {
  if (!format) return String(value)

  switch (format) {
    case 'percentage':
      return typeof value === 'number' ? `${value}%` : value
    case 'prefix':
      return typeof value === 'number' ? `+${value}` : value
    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : value
    default:
      return String(value)
  }
}
</script>

<style scoped>
/* Metric Group Container */
.metric-group {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  position: relative;
}

.metric-group.centered {
  justify-content: center;
}

.metric-group.spaced {
  gap: 2rem;
}

/* Metric Item */
.metric-item {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  position: relative;
}

.metric-item.compact {
  flex-direction: row;
  gap: 0.375rem;
}

/* Metric Value */
.metric-value {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: inline-block;
}

.metric-item.compact .metric-value {
  font-size: 1rem;
}

/* Animated Gradient Text Option */
.metric-value.gradient {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.metric-value.success {
  color: var(--success-color, #10b981);
}

.metric-value.warning {
  color: var(--warning-color, #f59e0b);
}

.metric-value.error {
  color: var(--error-color, #ef4444);
}

/* Metric Label */
.metric-label {
  font-size: 0.65rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.7;
}

.metric-item.compact .metric-label {
  text-transform: none;
  letter-spacing: normal;
}

/* Divider */
.metric-divider {
  position: absolute;
  width: 1px;
  height: 20px;
  background: var(--glass-border, rgba(255, 255, 255, 0.08));
  top: 50%;
  transform: translateY(-50%);
}

/* Hover Effect */
.metric-item:hover .metric-value {
  transform: scale(1.15);
  color: #8b5cf6;
}

.metric-item.compact:hover .metric-value {
  transform: scale(1.05);
}

/* Animations */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.metric-item {
  animation: fadeInUp 0.5s ease-out;
}

.metric-item:nth-child(2) {
  animation-delay: 0.1s;
}

.metric-item:nth-child(3) {
  animation-delay: 0.2s;
}

.metric-item:nth-child(4) {
  animation-delay: 0.3s;
}
</style>