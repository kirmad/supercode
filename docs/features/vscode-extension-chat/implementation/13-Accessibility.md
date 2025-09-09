# 13-Accessibility.md

**Accessibility Implementation for OpenCode VS Code Extension**

---

## 🎯 Overview

This document provides comprehensive accessibility implementation guidelines for the OpenCode VS Code extension's webview interface. It ensures WCAG 2.1 AA compliance, screen reader support, keyboard navigation, and inclusive design principles that align with VS Code's accessibility standards.

## 🔄 WCAG 2.1 AA Compliance Requirements

### Core Compliance Areas

#### 1. Perceivable
- **Color Contrast**: Minimum 4.5:1 for normal text, 3:1 for large text
- **Alternative Text**: All images and icons must have descriptive alt text
- **Text Resizing**: Support up to 200% zoom without horizontal scrolling
- **Color Independence**: Information must not rely solely on color

#### 2. Operable
- **Keyboard Navigation**: All functionality accessible via keyboard
- **No Seizures**: Avoid content that flashes more than 3 times per second
- **Focus Management**: Logical focus order and visible focus indicators
- **Timing**: No time limits on essential tasks

#### 3. Understandable
- **Readable Text**: Plain language with consistent terminology
- **Predictable Behavior**: Consistent navigation and interaction patterns
- **Input Assistance**: Clear error messages and form validation

#### 4. Robust
- **Valid Code**: Well-formed HTML with proper semantics
- **Assistive Technology**: Compatible with screen readers and other tools

## 🏗️ Implementation Architecture

### Accessibility Component System

```typescript
// src/accessibility/AccessibilityProvider.tsx
import React, { createContext, useContext, useState, useRef } from 'react'

interface AccessibilityContextType {
  announceToScreenReader: (message: string, priority?: 'polite' | 'assertive') => void
  setFocusToMain: () => void
  isHighContrast: boolean
  reduceMotion: boolean
  increaseTextSize: boolean
}

const AccessibilityContext = createContext<AccessibilityContextType | null>(null)

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ 
  children 
}) => {
  const announcementRef = useRef<HTMLDivElement>(null)
  const mainContentRef = useRef<HTMLDivElement>(null)
  
  // Detect user preferences
  const [isHighContrast] = useState(() => 
    window.matchMedia('(prefers-contrast: high)').matches
  )
  const [reduceMotion] = useState(() => 
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  const [increaseTextSize] = useState(() => 
    window.matchMedia('(min-resolution: 1.5dppx)').matches
  )

  const announceToScreenReader = (
    message: string, 
    priority: 'polite' | 'assertive' = 'polite'
  ) => {
    if (announcementRef.current) {
      // Clear previous message
      announcementRef.current.textContent = ''
      
      // Set priority
      announcementRef.current.setAttribute('aria-live', priority)
      
      // Add new message after brief delay to ensure screen reader picks it up
      setTimeout(() => {
        if (announcementRef.current) {
          announcementRef.current.textContent = message
        }
      }, 100)
    }
  }

  const setFocusToMain = () => {
    mainContentRef.current?.focus()
  }

  return (
    <AccessibilityContext.Provider value={{
      announceToScreenReader,
      setFocusToMain,
      isHighContrast,
      reduceMotion,
      increaseTextSize
    }}>
      {children}
      
      {/* Screen Reader Announcement Region */}
      <div
        ref={announcementRef}
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
        id="accessibility-announcements"
      />
      
      {/* Main Content Landmark */}
      <div
        ref={mainContentRef}
        tabIndex={-1}
        className="sr-only"
        id="main-content-target"
      />
    </AccessibilityContext.Provider>
  )
}

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext)
  if (!context) {
    throw new Error('useAccessibility must be used within AccessibilityProvider')
  }
  return context
}
```

## 🎹 Keyboard Navigation Implementation

### Global Keyboard Handler

```typescript
// src/accessibility/KeyboardHandler.tsx
import React, { useEffect, useCallback } from 'react'
import { useAccessibility } from './AccessibilityProvider'

interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  metaKey?: boolean
  action: () => void
  description: string
}

export const useKeyboardShortcuts = () => {
  const { announceToScreenReader, setFocusToMain } = useAccessibility()

  const shortcuts: KeyboardShortcut[] = [
    {
      key: 'F1',
      action: () => showKeyboardHelp(),
      description: 'Show keyboard shortcuts help'
    },
    {
      key: 'F6',
      action: () => cycleThroughRegions(),
      description: 'Cycle through main regions'
    },
    {
      key: 'Escape',
      action: () => closeModalOrFocusMain(),
      description: 'Close modal or focus main content'
    },
    {
      key: 'm',
      altKey: true,
      action: () => setFocusToMain(),
      description: 'Focus main content area'
    },
    {
      key: 'Enter',
      ctrlKey: true,
      action: () => submitCurrentForm(),
      description: 'Submit current form or send message'
    }
  ]

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const shortcut = shortcuts.find(s => 
      s.key.toLowerCase() === event.key.toLowerCase() &&
      !!s.ctrlKey === event.ctrlKey &&
      !!s.shiftKey === event.shiftKey &&
      !!s.altKey === event.altKey &&
      !!s.metaKey === event.metaKey
    )

    if (shortcut) {
      event.preventDefault()
      shortcut.action()
      announceToScreenReader(`Activated: ${shortcut.description}`)
    }
  }, [shortcuts, announceToScreenReader])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const showKeyboardHelp = () => {
    const helpText = shortcuts
      .map(s => {
        const keys = []
        if (s.ctrlKey) keys.push('Ctrl')
        if (s.altKey) keys.push('Alt')
        if (s.shiftKey) keys.push('Shift')
        if (s.metaKey) keys.push('Cmd')
        keys.push(s.key)
        return `${keys.join('+')} - ${s.description}`
      })
      .join(', ')
    
    announceToScreenReader(`Keyboard shortcuts: ${helpText}`, 'assertive')
  }

  const cycleThroughRegions = () => {
    const regions = document.querySelectorAll('[role="region"], main, nav, aside')
    // Implementation for region cycling
  }

  const closeModalOrFocusMain = () => {
    const modal = document.querySelector('[role="dialog"]')
    if (modal) {
      // Close modal logic
    } else {
      setFocusToMain()
    }
  }

  const submitCurrentForm = () => {
    const activeElement = document.activeElement
    const form = activeElement?.closest('form')
    if (form) {
      form.dispatchEvent(new Event('submit'))
    }
  }

  return { shortcuts }
}
```

### Focus Management

```typescript
// src/accessibility/FocusManager.tsx
import React, { useRef, useEffect } from 'react'

interface FocusTrapProps {
  children: React.ReactNode
  active: boolean
  restoreFocus?: boolean
}

export const FocusTrap: React.FC<FocusTrapProps> = ({ 
  children, 
  active, 
  restoreFocus = true 
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!active) return

    // Store previous focus
    previousFocusRef.current = document.activeElement as HTMLElement

    // Focus first focusable element
    const focusableElements = getFocusableElements(containerRef.current)
    if (focusableElements.length > 0) {
      focusableElements[0].focus()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return

      const focusableElements = getFocusableElements(containerRef.current)
      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault()
          lastElement.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault()
          firstElement.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      
      // Restore focus
      if (restoreFocus && previousFocusRef.current) {
        previousFocusRef.current.focus()
      }
    }
  }, [active, restoreFocus])

  return <div ref={containerRef}>{children}</div>
}

const getFocusableElements = (container: HTMLElement | null): HTMLElement[] => {
  if (!container) return []

  const selectors = [
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])'
  ].join(', ')

  return Array.from(container.querySelectorAll(selectors))
}
```

## 🎨 Color Contrast and Visual Accessibility

### Theme Integration with VS Code

```typescript
// src/accessibility/ColorScheme.tsx
import React, { useEffect, useState } from 'react'

interface ColorSchemeProps {
  children: React.ReactNode
}

export const ColorSchemeProvider: React.FC<ColorSchemeProps> = ({ children }) => {
  const [colorScheme, setColorScheme] = useState<'light' | 'dark' | 'high-contrast'>('light')

  useEffect(() => {
    // Detect VS Code theme
    const detectVSCodeTheme = () => {
      const isDark = document.body.classList.contains('vscode-dark')
      const isHighContrast = document.body.classList.contains('vscode-high-contrast')
      
      if (isHighContrast) {
        setColorScheme('high-contrast')
      } else if (isDark) {
        setColorScheme('dark')
      } else {
        setColorScheme('light')
      }
    }

    // Initial detection
    detectVSCodeTheme()

    // Listen for theme changes
    const observer = new MutationObserver(detectVSCodeTheme)
    observer.observe(document.body, { 
      attributes: true, 
      attributeFilter: ['class'] 
    })

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    // Apply accessibility-specific CSS custom properties
    const root = document.documentElement
    
    switch (colorScheme) {
      case 'high-contrast':
        root.style.setProperty('--focus-ring-width', '3px')
        root.style.setProperty('--focus-ring-offset', '2px')
        root.style.setProperty('--border-width', '2px')
        break
      case 'dark':
        root.style.setProperty('--focus-ring-width', '2px')
        root.style.setProperty('--focus-ring-offset', '1px')
        root.style.setProperty('--border-width', '1px')
        break
      default:
        root.style.setProperty('--focus-ring-width', '2px')
        root.style.setProperty('--focus-ring-offset', '1px')
        root.style.setProperty('--border-width', '1px')
    }
  }, [colorScheme])

  return <>{children}</>
}
```

### Accessible Color System

```css
/* src/styles/accessibility.css */

/* High Contrast Support */
@media (prefers-contrast: high) {
  :root {
    --border-width: 2px;
    --focus-ring-width: 3px;
    --text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.5);
  }
  
  .message {
    border-width: var(--border-width);
    text-shadow: var(--text-shadow);
  }
  
  .button {
    border-width: var(--border-width);
    font-weight: 600;
  }
}

/* Reduced Motion Support */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  
  .spinner {
    animation: none;
  }
  
  .fade-in,
  .slide-in {
    animation: none;
    opacity: 1;
    transform: none;
  }
}

/* Focus Indicators */
.focus-visible {
  outline: var(--focus-ring-width) solid var(--vscode-focusBorder);
  outline-offset: var(--focus-ring-offset);
  border-radius: 2px;
}

/* Skip Links */
.skip-link {
  position: absolute;
  top: -40px;
  left: 6px;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  padding: 8px;
  text-decoration: none;
  border-radius: 4px;
  z-index: 1000;
  font-weight: 600;
}

.skip-link:focus {
  top: 6px;
}

/* Screen Reader Only Content */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* High Contrast Color Overrides */
.vscode-high-contrast .message.error {
  background: #000000;
  color: #ffffff;
  border: 2px solid #ffffff;
}

.vscode-high-contrast .message.success {
  background: #000000;
  color: #00ff00;
  border: 2px solid #00ff00;
}

.vscode-high-contrast .button:focus {
  outline: 3px solid #ffffff;
  outline-offset: 2px;
}
```

## 🗣️ Screen Reader Support

### ARIA Implementation

```typescript
// src/accessibility/AriaComponents.tsx
import React from 'react'

interface AccessibleButtonProps {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'danger'
  ariaLabel?: string
  ariaDescribedBy?: string
  ariaPressed?: boolean
  loading?: boolean
}

export const AccessibleButton: React.FC<AccessibleButtonProps> = ({
  children,
  onClick,
  disabled = false,
  variant = 'primary',
  ariaLabel,
  ariaDescribedBy,
  ariaPressed,
  loading = false,
  ...props
}) => {
  return (
    <button
      className={`button button--${variant} ${loading ? 'button--loading' : ''}`}
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      aria-pressed={ariaPressed}
      aria-busy={loading}
      {...props}
    >
      {loading && (
        <span className="sr-only">Loading...</span>
      )}
      {children}
      {loading && (
        <span aria-hidden="true" className="spinner">⟳</span>
      )}
    </button>
  )
}

interface MessageProps {
  id: string
  type: 'user' | 'assistant' | 'system' | 'error'
  content: string
  timestamp: string
  toolCalls?: any[]
}

export const AccessibleMessage: React.FC<MessageProps> = ({
  id,
  type,
  content,
  timestamp,
  toolCalls = []
}) => {
  const roleLabel = {
    user: 'User message',
    assistant: 'Assistant response',
    system: 'System notification',
    error: 'Error message'
  }[type]

  return (
    <div
      className={`message message--${type}`}
      role={type === 'error' ? 'alert' : 'log'}
      aria-labelledby={`message-${id}-label`}
      aria-describedby={`message-${id}-content ${toolCalls.length > 0 ? `message-${id}-tools` : ''}`}
    >
      <div id={`message-${id}-label`} className="sr-only">
        {roleLabel} at {new Date(timestamp).toLocaleString()}
      </div>
      
      <div 
        id={`message-${id}-content`}
        className="message-content"
        aria-live={type === 'error' ? 'assertive' : 'polite'}
      >
        {content}
      </div>

      {toolCalls.length > 0 && (
        <div id={`message-${id}-tools`}>
          <div className="sr-only">
            {toolCalls.length} tool {toolCalls.length === 1 ? 'call' : 'calls'} in this message
          </div>
          {toolCalls.map((tool, index) => (
            <AccessibleToolCall key={tool.id} tool={tool} index={index} />
          ))}
        </div>
      )}
    </div>
  )
}

interface ToolCallProps {
  tool: any
  index: number
}

const AccessibleToolCall: React.FC<ToolCallProps> = ({ tool, index }) => {
  const statusAnnouncement = {
    pending: 'Waiting to execute',
    running: 'Currently executing',
    completed: 'Completed successfully',
    error: 'Failed with error'
  }[tool.state]

  return (
    <div
      className={`tool-call tool-call--${tool.state}`}
      role="region"
      aria-labelledby={`tool-${tool.id}-label`}
      aria-describedby={`tool-${tool.id}-status`}
    >
      <div id={`tool-${tool.id}-label`} className="tool-call-header">
        <span className="sr-only">Tool call {index + 1}:</span>
        {tool.name}
      </div>
      
      <div 
        id={`tool-${tool.id}-status`}
        className="sr-only"
        aria-live="polite"
      >
        {statusAnnouncement}
        {tool.error && `. Error: ${tool.error}`}
      </div>

      {tool.expanded && (
        <div className="tool-call-details" aria-label="Tool call details">
          {/* Tool call content */}
        </div>
      )}
    </div>
  )
}
```

### Live Regions for Dynamic Content

```typescript
// src/accessibility/LiveRegions.tsx
import React, { useRef, useCallback } from 'react'
import { useAccessibility } from './AccessibilityProvider'

export const useLiveAnnouncements = () => {
  const { announceToScreenReader } = useAccessibility()

  const announceToolStateChange = useCallback((toolName: string, newState: string) => {
    const messages = {
      pending: `${toolName} is queued for execution`,
      running: `${toolName} is now running`,
      completed: `${toolName} completed successfully`,
      error: `${toolName} failed with an error`
    }
    announceToScreenReader(messages[newState] || `${toolName} state changed to ${newState}`)
  }, [announceToScreenReader])

  const announceConnectionStatus = useCallback((status: string) => {
    const messages = {
      connecting: 'Connecting to SuperCode server',
      connected: 'Successfully connected to SuperCode',
      disconnected: 'Disconnected from SuperCode server',
      error: 'Connection to SuperCode failed'
    }
    announceToScreenReader(messages[status] || `Connection status: ${status}`, 'assertive')
  }, [announceToScreenReader])

  const announceNewMessage = useCallback((type: string, preview: string) => {
    if (type === 'assistant') {
      announceToScreenReader(`New assistant response: ${preview.substring(0, 50)}...`)
    } else if (type === 'error') {
      announceToScreenReader(`Error occurred: ${preview}`, 'assertive')
    }
  }, [announceToScreenReader])

  return {
    announceToolStateChange,
    announceConnectionStatus,
    announceNewMessage
  }
}

export const StatusLiveRegion: React.FC = () => {
  return (
    <div
      id="status-live-region"
      aria-live="polite"
      aria-atomic="false"
      className="sr-only"
    />
  )
}

export const AlertLiveRegion: React.FC = () => {
  return (
    <div
      id="alert-live-region"
      aria-live="assertive"
      aria-atomic="true"
      className="sr-only"
    />
  )
}
```

## 🧭 VS Code Accessibility Integration

### Extension Accessibility Metadata

```json
// package.json accessibility contributions
{
  "contributes": {
    "commands": [
      {
        "command": "supercode.openNewWebview",
        "title": "Open SuperCode Chat",
        "category": "SuperCode",
        "icon": "$(comment-discussion)"
      },
      {
        "command": "supercode.focusChat",
        "title": "Focus SuperCode Chat",
        "category": "SuperCode"
      },
      {
        "command": "supercode.announceStatus",
        "title": "Announce SuperCode Status",
        "category": "SuperCode"
      }
    ],
    "keybindings": [
      {
        "command": "supercode.focusChat",
        "key": "ctrl+shift+s",
        "mac": "cmd+shift+s",
        "when": "supercode.active"
      },
      {
        "command": "supercode.announceStatus",
        "key": "ctrl+shift+a",
        "mac": "cmd+shift+a",
        "when": "supercode.active"
      }
    ],
    "configuration": {
      "title": "SuperCode Accessibility",
      "properties": {
        "supercode.accessibility.announceToolStates": {
          "type": "boolean",
          "default": true,
          "description": "Announce tool execution state changes to screen readers"
        },
        "supercode.accessibility.verboseDescriptions": {
          "type": "boolean",
          "default": false,
          "description": "Provide detailed descriptions for screen readers"
        },
        "supercode.accessibility.keyboardShortcutsEnabled": {
          "type": "boolean",
          "default": true,
          "description": "Enable SuperCode-specific keyboard shortcuts"
        }
      }
    }
  }
}
```

### Webview Accessibility Enhancement

```typescript
// src/webview/AccessibleSuperCodeInstance.ts
import * as vscode from 'vscode'

export class AccessibleSuperCodeInstance extends SuperCodeInstance {
  
  protected getWebviewContent(): string {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SuperCode AI Assistant</title>
        <style>
            ${this.getAccessibilityCSS()}
        </style>
    </head>
    <body>
        <!-- Skip Links -->
        <a href="#main-content" class="skip-link">Skip to main content</a>
        <a href="#message-input" class="skip-link">Skip to message input</a>
        
        <div class="supercode-container" role="application" aria-label="SuperCode AI Assistant">
            <!-- Status Bar with ARIA Live Region -->
            <div class="status-bar" role="banner">
                <div class="connection-status" aria-live="polite" aria-atomic="true">
                    <span id="statusDot" aria-hidden="true">⚪</span>
                    <span id="statusText">Initializing SuperCode...</span>
                </div>
            </div>
            
            <!-- Main Content Area -->
            <main id="main-content" class="chat-messages" role="main" 
                  aria-label="Conversation history" tabindex="-1">
                <div class="welcome-message" role="region" aria-label="Welcome message">
                    <h1 class="sr-only">SuperCode AI Assistant</h1>
                    <p>Starting SuperCode server on port ${this.getPort()}...</p>
                    <p class="sr-only">This interface allows you to interact with SuperCode AI assistant. Use the message input area below to send messages.</p>
                </div>
            </main>
            
            <!-- Input Area -->
            <div class="input-area" role="complementary" aria-label="Message composition">
                <label for="messageInput" class="sr-only">
                    Message to send to SuperCode AI assistant
                </label>
                <textarea 
                    id="messageInput" 
                    placeholder="Ask SuperCode something..." 
                    aria-describedby="input-help"
                    disabled
                    rows="3"
                    aria-expanded="false">
                </textarea>
                <div id="input-help" class="sr-only">
                    Press Ctrl+Enter or Cmd+Enter to send your message
                </div>
                <button 
                    id="sendButton" 
                    disabled
                    aria-describedby="send-help">
                    Send
                </button>
                <div id="send-help" class="sr-only">
                    Sends your message to the SuperCode AI assistant
                </div>
            </div>
        </div>
        
        <!-- Live Regions for Announcements -->
        <div id="polite-announcements" aria-live="polite" aria-atomic="false" class="sr-only"></div>
        <div id="assertive-announcements" aria-live="assertive" aria-atomic="true" class="sr-only"></div>
        
        <script>
            ${this.getAccessibilityScript()}
        </script>
    </body>
    </html>`
  }

  private getAccessibilityCSS(): string {
    return `
      /* Skip Links */
      .skip-link {
        position: absolute;
        top: -40px;
        left: 6px;
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        padding: 8px 12px;
        text-decoration: none;
        border-radius: 4px;
        z-index: 1000;
        font-weight: 600;
        border: 2px solid transparent;
      }
      
      .skip-link:focus {
        top: 6px;
        border-color: var(--vscode-focusBorder);
        outline: none;
      }
      
      /* Focus Management */
      .focus-visible {
        outline: 2px solid var(--vscode-focusBorder);
        outline-offset: 2px;
      }
      
      /* High Contrast Support */
      @media (prefers-contrast: high) {
        .message {
          border-width: 2px;
        }
        
        .focus-visible {
          outline-width: 3px;
        }
      }
      
      /* Reduced Motion */
      @media (prefers-reduced-motion: reduce) {
        * {
          animation-duration: 0.01ms !important;
          transition-duration: 0.01ms !important;
        }
      }
      
      /* Screen Reader Only */
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
    `
  }

  private getAccessibilityScript(): string {
    return `
      const vscode = acquireVsCodeApi();
      
      // Accessibility utilities
      const accessibility = {
        announce: (message, priority = 'polite') => {
          const region = document.getElementById(priority + '-announcements');
          if (region) {
            region.textContent = '';
            setTimeout(() => {
              region.textContent = message;
            }, 100);
          }
        },
        
        manageFocus: () => {
          // Focus management for dynamic content
          const messages = document.getElementById('main-content');
          if (messages && messages.children.length > 0) {
            const lastMessage = messages.children[messages.children.length - 1];
            if (lastMessage.getAttribute('data-new') === 'true') {
              lastMessage.removeAttribute('data-new');
              lastMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }
        }
      };
      
      // Enhanced message handling with accessibility
      window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
          case 'statusUpdate':
            updateStatus(message.status, message.port);
            break;
          case 'addMessage':
            addAccessibleMessage(message.type, message.content);
            break;
          case 'announceToScreenReader':
            accessibility.announce(message.text, message.priority);
            break;
        }
      });
      
      function addAccessibleMessage(type, content) {
        const messagesContainer = document.getElementById('main-content');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message message--' + type;
        messageDiv.setAttribute('role', type === 'error' ? 'alert' : 'log');
        messageDiv.setAttribute('data-new', 'true');
        
        // Add timestamp for screen readers
        const timestamp = new Date().toLocaleString();
        const srTimestamp = document.createElement('span');
        srTimestamp.className = 'sr-only';
        srTimestamp.textContent = type + ' message at ' + timestamp + ': ';
        
        messageDiv.appendChild(srTimestamp);
        
        const contentSpan = document.createElement('span');
        contentSpan.textContent = content;
        messageDiv.appendChild(contentSpan);
        
        messagesContainer.appendChild(messageDiv);
        
        // Announce new messages
        if (type === 'assistant') {
          accessibility.announce('New response: ' + content.substring(0, 50) + (content.length > 50 ? '...' : ''));
        } else if (type === 'error') {
          accessibility.announce('Error: ' + content, 'assertive');
        }
        
        accessibility.manageFocus();
      }
      
      function updateStatus(status, port) {
        const statusText = document.getElementById('statusText');
        const statusDot = document.getElementById('statusDot');
        const messageInput = document.getElementById('messageInput');
        const sendButton = document.getElementById('sendButton');
        
        const statusConfig = {
          disconnected: { dot: '⚪', text: 'Disconnected', enabled: false },
          connecting: { dot: '🟡', text: 'Connecting to SuperCode...', enabled: false },
          connected: { dot: '🟢', text: 'Connected to SuperCode on port ' + port, enabled: true },
          error: { dot: '🔴', text: 'SuperCode connection failed', enabled: false }
        };
        
        const config = statusConfig[status];
        if (config) {
          statusDot.textContent = config.dot;
          statusText.textContent = config.text;
          messageInput.disabled = !config.enabled;
          sendButton.disabled = !config.enabled;
          
          // Announce status changes
          accessibility.announce('SuperCode status: ' + config.text, status === 'error' ? 'assertive' : 'polite');
          
          if (status === 'connected') {
            messageInput.focus();
            accessibility.announce('SuperCode is ready. You can now start typing your message.');
          }
        }
      }
      
      // Keyboard shortcuts
      document.addEventListener('keydown', (event) => {
        // Ctrl/Cmd + Enter to send message
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
          event.preventDefault();
          sendMessage();
        }
        
        // F1 for help
        if (event.key === 'F1') {
          event.preventDefault();
          accessibility.announce('Keyboard shortcuts: Ctrl+Enter to send message, F1 for this help, Escape to focus main content', 'assertive');
        }
        
        // Escape to focus main content
        if (event.key === 'Escape') {
          event.preventDefault();
          document.getElementById('main-content').focus();
          accessibility.announce('Focused main content area');
        }
      });
      
      function sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const text = messageInput.value.trim();
        if (!text || messageInput.disabled) return;
        
        // Add user message with accessibility features
        addAccessibleMessage('user', text);
        messageInput.value = '';
        
        // Announce sending
        accessibility.announce('Sending message to SuperCode...');
        
        vscode.postMessage({
          command: 'sendMessage',
          text: text
        });
      }
      
      // Initialize
      vscode.postMessage({ command: 'requestStatus' });
    `;
  }
}
```

## 🧪 Accessibility Testing

### Automated Testing Setup

```typescript
// src/tests/accessibility.test.ts
import { render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import userEvent from '@testing-library/user-event'
import { SuperCodeChat } from '../components/SuperCodeChat'

expect.extend(toHaveNoViolations)

describe('Accessibility Tests', () => {
  describe('WCAG 2.1 AA Compliance', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<SuperCodeChat />)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper heading hierarchy', () => {
      render(<SuperCodeChat />)
      
      const headings = screen.getAllByRole('heading')
      expect(headings).toHaveLength(1)
      expect(headings[0]).toHaveAttribute('aria-level', '1')
    })

    it('should have sufficient color contrast', async () => {
      const { container } = render(<SuperCodeChat />)
      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true }
        }
      })
      expect(results).toHaveNoViolations()
    })
  })

  describe('Keyboard Navigation', () => {
    it('should allow keyboard navigation through interactive elements', async () => {
      const user = userEvent.setup()
      render(<SuperCodeChat />)
      
      // Tab through all interactive elements
      await user.tab()
      expect(screen.getByRole('textbox')).toHaveFocus()
      
      await user.tab()
      expect(screen.getByRole('button', { name: /send/i })).toHaveFocus()
    })

    it('should support keyboard shortcuts', async () => {
      const user = userEvent.setup()
      render(<SuperCodeChat />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, 'Test message')
      
      // Ctrl+Enter should send message
      await user.keyboard('{Control>}{Enter}{/Control}')
      
      expect(screen.getByText('Test message')).toBeInTheDocument()
    })

    it('should trap focus in modal dialogs', async () => {
      const user = userEvent.setup()
      render(<SuperCodeChat />)
      
      // Open modal (assuming there's a help button)
      const helpButton = screen.getByRole('button', { name: /help/i })
      await user.click(helpButton)
      
      const modal = screen.getByRole('dialog')
      expect(modal).toBeInTheDocument()
      
      // Focus should be trapped within modal
      await user.tab()
      const focusedElement = document.activeElement
      expect(modal).toContainElement(focusedElement)
    })
  })

  describe('Screen Reader Support', () => {
    it('should have proper ARIA labels', () => {
      render(<SuperCodeChat />)
      
      expect(screen.getByRole('textbox')).toHaveAccessibleName('Message to send to SuperCode AI assistant')
      expect(screen.getByRole('button', { name: /send/i })).toHaveAccessibleDescription()
    })

    it('should announce status changes', () => {
      render(<SuperCodeChat />)
      
      const liveRegion = screen.getByRole('status')
      expect(liveRegion).toHaveAttribute('aria-live', 'polite')
    })

    it('should provide alternative text for images', () => {
      render(<SuperCodeChat />)
      
      const images = screen.queryAllByRole('img')
      images.forEach(img => {
        expect(img).toHaveAccessibleName()
      })
    })
  })

  describe('User Preferences', () => {
    it('should respect reduced motion preference', () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
        })),
      })

      render(<SuperCodeChat />)
      
      // Verify animations are disabled
      const animatedElements = document.querySelectorAll('.fade-in, .slide-in')
      animatedElements.forEach(element => {
        const styles = window.getComputedStyle(element)
        expect(styles.animationDuration).toBe('0.01ms')
      })
    })

    it('should support high contrast mode', () => {
      document.body.classList.add('vscode-high-contrast')
      
      render(<SuperCodeChat />)
      
      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        const styles = window.getComputedStyle(button)
        expect(parseInt(styles.borderWidth)).toBeGreaterThanOrEqual(2)
      })
    })
  })
})
```

### Manual Testing Checklist

```markdown
## 📋 Accessibility Testing Checklist

### WCAG 2.1 AA Compliance
- [ ] **Color Contrast**: All text meets 4.5:1 contrast ratio (3:1 for large text)
- [ ] **Keyboard Navigation**: All functionality accessible via keyboard
- [ ] **Focus Indicators**: Visible focus indicators on all interactive elements
- [ ] **Alternative Text**: All images and icons have descriptive alt text
- [ ] **Heading Structure**: Proper heading hierarchy (h1, h2, h3, etc.)
- [ ] **Form Labels**: All form inputs have associated labels
- [ ] **Error Messages**: Clear, accessible error messages and validation

### Screen Reader Testing
- [ ] **NVDA** (Windows): Test with latest version
- [ ] **JAWS** (Windows): Test with current version  
- [ ] **VoiceOver** (macOS): Test with Safari and VS Code
- [ ] **Orca** (Linux): Basic functionality testing

#### Screen Reader Test Cases
- [ ] Navigate through all messages using arrow keys
- [ ] Tab through all interactive elements
- [ ] Verify live regions announce status changes
- [ ] Check tool call announcements
- [ ] Verify error messages are announced properly

### Keyboard Navigation Testing
- [ ] **Tab Order**: Logical tab order through all elements
- [ ] **Skip Links**: Skip to main content and input area
- [ ] **Keyboard Shortcuts**: 
  - [ ] Ctrl/Cmd+Enter sends message
  - [ ] F1 shows help
  - [ ] Escape focuses main content
  - [ ] F6 cycles through regions
- [ ] **Focus Trapping**: Modal dialogs trap focus properly

### High Contrast Mode Testing
- [ ] Test with Windows High Contrast themes
- [ ] Test with VS Code high contrast theme
- [ ] Verify all UI elements remain visible
- [ ] Check focus indicators are prominent

### Motor Accessibility Testing
- [ ] **Large Click Targets**: Minimum 44x44px for buttons
- [ ] **Spacing**: Adequate spacing between interactive elements
- [ ] **Drag and Drop**: Alternative keyboard methods available
- [ ] **Timeout**: No time limits on essential tasks

### Cognitive Accessibility Testing
- [ ] **Clear Language**: Plain language used throughout
- [ ] **Consistent Navigation**: Predictable interaction patterns
- [ ] **Error Prevention**: Clear validation and confirmation
- [ ] **Help Documentation**: Accessible help and instructions

### User Preference Respecting
- [ ] **Reduced Motion**: Animations disabled when requested
- [ ] **High Contrast**: Enhanced contrast when requested  
- [ ] **Large Text**: Text scales properly up to 200%
- [ ] **Dark/Light Mode**: Follows VS Code theme preferences
```

## 🛠️ Tools and Procedures

### Development Tools

```bash
# Install accessibility testing tools
npm install --save-dev @axe-core/react jest-axe
npm install --save-dev @testing-library/jest-dom
npm install --save-dev eslint-plugin-jsx-a11y

# VS Code extensions for accessibility
code --install-extension deque-systems.vscode-axe-linter
code --install-extension streetsidesoftware.code-spell-checker
```

### ESLint Accessibility Rules

```json
// .eslintrc.json
{
  "extends": [
    "plugin:jsx-a11y/recommended"
  ],
  "plugins": [
    "jsx-a11y"
  ],
  "rules": {
    "jsx-a11y/alt-text": "error",
    "jsx-a11y/aria-props": "error",
    "jsx-a11y/aria-proptypes": "error",
    "jsx-a11y/aria-unsupported-elements": "error",
    "jsx-a11y/role-has-required-aria-props": "error",
    "jsx-a11y/role-supports-aria-props": "error",
    "jsx-a11y/tabindex-no-positive": "error",
    "jsx-a11y/heading-has-content": "error",
    "jsx-a11y/html-has-lang": "error",
    "jsx-a11y/lang": "error",
    "jsx-a11y/no-distracting-elements": "error",
    "jsx-a11y/scope": "error",
    "jsx-a11y/click-events-have-key-events": "error",
    "jsx-a11y/no-static-element-interactions": "error",
    "jsx-a11y/anchor-is-valid": "error",
    "jsx-a11y/mouse-events-have-key-events": "error"
  }
}
```

## 📝 Implementation Checklist

### Foundation ✅
- [ ] AccessibilityProvider component created
- [ ] Screen reader announcement system implemented
- [ ] Keyboard shortcut handler setup
- [ ] Focus management utilities created
- [ ] Skip links implemented

### VS Code Integration ✅
- [ ] Webview accessibility enhancements
- [ ] VS Code theme integration
- [ ] Extension accessibility metadata
- [ ] Keyboard shortcut registration
- [ ] Configuration options for accessibility

### WCAG Compliance ✅
- [ ] Color contrast validation
- [ ] Alternative text implementation
- [ ] Heading structure validation
- [ ] Form label associations
- [ ] Error message accessibility

### Screen Reader Support ✅
- [ ] ARIA labels and descriptions
- [ ] Live regions for dynamic content
- [ ] Semantic HTML structure
- [ ] Tool call state announcements
- [ ] Connection status announcements

### Testing Framework ✅
- [ ] Automated accessibility testing with axe
- [ ] Keyboard navigation tests
- [ ] Screen reader testing procedures
- [ ] High contrast mode testing
- [ ] Manual testing checklist

### User Preferences ✅
- [ ] Reduced motion support
- [ ] High contrast mode support
- [ ] Text scaling support
- [ ] Theme preference integration
- [ ] Customizable announcements

### Documentation ✅
- [ ] Implementation guidelines
- [ ] Testing procedures
- [ ] Compliance validation
- [ ] Troubleshooting guide

---

This comprehensive accessibility implementation ensures the OpenCode VS Code extension meets the highest standards for inclusive design, providing equal access to all users regardless of their abilities or assistive technologies used.