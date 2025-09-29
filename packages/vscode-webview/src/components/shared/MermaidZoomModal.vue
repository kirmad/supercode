<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="isOpen"
        class="mermaid-zoom-modal"
        @keydown.escape="close"
        tabindex="-1"
      >
        <!-- Backdrop -->
        <div class="modal-backdrop" @click="close"></div>

        <!-- Modal Container -->
        <div class="modal-container">
          <!-- Header -->
          <div class="modal-header">
            <div class="header-left">
              <h3 class="modal-title">{{ title || 'Mermaid Diagram' }}</h3>
              <span class="zoom-level">{{ Math.round(scale * 100) }}%</span>
            </div>

            <!-- Controls -->
            <div class="modal-controls">
              <!-- Zoom Controls -->
              <div class="control-group zoom-controls">
                <button
                  @click="zoomOut"
                  class="control-btn"
                  :disabled="scale <= minScale"
                  title="Zoom Out (-)">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
                    <path d="M21 21L16.65 16.65" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <path d="M8 11H14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </button>

                <button
                  @click="resetZoom"
                  class="control-btn reset-btn"
                  title="Reset View (R)">
                  <span>{{ Math.round(scale * 100) }}%</span>
                </button>

                <button
                  @click="zoomIn"
                  class="control-btn"
                  :disabled="scale >= maxScale"
                  title="Zoom In (+)">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
                    <path d="M21 21L16.65 16.65" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <path d="M11 8V14M8 11H14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>

              <!-- View Controls -->
              <div class="control-group view-controls">
                <button
                  @click="fitToScreen"
                  class="control-btn"
                  title="Fit to Screen (F)">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </button>

                <button
                  @click="toggleFullscreen"
                  class="control-btn"
                  title="Fullscreen (Space)">
                  <svg v-if="!isFullscreen" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m0 8v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3m0-8V5a2 2 0 0 0-2-2h-3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                  <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </button>

                <button
                  @click="downloadSVG"
                  class="control-btn"
                  title="Download SVG (D)">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M21 15V19C21 20.1 20.1 21 19 21H5C3.9 21 3 20.1 3 19V15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <path d="M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </button>

                <button
                  @click="close"
                  class="control-btn close-btn"
                  title="Close (ESC)">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <!-- Canvas Container -->
          <div
            ref="canvasContainer"
            class="canvas-container"
            :class="{ 'is-dragging': isDragging, 'is-fullscreen': isFullscreen }"
            @mousedown="startDrag"
            @mousemove="onDrag"
            @mouseup="endDrag"
            @mouseleave="endDrag"
            @wheel.prevent="onWheel"
            @touchstart="onTouchStart"
            @touchmove="onTouchMove"
            @touchend="onTouchEnd"
          >
            <!-- Grid Background -->
            <div class="grid-background" v-if="showGrid"></div>

            <!-- SVG Container -->
            <div
              ref="svgContainer"
              class="svg-container"
              :style="transformStyle"
            >
              <div v-html="svgContent" class="mermaid-svg-wrapper"></div>
            </div>

            <!-- Mini Map -->
            <div v-if="showMiniMap" class="mini-map">
              <div class="mini-map-viewport" :style="miniMapViewportStyle"></div>
              <div class="mini-map-content" v-html="miniMapSvg"></div>
            </div>
          </div>

          <!-- Footer Info -->
          <div class="modal-footer">
            <div class="footer-left">
              <span class="hint">Scroll to zoom • Drag to pan • <kbd>Space</kbd> for fullscreen</span>
            </div>
            <div class="footer-right">
              <label class="toggle-option">
                <input type="checkbox" v-model="showGrid" />
                <span>Grid</span>
              </label>
              <label class="toggle-option">
                <input type="checkbox" v-model="showMiniMap" />
                <span>Mini Map</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'

interface Props {
  isOpen: boolean
  svgContent: string
  title?: string
}

const props = defineProps<Props>()
const emit = defineEmits(['close'])

// Refs
const canvasContainer = ref<HTMLElement | null>(null)
const svgContainer = ref<HTMLElement | null>(null)

// State
const scale = ref(1)
const translateX = ref(0)
const translateY = ref(0)
const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartY = ref(0)
const lastTranslateX = ref(0)
const lastTranslateY = ref(0)
const isFullscreen = ref(false)
const showGrid = ref(true)
const showMiniMap = ref(false)
const containerRect = ref<DOMRect | null>(null)
const svgRect = ref<DOMRect | null>(null)

// Touch state
const touches = ref<TouchList | null>(null)
const lastTouchDistance = ref(0)

// Constants
const minScale = 0.1
const maxScale = 5
const zoomStep = 0.25
const wheelZoomSpeed = 0.001

// Computed
const transformStyle = computed(() => ({
  transform: `translate(${translateX.value}px, ${translateY.value}px) scale(${scale.value})`,
  transformOrigin: 'center center'
}))

const miniMapSvg = computed(() => {
  // Create a smaller version of the SVG for the minimap
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = props.svgContent
  const svg = tempDiv.querySelector('svg')
  if (svg) {
    svg.setAttribute('width', '150')
    svg.setAttribute('height', '100')
  }
  return tempDiv.innerHTML
})

const miniMapViewportStyle = computed(() => {
  if (!containerRect.value || !svgRect.value) return {}

  const viewportWidth = (containerRect.value.width / (svgRect.value.width * scale.value)) * 100
  const viewportHeight = (containerRect.value.height / (svgRect.value.height * scale.value)) * 100
  const viewportX = (-translateX.value / (svgRect.value.width * scale.value)) * 100
  const viewportY = (-translateY.value / (svgRect.value.height * scale.value)) * 100

  return {
    width: `${Math.min(viewportWidth, 100)}%`,
    height: `${Math.min(viewportHeight, 100)}%`,
    left: `${Math.max(0, Math.min(100 - viewportWidth, viewportX))}%`,
    top: `${Math.max(0, Math.min(100 - viewportHeight, viewportY))}%`
  }
})

// Methods
function close() {
  emit('close')
}

function zoomIn() {
  setScale(Math.min(scale.value + zoomStep, maxScale))
}

function zoomOut() {
  setScale(Math.max(scale.value - zoomStep, minScale))
}

function resetZoom() {
  scale.value = 1
  translateX.value = 0
  translateY.value = 0
  centerDiagram()
}

function setScale(newScale: number, centerX?: number, centerY?: number) {
  if (!canvasContainer.value) return

  const rect = canvasContainer.value.getBoundingClientRect()
  const mouseX = centerX !== undefined ? centerX : rect.width / 2
  const mouseY = centerY !== undefined ? centerY : rect.height / 2

  // Calculate the point in the diagram space
  const pointX = (mouseX - rect.left - translateX.value) / scale.value
  const pointY = (mouseY - rect.top - translateY.value) / scale.value

  // Update scale
  scale.value = Math.max(minScale, Math.min(maxScale, newScale))

  // Adjust translation to keep the same point under the mouse
  translateX.value = mouseX - rect.left - pointX * scale.value
  translateY.value = mouseY - rect.top - pointY * scale.value
}

function fitToScreen() {
  if (!canvasContainer.value || !svgContainer.value) return

  const containerBounds = canvasContainer.value.getBoundingClientRect()
  const svg = svgContainer.value.querySelector('svg')

  if (!svg) return

  const svgWidth = svg.clientWidth || 800
  const svgHeight = svg.clientHeight || 600

  const scaleX = (containerBounds.width - 40) / svgWidth
  const scaleY = (containerBounds.height - 40) / svgHeight

  scale.value = Math.min(scaleX, scaleY, 1)
  centerDiagram()
}

function centerDiagram() {
  if (!canvasContainer.value || !svgContainer.value) return

  nextTick(() => {
    const containerBounds = canvasContainer.value!.getBoundingClientRect()
    const svg = svgContainer.value!.querySelector('svg')

    if (!svg) return

    const svgWidth = (svg.clientWidth || 800) * scale.value
    const svgHeight = (svg.clientHeight || 600) * scale.value

    translateX.value = (containerBounds.width - svgWidth) / 2
    translateY.value = (containerBounds.height - svgHeight) / 2
  })
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    canvasContainer.value?.requestFullscreen()
    isFullscreen.value = true
  } else {
    document.exitFullscreen()
    isFullscreen.value = false
  }
}

function downloadSVG() {
  const svg = svgContainer.value?.querySelector('svg')
  if (!svg) return

  const svgData = new XMLSerializer().serializeToString(svg)
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
  const svgUrl = URL.createObjectURL(svgBlob)

  const downloadLink = document.createElement('a')
  downloadLink.href = svgUrl
  downloadLink.download = `${props.title || 'mermaid-diagram'}.svg`
  document.body.appendChild(downloadLink)
  downloadLink.click()
  document.body.removeChild(downloadLink)
  URL.revokeObjectURL(svgUrl)
}

// Mouse events
function startDrag(event: MouseEvent) {
  if (event.button !== 0) return // Only left click

  isDragging.value = true
  dragStartX.value = event.clientX
  dragStartY.value = event.clientY
  lastTranslateX.value = translateX.value
  lastTranslateY.value = translateY.value

  event.preventDefault()
}

function onDrag(event: MouseEvent) {
  if (!isDragging.value) return

  const deltaX = event.clientX - dragStartX.value
  const deltaY = event.clientY - dragStartY.value

  translateX.value = lastTranslateX.value + deltaX
  translateY.value = lastTranslateY.value + deltaY
}

function endDrag() {
  isDragging.value = false
}

function onWheel(event: WheelEvent) {
  event.preventDefault()

  const rect = canvasContainer.value?.getBoundingClientRect()
  if (!rect) return

  const mouseX = event.clientX - rect.left
  const mouseY = event.clientY - rect.top

  const delta = -event.deltaY * wheelZoomSpeed
  const newScale = scale.value * (1 + delta)

  setScale(newScale, mouseX, mouseY)
}

// Touch events
function onTouchStart(event: TouchEvent) {
  touches.value = event.touches

  if (event.touches.length === 2) {
    const dx = event.touches[0].clientX - event.touches[1].clientX
    const dy = event.touches[0].clientY - event.touches[1].clientY
    lastTouchDistance.value = Math.sqrt(dx * dx + dy * dy)
  } else if (event.touches.length === 1) {
    isDragging.value = true
    dragStartX.value = event.touches[0].clientX
    dragStartY.value = event.touches[0].clientY
    lastTranslateX.value = translateX.value
    lastTranslateY.value = translateY.value
  }

  event.preventDefault()
}

function onTouchMove(event: TouchEvent) {
  if (event.touches.length === 2 && touches.value?.length === 2) {
    // Pinch zoom
    const dx = event.touches[0].clientX - event.touches[1].clientX
    const dy = event.touches[0].clientY - event.touches[1].clientY
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (lastTouchDistance.value > 0) {
      const delta = distance / lastTouchDistance.value
      const newScale = scale.value * delta

      const centerX = (event.touches[0].clientX + event.touches[1].clientX) / 2
      const centerY = (event.touches[0].clientY + event.touches[1].clientY) / 2

      setScale(newScale, centerX, centerY)
    }

    lastTouchDistance.value = distance
  } else if (event.touches.length === 1 && isDragging.value) {
    // Pan
    const deltaX = event.touches[0].clientX - dragStartX.value
    const deltaY = event.touches[0].clientY - dragStartY.value

    translateX.value = lastTranslateX.value + deltaX
    translateY.value = lastTranslateY.value + deltaY
  }

  event.preventDefault()
}

function onTouchEnd() {
  isDragging.value = false
  touches.value = null
  lastTouchDistance.value = 0
}

// Keyboard shortcuts
function handleKeyboard(event: KeyboardEvent) {
  if (!props.isOpen) return

  switch (event.key) {
    case '+':
    case '=':
      zoomIn()
      break
    case '-':
    case '_':
      zoomOut()
      break
    case 'r':
    case 'R':
      resetZoom()
      break
    case 'f':
    case 'F':
      fitToScreen()
      break
    case ' ':
      event.preventDefault()
      toggleFullscreen()
      break
    case 'd':
    case 'D':
      downloadSVG()
      break
    case 'Escape':
      close()
      break
  }
}

// Update container and SVG rects
function updateRects() {
  if (canvasContainer.value) {
    containerRect.value = canvasContainer.value.getBoundingClientRect()
  }
  if (svgContainer.value) {
    const svg = svgContainer.value.querySelector('svg')
    if (svg) {
      svgRect.value = svg.getBoundingClientRect()
    }
  }
}

// Lifecycle
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    nextTick(() => {
      updateRects()
      fitToScreen()
    })
  } else {
    // Reset state when closed
    scale.value = 1
    translateX.value = 0
    translateY.value = 0
    isFullscreen.value = false
  }
})

onMounted(() => {
  window.addEventListener('keydown', handleKeyboard)
  window.addEventListener('resize', updateRects)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyboard)
  window.removeEventListener('resize', updateRects)
})
</script>

<style scoped>
/* Modal Transitions */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .modal-container,
.modal-fade-leave-to .modal-container {
  transform: scale(0.95) translateY(10px);
}

/* Base Modal Structure */
.mermaid-zoom-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.modal-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(10px);
}

.modal-container {
  position: relative;
  width: 90vw;
  height: 85vh;
  max-width: 1400px;
  background: linear-gradient(135deg, #1a1a2e 0%, #0f0f1e 100%);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.5),
    0 0 100px rgba(139, 92, 246, 0.1),
    inset 0 0 100px rgba(139, 92, 246, 0.02);
  overflow: hidden;
  animation: modalSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes modalSlideIn {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Header */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(139, 92, 246, 0.1);
  backdrop-filter: blur(10px);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.modal-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #e2e8f0;
  background: linear-gradient(135deg, #e2e8f0, #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.zoom-level {
  padding: 0.25rem 0.625rem;
  background: rgba(139, 92, 246, 0.1);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #a78bfa;
  min-width: 3rem;
  text-align: center;
}

/* Controls */
.modal-controls {
  display: flex;
  gap: 1rem;
}

.control-group {
  display: flex;
  gap: 0.375rem;
  background: rgba(255, 255, 255, 0.02);
  padding: 0.25rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(139, 92, 246, 0.05);
  border: 1px solid rgba(139, 92, 246, 0.1);
  border-radius: 6px;
  color: #a78bfa;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.control-btn::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  background: radial-gradient(circle, rgba(139, 92, 246, 0.3), transparent);
  transform: translate(-50%, -50%);
  transition: width 0.3s ease, height 0.3s ease;
}

.control-btn:hover::before {
  width: 100%;
  height: 100%;
}

.control-btn:hover:not(:disabled) {
  background: rgba(139, 92, 246, 0.15);
  border-color: rgba(139, 92, 246, 0.3);
  transform: translateY(-1px);
  color: #c4b5fd;
}

.control-btn:active:not(:disabled) {
  transform: translateY(0);
  background: rgba(139, 92, 246, 0.2);
}

.control-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.control-btn.reset-btn {
  width: auto;
  padding: 0 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.control-btn.close-btn:hover {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
  color: #ef4444;
}

/* Canvas Container */
.canvas-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  cursor: grab;
  background: #0a0a0f;
  user-select: none;
}

.canvas-container.is-dragging {
  cursor: grabbing;
}

.canvas-container.is-fullscreen {
  height: 100vh !important;
}

/* Grid Background */
.grid-background {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image:
    linear-gradient(rgba(139, 92, 246, 0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(139, 92, 246, 0.03) 1px, transparent 1px);
  background-size: 50px 50px;
  pointer-events: none;
}

/* SVG Container */
.svg-container {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.1s ease-out;
  will-change: transform;
}

.mermaid-svg-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
}

.mermaid-svg-wrapper :deep(svg) {
  max-width: none !important;
  height: auto !important;
  filter: drop-shadow(0 10px 40px rgba(139, 92, 246, 0.1));
}

/* Mini Map */
.mini-map {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  width: 150px;
  height: 100px;
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 8px;
  overflow: hidden;
  pointer-events: none;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.mini-map-viewport {
  position: absolute;
  background: rgba(139, 92, 246, 0.2);
  border: 2px solid rgba(139, 92, 246, 0.5);
  border-radius: 2px;
  pointer-events: none;
  transition: all 0.1s ease-out;
}

.mini-map-content {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.3;
  transform: scale(0.15);
}

/* Footer */
.modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1.5rem;
  background: rgba(0, 0, 0, 0.3);
  border-top: 1px solid rgba(139, 92, 246, 0.1);
  backdrop-filter: blur(10px);
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.footer-right {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.hint {
  font-size: 0.75rem;
  color: #64748b;
  font-weight: 500;
}

.hint kbd {
  padding: 0.125rem 0.375rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.7rem;
  color: #94a3b8;
  margin: 0 0.25rem;
}

.toggle-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.8125rem;
  color: #94a3b8;
  transition: color 0.2s ease;
}

.toggle-option:hover {
  color: #a78bfa;
}

.toggle-option input[type="checkbox"] {
  width: 14px;
  height: 14px;
  accent-color: #8b5cf6;
  cursor: pointer;
}

/* Responsive */
@media (max-width: 768px) {
  .modal-container {
    width: 95vw;
    height: 90vh;
    border-radius: 12px;
  }

  .modal-header {
    padding: 0.75rem 1rem;
  }

  .modal-title {
    font-size: 1rem;
  }

  .control-btn {
    width: 28px;
    height: 28px;
  }

  .modal-footer {
    flex-direction: column;
    gap: 0.75rem;
    align-items: flex-start;
  }

  .footer-right {
    width: 100%;
    justify-content: flex-end;
  }
}

/* Dark scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
}

::-webkit-scrollbar-thumb {
  background: rgba(139, 92, 246, 0.3);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(139, 92, 246, 0.5);
}
</style>