# 06-Shell-Commands.md

**Shell Command Execution, ANSI Processing, Terminal Emulation, and Platform Compatibility**

---

## 🎯 Overview

This document covers the implementation of shell command execution in the VS Code extension - including ANSI escape code processing, terminal output rendering, command history, interactive features, and cross-platform shell handling. This system provides rich terminal emulation within the chat interface.

## 🏗️ Architecture

### Shell Command Pipeline
```
Command Input → Platform Detection → Shell Execution → ANSI Processing → Terminal Rendering
      ↓                 ↓                ↓               ↓                  ↓
  User Input →    Shell Selection →  Process Spawn → Escape Code →    Rich Display
                      (bash/cmd)       with Streams    Parsing         with Colors
```

### Command Execution Flow
```
command_request → security_validation → shell_spawn → output_streaming → ansi_rendering
      ↓                   ↓                ↓              ↓                  ↓
  Tool Call →      Permission Check → Child Process → Real-time SSE →    Terminal UI
```

## 💻 Implementation

### 1. Shell Command Tool Renderer

```typescript
// src/components/tools/BashTool.tsx - Shell command execution renderer
import React, { useState, useEffect, useRef } from 'react'
import { ToolRendererProps } from '@types/index'
import { TerminalOutput } from './TerminalOutput'
import { CommandMetadata } from './CommandMetadata'
import { ShellIcon, SpinnerIcon } from '@components/ui/Icons'

export function BashTool({ toolCall }: ToolRendererProps) {
  const { parameters, result, state, error } = toolCall
  const [outputLines, setOutputLines] = useState<string[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const terminalRef = useRef<HTMLDivElement>(null)

  // Handle streaming output updates
  useEffect(() => {
    if (state === 'running' && result?.output) {
      const lines = result.output.split('\n')
      setOutputLines(lines)
      setIsStreaming(true)
      
      // Auto-scroll to bottom
      if (terminalRef.current) {
        terminalRef.current.scrollTop = terminalRef.current.scrollHeight
      }
    } else if (state === 'completed') {
      setIsStreaming(false)
    }
  }, [state, result])

  const getShellIcon = (command: string) => {
    if (command.includes('npm') || command.includes('node')) return '📦'
    if (command.includes('git')) return '🔀'
    if (command.includes('docker')) return '🐳'
    if (command.includes('python') || command.includes('pip')) return '🐍'
    return '💻'
  }

  return (
    <div className="bash-tool">
      <div className="bash-tool__header">
        <div className="bash-tool__info">
          <ShellIcon />
          <span className="bash-tool__command-icon">
            {getShellIcon(parameters.command)}
          </span>
          <code className="bash-tool__command">{parameters.command}</code>
        </div>
        
        <div className="bash-tool__status">
          {state === 'running' && (
            <>
              <SpinnerIcon size={16} />
              <span className="bash-tool__status-text">Running...</span>
            </>
          )}
          {state === 'completed' && result && (
            <span className={`bash-tool__exit-code bash-tool__exit-code--${
              result.exit_code === 0 ? 'success' : 'error'
            }`}>
              Exit {result.exit_code}
            </span>
          )}
        </div>
      </div>

      {parameters.description && (
        <div className="bash-tool__description">
          {parameters.description}
        </div>
      )}

      <div 
        ref={terminalRef}
        className="bash-tool__terminal"
      >
        <TerminalOutput
          lines={outputLines}
          isStreaming={isStreaming}
          command={parameters.command}
          exitCode={result?.exit_code}
          executionTime={result?.execution_time}
        />
      </div>

      {error && (
        <div className="bash-tool__error">
          <span className="bash-tool__error-icon">❌</span>
          <span className="bash-tool__error-message">{error}</span>
        </div>
      )}

      {state === 'completed' && result && (
        <CommandMetadata
          command={parameters.command}
          exitCode={result.exit_code}
          executionTime={result.execution_time}
          workingDirectory={result.working_directory}
          pid={result.pid}
        />
      )}
    </div>
  )
}
```

### 2. Terminal Output Component with ANSI Processing

```typescript
// src/components/tools/TerminalOutput.tsx - Terminal emulation with ANSI support
import React, { useMemo } from 'react'
import { AnsiProcessor } from '@services/ansiProcessor'
import { TerminalLine } from './TerminalLine'

interface TerminalOutputProps {
  lines: string[]
  isStreaming: boolean
  command: string
  exitCode?: number
  executionTime?: number
  maxLines?: number
  showTimestamps?: boolean
  enableScrollback?: boolean
}

export function TerminalOutput({
  lines,
  isStreaming,
  command,
  exitCode,
  executionTime,
  maxLines = 1000,
  showTimestamps = false,
  enableScrollback = true
}: TerminalOutputProps) {
  const ansiProcessor = useMemo(() => new AnsiProcessor(), [])

  // Process ANSI escape codes and format lines
  const processedLines = useMemo(() => {
    const displayLines = enableScrollback ? lines.slice(-maxLines) : lines.slice(0, maxLines)
    
    return displayLines.map((line, index) => {
      const processed = ansiProcessor.processLine(line)
      return {
        id: `line-${index}`,
        content: processed.content,
        styles: processed.styles,
        timestamp: showTimestamps ? new Date().toISOString() : undefined,
        raw: line
      }
    })
  }, [lines, ansiProcessor, maxLines, enableScrollback, showTimestamps])

  return (
    <div className="terminal-output">
      {/* Command prompt line */}
      <div className="terminal-output__prompt">
        <span className="terminal-output__prompt-symbol">$</span>
        <span className="terminal-output__command">{command}</span>
      </div>

      {/* Output lines */}
      <div className="terminal-output__content">
        {processedLines.map((line) => (
          <TerminalLine
            key={line.id}
            content={line.content}
            styles={line.styles}
            timestamp={line.timestamp}
            raw={line.raw}
          />
        ))}
      </div>

      {/* Streaming indicator */}
      {isStreaming && (
        <div className="terminal-output__cursor">
          <span className="terminal-output__cursor-blink">█</span>
        </div>
      )}

      {/* Command completion summary */}
      {!isStreaming && exitCode !== undefined && (
        <div className="terminal-output__summary">
          <span className={`terminal-output__exit-code terminal-output__exit-code--${
            exitCode === 0 ? 'success' : 'error'
          }`}>
            Process exited with code {exitCode}
          </span>
          {executionTime && (
            <span className="terminal-output__execution-time">
              ({executionTime}ms)
            </span>
          )}
        </div>
      )}
    </div>
  )
}
```

### 3. ANSI Escape Code Processor

```typescript
// src/services/ansiProcessor.ts - ANSI escape sequence processing
export interface AnsiStyle {
  color?: string
  backgroundColor?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
}

export interface ProcessedLine {
  content: string
  styles: Array<{
    start: number
    end: number
    style: AnsiStyle
  }>
}

export class AnsiProcessor {
  private static readonly ANSI_REGEX = /\x1b\[[0-9;]*[mGKHfABCDsu]/g
  private static readonly COLOR_MAP: Record<number, string> = {
    30: '#000000', // Black
    31: '#cd0000', // Red
    32: '#00cd00', // Green
    33: '#cdcd00', // Yellow
    34: '#0000ee', // Blue
    35: '#cd00cd', // Magenta
    36: '#00cdcd', // Cyan
    37: '#e5e5e5', // White (light gray)
    90: '#7f7f7f', // Bright black (dark gray)
    91: '#ff0000', // Bright red
    92: '#00ff00', // Bright green
    93: '#ffff00', // Bright yellow
    94: '#5c5cff', // Bright blue
    95: '#ff00ff', // Bright magenta
    96: '#00ffff', // Bright cyan
    97: '#ffffff', // Bright white
  }

  private static readonly BG_COLOR_MAP: Record<number, string> = {
    40: '#000000', // Black background
    41: '#cd0000', // Red background
    42: '#00cd00', // Green background
    43: '#cdcd00', // Yellow background
    44: '#0000ee', // Blue background
    45: '#cd00cd', // Magenta background
    46: '#00cdcd', // Cyan background
    47: '#e5e5e5', // White background
    100: '#7f7f7f', // Bright black background
    101: '#ff0000', // Bright red background
    102: '#00ff00', // Bright green background
    103: '#ffff00', // Bright yellow background
    104: '#5c5cff', // Bright blue background
    105: '#ff00ff', // Bright magenta background
    106: '#00ffff', // Bright cyan background
    107: '#ffffff', // Bright white background
  }

  processLine(line: string): ProcessedLine {
    const segments: Array<{
      text: string
      style: AnsiStyle
    }> = []

    let currentStyle: AnsiStyle = {}
    let position = 0
    let match: RegExpExecArray | null

    // Reset regex
    AnsiProcessor.ANSI_REGEX.lastIndex = 0

    while ((match = AnsiProcessor.ANSI_REGEX.exec(line)) !== null) {
      // Add text before escape sequence
      if (match.index > position) {
        const text = line.substring(position, match.index)
        segments.push({ text, style: { ...currentStyle } })
      }

      // Process escape sequence
      const sequence = match[0]
      currentStyle = this.processEscapeSequence(sequence, currentStyle)
      
      position = match.index + match[0].length
    }

    // Add remaining text
    if (position < line.length) {
      const text = line.substring(position)
      segments.push({ text, style: { ...currentStyle } })
    }

    // Convert segments to styled ranges
    const styles: ProcessedLine['styles'] = []
    let textPosition = 0
    let cleanContent = ''

    for (const segment of segments) {
      const start = textPosition
      const end = textPosition + segment.text.length
      
      if (Object.keys(segment.style).length > 0) {
        styles.push({
          start,
          end,
          style: segment.style
        })
      }
      
      cleanContent += segment.text
      textPosition = end
    }

    return {
      content: cleanContent,
      styles
    }
  }

  private processEscapeSequence(sequence: string, currentStyle: AnsiStyle): AnsiStyle {
    const codes = sequence
      .slice(2, -1) // Remove \x1b[ and final letter
      .split(';')
      .map(code => parseInt(code, 10))
      .filter(code => !isNaN(code))

    const newStyle = { ...currentStyle }

    for (const code of codes) {
      switch (code) {
        case 0:
          // Reset all styles
          return {}
        case 1:
          newStyle.bold = true
          break
        case 3:
          newStyle.italic = true
          break
        case 4:
          newStyle.underline = true
          break
        case 9:
          newStyle.strikethrough = true
          break
        case 22:
          newStyle.bold = false
          break
        case 23:
          newStyle.italic = false
          break
        case 24:
          newStyle.underline = false
          break
        case 29:
          newStyle.strikethrough = false
          break
        default:
          // Handle color codes
          if (AnsiProcessor.COLOR_MAP[code]) {
            newStyle.color = AnsiProcessor.COLOR_MAP[code]
          } else if (AnsiProcessor.BG_COLOR_MAP[code]) {
            newStyle.backgroundColor = AnsiProcessor.BG_COLOR_MAP[code]
          } else if (code >= 38 && code <= 48) {
            // Handle 256-color and RGB sequences (simplified)
            // This would need more complex parsing for full support
          }
          break
      }
    }

    return newStyle
  }

  stripAnsiCodes(text: string): string {
    return text.replace(AnsiProcessor.ANSI_REGEX, '')
  }
}
```

### 4. Terminal Line Component

```typescript
// src/components/tools/TerminalLine.tsx - Individual terminal line with styling
import React from 'react'
import { AnsiStyle } from '@services/ansiProcessor'

interface TerminalLineProps {
  content: string
  styles: Array<{
    start: number
    end: number
    style: AnsiStyle
  }>
  timestamp?: string
  raw?: string
  onClick?: () => void
}

export function TerminalLine({ 
  content, 
  styles, 
  timestamp, 
  raw,
  onClick 
}: TerminalLineProps) {
  // Convert styled ranges to React elements
  const renderStyledContent = () => {
    if (styles.length === 0) {
      return <span className="terminal-line__text">{content}</span>
    }

    const elements: React.ReactNode[] = []
    let lastIndex = 0

    // Sort styles by start position
    const sortedStyles = [...styles].sort((a, b) => a.start - b.start)

    for (const styleRange of sortedStyles) {
      // Add unstyled text before this range
      if (styleRange.start > lastIndex) {
        elements.push(
          <span key={`text-${lastIndex}`} className="terminal-line__text">
            {content.substring(lastIndex, styleRange.start)}
          </span>
        )
      }

      // Add styled text
      const styledText = content.substring(styleRange.start, styleRange.end)
      const inlineStyle = convertAnsiToCSS(styleRange.style)
      
      elements.push(
        <span
          key={`styled-${styleRange.start}`}
          className="terminal-line__styled"
          style={inlineStyle}
        >
          {styledText}
        </span>
      )

      lastIndex = styleRange.end
    }

    // Add remaining unstyled text
    if (lastIndex < content.length) {
      elements.push(
        <span key={`text-${lastIndex}`} className="terminal-line__text">
          {content.substring(lastIndex)}
        </span>
      )
    }

    return <>{elements}</>
  }

  return (
    <div 
      className="terminal-line"
      onClick={onClick}
      title={raw ? `Raw: ${raw}` : undefined}
    >
      {timestamp && (
        <span className="terminal-line__timestamp">
          {new Date(timestamp).toLocaleTimeString()}
        </span>
      )}
      <span className="terminal-line__content">
        {renderStyledContent()}
      </span>
    </div>
  )
}

function convertAnsiToCSS(style: AnsiStyle): React.CSSProperties {
  const cssStyle: React.CSSProperties = {}

  if (style.color) {
    cssStyle.color = style.color
  }

  if (style.backgroundColor) {
    cssStyle.backgroundColor = style.backgroundColor
  }

  if (style.bold) {
    cssStyle.fontWeight = 'bold'
  }

  if (style.italic) {
    cssStyle.fontStyle = 'italic'
  }

  if (style.underline) {
    cssStyle.textDecoration = (cssStyle.textDecoration || '') + ' underline'
  }

  if (style.strikethrough) {
    cssStyle.textDecoration = (cssStyle.textDecoration || '') + ' line-through'
  }

  return cssStyle
}
```

### 5. Command Metadata Component

```typescript
// src/components/tools/CommandMetadata.tsx - Command execution metadata
import React, { useState } from 'react'
import { CopyButton } from '@components/ui/CopyButton'

interface CommandMetadataProps {
  command: string
  exitCode: number
  executionTime: number
  workingDirectory?: string
  pid?: number
  environment?: Record<string, string>
}

export function CommandMetadata({
  command,
  exitCode,
  executionTime,
  workingDirectory,
  pid,
  environment
}: CommandMetadataProps) {
  const [expanded, setExpanded] = useState(false)

  const formatExecutionTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
  }

  const getExitCodeLabel = (code: number) => {
    const commonCodes: Record<number, string> = {
      0: 'Success',
      1: 'General error',
      2: 'Misuse of shell builtins',
      126: 'Command not executable',
      127: 'Command not found',
      128: 'Invalid exit argument',
      129: 'Hangup signal',
      130: 'Interrupt signal (Ctrl+C)',
      131: 'Quit signal',
      132: 'Illegal instruction',
      133: 'Trace trap',
      134: 'Process aborted',
      135: 'Bus error',
      136: 'Floating point exception',
      137: 'Kill signal',
      139: 'Segmentation fault',
      141: 'Broken pipe',
      143: 'Termination signal'
    }
    
    return commonCodes[code] || `Exit code ${code}`
  }

  return (
    <div className="command-metadata">
      <div className="command-metadata__summary">
        <div className="command-metadata__item">
          <span className="command-metadata__label">Status:</span>
          <span className={`command-metadata__value command-metadata__exit-code--${
            exitCode === 0 ? 'success' : 'error'
          }`}>
            {getExitCodeLabel(exitCode)}
          </span>
        </div>

        <div className="command-metadata__item">
          <span className="command-metadata__label">Duration:</span>
          <span className="command-metadata__value">
            {formatExecutionTime(executionTime)}
          </span>
        </div>

        {workingDirectory && (
          <div className="command-metadata__item">
            <span className="command-metadata__label">Directory:</span>
            <code className="command-metadata__path">
              {workingDirectory}
            </code>
            <CopyButton 
              text={workingDirectory}
              size="sm"
              title="Copy directory path"
            />
          </div>
        )}

        <button
          className="command-metadata__toggle"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      {expanded && (
        <div className="command-metadata__details">
          <div className="command-metadata__section">
            <h4 className="command-metadata__section-title">Command</h4>
            <div className="command-metadata__command">
              <code>{command}</code>
              <CopyButton text={command} size="sm" />
            </div>
          </div>

          {pid && (
            <div className="command-metadata__section">
              <h4 className="command-metadata__section-title">Process</h4>
              <div className="command-metadata__item">
                <span className="command-metadata__label">PID:</span>
                <span className="command-metadata__value">{pid}</span>
              </div>
            </div>
          )}

          {environment && Object.keys(environment).length > 0 && (
            <div className="command-metadata__section">
              <h4 className="command-metadata__section-title">Environment</h4>
              <div className="command-metadata__environment">
                {Object.entries(environment).map(([key, value]) => (
                  <div key={key} className="command-metadata__env-var">
                    <code className="command-metadata__env-key">{key}</code>
                    <span>=</span>
                    <code className="command-metadata__env-value">{value}</code>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

### 6. Platform Detection and Shell Selection

```typescript
// src/services/shellDetection.ts - Platform-specific shell detection
export interface ShellInfo {
  name: string
  path: string
  args: string[]
  platform: 'windows' | 'unix'
  supportsColors: boolean
  promptFormat: string
}

export class ShellDetection {
  static detectPlatform(): 'windows' | 'unix' {
    // In browser environment, we need server-side detection
    // This would typically come from the server via API
    return navigator.userAgent.includes('Windows') ? 'windows' : 'unix'
  }

  static getDefaultShell(platform: 'windows' | 'unix'): ShellInfo {
    if (platform === 'windows') {
      return {
        name: 'PowerShell',
        path: 'powershell.exe',
        args: ['-NoProfile', '-Command'],
        platform: 'windows',
        supportsColors: true,
        promptFormat: 'PS> '
      }
    } else {
      return {
        name: 'Bash',
        path: '/bin/bash',
        args: ['-c'],
        platform: 'unix',
        supportsColors: true,
        promptFormat: '$ '
      }
    }
  }

  static getAvailableShells(platform: 'windows' | 'unix'): ShellInfo[] {
    if (platform === 'windows') {
      return [
        {
          name: 'PowerShell',
          path: 'powershell.exe',
          args: ['-NoProfile', '-Command'],
          platform: 'windows',
          supportsColors: true,
          promptFormat: 'PS> '
        },
        {
          name: 'Command Prompt',
          path: 'cmd.exe',
          args: ['/c'],
          platform: 'windows',
          supportsColors: false,
          promptFormat: 'C:\\> '
        },
        {
          name: 'WSL Bash',
          path: 'wsl.exe',
          args: ['--'],
          platform: 'unix',
          supportsColors: true,
          promptFormat: '$ '
        }
      ]
    } else {
      return [
        {
          name: 'Bash',
          path: '/bin/bash',
          args: ['-c'],
          platform: 'unix',
          supportsColors: true,
          promptFormat: '$ '
        },
        {
          name: 'Zsh',
          path: '/bin/zsh',
          args: ['-c'],
          platform: 'unix',
          supportsColors: true,
          promptFormat: '% '
        },
        {
          name: 'Fish',
          path: '/usr/bin/fish',
          args: ['-c'],
          platform: 'unix',
          supportsColors: true,
          promptFormat: '> '
        }
      ]
    }
  }

  static formatCommand(command: string, shell: ShellInfo): string {
    if (shell.platform === 'windows' && shell.name === 'PowerShell') {
      // Escape PowerShell special characters
      return command
        .replace(/'/g, "''")
        .replace(/`/g, '``')
    }
    
    if (shell.platform === 'windows' && shell.name === 'Command Prompt') {
      // Escape CMD special characters
      return command
        .replace(/([&|<>^])/g, '^$1')
        .replace(/%/g, '%%')
    }

    // Unix shells - escape bash special characters
    return command
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'")
      .replace(/`/g, '\\`')
  }
}
```

### 7. Command History and Completion

```typescript
// src/services/commandHistory.ts - Command history management
export interface CommandHistoryEntry {
  id: string
  command: string
  timestamp: number
  exitCode?: number
  executionTime?: number
  workingDirectory?: string
  tags?: string[]
}

export class CommandHistory {
  private static readonly STORAGE_KEY = 'opencode-command-history'
  private static readonly MAX_ENTRIES = 1000

  private entries: CommandHistoryEntry[] = []

  constructor() {
    this.load()
  }

  add(entry: Omit<CommandHistoryEntry, 'id' | 'timestamp'>): void {
    const historyEntry: CommandHistoryEntry = {
      ...entry,
      id: this.generateId(),
      timestamp: Date.now()
    }

    // Prevent duplicate consecutive commands
    const lastEntry = this.entries[this.entries.length - 1]
    if (lastEntry && lastEntry.command === entry.command) {
      return
    }

    this.entries.push(historyEntry)

    // Trim to max entries
    if (this.entries.length > CommandHistory.MAX_ENTRIES) {
      this.entries = this.entries.slice(-CommandHistory.MAX_ENTRIES)
    }

    this.save()
  }

  getAll(): CommandHistoryEntry[] {
    return [...this.entries].reverse() // Most recent first
  }

  search(query: string): CommandHistoryEntry[] {
    const normalizedQuery = query.toLowerCase()
    return this.entries
      .filter(entry => 
        entry.command.toLowerCase().includes(normalizedQuery) ||
        entry.tags?.some(tag => tag.toLowerCase().includes(normalizedQuery))
      )
      .reverse()
  }

  getByDirectory(directory: string): CommandHistoryEntry[] {
    return this.entries
      .filter(entry => entry.workingDirectory === directory)
      .reverse()
  }

  getFrequentCommands(limit: number = 10): Array<{ command: string; count: number }> {
    const commandCounts = new Map<string, number>()
    
    for (const entry of this.entries) {
      const baseCommand = entry.command.split(' ')[0]
      commandCounts.set(baseCommand, (commandCounts.get(baseCommand) || 0) + 1)
    }

    return Array.from(commandCounts.entries())
      .map(([command, count]) => ({ command, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  }

  clear(): void {
    this.entries = []
    this.save()
  }

  remove(id: string): boolean {
    const initialLength = this.entries.length
    this.entries = this.entries.filter(entry => entry.id !== id)
    
    if (this.entries.length < initialLength) {
      this.save()
      return true
    }
    
    return false
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36)
  }

  private load(): void {
    try {
      const stored = localStorage.getItem(CommandHistory.STORAGE_KEY)
      if (stored) {
        this.entries = JSON.parse(stored)
      }
    } catch (error) {
      console.warn('Failed to load command history:', error)
      this.entries = []
    }
  }

  private save(): void {
    try {
      localStorage.setItem(CommandHistory.STORAGE_KEY, JSON.stringify(this.entries))
    } catch (error) {
      console.warn('Failed to save command history:', error)
    }
  }
}

// Command completion suggestions
export class CommandCompletion {
  private history: CommandHistory

  constructor(history: CommandHistory) {
    this.history = history
  }

  getSuggestions(input: string, limit: number = 5): string[] {
    if (input.length < 2) return []

    const suggestions = new Set<string>()
    const normalizedInput = input.toLowerCase()

    // Get recent commands that start with input
    const recentMatches = this.history.getAll()
      .filter(entry => entry.command.toLowerCase().startsWith(normalizedInput))
      .slice(0, limit)

    for (const match of recentMatches) {
      suggestions.add(match.command)
    }

    // Add common command completions
    const commonCommands = this.getCommonCommands()
    for (const command of commonCommands) {
      if (command.toLowerCase().startsWith(normalizedInput)) {
        suggestions.add(command)
      }
      if (suggestions.size >= limit) break
    }

    return Array.from(suggestions).slice(0, limit)
  }

  private getCommonCommands(): string[] {
    return [
      'ls -la',
      'cd ..',
      'pwd',
      'npm install',
      'npm start',
      'npm run build',
      'git status',
      'git add .',
      'git commit -m',
      'git push',
      'git pull',
      'docker ps',
      'docker build',
      'docker run',
      'python -m',
      'pip install',
      'curl -X GET',
      'grep -r',
      'find . -name',
      'chmod +x',
      'sudo apt update',
      'brew install',
      'code .',
      'vim',
      'nano',
      'cat',
      'head',
      'tail',
      'ps aux',
      'kill -9',
      'top',
      'df -h',
      'du -sh',
      'zip -r',
      'unzip',
      'tar -xzf',
      'ssh',
      'scp',
      'rsync'
    ]
  }
}
```

### 8. Interactive Terminal Features

```typescript
// src/hooks/useTerminalFeatures.ts - Terminal interaction hooks
import { useState, useCallback, useRef, useEffect } from 'react'
import { CommandHistory, CommandCompletion } from '@services/commandHistory'

export function useTerminalFeatures() {
  const [commandHistory] = useState(() => new CommandHistory())
  const [commandCompletion] = useState(() => new CommandCompletion(commandHistory))
  const [isHistoryMode, setIsHistoryMode] = useState(false)
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [currentInput, setCurrentInput] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])

  const inputRef = useRef<HTMLInputElement>(null)

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const value = input.value

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault()
        if (!isHistoryMode) {
          setIsHistoryMode(true)
          setCurrentInput(value)
          setHistoryIndex(0)
        } else if (historyIndex < commandHistory.getAll().length - 1) {
          setHistoryIndex(historyIndex + 1)
        }
        
        const upCommand = commandHistory.getAll()[historyIndex]
        if (upCommand) {
          input.value = upCommand.command
        }
        break

      case 'ArrowDown':
        event.preventDefault()
        if (isHistoryMode) {
          if (historyIndex > 0) {
            setHistoryIndex(historyIndex - 1)
            const downCommand = commandHistory.getAll()[historyIndex - 1]
            if (downCommand) {
              input.value = downCommand.command
            }
          } else {
            setIsHistoryMode(false)
            setHistoryIndex(-1)
            input.value = currentInput
          }
        }
        break

      case 'Tab':
        event.preventDefault()
        if (suggestions.length > 0) {
          input.value = suggestions[0]
          setSuggestions([])
        }
        break

      case 'Escape':
        event.preventDefault()
        setIsHistoryMode(false)
        setHistoryIndex(-1)
        setSuggestions([])
        input.value = currentInput
        break

      case 'Enter':
        setIsHistoryMode(false)
        setHistoryIndex(-1)
        setSuggestions([])
        setCurrentInput('')
        break

      default:
        // Reset history mode on typing
        if (event.key.length === 1) {
          setIsHistoryMode(false)
          setHistoryIndex(-1)
        }
        break
    }
  }, [isHistoryMode, historyIndex, currentInput, suggestions, commandHistory])

  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    
    if (!isHistoryMode) {
      // Update suggestions
      const newSuggestions = commandCompletion.getSuggestions(value)
      setSuggestions(newSuggestions)
    }
  }, [isHistoryMode, commandCompletion])

  const addToHistory = useCallback((command: string, metadata?: Partial<CommandHistoryEntry>) => {
    commandHistory.add({
      command,
      ...metadata
    })
  }, [commandHistory])

  const clearHistory = useCallback(() => {
    commandHistory.clear()
  }, [commandHistory])

  const searchHistory = useCallback((query: string) => {
    return commandHistory.search(query)
  }, [commandHistory])

  return {
    handleKeyDown,
    handleInputChange,
    addToHistory,
    clearHistory,
    searchHistory,
    suggestions,
    commandHistory: commandHistory.getAll(),
    frequentCommands: commandHistory.getFrequentCommands(),
    inputRef
  }
}
```

## 🔧 Configuration

### Terminal Component CSS

```css
/* src/styles/terminal.css - Terminal and shell command styling */

/* Bash Tool Container */
.bash-tool {
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  background: var(--bg-primary);
  overflow: hidden;
}

.bash-tool__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-secondary);
}

.bash-tool__info {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.bash-tool__command-icon {
  font-size: 1.2em;
}

.bash-tool__command {
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
  background: var(--bg-tertiary);
  padding: var(--space-xs) var(--space-sm);
  border-radius: 4px;
  border: 1px solid var(--border-secondary);
}

.bash-tool__status {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--font-sm);
}

.bash-tool__status-text {
  color: var(--text-secondary);
}

.bash-tool__exit-code {
  padding: var(--space-xs) var(--space-sm);
  border-radius: 4px;
  font-weight: 500;
  font-size: var(--font-xs);
}

.bash-tool__exit-code--success {
  background: rgba(var(--color-success-rgb), 0.1);
  color: var(--color-success);
  border: 1px solid rgba(var(--color-success-rgb), 0.3);
}

.bash-tool__exit-code--error {
  background: rgba(var(--color-error-rgb), 0.1);
  color: var(--color-error);
  border: 1px solid rgba(var(--color-error-rgb), 0.3);
}

.bash-tool__description {
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-secondary);
  font-size: var(--font-sm);
  color: var(--text-secondary);
}

.bash-tool__terminal {
  max-height: 400px;
  overflow-y: auto;
  background: #1e1e1e; /* Dark terminal background */
  color: #ffffff;
}

.bash-tool__error {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-md);
  background: rgba(var(--color-error-rgb), 0.05);
  border-top: 1px solid var(--border-secondary);
  color: var(--color-error);
}

/* Terminal Output */
.terminal-output {
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
  font-size: 14px;
  line-height: 1.4;
  padding: var(--space-md);
}

.terminal-output__prompt {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
  color: #00ff00; /* Bright green for prompt */
}

.terminal-output__prompt-symbol {
  color: #00ff00;
  font-weight: bold;
}

.terminal-output__command {
  color: #ffffff;
}

.terminal-output__content {
  min-height: 2rem;
}

.terminal-output__cursor {
  display: inline-block;
  margin-left: var(--space-xs);
}

.terminal-output__cursor-blink {
  animation: blink 1s infinite;
  color: #00ff00;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.terminal-output__summary {
  margin-top: var(--space-md);
  padding-top: var(--space-sm);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  font-size: var(--font-sm);
  color: #888888;
}

.terminal-output__exit-code--success {
  color: #00ff00;
}

.terminal-output__exit-code--error {
  color: #ff4444;
}

.terminal-output__execution-time {
  margin-left: var(--space-sm);
  color: #666666;
}

/* Terminal Line */
.terminal-line {
  display: flex;
  align-items: flex-start;
  line-height: 1.4;
  min-height: 1.4em;
  white-space: pre-wrap;
  word-break: break-word;
}

.terminal-line:hover {
  background: rgba(255, 255, 255, 0.02);
}

.terminal-line__timestamp {
  color: #666666;
  font-size: var(--font-xs);
  margin-right: var(--space-sm);
  flex-shrink: 0;
  width: 80px;
}

.terminal-line__content {
  flex: 1;
}

.terminal-line__text {
  color: inherit;
}

.terminal-line__styled {
  /* ANSI styles applied via inline styles */
}

/* Command Metadata */
.command-metadata {
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-secondary);
}

.command-metadata__summary {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  flex-wrap: wrap;
}

.command-metadata__item {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--font-sm);
}

.command-metadata__label {
  color: var(--text-secondary);
  font-weight: 500;
}

.command-metadata__value {
  color: var(--text-primary);
}

.command-metadata__path {
  font-family: monospace;
  background: var(--bg-tertiary);
  padding: 2px 4px;
  border-radius: 3px;
  font-size: var(--font-xs);
}

.command-metadata__toggle {
  background: none;
  border: 1px solid var(--border-secondary);
  color: var(--text-secondary);
  padding: var(--space-xs) var(--space-sm);
  border-radius: 4px;
  cursor: pointer;
  font-size: var(--font-xs);
  margin-left: auto;
}

.command-metadata__toggle:hover {
  background: var(--bg-tertiary);
  border-color: var(--border-focus);
}

.command-metadata__details {
  padding: var(--space-md);
  border-top: 1px solid var(--border-secondary);
}

.command-metadata__section {
  margin-bottom: var(--space-md);
}

.command-metadata__section:last-child {
  margin-bottom: 0;
}

.command-metadata__section-title {
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-sm);
}

.command-metadata__command {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  background: var(--bg-tertiary);
  padding: var(--space-sm);
  border-radius: 4px;
  border: 1px solid var(--border-secondary);
}

.command-metadata__command code {
  flex: 1;
  font-family: monospace;
  background: none;
}

.command-metadata__environment {
  display: grid;
  gap: var(--space-xs);
  font-family: monospace;
  font-size: var(--font-xs);
}

.command-metadata__env-var {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs);
  background: var(--bg-tertiary);
  border-radius: 3px;
}

.command-metadata__env-key {
  color: var(--color-primary);
  font-weight: 500;
}

.command-metadata__env-value {
  color: var(--text-secondary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Platform-specific styling */
.terminal-output--windows {
  /* Windows-specific terminal styling */
  background: #012456;
  color: #ffffff;
}

.terminal-output--unix {
  /* Unix-specific terminal styling */
  background: #1e1e1e;
  color: #ffffff;
}

/* Responsive design */
@media (max-width: 768px) {
  .bash-tool__header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-sm);
  }

  .command-metadata__summary {
    flex-direction: column;
    align-items: flex-start;
  }

  .terminal-output {
    font-size: 12px;
  }
}
```

## ✅ Testing

### ANSI Processor Tests

```typescript
// src/services/__tests__/ansiProcessor.test.ts
import { describe, it, expect } from 'vitest'
import { AnsiProcessor } from '../ansiProcessor'

describe('AnsiProcessor', () => {
  let processor: AnsiProcessor

  beforeEach(() => {
    processor = new AnsiProcessor()
  })

  it('should process basic color codes', () => {
    const input = '\x1b[31mRed text\x1b[0m normal'
    const result = processor.processLine(input)

    expect(result.content).toBe('Red text normal')
    expect(result.styles).toHaveLength(1)
    expect(result.styles[0]).toMatchObject({
      start: 0,
      end: 8,
      style: { color: '#cd0000' }
    })
  })

  it('should handle multiple styles', () => {
    const input = '\x1b[1m\x1b[31mBold red\x1b[0m normal'
    const result = processor.processLine(input)

    expect(result.content).toBe('Bold red normal')
    expect(result.styles[0].style).toMatchObject({
      bold: true,
      color: '#cd0000'
    })
  })

  it('should strip ANSI codes correctly', () => {
    const input = '\x1b[31mRed\x1b[0m \x1b[32mGreen\x1b[0m'
    const stripped = processor.stripAnsiCodes(input)

    expect(stripped).toBe('Red Green')
  })

  it('should handle reset codes', () => {
    const input = '\x1b[31m\x1b[1mBold red\x1b[0mNormal'
    const result = processor.processLine(input)

    expect(result.styles).toHaveLength(1)
    expect(result.styles[0].end).toBe(8) // Only "Bold red" should be styled
  })

  it('should handle background colors', () => {
    const input = '\x1b[41mRed background\x1b[0m'
    const result = processor.processLine(input)

    expect(result.styles[0].style).toMatchObject({
      backgroundColor: '#cd0000'
    })
  })

  it('should handle text decorations', () => {
    const input = '\x1b[4m\x1b[3mUnderline italic\x1b[0m'
    const result = processor.processLine(input)

    expect(result.styles[0].style).toMatchObject({
      underline: true,
      italic: true
    })
  })
})
```

### Terminal Component Tests

```typescript
// src/components/tools/__tests__/BashTool.test.tsx
import { render, screen } from '@testing-library/react'
import { BashTool } from '../BashTool'
import { ToolCall } from '@types/index'

describe('BashTool', () => {
  const baseTool: ToolCall = {
    id: 'bash-1',
    name: 'bash',
    parameters: { command: 'ls -la' },
    state: 'pending',
    expanded: false,
    show_details: false,
  }

  it('should render command in header', () => {
    render(<BashTool toolCall={baseTool} />)
    
    expect(screen.getByText('ls -la')).toBeInTheDocument()
  })

  it('should show running status with spinner', () => {
    const runningTool = {
      ...baseTool,
      state: 'running' as const
    }

    render(<BashTool toolCall={runningTool} />)
    
    expect(screen.getByText('Running...')).toBeInTheDocument()
  })

  it('should display exit code for completed command', () => {
    const completedTool = {
      ...baseTool,
      state: 'completed' as const,
      result: {
        exit_code: 0,
        execution_time: 1500,
        output: 'total 0\ndrwxr-xr-x 2 user user 4096 Jan 1 12:00 .'
      }
    }

    render(<BashTool toolCall={completedTool} />)
    
    expect(screen.getByText('Exit 0')).toBeInTheDocument()
  })

  it('should show error message for failed command', () => {
    const errorTool = {
      ...baseTool,
      state: 'error' as const,
      error: 'Command not found'
    }

    render(<BashTool toolCall={errorTool} />)
    
    expect(screen.getByText('Command not found')).toBeInTheDocument()
  })

  it('should detect command icons correctly', () => {
    const npmTool = {
      ...baseTool,
      parameters: { command: 'npm install' }
    }

    render(<BashTool toolCall={npmTool} />)
    
    // Should show npm icon
    expect(screen.getByText('📦')).toBeInTheDocument()
  })

  it('should render terminal output', () => {
    const toolWithOutput = {
      ...baseTool,
      state: 'completed' as const,
      result: {
        exit_code: 0,
        output: 'Hello, world!\nLine 2'
      }
    }

    render(<BashTool toolCall={toolWithOutput} />)
    
    expect(screen.getByText('Hello, world!')).toBeInTheDocument()
    expect(screen.getByText('Line 2')).toBeInTheDocument()
  })
})
```

## 📝 Implementation Checklist

### Core Shell Features ✅
- [ ] Shell command tool renderer with streaming support
- [ ] ANSI escape code processor with color mapping
- [ ] Terminal output component with line-by-line rendering
- [ ] Platform detection for Windows/Unix shells
- [ ] Command metadata display with execution details

### ANSI Processing ✅
- [ ] Color code processing (16-color and 256-color)
- [ ] Text decoration support (bold, italic, underline)
- [ ] Background color processing
- [ ] Reset code handling
- [ ] Cursor movement and clear screen sequences

### Interactive Features ✅
- [ ] Command history with local storage
- [ ] Command completion and suggestions
- [ ] Keyboard navigation (up/down arrows)
- [ ] Tab completion for common commands
- [ ] Search and filtering of command history

### Terminal Emulation ✅
- [ ] Real-time output streaming
- [ ] Proper line wrapping and scrolling
- [ ] Terminal cursor simulation
- [ ] Multi-line command support
- [ ] Output truncation and pagination

### Security & Platform Support ✅
- [ ] Command sanitization and validation
- [ ] Platform-specific shell detection
- [ ] Windows PowerShell/CMD support
- [ ] Unix bash/zsh/fish support
- [ ] Environment variable handling

### Performance & UX ✅
- [ ] Virtual scrolling for large outputs
- [ ] Efficient ANSI processing
- [ ] Responsive design for mobile
- [ ] Copy/paste functionality
- [ ] Command timing and metrics

### Testing ✅
- [ ] ANSI processor unit tests
- [ ] Terminal component rendering tests
- [ ] Command history functionality tests
- [ ] Platform detection tests
- [ ] Integration tests with tool execution

### Next Steps
After implementing shell commands:
1. **[07-Todo-Management.md](./07-Todo-Management.md)** - Implement todo list management tools
2. **[08-Advanced-Features.md](./08-Advanced-Features.md)** - Add advanced terminal features
3. **[09-Integration.md](./09-Integration.md)** - Integrate with VS Code extension

---

This shell command system provides comprehensive terminal emulation within the VS Code extension, supporting cross-platform execution, rich ANSI rendering, and interactive features that match the sophistication of the original OpenCode TUI implementation.