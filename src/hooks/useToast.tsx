
import React, { createContext, useState, useContext, useCallback, ReactNode } from 'react';
import { Toast as ToastComponent } from '@/components/Toast';
import type { Toast, ToastType } from '@/types';

type AddToastOptions = {
    duration?: number;
    action?: {
        label: string;
        onClick: () => void;
    };
};

type ToastContextType = {
    addToast: (type: ToastType, title: string, message: string, options?: AddToastOptions) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((type: ToastType, title: string, message: string, options?: AddToastOptions) => {
        const id = Date.now().toString() + Math.random().toString();
        const newToast: Toast = {
            id,
            type,
            title,
            message,
            duration: options?.duration,
            action: options?.action,
        };
        setToasts(prevToasts => [...prevToasts, newToast]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            <div className="fixed top-4 right-4 z-[100] w-full max-w-xs space-y-3">
                {toasts.map(toast => (
                    <ToastComponent
                        key={toast.id}
                        toast={toast}
                        onDismiss={() => removeToast(toast.id)}
                    />
                ))}
            </div>
        </ToastContext.Provider>
    );
};