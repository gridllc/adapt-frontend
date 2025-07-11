
import { useState, useCallback, useEffect } from 'react';
import type { UserAction, StepStatus } from '@/types';

export function useTrainingSession(moduleId: string, sessionToken: string, totalSteps: number) {
  const SESSION_KEY = `adapt-session-${moduleId}-${sessionToken}`;

  const getInitialState = useCallback(() => {
    try {
      const savedState = localStorage.getItem(SESSION_KEY);
      if (savedState) {
        const parsed = JSON.parse(savedState);
        // Add more robust validation to ensure the parsed data has the expected shape
        if (
          parsed &&
          typeof parsed === 'object' &&
          'currentStepIndex' in parsed &&
          typeof parsed.currentStepIndex === 'number' &&
          'userActions' in parsed &&
          Array.isArray(parsed.userActions)
        ) {
          // Also validate the content of userActions using a type guard
          const validUserActions = parsed.userActions.filter(
            (action: any): action is UserAction =>
              action &&
              typeof action === 'object' &&
              typeof action.stepIndex === 'number' &&
              typeof action.status === 'string' &&
              typeof action.timestamp === 'number'
          );

          return {
            initialStepIndex: parsed.currentStepIndex,
            initialUserActions: validUserActions,
            initialIsCompleted: !!parsed.isCompleted,
          };
        }
      }
    } catch (e) {
      console.error("Failed to load session state, starting fresh.", e);
      localStorage.removeItem(SESSION_KEY); // Clear corrupted data
    }
    return { initialStepIndex: 0, initialUserActions: [], initialIsCompleted: false };
  }, [SESSION_KEY]);


  const [currentStepIndex, setCurrentStepIndex] = useState(getInitialState().initialStepIndex);
  const [userActions, setUserActions] = useState<UserAction[]>(getInitialState().initialUserActions);
  const [isCompleted, setIsCompleted] = useState(getInitialState().initialIsCompleted);


  useEffect(() => {
    try {
      const stateToSave = JSON.stringify({ currentStepIndex, userActions, isCompleted });
      localStorage.setItem(SESSION_KEY, stateToSave);
    } catch (e) {
      console.error("Failed to save session state.", e);
    }
  }, [currentStepIndex, userActions, isCompleted, SESSION_KEY]);

  const markStep = useCallback(
    (status: StepStatus) => {
      const timestamp = Date.now();
      setUserActions(prevActions => [...prevActions, { stepIndex: currentStepIndex, status, timestamp }]);

      if (status === 'done') {
        if (currentStepIndex === totalSteps - 1) {
          setIsCompleted(true);
        } else {
          setCurrentStepIndex((prevIndex: number) => prevIndex + 1);
        }
      }
    },
    [totalSteps, currentStepIndex]
  );

  const resetSession = useCallback(() => {
    setCurrentStepIndex(0);
    setUserActions([]);
    setIsCompleted(false);
    localStorage.removeItem(SESSION_KEY);
  }, [SESSION_KEY]);

  return {
    currentStepIndex,
    setCurrentStepIndex,
    userActions,
    markStep,
    isCompleted,
    resetSession,
  };
}