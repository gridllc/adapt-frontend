// This file is used to provide type definitions for Vite's `import.meta.env`.
// By defining this interface, we get type-safe access to our environment variables.
// This also resolves errors when the standard `vite/client` types are not found.

interface ImportMetaEnv {
    readonly VITE_API_KEY_PRO?: string;
    readonly VITE_API_KEY?: string;
    readonly VITE_SUPABASE_URL?: string;
    readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
