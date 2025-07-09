
import React, { useRef, useEffect } from 'react';
import type { ProcessStep } from '../types';
import { CheckCircleIcon, LightbulbIcon } from './Icons';

interface ProcessStepsProps {
  steps: ProcessStep[];
  currentTime: number;
  onStepClick: (time: number) => void;
}

export const ProcessSteps: React.FC<ProcessStepsProps> = ({ steps, currentTime, onStepClick }) => {
  const activeStepRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll the active step into the center of the view smoothly.
    if (activeStepRef.current) {
      activeStepRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentTime]);

  const findActiveStepIndex = (time: number) => {
    return steps.findIndex(step => time >= step.start && time < step.end);
  }

  const activeStepIndex = findActiveStepIndex(currentTime);

  return (
    <div className="p-4 space-y-3 overflow-y-auto flex-1">
      {steps.map((step, index) => {
        const isActive = activeStepIndex === index;
        const isCompleted = activeStepIndex > index;

        return (
          <div
            key={index}
            ref={isActive ? activeStepRef : null}
            onClick={() => onStepClick(step.start)}
            className={`cursor-pointer p-4 rounded-lg transition-all duration-300 border-l-4 ${isActive
                ? 'bg-indigo-600/30 border-indigo-500 shadow-lg'
                : isCompleted
                  ? 'bg-slate-700/40 border-green-500 opacity-70'
                  : 'bg-slate-700/80 border-slate-600 hover:bg-slate-700'
              }`}
          >
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-md text-slate-100">{step.title}</h3>
              {isCompleted && <CheckCircleIcon className="h-5 w-5 text-green-500" />}
            </div>
            <p className="mt-1 text-sm text-slate-300">{step.description}</p>
            {step.checkpoint && (
              <p className="mt-2 text-xs text-indigo-300/80 italic">
                Checkpoint: {step.checkpoint}
              </p>
            )}
            {step.alternativeMethods.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-600/50">
                {step.alternativeMethods.map((alt, altIndex) => (
                  <div key={altIndex} className="mt-2">
                    <div className="flex items-center gap-2">
                      <LightbulbIcon className="h-4 w-4 text-yellow-400" />
                      <h4 className="font-semibold text-sm text-slate-200">{alt.title}</h4>
                    </div>
                    <p className="text-sm text-slate-300 pl-6">{alt.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};