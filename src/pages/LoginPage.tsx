
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { BookOpenIcon, EyeIcon, EyeOffIcon } from '@/components/Icons';
import { useNavigate, useLocation } from 'react-router-dom';

const LoginPage: React.FC = () => {
    const [isLoginView, setIsLoginView] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const { signIn, signUp, session, isLoading: isAuthLoading } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const from = location.state?.from?.pathname || '/';

    // Redirect if user is already logged in
    useEffect(() => {
        if (session && !isAuthLoading) {
            navigate(from, { replace: true });
        }
    }, [session, isAuthLoading, navigate, from]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            const { error } = isLoginView
                ? await signIn({ email, password })
                : await signUp({ email, password });

            if (error) {
                setError(error.message);
            } else {
                navigate(from, { replace: true });
            }
        } catch (err: any) {
            setError(err.message || "An unexpected error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    const toggleView = () => {
        setIsLoginView(!isLoginView);
        setError(null);
        setEmail('');
        setPassword('');
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-50 dark:bg-slate-900">
            <div className="w-full max-w-md">
                <button onClick={() => navigate('/')} className="absolute top-8 left-8 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-2">
                    <BookOpenIcon className="h-5 w-5" />
                    <span>Back to Home</span>
                </button>
                <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                            {isLoginView ? 'Admin Sign In' : 'Admin Sign Up'}
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 mt-2">
                            {isLoginView ? 'Enter your credentials to sign in.' : 'Create an account to get started.'}
                        </p>
                    </div>

                    {error && (
                        <div className="bg-red-100 dark:bg-red-900/50 border border-red-400 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg relative mb-6" role="alert">
                            <span className="block sm:inline">{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="email" className="sr-only">Email</label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                                placeholder="admin@example.com"
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="sr-only">Password</label>
                            <div className="relative">
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 dark:text-slate-400"
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-colors transform hover:scale-105 disabled:bg-slate-400 dark:disabled:bg-slate-500 disabled:scale-100 disabled:cursor-not-allowed"
                            disabled={isLoading || !email.trim() || !password.trim()}
                        >
                            {isLoading ? 'Processing...' : (isLoginView ? 'Sign In' : 'Sign Up')}
                        </button>
                    </form>
                    <div className="mt-6 text-center">
                        <button onClick={toggleView} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
                            {isLoginView ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;