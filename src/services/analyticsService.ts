
import type { ChatMessage } from '@/types';

export interface QuestionStats {
    question: string;
    count: number;
}

/**
 * Scans localStorage for all chat histories associated with a given module,
 * extracts all user questions, and returns a frequency-ranked list of those questions.
 * @param moduleId The slug of the module to analyze.
 * @returns An array of objects, each containing a question and its frequency, sorted descending.
 */
export const getQuestionFrequency = (moduleId: string): QuestionStats[] => {
    const questionCounts: Record<string, number> = {};
    const keyPrefix = `adapt-ai-tutor-chat-history-${moduleId}-`;

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(keyPrefix)) {
            try {
                const savedHistoryJSON = localStorage.getItem(key);
                if (savedHistoryJSON) {
                    const messages: ChatMessage[] = JSON.parse(savedHistoryJSON);
                    messages.forEach(msg => {
                        if (msg.role === 'user' && msg.text.trim()) {
                            const question = msg.text.trim();
                            questionCounts[question] = (questionCounts[question] || 0) + 1;
                        }
                    });
                }
            } catch (e) {
                console.error(`Failed to parse chat history from key ${key}`, e);
            }
        }
    }

    const stats: QuestionStats[] = Object.entries(questionCounts)
        .map(([question, count]) => ({ question, count }))
        .sort((a, b) => b.count - a.count);

    return stats;
};
