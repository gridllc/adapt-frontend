

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getModule, saveModule, deleteModule } from '@/services/moduleService';
import { getTraineeSuggestionsForModule, deleteTraineeSuggestion, getAiSuggestionsForModule } from '@/services/suggestionsService';
import { getCheckpointResponsesForModule } from '@/services/checkpointService';
import { supabase } from '@/services/apiClient';
import { ModuleEditor } from '@/components/ModuleEditor';
import { VideoPlayer } from '@/components/VideoPlayer';
import type { AlternativeMethod, TraineeSuggestion, ProcessStep, AiSuggestion } from '@/types';
import type { Database } from '@/types/supabase';
import { TrashIcon, VideoIcon, AlertTriangleIcon, RefreshCwIcon, SparklesIcon } from '@/components/Icons';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useSafeVideoUrl } from '@/hooks/useSafeVideoUrl';

type ModuleRow = Database['public']['Tables']['modules']['Row'];
type CheckpointResponseRow = Database['public']['Tables']['checkpoint_responses']['Row'];


const EditPage: React.FC = () => {
    const { moduleId } = useParams<{ moduleId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const { isAuthenticated, user } = useAuth();
    const { addToast } = useToast();
    const [module, setModule] = useState<ModuleRow | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const isAdmin = !!user;
    const [initialFocusStepIndex, setInitialFocusStepIndex] = useState<number | undefined>();

    // --- Refs and state for video player integration ---
    const videoRef = useRef<HTMLVideoElement>(null);
    const [currentTime, setCurrentTime] = useState(0);

    const {
        data: initialModuleData,
        isLoading,
        isError: isModuleError,
        error: queryError
    } = useQuery<ModuleRow | undefined>({
        queryKey: ['module', moduleId],
        queryFn: () => getModule(moduleId!),
        enabled: !!moduleId,
        staleTime: 1000 * 60 * 5, // 5 minutes,
        retry: false, // Don't retry on not found
    });

    const videoPath = useMemo(() => {
        if (!initialModuleData?.video_url) return null;
        try {
            const url = new URL(initialModuleData.video_url);
            const BUCKET_NAME = 'training-videos';
            const pathParts = url.pathname.split(`/${BUCKET_NAME}/`);
            return pathParts[1] || null;
        } catch (e) {
            console.error("Could not parse video URL to get path:", initialModuleData.video_url);
            return null;
        }
    }, [initialModuleData?.video_url]);

    const {
        videoUrl: publicVideoUrl,
        isLoading: isLoadingVideo,
        isError: isVideoError,
        retry: retryVideoUrl,
    } = useSafeVideoUrl(videoPath);


    const { data: traineeSuggestions = [] } = useQuery<TraineeSuggestion[]>({
        queryKey: ['traineeSuggestions', moduleId],
        queryFn: () => getTraineeSuggestionsForModule(moduleId!),
        enabled: !!moduleId && isAdmin,
    });

    const { data: aiSuggestions = [] } = useQuery<AiSuggestion[]>({
        queryKey: ['aiSuggestions', moduleId],
        queryFn: () => getAiSuggestionsForModule(moduleId!),
        enabled: !!moduleId && isAdmin,
    });

    const { data: checkpointResponses = [] } = useQuery<CheckpointResponseRow[], Error>({
        queryKey: ['checkpointResponses', moduleId],
        queryFn: () => getCheckpointResponsesForModule(moduleId!),
        enabled: !!moduleId && isAdmin,
    });

    // Real-time subscription for new suggestions
    useEffect(() => {
        if (!moduleId) return;

        const traineeChannel = supabase
            .channel(`suggestions-for-${moduleId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'suggestions', filter: `module_id=eq.${moduleId}` },
                (payload) => {
                    console.log('New trainee suggestion received!', payload);
                    queryClient.invalidateQueries({ queryKey: ['traineeSuggestions', moduleId] });
                    addToast('info', 'New Trainee Suggestion', 'A trainee has submitted a new suggestion for this module.');
                }
            ).subscribe();

        const aiChannel = supabase
            .channel(`ai-suggestions-for-${moduleId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'suggested_fixes', filter: `module_id=eq.${moduleId}` },
                (payload) => {
                    console.log('New AI suggestion received!', payload);
                    queryClient.invalidateQueries({ queryKey: ['aiSuggestions', moduleId] });
                    addToast('info', 'AI Suggestion Updated', 'A new AI-generated suggestion is available for this module.');
                }
            ).subscribe();

        return () => {
            supabase.removeChannel(traineeChannel);
            supabase.removeChannel(aiChannel);
        };
    }, [moduleId, queryClient, addToast]);

    const pendingTraineeSuggestions = useMemo(() => {
        return traineeSuggestions.filter((s: TraineeSuggestion) => s.status === 'pending');
    }, [traineeSuggestions]);

    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login');
        }
    }, [isAuthenticated, navigate]);

    // This single effect handles both initial load and applying suggestions from navigation state.
    useEffect(() => {
        if (initialModuleData) {
            const moduleToEdit = { ...initialModuleData }; // Make a mutable copy
            const navigationState = location.state as { suggestion?: string; stepIndex?: number } | null;

            if (navigationState?.suggestion && typeof navigationState.stepIndex === 'number') {
                const { suggestion, stepIndex } = navigationState;
                const steps = (moduleToEdit.steps as ProcessStep[]) ?? [];

                if (steps && steps[stepIndex]) {
                    steps[stepIndex] = { ...steps[stepIndex], description: suggestion };
                    moduleToEdit.steps = steps;
                    setInitialFocusStepIndex(stepIndex);

                    addToast('info', 'Suggestion Applied', `AI fix pre-filled for Step ${stepIndex + 1}. Review and save changes.`);

                    // Clear location state to prevent re-application on refresh/re-render
                    navigate(location.pathname, { replace: true, state: {} });
                }
            }

            setModule(moduleToEdit);
        }
    }, [initialModuleData, location.state, location.pathname, navigate, addToast]);


    useEffect(() => {
        if (!isLoading && (isModuleError || !initialModuleData)) {
            console.error(`Failed to load module for editing: ${moduleId}`, queryError);
            navigate('/not-found');
        }
    }, [isLoading, isModuleError, initialModuleData, moduleId, navigate, queryError]);

    // --- Callback to seek video from ModuleEditor ---
    const handleSeek = useCallback((time: number) => {
        if (videoRef.current) {
            videoRef.current.currentTime = time;
            if (videoRef.current.paused) {
                videoRef.current.play().catch(console.error);
            }
        }
    }, []);

    const handleSuggestionAccept = async (suggestion: TraineeSuggestion) => {
        if (!module) return;

        const newSteps = [...((module.steps as ProcessStep[]) ?? [])];
        const stepToUpdate = newSteps[suggestion.stepIndex];

        if (stepToUpdate) {
            const newAlternativeMethod: AlternativeMethod = {
                title: "Trainee-Suggested Improvement",
                description: suggestion.text || ''
            };
            stepToUpdate.alternativeMethods.push(newAlternativeMethod);

            setModule({ ...module, steps: newSteps });
        }

        await deleteTraineeSuggestion(suggestion.id.toString());
        queryClient.invalidateQueries({ queryKey: ['traineeSuggestions', moduleId] });
        addToast('success', 'Suggestion Accepted', 'The new method has been added to the step.');
    };

    const handleSuggestionReject = async (suggestionId: string) => {
        await deleteTraineeSuggestion(suggestionId);
        queryClient.invalidateQueries({ queryKey: ['traineeSuggestions', moduleId] });
        addToast('info', 'Suggestion Rejected', 'The suggestion has been removed.');
    };

    const handleSave = async () => {
        if (!module) return;
        if (!user) {
            addToast('error', 'Authentication Error', 'Cannot save module without a logged-in user.');
            setIsSaving(false);
            return;
        }
        setIsSaving(true);

        try {
            const savedModule = await saveModule({ moduleData: module });
            await queryClient.invalidateQueries({ queryKey: ['module', savedModule.slug] });
            await queryClient.invalidateQueries({ queryKey: ['modules'] });
            addToast('success', 'Changes Saved', 'The module has been updated successfully.');
            navigate(`/modules/${savedModule.slug}`);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Could not save the module. Please try again.';
            addToast('error', 'Save Failed', errorMessage);
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!module) return;

        const confirmation = window.confirm(
            'Are you sure you want to delete this module? This will also remove ALL associated training progress and chat histories. This action cannot be undone.'
        );

        if (confirmation) {
            setIsDeleting(true);
            try {
                await deleteModule(module.slug);
                await queryClient.invalidateQueries({ queryKey: ['module', module.slug] });
                await queryClient.invalidateQueries({ queryKey: ['modules'] });
                addToast('success', 'Module Deleted', 'The module and all its data have been removed.');
                navigate('/');
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Could not delete the module.';
                addToast('error', 'Delete Failed', errorMessage);
                setIsDeleting(false);
            }
        }
    }

    const handleModuleDataChange = useCallback((updatedModuleData: ModuleRow) => {
        setModule(prev => ({
            ...(prev || {} as ModuleRow), // Ensure prev is not null
            ...updatedModuleData
        }));
    }, []);

    if (isLoading || !module) {
        return <div className="text-center p-8 text-slate-500 dark:text-slate-400">Loading editor...</div>;
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white text-center">Edit: {module.title}</h1>
                <Link to={`/modules/${module.slug}`} className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white font-semibold py-2 px-4 rounded-lg transition-colors">
                    Back to Training
                </Link>
            </div>


            <div className="animate-fade-in-up">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    <div className="lg:sticky top-6">
                        <h2 className="text-xl font-bold text-indigo-500 dark:text-indigo-400 mb-4">Video Preview</h2>
                        {isLoadingVideo ? (
                            <div className="w-full aspect-video flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 rounded-lg p-4">
                                <SparklesIcon className="h-12 w-12 text-indigo-400 animate-pulse" />
                                <p className="mt-4 text-slate-500">Verifying video...</p>
                            </div>
                        ) : isVideoError ? (
                            <div className="w-full aspect-video flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 rounded-lg p-4">
                                <AlertTriangleIcon className="h-12 w-12 text-red-500 mb-4" />
                                <p className="text-red-500 text-center">Could not load the video. The path might be missing or incorrect.</p>
                                <button
                                    onClick={retryVideoUrl}
                                    className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg flex items-center gap-2"
                                >
                                    <RefreshCwIcon className="h-5 w-5" /> Try Again
                                </button>
                            </div>
                        ) : publicVideoUrl ? (
                            <VideoPlayer ref={videoRef} video_url={publicVideoUrl} onTimeUpdate={setCurrentTime} />
                        ) : (
                            <div className="aspect-video bg-slate-200 dark:bg-slate-800 rounded-lg flex flex-col items-center justify-center">
                                <VideoIcon className="h-16 w-16 text-slate-400 dark:text-slate-600" />
                                <p className="mt-4 text-slate-500">No video provided for this module.</p>
                            </div>
                        )}
                    </div>
                    <div>
                        <ModuleEditor
                            module={module}
                            onModuleChange={handleModuleDataChange}
                            traineeSuggestions={pendingTraineeSuggestions}
                            aiSuggestions={aiSuggestions}
                            checkpointResponses={checkpointResponses}
                            onAcceptSuggestion={handleSuggestionAccept}
                            onRejectSuggestion={(id) => handleSuggestionReject(id.toString())}
                            isAdmin={isAdmin}
                            currentTime={currentTime}
                            onSeek={handleSeek}
                            initialFocusStepIndex={initialFocusStepIndex}
                        />
                    </div>
                </div>
                <div className="mt-8 flex justify-center items-center gap-4">
                    <button
                        onClick={handleDelete}
                        disabled={isSaving || isDeleting}
                        className="flex items-center gap-2 bg-red-700 dark:bg-red-800/80 hover:bg-red-800 dark:hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:bg-slate-400 dark:disabled:bg-slate-500"
                    >
                        <TrashIcon className="h-5 w-5" />
                        <span>{isDeleting ? 'Deleting...' : 'Delete Module'}</span>
                    </button>
                    <button onClick={() => navigate(`/modules/${module.slug}`)} className="bg-slate-500 dark:bg-slate-600 hover:bg-slate-600 dark:hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-lg transition-colors" disabled={isSaving || isDeleting}>
                        Cancel
                    </button>
                    <button onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:bg-slate-400 dark:disabled:bg-slate-500" disabled={isSaving || isDeleting}>
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditPage;