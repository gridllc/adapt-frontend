
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

export interface TrainingModule {
  slug: string;
  title: string;
  videoUrl: string;
  steps: ProcessStep[];
  transcript?: TranscriptLine[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  citations?: { uri: string; title: string; }[];
  isFallback?: boolean;
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

export interface Suggestion {
  id: string;
  moduleId: string;
  stepIndex: number;
  text: string;
  status: 'pending' | 'approved' | 'rejected';
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
