<template>
  <div id="app">
    <!-- Navigation bar (hide on both simple and workflow pages as they have their own headers) -->
    <nav v-if="showNavigation && $route.name !== 'workflow' && $route.name !== 'home' && $route.name !== 'simple'" class="app-navigation">
      <div class="nav-brand">
        <svg class="brand-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L4 7V17L12 22L20 17V7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        </svg>
        <span class="brand-text">SuperCode</span>
      </div>
      <div class="nav-links">
        <router-link to="/" class="nav-link" :class="{ active: $route.name === 'home' }">
          Simple
        </router-link>
        <router-link to="/workflow" class="nav-link" :class="{ active: $route.name === 'workflow' }">
          Workflow <span class="alpha-badge">alpha</span>
        </router-link>
      </div>
      <div class="nav-actions">
        <button class="nav-button" @click="toggleTheme">
          <svg v-if="isDarkTheme" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="4" stroke="currentColor" stroke-width="1.5"/>
            <path d="M10 2V4M10 16V18M18 10H16M4 10H2" stroke="currentColor" stroke-width="1.5"/>
            <path d="M15.6569 4.34315L14.2426 5.75736M5.75736 14.2426L4.34315 15.6569" stroke="currentColor" stroke-width="1.5"/>
            <path d="M15.6569 15.6569L14.2426 14.2426M5.75736 5.75736L4.34315 4.34315" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          <svg v-else width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M17 10C17 14 14 17 10 17C6 17 3 14 3 10C3 6 6 3 10 3C10.5 3 11 3.1 11 3.1C10 4 9 5.5 9 7C9 9.5 11.5 12 14 12C15.5 12 17 11 17.9 10C17.9 10 17 10 17 10Z" stroke="currentColor" stroke-width="1.5"/>
          </svg>
        </button>
      </div>
    </nav>

    <!-- Main router view -->
    <router-view v-slot="{ Component }">
      <keep-alive>
        <component :is="Component" />
      </keep-alive>
    </router-view>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'

const $route = useRoute()

// Check if we're in VSCode or standalone mode
const isVSCode = ref(typeof (window as any).acquireVsCodeApi !== 'undefined')
const showNavigation = computed(() => !isVSCode.value)

// Theme management
const isDarkTheme = ref(true)

const toggleTheme = () => {
  isDarkTheme.value = !isDarkTheme.value
  document.documentElement.setAttribute('data-theme', isDarkTheme.value ? 'dark' : 'light')
}

// Initialize theme
onMounted(() => {
  // Check for saved theme preference or default to dark
  const savedTheme = localStorage.getItem('supercode-theme') || 'dark'
  isDarkTheme.value = savedTheme === 'dark'
  document.documentElement.setAttribute('data-theme', savedTheme)
})

// Save theme preference - removed as unused

// Watch theme changes
onMounted(() => {
  document.documentElement.setAttribute('data-theme', isDarkTheme.value ? 'dark' : 'light')
})
</script>

<style>
/* Global styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  height: 100%;
  margin: 0;
  padding: 0;
}

#app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* CSS Variables for theming */
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --text-primary: #1a1a1a;
  --text-secondary: #666666;
  --border-color: #e0e0e0;
  --accent-color: #0066ff;
  --accent-hover: #0052cc;
}

[data-theme="dark"] {
  --bg-primary: #0a0a0a;
  --bg-secondary: #1a1a1a;
  --text-primary: #e0e0e0;
  --text-secondary: #999999;
  --border-color: #2a2a2a;
  --accent-color: #0066ff;
  --accent-hover: #0052cc;
}

body {
  background: var(--bg-primary);
  color: var(--text-primary);
}

/* Navigation styles */
.app-navigation {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.5rem;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  font-size: 1.125rem;
}

.brand-icon {
  color: var(--accent-color);
}

.brand-text {
  color: var(--text-primary);
}

.nav-links {
  display: flex;
  gap: 1rem;
}

.nav-link {
  padding: 0.5rem 1rem;
  color: var(--text-secondary);
  text-decoration: none;
  border-radius: 0.375rem;
  transition: all 0.2s;
}

.nav-link:hover {
  color: var(--text-primary);
  background: var(--bg-primary);
}

.nav-link.active {
  color: var(--text-primary);
  background: var(--bg-primary);
  font-weight: 500;
}

/* Alpha badge styling */
.alpha-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  height: 16px;
  margin-left: 6px;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  background: linear-gradient(135deg, #ff6b35, #ff8c42);
  color: white;
  border-radius: 3px;
  vertical-align: middle;
  letter-spacing: 0.5px;
  box-shadow: 0 1px 3px rgba(255, 107, 53, 0.3);
  animation: pulse-glow 2s infinite;
  position: relative;
  top: -1px;
}

@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 1px 3px rgba(255, 107, 53, 0.3);
  }
  50% {
    box-shadow: 0 1px 6px rgba(255, 107, 53, 0.5), 0 0 10px rgba(255, 107, 53, 0.2);
  }
}

.nav-link.active .alpha-badge {
  background: linear-gradient(135deg, #ff4500, #ff6347);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2);
  animation: none;
}

.nav-actions {
  display: flex;
  gap: 0.5rem;
}

.nav-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}

.nav-button:hover {
  color: var(--text-primary);
  border-color: var(--accent-color);
  background: var(--bg-primary);
}

/* Router view container */
.router-view {
  flex: 1;
  overflow: auto;
}

/* Utility classes */
.hidden {
  display: none !important;
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--bg-secondary);
}

::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}
</style>