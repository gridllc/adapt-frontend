
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
import { BookOpenIcon, MicIcon, SparklesIcon, SpeakerOnIcon, EyeIcon, AlertTriangleIcon } from '@/components/Icons';
import type { Chat } from '@google/genai';
import type { DetectedObject, ModuleNeeds, StepNeeds } from '@/types';

type CoachStatus = 'initializing' | 'idle' | 'listening' | 'thinking' | 'speaking' | 'hinting' | 'correcting';

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
    const isInterjectingRef = useRef(false);

    const { data: moduleData, isLoading: isLoadingModule, isError, error: moduleError } = useQuery({
        queryKey: ['module', moduleId],
        queryFn: () => getModule(moduleId!),
        enabled: !!moduleId,
        staleTime: 1000 * 60 * 5,
        retry: false,
    });

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

    // Proactive Hinting & Mistake Detection Logic
    useEffect(() => {
        // This effect should only run when the system is in a listening state and ready to be proactive.
        if (status !== 'listening' || !moduleNeeds || !moduleId || !moduleData) return;

        const needs: StepNeeds | undefined = moduleNeeds[moduleId]?.[currentStepIndex];
        if (!needs) {
            if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
            return;
        }

        // --- Mistake Detection (Highest Priority) ---
        const forbiddenObjects = needs.forbidden || [];
        const detectedForbiddenItem = detectedObjects.find(detected =>
            forbiddenObjects.some(forbidden => detected.label.includes(forbidden))
        );

        if (detectedForbiddenItem) {
            if (hintTimerRef.current) clearTimeout(hintTimerRef.current); // Cancel any pending hints
            const mistakeText = `The user is on step "${moduleData.steps[currentStepIndex].title}". They are supposed to use: "${needs.required.join(', ')}". My vision system has detected a forbidden item: a "${detectedForbiddenItem.label}". Provide an immediate, gentle, but clear correction to get them back on track.`;
            processAiQuery(mistakeText, 'correction');
            return; // Stop further checks
        }

        // --- Proactive Hint Logic (Lower Priority) ---
        const requiredObjects = needs.required || [];
        if (requiredObjects.length === 0) {
            if (hintTimerRef.current) clearTimeout(hintTimerRef.current); // No hint needed
            return;
        }

        const hasAllRequiredObjects = requiredObjects.every(req =>
            detectedObjects.some(detected => detected.label.includes(req))
        );

        if (hasAllRequiredObjects) {
            if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
            hintTimerRef.current = null;
        } else if (!hintTimerRef.current && !isInterjectingRef.current) {
            // If there's a mismatch, start a timer to offer a hint.
            hintTimerRef.current = setTimeout(() => {
                const hintText = `The user is on step "${moduleData.steps[currentStepIndex].title}", which requires a "${requiredObjects.join(', ')}". My vision system does not detect this item. Please provide a gentle, proactive hint to help them find the right tool or item. Keep it brief.`;
                processAiQuery(hintText, 'hint');
            }, 5000); // 5-second delay
        }

    }, [detectedObjects, status, moduleNeeds, moduleId, currentStepIndex, moduleData]);

    const processAiQuery = useCallback(async (query: string, type: 'question' | 'hint' | 'correction' = 'question') => {
        if (!chatRef.current) {
            addToast('error', 'AI Not Ready', 'The AI chat session is not initialized.');
            return;
        }

        if (isInterjectingRef.current && type !== 'question') return; // Don't allow multiple interjections

        isInterjectingRef.current = (type !== 'question');

        if (type === 'correction') setStatus('correcting');
        else if (type === 'hint') setStatus('hinting');
        else setStatus('thinking');

        setAiResponse('');
        const toastTitle = type === 'correction' ? 'AI Correction' : (type === 'hint' ? 'AI Hint' : 'Question Sent');
        addToast('info', toastTitle, query);

        let enrichedQuery = query;
        if (type === 'question') {
            const currentDetections = detectedObjects;
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
                    isInterjectingRef.current = false;
                });
            } else {
                setStatus('listening');
                isInterjectingRef.current = false;
            }
        } catch (error) {
            console.error("Error sending message to AI:", error);
            const errorMessage = "Sorry, I couldn't process that. Please try again.";
            addToast('error', 'AI Error', errorMessage);
            setAiResponse(errorMessage);
            setStatus('speaking');
            ttsService.speak(errorMessage, () => {
                setStatus('listening');
                isInterjectingRef.current = false;
            });
        }
    }, [addToast, detectedObjects]);

    const handleSpeechResult = useCallback((transcript: string, isFinal: boolean) => {
        if (!isFinal || status === 'thinking' || status === 'speaking' || status === 'hinting' || status === 'correcting') return;

        const hotword = "hey adapt";
        const lowerTranscript = transcript.toLowerCase().trim();

        if (lowerTranscript.startsWith(hotword)) {
            const query = transcript.substring(hotword.length).trim();
            if (query) {
                ttsService.cancel();
                if (hintTimerRef.current) {
                    clearTimeout(hintTimerRef.current);
                    hintTimerRef.current = null;
                }
                processAiQuery(query, 'question');
            }
        }
    }, [processAiQuery, status]);

    const { startListening, hasSupport } = useSpeechRecognition(handleSpeechResult);

    useEffect(() => {
        const initialize = async () => {
            if (moduleData && hasSupport) {
                try {
                    await initializeObjectDetector();
                    // Continuously run detection in the background
                    setInterval(() => {
                        if (videoRef.current && videoRef.current.readyState >= 3) {
                            const detections = detectObjectsInVideo(videoRef.current);
                            setDetectedObjects(detections);
                        }
                    }, 500); // Run detection twice a second

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
        if (status === 'correcting') {
            return <><AlertTriangleIcon className="h-6 w-6 text-red-400 animate-pulse" />Correcting mistake...</>;
        }
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
