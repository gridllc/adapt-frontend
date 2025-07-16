import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAvailableModules, saveModule } from '@/services/moduleService';
import { getQuestionFrequency, findHotspots } from '@/services/analyticsService';
import { generateRefinementSuggestion, generateBranchModule } from '@/services/geminiService';
import { saveAiSuggestion, getLatestAiSuggestionForStep } from '@/services/suggestionsService';
import { BarChartIcon, BookOpenIcon, LightbulbIcon, SparklesIcon, GitBranchIcon } from '@/components/Icons';
import { RefinementModal } from '@/components/RefinementModal';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import type { AnalysisHotspot, RefinementSuggestion, ProcessStep, QuestionStats, AiSuggestion } from '@/types';
import type { Database } from '@/types/supabase';

type ModuleRow = Database['public']['Tables']['modules']['Row'];
type ModuleInsert = Database['public']['Tables']['modules']['Insert'];


const DashboardPage: React.FC = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const { addToast } = useToast();
    const [modules, setModules] = useState<ModuleRow[]>([]);
    const [selectedModule, setSelectedModule] = useState<ModuleRow | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // State to hold the suggestion for the modal. It can be from cache or newly generated.
    const [activeSuggestion, setActiveSuggestion] = useState<RefinementSuggestion | null>(null);

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

    const questionStats: QuestionStats[] = analysisData?.stats ?? [];
    const hotspot: AnalysisHotspot | null = analysisData?.hotspot ?? null;

    // New query to check for an existing suggestion for the hotspot
    const { data: existingAiSuggestion, isLoading: isLoadingExistingSuggestion } = useQuery<AiSuggestion | null, Error>({
        queryKey: ['aiSuggestion', selectedModule?.slug, hotspot?.stepIndex],
        queryFn: () => {
            if (!hotspot || !selectedModule) return null;
            return getLatestAiSuggestionForStep(selectedModule.slug, hotspot.stepIndex);
        },
        enabled: !!hotspot && !!selectedModule,
    });

    const refinementMutation = useMutation({
        mutationFn: async ({ step, questions }: { step: ProcessStep; questions: string[] }) => {
            const suggestion = await generateRefinementSuggestion(step, questions);
            if (selectedModule?.slug && user?.id && hotspot) {
                await saveAiSuggestion({
                    moduleId: selectedModule.slug,
                    stepIndex: hotspot.stepIndex,
                    originalInstruction: step.description,
                    suggestion: suggestion.newDescription,
                    sourceQuestions: questions,
                });
            }
            return suggestion;
        },
        onSuccess: (data) => {
            addToast('success', 'Suggestion Ready', 'The AI has generated and saved a refinement suggestion.');
            // Invalidate the query for existing suggestions so it shows up next time
            queryClient.invalidateQueries({ queryKey: ['aiSuggestion', selectedModule?.slug, hotspot?.stepIndex] });
        },
        onError: (error) => {
            addToast('error', 'Suggestion Failed', error.message);
        },
    });

    // --- New Mutation for Branch Module Generation ---
    const branchModuleMutation = useMutation({
        mutationFn: async ({ stepTitle, questions }: { stepTitle: string; questions: string[] }) => {
            if (!user) throw new Error("Authentication required.");
            const generatedData = await generateBranchModule(stepTitle, questions);

            // Transform the AI output into a savable module structure
            const newModuleSlug = generatedData.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            const newSteps: ProcessStep[] = generatedData.steps.map((desc, index) => ({
                title: `Step ${index + 1}`,
                description: desc,
                start: 0,
                end: 0,
                checkpoint: null,
                alternativeMethods: [],
            }));

            const newModule: ModuleInsert = {
                slug: newModuleSlug,
                title: generatedData.title,
                steps: newSteps,
                user_id: user.id,
                metadata: { generated_by_ai: true, source_module: selectedModule?.slug, source_step: hotspot?.stepIndex }
            };

            await saveModule({ moduleData: newModule });
            return newModule;
        },
        onSuccess: (data) => {
            addToast('success', 'Remedial Module Created', `"${data.title}" has been saved. You can now edit and link it.`);
            queryClient.invalidateQueries({ queryKey: ['modules'] }); // Refresh the main module list
        },
        onError: (error) => {
            addToast('error', 'Module Drafting Failed', error.message);
        }
    });

    const handleGenerateSuggestion = () => {
        if (!hotspot || !selectedModule) return;

        const stepToRefine = (selectedModule.steps as ProcessStep[])?.[hotspot.stepIndex];
        if (stepToRefine) {
            refinementMutation.mutate({ step: stepToRefine, questions: hotspot.questions });
        } else {
            addToast('error', 'Data Inconsistency', 'Could not find the step to refine in the module data.');
        }
    };

    const handleGenerateBranchModule = () => {
        if (!hotspot) return;
        branchModuleMutation.mutate({ stepTitle: hotspot.stepTitle, questions: hotspot.questions });
    };

    const openSuggestionModal = (suggestion: RefinementSuggestion) => {
        setActiveSuggestion(suggestion);
        setIsModalOpen(true);
    };

    const handleApplyRefinement = useCallback(async () => {
        if (!selectedModule || !hotspot || !activeSuggestion) {
            addToast('error', 'Cannot Apply', 'Could not apply refinement. Missing required data.');
            return;
        }

        navigate(`/modules/${selectedModule.slug}/edit`, {
            state: {
                suggestion: activeSuggestion.newDescription,
                stepIndex: hotspot.stepIndex
            }
        });

        setIsModalOpen(false);
    }, [selectedModule, hotspot, activeSuggestion, navigate, addToast]);


    const handleModuleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newSelectedModuleId = event.target.value;
        const module = modules.find(m => m.slug === newSelectedModuleId);
        setSelectedModule(module || null);
    };

    const newAiSuggestion = refinementMutation.data;

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

                        <div className="flex flex-wrap justify-center items-center gap-4 mt-4">
                            {isLoadingExistingSuggestion ? (
                                <p className="text-sm text-slate-600 dark:text-slate-300">Checking for existing suggestions...</p>
                            ) : existingAiSuggestion ? (
                                <div className="animate-fade-in-up">
                                    <p className="text-sm text-green-700 dark:text-green-300 mb-2 text-center">
                                        Existing suggestion found.
                                    </p>
                                    <button
                                        onClick={() => openSuggestionModal({ newDescription: existingAiSuggestion.suggestion, newAlternativeMethod: null })}
                                        className="bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700 transition-colors transform hover:scale-105"
                                    >
                                        Preview & Apply Fix
                                    </button>
                                </div>
                            ) : newAiSuggestion ? (
                                <div className="animate-fade-in-up">
                                    <p className="text-sm text-green-700 dark:text-green-300 mb-2 text-center">Suggestion generated!</p>
                                    <button
                                        onClick={() => openSuggestionModal(newAiSuggestion)}
                                        className="bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700 transition-colors transform hover:scale-105"
                                    >
                                        Preview & Apply Fix
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={handleGenerateSuggestion}
                                    disabled={refinementMutation.isPending}
                                    className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 transition-colors transform hover:scale-105 disabled:opacity-50 flex items-center gap-2"
                                >
                                    <SparklesIcon className="h-5 w-5" />
                                    {refinementMutation.isPending ? 'Generating...' : 'Refine This Step'}
                                </button>
                            )}

                            <button
                                onClick={handleGenerateBranchModule}
                                disabled={branchModuleMutation.isPending}
                                className="bg-cyan-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-cyan-700 transition-colors transform hover:scale-105 disabled:opacity-50 flex items-center gap-2"
                            >
                                <GitBranchIcon className="h-5 w-5" />
                                {branchModuleMutation.isPending ? 'Drafting...' : 'Draft Remedial Module'}
                            </button>
                        </div>
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

            {isModalOpen && hotspot && activeSuggestion && selectedModule && (
                <RefinementModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    currentStep={(selectedModule.steps as ProcessStep[])[hotspot.stepIndex]}
                    suggestion={activeSuggestion}
                    onApply={handleApplyRefinement}
                />
            )}
        </div>
    );
};

export default DashboardPage;