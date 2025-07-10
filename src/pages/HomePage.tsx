
import React, { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getAvailableModules, saveUploadedModule } from '@/data/modules';
import { UploadCloudIcon, BookOpenIcon } from '@/components/Icons';
import type { TrainingModule } from '@/types';

const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const availableModules = getAvailableModules();

    const handleFile = useCallback((file: File) => {
        setError(null);
        if (file.type !== 'application/json') {
            setError('Invalid file type. Please upload a .json file.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') throw new Error("Could not read file.");

                const moduleData = JSON.parse(text) as TrainingModule;

                if (saveUploadedModule(moduleData)) {
                    navigate(`/process/${moduleData.slug}`);
                } else {
                    throw new Error("The provided JSON is not a valid Training Module.");
                }

            } catch (err) {
                console.error(err);
                setError(err instanceof Error ? err.message : 'Failed to parse JSON file.');
            }
        };
        reader.onerror = () => {
             setError('Error reading file.');
        };
        reader.readAsText(file);
    }, [navigate]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) handleFile(file);
    };

    const handleDrop = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
        const file = event.dataTransfer.files?.[0];
        if (file) handleFile(file);
    }, [handleFile]);

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

    return (
        <div className="max-w-4xl mx-auto p-8">
            <header className="text-center mb-12">
                <h1 className="text-5xl font-bold text-white">Adapt Training Platform</h1>
                <p className="mt-4 text-lg text-slate-400">Your interactive AI-powered training assistant.</p>
            </header>

            <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl">
                <h2 className="text-2xl font-bold text-indigo-400 mb-2">Upload a Training Module</h2>
                <p className="text-slate-300 mb-6">Create your own training by uploading a JSON file.</p>
                
                <label
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    className={`flex justify-center w-full h-48 px-4 transition bg-slate-900/50 border-2 ${isDragging ? 'border-indigo-400' : 'border-slate-700'} border-dashed rounded-md appearance-none cursor-pointer hover:border-indigo-500 focus:outline-none`}
                >
                    <span className="flex items-center space-x-2">
                        <UploadCloudIcon className={`w-8 h-8 ${isDragging ? 'text-indigo-400' : 'text-slate-500'}`} />
                        <span className="font-medium text-slate-400">
                            Drop files to attach, or
                            <span className="text-indigo-400 underline ml-1">browse</span>
                        </span>
                    </span>
                    <input type="file" name="file_upload" className="hidden" accept=".json" onChange={handleFileChange} />
                </label>
                {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
            </div>

            <div className="mt-12">
                 <h2 className="text-2xl font-bold text-indigo-400 mb-6 text-center">Or Select an Existing Module</h2>
                 {availableModules.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {availableModules.map(module => (
                            <Link key={module.slug} to={`/process/${module.slug}`} className="block p-6 bg-slate-800 rounded-xl hover:bg-slate-700/50 hover:ring-2 hover:ring-indigo-500 transition-all duration-300 transform hover:-translate-y-1 shadow-lg">
                                <div className="flex items-center gap-4">
                                <div className="bg-indigo-600/30 p-3 rounded-lg">
                                        <BookOpenIcon className="h-6 w-6 text-indigo-300" />
                                </div>
                                <div>
                                        <h3 className="text-xl font-bold text-slate-100">{module.title}</h3>
                                        <p className="text-slate-400">{module.steps.length} steps</p>
                                </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                 ) : (
                    <div className="text-center bg-slate-800 p-8 rounded-lg">
                        <p className="text-slate-400">No training modules found.</p>
                        <p className="text-slate-500 text-sm mt-2">Upload a module JSON file to get started.</p>
                    </div>
                 )}
            </div>
        </div>
    );
};

export default HomePage;