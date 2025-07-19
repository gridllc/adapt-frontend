import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getModule, saveModule, deleteModule } from '@/services/moduleService';
import { getTraineeSuggestionsForModule, deleteTraineeSuggestion, getAiSuggestionsForModule } from '@/services/suggestionsService';
import { getCheckpointResponsesForModule } from '@/services/checkpointService';
import { supabase } from '@/services/apiClient';
import { ModuleEditor } from '@/components/ModuleEditor';
import { VideoPlayer } from '@/components/VideoPlayer';
import type { AlternativeMethod, TraineeSuggestion, ProcessStep, AiSuggestion, AppModule } from '@/types';
import type { Database } from '@/types/supabase';
import { TrashIcon, VideoIcon, AlertTriangleIcon, RefreshCwIcon, SparklesIcon } from '@/components/Icons';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useSafeVideoUrl } from '@/hooks/useSafeVideoUrl';

type CheckpointResponseRow = Database['public']['Tables']['checkpoint_responses']['Row'];


const EditPage: React.FC = () => {
    const { moduleId } = useParams<{ moduleId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const { isAuthenticated, user } = useAuth();
    const { addToast } = useToast();
    const [module, setModule] = useState<AppModule | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const isAdmin = !!user;
    const [initialFocusStepIndex, setInitialFocusStepIndex] = useState<number | undefined>();

    const videoRef = useRef<HTMLVideoElement>(null);
    const [currentTime, setCurrentTime] = useState(0);

    const {
        data: initialModuleData,
        isLoading,
        isError: isModuleError,
        error: queryError
    } = useQuery<AppModule | undefined>({
        queryKey: ['module', moduleId],
        queryFn: () => getModule(moduleId!),
        enabled: !!moduleId,
        staleTime: 1000 * 60 * 5,
        retry: false,
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

    useEffect(() => {
        if (!moduleId) return;

        const traineeChannel = supabase
            .channel(`suggestions-for-${moduleId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'suggestions', filter: `module_id=eq.${moduleId}` },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['traineeSuggestions', moduleId] });
                    addToast('info', 'New Trainee Suggestion', 'A trainee has submitted a new suggestion for this module.');
                }
            ).subscribe();

        const aiChannel = supabase
            .channel(`ai-suggestions-for-${moduleId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'suggested_fixes', filter: `module_id=eq.${moduleId}` },
                () => {
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

    useEffect(() => {
        if (initialModuleData) {
            const moduleToEdit = { ...initialModuleData };
            const navigationState = location.state as { suggestion?: string; stepIndex?: number } | null;

            if (navigationState?.suggestion && typeof navigationState.stepIndex === 'number') {
                const { suggestion, stepIndex } = navigationState;
                const steps = moduleToEdit.steps;

                if (steps && steps[stepIndex]) {
                    steps[stepIndex] = { ...steps[stepIndex], description: suggestion };
                    moduleToEdit.steps = steps;
                    setInitialFocusStepIndex(stepIndex);

                    addToast('info', 'Suggestion Applied', `AI fix pre-filled for Step ${stepIndex + 1}. Review and save changes.`);
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

    const handleSeek = useCallback((time: number) => {
        if (videoRef.current) {
            videoRef.current.currentTime = time;
            if (videoRef.current.paused) {
                videoRef.current.play().catch(console.error);
            }
        }
    }, []);

    const handleSuggestionAccept = useCallback(async (suggestion: TraineeSuggestion) => {
        if (!module) return;

        const newSteps = [...(module.steps ?? [])];
        const stepIndex = suggestion.stepIndex;

        if (stepIndex >= 0 && stepIndex < newSteps.length) {
            const stepToUpdate = newSteps[stepIndex];
            // Appends the trainee's suggestion to the existing description.
            const newDescription = `${stepToUpdate.description}\n\n--- Trainee Suggestion ---\n${suggestion.text}`;
            newSteps[stepIndex] = { ...stepToUpdate, description: newDescription };

            setModule({ ...module, steps: newSteps });

            // After applying the change, remove the suggestion from the pending list.
            try {
                await deleteTraineeSuggestion(suggestion.id);
                await queryClient.invalidateQueries({ queryKey: ['traineeSuggestions', moduleId] });
                addToast('success', 'Suggestion Applied', 'The suggestion has been added to the step description.');
            } catch (err) {
                addToast('error', 'Update Failed', 'Could not remove the pending suggestion.');
            }
        } else {
            // This case handles data inconsistency where a suggestion points to a non-existent step.
            addToast('error', 'Step Not Found', `Cannot apply suggestion: Step at index ${stepIndex} not found.`);
        }
    }, [module, moduleId, queryClient, addToast]);

    const handleSuggestionReject = async (suggestionId: string) => {
        try {
            await deleteTraineeSuggestion(suggestionId);
            queryClient.invalidateQueries({ queryKey: ['traineeSuggestions', moduleId] });
            addToast('info', 'Suggestion Rejected', 'The suggestion has been removed.');
        } catch (err) {
            addToast('error', 'Rejection Failed', 'Could not remove the pending suggestion.');
        }
    };


    const handleSave = async () => {
        if (!module || !user) return;
        setIsSaving(true);
        addToast('info', 'Saving...', 'Your changes are being saved to the database.');
        try {
            // The video file is not being re-uploaded here.
            // The video_url should persist from the initial load.
            const savedModule = await saveModule({ moduleData: { ...module, user_id: user.id } });
            await queryClient.invalidateQueries({ queryKey: ['module', savedModule.slug] });
            await queryClient.invalidateQueries({ queryKey: ['modules'] });
            addToast('success', 'Module Saved', 'Your changes have been successfully saved.');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Could not save module.";
            addToast('error', 'Save Failed', errorMessage);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!module?.slug) return;
        const confirmed = window.confirm('Are you sure you want to delete this module? This action is irreversible and will delete all associated session data and suggestions.');
        if (confirmed) {
            setIsDeleting(true);
            try {
                await deleteModule(module.slug);
                await queryClient.invalidateQueries({ queryKey: ['modules'] });
                addToast('success', 'Module Deleted', `The module "${module.title}" has been removed.`);
                navigate('/');
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Could not delete module.';
                addToast('error', 'Deletion Failed', errorMessage);
            } finally {
                setIsDeleting(false);
            }
        }
    };


    if (isLoading || !module) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-100 dark:bg-slate-900">
                <p className="text-xl text-slate-700 dark:text-slate-300">Loading Module for Editing...</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 h-screen">
            <div className="lg:col-span-2 flex flex-col h-full">
                <header className="flex-shrink-0 flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Edit: {module.title}</h1>
                    <div className="flex items-center gap-4">
                        <Link to={`/modules/${module.slug}`} className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                            Go to Training Page
                        </Link>
                        <button
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors disabled:bg-slate-400"
                        >
                            <TrashIcon className="h-5 w-5" />
                            {isDeleting ? 'Deleting...' : 'Delete'}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-slate-400"
                        >
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </header>
                <div className="flex-1 overflow-y-auto">
                    <ModuleEditor
                        module={module}
                        onModuleChange={setModule}
                        traineeSuggestions={pendingTraineeSuggestions}
                        aiSuggestions={aiSuggestions}
                        checkpointResponses={checkpointResponses}
                        onAcceptSuggestion={handleSuggestionAccept}
                        onRejectSuggestion={handleSuggestionReject}
                        isAdmin={isAdmin}
                        currentTime={currentTime}
                        onSeek={handleSeek}
                        initialFocusStepIndex={initialFocusStepIndex}
                    />
                </div>
            </div>
            <div className="lg:col-span-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl flex flex-col h-full overflow-hidden">
                <h2 className="text-lg font-bold p-4 border-b border-slate-200 dark:border-slate-700">Video Preview</h2>
                <div className="flex-1 bg-slate-900 flex items-center justify-center">
                    {!publicVideoUrl && !isLoadingVideo && (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900">
                            <VideoIcon className="h-16 w-16 text-slate-400 dark:text-slate-600" />
                            <p className="mt-4 text-slate-500">No video provided for this module.</p>
                        </div>
                    )}
                    {isLoadingVideo && (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 p-4">
                            <SparklesIcon className="h-12 w-12 text-indigo-400 animate-pulse" />
                            <p className="mt-4 text-slate-500">Verifying video...</p>
                        </div>
                    )}
                    {isVideoError && (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 p-4">
                            <AlertTriangleIcon className="h-12 w-12 text-red-500 mb-4" />
                            <p className="text-red-500 text-center">Could not load the video. The path might be missing or incorrect.</p>
                            <button
                                onClick={retryVideoUrl}
                                className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg flex items-center gap-2"
                            >
                                <RefreshCwIcon className="h-5 w-5" /> Try Again
                            </button>
                        </div>
                    )}
                    {publicVideoUrl && (
                        <VideoPlayer
                            ref={videoRef}
                            video_url={publicVideoUrl}
                            onTimeUpdate={setCurrentTime}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default EditPage;
