import React from 'react';
import type { TrainingModule, ProcessStep, AlternativeMethod, Suggestion } from '@/types.ts';
import { XIcon, SparklesIcon, LightbulbIcon, CheckCircleIcon } from '@/components/Icons.tsx';
import { VideoPlayer } from '@/components/VideoPlayer';
import { useToast } from '@/hooks/useToast';

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
    showAnalysisButton,
}) => {
    const { addToast } = useToast();

    const handleFieldChange = (field: keyof TrainingModule, value: string) => {
        if (field === 'videoUrl' && value.startsWith('blob:')) {
            addToast('error', 'Invalid URL', 'Blob URLs are not allowed. Please paste a real, hosted link.');
            return;
        }
        onModuleChange({ ...module, [field]: value });
    };

    const handleStepChange = (
        index: number,
        field: keyof ProcessStep,
        value: string | number | null
    ) => {
        const newSteps = [...module.steps];
        // @ts-ignore
        newSteps[index][field] = value;
        onModuleChange({ ...module, steps: newSteps });
    };

    const handleAlternativeMethodChange = (
        stepIndex: number,
        altIndex: number,
        field: keyof AlternativeMethod,
        value: string
    ) => {
        const newSteps = [...module.steps];
        const newAlternativeMethods = [...newSteps[stepIndex].alternativeMethods];
        newAlternativeMethods[altIndex] = { ...newAlternativeMethods[altIndex], [field]: value };
        newSteps[stepIndex] = { ...newSteps[stepIndex], alternativeMethods: newAlternativeMethods };
        onModuleChange({ ...module, steps: newSteps });
    };

    const addAlternativeMethod = (stepIndex: number) => {
        const newSteps = [...module.steps];
        const newAlternativeMethods = [
            ...newSteps[stepIndex].alternativeMethods,
            { title: 'New Method', description: '' },
        ];
        newSteps[stepIndex] = { ...newSteps[stepIndex], alternativeMethods: newAlternativeMethods };
        onModuleChange({ ...module, steps: newSteps });
    };

    const removeAlternativeMethod = (stepIndex: number, altIndex: number) => {
        const newSteps = [...module.steps];
        const newAlternativeMethods = newSteps[stepIndex].alternativeMethods.filter(
            (_, i) => i !== altIndex
        );
        newSteps[stepIndex] = { ...newSteps[stepIndex], alternativeMethods: newAlternativeMethods };
        onModuleChange({ ...module, steps: newSteps });
    };

    const addStep = () => {
        const newStep: ProcessStep = {
            title: 'New Step',
            description: '',
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
            <h2 className="text-2xl font-bold text-indigo-500 dark:text-indigo-400 mb-6">
                Review & Edit Your Module
            </h2>

            <div className="space-y-6">
                {/* Module Title */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Module Title
                    </label>
                    <input
                        type="text"
                        value={module.title}
                        onChange={(e) => handleFieldChange('title', e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                {/* Video URL */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Video URL
                    </label>
                    <input
                        type="text"
                        value={module.videoUrl}
                        onChange={(e) => handleFieldChange('videoUrl', e.target.value)}
                        placeholder="Paste a public video URL (e.g. from Supabase) — blob: URLs not allowed."
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {/* Video Preview */}
                    {module.videoUrl && (
                        <div className="mt-4">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Video Preview
                            </label>
                            <VideoPlayer videoUrl={module.videoUrl} onTimeUpdate={() => { }} />
                        </div>
                    )}
                </div>

                {/* AI Timestamp Button */}
                {showAnalysisButton && (
                    <div>
                        <button
                            onClick={onAnalyze}
                            disabled={isAnalyzing}
                            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-800 focus:ring-indigo-500 disabled:bg-slate-500 disabled:cursor-not-allowed disabled:scale-100"
                        >
                            <SparklesIcon
                                className={`h-5 w-5 ${isAnalyzing ? 'animate-pulse' : ''}`} />
                            {isAnalyzing ? 'Analyzing Video...' : 'Set Timestamps with AI'}
                        </button>
                    </div>
                )}

                {/* Steps List */}
                <div className="space-y-4">
                    {module.steps.map((step, idx) => (
                        <div key={idx} className="p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="font-semibold">Step {idx + 1}</h3>
                                <button onClick={() => removeStep(idx)} title="Remove Step">
                                    <XIcon className="h-5 w-5 text-red-500" />
                                </button>
                            </div>

                            {/* Title & Description */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Title
                                    </label>
                                    <input
                                        type="text"
                                        value={step.title}
                                        onChange={(e) => handleStepChange(idx, 'title', e.target.value)}
                                        className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Description
                                    </label>
                                    <textarea
                                        value={step.description}
                                        onChange={(e) => handleStepChange(idx, 'description', e.target.value)}
                                        className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>

                            {/* Timing & Checkpoint */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 text-sm">
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Start</label>
                                    <input
                                        type="number"
                                        value={step.start}
                                        onChange={(e) => handleStepChange(idx, 'start', Number(e.target.value))}
                                        className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark;border-slate-600 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">End</label>
                                    <input
                                        type="number"
                                        value={step.end}
                                        onChange={(e) => handleStepChange(idx, 'end', Number(e.target.value))}
                                        className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Checkpoint (optional)</label>
                                    <input
                                        type="text"
                                        value={step.checkpoint || ''}
                                        onChange={(e) => handleStepChange(idx, 'checkpoint', e.target.value)}
                                        className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>

                            {/* Alternative Methods */}
                            <div className="mb-4">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="font-medium text-sm">Alternative Methods</h4>
                                    <button onClick={() => addAlternativeMethod(idx)} className="text-indigo-600 hover:underline text-xs">
                                        + Add
                                    </button>
                                </div>
                                {step.alternativeMethods.map((alt, aIdx) => (
                                    <div key={aIdx} className="flex items-start gap-2 mb-2">
                                        <div className="flex-1">
                                            <input
                                                type="text"
                                                value={alt.title}
                                                onChange={(e) => handleAlternativeMethodChange(idx, aIdx, 'title', e.target.value)}
                                                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark;border-slate-600 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-1"
                                            />
                                            <textarea
                                                value={alt.description}
                                                onChange={(e) => handleAlternativeMethodChange(idx, aIdx, 'description', e.target.value)}
                                                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <button onClick={() => removeAlternativeMethod(idx, aIdx)} className="p-1 text-red-500">
                                            <XIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Suggestions (if any) */}
                            {suggestions.length > 0 && (
                                <div className="bg-yellow-50 dark:bg-yellow-900/50 p-3 rounded-lg">
                                    <h4 className="font-semibold text-yellow-700 mb-2">Trainee Suggestions</h4>
                                    {suggestions.map((sug) => (
                                        <div key={sug.id} className="flex justify-between items-center mb-2">
                                            <span className="italic text-sm flex-1">"{sug.text}"</span>
                                            <div className="flex gap-1">
                                                <button onClick={() => onAcceptSuggestion?.(sug)} className="text-green-600 hover:underline text-xs">
                                                    Accept
                                                </button>
                                                <button onClick={() => onRejectSuggestion?.(sug.id)} className="text-red-600 hover:underline text-xs">
                                                    Reject
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                        </div>
                    ))}

                    <button
                        onClick={addStep}
                        className="mt-4 inline-flex items-center gap-2 text-indigo-600 hover:underline text-sm"
                    >
                        + Add Step
                    </button>
                </div>
            </div>
        </div>
    );
};
