// Represents an official, owner-approved alternative to a process step.
export interface AlternativeMethod {
  title: string;
  description: string;
}

// This represents a single, distinct action or step in a larger process.
export interface ProcessStep {
  start: number;
  end: number;
  title: string;
  description: string;
  checkpoint: string | null; // A question to verify understanding
  alternativeMethods: AlternativeMethod[];
}

// This represents the entire training module, including the video and its structured steps.
export interface TrainingModule {
  title: string;
  videoUrl: string;
  steps: ProcessStep[];
}


// This represents a single message in the chat history for the AI Tutor.
export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  citations?: { uri: string; title: string }[];
}