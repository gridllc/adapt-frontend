
import { createClient } from '@supabase/supabase-js'

// Use Vite's standard `import.meta.env` to access environment variables.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL and Anon Key must be provided in your .env.local file.');
}

// Add global headers to ensure all requests accept JSON, fixing 406 errors.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
        headers: {
            'Accept': 'application/json'
        }
    }
});
