import React, { useState, useEffect, useRef, useCallback, useReducer } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { startChat, getFallbackResponse, generateImage, sendMessageWithRetry } from '@/services/geminiService';
import * as ttsService from '../services/ttsService';
import { submitSuggestion } from '@/services/suggestionsService';
import { getChatHistory, saveChatMessage, updateMessageFeedback } from '@/services/chatService';
import { findSimilarInteractions, logTutorInteraction } from '@/services/tutorLogService';
import { flagQuestion } from '@/services/flaggingService';
import { chatReducer, initialChatState } from '@/reducers/chatReducer';
import type { ChatMessage, ProcessStep } from '@/types';
import {
    SendIcon,
    BotIcon,
    UserIcon,
    LinkIcon,
    SpeakerOnIcon,
    SpeakerOffIcon,
    LightbulbIcon,
    DownloadIcon,
    MessageSquareIcon,
    XIcon,
    CheckCircleIcon,
    ImageIcon,
    SparklesIcon,
    ClockIcon,
    AlertTriangleIcon,
    DatabaseIcon,
    ThumbsUpIcon,
    ThumbsDownIcon
} from '@/components/Icons';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';
import type { Chat, Content, GroundingChunk } from '@google/genai';

interface ChatTutorProps {
    moduleId: string;
    sessionToken: string;
    stepsContext: string;
    fullTranscript: string;
    onTimestampClick: (time: number) => void;
    currentStepIndex: number;
    steps: ProcessStep[];
    onClose: () => void;
    initialPrompt?: string;
}

// Utility functions
const parseTimestamp = (text: string): number | null => {
    const match = text.match(/\[(?:(\d{2}):)?(\d{2}):(\d{2})\]/);
    if (!match) return null;

    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2], 10);
    const seconds = parseInt(match[3], 10);
    return hours * 3600 + minutes * 60 + seconds;
};

const isVagueQuery = (prompt: string): boolean => {
    const vagueQueryRegex = /\bdid i do this (right|correctly|okay)\??/i;
    return vagueQueryRegex.test(prompt.trim());
};

const isUnknownResponse = (text: string): boolean => {
    const unknownResponseRegex = /\b(i (don't|do not) (know|have enough|have that info)|i'm sorry|i am sorry|i cannot answer|i can't answer|i am unable to|that information isn't in this specific training)\b/i;
    return unknownResponseRegex.test(text);
};

const isDrawCommand = (text: string): boolean => {
    return text.toLowerCase().startsWith('/draw ');
};

const extractImagePrompt = (text: string): string => {
    return text.substring(6);
};

const extractSuggestion = (text: string): string | null => {
    const match = text.match(/\[SUGGESTION\]([\s\S]*?)\[\/SUGGESTION\]/);
    return match ? match[1] : null;
};

// Custom hooks
const useChatHistory = (moduleId: string, sessionToken: string) => {
    const queryKey = ['chatHistory', moduleId, sessionToken];

    return useQuery<ChatMessage[]>({
        queryKey,
        queryFn: () => getChatHistory(moduleId, sessionToken),
        enabled: !!moduleId && !!sessionToken,
    });
};

const useMessagePersistence = (moduleId: string, sessionToken: string) => {
    const queryClient = useQueryClient();
    const { addToast } = useToast();
    const chatHistoryQueryKey = ['chatHistory', moduleId, sessionToken];

    return useMutation({
        mutationFn: (message: ChatMessage) => saveChatMessage(moduleId, sessionToken, message),
        onError: (err) => {
            console.error("Failed to save message:", err);
            addToast('error', 'Sync Failed', 'Failed to save message. Your conversation may not be persisted.');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: chatHistoryQueryKey });
        }
    });
};

const useFeedbackMutation = (messages: ChatMessage[], dispatch: React.Dispatch<any>) => {
    const { addToast } = useToast();

    return useMutation({
        mutationFn: ({ messageId, feedback }: { messageId: string; feedback: 'good' | 'bad' }) =>
            updateMessageFeedback(messageId, feedback),
        onSuccess: (_, variables) => {
            const updatedMessages = messages.map((msg) =>
                msg.id === variables.messageId ? { ...msg, feedback: variables.feedback } : msg
            );
            dispatch({ type: 'SET_MESSAGES', payload: updatedMessages });
            addToast('success', 'Feedback Received', 'Thank you for helping improve the AI.');
        },
        onError: (err) => {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            addToast('error', 'Feedback Failed', `Could not save your feedback: ${errorMessage}`);
        },
    });
};

const useFlaggingMutation = (moduleId: string, currentStepIndex: number) => {
    const queryClient = useQueryClient();
    const { addToast } = useToast();
    const { user } = useAuth();

    return useMutation({
        mutationFn: (data: { userQuestion: string; aiResponse: string; }) => {
            if (!user) throw new Error("Authentication is required to flag responses.");
            return flagQuestion({
                module_id: moduleId,
                step_index: currentStepIndex,
                user_question: data.userQuestion,
                tutor_response: data.aiResponse,
                user_id: user.id
            });
        },
        onSuccess: () => {
            addToast('success', 'Submitted for Review', 'This conversation has been flagged for the module owner.');
            queryClient.invalidateQueries({ queryKey: ['flaggedQuestions', moduleId] });
        },
        onError: (err) => {
            addToast('error', 'Submission Failed', err instanceof Error ? err.message : "Could not flag the response.");
        }
    });
};

// Component
export const ChatTutor: React.FC<ChatTutorProps> = ({
    moduleId,
    sessionToken,
    stepsContext,
    fullTranscript,
    onTimestampClick,
    currentStepIndex,
    steps,
    onClose,
    initialPrompt
}) => {
    const { addToast } = useToast();
    const [state, dispatch] = useReducer(chatReducer, initialChatState);
    const { messages, input, isLoading, error } = state;

    // UI state
    const [isAutoSpeakEnabled, setIsAutoSpeakEnabled] = useState(false);
    const [isMemoryEnabled, setIsMemoryEnabled] = useState(true);
    const [showTimestamps, setShowTimestamps] = useState(true);
    const [submittedSuggestions, setSubmittedSuggestions] = useState<string[]>([]);
    const [flaggedMessageIds, setFlaggedMessageIds] = useState<string[]>([]);

    // Refs
    const chatRef = useRef<Chat | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Hooks
    const { data: initialMessages = [], isLoading: isLoadingHistory } = useChatHistory(moduleId, sessionToken);
    const { mutate: persistMessage } = useMessagePersistence(moduleId, sessionToken);
    const { mutate: sendFeedback } = useFeedbackMutation(messages, dispatch);
    const { mutate: flagResponseForReview } = useFlaggingMutation(moduleId, currentStepIndex);

    // Initialize messages from history
    useEffect(() => {
        dispatch({ type: 'SET_MESSAGES', payload: initialMessages });
    }, [initialMessages]);

    // Initialize chat
    useEffect(() => {
        if (!stepsContext || isLoadingHistory) return;

        const textBasedHistory = initialMessages.filter(msg => msg.text.trim() !== '' && !msg.isLoading);
        const geminiHistory: Content[] = textBasedHistory.map(msg => ({
            role: msg.role,
            parts: [{ text: msg.text }]
        }));

        try {
            chatRef.current = startChat(stepsContext, fullTranscript, geminiHistory);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Could not start AI chat.';
            addToast('error', 'Initialization Failed', errorMessage);
        }
    }, [stepsContext, fullTranscript, initialMessages, isLoadingHistory, addToast]);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    // Cleanup TTS on unmount
    useEffect(() => {
        return () => ttsService.cancel();
    }, []);

    // Process initial prompt
    useEffect(() => {
        if (initialPrompt) {
            sendMessage(initialPrompt);
        }
    }, [initialPrompt]);

    // Message processing functions
    const enrichPromptIfNeeded = useCallback((prompt: string): string => {
        if (isVagueQuery(prompt) && steps?.[currentStepIndex]) {
            const step = steps[currentStepIndex];
            return `The user is on step ${currentStepIndex + 1}: "${step.title}". Their question is: "${prompt}". Based on the process instructions for this step, please confirm if they are likely doing it correctly and guide them on what to do next.`;
        }
        return prompt;
    }, [currentStepIndex, steps]);

    const getMemoryContext = useCallback(async (prompt: string): Promise<string> => {
        if (!isMemoryEnabled) return '';

        try {
            const similarInteractions = await findSimilarInteractions(moduleId, prompt);
            if (similarInteractions.length === 0) return '';

            const context = "To help you, here are some questions and answers from previous trainees on this topic:\n\n---\n\n";
            const interactions = similarInteractions
                .map(log => `Question: ${log.user_question}\nAnswer: ${log.tutor_response}`)
                .join('\n\n---\n\n');

            return context + interactions + "\n\n--- \n\nNow, regarding your question:\n";
        } catch (e) {
            console.warn("Could not retrieve collective memory:", e);
            return '';
        }
    }, [isMemoryEnabled, moduleId]);

    const handleImageGeneration = useCallback(async (prompt: string) => {
        const imagePrompt = extractImagePrompt(prompt);
        const userMessage: ChatMessage = { id: Date.now().toString(), role: 'user', text: prompt };
        const modelPlaceholderId = (Date.now() + 1).toString();
        const modelPlaceholder: ChatMessage = {
            id: modelPlaceholderId,
            role: 'model',
            text: 'Generating image...',
            isLoading: true,
            imageUrl: ''
        };

        dispatch({ type: 'ADD_MESSAGES', payload: [userMessage, modelPlaceholder] });
        persistMessage(userMessage);

        try {
            const imageUrl = await generateImage(imagePrompt);
            const finalModelMessage: ChatMessage = {
                ...modelPlaceholder,
                text: '',
                isLoading: false,
                imageUrl
            };

            dispatch({
                type: 'MESSAGE_COMPLETE', payload: {
                    messageId: modelPlaceholderId,
                    finalMessage: finalModelMessage
                }
            });
            persistMessage(finalModelMessage);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            addToast('error', 'Image Generation Failed', errorMessage);
            dispatch({ type: 'SET_ERROR', payload: { messageId: modelPlaceholderId, error: errorMessage } });
        }
    }, [dispatch, persistMessage, addToast]);

    const handleTextMessage = useCallback(async (prompt: string) => {
        const userMessage: ChatMessage = { id: Date.now().toString(), role: 'user', text: prompt };
        const modelMessageId = (Date.now() + 1).toString();
        const modelPlaceholder: ChatMessage = { id: modelMessageId, role: 'model', text: '', isLoading: true };

        dispatch({ type: 'ADD_MESSAGES', payload: [userMessage, modelPlaceholder] });
        persistMessage(userMessage);

        const enrichedInput = enrichPromptIfNeeded(prompt);
        const memoryContext = await getMemoryContext(prompt);
        const finalPrompt = memoryContext + enrichedInput;

        dispatch({ type: 'START_MESSAGE' });

        let finalModelText = '';
        const finalCitations: ChatMessage['citations'] = [];
        let isFallback = false;
        let didErrorOccur = false;

        try {
            if (!chatRef.current) throw new Error("Chat not initialized");

            const stream = await sendMessageWithRetry(chatRef.current, finalPrompt);

            for await (const chunk of stream) {
                const chunkText = chunk.text;
                finalModelText += chunkText;

                const groundingChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
                let newCitations: ChatMessage['citations'] | undefined;

                if (groundingChunks && groundingChunks.length > 0) {
                    newCitations = groundingChunks
                        .map((c: GroundingChunk) => c.web)
                        .filter((c): c is { uri: string; title?: string; } => !!c?.uri);
                }

                dispatch({
                    type: 'STREAM_MESSAGE_CHUNK',
                    payload: { messageId: modelMessageId, chunk: chunkText, citations: newCitations }
                });
            }

            // Handle TTS for successful response
            if (isAutoSpeakEnabled && finalModelText) {
                try {
                    const ttsText = finalModelText.replace(/\[SUGGESTION\]([\s\S]*?)\[\/SUGGESTION\]/g, 'I have a suggestion. $1');
                    await ttsService.speak(ttsText);
                } catch (ttsErr) {
                    console.warn("TTS failed after primary AI response:", ttsErr);
                }
            }
        } catch (err) {
            console.warn("Primary AI provider failed. Attempting fallback.", err);

            try {
                const fallbackText = await getFallbackResponse(finalPrompt, messages, stepsContext, fullTranscript);
                finalModelText = fallbackText;
                isFallback = true;

                if (isAutoSpeakEnabled && fallbackText) {
                    try {
                        await ttsService.speak(fallbackText);
                    } catch (ttsErr) {
                        console.warn("TTS failed for fallback response:", ttsErr);
                    }
                }
            } catch (fallbackErr) {
                didErrorOccur = true;
                const errorMessage = fallbackErr instanceof Error ? fallbackErr.message : 'An unknown error occurred.';
                dispatch({ type: 'SET_ERROR', payload: { messageId: modelMessageId, error: errorMessage } });
            }
        } finally {
            if (finalModelText && !didErrorOccur) {
                const finalModelMessage: ChatMessage = {
                    id: modelMessageId,
                    role: 'model',
                    text: finalModelText,
                    citations: finalCitations,
                    isFallback,
                    isLoading: false,
                };

                dispatch({
                    type: 'MESSAGE_COMPLETE', payload: {
                        messageId: modelMessageId,
                        finalMessage: finalModelMessage
                    }
                });
                persistMessage(finalModelMessage);

                // Log interaction for future memory
                logTutorInteraction(moduleId, currentStepIndex, prompt, finalModelText)
                    .catch(err => console.warn("Failed to log interaction to collective memory:", err));
            } else if (!finalModelText && !didErrorOccur) {
                dispatch({ type: 'REMOVE_MESSAGE', payload: { messageId: modelMessageId } });
            }
        }
    }, [
        dispatch,
        persistMessage,
        enrichPromptIfNeeded,
        getMemoryContext,
        isAutoSpeakEnabled,
        messages,
        stepsContext,
        fullTranscript,
        moduleId,
        currentStepIndex
    ]);

    const sendMessage = useCallback(async (promptText: string) => {
        const trimmedInput = promptText.trim();
        if (!trimmedInput || isLoading || !chatRef.current) return;

        ttsService.cancel();

        if (isDrawCommand(trimmedInput)) {
            await handleImageGeneration(trimmedInput);
        } else {
            await handleTextMessage(trimmedInput);
        }
    }, [isLoading, handleImageGeneration, handleTextMessage]);

    const handleFormSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        const textToSend = input.trim();
        if (!textToSend) return;

        dispatch({ type: 'SET_INPUT', payload: '' });
        await sendMessage(textToSend);
    }, [input, sendMessage]);

    // Event handlers
    const handleSuggestionSubmit = useCallback(async (suggestionText: string, messageId: string) => {
        if (!suggestionText.trim()) {
            addToast('error', 'Empty Suggestion', 'Cannot submit a blank suggestion.');
            return;
        }

        try {
            await submitSuggestion(moduleId, currentStepIndex, suggestionText.trim());
            setSubmittedSuggestions(prev => [...prev, messageId]);
            addToast('success', 'Suggestion Submitted', 'Thank you for your feedback! The module owner will review it.');
        } catch (err) {
            console.error("Failed to submit suggestion", err);
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            addToast('error', 'Submission Failed', `Could not submit suggestion: ${errorMessage}`);
        }
    }, [moduleId, currentStepIndex, addToast]);

    const handleSubmitToOwner = useCallback((userQuestion: string, aiResponse: string, messageId: string) => {
        if (flaggedMessageIds.includes(messageId)) {
            addToast('info', 'Already Flagged', 'This response has already been submitted for review.');
            return;
        }

        addToast('info', 'Submitting...', 'Sending this conversation to the owner for review.');
        flagResponseForReview({ userQuestion, aiResponse });
        setFlaggedMessageIds(prev => [...prev, messageId]);
    }, [addToast, flaggedMessageIds, flagResponseForReview]);

    const toggleAutoSpeak = useCallback(() => {
        setIsAutoSpeakEnabled(prev => {
            if (prev) ttsService.cancel();
            return !prev;
        });
    }, []);

    const handleDownloadChat = useCallback(() => {
        if (messages.length === 0) return;

        const chatContent = messages.map(msg => {
            const prefix = msg.role === 'user' ? 'User:' : 'AI Tutor:';
            let content = msg.text.trim();

            if (msg.imageUrl) {
                content += `\n[Generated Image at: ${msg.imageUrl}]`;
            }

            content = content
                .replace(/\[SUGGESTION\]([\s\S]*?)\[\/SUGGESTION\]/g, '\n--- Suggestion ---\n$1\n--- End Suggestion ---')
                .replace(/\[\d{2}:\d{2}:\d{2}\]|\[\d{2}:\d{2}\]/g, '');

            return `${prefix}\n${content}\n`;
        }).join('\n----------------------------------------\n\n');

        const blob = new Blob([chatContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `adapt-chat-history-${moduleId}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [messages, moduleId]);

    // Render functions
    const renderTimestamp = useCallback((part: string, partIndex: number) => {
        const time = parseTimestamp(part);
        if (time === null || !showTimestamps) return null;

        return (
            <button
                key={partIndex}
                onClick={() => onTimestampClick(time)}
                className="bg-indigo-500 text-white font-mono px-2 py-1 rounded-md text-sm hover:bg-indigo-400 transition-colors"
            >
                {part.replace(/[\[\]]/g, '')}
            </button>
        );
    }, [showTimestamps, onTimestampClick]);

    const renderSuggestionBox = useCallback((suggestionText: string, messageId: string) => {
        const isSubmitted = submittedSuggestions.includes(messageId);

        return (
            <div className="bg-indigo-200/50 dark:bg-indigo-900/50 p-3 rounded-md mt-2 border border-indigo-300 dark:border-indigo-700">
                <div className="flex items-center gap-2 mb-2">
                    <LightbulbIcon className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />
                    <h4 className="font-bold text-sm text-yellow-700 dark:text-yellow-300">Suggestion</h4>
                </div>
                <p className="text-sm text-indigo-800 dark:text-indigo-100 italic">"{suggestionText.trim()}"</p>
                <button
                    onClick={() => handleSuggestionSubmit(suggestionText, messageId)}
                    disabled={isSubmitted}
                    className="text-xs w-full text-white font-semibold py-1.5 px-3 rounded-full mt-3 transition-colors flex items-center justify-center gap-2 disabled:bg-green-600 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-700"
                >
                    {isSubmitted ? (
                        <>
                            <CheckCircleIcon className="h-4 w-4" /> Submitted
                        </>
                    ) : (
                        'Propose to Owner'
                    )}
                </button>
            </div>
        );
    }, [submittedSuggestions, handleSuggestionSubmit]);

    const renderSubmitToOwnerButton = useCallback((userQuestion: string, aiResponse: string, messageId: string) => {
        const isFlagged = flaggedMessageIds.includes(messageId);

        return (
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                    This answer seems unhelpful. You can notify the module owner to help them improve this training.
                </p>
                <button
                    onClick={() => handleSubmitToOwner(userQuestion, aiResponse, messageId)}
                    disabled={isFlagged}
                    className="w-full mt-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold py-1.5 px-3 rounded-full transition-colors flex items-center justify-center gap-2 disabled:bg-green-600 disabled:cursor-not-allowed"
                >
                    {isFlagged ? (
                        <>
                            <CheckCircleIcon className="h-4 w-4" /> Submitted
                        </>
                    ) : (
                        <>
                            <AlertTriangleIcon className="h-4 w-4" /> Submit to Owner
                        </>
                    )}
                </button>
            </div>
        );
    }, [flaggedMessageIds, handleSubmitToOwner]);

    const renderMessageContent = useCallback((message: ChatMessage, index: number) => {
        const text = message.text;

        // Check for suggestion
        const suggestionText = extractSuggestion(text);
        if (suggestionText) {
            return renderSuggestionBox(suggestionText, message.id);
        }

        // Render text with timestamps
        const parts = text.split(/(\[(?:\d{2}:)?\d{2}:\d{2}\])/g);
        const renderedParts = parts.map((part, partIndex) => {
            const timestampElement = renderTimestamp(part, partIndex);
            if (timestampElement) return timestampElement;
            return <span key={partIndex}>{part}</span>;
        });

        // Check if we should show "Submit to Owner" button
        const shouldShowSubmitButton = message.role === 'model' && isUnknownResponse(text);
        const userPrompt = index > 0 ? messages[index - 1] : null;
        const canSubmit = shouldShowSubmitButton && userPrompt && userPrompt.role === 'user';

        return (
            <>
                {renderedParts}
                {canSubmit && renderSubmitToOwnerButton(userPrompt.text, message.text, message.id)}
            </>
        );
    }, [messages, renderSuggestionBox, renderTimestamp, renderSubmitToOwnerButton]);

    const renderMessage = useCallback((msg: ChatMessage, idx: number) => {
        return (
            <div key={msg.id} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''} animate-fade-in-up`}>
                {msg.role === 'model' && (
                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-indigo-500 flex items-center justify-center relative">
                        <BotIcon className="h-5 w-5 text-white" />
                        {msg.isFallback && (
                            <div className="absolute -bottom-2 -right-2 text-xs bg-amber-500 text-white rounded-full px-1 py-0.5" title="Response from fallback provider">
                                F
                            </div>
                        )}
                    </div>
                )}

                <div className={`max-w-xs md:max-w-md break-words p-3 rounded-lg ${msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : msg.isError
                        ? 'bg-red-100 dark:bg-red-900/50 rounded-bl-none'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-none'
                    }`}>
                    {msg.isLoading ? (
                        <div className="flex items-center gap-2">
                            {msg.imageUrl === '' ? (
                                <ImageIcon className="h-5 w-5 text-slate-500 animate-pulse" />
                            ) : (
                                <SparklesIcon className="h-5 w-5 text-slate-500 animate-pulse" />
                            )}
                            <span className="text-slate-600 dark:text-slate-300 italic">
                                {msg.text || 'Thinking...'}
                            </span>
                        </div>
                    ) : msg.isError ? (
                        <div className="flex items-start gap-2 text-red-800 dark:text-red-200">
                            <AlertTriangleIcon className="h-5 w-5 flex-shrink-0" />
                            <span className="text-base whitespace-pre-wrap">{msg.text}</span>
                        </div>
                    ) : msg.imageUrl ? (
                        <img
                            src={msg.imageUrl}
                            alt={msg.text || 'Generated image'}
                            className="rounded-lg max-w-full h-auto"
                        />
                    ) : (
                        <div className="text-base whitespace-pre-wrap">
                            {renderMessageContent(msg, idx)}
                        </div>
                    )}

                    {/* Citations */}
                    {msg.citations && msg.citations.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-600">
                            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Sources:</h4>
                            <div className="space-y-1">
                                {msg.citations.map((citation, cIdx) => (
                                    citation?.uri && (
                                        <a
                                            key={cIdx}
                                            href={citation.uri}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-300 hover:underline"
                                        >
                                            <LinkIcon className="h-3 w-3 flex-shrink-0" />
                                            <span className="truncate">
                                                {citation.title || new URL(citation.uri).hostname}
                                            </span>
                                        </a>
                                    )
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Feedback buttons */}
                    {msg.role === 'model' && !msg.isLoading && !msg.isError && (
                        <div className="flex items-center gap-1 mt-2 -ml-1">
                            <button
                                onClick={() => sendFeedback({ messageId: msg.id, feedback: 'good' })}
                                disabled={!!msg.feedback}
                                className={`p-1 text-slate-400 dark:text-slate-500 hover:text-green-500 disabled:cursor-not-allowed ${msg.feedback === 'good' ? 'text-green-600 dark:text-green-500' : ''}`}
                                aria-label="Good response"
                            >
                                <ThumbsUpIcon className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() =>