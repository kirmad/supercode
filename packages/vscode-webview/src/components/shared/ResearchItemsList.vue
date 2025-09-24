<template>
  <div class="research-items-container" :class="{ 'expanded': expanded }">
    <div class="research-header" @click="$emit('toggle-expand')">
      <div class="header-left">
        <div class="pulse-dot" :class="{ 'active': showPulse }"></div>
        <h3 class="section-title">{{ title }}</h3>
        <span v-if="items.length > 0" class="badge minimal">{{ items.length }}</span>
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
        class="research-items-scroll"
        ref="scrollContainer"
        @scroll="handleScroll"
      >
        <div class="research-items">
          <transition-group name="list-slide">
            <div
              v-for="item in items"
              :key="item.id"
              class="research-item"
              :class="`type-${item.type}`"
            >
              <div class="item-indicator" :class="`type-${item.type}`"></div>
              <div class="item-content">
                <div class="item-meta">
                  <span class="item-type">{{ item.type }}</span>
                  <span v-if="item.priority" class="item-priority-badge" :class="`priority-${item.priority}`">
                    {{ item.priority }}
                  </span>
                  <span v-if="item.status" class="item-status" :class="`status-${item.status}`">
                    <div v-if="item.status === 'in-progress'" class="status-spinner"></div>
                  </span>
                </div>
                <p class="item-text">{{ item.content }}</p>
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

export interface ResearchItem {
  id: string
  type: 'analysis' | 'pattern' | 'requirement' | 'best-practice' | 'clarification'
  priority?: 'high' | 'medium' | 'low'
  content: string
  timestamp?: number
  status?: 'pending' | 'in-progress' | 'completed'
}

interface Props {
  items: ResearchItem[]
  title?: string
  expanded?: boolean
  collapsible?: boolean
  showPulse?: boolean
  autoScroll?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Live Research',
  expanded: true,
  collapsible: true,
  showPulse: true,
  autoScroll: true
})

const emit = defineEmits(['toggle-expand', 'scroll'])

const scrollContainer = ref<HTMLElement | null>(null)
const userHasScrolled = ref(false)
const isNearBottom = ref(true)

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

// Auto-scroll when new items are added
watch(() => props.items.length, () => {
  scrollToLatest()
})

defineExpose({
  scrollToLatest,
  checkIfNearBottom
})
</script>

<style scoped>
.research-items-container {
  width: 100%;
}

.research-header {
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
  background: #10b981;
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

.research-items-scroll {
  max-height: 200px;
  overflow-y: auto;
  padding: 0.5rem;
  margin-top: 0.5rem;
}

.research-items {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.research-item {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  transition: all 0.2s ease;
  cursor: default;
  position: relative;
}

.research-item:hover {
  background: rgba(0, 0, 0, 0.3);
  transform: translateX(2px);
}

.item-indicator {
  width: 3px;
  background: var(--glass-border);
  border-radius: 2px;
  flex-shrink: 0;
}

.item-indicator.type-analysis {
  background: linear-gradient(180deg, #3b82f6 0%, #2563eb 100%);
}

.item-indicator.type-pattern {
  background: linear-gradient(180deg, #a855f7 0%, #9333ea 100%);
}

.item-indicator.type-requirement {
  background: linear-gradient(180deg, #ec4899 0%, #db2777 100%);
}

.item-indicator.type-best-practice {
  background: linear-gradient(180deg, #22c55e 0%, #16a34a 100%);
}

.item-indicator.type-clarification {
  background: linear-gradient(180deg, #f59e0b 0%, #f97316 100%);
}

.item-content {
  flex: 1;
  min-width: 0;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-bottom: 0.25rem;
}

.item-type {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-secondary);
  opacity: 0.7;
}

.item-priority-badge {
  font-size: 0.625rem;
  font-weight: 600;
  padding: 0.125rem 0.375rem;
  border-radius: 8px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  margin-left: auto;
  transition: all 0.2s ease;
}

.item-priority-badge.priority-high {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

.item-priority-badge.priority-medium {
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: #f59e0b;
}

.item-priority-badge.priority-low {
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #10b981;
}

.item-status {
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

.item-text {
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--text-primary);
  margin: 0;
  opacity: 0.9;
}

/* Animations */
@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(16, 185, 129, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
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
.research-items-scroll::-webkit-scrollbar {
  width: 6px;
}

.research-items-scroll::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.research-items-scroll::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #8b5cf6, #ec4899);
  border-radius: 3px;
}

.research-items-scroll::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #9f6ffa, #f06ba5);
}
</style>