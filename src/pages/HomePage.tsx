import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getAvailableModules, saveModule, deleteModule } from '@/services/moduleService';
import { UploadCloudIcon, BookOpenIcon, LogOutIcon, UserIcon, BarChartIcon, TrashIcon, SunIcon, MoonIcon, SearchIcon, XIcon, VideoIcon, DownloadIcon, SparklesIcon, ClockIcon } from '@/components/Icons';
import type { ProcessStep } from '@/types';
import type { Database } from '@/types/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useTheme } from '@/hooks/useTheme';
import { ModuleCardSkeleton } from '@/components/ModuleCardSkeleton';

type ModuleWithStatsRow = Database['public']['Views']['modules_with_session_stats']['Row'];
type ModuleInsert = Database['public']['Tables']['modules']['Insert'];

const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { addToast } = useToast();
    const [isDragging, setIsDragging] = useState(false);
    const { isAuthenticated, user, signOut } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [searchTerm, setSearchTerm] = useState('');

    const { data: availableModules, isLoading: isLoadingModules, error: modulesError } = useQuery<ModuleWithStatsRow[], Error>({
        queryKey: ['modules'],
        queryFn: getAvailableModules
    });

    const filteredModules = useMemo(() => {
        if (!availableModules) return [];
        const lowercasedTerm = searchTerm.toLowerCase();
        return availableModules.filter(module =>
            module.title?.toLowerCase().includes(lowercasedTerm)
        );
    }, [availableModules, searchTerm]);

    // --- Keyboard shortcut for search ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === '/' && (e.target as HTMLElement)?.tagName !== 'INPUT' && (e.target as HTMLElement)?.tagName !== 'TEXTAREA') {
                e.preventDefault();
                document.getElementById('module-search')?.focus();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleFileUpload = useCallback(async (file: File) => {
        if (!user) {
            addToast('error', 'Authentication Error', 'You must be logged in to upload a module.');
            return;
        }

        if (file.type !== 'application/json') {
            addToast('error', 'Invalid File', 'Please upload a .json file.');
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') throw new Error("Could not read file.");

                const moduleData = JSON.parse(text) as ModuleInsert;

                const savedModule = await saveModule({ moduleData });
                await queryClient.invalidateQueries({ queryKey: ['modules'] });
                addToast('success', 'Upload Complete', `Module "${savedModule.title}" was uploaded.`);
                navigate(`/modules/${savedModule.slug}`);

            } catch (err) {
                console.error(err);
                const errorMessage = err instanceof Error ? err.message : 'Failed to parse or save the module file.';
                addToast('error', 'Upload Failed', errorMessage);
            }
        };
        reader.onerror = () => {
            addToast('error', 'Read Error', 'Could not read the selected file.');
        };
        reader.readAsText(file);
    }, [navigate, queryClient, addToast, user]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) handleFileUpload(file);
    };

    const handleDrop = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
        const file = event.dataTransfer.files?.[0];
        if (file) handleFileUpload(file);
    }, [handleFileUpload]);

    const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        event.stopPropagation();
    };

    const handleDragEnter = (event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
    };

    const handleDeleteModule = useCallback(async (e: React.MouseEvent, slug: string | null) => {
        e.preventDefault();
        e.stopPropagation();
        if (!slug) return;

        const confirmation = window.confirm(
            'Are you sure you want to delete this module? This will also remove ALL associated training progress and chat histories from the database. This action cannot be undone.'
        );

        if (confirmation) {
            try {
                await deleteModule(slug);
                await queryClient.invalidateQueries({ queryKey: ['modules'] });
                addToast('success', 'Module Deleted', `The module was successfully removed.`);
            } catch (err) {
                console.error("Failed to delete module:", err);
                const errorMessage = err instanceof Error ? err.message : 'An error occurred during deletion.';
                addToast('error', 'Deletion Failed', errorMessage);
            }
        }
    }, [queryClient, addToast]);

    const handleDownloadModule = useCallback((e: React.MouseEvent, module: ModuleWithStatsRow) => {
        e.preventDefault();
        e.stopPropagation();

        // Create a clean version of the module data without the session stats for export
        const cleanModule = {
            slug: module.slug,
            title: module.title,
            steps: module.steps,
            video_url: module.video_url,
            transcript: module.transcript,
            metadata: module.metadata,
        };

        const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
            JSON.stringify(cleanModule, null, 2)
        )}`;
        const link = document.createElement("a");
        link.href = jsonString;
        link.download = `${module.slug}.json`;
        link.click();

        addToast('success', 'Download Started', 'Module JSON file is being downloaded.');
    }, [addToast]);


    return (
        <div className="max-w-4xl mx-auto p-8">
            <header className="text-center mb-12 relative">
                <div className="absolute top-0 right-0 flex items-center gap-4">
                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-full bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                        aria-label="Toggle theme"
                        title="Toggle theme"
                    >
                        {theme === 'dark' ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
                    </button>
                    {isAuthenticated && user ? (
                        <>
                            <Link to="/dashboard" className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2 px-4 rounded-full transition-colors">
                                <BarChartIcon className="h-5 w-5" />
                                <span>Go to Dashboard</span>
                            </Link>
                            <button
                                onClick={signOut}
                                className="flex items-center gap-2 bg-slate-200 dark:bg-slate-700 hover:bg-red-500/20 dark:hover:bg-red-500/80 text-slate-700 dark:text-white text-sm font-semibold py-2 px-4 rounded-full transition-colors"
                                title="Logout"
                            >
                                <LogOutIcon className="h-5 w-5" />
                                <span className="hidden md:inline">Logout</span>
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => navigate('/login')}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2 px-4 rounded-full transition-colors"
                        >
                            <UserIcon className="h-5 w-5" />
                            <span>Admin Login</span>
                        </button>
                    )}
                </div>
                <h1 className="text-5xl font-bold text-slate-900 dark:text-white">Adapt Training Platform</h1>
                <p className="mt-4 text-lg text-slate-500 dark:text-slate-400">Your interactive AI-powered training assistant.</p>
            </header>

            <div className="mt-12">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 text-center">Available Training Modules</h2>
                <div className="mb-6 max-w-lg mx-auto">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchIcon className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            id="module-search"
                            placeholder="Search for a module (or press /)"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-700 rounded-full bg-slate-100 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute inset-y-0 right-0 pr-3 flex items-center">
                                <XIcon className="h-5 w-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" />
                            </button>
                        )}
                    </div>
                </div>

                {isLoadingModules ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <ModuleCardSkeleton />
                        <ModuleCardSkeleton />
                    </div>
                ) : modulesError ? (
                    <div className="text-center text-red-500 dark:text-red-400 bg-red-100 dark:bg-red-900/50 p-4 rounded-lg">
                        Error fetching modules: {modulesError.message}
                    </div>
                ) : filteredModules.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {filteredModules.map(module => (
                            <div key={module.slug} className="block p-6 bg-white dark:bg-slate-800 rounded-xl hover:ring-2 hover:ring-indigo-500 transition-all duration-300 transform hover:-translate-y-1 shadow-md dark:shadow-lg relative group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-indigo-100 dark:bg-indigo-600/30 p-3 rounded-lg">
                                            <BookOpenIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-300" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                                {module.title}
                                                {module.is_ai_generated && <SparklesIcon className="h-5 w-5 text-yellow-500" title="AI Generated" />}
                                            </h3>
                                            <p className="text-slate-500 dark:text-slate-400">{((module.steps as ProcessStep[]) || []).length} steps</p>
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0" title={module.last_used_at ? `Last used on ${new Date(module.last_used_at).toLocaleDateString()}` : undefined}>
                                        {(module.session_count ?? 0) > 0 ? (
                                            <span className="flex items-center gap-1 text-xs font-semibold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-800/50 px-2 py-1 rounded-full">
                                                <ClockIcon className="h-4 w-4" /> In Use
                                            </span>
                                        ) : (
                                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-2 py-1 rounded-full">Not Started</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Link to={`/modules/${module.slug}`} className="flex-1 text-center bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                                        Start Training
                                    </Link>
                                    <Link to={`/modules/${module.slug}/live`} className="flex-1 text-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2">
                                        <VideoIcon className="h-5 w-5" />
                                        Live Coach
                                    </Link>
                                </div>
                                {isAuthenticated && (
                                    <div className="absolute top-4 right-4 flex flex-col gap-2 items-end opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => handleDownloadModule(e, module)}
                                            className="p-2 bg-slate-200/50 dark:bg-slate-700/50 rounded-full text-slate-500 dark:text-slate-400 hover:bg-blue-500/80 hover:text-white transition-all"
                                            aria-label="Download module JSON"
                                            title="Download module JSON"
                                        >
                                            <DownloadIcon className="h-5 w-5" />
                                        </button>
                                        <button
                                            onClick={(e) => handleDeleteModule(e, module.slug)}
                                            className="p-2 bg-slate-200/50 dark:bg-slate-700/50 rounded-full text-slate-500 dark:text-slate-400 hover:bg-red-500/80 hover:text-white transition-all"
                                            aria-label="Delete module"
                                            title="Delete module"
                                        >
                                            <TrashIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center bg-slate-100 dark:bg-slate-800 p-8 rounded-lg">
                        <p className="text-slate-500 dark:text-slate-400">{searchTerm ? `No modules found for "${searchTerm}"` : "No training modules found in the database."}</p>
                        {!searchTerm && <p className="text-slate-400 dark:text-slate-500 text-sm mt-2">Use the "Create with AI" tool to add one.</p>}
                    </div>
                )}
            </div>
        </div>
    );
};

export default HomePage;