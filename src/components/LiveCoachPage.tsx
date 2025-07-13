
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/useToast';
import { getModule } from '@/services/moduleService';
import { startChat, detectObjects } from '@/services/geminiService';
import * as ttsService from '@/services/ttsService';
import { LiveCameraFeed } from '@/components/LiveCameraFeed';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { BookOpenIcon, MicIcon, SparklesIcon, SpeakerOnIcon, EyeIcon } from '@/components/Icons';
import type { Chat } from '@google/genai';
import type { DetectedObject } from '@/types';

type CoachStatus = 'idle' | 'listening' | 'thinking' | 'speaking';

const LiveCoachPage: React.FC = () => {
    const { moduleId } = useParams<{ moduleId: string }>();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [status, setStatus] = useState<CoachStatus>('idle');
    const [aiResponse, setAiResponse] = useState('');
    const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);

    const chatRef = useRef<Chat | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const { data: moduleData, isLoading: isLoadingModule, isError, error: moduleError } = useQuery({
        queryKey: ['module', moduleId],
        queryFn: () => getModule(moduleId!),
        enabled: !!moduleId,
        staleTime: 1000 * 60 * 5,
        retry: false,
    });

    // Effect for real-time vision analysis
    useEffect(() => {
        const captureInterval = setInterval(async () => {
            if (videoRef.current && videoRef.current.readyState >= 3 && canvasRef.current) { // readyState >= 3 means we have enough data
                const video = videoRef.current;
                const canvas = canvasRef.current;
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;

                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const newDetections = await detectObjects(canvas);
                    if (newDetections.length > 0) {
                        setDetectedObjects(newDetections);
                        // Make detections fade out after a bit
                        setTimeout(() => setDetectedObjects([]), 2500);
                    }
                }
            }
        }, 1000); // Capture a frame every second

        return () => clearInterval(captureInterval);
    }, []); // Runs once on mount

    const processAiQuery = useCallback(async (query: string) => {
        if (!chatRef.current) {
            addToast('error', 'AI Not Ready', 'The AI chat session is not initialized.');
            return;
        }

        setStatus('thinking');
        setAiResponse('');
        addToast('info', 'Question Sent', `"${query}"`);

        // Enrich the prompt with visual context if available
        let enrichedQuery = query;
        if (detectedObjects.length > 0) {
            const objectLabels = detectedObjects.map(obj => obj.label).join(', ');
            enrichedQuery = `The user asked: "${query}". My camera analysis shows a ${objectLabels} are present. Based on the current step and this visual information, answer their question.`;
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
                ttsService.speak(fullText, () => setStatus('listening')); // Return to listening after speaking
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
        if (!isFinal) return; // Only process final results

        const hotword = "hey adapt";
        const lowerTranscript = transcript.toLowerCase().trim();

        if (lowerTranscript.startsWith(hotword)) {
            const query = transcript.substring(hotword.length).trim();
            if (query) {
                ttsService.cancel(); // Interrupt any ongoing speech
                processAiQuery(query);
            }
        }
    }, [processAiQuery]);

    const { startListening, hasSupport } = useSpeechRecognition(handleSpeechResult);

    // Effect to initialize chat and speech recognition
    useEffect(() => {
        if (moduleData && hasSupport) {
            const context = moduleData.steps.map((s, i) => `Step ${i + 1}: ${s.title}\n${s.description}`).join('\n\n');
            chatRef.current = startChat(context);
            startListening();
            setStatus('listening');
        } else if (moduleData && !hasSupport) {
            setStatus('idle');
            addToast('error', 'Unsupported Browser', 'Speech recognition is not available on this browser.');
        }
    }, [moduleData, hasSupport, startListening, addToast]);

    // Effect to handle navigation for loading/error states
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
            case 'listening':
                return <><MicIcon className="h-6 w-6 text-green-400" />Listening for "Hey Adapt"...</>;
            case 'thinking':
                return <><SparklesIcon className="h-6 w-6 text-indigo-400 animate-pulse" />Thinking...</>;
            case 'speaking':
                return <><SpeakerOnIcon className="h-6 w-6 text-amber-400" />{aiResponse}</>;
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
            {/* Hidden canvas used for capturing video frames for analysis */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
    );
};

export default LiveCoachPage;
