
import React from 'react';
import type { TrainingModule, ProcessStep, AlternativeMethod, Suggestion } from '@/types.ts';
import { XIcon, SparklesIcon, LightbulbIcon, CheckCircleIcon } from '@/components/Icons.tsx';

interface ModuleEditorProps {
    module: TrainingModule;
    onModuleChange: (module: TrainingModule) => void;
    suggestions?: Suggestion[];
    onAcceptSuggestion?: (suggestion: Suggestion) => void;
    onRejectSuggestion?: (suggestionId: string) => void;
    onAnalyze?: () => void;
    isAnalyzing?: boolean;
    showAnalysisButton: boolean;
}

export const ModuleEditor: React.FC<ModuleEditorProps> = ({
    module,
    onModuleChange,
    suggestions = [],
    onAcceptSuggestion = () => { },
    onRejectSuggestion = () => { },
    onAnalyze,
    isAnalyzing,
    showAnalysisButton
}) => {

    const handleFieldChange = (field: keyof TrainingModule, value: string) => {
        onModuleChange({ ...module, [field]: value });
    };

    const handleStepChange = (index: number, field: keyof ProcessStep, value: string | number | null) => {
        const newSteps = [...module.steps];
        // @ts-ignore
        newSteps[index][field] = value;
        onModuleChange({ ...module, steps: newSteps });
    };

    const handleAlternativeMethodChange = (stepIndex: number, altIndex: number, field: keyof AlternativeMethod, value: string) => {
        const newSteps = [...module.steps];
        const newAlternativeMethods = [...newSteps[stepIndex].alternativeMethods];
        newAlternativeMethods[altIndex] = { ...newAlternativeMethods[altIndex], [field]: value };
        newSteps[stepIndex] = { ...newSteps[stepIndex], alternativeMethods: newAlternativeMethods };
        onModuleChange({ ...module, steps: newSteps });
    };

    const addAlternativeMethod = (stepIndex: number) => {
        const newSteps = [...module.steps];
        const newAlternativeMethods = [...newSteps[stepIndex].alternativeMethods, { title: 'New Method', description: '' }];
        newSteps[stepIndex] = { ...newSteps[stepIndex], alternativeMethods: newAlternativeMethods };
        onModuleChange({ ...module, steps: newSteps });
    };

    const removeAlternativeMethod = (stepIndex: number, altIndex: number) => {
        const newSteps = [...module.steps];
        const newAlternativeMethods = newSteps[stepIndex].alternativeMethods.filter((_, i) => i !== altIndex);
        newSteps[stepIndex] = { ...newSteps[stepIndex], alternativeMethods: newAlternativeMethods };
        onModuleChange({ ...module, steps: newSteps });
    };

    const addStep = () => {
        const newStep: ProcessStep = {
            title: "New Step",
            description: "",
            start: 0,
            end: 0,
            checkpoint: null,
            alternativeMethods: [],
        };
        onModuleChange({ ...module, steps: [...module.steps, newStep] });
    };

    const removeStep = (index: number) => {
        const newSteps = module.steps.filter((_, i) => i !== index);
        onModuleChange({ ...module, steps: newSteps });
    };

    return (
        <div className="bg-slate-100 dark:bg-slate-800 p-8 rounded-2xl shadow-xl">
            <h2 className="text-2xl font-bold text-indigo-500 dark:text-indigo-400 mb-6">Review & Edit Your Module</h2>

            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Module Title</label>
                    <input
                        type="text"
                        value={module.title}
                        onChange={(e) => handleFieldChange('title', e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Video URL</label>
                    <input
                        type="text"
                        value={module.videoUrl}
                        onChange={(e) => handleFieldChange('videoUrl', e.target.value)}
                        placeholder="Upload a video to get a local URL, or paste one here."
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {showAnalysisButton && (
                        <div className="mt-2">
                            <button
                                onClick={onAnalyze}
                                disabled={isAnalyzing}
                                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-800 focus:ring-indigo-500 disabled:bg-slate-500 disabled:cursor-not-allowed disabled:scale-100"
                            >
                                <SparklesIcon className={`h-5 w-5 ${isAnalyzing ? 'animate-pulse' : ''}`} />
                                {isAnalyzing ? 'Analyzing Video...' : 'Set Timestamps with AI'}
                            </button>
                            {!showAnalysisButton && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 inline-block ml-3">Upload a video on the 'Create' screen to enable AI analysis.</p>}
                        </div>
                    )}
                </div>
            </div>

            <hr className="my-8 border-slate-200 dark:border-slate-700" />

            <h3 className="text-xl font-bold text-indigo-500 dark:text-indigo-400 mb-4">Process Steps</h3>
            <div className="space-y-4">
                {module.steps.map((step, index) => {
                    const stepSuggestions = suggestions.filter(s => s.stepIndex === index && s.status === 'pending');
                    return (
                        <div key={index} className="bg-white dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700 relative">
                            <button
                                onClick={() => removeStep(index)}
                                className="absolute top-2 right-2 p-1 text-slate-500 dark:text-slate-400 hover:text-red-400 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                aria-label="Remove step"
                            >
                                <XIcon className="h-5 w-5" />
                            </button>

                            {/* Title and Description */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-1">
                                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Step {index + 1}: Title</label>
                                    <input
                                        type="text"
                                        value={step.title}
                                        onChange={(e) => handleStepChange(index, 'title', e.target.value)}
                                        className="w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Description</label>
                                    <textarea
                                        value={step.description}
                                        onChange={(e) => handleStepChange(index, 'description', e.target.value)}
                                        rows={2}
                                        className="w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>

                            {/* Checkpoint */}
                            <div className="mt-4">
                                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Checkpoint Question <span className="text-slate-500 dark:text-slate-400">(Optional)</span></label>
                                <input
                                    type="text"
                                    value={step.checkpoint || ''}
                                    onChange={(e) => handleStepChange(index, 'checkpoint', e.target.value === '' ? null : e.target.value)}
                                    placeholder="e.g., How much turkey should be used?"
                                    className="w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>

                            {/* Alternative Methods */}
                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700/50">
                                <h4 className="text-sm font-semibold text-indigo-600 dark:text-indigo-300 mb-2 flex items-center gap-2"><LightbulbIcon className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />Alternative Methods</h4>
                                {step.alternativeMethods.length > 0 && (
                                    <div className="space-y-3">
                                        {step.alternativeMethods.map((alt, altIndex) => (
                                            <div key={altIndex} className="bg-slate-100 dark:bg-slate-700/50 p-3 rounded-lg relative pl-4">
                                                <button
                                                    onClick={() => removeAlternativeMethod(index, altIndex)}
                                                    className="absolute top-2 right-2 p-1 text-slate-500 dark:text-slate-400 hover:text-red-400 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                                    aria-label="Remove alternative method"
                                                >
                                                    <XIcon className="h-4 w-4" />
                                                </button>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                                                    <div>
                                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Title</label>
                                                        <input type="text" value={alt.title} onChange={(e) => handleAlternativeMethodChange(index, altIndex, 'title', e.target.value)} className="w-full bg-slate-200 dark:bg-slate-600 border border-slate-300 dark:border-slate-500 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Description</label>
                                                        <input type="text" value={alt.description} onChange={(e) => handleAlternativeMethodChange(index, altIndex, 'description', e.target.value)} className="w-full bg-slate-200 dark:bg-slate-600 border border-slate-300 dark:border-slate-500 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <button onClick={() => addAlternativeMethod(index)} className="mt-3 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-semibold">+ Add Method</button>
                            </div>

                            {/* AI Suggestions */}
                            {stepSuggestions.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-amber-500/30">
                                    <h4 className="text-sm font-semibold text-amber-500 dark:text-amber-400 mb-2 flex items-center gap-2"><SparklesIcon className="h-4 w-4" />Pending AI Suggestions</h4>
                                    <div className="space-y-3">
                                        {stepSuggestions.map(suggestion => (
                                            <div key={suggestion.id} className="bg-amber-100 dark:bg-amber-900/40 p-3 rounded-lg">
                                                <p className="text-sm text-amber-800 dark:text-slate-300 italic">"{suggestion.text}"</p>
                                                <div className="flex items-center justify-end gap-3 mt-3">
                                                    <button onClick={() => onRejectSuggestion(suggestion.id)} className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-semibold py-1 px-3 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                                                        Reject
                                                    </button>
                                                    <button onClick={() => onAcceptSuggestion(suggestion)} className="text-xs text-white font-semibold py-1 px-3 rounded-full bg-green-600 hover:bg-green-700 transition-colors flex items-center gap-1">
                                                        <CheckCircleIcon className="h-4 w-4" />
                                                        Accept
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Timestamps */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700/50">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Start Time (s)</label>
                                    <input
                                        type="number"
                                        value={step.start}
                                        onChange={(e) => handleStepChange(index, 'start', parseInt(e.target.value, 10) || 0)}
                                        className="w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">End Time (s)</label>
                                    <input
                                        type="number"
                                        value={step.end}
                                        onChange={(e) => handleStepChange(index, 'end', parseInt(e.target.value, 10) || 0)}
                                        className="w-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            <button
                onClick={addStep}
                className="mt-6 w-full text-center border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-indigo-500 text-slate-600 dark:text-slate-300 font-semibold py-2 px-4 rounded-lg transition-colors"
            >
                + Add Step
            </button>
        </div>
    );
};