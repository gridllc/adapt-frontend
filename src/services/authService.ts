import { supabase } from '@/services/apiClient.ts';
import type { AuthTokenResponse, SignUpWithPasswordCredentials } from '@supabase/supabase-js';

// --- Sign Up ---
export const signUp = async (credentials: SignUpWithPasswordCredentials): Promise<AuthTokenResponse> => {
    return supabase.auth.signUp(credentials);
};

// --- Sign In ---
export const signInWithPassword = async (credentials: SignUpWithPasswordCredentials): Promise<AuthTokenResponse> => {
    return supabase.auth.signInWithPassword(credentials);
};

// --- Sign Out ---
export const signOut = async (): Promise<{ error: Error | null }> => {
    return supabase.auth.signOut();
};

// --- Get Current Session ---
export const getSession = async () => {
    return supabase.auth.getSession();
};

// --- Listen for Auth State Changes ---
export const onAuthStateChange = (
    callback: (event: string, session: import('@supabase/supabase-js').Session | null) => void
) => {
    return supabase.auth.onAuthStateChange(callback);
};
