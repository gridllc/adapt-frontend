
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
        console.error(`Error fetching module with slug "${slug}":`, error.message);
        if (error.code === 'PGRST116') { // PGRST116 is the code for "The result contains 0 rows"
            return undefined; // Not found is not a throw-worthy error, just return undefined
        }
        throw new Error(error.message); // Other errors should be thrown
    }

    if (data && isTrainingModule(data)) {
        return data;
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

    // Basic validation that the returned data is an array
    if (!Array.isArray(data)) {
        console.error("Data fetched from 'modules' is not an array:", data);
        return [];
    }

    return data.filter(isTrainingModule);
};

/**
 * Saves (upserts) a module to the database.
 * If a module with the same slug exists, it will be updated. Otherwise, a new one will be created.
 * @param moduleData The TrainingModule object to save.
 * @returns The saved TrainingModule on success.
 * @throws An error if the save operation fails.
 */
export const saveUploadedModule = async (moduleData: TrainingModule): Promise<TrainingModule> => {
    const { data, error } = await supabase
        .from('modules')
        .upsert(moduleData, { onConflict: 'slug' })
        .select()
        .single();

    if (error) {
        console.error("Error saving module:", error);
        throw new Error(`Failed to save module: ${error.message}`);
    }

    if (!data || !isTrainingModule(data)) {
        throw new Error("Data returned after save is not a valid TrainingModule.");
    }

    return data;
};

/**
 * Deletes a module from the database and all its associated data.
 * @param slug The slug of the module to delete.
 * @throws An error if the deletion fails.
 */
export const deleteModule = async (slug: string): Promise<void> => {
    // Note: In a production environment, you would ideally set up cascading deletes
    // in your database schema. For this app, explicit deletion is clear and effective.
    const tablesToDeleteFrom = ['chat_messages', 'training_sessions', 'suggestions'];

    console.log(`Deleting all associated data for module '${slug}'...`);
    for (const table of tablesToDeleteFrom) {
        const { error } = await supabase.from(table).delete().eq('module_id', slug);
        if (error) {
            console.error(`Error deleting from ${table} for module ${slug}:`, error);
            throw new Error(`Failed to clean up associated data in ${table}.`);
        }
    }

    // Finally, delete the module itself
    const { error: moduleError } = await supabase
        .from('modules')
        .delete()
        .eq('slug', slug);

    if (moduleError) {
        console.error("Error deleting module from database:", moduleError);
        throw new Error(`Failed to delete module from database: ${moduleError.message}`);
    }

    console.log(`Deletion complete for module '${slug}' and all associated database records.`);
};
