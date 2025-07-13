
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  server: {
    historyApiFallback: true,
  },
  // The 'define' block is used to expose environment variables to the client-side code.
  // Per the coding guidelines, the Gemini API key MUST be accessed via `process.env.API_KEY`.
  // Vite replaces this with the value at build time.
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-router-dom') || id.includes('react-dom') || id.includes('react')) {
              return 'vendor-react';
            }
            if (id.includes('@tanstack') || id.includes('@supabase')) {
              return 'vendor-data';
            }
            if (id.includes('@google/genai')) {
              return 'vendor-ai';
            }
            // All other node_modules go into a common vendor chunk.
            return 'vendor';
          }
        },
      },
    },
  },
})