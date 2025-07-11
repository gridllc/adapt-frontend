
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
    plugins: [react(), tsconfigPaths()],
    define: {
      // Pass the API key from the build environment to the client-side code.
      // This assumes `API_KEY` is set in the environment where `vite build` or `vite dev` is run.
      'process.env.API_KEY': JSON.stringify(process.env.API_KEY),
      'process.env.API_KEY_PRO': JSON.stringify(process.env.API_KEY_PRO)
    }
  }
})