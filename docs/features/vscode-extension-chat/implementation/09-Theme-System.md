# 09-Theme-System.md

**Dynamic Theme System for OpenCode HTML Implementation**

---

## 🎯 Overview

This document covers the comprehensive theme system implementation for the OpenCode HTML clone, providing dynamic theming capabilities that match the TUI's 25+ theme support. The system uses CSS custom properties, React context, and intelligent theme switching to create a seamless theming experience.

## 🎨 Theme System Architecture

### Core Components
- **CSS Custom Properties**: Foundation for theme variables and dynamic switching
- **Theme Context**: React context for theme state management and persistence
- **Theme Registry**: Centralized theme loading and validation system
- **VS Code Integration**: Automatic theme detection and synchronization
- **Performance Optimization**: Efficient theme switching with minimal reflows

### Theme Structure
```typescript
// src/types/theme.ts - Theme type definitions
export interface Theme {
  id: string
  name: string
  displayName: string
  category: 'light' | 'dark' | 'high-contrast'
  
  colors: {
    // Background Colors
    background: string
    backgroundSecondary: string
    backgroundTertiary: string
    backgroundOverlay: string
    
    // Text Colors
    foreground: string
    foregroundSecondary: string
    foregroundMuted: string
    foregroundInverse: string
    
    // Accent Colors
    primary: string
    secondary: string
    accent: string
    
    // Status Colors
    success: string
    warning: string
    error: string
    info: string
    
    // Border Colors
    border: string
    borderSecondary: string
    borderFocus: string
    
    // Tool-specific Colors
    toolPending: string
    toolRunning: string
    toolCompleted: string
    toolError: string
    
    // Message Colors
    userMessage: string
    assistantMessage: string
    systemMessage: string
    
    // Syntax Highlighting
    syntax: {
      comment: string
      keyword: string
      string: string
      number: string
      operator: string
      function: string
      variable: string
      type: string
    }
  }
  
  typography: {
    fontFamily: string
    fontFamilyMono: string
    fontSize: {
      xs: string
      sm: string
      base: string
      lg: string
      xl: string
    }
    lineHeight: {
      tight: string
      normal: string
      relaxed: string
    }
    fontWeight: {
      normal: string
      medium: string
      semibold: string
      bold: string
    }
  }
  
  spacing: {
    xs: string
    sm: string
    md: string
    lg: string
    xl: string
    xxl: string
  }
  
  borderRadius: {
    none: string
    sm: string
    md: string
    lg: string
    full: string
  }
  
  shadows: {
    none: string
    sm: string
    md: string
    lg: string
    xl: string
  }
  
  animations: {
    transitionFast: string
    transitionNormal: string
    transitionSlow: string
  }
}

export interface ThemeManifest {
  version: string
  themes: ThemeDefinition[]
}

export interface ThemeDefinition {
  id: string
  name: string
  path: string
  category: 'light' | 'dark' | 'high-contrast'
  preview?: {
    background: string
    foreground: string
    accent: string
  }
}
```

## 💻 Implementation

### 1. Theme Provider and Context

```typescript
// src/contexts/ThemeContext.tsx - Main theme context provider
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { Theme, ThemeDefinition } from '@types/theme'
import { themeRegistry } from '@services/themeRegistry'
import { useVSCodeThemeSync } from '@hooks/useVSCodeThemeSync'

interface ThemeContextValue {
  currentTheme: Theme | null
  currentThemeId: string
  availableThemes: ThemeDefinition[]
  isLoading: boolean
  error: string | null
  
  // Actions
  setTheme: (themeId: string) => Promise<void>
  toggleThemeCategory: () => Promise<void>
  refreshThemes: () => Promise<void>
  preloadTheme: (themeId: string) => Promise<void>
  
  // VS Code integration
  syncWithVSCode: boolean
  setSyncWithVSCode: (sync: boolean) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<Theme | null>(null)
  const [currentThemeId, setCurrentThemeId] = useState<string>('default-dark')
  const [availableThemes, setAvailableThemes] = useState<ThemeDefinition[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncWithVSCode, setSyncWithVSCode] = useState(true)
  
  const { vscodeTheme } = useVSCodeThemeSync(syncWithVSCode)
  
  // Initialize themes on mount
  useEffect(() => {
    initializeThemes()
  }, [])
  
  // Sync with VS Code theme changes
  useEffect(() => {
    if (syncWithVSCode && vscodeTheme) {
      const matchingTheme = findMatchingTheme(vscodeTheme)
      if (matchingTheme && matchingTheme.id !== currentThemeId) {
        setTheme(matchingTheme.id)
      }
    }
  }, [vscodeTheme, syncWithVSCode, currentThemeId])
  
  const initializeThemes = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Load theme registry
      await themeRegistry.initialize()
      const themes = themeRegistry.getAvailableThemes()
      setAvailableThemes(themes)
      
      // Load persisted theme or default
      const savedThemeId = localStorage.getItem('opencode-theme-id')
      const themeId = savedThemeId || 'default-dark'
      
      await setTheme(themeId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load themes')
      console.error('Theme initialization failed:', err)
      
      // Fallback to built-in default theme
      await loadFallbackTheme()
    } finally {
      setIsLoading(false)
    }
  }
  
  const setTheme = useCallback(async (themeId: string) => {
    try {
      setError(null)
      
      const theme = await themeRegistry.loadTheme(themeId)
      if (!theme) {
        throw new Error(`Theme '${themeId}' not found`)
      }
      
      // Apply theme to document
      applyThemeToDocument(theme)
      
      // Update state
      setCurrentTheme(theme)
      setCurrentThemeId(themeId)
      
      // Persist theme preference
      localStorage.setItem('opencode-theme-id', themeId)
      
      // Announce theme change for screen readers
      announceThemeChange(theme.displayName)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load theme')
      console.error('Theme loading failed:', err)
    }
  }, [])
  
  const toggleThemeCategory = useCallback(async () => {
    if (!currentTheme) return
    
    const currentCategory = currentTheme.category
    const targetCategory = currentCategory === 'dark' ? 'light' : 'dark'
    
    // Find a theme in the target category
    const targetTheme = availableThemes.find(t => t.category === targetCategory)
    if (targetTheme) {
      await setTheme(targetTheme.id)
    }
  }, [currentTheme, availableThemes, setTheme])
  
  const refreshThemes = useCallback(async () => {
    await themeRegistry.refresh()
    const themes = themeRegistry.getAvailableThemes()
    setAvailableThemes(themes)
  }, [])
  
  const preloadTheme = useCallback(async (themeId: string) => {
    try {
      await themeRegistry.preloadTheme(themeId)
    } catch (err) {
      console.warn('Theme preload failed:', err)
    }
  }, [])
  
  return (
    <ThemeContext.Provider value={{
      currentTheme,
      currentThemeId,
      availableThemes,
      isLoading,
      error,
      setTheme,
      toggleThemeCategory,
      refreshThemes,
      preloadTheme,
      syncWithVSCode,
      setSyncWithVSCode
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}

// Helper functions
function applyThemeToDocument(theme: Theme) {
  const root = document.documentElement
  
  // Apply color variables
  Object.entries(theme.colors).forEach(([key, value]) => {
    if (typeof value === 'string') {
      root.style.setProperty(`--color-${kebabCase(key)}`, value)
    } else if (typeof value === 'object') {
      // Handle nested objects like syntax colors
      Object.entries(value).forEach(([nestedKey, nestedValue]) => {
        root.style.setProperty(`--color-${kebabCase(key)}-${kebabCase(nestedKey)}`, nestedValue)
      })
    }
  })
  
  // Apply typography variables
  Object.entries(theme.typography).forEach(([key, value]) => {
    if (typeof value === 'string') {
      root.style.setProperty(`--typography-${kebabCase(key)}`, value)
    } else if (typeof value === 'object') {
      Object.entries(value).forEach(([nestedKey, nestedValue]) => {
        root.style.setProperty(`--typography-${kebabCase(key)}-${kebabCase(nestedKey)}`, nestedValue)
      })
    }
  })
  
  // Apply spacing variables
  Object.entries(theme.spacing).forEach(([key, value]) => {
    root.style.setProperty(`--space-${key}`, value)
  })
  
  // Apply other design token categories
  Object.entries(theme.borderRadius).forEach(([key, value]) => {
    root.style.setProperty(`--radius-${key}`, value)
  })
  
  Object.entries(theme.shadows).forEach(([key, value]) => {
    root.style.setProperty(`--shadow-${key}`, value)
  })
  
  Object.entries(theme.animations).forEach(([key, value]) => {
    root.style.setProperty(`--${kebabCase(key)}`, value)
  })
  
  // Set theme category data attribute
  root.setAttribute('data-theme', theme.id)
  root.setAttribute('data-theme-category', theme.category)
}

function findMatchingTheme(vscodeTheme: any): ThemeDefinition | null {
  // Implementation to match VS Code theme to available themes
  // This would use heuristics based on theme names, categories, etc.
  return null
}

function announceThemeChange(themeName: string) {
  // Create announcement for screen readers
  const announcement = document.createElement('div')
  announcement.setAttribute('aria-live', 'polite')
  announcement.setAttribute('aria-atomic', 'true')
  announcement.className = 'sr-only'
  announcement.textContent = `Theme changed to ${themeName}`
  
  document.body.appendChild(announcement)
  setTimeout(() => document.body.removeChild(announcement), 1000)
}

function kebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
}

async function loadFallbackTheme() {
  // Implementation for loading a built-in fallback theme
  const fallbackTheme = createDefaultTheme()
  applyThemeToDocument(fallbackTheme)
  setCurrentTheme(fallbackTheme)
}
```

### 2. Theme Registry Service

```typescript
// src/services/themeRegistry.ts - Theme loading and management service
import { Theme, ThemeDefinition, ThemeManifest } from '@types/theme'

class ThemeRegistry {
  private themes = new Map<string, Theme>()
  private themeDefinitions: ThemeDefinition[] = []
  private preloadedThemes = new Set<string>()
  private manifestCache: ThemeManifest | null = null
  
  async initialize() {
    try {
      // Load theme manifest
      this.manifestCache = await this.loadThemeManifest()
      this.themeDefinitions = this.manifestCache.themes
      
      // Preload default themes
      await this.preloadEssentialThemes()
      
    } catch (error) {
      console.error('Theme registry initialization failed:', error)
      // Fall back to built-in themes
      this.loadBuiltInThemes()
    }
  }
  
  async loadThemeManifest(): Promise<ThemeManifest> {
    const response = await fetch('/themes/manifest.json')
    if (!response.ok) {
      throw new Error(`Failed to load theme manifest: ${response.statusText}`)
    }
    return response.json()
  }
  
  async loadTheme(themeId: string): Promise<Theme | null> {
    // Return cached theme if available
    if (this.themes.has(themeId)) {
      return this.themes.get(themeId)!
    }
    
    // Find theme definition
    const definition = this.themeDefinitions.find(t => t.id === themeId)
    if (!definition) {
      console.warn(`Theme definition not found: ${themeId}`)
      return null
    }
    
    try {
      // Load theme file
      const response = await fetch(definition.path)
      if (!response.ok) {
        throw new Error(`Failed to load theme: ${response.statusText}`)
      }
      
      const themeData = await response.json()
      const theme = this.validateAndNormalizeTheme(themeData, definition)
      
      // Cache the theme
      this.themes.set(themeId, theme)
      
      return theme
      
    } catch (error) {
      console.error(`Failed to load theme ${themeId}:`, error)
      return null
    }
  }
  
  async preloadTheme(themeId: string): Promise<void> {
    if (this.preloadedThemes.has(themeId)) return
    
    try {
      await this.loadTheme(themeId)
      this.preloadedThemes.add(themeId)
    } catch (error) {
      console.warn(`Failed to preload theme ${themeId}:`, error)
    }
  }
  
  async preloadEssentialThemes(): Promise<void> {
    const essentialThemes = ['default-dark', 'default-light', 'high-contrast-dark']
    
    await Promise.allSettled(
      essentialThemes.map(themeId => this.preloadTheme(themeId))
    )
  }
  
  getAvailableThemes(): ThemeDefinition[] {
    return [...this.themeDefinitions]
  }
  
  getThemesByCategory(category: 'light' | 'dark' | 'high-contrast'): ThemeDefinition[] {
    return this.themeDefinitions.filter(theme => theme.category === category)
  }
  
  async refresh(): Promise<void> {
    // Clear caches
    this.themes.clear()
    this.preloadedThemes.clear()
    this.manifestCache = null
    
    // Reinitialize
    await this.initialize()
  }
  
  private validateAndNormalizeTheme(themeData: any, definition: ThemeDefinition): Theme {
    // Validate required properties
    if (!themeData.colors || !themeData.typography) {
      throw new Error('Invalid theme: missing required properties')
    }
    
    // Create normalized theme object with defaults
    const theme: Theme = {
      id: definition.id,
      name: definition.name,
      displayName: themeData.displayName || definition.name,
      category: definition.category,
      
      colors: {
        background: themeData.colors.background || '#ffffff',
        backgroundSecondary: themeData.colors.backgroundSecondary || '#f8f9fa',
        backgroundTertiary: themeData.colors.backgroundTertiary || '#e9ecef',
        backgroundOverlay: themeData.colors.backgroundOverlay || 'rgba(0, 0, 0, 0.1)',
        
        foreground: themeData.colors.foreground || '#212529',
        foregroundSecondary: themeData.colors.foregroundSecondary || '#6c757d',
        foregroundMuted: themeData.colors.foregroundMuted || '#868e96',
        foregroundInverse: themeData.colors.foregroundInverse || '#ffffff',
        
        primary: themeData.colors.primary || '#007acc',
        secondary: themeData.colors.secondary || '#6c757d',
        accent: themeData.colors.accent || '#007acc',
        
        success: themeData.colors.success || '#28a745',
        warning: themeData.colors.warning || '#ffc107',
        error: themeData.colors.error || '#dc3545',
        info: themeData.colors.info || '#17a2b8',
        
        border: themeData.colors.border || '#dee2e6',
        borderSecondary: themeData.colors.borderSecondary || '#ced4da',
        borderFocus: themeData.colors.borderFocus || '#007acc',
        
        toolPending: themeData.colors.toolPending || '#ffc107',
        toolRunning: themeData.colors.toolRunning || '#007acc',
        toolCompleted: themeData.colors.toolCompleted || '#28a745',
        toolError: themeData.colors.toolError || '#dc3545',
        
        userMessage: themeData.colors.userMessage || '#e3f2fd',
        assistantMessage: themeData.colors.assistantMessage || '#f3e5f5',
        systemMessage: themeData.colors.systemMessage || '#fff3e0',
        
        syntax: {
          comment: themeData.colors.syntax?.comment || '#6a737d',
          keyword: themeData.colors.syntax?.keyword || '#d73a49',
          string: themeData.colors.syntax?.string || '#032f62',
          number: themeData.colors.syntax?.number || '#005cc5',
          operator: themeData.colors.syntax?.operator || '#d73a49',
          function: themeData.colors.syntax?.function || '#6f42c1',
          variable: themeData.colors.syntax?.variable || '#e36209',
          type: themeData.colors.syntax?.type || '#005cc5'
        }
      },
      
      typography: {
        fontFamily: themeData.typography.fontFamily || 
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontFamilyMono: themeData.typography.fontFamilyMono || 
          'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
        fontSize: {
          xs: themeData.typography.fontSize?.xs || '0.75rem',
          sm: themeData.typography.fontSize?.sm || '0.875rem',
          base: themeData.typography.fontSize?.base || '1rem',
          lg: themeData.typography.fontSize?.lg || '1.125rem',
          xl: themeData.typography.fontSize?.xl || '1.25rem'
        },
        lineHeight: {
          tight: themeData.typography.lineHeight?.tight || '1.25',
          normal: themeData.typography.lineHeight?.normal || '1.5',
          relaxed: themeData.typography.lineHeight?.relaxed || '1.75'
        },
        fontWeight: {
          normal: themeData.typography.fontWeight?.normal || '400',
          medium: themeData.typography.fontWeight?.medium || '500',
          semibold: themeData.typography.fontWeight?.semibold || '600',
          bold: themeData.typography.fontWeight?.bold || '700'
        }
      },
      
      spacing: {
        xs: themeData.spacing?.xs || '0.25rem',
        sm: themeData.spacing?.sm || '0.5rem',
        md: themeData.spacing?.md || '1rem',
        lg: themeData.spacing?.lg || '1.5rem',
        xl: themeData.spacing?.xl || '2rem',
        xxl: themeData.spacing?.xxl || '3rem'
      },
      
      borderRadius: {
        none: themeData.borderRadius?.none || '0',
        sm: themeData.borderRadius?.sm || '0.125rem',
        md: themeData.borderRadius?.md || '0.25rem',
        lg: themeData.borderRadius?.lg || '0.5rem',
        full: themeData.borderRadius?.full || '9999px'
      },
      
      shadows: {
        none: themeData.shadows?.none || 'none',
        sm: themeData.shadows?.sm || '0 1px 2px rgba(0, 0, 0, 0.05)',
        md: themeData.shadows?.md || '0 4px 6px rgba(0, 0, 0, 0.1)',
        lg: themeData.shadows?.lg || '0 10px 15px rgba(0, 0, 0, 0.1)',
        xl: themeData.shadows?.xl || '0 20px 25px rgba(0, 0, 0, 0.15)'
      },
      
      animations: {
        transitionFast: themeData.animations?.transitionFast || '0.15s ease',
        transitionNormal: themeData.animations?.transitionNormal || '0.25s ease',
        transitionSlow: themeData.animations?.transitionSlow || '0.35s ease'
      }
    }
    
    return theme
  }
  
  private loadBuiltInThemes(): void {
    // Load minimal built-in themes as fallback
    this.themeDefinitions = [
      {
        id: 'default-dark',
        name: 'Default Dark',
        path: '/themes/built-in/default-dark.json',
        category: 'dark'
      },
      {
        id: 'default-light',
        name: 'Default Light', 
        path: '/themes/built-in/default-light.json',
        category: 'light'
      }
    ]
  }
}

export const themeRegistry = new ThemeRegistry()
```

### 3. VS Code Theme Synchronization

```typescript
// src/hooks/useVSCodeThemeSync.ts - VS Code theme integration
import { useState, useEffect } from 'react'

interface VSCodeThemeInfo {
  kind: number // 1 = light, 2 = dark, 3 = high contrast
  name: string
}

export function useVSCodeThemeSync(enabled: boolean) {
  const [vscodeTheme, setVSCodeTheme] = useState<VSCodeThemeInfo | null>(null)
  const [isVSCodeEnvironment, setIsVSCodeEnvironment] = useState(false)
  
  useEffect(() => {
    // Detect if running in VS Code webview
    const isVSCode = typeof window !== 'undefined' && 
                     (window as any).acquireVsCodeApi !== undefined
    
    setIsVSCodeEnvironment(isVSCode)
    
    if (!enabled || !isVSCode) return
    
    // Get VS Code API
    const vscode = (window as any).acquireVsCodeApi()
    
    // Request current theme
    vscode.postMessage({
      command: 'getTheme'
    })
    
    // Listen for theme changes
    const handleMessage = (event: MessageEvent) => {
      if (event.data.command === 'themeChanged') {
        setVSCodeTheme(event.data.theme)
      }
    }
    
    window.addEventListener('message', handleMessage)
    
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [enabled])
  
  const requestThemeChange = (themeId: string) => {
    if (!isVSCodeEnvironment) return
    
    const vscode = (window as any).acquireVsCodeApi()
    vscode.postMessage({
      command: 'changeTheme',
      themeId
    })
  }
  
  return {
    vscodeTheme,
    isVSCodeEnvironment,
    requestThemeChange
  }
}

// Example VS Code extension integration (for reference)
/*
// In VS Code extension code:
const panel = vscode.window.createWebviewPanel(
  'opencode',
  'OpenCode',
  vscode.ViewColumn.One,
  {
    enableScripts: true,
    retainContextWhenHidden: true
  }
)

// Listen for theme changes
vscode.workspace.onDidChangeConfiguration(e => {
  if (e.affectsConfiguration('workbench.colorTheme')) {
    const theme = vscode.workspace.getConfiguration().get('workbench.colorTheme')
    panel.webview.postMessage({
      command: 'themeChanged',
      theme: {
        name: theme,
        kind: vscode.window.activeColorTheme.kind
      }
    })
  }
})

// Handle messages from webview
panel.webview.onDidReceiveMessage(message => {
  switch (message.command) {
    case 'getTheme':
      panel.webview.postMessage({
        command: 'themeChanged',
        theme: {
          name: vscode.workspace.getConfiguration().get('workbench.colorTheme'),
          kind: vscode.window.activeColorTheme.kind
        }
      })
      break
      
    case 'changeTheme':
      vscode.workspace.getConfiguration().update(
        'workbench.colorTheme',
        message.themeId,
        vscode.ConfigurationTarget.Global
      )
      break
  }
})
*/
```

### 4. Theme Utilities and Hooks

```typescript
// src/hooks/useThemeVariables.ts - Hook for accessing theme variables
import { useTheme } from '@contexts/ThemeContext'
import { useMemo } from 'react'

export function useThemeVariables() {
  const { currentTheme } = useTheme()
  
  const cssVariables = useMemo(() => {
    if (!currentTheme) return {}
    
    const variables: Record<string, string> = {}
    
    // Flatten theme colors to CSS variables
    Object.entries(currentTheme.colors).forEach(([key, value]) => {
      if (typeof value === 'string') {
        variables[`--color-${kebabCase(key)}`] = value
      } else if (typeof value === 'object') {
        Object.entries(value).forEach(([nestedKey, nestedValue]) => {
          variables[`--color-${kebabCase(key)}-${kebabCase(nestedKey)}`] = nestedValue
        })
      }
    })
    
    return variables
  }, [currentTheme])
  
  const getColor = (colorKey: string): string => {
    if (!currentTheme) return ''
    
    const keys = colorKey.split('.')
    let value: any = currentTheme.colors
    
    for (const key of keys) {
      value = value?.[key]
      if (value === undefined) break
    }
    
    return typeof value === 'string' ? value : ''
  }
  
  const getSpacing = (spacingKey: keyof typeof currentTheme.spacing): string => {
    return currentTheme?.spacing[spacingKey] || '0'
  }
  
  const getFontSize = (sizeKey: keyof typeof currentTheme.typography.fontSize): string => {
    return currentTheme?.typography.fontSize[sizeKey] || '1rem'
  }
  
  return {
    cssVariables,
    getColor,
    getSpacing,
    getFontSize,
    theme: currentTheme
  }
}

function kebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
}
```

### 5. Theme Selector Component

```typescript
// src/components/theme/ThemeSelector.tsx - Theme selection UI
import React, { useState } from 'react'
import { useTheme } from '@contexts/ThemeContext'
import { ChevronDown, Check, Monitor, Moon, Sun } from 'lucide-react'

export function ThemeSelector() {
  const { 
    currentThemeId, 
    availableThemes, 
    setTheme, 
    toggleThemeCategory,
    syncWithVSCode,
    setSyncWithVSCode,
    isLoading 
  } = useTheme()
  
  const [isOpen, setIsOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'light' | 'dark' | 'high-contrast'>('all')
  
  const filteredThemes = availableThemes.filter(theme => 
    selectedCategory === 'all' || theme.category === selectedCategory
  )
  
  const currentTheme = availableThemes.find(t => t.id === currentThemeId)
  
  const handleThemeSelect = async (themeId: string) => {
    await setTheme(themeId)
    setIsOpen(false)
  }
  
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'light': return <Sun className="w-4 h-4" />
      case 'dark': return <Moon className="w-4 h-4" />
      case 'high-contrast': return <Monitor className="w-4 h-4" />
      default: return null
    }
  }
  
  return (
    <div className="theme-selector relative">
      <button
        className="theme-selector__trigger"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Select theme"
      >
        <div className="flex items-center gap-2">
          {currentTheme && getCategoryIcon(currentTheme.category)}
          <span className="truncate">
            {currentTheme?.name || 'Loading...'}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="theme-selector__dropdown">
          <div className="theme-selector__header">
            <div className="theme-selector__category-filters">
              <button
                className={`category-filter ${selectedCategory === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('all')}
              >
                All
              </button>
              <button
                className={`category-filter ${selectedCategory === 'light' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('light')}
              >
                <Sun className="w-3 h-3" />
                Light
              </button>
              <button
                className={`category-filter ${selectedCategory === 'dark' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('dark')}
              >
                <Moon className="w-3 h-3" />
                Dark
              </button>
              <button
                className={`category-filter ${selectedCategory === 'high-contrast' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('high-contrast')}
              >
                <Monitor className="w-3 h-3" />
                High Contrast
              </button>
            </div>
            
            <div className="theme-selector__sync-toggle">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={syncWithVSCode}
                  onChange={(e) => setSyncWithVSCode(e.target.checked)}
                />
                Sync with VS Code
              </label>
            </div>
          </div>
          
          <div className="theme-selector__list" role="listbox">
            {filteredThemes.map((theme) => (
              <button
                key={theme.id}
                className={`theme-selector__item ${theme.id === currentThemeId ? 'selected' : ''}`}
                onClick={() => handleThemeSelect(theme.id)}
                role="option"
                aria-selected={theme.id === currentThemeId}
              >
                <div className="flex items-center gap-3">
                  <div className="theme-preview">
                    {theme.preview && (
                      <div className="theme-preview__colors">
                        <div 
                          className="color-swatch"
                          style={{ backgroundColor: theme.preview.background }}
                        />
                        <div 
                          className="color-swatch"
                          style={{ backgroundColor: theme.preview.accent }}
                        />
                        <div 
                          className="color-swatch"
                          style={{ backgroundColor: theme.preview.foreground }}
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <div className="theme-name">{theme.name}</div>
                    <div className="theme-category">
                      {getCategoryIcon(theme.category)}
                      <span className="capitalize">{theme.category}</span>
                    </div>
                  </div>
                  
                  {theme.id === currentThemeId && (
                    <Check className="w-4 h-4 text-success" />
                  )}
                </div>
              </button>
            ))}
          </div>
          
          <div className="theme-selector__actions">
            <button
              className="action-button"
              onClick={toggleThemeCategory}
              title="Toggle between light and dark themes"
            >
              Toggle Light/Dark
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

### 6. Theme CSS Architecture

```css
/* src/styles/themes.css - Theme-aware component styles */

/* Base theme variables that can be overridden */
:root {
  /* Dynamic theme variables - will be overridden by ThemeProvider */
  --color-background: #ffffff;
  --color-foreground: #000000;
  /* ... other variables */
}

/* Component styles using theme variables */
.opencode-app {
  background-color: var(--color-background);
  color: var(--color-foreground);
  font-family: var(--typography-font-family);
  transition: var(--transition-normal);
}

/* Message components */
.message {
  background-color: var(--color-background-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  margin-bottom: var(--space-sm);
}

.message--user {
  background-color: var(--color-user-message);
}

.message--assistant {
  background-color: var(--color-assistant-message);
}

.message--system {
  background-color: var(--color-system-message);
}

/* Tool execution components */
.tool-call {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: var(--transition-normal);
}

.tool-call--pending {
  border-color: var(--color-tool-pending);
  background-color: color-mix(in srgb, var(--color-tool-pending) 10%, transparent);
}

.tool-call--running {
  border-color: var(--color-tool-running);
  background-color: color-mix(in srgb, var(--color-tool-running) 10%, transparent);
}

.tool-call--completed {
  border-color: var(--color-tool-completed);
  background-color: color-mix(in srgb, var(--color-tool-completed) 5%, transparent);
}

.tool-call--error {
  border-color: var(--color-tool-error);
  background-color: color-mix(in srgb, var(--color-tool-error) 10%, transparent);
}

/* Syntax highlighting */
.syntax-highlight {
  font-family: var(--typography-font-family-mono);
  font-size: var(--typography-font-size-sm);
  line-height: var(--typography-line-height-normal);
}

.syntax-comment { color: var(--color-syntax-comment); }
.syntax-keyword { color: var(--color-syntax-keyword); }
.syntax-string { color: var(--color-syntax-string); }
.syntax-number { color: var(--color-syntax-number); }
.syntax-operator { color: var(--color-syntax-operator); }
.syntax-function { color: var(--color-syntax-function); }
.syntax-variable { color: var(--color-syntax-variable); }
.syntax-type { color: var(--color-syntax-type); }

/* Theme selector component */
.theme-selector {
  position: relative;
}

.theme-selector__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  background-color: var(--color-background-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-foreground);
  cursor: pointer;
  transition: var(--transition-fast);
}

.theme-selector__trigger:hover {
  background-color: var(--color-background-tertiary);
  border-color: var(--color-border-focus);
}

.theme-selector__trigger:focus {
  outline: 2px solid var(--color-border-focus);
  outline-offset: 2px;
}

.theme-selector__dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 50;
  margin-top: var(--space-xs);
  background-color: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.theme-selector__header {
  padding: var(--space-md);
  border-bottom: 1px solid var(--color-border);
  background-color: var(--color-background-secondary);
}

.theme-selector__category-filters {
  display: flex;
  gap: var(--space-xs);
  margin-bottom: var(--space-sm);
}

.category-filter {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background-color: var(--color-background);
  color: var(--color-foreground-secondary);
  font-size: var(--typography-font-size-xs);
  cursor: pointer;
  transition: var(--transition-fast);
}

.category-filter:hover {
  background-color: var(--color-background-tertiary);
}

.category-filter.active {
  background-color: var(--color-primary);
  color: var(--color-foreground-inverse);
  border-color: var(--color-primary);
}

.theme-selector__list {
  max-height: 300px;
  overflow-y: auto;
}

.theme-selector__item {
  display: block;
  width: 100%;
  padding: var(--space-md);
  border: none;
  background: none;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: var(--transition-fast);
}

.theme-selector__item:hover {
  background-color: var(--color-background-secondary);
}

.theme-selector__item.selected {
  background-color: var(--color-primary);
  color: var(--color-foreground-inverse);
}

.theme-preview__colors {
  display: flex;
  gap: 2px;
}

.color-swatch {
  width: 12px;
  height: 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-secondary);
}

.theme-name {
  font-weight: var(--typography-font-weight-medium);
  margin-bottom: 2px;
}

.theme-category {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--typography-font-size-xs);
  color: var(--color-foreground-muted);
}

/* High contrast theme adjustments */
[data-theme-category="high-contrast"] {
  --color-border: #000000;
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.3);
}

[data-theme-category="high-contrast"] .tool-call {
  border-width: 2px;
}

[data-theme-category="high-contrast"] button:focus {
  outline: 3px solid var(--color-border-focus);
  outline-offset: 2px;
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Print styles */
@media print {
  .theme-selector,
  .tool-call__animations {
    display: none !important;
  }
  
  .tool-call {
    border: 1px solid #000 !important;
    break-inside: avoid;
  }
}
```

### 7. Performance Optimization

```typescript
// src/hooks/useThemePerformance.ts - Performance optimization for theme switching
import { useCallback, useRef } from 'react'

export function useThemePerformance() {
  const pendingThemeChange = useRef<string | null>(null)
  const themeChangeTimeout = useRef<NodeJS.Timeout | null>(null)
  
  const optimizedThemeChange = useCallback((themeId: string, setTheme: (id: string) => Promise<void>) => {
    // Debounce rapid theme changes
    if (themeChangeTimeout.current) {
      clearTimeout(themeChangeTimeout.current)
    }
    
    pendingThemeChange.current = themeId
    
    themeChangeTimeout.current = setTimeout(async () => {
      if (pendingThemeChange.current) {
        // Use requestIdleCallback for non-critical theme changes
        if ('requestIdleCallback' in window) {
          requestIdleCallback(() => {
            if (pendingThemeChange.current) {
              setTheme(pendingThemeChange.current)
              pendingThemeChange.current = null
            }
          })
        } else {
          await setTheme(pendingThemeChange.current)
          pendingThemeChange.current = null
        }
      }
    }, 100)
  }, [])
  
  const preloadThemeCSS = useCallback((themeId: string) => {
    // Create link element to preload theme CSS
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'style'
    link.href = `/themes/${themeId}.css`
    document.head.appendChild(link)
    
    // Clean up after 5 seconds
    setTimeout(() => {
      document.head.removeChild(link)
    }, 5000)
  }, [])
  
  return {
    optimizedThemeChange,
    preloadThemeCSS
  }
}
```

## 📝 Example Theme Definitions

### Default Dark Theme
```json
{
  "id": "default-dark",
  "name": "Default Dark",
  "displayName": "OpenCode Dark",
  "category": "dark",
  "colors": {
    "background": "#1a1a1a",
    "backgroundSecondary": "#2d2d2d",
    "backgroundTertiary": "#404040",
    "backgroundOverlay": "rgba(0, 0, 0, 0.5)",
    
    "foreground": "#ffffff",
    "foregroundSecondary": "#cccccc",
    "foregroundMuted": "#999999",
    "foregroundInverse": "#000000",
    
    "primary": "#007acc",
    "secondary": "#6c757d",
    "accent": "#17a2b8",
    
    "success": "#28a745",
    "warning": "#ffc107",
    "error": "#dc3545",
    "info": "#17a2b8",
    
    "border": "#404040",
    "borderSecondary": "#555555",
    "borderFocus": "#007acc",
    
    "toolPending": "#ffc107",
    "toolRunning": "#007acc",
    "toolCompleted": "#28a745",
    "toolError": "#dc3545",
    
    "userMessage": "#264060",
    "assistantMessage": "#2d5a3d",
    "systemMessage": "#5a4d2d",
    
    "syntax": {
      "comment": "#6a737d",
      "keyword": "#f97583",
      "string": "#9ecbff",
      "number": "#79b8ff",
      "operator": "#f97583",
      "function": "#b392f0",
      "variable": "#ffab70",
      "type": "#79b8ff"
    }
  },
  "typography": {
    "fontFamily": "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    "fontFamilyMono": "SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace"
  }
}
```

### High Contrast Theme
```json
{
  "id": "high-contrast-dark",
  "name": "High Contrast Dark",
  "displayName": "High Contrast Dark",
  "category": "high-contrast",
  "colors": {
    "background": "#000000",
    "backgroundSecondary": "#1a1a1a",
    "backgroundTertiary": "#333333",
    "backgroundOverlay": "rgba(0, 0, 0, 0.8)",
    
    "foreground": "#ffffff",
    "foregroundSecondary": "#ffffff",
    "foregroundMuted": "#cccccc",
    "foregroundInverse": "#000000",
    
    "primary": "#ffffff",
    "secondary": "#ffffff",
    "accent": "#ffff00",
    
    "success": "#00ff00",
    "warning": "#ffff00",
    "error": "#ff0000",
    "info": "#00ffff",
    
    "border": "#ffffff",
    "borderSecondary": "#cccccc",
    "borderFocus": "#ffff00",
    
    "toolPending": "#ffff00",
    "toolRunning": "#00ffff",
    "toolCompleted": "#00ff00",
    "toolError": "#ff0000",
    
    "userMessage": "#003366",
    "assistantMessage": "#003300",
    "systemMessage": "#330000",
    
    "syntax": {
      "comment": "#808080",
      "keyword": "#ffffff",
      "string": "#00ff00",
      "number": "#ffff00",
      "operator": "#ffffff",
      "function": "#00ffff",
      "variable": "#ff8000",
      "type": "#00ffff"
    }
  }
}
```

## ✅ Implementation Checklist

### Core Theme System ✅
- [ ] CSS Custom Properties foundation
- [ ] Theme type definitions and interfaces
- [ ] Theme Context and Provider implementation
- [ ] Theme Registry service with validation
- [ ] Theme loading and caching system
- [ ] Error handling and fallback themes

### Dynamic Switching ✅
- [ ] Real-time theme application to DOM
- [ ] Smooth transitions between themes
- [ ] Theme persistence in localStorage
- [ ] Performance optimization for theme changes
- [ ] Screen reader announcements for theme changes

### VS Code Integration ✅
- [ ] VS Code theme detection hook
- [ ] Automatic theme synchronization
- [ ] Theme mapping between VS Code and OpenCode
- [ ] Manual override capabilities
- [ ] Extension message communication

### UI Components ✅
- [ ] Theme Selector component with categories
- [ ] Theme preview swatches
- [ ] Category filtering (light/dark/high-contrast)
- [ ] VS Code sync toggle
- [ ] Quick theme toggle action

### Accessibility ✅
- [ ] High contrast theme support
- [ ] Keyboard navigation for theme selector
- [ ] Screen reader compatibility
- [ ] Focus management during theme changes
- [ ] Reduced motion preference support

### Performance ✅
- [ ] Efficient CSS variable updates
- [ ] Theme preloading for popular themes
- [ ] Debounced theme changes
- [ ] Minimal DOM reflows during switching
- [ ] Bundle optimization for theme assets

---

This comprehensive theme system provides a robust, performant, and accessible theming solution that matches the sophistication of the OpenCode TUI while leveraging modern web technologies for enhanced user experience and VS Code integration.