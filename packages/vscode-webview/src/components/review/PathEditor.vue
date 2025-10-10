<template>
  <div class="path-editor" ref="pathEditorRef">
    <!-- Display Mode -->
    <div
      v-if="!isEditing"
      @click="startEditing"
      class="path-display"
      :title="'Click to edit path. Navigate to: ' + displayPath"
    >
      <Icon name="file-code" />
      <span class="path-text">{{ displayPath }}</span>
      <Icon name="edit" class="edit-icon" />
    </div>

    <!-- Edit Mode -->
    <div v-else class="path-edit-container">
      <div class="path-input-wrapper">
        <Icon name="file-code" />
        <input
          ref="pathInputRef"
          v-model="inputValue"
          @keydown="handleKeydown"
          @input="handleInput"
          @blur="handleBlur"
          class="path-input"
          :placeholder="'Type file path or name...'"
          autocomplete="off"
          spellcheck="false"
        />
        <div class="edit-controls">
          <button @click="applyNavigation" class="apply-btn" :disabled="!selectedFile" title="Navigate to file">
            <Icon name="arrow-right" />
          </button>
          <button @click="cancelEdit" class="cancel-btn" title="Cancel editing">
            <Icon name="x" />
          </button>
        </div>
      </div>

      <!-- Autocomplete Dropdown -->
      <div v-if="showDropdown && filteredFiles.length > 0" class="autocomplete-dropdown">
        <div class="dropdown-header">
          <span class="file-count">{{ filteredFiles.length }} file{{ filteredFiles.length !== 1 ? 's' : '' }}</span>
          <span class="hint">↑↓ to navigate, Enter to select, Esc to cancel</span>
        </div>
        <div class="file-list">
          <div
            v-for="(file, index) in filteredFiles.slice(0, maxResults)"
            :key="file.path || file.fileName"
            @click="selectFile(file)"
            @mouseenter="highlightedIndex = index"
            :class="[
              'file-item',
              {
                highlighted: highlightedIndex === index,
                current: isCurrentFile(file)
              }
            ]"
          >
            <div class="file-info">
              <Icon name="file-code" class="file-icon" />
              <div class="file-details">
                <div class="file-name">{{ getFileName(file) }}</div>
                <div class="file-path">{{ getFilePath(file) }}</div>
              </div>
            </div>
            <div class="file-meta">
              <span v-if="isCurrentFile(file)" class="current-badge">Current</span>
              <span class="file-type">{{ getFileExtension(file) }}</span>
            </div>
          </div>
        </div>
        <div v-if="filteredFiles.length > maxResults" class="dropdown-footer">
          <span class="more-results">+{{ filteredFiles.length - maxResults }} more files...</span>
        </div>
      </div>

      <!-- No Results -->
      <div v-else-if="showDropdown && inputValue && filteredFiles.length === 0" class="no-results">
        <Icon name="search" />
        <span>No files found matching "{{ inputValue }}"</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import type { DiffFile } from '../../services/ProjectWorkflowService'
import Icon from '../Icon.vue'

interface Props {
  currentFile: DiffFile | null
  files: DiffFile[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'file-select': [file: DiffFile]
}>()

// Refs
const pathEditorRef = ref<HTMLElement>()
const pathInputRef = ref<HTMLInputElement>()

// State
const isEditing = ref(false)
const inputValue = ref('')
const highlightedIndex = ref(0)
const showDropdown = ref(false)
const selectedFile = ref<DiffFile | null>(null)
const maxResults = 8

// Computed
const displayPath = computed(() => {
  if (!props.currentFile) return 'No file selected'
  return props.currentFile.path || props.currentFile.fileName || 'Unknown file'
})

const filteredFiles = computed(() => {
  if (!inputValue.value) return props.files

  const query = inputValue.value.toLowerCase()
  return props.files
    .map(file => {
      const filePath = file.path || file.fileName || ''
      const fileName = getFileName(file)

      // Calculate relevance score
      let score = 0

      // Exact matches get highest score
      if (fileName.toLowerCase() === query) score += 100
      else if (fileName.toLowerCase().includes(query)) score += 50
      else if (filePath.toLowerCase().includes(query)) score += 25

      // Bonus for matches at start of filename
      if (fileName.toLowerCase().startsWith(query)) score += 30

      // Bonus for matches after path separators
      const pathParts = filePath.split('/').pop() || ''
      if (pathParts.toLowerCase().startsWith(query)) score += 20

      return { file, score }
    })
    .filter(item => item.score > 0)
    .sort((a, b) => {
      // Sort by score descending, then alphabetically
      if (b.score !== a.score) return b.score - a.score
      return getFileName(a.file).localeCompare(getFileName(b.file))
    })
    .map(item => item.file)
})

// Utility functions
const getFileName = (file: DiffFile): string => {
  const fullPath = file.path || file.fileName || ''
  return fullPath.split('/').pop() || fullPath
}

const getFilePath = (file: DiffFile): string => {
  const fullPath = file.path || file.fileName || ''
  const parts = fullPath.split('/')
  return parts.length > 1 ? parts.slice(0, -1).join('/') + '/' : ''
}

const getFileExtension = (file: DiffFile): string => {
  const fileName = getFileName(file)
  const lastDot = fileName.lastIndexOf('.')
  return lastDot > 0 ? fileName.substring(lastDot + 1).toUpperCase() : ''
}

const isCurrentFile = (file: DiffFile): boolean => {
  if (!props.currentFile) return false
  const currentPath = props.currentFile.path || props.currentFile.fileName
  const filePath = file.path || file.fileName
  return currentPath === filePath
}

// Event handlers
const startEditing = async () => {
  isEditing.value = true
  showDropdown.value = true
  inputValue.value = displayPath.value
  highlightedIndex.value = 0

  await nextTick()
  pathInputRef.value?.focus()
  pathInputRef.value?.select()
}

const cancelEdit = () => {
  isEditing.value = false
  showDropdown.value = false
  inputValue.value = ''
  selectedFile.value = null
  highlightedIndex.value = 0
}

const applyNavigation = () => {
  if (selectedFile.value) {
    emit('file-select', selectedFile.value)
  }
  cancelEdit()
}

const selectFile = (file: DiffFile) => {
  selectedFile.value = file
  inputValue.value = file.path || file.fileName || ''
  applyNavigation()
}

const handleInput = () => {
  showDropdown.value = true
  highlightedIndex.value = 0

  // Update selected file based on exact matches
  const exactMatch = filteredFiles.value.find(file => {
    const filePath = file.path || file.fileName || ''
    return filePath.toLowerCase() === inputValue.value.toLowerCase()
  })

  selectedFile.value = exactMatch || (filteredFiles.value[0] || null)
}

const handleKeydown = (event: KeyboardEvent) => {
  switch (event.key) {
    case 'Escape':
      event.preventDefault()
      cancelEdit()
      break

    case 'Enter':
      event.preventDefault()
      if (filteredFiles.value[highlightedIndex.value]) {
        selectFile(filteredFiles.value[highlightedIndex.value])
      } else if (selectedFile.value) {
        applyNavigation()
      }
      break

    case 'ArrowDown':
      event.preventDefault()
      if (filteredFiles.value.length > 0) {
        highlightedIndex.value = Math.min(
          highlightedIndex.value + 1,
          Math.min(filteredFiles.value.length - 1, maxResults - 1)
        )
        updateSelectedFromHighlight()
      }
      break

    case 'ArrowUp':
      event.preventDefault()
      if (filteredFiles.value.length > 0) {
        highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0)
        updateSelectedFromHighlight()
      }
      break

    case 'Tab':
      event.preventDefault()
      if (filteredFiles.value[highlightedIndex.value]) {
        const file = filteredFiles.value[highlightedIndex.value]
        inputValue.value = file.path || file.fileName || ''
        selectedFile.value = file
      }
      break
  }
}

const updateSelectedFromHighlight = () => {
  if (filteredFiles.value[highlightedIndex.value]) {
    selectedFile.value = filteredFiles.value[highlightedIndex.value]
  }
}

const handleBlur = (event: FocusEvent) => {
  // Don't close if clicking on dropdown
  const target = event.relatedTarget as HTMLElement
  if (target && pathEditorRef.value?.contains(target)) {
    return
  }

  setTimeout(() => {
    if (!pathEditorRef.value?.contains(document.activeElement)) {
      cancelEdit()
    }
  }, 100)
}

// Lifecycle
onMounted(() => {
  document.addEventListener('click', handleOutsideClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleOutsideClick)
})

const handleOutsideClick = (event: MouseEvent) => {
  if (isEditing.value && !pathEditorRef.value?.contains(event.target as Node)) {
    cancelEdit()
  }
}
</script>

<style scoped>
.path-editor {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  z-index: 100;
}

.path-display {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s ease;
  background: transparent;
  border: 1px solid transparent;
  min-height: 2rem;
  flex: 1;
}

.path-display:hover {
  background: var(--glass-bg-hover);
  border-color: var(--border-subtle);
}

.path-text {
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.875rem;
  color: var(--text-primary);
  font-weight: 500;
}

.edit-icon {
  opacity: 0;
  transition: opacity 0.2s ease;
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.path-display:hover .edit-icon {
  opacity: 1;
}

.path-edit-container {
  width: 100%;
  flex: 1;
}

.path-input-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: var(--glass-bg);
  border: 2px solid var(--primary-color);
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.path-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.875rem;
  color: var(--text-primary);
  padding: 0.25rem 0;
}

.path-input::placeholder {
  color: var(--text-tertiary);
  font-style: italic;
}

.edit-controls {
  display: flex;
  gap: 0.25rem;
}

.apply-btn, .cancel-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.75rem;
}

.apply-btn {
  background: var(--success-color);
  color: white;
}

.apply-btn:hover:not(:disabled) {
  background: var(--success-color-dark);
  transform: scale(1.05);
}

.apply-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cancel-btn {
  background: var(--error-color);
  color: white;
}

.cancel-btn:hover {
  background: var(--error-color-dark);
  transform: scale(1.05);
}

.autocomplete-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 0.5rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  backdrop-filter: blur(12px);
  margin-top: 0.25rem;
  max-height: 24rem;
  overflow: hidden;
  z-index: 1000;
}

.dropdown-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--glass-bg-darker);
}

.file-count {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-primary);
}

.hint {
  font-size: 0.625rem;
  color: var(--text-tertiary);
  font-style: italic;
}

.file-list {
  max-height: 18rem;
  overflow-y: auto;
}

.file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  border-bottom: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: all 0.2s ease;
}

.file-item:last-child {
  border-bottom: none;
}

.file-item:hover,
.file-item.highlighted {
  background: var(--glass-bg-hover);
}

.file-item.current {
  background: var(--primary-alpha-10);
  border-left: 3px solid var(--primary-color);
}

.file-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  min-width: 0;
}

.file-icon {
  color: var(--primary-color);
  flex-shrink: 0;
}

.file-details {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
  font-family: 'Monaco', 'Courier New', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-path {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  font-family: 'Monaco', 'Courier New', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 0.125rem;
}

.file-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.current-badge {
  padding: 0.125rem 0.375rem;
  background: var(--primary-color);
  color: white;
  border-radius: 0.75rem;
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
}

.file-type {
  padding: 0.125rem 0.375rem;
  background: var(--glass-bg-darker);
  border: 1px solid var(--border-subtle);
  border-radius: 0.25rem;
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--text-secondary);
  min-width: 2rem;
  text-align: center;
}

.dropdown-footer {
  padding: 0.5rem 0.75rem;
  border-top: 1px solid var(--border-subtle);
  background: var(--glass-bg-darker);
  text-align: center;
}

.more-results {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  font-style: italic;
}

.no-results {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2rem;
  color: var(--text-tertiary);
  font-size: 0.875rem;
  font-style: italic;
}

/* Animations */
.autocomplete-dropdown {
  animation: dropdownSlide 0.2s ease-out;
}

@keyframes dropdownSlide {
  from {
    opacity: 0;
    transform: translateY(-0.5rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.file-item {
  animation: fadeInUp 0.1s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(0.25rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Scrollbar styling */
.file-list::-webkit-scrollbar {
  width: 6px;
}

.file-list::-webkit-scrollbar-track {
  background: var(--glass-bg);
}

.file-list::-webkit-scrollbar-thumb {
  background: var(--border-subtle);
  border-radius: 3px;
}

.file-list::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary);
}
</style>