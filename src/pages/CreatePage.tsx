

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
    uploadVideo,
    getTranscriptWithConfidence,
    generateModuleFromContext,
    deleteUploadedVideo
} from '@/services/geminiService';
import type { GeneratedModuleData, TranscriptAnalysis } from '@/services/geminiService';
import { saveModule } from '@/services/moduleService';
import { ModuleEditor } from '@/components/ModuleEditor';
import type { TranscriptLine, VideoMetadata } from '@/types';
import type { Database } from '@/types/supabase';
import { BookOpenIcon, UploadCloudIcon, XIcon, SparklesIcon, VideoIcon, LightbulbIcon, CheckCircleIcon } from '@/components/Icons';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import type { File as AiFile } from '@google/genai';
import { VideoPlayer } from '@/components/VideoPlayer';

type ModuleInsert = Database['public']['Tables']['modules']['Insert'];
type FlowStep = 'initial' | 'analyzing' | 'review' | 'generating' | 'final';

interface ConfidenceTranscriptEditorProps {
    transcriptLines: TranscriptLine[];
    uncertainWords: string[];
    originalTranscript: TranscriptLine[];
    onUpdate: (newTranscript: TranscriptLine[]) => void;
    onRevert: () => void;
}

// A new, more capable transcript editor component
const ConfidenceTranscriptEditor: React.FC<ConfidenceTranscriptEditorProps> = ({
    transcriptLines,
    uncertainWords,
    originalTranscript,
    onUpdate,
    onRevert
}) => {
    const uncertainSet = new Set(uncertainWords.map(w => w.toLowerCase()));
    const isChanged = JSON.stringify(transcriptLines) !== JSON.stringify(originalTranscript);

    const handleLineChange = (index: number, newText: string) => {
        const newLines = [...transcriptLines];
        newLines[index] = { ...newLines[index], text: newText };
        onUpdate(newLines);
    };

    const highlightUncertain = (text: string) => {
        const words = text.split(/(\s+)/); // Split by space, keeping spaces
        return words.map((word, i) => {
            const cleanWord = word.replace(/[.,!?]/g, '').toLowerCase();
            if (uncertainSet.has(cleanWord)) {
                return <mark key={i} className="bg-yellow-300/70 dark:bg-yellow-600/70 rounded px-1 py-0.5">{word}</mark>;
            }
            return <span key={i}>{word}</span>;
        });
    };

    return (
        <div>
            <div className="flex justify-end mb-2">
                <button
                    onClick={onRevert}
                    disabled={!isChanged}
                    className="text-xs font-semibold text-slate-500 hover:text-indigo-600 disabled:text-slate-400 disabled:hover:text-slate-400 disabled:cursor-not-allowed transition-colors"
                >
                    Revert All Changes
                </button>
            </div>
            <div className="space-y-3 p-3 bg-slate-200/50 dark:bg-slate-900/50 rounded-lg border border-slate-300 dark:border-slate-700 max-h-[50vh] overflow-y-auto">
                {transcriptLines.map((line, index) => (
                    <div key={index} className="flex items-start gap-3">
                        <span className="font-mono text-xs text-indigo-500 dark:text-indigo-300 pt-1.5 whitespace-nowrap">
                            [{new Date(line.start * 1000).toISOString().substr(14, 5)}]
                        </span>
                        <div className="w-full text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700/50 p-2 rounded-md border border-slate-300 dark:border-slate-600 focus-within:ring-2 focus-within:ring-indigo-500">
                            <p className="whitespace-pre-wrap">{highlightUncertain(line.text)}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


const CreatePage: React.FC = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { isAuthenticated, user } = useAuth();
    const { addToast } = useToast();

    // State for the new multi-step flow
    const [flowStep, setFlowStep] = useState<FlowStep>('initial');
    const [title, setTitle] = useState('');
    const [notes, setNotes] = useState('');
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // State for data from AI
    const [uploadedAiFile, setUploadedAiFile] = useState<AiFile | null>(null);
    const [analysisResult, setAnalysisResult] = useState<TranscriptAnalysis | null>(null);
    const [editedTranscript, setEditedTranscript] = useState<TranscriptLine[]>([]);
    const [generatedModule, setGeneratedModule] = useState<ModuleInsert | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Use a ref to hold the blob URL to prevent re-renders
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

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            // Revoke the old URL if it exists to prevent memory leaks
            if (videoBlobUrlRef.current) {
                URL.revokeObjectURL(videoBlobUrlRef.current);
            }

            const newUrl = URL.createObjectURL(file);
            videoBlobUrlRef.current = newUrl;
            setVideoUrl(newUrl); // Update state to trigger re-render with the preview
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
            videoElement.onerror = () => {
                addToast('error', 'Metadata Error', 'Could not read metadata from the video file.');
            };
            videoElement.src = newUrl;
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

    const handleDrop = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
        const file = event.dataTransfer.files?.[0];
        if (file && file.type.startsWith('video/')) {
            handleFileChange({ target: { files: [file] } } as any);
        } else if (file) {
            addToast('error', 'Invalid File Type', 'Please upload a video file.');
        }
    }, [addToast]);

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
        let tempUploadedFile: AiFile | null = null;
        try {
            addToast('info', 'Uploading Video...', 'Please wait while the video is prepared for analysis.');
            tempUploadedFile = await uploadVideo(videoFile);
            setUploadedAiFile(tempUploadedFile);

            addToast('info', 'Analyzing Audio...', 'AI is transcribing the video. This may take a moment.');
            const result = await getTranscriptWithConfidence(tempUploadedFile);
            setAnalysisResult(result);
            setEditedTranscript(result.transcript);

            addToast('success', 'Analysis Complete', `AI confidence: ${(result.confidence * 100).toFixed(0)}%`);
            setFlowStep('review');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            addToast('error', 'Analysis Failed', errorMessage);
            if (tempUploadedFile) {
                await deleteUploadedVideo(tempUploadedFile);
                setUploadedAiFile(null);
            }
            setFlowStep('initial');
        }
    };

    // Step 2: Generate Module
    const handleGenerateModule = async () => {
        if (!analysisResult || !title || !videoFile) return;
        setFlowStep('generating');
        try {
            const transcriptText = editedTranscript.map(line => line.text).join('\n');
            const moduleData = await generateModuleFromContext({
                title,
                transcript: transcriptText,
                notes,
                confidence: analysisResult.confidence
            });

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

            if (uploadedAiFile) {
                await deleteUploadedVideo(uploadedAiFile);
                setUploadedAiFile(null);
            }

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
        if (uploadedAiFile) {
            await deleteUploadedVideo(uploadedAiFile);
        }
        if (videoBlobUrlRef.current) {
            URL.revokeObjectURL(videoBlobUrlRef.current);
            videoBlobUrlRef.current = null;
        }
        setFlowStep('initial');
        setTitle('');
        setNotes('');
        setVideoFile(null);
        setVideoUrl(null);
        setVideoMetadata(null);
        setUploadedAiFile(null);
        setAnalysisResult(null);
        setGeneratedModule(null);
        setEditedTranscript([]);
        setIsSaving(false);
    }, [uploadedAiFile]);

    const handleRevertTranscript = useCallback(() => {
        if (analysisResult) {
            setEditedTranscript(analysisResult.transcript);
            addToast('info', 'Transcript Reverted', 'All changes to the transcript have been undone.');
        }
    }, [analysisResult, addToast]);


    const renderInitialStep = () => (
        <div className="bg-slate-100 dark:bg-slate-800 p-8 rounded-2xl shadow-xl animate-fade-in-up">
            <div className="max-w-2xl mx-auto">
                <h2 className="text-2xl font-bold text-indigo-500 dark:text-indigo-400 mb-2 text-center">1. Provide Context</h2>
                <p className="text-slate-600 dark:text-slate-300 mb-6 text-center">Give your training a title, upload a video, and add any helpful notes for the AI.</p>

                <div className="space-y-6">
                    <div>
                        <label htmlFor="title" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Process Title</label>
                        <input
                            id="title"
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g., How to Make a Sandwich"
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Training Video</label>
                        {videoFile && videoUrl ? (
                            <div>
                                <div className="bg-slate-200 dark:bg-slate-900/50 p-3 rounded-lg flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <VideoIcon className="h-6 w-6 text-indigo-500 dark:text-indigo-400" />
                                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{videoFile.name}</span>
                                    </div>
                                    <button onClick={handleRemoveVideo} className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white" disabled={flowStep !== 'initial'}>
                                        <XIcon className="h-5 w-5" />
                                    </button>
                                </div>
                                <div className="mt-4 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700">
                                    <VideoPlayer video_url={videoUrl} onTimeUpdate={() => { }} />
                                </div>
                            </div>
                        ) : (
                            <label onDrop={handleDrop} onDragOver={handleDragOver} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} className={`flex flex-col items-center justify-center w-full h-40 px-4 transition bg-white dark:bg-slate-900 border-2 ${isDragging ? 'border-indigo-400' : 'border-slate-300 dark:border-slate-700'} border-dashed rounded-md appearance-none cursor-pointer hover:border-indigo-500 focus:outline-none`}>
                                <UploadCloudIcon className={`w-10 h-10 ${isDragging ? 'text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`} />
                                <div className="mt-2 text-center">
                                    <p className="font-medium text-slate-600 dark:text-slate-300">Tap or click to upload a file</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">You'll be able to record with your phone or choose from your device.</p>
                                </div>
                                <input type="file" name="file_upload" className="hidden" accept="video/*" onChange={handleFileChange} />
                            </label>
                        )}
                    </div>
                    <div>
                        <details className="group">
                            <summary className="list-none flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Additional Notes (Optional)
                                <span className="text-slate-400 group-hover:text-slate-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                </span>
                            </summary>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="e.g., This training is for absolute beginners. Keep the language simple. Make sure to emphasize safety."
                                className="w-full h-24 p-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </details>
                    </div>
                </div>
                <div className="mt-8 text-center">
                    <button onClick={handleAnalyzeVideo} disabled={!videoFile || !title.trim()} className="bg-indigo-600 text-white font-bold py-3 px-8 rounded-lg disabled:bg-slate-400 dark:disabled:bg-slate-500 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors transform hover:scale-105 flex items-center justify-center gap-2 mx-auto">
                        <SparklesIcon className="h-6 w-6" />
                        Analyze Video
                    </button>
                </div>
            </div>
        </div>
    );

    const renderLoadingStep = (message: string) => (
        <div className="text-center p-8 animate-fade-in-up">
            <LightbulbIcon className="h-12 w-12 mx-auto text-indigo-500 dark:text-indigo-400 animate-pulse" />
            <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">{message}</p>
        </div>
    );

    const renderReviewStep = () => {
        if (!analysisResult) return null;

        const confidence = analysisResult.confidence;
        const confidenceText = `AI Confidence: ${(confidence * 100).toFixed(0)}%`;
        let confidenceColor = 'text-green-600 dark:text-green-400';
        if (confidence < 0.85) confidenceColor = 'text-yellow-600 dark:text-yellow-400';
        if (confidence < 0.6) confidenceColor = 'text-red-600 dark:text-red-400';

        const showEditor = confidence < 0.85;
        const editorInitiallyOpen = confidence < 0.6;

        return (
            <div className="bg-slate-100 dark:bg-slate-800 p-8 rounded-2xl shadow-xl animate-fade-in-up">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-6">
                        <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400 font-semibold mb-2">
                            <CheckCircleIcon className="h-6 w-6" />
                            <span>Analysis Complete</span>
                        </div>
                        <h2 className="text-2xl font-bold text-indigo-500 dark:text-indigo-400">2. Review Transcript</h2>
                        <p className={`font-semibold ${confidenceColor}`}>{confidenceText}</p>
                        <p className="text-slate-600 dark:text-slate-300 mt-1">
                            {showEditor ? "We've highlighted words the AI was unsure about. Please review and correct the transcript for best results." : "The transcript quality is high. You can generate steps directly or review it first."}
                        </p>
                    </div>

                    {showEditor ? (
                        <details open={editorInitiallyOpen} className="group">
                            <summary className="list-none flex items-center justify-center gap-2 cursor-pointer text-sm font-medium text-indigo-600 dark:text-indigo-400 mb-2 hover:underline">
                                {editorInitiallyOpen ? "Hide Transcript Editor" : "Show Transcript Editor"}
                                <span className="text-slate-400 group-hover:text-slate-600 transition-transform group-open:rotate-180">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                </span>
                            </summary>
                            <ConfidenceTranscriptEditor
                                transcriptLines={editedTranscript}
                                uncertainWords={analysisResult.uncertainWords}
                                originalTranscript={analysisResult.transcript}
                                onUpdate={setEditedTranscript}
                                onRevert={handleRevertTranscript}
                            />
                        </details>
                    ) : null}

                    <div className="mt-8 text-center">
                        <button onClick={handleGenerateModule} className="bg-indigo-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-indigo-700 transition-colors transform hover:scale-105 flex items-center justify-center gap-2 mx-auto">
                            <CheckCircleIcon className="h-6 w-6" />
                            Generate Steps
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderFinalStep = () => (
        <div className="animate-fade-in-up">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <div className="lg:sticky top-6">
                    <h2 className="text-2xl font-bold text-indigo-500 dark:text-indigo-400 mb-4">3. Video Preview</h2>
                    {videoUrl && <VideoPlayer video_url={videoUrl} onTimeUpdate={() => { }} />}
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-indigo-500 dark:text-indigo-400 mb-4">4. Refine Final Draft</h2>
                    {generatedModule && <ModuleEditor module={generatedModule} onModuleChange={setGeneratedModule} />}
                </div>
            </div>
            <div className="mt-8 flex justify-center gap-4">
                <button onClick={resetForm} className="bg-slate-500 dark:bg-slate-600 hover:bg-slate-600 dark:hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-lg transition-colors" disabled={isSaving}>
                    Start Over
                </button>
                <button onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:bg-slate-500" disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save and Start Training'}
                </button>
            </div>
        </div>
    );

    const renderContent = () => {
        switch (flowStep) {
            case 'initial':
                return renderInitialStep();
            case 'analyzing':
                return renderLoadingStep('AI is analyzing your video...');
            case 'review':
                return renderReviewStep();
            case 'generating':
                return renderLoadingStep('AI is building your training module...');
            case 'final':
                return renderFinalStep();
            default:
                return null;
        }
    }

    return (
        <div className="max-w-7xl mx-auto p-6">
            <header className="flex justify-between items-center mb-6">
                <button onClick={() => navigate('/')} className="text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-2">
                    <BookOpenIcon className="h-5 w-5" />
                    <span>Back to Home</span>
                </button>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white text-center">Create with AI</h1>
                <span className="w-40 text-right">
                    {flowStep !== 'initial' && <button onClick={resetForm} className="text-sm text-slate-500 hover:text-red-500">Start Over</button>}
                </span>
            </header>

            {renderContent()}
        </div>
    );
};

export default CreatePage;