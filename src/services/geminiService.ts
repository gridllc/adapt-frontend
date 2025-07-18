
import { GoogleGenAI, Chat, Content, Type, GenerateContentResponse, Part } from "@google/genai";
import type { ProcessStep, ChatMessage, RefinementSuggestion, CheckpointEvaluation, TranscriptLine, GeneratedBranchModule } from "@/types";

// --- Custom Return Types for Decoupling ---

export interface GeneratedModuleData {
    slug: string;
    title: string;
    steps: ProcessStep[];
    transcript?: TranscriptLine[];
}

export interface TranscriptAnalysis {
    transcript: TranscriptLine[];
    confidence: number;
    uncertainWords: string[];
}


// --- AI Client Initialization ---

let cachedClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
    if (cachedClient) {
        return cachedClient;
    }
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        throw new Error("AI features are unavailable. The required API key is missing from the environment.");
    }
    cachedClient = new GoogleGenAI({ apiKey });
    return cachedClient;
}

// --- Schemas for AI Response Validation ---

const transcriptWithConfidenceSchema = {
    type: Type.OBJECT,
    properties: {
        overallConfidence: {
            type: Type.NUMBER,
            description: "A score from 0.0 to 1.0 representing your confidence in the transcription's accuracy based on audio clarity. 1.0 is perfect, 0.0 is unintelligible."
        },
        uncertainWords: {
            type: Type.ARRAY,
            description: "An array of specific words or short phrases from the transcript that you are uncertain about due to mumbling, background noise, or ambiguity.",
            items: { type: Type.STRING }
        },
        transcript: {
            type: Type.ARRAY,
            description: "A full, line-by-line transcript of the video.",
            items: {
                type: Type.OBJECT,
                properties: {
                    start: { type: Type.NUMBER, description: "Start time of the speech segment in seconds." },
                    end: { type: Type.NUMBER, description: "End time of the speech segment in seconds." },
                    text: { type: Type.STRING, description: "The transcribed text for this segment, with filler words like 'um' or 'uh' removed." },
                },
                required: ["start", "end", "text"]
            }
        }
    },
    required: ["overallConfidence", "uncertainWords", "transcript"]
};

const moduleFromTextSchema = {
    type: Type.OBJECT,
    properties: {
        slug: { type: Type.STRING, description: "A URL-friendly slug for the module, based on the title (e.g., 'how-to-boil-water')." },
        title: { type: Type.STRING, description: "A concise, descriptive title for the overall process." },
        steps: {
            type: Type.ARRAY,
            description: "A list of the sequential steps in the process.",
            items: {
                type: Type.OBJECT,
                properties: {
                    start: { type: Type.NUMBER, description: "The start time of this step in seconds. Set to 0 as a placeholder." },
                    end: { type: Type.NUMBER, description: "The end time of this step in seconds. Set to 0 as a placeholder." },
                    title: { type: Type.STRING, description: "A short, action-oriented title for the step (e.g., 'Toast the Bread')." },
                    description: { type: Type.STRING, description: "A detailed explanation of how to perform this step." },
                    checkpoint: { type: Type.STRING, nullable: true, description: "A question to verify the trainee's understanding of this step. Should be null if not applicable." },
                    alternativeMethods: {
                        type: Type.ARRAY,
                        description: "Optional alternative ways to perform the step. Should be an empty array if not applicable.",
                        items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, description: { type: Type.STRING } }, required: ["title", "description"] }
                    }
                },
                required: ["start", "end", "title", "description", "checkpoint", "alternativeMethods"]
            }
        },
    },
    required: ["slug", "title", "steps"]
};

// --- Internal File Handling Helper ---
async function fileToGenerativePart(file: File): Promise<Part> {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
    });
    return {
        inlineData: {
            data: await base64EncodedDataPromise,
            mimeType: file.type,
        },
    };
}

// --- Module Creation Services ---

export const getTranscriptWithConfidence = async (videoFile: File): Promise<TranscriptAnalysis> => {
    if (import.meta.env.DEV) console.time('[AI Perf] getTranscriptWithConfidence');

    const ai = getAiClient();
    console.log("[AI Service] Generating transcript with confidence from video...");
    const videoFilePart = await fileToGenerativePart(videoFile);
    const prompt = `You are an expert transcriber with a confidence scoring system. Analyze this video and return a JSON object containing:
1.  'transcript': A full, clean, line-by-line transcript.
2.  'overallConfidence': A score from 0.0 to 1.0 indicating how clear the audio was and how confident you are in the transcription.
3.  'uncertainWords': An array of words or short phrases you were unsure about due to mumbling, background noise, or ambiguity.
The output MUST be a single, valid JSON object adhering to the provided schema.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: prompt }, videoFilePart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: transcriptWithConfidenceSchema,
            },
        });
        const jsonText = response.text?.trim();
        if (!jsonText) {
            console.warn("[AI Service] Transcript generation returned empty response. This may be normal for silent videos.");
            return { transcript: [], confidence: 0, uncertainWords: [] };
        }
        console.log("[AI Service] Parsing generated transcript...");
        const parsed = JSON.parse(jsonText);
        return {
            transcript: parsed.transcript || [],
            confidence: parsed.overallConfidence ?? 0.5,
            uncertainWords: parsed.uncertainWords || []
        };
    } catch (error) {
        console.error("[AI Service] Error generating transcript:", error);
        if (error instanceof SyntaxError) throw new Error("The AI returned invalid JSON for the transcript.");
        throw error;
    } finally {
        if (import.meta.env.DEV) console.timeEnd('[AI Perf] getTranscriptWithConfidence');
    }
};

export const generateModuleFromContext = async (context: {
    title: string;
    transcript: string;
    notes?: string;
    confidence: number;
}): Promise<GeneratedModuleData> => {
    if (import.meta.env.DEV) console.time('[AI Perf] generateModuleFromContext');

    const ai = getAiClient();
    console.log("[AI Service] Generating module from context...");

    const prompt = `Analyze the provided transcript and context to generate a structured training module.
    
    **Process Title:** ${context.title}
    **Transcript:**
    ${context.transcript}
    
    **Additional Notes:** ${context.notes || "No additional notes provided."}
    
    Based on this, create a JSON object with:
    - A URL-friendly 'slug'.
    - A concise 'title'.
    - An array of 'steps', where each step has a 'title', a detailed 'description', an optional 'checkpoint' question, and optional 'alternativeMethods'.
    - Set 'start' and 'end' times for steps to 0 as placeholders.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: moduleFromTextSchema,
            },
        });

        const jsonText = response.text?.trim();
        if (!jsonText) {
            console.error("[AI Service] AI response for module generation was empty.");
            throw new Error("The AI returned an empty response. The input text may have been too short or unclear.");
        }

        console.log("[AI Service] Parsing generated JSON from text...");
        return JSON.parse(jsonText) as GeneratedModuleData;

    } catch (error) {
        console.error("[AI Service] Error generating module from context:", error);
        if (error instanceof SyntaxError) {
            throw new Error("The AI returned invalid JSON. Please check the model or prompt.");
        }
        throw error;
    } finally {
        if (import.meta.env.DEV) console.timeEnd('[AI Perf] generateModuleFromContext');
    }
};

// --- Chat & Tutoring Services ---

function getChatTutorSystemInstruction(stepsContext: string, fullTranscript?: string): string {
    const transcriptSection = fullTranscript?.trim()
        ? `--- FULL VIDEO TRANSCRIPT (For additional context) ---\n${fullTranscript}\n--- END FULL VIDEO TRANSCRIPT ---`
        : "A video transcript was not available for this module.";

    return `You are the Adapt AI Tutor, an expert teaching assistant. Your single most important goal is to teach a trainee the specific process designed by their company's owner.

Your instructions are provided in the 'PROCESS STEPS' document below. This is your primary source of truth.

A 'FULL VIDEO TRANSCRIPT' may also be provided for additional context.

**Your Core Directives:**
1.  **Prioritize Process Steps:** Always base your answers on the 'PROCESS STEPS'. When asked a question (e.g., "what's next?"), find the relevant step and explain it using only the owner's instructions from that document.
2.  **Use Transcript for Context:** Use the 'FULL VIDEO TRANSCRIPT' only to answer questions about something the speaker said that isn't in the step descriptions.
3.  **Handle Out-of-Scope Questions:** If a question cannot be answered from the provided materials, you may use Google Search. You MUST first state: "That information isn't in this specific training, but here is what I found online:" before providing the answer.
4.  **Use Timestamps:** When referencing the transcript, include the relevant timestamp in your answer in the format [HH:MM:SS] or [MM:SS].
5.  **Suggest Improvements Correctly:** If a trainee's question implies they are looking for a better or faster way to do something, you may suggest a new method. You MUST format this suggestion clearly by wrapping it in special tags: [SUGGESTION]Your suggestion here.[/SUGGESTION]. Do not present suggestions as official process.

--- PROCESS STEPS (Source of Truth) ---
${stepsContext}
--- END PROCESS STEPS ---

${transcriptSection}
`;
}

export const startChat = (stepsContext: string, fullTranscript?: string, history: Content[] = []): Chat => {
    const ai = getAiClient();
    const systemInstruction = getChatTutorSystemInstruction(stepsContext, fullTranscript);
    return ai.chats.create({
        model: 'gemini-2.5-flash',
        config: { systemInstruction, tools: [{ googleSearch: {} }] },
        history,
    });
};

export async function sendMessageWithRetry(
    chat: Chat,
    prompt: string,
    retries: number = 2
): Promise<AsyncGenerator<GenerateContentResponse, void, unknown>> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await chat.sendMessageStream({ message: prompt });
        } catch (err) {
            console.warn(`[AI Service] sendMessageStream attempt ${attempt} failed.`, err);
            if (attempt === retries) {
                console.error("[AI Service] All retry attempts failed for sendMessageStream.");
                throw err;
            }
            await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        }
    }
    throw new Error("sendMessageWithRetry failed after all attempts.");
}

export const getFallbackResponse = async (prompt: string, history: ChatMessage[], stepsContext: string, fullTranscript: string): Promise<string> => {
    if (import.meta.env.DEV) console.time('[AI Perf] getFallbackResponse');
    console.log("[AI Service] Attempting fallback AI provider...");
    const ai = getAiClient();
    const systemInstruction = getChatTutorSystemInstruction(stepsContext, fullTranscript);
    const geminiHistory: Content[] = history.slice(-20).map(msg => ({ role: msg.role, parts: [{ text: msg.text }] }));
    const contents = [...geminiHistory, { role: 'user', parts: [{ text: prompt }] }];

    try {
        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents, config: { systemInstruction } });
        if (!response.text) throw new Error("Fallback AI provider returned an empty response.");
        return response.text;
    } catch (error) {
        console.error("[AI Service] Fallback AI provider also failed:", error);
        throw new Error("Sorry, the AI tutor is currently unavailable. Please try again later.");
    } finally {
        if (import.meta.env.DEV) console.timeEnd('[AI Perf] getFallbackResponse');
    }
};

export const generateImage = async (prompt: string): Promise<string> => {
    if (import.meta.env.DEV) console.time('[AI Perf] generateImage');
    const ai = getAiClient();
    try {
        const response = await ai.models.generateImages({
            model: 'imagen-3.0-generate-002',
            prompt: `A clean, simple, minimalist, black-and-white technical line drawing of: ${prompt}. The diagram should be on a plain white background.`,
            config: { numberOfImages: 1, outputMimeType: 'image/png', aspectRatio: '1:1' },
        });

        if (!response.generatedImages?.[0]?.image.imageBytes) throw new Error("The AI did not return an image.");
        return `data:image/png;base64,${response.generatedImages[0].image.imageBytes}`;
    } catch (error) {
        console.error("[AI Service] Error generating image:", error);
        throw new Error("Failed to generate the image. The model may be unavailable or the prompt was blocked.");
    } finally {
        if (import.meta.env.DEV) console.timeEnd('[AI Perf] generateImage');
    }
}

// --- Evaluation and Refinement Services ---

export const evaluateCheckpointAnswer = async (step: ProcessStep, userAnswer: string): Promise<CheckpointEvaluation> => {
    if (import.meta.env.DEV) console.time('[AI Perf] evaluateCheckpointAnswer');
    const ai = getAiClient();
    const systemInstruction = `You are a helpful and strict training evaluator. Your task is to determine if a user's answer to a checkpoint question is correct based ONLY on the provided step description. You must respond in JSON format.`;
    const prompt = `
        **Process Step Description (Source of Truth):** "${step.description}"
        **Checkpoint Question:** "${step.checkpoint}"
        **User's Answer:** "${userAnswer}"
        
        **Your Task:**
        1.  Evaluate if the user's answer is correct based on the step description. Set 'isCorrect' to true or false.
        2.  Provide brief 'feedback' explaining your decision.
        3.  **Crucially:** If the user's answer is technically wrong but their reasoning is logical because the original instruction was incomplete or ambiguous (e.g., the instruction was "Open the door" and the checkpoint was "Did you close it?"), you MUST provide a 'suggestedInstructionChange'. This new text should be the improved, clearer version of the instruction. If the instruction was fine, this field should be null.`;

    const evaluationSchema = {
        type: Type.OBJECT,
        properties: {
            isCorrect: { type: Type.BOOLEAN, description: "Whether the user's answer is correct based on the instructions." },
            feedback: { type: Type.STRING, description: "Gentle, helpful feedback for the user." },
            suggestedInstructionChange: {
                type: Type.STRING,
                nullable: true,
                description: "If the instruction was flawed, provide a revised, clearer instruction text here. Otherwise, this MUST be null."
            }
        },
        required: ["isCorrect", "feedback", "suggestedInstructionChange"],
    };

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { systemInstruction, responseMimeType: "application/json", responseSchema: evaluationSchema },
        });
        if (!response.text) throw new Error("AI evaluation returned an empty response.");
        return JSON.parse(response.text) as CheckpointEvaluation;
    } catch (error) {
        console.error("[AI Service] Error evaluating checkpoint:", error);
        throw new Error("An error occurred during checkpoint evaluation.");
    } finally {
        if (import.meta.env.DEV) console.timeEnd('[AI Perf] evaluateCheckpointAnswer');
    }
};

export const generateRefinementSuggestion = async (step: ProcessStep, questions: string[]): Promise<RefinementSuggestion> => {
    if (import.meta.env.DEV) console.time('[AI Perf] generateRefinementSuggestion');
    const ai = getAiClient();
    const systemInstruction = `You are an expert instructional designer tasked with improving a training module. You will be given a step and questions trainees have asked. Your job is to rewrite the step's description to be clearer and to proactively answer the questions. If appropriate, also suggest a new 'alternative method'. You MUST respond in valid JSON format.`;
    const prompt = `
        **Current Step Title:** "${step.title}"
        **Current Step Description:** "${step.description}"
        **Current Alternative Methods:** ${JSON.stringify(step.alternativeMethods)}
        **Trainee Questions (Points of Confusion):**\n- ${questions.join('\n- ')}
        **Your Task:**
        1.  **Rewrite the description:** Create a 'newDescription' that is much clearer and directly addresses the trainee questions.
        2.  **Suggest a new alternative method (optional):** If you can think of a good shortcut or pro-tip, create a 'newAlternativeMethod' object. If not, this should be null.`;

    const refinementSchema = {
        type: Type.OBJECT,
        properties: {
            newDescription: { type: Type.STRING },
            newAlternativeMethod: {
                type: Type.OBJECT, nullable: true,
                properties: { title: { type: Type.STRING }, description: { type: Type.STRING } },
                required: ["title", "description"],
            }
        },
        required: ["newDescription", "newAlternativeMethod"],
    };

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { systemInstruction, responseMimeType: "application/json", responseSchema: refinementSchema },
        });
        if (!response.text) throw new Error("AI returned empty refinement suggestion.");
        return JSON.parse(response.text);
    } catch (error) {
        console.error("[AI Service] Error generating refinement suggestion:", error);
        throw new Error("Failed to get AI refinement suggestion.");
    } finally {
        if (import.meta.env.DEV) console.timeEnd('[AI Perf] generateRefinementSuggestion');
    }
};

export const generatePerformanceSummary = async (moduleTitle: string, unclearSteps: ProcessStep[], userQuestions: string[]): Promise<{ summary: string }> => {
    if (import.meta.env.DEV) console.time('[AI Perf] generatePerformanceSummary');
    const ai = getAiClient();
    const systemInstruction = "You are a friendly and encouraging AI coach. Your job is to provide positive, summarized feedback to a trainee who has just completed a module. Speak directly to the trainee. Keep the feedback concise (2-3 sentences).";
    let prompt = `The trainee just completed the "${moduleTitle}" module.`;

    if (unclearSteps.length === 0 && userQuestions.length === 0) {
        prompt += " They completed it without any issues or questions. Provide a brief, positive, congratulatory message."
    } else {
        prompt += " Here is a summary of the areas where they seemed to have some trouble. Based on this, provide a constructive and encouraging feedback message."
        if (unclearSteps.length > 0) prompt += `\n- They marked these steps as unclear: ${unclearSteps.map(s => `"${s.title}"`).join(', ')}.`;
        if (userQuestions.length > 0) prompt += `\n- They asked these questions: ${userQuestions.map(q => `"${q}"`).join(', ')}.`;
    }

    const summarySchema = { type: Type.OBJECT, properties: { summary: { type: Type.STRING } }, required: ["summary"] };

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { systemInstruction, responseMimeType: "application/json", responseSchema: summarySchema },
        });
        if (!response.text) return { summary: "Great job completing the training!" };
        return JSON.parse(response.text);
    } catch (error) {
        console.error("[AI Service] Error generating performance summary:", error);
        return { summary: "Congratulations on completing the training module!" };
    } finally {
        if (import.meta.env.DEV) console.timeEnd('[AI Perf] generatePerformanceSummary');
    }
};

export const generateBranchModule = async (stepTitle: string, frequentQuestions: string[]): Promise<GeneratedBranchModule> => {
    if (import.meta.env.DEV) console.time('[AI Perf] generateBranchModule');
    const ai = getAiClient();
    const systemInstruction = "You are an expert instructional designer. Your task is to create a short, 2-3 step remedial training module to teach a specific concept more clearly. You MUST respond in the requested JSON format.";

    const prompt = `
        Trainees are struggling with this step:
        "${stepTitle}"

        They often ask:
        - ${frequentQuestions.join('\n- ')}

        Please create a short 2-3 step remedial training module to teach this concept more clearly.
        The title should be helpful and the steps should be simple, clear instructions.`;

    const branchModuleSchema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING, description: "A helpful title for the remedial submodule." },
            steps: {
                type: Type.ARRAY,
                description: "An array of 2-3 strings, where each string is a clear, simple instruction for a step.",
                items: { type: Type.STRING }
            }
        },
        required: ["title", "steps"],
    };

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: { systemInstruction, responseMimeType: "application/json", responseSchema: branchModuleSchema },
        });

        if (!response.text) {
            throw new Error("AI returned empty data for the branch module.");
        }

        return JSON.parse(response.text) as GeneratedBranchModule;

    } catch (error) {
        console.error("[AI Service] Error generating branch module:", error);
        throw new Error("Failed to generate the remedial module from the AI.");
    } finally {
        if (import.meta.env.DEV) console.timeEnd('[AI Perf] generateBranchModule');
    }
};

export const generateEmbedding = async (text: string): Promise<number[]> => {
    if (import.meta.env.DEV) console.time('[AI Perf] generateEmbedding');
    const ai = getAiClient();
    try {
        const response = await ai.models.embedContent({
            model: "text-embedding-004",
            contents: text,
        });
        return response.embeddings[0].values;
    } catch (error) {
        console.error("[AI Service] Error generating embedding:", error);
        throw new Error("Failed to generate text embedding for memory search.");
    } finally {
        if (import.meta.env.DEV) console.timeEnd('[AI Perf] generateEmbedding');
    }
};
