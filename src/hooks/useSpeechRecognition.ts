
import { useState, useEffect, useRef, useCallback } from 'react';

// Type definitions for the experimental SpeechRecognition API.
// These are added to satisfy TypeScript, as this API is not yet in the standard DOM library.
interface SpeechRecognitionEvent {
    resultIndex: number;
    results: {
        isFinal: boolean;
        [key: number]: {
            transcript: string;
        };
    }[];
}

interface SpeechRecognitionErrorEvent {
    error: string;
}

// Renamed to avoid conflict with the `SpeechRecognition` constant.
interface ISpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    onstart: (() => void) | null;
    onend: (() => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
}

interface SpeechRecognitionStatic {
    new(): ISpeechRecognition;
}

declare global {
    interface Window {
        SpeechRecognition: SpeechRecognitionStatic;
        webkitSpeechRecognition: SpeechRecognitionStatic;
    }
}

// The browser's SpeechRecognition API is still prefixed in some browsers.
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export const useSpeechRecognition = (onResult: (transcript: string, isFinal: boolean) => void) => {
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<ISpeechRecognition | null>(null);

    useEffect(() => {
        if (!SpeechRecognition) {
            console.warn("Speech Recognition API is not supported in this browser.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true; // Get results as the user speaks
        recognition.lang = 'en-US';

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => {
            // The onend event can fire unexpectedly. If it does, and we weren't manually stopping, restart it.
            // This makes the listening more robust.
            if (isListening) {
                recognition.start();
            } else {
                setIsListening(false);
            }
        };
        recognition.onerror = (event) => {
            console.error("Speech recognition error", event.error);
            setIsListening(false);
        };

        recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            // We call the callback with the full utterance so far, and a flag indicating if the final part has been received.
            if (finalTranscript || interimTranscript) {
                onResult(finalTranscript + interimTranscript, !!finalTranscript);
            }
        };

        recognitionRef.current = recognition;

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.onend = null; // Prevent restart on unmount
                recognitionRef.current.stop();
            }
        };
        // We use useCallback for onResult in the parent component, so this is safe.
    }, [onResult, isListening]);

    const startListening = useCallback(() => {
        if (recognitionRef.current && !isListening) {
            try {
                recognitionRef.current.start();
                setIsListening(true);
            } catch (e) {
                console.error("Could not start speech recognition", e);
            }
        }
    }, [isListening]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current && isListening) {
            // Set isListening to false before stopping to prevent the onend handler from restarting it.
            setIsListening(false);
            recognitionRef.current.stop();
        }
    }, [isListening]);

    return {
        isListening,
        startListening,
        stopListening,
        hasSupport: !!SpeechRecognition,
    };
};
