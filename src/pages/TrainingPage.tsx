

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { VideoPlayer } from '@/components/VideoPlayer';
import { ProcessSteps } from '@/components/ProcessSteps';
import { ChatTutor } from '@/components/ChatTutor';
import { BotIcon, BookOpenIcon, FileTextIcon, Share2Icon, PencilIcon } from '@/components/Icons';
import type { ProcessStep, PerformanceReportData, TranscriptLine, StepStatus, CheckpointEvaluation } from '@/types';
import type { Database } from '@/types/supabase';
import { useTrainingSession } from '@/hooks/useTrainingSession';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { getModule } from '@/services/moduleService';
import { getChatHistory } from '@/services/chatService';
import { generatePerformanceSummary, evaluateCheckpointAnswer } from '@/services/geminiService';
import { submitSuggestion } from '@/services/suggestionsService';
import { logCheckpointResponse } from '@/services/checkpointService';
import { TranscriptViewer } from '@/components/TranscriptViewer';
import { PerformanceReport } from '@/components/PerformanceReport';

type ModuleRow = Database['public']['Tables']['modules']['Row'];

const findActiveStepIndex = (time: number, steps: ProcessStep[]) => {
  let foundIndex = -1;
  // This allows finding the step even if the video overshoots the last step's end time.
  if (steps.length > 0 && time >= steps[steps.length - 1].start) {
    return steps.length - 1;
  }

  for (let i = 0; i < steps.length; i++) {
    if (time >= steps[i].start && time < steps[i].end) {
      return i;
    }
  }
  return -1;
};

const generateToken = () => Math.random().toString(36).substring(2, 10);

type ActiveTab = 'steps' | 'transcript';

const TrainingPage: React.FC = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { addToast } = useToast();

  const [currentTime, setCurrentTime] = useState(0);
  const [activeTab, setActiveTab] = useState<ActiveTab>('steps');
  const [stepsContext, setStepsContext] = useState('');
  const [fullTranscript, setFullTranscript] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [performanceReport, setPerformanceReport] = useState<PerformanceReportData | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [initialChatPrompt, setInitialChatPrompt] = useState<string | undefined>();

  // State for Checkpoint evaluation
  const [isEvaluatingCheckpoint, setIsEvaluatingCheckpoint] = useState(false);
  const [checkpointFeedback, setCheckpointFeedback] = useState<CheckpointEvaluation | null>(null);
  const [instructionSuggestion, setInstructionSuggestion] = useState<string | null>(null);
  const [isSuggestionSubmitted, setIsSuggestionSubmitted] = useState(false);


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
  } = useQuery<ModuleRow | undefined, Error>({
    queryKey: ['module', moduleId],
    queryFn: () => getModule(moduleId!),
    enabled: !!moduleId && !!sessionToken,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  });

  const steps = (moduleData?.steps as ProcessStep[]) || [];
  const transcript = (moduleData?.transcript as TranscriptLine[]) || [];

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


  useEffect(() => {
    // Only navigate to not-found if the query has errored AND we never had any data to display.
    if (isError && !moduleData) {
      console.error(`Module with slug "${moduleId}" not found or failed to load.`, error);
      navigate('/not-found');
    }
  }, [isError, moduleData, moduleId, navigate, error]);

  // Generate focused AI contexts based on the current step and transcript
  useEffect(() => {
    if (!moduleData || currentStepIndex < 0 || isCompleted) {
      setStepsContext('');
      setFullTranscript('');
      return;
    };

    const { title } = moduleData;

    // 1. Create context from the process steps (previous, current, next)
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

    // 2. Create context from the full video transcript
    if (transcript && transcript.length > 0) {
      const transcriptText = transcript.map(line => `[${line.start.toFixed(2)}] ${line.text}`).join('\n');
      setFullTranscript(transcriptText);
    } else {
      setFullTranscript('');
    }

  }, [currentStepIndex, moduleData, isCompleted, steps, transcript]);

  // Effect to generate performance report upon completion
  useEffect(() => {
    if (isCompleted && moduleData && !performanceReport && !isGeneratingReport) {
      const generateReport = async () => {
        if (!moduleId || !sessionToken) return;
        setIsGeneratingReport(true);

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
  }, [isCompleted, moduleData, userActions, moduleId, sessionToken, performanceReport, isGeneratingReport, steps]);


  const handleSeekTo = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      if (videoRef.current.paused) {
        videoRef.current.play().catch(console.error);
      }
    }
  }, []);

  // When currentStepIndex changes, seek video to the start of the new step.
  useEffect(() => {
    const step = steps?.[currentStepIndex];
    if (step && videoRef.current) {
      // Add a small tolerance to avoid seeking if already very close.
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

    // Automatically advance the step based on video time, but only if the user isn't on a checkpoint.
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
    setCheckpointFeedback(null);
    setInstructionSuggestion(null);
    setIsSuggestionSubmitted(false);
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
    setPerformanceReport(null);
    resetSession();
  }

  const handleCheckpointAnswer = useCallback(async (answer: string, comment?: string) => {
    const step = steps[currentStepIndex];
    if (!step?.checkpoint || !moduleId) return;

    // Log the raw response first (fire-and-forget style)
    if (user) {
      logCheckpointResponse({
        module_id: moduleId,
        user_id: user.id,
        step_index: currentStepIndex,
        checkpoint_text: step.checkpoint,
        answer: answer,
        comment: comment,
      }).catch(err => console.error("Non-blocking error: Failed to log checkpoint response.", err));
    }

    // Then, evaluate the answer with AI
    setIsEvaluatingCheckpoint(true);
    try {
      const evaluation = await evaluateCheckpointAnswer(step, answer);
      setCheckpointFeedback(evaluation);
      setInstructionSuggestion(evaluation.suggestedInstructionChange ?? null);

      if (evaluation.isCorrect) {
        addToast('success', 'Checkpoint Passed', 'Great! Moving to the next step.');
        setTimeout(() => markStep('done'), 1500);
      } else {
        addToast('info', 'Reviewing Step', 'Take another look at the instructions.');
        handleSeekTo(step.start);
      }
    } catch (err) {
      console.error("Error evaluating checkpoint with AI", err);
      addToast('error', 'Evaluation Error', 'Could not get AI feedback. Please try again.');
      // Fallback to simple logic if AI fails
      if (answer.toLowerCase() === 'yes') {
        markStep('done');
      } else {
        handleSeekTo(step.start);
      }
    } finally {
      setIsEvaluatingCheckpoint(false);
    }
  }, [currentStepIndex, steps, addToast, markStep, handleSeekTo, user, moduleId]);

  const handleSuggestionSubmit = async () => {
    if (!moduleId || !instructionSuggestion) return;

    try {
      await submitSuggestion(moduleId, currentStepIndex, instructionSuggestion);
      addToast('success', 'Suggestion Submitted!', 'Thank you for helping improve this training.');
      setIsSuggestionSubmitted(true);
    } catch (err) {
      addToast('error', 'Submission Failed', 'Could not send the suggestion.');
    }
  };

  const handleTutorHelp = useCallback((question: string, userAnswer?: string) => {
    const step = steps[currentStepIndex];
    if (!step) return;

    let prompt: string;

    // If a checkpoint was just failed, create a more contextual prompt.
    if (userAnswer && userAnswer.toLowerCase() === 'no' && checkpointFeedback && !checkpointFeedback.isCorrect) {
      let contextForAi = `I'm on the step: "${step.title}".\n`;
      contextForAi += `The instruction is: "${step.description}".\n`;
      if (step.checkpoint) {
        contextForAi += `I was asked the checkpoint question: "${step.checkpoint}" and I answered "${userAnswer}".\n`;
      }
      if (step.alternativeMethods && step.alternativeMethods.length > 0 && step.alternativeMethods[0].description) {
        contextForAi += `I see a hint that says: "${step.alternativeMethods[0].description}".\n`;
      }
      contextForAi += "I'm still stuck. What should I do next?";
      prompt = contextForAi;
    } else {
      // Default prompt if not a failed checkpoint scenario
      prompt = `I have a question about this checkpoint: "${question}"`;
    }

    setInitialChatPrompt(prompt);
    setIsChatOpen(true);
  }, [steps, currentStepIndex, checkpointFeedback]);


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
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-lg shadow-xl overflow-hidden">
          <VideoPlayer
            ref={videoRef}
            video_url={moduleData.video_url}
            onTimeUpdate={handleTimeUpdate}
          />
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
                  onClick={() => setActiveTab('steps')}
                  className={`flex-1 p-4 font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${activeTab === 'steps' ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100/50 dark:hover:bg-slate-700/50'
                    }`}
                >
                  <BookOpenIcon className="h-5 w-5" />
                  <span>Steps</span>
                </button>
                <button
                  onClick={() => setActiveTab('transcript')}
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
                  isEvaluatingCheckpoint={isEvaluatingCheckpoint}
                  checkpointFeedback={checkpointFeedback}
                  instructionSuggestion={instructionSuggestion}
                  onSuggestionSubmit={handleSuggestionSubmit}
                  isSuggestionSubmitted={isSuggestionSubmitted}
                  isAdmin={!!user}
                  moduleId={moduleId}
                  onTutorHelp={handleTutorHelp}
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
          onClick={() => setIsChatOpen(true)}
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
            onClose={() => {
              setIsChatOpen(false);
              setInitialChatPrompt(undefined);
            }}
            initialPrompt={initialChatPrompt}
          />
        </div>
      )}
    </>
  );
};

export default TrainingPage;
