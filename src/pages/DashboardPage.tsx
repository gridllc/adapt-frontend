
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAvailableModules } from '@/data/modules';
import { getQuestionFrequency, QuestionStats } from '@/services/analyticsService';
import { BarChartIcon, BookOpenIcon } from '@/components/Icons';
import type { TrainingModule } from '@/types';

const DashboardPage: React.FC = () => {
    const navigate = useNavigate();
    const [modules, setModules] = useState<TrainingModule[]>([]);
    const [selectedModuleId, setSelectedModuleId] = useState<string>('');
    const [questionStats, setQuestionStats] = useState<QuestionStats[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const availableModules = getAvailableModules();
        setModules(availableModules);
        if (availableModules.length > 0) {
            setSelectedModuleId(availableModules[0].slug);
        }
    }, []);

    useEffect(() => {
        if (selectedModuleId) {
            setIsLoading(true);
            const stats = getQuestionFrequency(selectedModuleId);
            setQuestionStats(stats);
            setIsLoading(false);
        } else {
            setQuestionStats([]);
        }
    }, [selectedModuleId]);

    const handleModuleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedModuleId(event.target.value);
    };

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
                <h2 className="text-xl font-bold text-indigo-400 mb-4">Most Common Trainee Questions</h2>
                <p className="text-slate-400 mb-6">Select a module to see which questions are asked most frequently by trainees. This can help identify areas where the training might be unclear.</p>
                
                <div className="mb-8">
                    <label htmlFor="module-select" className="block text-sm font-medium text-slate-300 mb-1">Select a Training Module</label>
                    <select
                        id="module-select"
                        value={selectedModuleId}
                        onChange={handleModuleChange}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={modules.length === 0}
                    >
                        {modules.length > 0 ? (
                            modules.map(module => (
                                <option key={module.slug} value={module.slug}>{module.title}</option>
                            ))
                        ) : (
                            <option>No modules available</option>
                        )}
                    </select>
                </div>

                {isLoading ? (
                    <div className="text-center text-slate-400">Loading stats...</div>
                ) : questionStats.length > 0 ? (
                    <div className="space-y-3">
                        {questionStats.map((stat, index) => (
                            <div key={index} className="bg-slate-900/50 p-4 rounded-lg flex items-center justify-between">
                                <p className="text-slate-200 italic">"{stat.question}"</p>
                                <span className="bg-indigo-600 text-white text-xs font-bold rounded-full px-3 py-1">{stat.count} {stat.count > 1 ? 'times' : 'time'}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center text-slate-500 bg-slate-900/50 p-6 rounded-lg">
                        No question data found for this module.
                    </div>
                )}
            </div>
        </div>
    );
};

export default DashboardPage;
