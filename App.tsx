import React, { useState, useRef, useCallback } from 'react';
import { VideoPlayer } from './components/VideoPlayer';
import { ProcessSteps } from './components/ProcessSteps';
import { ChatTutor } from './components/ChatTutor';
import { BotIcon, MessageSquareIcon, XIcon } from './components/Icons';
import type { TrainingModule } from './types';

// Mock data for a training module, now including an alternative method.
const MOCK_SANDWICH_MODULE: TrainingModule = {
    title: 'How to Make Our Signature Sandwich',
    videoUrl: 'https://storage.googleapis.com/web-dev-assets/video-api-demo/flowers.mp4', // Placeholder video
    steps: [
        {
            start: 0,
            end: 10,
            title: "Step 1: Prepare Your Station",
            description: "First, wash your hands and put on a fresh pair of gloves. Ensure your cutting board is clean and your knife is sharp.",
            checkpoint: "What is the very first thing you should do?",
            alternativeMethods: []
        },
        {
            start: 10,
            end: 20,
            title: "Step 2: Toast the Sourdough Bread",
            description: "Take two slices of sourdough bread. Place them in the conveyor toaster set to level 3. It should be golden brown, not dark.",
            checkpoint: "What setting should the toaster be on?",
            alternativeMethods: []
        },
        {
            start: 20,
            end: 35,
            title: "Step 3: Apply the Signature Sauce",
            description: "Spread one tablespoon of our signature aioli on both slices of the toasted bread, covering it edge to edge.",
            checkpoint: null,
            alternativeMethods: []
        },
        {
            start: 35,
            end: 45,
            title: "Step 4: Layer the Turkey",
            description: "Weigh out 4 ounces of sliced turkey. Gently fold and layer it evenly on the bottom slice of bread.",
            checkpoint: "How much turkey should you use?",
            alternativeMethods: [
                {
                    title: "Quick-Fold Method (for rush hours)",
                    description: "Instead of weighing, you can use 6 folded slices of turkey as a close approximation. This is faster but less precise."
                }
            ]
        },
        {
            start: 45,
            end: 55,
            title: "Step 5: Add Provolone Cheese & Veggies",
            description: "Place two slices of Provolone cheese on top of the turkey. Then, add three rings of red onion and a handful of arugula.",
            checkpoint: null,
            alternativeMethods: []
        },
        {
            start: 55,
            end: 60,
            title: "Step 6: Final Assembly",
            description: "Place the top slice of bread on, slice the sandwich diagonally, and serve immediately with a pickle spear.",
            checkpoint: "How is the sandwich cut?",
            alternativeMethods: []
        },
    ]
};

const App: React.FC = () => {
    const [currentTime, setCurrentTime] = useState(0);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    const handleTimeUpdate = (time: number) => {
        setCurrentTime(time);
    };

    const handleSeekTo = useCallback((time: number) => {
        if (videoRef.current) {
            videoRef.current.currentTime = time;
            videoRef.current.play();
        }
    }, []);

    // Create a structured context string for the AI, now including alternative methods.
    const aiContext = `
Module Title: ${MOCK_SANDWICH_MODULE.title}

Process Steps:
${MOCK_SANDWICH_MODULE.steps.map(step => `
- Time: [${new Date(step.start * 1000).toISOString().substr(14, 5)}-${new Date(step.end * 1000).toISOString().substr(14, 5)}]
  Title: ${step.title}
  Instruction: ${step.description}
  ${step.checkpoint ? `Checkpoint Question: ${step.checkpoint}` : ''}
  ${step.alternativeMethods.length > 0 ? `Alternative Methods:\n${step.alternativeMethods.map(alt => `    - ${alt.title}: ${alt.description}`).join('\n')}` : ''}
`).join('\n')}
  `.trim();

    return (
        <div className="min-h-screen bg-slate-900 text-slate-200 font-sans">
            <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700 p-4 sticky top-0 z-20 flex justify-between items-center">
                <h1 className="text-2xl font-bold text-white">{MOCK_SANDWICH_MODULE.title}</h1>
                <span className="font-bold text-lg text-indigo-400">Adapt</span>
            </header>

            <main className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 max-w-7xl mx-auto">
                <div className="lg:col-span-2 bg-slate-800 rounded-lg shadow-xl overflow-hidden">
                    <VideoPlayer
                        ref={videoRef}
                        videoUrl={MOCK_SANDWICH_MODULE.videoUrl}
                        onTimeUpdate={handleTimeUpdate}
                    />
                </div>
                <div className="lg:col-span-1 h-[75vh] bg-slate-800 rounded-lg shadow-xl overflow-hidden flex flex-col">
                    <h2 className="text-lg font-semibold p-4 border-b border-slate-700">Process Steps</h2>
                    <ProcessSteps
                        steps={MOCK_SANDWICH_MODULE.steps}
                        currentTime={currentTime}
                        onStepClick={handleSeekTo}
                    />
                </div>
            </main>

            {/* Chat Bubble */}
            {!isChatOpen && (
                <button
                    onClick={() => setIsChatOpen(true)}
                    className="fixed bottom-6 right-6 bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 transition-transform transform hover:scale-110"
                    aria-label="Open AI Tutor"
                >
                    <BotIcon className="h-6 w-6" />
                </button>
            )}

            {/* Chat Tutor Window */}
            {isChatOpen && (
                <div className="fixed bottom-6 right-6 h-[85vh] w-[90vw] max-w-md bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-2xl flex flex-col border border-slate-700 z-50 animate-fade-in-up">
                    <header className="flex items-center justify-between p-4 border-b border-slate-700">
                        <div className="flex items-center gap-3">
                            <MessageSquareIcon className="h-6 w-6 text-indigo-400" />
                            <h2 className="font-bold text-lg text-white">Adapt AI Tutor</h2>
                        </div>
                        <button onClick={() => setIsChatOpen(false)} className="text-slate-400 hover:text-white">
                            <XIcon className="h-6 w-6" />
                        </button>
                    </header>
                    <ChatTutor
                        transcriptContext={aiContext}
                        onTimestampClick={handleSeekTo}
                    />
                </div>
            )}
        </div>
    );
};

export default App;