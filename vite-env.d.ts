// This file is used to provide type definitions for Vite's `import.meta.env`.
// By defining this interface, we get type-safe access to our environment variables.
// This also resolves errors when the standard `vite/client` types are not found.

interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL?: string;
    readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

// Per coding guidelines, process.env.API_KEY is expected to be available in the execution context.
// We declare `process` here to satisfy TypeScript in the client-side code, assuming the
// execution environment provides it.
// To fix the "Cannot redeclare block-scoped variable" error, we wrap the declaration
// in `declare global` and make this file a module by adding `export {}`. This prevents
// declaration conflicts with other global types.
declare global {
    var process: {
        env: {
            API_KEY?: string;
        }
    };
}

export { };
