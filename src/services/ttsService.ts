
import { getVoiceIdForCharacter } from '@/utils/voiceMap';

// Cache to store generated audio blob URLs. The key is a composite of voiceId and text.
const MAX_CACHE_SIZE = 50; // A reasonable limit to prevent unbounded memory usage.
const audioCache = new Map<string, string>();

// Keep track of the currently playing audio element to allow for interruption.
let currentAudio: HTMLAudioElement | null = null;

/**
 * Plays an audio file from a given URL.
 * @param {string} url - The URL of the audio file to play (can be a blob URL).
 * @returns {Promise<void>} A promise that resolves when the audio has finished playing or an error occurs.
 */
const playAudio = (url: string): Promise<void> => {
  return new Promise((resolve) => {
    // Stop any currently playing audio before starting a new one.
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.src = '';
      currentAudio = null;
    }

    const audio = new Audio(url);
    currentAudio = audio;

    const cleanup = () => {
      if (currentAudio === audio) {
        currentAudio = null;
      }
      resolve();
    };

    audio.onended = cleanup;
    audio.onerror = (err) => {
      console.error('Audio playback error:', err);
      cleanup();
    };
    audio.onpause = cleanup;

    audio.play().catch(err => {
      console.error("Failed to play audio:", err);
      cleanup();
    });
  });
};

/**
 * Fallback function that uses the browser's native Web Speech API.
 * This is used if the primary TTS service fails.
 * @param {string} text - The text to speak.
 * @returns {Promise<void>} A promise that resolves when speech is finished.
 */
const speakWithFallbackApi = (text: string): Promise<void> => {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      console.warn("Browser does not support Speech Synthesis.");
      resolve();
      return;
    }

    // Cancel any native speech that might be ongoing.
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => resolve();
    utterance.onerror = (event) => {
      console.error("Native SpeechSynthesis Error", event);
      resolve();
    };

    window.speechSynthesis.speak(utterance);
  });
};


/**
 * Speaks the given text using a high-quality TTS API, with caching.
 * If the API fails, it gracefully falls back to the browser's native speech synthesis.
 * The function is now asynchronous and returns a promise that resolves when speech is complete.
 * @param {string} text - The text to be spoken.
 * @param {string} [character='system'] - The persona to use for the voice.
 * @returns {Promise<void>} A promise that resolves when speech has finished.
 */
export async function speak(text: string, character: string = 'system'): Promise<void> {
  const voiceId = getVoiceIdForCharacter(character);
  const cacheKey = `${voiceId}-${text}`;

  // 1. Check cache first
  if (audioCache.has(cacheKey)) {
    const audioUrl = audioCache.get(cacheKey);
    if (audioUrl) {
      return playAudio(audioUrl);
    }
  }

  // 2. Fetch from high-quality TTS API
  try {
    // NOTE: This assumes a backend endpoint at `/api/tts` that proxies the call to a service like ElevenLabs.
    // The backend would handle API keys securely. A real implementation would require this API route to be created.
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voiceId }),
    });

    if (!response.ok) {
      throw new Error(`TTS API request failed with status ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('audio/')) {
      throw new Error(`TTS API returned unexpected content type: ${contentType || 'none'}. Expected audio.`);
    }

    const blob = await response.blob();
    const audioUrl = URL.createObjectURL(blob);

    // --- Cache Management ---
    // If cache is full, evict the oldest entry to prevent memory leaks from blob URLs.
    if (audioCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = audioCache.keys().next().value;
      if (oldestKey) {
        const urlToRevoke = audioCache.get(oldestKey);
        if (urlToRevoke) {
          URL.revokeObjectURL(urlToRevoke); // Revoke the old blob URL to free memory.
        }
        audioCache.delete(oldestKey);
        console.log(`TTS cache full. Evicted oldest entry: ${oldestKey}`);
      }
    }
    audioCache.set(cacheKey, audioUrl); // Save to cache

    return playAudio(audioUrl);

  } catch (err) {
    // 3. Graceful fallback to browser's native TTS
    console.warn(`High-quality TTS failed: ${err instanceof Error ? err.message : 'Unknown error'}. Falling back to native speech.`);
    return speakWithFallbackApi(text);
  }
}

/**
 * Cancels any ongoing speech, whether from the custom audio player or the native API.
 */
export const cancel = () => {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }
  if (window.speechSynthesis && window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }
};