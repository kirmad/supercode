import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
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
    'process.env': JSON.stringify({})
  }
})