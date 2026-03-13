/**
 * JarvisInteractive вЂ” Interaktiv Ovoz Yordamchi Rejimi
 * =====================================================
 * Doktor Jarvis bilan bevosita gaplashadi.
 * Ikki chiqish rejimi: Ovozli | Faqat matnli.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { SpeechLanguage, JarvisChatResult } from '../../services/speechService';
import {
  RealtimeSTT, speakText, stopSpeaking, isSpeaking,
  jarvisChat, jarvisChatStream, AudioWaveform as _WF,
  AudioRecorder,
} from '../../services/speechService';
import { AudioWaveform } from './AudioWaveform';
import { INSTITUTE_NAME_SHORT } from '../../constants/brand';

interface Props {
  sessionId:  string | null;
  language:   SpeechLanguage;
  onError:    (msg: string) => void;
}

interface Message {
  id:        string;
  role:      'user' | 'jarvis';
  text:      string;
  time:      string;
  critical?: boolean;
  speaking?: boolean;
}

type OutputMode = 'voice' | 'text';

export const JarvisInteractive: React.FC<Props> = ({ sessionId, language, onError }) => {
  const [messages,     setMessages]    = useState<Message[]>([]);
  const [inputMode,    setInputMode]   = useState<'mic' | 'keyboard'>('mic');
  const [outputMode,   setOutputMode]  = useState<OutputMode>('voice');
  const [isListening,  setIsListening] = useState(false);
  const [isThinking,   setIsThinking]  = useState(false);
  const [isTalking,    setIsTalking]   = useState(false);
  const [textInput,    setTextInput]   = useState('');
  const [interimText,  setInterimText] = useState('');
  const [analyser,     setAnalyser]    = useState<AnalyserNode | null>(null);

  const sttRef       = useRef<RealtimeSTT | null>(null);
  const recorderRef  = useRef<AudioRecorder | null>(null);
  const cancelStream = useRef<(() => void) | null>(null);
  const scrollRef    = useRef<HTMLDivElement>(null);

  const voiceMode = outputMode === 'voice';

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, interimText]);

  const addMessage = (role: 'user' | 'jarvis', text: string, critical = false): string => {
    const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setMessages(prev => [...prev, {
      id, role, text,
      time:     new Date().toLocaleTimeString(),
      critical,
      speaking: role === 'jarvis',
    }]);
    return id;
  };

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !sessionId) return;
    setInterimText('');

    const userMsgId = addMessage('user', text);
    setIsThinking(true);

    try {
      // Streaming response
      let fullText = '';
      const jarvisId = `msg-${Date.now()}-jarvis`;

      setMessages(prev => [...prev, {
        id: jarvisId, role: 'jarvis', text: 'в–‹',
        time: new Date().toLocaleTimeString(),
        speaking: true,
      }]);

      const cancel = jarvisChatStream(
        sessionId, text, voiceMode,
        (chunk) => {
          fullText = chunk;
          setMessages(prev => prev.map(m =>
            m.id === jarvisId ? { ...m, text: fullText + 'в–‹' } : m
          ));
        },
        async (final, isCritical) => {
          setMessages(prev => prev.map(m =>
            m.id === jarvisId ? { ...m, text: final, critical: isCritical, speaking: false } : m
          ));
          setIsThinking(false);

          // TTS
          if (outputMode === 'voice' && final) {
            setIsTalking(true);
            try {
              await speakText(final, language, true);
            } catch (e) {
              console.warn('TTS xatolik:', e);
            } finally {
              setIsTalking(false);
              setMessages(prev => prev.map(m =>
                m.id === jarvisId ? { ...m, speaking: false } : m
              ));
            }
          }
        },
        (err) => {
          setIsThinking(false);
          setMessages(prev => prev.map(m =>
            m.id === jarvisId ? { ...m, text: `Xatolik: ${err}`, speaking: false } : m
          ));
        },
      );
      cancelStream.current = cancel;

    } catch (err) {
      setIsThinking(false);
      onError(err instanceof Error ? err.message : String(err));
    }
  }, [sessionId, voiceMode, outputMode, language, onError]);

  // Mic: press-to-talk
  const startMicListening = useCallback(async () => {
    if (isListening) return;
    stopSpeaking();

    // AudioRecorder for waveform
    try {
      const recorder = new AudioRecorder();
      await recorder.start();
      recorderRef.current = recorder;
      if (recorder.analyser) setAnalyser(recorder.analyser);
    } catch {
      // waveform optional
    }

    const stt = new RealtimeSTT(language);
    sttRef.current = stt;
    setIsListening(true);

    stt.start(
      async (text, isFinal) => {
        if (!isFinal) {
          setInterimText(text);
        } else if (text.trim()) {
          setInterimText('');
          sttRef.current?.stop();
          sttRef.current = null;
          recorderRef.current?.stop();
          recorderRef.current = null;
          setIsListening(false);
          setAnalyser(null);
          await sendMessage(text);
        }
      },
      (err) => {
        setIsListening(false);
        setAnalyser(null);
        if (!err.includes('no-speech')) onError(err);
      },
      false, // single utterance
    );
  }, [isListening, language, sendMessage, onError]);

  const stopMicListening = useCallback(() => {
    sttRef.current?.stop();
    sttRef.current = null;
    recorderRef.current?.stop().catch(() => null);
    recorderRef.current = null;
    setIsListening(false);
    setAnalyser(null);
    setInterimText('');
  }, []);

  const handleKeySubmit = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(textInput);
      setTextInput('');
    }
  }, [textInput, sendMessage]);

  const handleInterrupt = useCallback(() => {
    stopSpeaking();
    cancelStream.current?.();
    setIsTalking(false);
    setIsThinking(false);
  }, []);

  const jarvisIsActive = isThinking || isTalking;

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Jarvis avatar */}
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl
            ${jarvisIsActive ? 'bg-sky-600 animate-pulse' : 'bg-slate-700'}`}>
            рџ¤–
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-none">{INSTITUTE_NAME_SHORT} — Jarvis</p>
            <p className={`text-xs mt-0.5 ${
              isTalking ? 'text-sky-400' : isThinking ? 'text-amber-400' :
              isListening ? 'text-emerald-400' : 'text-slate-500'
            }`}>
              {isTalking ? 'рџ”Љ Gapirmoqda...' : isThinking ? 'рџ’­ O\'ylayapti...' :
               isListening ? 'рџЋ™ Eshitmoqda...' : 'в—Џ Tayyor'}
            </p>
          </div>
        </div>

        {/* Output mode toggle */}
        <div className="flex gap-1 bg-slate-800 rounded-xl p-1">
          <button
            onClick={() => setOutputMode('voice')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              outputMode === 'voice' ? 'bg-sky-600 text-white' : 'text-slate-400'
            }`}
          >
            рџ”Љ Ovozli
          </button>
          <button
            onClick={() => { setOutputMode('text'); stopSpeaking(); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              outputMode === 'text' ? 'bg-slate-600 text-white' : 'text-slate-400'
            }`}
          >
            рџ“ќ Matnli
          </button>
        </div>
      </div>

      {/* Waveform */}
      {(isListening || isTalking) && (
        <div className="rounded-2xl bg-slate-900/60 border border-sky-500/30 p-2">
          <AudioWaveform
            analyser={analyser}
            isActive={isListening || isTalking}
            color={isTalking ? '#a78bfa' : '#38bdf8'}
            height={48}
          />
        </div>
      )}

      {/* Chat messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-3 max-h-72 pr-1"
      >
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-slate-500 text-sm">
              {sessionId
                ? 'Savol bering yoki mikrofon tugmasini bosing'
                : 'Avval konsultatsiya sessiyasini boshlang'}
            </p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role === 'jarvis' && (
              <span className="w-6 h-6 rounded-full bg-sky-700 flex items-center justify-center text-xs shrink-0 mt-0.5">
                рџ¤–
              </span>
            )}
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
              msg.role === 'user'
                ? 'bg-sky-700 text-white rounded-tr-sm'
                : msg.critical
                  ? 'bg-red-950/60 border border-red-500/50 text-red-200 rounded-tl-sm'
                  : 'bg-slate-800/80 text-slate-200 rounded-tl-sm'
            }`}>
              {msg.critical && (
                <p className="text-red-400 text-xs font-bold mb-1">рџљЁ SHOSHILINCH</p>
              )}
              <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              <p className="text-xs opacity-40 mt-1 text-right">{msg.time}</p>
            </div>
            {msg.role === 'user' && (
              <span className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-xs shrink-0 mt-0.5">
                рџ‘ЁвЂЌвљ•пёЏ
              </span>
            )}
          </div>
        ))}

        {/* Interim text */}
        {interimText && (
          <div className="flex justify-end">
            <div className="bg-slate-700/60 rounded-2xl rounded-tr-sm px-3 py-2 text-sm text-slate-400 italic max-w-[80%]">
              {interimText}в–‹
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      {!sessionId ? (
        <p className="text-center text-slate-500 text-sm py-2">
          Jarvis uchun avval sessiya oching
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Input mode toggle */}
          <div className="flex gap-2">
            <button onClick={() => setInputMode('mic')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-medium ${
                inputMode === 'mic' ? 'bg-sky-700 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
              рџЋ™ Mikrofon
            </button>
            <button onClick={() => setInputMode('keyboard')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-medium ${
                inputMode === 'keyboard' ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
              вЊЁпёЏ Klaviatura
            </button>
          </div>

          {/* Mic input */}
          {inputMode === 'mic' && (
            <div className="flex gap-2">
              <button
                onMouseDown={startMicListening}
                onMouseUp={!isListening ? undefined : () => {
                  // Auto-send when release
                }}
                onClick={isListening ? stopMicListening : startMicListening}
                disabled={!sessionId || isThinking}
                className={`flex-1 py-3 rounded-2xl font-semibold text-sm transition-all active:scale-95 ${
                  isListening
                    ? 'bg-red-600 text-white animate-pulse'
                    : 'bg-sky-600 hover:bg-sky-500 text-white'
                } disabled:opacity-40`}
              >
                {isListening ? 'рџ”ґ Tinglayapti... (bosing to\'xtatish uchun)' : 'рџЋ™ Savol Berish'}
              </button>
              {(isThinking || isTalking) && (
                <button onClick={handleInterrupt}
                  className="px-4 rounded-2xl bg-amber-700 hover:bg-amber-600 text-white text-sm">
                  вЏ№
                </button>
              )}
            </div>
          )}

          {/* Keyboard input */}
          {inputMode === 'keyboard' && (
            <div className="flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                onKeyDown={handleKeySubmit}
                placeholder="Savol yozing... (Enter = yuborish)"
                disabled={isThinking}
                className="flex-1 rounded-xl bg-slate-800/60 border border-slate-600/30
                           text-slate-200 placeholder-slate-500 px-3 py-2.5 text-sm
                           focus:outline-none focus:border-sky-500 disabled:opacity-50"
              />
              <button
                onClick={() => { sendMessage(textInput); setTextInput(''); }}
                disabled={!textInput.trim() || isThinking}
                className="px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white
                           disabled:opacity-40 transition-all"
              >
                в–¶
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default JarvisInteractive;