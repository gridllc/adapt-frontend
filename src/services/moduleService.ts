




import { supabase } from '@/services/apiClient';
import type { Database } from '@/types/supabase';
import type { ProcessStep, TranscriptLine } from '@/types';

type ModuleRow = Database['public']['Tables']['modules']['Row'];
type ModuleInsert = Database['public']['Tables']['modules']['Insert'];
type ModuleWithStatsRow = Database['public']['Views']['modules_with_session_stats']['Row'];

export const getModule = async (slug: string): Promise<ModuleRow | undefined> => {
    if (!slug) return undefined;

    try {
        const { data, error } = await supabase
            .from('modules')
            .select('*')
            .eq('slug', slug)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        if (data) {
            return data;
        }

        // Fallback for static sub-modules used in live coaching
        const response = await fetch(`/modules/${slug}.json`);
        if (response.ok) {
            const staticModule = await response.json() as ModuleRow;
            return staticModule;
        }

        return undefined;

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "An unknown error occurred";
        console.error(`Error fetching module with slug "${slug}":`, message);
        throw new Error(message);
    }
};

export const getAvailableModules = async (): Promise<ModuleWithStatsRow[]> => {
    const { data, error } = await supabase
        .from('modules_with_session_stats')
        .select('*');

    if (error) {
        console.error("Error fetching modules with stats:", error);
        throw new Error(error.message);
    }

    if (!Array.isArray(data)) {
        console.error("Data fetched from 'modules_with_session_stats' is not an array:", data);
        return [];
    }

    return data;
};

export const saveModule = async ({
    moduleData,
    videoFile,
}: {
    moduleData: ModuleRow | ModuleInsert,
    videoFile?: File | null,
}): Promise<ModuleRow> => {
    // Validate transcript data before proceeding
    if (moduleData.transcript) {
        const invalidLines = (moduleData.transcript as TranscriptLine[]).filter(
            line => typeof line.text !== 'string' || line.text.trim() === '' || (typeof line.start === 'number' && typeof line.end === 'number' && line.start > line.end)
        );
        if (invalidLines.length > 0) {
            throw new Error(
                `Cannot save: ${invalidLines.length} transcript line(s) have missing text or invalid timestamps.`
            );
        }
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('User not authenticated. Cannot save module.');
    }

    let video_url = moduleData.video_url;

    // This is the critical logic: if a real file is passed, upload it and use its URL,
    // overriding any temporary blob: URL that might be in moduleData.
    if (videoFile) {
        const fileExt = videoFile.name.split('.').pop();
        const filePath = `${moduleData.slug}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('training-videos')
            .upload(filePath, videoFile, {
                cacheControl: '3600',
                upsert: true,
                resumable: true, // Enable chunked uploads for large files
            });

        if (uploadError) {
            console.error("Video upload failed:", uploadError);
            throw new Error(`Video upload failed: ${uploadError.message}`);
        }

        const { data } = supabase.storage.from('training-videos').getPublicUrl(filePath);
        video_url = data.publicUrl;
    }

    const dbData: ModuleInsert = {
        slug: moduleData.slug,
        title: moduleData.title,
        steps: moduleData.steps as ProcessStep[],
        transcript: moduleData.transcript as TranscriptLine[],
        video_url: video_url,
        metadata: moduleData.metadata,
        user_id: user.id,
    };

    // Use upsert to handle both creation of new modules and updating of existing ones.
    const { data: savedData, error } = await supabase
        .from('modules')
        .upsert(dbData, { onConflict: 'slug' })
        .select()
        .single();

    if (error) {
        console.error("Error saving module:", error);
        throw new Error(`Failed to save module: ${error.message}`);
    }

    if (!savedData) {
        throw new Error("Data returned after save is not a valid TrainingModule.");
    }

    return savedData;
};

export const deleteModule = async (slug: string): Promise<void> => {
    const { error: chatError } = await supabase
        .from('chat_messages')
        .delete()
        .eq('module_id', slug);
    if (chatError) throw new Error(`Failed to delete chat history: ${chatError.message}`);

    const { error: sessionError } = await supabase
        .from('training_sessions')
        .delete()
        .eq('module_id', slug);
    if (sessionError) throw new Error(`Failed to delete session data: ${sessionError.message}`);

    const { error: suggestionError } = await supabase
        .from('suggestions')
        .delete()
        .eq('module_id', slug);
    if (suggestionError) throw new Error(`Failed to delete suggestions: ${suggestionError.message}`);

    // Finally, delete the module itself. This will cascade and also delete associated videos in storage
    // if you set up the storage policies correctly (though that's an advanced step).
    const { error: moduleError } = await supabase
        .from('modules')
        .delete()
        .eq('slug', slug);
    if (moduleError) throw new Error(`Failed to delete the module: ${moduleError.message}`);
};
