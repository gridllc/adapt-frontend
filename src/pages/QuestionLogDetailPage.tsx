import React, { useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getQuestionLogsByQuestion } from '@/services/analyticsService';
import { getLatestAiSuggestionForStep } from '@/services/suggestionsService';
import { flagQuestion } from '@/services/flaggingService';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { BookOpenIcon, HelpCircleIcon, AlertTriangleIcon, SparklesIcon, CheckCircleIcon } from '@/components/Icons';

const QuestionLogDetailPage: React.FC = () => {
    const { moduleId = '', stepIndex = '0', encodedQuestion = '' } = useParams();
    const userQuestion = decodeURIComponent(encodedQuestion);
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const { addToast } = useToast();

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [showFlagFormId, setShowFlagFormId] = useState<string | null>(null);
    const [flagComment, setFlagComment] = useState('');

    const { data: logs, isLoading, error } = useQuery({
        queryKey: ['questionLogs', moduleId, stepIndex, userQuestion, startDate, endDate],
        queryFn: () => getQuestionLogsByQuestion({
            moduleId,
            stepIndex: Number(stepIndex),
            question: userQuestion,
            startDate,
            endDate,
        }),
        enabled: !!moduleId && !!userQuestion,
    });

    const { data: aiSuggestion } = useQuery({
        queryKey: ['latestAiSuggestion', moduleId, stepIndex],
        queryFn: () => getLatestAiSuggestionForStep(moduleId, Number(stepIndex)),
        enabled: !!moduleId && !!user,
    });
    
    const flagMutation = useMutation({
        mutationFn: (logId: string) => {
            if (!user) throw new Error("User not authenticated");
            return flagQuestion({
                module_id: moduleId,
                step_index: Number(stepIndex),
                user_question: userQuestion,
                comment: flagComment,
                user_id: user.id,
            });
        },
        onSuccess: () => {
            addToast('success', 'Question Flagged', 'The question has been marked for review.');
            setFlagComment('');
            setShowFlagFormId(null);
            // Optionally, you could invalidate a query for flagged questions here if you display them.
        },
        onError: (err) => {
            addToast('error', 'Flagging Failed', err instanceof Error ? err.message : 'An unknown error occurred.');
        }
    });

    const handleProposeFix = useCallback((tutorResponse: string) => {
        navigate(`/modules/${moduleId}/edit`, {
            state: {
                suggestion: tutorResponse,
                stepIndex: Number(stepIndex),
            },
        });
    }, [navigate, moduleId, stepIndex]);

    return (
        <div className="max-w-4xl mx-auto p-8">
            <header className="flex justify-between items-center mb-8">
                <Link to="/dashboard" className="text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-2">
                    <BookOpenIcon className="h-5 w-5" />
                    <span>Back to Dashboard</span>
                </Link>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white text-center flex items-center gap-3">
                    <HelpCircleIcon className="h-8 w-8 text-indigo-500 dark:text-indigo-400" />
                    Question Log
                </h1>
                <span className="w-40"></span>
            </header>

            <div className="bg-slate-100 dark:bg-slate-800 p-8 rounded-2xl shadow-xl animate-fade-in-up border border-slate-200 dark:border-slate-700">
                <div className="mb-6">
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">History for question:</h2>
                    <p className="text-lg italic text-indigo-600 dark:text-indigo-300">"{userQuestion}"</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Asked in Step {Number(stepIndex) + 1}</p>
                </div>
                
                {/* AI Suggestion Display */}
                {aiSuggestion && (
                     <div className="bg-yellow-100 dark:bg-yellow-900/30 p-4 rounded-lg border border-yellow-200 dark:border-yellow-700 animate-fade-in-up mb-6">
                        <h4 className="flex items-center gap-2 font-bold text-yellow-800 dark:text-yellow-300 mb-2">
                            <SparklesIcon className="h-5 w-5"/>
                            AI-Suggested Fix for this Step
                        </h4>
                        <p className="text-yellow-800 dark:text-yellow-200 italic mb-2">"{aiSuggestion.suggestion}"</p>
                        <button
                            onClick={() => handleProposeFix(aiSuggestion.suggestion)}
                            className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 text-xs font-semibold flex items-center gap-1.5"
                        >
                            <CheckCircleIcon className="h-4 w-4" /> Apply This Fix in Editor
                        </button>
                    </div>
                )}

                {/* Filters */}
                <div className="mb-6 flex flex-wrap gap-4 items-center p-4 bg-slate-200 dark:bg-slate-900/50 rounded-lg">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Start Date:
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="ml-2 p-1 rounded-md bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600" />
                    </label>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        End Date:
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="ml-2 p-1 rounded-md bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600" />
                    </label>
                </div>

                {isLoading && <p>Loading logs...</p>}
                {error && <p className="text-red-500">Error fetching logs: {error.message}</p>}
                
                {!isLoading && logs?.length === 0 && (
                    <p className="text-center text-slate-500 dark:text-slate-400 py-6">No logs found for this question in the selected date range.</p>
                )}
                
                {logs && logs.length > 0 && (
                    <ul className="space-y-4">
                        {logs.map((log) => (
                             <li key={log.id} className="p-4 bg-white dark:bg-slate-800/50 rounded-lg text-sm text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600">
                                <div className="font-semibold text-slate-600 dark:text-slate-400 mb-2">
                                    Asked on: {new Date(log.created_at!).toLocaleString()}
                                </div>
                                <div className="p-3 bg-slate-100 dark:bg-slate-900 rounded-md">
                                    <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-1">AI Tutor's Response:</h3>
                                    <pre className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap font-sans">{log.tutor_response}</pre>
                                </div>
                                <div className="mt-3 flex gap-4 items-center flex-wrap">
                                    <button
                                        onClick={() => setShowFlagFormId(showFlagFormId === log.id ? null : log.id)}
                                        className="text-sm font-semibold text-yellow-600 dark:text-yellow-400 hover:underline flex items-center gap-1"
                                    >
                                        <AlertTriangleIcon className="h-4 w-4" /> Flag for Review
                                    </button>
                                     <button
                                        onClick={() => handleProposeFix(log.tutor_response)}
                                        className="text-sm font-semibold text-green-600 dark:text-green-400 hover:underline flex items-center gap-1"
                                    >
                                        <SparklesIcon className="h-4 w-4" /> Propose Fix from This
                                    </button>
                                </div>
                                {showFlagFormId === log.id && (
                                    <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700 animate-fade-in-up">
                                        <textarea
                                            placeholder="Why is this question or response confusing? (Optional)"
                                            value={flagComment}
                                            onChange={(e) => setFlagComment(e.target.value)}
                                            className="w-full text-sm p-2 rounded-md bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600"
                                            rows={2}
                                        />
                                        <button
                                            className="mt-2 bg-yellow-500 hover:bg-yellow-600 text-white py-1 px-3 rounded-md text-sm font-semibold flex items-center gap-2"
                                            onClick={() => flagMutation.mutate(log.id)}
                                            disabled={flagMutation.isPending}
                                        >
                                            {flagMutation.isPending ? 'Submitting...' : <><CheckCircleIcon className="h-4 w-4"/> Submit Flag</>}
                                        </button>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default QuestionLogDetailPage;