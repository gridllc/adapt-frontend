
import React from 'react';
import { SparklesIcon, CompassIcon, EditIcon, CodeIcon } from './icons/Icons';

interface WelcomeScreenProps {
    onPromptClick: (prompt: string) => void;
}

const examplePrompts = [
    {
        icon: CompassIcon,
        title: "Explain a concept",
        prompt: "Explain the theory of relativity like I'm five years old."
    },
    {
        icon: EditIcon,
        title: "Draft an email",
        prompt: "Draft a polite email to a professor asking for an extension on a paper."
    },
    {
        icon: CodeIcon,
        title: "Write some code",
        prompt: "Write a python function that calculates the factorial of a number."
    },
    {
        icon: SparklesIcon,
        title: "Brainstorm ideas",
        prompt: "Brainstorm three innovative project ideas for a high school science fair."
    }
]

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onPromptClick }) => {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="p-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 inline-block mb-6">
                <SparklesIcon className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-200 to-gray-400 mb-4">
                Hello, how can I help you learn today?
            </h1>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-12 w-full max-w-3xl">
                {examplePrompts.map((item, index) => (
                    <div
                        key={index}
                        className="bg-[#1e1f20] p-4 rounded-xl hover:bg-gray-800 cursor-pointer transition-colors duration-200 border border-gray-700/50"
                        onClick={() => onPromptClick(item.prompt)}
                    >
                        <div className="flex items-start">
                            <div className="p-2 bg-gray-700 rounded-full mr-4">
                                <item.icon className="w-5 h-5 text-gray-300" />
                            </div>
                            <div>
                                <h3 className="text-left font-semibold text-gray-200">{item.title}</h3>
                                <p className="text-left text-sm text-gray-400">{item.prompt}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default WelcomeScreen;