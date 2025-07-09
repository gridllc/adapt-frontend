import React, { useState } from 'react';
import { PlusIcon, MenuIcon, MessageSquareIcon } from './icons/Icons';

interface SidebarProps {
    onNewChat: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onNewChat }) => {
    const [isExpanded, setIsExpanded] = useState(true);

    return (
        <div className={`flex flex-col bg-[#1e1f20] p-4 transition-all duration-300 ease-in-out ${isExpanded ? 'w-64' : 'w-20'}`}>
            <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 rounded-full hover:bg-gray-700 self-start mb-4">
                <MenuIcon className="w-6 h-6 text-gray-300" />
            </button>

            <button
                onClick={onNewChat}
                className="flex items-center justify-start p-3 bg-blue-500/20 text-blue-300 rounded-full hover:bg-blue-500/40 transition-colors duration-200"
            >
                <PlusIcon className="w-5 h-5" />
                {isExpanded && <span className="ml-3 font-medium">New Chat</span>}
            </button>

            {isExpanded && (
                <div className="mt-8 flex-1">
                    <h2 className="text-gray-400 text-sm font-semibold mb-3 px-3">Recent</h2>
                    <div className="flex items-center p-3 rounded-lg text-gray-300 bg-gray-700/50 cursor-pointer">
                        <MessageSquareIcon className="w-5 h-5 mr-3 flex-shrink-0" />
                        <span className="truncate">Personal Learning Session</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sidebar;