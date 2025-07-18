import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import {
    BarChartIcon,
    LightbulbIcon,
    HelpCircleIcon,
    LogOutIcon,
    SunIcon,
    MoonIcon,
    BookOpenIcon
} from '@/components/Icons';

const AdminLayout: React.FC = () => {
    const { user, signOut } = useAuth();
    const { theme, toggleTheme } = useTheme();

    const navLinks = [
        { to: '/dashboard', label: 'Dashboard', icon: BarChartIcon },
        { to: '/create', label: 'Create Module', icon: LightbulbIcon },
        { to: '/dashboard/questions', label: 'Question Log', icon: HelpCircleIcon },
    ];

    return (
        <div className="flex flex-col md:flex-row h-screen bg-slate-100 dark:bg-slate-900">
            {/* Sidebar */}
            <aside className="w-full md:w-64 flex-shrink-0 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col">
                <div className="h-16 flex items-center justify-center px-4 border-b border-slate-200 dark:border-slate-700">
                    <h1 className="text-2xl font-bold text-indigo-500 dark:text-indigo-400">Adapt Admin</h1>
                </div>
                <nav className="flex-1 px-4 py-6 space-y-2">
                    {navLinks.map(({ to, label, icon: Icon }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={to === '/dashboard'}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                                    ? 'bg-indigo-100 dark:bg-indigo-600/30 text-indigo-600 dark:text-indigo-300'
                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                                }`
                            }
                        >
                            <Icon className="h-5 w-5" />
                            <span>{label}</span>
                        </NavLink>
                    ))}
                    <NavLink
                        to="/"
                        className="flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                        <BookOpenIcon className="h-5 w-5" />
                        <span>Home</span>
                    </NavLink>
                </nav>
                <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs text-slate-500 dark:text-slate-400 truncate" title={user?.email}>{user?.email}</span>
                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-full bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                            aria-label="Toggle theme"
                        >
                            {theme === 'dark' ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
                        </button>
                    </div>
                    <button
                        onClick={signOut}
                        className="w-full flex items-center justify-center gap-2 bg-slate-200 dark:bg-slate-700 hover:bg-red-500/20 dark:hover:bg-red-500/80 text-slate-700 dark:text-white text-sm font-semibold py-2 px-4 rounded-full transition-colors"
                        title="Logout"
                    >
                        <LogOutIcon className="h-5 w-5" />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>
            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                <Outlet />
            </main>
        </div>
    );
};

export default AdminLayout;