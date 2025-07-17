import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenAI, Type } from 'https://esm.sh/@google/genai@0.14.1'
import { corsHeaders } from '../_shared/cors.ts'

// Minimal types needed for this function
interface AlternativeMethod {
  title: string;
  description: string;
}
interface ProcessStep {
  title: string;
  description: string;
  alternativeMethods: AlternativeMethod[];
}

// --- Gemini Generation Logic ---

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

async function generateRefinementSuggestion(step: ProcessStep, questions: string[]) {
  const apiKey = (globalThis as any).Deno.env.get("API_KEY");
  if (!apiKey) {
    throw new Error("Gemini API key is not available in function environment.");
  }
  const client = new GoogleGenAI({ apiKey });

  const systemInstruction = `You are an expert instructional designer tasked with improving a training module. You will be given a step and questions trainees have asked. Your job is to rewrite the step's description to be clearer and to proactively answer the questions. If appropriate, also suggest a new 'alternative method'. You MUST respond in valid JSON format.`;
  const prompt = `
        **Current Step Title:** "${step.title}"
        **Current Step Description:** "${step.description}"
        **Current Alternative Methods:** ${JSON.stringify(step.alternativeMethods)}
        **Trainee Questions (Points of Confusion):**\n- ${questions.join('\n- ')}
        
        **Your Task:**
        1.  **Rewrite the description:** Create a 'newDescription' that is much clearer and directly addresses the trainee questions.
        2.  **Suggest a new alternative method (optional):** If you can think of a good shortcut or pro-tip, create a 'newAlternativeMethod' object. If not, this should be null.`;

  const result = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: { systemInstruction, responseMimeType: "application/json", responseSchema: refinementSchema },
  });

  if (!result.text) throw new Error("AI returned empty refinement suggestion.");
  return JSON.parse(result.text);
}


// --- Edge Function Handler ---

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { moduleId, stepIndex } = await req.json()
    if (!moduleId || typeof stepIndex !== 'number') {
      throw new Error('moduleId and stepIndex are required.');
    }

    // Use the service role key for elevated access within the function
    const supabaseClient = createClient(
      (globalThis as any).Deno.env.get('SUPABASE_URL')!,
      (globalThis as any).Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Fetch module data to get the step content
    const { data: module, error: moduleError } = await supabaseClient
      .from('modules')
      .select('steps')
      .eq('slug', moduleId)
      .single();

    if (moduleError) throw moduleError;
    const step = (module.steps as ProcessStep[])?.[stepIndex];
    if (!step) throw new Error(`Step at index ${stepIndex} not found in module ${moduleId}.`);

    // 2. Fetch questions for the hotspot to provide context to the AI
    const { data: logs, error: logsError } = await supabaseClient
      .from('tutor_logs')
      .select('user_question')
      .eq('module_id', moduleId)
      .eq('step_index', stepIndex);

    if (logsError) throw logsError;

    const validQuestions = ((logs as { user_question: string | null }[]) || [])
      .map(log => log.user_question)
      .filter((q): q is string => typeof q === 'string' && q.trim().length > 0);

    const questions: string[] = [...new Set(validQuestions)];

    if (questions.length === 0) {
      return new Response(JSON.stringify({ suggestion: null, message: "No questions found for this step to generate a suggestion." }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // 3. Generate suggestion with Gemini
    const suggestion = await generateRefinementSuggestion(step, questions);

    // 4. Save the generated suggestion to the database
    const { error: saveError } = await supabaseClient.from('suggested_fixes').insert({
      module_id: moduleId,
      step_index: stepIndex,
      original_instruction: step.description,
      suggestion: suggestion.newDescription,
      source_questions: questions,
    });

    if (saveError) throw saveError;

    // 5. Return the successful suggestion to the client
    return new Response(JSON.stringify({ suggestion }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})