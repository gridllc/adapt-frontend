/**
 * A simple Text-to-Speech service using the browser's built-in Web Speech API.
 * This acts as a prototype for a more complex integration like ElevenLabs.
 */

// Ensure we have a single instance of utterance to control it.
let utterance: SpeechSynthesisUtterance | null = null;

/**
 * Speaks the given text out loud.
 * If speech is already in progress, it will be cancelled before starting new speech.
 * @param text The text to be spoken.
 */
export const speak = (text: string) => {
  if (!window.speechSynthesis) {
    console.warn("Browser does not support Speech Synthesis.");
    return;
  }

  // Cancel any ongoing speech before starting a new one.
  cancel();

  utterance = new SpeechSynthesisUtterance(text);

  // Optional: Configure voice, pitch, rate
  // const voices = window.speechSynthesis.getVoices();
  // utterance.voice = voices[0]; // You can pick a specific voice
  // utterance.pitch = 1;
  // utterance.rate = 1;

  utterance.onend = () => {
    utterance = null;
  };

  window.speechSynthesis.speak(utterance);
};

/**
 * Cancels any ongoing speech.
 */
export const cancel = () => {
  if (window.speechSynthesis && window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }
};
