import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  // serve / reference assets relative to the current HTML file
  base: './',
  plugins: [react(), tsconfigPaths()],
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (
              id.includes('react-router-dom') ||
              id.includes('react-dom') ||
              id.includes('react')
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