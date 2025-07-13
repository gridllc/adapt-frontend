
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/useToast';
import { getModule } from '@/services/moduleService';
import { getSession, saveSession } from '@/services/sessionService';
import { startChat } from '@/services/geminiService';
import { initializeObjectDetector, detectObjectsInVideo } from '@/services/visionService';
import * as ttsService from '@/services/ttsService';
import { LiveCameraFeed } from '@/components/LiveCameraFeed';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { BookOpenIcon, MicIcon, SparklesIcon, SpeakerOnIcon, EyeIcon, AlertTriangleIcon, LightbulbIcon, GitBranchIcon } from '@/components/Icons';
import type { Chat } from '@google/genai';
import type { DetectedObject, ModuleNeeds, StepNeeds, LiveCoachEvent, CoachEventType, TrainingModule } from '@/types';

type CoachStatus = 'initializing' | 'idle' | 'listening' | 'thinking' | 'speaking' | 'hinting' | 'correcting' | 'tutoring' | 'branching';

const generateToken = () => Math.random().toString(36).substring(2, 10);

const LiveCoachPage: React.FC = () => {
    const { moduleId = '' } = useParams<{ moduleId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const { addToast } = useToast();

    const [sessionToken, setSessionToken] = useState('');
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [sessionEvents, setSessionEvents] = useState<LiveCoachEvent[]>([]);

    const [status, setStatus] = useState<CoachStatus>('initializing');
    const [aiResponse, setAiResponse] = useState('');
    const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);
    const [moduleNeeds, setModuleNeeds] = useState<ModuleNeeds | null>(null);

    const [activeModule, setActiveModule] = useState<TrainingModule | null>(null);
    const [mainModuleState, setMainModuleState] = useState<{ module: TrainingModule; stepIndex: number } | null>(null);

    const chatRef = useRef<Chat | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const hintTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isInterjectingRef = useRef(false);

    // --- Session Management ---
    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        let token = searchParams.get('token');
        if (!token) {
            token = generateToken();
            navigate(`${location.pathname}?token=${token}`, { replace: true });
        }
        setSessionToken(token);
    }, [location.search, location.pathname, navigate]);

    const sessionQueryKey = ['liveCoachSession', moduleId, sessionToken];

    const { data: sessionData, isLoading: isLoadingSession } = useQuery({
        queryKey: sessionQueryKey,
        queryFn: () => getSession(moduleId, sessionToken),
        enabled: !!moduleId && !!sessionToken,
    });

    useEffect(() => {
        if (sessionData) {
            setCurrentStepIndex(sessionData.currentStepIndex);
            setSessionEvents(sessionData.liveCoachEvents || []);
        }
    }, [sessionData]);

    const { mutate: persistSession } = useMutation({
        mutationFn: (newState: Partial<Awaited<ReturnType<typeof getSession>>>) =>
            saveSession({ moduleId: moduleId!, sessionToken: sessionToken!, ...newState }),
        onSuccess: (_data, variables) => {
            queryClient.setQueryData(sessionQueryKey, (old: any) => ({ ...(old || {}), ...variables }));
        },
    });

    // --- Module Data and Needs ---
    const { data: moduleData, isLoading: isLoadingModule, isError } = useQuery({
        queryKey: ['module', moduleId],
        queryFn: () => getModule(moduleId),
        enabled: !!moduleId,
        staleTime: 1000 * 60 * 5,
        retry: false,
    });

    useEffect(() => {
        if (moduleData) setActiveModule(moduleData);
    }, [moduleData]);

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

    // --- Branching Logic ---
    const handleBranchStart = useCallback(async (subModuleSlug: string) => {
        if (!activeModule) return;

        isInterjectingRef.current = true;
        ttsService.cancel();
        setStatus('branching');

        try {
            const subModule = await getModule(subModuleSlug);
            if (!subModule) throw new Error(`Sub-module "${subModuleSlug}" not found.`);

            // Save current main module state
            setMainModuleState({ module: activeModule, stepIndex: currentStepIndex });

            // Switch to sub-module
            setActiveModule(subModule);
            setCurrentStepIndex(0);

            addToast('info', 'Taking a Detour', `Let's quickly review: ${subModule.title}`);
            const introText = `I noticed you might need some help with that. Let's take a quick look at how to do this correctly. First: ${subModule.steps[0].title}`;
            ttsService.speak(introText, () => {
                setStatus('listening');
                isInterjectingRef.current = false;
            });

        } catch (error) {
            console.error("Failed to start branch:", error);
            addToast('error', 'Branching Failed', 'Could not load the sub-lesson.');
            setStatus('listening');
            isInterjectingRef.current = false;
        }
    }, [activeModule, currentStepIndex, addToast]);

    const handleBranchEnd = useCallback(() => {
        if (!mainModuleState) return;

        setActiveModule(mainModuleState.module);
        setCurrentStepIndex(mainModuleState.stepIndex);
        setMainModuleState(null);

        const returnText = `Great, now let's get back to the main task. The next step is: ${mainModuleState.module.steps[mainModuleState.stepIndex].title}`;
        addToast('success', 'Back on Track!', 'Returning to the main training.');
        ttsService.speak(returnText);

    }, [mainModuleState, addToast]);

    // --- AI Interaction Logic ---
    const logAndSaveEvent = useCallback((eventType: CoachEventType) => {
        if (mainModuleState) return; // Don't log events during a branch
        const newEvent: LiveCoachEvent = { eventType, stepIndex: currentStepIndex, timestamp: Date.now() };
        const updatedEvents = [...sessionEvents, newEvent];
        setSessionEvents(updatedEvents);
        persistSession({ liveCoachEvents: updatedEvents });
    }, [currentStepIndex, sessionEvents, persistSession, mainModuleState]);

    const processAiInterjection = useCallback(async (basePrompt: string, type: 'hint' | 'correction') => {
        if (!chatRef.current || !activeModule) return;
        if (isInterjectingRef.current) return;

        isInterjectingRef.current = true;
        ttsService.cancel();

        const previousEvents = sessionEvents.filter(e => e.stepIndex === currentStepIndex && e.eventType === 'hint');
        const isRepeatStruggle = type === 'hint' && previousEvents.length > 0;

        let finalPrompt = basePrompt;
        let newStatus: CoachStatus = type === 'hint' ? 'hinting' : 'correcting';

        if (isRepeatStruggle) {
            newStatus = 'tutoring';
            finalPrompt = `The user is stuck on step "${activeModule.steps[currentStepIndex].title}". I have already given them a hint. Instead of another hint, provide a more detailed 'mini-tutorial' that re-explains the step clearly and anticipates their problem. Be encouraging.`;
        }

        setStatus(newStatus);
        logAndSaveEvent(newStatus);

        try {
            const stream = await chatRef.current.sendMessageStream({ message: finalPrompt });
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
        } catch (e) {
            console.error(e);
            setStatus('listening');
            isInterjectingRef.current = false;
        }

    }, [chatRef.current, activeModule, currentStepIndex, sessionEvents, logAndSaveEvent]);

    const processAiQuery = useCallback(async (query: string) => {
        if (!chatRef.current) return;
        if (isInterjectingRef.current) {
            ttsService.cancel(); // User overrides AI interjection
            isInterjectingRef.current = false;
        }
        setStatus('thinking');
        setAiResponse('');

        const objectLabels = detectedObjects.length > 0 ? detectedObjects.map(obj => obj.label).join(', ') : 'nothing in particular';
        const enrichedQuery = `The user asked: "${query}". My live camera analysis shows a ${objectLabels} are present. Based on the current step's instructions and this visual context, answer their question.`;

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
            const errorMessage = "Sorry, I couldn't process that.";
            setAiResponse(errorMessage);
            setStatus('speaking');
            ttsService.speak(errorMessage, () => setStatus('listening'));
        }
    }, [chatRef.current, detectedObjects]);

    // --- Proactive Checks ---
    useEffect(() => {
        if (status !== 'listening' || !moduleNeeds || !moduleId || !activeModule || mainModuleState) return;

        const needs: StepNeeds | undefined = moduleNeeds[activeModule.slug]?.[currentStepIndex];
        if (!needs) {
            if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
            return;
        }

        const detectedForbiddenItem = detectedObjects.find(detected =>
            (needs.forbidden || []).some(forbidden => detected.label.toLowerCase().includes(forbidden.toLowerCase()))
        );

        if (detectedForbiddenItem) {
            if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
            const branchRule = needs.branchOn?.find(b => detectedForbiddenItem.label.toLowerCase().includes(b.item.toLowerCase()));

            if (branchRule) {
                handleBranchStart(branchRule.module);
            } else {
                const mistakeText = `The user is on step "${activeModule.steps[currentStepIndex].title}". They are supposed to use: "${needs.required.join(', ')}". My vision system has detected a forbidden item: a "${detectedForbiddenItem.label}". Provide an immediate, gentle, but clear correction to get them back on track.`;
                processAiInterjection(mistakeText, 'correction');
            }
            return;
        }

        const requiredObjects = needs.required || [];
        if (requiredObjects.length === 0) {
            if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
            return;
        }

        const hasAllRequiredObjects = requiredObjects.every(req =>
            detectedObjects.some(detected => detected.label.toLowerCase().includes(req.toLowerCase()))
        );

        if (hasAllRequiredObjects) {
            if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
            hintTimerRef.current = null;
        } else if (!hintTimerRef.current && !isInterjectingRef.current) {
            hintTimerRef.current = setTimeout(() => {
                const hintText = `The user is on step "${activeModule.steps[currentStepIndex].title}", which requires a "${requiredObjects.join(', ')}". My vision system does not detect this item. Please provide a gentle, proactive hint to help them find the right tool or item. Keep it brief.`;
                processAiInterjection(hintText, 'hint');
            }, 5000); // 5-second delay
        }
    }, [detectedObjects, status, moduleNeeds, moduleId, currentStepIndex, activeModule, processAiInterjection, handleBranchStart, mainModuleState]);

    // --- Hooks and Lifecycle ---
    const handleSpeechResult = useCallback((transcript: string, isFinal: boolean) => {
        if (!isFinal || status === 'thinking' || status === 'speaking' || isInterjectingRef.current) return;

        if (transcript.toLowerCase().trim().startsWith("hey adapt")) {
            const query = transcript.substring(10).trim();
            if (query) {
                if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
                hintTimerRef.current = null;
                processAiQuery(query);
            }
        }
    }, [processAiQuery, status]);

    const { startListening, hasSupport } = useSpeechRecognition(handleSpeechResult);

    useEffect(() => {
        const initialize = async () => {
            if (activeModule && hasSupport) {
                try {
                    await initializeObjectDetector();
                    setInterval(() => {
                        if (videoRef.current?.readyState === 4) { // Only detect when video is ready
                            const detections = detectObjectsInVideo(videoRef.current);
                            setDetectedObjects(detections);
                        }
                    }, 500);

                    const context = activeModule.steps.map((s, i) => `Step ${i + 1}: ${s.title}\n${s.description}`).join('\n\n');
                    chatRef.current = startChat(context);
                    startListening();
                    setStatus('listening');
                } catch (err) {
                    setStatus('idle');
                }
            } else if (activeModule && !hasSupport) {
                setStatus('idle');
            }
        };
        initialize();
    }, [activeModule, hasSupport, startListening]);

    useEffect(() => {
        if (!isLoadingModule && isError) {
            navigate('/not-found');
        }
    }, [isLoadingModule, isError, navigate]);

    const handleNextStep = () => {
        if (!activeModule) return;
        if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
        hintTimerRef.current = null;

        const newIndex = currentStepIndex + 1;

        if (mainModuleState && newIndex >= activeModule.steps.length) {
            // Completed a sub-module, return to main flow
            handleBranchEnd();
            return;
        }

        if (newIndex >= activeModule.steps.length) {
            addToast('success', 'Module Complete!', 'You have finished all the steps.');
            navigate(`/modules/${moduleId}`);
        } else {
            setCurrentStepIndex(newIndex);
            if (!mainModuleState) { // Only persist progress for the main module
                persistSession({ currentStepIndex: newIndex });
            }
        }
    };

    const getStatusIndicator = () => {
        if (status === 'speaking') return <><SpeakerOnIcon className="h-6 w-6 text-amber-400" />{aiResponse}</>;
        if (status === 'correcting') return <><AlertTriangleIcon className="h-6 w-6 text-red-400 animate-pulse" />Correcting mistake...</>;
        if (status === 'hinting') return <><LightbulbIcon className="h-6 w-6 text-yellow-400 animate-pulse" />Offering a hint...</>;
        if (status === 'tutoring') return <><LightbulbIcon className="h-6 w-6 text-yellow-400 animate-pulse" />Let me explain that differently...</>;
        if (status === 'branching') return <><GitBranchIcon className="h-6 w-6 text-cyan-400 animate-pulse" />Taking a short detour...</>;

        if (detectedObjects.length > 0 && ['listening', 'idle'].includes(status)) {
            return <><EyeIcon className="h-6 w-6 text-green-400" />Seeing: {detectedObjects.map(o => o.label).join(', ')}</>;
        }
        switch (status) {
            case 'initializing': return <><SparklesIcon className="h-6 w-6 text-indigo-400 animate-pulse" />Vision AI is initializing...</>;
            case 'listening': return <><MicIcon className="h-6 w-6 text-green-400" />Listening for "Hey Adapt"...</>;
            case 'thinking': return <><SparklesIcon className="h-6 w-6 text-indigo-400 animate-pulse" />Thinking...</>;
            default: return 'Initializing...';
        }
    }

    if (isLoadingModule || isLoadingSession || !activeModule) {
        return <div className="flex items-center justify-center h-screen bg-slate-900"><p className="text-xl text-slate-300">Loading Live Coach...</p></div>;
    }

    const currentInstruction = activeModule.steps[currentStepIndex]?.title ?? "Module Complete!";

    return (
        <div className="flex flex-col h-screen bg-slate-800 text-white font-sans">
            <header className="flex-shrink-0 p-4 bg-slate-900/50 backdrop-blur-sm border-b border-slate-700 flex justify-between items-center">
                <button onClick={() => navigate(`/modules/${moduleId}`)} className="text-slate-300 hover:text-indigo-400 transition-colors flex items-center gap-2">
                    <BookOpenIcon className="h-5 w-5" />
                    <span>Back to Training</span>
                </button>
                <div className="text-center">
                    <h1 className="text-2xl font-bold">{activeModule.title}</h1>
                    {mainModuleState && <p className="text-xs text-cyan-400 font-semibold animate-pulse">REMEDIAL LESSON</p>}
                </div>
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