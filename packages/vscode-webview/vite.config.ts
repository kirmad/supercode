import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  // Load environment variables with any prefix (not just VITE_)
  const env = loadEnv(mode, process.cwd(), '')
  const isStandalone = mode === 'standalone'
  
  // Log mode for debugging
  if (isStandalone) {
    console.log('Building in standalone mode')
  }

  return {
    plugins: [vue()],
    server: isStandalone ? {
      port: 5000,
      open: true
    } : undefined,
    build: {
    outDir: 'dist',
    lib: {
      entry: 'src/main.ts',
      name: 'SuperCodeWebview',
      fileName: 'webview',
      formats: ['iife']
    },
    rollupOptions: {
      output: {
        // Ensure consistent CSS file naming
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'style.css'
          }
          return assetInfo.name || 'asset'
        },
        // Single JS bundle for webview
        entryFileNames: 'webview.js'
      }
    },
    // Separate CSS file for webview
    cssCodeSplit: false,
    minify: true,
    sourcemap: false
  },
    define: {
      // Required for Vue 3 in production
      __VUE_OPTIONS_API__: false,
      __VUE_PROD_DEVTOOLS__: false,
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
      // Define process.env for webview compatibility
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env': JSON.stringify({
        AZURE_DEVOPS_ORG: env.AZURE_DEVOPS_ORG || '',
        AZURE_DEVOPS_PROJECT: env.AZURE_DEVOPS_PROJECT || '',
        AZURE_DEVOPS_PAT: env.AZURE_DEVOPS_PAT || ''
      }),
      // Add Azure DevOps credentials as VITE_ prefixed variables
      'import.meta.env.VITE_AZURE_DEVOPS_ORG': JSON.stringify(env.AZURE_DEVOPS_ORG || ''),
      'import.meta.env.VITE_AZURE_DEVOPS_PROJECT': JSON.stringify(env.AZURE_DEVOPS_PROJECT || ''),
      'import.meta.env.VITE_AZURE_DEVOPS_PAT': JSON.stringify(env.AZURE_DEVOPS_PAT || ''),
      // Add standalone mode variables
      ...(isStandalone ? {
        'import.meta.env.VITE_STANDALONE': JSON.stringify(true),
        'import.meta.env.VITE_SERVER_PORT': JSON.stringify(5000)
      } : {})
    }
  }
})