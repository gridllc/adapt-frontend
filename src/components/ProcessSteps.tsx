
import React, { useRef, useEffect } from 'react';
import type { ProcessStep, StepStatus, CheckpointEvaluation } from '@/types';
import { CheckCircleIcon, LightbulbIcon, HelpCircleIcon, XCircleIcon, SendIcon, SparklesIcon } from '@/components/Icons';

interface ProcessStepsProps {
  steps: ProcessStep[];
  currentStepIndex: number;
  onStepClick: (time: number) => void;
  markStep: (status: StepStatus) => void;
  checkpointAnswer: string;
  onCheckpointAnswerChange: (value: string) => void;
  onCheckpointSubmit: () => void;
  checkpointFeedback: CheckpointEvaluation | null;
  isEvaluatingCheckpoint: boolean;
}

export const ProcessSteps: React.FC<ProcessStepsProps> = ({
  steps,
  currentStepIndex,
  onStepClick,
  markStep,
  checkpointAnswer,
  onCheckpointAnswerChange,
  onCheckpointSubmit,
  checkpointFeedback,
  isEvaluatingCheckpoint
}) => {
  const activeStepRef = useRef<HTMLDivElement>(null);

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
            onClick={() => onStepClick(step.start)}
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
                  </div>
                ) : (
                  // Standard Action Buttons
                  <div className="flex items-center justify-center gap-3">
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
