import { supabase } from '@/services/apiClient';
import type { UserAction, LiveCoachEvent, SessionSummary } from '@/types';

const TABLE_NAME = 'training_sessions';

export interface SessionState {
    moduleId: string;
    sessionToken: string;
    currentStepIndex: number;
    userActions: UserAction[];
    isCompleted: boolean;
    liveCoachEvents?: LiveCoachEvent[];
    score?: number;
}


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
        userActions: (data.user_actions as UserAction[]) || [],
        isCompleted: data.is_completed,
        liveCoachEvents: (data.live_coach_events as LiveCoachEvent[]) || [],
        score: data.score ?? undefined,
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
        score: state.score,
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


/**
 * Fetches a session and calculates derived analytics, such as time spent per step and total duration.
 * This powers the detailed session review page for administrators.
 * @param moduleId The ID of the module.
 * @param sessionToken The unique token for the session.
 * @returns A promise that resolves to a `SessionSummary` object or null.
 */
export const getSessionSummary = async (moduleId: string, sessionToken: string): Promise<SessionSummary | null> => {
    const session = await getSession(moduleId, sessionToken);

    if (!session) {
        return null;
    }

    const durationsPerStep: Record<number, number> = {};
    const allEvents = (session.liveCoachEvents || []).sort((a, b) => a.timestamp - b.timestamp);
    const stepAdvanceEvents = allEvents.filter(e => e.eventType === 'step_advance');

    // Calculate duration per step based on 'step_advance' events
    for (let i = 0; i < stepAdvanceEvents.length - 1; i++) {
        const currentEvent = stepAdvanceEvents[i];
        const nextEvent = stepAdvanceEvents[i + 1];
        const duration = nextEvent.timestamp - currentEvent.timestamp;

        durationsPerStep[currentEvent.stepIndex] = (durationsPerStep[currentEvent.stepIndex] || 0) + duration;
    }

    // Note: Duration for the final step is not calculated here as it requires an explicit 'session_end' event,
    // which is not part of the current implementation.

    const startedAt = allEvents.length > 0 ? allEvents[0].timestamp : 0;
    const endedAt = allEvents.length > 0 ? allEvents[allEvents.length - 1].timestamp : 0;

    return {
        ...session,
        startedAt,
        endedAt,
        durationsPerStep,
    };
};

/**
 * Gets the total number of training sessions across all modules.
 * @returns {Promise<number>} The total count of sessions.
 */
export const getTotalSessionCount = async (): Promise<number> => {
    const { count, error } = await supabase
        .from(TABLE_NAME)
        .select('*', { count: 'exact', head: true });
    if (error) {
        console.error("Error fetching total session count:", error);
        throw error;
    }
    return count || 0;
};

/**
 * Gets the total number of completed training sessions across all modules.
 * @returns {Promise<number>} The total count of completed sessions.
 */
export const getCompletedSessionCount = async (): Promise<number> => {
    const { count, error } = await supabase
        .from(TABLE_NAME)
        .select('*', { count: 'exact', head: true })
        .eq('is_completed', true);
    if (error) {
        console.error("Error fetching completed session count:", error);
        throw error;
    }
    return count || 0;
};