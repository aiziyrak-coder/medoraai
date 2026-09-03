import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from './useTranslation';
import { logger } from '../utils/logger';

// Web Speech API types live in src/types/speech.d.ts (they are absent from lib.dom).

const langCodeMap: Record<string, string> = {
    'uz-L': 'uz-UZ',
    'uz-C': 'uz-UZ',
    'ru': 'ru-RU',
    'en': 'en-US',
    'kaa': 'kk-KZ',
};

const langFallbackMap: Record<string, string> = {
    'uz-UZ': 'ru-RU',
    'kk-KZ': 'ru-RU',
};

export const useSpeechToText = () => {
    const { language } = useTranslation();
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [isSupported, setIsSupported] = useState(false);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const accumulatedRef = useRef('');

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setIsSupported(false);
            return;
        }
        setIsSupported(true);

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        const primary = langCodeMap[language] || 'uz-UZ';
        recognition.lang = primary;

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let finalText = '';
            let interimText = '';
            for (let i = 0; i < event.results.length; i++) {
                const chunk = (event.results[i][0] as { transcript: string }).transcript;
                if (event.results[i].isFinal) {
                    finalText += chunk;
                } else {
                    interimText += chunk;
                }
            }
            if (finalText) {
                accumulatedRef.current = `${accumulatedRef.current} ${finalText}`.trim();
            }
            setTranscript(`${accumulatedRef.current} ${interimText}`.trim());
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            if (event.error === 'language-not-supported') {
                const fallback = langFallbackMap[primary];
                if (fallback && recognition.lang !== fallback) {
                    recognition.lang = fallback;
                    return;
                }
            }
            if (event.error !== 'no-speech' && event.error !== 'aborted') {
                logger.error('Speech recognition error:', event.error);
            }
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognitionRef.current = recognition;

        return () => {
            recognitionRef.current?.stop();
        };
    }, [language]);

    const startListening = useCallback(() => {
        if (!recognitionRef.current || isListening) return;
        accumulatedRef.current = '';
        setTranscript('');
        try {
            recognitionRef.current.start();
            setIsListening(true);
        } catch (e) {
            logger.warn('Speech recognition start failed', e);
        }
    }, [isListening]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current && isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        }
    }, [isListening]);

    return { isListening, transcript, startListening, stopListening, isSupported };
};
