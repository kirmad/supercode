<template>
  <div class="coming-soon-container">
    <div class="coming-soon-content">
      <!-- Minimal icon with subtle animation -->
      <div class="icon-wrapper">
        <div class="icon-glow"></div>
        <svg v-if="tabType === 'prompt'" class="tab-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M3 12h18m-9-9v18" stroke="currentColor" stroke-width="0.5" opacity="0.3"/>
          <circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.8"/>
          <circle cx="12" cy="5" r="1.5" fill="currentColor" opacity="0.5"/>
          <circle cx="19" cy="12" r="1.5" fill="currentColor" opacity="0.5"/>
          <circle cx="12" cy="19" r="1.5" fill="currentColor" opacity="0.5"/>
          <circle cx="5" cy="12" r="1.5" fill="currentColor" opacity="0.5"/>
        </svg>
        <svg v-else-if="tabType === 'plan'" class="tab-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="5" y="3" width="14" height="18" stroke="currentColor" stroke-width="0.5" opacity="0.3"/>
          <path d="M9 7H15" stroke="currentColor" stroke-width="0.8" opacity="0.7"/>
          <path d="M9 11H15" stroke="currentColor" stroke-width="0.8" opacity="0.6"/>
          <path d="M9 15H13" stroke="currentColor" stroke-width="0.8" opacity="0.5"/>
          <circle cx="17" cy="19" r="1" fill="currentColor" opacity="0.8"/>
        </svg>
        <svg v-else-if="tabType === 'implement'" class="tab-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="4" y="4" width="6" height="6" stroke="currentColor" stroke-width="0.5" opacity="0.3"/>
          <rect x="14" y="4" width="6" height="6" stroke="currentColor" stroke-width="0.5" opacity="0.5"/>
          <rect x="4" y="14" width="6" height="6" stroke="currentColor" stroke-width="0.5" opacity="0.7"/>
          <rect x="14" y="14" width="6" height="6" stroke="currentColor" stroke-width="0.5" opacity="0.9"/>
        </svg>
        <svg v-else-if="tabType === 'review'" class="tab-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L2 7V17L12 22L22 17V7L12 2Z" stroke="currentColor" stroke-width="0.5" opacity="0.3"/>
          <path d="M7 12L10 15L17 8" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.8"/>
        </svg>
        <svg v-else-if="tabType === 'validate'" class="tab-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M9 11L12 14L22 4" stroke="currentColor" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>
          <path d="M21 12V19C21 20 20 21 19 21H5C4 21 3 20 3 19V5C3 4 4 3 5 3H16" stroke="currentColor" stroke-width="0.5" opacity="0.3"/>
        </svg>
        <svg v-else-if="tabType === 'enhance'" class="tab-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="0.5" opacity="0.6"/>
          <circle cx="12" cy="12" r="6" stroke="currentColor" stroke-width="0.5" opacity="0.4"/>
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="0.5" opacity="0.2"/>
        </svg>
        <svg v-else-if="tabType === 'build'" class="tab-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M4 8L12 4L20 8V16L12 20L4 16V8Z" stroke="currentColor" stroke-width="0.5" opacity="0.3"/>
          <path d="M12 4V20" stroke="currentColor" stroke-width="0.5" opacity="0.5"/>
          <path d="M4 8L12 12L20 8" stroke="currentColor" stroke-width="0.5" opacity="0.7"/>
        </svg>
        <svg v-else-if="tabType === 'deploy'" class="tab-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L12 9M12 9L15 6M12 9L9 6" stroke="currentColor" stroke-width="0.8" stroke-linecap="round" opacity="0.7"/>
          <circle cx="12" cy="16" r="6" stroke="currentColor" stroke-width="0.5" opacity="0.3"/>
          <circle cx="12" cy="16" r="2" fill="currentColor" opacity="0.6"/>
        </svg>
        <svg v-else-if="tabType === 'maintain'" class="tab-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 2V6M12 18V22M4 12H8M16 12H20" stroke="currentColor" stroke-width="0.5" opacity="0.3"/>
          <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="0.5" opacity="0.6"/>
          <path d="M12 10V12L14 14" stroke="currentColor" stroke-width="0.8" stroke-linecap="round" opacity="0.8"/>
        </svg>
        <svg v-else-if="tabType === 'daemon'" class="tab-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="1.5" fill="currentColor" opacity="0.8"/>
          <path d="M12 5V7M12 17V19M5 12H7M17 12H19" stroke="currentColor" stroke-width="0.8" stroke-linecap="round" opacity="0.6"/>
          <path d="M7.5 7.5L9 9M15 15L16.5 16.5M7.5 16.5L9 15M15 9L16.5 7.5" stroke="currentColor" stroke-width="0.5" stroke-linecap="round" opacity="0.3"/>
        </svg>
      </div>

      <div class="title-section">
        <h2 class="coming-soon-title">{{ title }}</h2>
        <p class="coming-soon-subtitle">{{ subtitle }}</p>
      </div>

      <!-- Feature preview with minimal, elegant hints -->
      <div class="feature-hints">
        <div
          v-for="(hint, index) in hints"
          :key="index"
          class="hint-item"
          :style="{ animationDelay: `${index * 0.1}s` }"
        >
          <span class="hint-indicator"></span>
          <span class="hint-text">{{ hint }}</span>
        </div>
      </div>

      <!-- Subtle status indicator -->
      <div class="status-container">
        <div class="status-line">
          <span class="status-progress"></span>
        </div>
        <p class="status-text">{{ statusText }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  tabType: string
}>()

const tabContent = {
  prompt: {
    title: "Context Intelligence",
    subtitle: "Comprehensive prompt generation from work items",
    hints: [
      "Work item context aggregation",
      "PR analysis & pattern matching",
      "Related changes synthesis"
    ],
    status: "Architecting context engine"
  },
  plan: {
    title: "Intelligent Design",
    subtitle: "Task decomposition and specification",
    hints: [
      "Comprehensive task generation",
      "File-by-file implementation guides",
      "Specification enhancement"
    ],
    status: "Refining design algorithms"
  },
  implement: {
    title: "Autonomous Implementation",
    subtitle: "Task-driven code generation",
    hints: [
      "Sequential task execution",
      "Partial change detection",
      "Smart completion analysis"
    ],
    status: "Building execution pipeline"
  },
  review: {
    title: "Intelligent Review",
    subtitle: "Automated PR monitoring & response",
    hints: [
      "Comment action automation",
      "Review agent suggestions",
      "PR context understanding"
    ],
    status: "Training review models"
  },
  validate: {
    title: "Self-Healing Validation",
    subtitle: "Deterministic testing with auto-fixes",
    hints: [
      "Specification compliance checks",
      "Automated issue resolution",
      "Build success verification"
    ],
    status: "Developing troubleshooting agent"
  },
  enhance: {
    title: "Code Evolution",
    subtitle: "Continuous improvement engine",
    hints: [
      "Pattern modernization",
      "Performance optimization",
      "Architecture refinement"
    ],
    status: "Designing enhancement algorithms"
  },
  build: {
    title: "Build Orchestration",
    subtitle: "Intelligent pipeline management",
    hints: [
      "Automatic failure recovery",
      "Pipeline rescheduling",
      "Success monitoring"
    ],
    status: "Creating build automation"
  },
  deploy: {
    title: "Zero-Touch Deployment",
    subtitle: "Automated release management",
    hints: [
      "Build-triggered deployments",
      "Log analysis & monitoring",
      "Success verification"
    ],
    status: "Engineering deployment agent"
  },
  maintain: {
    title: "Proactive Maintenance",
    subtitle: "Code health automation",
    hints: [
      "Safe refactoring",
      "Null reference prevention",
      "Pattern modernization"
    ],
    status: "Developing maintenance intelligence"
  },
  daemon: {
    title: "Background Intelligence",
    subtitle: "Continuous workflow automation",
    hints: [
      "Autonomous monitoring",
      "Event-driven actions",
      "Silent optimization"
    ],
    status: "Crafting daemon services"
  }
}

const title = computed(() => tabContent[props.tabType]?.title || "Coming Soon")
const subtitle = computed(() => tabContent[props.tabType]?.subtitle || "Under development")
const hints = computed(() => tabContent[props.tabType]?.hints || [])
const statusText = computed(() => tabContent[props.tabType]?.status || "In progress")
</script>

<style scoped>
.coming-soon-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  padding: 3rem 2rem;
  position: relative;
  overflow: hidden;
}

.coming-soon-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 1px;
  height: 100%;
  background: linear-gradient(
    180deg,
    transparent,
    var(--border-color, rgba(255, 255, 255, 0.05)) 20%,
    var(--border-color, rgba(255, 255, 255, 0.05)) 80%,
    transparent
  );
  opacity: 0.3;
}

.coming-soon-content {
  position: relative;
  text-align: center;
  max-width: 420px;
  z-index: 1;
}

.icon-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  margin-bottom: 2.5rem;
}

.icon-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
  background: radial-gradient(
    circle,
    var(--accent-color, #0066ff) 0%,
    transparent 70%
  );
  opacity: 0.1;
  border-radius: 50%;
  animation: breathe 4s ease-in-out infinite;
}

@keyframes breathe {
  0%, 100% {
    transform: translate(-50%, -50%) scale(0.8);
    opacity: 0.05;
  }
  50% {
    transform: translate(-50%, -50%) scale(1.2);
    opacity: 0.15;
  }
}

.tab-icon {
  color: var(--text-primary, #e0e0e0);
  width: 24px;
  height: 24px;
  z-index: 1;
  position: relative;
}

.title-section {
  margin-bottom: 2.5rem;
}

.coming-soon-title {
  font-size: 1.375rem;
  font-weight: 500;
  color: var(--text-primary, #e0e0e0);
  margin-bottom: 0.375rem;
  letter-spacing: -0.025em;
  line-height: 1.3;
}

.coming-soon-subtitle {
  font-size: 0.8125rem;
  color: var(--text-secondary, #666);
  font-weight: 400;
  opacity: 0.8;
}

.feature-hints {
  margin-bottom: 3rem;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  align-items: flex-start;
  max-width: 280px;
  margin-left: auto;
  margin-right: auto;
}

.hint-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  opacity: 0;
  animation: fadeInSlide 0.6s ease-out forwards;
}

@keyframes fadeInSlide {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.hint-indicator {
  width: 3px;
  height: 3px;
  background: var(--text-secondary, #666);
  border-radius: 50%;
  opacity: 0.4;
  flex-shrink: 0;
}

.hint-text {
  font-size: 0.75rem;
  color: var(--text-secondary, #666);
  font-weight: 400;
  letter-spacing: 0.01em;
  text-align: left;
  opacity: 0.7;
  line-height: 1.4;
}

.status-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.status-line {
  width: 120px;
  height: 1px;
  background: var(--border-color, #2a2a2a);
  position: relative;
  overflow: hidden;
}

.status-progress {
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    var(--text-secondary, #666),
    transparent
  );
  animation: scan 3s linear infinite;
}

@keyframes scan {
  0% {
    left: -100%;
  }
  100% {
    left: 100%;
  }
}

.status-text {
  font-size: 0.6875rem;
  color: var(--text-secondary, #666);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 500;
  opacity: 0.5;
}

/* Subtle hover effect */
.coming-soon-content:hover .icon-glow {
  animation-duration: 2s;
}

.coming-soon-content:hover .hint-text {
  opacity: 0.9;
}

.coming-soon-content:hover .status-progress {
  animation-duration: 2s;
}
</style>