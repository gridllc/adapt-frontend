import { supabase } from '@/services/apiClient';
import type { AIFeedbackLog, SimilarFix } from '@/types';
import { generateEmbedding } from './geminiService';

const TABLE_NAME = 'ai_feedback_logs';
const SIMILARITY_THRESHOLD = 0.78;
const MATCH_COUNT = 3;

/**
 * Logs a user's feedback (good/bad) on an AI's response during a Live Coach session.
 * @param feedbackData The core data about the feedback event.
 * @returns The ID of the newly created log entry.
 */
export const logAiFeedback = async (feedbackData: Omit<AIFeedbackLog, 'id' | 'createdAt' | 'feedback'> & { feedback?: 'good' | 'bad' }): Promise<string> => {
    const { data, error } = await supabase
        .from(TABLE_NAME)
        .insert({
            session_token: feedbackData.sessionToken,
            module_id: feedbackData.moduleId,
            step_index: feedbackData.stepIndex,
            user_prompt: feedbackData.userPrompt,
            ai_response: feedbackData.aiResponse,
            feedback: feedbackData.feedback, // This can be 'good' or 'bad'
        })
        .select('id')
        .single();

    if (error) {
        console.error("Error logging AI feedback:", error);
        throw new Error(`Could not save your feedback: ${error.message}`);
    }

    return data.id;
};

/**
 * Updates an existing feedback log with the user's explanation of what worked instead or a 'good' rating.
 * If a text fix is provided, it generates and stores a vector embedding for future similarity searches.
 * @param logId The ID of the feedback log to update.
 * @param fixOrRating The text provided by the user, or the string 'good'.
 */
export const updateFeedbackWithFix = async (logId: string, fixOrRating: string): Promise<void> => {
    const updatePayload: { user_fix_text?: string, feedback?: 'good', fix_embedding?: number[] } = {};

    if (fixOrRating === 'good') {
        updatePayload.feedback = 'good';
    } else {
        updatePayload.user_fix_text = fixOrRating;
        // Generate and add embedding for the user's successful fix.
        try {
            const embedding = await generateEmbedding(fixOrRating);
            updatePayload.fix_embedding = embedding;
        } catch (err) {
            console.warn("Could not generate embedding for user fix:", err);
            // Don't block the update if embedding fails.
        }
    }

    const { error } = await supabase
        .from(TABLE_NAME)
        .update(updatePayload)
        .eq('id', logId);

    if (error) {
        console.error("Error updating feedback with user fix:", error);
        throw new Error(`Could not save your explanation: ${error.message}`);
    }
};

/**
 * Retrieves past feedback for a specific step in a module to help the AI avoid repeating mistakes.
 * @param moduleId The ID of the module.
 * @param stepIndex The index of the step.
 * @returns An array of past feedback logs.
 */
export const getPastFeedbackForStep = async (moduleId: string, stepIndex: number): Promise<AIFeedbackLog[]> => {
    const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .eq('module_id', moduleId)
        .eq('step_index', stepIndex)
        .order('created_at', { ascending: false })
        .limit(5); // Limit to the 5 most recent feedback items to keep prompts concise

    if (error) {
        console.error("Error fetching past AI feedback:", error);
        return []; // Return empty on error to not block the user
    }

    return (data || []).map(item => ({
        id: item.id,
        sessionToken: item.session_token,
        moduleId: item.module_id,
        stepIndex: item.step_index,
        userPrompt: item.user_prompt || '',
        aiResponse: item.ai_response || '',
        feedback: item.feedback as 'good' | 'bad',
        userFixText: item.user_fix_text || undefined,
        createdAt: item.created_at,
    }));
};

/**
 * Finds semantically similar, user-submitted fixes from past sessions for a given user query.
 * @param moduleId The ID of the module.
 * @param stepIndex The index of the current step.
 * @param userQuery The user's new question or problem description.
 * @returns A promise that resolves to an array of similar fixes, ranked by similarity.
 */
export const findSimilarFixes = async (moduleId: string, stepIndex: number, userQuery: string): Promise<SimilarFix[]> => {
    if (!userQuery.trim()) return [];

    try {
        const embedding = await generateEmbedding(userQuery);
        const { data, error } = await supabase.rpc('match_ai_feedback_fixes', {
            query_embedding: embedding,
            p_module_id: moduleId,
            p_step_index: stepIndex,
            match_threshold: SIMILARITY_THRESHOLD,
            match_count: MATCH_COUNT
        });

        if (error) {
            throw error;
        }

        return (data || []).map(item => ({
            id: item.id,
            userFixText: item.user_fix_text,
            similarity: item.similarity
        }));

    } catch (err) {
        console.warn("Failed to find similar fixes from collective memory:", err);
        return []; // Return empty on error to not block the user.
    }
};