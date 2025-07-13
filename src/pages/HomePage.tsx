import React, { useState, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getAvailableModules, saveUploadedModule, deleteModule } from '@/services/moduleService';
import { UploadCloudIcon, BookOpenIcon, LightbulbIcon, LogOutIcon, UserIcon, BarChartIcon, TrashIcon, SunIcon, MoonIcon, SearchIcon, XIcon } from '@/components/Icons';
import type { TrainingModule } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useTheme } from '@/hooks/useTheme';
import { ModuleCardSkeleton } from '@/components/ModuleCardSkeleton';

const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { addToast } = useToast();
    const [isDragging, setIsDragging] = useState(false);
    const { isAuthenticated, user, signOut } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [searchTerm, setSearchTerm] = useState('');

    // Fetch available modules using React Query
    const { data: availableModules, isLoading: isLoadingModules, error: modulesError } = useQuery<TrainingModule[], Error>({
        queryKey: ['modules'],
        queryFn: getAvailableModules
    });

    const filteredModules = useMemo(() => {
        if (!availableModules) return [];
        if (!searchTerm.trim()) return availableModules;
        return availableModules.filter(module =>
            module.title.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [availableModules, searchTerm]);

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

                const moduleData = JSON.parse(text) as TrainingModule;

                const savedModule = await saveUploadedModule(moduleData);
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

    const handleDeleteModule = useCallback(async (e: React.MouseEvent, slug: string) => {
        e.preventDefault();
        e.stopPropagation();

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
                            <span className="text-sm text-slate-500 dark:text-slate-400 hidden sm:inline" title={user.email}>{user.email}</span>
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

            {isAuthenticated && (
                <div className="mb-12 animate-fade-in-up">
                    <h2 className="text-2xl font-bold text-indigo-500 dark:text-indigo-400 mb-6 text-center">Admin Tools</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-100 dark:bg-slate-800/50 p-6 rounded-2xl border border-indigo-200 dark:border-indigo-500/30">
                        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg flex flex-col">
                            <h3 className="text-xl font-bold text-indigo-500 dark:text-indigo-400 mb-2">Create with AI</h3>
                            <p className="text-slate-600 dark:text-slate-300 mb-6 flex-grow">Describe your process and let our AI build the training module for you.</p>
                            <Link to="/create" className="mt-auto w-full text-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105 flex items-center justify-center gap-2">
                                <LightbulbIcon className="h-6 w-6" />
                                <span>Start Creating</span>
                            </Link>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg flex flex-col">
                            <h3 className="text-xl font-bold text-indigo-500 dark:text-indigo-400 mb-2">Analytics Dashboard</h3>
                            <p className="text-slate-600 dark:text-slate-300 mb-6 flex-grow">View trainee insights and see the most common questions.</p>
                            <Link to="/dashboard" className="mt-auto w-full text-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105 flex items-center justify-center gap-2">
                                <BarChartIcon className="h-6 w-6" />
                                <span>View Dashboard</span>
                            </Link>
                        </div>
                        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg flex flex-col md:col-span-2">
                            <h3 className="text-xl font-bold text-indigo-500 dark:text-indigo-400 mb-2">Upload a Module</h3>
                            <p className="text-slate-600 dark:text-slate-300 mb-6 flex-grow">Have a pre-made training module? Upload the JSON file here.</p>

                            <label
                                onDrop={handleDrop}
                                onDragOver={handleDragOver}
                                onDragEnter={handleDragEnter}
                                onDragLeave={handleDragLeave}
                                className={`flex justify-center w-full h-24 px-4 transition bg-slate-50 dark:bg-slate-900/50 border-2 ${isDragging ? 'border-indigo-400' : 'border-slate-300 dark:border-slate-700'} border-dashed rounded-md appearance-none cursor-pointer hover:border-indigo-500 focus:outline-none`}
                            >
                                <span className="flex items-center space-x-2">
                                    <UploadCloudIcon className={`w-8 h-8 ${isDragging ? 'text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`} />
                                    <span className="font-medium text-slate-500 dark:text-slate-400">
                                        Drop file or
                                        <span className="text-indigo-500 dark:text-indigo-400 underline ml-1">browse</span>
                                    </span>
                                </span>
                                <input type="file" name="file_upload" className="hidden" accept=".json" onChange={handleFileChange} />
                            </label>
                        </div>
                    </div>
                </div>
            )}

            <div className="mt-12">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 text-center">Available Training Modules</h2>
                <div className="mb-6 max-w-lg mx-auto">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchIcon className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search for a module..."
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
                            <Link key={module.slug} to={`/modules/${module.slug}`} className="block p-6 bg-white dark:bg-slate-800 rounded-xl hover:bg-slate-100/50 dark:hover:bg-slate-700/50 hover:ring-2 hover:ring-indigo-500 transition-all duration-300 transform hover:-translate-y-1 shadow-md dark:shadow-lg relative group">
                                <div className="flex items-center gap-4">
                                    <div className="bg-indigo-100 dark:bg-indigo-600/30 p-3 rounded-lg">
                                        <BookOpenIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-300" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{module.title}</h3>
                                        <p className="text-slate-500 dark:text-slate-400">{module.steps.length} steps</p>
                                    </div>
                                </div>
                                {isAuthenticated && (
                                    <button
                                        onClick={(e) => handleDeleteModule(e, module.slug)}
                                        className="absolute top-4 right-4 p-2 bg-slate-200/50 dark:bg-slate-700/50 rounded-full text-slate-500 dark:text-slate-400 hover:bg-red-500/80 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                                        aria-label="Delete module"
                                    >
                                        <TrashIcon className="h-5 w-5" />
                                    </button>
                                )}
                            </Link>
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