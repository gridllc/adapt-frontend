// supabase/functions/generate-suggestions/index.ts
import { serve } from 'https://deno.land/std@0.192.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js';
import { generateStepSuggestion } from '@/services/suggestionLogic.ts'; // You must provide this helper

serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! // Full access required
  );

  const { data: fqRows, error } = await supabase
    .from('frequent_questions')
    .select('module_id, step_index')
    .order('occurrences', { ascending: false });

  if (error) {
    console.error('Failed to fetch frequent_questions:', error);
    return new Response(JSON.stringify({ success: false, error }), { status: 500 });
  }

  for (const row of fqRows) {
    const { data: stepData, error: stepError } = await supabase
      .from('modules')
      .select('steps')
      .eq('id', row.module_id)
      .single();

    if (stepError || !stepData?.steps?.[row.step_index]) continue;

    const step = stepData.steps[row.step_index];
    if (!step.instruction) continue;

    await generateStepSuggestion(row.module_id, row.step_index, step.instruction);
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  });
});
