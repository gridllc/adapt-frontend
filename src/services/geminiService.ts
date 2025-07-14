
import { GoogleGenAI, Chat, Content, Type } from "@google/genai";
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
            throw new Error("Checkpoint evaluation AI returned an empty response.");
        }
        return JSON.parse(jsonText);

    } catch (error) {
        console.error("Error evaluating checkpoint:", error);
        throw new Error(`Failed to get feedback from AI. ${error instanceof Error ? error.message : ''}`);
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
        // Step 1: Upload the file
        const uploadResponse = await client.files.upload({
            file: videoFile,
        });

        fileResource = (uploadResponse as any).file ?? uploadResponse;

        // Step 2: Poll for ACTIVE state, as file needs to be processed before use.
        let activeFile = await client.files.get({ name: fileResource.name });
        const maxAttempts = 15; // Wait for up to 30 seconds
        const delay = 2000; // 2-second delay between checks
        let attempts = 0;

        while (activeFile.state === 'PROCESSING' && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, delay));
            activeFile = await client.files.get({ name: fileResource.name });
            attempts++;
        }

        if (activeFile.state !== 'ACTIVE') {
            // Attempt to delete the failed/stuck file before throwing
            try {
                await client.files.delete({ name: fileResource.name });
            } catch (deleteError) {
                console.error("Could not clean up non-active file:", deleteError);
            }
            throw new Error(`File processing failed or timed out. Final state: ${activeFile.state}`);
        }

        // Keep the name for the finally block cleanup
        fileResource.name = activeFile.name;

        // Step 3: Use the active file in the generateContent call
        const videoPart = { fileData: { mimeType: activeFile.mimeType, fileUri: activeFile.uri } };
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

export const generateRefinementSuggestion = async (
    step: ProcessStep,
    questions: string[]
): Promise<RefinementSuggestion> => {
    const client = getAiClient();
    const systemInstruction = `You are an expert instructional designer. Your task is to improve a confusing step in a training manual. You will be given the current step's text and a list of questions that trainees frequently ask about it. Your goal is to rewrite the step's description to be clearer and to proactively answer those questions. You may also suggest a new "Alternative Method" if it helps address the common points of confusion.`;

    const prompt = `
        **Current Step Title:**
        "${step.title}"

        **Current Step Description:**
        "${step.description}"

        **Common Trainee Questions:**
        - ${questions.join('\n- ')}

        **Your Task:**
        Based on the questions, provide a JSON object with two properties:
        1.  \`newDescription\`: A rewritten, clearer version of the step description that addresses the trainee questions.
        2.  \`newAlternativeMethod\`: An object with 'title' and 'description' for a new method that could help, or \`null\` if no new method is needed.
    `;

    const refinementSchema = {
        type: Type.OBJECT,
        properties: {
            newDescription: {
                type: Type.STRING,
                description: "The revised, clearer description for the process step.",
            },
            newAlternativeMethod: {
                type: Type.OBJECT,
                nullable: true,
                description: "A new alternative method, or null.",
                properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                },
            },
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
        if (!jsonText) {
            throw new Error("Refinement AI returned an empty response.");
        }
        return JSON.parse(jsonText);

    } catch (error) {
        console.error("Error generating refinement suggestion:", error);
        throw new Error(`Failed to generate refinement suggestion. ${error instanceof Error ? error.message : ''}`);
    }
};

export const generatePerformanceSummary = async (
    moduleTitle: string,
    unclearSteps: ProcessStep[],
    userQuestions: string[]
): Promise<string> => {
    const client = getAiClient();
    const systemInstruction = `You are a friendly and encouraging training coach. Your task is to provide a brief, positive summary of a trainee's performance. The summary should be one paragraph long. Start by congratulating them. Then, if they had any areas of confusion, gently point them out and suggest they review those steps.`;

    let prompt = `The trainee has just completed the module: "${moduleTitle}".\n\n`;

    if (unclearSteps.length === 0 && userQuestions.length === 0) {
        prompt += "They completed it perfectly without any issues or questions. Write a short, congratulatory message."
    } else {
        if (unclearSteps.length > 0) {
            prompt += `They marked the following steps as "unclear":\n`
            prompt += unclearSteps.map(s => `- ${s.title}`).join('\n') + '\n\n';
        }
        if (userQuestions.length > 0) {
            prompt += `They asked the AI Tutor the following questions:\n`
            prompt += userQuestions.map(q => `- "${q}"`).join('\n') + '\n\n';
        }
        prompt += "Based on this, write the summary paragraph."
    }

    try {
        const result = await client.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                systemInstruction,
            },
        });
        const text = result.text;
        if (!text) {
            return "Congratulations on completing the training! Well done.";
        }
        return text;
    } catch (error) {
        console.error("Error generating performance summary:", error);
        // Return a graceful fallback message
        return "Congratulations on completing the training module! You've done a great job."
    }
};

export const generateImage = async (prompt: string): Promise<string> => {
    const client = getAiClient();
    try {
        const response = await client.models.generateImages({
            model: 'imagen-3.0-generate-002',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: '1:1',
            },
        });

        if (response.generatedImages && response.generatedImages.length > 0 && response.generatedImages[0].image?.imageBytes) {
            const base64ImageBytes = response.generatedImages[0].image.imageBytes;
            return `data:image/jpeg;base64,${base64ImageBytes}`;
        } else {
            throw new Error("Image generation succeeded but returned no image data.");
        }

    } catch (error) {
        console.error("Error generating image:", error);
        throw new Error(`Failed to generate visual aid. ${error instanceof Error ? error.message : ''}`);
    }
};
