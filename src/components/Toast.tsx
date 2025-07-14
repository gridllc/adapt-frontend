
import React, { useEffect } from 'react';
import type { Toast as ToastInterface } from '@/types';
import { CheckCircleIcon, AlertTriangleIcon, InfoIcon, XIcon } from '@/components/Icons';

interface ToastProps {
  toast: ToastInterface;
  onDismiss: (id: string) => void;
}

const ICONS = {
  success: <CheckCircleIcon className="h-6 w-6 text-green-500" />,
  error: <AlertTriangleIcon className="h-6 w-6 text-red-500" />,
  info: <InfoIcon className="h-6 w-6 text-blue-500" />,
};

const BG_COLORS = {
  success: 'bg-green-50 dark:bg-green-900/50 border-green-200 dark:border-green-700',
  error: 'bg-red-50 dark:bg-red-900/50 border-red-200 dark:border-red-700',
  info: 'bg-blue-50 dark:bg-blue-900/50 border-blue-200 dark:border-blue-700',
};

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  useEffect(() => {
    // Do not auto-dismiss if there's an action for the user to take.
    if (toast.action) return;

    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, toast.duration ?? 5000); // Use provided duration or default to 5 seconds

    return () => {
      clearTimeout(timer);
    };
  }, [toast, onDismiss]);

  const handleActionClick = () => {
    if (toast.action) {
      toast.action.onClick();
      onDismiss(toast.id); // Dismiss toast after action is performed
    }
  };

  return (
    <div
      className={`max-w-sm w-full bg-white dark:bg-slate-800 shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden border ${BG_COLORS[toast.type]} animate-fade-in-up`}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            {ICONS[toast.type]}
          </div>
          <div className="ml-3 w-0 flex-1 pt-0.5">
            <p className="text-sm font-bold text-slate-900 dark:text-white">{toast.title}</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{toast.message}</p>
            {toast.action && (
              <div className="mt-3">
                <button
                  onClick={handleActionClick}
                  className="bg-indigo-600 text-white text-sm font-semibold py-1.5 px-3 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-800 focus:ring-indigo-500"
                >
                  {toast.action.label}
                </button>
              </div>
            )}
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              onClick={() => onDismiss(toast.id)}
              className="inline-flex rounded-md p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-500 dark:hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-800 focus:ring-indigo-500"
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