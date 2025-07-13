
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/useToast';
import { getModule } from '@/services/moduleService';
import { startChat } from '@/services/geminiService';
import { initializeObjectDetector, detectObjectsInVideo } from '@/services/visionService';
import * as ttsService from '@/services/ttsService';
import { LiveCameraFeed } from '@/components/LiveCameraFeed';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { BookOpenIcon, MicIcon, SparklesIcon, SpeakerOnIcon, EyeIcon } from '@/components/Icons';
import type { Chat } from '@google/genai';
import type { DetectedObject, ModuleNeeds } from '@/types';

type CoachStatus = 'initializing' | 'idle' | 'listening' | 'thinking' | 'speaking' | 'hinting';

const LiveCoachPage: React.FC = () => {
    const { moduleId } = useParams<{ moduleId: string }>();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [status, setStatus] = useState<CoachStatus>('initializing');
    const [aiResponse, setAiResponse] = useState('');
    const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);
    const [moduleNeeds, setModuleNeeds] = useState<ModuleNeeds | null>(null);

    const chatRef = useRef<Chat | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const lastDetectionTime = useRef(0);
    const hintTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isHintingRef = useRef(false);

    const { data: moduleData, isLoading: isLoadingModule, isError, error: moduleError } = useQuery({
        queryKey: ['module', moduleId],
        queryFn: () => getModule(moduleId!),
        enabled: !!moduleId,
        staleTime: 1000 * 60 * 5,
        retry: false,
    });

    // Fetch the needs for all modules
    useEffect(() => {
        const fetchNeeds = async () => {
            try {
                const response = await fetch('/needs.json');
                const data: ModuleNeeds = await response.json();
                setModuleNeeds(data);
            } catch (error) {
                console.error("Could not fetch module needs:", error);
            }
        };
        fetchNeeds();
    }, []);

    const runDetection = useCallback(() => {
        if (status !== 'initializing' && videoRef.current && videoRef.current.readyState >= 3) {
            const detections = detectObjectsInVideo(videoRef.current);
            if (detections.length > 0) {
                setDetectedObjects(detections);
                lastDetectionTime.current = Date.now();
            } else {
                // If no objects are detected, clear the array.
                setDetectedObjects([]);
            }
        }
    }, [status]);

    // Proactive Hint Logic
    useEffect(() => {
        if (status !== 'listening' || !moduleNeeds || !moduleId || !moduleData) return;

        const requiredObjects = moduleNeeds[moduleId]?.[currentStepIndex];
        if (!requiredObjects || requiredObjects.length === 0) {
            if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
            return;
        }

        const hasAllObjects = requiredObjects.every(need =>
            detectedObjects.some(detected => detected.label.includes(need))
        );

        if (hasAllObjects) {
            if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
            hintTimerRef.current = null;
        } else if (!hintTimerRef.current && !isHintingRef.current) {
            // If mismatch, start a timer to offer a hint.
            hintTimerRef.current = setTimeout(() => {
                const hintText = `The user is on step "${moduleData.steps[currentStepIndex].title}", which requires a "${requiredObjects.join(', ')}". My vision system does not detect this item. Please provide a gentle, proactive hint to help them find the right tool or item. Keep it brief.`;
                processAiQuery(hintText, true);
            }, 5000); // 5-second delay before hinting
        }

    }, [detectedObjects, status, moduleNeeds, moduleId, currentStepIndex, moduleData]);

    const processAiQuery = useCallback(async (query: string, isProactiveHint = false) => {
        if (!chatRef.current) {
            addToast('error', 'AI Not Ready', 'The AI chat session is not initialized.');
            return;
        }

        if (isProactiveHint) {
            if (isHintingRef.current) return; // Don't allow multiple hints at once
            isHintingRef.current = true;
            setStatus('hinting');
        } else {
            setStatus('thinking');
        }

        setAiResponse('');
        addToast('info', isProactiveHint ? 'AI Hint' : 'Question Sent', isProactiveHint ? 'The AI is offering a hint.' : `"${query}"`);

        let enrichedQuery = query;
        if (!isProactiveHint) {
            const currentDetections = detectedObjects; // Capture current detections
            if (currentDetections.length > 0) {
                const objectLabels = currentDetections.map(obj => obj.label).join(', ');
                enrichedQuery = `The user asked: "${query}". My live camera analysis shows a ${objectLabels} are present. Based on the current step's instructions and this visual context, answer their question.`;
            }
        }

        try {
            const stream = await chatRef.current.sendMessageStream({ message: enrichedQuery });
            let fullText = '';
            for await (const chunk of stream) {
                fullText += chunk.text;
                setAiResponse(prev => prev + chunk.text);
            }

            if (fullText) {
                setStatus('speaking');
                ttsService.speak(fullText, () => {
                    setStatus('listening');
                    if (isProactiveHint) isHintingRef.current = false;
                });
            } else {
                setStatus('listening');
                if (isProactiveHint) isHintingRef.current = false;
            }
        } catch (error) {
            console.error("Error sending message to AI:", error);
            const errorMessage = "Sorry, I couldn't process that. Please try again.";
            addToast('error', 'AI Error', errorMessage);
            setAiResponse(errorMessage);
            setStatus('speaking');
            ttsService.speak(errorMessage, () => {
                setStatus('listening');
                if (isProactiveHint) isHintingRef.current = false;
            });
        }
    }, [addToast, detectedObjects]);

    const handleSpeechResult = useCallback((transcript: string, isFinal: boolean) => {
        if (!isFinal || status === 'thinking' || status === 'speaking' || status === 'hinting') return;

        const hotword = "hey adapt";
        const lowerTranscript = transcript.toLowerCase().trim();

        if (lowerTranscript.startsWith(hotword)) {
            const query = transcript.substring(hotword.length).trim();
            if (query) {
                ttsService.cancel();
                // If the user asks a question, cancel any pending hints.
                if (hintTimerRef.current) {
                    clearTimeout(hintTimerRef.current);
                    hintTimerRef.current = null;
                }
                processAiQuery(query);
            }
        }
    }, [processAiQuery, status]);

    const { startListening, hasSupport } = useSpeechRecognition(handleSpeechResult);

    // Effect to initialize everything
    useEffect(() => {
        const initialize = async () => {
            if (moduleData && hasSupport) {
                try {
                    await initializeObjectDetector();
                    const context = moduleData.steps.map((s, i) => `Step ${i + 1}: ${s.title}\n${s.description}`).join('\n\n');
                    chatRef.current = startChat(context);
                    startListening();
                    setStatus('listening');
                } catch (err) {
                    const msg = err instanceof Error ? err.message : 'An unknown error occurred.';
                    addToast('error', 'Initialization Failed', msg);
                    setStatus('idle');
                }
            } else if (moduleData && !hasSupport) {
                setStatus('idle');
                addToast('error', 'Unsupported Browser', 'Speech recognition is not available on this browser.');
            }
        };
        initialize();
    }, [moduleData, hasSupport, startListening, addToast]);

    useEffect(() => {
        if (!isLoadingModule && (isError || !moduleData)) {
            console.error(`Failed to load live coach module: ${moduleId}`, moduleError);
            navigate('/not-found');
        }
    }, [isLoadingModule, isError, moduleData, moduleId, navigate, moduleError]);

    const handleNextStep = () => {
        if (!moduleData) return;
        // Cancel any pending hint when user advances the step
        if (hintTimerRef.current) {
            clearTimeout(hintTimerRef.current);
            hintTimerRef.current = null;
        }
        setCurrentStepIndex(prev => {
            const nextIndex = prev + 1;
            if (nextIndex >= moduleData.steps.length) {
                addToast('success', 'Module Complete!', 'You have finished all the steps.');
                navigate(`/modules/${moduleId}`);
                return prev;
            }
            return nextIndex;
        });
    };

    const getStatusIndicator = () => {
        if (detectedObjects.length > 0 && status !== 'speaking' && status !== 'hinting' && status !== 'thinking') {
            return <><EyeIcon className="h-6 w-6 text-green-400" />Seeing: {detectedObjects.map(o => o.label).join(', ')}</>;
        }
        switch (status) {
            case 'initializing':
                return <><SparklesIcon className="h-6 w-6 text-indigo-400 animate-pulse" />Vision AI is initializing...</>;
            case 'listening':
                return <><MicIcon className="h-6 w-6 text-green-400" />Listening for "Hey Adapt"...</>;
            case 'thinking':
                return <><SparklesIcon className="h-6 w-6 text-indigo-400 animate-pulse" />Thinking...</>;
            case 'hinting':
                return <><SparklesIcon className="h-6 w-6 text-yellow-400 animate-pulse" />Offering a hint...</>;
            case 'speaking':
                return <><SpeakerOnIcon className="h-6 w-6 text-amber-400" />{aiResponse}</>;
            case 'idle':
                return 'Live Coach is idle.';
            default:
                return 'Initializing...';
        }
    }

    if (isLoadingModule || !moduleData) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-900">
                <p className="text-xl text-slate-300">Loading Live Coach...</p>
            </div>
        );
    }

    const currentInstruction = moduleData.steps[currentStepIndex]?.title ?? "Module Complete!";

    return (
        <div className="flex flex-col h-screen bg-slate-800 text-white font-sans">
            <header className="flex-shrink-0 p-4 bg-slate-900/50 backdrop-blur-sm border-b border-slate-700 flex justify-between items-center">
                <button onClick={() => navigate(`/modules/${moduleId}`)} className="text-slate-300 hover:text-indigo-400 transition-colors flex items-center gap-2">
                    <BookOpenIcon className="h-5 w-5" />
                    <span>Back to Training</span>
                </button>
                <h1 className="text-2xl font-bold">{moduleData.title}</h1>
                <span className="font-bold text-lg text-indigo-400">Live Coach</span>
            </header>

            <main className="flex-1 p-4 md:p-6 grid grid-rows-[1fr,auto] gap-4 overflow-hidden">
                <div className="min-h-0">
                    <LiveCameraFeed
                        ref={videoRef}
                        instruction={currentInstruction}
                        onClick={handleNextStep}
                        detectedObjects={detectedObjects}
                    />
                </div>

                <footer className="flex-shrink-0 h-24 bg-slate-900 rounded-lg p-4 flex items-center justify-center text-center shadow-lg border border-slate-700">
                    <div className="flex items-center gap-3 text-lg text-slate-300">
                        {getStatusIndicator()}
                    </div>
                </footer>
            </main>
        </div>
    );
};

export default LiveCoachPage;
