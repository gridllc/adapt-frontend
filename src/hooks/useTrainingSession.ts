import { useState, useCallback, useEffect } from 'react';
import type { UserAction, StepStatus } from '@/types';

export function useTrainingSession(moduleId: string, totalSteps: number) {
  const SESSION_KEY = `adapt-session-${moduleId}`;

  const getInitialState = useCallback(() => {
    try {
      const savedState = localStorage.getItem(SESSION_KEY);
      if (savedState) {
        const { currentStepIndex, userActions } = JSON.parse(savedState);
        // Basic validation
        if (typeof currentStepIndex === 'number' && Array.isArray(userActions)) {
          return {
            initialStepIndex: currentStepIndex,
            initialUserActions: userActions,
          };
        }
      }
    } catch (e) {
      console.error("Failed to load session state, starting fresh.", e);
      localStorage.removeItem(SESSION_KEY); // Clear corrupted data
    }
    return { initialStepIndex: 0, initialUserActions: [] };
  }, [SESSION_KEY]);


  const [currentStepIndex, setCurrentStepIndex] = useState(getInitialState().initialStepIndex);
  const [userActions, setUserActions] = useState<UserAction[]>(getInitialState().initialUserActions);

  useEffect(() => {
    try {
      const stateToSave = JSON.stringify({ currentStepIndex, userActions });
      localStorage.setItem(SESSION_KEY, stateToSave);
    } catch (e) {
      console.error("Failed to save session state.", e);
    }
  }, [currentStepIndex, userActions, SESSION_KEY]);

  const markStep = useCallback(
    (status: StepStatus) => {
      const timestamp = Date.now();
      setCurrentStepIndex(prevIndex => {
        setUserActions(prevActions => [...prevActions, { stepIndex: prevIndex, status, timestamp }]);
        if (status === 'done' && prevIndex < totalSteps - 1) {
          return prevIndex + 1;
        }
        return prevIndex;
      });
    },
    [totalSteps]
  );

  const resetSession = useCallback(() => {
    setCurrentStepIndex(0);
    setUserActions([]);
    localStorage.removeItem(SESSION_KEY);
  }, [SESSION_KEY]);

  return {
    currentStepIndex,
    setCurrentStepIndex,
    userActions,
    markStep,
    resetSession,
  };
}