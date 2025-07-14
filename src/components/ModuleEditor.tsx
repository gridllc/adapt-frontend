import React, { useCallback } from 'react'
import type {
    TrainingModule,
    ProcessStep,
    AlternativeMethod,
    Suggestion
} from '@/types'
import {
    XIcon,
    SparklesIcon,
    LightbulbIcon,
    CheckCircleIcon
} from '@/components/Icons'
import { VideoPlayer } from '@/components/VideoPlayer'
import { useToast } from '@/hooks/useToast'

interface ModuleEditorProps {
    module: TrainingModule
    onModuleChange: (module: TrainingModule) => void
    suggestions?: Suggestion[]
    onAcceptSuggestion?: (suggestion: Suggestion) => void
    onRejectSuggestion?: (suggestionId: string) => void
    onAnalyze?: () => void
    isAnalyzing?: boolean
    showAnalysisButton: boolean
}

export const ModuleEditor: React.FC<ModuleEditorProps> = ({
    module,
    onModuleChange,
    suggestions = [],
    onAcceptSuggestion = () => { },
    onRejectSuggestion = () => { },
    onAnalyze,
    isAnalyzing = false,
    showAnalysisButton
}) => {
    const { addToast } = useToast()

    // Top-level field updater (title, videoUrl, etc.)
    const handleFieldChange = useCallback(
        (field: keyof TrainingModule, value: string) => {
            // Prevent persisting blob URLs
            if (field === 'videoUrl' && value.startsWith('blob:')) {
                addToast(
                    'error',
                    'Invalid Video URL',
                    'Please paste a permanent, hosted URL (e.g. Supabase public URL).'
                )
                return
            }
            onModuleChange({ ...module, [field]: value })
        },
        [addToast, module, onModuleChange]
    )

    // Update a single field on one step
    const handleStepChange = useCallback(
        (
            index: number,
            field: keyof ProcessStep,
            value: string | number | null
        ) => {
            const steps = module.steps.map((s, i) =>
                i === index ? { ...s, [field]: value } : s
            )
            onModuleChange({ ...module, steps })
        },
        [module, onModuleChange]
    )

    // Update an alternative method on a step
    const handleAltChange = useCallback(
        (
            stepIndex: number,
            altIndex: number,
            field: keyof AlternativeMethod,
            value: string
        ) => {
            const steps = module.steps.map((s, i) => {
                if (i !== stepIndex) return s
                const alternativeMethods = s.alternativeMethods.map((a, j) =>
                    j === altIndex ? { ...a, [field]: value } : a
                )
                return { ...s, alternativeMethods }
            })
            onModuleChange({ ...module, steps })
        },
        [module, onModuleChange]
    )

    // Add / remove alternative methods
    const addAlternativeMethod = useCallback(
        (stepIndex: number) => {
            const steps = module.steps.map((s, i) =>
                i === stepIndex
                    ? {
                        ...s,
                        alternativeMethods: [
                            ...s.alternativeMethods,
                            { title: 'New Method', description: '' }
                        ]
                    }
                    : s
            )
            onModuleChange({ ...module, steps })
        },
        [module, onModuleChange]
    )

    const removeAlternativeMethod = useCallback(
        (stepIndex: number, altIndex: number) => {
            const steps = module.steps.map((s, i) =>
                i === stepIndex
                    ? {
                        ...s,
                        alternativeMethods: s.alternativeMethods.filter(
                            (_, j) => j !== altIndex
                        )
                    }
                    : s
            )
            onModuleChange({ ...module, steps })
        },
        [module, onModuleChange]
    )

    // Add / remove steps
    const addStep = useCallback(() => {
        const newStep: ProcessStep = {
            title: 'New Step',
            description: '',
            start: 0,
            end: 0,
            checkpoint: null,
            alternativeMethods: []
        }
        onModuleChange({ ...module, steps: [...module.steps, newStep] })
    }, [module, onModuleChange])

    const removeStep = useCallback(
        (index: number) => {
            const steps = module.steps.filter((_, i) => i !== index)
            onModuleChange({ ...module, steps })
        },
        [module, onModuleChange]
    )

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl space-y-6 animate-fade-in-up">
            {/* === Header: Title + Video URL + AI Button === */}
            <div className="grid gap-6 md:grid-cols-2">
                <div>
                    <label className="block font-semibold mb-2">Module Title</label>
                    <input
                        type="text"
                        className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 bg-white dark:bg-slate-900 focus:outline-none"
                        value={module.title}
                        onChange={(e) =>
                            handleFieldChange('title', e.currentTarget.value)
                        }
                    />
                </div>
                <div>
                    <label className="block font-semibold mb-2">Video URL</label>
                    <input
                        type="text"
                        className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 bg-white dark:bg-slate-900 focus:outline-none"
                        value={module.videoUrl}
                        onChange={(e) =>
                            handleFieldChange('videoUrl', e.currentTarget.value)
                        }
                        placeholder="Paste Supabase public URL here"
                    />
                    {showAnalysisButton && onAnalyze && (
                        <button
                            onClick={onAnalyze}
                            disabled={isAnalyzing}
                            className="mt-3 inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            <SparklesIcon className="h-5 w-5" />
                            {isAnalyzing ? 'Analyzing...' : 'Set Timestamps with AI'}
                        </button>
                    )}
                    {/* Video Preview */}
                    {module.videoUrl && (
                        <div className="mt-4">
                            <VideoPlayer
                                videoUrl={module.videoUrl}
                                onTimeUpdate={() => { }}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* === Steps Editor === */}
            <div>
                <h2 className="font-semibold mb-3">Process Steps</h2>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                    {module.steps.map((step, idx) => {
                        // filter suggestions for this step
                        const stepSuggestions = suggestions.filter(
                            (s) => s.stepIndex === idx
                        )

                        return (
                            <div
                                key={idx}
                                className="p-4 bg-slate-100 dark:bg-slate-900 rounded-lg space-y-3"
                            >
                                <div className="flex justify-between items-center">
                                    <h3 className="font-bold">Step {idx + 1}</h3>
                                    <button
                                        onClick={() => removeStep(idx)}
                                        className="text-red-500 hover:text-red-700"
                                    >
                                        <XIcon className="h-5 w-5" />
                                    </button>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">
                                            Title
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-1 bg-white dark:bg-slate-900 focus:outline-none"
                                            value={step.title}
                                            onChange={(e) =>
                                                handleStepChange(idx, 'title', e.currentTarget.value)
                                            }
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">
                                            Description
                                        </label>
                                        <textarea
                                            className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-1 h-20 bg-white dark:bg-slate-900 focus:outline-none"
                                            value={step.description}
                                            onChange={(e) =>
                                                handleStepChange(
                                                    idx,
                                                    'description',
                                                    e.currentTarget.value
                                                )
                                            }
                                        />
                                    </div>
                                </div>

                                <div className="grid gap-4 grid-cols-2">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">
                                            Start (sec)
                                        </label>
                                        <input
                                            type="number"
                                            className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-1 bg-white dark:bg-slate-900 focus:outline-none"
                                            value={step.start}
                                            onChange={(e) =>
                                                handleStepChange(
                                                    idx,
                                                    'start',
                                                    Number(e.currentTarget.value)
                                                )
                                            }
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">
                                            End (sec)
                                        </label>
                                        <input
                                            type="number"
                                            className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-1 bg-white dark:bg-slate-900 focus:outline-none"
                                            value={step.end}
                                            onChange={(e) =>
                                                handleStepChange(
                                                    idx,
                                                    'end',
                                                    Number(e.currentTarget.value)
                                                )
                                            }
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Checkpoint (optional)
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-1 bg-white dark:bg-slate-900 focus:outline-none"
                                        value={step.checkpoint ?? ''}
                                        onChange={(e) =>
                                            handleStepChange(idx, 'checkpoint', e.currentTarget.value)
                                        }
                                    />
                                </div>

                                {/* Alternative Methods */}
                                {step.alternativeMethods.length > 0 && (
                                    <div className="space-y-2">
                                        <h4 className="font-medium">Alternative Methods</h4>
                                        {step.alternativeMethods.map((alt, aIdx) => (
                                            <div
                                                key={aIdx}
                                                className="p-2 bg-white dark:bg-slate-800 rounded-lg relative"
                                            >
                                                <button
                                                    onClick={() =>
                                                        removeAlternativeMethod(idx, aIdx)
                                                    }
                                                    className="absolute top-1 right-1 text-red-500"
                                                >
                                                    <XIcon className="h-4 w-4" />
                                                </button>
                                                <input
                                                    type="text"
                                                    placeholder="Method title"
                                                    className="w-full border border-slate-300 dark:border-slate-600 rounded px-2 py-1 mb-1 bg-white dark:bg-slate-900 focus:outline-none"
                                                    value={alt.title}
                                                    onChange={(e) =>
                                                        handleAltChange(
                                                            idx,
                                                            aIdx,
                                                            'title',
                                                            e.currentTarget.value
                                                        )
                                                    }
                                                />
                                                <textarea
                                                    placeholder="Method description"
                                                    className="w-full border border-slate-300 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-900 focus:outline-none"
                                                    value={alt.description}
                                                    onChange={(e) =>
                                                        handleAltChange(
                                                            idx,
                                                            aIdx,
                                                            'description',
                                                            e.currentTarget.value
                                                        )
                                                    }
                                                />
                                            </div>
                                        ))}
                                        <button
                                            onClick={() => addAlternativeMethod(idx)}
                                            className="mt-2 inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800"
                                        >
                                            <LightbulbIcon className="h-4 w-4" />
                                            Add alternative
                                        </button>
                                    </div>
                                )}

                                {/* Suggestions for this step */}
                                {stepSuggestions.length > 0 && (
                                    <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                        <h4 className="font-semibold mb-2">Trainee Suggestions</h4>
                                        {stepSuggestions.map((sug) => (
                                            <div
                                                key={sug.id}
                                                className="flex justify-between items-center mb-2"
                                            >
                                                <span className="italic flex-1">"{sug.text}"</span>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => onAcceptSuggestion?.(sug)}
                                                        className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                                                    >
                                                        Accept
                                                    </button>
                                                    <button
                                                        onClick={() => onRejectSuggestion?.(sug.id)}
                                                        className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs"
                                                    >
                                                        Reject
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    })}

                    <button
                        onClick={addStep}
                        className="mt-4 inline-flex items-center gap-2 text-green-600 hover:text-green-800"
                    >
                        <CheckCircleIcon className="h-5 w-5" /> Add Step
                    </button>
                </div>
            </div>
        </div>
    )
}
