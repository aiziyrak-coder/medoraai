import { useState, useEffect, useRef } from 'react';
import { useTranslation } from './useTranslation';
import { logger } from '../utils/logger';

// TypeScript definitions for the Web Speech API
interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    onresult: (event: SpeechRecognitionEvent) => void;
    onerror: (event: SpeechRecognitionErrorEvent) => void;
    onend: () => void;
}

interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
    error: string;
}

declare global {
    interface Window {
        SpeechRecognition: { new(): SpeechRecognition };
        webkitSpeechRecognition: { new(): SpeechRecognition };
    }
}

const langCodeMap = {
    'uz-L': 'uz-UZ',
    'uz-C': 'uz-UZ',
    'ru': 'ru-RU',
    'en': 'en-US'
};

export const useSpeechToText = () => {
    const { language } = useTranslation();
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const recognitionRef = useRef<SpeechRecognition | null>(null);

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            // Browser doesn't support speech recognition
            logger.warn("Browser doesn't support SpeechRecognition.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = langCodeMap[language] || 'uz-UZ';

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            const results = event.results;
            if (results.length === 0) return;
            const last = results[results.length - 1];
            const text = (last[0] as { transcript: string }).transcript.trim();
            setTranscript(text);
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            // Speech recognition error
            logger.error('Speech recognition error:', event.error);
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognitionRef.current = recognition;
        
        // Return a cleanup function to stop recognition if the component unmounts
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, [language]); // Re-initialize if language changes

    const startListening = () => {
        if (recognitionRef.current && !isListening) {
            setTranscript('');
            recognitionRef.current.start();
            setIsListening(true);
        }
    };

    const stopListening = () => {
        if (recognitionRef.current && isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        }
    };

    return { isListening, transcript, startListening, stopListening };
};