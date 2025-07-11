
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getModule, saveUploadedModule } from '@/data/modules';
import { getSuggestionsForModule, deleteSuggestion } from '@/services/suggestionsService';
import { ModuleEditor } from '@/components/ModuleEditor';
import type { TrainingModule, Suggestion, ProcessStep, AlternativeMethod } from '@/types';
import { BookOpenIcon } from '@/components/Icons';
import { useAuth } from '@/hooks/useAuth';

const EditPage: React.FC = () => {
    const { moduleId } = useParams<{ moduleId: string }>();
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const [module, setModule] = useState<TrainingModule | null>(null);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }

        if (!moduleId) {
            navigate('/not-found');
            return;
        }

        const data = getModule(moduleId);
        if (data) {
            setModule(data);
            const pendingSuggestions = getSuggestionsForModule(moduleId).filter(s => s.status === 'pending');
            setSuggestions(pendingSuggestions);
        } else {
            navigate('/not-found');
        }
    }, [moduleId, navigate, isAuthenticated]);

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

    const handleSave = () => {
        if (!module) return;

        const originalModule = getModule(moduleId!);
        if (!originalModule) {
            setError('Could not find the original module to save.');
            return;
        }

        const moduleToSave = { ...module, slug: originalModule.slug };

        if (saveUploadedModule(moduleToSave)) {
            navigate(`/modules/${moduleToSave.slug}`);
        } else {
            setError('Could not save the module. Please try again.');
        }
    };

    if (!module) {
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
                <div className="mt-8 flex justify-center gap-4">
                    <button onClick={() => navigate(`/modules/${module.slug}`)} className="bg-slate-600 hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors">
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditPage;