
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  // The 'define' block is no longer needed.
  // Vite automatically handles exposing variables prefixed with 'VITE_'
  // on the `import.meta.env` object.
})
