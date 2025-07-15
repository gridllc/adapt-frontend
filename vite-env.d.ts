// This file is used to provide type definitions for Vite's `import.meta.env`.
// By defining this interface, we get type-safe access to our environment variables.
// This also resolves errors when the standard `vite/client` types are not found.

// To fix "Cannot redeclare block-scoped variable" errors and correctly augment
// global types, all declarations are wrapped in `declare global`. `export {}`
// makes this file a module, which is necessary for `declare global` to work correctly.
declare global {
    interface ImportMetaEnv {
        readonly VITE_SUPABASE_URL?: string;
        readonly VITE_SUPABASE_ANON_KEY?: string;
        readonly PROD: boolean;
        DEV: boolean;
    }

    interface ImportMeta {
        readonly env: ImportMetaEnv;
    }

    // Per coding guidelines, process.env.API_KEY is expected to be available in the execution context.
    // We augment the NodeJS.ProcessEnv type to include API_KEY. This avoids redeclaring `process`
    // and is the standard way to add types for environment variables.
    namespace NodeJS {
        interface ProcessEnv {
            API_KEY?: string;
        }
    }
}

export { };