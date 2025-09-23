<template>
  <div class="enhanced-markdown-renderer" :class="[customClass, { 'compact': compact }]">
    <div
      class="markdown-container"
      :class="{ 'has-max-height': maxHeight }"
      :style="{ maxHeight: maxHeight ? `${maxHeight}px` : undefined }"
      ref="contentContainer"
    >
      <div class="markdown-content" v-html="renderedContent"></div>
    </div>

    <!-- Expand/Collapse button if content overflows -->
    <button
      v-if="showExpandButton"
      @click="toggleExpanded"
      class="expand-toggle"
    >
      <span v-if="!isExpanded">
        Show More
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
      <span v-else>
        Show Less
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path d="M18 15L12 9L6 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
    </button>

    <!-- Copy button overlay -->
    <button
      v-if="showCopyButton"
      @click="copyToClipboard"
      class="copy-button"
      :class="{ 'copied': copied }"
    >
      <svg v-if="!copied" width="16" height="16" viewBox="0 0 24 24" fill="none">
        <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="1.5"/>
        <path d="M5 15H4C2.89543 15 2 14.1046 2 13V4C2 2.89543 2.89543 2 4 2H13C14.1046 2 15 2.89543 15 4V5" stroke="currentColor" stroke-width="1.5"/>
      </svg>
      <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span class="copy-text">{{ copied ? 'Copied!' : 'Copy' }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUpdated, nextTick } from 'vue'

interface Props {
  content: string
  customClass?: string
  compact?: boolean
  maxHeight?: number
  showCopyButton?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  content: '',
  customClass: '',
  compact: false,
  maxHeight: 0,
  showCopyButton: true
})

const contentContainer = ref<HTMLElement | null>(null)
const isExpanded = ref(false)
const showExpandButton = ref(false)
const copied = ref(false)

// Enhanced markdown to HTML converter with better formatting
function enhancedMarkdownToHtml(markdown: string): string {
  if (!markdown) return ''

  let html = markdown

  // Pre-process: Preserve code blocks
  const codeBlocks: string[] = []
  html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
    const index = codeBlocks.length
    const langMatch = code.match(/^(\w+)\n/)
    const lang = langMatch ? langMatch[1] : ''
    const codeContent = langMatch ? code.slice(langMatch[0].length) : code
    codeBlocks.push(`<pre class="code-block" data-lang="${lang}"><code>${escapeHtml(codeContent.trim())}</code></pre>`)
    return `{{CODE_BLOCK_${index}}}`
  })

  // Preserve inline code
  const inlineCode: string[] = []
  html = html.replace(/`([^`]+)`/g, (match, code) => {
    const index = inlineCode.length
    inlineCode.push(`<code class="inline-code">${escapeHtml(code)}</code>`)
    return `{{INLINE_CODE_${index}}}`
  })

  // Escape HTML to prevent XSS (but preserve our placeholders)
  html = escapeHtml(html)

  // Headers with anchors
  html = html.replace(/^#{6} (.*?)$/gm, '<h6 class="heading-6">$1</h6>')
  html = html.replace(/^#{5} (.*?)$/gm, '<h5 class="heading-5">$1</h5>')
  html = html.replace(/^#{4} (.*?)$/gm, '<h4 class="heading-4">$1</h4>')
  html = html.replace(/^### (.*?)$/gm, '<h3 class="heading-3">$1</h3>')
  html = html.replace(/^## (.*?)$/gm, '<h2 class="heading-2">$1</h2>')
  html = html.replace(/^# (.*?)$/gm, '<h1 class="heading-1">$1</h1>')

  // Horizontal rules
  html = html.replace(/^---+$/gm, '<hr class="divider">')
  html = html.replace(/^\*\*\*+$/gm, '<hr class="divider">')

  // Bold and italic (handle nested)
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')
  html = html.replace(/__(.*?)__/g, '<strong>$1</strong>')
  html = html.replace(/_(.*?)_/g, '<em>$1</em>')

  // Strikethrough
  html = html.replace(/~~(.*?)~~/g, '<del>$1</del>')

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')

  // Blockquotes
  html = html.replace(/^&gt; (.*?)$/gm, '<blockquote>$1</blockquote>')
  // Merge consecutive blockquotes
  html = html.replace(/(<\/blockquote>\n<blockquote>)+/g, '\n')

  // Task lists
  html = html.replace(/^- \[x\] (.*?)$/gmi, '<li class="task-item checked"><input type="checkbox" checked disabled> $1</li>')
  html = html.replace(/^- \[ \] (.*?)$/gmi, '<li class="task-item"><input type="checkbox" disabled> $1</li>')

  // Unordered lists
  html = html.replace(/^[\*\-\+] (.*?)$/gm, '<li>$1</li>')
  html = html.replace(/(<li>.*?<\/li>\s*)+/gs, (match) => {
    return `<ul class="bullet-list">${match}</ul>`
  })

  // Ordered lists
  html = html.replace(/^\d+\. (.*?)$/gm, '<li>$1</li>')
  // Group consecutive ordered list items
  let inOrderedList = false
  const lines = html.split('\n')
  const processedLines = []

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('<li>') && !lines[i].includes('task-item')) {
      if (!inOrderedList && i > 0 && lines[i-1].includes('<li>')) {
        // Already in a list from bullet processing
      } else if (!inOrderedList) {
        processedLines.push('<ol class="numbered-list">')
        inOrderedList = true
      }
      processedLines.push(lines[i])
    } else {
      if (inOrderedList) {
        processedLines[processedLines.length - 1] += '</ol>'
        inOrderedList = false
      }
      processedLines.push(lines[i])
    }
  }
  if (inOrderedList) {
    processedLines[processedLines.length - 1] += '</ol>'
  }
  html = processedLines.join('\n')

  // Tables (basic support)
  html = html.replace(/\|(.+)\|/g, (match) => {
    const cells = match.slice(1, -1).split('|').map(cell => cell.trim())
    return `<tr>${cells.map(cell => `<td>${cell}</td>`).join('')}</tr>`
  })
  html = html.replace(/(<tr>.*?<\/tr>\s*)+/gs, (match) => {
    return `<table class="data-table">${match}</table>`
  })

  // Paragraphs
  html = html.split('\n\n').map(paragraph => {
    paragraph = paragraph.trim()
    if (paragraph && !paragraph.startsWith('<')) {
      return `<p>${paragraph}</p>`
    }
    return paragraph
  }).join('\n')

  // Line breaks within paragraphs
  html = html.replace(/([^>])\n([^<])/g, '$1<br>$2')

  // Restore code blocks
  codeBlocks.forEach((block, index) => {
    html = html.replace(`{{CODE_BLOCK_${index}}}`, block)
  })

  // Restore inline code
  inlineCode.forEach((code, index) => {
    html = html.replace(`{{INLINE_CODE_${index}}}`, code)
  })

  // Clean up
  html = html.replace(/<p><\/p>/g, '')
  html = html.replace(/<p>(<h[1-6])/g, '$1')
  html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1')
  html = html.replace(/<p>(<ul|<ol|<blockquote|<pre|<table|<hr)/g, '$1')
  html = html.replace(/(<\/ul>|<\/ol>|<\/blockquote>|<\/pre>|<\/table>|<hr>)<\/p>/g, '$1')

  return html
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, m => map[m])
}

// Computed property to render markdown
const renderedContent = computed(() => {
  if (!props.content) return ''

  try {
    return enhancedMarkdownToHtml(props.content)
  } catch (error) {
    console.error('Error rendering markdown:', error)
    return `<pre class="fallback">${escapeHtml(props.content)}</pre>`
  }
})

// Check if content overflows
async function checkOverflow() {
  await nextTick()
  if (contentContainer.value && props.maxHeight) {
    const isOverflowing = contentContainer.value.scrollHeight > props.maxHeight
    showExpandButton.value = isOverflowing && !isExpanded.value
  }
}

function toggleExpanded() {
  isExpanded.value = !isExpanded.value
  if (contentContainer.value) {
    if (isExpanded.value) {
      contentContainer.value.style.maxHeight = 'none'
      showExpandButton.value = true
    } else {
      contentContainer.value.style.maxHeight = props.maxHeight ? `${props.maxHeight}px` : ''
      checkOverflow()
    }
  }
}

async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(props.content)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

onMounted(() => {
  checkOverflow()
})

onUpdated(() => {
  checkOverflow()
})
</script>

<style scoped>
.enhanced-markdown-renderer {
  position: relative;
  width: 100%;
}

.markdown-container {
  width: 100%;
  overflow: hidden;
  transition: max-height 0.3s ease;
}

.markdown-container.has-max-height {
  overflow-y: auto;
  position: relative;
}

.markdown-content {
  color: var(--text-primary);
  line-height: 1.7;
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
  font-size: 0.9375rem;
}

/* Compact mode */
.compact .markdown-content {
  font-size: 0.875rem;
  line-height: 1.6;
}

/* Headers */
.markdown-content :deep(.heading-1) {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 1.5rem 0 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid rgba(139, 92, 246, 0.2);
  color: var(--text-primary);
  background: linear-gradient(135deg, var(--text-primary), #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.markdown-content :deep(.heading-2) {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 1.25rem 0 0.75rem;
  color: var(--text-primary);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding-bottom: 0.25rem;
}

.markdown-content :deep(.heading-3) {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 1rem 0 0.5rem;
  color: #a78bfa;
}

.markdown-content :deep(.heading-4),
.markdown-content :deep(.heading-5),
.markdown-content :deep(.heading-6) {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0.75rem 0 0.5rem;
  color: var(--text-primary);
  opacity: 0.9;
}

/* Paragraphs */
.markdown-content :deep(p) {
  margin: 0.75rem 0;
  color: var(--text-primary);
  opacity: 0.95;
}

/* Lists */
.markdown-content :deep(.bullet-list),
.markdown-content :deep(.numbered-list) {
  margin: 0.75rem 0;
  padding-left: 1.75rem;
  color: var(--text-primary);
}

.markdown-content :deep(.bullet-list li),
.markdown-content :deep(.numbered-list li) {
  margin: 0.375rem 0;
  line-height: 1.6;
  position: relative;
}

.markdown-content :deep(.bullet-list li) {
  list-style: none;
}

.markdown-content :deep(.bullet-list li::before) {
  content: '▸';
  position: absolute;
  left: -1.25rem;
  color: #8b5cf6;
  font-weight: 600;
}

.markdown-content :deep(.numbered-list li) {
  list-style: decimal;
  list-style-position: outside;
}

.markdown-content :deep(.numbered-list li)::marker {
  color: #8b5cf6;
  font-weight: 600;
}

/* Task lists */
.markdown-content :deep(.task-item) {
  list-style: none;
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.markdown-content :deep(.task-item input[type="checkbox"]) {
  margin-top: 0.25rem;
  accent-color: #8b5cf6;
}

/* Blockquotes */
.markdown-content :deep(blockquote) {
  margin: 1rem 0;
  padding: 0.75rem 1rem;
  border-left: 4px solid #8b5cf6;
  background: linear-gradient(90deg, rgba(139, 92, 246, 0.05) 0%, transparent 100%);
  color: var(--text-secondary);
  font-style: italic;
  border-radius: 0 8px 8px 0;
}

/* Code */
.markdown-content :deep(.inline-code) {
  padding: 0.125rem 0.375rem;
  background: rgba(139, 92, 246, 0.1);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: 4px;
  font-family: 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
  font-size: 0.875em;
  color: #c4b5fd;
  font-weight: 500;
}

.markdown-content :deep(.code-block) {
  margin: 1rem 0;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: 8px;
  overflow-x: auto;
  position: relative;
}

.markdown-content :deep(.code-block)::before {
  content: attr(data-lang);
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  padding: 0.125rem 0.5rem;
  background: rgba(139, 92, 246, 0.15);
  border-radius: 4px;
  font-size: 0.7rem;
  color: #a78bfa;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.markdown-content :deep(.code-block code) {
  padding: 0;
  background: transparent;
  border: none;
  font-family: 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
  font-size: 0.875rem;
  color: #e5e7eb;
  line-height: 1.6;
  display: block;
  white-space: pre;
  overflow-x: auto;
}

/* Links */
.markdown-content :deep(a) {
  color: #8b5cf6;
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: all 0.2s ease;
  font-weight: 500;
}

.markdown-content :deep(a:hover) {
  color: #a78bfa;
  border-bottom-color: #a78bfa;
}

/* Tables */
.markdown-content :deep(.data-table) {
  width: 100%;
  margin: 1rem 0;
  border-collapse: collapse;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  overflow: hidden;
  display: block;
  overflow-x: auto;
}

.markdown-content :deep(.data-table td) {
  padding: 0.625rem;
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: var(--text-primary);
  white-space: nowrap;
}

.markdown-content :deep(.data-table tr:nth-child(odd)) {
  background: rgba(255, 255, 255, 0.01);
}

.markdown-content :deep(.data-table tr:hover) {
  background: rgba(139, 92, 246, 0.05);
}

/* Horizontal rule */
.markdown-content :deep(.divider) {
  margin: 1.5rem 0;
  border: none;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.3), transparent);
}

/* Text formatting */
.markdown-content :deep(strong) {
  font-weight: 600;
  color: var(--text-primary);
  background: linear-gradient(135deg, #fff, #c4b5fd);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.markdown-content :deep(em) {
  font-style: italic;
  color: var(--text-primary);
  opacity: 0.9;
}

.markdown-content :deep(del) {
  text-decoration: line-through;
  opacity: 0.6;
}

/* Expand button */
.expand-toggle {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.75rem;
  padding: 0.375rem 0.75rem;
  background: rgba(139, 92, 246, 0.1);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: 6px;
  color: #a78bfa;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.expand-toggle:hover {
  background: rgba(139, 92, 246, 0.15);
  border-color: rgba(139, 92, 246, 0.3);
  transform: translateY(-1px);
}

.expand-toggle span {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

/* Copy button */
.copy-button {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.625rem;
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s ease;
  opacity: 0;
  backdrop-filter: blur(8px);
}

.enhanced-markdown-renderer:hover .copy-button {
  opacity: 1;
}

.copy-button:hover {
  background: rgba(139, 92, 246, 0.2);
  border-color: rgba(139, 92, 246, 0.3);
  color: var(--text-primary);
}

.copy-button.copied {
  background: rgba(34, 197, 94, 0.2);
  border-color: rgba(34, 197, 94, 0.3);
  color: #4ade80;
}

.copy-text {
  font-weight: 500;
}

/* Scrollbar */
.markdown-container::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.markdown-container::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.02);
  border-radius: 3px;
}

.markdown-container::-webkit-scrollbar-thumb {
  background: rgba(139, 92, 246, 0.2);
  border-radius: 3px;
}

.markdown-container::-webkit-scrollbar-thumb:hover {
  background: rgba(139, 92, 246, 0.3);
}

/* Gradient fade for collapsed content */
.markdown-container.has-max-height:not(.expanded)::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.8));
  pointer-events: none;
}

/* Animation */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.markdown-content > * {
  animation: fadeIn 0.3s ease;
}

/* Responsive */
@media (max-width: 640px) {
  .markdown-content {
    font-size: 0.875rem;
  }

  .markdown-content :deep(.heading-1) {
    font-size: 1.5rem;
  }

  .markdown-content :deep(.heading-2) {
    font-size: 1.25rem;
  }

  .markdown-content :deep(.heading-3) {
    font-size: 1.1rem;
  }
}
</style>