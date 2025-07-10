
import React, { useState, useRef, useEffect } from 'react';
import type { TranscriptLine } from '@/types';
import { DownloadIcon } from '@/components/Icons';

interface TranscriptViewerProps {
  transcript: TranscriptLine[];
  currentTime: number;
  onLineClick: (time: number) => void;
}

const formatTime = (seconds: number): string => {
  const date = new Date(0);
  date.setSeconds(seconds);
  return date.toISOString().substr(14, 5);
};

export const TranscriptViewer: React.FC<TranscriptViewerProps> = ({ transcript, currentTime, onLineClick }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const activeLineRef = useRef<HTMLDivElement>(null);

  const filteredTranscript = transcript.filter(line =>
    line.text.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const activeIndex = filteredTranscript.findIndex(line => currentTime >= line.start && currentTime < line.end);

  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex]);

  const handleDownload = () => {
    const transcriptText = transcript
      .map(line => `[${formatTime(line.start)}] ${line.text}`)
      .join('\n');
      
    const blob = new Blob([transcriptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transcript.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 flex flex-col h-full overflow-hidden">
        <div className="flex gap-2 mb-4 flex-shrink-0">
            <input
                type="text"
                placeholder="Search transcript..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-grow bg-slate-900 border border-slate-600 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button 
                onClick={handleDownload}
                className="p-2 bg-slate-700 hover:bg-slate-600 rounded-md transition-colors"
                aria-label="Download transcript"
            >
                <DownloadIcon className="h-5 w-5 text-slate-300" />
            </button>
        </div>
        <div className="space-y-1 overflow-y-auto flex-1">
            {filteredTranscript.map((line, index) => {
                const isActive = currentTime >= line.start && currentTime < line.end;
                return (
                <div
                    key={index}
                    ref={isActive ? activeLineRef : null}
                    onClick={() => onLineClick(line.start)}
                    className={`cursor-pointer p-2 rounded-md transition-colors duration-200 flex items-start gap-3 ${
                    isActive ? 'bg-indigo-600/50 text-white' : 'text-slate-300 hover:bg-slate-700/80'
                    }`}
                >
                    <span className="font-mono text-xs text-indigo-300 pt-0.5">{formatTime(line.start)}</span>
                    <p className="text-sm flex-1">{line.text}</p>
                </div>
                );
            })}
        </div>
    </div>
  );
};