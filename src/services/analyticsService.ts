import { supabase } from '@/services/apiClient';
import type { AnalysisHotspot, QuestionStats, ProcessStep, TutorLogRow } from '@/types';
import type { Database } from '@/types/supabase';

// Define types from the database schema for better type safety.
type ModuleRow = Database['public']['Tables']['modules']['Row'];
type TutorLogsRow = Database['public']['Tables']['tutor_logs']['Row'];


/**
 * Scans the tutor_logs table and returns a frequency-ranked list of unique questions for a module.
 * This is used to populate the main analytics dashboard.
 * @param {string} moduleId The slug of the module to analyze.
 * @returns {Promise<QuestionStats[]>} A promise that resolves to an array of objects, each containing a unique
 * question, its total frequency, and the associated step index, sorted by frequency descending.
 */
export const getQuestionFrequency = async (moduleId: string): Promise<QuestionStats[]> => {
    const { data, error } = await supabase
        .from('tutor_logs')
        .select('user_question, step_index')
        .eq('module_id', moduleId);

    if (error) {
        console.error("Error fetching tutor logs for frequency analysis:", error);
        throw new Error(`Failed to fetch analytics data: ${error.message}`);
    }

    // Aggregate counts for each unique question at each step.
    const questionCounts: Record<string, { count: number; stepIndex: number }> = {};
    data.forEach(log => {
        if (log.user_question?.trim()) {
            const question = log.user_question.trim();
            // Default to step 0 if not specified.
            const stepIndex = log.step_index ?? 0;

            const key = `${question}::${stepIndex}`; // Use a unique key for question-step pairs.
            if (questionCounts[key]) {
                questionCounts[key].count++;
            } else {
                questionCounts[key] = { count: 1, stepIndex };
            }
        }
    });

    const stats: QuestionStats[] = Object.entries(questionCounts)
        .map(([key, data]) => {
            const question = key.substring(0, key.lastIndexOf('::'));
            return { question, count: data.count, stepIndex: data.stepIndex };
        })
        .sort((a, b) => b.count - a.count);

    return stats;
};

/**
 * Fetches all tutor interaction logs for a given module, for display in the detailed question log page.
 * @param {string} moduleId The slug of the module.
 * @returns {Promise<TutorLogRow[]>} A promise that resolves to an array of all tutor logs, newest first.
 */
export const getTutorLogs = async (moduleId: string): Promise<TutorLogRow[]> => {
    const { data, error } = await supabase
        .from('tutor_logs')
        .select('*')
        .eq('module_id', moduleId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching tutor logs:", error);
        throw new Error(`Failed to fetch tutor logs: ${error.message}`);
    }

    return data || [];
};

/**
 * Fetches all instances of a specific question for a specific step within a module, with optional date filtering.
 * Used for the detailed drill-down view from the dashboard.
 * @param {object} params - The parameters for the query.
 * @param {string} params.moduleId - The slug of the module.
 * @param {number} params.stepIndex - The index of the step.
 * @param {string} params.question - The exact question text to match.
 * @param {string} [params.startDate] - Optional start date in 'YYYY-MM-DD' format.
 * @param {string} [params.endDate] - Optional end date in 'YYYY-MM-DD' format.
 * @returns {Promise<TutorLogsRow[]>} A promise resolving to an array of matching tutor logs.
 */
export const getQuestionLogsByQuestion = async ({ moduleId, stepIndex, question, startDate, endDate }: {
    moduleId: string;
    stepIndex: number;
    question: string;
    startDate?: string;
    endDate?: string;
}): Promise<TutorLogsRow[]> => {
    let query = supabase
        .from('tutor_logs')
        .select('*')
        .eq('module_id', moduleId)
        .eq('step_index', stepIndex)
        .eq('user_question', question);

    if (startDate) {
        query = query.gte('created_at', new Date(startDate).toISOString());
    }
    if (endDate) {
        // Add 1 day to the end date to make the date range inclusive.
        const inclusiveEndDate = new Date(endDate);
        inclusiveEndDate.setDate(inclusiveEndDate.getDate() + 1);
        query = query.lte('created_at', inclusiveEndDate.toISOString());
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching detailed question logs:", error);
        throw new Error(`Failed to fetch detailed question logs: ${error.message}`);
    }

    return data || [];
};


/**
 * Analyzes question statistics to find the single most problematic step ("hotspot").
 * A hotspot is defined as the step with the highest number of *unique* questions asked,
 * as this indicates broader confusion rather than one person asking the same question repeatedly.
 * @param {QuestionStats[]} stats - The question statistics from getQuestionFrequency.
 * @param {ModuleRow} module - The full training module data object.
 * @returns {AnalysisHotspot | null} The identified hotspot, or null if no significant confusion is found.
 */
export const findHotspots = (stats: QuestionStats[], module: ModuleRow): AnalysisHotspot | null => {
    if (!stats || stats.length === 0) {
        return null;
    }

    const stepConfusion: Record<number, { questions: Set<string>; totalCount: number }> = {};
    const steps = (module.steps as ProcessStep[]) || [];

    // Group questions by step index to find the step with the most unique questions.
    stats.forEach(stat => {
        if (typeof stat.stepIndex !== 'number') return;

        if (!stepConfusion[stat.stepIndex]) {
            stepConfusion[stat.stepIndex] = { questions: new Set(), totalCount: 0 };
        }
        stepConfusion[stat.stepIndex].questions.add(stat.question);
        stepConfusion[stat.stepIndex].totalCount += stat.count;
    });

    let topHotspot: AnalysisHotspot | null = null;
    let maxUniqueQuestions = 0;

    // Iterate through the grouped data to find the step with the maximum number of unique questions.
    Object.entries(stepConfusion).forEach(([stepIndexStr, data]) => {
        const stepIndex = parseInt(stepIndexStr, 10);
        // A step is a "hotter" spot if it has more *variety* of confusion.
        if (data.questions.size > maxUniqueQuestions) {
            maxUniqueQuestions = data.questions.size;
            topHotspot = {
                stepIndex,
                stepTitle: steps[stepIndex]?.title || `Unknown Step (${stepIndex})`,
                questions: Array.from(data.questions),
                questionCount: data.totalCount,
            };
        }
    });

    // Only return a hotspot if there's at least one question to analyze.
    return maxUniqueQuestions > 0 ? topHotspot : null;
};