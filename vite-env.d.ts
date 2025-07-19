// This file provides type definitions for Vite's `import.meta.env` and Node's `process.env`.
// It is the single source of truth for environment variable types in the project.

// By declaring `ImportMetaEnv` in the global scope (in a .d.ts file without top-level imports/exports),
// we augment the existing interface. This ensures that
// built-in Vite environment variables like `DEV` and `PROD` are still available.
interface ImportMetaEnv {
    readonly DEV: boolean;
    readonly PROD: boolean;
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
    readonly VITE_SLACK_WEBHOOK_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

// Augment the NodeJS namespace to include the `API_KEY` type for `process.env`.
// This is the standard way to add types for Node.js environment variables.
declare namespace NodeJS {
    interface ProcessEnv {
        API_KEY: string;
    }
}
