<template>
  <div class="simple-mermaid-renderer">
    <h3>Simple Mermaid Test</h3>
    <div v-if="!mermaidLoaded" class="loading">Loading Mermaid...</div>
    <div v-else class="status">Mermaid loaded: {{ mermaidVersion }}</div>

    <div ref="containerRef" class="mermaid-container">
      <pre class="mermaid" id="test-diagram">
graph LR
    A[Vue Component] --> B[Load Mermaid]
    B --> C{Success?}
    C -->|Yes| D[Render Diagram]
    C -->|No| E[Show Error]
      </pre>
    </div>

    <button @click="renderDiagram">Render Diagram</button>
    <button v-if="diagramRendered" @click="openZoomModal" class="zoom-button">
      Open in Zoom Modal
    </button>
    <div v-if="error" class="error">{{ error }}</div>

    <!-- Mermaid Zoom Modal -->
    <MermaidZoomModal
      :isOpen="isModalOpen"
      :svgContent="svgContent"
      title="Simple Mermaid Test Diagram"
      @close="closeModal"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import MermaidZoomModal from './MermaidZoomModal.vue'

const mermaidLoaded = ref(false)
const mermaidVersion = ref('unknown')
const error = ref('')
const containerRef = ref<HTMLElement | null>(null)
const diagramRendered = ref(false)
const isModalOpen = ref(false)
const svgContent = ref('')

declare global {
  interface Window {
    mermaid: any
  }
}

onMounted(async () => {
  await loadMermaid()
})

async function loadMermaid() {
  console.log('[SimpleMermaid] Starting to load Mermaid...')

  try {
    // Check if already loaded
    if (window.mermaid) {
      console.log('[SimpleMermaid] Mermaid already loaded')
      mermaidLoaded.value = true
      mermaidVersion.value = window.mermaid.version || 'unknown'
      return
    }

    // Create script element
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js'

    await new Promise((resolve, reject) => {
      script.onload = () => {
        console.log('[SimpleMermaid] Script loaded successfully')
        resolve(true)
      }
      script.onerror = (e) => {
        console.error('[SimpleMermaid] Script failed to load', e)
        reject(e)
      }
      document.head.appendChild(script)
    })

    // Check if mermaid is available
    if (window.mermaid) {
      console.log('[SimpleMermaid] Mermaid object available, initializing...')

      window.mermaid.initialize({
        startOnLoad: false,
        theme: 'dark'
      })

      mermaidLoaded.value = true
      mermaidVersion.value = window.mermaid.version || 'unknown'
      console.log('[SimpleMermaid] Mermaid initialized, version:', mermaidVersion.value)
    } else {
      throw new Error('Mermaid object not available after script load')
    }
  } catch (e: any) {
    console.error('[SimpleMermaid] Error loading Mermaid:', e)
    error.value = `Failed to load Mermaid: ${e.message}`
  }
}

async function renderDiagram() {
  if (!window.mermaid || !containerRef.value) {
    error.value = 'Mermaid not loaded or container not found'
    return
  }

  try {
    console.log('[SimpleMermaid] Rendering diagram...')

    const mermaidEl = containerRef.value.querySelector('.mermaid')
    if (!mermaidEl) {
      error.value = 'No mermaid element found'
      return
    }

    const graphDef = mermaidEl.textContent || ''
    const id = 'rendered-' + Date.now()

    // Try to render
    const { svg } = await window.mermaid.render(id, graphDef)
    mermaidEl.innerHTML = svg
    console.log('[SimpleMermaid] Diagram rendered successfully')

    // Store the SVG content for the modal
    svgContent.value = svg
    diagramRendered.value = true
    error.value = ''
  } catch (e: any) {
    console.error('[SimpleMermaid] Error rendering diagram:', e)
    error.value = `Render error: ${e.message}`
  }
}

function openZoomModal() {
  isModalOpen.value = true
}

function closeModal() {
  isModalOpen.value = false
}
</script>

<style scoped>
.simple-mermaid-renderer {
  padding: 20px;
  background: #2a2a2a;
  border-radius: 8px;
  margin: 20px;
}

h3 {
  color: #8b5cf6;
  margin-bottom: 20px;
}

.loading {
  color: #3b82f6;
  padding: 10px;
  background: rgba(59, 130, 246, 0.1);
  border-radius: 4px;
  margin-bottom: 10px;
}

.status {
  color: #10b981;
  padding: 10px;
  background: rgba(16, 185, 129, 0.1);
  border-radius: 4px;
  margin-bottom: 10px;
}

.error {
  color: #ef4444;
  padding: 10px;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 4px;
  margin-top: 10px;
}

.mermaid-container {
  background: #1a1a1a;
  padding: 20px;
  border-radius: 8px;
  margin: 20px 0;
  min-height: 200px;
}

.mermaid {
  color: #fff;
}

button {
  background: #8b5cf6;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  margin-right: 10px;
  transition: all 0.2s ease;
}

button:hover {
  background: #7c3aed;
  transform: translateY(-1px);
}

.zoom-button {
  background: linear-gradient(135deg, #10b981, #059669);
  position: relative;
  overflow: hidden;
}

.zoom-button::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: width 0.5s, height 0.5s;
}

.zoom-button:hover::before {
  width: 300px;
  height: 300px;
}

.zoom-button:hover {
  background: linear-gradient(135deg, #059669, #047857);
  box-shadow: 0 4px 20px rgba(16, 185, 129, 0.3);
}
</style>