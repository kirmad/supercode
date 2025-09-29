<template>
  <div class="mermaid-sanitizer-demo">
    <h2>Mermaid Sanitization Demo</h2>

    <div class="demo-section">
      <h3>Example: API Endpoint Diagram (Your Use Case)</h3>
      <p>This diagram contains special characters that require sanitization:</p>

      <div class="diagram-container">
        <div ref="apiDiagram" class="mermaid"></div>
      </div>

      <details>
        <summary>View Source</summary>
        <pre><code>{{ apiDiagramSource }}</code></pre>
      </details>
    </div>

    <div class="demo-section">
      <h3>Example: Complex System Architecture</h3>
      <p>Multiple nodes with paths and special characters:</p>

      <div class="diagram-container">
        <div ref="systemDiagram" class="mermaid"></div>
      </div>

      <details>
        <summary>View Source</summary>
        <pre><code>{{ systemDiagramSource }}</code></pre>
      </details>
    </div>

    <div class="status-panel">
      <h3>Sanitization Status</h3>
      <div v-if="loading" class="loading">Loading and sanitizing diagrams...</div>
      <div v-else-if="error" class="error">{{ error }}</div>
      <div v-else class="success">✅ All diagrams sanitized and rendered successfully!</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { loadMermaid, renderMermaidDiagram } from '../../utils/mermaid-loader'

const apiDiagram = ref<HTMLElement>()
const systemDiagram = ref<HTMLElement>()
const loading = ref(true)
const error = ref('')

// Diagram sources that will be automatically sanitized
const apiDiagramSource = `graph LR
    API[/review endpoints]
    DB[(Database)]
    Cache[Redis Cache]

    API -->|GET /api/reviews| DB
    API -->|cached data| Cache
    DB -->|query results| API`

const systemDiagramSource = `flowchart TD
    Frontend[/app/frontend]
    Backend[/api/backend]
    Auth[Auth Service]
    Storage[/data/storage]
    Queue[Message Queue]

    Frontend -->|HTTP /api/*| Backend
    Backend -->|validate| Auth
    Backend -->|store files| Storage
    Backend -->|publish events| Queue
    Queue -->|process jobs| Backend`

onMounted(async () => {
  try {
    console.log('[Demo] Starting mermaid diagram rendering with sanitization...')

    // Load mermaid if not already loaded
    await loadMermaid()

    // Render API diagram
    if (apiDiagram.value) {
      apiDiagram.value.textContent = apiDiagramSource
      await renderMermaidDiagram(apiDiagram.value, apiDiagramSource)
      console.log('[Demo] API diagram rendered successfully')
    }

    // Render System diagram
    if (systemDiagram.value) {
      systemDiagram.value.textContent = systemDiagramSource
      await renderMermaidDiagram(systemDiagram.value, systemDiagramSource)
      console.log('[Demo] System diagram rendered successfully')
    }

    loading.value = false
  } catch (err: any) {
    console.error('[Demo] Error rendering diagrams:', err)
    error.value = `Failed to render diagrams: ${err.message}`
    loading.value = false
  }
})
</script>

<style scoped>
.mermaid-sanitizer-demo {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

h2 {
  color: #8b5cf6;
  margin-bottom: 2rem;
  border-bottom: 2px solid #8b5cf6;
  padding-bottom: 0.5rem;
}

.demo-section {
  margin-bottom: 3rem;
  background: #1a1a1a;
  border-radius: 8px;
  padding: 1.5rem;
}

.demo-section h3 {
  color: #a78bfa;
  margin-bottom: 1rem;
}

.demo-section p {
  color: #9ca3af;
  margin-bottom: 1rem;
}

.diagram-container {
  background: #0f0f0f;
  border: 1px solid #374151;
  border-radius: 8px;
  padding: 2rem;
  margin-bottom: 1rem;
  min-height: 200px;
  display: flex;
  justify-content: center;
  align-items: center;
}

details {
  margin-top: 1rem;
  background: #111827;
  border-radius: 6px;
  padding: 0.5rem;
}

summary {
  cursor: pointer;
  color: #60a5fa;
  font-weight: 500;
  padding: 0.5rem;
}

summary:hover {
  color: #93c5fd;
}

details[open] summary {
  margin-bottom: 0.5rem;
  border-bottom: 1px solid #374151;
}

pre {
  margin: 0;
  padding: 1rem;
  overflow-x: auto;
  background: #0a0a0a;
  border-radius: 4px;
}

code {
  color: #d1d5db;
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 0.875rem;
}

.status-panel {
  background: linear-gradient(135deg, #1e1b4b, #312e81);
  border-radius: 8px;
  padding: 1.5rem;
  margin-top: 2rem;
}

.status-panel h3 {
  color: #c7d2fe;
  margin-bottom: 1rem;
}

.loading {
  color: #60a5fa;
  font-weight: 500;
  animation: pulse 2s infinite;
}

.error {
  color: #f87171;
  background: rgba(239, 68, 68, 0.1);
  padding: 0.75rem;
  border-radius: 4px;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.success {
  color: #4ade80;
  background: rgba(34, 197, 94, 0.1);
  padding: 0.75rem;
  border-radius: 4px;
  border: 1px solid rgba(34, 197, 94, 0.3);
  font-weight: 500;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* Ensure mermaid diagrams are visible */
.mermaid-rendered {
  width: 100%;
  height: auto;
}

.mermaid-rendered svg {
  max-width: 100%;
  height: auto;
}
</style>