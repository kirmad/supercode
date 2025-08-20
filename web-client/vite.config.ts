import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Ensure single JS file output
        manualChunks: undefined,
        entryFileNames: 'assets/app-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'assets/app-[hash].css'
          }
          return 'assets/[name]-[hash].[ext]'
        }
      }
    },
    // Optimize for single file output
    cssCodeSplit: false,
    // Output directory that we'll copy from
    outDir: 'dist',
    // Clear dist before build
    emptyOutDir: true,
    // Inline small assets
    assetsInlineLimit: 4096
  },
  // Configure for production optimization
  define: {
    'process.env.NODE_ENV': '"production"'
  }
})