# 01-Foundation-Setup.md

**Project Setup, Architecture, and Build System for OpenCode HTML Implementation**

---

## 🎯 Overview

This document covers the foundational setup for creating an HTML clone of OpenCode TUI. It includes project structure, build configuration, and core architectural decisions that will support all other features.

## 🏗️ Architecture Foundation

### Technology Stack
- **Frontend Framework**: React 18+ with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **State Management**: Zustand for global application state
- **Styling**: CSS Custom Properties with modular CSS
- **Real-time Communication**: Server-Sent Events (SSE), not WebSockets
- **Development Tools**: ESLint, Prettier, TypeScript strict mode

### Project Structure
```
opencode-html/
├── public/                 # Static assets
├── src/
│   ├── components/        # React components
│   │   ├── chat/         # Chat interface components
│   │   ├── tools/        # Tool execution components
│   │   ├── layout/       # Layout and navigation
│   │   └── ui/           # Reusable UI components
│   ├── services/         # API clients and external services
│   ├── stores/           # Zustand state management
│   ├── hooks/            # Custom React hooks
│   ├── utils/            # Utility functions
│   ├── types/            # TypeScript type definitions
│   ├── styles/           # Global styles and themes
│   └── App.tsx           # Main application component
├── tests/                # Test files
├── docs/                 # Documentation
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```

## 💻 Implementation

### 1. Project Initialization

```bash
# Create new Vite + React + TypeScript project
npm create vite@latest opencode-html -- --template react-ts
cd opencode-html

# Install core dependencies
npm install zustand
npm install @types/node

# Install development dependencies
npm install -D @types/react @types/react-dom
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
npm install -D prettier eslint-config-prettier eslint-plugin-prettier
```

### 2. Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          state: ['zustand'],
          ui: ['prismjs'] // Will add more UI libraries later
        }
      }
    }
  },
  
  optimizeDeps: {
    include: ['react', 'react-dom', 'zustand']
  },
  
  server: {
    port: 5173,
    proxy: {
      '/v1': {
        target: 'http://localhost:3000', // OpenCode server
        changeOrigin: true,
        secure: false
      }
    }
  },
  
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@services': resolve(__dirname, 'src/services'),
      '@stores': resolve(__dirname, 'src/stores'),
      '@hooks': resolve(__dirname, 'src/hooks'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@types': resolve(__dirname, 'src/types'),
      '@styles': resolve(__dirname, 'src/styles')
    }
  }
})
```

### 3. TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,

    /* Path mapping */
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@services/*": ["src/services/*"],
      "@stores/*": ["src/stores/*"],
      "@hooks/*": ["src/hooks/*"],
      "@utils/*": ["src/utils/*"],
      "@types/*": ["src/types/*"],
      "@styles/*": ["src/styles/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### 4. Core Type Definitions

```typescript
// src/types/index.ts - Core type definitions
export interface Session {
  id: string
  title: string
  created_at: string
  updated_at: string
  model_provider: 'anthropic' | 'openai' | 'google' | 'local'
  model_name: string
}

export interface Message {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  tool_calls?: ToolCall[]
}

export type ToolCallState = 'pending' | 'running' | 'completed' | 'error'

export interface ToolCall {
  id: string
  name: string
  parameters: Record<string, any>
  state: ToolCallState
  result?: any
  error?: string
  start_time?: number
  end_time?: number
  
  // UI State
  expanded: boolean
  show_details: boolean
}

export interface SSEMessage {
  type: 'message_start' | 'message_delta' | 'message_end' |
        'tool_call_start' | 'tool_call_delta' | 'tool_call_result' |
        'error' | 'connection_state'
  data: any
  timestamp: string
  session_id: string
}
```

### 5. Main Application Shell

```typescript
// src/App.tsx - Main application component
import React from 'react'
import { ErrorBoundary } from '@components/error/ErrorBoundary'
import { ThemeProvider } from '@components/providers/ThemeProvider'
import { SSEProvider } from '@components/providers/SSEProvider'
import { MainLayout } from '@components/layout/MainLayout'
import '@styles/globals.css'

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <SSEProvider>
          <div className="opencode-app">
            <MainLayout />
          </div>
        </SSEProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
```

### 6. Global Styles Foundation

```css
/* src/styles/globals.css - Global styles and CSS custom properties */

/* CSS Reset and Base Styles */
*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 
               'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  margin: 0;
  padding: 0;
  min-height: 100vh;
  color: var(--text-primary);
  background-color: var(--bg-primary);
}

/* CSS Custom Properties - Theme Foundation */
:root {
  /* Color System */
  --color-primary: #007acc;
  --color-secondary: #6c757d;
  --color-success: #28a745;
  --color-warning: #ffc107;
  --color-error: #dc3545;
  --color-info: #17a2b8;
  
  /* Background Colors */
  --bg-primary: #ffffff;
  --bg-secondary: #f8f9fa;
  --bg-tertiary: #e9ecef;
  --bg-overlay: rgba(0, 0, 0, 0.1);
  
  /* Text Colors */
  --text-primary: #212529;
  --text-secondary: #6c757d;
  --text-muted: #868e96;
  --text-inverse: #ffffff;
  
  /* Border Colors */
  --border-primary: #dee2e6;
  --border-secondary: #ced4da;
  --border-focus: var(--color-primary);
  
  /* Spacing Scale */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
  
  /* Font Sizes */
  --font-xs: 0.75rem;
  --font-sm: 0.875rem;
  --font-md: 1rem;
  --font-lg: 1.125rem;
  --font-xl: 1.25rem;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
  
  /* Tool-specific Colors */
  --tool-pending: var(--color-warning);
  --tool-running: var(--color-primary);
  --tool-completed: var(--color-success);
  --tool-error: var(--color-error);
  
  /* Animation Timing */
  --transition-fast: 0.15s ease;
  --transition-normal: 0.25s ease;
  --transition-slow: 0.35s ease;
}

/* Application Layout */
.opencode-app {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Utility Classes */
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

.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.focus-ring {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
}
```

## 🔧 Configuration

### 1. ESLint Configuration

```json
// .eslintrc.json
{
  "extends": [
    "eslint:recommended",
    "@typescript-eslint/recommended",
    "prettier"
  ],
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint", "prettier"],
  "parserOptions": {
    "ecmaVersion": 2020,
    "sourceType": "module",
    "ecmaFeatures": {
      "jsx": true
    }
  },
  "rules": {
    "prettier/prettier": "error",
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-explicit-any": "warn"
  }
}
```

### 2. Prettier Configuration

```json
// .prettierrc
{
  "semi": false,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
```

### 3. Environment Variables

```env
# .env.development
VITE_API_BASE_URL=http://localhost:3000
VITE_WS_BASE_URL=ws://localhost:3000
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_ERROR_REPORTING=false

# .env.production
VITE_API_BASE_URL=https://api.opencode.app
VITE_WS_BASE_URL=wss://api.opencode.app
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_ERROR_REPORTING=true
```

### 4. Package.json Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext .ts,.tsx",
    "lint:fix": "eslint src --ext .ts,.tsx --fix",
    "format": "prettier --write src/**/*.{ts,tsx,css,md}",
    "type-check": "tsc --noEmit",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```

## ✅ Testing

### Test Setup Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    css: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@services': resolve(__dirname, 'src/services'),
      '@stores': resolve(__dirname, 'src/stores'),
      '@utils': resolve(__dirname, 'src/utils')
    }
  }
})
```

```typescript
// src/tests/setup.ts
import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock EventSource for SSE testing
global.EventSource = vi.fn(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  close: vi.fn(),
  onmessage: null,
  onerror: null,
  onopen: null
})) as any
```

### Foundation Test Example

```typescript
// src/App.test.tsx
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('should render main application', () => {
    render(<App />)
    
    // Should render main layout
    expect(screen.getByRole('main')).toBeInTheDocument()
  })
  
  it('should apply theme provider', () => {
    render(<App />)
    
    // Should have theme data attribute
    expect(document.documentElement).toHaveAttribute('data-theme')
  })
})
```

## 📝 Implementation Checklist

### Project Setup ✅
- [ ] Vite + React + TypeScript project created
- [ ] Core dependencies installed (Zustand, etc.)
- [ ] Development tools configured (ESLint, Prettier)
- [ ] TypeScript strict mode enabled
- [ ] Path aliases configured

### Build System ✅
- [ ] Vite configuration with proper bundling
- [ ] Development proxy for OpenCode API
- [ ] Environment variable support
- [ ] Production build optimization
- [ ] Source maps enabled

### Architecture Foundation ✅  
- [ ] Project structure established
- [ ] Core type definitions created
- [ ] CSS custom properties system
- [ ] Global styles and resets
- [ ] Error boundary setup
- [ ] Provider architecture (Theme, SSE)

### Development Environment ✅
- [ ] Hot reload working
- [ ] TypeScript type checking
- [ ] Linting and formatting
- [ ] Test setup with Vitest
- [ ] Development scripts configured

### Next Steps
After completing this foundation setup, proceed to:
1. **[02-Communication-Layer.md](./02-Communication-Layer.md)** - Implement SSE and API communication
2. **[03-State-Management.md](./03-State-Management.md)** - Set up Zustand stores and state management

---

This foundation provides a robust, scalable base for implementing all OpenCode HTML features with proper TypeScript support, modern build tooling, and a maintainable architecture.