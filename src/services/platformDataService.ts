
export interface PlatformData {
    modules: Record<string, any>;
    chatHistories: Record<string, any>;
    sessions: Record<string, any>;
    suggestions: any;
    auth?: any; // Include auth for completeness, but handle with care
}

const MODULE_PREFIX = 'adapt-module-';
const CHAT_PREFIX = 'adapt-ai-tutor-chat-history-';
const SESSION_PREFIX = 'adapt-session-';
const SUGGESTIONS_KEY = 'adapt-suggestions';
const AUTH_KEY = 'adapt-auth-token';

/**
 * Exports all Adapt platform data from localStorage into a single JSON object.
 */
export const exportAllData = (): PlatformData => {
    const data: PlatformData = {
        modules: {},
        chatHistories: {},
        sessions: {},
        suggestions: null,
        auth: null,
    };

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;

        try {
            const value = localStorage.getItem(key)!;
            // Auth token is not JSON, handle it separately
            if (key === AUTH_KEY) {
                data.auth = value;
                continue;
            }
            
            const parsedValue = JSON.parse(value);

            if (key.startsWith(MODULE_PREFIX)) {
                data.modules[key] = parsedValue;
            } else if (key.startsWith(CHAT_PREFIX)) {
                data.chatHistories[key] = parsedValue;
            } else if (key.startsWith(SESSION_PREFIX)) {
                data.sessions[key] = parsedValue;
            } else if (key === SUGGESTIONS_KEY) {
                data.suggestions = parsedValue;
            }
        } catch (e) {
            console.warn(`Could not parse localStorage item with key: ${key}`, e);
        }
    }
    return data;
};

/**
 * Imports platform data from a JSON string, clearing existing data first.
 * @param dataToImport The JSON string of the platform data.
 * @returns True if import was successful, throws an error otherwise.
 */
export const importAllData = (dataToImport: string): boolean => {
    let parsedData: PlatformData;
    try {
        parsedData = JSON.parse(dataToImport);
        if (!parsedData || typeof parsedData !== 'object' || !('modules' in parsedData)) {
            throw new Error("Invalid data structure. The file does not appear to be a valid Adapt backup.");
        }
    } catch (e) {
        throw new Error(`Failed to parse import file. It must be a valid JSON backup from the Adapt platform. Error: ${e instanceof Error ? e.message : 'Unknown parsing error'}`);
    }

    // Clear all existing Adapt data
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('adapt-')) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // Import new data
    try {
        const writeJson = (dataObject: Record<string, any>) => {
            Object.entries(dataObject).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)));
        };

        writeJson(parsedData.modules);
        writeJson(parsedData.chatHistories);
        writeJson(parsedData.sessions);
        
        if (parsedData.suggestions) {
            localStorage.setItem(SUGGESTIONS_KEY, JSON.stringify(parsedData.suggestions));
        }
        if (parsedData.auth) {
            localStorage.setItem(AUTH_KEY, parsedData.auth);
        }

    } catch (e) {
        throw new Error(`An error occurred while writing imported data to storage. ${e instanceof Error ? e.message : ''}`);
    }

    return true;
};
