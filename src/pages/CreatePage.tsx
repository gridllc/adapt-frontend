
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
    getTranscriptWithConfidence,
    generateModuleFromContext,
} from '@/services/geminiService';
import type { GeneratedModuleData, TranscriptAnalysis } from '@/services/geminiService';
import { saveModule } from '@/services/moduleService';
import { ModuleEditor } from '@/components/ModuleEditor';
import { TranscriptEditor } from '@/components/TranscriptEditor';
import type { TranscriptLine, VideoMetadata } from '@/types';
import type { Database } from '@/types/supabase';
import { UploadCloudIcon, XIcon, SparklesIcon, VideoIcon, LightbulbIcon, FileTextIcon } from '@/components/Icons';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { VideoPlayer } from '@/components/VideoPlayer';

type ModuleInsert = Database['public']['Tables']['modules']['Insert'];
type FlowStep = 'initial' | 'analyzing' | 'review' | 'generating' | 'final';
type ActiveTab = 'ai' | 'json';


const CreatePage: React.FC = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { isAuthenticated, user } = useAuth();
    const { addToast } = useToast();

    // --- Core state ---
    const [activeTab, setActiveTab] = useState<ActiveTab>('ai');
    const [isDragging, setIsDragging] = useState(false);

    // --- AI Flow State ---
    const [flowStep, setFlowStep] = useState<FlowStep>('initial');
    const [title, setTitle] = useState('');
    const [notes, setNotes] = useState('');
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);
    const [analysisResult, setAnalysisResult] = useState<TranscriptAnalysis | null>(null);
    const [editedTranscript, setEditedTranscript] = useState<TranscriptLine[]>([]);
    const [generatedModule, setGeneratedModule] = useState<ModuleInsert | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // --- Refs and state for video player integration ---
    const videoRef = useRef<HTMLVideoElement>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const videoBlobUrlRef = useRef<string | null>(null);

    useEffect(() => {
        if (!isAuthenticated) navigate('/login');
    }, [isAuthenticated, navigate]);

    // Effect to clean up the blob URL on unmount
    useEffect(() => {
        const urlToClean = videoBlobUrlRef.current;
        return () => {
            if (urlToClean) {
                URL.revokeObjectURL(urlToClean);
            }
        };
    }, []);

    // --- JSON Import Logic ---
    const handleJsonUpload = useCallback(async (file: File) => {
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

                const moduleToSave = { ...moduleData, user_id: user.id };

                const savedModule = await saveModule({ moduleData: moduleToSave });
                await queryClient.invalidateQueries({ queryKey: ['modules'] });
                addToast('success', 'Upload Complete', `Module "${savedModule.title}" was imported.`);
                navigate(`/modules/${savedModule.slug}/edit`);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to parse or save the module file.';
                addToast('error', 'Upload Failed', errorMessage);
            }
        };
        reader.onerror = () => addToast('error', 'Read Error', 'Could not read the selected file.');
        reader.readAsText(file);
    }, [navigate, queryClient, addToast, user]);


    // --- AI Video Processing Logic ---
    const processVideoFile = useCallback((file: File | null | undefined) => {
        if (!file) return;
        if (!file.type.startsWith('video/')) {
            addToast('error', 'Invalid File Type', 'Please upload a video file.');
            return;
        }
        if (videoBlobUrlRef.current) URL.revokeObjectURL(videoBlobUrlRef.current);
        const newUrl = URL.createObjectURL(file);
        videoBlobUrlRef.current = newUrl;
        setVideoUrl(newUrl);
        setVideoFile(file);
        const videoElement = document.createElement('video');
        videoElement.preload = 'metadata';
        videoElement.onloadedmetadata = () => {
            setVideoMetadata({
                originalName: file.name,
                size: file.size,
                duration: Math.round(videoElement.duration),
                width: videoElement.videoWidth,
                height: videoElement.videoHeight,
            });
        };
        videoElement.onerror = () => addToast('error', 'Metadata Error', 'Could not read metadata from the video file.');
        videoElement.src = newUrl;
    }, [addToast]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, forJson: boolean) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (forJson) {
            handleJsonUpload(file);
        } else {
            processVideoFile(file);
        }
    };

    const handleRemoveVideo = useCallback(() => {
        if (videoBlobUrlRef.current) {
            URL.revokeObjectURL(videoBlobUrlRef.current);
            videoBlobUrlRef.current = null;
        }
        setVideoUrl(null);
        setVideoFile(null);
        setVideoMetadata(null);
    }, []);

    const handleDrop = useCallback((event: React.DragEvent<HTMLLabelElement>, forJson: boolean) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
        const file = event.dataTransfer.files?.[0];
        if (!file) return;
        if (forJson) {
            handleJsonUpload(file);
        } else {
            processVideoFile(file);
        }
    }, [processVideoFile, handleJsonUpload]);

    const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => { event.preventDefault(); event.stopPropagation(); };
    const handleDragEnter = (event: React.DragEvent<HTMLLabelElement>) => { event.preventDefault(); event.stopPropagation(); setIsDragging(true); };
    const handleDragLeave = (event: React.DragEvent<HTMLLabelElement>) => { event.preventDefault(); event.stopPropagation(); setIsDragging(false); };

    // Step 1: Analyze Video
    const handleAnalyzeVideo = async () => {
        if (!videoFile || !title.trim()) {
            addToast('error', 'Input Required', 'Please provide a title and a video file.');
            return;
        }
        setFlowStep('analyzing');
        try {
            addToast('info', 'Analyzing Video...', 'AI is transcribing the video. This may take a moment.');
            const result = await getTranscriptWithConfidence(videoFile);
            setAnalysisResult(result);
            setEditedTranscript(result.transcript);
            addToast('success', 'Analysis Complete', `AI confidence: ${(result.confidence * 100).toFixed(0)}%`);
            setFlowStep('review');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            addToast('error', 'Analysis Failed', errorMessage);
            setFlowStep('initial');
        }
    };

    // Step 2: Generate Module
    const handleGenerateModule = async () => {
        if (!analysisResult || !title || !videoFile) return;
        setFlowStep('generating');
        try {
            const transcriptText = editedTranscript.map(line => line.text).join('\n');
            const moduleData = await generateModuleFromContext({ title, transcript: transcriptText, notes, confidence: analysisResult.confidence });
            const timedModuleData: GeneratedModuleData = { ...moduleData, steps: [] };
            timedModuleData.steps = moduleData.steps.map(generatedStep => {
                const bestLine = editedTranscript.find(line => line.text.includes(generatedStep.title) || generatedStep.description.includes(line.text.substring(0, 30)));
                return { ...generatedStep, start: bestLine?.start ?? 0, end: bestLine?.end ?? 0 };
            });
            (timedModuleData as ModuleInsert).transcript = editedTranscript;
            setGeneratedModule(timedModuleData as ModuleInsert);
            setFlowStep('final');
            addToast('success', 'Module Generated', 'Review the final draft and save your training!');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            addToast('error', 'Generation Failed', errorMessage);
            setFlowStep('review');
        }
    };

    // Step 3: Save to DB
    const handleSave = async () => {
        if (!generatedModule || !user) return;
        setIsSaving(true);
        try {
            const moduleToSave: ModuleInsert = {
                ...generatedModule,
                video_url: videoFile ? '' : null,
                metadata: videoFile ? (videoMetadata || undefined) : undefined,
                user_id: user.id,
            };
            const savedModule = await saveModule({ moduleData: moduleToSave, videoFile });
            await queryClient.invalidateQueries({ queryKey: ['module', savedModule.slug] });
            addToast('success', 'Module Saved', `Navigating to new training: "${savedModule.title}"`);
            navigate(`/modules/${savedModule.slug}`);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Could not save the module. Please try again.';
            addToast('error', 'Save Failed', errorMessage);
        } finally {
            setIsSaving(false);
        }
    };

    const resetForm = useCallback(async () => {
        if (videoBlobUrlRef.current) URL.revokeObjectURL(videoBlobUrlRef.current);
        setFlowStep('initial');
        setTitle('');
        setNotes('');
        setVideoFile(null);
        setVideoUrl(null);
        setVideoMetadata(null);
        setAnalysisResult(null);
        setGeneratedModule(null);
        setEditedTranscript([]);
        setIsSaving(false);
    }, []);

    const handleSeek = useCallback((time: number) => {
        if (videoRef.current) {
            videoRef.current.currentTime = time;
            videoRef.current.play().catch(console.error);
        }
    }, []);

    const handleTranscriptChange = useCallback((index: number, newText: string) => {
        const newTranscript = [...editedTranscript];
        newTranscript[index] = { ...newTranscript[index], text: newText };
        setEditedTranscript(newTranscript);
    }, [editedTranscript]);


    const renderAiFlow = () => (
        <>
            {flowStep === 'initial' && (
                <div className="bg-slate-100 dark:bg-slate-800 p-8 rounded-2xl shadow-xl animate-fade-in-up">
                    <div className="max-w-2xl mx-auto">
                        <h2 className="text-2xl font-bold text-indigo-500 dark:text-indigo-400 mb-2 text-center">1. Provide Context</h2>
                        <p className="text-slate-600 dark:text-slate-300 mb-6 text-center">Give your training a title, upload a video, and add any helpful notes for the AI.</p>
                        <div className="space-y-6">
                            <div>
                                <label htmlFor="title" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Process Title</label>
                                <input id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., How to Make a Sandwich" className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Training Video</label>
                                {videoFile && videoUrl ? (
                                    <div>
                                        <div className="bg-slate-200 dark:bg-slate-900/50 p-3 rounded-lg flex items-center justify-between">
                                            <div className="flex items-center gap-3"><VideoIcon className="h-6 w-6 text-indigo-500 dark:text-indigo-400" /><span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{videoFile.name}</span></div>
                                            <button onClick={handleRemoveVideo} className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white" disabled={flowStep !== 'initial'}><XIcon className="h-5 w-5" /></button>
                                        </div>
                                        <div className="mt-4 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700"><VideoPlayer video_url={videoUrl} onTimeUpdate={() => { }} /></div>
                                    </div>
                                ) : (
                                    <label onDrop={(e) => handleDrop(e, false)} onDragOver={handleDragOver} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} className={`flex flex-col items-center justify-center w-full h-40 px-4 transition bg-white dark:bg-slate-900 border-2 ${isDragging ? 'border-indigo-400' : 'border-slate-300 dark:border-slate-700'} border-dashed rounded-md appearance-none cursor-pointer hover:border-indigo-500 focus:outline-none`}>
                                        <UploadCloudIcon className={`w-10 h-10 ${isDragging ? 'text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`} />
                                        <div className="mt-2 text-center"><p className="font-medium text-slate-600 dark:text-slate-300">Tap or click to upload a file</p><p className="text-xs text-slate-500 dark:text-slate-400">You&apos;ll be able to record with your phone or choose from your device.</p></div>
                                        <input type="file" name="file_upload" className="hidden" accept="video/*" onChange={(e) => handleFileChange(e, false)} />
                                    </label>
                                )}
                            </div>
                            <div>
                                <details className="group">
                                    <summary className="list-none flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Additional Notes (Optional)<span className="text-slate-400 group-hover:text-slate-600"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg></span></summary>
                                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g., This training is for absolute beginners. Keep the language simple." className="w-full h-24 p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                </details>
                            </div>
                        </div>
                        <div className="mt-8 text-center"><button onClick={handleAnalyzeVideo} disabled={!videoFile || !title.trim()} className="bg-indigo-600 text-white font-bold py-3 px-8 rounded-lg disabled:bg-slate-400 dark:disabled:bg-slate-500 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors transform hover:scale-105 flex items-center justify-center gap-2 mx-auto"><SparklesIcon className="h-6 w-6" />Analyze Video</button></div>
                    </div>
                </div>
            )}
            {flowStep === 'analyzing' && <div className="text-center p-8 animate-fade-in-up"><LightbulbIcon className="h-12 w-12 mx-auto text-indigo-500 dark:text-indigo-400 animate-pulse" /><p className="mt-4 text-lg text-slate-600 dark:text-slate-300">AI is analyzing your video...</p></div>}

            {flowStep === 'review' && analysisResult && videoUrl && (
                <div className="animate-fade-in-up">
                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold text-indigo-500 dark:text-indigo-400 mb-2">2. Review & Edit Transcript</h2>
                        <p className="text-slate-600 dark:text-slate-300">Correct any mistakes in the AI-generated transcript. The accuracy of the next step depends on it.</p>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left Column: Video & Metadata */}
                        <div className="lg:col-span-1 lg:sticky top-6 space-y-4">
                            <VideoPlayer ref={videoRef} video_url={videoUrl} onTimeUpdate={setCurrentTime} />
                            <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                                <h3 className="font-bold mb-2 text-slate-800 dark:text-slate-100">Analysis Details</h3>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-600 dark:text-slate-300">AI Confidence</span>
                                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{(analysisResult.confidence * 100).toFixed(0)}%</span>
                                </div>
                                {analysisResult.uncertainWords.length > 0 && (
                                    <div className="mt-3">
                                        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Uncertain Words</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {analysisResult.uncertainWords.map((word, i) => (
                                                <span key={i} className="bg-yellow-200 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300 text-xs font-mono px-2 py-1 rounded">{word}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Column: Transcript Editor */}
                        <div className="lg:col-span-2 bg-slate-100 dark:bg-slate-800 p-4 rounded-lg h-[70vh]">
                            <TranscriptEditor
                                transcript={editedTranscript}
                                currentTime={currentTime}
                                onSeek={handleSeek}
                                onTranscriptChange={handleTranscriptChange}
                            />
                        </div>
                    </div>

                    <div className="mt-8 flex justify-center gap-4">
                        <button onClick={resetForm} className="bg-slate-500 dark:bg-slate-600 hover:bg-slate-600 dark:hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-lg transition-colors">Start Over</button>
                        <button onClick={handleGenerateModule} className="bg-indigo-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-indigo-700 transition-colors transform hover:scale-105 flex items-center justify-center gap-2">
                            <SparklesIcon className="h-6 w-6" />
                            Generate Module Steps
                        </button>
                    </div>
                </div>
            )}

            {flowStep === 'generating' && <div className="text-center p-8 animate-fade-in-up"><LightbulbIcon className="h-12 w-12 mx-auto text-indigo-500 dark:text-indigo-400 animate-pulse" /><p className="mt-4 text-lg text-slate-600 dark:text-slate-300">AI is building your training module...</p></div>}

            {flowStep === 'final' && (
                <div className="animate-fade-in-up">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                        <div className="lg:sticky top-6">
                            <h2 className="text-2xl font-bold text-indigo-500 dark:text-indigo-400 mb-4">3. Video Preview</h2>
                            {videoUrl && <VideoPlayer ref={videoRef} video_url={videoUrl} onTimeUpdate={setCurrentTime} />}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-indigo-500 dark:text-indigo-400 mb-4">4. Refine Final Draft</h2>
                            {generatedModule && <ModuleEditor module={generatedModule} onModuleChange={setGeneratedModule} isAdmin={true} currentTime={currentTime} onSeek={handleSeek} />}
                        </div>
                    </div>
                    <div className="mt-8 flex justify-center gap-4">
                        <button onClick={resetForm} className="bg-slate-500 dark:bg-slate-600 hover:bg-slate-600 dark:hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-lg transition-colors" disabled={isSaving}>Start Over</button>
                        <button onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:bg-slate-500" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save and Start Training'}</button>
                    </div>
                </div>
            )}
        </>
    );

    const renderJsonImport = () => (
        <div className="bg-slate-100 dark:bg-slate-800 p-8 rounded-2xl shadow-xl animate-fade-in-up max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-indigo-500 dark:text-indigo-400 mb-2 text-center">Import from JSON</h2>
            <p className="text-slate-600 dark:text-slate-300 mb-6 text-center">Upload a previously exported `.json` module file to add it to the platform.</p>
            <label onDrop={(e) => handleDrop(e, true)} onDragOver={handleDragOver} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} className={`flex flex-col items-center justify-center w-full h-48 px-4 transition bg-white dark:bg-slate-900 border-2 ${isDragging ? 'border-indigo-400' : 'border-slate-300 dark:border-slate-700'} border-dashed rounded-md appearance-none cursor-pointer hover:border-indigo-500 focus:outline-none`}>
                <UploadCloudIcon className={`w-12 h-12 ${isDragging ? 'text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`} />
                <div className="mt-2 text-center"><p className="font-medium text-slate-600 dark:text-slate-300">Drop a .json file here, or click to upload</p></div>
                <input type="file" name="json_upload" className="hidden" accept="application/json" onChange={(e) => handleFileChange(e, true)} />
            </label>
        </div>
    );

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white text-center">Create Module</h1>
                <span className="w-40 text-right">
                    {activeTab === 'ai' && flowStep !== 'initial' && <button onClick={resetForm} className="text-sm text-slate-500 hover:text-red-500">Start Over</button>}
                </span>
            </div>

            <div className="mb-6 flex justify-center border-b border-slate-300 dark:border-slate-700">
                <button onClick={() => setActiveTab('ai')} className={`px-4 py-2 text-sm font-semibold flex items-center gap-2 ${activeTab === 'ai' ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                    <SparklesIcon className="h-5 w-5" /> Create with AI
                </button>
                <button onClick={() => setActiveTab('json')} className={`px-4 py-2 text-sm font-semibold flex items-center gap-2 ${activeTab === 'json' ? 'border-b-2 border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                    <FileTextIcon className="h-5 w-5" /> Import from JSON
                </button>
            </div>

            {activeTab === 'ai' ? renderAiFlow() : renderJsonImport()}
        </div>
    );
};

export default CreatePage;
