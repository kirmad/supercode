<template>
  <div class="design-thoughts-container" :class="{ 'expanded': expanded }">
    <div class="thoughts-header" @click="$emit('toggle-expand')">
      <div class="header-left">
        <div class="pulse-dot" :class="{ 'active': showPulse }"></div>
        <h3 class="section-title">{{ title }}</h3>
        <span v-if="thoughts.length > 0" class="badge minimal">{{ thoughts.length }}</span>
      </div>
      <button v-if="collapsible" class="expand-button" :class="{ 'rotated': !expanded }">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>

    <transition name="expand">
      <div
        v-show="expanded"
        class="thoughts-scroll"
        ref="scrollContainer"
        @scroll="handleScroll"
      >
        <div class="design-thoughts">
          <transition-group name="list-slide">
            <div
              v-for="thought in thoughts"
              :key="thought.id"
              class="design-thought"
              :class="`type-${thought.type}`"
            >
              <div class="thought-indicator" :class="`type-${thought.type}`"></div>
              <div class="thought-content">
                <div class="thought-meta">
                  <div class="thought-type-icon" :class="`type-${thought.type}`">
                    {{ getTypeIcon(thought.type) }}
                  </div>
                  <span class="thought-type">{{ thought.type }}</span>
                  <span v-if="thought.priority" class="thought-priority-badge" :class="`priority-${thought.priority}`">
                    {{ thought.priority }}
                  </span>
                  <span v-if="thought.status" class="thought-status" :class="`status-${thought.status}`">
                    <div v-if="thought.status === 'in-progress'" class="status-spinner"></div>
                  </span>
                </div>
                <p class="thought-text">{{ thought.content }}</p>
              </div>
            </div>
          </transition-group>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { DesignThought } from '../../../types/plan-generation'

interface Props {
  thoughts: DesignThought[]
  title?: string
  expanded?: boolean
  collapsible?: boolean
  showPulse?: boolean
  autoScroll?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Design Thoughts',
  expanded: true,
  collapsible: true,
  showPulse: true,
  autoScroll: true
})

const emit = defineEmits(['toggle-expand', 'scroll'])

const scrollContainer = ref<HTMLElement | null>(null)
const userHasScrolled = ref(false)
const isNearBottom = ref(true)

function getTypeIcon(type: DesignThought['type']): string {
  const icons = {
    exploration: '🔍',
    architecture: '🏗️',
    integration: '🔗',
    dependency: '📦',
    pattern: '🧩',
    decision: '⚖️',
    constraint: '⚠️'
  }
  return icons[type] || '💭'
}

function checkIfNearBottom() {
  if (!scrollContainer.value) return true

  const container = scrollContainer.value
  const threshold = 50
  const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight

  return distanceFromBottom <= threshold
}

function handleScroll() {
  if (!scrollContainer.value) return

  isNearBottom.value = checkIfNearBottom()

  if (isNearBottom.value) {
    userHasScrolled.value = false
  } else {
    userHasScrolled.value = true
  }

  emit('scroll', { userHasScrolled: userHasScrolled.value, isNearBottom: isNearBottom.value })
}

function scrollToLatest() {
  if (!scrollContainer.value || !props.expanded || !props.autoScroll) return

  if (!userHasScrolled.value || isNearBottom.value) {
    nextTick(() => {
      const container = scrollContainer.value
      if (container) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: 'smooth'
        })
        userHasScrolled.value = false
        isNearBottom.value = true
      }
    })
  }
}

// Auto-scroll when new thoughts are added
watch(() => props.thoughts.length, () => {
  scrollToLatest()
})

defineExpose({
  scrollToLatest,
  checkIfNearBottom
})
</script>

<style scoped>
.design-thoughts-container {
  width: 100%;
}

.thoughts-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  cursor: pointer;
  user-select: none;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  background: #8b5cf6;
  border-radius: 50%;
  flex-shrink: 0;
}

.pulse-dot.active {
  animation: pulse 2s infinite;
}

.section-title {
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.badge.minimal {
  padding: 0.125rem 0.375rem;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  font-size: 0.7rem;
  font-weight: 600;
}

.expand-button {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0.25rem;
  transition: all 0.3s ease;
}

.expand-button svg {
  transition: transform 0.3s ease;
}

.expand-button.rotated svg {
  transform: rotate(180deg);
}

.thoughts-scroll {
  max-height: 200px;
  overflow-y: auto;
  padding: 0.5rem;
  margin-top: 0.5rem;
}

.design-thoughts {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.design-thought {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  transition: all 0.2s ease;
  cursor: default;
  position: relative;
}

.design-thought:hover {
  background: rgba(0, 0, 0, 0.3);
  transform: translateX(2px);
}

.thought-indicator {
  width: 3px;
  background: var(--glass-border);
  border-radius: 2px;
  flex-shrink: 0;
}

/* Type-specific colors */
.thought-indicator.type-exploration {
  background: linear-gradient(180deg, #3b82f6 0%, #2563eb 100%);
}

.thought-indicator.type-architecture {
  background: linear-gradient(180deg, #8b5cf6 0%, #7c3aed 100%);
}

.thought-indicator.type-integration {
  background: linear-gradient(180deg, #10b981 0%, #059669 100%);
}

.thought-indicator.type-dependency {
  background: linear-gradient(180deg, #f59e0b 0%, #d97706 100%);
}

.thought-indicator.type-pattern {
  background: linear-gradient(180deg, #a855f7 0%, #9333ea 100%);
}

.thought-indicator.type-decision {
  background: linear-gradient(180deg, #ec4899 0%, #db2777 100%);
}

.thought-indicator.type-constraint {
  background: linear-gradient(180deg, #ef4444 0%, #dc2626 100%);
}

.thought-content {
  flex: 1;
  min-width: 0;
}

.thought-meta {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-bottom: 0.25rem;
}

.thought-type-icon {
  font-size: 0.75rem;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  flex-shrink: 0;
}

.thought-type-icon.type-exploration {
  background: rgba(59, 130, 246, 0.1);
}

.thought-type-icon.type-architecture {
  background: rgba(139, 92, 246, 0.1);
}

.thought-type-icon.type-integration {
  background: rgba(16, 185, 129, 0.1);
}

.thought-type-icon.type-dependency {
  background: rgba(245, 158, 11, 0.1);
}

.thought-type-icon.type-pattern {
  background: rgba(168, 85, 247, 0.1);
}

.thought-type-icon.type-decision {
  background: rgba(236, 72, 153, 0.1);
}

.thought-type-icon.type-constraint {
  background: rgba(239, 68, 68, 0.1);
}

.thought-type {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-secondary);
  opacity: 0.7;
}

.thought-priority-badge {
  font-size: 0.625rem;
  font-weight: 600;
  padding: 0.125rem 0.375rem;
  border-radius: 8px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-left: auto;
  transition: all 0.2s ease;
}

.thought-priority-badge.priority-critical {
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #ef4444;
}

.thought-priority-badge.priority-high {
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: #f59e0b;
}

.thought-priority-badge.priority-medium {
  background: rgba(34, 197, 94, 0.15);
  border: 1px solid rgba(34, 197, 94, 0.3);
  color: #22c55e;
}

.thought-priority-badge.priority-low {
  background: rgba(107, 114, 128, 0.15);
  border: 1px solid rgba(107, 114, 128, 0.3);
  color: #6b7280;
}

.thought-status {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.65rem;
  margin-left: 0.5rem;
}

.status-spinner {
  width: 10px;
  height: 10px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.thought-text {
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--text-primary);
  margin: 0;
  opacity: 0.9;
}

/* Animations */
@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(139, 92, 246, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(139, 92, 246, 0);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Transitions */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  max-height: 300px;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}

.list-slide-enter-active,
.list-slide-leave-active,
.list-slide-move {
  transition: all 0.3s ease;
}

.list-slide-enter-from {
  transform: translateX(-20px);
  opacity: 0;
}

.list-slide-leave-to {
  transform: translateX(20px);
  opacity: 0;
}

/* Custom scrollbar */
.thoughts-scroll::-webkit-scrollbar {
  width: 6px;
}

.thoughts-scroll::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.thoughts-scroll::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #8b5cf6, #7c3aed);
  border-radius: 3px;
}

.thoughts-scroll::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #9f6ffa, #8b4cf6);
}
</style>