
import { GoogleGenAI, Chat, Content, Type, File } from "@google/genai";
import type { ProcessStep, VideoAnalysisResult, ChatMessage, RefinementSuggestion, CheckpointEvaluation } from "@/types";

// --- AI Client Initialization ---

// The client is cached to avoid re-initialization on every call.
let cachedClient: GoogleGenAI | null = null;

/**
 * Lazily initializes and returns the GoogleGenAI client instance.
 * It uses the API key from the execution environment.
 * 
 * @throws {Error} If no API key is found in the environment.
 * @returns {GoogleGenAI} The initialized Gemini AI client.
 */
function getAiClient(): GoogleGenAI {
    if (cachedClient) {
        return cachedClient;
    }

    // Per the coding guidelines, the API key MUST be obtained from `process.env.API_KEY`.
    // The execution environment is expected to provide this variable.
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
        throw new Error(
            "AI features are unavailable. The required API key is missing from the environment."
        );
    }

    // Create and cache the new client.
    cachedClient = new GoogleGenAI({ apiKey });
    return cachedClient;
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

/**
 * Simulates a call to a fallback provider (e.g., GPT) if the primary one fails.
 * For now, it uses a non-streaming Gemini call to demonstrate the mechanism.
 * @param prompt The user's latest prompt.
 * @param history The existing chat history to provide context.
 * @param processContext The process steps to include in the system instruction.
 * @returns The text of the fallback response.
 */
export const getFallbackResponse = async (prompt: string, history: ChatMessage[], processContext: string): Promise<string> => {
    console.log("Attempting fallback AI provider...");
    const client = getAiClient();
    const systemInstruction = getSystemInstruction(processContext);

    // Convert ChatMessage[] to Content[]
    const geminiHistory: Content[] = history.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
    }));

    // Add the current prompt to the history for the one-off call
    const contents = [...geminiHistory, { role: 'user', parts: [{ text: prompt }] }];

    try {
        const result = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents,
            config: { systemInstruction },
        });
        const text = result.text;
        if (!text) {
            throw new Error("Fallback AI provider returned an empty response.");
        }
        return text;
    } catch (error) {
        console.error("Fallback AI provider also failed:", error);
        throw new Error("Sorry, the AI tutor is currently unavailable. Please try again later.");
    }
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
                    },
                    checkpoint: {
                        type: Type.STRING,
                        description: "A question to verify the trainee's understanding of this step. Should be null if not applicable."
                    },
                    alternativeMethods: {
                        type: Type.ARRAY,
                        description: "Optional alternative ways to perform the step, like an expert tip or shortcut. Should be an empty array if not applicable.",
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                title: { type: Type.STRING },
                                description: { type: Type.STRING }
                            },
                            required: ["title", "description"]
                        }
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
    const systemInstruction = `You are an expert instructional designer. Your task is to analyze the provided text describing a process and convert it into a structured training module. Create a main title for the module and break the process down into logical, sequential steps. For each step, create a short, action-oriented title and a clear description. Where appropriate, also generate a 'checkpoint' question to test understanding, and any 'alternativeMethods' that might be relevant (like a pro-tip or shortcut). Ensure the final output is a valid JSON object adhering to the provided schema.`;

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
                checkpoint: step.checkpoint || null,
                alternativeMethods: step.alternativeMethods || [],
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

export const evaluateCheckpointAnswer = async (step: ProcessStep, userAnswer: string): Promise<CheckpointEvaluation> => {
    const client = getAiClient();
    const systemInstruction = `You are a helpful and strict training evaluator. Your task is to determine if a user's answer to a checkpoint question is correct based ONLY on the provided step description. You must respond in JSON format.`;

    const prompt = `
        **Process Step Description (Source of Truth):**
        "${step.description}"

        **Checkpoint Question:**
        "${step.checkpoint}"

        **User's Answer:**
        "${userAnswer}"

        **Your Task:**
        Evaluate if the user's answer is correct based on the description.
        - If the answer is definitively correct, set isCorrect to true and provide brief, positive feedback.
        - If the answer is incorrect, or if the description doesn't contain enough information to judge, set isCorrect to false and provide a gentle, helpful correction that guides the user to the right answer using the description.
    `;

    const evaluationSchema = {
        type: Type.OBJECT,
        properties: {
            isCorrect: {
                type: Type.BOOLEAN,
                description: "True if the user's answer is correct, otherwise false.",
            },
            feedback: {
                type: Type.STRING,
                description: "A brief, helpful feedback message for the user.",
            },
        },
        required: ["isCorrect", "feedback"],
    };

    try {
        const result = await client.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: evaluationSchema,
            },
        });

        const jsonText = result.text?.trim();
        if (!jsonText) {
            throw new Error("AI evaluation returned an empty response.");
        }

        return JSON.parse(jsonText) as CheckpointEvaluation;

    } catch (error) {
        console.error("Error evaluating checkpoint:", error);
        if (error instanceof SyntaxError) {
            throw new Error("The AI returned an invalid response. Please try again.");
        }
        throw new Error("An error occurred during checkpoint evaluation.");
    }
};

const pollFileState = async (file: File, client: GoogleGenAI): Promise<void> => {
    const MAX_POLLS = 15;
    const POLL_INTERVAL_MS = 2000;

    let pollCount = 0;
    while (pollCount < MAX_POLLS) {
        if (file.state === 'ACTIVE') {
            return;
        }
        if (file.state === 'FAILED') {
            throw new Error(`Video processing failed. State: ${file.state}. Error: ${file.error?.message}`);
        }
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        // Re-fetch the file to get the updated state
        try {
            file = await client.files.get({ name: file.name });
        } catch (e) {
            throw new Error(`Could not check video processing status: ${(e as Error).message}`);
        }
        pollCount++;
    }

    throw new Error('Video processing timed out after 30 seconds.');
};

export const analyzeVideoContent = async (
    videoFile: globalThis.File,
    steps: ProcessStep[]
): Promise<VideoAnalysisResult> => {
    const client = getAiClient();

    console.log("Uploading video to AI for analysis...");
    const uploadedFile = await client.files.upload({
        file: videoFile,
        displayName: videoFile.name,
    });

    try {
        console.log("Polling for active video state...");
        await pollFileState(uploadedFile, client);
        console.log("Video is active. Starting parallel analysis.");

        const videoFilePart = {
            fileData: {
                mimeType: uploadedFile.mimeType,
                fileUri: uploadedFile.uri,
            },
        };

        const timestampsPrompt = `
            You are a timestamp extraction engine. Given the following process steps, find the exact start and end time (in seconds) where each step begins/ends in the video. Do NOT transcribe text—only return timings.
            The number of objects in your response MUST match the number of steps provided.

            Steps:
            ${steps.map((s, i) => `${i + 1}. ${s.title}`).join('\n')}

            Output a valid JSON array of objects, where each object has "start" and "end" keys.
        `;

        const transcriptPrompt = `
            You are a highly accurate transcription assistant. Transcribe this video verbatim but remove all filler words such as 'um', 'ah', 'like', and 'you know'. Do not summarize or paraphrase. Output a JSON array of { start:number, end:number, text:string } where start and end are in seconds.
        `;

        const timestampSchema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    start: { type: Type.NUMBER },
                    end: { type: Type.NUMBER },
                },
                required: ["start", "end"]
            }
        };

        const transcriptSchema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    start: { type: Type.NUMBER, description: "Start time of the line in seconds." },
                    end: { type: Type.NUMBER, description: "End time of the line in seconds." },
                    text: { type: Type.STRING, description: "The transcribed text for this segment." },
                },
                required: ["start", "end", "text"]
            }
        };

        const timestampPromise = client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: timestampsPrompt }, videoFilePart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: timestampSchema
            }
        });

        const transcriptPromise = client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: transcriptPrompt }, videoFilePart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: transcriptSchema
            }
        });

        const [timestampResponse, transcriptResponse] = await Promise.all([timestampPromise, transcriptPromise]);

        console.log("Analysis calls completed.");

        const timestamps = JSON.parse(timestampResponse.text);
        const transcript = JSON.parse(transcriptResponse.text);

        if (!timestamps || !transcript) {
            throw new Error("AI analysis returned incomplete data.");
        }

        if (timestamps.length !== steps.length) {
            console.warn(`Timestamp count (${timestamps.length}) does not match step count (${steps.length}). This may cause issues.`);
        }

        return { timestamps, transcript };

    } catch (error) {
        console.error("Error during video content analysis:", error);
        throw error;
    } finally {
        console.log("Cleaning up uploaded video file...");
        await client.files.delete({ name: uploadedFile.name });
    }
};

export const generateImage = async (prompt: string): Promise<string> => {
    const client = getAiClient();
    try {
        const response = await client.models.generateImages({
            model: 'imagen-3.0-generate-002',
            prompt: `A clean, simple, minimalist, black-and-white technical line drawing of: ${prompt}. The diagram should be on a plain white background.`,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/png',
                aspectRatio: '1:1',
            },
        });

        if (!response.generatedImages || response.generatedImages.length === 0) {
            throw new Error("The AI did not return an image.");
        }
        const base64ImageBytes = response.generatedImages[0].image.imageBytes;
        return `data:image/png;base64,${base64ImageBytes}`;
    } catch (error) {
        console.error("Error generating image:", error);
        throw new Error("Failed to generate the image. The model may be unavailable or the prompt was blocked.");
    }
}


export const generateRefinementSuggestion = async (
    step: ProcessStep,
    questions: string[]
): Promise<RefinementSuggestion> => {
    const client = getAiClient();
    const systemInstruction = `You are an expert instructional designer tasked with improving a training module.
    You will be given a step from the module and a list of questions that real trainees have asked about it.
    Your job is to rewrite the step's description to be clearer and to proactively answer the questions.
    If appropriate, also suggest a new 'alternative method' (like a pro-tip or shortcut).
    You MUST respond in valid JSON format.`;

    const prompt = `
        **Current Step Title:**
        "${step.title}"

        **Current Step Description:**
        "${step.description}"

        **Current Alternative Methods:**
        ${JSON.stringify(step.alternativeMethods)}

        **Trainee Questions (Points of Confusion):**
        - ${questions.join('\n- ')}

        **Your Task:**
        1.  **Rewrite the description:** Create a 'newDescription' that is much clearer and directly addresses the trainee questions.
        2.  **Suggest a new alternative method (optional):** If you can think of a good shortcut or pro-tip related to the questions, create a 'newAlternativeMethod' object with a title and description. If not, this should be null.
    `;

    const refinementSchema = {
        type: Type.OBJECT,
        properties: {
            newDescription: {
                type: Type.STRING,
                description: "The improved, clearer description for the process step.",
            },
            newAlternativeMethod: {
                type: Type.OBJECT,
                nullable: true,
                properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING }
                },
                required: ["title", "description"],
                description: "A new pro-tip or shortcut to add, or null if not applicable."
            }
        },
        required: ["newDescription", "newAlternativeMethod"],
    };

    try {
        const result = await client.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema: refinementSchema,
            },
        });
        const jsonText = result.text?.trim();
        if (!jsonText) throw new Error("AI returned empty refinement suggestion.");
        return JSON.parse(jsonText);
    } catch (error) {
        console.error("Error generating refinement suggestion:", error);
        throw new Error("Failed to get AI refinement suggestion.");
    }
};

export const generatePerformanceSummary = async (
    moduleTitle: string,
    unclearSteps: ProcessStep[],
    userQuestions: string[]
): Promise<string> => {
    const client = getAiClient();
    const systemInstruction = "You are a friendly and encouraging AI coach. Your job is to provide positive, summarized feedback to a trainee who has just completed a module. Speak directly to the trainee. Keep the feedback concise (2-3 sentences).";

    let prompt = `The trainee just completed the "${moduleTitle}" module.`;

    if (unclearSteps.length === 0 && userQuestions.length === 0) {
        prompt += " They completed it without any issues or questions. Provide a brief, positive, congratulatory message."
    } else {
        prompt += " Here is a summary of the areas where they seemed to have some trouble. Based on this, provide a constructive and encouraging feedback message."
        if (unclearSteps.length > 0) {
            prompt += `\n- They marked the following steps as unclear: ${unclearSteps.map(s => `"${s.title}"`).join(', ')}.`;
        }
        if (userQuestions.length > 0) {
            prompt += `\n- They asked the following questions: ${userQuestions.map(q => `"${q}"`).join(', ')}.`;
        }
    }

    try {
        const result = await client.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { systemInstruction },
        });
        return result.text || "Great job completing the training!";
    } catch (error) {
        console.error("Error generating performance summary:", error);
        return "Congratulations on completing the training module!"; // Fallback
    }
};
