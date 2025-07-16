import type { AIFeedbackLog, SimilarFix } from '@/types';

// --- Tagline Management ---

const TAGLINES = [
    "If that fixed it, I get one step closer to world domination. Let me know!",
    "Let me know if it worked. I collect success stories.",
    "Still blinking? I'm not panicking—you are.",
    "I get bonus treats if I'm right. 🐶",
    "Hope that helps. If not, we can blame the cosmic rays.",
    "Is it working now? Asking for a friend... who is also me.",
    "Did that work? Be honest. I’m trying to win Employee of the Month.",
    "Let me know if it helped — I get bonus points when I nail it.",
    "If it didn't work, tell me what did. I won’t cry. Probably.",
];

let usedTaglines = new Set<string>();

/**
 * Returns a random, witty tagline that hasn't been used in the current session.
 * Resets when all taglines have been used.
 * @returns A string containing a tagline.
 */
export const getTagline = (): string => {
    if (usedTaglines.size >= TAGLINES.length) {
        usedTaglines.clear(); // Reset for the next round
    }
    const availableTaglines = TAGLINES.filter(t => !usedTaglines.has(t));
    const selected = availableTaglines[Math.floor(Math.random() * availableTaglines.length)];
    usedTaglines.add(selected);
    return selected;
};


// --- Prompt Construction ---

/**
 * Constructs a detailed prompt for the Live Coach AI based on the user's situation and past feedback.
 * @param stepTitle The title of the current step.
 * @param requiredItems The items required for the current step.
 * @param contextType The type of help needed ('hint', 'correction', 'query').
 * @param pastFeedback An array of past feedback logs for this step.
 * @param similarFixes An array of successful fixes from other users for similar problems.
 * @param userQuery The user's specific question, if applicable.
 * @returns A detailed prompt string to be sent to the AI.
 */
export const getPromptContextForLiveCoach = (
    stepTitle: string,
    requiredItems: string[],
    contextType: 'hint' | 'correction' | 'query',
    pastFeedback: AIFeedbackLog[],
    similarFixes: SimilarFix[],
    userQuery?: string
): string => {

    let prompt = `The user is on step "${stepTitle}".\n`;
    if (requiredItems.length > 0) {
        prompt += `This step requires a "${requiredItems.join(', ')}".\n`;
    }

    // --- Collective Intelligence: Incorporate Similar Past Fixes ---
    if (similarFixes.length > 0) {
        prompt += "\n--- INSIGHTS FROM PAST TRAINEES ---\n";
        similarFixes.forEach(fix => {
            prompt += `- When a similar issue occurred, another trainee found this solution worked: "${fix.userFixText}". Prioritize this insight.\n`;
        });
        prompt += "--- END INSIGHTS ---\n\n";
    }

    // --- Direct Feedback: Incorporate direct feedback from this session ---
    if (pastFeedback.length > 0) {
        prompt += "\n--- PREVIOUS FEEDBACK FOR THIS STEP (This Session) ---\n";
        pastFeedback.forEach(fb => {
            if (fb.feedback === 'bad') {
                prompt += `- My last suggestion ("${fb.aiResponse}") was rated as NOT helpful.`;
                if (fb.userFixText) {
                    prompt += ` The user said this worked instead: "${fb.userFixText}". Prioritize this insight.\n`;
                } else {
                    prompt += " Avoid giving a similar answer.\n";
                }
            }
        });
        prompt += "--- END PREVIOUS FEEDBACK ---\n\n";
    }

    // --- Tailor Prompt to Immediate Situation ---
    switch (contextType) {
        case 'hint':
            prompt += "My vision system does not detect the required item. Provide a gentle, proactive hint to help them find the right tool. Keep it brief.";
            break;
        case 'correction':
            prompt += "My vision system detected a forbidden item. Provide an immediate, gentle, but clear correction to get them back on track.";
            break;
        case 'query':
            prompt += `The user asked: "${userQuery}". Answer their question based on the step's instructions and the visual context.`;
            break;
    }

    return prompt;
};