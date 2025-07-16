import { supabase } from '@/services/apiClient';
import type { AnalysisHotspot, UserAction, QuestionStats, ProcessStep, TutorLogRow } from '@/types';
import type { Database } from '@/types/supabase';

type ModuleRow = Database['public']['Tables']['modules']['Row'];
type TutorLogsRow = Database['public']['Tables']['tutor_logs']['Row'];


/**
 * Scans the tutor_logs table and returns a frequency-ranked list of questions for a module.
 * @param moduleId The slug of the module to analyze.
 * @returns An array of objects, each containing a question, its frequency, and the step index, sorted descending.
 */
export const getQuestionFrequency = async (moduleId: string): Promise<QuestionStats[]> => {
    // This now queries the unified tutor_logs table, which is more efficient and accurate.
    const { data, error } = await supabase
        .from('tutor_logs')
        .select('user_question, step_index')
        .eq('module_id', moduleId);

    if (error) {
        console.error("Error fetching tutor logs for analytics:", error);
        throw error;
    }

    const questionCounts: Record<string, { count: number; stepIndex: number }> = {};
    data.forEach(log => {
        if (log.user_question?.trim()) {
            const question = log.user_question.trim();
            const stepIndex = log.step_index ?? 0;

            const key = `${question}-${stepIndex}`; // Group by question and step
            if (questionCounts[key]) {
                questionCounts[key].count++;
            } else {
                questionCounts[key] = { count: 1, stepIndex };
            }
        }
    });

    const stats: QuestionStats[] = Object.entries(questionCounts)
        .map(([key, data]) => {
            // Extract the original question text from the key
            const question = key.substring(0, key.lastIndexOf('-'));
            return { question, count: data.count, stepIndex: data.stepIndex };
        })
        .sort((a, b) => b.count - a.count);

    return stats;
};

/**
 * Fetches all tutor logs for a given module, for display in the FAQ dashboard.
 * @param moduleId The slug of the module.
 * @returns A promise resolving to an array of all tutor logs.
 */
export const getTutorLogs = async (moduleId: string): Promise<TutorLogRow[]> => {
    const { data, error } = await supabase
        .from('tutor_logs')
        .select('*')
        .eq('module_id', moduleId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching tutor logs:", error);
        throw error;
    }

    return data || [];
};

/**
 * Fetches all instances of a specific question for a specific step within a module.
 * @param params The parameters for the query.
 * @returns A promise resolving to an array of matching tutor logs.
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
        // Add 1 day to the end date to make the range inclusive
        const inclusiveEndDate = new Date(endDate);
        inclusiveEndDate.setDate(inclusiveEndDate.getDate() + 1);
        query = query.lte('created_at', inclusiveEndDate.toISOString());
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching detailed question logs:", error);
        throw error;
    }

    return data || [];
};


/**
 * Analyzes question statistics to find the single most problematic step ("hotspot").
 * A hotspot is defined as the step with the highest number of unique questions asked.
 * @param stats The question statistics from getQuestionFrequency.
 * @param module The training module data.
 * @returns The identified hotspot, or null if no significant confusion is found.
 */
export const findHotspots = (stats: QuestionStats[], module: ModuleRow): AnalysisHotspot | null => {
    if (stats.length === 0) return null;

    const stepConfusion: Record<number, { questions: Set<string>; totalCount: number }> = {};
    const steps = (module.steps as ProcessStep[]) || [];

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
                stepTitle: steps[stepIndex]?.title || 'Unknown Step',
                questions: Array.from(data.questions),
                questionCount: data.totalCount,
            };
        }
    });

    // Only return a hotspot if there's at least one question.
    return maxUniqueQuestions > 0 ? topHotspot : null;
};