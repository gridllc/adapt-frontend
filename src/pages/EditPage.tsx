import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getModule, saveModule, deleteModule } from '@/services/moduleService';
import { getSuggestionsForModule, deleteSuggestion } from '@/services/suggestionsService';
import { supabase } from '@/services/apiClient';
import { ModuleEditor } from '@/components/ModuleEditor';
import type { AlternativeMethod, Suggestion } from '@/types';
import type { Database } from '@/types/supabase';
import { BookOpenIcon, TrashIcon } from '@/components/Icons';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';

type ModuleRow = Database['public']['Tables']['modules']['Row'];

const EditPage: React.FC = () => {
    const { moduleId } = useParams<{ moduleId: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { isAuthenticated, user } = useAuth();
    const { addToast } = useToast();
    const [module, setModule] = useState<ModuleRow | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const {
        data: initialModuleData,
        isLoading,
        isError,
        error: queryError
    } = useQuery<ModuleRow | undefined>({
        queryKey: ['module', moduleId],
        queryFn: () => getModule(moduleId!),
        enabled: !!moduleId,
        staleTime: 1000 * 60 * 5, // 5 minutes,
        retry: false, // Don't retry on not found
    });

    const { data: allSuggestions = [] } = useQuery<Suggestion[]>({
        queryKey: ['suggestions', moduleId],
        queryFn: () => getSuggestionsForModule(moduleId!),
        enabled: !!moduleId,
    });

    // Real-time subscription for new suggestions
    useEffect(() => {
        if (!moduleId) return;

        const channel = supabase
            .channel(`suggestions-for-${moduleId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'suggestions', filter: `module_id=eq.${moduleId}` },
                (payload) => {
                    console.log('New suggestion received!', payload);
                    queryClient.invalidateQueries({ queryKey: ['suggestions', moduleId] });
                    addToast('info', 'New Suggestion', 'A trainee has submitted a new suggestion for this module.');
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [moduleId, queryClient, addToast]);

    const suggestions = useMemo(() => {
        return allSuggestions.filter((s: Suggestion) => s.status === 'pending');
    }, [allSuggestions]);

    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login');
        }
    }, [isAuthenticated, navigate]);

    useEffect(() => {
        if (initialModuleData) {
            setModule(initialModuleData);
        }
    }, [initialModuleData]);

    useEffect(() => {
        if (!isLoading && (isError || !initialModuleData)) {
            console.error(`Failed to load module for editing: ${moduleId}`, queryError);
            navigate('/not-found');
        }
    }, [isLoading, isError, initialModuleData, moduleId, navigate, queryError]);

    const handleSuggestionAccept = async (suggestion: Suggestion) => {
        if (!module) return;

        const newSteps = [...module.steps as any[]];
        const stepToUpdate = newSteps[suggestion.stepIndex];

        if (stepToUpdate) {
            const newAlternativeMethod: AlternativeMethod = {
                title: "AI-Suggested Improvement",
                description: suggestion.text || ''
            };
            stepToUpdate.alternativeMethods.push(newAlternativeMethod);

            setModule({ ...module, steps: newSteps });
        }

        await deleteSuggestion(suggestion.id.toString());
        queryClient.invalidateQueries({ queryKey: ['suggestions', moduleId] });
        addToast('success', 'Suggestion Accepted', 'The new method has been added to the step.');
    };

    const handleSuggestionReject = async (suggestionId: string) => {
        await deleteSuggestion(suggestionId);
        queryClient.invalidateQueries({ queryKey: ['suggestions', moduleId] });
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

    if (isLoading || !module) {
        return <div className="text-center p-8 text-slate-500 dark:text-slate-400">Loading editor...</div>;
    }

    return (
        <div className="max-w-7xl mx-auto p-6">
            <header className="flex justify-between items-center mb-6">
                <button onClick={() => navigate(`/modules/${module.slug}`)} className="text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-2">
                    <BookOpenIcon className="h-5 w-5" />
                    <span>Back to Training</span>
                </button>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white text-center">Edit Module</h1>
                <span className="w-40"></span>
            </header>

            <div className="animate-fade-in-up">
                <ModuleEditor
                    module={module}
                    onModuleChange={setModule}
                    suggestions={suggestions}
                    onAcceptSuggestion={handleSuggestionAccept}
                    onRejectSuggestion={(id) => handleSuggestionReject(id.toString())}
                    showAnalysisButton={false}
                />
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