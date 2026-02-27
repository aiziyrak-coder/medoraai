/**
 * ZiyrakSurgery — Operatsiya Xonasi Rejimi
 * ==========================================
 * Hands-free, faqat ovoz bilan boshqariladi.
 * Favqulodda protokollar darhol taqdim etiladi.
 * Operatsiya logi real-vaqtda yoziladi.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { ZiyrakState } from './ZiyrakDashboard';
import { AudioWaveform } from '../jarvis/AudioWaveform';
import { getMicStreamWithNoiseFilter } from '../../services/wakeWordDetector';
import { API_BASE_URL } from '../../services/api';

interface SurgeryLogEntry {
  t:          number;
  ts:         string;
  speaker:    string;
  text:       string;
  event_type: string;
}

interface EmergencyResult {
  protocol_name:    string;
  steps:            string[];
  emergency_call:   string;
  protocol_summary: string;
  detailed_response: string;
  audio_base64?:    string;
}

interface Props {
  language:      "uz-L" | "uz-C" | "ru" | "en";
  onError:       (msg: string) => void;
  onStateChange?: (state: ZiyrakState) => void;
}

const OPERATION_TYPES = [
  "Umumiy jarrohlik",
  "Laparoskopik jarrohlik",
  "Kardiojarrohlik",
  "Neyroxirurgiya",
  "Ortopediya",
  "Urologia jarrohlik",
  "Ginekologiya jarrohlik",
  "Travmatologiya",
];

const EMERGENCY_TYPES = [
  { key: "qon_ketish",           label: "🩸 Qon Ketish",          color: "border-red-600 text-red-300" },
  { key: "anesteziya_muammosi",  label: "💉 Anesteziya Asorat",    color: "border-orange-600 text-orange-300" },
  { key: "yurak_toxtatish",      label: "💔 Yurak To'xtashi",      color: "border-red-700 text-red-200" },
  { key: "nafas_etishmovchiligi",label: "🫁 Nafas Etishmovchiligi",color: "border-amber-600 text-amber-300" },
  { key: "septik_shok",          label: "🦠 Septik Shok",          color: "border-violet-600 text-violet-300" },
];

export const ZiyrakSurgery: React.FC<Props> = ({ language, onError, onStateChange }) => {
  const [sessionId,       setSessionId]       = useState<string | null>(null);
  const [opType,          setOpType]          = useState(OPERATION_TYPES[0]);
  const [isSetup,         setIsSetup]         = useState(false);
  const [isListening,     setIsListening]     = useState(false);
  const [isProcessing,    setIsProcessing]    = useState(false);
  const [log,             setLog]             = useState<SurgeryLogEntry[]>([]);
  const [lastResponse,    setLastResponse]    = useState('');
  const [emergency,       setEmergency]       = useState<EmergencyResult | null>(null);
  const [analyser,        setAnalyser]        = useState<AnalyserNode | null>(null);
  const [micStream,       setMicStream]       = useState<MediaStream | null>(null);
  const [bgListening,     setBgListening]     = useState(false);

  const recognitionRef    = useRef<SpeechRecognition | null>(null);
  const bgRecognitionRef  = useRef<SpeechRecognition | null>(null);
  const currentAudioRef   = useRef<HTMLAudioElement | null>(null);
  const logScrollRef      = useRef<HTMLDivElement>(null);

  const token = localStorage.getItem('access_token') || '';

  useEffect(() => {
    if (logScrollRef.current)
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
  }, [log]);

  // Sessiya yaratish
  const startSurgery = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE_URL}/ziyrak/surgery/session/create/`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ language, operation_type: opType }),
      });
      const data = await resp.json() as {
        success?: boolean;
        data?: { session_id?: string; greeting?: string };
      };
      if (data.success && data.data?.session_id) {
        setSessionId(data.data.session_id);
        setIsSetup(true);
        if (data.data.greeting) {
          setLastResponse(data.data.greeting);
          await speak(data.data.greeting);
        }
        // Fon tinglashni boshlash
        startBackgroundMonitor(data.data.session_id);
      }
    } catch (e) {
      onError(String(e));
    }
  }, [language, opType, onError, token]);

  // Background Monitor (barcha muloqotni yozib borish)
  const startBackgroundMonitor = useCallback((sid: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const localeMap: Record<string,string> = { "uz-L":"uz-UZ","uz-C":"uz-UZ","ru":"ru-RU","en":"en-US" };
    const rec = new SR() as SpeechRecognition;
    rec.lang           = localeMap[language] || "uz-UZ";
    rec.continuous     = true;
    rec.interimResults = false;

    rec.onresult = async (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal && result[0].transcript.trim()) {
          const text = result[0].transcript.trim();
          // Loga qo'shish
          const entry: SurgeryLogEntry = {
            t:          Date.now() / 1000,
            ts:         new Date().toLocaleTimeString(),
            speaker:    "room",
            text,
            event_type: "room_audio",
          };
          setLog(prev => [...prev, entry]);

          // Backend'ga transkript
          fetch(`${API_BASE_URL}/ziyrak/transcript/add/`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body:    JSON.stringify({ session_id: sid, text, speaker: "room" }),
          }).catch(() => {});
        }
      }
    };
    rec.onend = () => {
      if (bgListening) try { rec.start(); } catch { /* ignore */ }
    };
    rec.start();
    bgRecognitionRef.current = rec;
    setBgListening(true);
  }, [language, token, bgListening]);

  // Ovozli buyruq — Press-to-command
  const startCommand = useCallback(async () => {
    if (isListening) return;

    try {
      const { stream, audioContext } = await getMicStreamWithNoiseFilter(true);
      const an = audioContext.createAnalyser();
      an.fftSize = 256;
      audioContext.createMediaStreamSource(stream).connect(an);
      setAnalyser(an);
      setMicStream(stream);
    } catch { /* fallback: no waveform */ }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { onError("STT qo'llab-quvvatlanmaydi"); return; }

    const localeMap: Record<string,string> = { "uz-L":"uz-UZ","uz-C":"uz-UZ","ru":"ru-RU","en":"en-US" };
    const rec = new SR() as SpeechRecognition;
    rec.lang           = localeMap[language] || "uz-UZ";
    rec.continuous     = false;
    rec.interimResults = false;

    rec.onresult = async (event: SpeechRecognitionEvent) => {
      const text = event.results[0]?.[0]?.transcript?.trim();
      if (!text || !sessionId) return;
      setIsListening(false);
      setAnalyser(null);
      await sendCommand(text);
    };
    rec.onend = () => { setIsListening(false); setAnalyser(null); };
    rec.start();
    recognitionRef.current = rec;
    setIsListening(true);
    onStateChange?.('listening');
  }, [isListening, language, sessionId, onError, onStateChange]);

  const sendCommand = useCallback(async (command: string) => {
    if (!sessionId) return;
    setIsProcessing(true);
    onStateChange?.('active');

    const entry: SurgeryLogEntry = {
      t: Date.now()/1000, ts: new Date().toLocaleTimeString(),
      speaker: "doctor", text: command, event_type: "voice_command",
    };
    setLog(prev => [...prev, entry]);

    try {
      const resp = await fetch(`${API_BASE_URL}/ziyrak/surgery/command/`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({
          session_id: sessionId, command, language,
          with_tts: true,
        }),
      });
      const data = await resp.json() as {
        success?: boolean;
        data?: { response?: string; is_emergency?: boolean; audio_base64?: string; full_steps?: string[] };
      };
      if (data.success && data.data) {
        const d = data.data;
        setLastResponse(d.response || '');
        const respEntry: SurgeryLogEntry = {
          t: Date.now()/1000, ts: new Date().toLocaleTimeString(),
          speaker: "ziyrak", text: d.response || '', event_type: "ai_response",
        };
        setLog(prev => [...prev, respEntry]);

        if (d.audio_base64) {
          await speak(d.audio_base64, true);
        } else if (d.response) {
          await ttsSpeak(d.response);
        }
      }
    } catch (e) {
      onError(String(e));
    } finally {
      setIsProcessing(false);
      onStateChange?.('sleeping');
    }
  }, [sessionId, language, token, onError, onStateChange]);

  const triggerEmergency = useCallback(async (emergencyType: string) => {
    if (!sessionId) return;
    setIsProcessing(true);
    onStateChange?.('active');

    try {
      const resp = await fetch(`${API_BASE_URL}/ziyrak/surgery/emergency/`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({
          session_id: sessionId || 'unknown',
          emergency_type: emergencyType, language, with_tts: true,
        }),
      });
      const data = await resp.json() as {
        success?: boolean;
        data?: EmergencyResult & { audio_base64?: string };
      };
      if (data.success && data.data) {
        setEmergency(data.data);
        if (data.data.audio_base64) {
          await speak(data.data.audio_base64, true);
        } else if (data.data.protocol_summary) {
          await ttsSpeak(data.data.protocol_summary);
        }
      }
    } catch (e) {
      onError(String(e));
    } finally {
      setIsProcessing(false);
    }
  }, [sessionId, language, token, onError, onStateChange]);

  // Audio helpers
  const speak = useCallback(async (base64OrUrl: string, isBase64 = true) => {
    onStateChange?.('speaking');
    return new Promise<void>((resolve) => {
      let url = base64OrUrl;
      if (isBase64) {
        const bytes  = atob(base64OrUrl);
        const buffer = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i);
        const blob = new Blob([buffer], { type: 'audio/mpeg' });
        url  = URL.createObjectURL(blob);
      }
      const audio = new Audio(url);
      currentAudioRef.current = audio;
      audio.onended  = () => { if (isBase64) URL.revokeObjectURL(url); onStateChange?.('active'); resolve(); };
      audio.onerror  = () => { if (isBase64) URL.revokeObjectURL(url); resolve(); };
      audio.play().catch(() => resolve());
    });
  }, [onStateChange]);

  const ttsSpeak = useCallback(async (text: string) => {
    try {
      const resp = await fetch(`${API_BASE_URL}/ziyrak/speech/tts/`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ text, language, voice_mode: true }),
      });
      const data = await resp.json() as { data?: { audio_base64?: string } };
      if (data.data?.audio_base64) await speak(data.data.audio_base64, true);
    } catch { /* ignore */ }
  }, [language, token, speak]);

  const stopAudio = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
  };

  if (!isSetup) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl bg-red-950/20 border border-red-700/40 p-4">
          <h3 className="font-bold text-red-300 mb-2 flex items-center gap-2">
            🩺 Operatsiya Xonasiga Kirish
          </h3>
          <p className="text-slate-400 text-xs mb-3">
            Ziyrak operatsiya davomida fon tinglash va hands-free yordam rejimiga o'tadi.
          </p>
        </div>

        {/* Operation type */}
        <div>
          <label className="text-slate-400 text-xs mb-2 block">Operatsiya Turi:</label>
          <select
            value={opType}
            onChange={e => setOpType(e.target.value)}
            className="w-full rounded-xl bg-slate-800/60 border border-slate-600/30 text-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-sky-500"
          >
            {OPERATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <button
          onClick={startSurgery}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-700 to-red-600
                     text-white font-bold text-base hover:opacity-90 active:scale-95 transition-all"
        >
          🩺 Operatsiya Xonasiga Kirish
        </button>

        <p className="text-xs text-slate-500 text-center">
          Kirish bilan mikrofon ruxsati so'raladi va fon tinglash boshlanadi
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Surgery header */}
      <div className="rounded-2xl bg-red-950/30 border border-red-700/40 p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-red-300 text-sm">🩺 Operatsiya Rejimi — FAOL</p>
            <p className="text-slate-400 text-xs">{opType}</p>
          </div>
          <div className="flex items-center gap-2">
            {bgListening && (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Fon eshitmoqda
              </span>
            )}
            <button onClick={stopAudio} className="text-xs text-slate-500 hover:text-white">⏹</button>
          </div>
        </div>
      </div>

      {/* Waveform */}
      <div className={`rounded-xl p-2 border transition-colors ${
        isListening ? "border-sky-500/50 bg-sky-950/20" : "border-slate-700/30 bg-slate-800/30"
      }`}>
        <AudioWaveform analyser={analyser} isActive={isListening} color={isListening ? "#ef4444" : "#475569"} height={40} />
      </div>

      {/* Last response */}
      {lastResponse && (
        <div className="rounded-xl bg-slate-800/60 border border-slate-700/30 p-3">
          <p className="text-xs text-slate-500 mb-1">🤖 Ziyrak:</p>
          <p className="text-slate-200 text-sm">{lastResponse}</p>
        </div>
      )}

      {/* HANDS-FREE Command button */}
      <button
        onPointerDown={startCommand}
        onPointerUp={() => {
          recognitionRef.current?.stop();
          setIsListening(false);
        }}
        disabled={isProcessing}
        className={`w-full py-5 rounded-2xl font-bold text-base transition-all select-none
          ${isListening
            ? "bg-red-600 text-white shadow-lg shadow-red-500/30 scale-95"
            : "bg-slate-700 hover:bg-slate-600 text-white active:scale-95"
          } disabled:opacity-50`}
      >
        {isListening
          ? "🔴 Eshitmoqda... (qo'yib yuboring)"
          : isProcessing
            ? "⟳ Jarayonda..."
            : "🎙 BUYRUQ BERISH\n(Bosib tuting)"}
      </button>

      {/* Emergency buttons */}
      <div>
        <p className="text-xs text-slate-500 mb-2 font-medium">⚡ FAVQULODDA PROTOKOLLAR:</p>
        <div className="grid grid-cols-2 gap-2">
          {EMERGENCY_TYPES.map(et => (
            <button
              key={et.key}
              onClick={() => triggerEmergency(et.key)}
              disabled={isProcessing}
              className={`py-3 px-3 rounded-xl border text-xs font-bold bg-slate-900/60
                          hover:bg-slate-800 active:scale-95 transition-all disabled:opacity-40
                          ${et.color}`}
            >
              {et.label}
            </button>
          ))}
        </div>
      </div>

      {/* Emergency result */}
      {emergency && (
        <div className="rounded-2xl bg-red-950/50 border-2 border-red-500 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-red-200 text-sm">🚨 {emergency.protocol_name}</h4>
            <button onClick={() => setEmergency(null)} className="text-slate-500 text-lg">×</button>
          </div>
          <div className="space-y-1">
            {emergency.steps.slice(0,5).map((step, i) => (
              <p key={i} className="text-red-100 text-xs bg-red-900/30 rounded-lg px-2 py-1">{step}</p>
            ))}
          </div>
          <p className="text-red-300 font-bold text-sm">📞 {emergency.emergency_call}</p>
          {emergency.detailed_response && (
            <p className="text-slate-300 text-xs border-t border-red-800/50 pt-2">
              {emergency.detailed_response}
            </p>
          )}
        </div>
      )}

      {/* Surgery Log */}
      {log.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-1">📋 Operatsiya Logi ({log.length}):</p>
          <div ref={logScrollRef}
            className="max-h-40 overflow-y-auto rounded-xl bg-slate-900/60 border border-slate-700/30 p-2 space-y-1">
            {log.slice(-20).map((entry, i) => (
              <div key={i} className="flex gap-2 text-xs">
                <span className={`shrink-0 font-medium ${
                  entry.speaker === "doctor" ? "text-sky-400" :
                  entry.speaker === "ziyrak" ? "text-emerald-400" :
                  "text-slate-500"
                }`}>
                  [{entry.ts}] {entry.speaker.toUpperCase()}
                </span>
                <span className="text-slate-400 truncate">{entry.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
