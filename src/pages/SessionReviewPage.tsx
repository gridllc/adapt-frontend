import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getModule } from '@/services/moduleService';
import { getSessionSummary } from '@/services/sessionService';
import { ClockIcon, LightbulbIcon, AlertTriangleIcon, TrophyIcon } from '@/components/Icons';
import type { LiveCoachEvent, AppModule, SessionSummary } from '@/types';

/**
 * A small component to render the correct icon based on the event type.
 * @param {object} props - The component props.
 * @param {LiveCoachEvent['eventType']} props.type - The type of the coaching event.
 * @returns {React.ReactElement} The corresponding icon.
 */
const EventIcon: React.FC<{ type: LiveCoachEvent['eventType'] }> = ({ type }) => {
    switch (type) {
        case 'hint': return <span title="Hint Provided"><LightbulbIcon className="h-5 w-5 text-yellow-400" /></span>;
        case 'correction': return <span title="Correction Made"><AlertTriangleIcon className="h-5 w-5 text-red-400" /></span>;
        case 'tutoring': return <span title="Tutoring Session"><LightbulbIcon className="h-5 w-5 text-orange-400" /></span>;
        default: return <span title="Step Advanced"><ClockIcon className="h-5 w-5 text-slate-400" /></span>;
    }
};

/**
 * Formats milliseconds into a human-readable string (e.g., "1m 32s", "15.2s", "980ms").
 * @param {number} ms - The duration in milliseconds.
 * @returns {string} The formatted duration string.
 */
const formatDuration = (ms: number): string => {
    if (isNaN(ms) || ms < 0) return '0s';
    if (ms < 1000) return `${ms}ms`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
};

/**
 * Renders a read-only review page for a completed or in-progress Live Coach session.
 * It provides administrators with a detailed timeline of events and performance metrics.
 */
const SessionReviewPage: React.FC = () => {
    const { moduleId, session_key } = useParams<{ moduleId: string, session_key: string }>();

    // Fetch the core module data (title, steps, etc.)
    const { data: moduleData, isLoading: isLoadingModule } = useQuery<AppModule | undefined>({
        queryKey: ['module', moduleId],
        queryFn: () => getModule(moduleId!),
        enabled: !!moduleId,
    });

    // Fetch the detailed session summary, which includes events and calculated stats
    const { data: sessionSummary, isLoading: isLoadingSession } = useQuery<SessionSummary | null>({
        queryKey: ['liveCoachSessionSummary', moduleId, session_key],
        queryFn: () => getSessionSummary(moduleId!, session_key!),
        enabled: !!moduleId && !!session_key,
    });

    const isLoading = isLoadingModule || isLoadingSession;

    if (isLoading) {
        return <div className="text-center p-8 text-slate-500 dark:text-slate-400">Loading session review...</div>;
    }

    if (!moduleData || !sessionSummary) {
        return <div className="text-center p-8 text-red-500">Could not find the requested module or session data.</div>;
    }

    const events = sessionSummary.liveCoachEvents || [];
    const totalDuration = sessionSummary.endedAt - sessionSummary.startedAt;

    return (
        <div className="p-8">
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Session Review</h1>
                <p className="text-indigo-500 dark:text-indigo-400">{moduleData.title}</p>
                <p className="text-xs text-slate-500 truncate" title={session_key}>Session Token: {session_key}</p>
            </div>

            <div className="bg-white dark:bg-slate-800/50 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 space-y-8">
                {/* --- Key Metrics Summary Card --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-center">
                    <div className="bg-slate-200 dark:bg-slate-900/50 p-4 rounded-lg">
                        <h2 className="text-lg font-bold text-indigo-500 dark:text-indigo-400">Final Score</h2>
                        <div className="flex items-center justify-center gap-2 text-4xl font-bold mt-2">
                            <TrophyIcon className="h-10 w-10 text-yellow-400" />
                            <span className="text-slate-800 dark:text-white">{sessionSummary.score ?? 'N/A'}%</span>
                        </div>
                    </div>
                    <div className="bg-slate-200 dark:bg-slate-900/50 p-4 rounded-lg">
                        <h2 className="text-lg font-bold text-indigo-500 dark:text-indigo-400">Total Duration</h2>
                        <div className="flex items-center justify-center gap-2 text-4xl font-bold mt-2">
                            <ClockIcon className="h-10 w-10 text-slate-500 dark:text-slate-400" />
                            <span className="text-slate-800 dark:text-white">{formatDuration(totalDuration)}</span>
                        </div>
                    </div>
                </div>

                {/* --- Time per Step Breakdown --- */}
                <div>
                    <h2 className="text-xl font-bold text-indigo-500 dark:text-indigo-400 mb-4">Time per Step</h2>
                    {Object.keys(sessionSummary.durationsPerStep).length > 0 ? (
                        <div className="space-y-2">
                            {Object.entries(sessionSummary.durationsPerStep).map(([stepIndex, duration]) => (
                                <div key={stepIndex} className="flex justify-between items-center bg-white dark:bg-slate-700/50 p-3 rounded-md text-sm">
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">Step {Number(stepIndex) + 1}: {moduleData.steps[Number(stepIndex)]?.title}</span>
                                    <span className="text-slate-600 dark:text-slate-300 font-mono">{formatDuration(Number(duration))}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-sm text-slate-500 py-4">No step duration data was recorded.</p>
                    )}
                </div>

                {/* --- Full Event Timeline --- */}
                <div>
                    <h2 className="text-xl font-bold text-indigo-500 dark:text-indigo-400 mb-6">Event Timeline</h2>
                    {events.length > 0 ? (
                        <div className="flow-root">
                            <ul className="-mb-8">
                                {events.map((event, eventIdx) => (
                                    <li key={eventIdx}>
                                        <div className="relative pb-8">
                                            {eventIdx !== events.length - 1 ? (
                                                <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
                                            ) : null}
                                            <div className="relative flex space-x-3">
                                                <div>
                                                    <span className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center ring-4 ring-slate-100 dark:ring-slate-800">
                                                        <EventIcon type={event.eventType} />
                                                    </span>
                                                </div>
                                                <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                                                    <div>
                                                        <p className="text-sm text-slate-600 dark:text-slate-300">
                                                            <span className="font-bold capitalize">{event.eventType.replace('_', ' ')}</span> on step {event.stepIndex + 1}: <span className="italic">&quot;{moduleData.steps[event.stepIndex]?.title}&quot;</span>
                                                        </p>
                                                    </div>
                                                    <div className="text-right text-sm whitespace-nowrap text-slate-500">
                                                        <time dateTime={new Date(event.timestamp).toISOString()}>
                                                            {new Date(event.timestamp).toLocaleTimeString()}
                                                        </time>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : (
                        <div className="text-center text-slate-500 bg-slate-200 dark:bg-slate-900/50 p-6 rounded-lg">
                            No coaching events were recorded for this session. The trainee completed it without assistance.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SessionReviewPage;