
export interface AlternativeMethod {
  title: string;
  description: string;
}

export interface TranscriptLine {
  start: number;
  end: number;
  text: string;
}

export interface ProcessStep {
  start: number;
  end: number;
  title: string;
  description: string;
  checkpoint: string | null;
  alternativeMethods: AlternativeMethod[];
}

export interface VideoMetadata {
  originalName: string;
  size: number;
  duration: number;
  width: number;
  height: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  citations?: { uri: string; title: string; }[];
  isFallback?: boolean;
  imageUrl?: string; // For generated images
  isLoading?: boolean; // For showing loading indicators on a specific message
}

export type StepStatus = 'done' | 'unclear' | 'skipped';

export interface UserAction {
  stepIndex: number;
  status: StepStatus;
  timestamp: number;
}

export interface VideoAnalysisResult {
  timestamps: { start: number; end: number }[];
  transcript: TranscriptLine[];
}

export interface TraineeSuggestion {
  id: string;
  moduleId: string;
  stepIndex: number;
  text: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface AiSuggestion {
  id: string;
  moduleId: string;
  stepIndex: number;
  originalInstruction: string;
  suggestion: string;
  sourceQuestions: string[];
  createdAt: string;
}

export interface AnalysisHotspot {
  stepIndex: number;
  stepTitle: string;
  questions: string[];
  questionCount: number;
}

export interface RefinementSuggestion {
  newDescription: string;
  newAlternativeMethod: AlternativeMethod | null;
}

export interface PerformanceReportData {
  moduleTitle: string;
  completionDate: string;
  aiFeedback: string;
  unclearSteps: ProcessStep[];
  userQuestions: string[];
}

export type CoachEventType = 'hint' | 'correction' | 'tutoring';

export interface LiveCoachEvent {
  eventType: CoachEventType;
  stepIndex: number;
  timestamp: number;
}

export interface SessionState {
  moduleId: string;
  sessionToken: string;
  currentStepIndex: number;
  userActions: UserAction[];
  isCompleted: boolean;
  liveCoachEvents?: LiveCoachEvent[]; // Optional for backward compatibility with older session data
}

export interface QuestionStats {
  question: string;
  count: number;
  stepIndex: number;
}

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface AuthUser {
  id: string;
  email?: string;
  app_metadata: {
    provider?: string;
    [key: string]: any;
  };
}

export interface CheckpointEvaluation {
  isCorrect: boolean;
  feedback: string;
  suggestedInstructionChange?: string;
}

export interface DetectedObject {
  label: string;
  score?: number; // Confidence score from the model
  box: [number, number, number, number]; // [xMin, yMin, xMax, yMax] as percentages
}

export interface StepNeeds {
  required: string[];
  forbidden: string[];
  branchOn?: { item: string; module: string }[];
}

export type ModuleNeeds = Record<string, Record<number, StepNeeds>>;

export interface TutorLog {
  id: string;
  user_question: string;
  tutor_response: string;
  similarity?: number;
}

export interface TutorLogRow {
  id: string;
  module_id: string;
  step_index: number | null;
  user_question: string;
  tutor_response: string;
  created_at: string | null;
}