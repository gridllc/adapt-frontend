import React, { useRef, useEffect } from 'react';
import type { TranscriptLine } from '@/types';
import { PlayCircleIcon } from '@/components/Icons';

interface TranscriptEditorProps {
  transcript: TranscriptLine[];
  currentTime: number;
  onSeek: (time: number) => void;
  onTranscriptChange: (index: number, newText: string) => void;
}

const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const date = new Date(0);
    date.setSeconds(seconds);
    return date.toISOString().substr(14, 5); // MM:SS
};

export const TranscriptEditor: React.FC<TranscriptEditorProps> = ({ transcript, currentTime, onSeek, onTranscriptChange }) => {
    const activeLineRef = useRef<HTMLDivElement>(null);

    // Find the index of the line that corresponds to the current video time
    const activeIndex = transcript.findIndex(line => currentTime >= line.start && currentTime < line.end);

    useEffect(() => {
        // Automatically scroll the active line into view
        if (activeLineRef.current) {
            activeLineRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest'
            });
        }
    }, [activeIndex]);

    return (
        <div className="space-y-2 overflow-y-auto h-full pr-2">
            {transcript.map((line, index) => {
                const isActive = index === activeIndex;
                return (
                    <div
                        key={index}
                        ref={isActive ? activeLineRef : null}
                        className={`p-2 rounded-md transition-colors duration-200 flex items-start gap-3 ${
                            isActive ? 'bg-indigo-100 dark:bg-indigo-900/50' : 'bg-white dark:bg-slate-800/50'
                        }`}
                    >
                        <button onClick={() => onSeek(line.start)} className="pt-1.5 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400" aria-label={`Play from ${formatTime(line.start)}`}>
                           <PlayCircleIcon className="h-5 w-5" />
                        </button>
                        <span className="font-mono text-sm text-indigo-500 dark:text-indigo-300 pt-1.5 whitespace-nowrap">
                            [{formatTime(line.start)}]
                        </span>
                        <textarea
                            value={line.text}
                            onChange={(e) => onTranscriptChange(index, e.target.value)}
                            aria-label={`Transcript line at ${formatTime(line.start)}`}
                            className="w-full text-base text-slate-800 dark:text-slate-200 bg-transparent p-1 rounded-md border border-transparent focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                            rows={Math.max(2, Math.ceil(line.text.length / 50))}
                        />
                    </div>
                );
            })}
        </div>
    );
};
