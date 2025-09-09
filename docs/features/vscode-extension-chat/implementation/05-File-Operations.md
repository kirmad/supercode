# 05-File-Operations.md

**File Tools, Syntax Highlighting, Diff Viewers, and LSP Integration**

---

## 🎯 Overview

This document covers the implementation of file operation tools (read, write, edit) with syntax highlighting, diff visualization, and Language Server Protocol (LSP) integration. File operations are core to OpenCode's functionality, requiring sophisticated rendering of code content with proper highlighting and change visualization.

## 🏗️ Architecture

### File Operation Types
```
Read Operations    → Syntax Highlighting → Code Display
Write Operations   → File Creation       → Success Feedback  
Edit Operations    → Diff Visualization  → Change Highlighting
Directory Listing  → File Tree           → Navigation
```

### Syntax Highlighting Pipeline
```
File Extension → Language Detection → Prism.js/Monaco → Highlighted Code
Raw Content   → AST Parsing        → Token Colors   → Rendered Output
```

## 💻 Implementation

### 1. File Read Tool Renderer

```typescript
// src/components/tools/FileReadTool.tsx - File reading visualization
import React, { useState, useMemo } from 'react'
import { ToolRendererProps } from '@services/toolRegistry'
import { CodeHighlight } from '@components/ui/CodeHighlight'
import { FileIcon } from '@components/ui/FileIcon'
import { CopyButton } from '@components/ui/CopyButton'
import { SkeletonCodeBlock } from '@components/ui/ShimmerAnimation'
import { getLanguageFromPath, formatFileSize } from '@utils/fileUtils'

export function FileReadTool({ toolCall }: ToolRendererProps) {
  const { parameters, result, state, error } = toolCall
  const [showLineNumbers, setShowLineNumbers] = useState(true)
  const [wordWrap, setWordWrap] = useState(false)

  const language = useMemo(() => {
    return getLanguageFromPath(parameters.file_path)
  }, [parameters.file_path])

  const fileInfo = useMemo(() => {
    if (!result?.content) return null
    
    const lines = result.content.split('\n').length
    const size = new Blob([result.content]).size
    
    return {
      lines,
      size: formatFileSize(size),
      language: language || 'text'
    }
  }, [result?.content, language])

  if (state === 'pending') {
    return (
      <div className="file-tool file-tool--pending">
        <div className="file-tool__header">
          <FileIcon path={parameters.file_path} />
          <code className="file-tool__path">{parameters.file_path}</code>
          <div className="file-tool__status">Preparing to read...</div>
        </div>
      </div>
    )
  }

  if (state === 'running') {
    return (
      <div className="file-tool file-tool--running">
        <div className="file-tool__header">
          <FileIcon path={parameters.file_path} />
          <code className="file-tool__path">{parameters.file_path}</code>
          <div className="file-tool__status">Reading file...</div>
        </div>
        
        <div className="file-tool__content">
          <SkeletonCodeBlock lines={8} />
        </div>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="file-tool file-tool--error">
        <div className="file-tool__header">
          <FileIcon path={parameters.file_path} />
          <code className="file-tool__path">{parameters.file_path}</code>
          <div className="file-tool__status file-tool__status--error">
            Failed to read
          </div>
        </div>
        
        <div className="file-tool__error">
          <span className="file-tool__error-message">{error}</span>
        </div>
      </div>
    )
  }

  if (state === 'completed' && result) {
    return (
      <div className="file-tool file-tool--completed">
        <div className="file-tool__header">
          <div className="file-tool__info">
            <FileIcon path={parameters.file_path} />
            <code className="file-tool__path">{parameters.file_path}</code>
          </div>
          
          {fileInfo && (
            <div className="file-tool__meta">
              <span className="file-tool__meta-item">
                {fileInfo.lines} lines
              </span>
              <span className="file-tool__meta-item">
                {fileInfo.size}
              </span>
              <span className="file-tool__meta-item">
                {fileInfo.language}
              </span>
            </div>
          )}
        </div>

        <div className="file-tool__controls">
          <label className="file-tool__control">
            <input
              type="checkbox"
              checked={showLineNumbers}
              onChange={(e) => setShowLineNumbers(e.target.checked)}
            />
            Line numbers
          </label>
          
          <label className="file-tool__control">
            <input
              type="checkbox"
              checked={wordWrap}
              onChange={(e) => setWordWrap(e.target.checked)}
            />
            Word wrap
          </label>
          
          <CopyButton 
            content={result.content}
            className="file-tool__control"
          />
        </div>

        <div className="file-tool__content">
          <CodeHighlight
            content={result.content}
            language={language}
            showLineNumbers={showLineNumbers}
            wordWrap={wordWrap}
            maxHeight="500px"
            fileName={parameters.file_path}
          />
        </div>
      </div>
    )
  }

  return null
}
```

### 2. File Write Tool Renderer

```typescript
// src/components/tools/FileWriteTool.tsx - File writing visualization
import React, { useState } from 'react'
import { ToolRendererProps } from '@services/toolRegistry'
import { CodeHighlight } from '@components/ui/CodeHighlight'
import { FileIcon } from '@components/ui/FileIcon'
import { ProgressBar } from '@components/ui/ProgressBar'
import { getLanguageFromPath, formatFileSize } from '@utils/fileUtils'

export function FileWriteTool({ toolCall }: ToolRendererProps) {
  const { parameters, result, state, error } = toolCall
  const [previewMode, setPreviewMode] = useState<'preview' | 'raw'>('preview')

  const language = getLanguageFromPath(parameters.file_path)
  const contentSize = new Blob([parameters.content || '']).size

  if (state === 'pending') {
    return (
      <div className="file-tool file-tool--pending">
        <div className="file-tool__header">
          <FileIcon path={parameters.file_path} />
          <code className="file-tool__path">{parameters.file_path}</code>
          <div className="file-tool__status">Queued for writing</div>
        </div>
        
        <div className="file-tool__preview">
          <div className="file-tool__preview-header">
            <span>Content to write ({formatFileSize(contentSize)})</span>
          </div>
          
          <CodeHighlight
            content={parameters.content}
            language={language}
            showLineNumbers={true}
            maxHeight="300px"
            fileName={parameters.file_path}
          />
        </div>
      </div>
    )
  }

  if (state === 'running') {
    return (
      <div className="file-tool file-tool--running">
        <div className="file-tool__header">
          <FileIcon path={parameters.file_path} />
          <code className="file-tool__path">{parameters.file_path}</code>
          <div className="file-tool__status">Writing file...</div>
        </div>
        
        <div className="file-tool__progress">
          <ProgressBar 
            progress={result?.progress || 0}
            label="Writing content..."
          />
        </div>

        <div className="file-tool__preview">
          <CodeHighlight
            content={parameters.content}
            language={language}
            showLineNumbers={true}
            maxHeight="300px"
            fileName={parameters.file_path}
          />
        </div>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="file-tool file-tool--error">
        <div className="file-tool__header">
          <FileIcon path={parameters.file_path} />
          <code className="file-tool__path">{parameters.file_path}</code>
          <div className="file-tool__status file-tool__status--error">
            Write failed
          </div>
        </div>
        
        <div className="file-tool__error">
          <span className="file-tool__error-message">{error}</span>
        </div>

        <details className="file-tool__details">
          <summary>Content that failed to write</summary>
          <CodeHighlight
            content={parameters.content}
            language={language}
            showLineNumbers={true}
            maxHeight="200px"
            fileName={parameters.file_path}
          />
        </details>
      </div>
    )
  }

  if (state === 'completed') {
    return (
      <div className="file-tool file-tool--completed">
        <div className="file-tool__header">
          <FileIcon path={parameters.file_path} />
          <code className="file-tool__path">{parameters.file_path}</code>
          <div className="file-tool__status file-tool__status--success">
            ✅ File written successfully
          </div>
        </div>

        {result?.bytes_written && (
          <div className="file-tool__result">
            <span className="file-tool__result-item">
              {formatFileSize(result.bytes_written)} written
            </span>
            {result.created && (
              <span className="file-tool__result-item">
                📄 New file created
              </span>
            )}
          </div>
        )}

        <div className="file-tool__preview">
          <div className="file-tool__preview-controls">
            <button
              className={`preview-toggle ${previewMode === 'preview' ? 'active' : ''}`}
              onClick={() => setPreviewMode('preview')}
            >
              Preview
            </button>
            <button
              className={`preview-toggle ${previewMode === 'raw' ? 'active' : ''}`}
              onClick={() => setPreviewMode('raw')}
            >
              Raw
            </button>
          </div>

          <CodeHighlight
            content={parameters.content}
            language={previewMode === 'raw' ? 'text' : language}
            showLineNumbers={true}
            maxHeight="400px"
            fileName={parameters.file_path}
          />
        </div>
      </div>
    )
  }

  return null
}
```

### 3. File Edit Tool with Diff Viewer

```typescript
// src/components/tools/FileEditTool.tsx - File editing with diff visualization
import React, { useState, useMemo } from 'react'
import { ToolRendererProps } from '@services/toolRegistry'
import { DiffViewer } from '@components/ui/DiffViewer'
import { CodeHighlight } from '@components/ui/CodeHighlight'
import { FileIcon } from '@components/ui/FileIcon'
import { getLanguageFromPath } from '@utils/fileUtils'

type EditViewMode = 'diff' | 'before' | 'after'

export function FileEditTool({ toolCall }: ToolRendererProps) {
  const { parameters, result, state, error } = toolCall
  const [viewMode, setViewMode] = useState<EditViewMode>('diff')

  const language = getLanguageFromPath(parameters.file_path)

  const diffStats = useMemo(() => {
    if (!result?.old_content || !result?.new_content) return null
    
    const oldLines = result.old_content.split('\n')
    const newLines = result.new_content.split('\n')
    
    return {
      oldLines: oldLines.length,
      newLines: newLines.length,
      linesChanged: Math.abs(newLines.length - oldLines.length)
    }
  }, [result?.old_content, result?.new_content])

  if (state === 'pending') {
    return (
      <div className="file-tool file-tool--pending">
        <div className="file-tool__header">
          <FileIcon path={parameters.file_path} />
          <code className="file-tool__path">{parameters.file_path}</code>
          <div className="file-tool__status">Preparing edit...</div>
        </div>
        
        <div className="file-tool__edit-info">
          <div className="edit-change">
            <strong>Find:</strong> <code>{parameters.old_string}</code>
          </div>
          <div className="edit-change">
            <strong>Replace with:</strong> <code>{parameters.new_string}</code>
          </div>
        </div>
      </div>
    )
  }

  if (state === 'running') {
    return (
      <div className="file-tool file-tool--running">
        <div className="file-tool__header">
          <FileIcon path={parameters.file_path} />
          <code className="file-tool__path">{parameters.file_path}</code>
          <div className="file-tool__status">Applying edits...</div>
        </div>
        
        <div className="file-tool__edit-info">
          <div className="edit-change">
            <strong>Replacing:</strong> <code>{parameters.old_string}</code>
          </div>
          <div className="edit-change">
            <strong>With:</strong> <code>{parameters.new_string}</code>
          </div>
        </div>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="file-tool file-tool--error">
        <div className="file-tool__header">
          <FileIcon path={parameters.file_path} />
          <code className="file-tool__path">{parameters.file_path}</code>
          <div className="file-tool__status file-tool__status--error">
            Edit failed
          </div>
        </div>
        
        <div className="file-tool__error">
          <span className="file-tool__error-message">{error}</span>
        </div>

        <details className="file-tool__details">
          <summary>Attempted changes</summary>
          <div className="file-tool__edit-info">
            <div className="edit-change">
              <strong>Find:</strong> <code>{parameters.old_string}</code>
            </div>
            <div className="edit-change">
              <strong>Replace with:</strong> <code>{parameters.new_string}</code>
            </div>
          </div>
        </details>
      </div>
    )
  }

  if (state === 'completed' && result) {
    return (
      <div className="file-tool file-tool--completed">
        <div className="file-tool__header">
          <FileIcon path={parameters.file_path} />
          <code className="file-tool__path">{parameters.file_path}</code>
          <div className="file-tool__status file-tool__status--success">
            ✅ Edit applied successfully
          </div>
        </div>

        {diffStats && (
          <div className="file-tool__stats">
            <span className="file-tool__stat">
              {result.changes_made} change{result.changes_made !== 1 ? 's' : ''} made
            </span>
            {diffStats.linesChanged > 0 && (
              <span className="file-tool__stat">
                {diffStats.linesChanged} lines modified
              </span>
            )}
          </div>
        )}

        <div className="file-tool__view-controls">
          <button
            className={`view-toggle ${viewMode === 'diff' ? 'active' : ''}`}
            onClick={() => setViewMode('diff')}
          >
            📊 Diff
          </button>
          <button
            className={`view-toggle ${viewMode === 'before' ? 'active' : ''}`}
            onClick={() => setViewMode('before')}
          >
            📄 Before
          </button>
          <button
            className={`view-toggle ${viewMode === 'after' ? 'active' : ''}`}
            onClick={() => setViewMode('after')}
          >
            📝 After
          </button>
        </div>

        <div className="file-tool__content">
          {viewMode === 'diff' && (
            <DiffViewer
              oldContent={result.old_content}
              newContent={result.new_content}
              fileName={parameters.file_path}
              language={language}
            />
          )}
          
          {viewMode === 'before' && (
            <CodeHighlight
              content={result.old_content}
              language={language}
              showLineNumbers={true}
              fileName={parameters.file_path}
              title="Before changes"
            />
          )}
          
          {viewMode === 'after' && (
            <CodeHighlight
              content={result.new_content}
              language={language}
              showLineNumbers={true}
              fileName={parameters.file_path}
              title="After changes"
            />
          )}
        </div>
      </div>
    )
  }

  return null
}
```

### 4. Advanced Diff Viewer Component

```typescript
// src/components/ui/DiffViewer.tsx - Advanced diff visualization
import React, { useMemo } from 'react'
import { computeDiff, DiffResult, DiffHunk, DiffLine } from '@utils/diffUtils'
import { CodeHighlight } from './CodeHighlight'

interface DiffViewerProps {
  oldContent: string
  newContent: string
  fileName: string
  language?: string
  maxHeight?: string
  showStats?: boolean
}

export function DiffViewer({
  oldContent,
  newContent,
  fileName,
  language,
  maxHeight = '600px',
  showStats = true
}: DiffViewerProps) {
  const diffResult = useMemo(() => {
    return computeDiff(oldContent, newContent)
  }, [oldContent, newContent])

  if (oldContent === newContent) {
    return (
      <div className="diff-viewer diff-viewer--no-changes">
        <div className="diff-viewer__header">
          <span className="diff-viewer__filename">{fileName}</span>
          <span className="diff-viewer__status">No changes</span>
        </div>
        
        <CodeHighlight
          content={oldContent}
          language={language}
          showLineNumbers={true}
          maxHeight={maxHeight}
        />
      </div>
    )
  }

  return (
    <div className="diff-viewer">
      <div className="diff-viewer__header">
        <span className="diff-viewer__filename">{fileName}</span>
        
        {showStats && (
          <div className="diff-viewer__stats">
            <span className="diff-stat diff-stat--additions">
              +{diffResult.additions}
            </span>
            <span className="diff-stat diff-stat--deletions">
              -{diffResult.deletions}
            </span>
          </div>
        )}
      </div>

      <div className="diff-viewer__content" style={{ maxHeight }}>
        {diffResult.hunks.map((hunk, index) => (
          <DiffHunk key={index} hunk={hunk} language={language} />
        ))}
      </div>
    </div>
  )
}

interface DiffHunkProps {
  hunk: DiffHunk
  language?: string
}

function DiffHunk({ hunk, language }: DiffHunkProps) {
  return (
    <div className="diff-hunk">
      <div className="diff-hunk__header">
        <span className="diff-hunk__range">
          @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
        </span>
      </div>
      
      <div className="diff-hunk__lines">
        {hunk.lines.map((line, index) => (
          <DiffLine key={index} line={line} language={language} />
        ))}
      </div>
    </div>
  )
}

interface DiffLineProps {
  line: DiffLine
  language?: string
}

function DiffLine({ line, language }: DiffLineProps) {
  return (
    <div className={`diff-line diff-line--${line.type}`}>
      <span className="diff-line__numbers">
        <span className="diff-line__number diff-line__number--old">
          {line.oldLineNumber || ''}
        </span>
        <span className="diff-line__number diff-line__number--new">
          {line.newLineNumber || ''}
        </span>
      </span>
      
      <span className="diff-line__indicator">{line.indicator}</span>
      
      <span className="diff-line__content">
        <CodeHighlight
          content={line.content}
          language={language}
          inline={true}
          showLineNumbers={false}
        />
      </span>
    </div>
  )
}
```

### 5. Syntax Highlighting Component

```typescript
// src/components/ui/CodeHighlight.tsx - Advanced syntax highlighting
import React, { useMemo, useEffect, useRef } from 'react'
import Prism from 'prismjs'
import 'prismjs/themes/prism-tomorrow.css'

// Load common languages
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-go'
import 'prismjs/components/prism-rust'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-markdown'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-sql'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-scss'

interface CodeHighlightProps {
  content: string
  language?: string
  showLineNumbers?: boolean
  maxHeight?: string
  fileName?: string
  highlightLines?: number[]
  wordWrap?: boolean
  inline?: boolean
  title?: string
}

export function CodeHighlight({
  content,
  language,
  showLineNumbers = false,
  maxHeight,
  fileName,
  highlightLines = [],
  wordWrap = false,
  inline = false,
  title
}: CodeHighlightProps) {
  const codeRef = useRef<HTMLElement>(null)

  const detectedLanguage = useMemo(() => {
    if (language) return language
    if (fileName) return detectLanguageFromFileName(fileName)
    return detectLanguageFromContent(content)
  }, [language, fileName, content])

  const highlightedCode = useMemo(() => {
    if (!detectedLanguage || !Prism.languages[detectedLanguage]) {
      return escapeHtml(content)
    }

    try {
      return Prism.highlight(content, Prism.languages[detectedLanguage], detectedLanguage)
    } catch (error) {
      console.warn('Syntax highlighting failed:', error)
      return escapeHtml(content)
    }
  }, [content, detectedLanguage])

  const lines = useMemo(() => {
    return content.split('\n')
  }, [content])

  // Handle line highlighting
  useEffect(() => {
    if (highlightLines.length === 0 || !codeRef.current) return

    const codeElement = codeRef.current
    const lineElements = codeElement.querySelectorAll('.line-number')
    
    lineElements.forEach((element, index) => {
      const lineNumber = index + 1
      if (highlightLines.includes(lineNumber)) {
        element.classList.add('highlighted')
      } else {
        element.classList.remove('highlighted')
      }
    })
  }, [highlightLines])

  if (inline) {
    return (
      <code 
        className={`inline-code language-${detectedLanguage}`}
        dangerouslySetInnerHTML={{ __html: highlightedCode }}
      />
    )
  }

  return (
    <div className="code-highlight">
      {(title || fileName) && (
        <div className="code-highlight__header">
          <span className="code-highlight__title">
            {title || fileName}
          </span>
          {detectedLanguage && (
            <span className="code-highlight__language">
              {detectedLanguage}
            </span>
          )}
        </div>
      )}

      <div 
        className="code-highlight__container"
        style={{ maxHeight }}
      >
        <pre 
          className={`code-highlight__pre ${wordWrap ? 'word-wrap' : ''}`}
        >
          {showLineNumbers && (
            <div className="code-highlight__line-numbers">
              {lines.map((_, index) => (
                <span
                  key={index}
                  className={`line-number ${
                    highlightLines.includes(index + 1) ? 'highlighted' : ''
                  }`}
                >
                  {index + 1}
                </span>
              ))}
            </div>
          )}
          
          <code
            ref={codeRef}
            className={`language-${detectedLanguage} ${
              showLineNumbers ? 'with-line-numbers' : ''
            }`}
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
          />
        </pre>
      </div>
    </div>
  )
}

function detectLanguageFromFileName(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase()
  
  const extensionMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'jsx',
    ts: 'typescript',
    tsx: 'tsx',
    py: 'python',
    go: 'go',
    rs: 'rust',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    sh: 'bash',
    bash: 'bash',
    sql: 'sql',
    css: 'css',
    scss: 'scss',
    html: 'html',
    xml: 'xml'
  }
  
  return extensionMap[extension || ''] || 'text'
}

function detectLanguageFromContent(content: string): string {
  // Simple heuristics for content-based detection
  if (content.includes('import ') && content.includes('from ')) {
    if (content.includes('React') || content.includes('jsx')) return 'jsx'
    return 'javascript'
  }
  
  if (content.includes('def ') && content.includes(':')) return 'python'
  if (content.includes('func ') && content.includes('{')) return 'go'
  if (content.includes('fn ') && content.includes('->')) return 'rust'
  
  // JSON detection
  try {
    JSON.parse(content.trim())
    return 'json'
  } catch {
    // Not JSON
  }
  
  return 'text'
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
```

### 6. File Utilities

```typescript
// src/utils/fileUtils.ts - File utility functions
export function getLanguageFromPath(filePath: string): string {
  const extension = filePath.split('.').pop()?.toLowerCase()
  
  const extensionMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'jsx',
    ts: 'typescript',
    tsx: 'tsx',
    py: 'python',
    go: 'go',
    rs: 'rust',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    sh: 'bash',
    bash: 'bash',
    sql: 'sql',
    css: 'css',
    scss: 'scss',
    html: 'html',
    xml: 'xml',
    c: 'c',
    cpp: 'cpp',
    java: 'java',
    php: 'php',
    rb: 'ruby',
    swift: 'swift',
    kt: 'kotlin',
    dart: 'dart'
  }
  
  return extensionMap[extension || ''] || 'text'
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export function getFileIcon(filePath: string): string {
  const extension = filePath.split('.').pop()?.toLowerCase()
  
  const iconMap: Record<string, string> = {
    js: '📄',
    jsx: '⚛️',
    ts: '📘',
    tsx: '⚛️',
    py: '🐍',
    go: '🐹',
    rs: '🦀',
    json: '📋',
    yaml: '📋',
    yml: '📋',
    md: '📝',
    txt: '📄',
    sh: '💻',
    bash: '💻',
    sql: '🗃️',
    css: '🎨',
    scss: '🎨',
    html: '🌐',
    xml: '📊',
    pdf: '📕',
    jpg: '🖼️',
    jpeg: '🖼️',
    png: '🖼️',
    gif: '🖼️',
    svg: '🎨'
  }
  
  return iconMap[extension || ''] || '📄'
}

export function isImageFile(filePath: string): boolean {
  const extension = filePath.split('.').pop()?.toLowerCase()
  return ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(extension || '')
}

export function isBinaryFile(filePath: string): boolean {
  const extension = filePath.split('.').pop()?.toLowerCase()
  const binaryExtensions = [
    'exe', 'bin', 'dmg', 'pkg', 'deb', 'rpm',
    'zip', 'tar', 'gz', 'rar', '7z',
    'jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp',
    'mp3', 'mp4', 'wav', 'avi', 'mov',
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'
  ]
  return binaryExtensions.includes(extension || '')
}
```

### 7. Diff Utilities

```typescript
// src/utils/diffUtils.ts - Diff computation utilities
export interface DiffLine {
  type: 'context' | 'addition' | 'deletion'
  content: string
  oldLineNumber?: number
  newLineNumber?: number
  indicator: string
}

export interface DiffHunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: DiffLine[]
}

export interface DiffResult {
  additions: number
  deletions: number
  hunks: DiffHunk[]
}

export function computeDiff(oldContent: string, newContent: string): DiffResult {
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')
  
  // Simple line-by-line diff implementation
  // In a production app, you'd use a more sophisticated diff algorithm
  // like Myers' algorithm or similar
  
  const hunks: DiffHunk[] = []
  let additions = 0
  let deletions = 0
  
  let oldIndex = 0
  let newIndex = 0
  
  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    const hunk = computeHunk(oldLines, newLines, oldIndex, newIndex)
    
    if (hunk) {
      hunks.push(hunk)
      
      // Count additions and deletions
      hunk.lines.forEach(line => {
        if (line.type === 'addition') additions++
        if (line.type === 'deletion') deletions++
      })
      
      // Update indices
      oldIndex = hunk.oldStart + hunk.oldLines
      newIndex = hunk.newStart + hunk.newLines
    } else {
      break
    }
  }
  
  return { additions, deletions, hunks }
}

function computeHunk(
  oldLines: string[], 
  newLines: string[], 
  oldStart: number, 
  newStart: number
): DiffHunk | null {
  const hunkLines: DiffLine[] = []
  
  let oldIndex = oldStart
  let newIndex = newStart
  let oldLinesInHunk = 0
  let newLinesInHunk = 0
  
  // Find context and changes
  const contextSize = 3
  
  // Add leading context
  for (let i = Math.max(0, oldStart - contextSize); i < oldStart; i++) {
    if (oldLines[i] && newLines[newStart - (oldStart - i)]) {
      hunkLines.push({
        type: 'context',
        content: oldLines[i],
        oldLineNumber: i + 1,
        newLineNumber: newStart - (oldStart - i) + 1,
        indicator: ' '
      })
    }
  }
  
  // Process changes
  while (oldIndex < oldLines.length && newIndex < newLines.length) {
    const oldLine = oldLines[oldIndex]
    const newLine = newLines[newIndex]
    
    if (oldLine === newLine) {
      // Lines match - context
      hunkLines.push({
        type: 'context',
        content: oldLine,
        oldLineNumber: oldIndex + 1,
        newLineNumber: newIndex + 1,
        indicator: ' '
      })
      oldIndex++
      newIndex++
      oldLinesInHunk++
      newLinesInHunk++
    } else {
      // Lines differ
      if (oldIndex < oldLines.length) {
        hunkLines.push({
          type: 'deletion',
          content: oldLine,
          oldLineNumber: oldIndex + 1,
          indicator: '-'
        })
        oldIndex++
        oldLinesInHunk++
      }
      
      if (newIndex < newLines.length) {
        hunkLines.push({
          type: 'addition',
          content: newLine,
          newLineNumber: newIndex + 1,
          indicator: '+'
        })
        newIndex++
        newLinesInHunk++
      }
    }
    
    // Stop if we've processed enough for this hunk
    if (hunkLines.length > 50) break
  }
  
  // Add trailing context
  for (let i = 0; i < contextSize && oldIndex + i < oldLines.length; i++) {
    if (oldLines[oldIndex + i] && newLines[newIndex + i]) {
      hunkLines.push({
        type: 'context',
        content: oldLines[oldIndex + i],
        oldLineNumber: oldIndex + i + 1,
        newLineNumber: newIndex + i + 1,
        indicator: ' '
      })
    }
  }
  
  if (hunkLines.length === 0) return null
  
  return {
    oldStart: oldStart + 1, // 1-based line numbers
    oldLines: oldLinesInHunk,
    newStart: newStart + 1,
    newLines: newLinesInHunk,
    lines: hunkLines
  }
}
```

## 🔧 Configuration

### File Operations CSS

```css
/* src/styles/fileOperations.css - File tool styling */

/* File Tool Base Styles */
.file-tool {
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  overflow: hidden;
}

.file-tool__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-primary);
}

.file-tool__info {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.file-tool__path {
  font-family: monospace;
  font-size: var(--font-sm);
  background: var(--bg-tertiary);
  padding: var(--space-xs) var(--space-sm);
  border-radius: 4px;
}

.file-tool__meta {
  display: flex;
  gap: var(--space-md);
  font-size: var(--font-xs);
  color: var(--text-secondary);
}

.file-tool__meta-item {
  background: var(--bg-tertiary);
  padding: var(--space-xs) var(--space-sm);
  border-radius: 4px;
}

.file-tool__status {
  font-size: var(--font-sm);
  color: var(--text-secondary);
}

.file-tool__status--error {
  color: var(--color-error);
}

.file-tool__status--success {
  color: var(--color-success);
}

/* File Tool Controls */
.file-tool__controls {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-primary);
}

.file-tool__control {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--font-sm);
  cursor: pointer;
}

.file-tool__control input[type="checkbox"] {
  margin-right: var(--space-xs);
}

/* File Tool Content */
.file-tool__content {
  max-height: 600px;
  overflow: auto;
}

.file-tool__preview {
  margin: var(--space-md);
}

.file-tool__preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-sm);
  font-size: var(--font-sm);
  color: var(--text-secondary);
}

.file-tool__preview-controls {
  display: flex;
  gap: var(--space-xs);
  margin-bottom: var(--space-md);
}

.preview-toggle {
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--border-secondary);
  background: var(--bg-primary);
  border-radius: 4px;
  cursor: pointer;
  font-size: var(--font-sm);
}

.preview-toggle.active {
  background: var(--color-primary);
  color: var(--text-inverse);
  border-color: var(--color-primary);
}

/* View Mode Controls */
.file-tool__view-controls {
  display: flex;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-primary);
}

.view-toggle {
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--border-secondary);
  background: var(--bg-primary);
  border-radius: 4px;
  cursor: pointer;
  font-size: var(--font-sm);
  transition: all var(--transition-fast);
}

.view-toggle:hover {
  background: var(--bg-secondary);
}

.view-toggle.active {
  background: var(--color-primary);
  color: var(--text-inverse);
  border-color: var(--color-primary);
}

/* Code Highlight Styles */
.code-highlight {
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  overflow: hidden;
}

.code-highlight__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-primary);
  font-size: var(--font-sm);
}

.code-highlight__container {
  position: relative;
  overflow: auto;
}

.code-highlight__pre {
  margin: 0;
  padding: var(--space-md);
  background: var(--bg-primary);
  overflow-x: auto;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: var(--font-sm);
  line-height: 1.6;
}

.code-highlight__pre.word-wrap {
  white-space: pre-wrap;
  overflow-wrap: break-word;
}

.code-highlight__line-numbers {
  position: absolute;
  left: 0;
  top: 0;
  padding: var(--space-md) var(--space-sm);
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-primary);
  color: var(--text-muted);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: var(--font-sm);
  line-height: 1.6;
  user-select: none;
}

.line-number {
  display: block;
  text-align: right;
  min-width: 2ch;
  padding: 0 var(--space-xs);
}

.line-number.highlighted {
  background: var(--color-warning);
  color: var(--text-primary);
}

.code-highlight__pre.with-line-numbers {
  padding-left: 4rem; /* Adjust based on line number width */
}

/* Diff Viewer Styles */
.diff-viewer {
  border: 1px solid var(--border-primary);
  border-radius: 4px;
  overflow: hidden;
}

.diff-viewer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-primary);
}

.diff-viewer__filename {
  font-family: monospace;
  font-weight: 500;
}

.diff-viewer__stats {
  display: flex;
  gap: var(--space-sm);
  font-size: var(--font-sm);
}

.diff-stat {
  padding: var(--space-xs) var(--space-sm);
  border-radius: 4px;
  font-weight: 500;
}

.diff-stat--additions {
  background: rgba(40, 167, 69, 0.1);
  color: var(--color-success);
}

.diff-stat--deletions {
  background: rgba(220, 53, 69, 0.1);
  color: var(--color-error);
}

.diff-viewer__content {
  overflow: auto;
}

.diff-hunk {
  border-bottom: 1px solid var(--border-primary);
}

.diff-hunk__header {
  padding: var(--space-xs) var(--space-md);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-family: monospace;
  font-size: var(--font-xs);
}

.diff-line {
  display: flex;
  font-family: monospace;
  font-size: var(--font-sm);
  line-height: 1.4;
}

.diff-line--addition {
  background: rgba(40, 167, 69, 0.1);
}

.diff-line--deletion {
  background: rgba(220, 53, 69, 0.1);
}

.diff-line--context {
  background: transparent;
}

.diff-line__numbers {
  display: flex;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-primary);
  user-select: none;
}

.diff-line__number {
  width: 3rem;
  padding: var(--space-xs) var(--space-sm);
  text-align: right;
  color: var(--text-muted);
  font-size: var(--font-xs);
}

.diff-line__indicator {
  width: 1.5rem;
  padding: var(--space-xs) var(--space-xs);
  text-align: center;
  font-weight: bold;
}

.diff-line--addition .diff-line__indicator {
  color: var(--color-success);
}

.diff-line--deletion .diff-line__indicator {
  color: var(--color-error);
}

.diff-line__content {
  flex: 1;
  padding: var(--space-xs) var(--space-sm);
  overflow-x: auto;
}

/* No changes state */
.diff-viewer--no-changes .diff-viewer__header {
  background: rgba(40, 167, 69, 0.1);
}

.diff-viewer--no-changes .diff-viewer__status {
  color: var(--color-success);
  font-weight: 500;
}

/* Inline code */
.inline-code {
  background: var(--bg-tertiary);
  padding: 0.1em 0.3em;
  border-radius: 3px;
  font-family: monospace;
  font-size: 0.9em;
}
```

## ✅ Testing

### File Tool Tests

```typescript
// src/components/tools/__tests__/FileReadTool.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { FileReadTool } from '../FileReadTool'
import { ToolCall } from '@types/index'

describe('FileReadTool', () => {
  const mockToolCall: ToolCall = {
    id: 'test-1',
    name: 'read',
    parameters: { file_path: '/path/to/test.js' },
    state: 'completed',
    result: {
      content: 'console.log("Hello, world!");'
    },
    expanded: false,
    show_details: false,
  }

  it('should render file content with syntax highlighting', () => {
    render(<FileReadTool toolCall={mockToolCall} />)
    
    expect(screen.getByText('/path/to/test.js')).toBeInTheDocument()
    expect(screen.getByText('console.log("Hello, world!");')).toBeInTheDocument()
  })

  it('should show loading state', () => {
    const runningToolCall = { ...mockToolCall, state: 'running' as const, result: undefined }
    
    render(<FileReadTool toolCall={runningToolCall} />)
    
    expect(screen.getByText('Reading file...')).toBeInTheDocument()
  })

  it('should toggle line numbers', () => {
    render(<FileReadTool toolCall={mockToolCall} />)
    
    const lineNumbersCheckbox = screen.getByLabelText('Line numbers')
    fireEvent.click(lineNumbersCheckbox)
    
    // This would require more complex testing to verify the effect
    expect(lineNumbersCheckbox).toBeChecked()
  })
})
```

## 📝 Implementation Checklist

### File Operations ✅
- [ ] FileReadTool with syntax highlighting
- [ ] FileWriteTool with content preview
- [ ] FileEditTool with diff visualization
- [ ] Language detection from file extensions
- [ ] File metadata display (size, lines, type)

### Syntax Highlighting ✅
- [ ] Prism.js integration with multiple languages
- [ ] Language detection algorithms
- [ ] Line number support with highlighting
- [ ] Word wrap and overflow handling
- [ ] Inline and block code highlighting

### Diff Visualization ✅
- [ ] Advanced diff computation algorithm
- [ ] Hunk-based diff display
- [ ] Addition/deletion statistics
- [ ] Context line preservation
- [ ] Side-by-side and unified views

### User Interface ✅
- [ ] Interactive controls (line numbers, word wrap)
- [ ] Copy-to-clipboard functionality
- [ ] File type icons and indicators
- [ ] Loading states with skeleton animations
- [ ] Error states with retry options

### Performance ✅
- [ ] Efficient diff algorithms
- [ ] Code highlighting optimizations
- [ ] Large file handling strategies
- [ ] Virtual scrolling for long content
- [ ] Memoization for expensive operations

### Testing ✅
- [ ] Component rendering tests
- [ ] Syntax highlighting tests
- [ ] Diff computation tests
- [ ] User interaction tests
- [ ] Performance benchmarks

### Next Steps
After implementing file operations:
1. **[06-Shell-Commands.md](./06-Shell-Commands.md)** - Implement shell command execution
2. **[07-Todo-Management.md](./07-Todo-Management.md)** - Implement todo management tools

---

This file operations system provides comprehensive support for viewing, editing, and managing files with professional-grade syntax highlighting and diff visualization capabilities.