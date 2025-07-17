
import type { CheckpointEvaluation, PerformanceReportData } from '@/types';

/**
 * Defines the possible states for the main content area of the training page.
 */
export type ActiveTab = 'steps' | 'transcript';

/**
 * The shape of the state object managed by the training page reducer.
 * This centralizes the complex UI state for the main training interface.
 */
export interface TrainingPageState {
    isChatOpen: boolean;
    activeTab: ActiveTab;
    
    // Checkpoint-related state
    isEvaluatingCheckpoint: boolean;
    isAdvancing: boolean; // A brief state after correct answer before moving to next step
    checkpointFeedback: CheckpointEvaluation | null;
    instructionSuggestion: string | null;
    isSuggestionSubmitted: boolean;

    // Report generation state
    isGeneratingReport: boolean;
    performanceReport: PerformanceReportData | null;
    
    // State for launching the chat tutor with context
    initialChatPrompt?: string;
}

/**
 * All possible actions that can be dispatched to update the training page's state.
 */
export type TrainingPageAction =
  | { type: 'SET_ACTIVE_TAB'; payload: ActiveTab }
  | { type: 'TOGGLE_CHAT' }
  | { type: 'SET_CHAT_PROMPT'; payload?: string }
  | { type: 'START_CHECKPOINT_EVALUATION' }
  | { type: 'CHECKPOINT_EVALUATION_SUCCESS'; payload: { evaluation: CheckpointEvaluation; isAdvancing: boolean } }
  | { type: 'CHECKPOINT_EVALUATION_FAILURE' }
  | { type: 'SET_INSTRUCTION_SUGGESTION'; payload: string | null }
  | { type: 'SUBMIT_SUGGESTION_SUCCESS' }
  | { type: 'START_REPORT_GENERATION' }
  | { type: 'SET_PERFORMANCE_REPORT'; payload: PerformanceReportData | null }
  | { type: 'RESET_CHECKPOINT_STATE' }
  | { type: 'RESET_SESSION_UI' };


export const initialTrainingPageState: TrainingPageState = {
    isChatOpen: false,
    activeTab: 'steps',
    isEvaluatingCheckpoint: false,
    isAdvancing: false,
    checkpointFeedback: null,
    instructionSuggestion: null,
    isSuggestionSubmitted: false,
    isGeneratingReport: false,
    performanceReport: null,
    initialChatPrompt: undefined,
};

/**
 * The reducer function to manage training page state.
 * @param state The current state.
 * @param action The action to perform.
 * @returns The new state.
 */
export function trainingPageReducer(state: TrainingPageState, action: TrainingPageAction): TrainingPageState {
    switch (action.type) {
        case 'SET_ACTIVE_TAB':
            return { ...state, activeTab: action.payload };
        case 'TOGGLE_CHAT':
            return { ...state, isChatOpen: !state.isChatOpen, initialChatPrompt: undefined };
        case 'SET_CHAT_PROMPT':
            return { ...state, isChatOpen: true, initialChatPrompt: action.payload };
        case 'START_CHECKPOINT_EVALUATION':
            return { ...state, isEvaluatingCheckpoint: true, checkpointFeedback: null, instructionSuggestion: null };
        case 'CHECKPOINT_EVALUATION_SUCCESS':
            return {
                ...state,
                isEvaluatingCheckpoint: false,
                checkpointFeedback: action.payload.evaluation,
                instructionSuggestion: action.payload.evaluation.suggestedInstructionChange ?? null,
                isAdvancing: action.payload.isAdvancing,
            };
        case 'CHECKPOINT_EVALUATION_FAILURE':
            return { ...state, isEvaluatingCheckpoint: false };
        case 'SET_INSTRUCTION_SUGGESTION':
            return { ...state, instructionSuggestion: action.payload };
        case 'SUBMIT_SUGGESTION_SUCCESS':
            return { ...state, isSuggestionSubmitted: true };
        case 'START_REPORT_GENERATION':
            return { ...state, isGeneratingReport: true };
        case 'SET_PERFORMANCE_REPORT':
            return { ...state, isGeneratingReport: false, performanceReport: action.payload };
        case 'RESET_CHECKPOINT_STATE':
            return {
                ...state,
                checkpointFeedback: null,
                instructionSuggestion: null,
                isSuggestionSubmitted: false,
                isAdvancing: false,
            };
        case 'RESET_SESSION_UI':
            return {
                ...state,
                performanceReport: null,
            }
        default:
            return state;
    }
}
