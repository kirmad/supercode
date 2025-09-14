# Standalone Mode for VSCode Webview

## Overview
This package can now run as a standalone web application that connects to the SuperCode server on port 8881.

## Setup Complete
✅ Added `dev:standalone` script to package.json
✅ Created index.html for standalone mode
✅ Updated vite.config.ts with standalone configuration
✅ Created standalone configuration helper (src/config/standalone.ts)
✅ Configured automatic connection to port 8881 in standalone mode

## Running Standalone Mode

### Prerequisites
1. Ensure SuperCode server is running on port 8881:
   ```bash
   # From the supercode root directory
   bun dev --port 8881
   ```

2. Run the webview in standalone mode:
   ```bash
   cd packages/vscode-webview
   npm run dev:standalone
   ```

3. Open your browser to http://localhost:3000 (or the port shown in terminal)

## How It Works

### Environment Detection
- The app detects if it's running in standalone mode via `import.meta.env.VITE_STANDALONE`
- When in standalone mode, it automatically connects to port 8881 instead of the default 25716

### Configuration
- **Development Server Port**: 3000 (configurable in vite.config.ts)
- **SuperCode Server Port**: 8881 (configurable via VITE_SERVER_PORT env variable)
- **Default VSCode Extension Port**: 25716 (used when not in standalone mode)

### Files Modified/Created
1. **package.json**: Added `dev:standalone` script
2. **index.html**: Entry point for standalone mode
3. **vite.config.ts**: Added standalone mode configuration
4. **src/config/standalone.ts**: Configuration helper for port management
5. **src/components/SimpleInterface.vue**: Updated to use dynamic port configuration

## Benefits
- Develop and test the webview independently of VSCode
- Connect to different SuperCode server instances
- Easier debugging with browser dev tools
- Hot module replacement for faster development

## Notes
- The standalone mode uses the same Vue components as the VSCode extension
- All features should work identically in both modes
- The connection status indicator will show the current port being used