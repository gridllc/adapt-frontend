import React from 'react';
import type { TrainingModule, ProcessStep } from '@/types';
import { XIcon, SparklesIcon } from '@/components/Icons';

interface ModuleEditorProps {
    module: TrainingModule;
    onModuleChange: (module: TrainingModule) => void;
    onAnalyze: () => void;
    isAnalyzing: boolean;
    canAnalyze: boolean;
}

export const ModuleEditor: React.FC<ModuleEditorProps> = ({ module, onModuleChange, onAnalyze, isAnalyzing, canAnalyze }) => {

    const handleFieldChange = (field: keyof TrainingModule, value: string) => {
        onModuleChange({ ...module, [field]: value });
    };

    const handleStepChange = (index: number, field: keyof ProcessStep, value: string | number) => {
        const newSteps = [...module.steps];
        // @ts-ignore
        newSteps[index][field] = value;
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
        <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl">
            <h2 className="text-2xl font-bold text-indigo-400 mb-6">Review & Edit Your Module</h2>

            <div className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Module Title</label>
                    <input
                        type="text"
                        value={module.title}
                        onChange={(e) => handleFieldChange('title', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">Video URL</label>
                    <input
                        type="text"
                        value={module.videoUrl}
                        onChange={(e) => handleFieldChange('videoUrl', e.target.value)}
                        placeholder="Upload a video to get a local URL, or paste one here."
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="mt-2">
                        <button
                            onClick={onAnalyze}
                            disabled={!canAnalyze || isAnalyzing}
                            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500 disabled:bg-slate-500 disabled:cursor-not-allowed disabled:scale-100"
                        >
                            <SparklesIcon className={`h-5 w-5 ${isAnalyzing ? 'animate-pulse' : ''}`} />
                            {isAnalyzing ? 'Analyzing Video...' : 'Set Timestamps with AI'}
                        </button>
                        {!canAnalyze && <p className="text-xs text-slate-400 mt-1 inline-block ml-3">Upload a video on the 'Create' screen to enable AI analysis.</p>}
                    </div>
                </div>
            </div>

            <hr className="my-8 border-slate-700" />

            <h3 className="text-xl font-bold text-indigo-400 mb-4">Process Steps</h3>
            <div className="space-y-4">
                {module.steps.map((step, index) => (
                    <div key={index} className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 relative">
                        <button
                            onClick={() => removeStep(index)}
                            className="absolute top-2 right-2 p-1 text-slate-400 hover:text-red-400 rounded-full hover:bg-slate-700 transition-colors"
                            aria-label="Remove step"
                        >
                            <XIcon className="h-5 w-5" />
                        </button>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-1">
                                <label className="block text-sm font-medium text-slate-300 mb-1">Step {index + 1}: Title</label>
                                <input
                                    type="text"
                                    value={step.title}
                                    onChange={(e) => handleStepChange(index, 'title', e.target.value)}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                                <textarea
                                    value={step.description}
                                    onChange={(e) => handleStepChange(index, 'description', e.target.value)}
                                    rows={3}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">Start Time (s)</label>
                                <input
                                    type="number"
                                    value={step.start}
                                    onChange={(e) => handleStepChange(index, 'start', parseInt(e.target.value, 10))}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1">End Time (s)</label>
                                <input
                                    type="number"
                                    value={step.end}
                                    onChange={(e) => handleStepChange(index, 'end', parseInt(e.target.value, 10))}
                                    className="w-full bg-slate-700 border border-slate-600 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <button
                onClick={addStep}
                className="mt-6 w-full text-center border-2 border-dashed border-slate-600 hover:border-indigo-500 text-slate-300 font-semibold py-2 px-4 rounded-lg transition-colors"
            >
                + Add Step
            </button>
        </div>
    );
};
