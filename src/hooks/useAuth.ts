import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const AUTH_KEY = 'adapt-auth-token';

interface AuthState {
  isAuthenticated: boolean;
  user: { email: string } | null;
}

export function useAuth() {
  const navigate = useNavigate();
  const location = useLocation();

  const [authState, setAuthState] = useState<AuthState>(() => {
    try {
      const storedToken = localStorage.getItem(AUTH_KEY);
      if (storedToken) {
        return { isAuthenticated: true, user: { email: storedToken } };
      }
    } catch (e) {
      console.error("Could not read auth state from local storage", e);
    }
    return { isAuthenticated: false, user: null };
  });

  const login = useCallback((email: string) => {
    try {
      localStorage.setItem(AUTH_KEY, email);
      setAuthState({ isAuthenticated: true, user: { email } });
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    } catch (error) {
      console.error('Could not save auth token to local storage', error);
    }
  }, [navigate, location.state]);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(AUTH_KEY);
      setAuthState({ isAuthenticated: false, user: null });
      navigate('/');
    } catch (error) {
      console.error('Could not remove auth token from local storage', error);
    }
  }, [navigate]);

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === AUTH_KEY) {
        if (event.newValue) {
            setAuthState({ isAuthenticated: true, user: { email: event.newValue } });
        } else {
            setAuthState({ isAuthenticated: false, user: null });
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return { ...authState, login, logout };
}
