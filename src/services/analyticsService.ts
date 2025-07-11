
import type { ChatMessage, TrainingModule, AnalysisHotspot } from '@/types';

export interface QuestionStats {
    question: string;
    count: number;
    stepIndex: number; // Add step index to track where the question was asked
}

/**
 * Scans localStorage for all chat histories associated with a given module,
 * extracts all user questions, and returns a frequency-ranked list of those questions.
 * @param moduleId The slug of the module to analyze.
 * @returns An array of objects, each containing a question, its frequency, and the step index, sorted descending.
 */
export const getQuestionFrequency = (moduleId: string): QuestionStats[] => {
    const questionCounts: Record<string, { count: number; stepIndex: number }> = {};
    const keyPrefix = `adapt-ai-tutor-chat-history-${moduleId}-`;
    const sessionPrefix = `adapt-session-${moduleId}-`;

    // A map to find the session's step index at the time of a chat message.
    const sessionStepMap: Record<string, { timestamp: number; stepIndex: number }[]> = {};

    // First, gather all user actions and their timestamps from session data
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(sessionPrefix)) {
            try {
                const sessionData = JSON.parse(localStorage.getItem(key)!);
                const sessionToken = key.replace(sessionPrefix, '');
                if (sessionData.userActions && Array.isArray(sessionData.userActions)) {
                    sessionStepMap[sessionToken] = sessionData.userActions.map((action: any) => ({
                        timestamp: action.timestamp,
                        stepIndex: action.stepIndex,
                    }));
                }
            } catch (e) { /* ignore parse errors */ }
        }
    }

    // Function to find the step index for a given timestamp
    const findStepIndexForTimestamp = (sessionToken: string, chatTimestamp: number): number => {
        const actions = sessionStepMap[sessionToken];
        if (!actions) return 0;
        // Find the last action that occurred before or at the same time as the chat message
        let lastAction = actions.filter(a => a.timestamp <= chatTimestamp).pop();
        return lastAction ? lastAction.stepIndex : 0;
    };


    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(keyPrefix)) {
            try {
                const sessionToken = key.replace(keyPrefix, '');
                const savedHistoryJSON = localStorage.getItem(key);
                if (savedHistoryJSON) {
                    const messages: ChatMessage[] = JSON.parse(savedHistoryJSON);
                    messages.forEach(msg => {
                        if (msg.role === 'user' && msg.text.trim()) {
                            const question = msg.text.trim();
                            const stepIndex = findStepIndexForTimestamp(sessionToken, parseInt(msg.id, 10));

                            if (questionCounts[question]) {
                                questionCounts[question].count++;
                            } else {
                                questionCounts[question] = { count: 1, stepIndex };
                            }
                        }
                    });
                }
            } catch (e) {
                console.error(`Failed to parse chat history from key ${key}`, e);
            }
        }
    }

    const stats: QuestionStats[] = Object.entries(questionCounts)
        .map(([question, data]) => ({ question, count: data.count, stepIndex: data.stepIndex }))
        .sort((a, b) => b.count - a.count);

    return stats;
};

/**
 * Analyzes question statistics to find the single most problematic step ("hotspot").
 * A hotspot is defined as the step with the highest number of unique questions asked.
 * @param stats The question statistics from getQuestionFrequency.
 * @param module The training module data.
 * @returns The identified hotspot, or null if no significant confusion is found.
 */
export const findHotspots = (stats: QuestionStats[], module: TrainingModule): AnalysisHotspot | null => {
    if (stats.length === 0) return null;

    const stepConfusion: Record<number, { questions: Set<string>; totalCount: number }> = {};

    stats.forEach(stat => {
        if (!stepConfusion[stat.stepIndex]) {
            stepConfusion[stat.stepIndex] = { questions: new Set(), totalCount: 0 };
        }
        stepConfusion[stat.stepIndex].questions.add(stat.question);
        stepConfusion[stat.stepIndex].totalCount += stat.count;
    });

    let topHotspot: AnalysisHotspot | null = null;
    let maxUniqueQuestions = 0;

    Object.entries(stepConfusion).forEach(([stepIndexStr, data]) => {
        const stepIndex = parseInt(stepIndexStr, 10);
        if (data.questions.size > maxUniqueQuestions) {
            maxUniqueQuestions = data.questions.size;
            topHotspot = {
                stepIndex,
                stepTitle: module.steps[stepIndex]?.title || 'Unknown Step',
                questions: Array.from(data.questions),
                questionCount: data.totalCount,
            };
        }
    });

    // Only return a hotspot if there's at least one question.
    return maxUniqueQuestions > 0 ? topHotspot : null;
};
