
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { resolve } from 'path'
import { cwd } from 'process'

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), tsconfigPaths()],
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
  },

  // 1) In dev, don’t pre-bundle fsevents
  optimizeDeps: {
    exclude: ['fsevents'],
  },

  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      // Explicitly set an absolute path for the entry point to resolve build errors on Render.
      input: resolve(process.cwd(), 'index.html'),
      // 2) In production, treat fsevents as external
      external: ['fsevents'],
      output: {
        // 3) Arrow-fn for manualChunks to avoid parser issues
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (
              id.includes('react') ||
              id.includes('react-dom') ||
              id.includes('react-router-dom')
            ) {
              return 'vendor-react'
            }
            if (id.includes('@tanstack') || id.includes('@supabase')) {
              return 'vendor-data'
            }
            if (id.includes('@google/genai')) {
              return 'vendor-ai'
            }
            return 'vendor'
          }
        },
      },
    },
  },
})
