import { supabase } from '@/services/apiClient';
import type { Database } from '@/types/supabase';

type CheckpointResponseInsert = Database['public']['Tables']['checkpoint_responses']['Insert'];
type CheckpointResponseRow = Database['public']['Tables']['checkpoint_responses']['Row'];
type CsvExportRow = Pick<CheckpointResponseRow, 'step_index' | 'checkpoint_text' | 'answer' | 'comment' | 'created_at'>;


/**
 * Logs a user's response to a checkpoint question to the database.
 * This is a fire-and-forget operation from the UI's perspective.
 * @param response The checkpoint response data to insert.
 */
export async function logCheckpointResponse(response: CheckpointResponseInsert): Promise<void> {
    const { error } = await supabase.from('checkpoint_responses').insert(response);

    if (error) {
        console.error('Failed to log checkpoint response:', error);
        // We re-throw the error so the calling function can catch it and decide
        // whether to notify the user, but it won't block the primary UI flow.
        throw error;
    }
}

/**
 * Fetches all checkpoint responses for a given module.
 * @param moduleId The slug of the module.
 * @returns A promise that resolves to an array of checkpoint response rows.
 */
export async function getCheckpointResponsesForModule(moduleId: string): Promise<CheckpointResponseRow[]> {
    const { data, error } = await supabase
        .from('checkpoint_responses')
        .select('*')
        .eq('module_id', moduleId);

    if (error) {
        console.error('Failed to fetch checkpoint responses:', error);
        throw error;
    }

    return data || [];
}


/**
 * Fetches "No" responses for a module and aggregates them to find the most-missed checkpoints.
 * @param moduleId The slug of the module.
 * @returns A promise that resolves to an array of aggregated failure statistics.
 */
export async function getCheckpointFailureStats(moduleId: string): Promise<{ step_index: number; checkpoint_text: string; count: number }[]> {
    const { data: rawNoResponses, error } = await supabase
        .from('checkpoint_responses')
        .select('step_index, checkpoint_text')
        .eq('module_id', moduleId)
        .eq('answer', 'No');

    if (error) {
        console.error('Error fetching raw "no" responses for stats:', error);
        return [];
    }
    if (!rawNoResponses) return [];

    const statsMap = new Map<string, { step_index: number; checkpoint_text: string; count: number }>();

    for (const response of rawNoResponses) {
        if (!response.checkpoint_text) continue;

        const key = `${response.step_index}-${response.checkpoint_text}`;
        if (statsMap.has(key)) {
            statsMap.get(key)!.count++;
        } else {
            statsMap.set(key, { step_index: response.step_index, checkpoint_text: response.checkpoint_text, count: 1 });
        }
    }

    return Array.from(statsMap.values()).sort((a, b) => b.count - a.count);
}

const convertToCsv = (data: CsvExportRow[]): string => {
    if (data.length === 0) return '';
    const headers = ['Step', 'Checkpoint', 'Answer', 'Comment', 'Timestamp'];
    const rows = data.map(row => [
        row.step_index + 1,
        `"${(row.checkpoint_text || '').replace(/"/g, '""')}"`,
        row.answer,
        `"${(row.comment || '').replace(/"/g, '""')}"`,
        new Date(row.created_at).toLocaleString()
    ]);

    return [headers, ...rows]
        .map(r => r.join(','))
        .join('\n');
}

/**
 * Fetches raw "No" responses for a module, intended for CSV export.
 * @param moduleId The slug of the module.
 * @returns A promise that resolves to an array of raw checkpoint response rows.
 */
export async function getCheckpointFailuresRaw(moduleId: string): Promise<CsvExportRow[]> {
    const { data, error } = await supabase
        .from('checkpoint_responses')
        .select('step_index, checkpoint_text, answer, comment, created_at')
        .eq('module_id', moduleId)
        .eq('answer', 'No')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching checkpoint raw responses:', error);
        return [];
    }

    return data || [];
}

export const sendCheckpointFailuresToSlack = async (moduleId: string, moduleTitle: string): Promise<void> => {
    const slackWebhookUrl = import.meta.env.VITE_SLACK_WEBHOOK_URL;
    if (!slackWebhookUrl) {
        throw new Error("Slack webhook URL is not configured. Please set VITE_SLACK_WEBHOOK_URL in your environment.");
    }

    const rawData = await getCheckpointFailuresRaw(moduleId);
    if (rawData.length === 0) {
        throw new Error("No checkpoint failures to export.");
    }
    const csvText = convertToCsv(rawData);
    const filename = `failures-${moduleId}-${Date.now()}.csv`;

    const { error: uploadError } = await supabase.storage
        .from('exports')
        .upload(`checkpoints/${filename}`, csvText, {
            contentType: 'text/csv',
            upsert: true,
        });

    if (uploadError) {
        console.error('Upload failed:', uploadError);
        throw new Error(`Failed to upload report to storage: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
        .from('exports')
        .getPublicUrl(`checkpoints/${filename}`);

    if (!publicUrl) {
        throw new Error("Could not get public URL for the uploaded report.");
    }

    const response = await fetch(slackWebhookUrl, {
        method: 'POST',
        body: JSON.stringify({
            text: `📥 New checkpoint failure export for *${moduleTitle}*\nDownload the CSV report here: ${publicUrl}`
        }),
        headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
        throw new Error(`Failed to send notification to Slack. Status: ${response.status}`);
    }
}