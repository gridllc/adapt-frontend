import { useState, useEffect, useRef } from 'react';

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

export const useSpeechRecognition = (onResult: (transcript: string) => void) => {
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
        recognition.onend = () => setIsListening(false);
        recognition.onerror = (event) => {
            console.error("Speech recognition error", event.error);
            setIsListening(false);
        };

        recognition.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
            }
            if (finalTranscript) {
                onResult(finalTranscript);
            }
        };

        recognitionRef.current = recognition;

        return () => {
            recognition.stop();
        };
    }, [onResult]);

    const startListening = () => {
        if (recognitionRef.current && !isListening) {
            try {
                recognitionRef.current.start();
            } catch (e) {
                console.error("Could not start speech recognition", e);
            }
        }
    };

    const stopListening = () => {
        if (recognitionRef.current && isListening) {
            recognitionRef.current.stop();
        }
    };

    return {
        isListening,
        startListening,
        stopListening,
        hasSupport: !!SpeechRecognition,
    };
};
