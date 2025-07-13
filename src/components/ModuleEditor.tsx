import React from 'react'
import { useToast } from '@/hooks/useToast'
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

    /** Top-level module field updater */
    const handleFieldChange = (field: keyof TrainingModule, value: string) => {
        // Prevent saving a blob URL as the permanent video_url
        if (field === 'videoUrl' && value.startsWith('blob:')) {
            addToast(
                'error',
                'Invalid Video URL',
                'Please use the uploaded video or a permanent URL.'
            )
            return
        }
        onModuleChange({ ...module, [field]: value })
    }

    /** Single step field updater */
    const handleStepChange = (
        index: number,
        field: keyof ProcessStep,
        value: string | number | null
    ) => {
        const steps = module.steps.map((s, i) =>
            i === index ? { ...s, [field]: value } : s
        )
        onModuleChange({ ...module, steps })
    }

    /** Alternative-method editor */
    const handleAltChange = (
        stepIndex: number,
        altIndex: number,
        field: keyof AlternativeMethod,
        value: string
    ) => {
        const steps = module.steps.map((s, i) => {
            if (i !== stepIndex) return s
            const als = s.alternativeMethods.map((a, j) =>
                j === altIndex ? { ...a, [field]: value } : a
            )
            return { ...s, alternativeMethods: als }
        })
        onModuleChange({ ...module, steps })
    }

    const addAlternativeMethod = (stepIndex: number) => {
        const steps = module.steps.map((s, i) => {
            if (i !== stepIndex) return s
            return {
                ...s,
                alternativeMethods: [
                    ...s.alternativeMethods,
                    { title: 'New Method', description: '' }
                ]
            }
        })
        onModuleChange({ ...module, steps })
    }

    const removeAlternativeMethod = (stepIndex: number, altIndex: number) => {
        const steps = module.steps.map((s, i) => {
            if (i !== stepIndex) return s
            return {
                ...s,
                alternativeMethods: s.alternativeMethods.filter((_, j) => j !== altIndex)
            }
        })
        onModuleChange({ ...module, steps })
    }

    const addStep = () => {
        const newStep: ProcessStep = {
            title: 'New Step',
            description: '',
            start: 0,
            end: 0,
            checkpoint: null,
            alternativeMethods: []
        }
        onModuleChange({ ...module, steps: [...module.steps, newStep] })
    }

    const removeStep = (index: number) => {
        const steps = module.steps.filter((_, i) => i !== index)
        onModuleChange({ ...module, steps })
    }

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl space-y-6 animate-fade-in-up">
            {/* === Module Header === */}
            <div className="grid gap-6 md:grid-cols-2">
                <div>
                    <label className="block font-semibold mb-2">Module Title</label>
                    <input
                        type="text"
                        className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 bg-white dark:bg-slate-900 focus:outline-none"
                        value={module.title}
                        onChange={(e) => handleFieldChange('title', e.target.value)}
                    />
                </div>

                <div>
                    <label className="block font-semibold mb-2">Video URL</label>
                    <input
                        type="text"
                        className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 bg-white dark:bg-slate-900 focus:outline-none"
                        value={module.videoUrl}
                        onChange={(e) => handleFieldChange('videoUrl', e.target.value)}
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
                </div>
            </div>

            {/* === Steps Editor === */}
            <div>
                <h2 className="font-semibold mb-3">Process Steps</h2>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                    {module.steps.map((step, idx) => (
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
                                    <label className="block text-sm font-medium">
                                        Title
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-1 bg-white dark:bg-slate-900 focus:outline-none"
                                        value={step.title}
                                        onChange={(e) =>
                                            handleStepChange(idx, 'title', e.target.value)
                                        }
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium">
                                        Description
                                    </label>
                                    <textarea
                                        className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-1 h-20 bg-white dark:bg-slate-900 focus:outline-none"
                                        value={step.description}
                                        onChange={(e) =>
                                            handleStepChange(idx, 'description', e.target.value)
                                        }
                                    />
                                </div>
                            </div>

                            <div className="grid gap-4 grid-cols-2">
                                <div>
                                    <label className="block text-sm font-medium">
                                        Start (seconds)
                                    </label>
                                    <input
                                        type="number"
                                        className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-1 bg-white dark:bg-slate-900 focus:outline-none"
                                        value={step.start}
                                        onChange={(e) =>
                                            handleStepChange(idx, 'start', Number(e.target.value))
                                        }
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium">
                                        End (seconds)
                                    </label>
                                    <input
                                        type="number"
                                        className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-1 bg-white dark:bg-slate-900 focus:outline-none"
                                        value={step.end}
                                        onChange={(e) =>
                                            handleStepChange(idx, 'end', Number(e.target.value))
                                        }
                                    />
                                </div>
                            </div>

                            {/* Checkpoint */}
                            {step.checkpoint !== null && (
                                <div>
                                    <label className="block text-sm font-medium">
                                        Checkpoint Question
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full border border-slate-300 dark:border-slate-600 rounded px-3 py-1 bg-white dark:bg-slate-900 focus:outline-none"
                                        value={step.checkpoint}
                                        onChange={(e) =>
                                            handleStepChange(idx, 'checkpoint', e.target.value)
                                        }
                                    />
                                </div>
                            )}

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
                                                className="absolute top-1 right-1 text-red-500 hover:text-red-700"
                                            >
                                                <XIcon className="h-4 w-4" />
                                            </button>
                                            <input
                                                type="text"
                                                placeholder="Method title"
                                                className="w-full border border-slate-300 dark:border-slate-600 rounded px-2 py-1 mb-1 bg-white dark:bg-slate-900 focus:outline-none"
                                                value={alt.title}
                                                onChange={(e) =>
                                                    handleAltChange(idx, aIdx, 'title', e.target.value)
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
                                                        e.target.value
                                                    )
                                                }
                                            />
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => addAlternativeMethod(idx)}
                                        className="mt-2 inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800"
                                    >
                                        <LightbulbIcon className="h-4 w-4" /> Add alternative
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <button
                    onClick={addStep}
                    className="mt-4 inline-flex items-center gap-1 text-green-600 hover:text-green-800"
                >
                    <CheckCircleIcon className="h-5 w-5" /> Add Step
                </button>
            </div>

            {/* === Suggestions === */}
            {suggestions.length > 0 && (
                <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <h3 className="font-semibold mb-2">Pending Suggestions</h3>
                    <ul className="space-y-2">
                        {suggestions.map((s) => (
                            <li
                                key={s.id}
                                className="flex justify-between items-center p-2 bg-white dark:bg-slate-800 rounded-lg"
                            >
                                <span className="flex-1 italic">{s.text}</span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => onAcceptSuggestion?.(s)}
                                        className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                                    >
                                        Accept
                                    </button>
                                    <button
                                        onClick={() => onRejectSuggestion?.(s.id)}
                                        className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                                    >
                                        Reject
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    )
}
