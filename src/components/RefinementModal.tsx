
import React, { useEffect } from 'react';
import type { ProcessStep, RefinementSuggestion } from '@/types.ts';
import { XIcon, LightbulbIcon, CheckCircleIcon } from '@/components/Icons.tsx';

interface RefinementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStep: ProcessStep;
  suggestion: RefinementSuggestion;
  onApply: () => void;
}

export const RefinementModal: React.FC<RefinementModalProps> = ({
  isOpen,
  onClose,
  currentStep,
  suggestion,
  onApply,
}) => {
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);

    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="bg-white dark:bg-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 animate-fade-in-up"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
      >
        <header className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <LightbulbIcon className="h-6 w-6 text-yellow-500 dark:text-yellow-400" />
            <h2 className="font-bold text-lg text-slate-900 dark:text-white">Review AI Suggestion</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
            <XIcon className="h-5 w-5" />
          </button>
        </header>

        <main className="p-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mb-1">For Step:</h3>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{currentStep.title}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Current Version */}
            <div>
              <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-2">Current Version</h4>
              <div className="bg-slate-100 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700 h-full">
                <p className="text-sm text-slate-600 dark:text-slate-300">{currentStep.description}</p>
              </div>
            </div>

            {/* Suggested Version */}
            <div>
              <h4 className="font-semibold text-green-600 dark:text-green-400 mb-2">Suggested Improvement</h4>
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-700 h-full">
                <p className="text-sm text-green-800 dark:text-green-200">{suggestion.newDescription}</p>
              </div>
            </div>
          </div>

          {suggestion.newAlternativeMethod && (
            <div>
              <h4 className="font-semibold text-green-600 dark:text-green-400 mb-2">Suggested New Alternative Method</h4>
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-700">
                <h5 className="font-bold text-sm text-green-800 dark:text-green-300">{suggestion.newAlternativeMethod.title}</h5>
                <p className="text-sm text-green-700 dark:text-green-200 mt-1">{suggestion.newAlternativeMethod.description}</p>
              </div>
            </div>
          )}

        </main>

        <footer className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-4 rounded-b-2xl">
          <button onClick={onClose} className="bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold py-2 px-4 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={onApply}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center gap-2"
          >
            <CheckCircleIcon className="h-5 w-5" />
            Apply & Edit
          </button>
        </footer>
      </div>
    </div>
  );
};