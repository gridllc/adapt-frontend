import React, { useCallback, useState } from 'react'
import type {
    AlternativeMethod,
    Suggestion,
    TranscriptLine,
    ProcessStep,
} from '@/types'
import type { Database } from '@/types/supabase'
import {
    XIcon,
    SparklesIcon,
    LightbulbIcon,
    CheckCircleIcon
} from '@/components/Icons'
import { VideoPlayer } from '@/components/VideoPlayer'
import { useToast } from '@/hooks/useToast'

type ModuleRow = Database['public']['Tables']['modules']['Row'];
type ModuleInsert = Database['public']['Tables']['modules']['Insert'];

interface ModuleEditorProps {
    module: ModuleRow | ModuleInsert
    onModuleChange: (module: ModuleRow | ModuleInsert) => void
    suggestions?: Suggestion[]
    onAcceptSuggestion?: (suggestion: Suggestion) => void
    onRejectSuggestion?: (suggestionId: string) => void
    onAnalyze?: () => void
    isAnalyzing?: boolean
    showAnalysisButton: boolean
}

const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const date = new Date(0);
    date.setSeconds(seconds);
    return date.toISOString().substr(14, 5); // MM:SS
};


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
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [openTranscripts, setOpenTranscripts] = useState<Record<number, boolean>>({});

    const steps = (module.steps as ProcessStep[]) || [];
    const transcript = (module.transcript as TranscriptLine[]) || [];

    const toggleTranscript = useCallback((index: number) => {
        setOpenTranscripts(prev => ({ ...prev, [index]: !prev[index] }));
    }, []);

    // Top-level field updater (title, video_url, etc.)
    const handleFieldChange = useCallback(
        (field: keyof ModuleInsert, value: string) => {
            // Prevent persisting blob URLs
            if (field === 'video_url' && value.startsWith('blob:')) {
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
    );

    // Update a single field on one step
    const handleStepChange = useCallback(
        (
            index: number,
            field: keyof ProcessStep,
            value: string | number | null
        ) => {
            const newSteps = steps.map((s, i) =>
                i === index ? { ...s, [field]: value } : s
            )
            onModuleChange({ ...module, steps: newSteps })
        },
        [module, onModuleChange, steps]
    );

    const handleTranscriptChange = useCallback((lineIndex: number, newText: string) => {
        if (!transcript) return;

        const newTranscript = transcript.map((line, index) =>
            index === lineIndex ? { ...line, text: newText } : line
        );
        onModuleChange({ ...module, transcript: newTranscript });
    }, [module, onModuleChange, transcript]);

    // Update an alternative method on a step
    const handleAltChange = useCallback(
        (
            stepIndex: number,
            altIndex: number,
            field: keyof AlternativeMethod,
            value: string
        ) => {
            const newSteps = steps.map((s, i) => {
                if (i !== stepIndex) return s
                const alternativeMethods = s.alternativeMethods.map((a, j) =>
                    j === altIndex ? { ...a, [field]: value } : a
                )
                return { ...s, alternativeMethods }
            })
            onModuleChange({ ...module, steps: newSteps })
        },
        [module, onModuleChange, steps]
    )

    // Add / remove alternative methods
    const addAlternativeMethod = useCallback(
        (stepIndex: number) => {
            const newSteps = steps.map((s, i) =>
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
            onModuleChange({ ...module, steps: newSteps })
        },
        [module, onModuleChange, steps]
    )

    const removeAlternativeMethod = useCallback(
        (stepIndex: number, altIndex: number) => {
            const newSteps = steps.map((s, i) =>
                i === stepIndex
                    ? {
                        ...s,
                        alternativeMethods: s.alternativeMethods.filter(
                            (_, j) => j !== altIndex
                        )
                    }
                    : s
            )
            onModuleChange({ ...module, steps: newSteps })
        },
        [module, onModuleChange, steps]
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
        onModuleChange({ ...module, steps: [...steps, newStep] })
    }, [module, onModuleChange, steps])

    const removeStep = useCallback(
        (index: number) => {
            const newSteps = steps.filter((_, i) => i !== index)
            onModuleChange({ ...module, steps: newSteps })
        },
        [module, onModuleChange, steps]
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
                        value={module.video_url || ''}
                        onChange={(e) =>
                            handleFieldChange('video_url', e.currentTarget.value)
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
                    {module.video_url && (
                        <div className="mt-4">
                            <VideoPlayer
                                video_url={module.video_url}
                                onTimeUpdate={() => { }}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* === Steps Editor === */}
            <div>
                <div className="flex justify-between items-center mb-3">
                    <h2 className="font-semibold text-lg">Process Steps</h2>
                    {suggestions.length > 0 && (
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="show-suggestions-toggle"
                                checked={showSuggestions}
                                onChange={() => setShowSuggestions(!showSuggestions)}
                                className="h-4 w-4 rounded border-slate-300 dark:border-slate-500 text-indigo-600 focus:ring-indigo-500"
                            />
                            <label htmlFor="show-suggestions-toggle" className="text-sm font-medium text-slate-700 dark:text-slate-300 select-none">
                                Show Trainee Suggestions
                            </label>
                        </div>
                    )}
                </div>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto p-1">
                    {steps.map((step, idx) => {
                        const stepSuggestions = suggestions.filter(
                            (s) => s.stepIndex === idx
                        );

                        // We need the original index to update the correct line
                        const stepTranscriptLines = transcript
                            .map((line, index) => ({ ...line, originalIndex: index }))
                            .filter(line => line.start >= step.start && line.end <= step.end && step.end > step.start);

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
                                        placeholder="e.g., How many screws did you use?"
                                    />
                                </div>

                                {/* Alternative Methods */}
                                {step.alternativeMethods.map((alt, aIdx) => (
                                    <div
                                        key={aIdx}
                                        className="p-2 bg-white dark:bg-slate-800 rounded-lg relative"
                                    >
                                        <button
                                            onClick={() =>
                                                removeAlternativeMethod(idx, aIdx)
                                            }
                                            className="absolute top-1 right-1 text-red-500 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50"
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
                                    className="mt-2 inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-sm"
                                >
                                    <LightbulbIcon className="h-4 w-4" />
                                    Add alternative method
                                </button>

                                {/* Transcript for this step */}
                                {transcript && transcript.length > 0 && step.end > step.start && (
                                    <div>
                                        <button onClick={() => toggleTranscript(idx)} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline mt-2">
                                            {openTranscripts[idx] ? 'Hide' : 'Show'} Original Transcript ({stepTranscriptLines.length} lines)
                                        </button>
                                        {openTranscripts[idx] && (
                                            <div className="mt-2 p-3 bg-white dark:bg-slate-800/50 rounded-md border border-slate-200 dark:border-slate-700 max-h-40 overflow-y-auto space-y-2">
                                                {stepTranscriptLines.length > 0 ? (
                                                    stepTranscriptLines.map((line) => (
                                                        <div key={line.originalIndex} className="flex items-start gap-3">
                                                            <span className="font-mono text-xs text-indigo-500 dark:text-indigo-300 pt-1.5 whitespace-nowrap">[{formatTime(line.start)}]</span>
                                                            <textarea
                                                                value={line.text}
                                                                onChange={(e) => handleTranscriptChange(line.originalIndex, e.target.value)}
                                                                className="w-full text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700/50 p-1 rounded-md border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                                rows={2}
                                                            />
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="text-xs text-slate-500 italic">No transcript lines fall within this step's time range.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}


                                {/* Suggestions for this step */}
                                {showSuggestions && stepSuggestions.length > 0 && (
                                    <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                        <h4 className="font-semibold mb-2">Trainee Suggestions</h4>
                                        {stepSuggestions.map((sug) => (
                                            <div
                                                key={sug.id}
                                                className="flex justify-between items-center mb-2"
                                            >
                                                <span className="italic flex-1 text-sm text-slate-800 dark:text-slate-200">"{sug.text}"</span>
                                                <div className="flex gap-2 ml-4">
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
                        className="mt-4 inline-flex items-center gap-2 text-green-600 hover:text-green-800 font-semibold"
                    >
                        <CheckCircleIcon className="h-5 w-5" /> Add Step
                    </button>
                </div>
            </div>
        </div>
    )
}