
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
import type { DetectedObject } from '@/types';

type CoachStatus = 'initializing' | 'idle' | 'listening' | 'thinking' | 'speaking';

const LiveCoachPage: React.FC = () => {
    const { moduleId } = useParams<{ moduleId: string }>();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [status, setStatus] = useState<CoachStatus>('initializing');
    const [aiResponse, setAiResponse] = useState('');
    const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);

    const chatRef = useRef<Chat | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const lastDetectionTime = useRef(0);

    const { data: moduleData, isLoading: isLoadingModule, isError, error: moduleError } = useQuery({
        queryKey: ['module', moduleId],
        queryFn: () => getModule(moduleId!),
        enabled: !!moduleId,
        staleTime: 1000 * 60 * 5,
        retry: false,
    });

    const runDetection = useCallback(() => {
        if (status !== 'initializing' && videoRef.current && videoRef.current.readyState >= 3) {
            const detections = detectObjectsInVideo(videoRef.current);
            if (detections.length > 0) {
                setDetectedObjects(detections);
                lastDetectionTime.current = Date.now();
            }
        }
    }, [status]);

    // Main loop for video detection
    useEffect(() => {
        const detectionLoop = setInterval(runDetection, 100); // Run detection frequently
        const clearLoop = setInterval(() => {
            // Clear detections if none have been seen for a while
            if (Date.now() - lastDetectionTime.current > 2000) {
                setDetectedObjects([]);
            }
        }, 500);

        return () => {
            clearInterval(detectionLoop);
            clearInterval(clearLoop);
        };
    }, [runDetection]);


    const processAiQuery = useCallback(async (query: string) => {
        if (!chatRef.current) {
            addToast('error', 'AI Not Ready', 'The AI chat session is not initialized.');
            return;
        }

        setStatus('thinking');
        setAiResponse('');
        addToast('info', 'Question Sent', `"${query}"`);

        let enrichedQuery = query;
        const currentDetections = detectedObjects; // Capture current detections
        if (currentDetections.length > 0) {
            const objectLabels = currentDetections.map(obj => obj.label).join(', ');
            enrichedQuery = `The user asked: "${query}". My live camera analysis shows a ${objectLabels} are present. Based on the current step's instructions and this visual context, answer their question.`;
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
                ttsService.speak(fullText, () => setStatus('listening'));
            } else {
                setStatus('listening');
            }
        } catch (error) {
            console.error("Error sending message to AI:", error);
            const errorMessage = "Sorry, I couldn't process that. Please try again.";
            addToast('error', 'AI Error', errorMessage);
            setAiResponse(errorMessage);
            setStatus('speaking');
            ttsService.speak(errorMessage, () => setStatus('listening'));
        }
    }, [addToast, detectedObjects]);

    const handleSpeechResult = useCallback((transcript: string, isFinal: boolean) => {
        if (!isFinal || status === 'thinking' || status === 'speaking') return;

        const hotword = "hey adapt";
        const lowerTranscript = transcript.toLowerCase().trim();

        if (lowerTranscript.startsWith(hotword)) {
            const query = transcript.substring(hotword.length).trim();
            if (query) {
                ttsService.cancel();
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
                    setStatus('idle'); // Set to idle on failure
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
        if (detectedObjects.length > 0) {
            return <><EyeIcon className="h-6 w-6 text-green-400" />Seeing: {detectedObjects.map(o => o.label).join(', ')}</>;
        }
        switch (status) {
            case 'initializing':
                return <><SparklesIcon className="h-6 w-6 text-indigo-400 animate-pulse" />Vision AI is initializing...</>;
            case 'listening':
                return <><MicIcon className="h-6 w-6 text-green-400" />Listening for "Hey Adapt"...</>;
            case 'thinking':
                return <><SparklesIcon className="h-6 w-6 text-indigo-400 animate-pulse" />Thinking...</>;
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