# SuperCode Web Client

Modern React-based web interface for SuperCode, built with Vite, TypeScript, and shadcn/ui components.

## 🏗️ Architecture

This web client replaces the static HTML/JavaScript files with a modern React application:

- **React 18** with TypeScript for type safety
- **Vite** for fast development and optimized builds
- **shadcn/ui** components for consistent design
- **Tailwind CSS** for styling
- **Lucide React** for icons

## 📁 Structure

```
web-client/
├── src/
│   ├── components/
│   │   ├── ui/           # shadcn/ui components
│   │   ├── tabs/         # Tab components (API, Sessions, Logs)
│   │   └── MainLayout.tsx # Main application layout
│   ├── hooks/
│   │   └── use-theme.tsx # Theme management
│   ├── lib/
│   │   └── utils.ts      # Utility functions
│   ├── App.tsx           # Root component
│   ├── main.tsx          # Entry point
│   └── index.css         # Global styles
├── scripts/
│   └── copy-build-files.js # Build deployment script
└── dist/                 # Build output (generated)
```

## 🚀 Development

### Prerequisites

- Bun 1.2+ or Node.js 18+
- The main SuperCode project

### Setup

```bash
cd web-client
bun install
```

### Development Server

```bash
bun run dev
```

This starts the Vite development server at http://localhost:5173

### Building for Production

```bash
# Build and replace the existing static files
bun run build:replace

# Or just build without replacing
bun run build
```

The `build:replace` command:
1. Builds the React application
2. Automatically replaces the existing files:
   - `packages/opencode/src/server/templates/web-app.html`
   - `packages/opencode/src/server/static/app.js`

## 🎨 Features

### Theme Management
- Light/dark theme toggle
- Persistent theme storage
- System preference detection

### API Client Tab
- Scalar API documentation integration
- Theme-aware API client
- Real-time status indicators

### Sessions Tab
- Session list with metadata
- Detailed session message history
- Role-based message display (User/Assistant/System)

### Logs Tab
- Real-time log streaming via EventSource
- Log level filtering (Error/Warning/Info/Debug)
- Auto-scroll toggle
- Connection status monitoring

## 🔧 Configuration

The build process automatically:
- Inlines CSS for single-file deployment
- Replaces asset paths with template variables
- Maintains compatibility with existing server

### Template Variables

The HTML template supports these variables:
- `{{BASE_URL}}` - Base URL for the application
- CSS is inlined for optimal performance

## 🛠️ Build Process

1. **TypeScript Compilation**: Type-checked and compiled
2. **Vite Build**: Optimized bundle with code splitting disabled
3. **Asset Processing**: CSS inlined, JS referenced correctly
4. **File Replacement**: Automated deployment to existing paths

## 📦 Dependencies

### Core
- react, react-dom
- @radix-ui components
- lucide-react
- tailwind-merge, clsx

### Build Tools
- vite, @vitejs/plugin-react
- typescript
- tailwindcss, tailwindcss-animate
- postcss, autoprefixer

## 🔄 Updating the Web Client

After making changes:

```bash
# Development
bun run dev

# Deploy changes
bun run build:replace
```

The server will automatically serve the updated files.

## 🎯 API Compatibility

The web client maintains full compatibility with the existing OpenCode server API:
- `/session` - Session management
- `/session/:id/message` - Message retrieval
- `/event` - Real-time log streaming
- `/doc` - API documentation

## 📝 Notes

- Built files are automatically optimized for production
- Theme persistence works across sessions
- Real-time features require EventSource support
- All shadcn/ui components are pre-configured and ready to use