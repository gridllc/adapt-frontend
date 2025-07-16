import { supabase } from '@/services/apiClient';
import type { Database } from '@/types/supabase';
import type { FlaggedQuestion } from '@/types';

type FlaggedQuestionInsert = Database['public']['Tables']['flagged_questions']['Insert'];
type FlaggedQuestionRow = Database['public']['Tables']['flagged_questions']['Row'];


/**
 * Inserts a record into the `flagged_questions` table for admin review.
 * @param {FlaggedQuestionInsert} flagData The data for the flag to be inserted, conforming to the DB schema.
 * @returns {Promise<void>} A promise that resolves on success or throws on failure.
 */
export async function flagQuestion(flagData: FlaggedQuestionInsert): Promise<void> {
    const { error } = await supabase.from('flagged_questions').insert(flagData);
    if (error) {
        console.error('Error flagging question:', error);
        throw new Error(`Could not save the flag: ${error.message}`);
    }
}

/**
 * Fetches all flagged questions for a given module, ordered by most recent first.
 * This is used to populate an admin review dashboard.
 * @param {string} moduleId The slug of the module to retrieve flags for.
 * @returns {Promise<FlaggedQuestion[]>} A promise that resolves to an array of flagged questions.
 */
export async function getFlaggedQuestions(moduleId: string): Promise<FlaggedQuestion[]> {
    const { data, error } = await supabase
        .from('flagged_questions')
        .select('*')
        .eq('module_id', moduleId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error(`Error fetching flagged questions for module ${moduleId}:`, error);
        throw new Error(`Failed to retrieve flagged questions: ${error.message}`);
    }

    if (!data) return [];

    // Map from snake_case (db) to camelCase (app type)
    return data.map((row: FlaggedQuestionRow) => ({
        id: row.id,
        moduleId: row.module_id,
        stepIndex: row.step_index,
        userQuestion: row.user_question,
        comment: row.comment,
        userId: row.user_id,
        createdAt: row.created_at,
        tutorLogId: row.tutor_log_id,
        tutorResponse: row.tutor_response,
    }));
}