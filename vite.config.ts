
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
    plugins: [react(), tsconfigPaths()],
    define: {
      // Pass environment variables to the client-side code.
      // Vite handles loading .env files. The VITE_ prefix is required for client-side exposure.
      'process.env.API_KEY': JSON.stringify(process.env.VITE_API_KEY),
      'process.env.API_KEY_PRO': JSON.stringify(process.env.VITE_API_KEY_PRO),
      'process.env.SUPABASE_URL': JSON.stringify(process.env.VITE_SUPABASE_URL),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY),
    }
  }
})
