import type { TrainingModule } from '@/types';
import { supabase } from '@/services/apiClient';

const isTrainingModule = (data: any): data is TrainingModule => {
    return (
        typeof data === 'object' &&
        data !== null &&
        typeof data.slug === 'string' &&
        typeof data.title === 'string' &&
        (typeof data.videoUrl === 'string' || data.videoUrl === null) &&
        Array.isArray(data.steps)
    );
};

const mapToTrainingModule = (data: any): TrainingModule | null => {
    if (!data) return null;
    const module: TrainingModule = {
        slug: data.slug,
        title: data.title,
        videoUrl: data.video_url || '',
        steps: data.steps || [],
        transcript: data.transcript || [],
        userId: data.user_id,
    };
    return isTrainingModule(module) ? module : null;
}

export const getModule = async (slug: string): Promise<TrainingModule | undefined> => {
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
            const mappedModule = mapToTrainingModule(data);
            if (mappedModule) return mappedModule;
        }

        const response = await fetch(`/modules/${slug}.json`);
        if (response.ok) {
            const staticModule = await response.json();
            if (isTrainingModule(staticModule)) {
                return staticModule;
            }
        }

        return undefined;

    } catch (error: any) {
        console.error(`Error fetching module with slug "${slug}":`, error.message);
        throw new Error(error.message);
    }
};

export const getAvailableModules = async (): Promise<TrainingModule[]> => {
    const { data, error } = await supabase
        .from('modules')
        .select('*');

    if (error) {
        console.error("Error fetching modules:", error);
        throw new Error(error.message);
    }

    if (!Array.isArray(data)) {
        console.error("Data fetched from 'modules' is not an array:", data);
        return [];
    }

    return data.map(mapToTrainingModule).filter((m): m is TrainingModule => m !== null);
};

export const saveModule = async ({
    moduleData,
    videoFile,
}: {
    moduleData: TrainingModule,
    videoFile?: File | null,
}): Promise<TrainingModule> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        throw new Error('User not authenticated. Cannot save module.');
    }

    let video_url = moduleData.videoUrl;

    if (videoFile) {
        const fileExt = videoFile.name.split('.').pop();
        const filePath = `${moduleData.slug}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('training_videos')
            .upload(filePath, videoFile, {
                cacheControl: '3600',
                upsert: true,
            });

        if (uploadError) {
            console.error("Video upload failed:", uploadError);
            throw new Error(`Video upload failed: ${uploadError.message}`);
        }

        const { data } = supabase.storage.from('training_videos').getPublicUrl(filePath);
        video_url = data.publicUrl;
    }

    const dbData = {
        slug: moduleData.slug,
        title: moduleData.title,
        steps: moduleData.steps,
        transcript: moduleData.transcript,
        video_url: video_url,
        user_id: user.id,
    };

    const { data, error } = await supabase
        .from('modules')
        .upsert(dbData, { onConflict: 'slug' })
        .select()
        .single();

    if (error) {
        console.error("Error saving module:", error);
        throw new Error(`Failed to save module: ${error.message}`);
    }

    const savedModule = mapToTrainingModule(data);
    if (!savedModule) {
        throw new Error("Data returned after save is not a valid TrainingModule.");
    }

    return savedModule;
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

    const { error: moduleError } = await supabase
        .from('modules')
        .delete()
        .eq('slug', slug);
    if (moduleError) throw new Error(`Failed to delete the module: ${moduleError.message}`);
};