
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createModuleFromText, analyzeVideoContent } from '@/services/geminiService';
import { saveUploadedModule } from '@/services/moduleService';
import { ModuleEditor } from '@/components/ModuleEditor';
import type { TrainingModule } from '@/types';
import { BookOpenIcon, LightbulbIcon, UploadCloudIcon, FileTextIcon, XIcon } from '@/components/Icons';
import { useAuth } from '@/hooks/useAuth';

const CreatePage: React.FC = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const [processText, setProcessText] = useState('');
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [videoBlobUrl, setVideoBlobUrl] = useState('');
    const [generatedModule, setGeneratedModule] = useState<TrainingModule | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Redundancy check, main protection is at the router level
        if (!isAuthenticated) {
            navigate('/login');
        }
    }, [isAuthenticated, navigate]);

    useEffect(() => {
        if (videoFile) {
            const objectUrl = URL.createObjectURL(videoFile);
            setVideoBlobUrl(objectUrl);
            return () => URL.revokeObjectURL(objectUrl);
        }
        setVideoBlobUrl('');
    }, [videoFile]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setVideoFile(file);
        }
    };

    const handleGenerate = async () => {
        if (!processText.trim()) {
            setError('Please provide a description of the process.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setGeneratedModule(null);

        try {
            const moduleData = await createModuleFromText(processText);
            if (videoBlobUrl) {
                moduleData.videoUrl = videoBlobUrl;
            }
            setGeneratedModule(moduleData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAnalyzeVideo = async () => {
        if (!generatedModule || !videoFile) return;

        setIsAnalyzing(true);
        setError(null);
        try {
            const { timestamps, transcript } = await analyzeVideoContent(videoFile, generatedModule.steps);

            const updatedSteps = generatedModule.steps.map((step, index) => ({
                ...step,
                start: Math.round(timestamps[index]?.start ?? step.start),
                end: Math.round(timestamps[index]?.end ?? step.end),
            }));

            setGeneratedModule({ ...generatedModule, steps: updatedSteps, transcript });

        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred during video analysis.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSave = async () => {
        if (!generatedModule) return;
        setIsSaving(true);
        setError(null);
        try {
            const savedModule = await saveUploadedModule(generatedModule);
            navigate(`/modules/${savedModule.slug}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not save the module. Please try again.');
            setIsSaving(false);
        }
    };

    const resetForm = () => {
        setProcessText('');
        setVideoFile(null);
        setGeneratedModule(null);
        setError(null);
        setIsLoading(false);
        setIsAnalyzing(false);
        setIsSaving(false);
    }

    return (
        <div className="max-w-7xl mx-auto p-6">
            <header className="flex justify-between items-center mb-6">
                <button onClick={() => navigate('/')} className="text-slate-300 hover:text-indigo-400 transition-colors flex items-center gap-2">
                    <BookOpenIcon className="h-5 w-5" />
                    <span>Back to Home</span>
                </button>
                <h1 className="text-3xl font-bold text-white text-center">Create with AI</h1>
                <span className="w-24"></span>
            </header>

            {!generatedModule && (
                <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl animate-fade-in-up">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h2 className="text-xl font-bold text-indigo-400 mb-2">1. Describe the Process</h2>
                            <p className="text-slate-300 mb-4">Write or paste a step-by-step description of the task you want to teach. The more detail, the better the AI will understand.</p>
                            <textarea
                                value={processText}
                                onChange={(e) => setProcessText(e.target.value)}
                                placeholder="e.g., 'First, get two slices of bread. Second, spread butter on one side of each slice. Then, place cheese between the slices...'"
                                className="w-full h-48 bg-slate-900 border border-slate-600 rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white"
                                disabled={isLoading}
                            />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-indigo-400 mb-2">2. (Optional) Add a Video</h2>
                            <p className="text-slate-300 mb-4">Upload a video for this training. The AI can analyze it to set timestamps automatically later.</p>
                            {videoFile ? (
                                <div className="bg-slate-900/50 p-3 rounded-lg flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <FileTextIcon className="h-6 w-6 text-indigo-400" />
                                        <span className="text-sm font-medium text-slate-200 truncate">{videoFile.name}</span>
                                    </div>
                                    <button onClick={() => setVideoFile(null)} className="p-1 text-slate-400 hover:text-white">
                                        <XIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            ) : (
                                <label className="flex flex-col items-center justify-center w-full h-32 px-4 transition bg-slate-900/50 border-2 border-slate-700 border-dashed rounded-md appearance-none cursor-pointer hover:border-indigo-500 focus:outline-none">
                                    <UploadCloudIcon className="w-8 h-8 text-slate-500" />
                                    <span className="mt-2 font-medium text-slate-400">
                                        Drop video file or <span className="text-indigo-400 underline">browse</span>
                                    </span>
                                    <input type="file" name="file_upload" className="hidden" accept="video/*" onChange={handleFileChange} />
                                </label>
                            )}
                        </div>
                    </div>
                    <div className="mt-8 text-center">
                        <button
                            onClick={handleGenerate}
                            disabled={isLoading}
                            className="bg-indigo-600 text-white font-bold py-3 px-8 rounded-lg disabled:bg-slate-500 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors transform hover:scale-105"
                        >
                            {isLoading ? 'Generating...' : 'Generate Training'}
                        </button>
                        {error && <p className="mt-4 text-red-500">{error}</p>}
                    </div>
                </div>
            )}
            {isLoading && !generatedModule && (
                <div className="text-center p-8">
                    <LightbulbIcon className="h-12 w-12 mx-auto text-indigo-400 animate-pulse" />
                    <p className="mt-4 text-lg text-slate-300">AI is building your module...</p>
                    <p className="text-slate-400">This might take a moment.</p>
                </div>
            )}

            {generatedModule && (
                <div className="animate-fade-in-up">
                    <ModuleEditor
                        module={generatedModule}
                        onModuleChange={setGeneratedModule}
                        onAnalyze={handleAnalyzeVideo}
                        isAnalyzing={isAnalyzing}
                        showAnalysisButton={!!videoFile}
                    />
                    {error && <p className="mt-4 text-red-500 text-center">{error}</p>}
                    <div className="mt-8 flex justify-center gap-4">
                        <button onClick={resetForm} className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-lg transition-colors" disabled={isSaving}>
                            Start Over
                        </button>
                        <button onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:bg-slate-500" disabled={isSaving}>
                            {isSaving ? 'Saving...' : 'Save and Start Training'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CreatePage;
