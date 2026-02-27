/**
 * ZiyrakInteractive — Interaktiv Ziyrak Chat
 * Wake word faollashganda avtomatik ochiladi.
 * Ovozli + matnli rejim.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { ZiyrakState } from './ZiyrakDashboard';
import { AudioWaveform } from '../jarvis/AudioWaveform';
import { apiPost, API_BASE_URL } from '../../services/api';

interface Message {
  id:       string;
  role:     'user' | 'ziyrak';
  text:     string;
  time:     string;
  critical?: boolean;
}

interface Props {
  sessionId:     string | null;
  language:      "uz-L" | "uz-C" | "ru" | "en";
  isWakeActive?: boolean;
  onError:       (msg: string) => void;
  onStateChange?: (state: ZiyrakState) => void;
}

export const ZiyrakInteractive: React.FC<Props> = ({
  sessionId, language, isWakeActive, onError, onStateChange,
}) => {
  const [messages,    setMessages]    = useState<Message[]>([]);
  const [outputMode,  setOutputMode]  = useState<'voice' | 'text'>('voice');
  const [isListening, setIsListening] = useState(false);
  const [isThinking,  setIsThinking]  = useState(false);
  const [textInput,   setTextInput]   = useState('');
  const [interim,     setInterim]     = useState('');
  const [analyser,    setAnalyser]    = useState<AnalyserNode | null>(null);
  const [audioCtx,    setAudioCtx]    = useState<AudioContext | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const cancelRef      = useRef<(() => void) | null>(null);
  const scrollRef      = useRef<HTMLDivElement>(null);

  // Wake word faollashsa avtomatik mikrofon
  useEffect(() => {
    if (isWakeActive && sessionId && !isListening) {
      startListening();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWakeActive]);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, interim]);

  const addMsg = (role: 'user' | 'ziyrak', text: string, critical = false): string => {
    const id = `m-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
    setMessages(p => [...p, { id, role, text, time: new Date().toLocaleTimeString(), critical }]);
    return id;
  };

  const playAudio = useCallback(async (base64: string) => {
    if (outputMode !== 'voice') return;
    try {
      const bytes  = atob(base64);
      const buffer = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i);
      const blob   = new Blob([buffer], { type: 'audio/mpeg' });
      const url    = URL.createObjectURL(blob);
      const audio  = new Audio(url);

      // Waveform for speaking
      if (!audioCtx) {
        const ctx  = new AudioContext();
        const an   = ctx.createAnalyser();
        an.fftSize = 256;
        const src  = ctx.createMediaElementSource(audio);
        src.connect(an);
        src.connect(ctx.destination);
        setAudioCtx(ctx);
        setAnalyser(an);
      }

      onStateChange?.('speaking');
      await new Promise<void>((resolve) => {
        audio.onended = () => {
          URL.revokeObjectURL(url);
          onStateChange?.('active');
          resolve();
        };
        audio.play().catch(() => resolve());
      });
    } catch { /* ignore */ }
  }, [outputMode, audioCtx, onStateChange]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !sessionId) return;
    setInterim('');
    addMsg('user', text);
    setIsThinking(true);
    onStateChange?.('active');

    const ziyrakId = `m-${Date.now()}-z`;
    setMessages(p => [...p, { id: ziyrakId, role: 'ziyrak', text: '▋', time: new Date().toLocaleTimeString() }]);

    const token = localStorage.getItem('access_token') || '';
    let fullText = '';
    let aborted  = false;

    const resp = await fetch(`${API_BASE_URL}/ziyrak/chat/stream/`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({
        session_id: sessionId,
        message:    text,
        voice_mode: outputMode === 'voice',
        with_tts:   outputMode === 'voice',
        language,
      }),
    }).catch(e => { onError(String(e)); setIsThinking(false); return null; });

    if (!resp || !resp.body) { setIsThinking(false); return; }

    cancelRef.current = () => { aborted = true; };
    const reader  = resp.body.getReader();
    const decoder = new TextDecoder();

    while (!aborted) {
      const { value, done } = await reader.read();
      if (done) break;
      const raw = decoder.decode(value, { stream: true });
      for (const line of raw.split('\n')) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        const payload = t.slice(5).trim();
        if (payload === '[DONE]') { aborted = true; break; }
        try {
          const obj = JSON.parse(payload) as {
            chunk?: string; done?: boolean; is_critical?: boolean;
            audio_base64?: string; error?: string;
          };
          if (obj.error) { onError(obj.error); break; }
          if (obj.chunk) {
            fullText += obj.chunk;
            setMessages(p => p.map(m => m.id === ziyrakId ? { ...m, text: fullText + '▋' } : m));
          }
          if (obj.done) {
            const isCrit = obj.is_critical || false;
            setMessages(p => p.map(m =>
              m.id === ziyrakId ? { ...m, text: fullText, critical: isCrit } : m
            ));
            setIsThinking(false);
            if (obj.audio_base64) await playAudio(obj.audio_base64);
            aborted = true;
          }
        } catch { /* skip */ }
      }
    }
    setIsThinking(false);
  }, [sessionId, language, outputMode, onError, onStateChange, playAudio]);

  const startListening = useCallback(() => {
    if (isListening) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { onError("STT qo'llab-quvvatlanmaydi"); return; }

    const localeMap: Record<string,string> = {
      "uz-L":"uz-UZ","uz-C":"uz-UZ","ru":"ru-RU","en":"en-US",
    };
    const rec = new SR() as SpeechRecognition;
    rec.lang           = localeMap[language] || "uz-UZ";
    rec.continuous     = false;
    rec.interimResults = true;

    rec.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal && r[0].transcript.trim()) {
          setInterim('');
          setIsListening(false);
          recognitionRef.current = null;
          sendMessage(r[0].transcript.trim());
        } else {
          setInterim(r[0].transcript);
        }
      }
    };
    rec.onerror = () => { setIsListening(false); };
    rec.onend   = () => { setIsListening(false); };

    rec.start();
    recognitionRef.current = rec;
    setIsListening(true);
    onStateChange?.('listening');
  }, [isListening, language, sendMessage, onError, onStateChange]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setInterim('');
  }, []);

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-base
            ${isThinking ? "bg-amber-700 animate-pulse" : "bg-sky-700"}`}>
            🤖
          </div>
          <div>
            <p className="font-semibold text-white text-sm">Ziyrak</p>
            <p className={`text-xs ${isListening ? "text-emerald-400" : isThinking ? "text-amber-400" : "text-slate-500"}`}>
              {isListening ? "🎙 Eshitmoqda" : isThinking ? "💭 O'ylayapti" : "Tayyor"}
            </p>
          </div>
        </div>
        {/* Output mode */}
        <div className="flex gap-1 bg-slate-800 rounded-xl p-1">
          {(["voice","text"] as const).map(mode => (
            <button key={mode} onClick={() => setOutputMode(mode)}
              className={`px-3 py-1 rounded-lg text-xs font-medium ${
                outputMode === mode ? "bg-sky-600 text-white" : "text-slate-400"
              }`}>
              {mode === "voice" ? "🔊 Ovozli" : "📝 Matnli"}
            </button>
          ))}
        </div>
      </div>

      {/* Waveform (tinglayotganda) */}
      {(isListening) && (
        <div className="rounded-xl bg-sky-950/30 border border-sky-600/30 p-2">
          <AudioWaveform analyser={analyser} isActive={isListening} color="#38bdf8" height={40} />
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 max-h-64 overflow-y-auto space-y-2">
        {messages.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-6">
            {sessionId ? '"Salom Ziyrak" deng yoki savol bering' : 'Sessiya yuklanmoqda...'}
          </p>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? "justify-end" : ""}`}>
            {msg.role === 'ziyrak' && (
              <span className="w-6 h-6 rounded-full bg-sky-700 flex items-center justify-center text-xs shrink-0 mt-0.5">🤖</span>
            )}
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
              msg.role === 'user'
                ? "bg-sky-700 text-white rounded-tr-sm"
                : msg.critical
                  ? "bg-red-950/60 border border-red-500/50 text-red-200 rounded-tl-sm"
                  : "bg-slate-800/80 text-slate-200 rounded-tl-sm"
            }`}>
              {msg.critical && <p className="text-red-400 text-xs font-bold mb-1">🚨 SHOSHILINCH</p>}
              <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              <p className="text-xs opacity-40 mt-1 text-right">{msg.time}</p>
            </div>
            {msg.role === 'user' && (
              <span className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-xs shrink-0 mt-0.5">👨‍⚕️</span>
            )}
          </div>
        ))}
        {interim && (
          <div className="flex justify-end">
            <div className="bg-slate-700/50 rounded-2xl rounded-tr-sm px-3 py-2 text-sm text-slate-400 italic max-w-[80%]">
              {interim}▋
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      {sessionId ? (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              onClick={isListening ? stopListening : startListening}
              disabled={isThinking}
              className={`flex-1 py-2.5 rounded-2xl font-semibold text-sm transition-all active:scale-95 ${
                isListening
                  ? "bg-red-600 text-white animate-pulse"
                  : "bg-sky-600 hover:bg-sky-500 text-white"
              } disabled:opacity-40`}>
              {isListening ? "🔴 Eshitmoqda..." : "🎙 Savol Berish"}
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="text" value={textInput}
              onChange={e => setTextInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(textInput); setTextInput(''); } }}
              placeholder="Yoki yozing... (Enter)"
              className="flex-1 rounded-xl bg-slate-800/60 border border-slate-600/30 text-slate-200 placeholder-slate-500 px-3 py-2 text-sm focus:outline-none focus:border-sky-500"
            />
            <button onClick={() => { sendMessage(textInput); setTextInput(''); }}
              disabled={!textInput.trim() || isThinking}
              className="px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-40">▶</button>
          </div>
        </div>
      ) : (
        <p className="text-center text-slate-500 text-sm py-2">Sessiya yuklanmoqda...</p>
      )}
    </div>
  );
};
