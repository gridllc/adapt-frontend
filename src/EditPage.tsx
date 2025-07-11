
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getModule, saveUploadedModule, deleteModule } from '@/services/moduleService';
import { getSuggestionsForModule, deleteSuggestion } from '@/services/suggestionsService';
import { ModuleEditor } from '@/components/ModuleEditor';
import type { TrainingModule, Suggestion, AlternativeMethod } from '@/types';
import { BookOpenIcon, TrashIcon } from '@/components/Icons';
import { useAuth } from '@/hooks/useAuth';

const EditPage: React.FC = () => {
    const { moduleId } = useParams<{ moduleId: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { isAuthenticated } = useAuth();
    const [module, setModule] = useState<TrainingModule | null>(null);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const {
        data: initialModuleData,
        isLoading,
        isError,
        error: queryError
    } = useQuery({
        queryKey: ['module', moduleId],
        queryFn: () => getModule(moduleId!),
        enabled: !!moduleId,
        staleTime: 1000 * 60 * 5, // 5 minutes,
        retry: false, // Don't retry on not found
    });

    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login');
        }
    }, [isAuthenticated, navigate]);

    useEffect(() => {
        if (initialModuleData) {
            setModule(initialModuleData);
            if (moduleId) {
                const pendingSuggestions = getSuggestionsForModule(moduleId).filter(s => s.status === 'pending');
                setSuggestions(pendingSuggestions);
            }
        }
    }, [initialModuleData, moduleId]);

    useEffect(() => {
        if (!isLoading && (isError || !initialModuleData)) {
            console.error(`Failed to load module for editing: ${moduleId}`, queryError);
            navigate('/not-found');
        }
    }, [isLoading, isError, initialModuleData, moduleId, navigate, queryError]);

    const handleSuggestionAccept = (suggestion: Suggestion) => {
        if (!module) return;

        const newSteps = [...module.steps];
        const stepToUpdate = newSteps[suggestion.stepIndex];

        if (stepToUpdate) {
            const newAlternativeMethod: AlternativeMethod = {
                title: "AI-Suggested Improvement",
                description: suggestion.text
            };
            stepToUpdate.alternativeMethods.push(newAlternativeMethod);

            setModule({ ...module, steps: newSteps });
        }

        deleteSuggestion(suggestion.id);
        setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
    };

    const handleSuggestionReject = (suggestionId: string) => {
        deleteSuggestion(suggestionId);
        setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
    };

    const handleSave = async () => {
        if (!module) return;
        setIsSaving(true);
        setError(null);

        try {
            const savedModule = await saveUploadedModule(module);
            await queryClient.invalidateQueries({ queryKey: ['module', savedModule.slug] });
            await queryClient.invalidateQueries({ queryKey: ['modules'] });
            navigate(`/modules/${savedModule.slug}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not save the module. Please try again.');
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
            setError(null);
            try {
                await deleteModule(module.slug);
                await queryClient.invalidateQueries({ queryKey: ['module', module.slug] });
                await queryClient.invalidateQueries({ queryKey: ['modules'] });
                navigate('/');
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not delete the module.');
                setIsDeleting(false);
            }
        }
    }

    if (isLoading || !module) {
        return <div className="text-center p-8">Loading editor...</div>;
    }

    return (
        <div className="max-w-7xl mx-auto p-6">
            <header className="flex justify-between items-center mb-6">
                <button onClick={() => navigate(`/modules/${module.slug}`)} className="text-slate-300 hover:text-indigo-400 transition-colors flex items-center gap-2">
                    <BookOpenIcon className="h-5 w-5" />
                    <span>Back to Training</span>
                </button>
                <h1 className="text-3xl font-bold text-white text-center">Edit Module</h1>
                <span className="w-40"></span>
            </header>

            <div className="animate-fade-in-up">
                <ModuleEditor
                    module={module}
                    onModuleChange={setModule}
                    suggestions={suggestions}
                    onAcceptSuggestion={handleSuggestionAccept}
                    onRejectSuggestion={handleSuggestionReject}
                    showAnalysisButton={false}
                />
                {error && <p className="mt-4 text-red-500 text-center">{error}</p>}
                <div className="mt-8 flex justify-center items-center gap-4">
                    <button
                        onClick={handleDelete}
                        disabled={isSaving || isDeleting}
                        className="flex items-center gap-2 bg-red-800/80 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:bg-slate-500"
                    >
                        <TrashIcon className="h-5 w-5" />
                        <span>{isDeleting ? 'Deleting...' : 'Delete Module'}</span>
                    </button>
                    <button onClick={() => navigate(`/modules/${module.slug}`)} className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-lg transition-colors" disabled={isSaving || isDeleting}>
                        Cancel
                    </button>
                    <button onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:bg-slate-500" disabled={isSaving || isDeleting}>
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditPage;
