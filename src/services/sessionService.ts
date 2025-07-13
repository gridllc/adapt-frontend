
import { supabase } from '@/services/apiClient.ts';
import type { UserAction, LiveCoachEvent } from '@/types.ts';

export interface SessionState {
    moduleId: string;
    sessionToken: string;
    currentStepIndex: number;
    userActions: UserAction[];
    isCompleted: boolean;
    liveCoachEvents: LiveCoachEvent[];
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
        liveCoachEvents: data.live_coach_events || [],
    };
};

export const saveSession = async (state: Partial<SessionState> & { moduleId: string; sessionToken: string }): Promise<void> => {
    const upsertData = {
        module_id: state.moduleId,
        session_token: state.sessionToken,
        current_step_index: state.currentStepIndex,
        user_actions: state.userActions,
        is_completed: state.isCompleted,
        live_coach_events: state.liveCoachEvents,
        updated_at: new Date().toISOString()
    };

    // Remove undefined properties so they don't overwrite existing values in DB
    Object.keys(upsertData).forEach(key => upsertData[key as keyof typeof upsertData] === undefined && delete upsertData[key as keyof typeof upsertData]);

    const { error } = await supabase
        .from(TABLE_NAME)
        .upsert(upsertData, { onConflict: 'module_id, session_token' }); // Composite key for upsert

    if (error) {
        console.error('Error saving session:', error);
        throw error;
    }
};