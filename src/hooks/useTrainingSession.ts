
import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSession, saveSession } from '@/services/sessionService';
import type { SessionState } from '@/services/sessionService';
import type { UserAction, StepStatus } from '@/types';

// This hook now manages state synchronization with the database.
export function useTrainingSession(moduleId: string, sessionToken: string, totalSteps: number) {
  const queryClient = useQueryClient();
  const sessionQueryKey = ['session', moduleId, sessionToken];

  // Fetch initial session state from the database
  const { data: sessionState, isLoading: isLoadingSession } = useQuery<SessionState | null>({
    queryKey: sessionQueryKey,
    queryFn: () => getSession(moduleId, sessionToken),
    enabled: !!moduleId && !!sessionToken,
    staleTime: Infinity, // We manage state locally and sync, no need to refetch in background
    refetchOnWindowFocus: false,
  });

  // Local state that reflects the database, or a default initial state
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [userActions, setUserActions] = useState<UserAction[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);

  // When session data loads from DB, update local state
  useEffect(() => {
    if (sessionState) {
      setCurrentStepIndex(sessionState.currentStepIndex);
      setUserActions(sessionState.userActions);
      setIsCompleted(sessionState.isCompleted);
    } else {
      // If no session in DB, reset to initial state
      setCurrentStepIndex(0);
      setUserActions([]);
      setIsCompleted(false);
    }
  }, [sessionState]);

  // Mutation to save session state to the database
  const { mutate: persistSession } = useMutation({
    mutationFn: (newState: Omit<SessionState, 'moduleId' | 'sessionToken'>) =>
      saveSession({ moduleId, sessionToken, ...newState }),
    onSuccess: (_data, variables) => {
      // Update the query cache with the new state
      queryClient.setQueryData(sessionQueryKey, (old: SessionState | null) => ({
        ...(old || {}),
        moduleId,
        sessionToken,
        ...variables,
      }));
    },
    onError: (error) => {
      console.error("Failed to save session state:", error);
      // Here you could implement retry logic or show a user-facing error
    }
  });

  // Debounce the save operation to avoid hammering the DB on rapid state changes
  useEffect(() => {
    // Don't save on initial load if we are still waiting for data
    if (isLoadingSession) return;

    const currentStateInDb = {
      currentStepIndex: sessionState?.currentStepIndex ?? 0,
      userActions: sessionState?.userActions ?? [],
      isCompleted: sessionState?.isCompleted ?? false,
    };

    const localState = { currentStepIndex, userActions, isCompleted };

    // Only save if there's a change
    if (JSON.stringify(currentStateInDb) === JSON.stringify(localState)) {
      return;
    }

    const handler = setTimeout(() => {
      persistSession(localState);
    }, 1000); // Debounce for 1 second

    return () => {
      clearTimeout(handler);
    };
  }, [currentStepIndex, userActions, isCompleted, persistSession, isLoadingSession, sessionState]);


  const markStep = useCallback(
    (status: StepStatus) => {
      const newAction: UserAction = { stepIndex: currentStepIndex, status, timestamp: Date.now() };
      setUserActions(prevActions => [...prevActions, newAction]);

      if (status === 'done') {
        if (currentStepIndex === totalSteps - 1) {
          setIsCompleted(true);
        } else {
          setCurrentStepIndex(prevIndex => prevIndex + 1);
        }
      }
    },
    [totalSteps, currentStepIndex]
  );

  const resetSession = useCallback(() => {
    // This now resets the local state, and the useEffect will trigger a save
    setCurrentStepIndex(0);
    setUserActions([]);
    setIsCompleted(false);
    // Also immediately trigger a save to clear the DB state
    persistSession({ currentStepIndex: 0, userActions: [], isCompleted: false });
  }, [persistSession]);

  return {
    currentStepIndex,
    setCurrentStepIndex,
    userActions,
    markStep,
    isCompleted,
    resetSession,
    isLoadingSession, // Expose loading state
  };
}