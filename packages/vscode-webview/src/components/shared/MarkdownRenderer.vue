<template>
  <div class="markdown-renderer" :class="[customClass, { 'compact': compact, 'loading': isLoading }]">
    <!-- Loading state -->
    <div v-if="isLoading" class="loading-state">
      <div class="loading-spinner"></div>
      <span>Rendering content...</span>
    </div>

    <!-- Content container -->
    <div
      v-show="!isLoading"
      class="markdown-container"
      :class="{ 'has-max-height': maxHeight && !isExpanded }"
      :style="{ maxHeight: isExpanded ? 'none' : (maxHeight ? `${maxHeight}px` : undefined) }"
      ref="contentContainer"
    >
      <div class="markdown-content" ref="markdownContent"></div>
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
      v-if="showCopyButton && !isLoading"
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
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { loadMermaid, renderMermaidDiagram } from '../../utils/mermaid-loader'

// Type definitions for external libraries
declare global {
  interface Window {
    markdownit: any
    mermaid: any
    Prism: any
  }
}

interface Props {
  content: string
  customClass?: string
  compact?: boolean
  maxHeight?: number
  showCopyButton?: boolean
  enableMermaid?: boolean
  enableSyntaxHighlight?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  content: '',
  customClass: '',
  compact: false,
  maxHeight: 0,
  showCopyButton: true,
  enableMermaid: true,
  enableSyntaxHighlight: true
})

const contentContainer = ref<HTMLElement | null>(null)
const markdownContent = ref<HTMLElement | null>(null)
const isExpanded = ref(false)
const showExpandButton = ref(false)
const copied = ref(false)
const isLoading = ref(false)
const librariesLoaded = ref(false)
const md = ref<any>(null)

// Load external libraries dynamically
async function loadLibraries() {
  if (librariesLoaded.value) return

  try {
    // Load markdown-it
    if (!window.markdownit) {
      await loadScript('https://cdn.jsdelivr.net/npm/markdown-it@14/dist/markdown-it.min.js')
    }

    // Load Prism for syntax highlighting
    if (props.enableSyntaxHighlight && !window.Prism) {
      await loadStylesheet('https://cdn.jsdelivr.net/npm/prismjs@1/themes/prism-tomorrow.min.css')
      await loadScript('https://cdn.jsdelivr.net/npm/prismjs@1/prism.min.js')

      // Load additional languages
      const languages = [
        'javascript', 'typescript', 'python', 'java', 'csharp', 'cpp', 'go', 'rust',
        'sql', 'bash', 'json', 'yaml', 'markdown', 'jsx', 'tsx', 'css', 'scss'
      ]

      const langPromises = languages.map(lang =>
        loadScript(`https://cdn.jsdelivr.net/npm/prismjs@1/components/prism-${lang}.min.js`).catch(() => {})
      )
      await Promise.all(langPromises)
    }

    // Load Mermaid for diagrams using the new loader
    if (props.enableMermaid) {
      try {
        await loadMermaid()
        console.log('Mermaid loaded successfully')
      } catch (error) {
        console.error('Failed to load Mermaid:', error)
      }
    }

    // Initialize markdown-it with better plugins
    initializeMarkdownIt()

    librariesLoaded.value = true
  } catch (error) {
    console.error('Error loading markdown libraries:', error)
    // Fallback to simple markdown parsing
    librariesLoaded.value = true
  }
}

function initializeMarkdownIt() {
  if (!window.markdownit) return

  // Initialize markdown-it with options
  md.value = window.markdownit({
    html: true,
    linkify: true,
    typographer: true,
    breaks: true,
    highlight: props.enableSyntaxHighlight ? highlightCode : undefined
  })

  // Custom renderer for mermaid blocks
  const defaultFenceRenderer = md.value.renderer.rules.fence || function(tokens: any, idx: number, options: any, env: any, self: any) {
    return self.renderToken(tokens, idx, options)
  }

  md.value.renderer.rules.fence = function(tokens: any, idx: number, options: any, env: any, self: any) {
    const token = tokens[idx]
    const info = token.info ? token.info.trim() : ''
    const langName = info.split(/\s+/g)[0]

    if (props.enableMermaid && langName === 'mermaid') {
      const uniqueId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      return `<div class="mermaid-container"><pre class="mermaid" id="${uniqueId}">${escapeHtml(token.content)}</pre></div>`
    }

    return defaultFenceRenderer(tokens, idx, options, env, self)
  }
}

// Syntax highlighting with Prism
function highlightCode(str: string, lang: string): string {
  if (!window.Prism || !lang) {
    return escapeHtml(str)
  }

  // Map common language aliases
  const langMap: Record<string, string> = {
    'js': 'javascript',
    'ts': 'typescript',
    'py': 'python',
    'sh': 'bash',
    'yml': 'yaml',
    'vue': 'html'
  }

  const mappedLang = langMap[lang] || lang
  const language = window.Prism.languages[mappedLang]

  if (language) {
    try {
      const highlighted = window.Prism.highlight(str, language, mappedLang)
      return `<span class="language-badge">${mappedLang}</span>${highlighted}`
    } catch (error) {
      console.error(`Error highlighting ${mappedLang}:`, error)
    }
  }

  return `<span class="language-badge">${lang}</span>${escapeHtml(str)}`
}

// Helper function to escape HTML
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Helper function to load scripts
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) {
      console.log(`Script already loaded: ${src}`)
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.crossOrigin = 'anonymous'

    script.onload = () => {
      console.log(`Successfully loaded: ${src}`)
      resolve()
    }

    script.onerror = (error) => {
      console.error(`Failed to load script: ${src}`, error)
      reject(new Error(`Failed to load ${src}`))
    }

    document.head.appendChild(script)
  })
}

// Helper function to load stylesheets
function loadStylesheet(href: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`link[href="${href}"]`)
    if (existing) {
      resolve()
      return
    }

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.onload = () => resolve()
    link.onerror = () => {
      console.warn(`Failed to load stylesheet: ${href}`)
      resolve() // Resolve anyway to continue
    }
    document.head.appendChild(link)
  })
}

// Enhanced fallback markdown parser
function enhancedMarkdownToHtml(markdown: string): string {
  if (!markdown) return ''

  let html = markdown

  // Pre-process: Preserve code blocks and mermaid blocks
  const codeBlocks: string[] = []
  html = html.replace(/```([\s\S]*?)```/g, (match, content) => {
    const index = codeBlocks.length
    const langMatch = content.match(/^(\w+)\n/)
    const lang = langMatch ? langMatch[1] : ''
    const codeContent = langMatch ? content.slice(langMatch[0].length) : content

    if (lang === 'mermaid' && props.enableMermaid) {
      const uniqueId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      codeBlocks.push(`<div class="mermaid-container"><pre class="mermaid" id="${uniqueId}">${escapeHtml(codeContent.trim())}</pre></div>`)
    } else {
      codeBlocks.push(`<pre class="code-block" data-lang="${lang}"><code class="language-${lang}">${escapeHtml(codeContent.trim())}</code></pre>`)
    }
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
  html = html.replace(/^#{6} (.*?)$/gm, '<h6>$1</h6>')
  html = html.replace(/^#{5} (.*?)$/gm, '<h5>$1</h5>')
  html = html.replace(/^#{4} (.*?)$/gm, '<h4>$1</h4>')
  html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>')

  // Horizontal rules
  html = html.replace(/^---+$/gm, '<hr>')
  html = html.replace(/^\*\*\*+$/gm, '<hr>')

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
    return `<ul>${match}</ul>`
  })

  // Ordered lists
  html = html.replace(/^\d+\. (.*?)$/gm, '<li class="ordered-item">$1</li>')
  html = html.replace(/(<li class="ordered-item">.*?<\/li>\s*)+/gs, (match) => {
    return `<ol>${match.replace(/ordered-item/g, '')}</ol>`
  })

  // Tables (basic support)
  html = html.replace(/\|(.+)\|/g, (match) => {
    const cells = match.slice(1, -1).split('|').map(cell => cell.trim())
    return `<tr>${cells.map(cell => `<td>${cell}</td>`).join('')}</tr>`
  })
  html = html.replace(/(<tr>.*?<\/tr>\s*)+/gs, (match) => {
    return `<table>${match}</table>`
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
  html = html.replace(/<p>(<ul|<ol|<blockquote|<pre|<table|<hr|<div)/g, '$1')
  html = html.replace(/(<\/ul>|<\/ol>|<\/blockquote>|<\/pre>|<\/table>|<hr>|<\/div>)<\/p>/g, '$1')

  return html
}

// Render markdown content
async function renderMarkdown() {
  if (!markdownContent.value || !props.content) return

  isLoading.value = true

  try {
    // Load libraries first
    await loadLibraries()

    let html = ''

    if (md.value) {
      // Use markdown-it if available
      html = md.value.render(props.content)
    } else {
      // Use fallback parser
      html = enhancedMarkdownToHtml(props.content)
    }

    markdownContent.value.innerHTML = html

    // Render Mermaid diagrams
    if (props.enableMermaid) {
      await renderMermaidDiagrams()
    }

    // Apply syntax highlighting to code blocks
    if (props.enableSyntaxHighlight && window.Prism) {
      window.Prism.highlightAllUnder(markdownContent.value)
    }

    // Check for overflow
    await checkOverflow()
  } catch (error) {
    console.error('Error rendering markdown:', error)
    // Fallback to simple text
    markdownContent.value.innerHTML = enhancedMarkdownToHtml(props.content)
  } finally {
    isLoading.value = false
  }
}

// Render Mermaid diagrams
async function renderMermaidDiagrams() {
  if (!markdownContent.value) {
    console.warn('No markdown content container found')
    return
  }

  const mermaidElements = markdownContent.value.querySelectorAll('.mermaid')
  console.log(`Found ${mermaidElements.length} Mermaid elements to render`)

  for (const element of Array.from(mermaidElements)) {
    try {
      const graphDefinition = element.textContent || ''

      // Use the new renderMermaidDiagram function
      await renderMermaidDiagram(element as HTMLElement, graphDefinition)
    } catch (error: any) {
      console.error('Error rendering Mermaid diagram:', error)
      element.innerHTML = `<div class="mermaid-error">Failed to render diagram: ${error.message || error}</div>`
      element.classList.add('mermaid-error-container')
    }
  }
}

// Check if content overflows
async function checkOverflow() {
  await nextTick()
  if (contentContainer.value && props.maxHeight) {
    const isOverflowing = contentContainer.value.scrollHeight > props.maxHeight
    showExpandButton.value = isOverflowing && !isExpanded.value
  }
}

// Toggle expanded state
function toggleExpanded() {
  isExpanded.value = !isExpanded.value
  if (!isExpanded.value) {
    checkOverflow()
  }
}

// Copy content to clipboard
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

// Watch for content changes
watch(() => props.content, () => {
  renderMarkdown()
})

// Lifecycle hooks
onMounted(() => {
  renderMarkdown()
})
</script>

<style scoped>
.markdown-renderer {
  position: relative;
  width: 100%;
}

/* Loading state */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2rem;
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(139, 92, 246, 0.2);
  border-top-color: #8b5cf6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Container */
.markdown-container {
  width: 100%;
  overflow: hidden;
  transition: max-height 0.3s ease;
}

.markdown-container.has-max-height {
  overflow-y: auto;
  position: relative;
}

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

/* Content */
.markdown-content {
  color: var(--text-primary);
  line-height: 1.7;
  word-wrap: break-word;
  overflow-wrap: break-word;
  font-size: 0.9375rem;
}

.compact .markdown-content {
  font-size: 0.875rem;
  line-height: 1.6;
}

/* Deep selectors for rendered content */
.markdown-content :deep(h1) {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 1.5rem 0 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid rgba(139, 92, 246, 0.2);
  background: linear-gradient(135deg, var(--text-primary), #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.markdown-content :deep(h2) {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 1.25rem 0 0.75rem;
  color: var(--text-primary);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding-bottom: 0.25rem;
}

.markdown-content :deep(h3) {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 1rem 0 0.5rem;
  color: #a78bfa;
}

.markdown-content :deep(h4),
.markdown-content :deep(h5),
.markdown-content :deep(h6) {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0.75rem 0 0.5rem;
  color: var(--text-primary);
  opacity: 0.9;
}

.markdown-content :deep(p) {
  margin: 0.75rem 0;
  color: var(--text-primary);
  opacity: 0.95;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  margin: 0.75rem 0;
  padding-left: 1.75rem;
  color: var(--text-primary);
}

.markdown-content :deep(li) {
  margin: 0.375rem 0;
  line-height: 1.6;
}

.markdown-content :deep(blockquote) {
  margin: 1rem 0;
  padding: 0.75rem 1rem;
  border-left: 4px solid #8b5cf6;
  background: linear-gradient(90deg, rgba(139, 92, 246, 0.05) 0%, transparent 100%);
  color: var(--text-secondary);
  font-style: italic;
  border-radius: 0 8px 8px 0;
}

/* Style for inline code (code elements without language class) */
.markdown-content :deep(code:not([class*="language-"])) {
  padding: 0.125rem 0.375rem;
  background: rgba(139, 92, 246, 0.1);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: 4px;
  font-family: 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
  font-size: 0.875em;
  color: #c4b5fd;
  font-weight: 500;
}

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

.markdown-content :deep(pre) {
  margin: 1rem 0;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: 8px;
  overflow-x: auto;
  position: relative;
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

.markdown-content :deep(pre code) {
  padding: 0;
  background: transparent;
  border: none;
  font-family: 'Fira Code', 'JetBrains Mono', 'Consolas', monospace;
  font-size: 0.875rem;
  color: #e5e7eb;
  line-height: 1.6;
  display: block;
  white-space: pre;
}

.markdown-content :deep(.language-badge) {
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
  display: inline-block;
  margin-bottom: 0.5rem;
}

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

.markdown-content :deep(table) {
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

.markdown-content :deep(th),
.markdown-content :deep(td) {
  padding: 0.625rem;
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: var(--text-primary);
  text-align: left;
}

.markdown-content :deep(th) {
  background: rgba(139, 92, 246, 0.1);
  font-weight: 600;
  color: #a78bfa;
}

.markdown-content :deep(tr:nth-child(even)) {
  background: rgba(255, 255, 255, 0.01);
}

.markdown-content :deep(tr:hover) {
  background: rgba(139, 92, 246, 0.05);
}

.markdown-content :deep(hr) {
  margin: 1.5rem 0;
  border: none;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.3), transparent);
}

.markdown-content :deep(strong) {
  font-weight: 600;
  color: var(--text-primary);
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

/* Task lists */
.markdown-content :deep(.task-item) {
  list-style: none;
  margin-left: -1.5rem;
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.markdown-content :deep(.task-item input[type="checkbox"]) {
  margin-top: 0.25rem;
  accent-color: #8b5cf6;
}

/* Mermaid diagrams */
.markdown-content :deep(.mermaid-container) {
  margin: 1.5rem 0;
  padding: 1.5rem;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: 8px;
  overflow: auto;
  display: flex;
  justify-content: center;
  align-items: center;
}

.markdown-content :deep(.mermaid-rendered) {
  background: transparent !important;
  border: none !important;
  padding: 0 !important;
}

.markdown-content :deep(.mermaid-error-container) {
  color: #ef4444;
  font-family: monospace;
  font-size: 0.875rem;
}

.markdown-content :deep(.mermaid-error) {
  padding: 1rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 4px;
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
  z-index: 10;
}

.markdown-renderer:hover .copy-button {
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

  .markdown-content :deep(h1) {
    font-size: 1.5rem;
  }

  .markdown-content :deep(h2) {
    font-size: 1.25rem;
  }

  .markdown-content :deep(h3) {
    font-size: 1.1rem;
  }
}
</style>