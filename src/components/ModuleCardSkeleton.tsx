import React from 'react';
import { BookOpenIcon } from '@/components/Icons';

export const ModuleCardSkeleton: React.FC = () => {
  return (
    <div className="block p-6 bg-white dark:bg-slate-800 rounded-xl shadow-md">
      <div className="flex items-center gap-4 animate-pulse">
        <div className="bg-slate-200 dark:bg-slate-700 p-3 rounded-lg">
          <BookOpenIcon className="h-6 w-6 text-slate-400 dark:text-slate-500" />
        </div>
        <div className="flex-1">
          <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4 mt-2"></div>
        </div>
      </div>
    </div>
  );
};