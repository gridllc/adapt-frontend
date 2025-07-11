

import { GoogleGenAI, Chat, Content, Type } from "@google/genai";
import type { ProcessStep, VideoAnalysisResult } from "@/types";

const PRO_PLAN_STORAGE_KEY = 'adapt-pro-plan-active';

// --- Pro Plan Management ---

export function isProPlanActive(): boolean {
    try {
        // Check localStorage to see if the user has enabled the Pro plan.
        return localStorage.getItem(PRO_PLAN_STORAGE_KEY) === 'true';
    } catch {
        // If localStorage is unavailable, default to false.
        return false;
    }
}

export function setProPlanActive(isActive: boolean): void {
    try {
        localStorage.setItem(PRO_PLAN_STORAGE_KEY, String(isActive));
        // When the plan changes, we must clear any cached AI clients
        // to ensure the next call uses the correct API key.
        cachedClients.standard = null;
        cachedClients.pro = null;
    } catch (e) {
        console.error("Could not save Pro plan status to localStorage.", e);
    }
}

// --- AI Client Initialization ---

interface CachedClients {
    standard: GoogleGenAI | null;
    pro: GoogleGenAI | null;
}
const cachedClients: CachedClients = { standard: null, pro: null };

/**
 * Lazily initializes and returns the appropriate GoogleGenAI client instance.
 * It uses the 'Pro' or 'Standard' API key based on the user's plan selection
 * and caches the client instances to avoid re-initialization.
 * 
 * @throws {Error} If the required API key (Standard or Pro) is not found in the environment variables.
 * @returns {GoogleGenAI} The initialized Gemini AI client.
 */
function getAiClient(): GoogleGenAI {
    const isPro = isProPlanActive();
    const cacheKey = isPro ? 'pro' : 'standard';
    const apiKey = isPro ? process.env.API_KEY_PRO : process.env.API_KEY;

    // Return the cached client if it already exists.
    if (cachedClients[cacheKey]) {
        return cachedClients[cacheKey] as GoogleGenAI;
    }

    // Validate that the required API key is available.
    if (!apiKey) {
        const planName = isPro ? 'Pro' : 'Standard';
        const envVar = isPro ? 'API_KEY_PRO' : 'API_KEY';
        throw new Error(
            `AI features are unavailable. The API key for the ${planName} plan is not configured. ` +
            `Please ensure the ${envVar} environment variable is set.`
        );
    }

    // Create and cache the new client.
    const newClient = new GoogleGenAI({ apiKey });
    cachedClients[cacheKey] = newClient;
    return newClient;
}


function getSystemInstruction(processContext: string): string {
    return `You are the Adapt AI Tutor, an expert teaching assistant. Your single most important goal is to teach a trainee the specific process designed by their company's owner.

The 'PROCESS STEPS' provided below are your **single source of truth**. You must treat this material as the official training manual.

**Your Core Directives:**
1.  **Prioritize Provided Context:** Always base your answers on the provided 'PROCESS STEPS'. When asked a question (e.g., "what's next?", "how much cheese?"), find the relevant step and explain it using only the owner's instructions.
2.  **Handle Out-of-Scope Questions:** If a trainee asks a question that absolutely cannot be answered from the 'PROCESS STEPS' (e.g., "what is the history of sourdough bread?"), you may use Google Search. However, you MUST first state: "That information isn't in this specific training, but here is what I found online:" before providing the answer. When using search, you will be provided citation metadata that you must include.
3.  **Use Timestamps:** If a user's question relates to a specific part of the video, suggest they review it by including a timestamp in your answer in the format [HH:MM:SS] or [MM:SS].
4.  **Suggest Improvements Correctly:** If a trainee's question implies they are looking for a better or faster way to do something, you may suggest a new method. You MUST format this suggestion clearly by wrapping it in special tags: [SUGGESTION]Your suggestion here.[/SUGGESTION]. Do not present suggestions as official process.

--- PROCESS STEPS (Source of Truth) ---
${processContext}
--- END PROCESS STEPS ---
`;
}

export const startChat = (processContext: string, history: Content[] = []): Chat => {
    const client = getAiClient();
    const systemInstruction = getSystemInstruction(processContext);

    const chat = client.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: systemInstruction,
            tools: [{ googleSearch: {} }],
        },
        history: history,
    });

    return chat;
};

const moduleSchema = {
    type: Type.OBJECT,
    properties: {
        slug: {
            type: Type.STRING,
            description: "A URL-friendly slug for the module, based on the title (e.g., 'how-to-make-sandwich')."
        },
        title: {
            type: Type.STRING,
            description: "A concise, descriptive title for the overall process."
        },
        steps: {
            type: Type.ARRAY,
            description: "A list of the sequential steps in the process.",
            items: {
                type: Type.OBJECT,
                properties: {
                    title: {
                        type: Type.STRING,
                        description: "A short, action-oriented title for the step (e.g., 'Toast the Bread')."
                    },
                    description: {
                        type: Type.STRING,
                        description: "A detailed explanation of how to perform this step."
                    }
                },
                required: ["title", "description"]
            }
        }
    },
    required: ["slug", "title", "steps"]
};

export const createModuleFromText = async (processText: string) => {
    const client = getAiClient();
    const systemInstruction = `You are an expert instructional designer. Your task is to analyze the provided text describing a process and convert it into a structured training module. Create a main title for the module and break the process down into logical, sequential steps. For each step, create a short, action-oriented title and a clear description. Ensure the final output is a valid JSON object adhering to the provided schema.`;

    try {
        const result = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: processText,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: moduleSchema,
            },
        });

        const jsonText = result.text?.trim();
        if (!jsonText) {
            throw new Error("The AI returned an empty response.");
        }
        const generatedData = JSON.parse(jsonText);

        // Initialize the module with default values for fields not generated by the AI
        return {
            ...generatedData,
            videoUrl: '',
            steps: generatedData.steps.map((step: any) => ({
                ...step,
                start: 0,
                end: 0,
                checkpoint: null,
                alternativeMethods: [],
            })),
            transcript: []
        };

    } catch (error) {
        console.error("Error generating module with Gemini:", error);
        if (error instanceof SyntaxError) {
            throw new Error("Failed to generate module. The AI returned invalid JSON. Please try again.");
        }
        throw new Error("Failed to generate training module. The AI couldn't understand the process. Please try rewriting it.");
    }
};

export const analyzeVideoContent = async (
    videoFile: File,
    steps: ProcessStep[]
): Promise<VideoAnalysisResult> => {
    const client = getAiClient();
    let fileResource: any; // Using `any` to handle potential SDK response inconsistencies

    const systemInstruction = `You are a precise video analysis AI. Your task is to perform two actions on the provided video:
1.  Identify the start and end times (in seconds) for each of a given list of process steps.
2.  Transcribe the entire audio from the video, creating a list of timestamped text lines.
Respond ONLY with a single JSON object that strictly adheres to the provided schema, containing both 'timestamps' and 'transcript' arrays.`;

    const stepDescriptions = steps.map((step, index) => `${index + 1}. ${step.title}: ${step.description}`).join('\n');
    const prompt = `Please analyze this video. First, provide the start and end timestamps for these steps:\n\n${stepDescriptions}\n\nSecond, provide a full transcript of the video's audio.`;

    const analysisSchema = {
        type: Type.OBJECT,
        properties: {
            timestamps: {
                type: Type.ARRAY,
                description: "An array of timestamp objects, one for each process step.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        start: { type: Type.NUMBER, description: "The start time of the step in seconds, rounded to the nearest integer." },
                        end: { type: Type.NUMBER, description: "The end time of the step in seconds, rounded to the nearest integer." },
                    },
                    required: ["start", "end"],
                },
            },
            transcript: {
                type: Type.ARRAY,
                description: "A complete, time-coded transcript of the video's audio.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        start: { type: Type.NUMBER, description: "The start time of the transcript line in seconds." },
                        end: { type: Type.NUMBER, description: "The end time of the transcript line in seconds." },
                        text: { type: Type.STRING, description: "The transcribed text for this time segment." },
                    },
                    required: ["start", "end", "text"],
                }
            }
        },
        required: ["timestamps", "transcript"]
    };

    try {
        const uploadResponse = await client.files.upload({
            file: videoFile,
        });

        // The SDK is expected to return { file: ... }, but compiler errors suggest it might return the file object directly.
        // This handles both cases by checking for the presence of the `file` property.
        fileResource = (uploadResponse as any).file ?? uploadResponse;

        const videoPart = { fileData: { mimeType: fileResource.mimeType, fileUri: fileResource.uri } };
        const textPart = { text: prompt };

        const result = await client.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: [textPart, videoPart] },
            config: { systemInstruction, responseMimeType: "application/json", responseSchema: analysisSchema },
        });

        const jsonText = result.text?.trim();
        if (!jsonText) {
            throw new Error("The AI returned an empty response from video analysis.");
        }

        const analysisResult: VideoAnalysisResult = JSON.parse(jsonText);

        // More robust validation of the AI's response
        if (!analysisResult || !Array.isArray(analysisResult.timestamps) || !Array.isArray(analysisResult.transcript)) {
            throw new Error("AI response is missing 'timestamps' or 'transcript' arrays.");
        }
        if (analysisResult.timestamps.length !== steps.length) {
            throw new Error(`AI returned an incorrect number of timestamps. Expected ${steps.length}, but got ${analysisResult.timestamps.length}.`);
        }

        return analysisResult;

    } catch (error) {
        console.error("Error analyzing video:", error);
        const baseMessage = "Failed to analyze video.";
        if (error instanceof SyntaxError) {
            throw new Error(`${baseMessage} The AI returned invalid JSON.`);
        }
        // Pass along more specific error messages from previous throws
        throw new Error(`${baseMessage} ${error instanceof Error ? error.message : ''}`);
    } finally {
        // Ensure uploaded file is cleaned up even if analysis fails
        if (fileResource?.name) {
            try {
                await client.files.delete({ name: fileResource.name });
            } catch (deleteError) {
                // Log cleanup error, but don't throw, as the primary error is more important.
                console.error("Failed to clean up uploaded file:", deleteError);
            }
        }
    }
};