/**
 * ZiyrakConsultation вЂ” Passiv Konsultatsiya Monitori
 * Shifokor-bemor suhbatini yozib oladi va real-vaqt transkript yaratadi.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { PatientData } from '../../types';
import type { ZiyrakState } from './ZiyrakDashboard';
import { AudioWaveform } from '../jarvis/AudioWaveform';
import { apiPost, API_BASE_URL } from '../../services/api';
import { getMicStreamWithNoiseFilter } from '../../services/wakeWordDetector';

interface TranscriptLine {
  id:      string;
  speaker: 'doctor' | 'patient' | 'system';
  text:    string;
  time:    string;
}

interface Props {
  patientData?:   PatientData;
  language:       "uz-L" | "uz-C" | "ru" | "en";
  sessionId:      string | null;
  onSessionId:    (id: string) => void;
  onError:        (msg: string) => void;
  onStateChange?: (state: ZiyrakState) => void;
}

const SPEAKERS = {
  doctor:  { label: "рџ‘ЁвЂЌвљ•пёЏ Shifokor", color: "text-sky-400" },
  patient: { label: "рџ§‘ Bemor",     color: "text-violet-400" },
  system:  { label: "рџ¤– Ziyrak",    color: "text-emerald-400" },
};

export const ZiyrakConsultation: React.FC<Props> = ({
  patientData, language, sessionId, onSessionId, onError, onStateChange,
}) => {
  const [isListening,  setIsListening]  = useState(false);
  const [transcript,   setTranscript]   = useState<TranscriptLine[]>([]);
  const [interim,      setInterim]      = useState('');
  const [speaker,      setSpeaker]      = useState<'doctor' | 'patient'>('doctor');
  const [duration,     setDuration]     = useState(0);
  const [diagnosing,   setDiagnosing]   = useState(false);
  const [diagnosis,    setDiagnosis]    = useState<Record<string, unknown> | null>(null);
  const [alertMsg,     setAlertMsg]     = useState('');
  const [analyser,     setAnalyser]     = useState<AnalyserNode | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef      = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [transcript, interim]);

  const startListening = useCallback(async () => {
    try {
      // Noise filtered mic stream
      const { stream, audioContext } = await getMicStreamWithNoiseFilter(false);
      const analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 256;
      audioContext.createMediaStreamSource(stream).connect(analyserNode);
      setAnalyser(analyserNode);

      // Speech Recognition
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) { onError("Brauzer STT ni qo'llab-quvvatlamaydi"); return; }

      const rec = new SR() as SpeechRecognition;
      const localeMap: Record<string, string> = {
        "uz-L": "uz-UZ", "uz-C": "uz-UZ", "ru": "ru-RU", "en": "en-US",
      };
      rec.lang           = localeMap[language] || "uz-UZ";
      rec.continuous     = true;
      rec.interimResults = true;

      rec.onresult = async (event: SpeechRecognitionEvent) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal && result[0].transcript.trim()) {
            const text = result[0].transcript.trim();
            setInterim('');
            const line: TranscriptLine = {
              id:      `ln-${Date.now()}`,
              speaker,
              text,
              time:    new Date().toLocaleTimeString(),
            };
            setTranscript(prev => [...prev, line]);

            // Backend'ga yuborish
            if (sessionId) {
              const token = localStorage.getItem("access_token") || "";
              fetch(`${API_BASE_URL}/ziyrak/transcript/add/`, {
                method:  "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body:    JSON.stringify({ session_id: sessionId, text, speaker }),
              }).then(r => r.json()).then(data => {
                const d = data as { data?: { is_critical?: boolean; alert?: string } };
                if (d?.data?.is_critical && d?.data?.alert) {
                  setAlertMsg(d.data.alert);
                  setTimeout(() => setAlertMsg(''), 8000);
                }
              }).catch(() => {});
            }
          } else if (!result.isFinal) {
            setInterim(result[0].transcript);
          }
        }
      };

      rec.onend = () => {
        if (isListening) {
          try { rec.start(); } catch { setIsListening(false); }
        }
      };

      rec.start();
      recognitionRef.current = rec;
      timerRef.current = setInterval(() => setDuration(p => p + 1), 1000);
      setIsListening(true);
      onStateChange?.("active");
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    }
  }, [sessionId, speaker, language, isListening, onError, onStateChange]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    setIsListening(false);
    setAnalyser(null);
    setInterim('');
    onStateChange?.("sleeping");
  }, [onStateChange]);

  const handleDiagnosis = useCallback(async () => {
    if (!sessionId) return;
    setDiagnosing(true);
    try {
      const token = localStorage.getItem("access_token") || "";
      const resp  = await fetch(`${API_BASE_URL}/ziyrak/diagnosis/`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ session_id: sessionId, language }),
      });
      const data = await resp.json() as { success?: boolean; data?: Record<string, unknown> };
      if (data.success && data.data) setDiagnosis(data.data);
    } catch (e) {
      onError(String(e));
    } finally {
      setDiagnosing(false);
    }
  }, [sessionId, language, onError]);

  const formatDur = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  return (
    <div className="flex flex-col gap-3">
      {/* Alert */}
      {alertMsg && (
        <div className="rounded-2xl bg-red-950/60 border border-red-500 p-3 flex gap-2 animate-pulse">
          <span className="text-2xl">рџљЁ</span>
          <p className="text-red-200 text-sm">{alertMsg}</p>
        </div>
      )}

      {/* Waveform */}
      <div className={`rounded-2xl p-3 border ${
        isListening ? "border-sky-500/50 bg-sky-950/20" : "border-slate-700/30 bg-slate-800/40"
      }`}>
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs font-medium ${isListening ? "text-sky-400" : "text-slate-500"}`}>
            {isListening ? `рџ”ґ ${formatDur(duration)}` : "Tayyorlanmoqda..."}
          </span>
          <span className="text-xs text-slate-500">{transcript.length} gap</span>
        </div>
        <AudioWaveform analyser={analyser} isActive={isListening} color={isListening ? "#38bdf8" : "#475569"} height={48} />
      </div>

      {/* Speaker toggle */}
      <div className="flex gap-2">
        {(["doctor","patient"] as const).map(sp => (
          <button key={sp} onClick={() => setSpeaker(sp)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
              speaker === sp
                ? sp === "doctor" ? "bg-sky-600 text-white" : "bg-violet-600 text-white"
                : "bg-slate-800/60 text-slate-400"
            }`}>
            {SPEAKERS[sp].label}
          </button>
        ))}
      </div>

      {/* Controls */}
      <button
        onClick={isListening ? stopListening : startListening}
        className={`w-full py-3 rounded-2xl font-semibold text-sm transition-all active:scale-95 ${
          isListening ? "bg-red-600 hover:bg-red-500 text-white" : "bg-sky-600 hover:bg-sky-500 text-white"
        }`}>
        {isListening ? "вЏ№ Tinglashni To'xtatish" : "рџЋ™ Tinglashni Boshlash"}
      </button>

      {/* Transcript */}
      {(transcript.length > 0 || interim) && (
        <div ref={scrollRef} className="max-h-56 overflow-y-auto rounded-2xl bg-slate-900/60 border border-slate-700/30 p-3 space-y-2">
          {transcript.map(line => (
            <div key={line.id} className="flex gap-2 text-sm">
              <span className={`shrink-0 text-xs font-medium mt-0.5 ${SPEAKERS[line.speaker].color}`}>
                {SPEAKERS[line.speaker].label}
              </span>
              <div className="flex-1">
                <span className="text-slate-200">{line.text}</span>
                <span className="ml-2 text-xs text-slate-600">{line.time}</span>
              </div>
            </div>
          ))}
          {interim && (
            <div className="flex gap-2 text-sm opacity-60">
              <span className={`shrink-0 text-xs font-medium mt-0.5 ${SPEAKERS[speaker].color}`}>
                {SPEAKERS[speaker].label}
              </span>
              <span className="text-slate-400 italic">{interim}в–‹</span>
            </div>
          )}
        </div>
      )}

      {/* Diagnosis */}
      {!isListening && transcript.length > 3 && !diagnosis && (
        <button onClick={handleDiagnosis} disabled={diagnosing}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-sky-600 text-white font-semibold disabled:opacity-50">
          {diagnosing ? "вџі Ziyrak tahlil qilmoqda..." : "рџ§  Ziyrak Tashxis Qo'ysin"}
        </button>
      )}

      {/* Diagnosis result */}
      {diagnosis && (
        <div className="rounded-2xl bg-emerald-950/30 border border-emerald-500/30 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-emerald-300 text-sm">рџ§  Ziyrak Tashxis Xulosasi</h4>
            <button onClick={() => setDiagnosis(null)} className="text-slate-500 text-lg">Г—</button>
          </div>
          {diagnosis.patient_complaints_summary && (
            <p className="text-slate-300 text-sm">{String(diagnosis.patient_complaints_summary)}</p>
          )}
          {diagnosis.primary_diagnosis && (
            <div className="p-2 rounded-xl bg-slate-800/60">
              <p className="text-white text-sm font-medium">
                {String((diagnosis.primary_diagnosis as Record<string,unknown>).name || '')}
                <span className="ml-2 text-emerald-400">
                  {String((diagnosis.primary_diagnosis as Record<string,unknown>).probability || '')}%
                </span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};