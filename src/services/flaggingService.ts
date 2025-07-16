import { supabase } from '@/services/apiClient';
import type { Database } from '@/types/supabase';

type FlaggedQuestionInsert = Database['public']['Tables']['flagged_questions']['Insert'];

/**
 * Inserts a record into the `flagged_questions` table for admin review.
 * @param {FlaggedQuestionInsert} flagData The data for the flag to be inserted.
 * @returns {Promise<void>}
 */
export async function flagQuestion(flagData: FlaggedQuestionInsert): Promise<void> {
    const { error } = await supabase.from('flagged_questions').insert(flagData);
    if (error) {
        console.error('Error flagging question:', error);
        throw new Error('Could not save the flag. Please try again.');
    }
}
