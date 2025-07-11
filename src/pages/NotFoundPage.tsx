
import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpenIcon } from '@/components/Icons.tsx';

const NotFoundPage: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen text-center p-6">
            <h1 className="text-6xl font-bold text-indigo-500 dark:text-indigo-400">404</h1>
            <h2 className="text-3xl font-semibold text-slate-900 dark:text-white mt-4">Page Not Found</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2">Sorry, the page you are looking for does not exist.</p>
            <Link
                to="/"
                className="mt-8 inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition-transform transform hover:scale-105"
            >
                <BookOpenIcon className="h-5 w-5" />
                <span>Return to Home</span>
            </Link>
        </div>
    );
};

export default NotFoundPage;