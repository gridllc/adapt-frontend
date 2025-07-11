
import { MOCK_SANDWICH_MODULE } from '@/data/sandwich';
import type { TrainingModule, Suggestion } from '@/types';

// Storage prefixes and keys
const MODULE_PREFIX = 'adapt-module-';
const SESSION_PREFIX = 'adapt-session-';
const CHAT_PREFIX = 'adapt-ai-tutor-chat-history-';
const SUGGESTIONS_KEY = 'adapt-suggestions';


const isTrainingModule = (data: any): data is TrainingModule => {
    return (
        typeof data === 'object' &&
        data !== null &&
        typeof data.slug === 'string' &&
        typeof data.title === 'string' &&
        typeof data.videoUrl === 'string' &&
        Array.isArray(data.steps)
    );
};

// A simple in-memory store for pre-loaded modules.
const modules: Record<string, TrainingModule> = {
  [MOCK_SANDWICH_MODULE.slug]: MOCK_SANDWICH_MODULE,
};

/**
 * Retrieves a training module by its slug.
 * It first checks pre-loaded modules, then falls back to checking localStorage
 * for any modules uploaded by the user.
 * @param slug The slug of the module to retrieve.
 * @returns The TrainingModule if found, otherwise undefined.
 */
export const getModule = (slug: string): TrainingModule | undefined => {
  if (modules[slug]) {
    return modules[slug];
  }

  try {
    const storedData = localStorage.getItem(`${MODULE_PREFIX}${slug}`);
    if (storedData) {
      const parsedData = JSON.parse(storedData);
      if (isTrainingModule(parsedData)) {
        return parsedData;
      }
    }
  } catch (e) {
    console.error(`Failed to get module '${slug}' from localStorage`, e);
  }
  
  return undefined;
};

/**
 * Gets a list of all available modules, combining pre-loaded and localStorage-stored ones.
 */
export const getAvailableModules = (): TrainingModule[] => {
    const allModules = { ...modules };
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(MODULE_PREFIX)) {
            try {
                const storedData = localStorage.getItem(key);
                if(storedData) {
                    const parsedData = JSON.parse(storedData);
                    if (isTrainingModule(parsedData)) {
                        allModules[parsedData.slug] = parsedData;
                    }
                }
            } catch (e) {
                console.error(`Failed to parse module from localStorage with key ${key}`, e);
            }
        }
    }

    return Object.values(allModules);
};

/**
 * Saves an uploaded module to localStorage so it can be retrieved by its slug.
 * @param moduleData The parsed TrainingModule object.
 * @returns True if successful, false otherwise.
 */
export const saveUploadedModule = (moduleData: TrainingModule): boolean => {
    if (!isTrainingModule(moduleData)) {
        console.error("Data is not a valid TrainingModule", moduleData);
        return false;
    }
    try {
        localStorage.setItem(`${MODULE_PREFIX}${moduleData.slug}`, JSON.stringify(moduleData));
        return true;
    } catch (e) {
        console.error(`Failed to save module '${moduleData.slug}' to localStorage`, e);
        return false;
    }
};

/**
 * Deletes a module and all its associated data (sessions, chats, suggestions) from localStorage.
 * @param slug The slug of the module to delete.
 */
export const deleteModule = (slug: string): void => {
    console.log(`Deleting module '${slug}' and all associated data.`);
    const keysToRemove: string[] = [];

    // Find all keys related to this module
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
            key === `${MODULE_PREFIX}${slug}` ||
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
    } catch(e) {
        console.error(`Failed to process and filter suggestions for module ${slug}`, e);
    }

    console.log(`Deletion complete for module '${slug}'.`);
};
