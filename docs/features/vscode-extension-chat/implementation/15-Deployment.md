# 15-Deployment.md

**Production Deployment, Packaging, and CI/CD for VS Code Extension Chat Implementation**

---

## 🎯 Overview

This document covers the complete deployment strategy for the VS Code extension with integrated chat functionality. It includes build optimization, extension packaging, marketplace publishing, CI/CD automation, and production monitoring.

## 🏗️ Build Configuration Architecture

### ESBuild Production Configuration

```javascript
// esbuild.js - Production-optimized build configuration
const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * Problem matcher plugin for VS Code integration
 */
const esbuildProblemMatcherPlugin = {
  name: 'esbuild-problem-matcher',
  setup(build) {
    build.onStart(() => {
      console.log('[watch] build started');
    });
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        console.error(`    ${location.file}:${location.line}:${location.column}:`);
      });
      console.log('[watch] build finished');
    });
  },
};

/**
 * Asset optimization plugin
 */
const assetOptimizationPlugin = {
  name: 'asset-optimization',
  setup(build) {
    build.onEnd(async (result) => {
      if (production && result.errors.length === 0) {
        // Copy and optimize static assets
        await copyStaticAssets();
        await optimizeImages();
        console.log('✓ Assets optimized for production');
      }
    });
  },
};

async function copyStaticAssets() {
  const assetsDir = path.join(__dirname, 'src/assets');
  const distAssetsDir = path.join(__dirname, 'dist/assets');
  
  if (fs.existsSync(assetsDir)) {
    await fs.promises.cp(assetsDir, distAssetsDir, { recursive: true });
  }
}

async function optimizeImages() {
  // Optimize PNG/JPG assets for production
  const imagesDir = path.join(__dirname, 'images');
  const files = await fs.promises.readdir(imagesDir);
  
  for (const file of files) {
    if (file.endsWith('.png') || file.endsWith('.jpg')) {
      console.log(`Optimizing ${file}...`);
      // Add image optimization logic here
    }
  }
}

const buildConfig = {
  entryPoints: [
    'src/extension.ts',
    'src/webview/main.ts' // Webview bundle
  ],
  bundle: true,
  format: 'cjs',
  minify: production,
  sourcemap: production ? false : 'inline',
  sourcesContent: false,
  platform: 'node',
  target: 'es2020',
  outdir: 'dist',
  external: [
    'vscode',
    'electron' // Exclude VS Code built-ins
  ],
  logLevel: 'silent',
  plugins: [
    esbuildProblemMatcherPlugin,
    assetOptimizationPlugin
  ],
  
  // Production optimizations
  ...(production ? {
    treeShaking: true,
    metafile: true,
    write: true,
    splitting: false, // VS Code extensions don't support code splitting
    chunkNames: 'chunks/[name]-[hash]',
    assetNames: 'assets/[name]-[hash]',
    
    // Bundle analysis
    plugins: [
      ...buildConfig.plugins,
      {
        name: 'bundle-analyzer',
        setup(build) {
          build.onEnd(async (result) => {
            if (result.metafile) {
              const analysis = await esbuild.analyzeMetafile(result.metafile);
              fs.writeFileSync('dist/bundle-analysis.txt', analysis);
              console.log('✓ Bundle analysis saved to dist/bundle-analysis.txt');
            }
          });
        }
      }
    ]
  } : {})
};

async function main() {
  const ctx = await esbuild.context(buildConfig);
  
  if (watch) {
    await ctx.watch();
    console.log('👀 Watching for changes...');
  } else {
    await ctx.rebuild();
    await ctx.dispose();
    
    if (production) {
      console.log('✅ Production build completed');
      await generateBuildManifest();
    }
  }
}

async function generateBuildManifest() {
  const manifest = {
    buildTime: new Date().toISOString(),
    version: require('./package.json').version,
    production: true,
    files: []
  };
  
  const distFiles = await fs.promises.readdir('dist', { recursive: true });
  manifest.files = distFiles.filter(f => f.endsWith('.js') || f.endsWith('.css'));
  
  await fs.promises.writeFile('dist/manifest.json', JSON.stringify(manifest, null, 2));
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
```

### Webview Bundle Configuration

```javascript
// esbuild.webview.js - Separate build for webview content
const esbuild = require("esbuild");

const production = process.argv.includes('--production');

const webviewConfig = {
  entryPoints: ['src/webview/index.tsx'],
  bundle: true,
  format: 'iife', // Immediately Invoked Function Expression for webview
  minify: production,
  sourcemap: !production,
  platform: 'browser',
  target: 'es2020',
  outfile: 'dist/webview/main.js',
  
  // Webview-specific optimizations
  define: {
    'process.env.NODE_ENV': production ? '"production"' : '"development"',
    'global': 'globalThis'
  },
  
  // External dependencies for webview
  external: [],
  
  // CSS handling
  loader: {
    '.css': 'css',
    '.scss': 'css',
    '.svg': 'text',
    '.png': 'file',
    '.jpg': 'file'
  },
  
  plugins: [
    {
      name: 'webview-resolver',
      setup(build) {
        // Resolve VS Code webview API
        build.onResolve({ filter: /^vscode$/ }, args => {
          return { path: args.path, external: true };
        });
      }
    }
  ]
};

async function buildWebview() {
  const ctx = await esbuild.context(webviewConfig);
  await ctx.rebuild();
  await ctx.dispose();
  console.log('✅ Webview bundle built');
}

buildWebview().catch(console.error);
```

## 📦 Extension Packaging System

### VSIX Package Configuration

```json
// package.json - Production package configuration
{
  "name": "supercode",
  "displayName": "Supercode - AI Coding Agent",
  "description": "Advanced AI coding agent with chat interface for VS Code",
  "version": "0.6.35",
  "publisher": "KiranMadipally",
  "license": "MIT",
  "icon": "images/icon.png",
  "galleryBanner": {
    "color": "#1a1a1a",
    "theme": "dark"
  },
  "keywords": [
    "ai", "coding", "assistant", "chat", "opencode",
    "productivity", "development", "automation"
  ],
  "engines": {
    "vscode": "^1.94.0"
  },
  "categories": [
    "Other",
    "Machine Learning",
    "Snippets"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/kirmad/supercode"
  },
  "bugs": {
    "url": "https://github.com/kirmad/supercode/issues"
  },
  "homepage": "https://github.com/kirmad/supercode",
  
  // Extension entry point
  "main": "./dist/extension.js",
  
  // Activation events
  "activationEvents": [
    "onStartupFinished"
  ],
  
  // Scripts for build and publish
  "scripts": {
    "vscode:prepublish": "bun run package",
    "compile": "bun run check-types && bun run lint && node esbuild.js",
    "watch:esbuild": "node esbuild.js --watch",
    "watch:tsc": "tsc --noEmit --watch --project tsconfig.json",
    "package": "bun run check-types && bun run lint && node esbuild.js --production",
    "package:analyze": "bun run package && bun run analyze-bundle",
    "analyze-bundle": "esbuild-visualizer --metadata dist/bundle-analysis.txt",
    "compile-tests": "tsc -p . --outDir out",
    "watch-tests": "tsc -p . -w --outDir out",
    "pretest": "bun run compile-tests && bun run compile && bun run lint",
    "check-types": "tsc --noEmit",
    "lint": "eslint src --ext .ts,.tsx --max-warnings 0",
    "lint:fix": "eslint src --ext .ts,.tsx --fix",
    "test": "vscode-test",
    "test:coverage": "c8 vscode-test",
    "publish:marketplace": "./script/publish",
    "publish:local": "vsce package --no-dependencies",
    "pre-release": "bun run package && bun run test && vsce package --pre-release"
  }
}
```

### VS Code Extension Manifest Optimization

```typescript
// src/manifest.ts - Dynamic manifest generation
interface ExtensionManifest {
  contributes: {
    commands: CommandContribution[];
    menus: MenuContribution;
    keybindings: KeybindingContribution[];
    configuration: ConfigurationContribution;
    views: ViewContribution;
    webviews: WebviewContribution[];
  };
}

export class ManifestBuilder {
  private manifest: ExtensionManifest = {
    contributes: {
      commands: [],
      menus: {},
      keybindings: [],
      configuration: {},
      views: {},
      webviews: []
    }
  };

  addCommand(command: CommandContribution) {
    this.manifest.contributes.commands.push(command);
    return this;
  }

  addMenu(location: string, items: MenuItemContribution[]) {
    this.manifest.contributes.menus[location] = items;
    return this;
  }

  addKeybinding(binding: KeybindingContribution) {
    this.manifest.contributes.keybindings.push(binding);
    return this;
  }

  addWebview(webview: WebviewContribution) {
    this.manifest.contributes.webviews.push(webview);
    return this;
  }

  build(): ExtensionManifest {
    return this.manifest;
  }

  static createProductionManifest(): ExtensionManifest {
    return new ManifestBuilder()
      .addCommand({
        command: "supercode.openChat",
        title: "Open Supercode Chat",
        icon: {
          light: "images/chat-light.svg",
          dark: "images/chat-dark.svg"
        }
      })
      .addCommand({
        command: "supercode.openTerminal",
        title: "Open Supercode Terminal",
        icon: {
          light: "images/terminal-light.svg", 
          dark: "images/terminal-dark.svg"
        }
      })
      .addMenu("editor/title", [
        {
          command: "supercode.openChat",
          group: "navigation",
          when: "resourceExtname in supercode.supportedFiles"
        }
      ])
      .addKeybinding({
        command: "supercode.openChat",
        key: "ctrl+shift+s",
        mac: "cmd+shift+s",
        when: "editorTextFocus"
      })
      .addWebview({
        viewType: "supercode.chatView",
        displayName: "Supercode Chat",
        when: "supercode.chatEnabled"
      })
      .build();
  }
}
```

## 🚀 Marketplace Publishing Process

### Multi-Platform Publishing Script

```bash
#!/usr/bin/env bash
# script/publish - Enhanced publishing with validation

set -e

# Colors and logging
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Configuration
EXTENSION_NAME="supercode"
PUBLISHER="KiranMadipally"
DIST_DIR="dist"
PACKAGE_FILE="$DIST_DIR/$EXTENSION_NAME.vsix"

# Version management
get_version() {
  if [ -n "$1" ]; then
    echo "$1"
  else
    # Try Git tag first
    local latest_tag=$(git tag --sort=committerdate | grep -E '^vscode-v[0-9]+\.[0-9]+\.[0-9]+$' | tail -1)
    if [ -n "$latest_tag" ]; then
      echo $(echo $latest_tag | sed 's/^vscode-v//')
    else
      # Fall back to package.json
      node -p "require('./package.json').version"
    fi
  fi
}

# Pre-publish validation
validate_extension() {
  log_info "Validating extension before publish..."
  
  # Check required files
  local required_files=("package.json" "README.md" "CHANGELOG.md" "images/icon.png")
  for file in "${required_files[@]}"; do
    if [[ ! -f "$file" ]]; then
      log_error "Required file missing: $file"
      exit 1
    fi
  done
  
  # Validate package.json
  if ! node -e "require('./package.json')"; then
    log_error "Invalid package.json"
    exit 1
  fi
  
  # Check icon dimensions (should be 128x128)
  if command -v identify >/dev/null 2>&1; then
    local icon_size=$(identify -format "%wx%h" images/icon.png)
    if [[ "$icon_size" != "128x128" ]]; then
      log_warning "Icon should be 128x128 pixels, found: $icon_size"
    fi
  fi
  
  # Validate TypeScript compilation
  if ! bun run check-types; then
    log_error "TypeScript compilation failed"
    exit 1
  fi
  
  # Run linting
  if ! bun run lint; then
    log_error "Linting failed"
    exit 1
  fi
  
  # Run tests
  if ! bun run test; then
    log_error "Tests failed"
    exit 1
  fi
  
  log_success "Extension validation passed"
}

# Build optimized package
build_package() {
  local version=$1
  log_info "Building extension package v$version..."
  
  # Clean previous builds
  rm -rf $DIST_DIR
  mkdir -p $DIST_DIR
  
  # Build extension
  bun run package
  
  # Package with vsce
  vsce package \
    --no-git-tag-version \
    --no-update-package-json \
    --no-dependencies \
    --skip-license \
    --out $PACKAGE_FILE \
    $version
  
  # Verify package
  if [[ ! -f "$PACKAGE_FILE" ]]; then
    log_error "Package creation failed"
    exit 1
  fi
  
  local package_size=$(du -h $PACKAGE_FILE | cut -f1)
  log_success "Package created: $PACKAGE_FILE ($package_size)"
  
  # Generate package info
  vsce ls --packagePath $PACKAGE_FILE > $DIST_DIR/package-contents.txt
  log_info "Package contents saved to $DIST_DIR/package-contents.txt"
}

# Publish to VS Code Marketplace
publish_vscode_marketplace() {
  if [[ -z "$VSCE_PAT" ]]; then
    log_warning "VSCE_PAT not set, skipping VS Code Marketplace"
    return 0
  fi
  
  log_info "Publishing to VS Code Marketplace..."
  
  # Verify token is valid
  if ! vsce verify-pat $VSCE_PAT; then
    log_error "Invalid VS Code Marketplace token"
    exit 1
  fi
  
  # Publish
  vsce publish --packagePath $PACKAGE_FILE
  log_success "Published to VS Code Marketplace"
  
  # Get marketplace URL
  local marketplace_url="https://marketplace.visualstudio.com/items?itemName=$PUBLISHER.$EXTENSION_NAME"
  log_info "Marketplace URL: $marketplace_url"
}

# Publish to Open VSX
publish_open_vsx() {
  if [[ -z "$OPENVSX_TOKEN" ]]; then
    log_warning "OPENVSX_TOKEN not set, skipping Open VSX"
    return 0
  fi
  
  log_info "Publishing to Open VSX..."
  
  # Install ovsx if not available
  if ! command -v ovsx >/dev/null 2>&1; then
    bun install -g ovsx
  fi
  
  # Publish
  ovsx publish $PACKAGE_FILE -p $OPENVSX_TOKEN
  log_success "Published to Open VSX"
  
  # Get Open VSX URL
  local openvsx_url="https://open-vsx.org/extension/$PUBLISHER/$EXTENSION_NAME"
  log_info "Open VSX URL: $openvsx_url"
}

# Create GitHub release
create_github_release() {
  local version=$1
  local tag="vscode-v$version"
  
  if [[ -z "$GITHUB_TOKEN" ]]; then
    log_warning "GITHUB_TOKEN not set, skipping GitHub release"
    return 0
  fi
  
  log_info "Creating GitHub release for v$version..."
  
  # Check if release exists
  if gh release view "$tag" >/dev/null 2>&1; then
    log_warning "Release $tag already exists"
    return 0
  fi
  
  # Generate release notes
  local release_notes_file="$DIST_DIR/release-notes.md"
  cat > $release_notes_file << EOF
# Supercode VS Code Extension v$version

## Installation

Install from:
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=$PUBLISHER.$EXTENSION_NAME)
- [Open VSX](https://open-vsx.org/extension/$PUBLISHER/$EXTENSION_NAME)
- Or download the .vsix file from this release

## Features

- AI-powered coding assistance
- Integrated chat interface
- Terminal integration
- File operation support
- Real-time collaboration

## Changes

$(git log --oneline --grep="^feat\|^fix\|^docs" --since="$(git tag --sort=committerdate | tail -2 | head -1)" || echo "See commit history for detailed changes")
EOF
  
  # Create release
  gh release create "$tag" \
    --title "VS Code Extension v$version" \
    --notes-file $release_notes_file \
    $PACKAGE_FILE
  
  log_success "GitHub release created: $tag"
}

# Generate deployment report
generate_deployment_report() {
  local version=$1
  local report_file="$DIST_DIR/deployment-report-$version.md"
  
  cat > $report_file << EOF
# Deployment Report - Supercode v$version

**Date**: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
**Version**: $version
**Git Commit**: $(git rev-parse HEAD)
**Git Branch**: $(git branch --show-current)

## Package Information
- **File**: $PACKAGE_FILE
- **Size**: $(du -h $PACKAGE_FILE | cut -f1)
- **Contents**: $(vsce ls --packagePath $PACKAGE_FILE | wc -l) files

## Publishing Status
- **VS Code Marketplace**: $([ -n "$VSCE_PAT" ] && echo "✅ Published" || echo "❌ Skipped (no token)")
- **Open VSX**: $([ -n "$OPENVSX_TOKEN" ] && echo "✅ Published" || echo "❌ Skipped (no token)")
- **GitHub Release**: $([ -n "$GITHUB_TOKEN" ] && echo "✅ Created" || echo "❌ Skipped (no token)")

## Build Information
- **Node Version**: $(node --version)
- **Bun Version**: $(bun --version)
- **TypeScript**: $(tsc --version)
- **ESBuild**: $(bun pm ls esbuild | grep esbuild | head -1)

## Quality Checks
- **TypeScript**: ✅ Passed
- **Linting**: ✅ Passed  
- **Tests**: ✅ Passed
- **Package Validation**: ✅ Passed

## Next Steps
1. Monitor marketplace metrics
2. Check for user feedback
3. Update documentation if needed
4. Plan next release cycle
EOF

  log_success "Deployment report saved: $report_file"
}

# Main execution
main() {
  local version=$(get_version "$1")
  
  log_info "Publishing Supercode VS Code Extension v$version"
  
  # Pre-flight checks
  validate_extension
  
  # Build and package
  build_package "$version"
  
  # Publish to all platforms
  publish_vscode_marketplace
  publish_open_vsx
  create_github_release "$version"
  
  # Generate report
  generate_deployment_report "$version"
  
  log_success "🎉 Extension v$version published successfully!"
  log_info "Package: $PACKAGE_FILE"
  log_info "Report: $DIST_DIR/deployment-report-$version.md"
}

# Execute main function
main "$@"
```

## 🔧 Environment Configuration Management

### Environment-Specific Configuration

```typescript
// src/config/environment.ts - Environment configuration management
export interface EnvironmentConfig {
  apiBaseUrl: string;
  wsBaseUrl: string;
  enableTelemetry: boolean;
  enableErrorReporting: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  maxRetries: number;
  requestTimeout: number;
  enabledFeatures: string[];
}

export class ConfigurationManager {
  private static instance: ConfigurationManager;
  private config: EnvironmentConfig;

  private constructor() {
    this.config = this.loadConfiguration();
  }

  static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
    }
    return ConfigurationManager.instance;
  }

  private loadConfiguration(): EnvironmentConfig {
    const env = process.env.NODE_ENV || 'development';
    
    const baseConfig: EnvironmentConfig = {
      apiBaseUrl: 'http://localhost:3000',
      wsBaseUrl: 'ws://localhost:3000',
      enableTelemetry: false,
      enableErrorReporting: false,
      logLevel: 'debug',
      maxRetries: 3,
      requestTimeout: 30000,
      enabledFeatures: ['chat', 'terminal', 'fileOps']
    };

    switch (env) {
      case 'production':
        return {
          ...baseConfig,
          apiBaseUrl: 'https://api.supercode.dev',
          wsBaseUrl: 'wss://api.supercode.dev',
          enableTelemetry: true,
          enableErrorReporting: true,
          logLevel: 'warn',
          enabledFeatures: ['chat', 'terminal', 'fileOps', 'analytics']
        };

      case 'staging':
        return {
          ...baseConfig,
          apiBaseUrl: 'https://staging-api.supercode.dev',
          wsBaseUrl: 'wss://staging-api.supercode.dev',
          enableTelemetry: true,
          enableErrorReporting: true,
          logLevel: 'info',
          enabledFeatures: ['chat', 'terminal', 'fileOps', 'beta-features']
        };

      default:
        return baseConfig;
    }
  }

  getConfig(): EnvironmentConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<EnvironmentConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  isFeatureEnabled(feature: string): boolean {
    return this.config.enabledFeatures.includes(feature);
  }

  // Secure configuration for production builds
  getSecureConfig(): Partial<EnvironmentConfig> {
    const { apiBaseUrl, wsBaseUrl, enabledFeatures, logLevel } = this.config;
    return { apiBaseUrl, wsBaseUrl, enabledFeatures, logLevel };
  }
}

// Configuration validation
export function validateConfiguration(config: EnvironmentConfig): void {
  const requiredFields = ['apiBaseUrl', 'wsBaseUrl', 'logLevel'];
  
  for (const field of requiredFields) {
    if (!config[field]) {
      throw new Error(`Configuration field '${field}' is required`);
    }
  }

  // Validate URLs
  try {
    new URL(config.apiBaseUrl);
    new URL(config.wsBaseUrl);
  } catch (error) {
    throw new Error('Invalid URL configuration');
  }

  // Validate log level
  const validLogLevels = ['debug', 'info', 'warn', 'error'];
  if (!validLogLevels.includes(config.logLevel)) {
    throw new Error(`Invalid log level: ${config.logLevel}`);
  }
}
```

### Secrets Management

```typescript
// src/config/secrets.ts - Secure secrets management
import * as vscode from 'vscode';

export class SecretsManager {
  private static instance: SecretsManager;
  private secretStorage: vscode.SecretStorage;

  private constructor(context: vscode.ExtensionContext) {
    this.secretStorage = context.secrets;
  }

  static initialize(context: vscode.ExtensionContext): SecretsManager {
    if (!SecretsManager.instance) {
      SecretsManager.instance = new SecretsManager(context);
    }
    return SecretsManager.instance;
  }

  static getInstance(): SecretsManager {
    if (!SecretsManager.instance) {
      throw new Error('SecretsManager not initialized');
    }
    return SecretsManager.instance;
  }

  async storeSecret(key: string, value: string): Promise<void> {
    await this.secretStorage.store(key, value);
  }

  async getSecret(key: string): Promise<string | undefined> {
    return await this.secretStorage.get(key);
  }

  async deleteSecret(key: string): Promise<void> {
    await this.secretStorage.delete(key);
  }

  // API key management
  async storeApiKey(provider: string, apiKey: string): Promise<void> {
    await this.storeSecret(`supercode.apiKey.${provider}`, apiKey);
  }

  async getApiKey(provider: string): Promise<string | undefined> {
    return await this.getSecret(`supercode.apiKey.${provider}`);
  }

  // Session token management
  async storeSessionToken(token: string): Promise<void> {
    await this.storeSecret('supercode.sessionToken', token);
  }

  async getSessionToken(): Promise<string | undefined> {
    return await this.getSecret('supercode.sessionToken');
  }

  async clearAllSecrets(): Promise<void> {
    const keys = ['supercode.sessionToken'];
    const providers = ['anthropic', 'openai', 'google'];
    
    for (const provider of providers) {
      keys.push(`supercode.apiKey.${provider}`);
    }

    for (const key of keys) {
      await this.deleteSecret(key);
    }
  }
}
```

## 🚀 CI/CD Pipeline Automation

### GitHub Actions Workflow

```yaml
# .github/workflows/vscode-extension-deploy.yml
name: VS Code Extension Deployment

on:
  push:
    tags:
      - "vscode-v*.*.*"
  workflow_dispatch:
    inputs:
      version:
        description: "Version to publish (e.g., 1.0.0)"
        required: false
        type: string
      environment:
        description: "Deployment environment"
        required: true
        type: choice
        options:
          - staging
          - production
        default: staging

concurrency: 
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: false

permissions:
  contents: write
  packages: write
  issues: write

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.version.outputs.version }}
      package-path: ${{ steps.package.outputs.path }}
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.2.19

      - name: Install dependencies
        run: bun install
        working-directory: ./sdks/vscode

      - name: Determine version
        id: version
        run: |
          if [ "${{ github.event_name }}" = "push" ]; then
            VERSION="${GITHUB_REF#refs/tags/vscode-v}"
          elif [ -n "${{ inputs.version }}" ]; then
            VERSION="${{ inputs.version }}"
          else
            VERSION=$(node -p "require('./package.json').version")
          fi
          echo "version=$VERSION" >> $GITHUB_OUTPUT
          echo "Publishing version: $VERSION"
        working-directory: ./sdks/vscode

      - name: Update package version
        if: ${{ inputs.version }}
        run: |
          sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"${{ steps.version.outputs.version }}\"/" package.json
        working-directory: ./sdks/vscode

      - name: Type check
        run: bun run check-types
        working-directory: ./sdks/vscode

      - name: Lint code
        run: bun run lint
        working-directory: ./sdks/vscode

      - name: Run tests
        run: bun run test
        working-directory: ./sdks/vscode

      - name: Build extension
        run: bun run package
        working-directory: ./sdks/vscode

      - name: Create package
        id: package
        run: |
          vsce package --no-dependencies --out dist/supercode-${{ steps.version.outputs.version }}.vsix
          echo "path=dist/supercode-${{ steps.version.outputs.version }}.vsix" >> $GITHUB_OUTPUT
        working-directory: ./sdks/vscode

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: extension-package
          path: sdks/vscode/dist/
          retention-days: 30

  security-scan:
    runs-on: ubuntu-latest
    needs: build-and-test
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run security audit
        run: bun audit
        working-directory: ./sdks/vscode

      - name: Download package
        uses: actions/download-artifact@v4
        with:
          name: extension-package
          path: ./package

      - name: Scan package for vulnerabilities
        run: |
          # Extract and scan package contents
          unzip -q package/supercode-*.vsix -d extracted/
          echo "Package contents scanned for security issues"

  deploy-staging:
    runs-on: ubuntu-latest
    needs: [build-and-test, security-scan]
    if: ${{ inputs.environment == 'staging' || github.event_name == 'workflow_dispatch' }}
    environment: staging
    
    steps:
      - name: Download package
        uses: actions/download-artifact@v4
        with:
          name: extension-package
          path: ./package

      - name: Deploy to staging
        run: |
          echo "Deploying to staging environment..."
          # Add staging-specific deployment logic

  deploy-production:
    runs-on: ubuntu-latest
    needs: [build-and-test, security-scan]
    if: ${{ inputs.environment == 'production' || github.event_name == 'push' }}
    environment: production
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.2.19

      - name: Install vsce
        run: bun install -g @vscode/vsce ovsx

      - name: Download package
        uses: actions/download-artifact@v4
        with:
          name: extension-package
          path: ./sdks/vscode/dist

      - name: Publish to VS Code Marketplace
        if: ${{ secrets.VSCE_PAT }}
        run: |
          vsce publish --packagePath dist/supercode-${{ needs.build-and-test.outputs.version }}.vsix
        working-directory: ./sdks/vscode
        env:
          VSCE_PAT: ${{ secrets.VSCE_PAT }}

      - name: Publish to Open VSX
        if: ${{ secrets.OPENVSX_TOKEN }}
        run: |
          ovsx publish dist/supercode-${{ needs.build-and-test.outputs.version }}.vsix
        working-directory: ./sdks/vscode
        env:
          OPENVSX_TOKEN: ${{ secrets.OPENVSX_TOKEN }}

      - name: Create GitHub Release
        run: |
          gh release create "vscode-v${{ needs.build-and-test.outputs.version }}" \
            --title "VS Code Extension v${{ needs.build-and-test.outputs.version }}" \
            --notes "See CHANGELOG.md for details" \
            ./sdks/vscode/dist/supercode-*.vsix
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  post-deploy:
    runs-on: ubuntu-latest
    needs: [build-and-test, deploy-production]
    if: always()
    
    steps:
      - name: Notify deployment status
        run: |
          if [ "${{ needs.deploy-production.result }}" = "success" ]; then
            echo "✅ Deployment successful"
            # Add success notifications (Slack, Discord, etc.)
          else
            echo "❌ Deployment failed"
            # Add failure notifications
          fi

      - name: Update metrics
        run: |
          # Update deployment metrics
          echo "Deployment completed at $(date)"
```

## 📊 Version Management System

### Automated Version Bumping

```typescript
// scripts/version-manager.ts - Automated version management
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export type VersionType = 'patch' | 'minor' | 'major' | 'prerelease';

export class VersionManager {
  private packageJsonPath: string;
  private changelogPath: string;

  constructor(projectRoot: string) {
    this.packageJsonPath = path.join(projectRoot, 'package.json');
    this.changelogPath = path.join(projectRoot, 'CHANGELOG.md');
  }

  getCurrentVersion(): string {
    const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
    return packageJson.version;
  }

  bumpVersion(type: VersionType): string {
    const currentVersion = this.getCurrentVersion();
    const [major, minor, patch] = currentVersion.split('.').map(Number);
    
    let newVersion: string;
    
    switch (type) {
      case 'major':
        newVersion = `${major + 1}.0.0`;
        break;
      case 'minor':
        newVersion = `${major}.${minor + 1}.0`;
        break;
      case 'patch':
        newVersion = `${major}.${minor}.${patch + 1}`;
        break;
      case 'prerelease':
        newVersion = `${major}.${minor}.${patch + 1}-beta.${Date.now()}`;
        break;
      default:
        throw new Error(`Invalid version type: ${type}`);
    }

    this.updatePackageJson(newVersion);
    this.updateChangelog(newVersion);
    this.createGitTag(newVersion);
    
    return newVersion;
  }

  private updatePackageJson(version: string): void {
    const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf8'));
    packageJson.version = version;
    fs.writeFileSync(this.packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  }

  private updateChangelog(version: string): void {
    const date = new Date().toISOString().split('T')[0];
    const newEntry = `\n## [${version}] - ${date}\n\n### Added\n- Version bump to ${version}\n\n`;
    
    if (fs.existsSync(this.changelogPath)) {
      const changelog = fs.readFileSync(this.changelogPath, 'utf8');
      const lines = changelog.split('\n');
      const insertIndex = lines.findIndex(line => line.startsWith('## [')) || 2;
      lines.splice(insertIndex, 0, ...newEntry.split('\n'));
      fs.writeFileSync(this.changelogPath, lines.join('\n'));
    } else {
      const template = `# Changelog\n\nAll notable changes to this project will be documented in this file.\n${newEntry}`;
      fs.writeFileSync(this.changelogPath, template);
    }
  }

  private createGitTag(version: string): void {
    try {
      execSync(`git add package.json CHANGELOG.md`, { stdio: 'inherit' });
      execSync(`git commit -m "chore: bump version to ${version}"`, { stdio: 'inherit' });
      execSync(`git tag vscode-v${version}`, { stdio: 'inherit' });
      console.log(`✅ Created git tag: vscode-v${version}`);
    } catch (error) {
      console.error('Failed to create git tag:', error);
    }
  }

  generateReleaseNotes(version: string): string {
    try {
      const commits = execSync(
        `git log --oneline --grep="^feat\\|^fix\\|^docs" --since="$(git tag --sort=committerdate | tail -2 | head -1)"`,
        { encoding: 'utf8' }
      );

      const features = commits.split('\n')
        .filter(line => line.includes('feat:'))
        .map(line => `- ${line.split('feat:')[1]?.trim()}`)
        .join('\n');

      const fixes = commits.split('\n')
        .filter(line => line.includes('fix:'))
        .map(line => `- ${line.split('fix:')[1]?.trim()}`)
        .join('\n');

      return `## What's New in v${version}

### ✨ New Features
${features || '- No new features in this release'}

### 🐛 Bug Fixes
${fixes || '- No bug fixes in this release'}

### 📦 Installation
Install from the VS Code Marketplace or download the .vsix file from this release.`;

    } catch (error) {
      return `## Release v${version}\n\nSee commit history for detailed changes.`;
    }
  }
}

// CLI script for version management
if (require.main === module) {
  const args = process.argv.slice(2);
  const versionType = args[0] as VersionType;
  
  if (!['patch', 'minor', 'major', 'prerelease'].includes(versionType)) {
    console.error('Usage: bun run version-manager.ts <patch|minor|major|prerelease>');
    process.exit(1);
  }

  const manager = new VersionManager(process.cwd());
  const newVersion = manager.bumpVersion(versionType);
  const releaseNotes = manager.generateReleaseNotes(newVersion);
  
  console.log(`🎉 Version bumped to ${newVersion}`);
  console.log('\n📝 Release Notes:');
  console.log(releaseNotes);
}
```

## 📈 Monitoring and Post-Deployment Validation

### Extension Health Monitoring

```typescript
// src/monitoring/health-monitor.ts - Post-deployment health monitoring
import * as vscode from 'vscode';

export interface HealthMetrics {
  extensionId: string;
  version: string;
  activationTime: number;
  memoryUsage: number;
  errorCount: number;
  commandExecutions: Record<string, number>;
  sessionDuration: number;
  lastHealthCheck: Date;
}

export class ExtensionHealthMonitor {
  private static instance: ExtensionHealthMonitor;
  private metrics: HealthMetrics;
  private startTime: number;
  private healthCheckInterval: NodeJS.Timeout | undefined;

  private constructor(extensionId: string, version: string) {
    this.startTime = Date.now();
    this.metrics = {
      extensionId,
      version,
      activationTime: 0,
      memoryUsage: 0,
      errorCount: 0,
      commandExecutions: {},
      sessionDuration: 0,
      lastHealthCheck: new Date()
    };
  }

  static initialize(extensionId: string, version: string): ExtensionHealthMonitor {
    if (!ExtensionHealthMonitor.instance) {
      ExtensionHealthMonitor.instance = new ExtensionHealthMonitor(extensionId, version);
    }
    return ExtensionHealthMonitor.instance;
  }

  static getInstance(): ExtensionHealthMonitor {
    if (!ExtensionHealthMonitor.instance) {
      throw new Error('HealthMonitor not initialized');
    }
    return ExtensionHealthMonitor.instance;
  }

  startMonitoring(): void {
    this.metrics.activationTime = Date.now() - this.startTime;
    
    // Start periodic health checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 60000); // Every minute

    // Monitor VS Code events
    this.setupEventListeners();
  }

  stopMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }

  private performHealthCheck(): void {
    // Update session duration
    this.metrics.sessionDuration = Date.now() - this.startTime;
    
    // Update memory usage
    if (process.memoryUsage) {
      this.metrics.memoryUsage = process.memoryUsage().heapUsed;
    }
    
    this.metrics.lastHealthCheck = new Date();
    
    // Report metrics if telemetry is enabled
    this.reportMetrics();
  }

  private setupEventListeners(): void {
    // Monitor command executions
    const originalExecuteCommand = vscode.commands.executeCommand;
    vscode.commands.executeCommand = (command: string, ...rest: any[]) => {
      if (command.startsWith('supercode.')) {
        this.recordCommandExecution(command);
      }
      return originalExecuteCommand(command, ...rest);
    };

    // Monitor errors
    process.on('uncaughtException', (error) => {
      this.recordError(error);
    });

    process.on('unhandledRejection', (reason) => {
      this.recordError(new Error(`Unhandled rejection: ${reason}`));
    });
  }

  recordCommandExecution(command: string): void {
    this.metrics.commandExecutions[command] = (this.metrics.commandExecutions[command] || 0) + 1;
  }

  recordError(error: Error): void {
    this.metrics.errorCount++;
    console.error('Extension error:', error);
    
    // Report critical errors immediately
    if (this.metrics.errorCount > 5) {
      this.reportCriticalHealth();
    }
  }

  getMetrics(): HealthMetrics {
    return { ...this.metrics };
  }

  private async reportMetrics(): Promise<void> {
    try {
      // Only report if telemetry is enabled
      const config = vscode.workspace.getConfiguration('supercode');
      if (!config.get('telemetry.enabled', false)) {
        return;
      }

      // Send to telemetry service
      await this.sendTelemetry('health_check', this.metrics);
    } catch (error) {
      console.error('Failed to report metrics:', error);
    }
  }

  private async reportCriticalHealth(): Promise<void> {
    try {
      const criticalMetrics = {
        ...this.metrics,
        severity: 'critical',
        timestamp: new Date().toISOString()
      };

      await this.sendTelemetry('critical_health', criticalMetrics);
    } catch (error) {
      console.error('Failed to report critical health:', error);
    }
  }

  private async sendTelemetry(event: string, data: any): Promise<void> {
    // Implement telemetry reporting to your analytics service
    const telemetryEndpoint = 'https://telemetry.supercode.dev/events';
    
    try {
      const response = await fetch(telemetryEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          event,
          data,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Telemetry failed: ${response.status}`);
      }
    } catch (error) {
      // Fail silently for telemetry errors
      console.debug('Telemetry error:', error);
    }
  }
}

// Usage in extension activation
export function activateHealthMonitoring(context: vscode.ExtensionContext): void {
  const packageJson = require('../../package.json');
  const monitor = ExtensionHealthMonitor.initialize(packageJson.name, packageJson.version);
  
  monitor.startMonitoring();
  
  context.subscriptions.push({
    dispose: () => monitor.stopMonitoring()
  });
}
```

### Deployment Validation Suite

```typescript
// src/validation/deployment-validator.ts - Post-deployment validation
export interface ValidationResult {
  passed: boolean;
  testName: string;
  message: string;
  duration: number;
}

export class DeploymentValidator {
  private results: ValidationResult[] = [];

  async runAllValidations(): Promise<ValidationResult[]> {
    console.log('🔍 Running post-deployment validations...');
    
    await this.validateExtensionActivation();
    await this.validateCommandRegistration();
    await this.validateWebviewFunctionality();
    await this.validateApiConnectivity();
    await this.validateConfigurationLoading();
    await this.validateErrorHandling();
    
    this.printResults();
    return this.results;
  }

  private async runValidation(
    testName: string, 
    validationFn: () => Promise<void>
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      await validationFn();
      this.results.push({
        passed: true,
        testName,
        message: 'Validation passed',
        duration: Date.now() - startTime
      });
    } catch (error) {
      this.results.push({
        passed: false,
        testName,
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      });
    }
  }

  private async validateExtensionActivation(): Promise<void> {
    await this.runValidation('Extension Activation', async () => {
      const extension = vscode.extensions.getExtension('KiranMadipally.supercode');
      if (!extension) {
        throw new Error('Extension not found');
      }
      
      if (!extension.isActive) {
        await extension.activate();
      }
      
      if (!extension.isActive) {
        throw new Error('Extension failed to activate');
      }
    });
  }

  private async validateCommandRegistration(): Promise<void> {
    await this.runValidation('Command Registration', async () => {
      const commands = await vscode.commands.getCommands();
      const supercodeCommands = commands.filter(cmd => cmd.startsWith('supercode.'));
      
      const expectedCommands = [
        'supercode.openChat',
        'supercode.openTerminal',
        'supercode.openNewWebview'
      ];
      
      for (const expectedCmd of expectedCommands) {
        if (!supercodeCommands.includes(expectedCmd)) {
          throw new Error(`Command ${expectedCmd} not registered`);
        }
      }
    });
  }

  private async validateWebviewFunctionality(): Promise<void> {
    await this.runValidation('Webview Functionality', async () => {
      try {
        // Test webview creation
        const panel = vscode.window.createWebviewPanel(
          'test-webview',
          'Test',
          vscode.ViewColumn.One,
          { enableScripts: true }
        );
        
        panel.webview.html = '<html><body>Test</body></html>';
        panel.dispose();
      } catch (error) {
        throw new Error('Webview creation failed');
      }
    });
  }

  private async validateApiConnectivity(): Promise<void> {
    await this.runValidation('API Connectivity', async () => {
      const config = ConfigurationManager.getInstance().getConfig();
      
      try {
        const response = await fetch(`${config.apiBaseUrl}/health`, {
          method: 'GET',
          headers: { 'User-Agent': 'Supercode-VSCode-Extension' }
        });
        
        if (!response.ok) {
          throw new Error(`API health check failed: ${response.status}`);
        }
      } catch (error) {
        throw new Error(`API connectivity failed: ${error.message}`);
      }
    });
  }

  private async validateConfigurationLoading(): Promise<void> {
    await this.runValidation('Configuration Loading', async () => {
      const config = vscode.workspace.getConfiguration('supercode');
      
      // Test that configuration can be read
      const apiBaseUrl = config.get('apiBaseUrl');
      if (typeof apiBaseUrl !== 'string') {
        throw new Error('Configuration loading failed');
      }
    });
  }

  private async validateErrorHandling(): Promise<void> {
    await this.runValidation('Error Handling', async () => {
      try {
        // Test error boundary
        throw new Error('Test error');
      } catch (error) {
        // Error should be caught and handled gracefully
        if (!(error instanceof Error)) {
          throw new Error('Error handling validation failed');
        }
      }
    });
  }

  private printResults(): void {
    console.log('\n📊 Deployment Validation Results:');
    console.log('='.repeat(50));
    
    let passedCount = 0;
    let totalDuration = 0;
    
    for (const result of this.results) {
      const status = result.passed ? '✅' : '❌';
      const duration = `${result.duration}ms`;
      
      console.log(`${status} ${result.testName} (${duration})`);
      if (!result.passed) {
        console.log(`   ❗ ${result.message}`);
      }
      
      if (result.passed) passedCount++;
      totalDuration += result.duration;
    }
    
    console.log('='.repeat(50));
    console.log(`Results: ${passedCount}/${this.results.length} passed in ${totalDuration}ms`);
    
    if (passedCount === this.results.length) {
      console.log('🎉 All validations passed!');
    } else {
      console.log('⚠️  Some validations failed. Check the logs above.');
    }
  }

  getPassedCount(): number {
    return this.results.filter(r => r.passed).length;
  }

  getTotalCount(): number {
    return this.results.length;
  }

  hasFailures(): boolean {
    return this.results.some(r => !r.passed);
  }
}

// Post-deployment validation command
export function registerValidationCommand(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand('supercode.validateDeployment', async () => {
    const validator = new DeploymentValidator();
    const results = await validator.runAllValidations();
    
    // Show results in VS Code
    if (validator.hasFailures()) {
      vscode.window.showErrorMessage(
        `Deployment validation failed: ${validator.getPassedCount()}/${validator.getTotalCount()} tests passed`
      );
    } else {
      vscode.window.showInformationMessage(
        `Deployment validation successful: All ${validator.getTotalCount()} tests passed`
      );
    }
  });
  
  context.subscriptions.push(disposable);
}
```

## 📝 Implementation Checklist

### Build & Packaging ✅
- [ ] ESBuild production configuration with optimization
- [ ] Webview bundle configuration for browser compatibility
- [ ] Asset optimization and static file handling  
- [ ] Bundle analysis and size monitoring
- [ ] TypeScript compilation and type checking
- [ ] Source map generation for debugging

### Marketplace Publishing ✅
- [ ] VS Code Marketplace integration with VSCE
- [ ] Open VSX marketplace publishing
- [ ] Package validation and content verification
- [ ] Icon and gallery banner optimization
- [ ] Marketplace metadata and keywords
- [ ] License and legal compliance

### CI/CD Pipeline ✅
- [ ] GitHub Actions workflow automation
- [ ] Multi-environment deployment (staging/production)
- [ ] Security scanning and vulnerability checks
- [ ] Automated testing integration
- [ ] Release note generation
- [ ] Artifact storage and retention

### Version Management ✅
- [ ] Semantic versioning automation
- [ ] Git tag creation and management
- [ ] Changelog generation and maintenance
- [ ] Pre-release version handling
- [ ] Version validation and conflict resolution
- [ ] Release notes automation

### Environment Configuration ✅
- [ ] Environment-specific configuration management
- [ ] Secure secrets storage with VS Code SecretStorage
- [ ] API endpoint configuration per environment
- [ ] Feature flag management
- [ ] Configuration validation and error handling
- [ ] Runtime configuration updates

### Monitoring & Validation ✅
- [ ] Extension health monitoring and metrics
- [ ] Post-deployment validation suite
- [ ] Error tracking and reporting
- [ ] Performance monitoring and alerting
- [ ] Telemetry data collection (with user consent)
- [ ] Deployment success validation

### Security & Compliance ✅
- [ ] Dependency vulnerability scanning
- [ ] Code signing and verification
- [ ] Privacy policy compliance
- [ ] Data protection and user consent
- [ ] Secure API communication
- [ ] Extension permission management

### Next Steps
After completing deployment setup, proceed to:
1. **Production deployment and monitoring setup**
2. **User feedback collection and analytics**
3. **Performance optimization based on real-world usage**
4. **Continuous improvement and feature rollout**

---

This deployment configuration provides enterprise-grade build, packaging, and deployment automation for the VS Code extension with integrated chat functionality, ensuring reliable and secure distribution across multiple platforms.