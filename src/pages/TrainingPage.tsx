

import React, { useState, useRef, useCallback, useEffect, useMemo, useReducer } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { VideoPlayer } from '@/components/VideoPlayer';
import { ProcessSteps } from '@/components/ProcessSteps';
import { ChatTutor } from '@/components/ChatTutor';
import { BotIcon, BookOpenIcon, FileTextIcon, Share2Icon, PencilIcon, VideoIcon, AlertTriangleIcon, SparklesIcon, RefreshCwIcon } from '@/components/Icons';
import type { ProcessStep, TranscriptLine, StepStatus } from '@/types';
import type { Database } from '@/types/supabase';
import { useTrainingSession } from '@/hooks/useTrainingSession';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { getModule } from '@/services/moduleService';
import { getChatHistory } from '@/services/chatService';
import { generatePerformanceSummary, evaluateCheckpointAnswer } from '@/services/geminiService';
import { submitSuggestion } from '@/services/suggestionsService';
import { logCheckpointResponse, getCheckpointFailureStats } from '@/services/checkpointService';
import { TranscriptViewer } from '@/components/TranscriptViewer';
import { PerformanceReport } from '@/components/PerformanceReport';
import { useSafeVideoUrl } from '@/hooks/useSafeVideoUrl';
import { trainingPageReducer, initialTrainingPageState } from '@/reducers/trainingPageReducer';

type ModuleRow = Database['public']['Tables']['modules']['Row'];

const generateToken = () => Math.random().toString(36).substring(2, 10);

const TrainingPage: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { addToast } = useToast();

  const [state, dispatch] = useReducer(trainingPageReducer, initialTrainingPageState);
  const {
    isChatOpen,
    activeTab,
    isEvaluatingCheckpoint,
    isAdvancing,
    checkpointFeedback,
    instructionSuggestion,
    isSuggestionSubmitted,
    isGeneratingReport,
    performanceReport,
    initialChatPrompt
  } = state;

  const [currentTime, setCurrentTime] = useState(0);
  const [stepsContext, setStepsContext] = useState('');
  const [fullTranscript, setFullTranscript] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const isAdmin = !!user;

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    let token = searchParams.get('token');

    if (!token) {
      token = generateToken();
      navigate(`${location.pathname}?token=${token}`, { replace: true });
    }

    setSessionToken(token);
  }, [location.search, location.pathname, navigate]);

  const {
    data: moduleData,
    isLoading: isLoadingModule,
    isError,
    error,
  } = useQuery<ModuleRow | undefined, Error>({
    queryKey: ['module', moduleId],
    queryFn: () => getModule(moduleId!),
    enabled: !!moduleId && !!sessionToken,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  });

  const steps = useMemo(() => (moduleData?.steps as ProcessStep[]) || [], [moduleData]);
  const transcript = useMemo(() => (moduleData?.transcript as TranscriptLine[]) || [], [moduleData]);

  const {
    currentStepIndex,
    setCurrentStepIndex,
    userActions,
    markStep,
    isCompleted,
    resetSession,
    isLoadingSession,
    goBack,
  } = useTrainingSession(moduleId ?? 'unknown', sessionToken, steps.length ?? 0);

  const { data: checkpointFailureStats } = useQuery({
    queryKey: ['checkpointFailureStats', moduleId],
    queryFn: () => getCheckpointFailureStats(moduleId!),
    enabled: !!moduleId && isAdmin,
    staleTime: 1000 * 60 * 5,
  });

  const videoPath = useMemo(() => {
    if (!moduleData?.video_url) return null;
    try {
      const url = new URL(moduleData.video_url);
      const BUCKET_NAME = 'training-videos';
      const pathParts = url.pathname.split(`/${BUCKET_NAME}/`);
      return pathParts[1] || null;
    } catch (e) {
      console.error("Could not parse video URL to get path:", moduleData.video_url);
      return null;
    }
  }, [moduleData?.video_url]);

  const {
    videoUrl: publicVideoUrl,
    isLoading: isLoadingVideo,
    isError: isVideoError,
    retry: retryVideoUrl,
  } = useSafeVideoUrl(videoPath);


  useEffect(() => {
    if (isError && !moduleData) {
      console.error(`Module with slug "${moduleId}" not found or failed to load.`, error);
      navigate('/not-found');
    }
  }, [isError, moduleData, moduleId, navigate, error]);

  useEffect(() => {
    if (!moduleData || currentStepIndex < 0 || isCompleted) {
      setStepsContext('');
      setFullTranscript('');
      return;
    }

    const { title } = moduleData;

    const prevStep = steps[currentStepIndex - 1];
    const currentStep = steps[currentStepIndex];
    const nextStep = steps[currentStepIndex + 1];

    let stepCtx = `Module: ${title}\n`;
    stepCtx += `The trainee is on step ${currentStepIndex + 1} of ${steps.length}.\n\n--- RELEVANT STEPS ---\n`;

    const formatStep = (step: ProcessStep | undefined, label: string) => {
      if (!step) return '';
      let stepStr = `## ${label} Step: ${step.title}\n`;
      stepStr += `Instruction: ${step.description}\n`;
      if (step.checkpoint) stepStr += `Checkpoint: ${step.checkpoint}\n`;
      return stepStr + '\n';
    }

    stepCtx += formatStep(prevStep, "Previous");
    stepCtx += formatStep(currentStep, "Current");
    stepCtx += formatStep(nextStep, "Next");

    setStepsContext(stepCtx.trim());

    if (transcript && transcript.length > 0) {
      const transcriptText = transcript.map(line => `[${line.start.toFixed(2)}] ${line.text}`).join('\n');
      setFullTranscript(transcriptText);
    } else {
      setFullTranscript('');
    }

  }, [currentStepIndex, moduleData, isCompleted, steps, transcript]);

  useEffect(() => {
    if (isCompleted && moduleData && !performanceReport && !isGeneratingReport) {
      const generateReport = async () => {
        if (!moduleId || !sessionToken) return;
        dispatch({ type: 'START_REPORT_GENERATION' });

        const unclearStepIndexes = new Set(
          userActions.filter(a => a.status === 'unclear').map(a => a.stepIndex)
        );
        const unclearSteps = Array.from(unclearStepIndexes).map((i: number) => steps[i]).filter(Boolean);

        const chatHistory = await getChatHistory(moduleId, sessionToken);
        const userQuestions = chatHistory
          .filter(msg => msg.role === 'user' && msg.text.trim())
          .map(msg => msg.text.trim());

        try {
          const { summary: aiFeedback } = await generatePerformanceSummary(moduleData.title, unclearSteps, userQuestions);

          dispatch({
            type: 'SET_PERFORMANCE_REPORT', payload: {
              moduleTitle: moduleData.title,
              completionDate: new Date().toLocaleDateString(),
              aiFeedback,
              unclearSteps,
              userQuestions,
            }
          });

        } catch (error) {
          console.error("Failed to generate performance report:", error);
          dispatch({
            type: 'SET_PERFORMANCE_REPORT', payload: {
              moduleTitle: moduleData.title,
              completionDate: new Date().toLocaleDateString(),
              aiFeedback: "Congratulations on completing the training! You did a great job.",
              unclearSteps,
              userQuestions,
            }
          });
        }
      };
      generateReport();
    }
  }, [isCompleted, moduleData, userActions, moduleId, sessionToken, performanceReport, isGeneratingReport, steps]);


  const handleSeekTo = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      if (videoRef.current.paused) {
        videoRef.current.play().catch(console.error);
      }
    }
  }, []);

  useEffect(() => {
    const step = steps?.[currentStepIndex];
    if (step && videoRef.current) {
      if (Math.abs(videoRef.current.currentTime - step.start) > 0.5) {
        handleSeekTo(step.start);
      }
    }
  }, [currentStepIndex, steps, handleSeekTo]);


  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      addToast('success', 'Link Copied', 'The training session link is now in your clipboard.');
    }, (err) => {
      addToast('error', 'Copy Failed', 'Could not copy the link to your clipboard.');
      console.error('Failed to copy link: ', err);
    });
  }, [addToast]);

  const handleTimeUpdate = (time: number) => {
    if (isCompleted) return;
    setCurrentTime(time);

    const currentStep = steps[currentStepIndex];
    if (currentStep && !currentStep.checkpoint && time > currentStep.end && currentStep.end > 0) {
      if (currentStepIndex < steps.length - 1) {
        markStep('done');
      }
    }
  };

  const handleStepSelect = useCallback((time: number, index: number) => {
    handleSeekTo(time);
    setCurrentStepIndex(index);
  }, [handleSeekTo, setCurrentStepIndex]);

  useEffect(() => {
    // Clear checkpoint-specific feedback when the step changes
    dispatch({ type: 'RESET_CHECKPOINT_STATE' });
  }, [currentStepIndex]);

  const handleMarkStep = useCallback((status: StepStatus) => {
    if (status === 'unclear') {
      markStep('unclear');

      const currentStep = steps[currentStepIndex];
      if (currentStep) {
        handleSeekTo(currentStep.start);
        addToast('info', "Let's try that again", "We'll replay this step for you.");
      }
    } else {
      markStep(status);
    }
  }, [markStep, steps, currentStepIndex, handleSeekTo, addToast]);

  const handleRestart = () => {
    dispatch({ type: 'RESET_SESSION_UI' });
    resetSession();
  }

  const handleCheckpointAnswer = useCallback(async (answer: string, comment?: string) => {
    const stepJustAnswered = steps[currentStepIndex];
    if (!stepJustAnswered?.checkpoint || !moduleId) return;

    dispatch({ type: 'START_CHECKPOINT_EVALUATION' });

    if (user) {
      logCheckpointResponse({
        module_id: moduleId,
        user_id: user.id,
        step_index: currentStepIndex,
        checkpoint_text: stepJustAnswered.checkpoint,
        answer: answer,
        comment: comment,
      }).catch(err => {
        console.error("Non-blocking error: Failed to log checkpoint response.", err);
      });
    }

    try {
      const evaluation = await evaluateCheckpointAnswer(stepJustAnswered, answer);
      const isCorrect = evaluation.isCorrect;

      const feedbackPayload = {
        ...evaluation,
        feedback: isCorrect ? `${evaluation.feedback} Correct! Moving on...` : evaluation.feedback,
      };

      dispatch({ type: 'CHECKPOINT_EVALUATION_SUCCESS', payload: { evaluation: feedbackPayload, isAdvancing: isCorrect } });

      if (isCorrect) {
        addToast('success', 'Checkpoint Passed!', "Moving to the next step shortly.");
        setTimeout(() => {
          markStep('done');
        }, 2000);
      } else {
        addToast('info', 'Checkpoint Answer Noted', evaluation.feedback);
      }
    } catch (err) {
      console.error("Error evaluating checkpoint with AI", err);
      dispatch({ type: 'CHECKPOINT_EVALUATION_FAILURE' });
      addToast('error', 'Evaluation Error', 'Could not get AI feedback.');
    }
  }, [currentStepIndex, steps, addToast, markStep, user, moduleId]);

  const handleSuggestionSubmit = useCallback(async () => {
    if (!instructionSuggestion || !moduleId) return;
    try {
      await submitSuggestion(moduleId, currentStepIndex, instructionSuggestion);
      addToast('success', 'Suggestion Submitted', 'Thank you! The module owner will review it.');
      dispatch({ type: 'SUBMIT_SUGGESTION_SUCCESS' });
    } catch (err) {
      addToast('error', 'Submission Failed', 'Could not submit suggestion.');
    }
  }, [instructionSuggestion, moduleId, currentStepIndex, addToast]);


  const handleTutorHelp = useCallback((question: string, userAnswer?: string) => {
    const step = steps[currentStepIndex];
    if (!step) return;

    let prompt: string;

    if (userAnswer && userAnswer.toLowerCase() === 'no' && step.checkpoint) {
      let contextForAi = `I'm on the step: "${step.title}".\n`;
      contextForAi += `The instruction is: "${step.description}".\n`;
      contextForAi += `I was asked the checkpoint question: "${step.checkpoint}" and I answered "${userAnswer}".\n`;

      if (step.alternativeMethods && step.alternativeMethods.length > 0 && step.alternativeMethods[0].description) {
        contextForAi += `I see a hint that says: "${step.alternativeMethods[0].description}".\n`;
      }
      contextForAi += "I'm still stuck. What should I do next?";
      prompt = contextForAi;
    } else {
      prompt = question;
    }

    dispatch({ type: 'SET_CHAT_PROMPT', payload: prompt });
  }, [steps, currentStepIndex]);


  if (isLoadingModule || isLoadingSession || !sessionToken) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-slate-900">
        <p className="text-xl text-slate-700 dark:text-slate-300">Loading Training Module...</p>
      </div>
    );
  }

  if (!moduleData) {
    return <div className="flex items-center justify-center h-screen">Module not found.</div>
  }

  return (
    <>
      <header className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 p-4 sticky top-0 z-20 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-2">
            <BookOpenIcon className="h-5 w-5" />
            <span>Home</span>
          </button>
          <button onClick={handleCopyLink} className="text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-2">
            <Share2Icon className="h-5 w-5" />
            <span>Share</span>
          </button>
          {isAuthenticated && (
            <button onClick={() => navigate(`/modules/${moduleId}/edit`)} className="text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-2">
              <PencilIcon className="h-5 w-5" />
              <span>Edit Module</span>
            </button>
          )}
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white text-center absolute left-1/2 -translate-x-1/2">{moduleData.title}</h1>
        <span className="font-bold text-lg text-indigo-500 dark:text-indigo-400">Adapt</span>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 max-w-7xl mx-auto">
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-lg shadow-xl overflow-hidden min-h-[400px]">
          {!moduleData?.video_url ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900">
              <VideoIcon className="h-16 w-16 text-slate-400 dark:text-slate-600" />
              <p className="mt-4 text-slate-500">No video provided for this module.</p>
            </div>
          ) : isLoadingVideo ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 p-4">
              <SparklesIcon className="h-12 w-12 text-indigo-400 animate-pulse" />
              <p className="mt-4 text-slate-500">Verifying video...</p>
            </div>
          ) : isVideoError ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 p-4">
              <AlertTriangleIcon className="h-12 w-12 text-red-500 mb-4" />
              <p className="text-red-500 text-center">Could not load the video. The path might be missing or incorrect.</p>
              <button
                onClick={retryVideoUrl}
                className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg flex items-center gap-2"
              >
                <RefreshCwIcon className="h-5 w-5" /> Try Again
              </button>
            </div>
          ) : publicVideoUrl ? (
            <VideoPlayer
              ref={videoRef}
              video_url={publicVideoUrl}
              onTimeUpdate={handleTimeUpdate}
            />
          ) : null}
        </div>
        <div className={`lg:col-span-1 h-[75vh] bg-white dark:bg-slate-800 rounded-lg shadow-xl flex flex-col ${isCompleted ? 'overflow-y-auto' : 'overflow-hidden'}`}>

          {isCompleted ? (
            isGeneratingReport ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 dark:text-slate-400">
                <FileTextIcon className="h-12 w-12 mx-auto mb-4 text-slate-400 dark:text-slate-600 animate-pulse" />
                <h3 className="font-bold text-lg text-slate-700 dark:text-slate-300">Generating Your Report...</h3>
                <p className="text-sm mt-1">The AI is analyzing your performance.</p>
              </div>
            ) : performanceReport ? (
              <PerformanceReport report={performanceReport} onRestart={handleRestart} />
            ) : null
          ) : (
            <>
              <div className="flex border-b border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: 'steps' })}
                  className={`flex-1 p-4 font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${activeTab === 'steps' ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-700/50'
                    }`}
                >
                  <BookOpenIcon className="h-5 w-5" />
                  <span>Steps</span>
                </button>
                <button
                  onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: 'transcript' })}
                  className={`flex-1 p-4 font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${activeTab === 'transcript' ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-700/50'
                    }`}
                >
                  <FileTextIcon className="h-5 w-5" />
                  <span>Transcript</span>
                </button>
              </div>

              {activeTab === 'steps' && (
                <ProcessSteps
                  steps={steps}
                  currentStepIndex={currentStepIndex}
                  onStepSelect={handleStepSelect}
                  markStep={handleMarkStep}
                  goBack={goBack}
                  onCheckpointAnswer={handleCheckpointAnswer}
                  isEvaluatingCheckpoint={isEvaluatingCheckpoint || isAdvancing}
                  checkpointFeedback={checkpointFeedback}
                  instructionSuggestion={instructionSuggestion}
                  onSuggestionSubmit={handleSuggestionSubmit}
                  isSuggestionSubmitted={isSuggestionSubmitted}
                  isAdmin={isAdmin}
                  moduleId={moduleId}
                  onTutorHelp={handleTutorHelp}
                  checkpointFailureStats={checkpointFailureStats}
                />
              )}

              {activeTab === 'transcript' && (
                transcript.length > 0 ? (
                  <TranscriptViewer
                    transcript={transcript}
                    currentTime={currentTime}
                    onLineClick={handleSeekTo}
                  />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 dark:text-slate-400">
                    <FileTextIcon className="h-12 w-12 mx-auto mb-4 text-slate-400 dark:text-slate-600" />
                    <h3 className="font-bold text-lg text-slate-700 dark:text-slate-300">No Transcript Available</h3>
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
          onClick={() => dispatch({ type: 'TOGGLE_CHAT' })}
          className="fixed bottom-6 right-6 bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 transition-transform transform hover:scale-110"
          aria-label="Open AI Tutor"
        >
          <BotIcon className="h-6 w-6" />
        </button>
      )}

      {isChatOpen && moduleId && sessionToken && moduleData && (
        <div className="fixed bottom-6 right-6 h-[85vh] w-[90vw] max-w-md bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-2xl flex flex-col border border-slate-200 dark:border-slate-700 z-50 animate-fade-in-up">
          <ChatTutor
            moduleId={moduleId}
            sessionToken={sessionToken}
            stepsContext={stepsContext}
            fullTranscript={fullTranscript}
            onTimestampClick={handleSeekTo}
            currentStepIndex={currentStepIndex}
            steps={steps}
            onClose={() => dispatch({ type: 'TOGGLE_CHAT' })}
            initialPrompt={initialChatPrompt}
          />
        </div>
      )}
    </>
  );
};

export default TrainingPage;