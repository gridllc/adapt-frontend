import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  base: './',
  plugins: [react(), tsconfigPaths()],
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
  },
  optimizeDeps: {
    exclude: ['fsevents'],
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      external: ['fsevents'],
      // <<< no manualChunks block at all >>>
    },
  },
})