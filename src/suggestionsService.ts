import type { Suggestion } from '@/types';

const SUGGESTIONS_KEY = 'adapt-suggestions';

/**
 * Retrieves all suggestions from localStorage.
 * @returns {Suggestion[]} An array of all stored suggestions.
 */
const getAllSuggestions = (): Suggestion[] => {
    try {
        const storedSuggestions = localStorage.getItem(SUGGESTIONS_KEY);
        if (storedSuggestions) {
            return JSON.parse(storedSuggestions);
        }
    } catch (e) {
        console.error("Failed to retrieve suggestions from localStorage", e);
    }
    return [];
};

/**
 * Saves a list of suggestions to localStorage.
 * @param {Suggestion[]} suggestions The array of suggestions to save.
 */
const saveAllSuggestions = (suggestions: Suggestion[]) => {
    try {
        localStorage.setItem(SUGGESTIONS_KEY, JSON.stringify(suggestions));
    } catch (e) {
        console.error("Failed to save suggestions to localStorage", e);
    }
};

/**
 * Submits a new suggestion for a specific module and step.
 * @param {string} moduleId The ID of the module.
 * @param {number} stepIndex The index of the step the suggestion applies to.
 * @param {string} suggestionText The text content of the suggestion.
 */
export const submitSuggestion = (moduleId: string, stepIndex: number, suggestionText: string): void => {
    const allSuggestions = getAllSuggestions();
    const newSuggestion: Suggestion = {
        id: `sug_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        moduleId,
        stepIndex,
        text: suggestionText,
        status: 'pending',
    };
    allSuggestions.push(newSuggestion);
    saveAllSuggestions(allSuggestions);
};

/**
 * Retrieves all suggestions for a specific module.
 * @param {string} moduleId The ID of the module to get suggestions for.
 * @returns {Suggestion[]} An array of suggestions for the specified module.
 */
export const getSuggestionsForModule = (moduleId: string): Suggestion[] => {
    return getAllSuggestions().filter(s => s.moduleId === moduleId);
};

/**
 * Updates the status of a specific suggestion.
 * @param {string} suggestionId The ID of the suggestion to update.
 * @param {'approved' | 'rejected'} status The new status for the suggestion.
 */
export const updateSuggestionStatus = (suggestionId: string, status: 'approved' | 'rejected'): void => {
    let allSuggestions = getAllSuggestions();
    const suggestionIndex = allSuggestions.findIndex(s => s.id === suggestionId);

    if (suggestionIndex > -1) {
        allSuggestions[suggestionIndex].status = status;
        saveAllSuggestions(allSuggestions);
    } else {
        console.warn(`Suggestion with ID ${suggestionId} not found.`);
    }
};

/**
 * Deletes a suggestion by its ID. Used after a suggestion is processed.
 * @param {string} suggestionId The ID of the suggestion to delete.
 */
export const deleteSuggestion = (suggestionId: string): void => {
    let allSuggestions = getAllSuggestions();
    const updatedSuggestions = allSuggestions.filter(s => s.id !== suggestionId);
    saveAllSuggestions(updatedSuggestions);
};
