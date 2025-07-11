import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AtSignIcon, BookOpenIcon } from '@/components/Icons';
import { useNavigate } from 'react-router-dom';

const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return;

        // In a real app, this would trigger a backend service to send an email.
        // For this prototype, we'll simulate the "magic link" by logging it
        // to the console and then immediately logging the user in.
        const magicToken = btoa(email); // simple base64 encoding as a mock token
        const magicLink = `${window.location.origin}/login?token=${magicToken}`;
        
        console.log("--- MAGIC LINK (for prototype) ---");
        console.log("In a real app, this link would be emailed to the user.");
        console.log("Clicking it would sign them in automatically.");
        console.log(magicLink);
        console.log("------------------------------------");

        // For the prototype, we just log the user in directly.
        login(email);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6">
            <div className="w-full max-w-md">
                 <button onClick={() => navigate('/')} className="absolute top-8 left-8 text-slate-300 hover:text-indigo-400 transition-colors flex items-center gap-2">
                    <BookOpenIcon className="h-5 w-5" />
                    <span>Back to Home</span>
                </button>
                <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-white">Admin Login</h1>
                        <p className="text-slate-400 mt-2">Enter your email to sign in.</p>
                    </div>
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label htmlFor="email" className="sr-only">Email</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <AtSignIcon className="h-5 w-5 text-slate-400" />
                                </div>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white"
                                    placeholder="admin@example.com"
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-colors transform hover:scale-105 disabled:bg-slate-500 disabled:scale-100"
                            disabled={!email.trim()}
                        >
                            Send Magic Link
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;