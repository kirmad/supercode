<template>
  <div class="diff-viewer">
    <!-- File Tabs -->
    <div v-if="files.length > 1" class="file-tabs">
      <button
        v-for="(file, index) in files"
        :key="index"
        :class="['file-tab', { active: selectedFileIndex === index }]"
        @click="selectedFileIndex = index"
      >
        <Icon name="file-code" :size="14" />
        <span class="file-name">{{ getFileName(file.path) }}</span>
        <span v-if="file.additions || file.deletions" class="file-stats">
          <span class="additions">+{{ file.additions || 0 }}</span>
          <span class="deletions">-{{ file.deletions || 0 }}</span>
        </span>
      </button>
    </div>

    <!-- Diff Content -->
    <div class="diff-container" :class="[`view-${viewMode}`]">
      <!-- Unified View -->
      <div v-if="viewMode === 'unified' && currentFile" class="unified-view">
        <div class="file-header">
          <Icon name="file-code" />
          {{ currentFile.path }}
        </div>

        <div class="diff-lines">
          <template v-for="(line, index) in processedLines" :key="index">
            <!-- Hunk Description (shown before the hunk starts) -->
            <div
              v-if="isHunkStart(line.newNumber || line.oldNumber || 0)"
              class="hunk-description"
            >
              <div
                class="hunk-header collapsible"
                @click="toggleHunk(getHunkId(getHunkForLine(line.newNumber || line.oldNumber || 0)))"
              >
                <Icon
                  :name="isHunkCollapsed(getHunkForLine(line.newNumber || line.oldNumber || 0)) ? 'chevron-right' : 'chevron-down'"
                  class="collapse-icon"
                  :size="14"
                />
                <Icon name="git-branch" :size="14" />
                <span class="hunk-category">{{ getHunkForLine(line.newNumber || line.oldNumber || 0)?.category }}</span>
                <span class="hunk-risk" :class="`risk-${getHunkForLine(line.newNumber || line.oldNumber || 0)?.risk}`">
                  {{ getHunkForLine(line.newNumber || line.oldNumber || 0)?.risk }} risk
                </span>
                <span v-if="getHunkForLine(line.newNumber || line.oldNumber || 0)?.needsAttention" class="needs-attention">
                  <Icon name="alert-circle" :size="12" />
                  Needs Attention
                </span>
              </div>
              <div
                v-show="!isHunkCollapsed(getHunkForLine(line.newNumber || line.oldNumber || 0))"
                class="hunk-description-text"
              >
                {{ getHunkForLine(line.newNumber || line.oldNumber || 0)?.description }}
              </div>
            </div>

            <!-- Diff Line -->
            <div
              :class="['diff-line', line.type]"
              :data-file="currentFile.path"
              :data-line="line.newNumber || line.oldNumber"
            >
              <!-- Line Numbers -->
              <span class="line-number old">{{ line.oldNumber || '' }}</span>
              <span class="line-number new">{{ line.newNumber || '' }}</span>

              <!-- Line Content -->
              <div class="line-content">
                <span v-if="line.type === 'added'" class="diff-indicator">+</span>
                <span v-else-if="line.type === 'removed'" class="diff-indicator">-</span>
                <span v-else class="diff-indicator"> </span>

                <code v-html="highlightSyntax(line.content, currentFile.path)"></code>

                <!-- Inline Comments (only on first line) -->
                <button
                  v-if="hasComment(line.newNumber || line.oldNumber)"
                  :class="['comment-indicator', getCommentTypeClass(line.newNumber || line.oldNumber)]"
                  @click="toggleComment(line.newNumber || line.oldNumber)"
                >
                  <Icon :name="getCommentTypeIcon(line.newNumber || line.oldNumber)" :size="14" />
                  <span class="comment-count">{{ getCommentCount(line.newNumber || line.oldNumber) }}</span>
                </button>
              </div>

              <!-- Expandable Comment -->
              <transition name="slide-down">
                <div
                  v-if="expandedComments[line.newNumber || line.oldNumber]"
                  class="inline-comment-container"
                >
                  <CommentCard
                    v-for="comment in getLineComments(line.newNumber || line.oldNumber)"
                    :key="`${comment.file}-${comment.lines.start}`"
                    :comment="comment"
                    :inline="true"
                    @apply-fix="$emit('apply-fix', comment)"
                  />
                </div>
              </transition>
            </div>
          </template>
        </div>
      </div>

      <!-- Split View -->
      <div v-else-if="viewMode === 'split' && currentFile" class="split-view">
        <div class="file-header">
          <Icon name="file-code" />
          {{ currentFile.path }}
        </div>

        <div class="split-container">
          <!-- Old Version -->
          <div class="split-pane old-pane">
            <div class="pane-header">Original</div>
            <div class="diff-lines">
              <div
                v-for="(line, index) in splitLines.old"
                :key="`old-${index}`"
                :class="['diff-line', line.type]"
              >
                <span class="line-number">{{ line.number || '' }}</span>
                <div class="line-content">
                  <code v-html="highlightSyntax(line.content, currentFile.path)"></code>
                </div>
              </div>
            </div>
          </div>

          <!-- New Version -->
          <div class="split-pane new-pane">
            <div class="pane-header">Modified</div>
            <div class="diff-lines">
              <div
                v-for="(line, index) in splitLines.new"
                :key="`new-${index}`"
                :class="['diff-line', line.type]"
                :data-file="currentFile.path"
                :data-line="line.number"
              >
                <span class="line-number">{{ line.number || '' }}</span>
                <div class="line-content">
                  <code v-html="highlightSyntax(line.content, currentFile.path)"></code>

                  <!-- Comments in split view -->
                  <button
                    v-if="hasComment(line.number)"
                    :class="['comment-indicator', getCommentTypeClass(line.number)]"
                    @click="toggleComment(line.number)"
                  >
                    <Icon :name="getCommentTypeIcon(line.number)" :size="14" />
                  </button>
                </div>

                <!-- Expandable Comment -->
                <transition name="slide-down">
                  <div
                    v-if="expandedComments[line.number]"
                    class="inline-comment-container"
                  >
                    <CommentCard
                      v-for="comment in getLineComments(line.number)"
                      :key="`${comment.file}-${comment.lines.start}`"
                      :comment="comment"
                      :inline="true"
                      @apply-fix="$emit('apply-fix', comment)"
                    />
                  </div>
                </transition>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-diff">
        <Icon name="file-x" :size="48" />
        <p>No diff data available</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import Icon from '../Icon.vue'
import CommentCard from './CommentCard.vue'
import type { DiffFile, Comment, Hunk } from '../../services/CodeReviewService'

interface Props {
  files: DiffFile[]
  comments: Comment[]
  hunks: Hunk[]
  viewMode: 'unified' | 'split'
}

interface ProcessedLine {
  type: 'unchanged' | 'added' | 'removed'
  oldNumber?: number
  newNumber?: number
  content: string
}

interface SplitLines {
  old: Array<{ type: string; number?: number; content: string }>
  new: Array<{ type: string; number?: number; content: string }>
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'comment-click': [comment: Comment]
  'apply-fix': [comment: Comment]
}>()

const selectedFileIndex = ref(0)
const expandedComments = ref<Record<number, boolean>>({})
const collapsedHunks = ref<Record<string, boolean>>({})

const currentFile = computed(() => props.files[selectedFileIndex.value])

const processedLines = computed((): ProcessedLine[] => {
  if (!currentFile.value) return []

  const lines: ProcessedLine[] = []
  const file = currentFile.value

  // Process diff/patches to create line array
  if (file.patches) {
    for (const patch of file.patches) {
      let oldLine = patch.oldStart
      let newLine = patch.newStart

      for (const line of patch.lines) {
        // Skip empty lines that shouldn't be in the diff
        if (!line || line.length === 0) continue

        if (line.startsWith('+')) {
          lines.push({
            type: 'added',
            newNumber: newLine++,
            content: line.substring(1)
          })
        } else if (line.startsWith('-')) {
          lines.push({
            type: 'removed',
            oldNumber: oldLine++,
            content: line.substring(1)
          })
        } else if (line.startsWith(' ')) {
          // Context lines in patches start with a space
          lines.push({
            type: 'unchanged',
            oldNumber: oldLine++,
            newNumber: newLine++,
            content: line.substring(1)
          })
        } else {
          // If no prefix, treat as unchanged but keep the content as-is
          lines.push({
            type: 'unchanged',
            oldNumber: oldLine++,
            newNumber: newLine++,
            content: line
          })
        }
      }
    }
  } else if (file.diff) {
    // Parse unified diff format
    const diffLines = file.diff.split('\n')
    let oldLine = 1
    let newLine = 1
    let inHeader = true

    for (const line of diffLines) {
      if (line.startsWith('@@')) {
        // Parse hunk header
        inHeader = false
        const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
        if (match) {
          oldLine = parseInt(match[1])
          newLine = parseInt(match[2])
        }
      } else if (inHeader) {
        // Skip header lines (diff --git, index, ---, +++, etc.)
        continue
      } else if (line.startsWith('+')) {
        lines.push({
          type: 'added',
          newNumber: newLine++,
          content: line.substring(1)
        })
      } else if (line.startsWith('-')) {
        lines.push({
          type: 'removed',
          oldNumber: oldLine++,
          content: line.substring(1)
        })
      } else if (line.startsWith(' ')) {
        // Context lines in unified diff start with a space
        lines.push({
          type: 'unchanged',
          oldNumber: oldLine++,
          newNumber: newLine++,
          content: line.substring(1)
        })
      } else if (!line.startsWith('\\')) {
        // Handle lines without prefix (shouldn't happen in valid diff, but just in case)
        lines.push({
          type: 'unchanged',
          oldNumber: oldLine++,
          newNumber: newLine++,
          content: line
        })
      }
    }
  }

  return lines
})

const splitLines = computed((): SplitLines => {
  const oldLines: Array<{ type: string; number?: number; content: string }> = []
  const newLines: Array<{ type: string; number?: number; content: string }> = []

  for (const line of processedLines.value) {
    if (line.type === 'removed' || line.type === 'unchanged') {
      oldLines.push({
        type: line.type,
        number: line.oldNumber,
        content: line.content
      })
    } else {
      oldLines.push({ type: 'placeholder', content: '' })
    }

    if (line.type === 'added' || line.type === 'unchanged') {
      newLines.push({
        type: line.type,
        number: line.newNumber,
        content: line.content
      })
    } else {
      newLines.push({ type: 'placeholder', content: '' })
    }
  }

  return { old: oldLines, new: newLines }
})

function getFileName(path: string): string {
  return path.split('/').pop() || path
}

function hasComment(lineNumber: number): boolean {
  if (!currentFile.value) return false
  // Only show comment indicator on the first line of the comment range
  return props.comments.some(c =>
    c.file === currentFile.value.path &&
    lineNumber === c.lines.start // Changed from >= start && <= end
  )
}

function getLineComments(lineNumber: number): Comment[] {
  if (!currentFile.value) return []
  // Get comments that start at this line
  return props.comments.filter(c =>
    c.file === currentFile.value.path &&
    lineNumber === c.lines.start // Only get comments that start at this line
  )
}

function getCommentTypeIcon(lineNumber: number): string {
  const comments = getLineComments(lineNumber)
  if (comments.length === 0) return 'message-square'

  // Return icon based on the first comment's type
  const type = comments[0].type
  const icons: Record<string, string> = {
    issue: 'alert-triangle',
    bug: 'bug',
    error: 'x-circle',
    warning: 'alert-circle',
    suggestion: 'lightbulb',
    improvement: 'trending-up',
    refactor: 'refresh-cw',
    praise: 'thumbs-up',
    performance: 'zap',
    security: 'shield',
    style: 'palette',
    documentation: 'file-text',
    test: 'check-square',
    question: 'help-circle',
    note: 'message-circle',
    todo: 'clock'
  }
  return icons[type] || 'message-square'
}

function getCommentTypeClass(lineNumber: number): string {
  const comments = getLineComments(lineNumber)
  if (comments.length === 0) return ''

  // Return class based on the first comment's type
  return `comment-type-${comments[0].type}`
}

function getCommentCount(lineNumber: number): number {
  return getLineComments(lineNumber).length
}

function toggleComment(lineNumber: number) {
  expandedComments.value[lineNumber] = !expandedComments.value[lineNumber]
}

function toggleHunk(hunkId: string) {
  collapsedHunks.value[hunkId] = !collapsedHunks.value[hunkId]
}

function getHunkId(hunk: Hunk | undefined): string {
  if (!hunk) return ''
  return `${hunk.file}-${hunk.start}`
}

function isHunkCollapsed(hunk: Hunk | undefined): boolean {
  if (!hunk) return false
  return collapsedHunks.value[getHunkId(hunk)] || false
}

// Method to select a file by path
function selectFile(filePath: string): boolean {
  const index = props.files.findIndex(f => f.path === filePath)
  if (index !== -1) {
    selectedFileIndex.value = index
    return true
  }
  return false
}

// Expose the selectFile method to parent components
defineExpose({
  selectFile
})

// Hunk-related functions
function isHunkStart(lineNumber: number): boolean {
  if (!currentFile.value) return false
  return props.hunks.some(h =>
    h.file === currentFile.value.path &&
    h.start === lineNumber
  )
}

function getHunkForLine(lineNumber: number): Hunk | undefined {
  if (!currentFile.value) return undefined
  return props.hunks.find(h =>
    h.file === currentFile.value.path &&
    h.start === lineNumber
  )
}

function highlightSyntax(code: string, filepath: string): string {
  // For now, just escape HTML and return plain text to avoid rendering issues
  // TODO: Fix syntax highlighting to properly handle all cases

  // Escape HTML to prevent XSS and display issues
  return code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Watch for file changes
watch(() => props.files, () => {
  selectedFileIndex.value = 0
  expandedComments.value = {}
})
</script>

<style scoped>
.diff-viewer {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--glass-bg);
  border-radius: 0.75rem;
  overflow: hidden;
}

/* File Tabs */
.file-tabs {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--glass-bg-darker);
  border-bottom: 1px solid var(--border-subtle);
  overflow-x: auto;
}

.file-tab {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
}

.file-tab:hover {
  background: var(--glass-bg);
  border-color: var(--border-subtle);
}

.file-tab.active {
  background: var(--primary-gradient);
  color: white;
  border-color: transparent;
}

.file-name {
  font-family: 'Monaco', 'Courier New', monospace;
}

.file-stats {
  display: flex;
  gap: 0.25rem;
  font-size: 0.625rem;
}

.additions {
  color: var(--success-color);
}

.deletions {
  color: var(--error-color);
}

/* Diff Container */
.diff-container {
  flex: 1;
  overflow: auto;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.75rem;
}

.file-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--glass-bg-darker);
  border-bottom: 1px solid var(--border-subtle);
  font-size: 0.875rem;
  color: var(--text-primary);
  font-weight: 500;
}

/* Unified View */
.unified-view {
  display: flex;
  flex-direction: column;
}

.diff-lines {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.diff-line {
  display: grid;
  grid-template-columns: 40px 40px 1fr;
  transition: background 0.2s ease;
  position: relative;
}

.diff-line:hover {
  background: var(--glass-bg-hover);
}

.line-number {
  padding: 0.25rem 0.5rem;
  text-align: right;
  color: var(--text-tertiary);
  background: var(--glass-bg-darker);
  border-right: 1px solid var(--border-subtle);
  user-select: none;
  font-size: 0.625rem;
}

.line-content {
  padding: 0.25rem 1rem;
  position: relative;
  white-space: pre-wrap;
  word-break: break-word;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.diff-indicator {
  display: inline-block;
  width: 1ch;
  margin-right: 0.5rem;
  text-align: center;
  font-weight: 600;
  flex-shrink: 0;
}

code {
  flex: 1;
  overflow-wrap: break-word;
}

.diff-line.added {
  background: var(--success-alpha-5, rgba(34, 197, 94, 0.05));
}

.diff-line.added .diff-indicator {
  color: var(--success-color, #22c55e);
}

.diff-line.removed {
  background: var(--error-alpha-5, rgba(239, 68, 68, 0.05));
}

.diff-line.removed .diff-indicator {
  color: var(--error-color, #ef4444);
}

.diff-line.unchanged {
  background: transparent;
}

/* Comment Indicator */
.comment-indicator {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: var(--warning-bg, rgba(251, 191, 36, 0.1));
  border: 1px solid var(--warning-color, #fbbf24);
  border-radius: 1rem;
  font-size: 0.625rem;
  color: var(--warning-color, #fbbf24);
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.comment-indicator:hover {
  background: var(--warning-color, #fbbf24);
  color: white;
  transform: scale(1.05);
}

.comment-count {
  font-weight: 600;
}

/* Type-specific comment indicator colors */
.comment-type-issue {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
}

.comment-type-bug {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
}

.comment-type-error {
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  color: white;
}

.comment-type-warning {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: white;
}

.comment-type-suggestion {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
}

.comment-type-improvement {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
}

.comment-type-refactor {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  color: white;
}

.comment-type-praise {
  background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
  color: white;
}

.comment-type-performance {
  background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%);
  color: white;
}

.comment-type-security {
  background: linear-gradient(135deg, #ec4899 0%, #db2777 100%);
  color: white;
}

.comment-type-style {
  background: linear-gradient(135deg, #a78bfa 0%, #9333ea 100%);
  color: white;
}

.comment-type-documentation {
  background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
  color: white;
}

.comment-type-test {
  background: linear-gradient(135deg, #34d399 0%, #10b981 100%);
  color: white;
}

.comment-type-question {
  background: linear-gradient(135deg, #818cf8 0%, #6366f1 100%);
  color: white;
}

.comment-type-note {
  background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%);
  color: white;
}

.comment-type-todo {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  color: white;
}

.inline-comment-container {
  grid-column: 1 / -1;
  background: var(--glass-bg-darker);
  border-left: 3px solid var(--warning-color);
  padding: 0.75rem 1rem;
  margin-top: 0.5rem;
}

/* Hunk Description Styles */
.hunk-description {
  grid-column: 1 / -1;
  background: linear-gradient(135deg,
    rgba(155, 135, 245, 0.05) 0%,
    rgba(155, 135, 245, 0.02) 100%);
  border: 1px solid rgba(155, 135, 245, 0.2);
  border-left: 3px solid var(--primary-color);
  padding: 0.75rem 1rem;
  margin: 0.5rem 0;
  border-radius: 4px;
}

.hunk-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  font-size: 0.85rem;
}

.hunk-header.collapsible {
  cursor: pointer;
  user-select: none;
  transition: opacity 0.2s ease;
}

.hunk-header.collapsible:hover {
  opacity: 0.8;
}

.hunk-header .collapse-icon {
  transition: transform 0.3s ease;
  flex-shrink: 0;
}

.hunk-category {
  background: rgba(155, 135, 245, 0.2);
  color: var(--primary-color);
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 500;
  text-transform: capitalize;
}

.hunk-risk {
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 500;
  text-transform: capitalize;
}

.hunk-risk.risk-low {
  background: rgba(34, 197, 94, 0.1);
  color: var(--success-color);
}

.hunk-risk.risk-medium {
  background: rgba(251, 191, 36, 0.1);
  color: var(--warning-color);
}

.hunk-risk.risk-high {
  background: rgba(239, 68, 68, 0.1);
  color: var(--error-color);
}

.needs-attention {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(239, 68, 68, 0.1);
  color: var(--error-color);
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 500;
}

.hunk-description-text {
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.5;
}

/* Split View */
.split-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.split-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  background: var(--border-subtle);
  flex: 1;
  overflow: hidden;
}

.split-pane {
  background: var(--glass-bg);
  overflow-x: auto;
  overflow-y: auto;
}

.pane-header {
  padding: 0.5rem 1rem;
  background: var(--glass-bg-darker);
  border-bottom: 1px solid var(--border-subtle);
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: uppercase;
  position: sticky;
  top: 0;
  z-index: 1;
}

.old-pane {
  border-right: 1px solid var(--border-subtle);
}

.split-pane .diff-lines {
  display: block;
}

.split-pane .diff-line {
  display: flex;
  align-items: stretch;
  min-height: 1.5rem;
}

.split-pane .line-number {
  display: block;
  width: 40px;
  padding: 0.25rem 0.5rem;
}

.split-pane .line-content {
  display: block;
  flex: 1;
  padding: 0.25rem 0.5rem;
}

.split-pane .diff-line.placeholder {
  background: var(--glass-bg-darker);
  opacity: 0.5;
}

/* Empty State */
.empty-diff {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 3rem;
  color: var(--text-tertiary);
  opacity: 0.5;
}

/* Syntax Highlighting */
code :deep(.keyword) {
  color: var(--syntax-keyword);
  font-weight: 600;
}

code :deep(.string) {
  color: var(--syntax-string);
}

code :deep(.comment) {
  color: var(--syntax-comment);
  font-style: italic;
}

code :deep(.selector) {
  color: var(--syntax-selector);
}

code :deep(.property) {
  color: var(--syntax-property);
}

code :deep(.value) {
  color: var(--syntax-value);
}

code :deep(.tag) {
  color: var(--syntax-tag);
}

code :deep(.attribute) {
  color: var(--syntax-attribute);
}

code :deep(.key) {
  color: var(--syntax-key);
}

/* Scrollbar */
.diff-container::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.diff-container::-webkit-scrollbar-track {
  background: var(--glass-bg-darker);
}

.diff-container::-webkit-scrollbar-thumb {
  background: var(--border-subtle);
  border-radius: 4px;
}

.diff-container::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary);
}

/* Animations */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Responsive */
@media (max-width: 768px) {
  .split-container {
    grid-template-columns: 1fr;
  }

  .old-pane {
    display: none;
  }

  .pane-header {
    display: none;
  }
}

/* CSS Variables for Syntax Colors */
:root {
  --syntax-keyword: #569cd6;
  --syntax-string: #ce9178;
  --syntax-comment: #6a9955;
  --syntax-selector: #d7ba7d;
  --syntax-property: #9cdcfe;
  --syntax-value: #ce9178;
  --syntax-tag: #569cd6;
  --syntax-attribute: #9cdcfe;
  --syntax-key: #9cdcfe;
}
</style>