

import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProcessStep, StepStatus, CheckpointEvaluation } from '@/types';
import { CheckCircleIcon, LightbulbIcon, HelpCircleIcon, XCircleIcon, SendIcon, SparklesIcon, ArrowLeftIcon, AlertTriangleIcon, PencilIcon } from '@/components/Icons';

interface ProcessStepsProps {
  steps: ProcessStep[];
  currentStepIndex: number;
  onStepSelect: (time: number, index: number) => void;
  markStep: (status: StepStatus) => void;
  checkpointAnswer: string;
  onCheckpointAnswerChange: (value: string) => void;
  onCheckpointSubmit: () => void;
  checkpointFeedback: CheckpointEvaluation | null;
  isEvaluatingCheckpoint: boolean;
  goBack: () => void;
  instructionSuggestion: string | null;
  onSuggestionSubmit: () => void;
  isSuggestionSubmitted: boolean;
  isAdmin: boolean;
  moduleId: string | undefined;
}

export const ProcessSteps: React.FC<ProcessStepsProps> = ({
  steps,
  currentStepIndex,
  onStepSelect,
  markStep,
  checkpointAnswer,
  onCheckpointAnswerChange,
  onCheckpointSubmit,
  checkpointFeedback,
  isEvaluatingCheckpoint,
  goBack,
  instructionSuggestion,
  onSuggestionSubmit,
  isSuggestionSubmitted,
  isAdmin,
  moduleId,
}) => {
  const activeStepRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Scroll the active step into the center of the view smoothly.
    if (activeStepRef.current) {
      activeStepRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentStepIndex]); // Depend on activeStepIndex to scroll when the step changes

  return (
    <div className="p-4 space-y-3 overflow-y-auto flex-1">
      {steps.map((step, index) => {
        const isActive = currentStepIndex === index;
        const isCompleted = currentStepIndex > index;

        return (
          <div
            key={index}
            ref={isActive ? activeStepRef : null}
            onClick={() => onStepSelect(step.start, index)}
            className={`cursor-pointer p-4 rounded-lg transition-all duration-300 border-l-4 ${isActive
              ? 'bg-indigo-100 dark:bg-indigo-600/30 border-indigo-500 shadow-lg'
              : isCompleted
                ? 'bg-slate-100/60 dark:bg-slate-700/40 border-green-500 opacity-70'
                : 'bg-slate-100 dark:bg-slate-700/80 border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
          >
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-md text-slate-800 dark:text-slate-100">{step.title}</h3>
              {isCompleted && <CheckCircleIcon className="h-5 w-5 text-green-500" />}
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{step.description}</p>

            {step.alternativeMethods.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600/50">
                {step.alternativeMethods.map((alt, altIndex) => (
                  <div key={altIndex} className="mt-2">
                    <div className="flex items-center gap-2">
                      <LightbulbIcon className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
                      <h4 className="font-semibold text-sm text-slate-700 dark:text-slate-200">{alt.title}</h4>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300 pl-6">{alt.description}</p>
                  </div>
                ))}
              </div>
            )}

            {isActive && (
              <div className="mt-4 pt-3 border-t border-slate-300 dark:border-slate-600/70">
                {step.checkpoint ? (
                  // Interactive Checkpoint UI
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 italic">
                      Checkpoint: {step.checkpoint}
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={checkpointAnswer}
                        onChange={(e) => onCheckpointAnswerChange(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !isEvaluatingCheckpoint && onCheckpointSubmit()}
                        placeholder="Type your answer here..."
                        className="flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                        disabled={isEvaluatingCheckpoint}
                      />
                      <button
                        onClick={onCheckpointSubmit}
                        disabled={isEvaluatingCheckpoint || !checkpointAnswer.trim()}
                        className="bg-indigo-600 text-white p-2.5 rounded-lg disabled:bg-slate-400 dark:disabled:bg-slate-500 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
                      >
                        {isEvaluatingCheckpoint ? <SparklesIcon className="h-5 w-5 animate-pulse" /> : <SendIcon className="h-5 w-5" />}
                      </button>
                    </div>
                    {checkpointFeedback && (
                      <div className={`flex items-start gap-2 p-3 rounded-lg text-sm animate-fade-in-up ${checkpointFeedback.isCorrect
                          ? 'bg-green-100/80 dark:bg-green-900/50 text-green-800 dark:text-green-200'
                          : 'bg-red-100/80 dark:bg-red-900/50 text-red-800 dark:text-red-200'
                        }`}>
                        {checkpointFeedback.isCorrect ? <CheckCircleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" /> : <XCircleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />}
                        <span>{checkpointFeedback.feedback}</span>
                      </div>
                    )}

                    {!checkpointFeedback?.isCorrect && instructionSuggestion && (
                      isAdmin ? (
                        // Admin view: Prompt to fix the step directly
                        <div className="mt-3 p-3 bg-red-100 dark:bg-red-900/50 rounded-lg text-sm animate-fade-in-up space-y-2 border border-red-300 dark:border-red-700">
                          <div className="flex items-center gap-2 font-bold text-red-800 dark:text-red-200">
                            <AlertTriangleIcon className="h-5 w-5" />
                            <span>Instruction Mismatch Detected</span>
                          </div>
                          <p className="text-red-900 dark:text-red-100 italic">"This checkpoint surfaced a missing detail in the instructions. Here's a suggested fix:"</p>
                          <p className="p-2 bg-white/50 dark:bg-black/20 rounded-md font-medium text-slate-700 dark:text-slate-200">"{instructionSuggestion}"</p>
                          <button
                            onClick={() => navigate(`/modules/${moduleId}/edit`)}
                            className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                          >
                            <PencilIcon className="h-4 w-4" />
                            Edit Step to Apply Fix
                          </button>
                        </div>
                      ) : (
                        // Trainee view: Submit suggestion to owner
                        <div className="mt-3 p-3 bg-yellow-100/80 dark:bg-yellow-900/50 rounded-lg text-sm animate-fade-in-up space-y-2 border border-yellow-300 dark:border-yellow-700">
                          <div className="flex items-center gap-2 font-bold text-yellow-800 dark:text-yellow-200">
                            <LightbulbIcon className="h-5 w-5" />
                            <span>AI Improvement Suggestion</span>
                          </div>
                          <p className="text-yellow-900 dark:text-yellow-100 italic">"The instructions for this step seem a bit unclear. Here's a suggested improvement:"</p>
                          <p className="p-2 bg-white/50 dark:bg-black/20 rounded-md font-medium text-slate-700 dark:text-slate-200">"{instructionSuggestion}"</p>
                          <button
                            onClick={onSuggestionSubmit}
                            disabled={isSuggestionSubmitted}
                            className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2 px-3 rounded-lg transition-colors disabled:bg-green-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            {isSuggestionSubmitted ? <> <CheckCircleIcon className="h-4 w-4" /> Submitted </> : 'Submit this fix to the owner'}
                          </button>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  // Standard Action Buttons
                  <div className="flex items-center justify-center gap-3">
                    {currentStepIndex > 0 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); goBack(); }}
                        className="flex items-center gap-2 bg-slate-500 hover:bg-slate-600 text-white text-sm font-semibold py-2 px-4 rounded-full transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-800 focus:ring-slate-400"
                        aria-label="Go to previous step"
                      >
                        <ArrowLeftIcon className="h-5 w-5" />
                        <span>Back</span>
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); markStep('done'); }}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2 px-4 rounded-full transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-800 focus:ring-green-500"
                      aria-label="Mark step as done"
                    >
                      <CheckCircleIcon className="h-5 w-5" />
                      <span>I did this</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); markStep('unclear'); }}
                      className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold py-2 px-4 rounded-full transition-transform transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-800 focus:ring-amber-400"
                      aria-label="Mark step as unclear"
                    >
                      <HelpCircleIcon className="h-5 w-5" />
                      <span>I'm not sure</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
