import { supabase } from '@/services/apiClient';
import { generateEmbedding } from '@/services/geminiService';
import type { TutorLog } from '@/types';

const TABLE_NAME = 'tutor_logs';
const SIMILARITY_THRESHOLD = 0.75;
const MATCH_COUNT = 3;

/**
 * Logs a user's question and the AI's response to the database, including a vector embedding of the question.
 * This is a "fire-and-forget" function from the UI's perspective.
 * @param moduleId The slug of the module.
 * @param stepIndex The step index where the question was asked.
 * @param userQuestion The raw text of the user's question.
 * @param tutorResponse The raw text of the AI's response.
 */
export const logTutorInteraction = async (
    moduleId: string,
    stepIndex: number,
    userQuestion: string,
    tutorResponse: string
): Promise<void> => {
    if (!userQuestion.trim() || !tutorResponse.trim()) {
        return; // Don't log empty interactions
    }

    try {
        const embedding = await generateEmbedding(userQuestion);

        const { error } = await supabase.from(TABLE_NAME).insert({
            module_id: moduleId,
            step_index: stepIndex,
            user_question: userQuestion,
            tutor_response: tutorResponse,
            question_embedding: embedding,
        });

        if (error) {
            throw error;
        }
    } catch (err) {
        // Log the error but don't let it crash the main application flow.
        console.warn("Failed to log interaction to collective memory:", err);
    }
};

/**
 * Finds similar, previously answered questions from the tutor logs for a given module.
 * @param moduleId The slug of the module to search within.
 * @param question The new question to find similar matches for.
 * @returns A promise that resolves to an array of similar tutor log entries.
 */
export const findSimilarInteractions = async (
    moduleId: string,
    question: string
): Promise<TutorLog[]> => {
    if (!question.trim()) {
        return [];
    }

    try {
        const embedding = await generateEmbedding(question);

        const { data, error } = await supabase.rpc('match_tutor_logs', {
            query_embedding: embedding,
            p_module_id: moduleId,
            match_threshold: SIMILARITY_THRESHOLD,
            match_count: MATCH_COUNT,
        });

        if (error) {
            console.error("Error finding similar interactions:", error);
            throw error;
        }

        return data || [];
    } catch (err) {
        console.warn("Could not retrieve collective memory:", err);
        // Return empty array on failure to avoid blocking the user.
        return [];
    }
};