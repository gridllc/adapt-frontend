
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { startChat, getFallbackResponse } from '@/services/geminiService';
import * as ttsService from '../services/ttsService';
import { submitSuggestion } from '@/services/suggestionsService';
import type { ChatMessage, ProcessStep } from '@/types';
import { SendIcon, BotIcon, UserIcon, LinkIcon, SpeakerOnIcon, SpeakerOffIcon, LightbulbIcon, DownloadIcon, MessageSquareIcon, XIcon, CheckCircleIcon } from '@/components/Icons';
import type { Chat, Content, GroundingChunk } from '@google/genai';

interface ChatTutorProps {
    moduleId: string;
    sessionToken: string;
    transcriptContext: string;
    onTimestampClick: (time: number) => void;
    currentStepIndex: number;
    steps: ProcessStep[];
    onClose: () => void;
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

export const ChatTutor: React.FC<ChatTutorProps> = ({ moduleId, sessionToken, transcriptContext, onTimestampClick, currentStepIndex, steps, onClose }) => {
    const CHAT_HISTORY_KEY = `adapt-ai-tutor-chat-history-${moduleId}-${sessionToken}`;

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isAutoSpeakEnabled, setIsAutoSpeakEnabled] = useState(false);
    const [submittedSuggestions, setSubmittedSuggestions] = useState<string[]>([]);
    const chatRef = useRef<Chat | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let loadedMessages: ChatMessage[] = [];
        try {
            const savedHistoryJSON = localStorage.getItem(CHAT_HISTORY_KEY);
            if (savedHistoryJSON) {
                loadedMessages = JSON.parse(savedHistoryJSON);
            }
        } catch (e) {
            console.error("Failed to parse chat history, starting fresh.", e);
            localStorage.removeItem(CHAT_HISTORY_KEY);
        }
        setMessages(loadedMessages);

        const geminiHistory: Content[] = loadedMessages.map(msg => ({
            role: msg.role,
            parts: [{ text: msg.text }]
        }));

        try {
            chatRef.current = startChat(transcriptContext, geminiHistory);
        } catch (err) {
            console.error("Failed to initialize chat:", err);
            setError(err instanceof Error ? err.message : 'Could not start AI chat.');
        }

        return () => {
            ttsService.cancel();
        }
    }, [transcriptContext, CHAT_HISTORY_KEY]);

    useEffect(() => {
        const handler = setTimeout(() => {
            try {
                if (messages.length > 0) {
                    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages));
                } else {
                    localStorage.removeItem(CHAT_HISTORY_KEY);
                }
            } catch (e) {
                console.error("Failed to save chat history.", e);
            }
        }, 500);

        return () => clearTimeout(handler);
    }, [messages, CHAT_HISTORY_KEY]);

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

    const handleSendMessage = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading || !chatRef.current) return;

        ttsService.cancel();
        const userMessage: ChatMessage = { id: Date.now().toString(), role: 'user', text: input };
        const currentMessages = [...messages, userMessage];
        setMessages(currentMessages);

        const enrichedInput = enrichPromptIfNeeded(input);
        setInput('');
        setIsLoading(true);
        setError(null);

        const modelMessageId = (Date.now() + 1).toString();
        setMessages(prev => [...prev, { id: modelMessageId, role: 'model', text: '', citations: [] }]);

        let finalModelText = '';
        try {
            if (!chatRef.current) {
                throw new Error("Chat not initialized");
            }
            const stream = await chatRef.current.sendMessageStream({ message: enrichedInput });

            for await (const chunk of stream) {
                const chunkText = chunk.text;
                finalModelText += chunkText;
                const groundingChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;

                setMessages(prev =>
                    prev.map(msg => {
                        if (msg.id !== modelMessageId) return msg;
                        const updatedMsg: ChatMessage = { ...msg, text: msg.text + chunkText };
                        if (groundingChunks && groundingChunks.length > 0) {
                            const newCitations = groundingChunks
                                .map((c: GroundingChunk) => c.web)
                                .filter((c): c is { uri: string; title?: string; } => !!c?.uri)
                                .map(c => ({ uri: c.uri, title: c.title || c.uri }));
                            if (newCitations.length > 0) {
                                const currentCitations = msg.citations || [];
                                const combined = [...currentCitations, ...newCitations];
                                updatedMsg.citations = combined.filter((v, i, a) => a.findIndex(t => (t.uri === v.uri)) === i);
                            }
                        }
                        return updatedMsg;
                    })
                );
            }
            if (isAutoSpeakEnabled && finalModelText) {
                ttsService.speak(finalModelText.replace(/\[SUGGESTION\]([\s\S]*?)\[\/SUGGESTION\]/g, 'I have a suggestion. $1'));
            }
        } catch (err) {
            console.warn("Primary AI provider failed. Attempting fallback.", err);
            try {
                const fallbackText = await getFallbackResponse(enrichedInput, currentMessages, transcriptContext);
                setMessages(prev =>
                    prev.map(msg =>
                        msg.id === modelMessageId
                            ? { ...msg, text: fallbackText, isFallback: true }
                            : msg
                    )
                );
                if (isAutoSpeakEnabled && fallbackText) {
                    ttsService.speak(fallbackText);
                }
            } catch (fallbackErr) {
                const errorMessage = fallbackErr instanceof Error ? fallbackErr.message : 'An unknown error occurred.';
                setError(errorMessage);
                setMessages(prev => prev.filter(msg => msg.id !== modelMessageId && msg.id !== userMessage.id));
            }
        } finally {
            setIsLoading(false);
        }
    }, [input, isLoading, isAutoSpeakEnabled, enrichPromptIfNeeded, transcriptContext, messages]);

    const handleSuggestionSubmit = useCallback((suggestionText: string) => {
        try {
            submitSuggestion(moduleId, currentStepIndex, suggestionText.trim());
            setSubmittedSuggestions(prev => [...prev, suggestionText]);
            alert("Suggestion submitted! The module owner will review it. Thank you for your feedback.");
        } catch (error) {
            console.error("Failed to submit suggestion", error);
            setError("Could not submit suggestion at this time.");
        }
    }, [moduleId, currentStepIndex]);

    const renderMessageContent = (text: string) => {
        const suggestionMatch = text.match(/\[SUGGESTION\]([\s\S]*?)\[\/SUGGESTION\]/);
        if (suggestionMatch) {
            const suggestionText = suggestionMatch[1];
            const isSubmitted = submittedSuggestions.includes(suggestionText);

            return (
                <div className="bg-indigo-900/50 p-3 rounded-md mt-2 border border-indigo-700">
                    <div className="flex items-center gap-2 mb-2">
                        <LightbulbIcon className="h-5 w-5 text-yellow-400" />
                        <h4 className="font-bold text-sm text-yellow-300">Suggestion</h4>
                    </div>
                    <p className="text-sm text-indigo-100 italic">"{suggestionText.trim()}"</p>
                    <button
                        onClick={() => handleSuggestionSubmit(suggestionText)}
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

        const parts = text.split(/(\[(?:\d{2}:)?\d{2}:\d{2}\])/g);
        return parts.map((part, index) => {
            const time = parseTimestamp(part);
            if (time !== null) {
                return (
                    <button
                        key={index}
                        onClick={() => onTimestampClick(time)}
                        className="bg-indigo-500 text-white font-mono px-2 py-1 rounded-md text-sm hover:bg-indigo-400 transition-colors"
                    >
                        {part.replace(/[\[\]]/g, '')}
                    </button>
                );
            }
            return <span key={index}>{part}</span>;
        });
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
            const text = msg.text
                .replace(/\[SUGGESTION\]([\s\S]*?)\[\/SUGGESTION\]/g, '\n--- Suggestion ---\n$1\n--- End Suggestion ---')
                .replace(/\[\d{2}:\d{2}:\d{2}\]|\[\d{2}:\d{2}\]/g, '');
            return `${prefix}\n${text.trim()}\n`;
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
        <div className="flex flex-col h-full">
            <header className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <MessageSquareIcon className="h-6 w-6 text-indigo-400" />
                    <h2 className="font-bold text-lg text-white">Adapt AI Tutor</h2>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleDownloadChat}
                        className="p-1 text-slate-400 hover:text-white transition-colors"
                        aria-label="Download chat history"
                        title="Download chat history"
                        disabled={messages.length === 0}
                    >
                        <DownloadIcon className="h-5 w-5" />
                    </button>
                    <button
                        onClick={toggleAutoSpeak}
                        className="p-1 text-slate-400 hover:text-white transition-colors"
                        aria-label={isAutoSpeakEnabled ? "Disable auto-speak" : "Enable auto-speak"}
                        title={isAutoSpeakEnabled ? "Disable auto-speak" : "Enable auto-speak"}
                    >
                        {isAutoSpeakEnabled ? <SpeakerOnIcon className="h-5 w-5 text-green-400" /> : <SpeakerOffIcon className="h-5 w-5" />}
                    </button>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <XIcon className="h-6 w-6" />
                    </button>
                </div>
            </header>
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                {messages.length === 0 && !isLoading && !error && (
                    <div className="flex items-start gap-3 animate-fade-in-up">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-indigo-500 flex items-center justify-center">
                            <BotIcon className="h-5 w-5 text-white" />
                        </div>
                        <div className="max-w-xs md:max-w-md break-words p-3 rounded-lg bg-slate-700 text-slate-200 rounded-bl-none">
                            <p className="text-base whitespace-pre-wrap">Hello! I'm the Adapt AI Tutor. I've been trained on your company's specific process for this task. Ask me anything, and I'll guide you using the official steps.</p>
                        </div>
                    </div>
                )}
                {messages.map((msg) => (
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
                        <div className={`max-w-xs md:max-w-md break-words p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-slate-700 text-slate-200 rounded-bl-none'}`}>
                            <div className="text-base whitespace-pre-wrap">{renderMessageContent(msg.text)}</div>
                            {msg.citations && msg.citations.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-slate-600">
                                    <h4 className="text-xs font-bold text-slate-400 mb-1">Sources:</h4>
                                    <div className="space-y-1">
                                        {msg.citations.map((citation, idx) => (
                                            citation?.uri && <a key={idx} href={citation.uri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-indigo-300 hover:underline">
                                                <LinkIcon className="h-3 w-3 flex-shrink-0" />
                                                <span className="truncate">{citation.title || new URL(citation.uri).hostname}</span>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        {msg.role === 'user' && (
                            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-slate-600 flex items-center justify-center">
                                <UserIcon className="h-5 w-5 text-white" />
                            </div>
                        )}
                    </div>
                ))}
                {isLoading && messages[messages.length - 1]?.role === 'model' && (
                    <div className="flex items-start gap-3 animate-fade-in-up">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-indigo-500 flex items-center justify-center">
                            <BotIcon className="h-5 w-5 text-white animate-pulse" />
                        </div>
                        <div className="bg-slate-700 p-3 rounded-lg rounded-bl-none">
                            <div className="flex items-center space-x-1">
                                <div className="h-2 w-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                <div className="h-2 w-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                <div className="h-2 w-2 bg-slate-400 rounded-full animate-bounce"></div>
                            </div>
                        </div>
                    </div>
                )}
                {error && <p className="text-red-400 text-center text-sm p-2 bg-red-900/50 rounded-md">{error}</p>}
                <div ref={messagesEndRef} />
            </div>
            <div className="p-4 border-t border-slate-700 flex-shrink-0">
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={error ? "AI Tutor is unavailable" : "Ask a question..."}
                        className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white disabled:opacity-50"
                        disabled={isLoading || !!error}
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !input.trim() || !!error}
                        className="bg-indigo-600 text-white p-2.5 rounded-lg disabled:bg-slate-500 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
                    >
                        <SendIcon className="h-5 w-5" />
                    </button>
                </form>
            </div>
        </div>
    );
};
