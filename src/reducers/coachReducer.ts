import type { TrainingModule } from '@/types';

/**
 * Defines the possible states the Live Coach can be in. This acts as a state machine
 * to prevent invalid or concurrent operations.
 */
export type CoachStatus =
  | 'initializing'
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'hinting'
  | 'correcting'
  | 'tutoring'
  | 'branching';

/**
 * The shape of the state object managed by the reducer. This is the single source of
 * truth for the coach's core operational state.
 */
export interface CoachState {
  status: CoachStatus;
  aiResponse: string;
  currentStepIndex: number;
  sessionScore: number;
  activeModule: TrainingModule | null;
  mainModuleState: { module: TrainingModule; stepIndex: number } | null; // For branching
}

/**
 * Defines all possible actions that can be dispatched to update the coach's state.
 * Using a discriminated union makes the reducer type-safe.
 */
export type CoachAction =
  | { type: 'INITIALIZE_SESSION'; payload: { stepIndex: number; score?: number; module: TrainingModule } }
  | { type: 'SET_STATUS'; payload: CoachStatus }
  | { type: 'SET_AI_RESPONSE'; payload: string }
  | { type: 'RESET_AI_RESPONSE' }
  | { type: 'APPEND_AI_RESPONSE'; payload: string }
  | { type: 'ADVANCE_STEP' }
  | { type: 'SET_STEP_INDEX'; payload: number }
  | { type: 'DECREMENT_SCORE'; payload: number }
  | { type: 'START_BRANCH'; payload: { subModule: TrainingModule; mainModule: TrainingModule; mainStepIndex: number } }
  | { type: 'END_BRANCH' };

/**
 * The initial state for the coach when the component first mounts.
 */
export const initialCoachState: CoachState = {
  status: 'initializing',
  aiResponse: '',
  currentStepIndex: 0,
  sessionScore: 100,
  activeModule: null,
  mainModuleState: null,
};

/**
 * The reducer function. It takes the current state and an action, and returns the new state.
 * This is a pure function, meaning it has no side effects.
 * @param state The current state.
 * @param action The action to perform.
 * @returns The new state.
 */
export function coachReducer(state: CoachState, action: CoachAction): CoachState {
  switch (action.type) {
    case 'INITIALIZE_SESSION':
      return {
        ...state,
        currentStepIndex: action.payload.stepIndex,
        sessionScore: action.payload.score ?? state.sessionScore,
        activeModule: action.payload.module,
      };
    case 'SET_STATUS':
      return { ...state, status: action.payload };
    case 'SET_AI_RESPONSE':
      return { ...state, aiResponse: action.payload };
    case 'RESET_AI_RESPONSE':
      return { ...state, aiResponse: '' };
    case 'APPEND_AI_RESPONSE':
      return { ...state, aiResponse: state.aiResponse + action.payload };
    case 'ADVANCE_STEP':
      if (!state.activeModule) return state;
      return { ...state, currentStepIndex: state.currentStepIndex + 1 };
    case 'SET_STEP_INDEX':
      return { ...state, currentStepIndex: action.payload };
    case 'DECREMENT_SCORE':
      return { ...state, sessionScore: Math.max(0, state.sessionScore - action.payload) };
    case 'START_BRANCH':
      return {
        ...state,
        status: 'branching',
        mainModuleState: { module: action.payload.mainModule, stepIndex: action.payload.mainStepIndex },
        activeModule: action.payload.subModule,
        currentStepIndex: 0,
      };
    case 'END_BRANCH':
      if (!state.mainModuleState) return state;
      return {
        ...state,
        activeModule: state.mainModuleState.module,
        currentStepIndex: state.mainModuleState.stepIndex,
        mainModuleState: null,
      }
    default:
      return state;
  }
}
