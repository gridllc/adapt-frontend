
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { getModule } from '@/services/moduleService';
import { startChat } from '@/services/geminiService';
import * as ttsService from '@/services/ttsService';
import { LiveCameraFeed } from '@/components/LiveCameraFeed';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { BookOpenIcon, MicIcon, SparklesIcon } from '@/components/Icons';
import type { Chat } from '@google/genai';

const LiveCoachPage: React.FC = () => {
    const { moduleId } = useParams<{ moduleId: string }>();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [aiResponse, setAiResponse] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const chatRef = React.useRef<Chat | null>(null);

    const { data: moduleData, isLoading, isError } = useQuery({
        queryKey: ['module', moduleId],
        queryFn: () => getModule(moduleId!),
        enabled: !!moduleId,
        staleTime: 1000 * 60 * 5,
        retry: false,
    });

    const handleSpeechResult = useCallback(async (transcript: string) => {
        if (!chatRef.current || isThinking) return;

        addToast('info', 'Question Sent', `"${transcript}"`);
        setIsThinking(true);
        setAiResponse('');

        try {
            const stream = await chatRef.current.sendMessageStream({ message: transcript });
            let fullText = '';
            for await (const chunk of stream) {
                const chunkText = chunk.text;
                fullText += chunkText;
                setAiResponse(fullText);
            }
            if (fullText) {
                ttsService.speak(fullText);
            }
        } catch (error) {
            console.error("Error sending message to AI:", error);
            const errorMessage = "Sorry, I couldn't process that. Please try again.";
            addToast('error', 'AI Error', errorMessage);
            setAiResponse(errorMessage);
            ttsService.speak(errorMessage);
        } finally {
            setIsThinking(false);
        }
    }, [isThinking, addToast]);

    const { isListening, startListening, stopListening, hasSupport } = useSpeechRecognition(handleSpeechResult);

    // Initialize the AI chat with the module context
    useEffect(() => {
        if (moduleData) {
            const context = `Module: ${moduleData.title}\n` + moduleData.steps.map((s, i) => `Step ${i + 1}: ${s.title} - ${s.description}`).join('\n');
            chatRef.current = startChat(context);
        }
        return () => {
            ttsService.cancel();
        };
    }, [moduleData]);

    const currentInstruction = moduleData?.steps[currentStepIndex]?.title || 'Loading instructions...';

    const handleNextStep = () => {
        if (moduleData && currentStepIndex < moduleData.steps.length - 1) {
            setCurrentStepIndex(prev => prev + 1);
        }
    };

    const handlePrevStep = () => {
        if (currentStepIndex > 0) {
            setCurrentStepIndex(prev => prev - 1);
        }
    };

    if (isLoading) {
        return <div className="text-center p-8 text-slate-500 dark:text-slate-400">Loading Live Coach...</div>;
    }

    if (isError || !moduleData) {
        return <div className="text-center p-8 text-red-500 dark:text-red-400">Failed to load module data.</div>;
    }

    return (
        <div className="w-screen h-screen bg-slate-800 flex flex-col items-center justify-center p-4 gap-4">
            <header className="absolute top-4 left-4 z-20">
                <button onClick={() => navigate('/')} className="flex items-center gap-2 py-2 px-4 rounded-full bg-black/50 text-white hover:bg-black/80 transition-colors backdrop-blur-sm">
                    <BookOpenIcon className="h-5 w-5" />
                    <span className="font-semibold">End Session</span>
                </button>
            </header>

            <div className="w-full max-w-4xl aspect-video">
                <LiveCameraFeed instruction={`Step ${currentStepIndex + 1}/${moduleData.steps.length}: ${currentInstruction}`} />
            </div>

            <div className="flex items-center gap-4 z-10">
                <button onClick={handlePrevStep} disabled={currentStepIndex === 0} className="bg-slate-600 text-white font-bold py-3 px-6 rounded-lg disabled:opacity-50 hover:bg-slate-500 transition-colors">
                    Prev Step
                </button>
                <div className="relative">
                    <button
                        onMouseDown={startListening}
                        onMouseUp={stopListening}
                        onTouchStart={startListening}
                        onTouchEnd={stopListening}
                        disabled={!hasSupport || isThinking}
                        className={`relative flex items-center justify-center w-24 h-24 rounded-full transition-all duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed ${isListening ? 'bg-red-600 scale-110' : 'bg-indigo-600 hover:bg-indigo-500'}`}
                        aria-label="Hold to talk"
                    >
                        <MicIcon className="h-10 w-10 text-white" />
                    </button>
                    {isListening && <div className="absolute inset-0 border-4 border-red-400 rounded-full animate-pulse"></div>}
                </div>
                <button onClick={handleNextStep} disabled={!moduleData || currentStepIndex === moduleData.steps.length - 1} className="bg-slate-600 text-white font-bold py-3 px-6 rounded-lg disabled:opacity-50 hover:bg-slate-500 transition-colors">
                    Next Step
                </button>
            </div>

            <div className="w-full max-w-4xl min-h-[6rem] p-4 bg-black/50 rounded-lg text-white text-center flex items-center justify-center backdrop-blur-sm">
                {isThinking ? (
                    <div className="flex items-center gap-3">
                        <SparklesIcon className="h-6 w-6 text-indigo-400 animate-pulse" />
                        <p className="text-lg italic text-slate-300">AI is thinking...</p>
                    </div>
                ) : aiResponse ? (
                    <p className="text-lg italic">{aiResponse}</p>
                ) : (
                    <p className="text-slate-400">Hold the microphone button to ask a question.</p>
                )}
            </div>
        </div>
    );
};

export default LiveCoachPage;
