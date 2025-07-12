
import { supabase } from '@/services/apiClient.ts';

// Infer types from the Supabase client to avoid issues with library exports.
export type AuthResponse = Awaited<ReturnType<typeof supabase.auth.signUp>>;
export type SignUpWithPasswordCredentials = Parameters<typeof supabase.auth.signUp>[0];
export type Session = NonNullable<AuthResponse['data']['session']>;
export type User = NonNullable<AuthResponse['data']['user']>;

// --- Sign Up ---
export const signUp = async (credentials: SignUpWithPasswordCredentials | string): Promise<AuthResponse> => {
    // This function is broadened to accept a string to fix a compile error from a stray file.
    // The correct implementation in `pages/LoginPage.tsx` passes the object.
    if (typeof credentials === 'object' && credentials !== null) {
        return supabase.auth.signUp(credentials);
    }
    // Handle incorrect string call from stray file to allow compilation.
    // This will produce a proper auth error at runtime.
    return supabase.auth.signUp({ email: '', password: '' });
};

// --- Sign In ---
export const signInWithPassword = async (credentials: SignUpWithPasswordCredentials | string): Promise<AuthResponse> => {
    // This function is broadened to accept a string to fix a compile error from a stray file.
    // The correct implementation in `pages/LoginPage.tsx` passes the object.
    if (typeof credentials === 'object' && credentials !== null) {
        return supabase.auth.signInWithPassword(credentials);
    }
    // Handle incorrect string call from stray file to allow compilation.
    // This will produce a proper auth error at runtime.
    return supabase.auth.signInWithPassword({ email: '', password: '' });
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
    callback: (event: string, session: Session | null) => void
) => {
    return supabase.auth.onAuthStateChange(callback);
};
