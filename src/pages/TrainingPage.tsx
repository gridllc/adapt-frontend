
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { VideoPlayer } from '@/components/VideoPlayer';
import { ProcessSteps } from '@/components/ProcessSteps';
import { ChatTutor } from '@/components/ChatTutor';
import { BotIcon, BookOpenIcon, FileTextIcon, Share2Icon, PencilIcon } from '@/components/Icons';
import type { TrainingModule, ProcessStep, PerformanceReportData } from '@/types';
import { useTrainingSession } from '@/hooks/useTrainingSession';
import { useAuth } from '@/hooks/useAuth';
import { getModule } from '@/services/moduleService';
import { getChatHistory } from '@/services/chatService';
import { generatePerformanceSummary } from '@/services/geminiService';
import { TranscriptViewer } from '@/components/TranscriptViewer';
import { PerformanceReport } from '@/components/PerformanceReport';

const findActiveStepIndex = (time: number, steps: ProcessStep[]) => {
  let foundIndex = -1;
  for (let i = 0; i < steps.length; i++) {
    if (time >= steps[i].start) {
      foundIndex = i;
    } else {
      break;
    }
  }
  return foundIndex === -1 && steps.length > 0 ? 0 : foundIndex;
};

const generateToken = () => Math.random().toString(36).substring(2, 10);

type ActiveTab = 'steps' | 'transcript';

const TrainingPage: React.FC = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  const [currentTime, setCurrentTime] = useState(0);
  const [activeTab, setActiveTab] = useState<ActiveTab>('steps');
  const [aiContext, setAiContext] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [copied, setCopied] = useState(false);
  const [performanceReport, setPerformanceReport] = useState<PerformanceReportData | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Effect to manage session token in URL
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    let token = searchParams.get('token');

    if (!token) {
      token = generateToken();
      // Replace the current history entry with the one that has the token
      navigate(`${location.pathname}?token=${token}`, { replace: true });
    }

    setSessionToken(token);
  }, [location.search, location.pathname, navigate]);

  const {
    data: moduleData,
    isLoading: isLoadingModule,
    isError,
    error,
  } = useQuery({
    queryKey: ['module', moduleId],
    queryFn: () => getModule(moduleId!),
    enabled: !!moduleId && !!sessionToken,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const {
    currentStepIndex,
    setCurrentStepIndex,
    userActions,
    markStep,
    isCompleted,
    resetSession,
    isLoadingSession,
  } = useTrainingSession(moduleId ?? 'unknown', sessionToken, moduleData?.steps.length ?? 0);

  useEffect(() => {
    if (!isLoadingModule && (isError || !moduleData)) {
      console.error(`Module with slug "${moduleId}" not found or failed to load.`, error);
      navigate('/not-found');
    }
  }, [isLoadingModule, isError, moduleData, moduleId, navigate, error]);

  // Generate a focused AI context based on the current step
  useEffect(() => {
    if (!moduleData || currentStepIndex < 0 || isCompleted) return;

    const { title, steps } = moduleData;

    // Context window: previous, current, and next step
    const prevStep = steps[currentStepIndex - 1];
    const currentStep = steps[currentStepIndex];
    const nextStep = steps[currentStepIndex + 1];

    let context = `Module: ${title}\n`;
    context += `The trainee is on step ${currentStepIndex + 1} of ${steps.length}.\n\n--- RELEVANT STEPS ---\n`;

    const formatStep = (step: ProcessStep | undefined, label: string) => {
      if (!step) return '';
      let stepStr = `## ${label} Step: ${step.title}\n`;
      stepStr += `Instruction: ${step.description}\n`;
      if (step.checkpoint) stepStr += `Checkpoint: ${step.checkpoint}\n`;
      return stepStr + '\n';
    }

    context += formatStep(prevStep, "Previous");
    context += formatStep(currentStep, "Current");
    context += formatStep(nextStep, "Next");

    setAiContext(context.trim());

  }, [currentStepIndex, moduleData, isCompleted]);

  // Effect to generate performance report upon completion
  useEffect(() => {
    if (isCompleted && moduleData && !performanceReport && !isGeneratingReport) {
      const generateReport = async () => {
        if (!moduleId || !sessionToken) return;
        setIsGeneratingReport(true);

        const unclearStepIndexes = new Set(
          userActions.filter(a => a.status === 'unclear').map(a => a.stepIndex)
        );
        const unclearSteps = Array.from(unclearStepIndexes).map((i: number) => moduleData.steps[i]).filter(Boolean);

        const chatHistory = await getChatHistory(moduleId, sessionToken);
        const userQuestions = chatHistory
          .filter(msg => msg.role === 'user' && msg.text.trim())
          .map(msg => msg.text.trim());

        try {
          const aiFeedback = await generatePerformanceSummary(moduleData.title, unclearSteps, userQuestions);

          setPerformanceReport({
            moduleTitle: moduleData.title,
            completionDate: new Date().toLocaleDateString(),
            aiFeedback,
            unclearSteps,
            userQuestions,
          });

        } catch (error) {
          console.error("Failed to generate performance report:", error);
          // Set a fallback report if AI fails
          setPerformanceReport({
            moduleTitle: moduleData.title,
            completionDate: new Date().toLocaleDateString(),
            aiFeedback: "Congratulations on completing the training! You did a great job.",
            unclearSteps,
            userQuestions,
          });
        } finally {
          setIsGeneratingReport(false);
        }
      };
      generateReport();
    }
  }, [isCompleted, moduleData, userActions, moduleId, sessionToken, performanceReport, isGeneratingReport]);


  const handleSeekTo = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      if (videoRef.current.paused) {
        videoRef.current.play().catch(console.error);
      }
    }
  }, []);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  useEffect(() => {
    if (!moduleData || userActions.length === 0 || isCompleted) return;
    const lastAction = userActions[userActions.length - 1];

    if (lastAction.status === 'done' && lastAction.stepIndex === currentStepIndex - 1) {
      const nextStep = moduleData.steps[currentStepIndex];
      if (nextStep) {
        handleSeekTo(nextStep.start);
      }
    }
  }, [currentStepIndex, userActions, handleSeekTo, moduleData, isCompleted]);

  const handleTimeUpdate = (time: number) => {
    if (isCompleted) return;
    setCurrentTime(time);
    if (!moduleData) return;
    const activeStepFromVideo = findActiveStepIndex(time, moduleData.steps);
    if (activeStepFromVideo !== -1 && activeStepFromVideo !== currentStepIndex) {
      setCurrentStepIndex(activeStepFromVideo);
    }
  };

  const handleRestart = () => {
    setPerformanceReport(null);
    resetSession();
  }

  if (isLoadingModule || isLoadingSession || !sessionToken || !moduleData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-xl">Loading Training Module...</p>
      </div>
    );
  }

  return (
    <>
      <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700 p-4 sticky top-0 z-20 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-slate-300 hover:text-indigo-400 transition-colors flex items-center gap-2">
            <BookOpenIcon className="h-5 w-5" />
            <span>Home</span>
          </button>
          <button onClick={handleCopyLink} className="text-slate-300 hover:text-indigo-400 transition-colors flex items-center gap-2">
            <Share2Icon className="h-5 w-5" />
            <span>{copied ? 'Copied!' : 'Share'}</span>
          </button>
          {isAuthenticated && (
            <button onClick={() => navigate(`/modules/${moduleId}/edit`)} className="text-slate-300 hover:text-indigo-400 transition-colors flex items-center gap-2">
              <PencilIcon className="h-5 w-5" />
              <span>Edit Module</span>
            </button>
          )}
        </div>
        <h1 className="text-2xl font-bold text-white text-center absolute left-1/2 -translate-x-1/2">{moduleData.title}</h1>
        <span className="font-bold text-lg text-indigo-400">Adapt</span>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 max-w-7xl mx-auto">
        <div className="lg:col-span-2 bg-slate-800 rounded-lg shadow-xl overflow-hidden">
          <VideoPlayer
            ref={videoRef}
            videoUrl={moduleData.videoUrl}
            onTimeUpdate={handleTimeUpdate}
          />
        </div>
        <div className="lg:col-span-1 h-[75vh] bg-slate-800 rounded-lg shadow-xl overflow-hidden flex flex-col">

          {isCompleted ? (
            isGeneratingReport ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                <FileTextIcon className="h-12 w-12 mx-auto mb-4 text-slate-600 animate-pulse" />
                <h3 className="font-bold text-lg text-slate-300">Generating Your Report...</h3>
                <p className="text-sm mt-1">The AI is analyzing your performance.</p>
              </div>
            ) : performanceReport ? (
              <PerformanceReport report={performanceReport} onRestart={handleRestart} />
            ) : null
          ) : (
            <>
              <div className="flex border-b border-slate-700">
                <button
                  onClick={() => setActiveTab('steps')}
                  className={`flex-1 p-4 font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${activeTab === 'steps' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-700/50'
                    }`}
                >
                  <BookOpenIcon className="h-5 w-5" />
                  <span>Steps</span>
                </button>
                <button
                  onClick={() => setActiveTab('transcript')}
                  className={`flex-1 p-4 font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${activeTab === 'transcript' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-700/50'
                    }`}
                >
                  <FileTextIcon className="h-5 w-5" />
                  <span>Transcript</span>
                </button>
              </div>

              {activeTab === 'steps' && (
                <ProcessSteps
                  steps={moduleData.steps}
                  currentStepIndex={currentStepIndex}
                  onStepClick={handleSeekTo}
                  markStep={markStep}
                />
              )}

              {activeTab === 'transcript' && (
                moduleData.transcript && moduleData.transcript.length > 0 ? (
                  <TranscriptViewer
                    transcript={moduleData.transcript}
                    currentTime={currentTime}
                    onLineClick={handleSeekTo}
                  />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                    <FileTextIcon className="h-12 w-12 mx-auto mb-4 text-slate-600" />
                    <h3 className="font-bold text-lg text-slate-300">No Transcript Available</h3>
                    <p className="text-sm mt-1">A transcript was not provided for this training module.</p>
                  </div>
                )
              )}
            </>
          )}

        </div>
      </main>

      {!isChatOpen && !isCompleted && (
        <button
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-6 right-6 bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 transition-transform transform hover:scale-110"
          aria-label="Open AI Tutor"
        >
          <BotIcon className="h-6 w-6" />
        </button>
      )}

      {isChatOpen && moduleId && sessionToken && moduleData && (
        <div className="fixed bottom-6 right-6 h-[85vh] w-[90vw] max-w-md bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-2xl flex flex-col border border-slate-700 z-50 animate-fade-in-up">
          <ChatTutor
            moduleId={moduleId}
            sessionToken={sessionToken}
            transcriptContext={aiContext}
            onTimestampClick={handleSeekTo}
            currentStepIndex={currentStepIndex}
            steps={moduleData.steps}
            onClose={() => setIsChatOpen(false)}
          />
        </div>
      )}
    </>
  );
};

export default TrainingPage;
