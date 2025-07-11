
import { supabase } from '@/services/apiClient';
import type { TrainingModule, AnalysisHotspot, UserAction, ChatMessage } from '@/types';

export interface QuestionStats {
    question: string;
    count: number;
    stepIndex: number; // Add step index to track where the question was asked
}

/**
 * Scans the database for all chat histories associated with a given module,
 * extracts all user questions, and returns a frequency-ranked list of those questions.
 * @param moduleId The slug of the module to analyze.
 * @returns An array of objects, each containing a question, its frequency, and the step index, sorted descending.
 */
export const getQuestionFrequency = async (moduleId: string): Promise<QuestionStats[]> => {
    // This approach fetches chats and sessions for the module and processes them in JS.
    // It's simpler than a complex SQL query with JSONB and sufficient for this app's scale.
    const { data: chatData, error: chatError } = await supabase
        .from('chat_messages')
        .select('session_token, text, created_at, role')
        .eq('module_id', moduleId)
        .eq('role', 'user');

    if (chatError) {
        console.error("Error fetching chats for analytics:", chatError);
        throw chatError;
    }

    const { data: sessionData, error: sessionError } = await supabase
        .from('training_sessions')
        .select('session_token, user_actions')
        .eq('module_id', moduleId);

    if (sessionError) {
        console.error("Error fetching sessions for analytics:", sessionError);
        throw sessionError;
    }

    const sessionStepMap = new Map<string, UserAction[]>();
    sessionData.forEach(session => {
        if (session.user_actions) {
            sessionStepMap.set(session.session_token, session.user_actions);
        }
    });

    const findStepIndexForTimestamp = (sessionToken: string, chatTimestamp: number): number => {
        const actions = sessionStepMap.get(sessionToken);
        if (!actions) return 0;
        // Find the last action that occurred before or at the same time as the chat message
        const lastAction = actions
            .filter(a => a.timestamp <= chatTimestamp)
            .pop();
        return lastAction ? lastAction.stepIndex : 0;
    };

    const questionCounts: Record<string, { count: number; stepIndex: number }> = {};
    chatData.forEach(msg => {
        if (msg.text?.trim()) {
            const question = msg.text.trim();
            // The `id` from chat messages is the timestamp
            const timestamp = new Date(msg.created_at).getTime();
            const stepIndex = findStepIndexForTimestamp(msg.session_token, timestamp);

            if (questionCounts[question]) {
                questionCounts[question].count++;
            } else {
                questionCounts[question] = { count: 1, stepIndex };
            }
        }
    });

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
