import { supabase } from '@/services/apiClient';
import type { ChatMessage } from '@/types';

const TABLE_NAME = 'chat_messages';

export const getChatHistory = async (moduleId: string, sessionToken: string): Promise<ChatMessage[]> => {
    const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .eq('module_id', moduleId)
        .eq('session_token', sessionToken)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching chat history:', error);
        throw error;
    }

    if (!data) return [];

    // Map from snake_case (db) to camelCase (ts type)
    return data.map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'model',
        text: msg.text || '',
        citations: (msg.citations as any) || [],
        isFallback: msg.is_fallback || false,
        feedback: msg.feedback as 'good' | 'bad' | null,
    }));
};

export const saveChatMessage = async (moduleId: string, sessionToken: string, message: ChatMessage): Promise<void> => {
    const { error } = await supabase
        .from(TABLE_NAME)
        .insert({
            id: message.id,
            module_id: moduleId,
            session_token: sessionToken,
            role: message.role,
            text: message.text,
            citations: message.citations,
            is_fallback: message.isFallback,
            feedback: message.feedback,
            // `created_at` is handled by the database's default value
        });

    if (error) {
        console.error('Error saving chat message:', error);
        throw error;
    }
};

/**
 * Updates the feedback for a specific chat message in the database.
 * @param {string} messageId The ID of the message to update.
 * @param {'good' | 'bad'} feedback The feedback to set.
 * @returns {Promise<void>} A promise that resolves on success or throws on error.
 */
export const updateMessageFeedback = async (messageId: string, feedback: 'good' | 'bad'): Promise<void> => {
    const { error } = await supabase
        .from(TABLE_NAME)
        .update({ feedback })
        .eq('id', messageId);

    if (error) {
        console.error('Error updating message feedback:', error);
        throw error;
    }
};