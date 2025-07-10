import { MOCK_SANDWICH_MODULE } from './sandwich';
import type { TrainingModule } from '../types';

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
 * It first checks pre-loaded modules, then falls back to checking sessionStorage
 * for any modules uploaded by the user during the current session.
 * @param slug The slug of the module to retrieve.
 * @returns The TrainingModule if found, otherwise undefined.
 */
export const getModule = (slug: string): TrainingModule | undefined => {
  if (modules[slug]) {
    return modules[slug];
  }

  try {
    const storedData = sessionStorage.getItem(`adapt-module-${slug}`);
    if (storedData) {
      const parsedData = JSON.parse(storedData);
      if (isTrainingModule(parsedData)) {
        return parsedData;
      }
    }
  } catch (e) {
    console.error(`Failed to get module '${slug}' from session storage`, e);
  }
  
  return undefined;
};

/**
 * Gets a list of all available modules, combining pre-loaded and session-stored ones.
 */
export const getAvailableModules = (): TrainingModule[] => {
    const allModules = { ...modules };
    
    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('adapt-module-')) {
            try {
                const storedData = sessionStorage.getItem(key);
                if(storedData) {
                    const parsedData = JSON.parse(storedData);
                    if (isTrainingModule(parsedData)) {
                        allModules[parsedData.slug] = parsedData;
                    }
                }
            } catch (e) {
                console.error(`Failed to parse module from session storage with key ${key}`, e);
            }
        }
    }

    return Object.values(allModules);
};

/**
 * Saves an uploaded module to sessionStorage so it can be retrieved by its slug.
 * @param moduleData The parsed TrainingModule object.
 * @returns True if successful, false otherwise.
 */
export const saveUploadedModule = (moduleData: TrainingModule): boolean => {
    if (!isTrainingModule(moduleData)) {
        console.error("Data is not a valid TrainingModule", moduleData);
        return false;
    }
    try {
        sessionStorage.setItem(`adapt-module-${moduleData.slug}`, JSON.stringify(moduleData));
        return true;
    } catch (e) {
        console.error(`Failed to save module '${moduleData.slug}' to session storage`, e);
        return false;
    }
};