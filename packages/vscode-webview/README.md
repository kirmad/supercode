# SuperCode VS Code Webview Interface

A modern, Vite-based web interface for the SuperCode VS Code extension, replacing the hardcoded HTML approach with a comprehensive, maintainable frontend solution.

## Overview

This package provides a Vue 3 + Vite-based web interface that compiles into VS Code extension-compatible webview content. It offers the same functionality as the original hardcoded HTML interface but with better maintainability, component organization, and development experience.

## Features

- ✅ **Vue 3 Composition API** - Modern reactive framework
- ✅ **Vite Build System** - Fast development and optimized builds
- ✅ **TypeScript Support** - Full type safety
- ✅ **VS Code Theme Integration** - Seamlessly matches VS Code's appearance
- ✅ **Component Architecture** - Modular, maintainable code structure
- ✅ **Development Mode** - Hot reload during development
- ✅ **Fallback Support** - Graceful fallback when Vite output isn't available

## Architecture

```
packages/vscode-webview/
├── src/
│   ├── components/          # Vue components
│   │   ├── SuperCodeWebview.vue    # Main app component
│   │   ├── StatusBar.vue           # Connection status display
│   │   ├── MessagesList.vue        # Chat messages
│   │   ├── InputArea.vue           # Message input
│   │   ├── ErrorActions.vue        # Error handling UI
│   │   └── RestartDialog.vue       # Restart confirmation
│   ├── types/               # TypeScript definitions
│   ├── utils/               # Utility functions
│   ├── main.ts             # Vue app entry point
│   └── style.css           # Base styles
├── scripts/
│   └── build-for-vscode.js # VS Code compilation script
├── vite.config.ts          # Vite configuration
└── package.json
```

## Development Setup

### Prerequisites

- Node.js 18+ and npm (or use Bun if available in the project)
- VS Code with the SuperCode extension

### Installation

1. **Navigate to the webview package:**
   ```bash
   cd packages/vscode-webview
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Development with hot reload:**
   ```bash
   npm run dev
   ```
   This opens a development server with hot reload and mock VS Code API for testing.

4. **Build for VS Code extension:**
   ```bash
   npm run build:vscode
   ```
   This creates the compiled output that the VS Code extension can consume.

### Integration with VS Code Extension

The build process generates `vscode-output/webview-content.js` which exports a `getWebviewContent(port)` function that the VS Code extension can use:

```typescript
import { getWebviewContent } from './packages/vscode-webview/vscode-output/webview-content.js'

// In your VS Code extension
panel.webview.html = getWebviewContent(port)
```

## Usage in VS Code Extension

### Option 1: Use the New Vite-Based Classes

```typescript
import { SuperCodeWebviewManagerVite } from './src/webview/SuperCodeWebviewManagerVite'

// Replace the original manager
const webviewManager = new SuperCodeWebviewManagerVite(context)
await webviewManager.openNewWebview()
```

### Option 2: Use the Vite Content Provider

```typescript
import { ViteWebviewManager } from './src/webview/ViteWebviewManager'

// Get Vite-compiled content
const html = ViteWebviewManager.getWebviewContent(port, context)
panel.webview.html = html
```

### Option 3: Add as New Command (Recommended for Testing)

```typescript
import { registerOpenViteWebviewCommand } from './src/commands/openViteWebview'

// In extension.ts activate() function
registerOpenViteWebviewCommand(context)
```

Then add to `package.json` commands:

```json
{
  "command": "supercode.openViteWebview",
  "title": "Open SuperCode Vite UI",
  "icon": {
    "light": "images/button-dark.svg",
    "dark": "images/button-light.svg"
  }
}
```

## Development Workflow

### Making Changes to the Interface

1. **Start development server:**
   ```bash
   npm run dev
   ```

2. **Make changes to Vue components** in `src/components/`

3. **Test with hot reload** at `http://localhost:5173`

4. **Build for production:**
   ```bash
   npm run build:vscode
   ```

5. **Reload VS Code extension** to see changes

### Component Development

Each component follows Vue 3 Composition API patterns:

```vue
<template>
  <!-- HTML template -->
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { MyType } from '../types'

// Component logic
</script>

<style scoped>
/* Component-specific styles using VS Code CSS variables */
</style>
```

## Styling with VS Code Theme

The interface uses VS Code's CSS custom properties for consistent theming:

```css
.my-component {
  background: var(--vscode-editor-background);
  color: var(--vscode-foreground);
  border: 1px solid var(--vscode-panel-border);
}
```

Available VS Code CSS variables:
- `--vscode-foreground`, `--vscode-editor-background`
- `--vscode-button-background`, `--vscode-button-foreground`
- `--vscode-input-background`, `--vscode-input-border`
- `--vscode-statusBar-background`, `--vscode-panel-border`
- And many more...

## Build Output

The build process creates:

- **`dist/webview.js`** - Compiled JavaScript bundle
- **`dist/style.css`** - Compiled CSS styles  
- **`vscode-output/webview-content.js`** - VS Code extension-ready module

## Fallback Behavior

When the Vite output is not available, the system gracefully falls back to a basic HTML template that:

- Shows development instructions
- Provides basic VS Code integration
- Maintains essential functionality
- Guides users through the setup process

## Scripts

- **`npm run dev`** - Development server with hot reload
- **`npm run build`** - Standard Vite build
- **`npm run build:vscode`** - Build and prepare for VS Code extension
- **`npm run preview`** - Preview production build
- **`npm run type-check`** - TypeScript type checking

## Type Safety

Full TypeScript support with:

- VS Code API types
- Webview message interfaces  
- Component prop types
- Event handler types

## Future Enhancements

- [ ] **Component Library** - Shared components for multiple extensions
- [ ] **Theme System** - Custom themes beyond VS Code defaults
- [ ] **Plugin Architecture** - Extensible component system
- [ ] **Testing Suite** - Unit and integration tests
- [ ] **Storybook Integration** - Component documentation and testing

## Troubleshooting

### Vite Output Not Found

If you see "Development Mode - Vite Output Not Found":

1. Ensure you've run `npm install` in the webview package
2. Run `npm run build:vscode` to generate the VS Code output
3. Restart the VS Code extension

### Build Errors

- Check Node.js version (18+ required)
- Clear node_modules and reinstall dependencies
- Verify all TypeScript types are correctly defined

### Hot Reload Not Working

- Ensure the development server is running (`npm run dev`)
- Check that port 5173 is not blocked by firewall
- Verify VS Code is not caching the old interface

## Contributing

When contributing to the webview interface:

1. **Follow Vue 3 Composition API patterns**
2. **Use TypeScript for all new code**  
3. **Test in both development mode and built extension**
4. **Maintain VS Code theme compatibility**
5. **Update this README for significant changes**

## Migration from Hardcoded HTML

The new Vite-based interface maintains API compatibility with the original hardcoded HTML approach while providing:

- Better maintainability through component architecture
- Improved development experience with hot reload
- Type safety with TypeScript
- Modern build tooling with Vite
- Extensible foundation for future enhancements