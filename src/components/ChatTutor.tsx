
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
import { SendIcon, BotIcon, UserIcon, LinkIcon, SpeakerOnIcon, SpeakerOffIcon, LightbulbIcon, DownloadIcon, MessageSquareIcon, XIcon, CheckCircleIcon, ImageIcon, SparklesIcon, ClockIcon, AlertTriangleIcon, DatabaseIcon, ThumbsUpIcon, ThumbsDownIcon } from '@/components/Icons';
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

const parseTimestamp = (text: string): number | null => {
    const match = text.match(/\[(?:(\d{2}):)?(\d{2}):(\d{2})\]/);
    if (match) {
        const hours = parseInt(match[1] || '0', 10);
        const minutes = parseInt(match[2], 10);
        const seconds = parseInt(match[3], 10);
        return hours * 3600 + minutes * 60 + seconds;
    }
    return null;
};

export const ChatTutor: React.FC<ChatTutorProps> = ({ moduleId, sessionToken, stepsContext, fullTranscript, onTimestampClick, currentStepIndex, steps, onClose, initialPrompt }) => {
    const queryClient = useQueryClient();
    const chatHistoryQueryKey = ['chatHistory', moduleId, sessionToken];
    const { addToast } = useToast();
    const { user } = useAuth();

    const [state, dispatch] = useReducer(chatReducer, initialChatState);
    const { messages, input, isLoading, error } = state;

    const { data: initialMessages = [], isLoading: isLoadingHistory } = useQuery<ChatMessage[]>({
        queryKey: chatHistoryQueryKey,
        queryFn: () => getChatHistory(moduleId, sessionToken),
        enabled: !!moduleId && !!sessionToken,
    });

    const [isAutoSpeakEnabled, setIsAutoSpeakEnabled] = useState(false);
    const [isMemoryEnabled, setIsMemoryEnabled] = useState(true);
    const [showTimestamps, setShowTimestamps] = useState(true);
    const [submittedSuggestions, setSubmittedSuggestions] = useState<string[]>([]);
    const [flaggedMessageIds, setFlaggedMessageIds] = useState<string[]>([]);
    const chatRef = useRef<Chat | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const { mutate: persistMessage } = useMutation({
        mutationFn: (message: ChatMessage) => saveChatMessage(moduleId, sessionToken, message),
        onError: (err) => {
            console.error("Failed to save message:", err);
            addToast('error', 'Sync Failed', 'Failed to save message. Your conversation may not be persisted.');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: chatHistoryQueryKey });
        }
    });

    const { mutate: sendFeedback } = useMutation({
        mutationFn: ({ messageId, feedback }: { messageId: string; feedback: 'good' | 'bad' }) =>
            updateMessageFeedback(messageId, feedback),
        onSuccess: (_, variables) => {
            // Optimistically update the local state for instant UI response
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

    const { mutate: flagResponseForReview } = useMutation({
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

    useEffect(() => {
        dispatch({ type: 'SET_MESSAGES', payload: initialMessages });
    }, [initialMessages]);

    useEffect(() => {
        return () => ttsService.cancel();
    }, []);

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

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    const enrichPromptIfNeeded = useCallback((prompt: string): string => {
        const vagueQueryRegex = /\bdid i do this (right|correctly|okay)\??/i;

        if (vagueQueryRegex.test(prompt.trim()) && steps?.[currentStepIndex]) {
            const step = steps[currentStepIndex];
            return `The user is on step ${currentStepIndex + 1}: "${step.title}". Their question is: "${prompt}". Based on the process instructions for this step, please confirm if they are likely doing it correctly and guide them on what to do next.`;
        }
        return prompt;
    }, [currentStepIndex, steps]);

    const sendMessage = useCallback(async (promptText: string) => {
        const trimmedInput = promptText.trim();
        if (!trimmedInput || isLoading || !chatRef.current) return;

        ttsService.cancel();

        // Handle image generation command
        if (trimmedInput.toLowerCase().startsWith('/draw ')) {
            const imagePrompt = trimmedInput.substring(6);
            const userMessage: ChatMessage = { id: Date.now().toString(), role: 'user', text: trimmedInput };
            const modelPlaceholderId = (Date.now() + 1).toString();
            const modelPlaceholder: ChatMessage = { id: modelPlaceholderId, role: 'model', text: 'Generating image...', isLoading: true, imageUrl: '' };

            dispatch({ type: 'ADD_MESSAGES', payload: [userMessage, modelPlaceholder] });
            persistMessage(userMessage);

            try {
                const imageUrl = await generateImage(imagePrompt);
                const finalModelMessage: ChatMessage = { ...modelPlaceholder, text: '', isLoading: false, imageUrl };
                dispatch({ type: 'MESSAGE_COMPLETE', payload: { messageId: modelPlaceholderId, finalMessage: finalModelMessage } });
                persistMessage(finalModelMessage);
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
                addToast('error', 'Image Generation Failed', errorMessage);
                dispatch({ type: 'SET_ERROR', payload: { messageId: modelPlaceholderId, error: errorMessage } });
            }
            return;
        }

        // --- RAG: Retrieve similar past interactions ---
        let memoryContext = '';
        if (isMemoryEnabled) {
            try {
                const similarInteractions = await findSimilarInteractions(moduleId, trimmedInput);
                if (similarInteractions.length > 0) {
                    memoryContext = "To help you, here are some questions and answers from previous trainees on this topic:\n\n---\n\n";
                    memoryContext += similarInteractions
                        .map(log => `Question: ${log.user_question}\nAnswer: ${log.tutor_response}`)
                        .join('\n\n---\n\n');
                    memoryContext += "\n\n--- \n\nNow, regarding your question:\n";
                }
            } catch (e) { console.warn("Could not retrieve collective memory:", e); }
        }


        // Standard text message handling
        const userMessage: ChatMessage = { id: Date.now().toString(), role: 'user', text: trimmedInput };
        const modelMessageId = (Date.now() + 1).toString();
        const modelPlaceholder: ChatMessage = { id: modelMessageId, role: 'model', text: '', isLoading: true };

        dispatch({ type: 'ADD_MESSAGES', payload: [userMessage, modelPlaceholder] });
        persistMessage(userMessage);

        const enrichedInput = enrichPromptIfNeeded(trimmedInput);
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
                dispatch({ type: 'STREAM_MESSAGE_CHUNK', payload: { messageId: modelMessageId, chunk: chunkText, citations: newCitations } });
            }

            if (isAutoSpeakEnabled && finalModelText) {
                try { await ttsService.speak(finalModelText.replace(/\[SUGGESTION\]([\s\S]*?)\[\/SUGGESTION\]/g, 'I have a suggestion. $1')); }
                catch (ttsErr) { console.warn("TTS failed after primary AI response:", ttsErr); }
            }
        } catch (err) {
            console.warn("Primary AI provider failed. Attempting fallback.", err);
            try {
                const fallbackText = await getFallbackResponse(finalPrompt, messages, stepsContext, fullTranscript);
                finalModelText = fallbackText;
                isFallback = true;
                if (isAutoSpeakEnabled && fallbackText) {
                    try { await ttsService.speak(fallbackText); }
                    catch (ttsErr) { console.warn("TTS failed for fallback response:", ttsErr); }
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
                dispatch({ type: 'MESSAGE_COMPLETE', payload: { messageId: modelMessageId, finalMessage: finalModelMessage } });
                persistMessage(finalModelMessage);
                logTutorInteraction(moduleId, currentStepIndex, trimmedInput, finalModelText)
                    .catch(err => console.warn("Failed to log interaction to collective memory:", err));
            } else if (!finalModelText && !didErrorOccur) {
                dispatch({ type: 'REMOVE_MESSAGE', payload: { messageId: modelMessageId } });
            }
        }
    }, [isLoading, isAutoSpeakEnabled, enrichPromptIfNeeded, stepsContext, fullTranscript, messages, persistMessage, addToast, moduleId, sessionToken, currentStepIndex, isMemoryEnabled]);

    const handleFormSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        const textToSend = input.trim();
        if (!textToSend) return;
        dispatch({ type: 'SET_INPUT', payload: '' });
        await sendMessage(textToSend);
    }, [input, sendMessage]);

    useEffect(() => {
        if (initialPrompt) {
            sendMessage(initialPrompt);
        }
    }, [initialPrompt, sendMessage]);


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
        setFlaggedMessageIds(prev => [...prev, messageId]); // Optimistic UI update
    }, [addToast, flaggedMessageIds, flagResponseForReview]);

    const renderMessageContent = (message: ChatMessage, index: number) => {
        const text = message.text;

        // --- Suggestion Box Rendering ---
        const suggestionMatch = text.match(/\[SUGGESTION\]([\s\S]*?)\[\/SUGGESTION\]/);
        if (suggestionMatch) {
            const suggestionText = suggestionMatch[1];
            const isSubmitted = submittedSuggestions.includes(message.id);

            return (
                <div className="bg-indigo-200/50 dark:bg-indigo-900/50 p-3 rounded-md mt-2 border border-indigo-300 dark:border-indigo-700">
                    <div className="flex items-center gap-2 mb-2">
                        <LightbulbIcon className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />
                        <h4 className="font-bold text-sm text-yellow-700 dark:text-yellow-300">Suggestion</h4>
                    </div>
                    <p className="text-sm text-indigo-800 dark:text-indigo-100 italic">"{suggestionText.trim()}"</p>
                    <button
                        onClick={() => handleSuggestionSubmit(suggestionText, message.id)}
                        disabled={isSubmitted}
                        className="text-xs w-full text-white font-semibold py-1.5 px-3 rounded-full mt-3 transition-colors flex items-center justify-center gap-2 disabled:bg-green-600 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-700"
                    >
                        {isSubmitted ? (
                            <><CheckCircleIcon className="h-4 w-4" /> Submitted</>
                        ) : (
                            'Propose to Owner'
                        )}
                    </button>
                </div>
            );
        }

        // --- Timestamp and Text Rendering ---
        // eslint-disable-next-line no-useless-escape
        const parts = text.split(/(\[(?:\d{2}:)?\d{2}:\d{2}\])/g);
        const renderedParts = parts.map((part, partIndex) => {
            const time = parseTimestamp(part);
            if (time !== null) {
                if (showTimestamps) {
                    return (
                        <button
                            key={partIndex}
                            onClick={() => onTimestampClick(time)}
                            className="bg-indigo-500 text-white font-mono px-2 py-1 rounded-md text-sm hover:bg-indigo-400 transition-colors"
                        >
                            {part.replace(/[\[\]]/g, '')}
                        </button>
                    );
                }
                return null;
            }
            return <span key={partIndex}>{part}</span>;
        });

        // --- "Submit to Owner" Button Logic ---
        const unknownResponseRegex = /\b(i (don’t|do not) (know|have enough|have that info)|i'm sorry|i am sorry|i cannot answer|i can't answer|i am unable to|that information isn't in this specific training)\b/i;
        const showSubmitToOwner = message.role === 'model' && unknownResponseRegex.test(text);

        const userPrompt = index > 0 ? messages[index - 1] : null;
        const canSubmit = showSubmitToOwner && userPrompt && userPrompt.role === 'user';
        const isFlagged = flaggedMessageIds.includes(message.id);

        return (
            <>
                {renderedParts}
                {canSubmit && (
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600">
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                            This answer seems unhelpful. You can notify the module owner to help them improve this training.
                        </p>
                        <button
                            onClick={() => handleSubmitToOwner(userPrompt.text, message.text, message.id)}
                            disabled={isFlagged}
                            className="w-full mt-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold py-1.5 px-3 rounded-full transition-colors flex items-center justify-center gap-2 disabled:bg-green-600 disabled:cursor-not-allowed"
                        >
                            {isFlagged ? <><CheckCircleIcon className="h-4 w-4" /> Submitted</> : <><AlertTriangleIcon className="h-4 w-4" /> Submit to Owner</>}
                        </button>
                    </div>
                )}
            </>
        )
    };

    const toggleAutoSpeak = () => {
        setIsAutoSpeakEnabled(prev => {
            if (!prev === false) ttsService.cancel();
            return !prev;
        });
    };

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

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-800/50 rounded-2xl">
            <header className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <MessageSquareIcon className="h-6 w-6 text-indigo-500 dark:text-indigo-400" />
                    <h2 className="font-bold text-lg text-slate-900 dark:text-white">Adapt AI Tutor</h2>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsMemoryEnabled(prev => !prev)}
                        className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                        aria-label={isMemoryEnabled ? "Disable collective memory" : "Enable collective memory"}
                        title={isMemoryEnabled ? "Disable collective memory (RAG)" : "Enable collective memory (RAG)"}
                    >
                        <DatabaseIcon className={`h-5 w-5 ${isMemoryEnabled ? 'text-indigo-500 dark:text-indigo-400' : ''}`} />
                    </button>
                    <button
                        onClick={() => setShowTimestamps(prev => !prev)}
                        className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                        aria-label={showTimestamps ? "Hide timestamps" : "Show timestamps"}
                        title={showTimestamps ? "Hide timestamps" : "Show timestamps"}
                    >
                        <ClockIcon className={`h-5 w-5 ${showTimestamps ? 'text-indigo-500 dark:text-indigo-400' : ''}`} />
                    </button>
                    <button
                        onClick={handleDownloadChat}
                        className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                        aria-label="Download chat history"
                        title="Download chat history"
                        disabled={messages.length === 0}
                    >
                        <DownloadIcon className="h-5 w-5" />
                    </button>
                    <button
                        onClick={toggleAutoSpeak}
                        className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                        aria-label={isAutoSpeakEnabled ? "Disable auto-speak" : "Enable auto-speak"}
                        title={isAutoSpeakEnabled ? "Disable auto-speak" : "Enable auto-speak"}
                    >
                        {isAutoSpeakEnabled ? <SpeakerOnIcon className="h-5 w-5 text-green-500 dark:text-green-400" /> : <SpeakerOffIcon className="h-5 w-5" />}
                    </button>
                    <button onClick={onClose} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                        <XIcon className="h-6 w-6" />
                    </button>
                </div>
            </header>
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                {isLoadingHistory && <div className="text-center text-slate-500 dark:text-slate-400">Loading chat history...</div>}

                {!isLoadingHistory && messages.length === 0 && !isLoading && !error && (
                    <div className="flex items-start gap-3 animate-fade-in-up">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-indigo-500 flex items-center justify-center">
                            <BotIcon className="h-5 w-5 text-white" />
                        </div>
                        <div className="max-w-xs md:max-w-md break-words p-3 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-none">
                            <p className="text-base whitespace-pre-wrap">Hello! I'm the Adapt AI Tutor. I can try to answer questions about the process.</p>
                        </div>
                    </div>
                )}
                {messages.map((msg, idx) => (
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
                                    {msg.imageUrl === '' ? <ImageIcon className="h-5 w-5 text-slate-500 animate-pulse" /> : <SparklesIcon className="h-5 w-5 text-slate-500 animate-pulse" />}
                                    <span className="text-slate-600 dark:text-slate-300 italic">{msg.text || 'Thinking...'}</span>
                                </div>
                            ) : msg.isError ? (
                                <div className="flex items-start gap-2 text-red-800 dark:text-red-200">
                                    <AlertTriangleIcon className="h-5 w-5 flex-shrink-0" />
                                    <span className="text-base whitespace-pre-wrap">{msg.text}</span>
                                </div>
                            ) : msg.imageUrl ? (
                                <img src={msg.imageUrl} alt={msg.text || 'Generated image'} className="rounded-lg max-w-full h-auto" />
                            ) : (
                                <div className="text-base whitespace-pre-wrap">{renderMessageContent(msg, idx)}</div>
                            )}

                            {msg.citations && msg.citations.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-600">
                                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Sources:</h4>
                                    <div className="space-y-1">
                                        {msg.citations.map((citation, cIdx) => (
                                            citation?.uri && <a key={cIdx} href={citation.uri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-300 hover:underline">
                                                <LinkIcon className="h-3 w-3 flex-shrink-0" />
                                                <span className="truncate">{citation.title || new URL(citation.uri).hostname}</span>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
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
                                        onClick={() => sendFeedback({ messageId: msg.id, feedback: 'bad' })}
                                        disabled={!!msg.feedback}
                                        className={`p-1 text-slate-400 dark:text-slate-500 hover:text-red-500 disabled:cursor-not-allowed ${msg.feedback === 'bad' ? 'text-red-600 dark:text-red-500' : ''}`}
                                        aria-label="Bad response"
                                    >
                                        <ThumbsDownIcon className="h-4 w-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                        {msg.role === 'user' && (
                            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-slate-400 dark:bg-slate-600 flex items-center justify-center">
                                <UserIcon className="h-5 w-5 text-white" />
                            </div>
                        )}
                    </div>
                ))}

                {isLoading && !messages.some(m => m.isLoading) && (
                    <div className="flex items-start gap-3 animate-fade-in-up">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-indigo-500 flex items-center justify-center">
                            <BotIcon className="h-5 w-5 text-white animate-pulse" />
                        </div>
                        <div className="bg-slate-100 dark:bg-slate-700 p-3 rounded-lg rounded-bl-none">
                            <div className="flex items-center space-x-1">
                                <div className="h-2 w-2 bg-slate-400 dark:bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                <div className="h-2 w-2 bg-slate-400 dark:bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                <div className="h-2 w-2 bg-slate-400 dark:bg-slate-400 rounded-full animate-bounce"></div>
                            </div>
                        </div>
                    </div>
                )}
                {error && <p className="text-red-500 dark:text-red-400 text-center text-sm p-2 bg-red-100 dark:bg-red-900/50 rounded-md">{error}</p>}
                <div ref={messagesEndRef} />
            </div>
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
                <form onSubmit={handleFormSubmit} className="flex items-center gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => dispatch({ type: 'SET_INPUT', payload: e.target.value })}
                        placeholder={error ? "AI Tutor is unavailable" : "Ask or type /draw..."}
                        className="flex-1 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white disabled:opacity-50"
                        disabled={isLoading || !!error || isLoadingHistory}
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !input.trim() || !!error || isLoadingHistory}
                        className="bg-indigo-600 text-white p-2.5 rounded-lg disabled:bg-slate-400 dark:disabled:bg-slate-500 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
                    >
                        <SendIcon className="h-5 w-5" />
                    </button>
                </form>
            </div>
        </div>
    );
};