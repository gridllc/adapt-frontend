
import type { ChatMessage } from '@/types';

export interface ChatState {
  messages: ChatMessage[];
  input: string;
  isLoading: boolean;
  error: string | null;
}

export type ChatAction =
  | { type: 'SET_MESSAGES'; payload: ChatMessage[] }
  | { type: 'SET_INPUT'; payload: string }
  | { type: 'START_MESSAGE' }
  | { type: 'ADD_MESSAGES'; payload: ChatMessage[] }
  | { type: 'STREAM_MESSAGE_CHUNK'; payload: { messageId: string; chunk: string; citations?: ChatMessage['citations'] } }
  | { type: 'MESSAGE_COMPLETE'; payload: { messageId: string; finalMessage: ChatMessage } }
  | { type: 'SET_ERROR'; payload: { messageId: string; error: string } }
  | { type: 'REMOVE_MESSAGE'; payload: { messageId: string } };

export const initialChatState: ChatState = {
  messages: [],
  input: '',
  isLoading: false,
  error: null,
};

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SET_MESSAGES':
      return { ...state, messages: action.payload };
    case 'SET_INPUT':
      return { ...state, input: action.payload };
    case 'START_MESSAGE':
      return { ...state, isLoading: true, error: null };
    case 'ADD_MESSAGES':
        return { ...state, messages: [...state.messages, ...action.payload] };
    case 'STREAM_MESSAGE_CHUNK':
        return {
            ...state,
            isLoading: false, // First chunk received
            messages: state.messages.map(msg => {
                if (msg.id !== action.payload.messageId) return msg;
                const updatedMsg: ChatMessage = {
                    ...msg,
                    text: (msg.text || '') + action.payload.chunk,
                    isLoading: false,
                };
                if (action.payload.citations) {
                    const currentCitations = msg.citations || [];
                    const combined = [...currentCitations, ...action.payload.citations];
                    // De-duplicate citations
                    updatedMsg.citations = combined.filter((v, i, a) => a.findIndex(t => (t.uri === v.uri)) === i);
                }
                return updatedMsg;
            })
        };
    case 'MESSAGE_COMPLETE':
        return {
            ...state,
            isLoading: false,
            messages: state.messages.map(msg => msg.id === action.payload.messageId ? action.payload.finalMessage : msg)
        };
    case 'SET_ERROR':
        return {
            ...state,
            isLoading: false,
            error: action.payload.error,
            messages: state.messages.map(msg =>
                msg.id === action.payload.messageId
                    ? { ...msg, text: `Error: ${action.payload.error}`, isLoading: false, isError: true, imageUrl: undefined }
                    : msg
            )
        };
    case 'REMOVE_MESSAGE':
        return {
            ...state,
            isLoading: false,
            messages: state.messages.filter(msg => msg.id !== action.payload.messageId),
        };
    default:
      return state;
  }
}
