
import React, { useEffect } from 'react';
import type { Toast as ToastType } from '@/types.ts';
import { CheckCircleIcon, AlertTriangleIcon, InfoIcon, XIcon } from '@/components/Icons.tsx';

interface ToastProps {
    toast: ToastType;
    onDismiss: () => void;
}

const icons = {
    success: <CheckCircleIcon className="h-6 w-6 text-green-500 dark:text-green-400" />,
    error: <AlertTriangleIcon className="h-6 w-6 text-red-500 dark:text-red-400" />,
    info: <InfoIcon className="h-6 w-6 text-blue-500 dark:text-blue-400" />,
};

const colors = {
    success: 'bg-green-50 dark:bg-green-900/80 border-green-200 dark:border-green-700/80',
    error: 'bg-red-50 dark:bg-red-900/80 border-red-200 dark:border-red-700/80',
    info: 'bg-blue-50 dark:bg-blue-900/80 border-blue-200 dark:border-blue-700/80',
};

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onDismiss();
        }, 5000); // Auto-dismiss after 5 seconds

        return () => {
            clearTimeout(timer);
        };
    }, [onDismiss]);

    return (
        <div
            className={`max-w-sm w-full shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden backdrop-blur-md animate-fade-in-up ${colors[toast.type]}`}
            role="alert"
        >
            <div className="p-4">
                <div className="flex items-start">
                    <div className="flex-shrink-0">
                        {icons[toast.type]}
                    </div>
                    <div className="ml-3 w-0 flex-1 pt-0.5">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{toast.title}</p>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{toast.message}</p>
                    </div>
                    <div className="ml-4 flex-shrink-0 flex">
                        <button
                            onClick={onDismiss}
                            className="inline-flex rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-800 focus:ring-indigo-500"
                        >
                            <span className="sr-only">Close</span>
                            <XIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};