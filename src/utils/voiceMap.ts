/**
 * A centralized mapping of character personas to their corresponding
 * voice IDs for a high-quality TTS service (e.g., ElevenLabs).
 * This makes it easy to update or change voices across the application.
 *
 * NOTE: These are placeholder IDs and should be replaced with actual
 * voice IDs from your chosen TTS provider.
 */
const VOICE_MAP: Record<string, string> = {
    // A standard, clear narrator voice for system instructions.
    system: '21m00Tcm4TlvDq8ikWAM', // Default (Rachel)
    // A more engaging, friendly voice for the AI coach.
    coach: '2EiwWnXFnvU5JabPnv8n', // Alternate (Gigi)
    // A more formal, authoritative voice for stephen (if used)
    stephen: '5Q022V3w7hLp35k5uA2u', // Alternate (Fin)
    // A playful, sarcastic voice for Sunny (if used)
    sunny: 'jsCqWAovK2LkecY7zXl4', // Alternate (Glinda)
    // A more formal, authoritative voice
    janice: 'piTKgcLEGmPE4e6mEKli', // Alternate (Bella)
    // Default fallback voice if no character is specified.
    default: '21m00Tcm4TlvDq8ikWAM',
};

/**
 * Retrieves the voice ID for a given character.
 * @param {string} [character='default'] - The character persona (e.g., 'coach', 'system').
 * @returns {string} The corresponding voice ID.
 */
export const getVoiceIdForCharacter = (character: string = 'default'): string => {
    return VOICE_MAP[character.toLowerCase()] || VOICE_MAP.default;
};
