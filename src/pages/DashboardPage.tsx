import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAvailableModules } from '@/services/moduleService';
import { getQuestionFrequency, findHotspots } from '@/services/analyticsService';
import { generateRefinementSuggestion } from '@/services/geminiService';
import { saveAiSuggestion } from '@/services/suggestionsService';
import { BarChartIcon, BookOpenIcon, LightbulbIcon, SparklesIcon } from '@/components/Icons';
import { RefinementModal } from '@/components/RefinementModal';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import type { AnalysisHotspot, RefinementSuggestion, ProcessStep, QuestionStats } from '@/types';
import type { Database } from '@/types/supabase';

type ModuleRow = Database['public']['Tables']['modules']['Row'];

const DashboardPage: React.FC = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const { addToast } = useToast();
    const [modules, setModules] = useState<ModuleRow[]>([]);
    const [selectedModule, setSelectedModule] = useState<ModuleRow | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [refinement, setRefinement] = useState<RefinementSuggestion | null>(null);

    const { data: availableModules, isLoading: isLoadingModules } = useQuery<ModuleRow[], Error>({
        queryKey: ['modules'],
        queryFn: getAvailableModules,
    });

    useEffect(() => {
        if (availableModules) {
            setModules(availableModules);
            if (availableModules.length > 0 && !selectedModule) {
                setSelectedModule(availableModules[0]);
            }
        }
    }, [availableModules, selectedModule]);

    const { data: analysisData, isLoading: isAnalyzing } = useQuery<{ stats: QuestionStats[]; hotspot: AnalysisHotspot | null }, Error>({
        queryKey: ['dashboardAnalysis', selectedModule?.slug],
        queryFn: async () => {
            if (!selectedModule) return { stats: [], hotspot: null };

            const stats = await getQuestionFrequency(selectedModule.slug);
            const hotspot = findHotspots(stats, selectedModule);

            return { stats, hotspot };
        },
        enabled: !!selectedModule,
    });

    useEffect(() => {
        // Reset refinement when the selected module changes
        setRefinement(null);
    }, [selectedModule]);


    const questionStats: QuestionStats[] = analysisData?.stats ?? [];
    const hotspot: AnalysisHotspot | null = analysisData?.hotspot ?? null;

    const refinementMutation = useMutation({
        mutationFn: async ({ step, questions }: { step: ProcessStep; questions: string[] }) => {
            const suggestion = await generateRefinementSuggestion(step, questions);
            // After generating, immediately save it to the new persistent table.
            if (selectedModule?.slug && user?.id) {
                await saveAiSuggestion({
                    moduleId: selectedModule.slug,
                    stepIndex: hotspot!.stepIndex,
                    originalInstruction: step.description,
                    suggestion: suggestion.newDescription,
                    sourceQuestions: questions,
                });
            }
            return suggestion;
        },
        onSuccess: (data) => {
            setRefinement(data);
            addToast('success', 'Suggestion Ready', 'The AI has generated and saved a refinement suggestion.');
            queryClient.invalidateQueries({ queryKey: ['aiSuggestions', selectedModule?.slug] });
        },
        onError: (error) => {
            addToast('error', 'Suggestion Failed', error.message);
        },
    });

    const handleGenerateSuggestion = () => {
        if (!hotspot || !selectedModule) return;
        const stepToRefine = (selectedModule.steps as ProcessStep[])[hotspot.stepIndex];
        if (stepToRefine) {
            refinementMutation.mutate({ step: stepToRefine, questions: hotspot.questions });
        }
    };

    const handleModuleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newSelectedModuleId = event.target.value;
        const module = modules.find(m => m.slug === newSelectedModuleId);
        setSelectedModule(module || null);
    };

    const handleApplyRefinement = useCallback(async () => {
        if (!selectedModule || !hotspot || !refinement) {
            addToast('error', 'Cannot Apply', `Could not apply refinement. Missing required data.`);
            return;
        }

        // This function now only navigates. The suggestion is already saved.
        // The editor will pick it up from the database.
        addToast('info', 'Applying Suggestion', 'Redirecting to the editor to apply the fix.');
        navigate(`/modules/${selectedModule.slug}/edit`);

        setIsModalOpen(false);

    }, [selectedModule, hotspot, refinement, navigate, addToast]);

    return (
        <div className="max-w-4xl mx-auto p-8">
            <header className="flex justify-between items-center mb-8">
                <button onClick={() => navigate('/')} className="text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-2">
                    <BookOpenIcon className="h-5 w-5" />
                    <span>Back to Home</span>
                </button>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white text-center flex items-center gap-3">
                    <BarChartIcon className="h-8 w-8 text-indigo-500 dark:text-indigo-400" />
                    Analytics Dashboard
                </h1>
                <span className="w-40"></span>
            </header>

            <div className="bg-slate-100 dark:bg-slate-800 p-8 rounded-2xl shadow-xl animate-fade-in-up border border-slate-200 dark:border-slate-700">
                <h2 className="text-xl font-bold text-indigo-500 dark:text-indigo-400 mb-4">Module Performance</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-6">Select a module to see trainee question patterns and AI-driven suggestions for improvement.</p>

                <div className="mb-8">
                    <label htmlFor="module-select" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Select a Training Module</label>
                    <select
                        id="module-select"
                        value={selectedModule?.slug || ''}
                        onChange={handleModuleChange}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={modules.length === 0 || isLoadingModules}
                    >
                        {isLoadingModules && <option>Loading modules...</option>}
                        {!isLoadingModules && modules.map(module => (
                            <option key={module.slug} value={module.slug}>{module.title}</option>
                        ))}
                        {!isLoadingModules && modules.length === 0 && <option>No modules available</option>}
                    </select>
                </div>

                {/* AI Refinement Section */}
                {isAnalyzing && (
                    <div className="text-center p-6 bg-slate-200 dark:bg-slate-900/50 rounded-lg">
                        <SparklesIcon className="h-8 w-8 mx-auto text-indigo-500 dark:text-indigo-400 animate-pulse" />
                        <p className="mt-2 text-slate-600 dark:text-slate-300">AI is analyzing trainee data...</p>
                    </div>
                )}

                {!isAnalyzing && hotspot && (
                    <div className="bg-gradient-to-br from-indigo-200 dark:from-indigo-900/70 to-slate-200/50 dark:to-slate-900/50 p-6 rounded-xl border border-indigo-300 dark:border-indigo-700 mb-8 animate-fade-in-up">
                        <div className="flex items-center gap-3 mb-4">
                            <LightbulbIcon className="h-8 w-8 text-yellow-500 dark:text-yellow-400 flex-shrink-0" />
                            <div>
                                <h3 className="text-lg font-bold text-yellow-700 dark:text-yellow-300">Top Confusion Hotspot</h3>
                                <p className="text-sm text-indigo-800 dark:text-indigo-200">The AI found a point of confusion and can suggest an improvement.</p>
                            </div>
                        </div>

                        <div className="bg-white/60 dark:bg-slate-900/60 p-4 rounded-lg">
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">Confusing Step</p>
                            <p className="text-md font-bold text-slate-800 dark:text-slate-200 mb-3">{hotspot.stepTitle}</p>

                            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">Common Questions</p>
                            <ul className="list-disc list-inside text-sm text-slate-700 dark:text-slate-300 mb-4">
                                {hotspot.questions.slice(0, 3).map((q, i) => <li key={i} className="italic truncate">"{q}"</li>)}
                            </ul>
                        </div>

                        {!refinement && (
                            <div className="text-center mt-4">
                                <button
                                    onClick={handleGenerateSuggestion}
                                    disabled={refinementMutation.isPending}
                                    className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 transition-colors transform hover:scale-105 disabled:opacity-50"
                                >
                                    {refinementMutation.isPending ? 'Generating...' : 'Generate AI Suggestion'}
                                </button>
                            </div>
                        )}

                        {refinement && (
                            <div className="text-center mt-4 animate-fade-in-up">
                                <p className="text-sm text-green-700 dark:text-green-300 mb-2">Suggestion generated!</p>
                                <button
                                    onClick={() => setIsModalOpen(true)}
                                    className="bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700 transition-colors transform hover:scale-105"
                                >
                                    Preview & Apply
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Question Frequency Section */}
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-indigo-500 dark:text-indigo-400">Common Questions</h3>
                    <Link to="/dashboard/questions" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline font-semibold">
                        View Full Log &rarr;
                    </Link>
                </div>

                {questionStats.length > 0 ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                        {questionStats.map((stat, index) => (
                            <Link
                                key={index}
                                to={`/dashboard/questions/${selectedModule?.slug}/${stat.stepIndex}/${encodeURIComponent(stat.question)}`}
                                className="block bg-slate-200 dark:bg-slate-900/50 p-4 rounded-lg flex items-center justify-between hover:ring-2 hover:ring-indigo-500 transition-all"
                            >
                                <p className="text-slate-800 dark:text-slate-200 italic">"{stat.question}"</p>
                                <span className="bg-indigo-600 text-white text-xs font-bold rounded-full px-3 py-1 flex-shrink-0 ml-4">{stat.count} {stat.count > 1 ? 'times' : 'time'}</span>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="text-center text-slate-500 bg-slate-200 dark:bg-slate-900/50 p-6 rounded-lg">
                        {!isAnalyzing && "No question data found for this module."}
                    </div>
                )}
            </div>

            {isModalOpen && hotspot && refinement && selectedModule && (
                <RefinementModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    currentStep={(selectedModule.steps as ProcessStep[])[hotspot.stepIndex]}
                    suggestion={refinement}
                    onApply={handleApplyRefinement}
                />
            )}
        </div>
    );
};

export default DashboardPage;