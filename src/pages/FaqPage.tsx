import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAvailableModules } from '@/services/moduleService';
import { getTutorLogs } from '@/services/analyticsService';
import { HelpCircleIcon } from '@/components/Icons';
import type { TutorLogRow, AppModuleWithStats } from '@/types';

const FaqPage: React.FC = () => {
    const [selectedModule, setSelectedModule] = useState<AppModuleWithStats | null>(null);

    const { data: availableModules = [], isLoading: isLoadingModules } = useQuery<AppModuleWithStats[], Error>({
        queryKey: ['modules'],
        queryFn: getAvailableModules,
    });

    const { data: tutorLogs = [], isLoading: isLoadingLogs } = useQuery<TutorLogRow[], Error>({
        queryKey: ['tutorLogs', selectedModule?.slug],
        queryFn: () => getTutorLogs(selectedModule!.slug!),
        enabled: !!selectedModule,
    });

    useEffect(() => {
        if (availableModules.length > 0 && !selectedModule) {
            setSelectedModule(availableModules[0]);
        }
    }, [availableModules, selectedModule]);

    const handleModuleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newSelectedModuleId = event.target.value;
        const module = availableModules.find(m => m.slug === newSelectedModuleId);
        setSelectedModule(module || null);
    };

    return (
        <div className="p-8">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white text-center mb-8 flex items-center gap-3 justify-center">
                <HelpCircleIcon className="h-8 w-8 text-indigo-500 dark:text-indigo-400" />
                Tutor Question Log
            </h1>

            <div className="bg-white dark:bg-slate-800/50 p-8 rounded-2xl shadow-xl animate-fade-in-up border border-slate-200 dark:border-slate-700">
                <div className="mb-6">
                    <label htmlFor="module-select" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Select Module to View Logs</label>
                    <select
                        id="module-select"
                        value={selectedModule?.slug || ''}
                        onChange={handleModuleChange}
                        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={availableModules.length === 0 || isLoadingModules}
                    >
                        {isLoadingModules && <option>Loading modules...</option>}
                        {!isLoadingModules && availableModules.map(module => (
                            <option key={module.slug} value={module.slug ?? ''}>{module.title}</option>
                        ))}
                        {!isLoadingModules && availableModules.length === 0 && <option>No modules available</option>}
                    </select>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-700">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Trainee Question</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">AI Response</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Step</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">Timestamp</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                            {isLoadingLogs ? (
                                <tr>
                                    <td colSpan={4} className="text-center p-6 text-slate-500 dark:text-slate-400">Loading logs...</td>
                                </tr>
                            ) : tutorLogs.length > 0 ? (
                                tutorLogs.map(log => (
                                    <tr key={log.id}>
                                        <td className="px-6 py-4 whitespace-normal text-sm text-slate-700 dark:text-slate-300 italic">&quot;{log.user_question}&quot;</td>
                                        <td className="px-6 py-4 whitespace-normal text-sm text-slate-500 dark:text-slate-400">{log.tutor_response.substring(0, 150)}...</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400 text-center">{log.step_index != null ? log.step_index + 1 : 'N/A'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{log.created_at ? new Date(log.created_at).toLocaleString() : 'N/A'}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="text-center p-6 text-slate-500 dark:text-slate-400">No questions have been logged for this module yet.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default FaqPage;