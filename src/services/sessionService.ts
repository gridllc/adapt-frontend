
import { supabase } from '@/services/apiClient.ts';
import type { UserAction } from '@/types.ts';

export interface SessionState {
    moduleId: string;
    sessionToken: string;
    currentStepIndex: number;
    userActions: UserAction[];
    isCompleted: boolean;
}

const TABLE_NAME = 'training_sessions';

export const getSession = async (moduleId: string, sessionToken: string): Promise<SessionState | null> => {
    const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .eq('module_id', moduleId)
        .eq('session_token', sessionToken)
        .single();

    if (error && error.code !== 'PGRST116') { // Ignore "no rows" error, which is expected for new sessions
        console.error('Error fetching session:', error);
        throw error;
    }

    if (!data) return null;

    return {
        moduleId: data.module_id,
        sessionToken: data.session_token,
        currentStepIndex: data.current_step_index,
        userActions: data.user_actions || [],
        isCompleted: data.is_completed,
    };
};

export const saveSession = async (state: SessionState): Promise<void> => {
    const { error } = await supabase
        .from(TABLE_NAME)
        .upsert({
            module_id: state.moduleId,
            session_token: state.sessionToken,
            current_step_index: state.currentStepIndex,
            user_actions: state.userActions,
            is_completed: state.isCompleted,
            updated_at: new Date().toISOString()
        }, { onConflict: 'module_id, session_token' }); // Composite key for upsert

    if (error) {
        console.error('Error saving session:', error);
        throw error;
    }
};