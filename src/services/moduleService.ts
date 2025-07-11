
import type { TrainingModule, Suggestion } from '@/types';
import { supabase } from './apiClient';

// Storage prefixes and keys
const SESSION_PREFIX = 'adapt-session-';
const CHAT_PREFIX = 'adapt-ai-tutor-chat-history-';
const SUGGESTIONS_KEY = 'adapt-suggestions';


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
export const getModule = (_slug: string): TrainingModule | undefined => {
    // This function will also need to be converted to async.
    // For now, it will not work correctly until migrated.
    console.warn("getModule is not yet migrated to use Supabase and may not function as expected.");
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
 * @param moduleData The TrainingModule object.
 * @returns True if successful, false otherwise.
 */
export const saveUploadedModule = (_moduleData: TrainingModule): boolean => {
    // This function will also need to be converted to async.
    console.warn("saveUploadedModule is not yet migrated to use Supabase and may not function as expected.");
    return false;
};

/**
 * Deletes a module and all its associated data from the database.
 * @param slug The slug of the module to delete.
 */
export const deleteModule = (slug: string): void => {
    // This function will also need to be converted to async.
    console.warn("deleteModule is not yet migrated to use Supabase and may not function as expected.");

    // The old localStorage logic is kept here as a reference and will be removed once
    // the full migration to Supabase (with cascading deletes or equivalent logic) is complete.
    console.log(`(LocalStorage) Deleting module '${slug}' and all associated data.`);
    const keysToRemove: string[] = [];

    // Find all keys related to this module
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
            key.startsWith(`${SESSION_PREFIX}${slug}-`) ||
            key.startsWith(`${CHAT_PREFIX}${slug}-`)
        )) {
            keysToRemove.push(key);
        }
    }

    // Remove the identified keys
    keysToRemove.forEach(key => {
        try {
            localStorage.removeItem(key);
        } catch (e) {
            console.error(`Failed to remove key ${key} from localStorage`, e);
        }
    });

    // Handle suggestions, which are all in one key
    try {
        const suggestionsJson = localStorage.getItem(SUGGESTIONS_KEY);
        if (suggestionsJson) {
            let suggestions: Suggestion[] = JSON.parse(suggestionsJson);
            const filteredSuggestions = suggestions.filter(s => s.moduleId !== slug);
            localStorage.setItem(SUGGESTIONS_KEY, JSON.stringify(filteredSuggestions));
        }
    } catch (e) {
        console.error(`Failed to process and filter suggestions for module ${slug}`, e);
    }

    console.log(`(LocalStorage) Deletion complete for module '${slug}'.`);
};
