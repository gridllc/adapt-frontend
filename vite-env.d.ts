// This file provides type definitions for Vite's `import.meta.env` and Node's `process.env`.
// It is the single source of truth for environment variable types in the project.

// By using `declare global`, we augment the existing global types rather than creating new ones.
// This avoids conflicts with Vite's built-in environment variable types (like PROD and DEV).
declare global {
    // --- Vite Environment Variables (import.meta.env) ---
    interface ImportMetaEnv {
        readonly VITE_SUPABASE_URL?: string
        readonly VITE_SUPABASE_ANON_KEY?: string
        readonly VITE_SLACK_WEBHOOK_URL?: string
        readonly DEV: boolean
        readonly PROD: boolean
    }

    interface ImportMeta {
        readonly env: ImportMetaEnv
    }

    // --- Node.js Environment Variables (process.env) ---
    // Per coding guidelines, process.env.API_KEY is expected to be available in the execution context.
    // We augment the NodeJS.ProcessEnv type to include API_KEY. This is the standard way to add types for Node.js environment variables.
    namespace NodeJS {
        interface ProcessEnv {
            API_KEY?: string
        }
    }
}

// This `export {}` is required to make this file a module, which allows `declare global` to work correctly.
export { }