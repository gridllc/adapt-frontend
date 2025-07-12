
import type { TrainingModule } from '@/types';
import { supabase } from '@/services/apiClient';

const isTrainingModule = (data: any): data is TrainingModule => {
    return (
        typeof data === 'object' &&
        data !== null &&
        typeof data.slug === 'string' &&
        typeof data.title === 'string' &&
        // videoUrl can be empty string
        (typeof data.videoUrl === 'string' || data.videoUrl === null) &&
        Array.isArray(data.steps)
    );
};

// Helper to map from database snake_case to JS camelCase
const mapToTrainingModule = (data: any): TrainingModule | null => {
    if (!data) return null;
    const module: TrainingModule = {
        slug: data.slug,
        title: data.title,
        videoUrl: data.video_url || '',
        steps: data.steps || [],
        transcript: data.transcript || [],
    };
    return isTrainingModule(module) ? module : null;
}

/**
 * Retrieves a training module by its slug from the database.
 * @param slug The slug of the module to retrieve.
 * @returns The TrainingModule if found, otherwise undefined.
 */
export const getModule = async (slug: string): Promise<TrainingModule | undefined> => {
    if (!slug) return undefined;

    const { data, error } = await supabase
        .from('modules')
        .select('*')
        .eq('slug', slug)
        .single(); // Use .single() to get one object instead of an array

    if (error) {
        // .single() throws an error if no rows are found or more than one is found.
        if (error.code === 'PGRST116') { // PGRST116 is the code for "The result contains 0 rows"
            return undefined; // Not found is not a throw-worthy error, just return undefined
        }
        console.error(`Error fetching module with slug "${slug}":`, error.message);
        throw new Error(error.message); // Other errors should be thrown
    }

    const mappedModule = mapToTrainingModule(data);
    if (mappedModule) {
        return mappedModule;
    }

    console.warn(`Data received for slug "${slug}" is not a valid TrainingModule.`, data);
    return undefined;
};

/**
 * Gets a list of all available modules from the database.
 */
export const getAvailableModules = async (): Promise<TrainingModule[]> => {
    const { data, error } = await supabase
        .from('modules') // Assumes your table is named 'modules'
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

/**
 * Saves (upserts) a module to the database.
 * If a module with the same slug exists, it will be updated. Otherwise, a new one will be created.
 * @param moduleData The TrainingModule object to save.
 * @returns The saved TrainingModule on success.
 * @throws An error if the save operation fails.
 */
export const saveUploadedModule = async (moduleData: TrainingModule): Promise<TrainingModule> => {
    // Map from JS camelCase to database snake_case before sending
    const dbData = {
        slug: moduleData.slug,
        title: moduleData.title,
        steps: moduleData.steps,
        transcript: moduleData.transcript,
        video_url: moduleData.videoUrl,
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

/**
 * Deletes a module from the database and all its associated data.
 * @param slug The slug of the module to delete.
 * @throws An error if the deletion fails.
 */
export const deleteModule = async (slug: string): Promise<void> => {
    // In a production environment with Foreign Key constraints and `ON DELETE CASCADE`,
    // deleting the parent `modules` record would automatically delete child records.
    // Without it, we must delete from dependent tables first to avoid foreign key violations.

    // 1. Delete associated chat messages
    const { error: chatError } = await supabase
        .from('chat_messages')
        .delete()
        .eq('module_id', slug);

    if (chatError) {
        console.error(`Error deleting chat messages for module ${slug}:`, chatError);
        throw new Error(`Failed to delete chat history: ${chatError.message}`);
    }

    // 2. Delete associated training sessions
    const { error: sessionError } = await supabase
        .from('training_sessions')
        .delete()
        .eq('module_id', slug);

    if (sessionError) {
        console.error(`Error deleting training sessions for module ${slug}:`, sessionError);
        throw new Error(`Failed to delete session data: ${sessionError.message}`);
    }

    // 3. Delete associated suggestions
    const { error: suggestionError } = await supabase
        .from('suggestions')
        .delete()
        .eq('module_id', slug);

    if (suggestionError) {
        console.error(`Error deleting suggestions for module ${slug}:`, suggestionError);
        throw new Error(`Failed to delete suggestions: ${suggestionError.message}`);
    }

    // 4. Finally, delete the module itself
    const { error: moduleError } = await supabase
        .from('modules')
        .delete()
        .eq('slug', slug);

    if (moduleError) {
        console.error(`Error deleting module ${slug}:`, moduleError);
        throw new Error(`Failed to delete the module: ${moduleError.message}`);
    }
};