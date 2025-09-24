<template>
  <div class="section-header" :class="[variant, { 'clickable': clickable }]" @click="handleClick">
    <div class="header-content">
      <div v-if="icon || $slots.icon" class="header-icon" :class="iconClass">
        <slot name="icon">
          <component v-if="icon" :is="icon" />
        </slot>
      </div>
      <h3 class="header-title">{{ title }}</h3>
      <div v-if="badge || $slots.badge" class="header-badge">
        <slot name="badge">
          <span class="badge-text">{{ badge }}</span>
        </slot>
      </div>
    </div>
    <div v-if="$slots.actions || collapsible" class="header-actions">
      <slot name="actions"></slot>
      <button v-if="collapsible" class="collapse-button" :class="{ 'collapsed': collapsed }">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  title: string
  icon?: any
  iconClass?: string
  badge?: string | number
  variant?: 'default' | 'modern' | 'minimal' | 'prominent'
  collapsible?: boolean
  collapsed?: boolean
  clickable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  collapsible: false,
  collapsed: false,
  clickable: false,
  iconClass: ''
})

const emit = defineEmits(['click', 'toggle-collapse'])

function handleClick() {
  if (props.clickable || props.collapsible) {
    emit('click')
    if (props.collapsible) {
      emit('toggle-collapse')
    }
  }
}
</script>

<style scoped>
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--glass-border);
  margin-bottom: 0.5rem;
  transition: all 0.2s ease;
}

.section-header.clickable {
  cursor: pointer;
  user-select: none;
}

.section-header.clickable:hover {
  background: var(--glass-bg);
  padding-left: 0.5rem;
  padding-right: 0.5rem;
  margin-left: -0.5rem;
  margin-right: -0.5rem;
  border-radius: 8px;
}

/* Variants */
.section-header.modern {
  border-bottom-style: solid;
  border-bottom-width: 2px;
  border-image: linear-gradient(90deg, var(--primary-color), transparent) 1;
}

.section-header.minimal {
  border-bottom: none;
  padding: 0.5rem 0;
  margin-bottom: 0.25rem;
}

.section-header.prominent {
  background: var(--glass-bg);
  padding: 1rem;
  border-radius: 8px;
  border-bottom: none;
  margin-bottom: 1rem;
}

/* Header Content */
.header-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.header-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: all 0.3s ease;
}

.header-icon.success {
  color: var(--success-color);
}

.header-icon.warning {
  color: var(--warning-color);
}

.header-icon.error {
  color: var(--error-color);
}

.header-icon.primary {
  color: var(--primary-color);
}

.section-header:hover .header-icon {
  transform: scale(1.1);
}

.header-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -0.01em;
}

.header-badge {
  margin-left: 0.5rem;
}

.badge-text {
  padding: 0.125rem 0.5rem;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-secondary);
}

/* Header Actions */
.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.collapse-button {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  border-radius: 4px;
}

.collapse-button:hover {
  background: var(--glass-bg);
  color: var(--text-primary);
}

.collapse-button svg {
  transition: transform 0.3s ease;
}

.collapse-button.collapsed svg {
  transform: rotate(-90deg);
}

/* Animations */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.section-header {
  animation: fadeIn 0.3s ease-out;
}
</style>