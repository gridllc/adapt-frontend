
import { supabase } from '@/services/apiClient';
import type { TraineeSuggestion, AiSuggestion } from '@/types';

const TRAINEE_TABLE_NAME = 'suggestions';
const AI_TABLE_NAME = 'suggested_fixes';

/**
 * Submits a new trainee suggestion for a specific module and step to the database.
 * @param {string} moduleId The ID of the module.
 * @param {number} stepIndex The index of the step the suggestion applies to.
 * @param {string} suggestionText The text content of the suggestion.
 * @returns {Promise<TraineeSuggestion>} The created suggestion object.
 */
export const submitSuggestion = async (moduleId: string, stepIndex: number, suggestionText: string): Promise<TraineeSuggestion> => {
    const { data: { user } } = await supabase.auth.getUser();

    // The `user_id` is optional on the table, so we only include it if the user is logged in.
    const newSuggestionData = {
        module_id: moduleId,
        step_index: stepIndex,
        text: suggestionText,
        status: 'pending' as const,
        user_id: user?.id,
    };

    const { data, error } = await supabase
        .from(TRAINEE_TABLE_NAME)
        .insert(newSuggestionData)
        .select()
        .single();

    if (error) {
        console.error("Error submitting trainee suggestion:", error);
        if (error.code === '42501') { // Row-level security policy violation
            throw new Error("You do not have permission to submit suggestions. Please log in or check database policies.");
        }
        if (error.message.includes('rate limit')) {
            throw new Error("You are submitting suggestions too quickly. Please wait a moment.");
        }
        throw new Error(`Failed to submit suggestion: ${error.message}`);
    }

    if (!data) {
        throw new Error("Failed to create suggestion: no data was returned from the server.");
    }

    // Map from snake_case (db) to camelCase (ts type) for consistency
    return {
        id: data.id.toString(),
        moduleId: data.module_id,
        stepIndex: data.step_index,
        text: data.text || '',
        status: data.status as TraineeSuggestion['status'],
    };
};

/**
 * Retrieves all trainee-submitted suggestions for a specific module from the database.
 * @param {string} moduleId The ID of the module to get suggestions for.
 * @returns {Promise<TraineeSuggestion[]>} An array of suggestions for the specified module.
 */
export const getTraineeSuggestionsForModule = async (moduleId: string): Promise<TraineeSuggestion[]> => {
    const { data, error } = await supabase
        .from(TRAINEE_TABLE_NAME)
        .select('*')
        .eq('module_id', moduleId);

    if (error) {
        console.error("Error fetching trainee suggestions:", error);
        throw error;
    }

    // Map from snake_case (db) to camelCase (ts type)
    return data.map(s => ({
        id: s.id.toString(),
        moduleId: s.module_id,
        stepIndex: s.step_index,
        text: s.text || '',
        status: s.status as TraineeSuggestion['status'],
    }));
};

/**
 * Retrieves all pending trainee-submitted suggestions across all modules.
 * @returns {Promise<(TraineeSuggestion & { module_title?: string })[]>} An array of suggestions.
 */
export const getAllPendingSuggestions = async (): Promise<(TraineeSuggestion & { module_title?: string })[]> => {
    const { data, error } = await supabase
        .from(TRAINEE_TABLE_NAME)
        .select('*, modules(title)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching all pending suggestions:", error);
        throw error;
    }
    // Map from snake_case (db) to camelCase (ts type)
    return (data || []).map(s => {
        // Supabase join type can be an array or object depending on relationship
        const moduleData = Array.isArray(s.modules) ? s.modules[0] : s.modules;
        return {
            id: s.id.toString(),
            moduleId: s.module_id,
            stepIndex: s.step_index,
            text: s.text || '',
            status: s.status as TraineeSuggestion['status'],
            module_title: moduleData?.title
        };
    });
};


/**
 * Deletes a trainee suggestion by its ID from the database.
 * @param {string} suggestionId The ID of the suggestion to delete.
 */
export const deleteTraineeSuggestion = async (suggestionId: string): Promise<void> => {
    const { error } = await supabase
        .from(TRAINEE_TABLE_NAME)
        .delete()
        .eq('id', parseInt(suggestionId, 10));

    if (error) {
        console.error(`Error deleting trainee suggestion ${suggestionId}:`, error);
        throw error;
    }
};


// --- AI-Generated Suggestions ---

/**
 * Saves a new AI-generated suggestion to the database.
 * @param suggestionData The AI suggestion data.
 */
export const saveAiSuggestion = async (suggestionData: Omit<AiSuggestion, 'id' | 'createdAt'>): Promise<void> => {
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from(AI_TABLE_NAME).insert({
        module_id: suggestionData.moduleId,
        step_index: suggestionData.stepIndex,
        original_instruction: suggestionData.originalInstruction,
        suggestion: suggestionData.suggestion,
        source_questions: suggestionData.sourceQuestions,
        user_id: user?.id
    });

    if (error) {
        console.error("Error saving AI suggestion:", error);
        throw error;
    }
};

/**
 * Retrieves all AI-generated suggestions for a specific module.
 * @param moduleId The slug of the module.
 * @returns An array of AI suggestions.
 */
export const getAiSuggestionsForModule = async (moduleId: string): Promise<AiSuggestion[]> => {
    if (!moduleId) return [];
    const { data, error } = await supabase
        .from(AI_TABLE_NAME)
        .select('*')
        .eq('module_id', moduleId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching AI suggestions:", error);
        throw error;
    }

    return data.map(item => ({
        id: item.id,
        moduleId: item.module_id,
        stepIndex: item.step_index,
        originalInstruction: item.original_instruction || '',
        suggestion: item.suggestion || '',
        sourceQuestions: item.source_questions || [],
        createdAt: item.created_at
    }));
};

/**
 * Retrieves the most recent AI-generated suggestion for a specific step in a module.
 * @param moduleId The slug of the module.
 * @param stepIndex The index of the step.
 * @returns The latest AI suggestion or null if none exists.
 */
export const getLatestAiSuggestionForStep = async (moduleId: string, stepIndex: number): Promise<AiSuggestion | null> => {
    if (!moduleId) return null;
    const { data, error } = await supabase
        .from(AI_TABLE_NAME)
        .select('*')
        .eq('module_id', moduleId)
        .eq('step_index', stepIndex)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error && error.code !== 'PGRST116') { // Ignore "no rows" error
        console.error("Error fetching latest AI suggestion:", error);
        throw error;
    }

    if (!data) return null;

    return {
        id: data.id,
        moduleId: data.module_id,
        stepIndex: data.step_index,
        originalInstruction: data.original_instruction || '',
        suggestion: data.suggestion || '',
        sourceQuestions: data.source_questions || [],
        createdAt: data.created_at
    };
};
