import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import * as authService from '@/services/authService.ts';
import type { Session, User } from '@/services/authService.ts';

interface AuthContextType {
    isAuthenticated: boolean;
    user: User | null;
    session: Session | null;
    isLoading: boolean;
    signIn: typeof authService.signInWithPassword;
    login: typeof authService.signInWithPassword; // Alias for backward compatibility
    signUp: typeof authService.signUp;
    signOut: typeof authService.signOut;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchSession = async () => {
            try {
                const { data } = await authService.getSession();
                setSession(data.session);
                setUser(data.session?.user ?? null);
            } catch (error) {
                console.error("Error fetching initial session:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSession();

        const { data: authListener } = authService.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setIsLoading(false);
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    const value: AuthContextType = {
        session,
        user,
        isAuthenticated: !!user,
        isLoading,
        signIn: authService.signInWithPassword,
        login: authService.signInWithPassword, // Add alias to value
        signUp: authService.signUp,
        signOut: authService.signOut,
    };

    return React.createElement(AuthContext.Provider, { value }, children);
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
