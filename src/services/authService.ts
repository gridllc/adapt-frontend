
import { supabase } from '@/services/apiClient.ts';

// Infer types from the Supabase client to avoid issues with library exports.
export type AuthResponse = Awaited<ReturnType<typeof supabase.auth.signUp>>;
export type SignUpWithPasswordCredentials = Parameters<typeof supabase.auth.signUp>[0];
export type Session = NonNullable<AuthResponse['data']['session']>;
export type User = NonNullable<AuthResponse['data']['user']>;

// --- Sign Up ---
export const signUp = async (credentials: SignUpWithPasswordCredentials): Promise<AuthResponse> => {
    return supabase.auth.signUp(credentials);
};

// --- Sign In ---
export const signInWithPassword = async (credentials: SignUpWithPasswordCredentials): Promise<AuthResponse> => {
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
    callback: (event: string, session: Session | null) => void
) => {
    return supabase.auth.onAuthStateChange(callback);
};