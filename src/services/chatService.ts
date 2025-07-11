
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
        role: msg.role,
        text: msg.text,
        citations: msg.citations || [],
        isFallback: msg.is_fallback || false,
    }));
};

export const saveChatMessage = async (moduleId: string, sessionToken:string, message: ChatMessage): Promise<void> => {
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
            // `created_at` is handled by the database's default value
        });

    if (error) {
        console.error('Error saving chat message:', error);
        throw error;
    }
};
