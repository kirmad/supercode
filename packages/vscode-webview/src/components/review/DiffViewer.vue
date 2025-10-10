<template>
  <div class="diff-viewer">
    <!-- Sidebar Layout -->
    <div v-if="files.length > 0" class="diff-layout">
      <!-- File Tree Sidebar -->
      <div :class="['file-sidebar', { collapsed: fileTreeCollapsed }]">
        <div class="sidebar-header">
          <div class="sidebar-title">
            <FolderOpen :size="16" />
            <span v-if="!fileTreeCollapsed">Files</span>
          </div>
          <button
            @click.stop="fileTreeCollapsed = !fileTreeCollapsed"
            class="sidebar-toggle"
            :title="fileTreeCollapsed ? 'Expand file tree' : 'Collapse file tree'"
          >
            <ChevronRight v-if="fileTreeCollapsed" :size="16" />
            <ChevronLeft v-else :size="16" />
          </button>
        </div>
        <div v-if="!fileTreeCollapsed" class="sidebar-content">
          <!-- Content Mode Selector -->
          <div class="content-mode-selector">
            <div class="mode-buttons">
              <button
                @click.stop="$emit('update:contentMode', 'diff')"
                :class="['mode-button', { active: contentMode === 'diff' }]"
              >
                <Icon name="git-compare" :size="12" />
                Diff
              </button>
              <button
                @click.stop="$emit('update:contentMode', 'local')"
                :class="['mode-button', { active: contentMode === 'local' }]"
                :title="'View local version'"
              >
                <Icon name="file-code" :size="12" />
                Local
              </button>
              <button
                @click.stop="$emit('update:contentMode', 'remote')"
                :class="['mode-button', { active: contentMode === 'remote' }]"
                :title="'View remote version'"
              >
                <Icon name="git-branch" :size="12" />
                Remote
              </button>
            </div>
          </div>

          <!-- View Mode Toggle -->
          <div class="view-mode-toggle">
            <div class="mode-buttons">
              <button
                @click.stop="$emit('update:viewMode', 'unified')"
                :class="['mode-button', { active: viewMode === 'unified' }]"
              >
                <Icon name="align-justify" :size="12" />
                Unified
              </button>
              <button
                @click.stop="$emit('update:viewMode', 'split')"
                :class="['mode-button', { active: viewMode === 'split' }]"
              >
                <Icon name="columns" :size="12" />
                Side-by-Side
              </button>
            </div>
          </div>

          <FileTreeView
            :files="files"
            :selected-file="currentFile?.path || currentFile?.fileName || ''"
            @file-select="handleFileSelect"
          />
        </div>
      </div>

      <!-- Main Diff Content -->
      <div class="diff-main">
    <!-- Diff Content -->
    <div class="diff-container" :class="[`view-${viewMode}`]">
      <!-- Unified View -->
      <div v-if="viewMode === 'unified' && currentFile" class="unified-view">
        <div class="file-header">
          <PathEditor
            :current-file="currentFile"
            :files="files"
            @file-select="handleFileSelect"
          />
          <!-- Mode Indicator -->
          <span v-if="contentMode && contentMode !== 'diff'" class="mode-indicator">
            Viewing: {{ contentMode === 'local' ? 'Local' : 'Remote' }}
          </span>
        </div>

        <div class="diff-lines">
          <template v-for="(line, index) in displayContent" :key="index">
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
                  <Icon name="alert-triangle" :size="12" />
                  Needs Attention
                </span>
              </div>
              <div
                v-show="!isHunkCollapsed(getHunkForLine(line.newNumber || line.oldNumber || 0))"
                class="hunk-description-content"
              >
                <div class="hunk-description-text">
                  {{ getHunkForLine(line.newNumber || line.oldNumber || 0)?.description }}
                </div>
                <div class="hunk-actions">
                  <button
                    class="ask-hunk-button"
                    @click="toggleHunkThread(getHunkForLine(line.newNumber || line.oldNumber || 0))"
                  >
                    <Icon name="info" :size="14" />
                    Ask about this change
                  </button>
                </div>

                <!-- Hunk Thread -->
                <transition name="slide-down">
                  <div
                    v-if="isHunkThreadExpanded(getHunkForLine(line.newNumber || line.oldNumber || 0))"
                    class="hunk-thread-container"
                  >
                    <HunkReplyCard
                      v-if="getHunkForLine(line.newNumber || line.oldNumber || 0)"
                      :hunk="getHunkForLine(line.newNumber || line.oldNumber || 0)!"
                      :threading-service="threadingService"
                      :thread="getHunkThread(getHunkForLine(line.newNumber || line.oldNumber || 0))"
                      :is-a-i-typing="props.isHunkAiTyping?.(getHunkForLine(line.newNumber || line.oldNumber || 0)!) || false"
                      :streaming-response="props.getHunkStreamingResponse?.(getHunkForLine(line.newNumber || line.oldNumber || 0)!) || ''"
                      @thread-created="onHunkThreadCreated"
                      @user-question="onHunkQuestionSubmitted"
                    />
                  </div>
                </transition>
              </div>
            </div>

            <!-- Diff Line -->
            <div
              :class="['diff-line', line.type]"
              :data-file="currentFile.path || currentFile.fileName"
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

                <code v-html="highlightSyntax(line.content, currentFile.path || currentFile.fileName)"></code>

                <!-- Inline Comments (only on first line) -->
                <div v-if="hasComment(line.newNumber || line.oldNumber || 0)" class="line-indicators">
                  <button
                    :class="['comment-indicator', getCommentTypeClass(line.newNumber || line.oldNumber || 0)]"
                    @click="toggleComment(line.newNumber || line.oldNumber || 0)"
                  >
                    <Icon :name="getCommentTypeIcon(line.newNumber || line.oldNumber || 0)" :size="14" />
                    <span class="comment-count">{{ getCommentCount(line.newNumber || line.oldNumber || 0) }}</span>
                  </button>

                  <button
                    class="thread-indicator"
                    @click="toggleInlineThread(line.newNumber || line.oldNumber || 0)"
                    title="Reply inline"
                  >
                    <Icon name="message-square" :size="14" />
                  </button>
                </div>
              </div>

              <!-- Expandable Comment -->
              <transition name="slide-down">
                <div
                  v-if="expandedComments[line.newNumber || line.oldNumber || 0]"
                  class="inline-comment-container"
                >
                  <CommentCard
                    v-for="comment in getLineComments(line.newNumber || line.oldNumber || 0)"
                    :key="`${comment.file}-${comment.lines.start}`"
                    :comment="comment"
                    :inline="true"
                    @apply-fix="$emit('apply-fix', comment)"
                  />
                </div>
              </transition>

              <!-- Inline Thread for Comments -->
              <transition name="slide-down">
                <div
                  v-if="expandedInlineThreads[line.newNumber || line.oldNumber || 0]"
                  class="inline-thread-container"
                >
                  <InlineCommentThread
                    v-for="comment in getLineComments(line.newNumber || line.oldNumber || 0)"
                    :key="`thread-${comment.file}-${comment.lines.start}`"
                    context-type="comment"
                    :original-message="comment.message"
                    :file-name="comment.file"
                    :lines="comment.lines"
                    :threading-service="threadingService"
                    :thread="getCommentThread(comment)"
                    @thread-created="onInlineThreadCreated"
                    @reply-submitted="onCommentReplySubmitted"
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
          <PathEditor
            :current-file="currentFile"
            :files="files"
            @file-select="handleFileSelect"
          />
          <!-- Mode Indicator -->
          <span v-if="contentMode && contentMode !== 'diff'" class="mode-indicator">
            Viewing: {{ contentMode === 'local' ? 'Local' : 'Remote' }}
          </span>
        </div>

        <template v-if="contentMode === 'diff'">
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
                    <code v-html="highlightSyntax(line.content, currentFile.path || currentFile.fileName)"></code>
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
                  :data-file="currentFile.path || currentFile.fileName"
                  :data-line="line.number"
                >
                  <span class="line-number">{{ line.number || '' }}</span>
                  <div class="line-content">
                    <code v-html="highlightSyntax(line.content, currentFile.path || currentFile.fileName)"></code>

                    <!-- Comments in split view -->
                    <button
                      v-if="hasComment(line.number || 0)"
                      :class="['comment-indicator', getCommentTypeClass(line.number || 0)]"
                      @click="toggleComment(line.number || 0)"
                    >
                      <Icon :name="getCommentTypeIcon(line.number || 0)" :size="14" />
                    </button>
                  </div>

                  <!-- Expandable Comment -->
                  <transition name="slide-down">
                    <div
                      v-if="expandedComments[line.number || 0]"
                      class="inline-comment-container"
                    >
                      <CommentCard
                        v-for="comment in getLineComments(line.number || 0)"
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
        </template>
        <div v-else class="empty-diff">Split view is only available for diffs.</div>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-diff">
        <Icon name="file-x" :size="48" />
        <p>No diff data available</p>
      </div>
    </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import Icon from '../Icon.vue'
import { FolderOpen, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import CommentCard from './CommentCard.vue'
import HunkReplyCard from './HunkReplyCard.vue'
import InlineCommentThread from './InlineCommentThread.vue'
import FileTreeView from './FileTreeView.vue'
import PathEditor from './PathEditor.vue'
import type { DiffFile, Comment, Hunk } from '../../services/ProjectWorkflowService'
import type { CommentThreadingService } from '../../services/CommentThreadingService'
import type { ThreadInfo } from '../../types/CodeReview'

interface Props {
  files: DiffFile[]
  comments: Comment[]
  hunks: Hunk[]
  viewMode: 'unified' | 'split'
  contentMode?: 'diff' | 'local' | 'remote'
  threadingService?: CommentThreadingService
  threads?: ThreadInfo[]
  isHunkAiTyping?: (hunk: any) => boolean
  getHunkStreamingResponse?: (hunk: any) => string
  selectedFileIndex?: number
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
  'hunk-question': [hunk: Hunk, question: string]
  'comment-reply': [comment: Comment, reply: string]
  'update:selectedFileIndex': [index: number]
  'update:contentMode': [mode: 'diff' | 'local' | 'remote']
  'update:viewMode': [mode: 'unified' | 'split']
}>()

const selectedFileIndex = ref(props.selectedFileIndex ?? 0)
const expandedComments = ref<Record<number, boolean>>({})
const collapsedHunks = ref<Record<string, boolean>>({})
const expandedHunkThreads = ref<Record<string, boolean>>({})
const expandedInlineThreads = ref<Record<string, boolean>>({})
const fileTreeCollapsed = ref(false)

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
  } else if (file.diff || file.diffContent) {
    // Parse unified diff format
    const diffLines = (file.diff ?? file.diffContent)!.split('\n')
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

  for (const line of displayContent.value) {
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

const displayContent = computed((): ProcessedLine[] => {
  if (!currentFile.value) return []

  const contentMode = props.contentMode || 'diff'
  const file = currentFile.value

  if (contentMode === 'local' && file.localContent) {
    // Split the local content by newlines and return as ProcessedLine array
    const lines = file.localContent.split('\n')
    return lines.map((content: string, index: number) => ({
      type: 'unchanged' as const,
      oldNumber: index + 1,
      newNumber: index + 1,
      content
    }))
  }

  if (contentMode === 'remote' && file.remoteContent) {
    // Split the remote content by newlines and return as ProcessedLine array
    const lines = file.remoteContent.split('\n')
    return lines.map((content: string, index: number) => ({
      type: 'unchanged' as const,
      oldNumber: index + 1,
      newNumber: index + 1,
      content
    }))
  }

  // Fall back to existing diff processing for 'diff' mode or when version content is not available
  return processedLines.value
})

function getFileName(path: string | undefined): string {
  if (!path || typeof path !== 'string') {
    return 'Unknown File'
  }
  return path.split('/').pop() || path
}

function hasComment(lineNumber: number): boolean {
  if (!currentFile.value) return false
  // Only show comment indicator on the first line of the comment range
  return props.comments.some(c =>
    c.file === (currentFile.value.path || currentFile.value.fileName) &&
    lineNumber === c.lines.start // Changed from >= start && <= end
  )
}

function getLineComments(lineNumber: number): Comment[] {
  if (!currentFile.value) return []
  // Get comments that start at this line
  return props.comments.filter(c =>
    c.file === (currentFile.value.path || currentFile.value.fileName) &&
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
function updateSelectedFileIndex(index: number) {
  selectedFileIndex.value = index
  emit('update:selectedFileIndex', index)
}

function handleFileSelect(file: DiffFile) {
  const fileIndex = props.files.findIndex(f =>
    (f.path || f.fileName) === (file.path || file.fileName)
  )
  if (fileIndex !== -1) {
    updateSelectedFileIndex(fileIndex)
  }
}

function selectFile(filePath: string): boolean {
  const index = props.files.findIndex(f => f.path === filePath)
  if (index !== -1) {
    updateSelectedFileIndex(index)
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

function highlightSyntax(code: string, _filepath: string): string {
  // For now, just escape HTML and return plain text to avoid rendering issues
  // TODO: Fix syntax highlighting to properly handle all cases

  // Escape HTML to prevent XSS and display issues
  return code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Hunk threading functions
function toggleHunkThread(hunk: Hunk | undefined) {
  if (!hunk) return
  const hunkId = getHunkId(hunk)
  expandedHunkThreads.value[hunkId] = !expandedHunkThreads.value[hunkId]
}

function isHunkThreadExpanded(hunk: Hunk | undefined): boolean {
  if (!hunk) return false
  return expandedHunkThreads.value[getHunkId(hunk)] || false
}

function getHunkThread(hunk: Hunk | undefined): ThreadInfo | undefined {
  if (!hunk || !props.threads) {
    console.log('[DiffViewer] getHunkThread: no hunk or threads', hunk?.id, props.threads?.length)
    return undefined
  }
  const threadId = `${hunk.file}-hunk-${hunk.start}-${hunk.end}`
  const thread = props.threads.find(t => t.threadId === threadId)
  console.log('[DiffViewer] getHunkThread: looking for', threadId, 'found:', !!thread, 'total threads:', props.threads.length)
  return thread
}

// Inline comment threading functions
function toggleInlineThread(lineNumber: number) {
  expandedInlineThreads.value[lineNumber] = !expandedInlineThreads.value[lineNumber]
}

function getCommentThread(comment: Comment): ThreadInfo | undefined {
  if (!props.threads) return undefined
  const threadId = `${comment.file}-${comment.lines.start}-${comment.lines.end}`
  return props.threads.find(t => t.threadId === threadId)
}

// Event handlers
function onHunkThreadCreated(_thread: ThreadInfo) {
  emit('hunk-question', {} as Hunk, 'Thread created')
}

function onHunkQuestionSubmitted(hunk: Hunk, question: string) {
  console.log('[DiffViewer] Received hunk question:', question, 'for hunk:', hunk)
  emit('hunk-question', hunk, question)
}

function onInlineThreadCreated(_thread: ThreadInfo) {
  // Handle inline thread creation
  console.log('Inline thread created')
}

function onCommentReplySubmitted(comment: Comment, reply: string) {
  emit('comment-reply', comment, reply)
}

// Watch for file changes
watch(() => props.files, () => {
  updateSelectedFileIndex(0)
  expandedComments.value = {}
  expandedHunkThreads.value = {}
  expandedInlineThreads.value = {}
})

// Watch for selectedFileIndex prop changes (for v-model support)
watch(() => props.selectedFileIndex, (newIndex) => {
  if (newIndex !== undefined && newIndex !== selectedFileIndex.value) {
    selectedFileIndex.value = newIndex
  }
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

.mode-indicator {
  margin-left: auto;
  padding: 0.25rem 0.5rem;
  background: var(--primary-gradient);
  color: white;
  font-size: 0.75rem;
  border-radius: 0.25rem;
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

/* Line Indicators */
.line-indicators {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Comment Indicator */
.comment-indicator {
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

/* Thread Indicator */
.thread-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 50%;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.thread-indicator:hover {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
  transform: scale(1.1);
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

.inline-thread-container {
  grid-column: 1 / -1;
  background: var(--glass-bg-darker);
  border-left: 3px solid var(--primary-color);
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

.hunk-description-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.hunk-description-text {
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.5;
}

.hunk-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.ask-hunk-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--primary-gradient);
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.ask-hunk-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(155, 135, 245, 0.3);
}

.hunk-thread-container {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-subtle);
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

/* Diff Layout Styles */
.diff-layout {
  display: flex;
  gap: 1rem;
  height: 100%;
  min-height: 500px;
}

.file-sidebar {
  width: 280px;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  background: transparent;
  overflow: hidden;
  transition: all 0.3s ease;
}

.file-sidebar.collapsed {
  width: 48px;
  min-width: 48px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 0;
  background: transparent;
}

.sidebar-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
}

.sidebar-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.375rem;
  background: transparent;
  border: 1px solid var(--border-subtle);
  border-radius: 0.25rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.sidebar-toggle:hover {
  background: var(--glass-bg-hover);
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.sidebar-content {
  flex: 1;
  overflow: hidden;
}

.diff-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--glass-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 0.5rem;
  overflow: hidden;
}

/* Responsive Design */
@media (max-width: 1024px) {
  .diff-layout {
    flex-direction: column;
    gap: 0.5rem;
  }

  .file-sidebar {
    width: 100%;
    min-width: auto;
    max-height: 300px;
  }

  .file-sidebar.collapsed {
    width: 100%;
    max-height: 48px;
  }

  .diff-main {
    flex: 1;
  }
}

@media (max-width: 768px) {
  .diff-layout {
    gap: 0.25rem;
  }

  .sidebar-header {
    padding: 0.5rem;
  }

  .sidebar-title {
    font-size: 0.75rem;
  }
}

/* Content Mode Selector */
.content-mode-selector {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.75rem 0;
  margin-bottom: 0.5rem;
  padding: 0;
  background: transparent;
}

.mode-label {
  font-size: 0.625rem;
  font-weight: 500;
  color: var(--text-secondary);
  white-space: nowrap;
}

.mode-buttons {
  display: flex;
  gap: 0.25rem;
}

.mode-button {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.25rem;
  color: var(--text-secondary);
  font-size: 0.625rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mode-button:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.3);
  color: var(--text-primary);
}

.mode-button.active {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: white;
}

.mode-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.mode-button:disabled:hover {
  transform: none;
  background: transparent;
  border-color: rgba(255, 255, 255, 0.2);
  color: var(--text-secondary);
}
</style>