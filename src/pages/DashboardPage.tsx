
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAvailableModules, saveUploadedModule } from '@/data/modules';
import { getQuestionFrequency, findHotspots, QuestionStats } from '@/services/analyticsService';
import { generateRefinementSuggestion } from '@/services/geminiService';
import { BarChartIcon, BookOpenIcon, LightbulbIcon, SparklesIcon } from '@/components/Icons';
import { RefinementModal } from '@/components/RefinementModal';
import type { TrainingModule, AnalysisHotspot, RefinementSuggestion, ProcessStep } from '@/types';

const DashboardPage: React.FC = () => {
    const navigate = useNavigate();
    const [modules, setModules] = useState<TrainingModule[]>([]);
    const [selectedModule, setSelectedModule] = useState<TrainingModule | null>(null);
    const [questionStats, setQuestionStats] = useState<QuestionStats[]>([]);
    const [hotspot, setHotspot] = useState<AnalysisHotspot | null>(null);
    const [refinement, setRefinement] = useState<RefinementSuggestion | null>(null);
    const [isRefining, setIsRefining] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        const availableModules = getAvailableModules();
        setModules(availableModules);
        if (availableModules.length > 0) {
            setSelectedModule(availableModules[0]);
        }
    }, []);

    useEffect(() => {
        const analyzeModule = async () => {
            if (!selectedModule) {
                setQuestionStats([]);
                setHotspot(null);
                setRefinement(null);
                return;
            }

            // Reset state for new module
            setHotspot(null);
            setRefinement(null);
            setIsRefining(true);

            // 1. Get question frequency
            const stats = getQuestionFrequency(selectedModule.slug);
            setQuestionStats(stats);

            // 2. Find the biggest point of confusion ("hotspot")
            const foundHotspot = findHotspots(stats, selectedModule);
            setHotspot(foundHotspot);

            // 3. If a hotspot is found, ask the AI for a refinement suggestion
            if (foundHotspot) {
                try {
                    const stepToRefine = selectedModule.steps[foundHotspot.stepIndex];
                    if (stepToRefine) {
                        const suggestion = await generateRefinementSuggestion(stepToRefine, foundHotspot.questions);
                        setRefinement(suggestion);
                    }
                } catch (error) {
                    console.error("Failed to get AI refinement:", error);
                    // Silently fail, don't show an error to the user for this background task
                }
            }
            setIsRefining(false);
        };

        analyzeModule();
    }, [selectedModule]);

    const handleModuleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newSelectedModuleId = event.target.value;
        const module = modules.find(m => m.slug === newSelectedModuleId);
        setSelectedModule(module || null);
    };

    const handleApplyRefinement = useCallback(() => {
        if (!selectedModule || !hotspot || !refinement) return;

        const updatedModule = { ...selectedModule };
        const newSteps = [...updatedModule.steps];
        const stepToUpdate: ProcessStep = { ...newSteps[hotspot.stepIndex] };

        // Apply changes
        stepToUpdate.description = refinement.newDescription;
        if (refinement.newAlternativeMethod) {
            stepToUpdate.alternativeMethods = [
                ...stepToUpdate.alternativeMethods,
                refinement.newAlternativeMethod
            ];
        }

        newSteps[hotspot.stepIndex] = stepToUpdate;
        updatedModule.steps = newSteps;

        // Save the updated module and navigate to the editor for final review
        if (saveUploadedModule(updatedModule)) {
            navigate(`/modules/${updatedModule.slug}/edit`);
        } else {
            alert("Failed to apply changes. Please try again.");
        }

        setIsModalOpen(false);

    }, [selectedModule, hotspot, refinement, navigate]);

    return (
        <div className="max-w-4xl mx-auto p-8">
            <header className="flex justify-between items-center mb-8">
                <button onClick={() => navigate('/')} className="text-slate-300 hover:text-indigo-400 transition-colors flex items-center gap-2">
                    <BookOpenIcon className="h-5 w-5" />
                    <span>Back to Home</span>
                </button>
                <h1 className="text-3xl font-bold text-white text-center flex items-center gap-3">
                    <BarChartIcon className="h-8 w-8 text-indigo-400" />
                    Analytics Dashboard
                </h1>
                <span className="w-40"></span>
            </header>

            <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl animate-fade-in-up border border-slate-700">
                <h2 className="text-xl font-bold text-indigo-400 mb-4">Module Performance</h2>
                <p className="text-slate-400 mb-6">Select a module to see trainee question patterns and AI-driven suggestions for improvement.</p>

                <div className="mb-8">
                    <label htmlFor="module-select" className="block text-sm font-medium text-slate-300 mb-1">Select a Training Module</label>
                    <select
                        id="module-select"
                        value={selectedModule?.slug || ''}
                        onChange={handleModuleChange}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={modules.length === 0}
                    >
                        {modules.map(module => (
                            <option key={module.slug} value={module.slug}>{module.title}</option>
                        ))}
                        {modules.length === 0 && <option>No modules available</option>}
                    </select>
                </div>

                {/* AI Refinement Section */}
                {isRefining && (
                    <div className="text-center p-6 bg-slate-900/50 rounded-lg">
                        <SparklesIcon className="h-8 w-8 mx-auto text-indigo-400 animate-pulse" />
                        <p className="mt-2 text-slate-300">AI is analyzing trainee data...</p>
                    </div>
                )}

                {!isRefining && hotspot && refinement && (
                    <div className="bg-gradient-to-br from-indigo-900/70 to-slate-900/50 p-6 rounded-xl border border-indigo-700 mb-8 animate-fade-in-up">
                        <div className="flex items-center gap-3 mb-4">
                            <LightbulbIcon className="h-8 w-8 text-yellow-400 flex-shrink-0" />
                            <div>
                                <h3 className="text-lg font-bold text-yellow-300">AI Refinement Suggestion</h3>
                                <p className="text-sm text-indigo-200">The AI found a point of confusion and suggests this improvement.</p>
                            </div>
                        </div>

                        <div className="bg-slate-900/60 p-4 rounded-lg">
                            <p className="text-xs text-slate-400 font-semibold uppercase">Confusing Step</p>
                            <p className="text-md font-bold text-slate-200 mb-3">{hotspot.stepTitle}</p>

                            <p className="text-xs text-slate-400 font-semibold uppercase">Common Questions</p>
                            <ul className="list-disc list-inside text-sm text-slate-300 mb-4">
                                {hotspot.questions.slice(0, 3).map((q, i) => <li key={i} className="italic truncate">"{q}"</li>)}
                            </ul>

                            <p className="text-xs text-slate-400 font-semibold uppercase">Suggested New Description</p>
                            <p className="text-sm text-slate-200 bg-slate-800 p-2 rounded-md">"{refinement.newDescription}"</p>
                        </div>

                        <div className="text-center mt-4">
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-indigo-700 transition-colors transform hover:scale-105"
                            >
                                Preview & Apply
                            </button>
                        </div>
                    </div>
                )}

                {/* Question Frequency Section */}
                <h3 className="text-lg font-bold text-indigo-400 mb-4">All Common Questions</h3>
                {questionStats.length > 0 ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                        {questionStats.map((stat, index) => (
                            <div key={index} className="bg-slate-900/50 p-4 rounded-lg flex items-center justify-between">
                                <p className="text-slate-200 italic">"{stat.question}"</p>
                                <span className="bg-indigo-600 text-white text-xs font-bold rounded-full px-3 py-1 flex-shrink-0 ml-4">{stat.count} {stat.count > 1 ? 'times' : 'time'}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center text-slate-500 bg-slate-900/50 p-6 rounded-lg">
                        {!isRefining && "No question data found for this module."}
                    </div>
                )}
            </div>

            {isModalOpen && hotspot && refinement && selectedModule && (
                <RefinementModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    currentStep={selectedModule.steps[hotspot.stepIndex]}
                    suggestion={refinement}
                    onApply={handleApplyRefinement}
                />
            )}
        </div>
    );
};

export default DashboardPage;
