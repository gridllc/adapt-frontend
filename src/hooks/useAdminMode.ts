
import { useState, useEffect, useCallback } from 'react';

const ADMIN_KEY = 'adapt-admin-mode';

export function useAdminMode(): [boolean, (isAdmin: boolean) => void] {
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    try {
      const storedValue = localStorage.getItem(ADMIN_KEY);
      return storedValue === 'true';
    } catch {
      return false;
    }
  });

  const setAdminMode = useCallback((newValue: boolean) => {
    try {
      localStorage.setItem(ADMIN_KEY, String(newValue));
      setIsAdmin(newValue);
    } catch (error) {
      console.error('Could not save admin mode to local storage', error);
    }
  }, []);

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === ADMIN_KEY) {
        setIsAdmin(event.newValue === 'true');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return [isAdmin, setAdminMode];
}
