/**
 * ConsultationMonitor вЂ” Passiv Tinglash Rejimi
 * ================================================
 * Doktor va bemor suhbatini yozib oladi va real-vaqtda transkript yaratadi.
 *
 * Flow:
 *  "Tinglashni Boshlash" в†’ mic yoqiladi в†’ STT ishlaydi в†’
 *  transkript to'planadi в†’ "Yakunlash" в†’ auto-diagnosis
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { PatientData } from '../../types';
import type { SpeechLanguage, ConsultationDiagnosis } from '../../services/speechService';
import {
  RealtimeSTT, AudioRecorder, AudioWaveform,
  addTranscriptChunk, generateConsultationDiagnosis,
  createJarvisSession, endJarvisSession,
  speakText, stopSpeaking,
} from '../../services/speechService';

// Re-export AudioWaveform for use here
import { AudioWaveform as WaveformComponent } from './AudioWaveform';

interface Props {
  patientData: PatientData;
  language:    SpeechLanguage;
  sessionId:   string | null;
  onSessionId: (id: string) => void;
  onDiagnosis: (d: ConsultationDiagnosis) => void;
  onError:     (msg: string) => void;
}

interface TranscriptLine {
  id:      string;
  speaker: 'doctor' | 'patient' | 'system';
  text:    string;
  time:    string;
  interim: boolean;
}

const SPEAKER_LABELS: Record<string, Record<string, string>> = {
  'uz-L': { doctor: 'Shifokor', patient: 'Bemor', system: 'Tizim' },
  ru:     { doctor: 'Врач',     patient: 'Пациент', system: 'Система' },
  en:     { doctor: 'Doctor',   patient: 'Patient', system: 'System' },
};

export const ConsultationMonitor: React.FC<Props> = ({
  patientData, language, sessionId, onSessionId, onDiagnosis, onError,
}) => {
  const [isListening,  setIsListening]  = useState(false);
  const [transcript,   setTranscript]   = useState<TranscriptLine[]>([]);
  const [interim,      setInterim]      = useState('');
  const [currentSpeaker, setSpeaker]    = useState<'doctor' | 'patient'>('doctor');
  const [duration,     setDuration]     = useState(0);
  const [diagnosing,   setDiagnosing]   = useState(false);
  const [alertMsg,     setAlertMsg]     = useState('');
  const [analyser,     setAnalyser]     = useState<AnalyserNode | null>(null);

  const sttRef      = useRef<RealtimeSTT | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef   = useRef<HTMLDivElement>(null);

  const labels = SPEAKER_LABELS[language] || SPEAKER_LABELS['uz-L'];
  const wordCount = transcript.reduce((s, l) => s + l.text.split(' ').length, 0);

  // Auto-scroll transcript
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript, interim]);

  const startListening = useCallback(async () => {
    try {
      // Create Jarvis session if not exists
      let sid = sessionId;
      if (!sid) {
        const resp = await createJarvisSession(language, patientData as unknown as Record<string, unknown>);
        if (!resp.success || !resp.data) throw new Error('Sessiya yaratishda xatolik');
        sid = resp.data.session_id;
        onSessionId(sid);
      }

      // Start audio recorder (for backup & batch STT)
      const recorder = new AudioRecorder();
      await recorder.start();
      recorderRef.current = recorder;
      if (recorder.analyser) setAnalyser(recorder.analyser);

      // Start real-time STT
      const stt = new RealtimeSTT(language);
      sttRef.current = stt;

      stt.start(
        async (text, isFinal) => {
          if (isFinal && text.trim()) {
            const line: TranscriptLine = {
              id:      `line-${Date.now()}`,
              speaker: currentSpeaker,
              text:    text.trim(),
              time:    new Date().toLocaleTimeString(),
              interim: false,
            };
            setTranscript(prev => [...prev, line]);
            setInterim('');

            // Backend'ga yuborish
            const res = await addTranscriptChunk(sid!, text, currentSpeaker);
            if (res.success && (res.data as { is_critical?: boolean; alert?: string })?.is_critical) {
              const alert = (res.data as { alert?: string })?.alert || '';
              setAlertMsg(alert);
              setTimeout(() => setAlertMsg(''), 8000);
            }
          } else if (!isFinal) {
            setInterim(text);
          }
        },
        (err) => onError(err),
        true, // continuous
      );

      // Duration timer
      timerRef.current = setInterval(() => setDuration(p => p + 1), 1000);
      setIsListening(true);

    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }, [sessionId, language, patientData, currentSpeaker, onSessionId, onError]);

  const stopListening = useCallback(async () => {
    sttRef.current?.stop();
    sttRef.current = null;

    if (recorderRef.current) {
      await recorderRef.current.stop();
      recorderRef.current = null;
    }

    if (timerRef.current) clearInterval(timerRef.current);
    setIsListening(false);
    setAnalyser(null);
    setInterim('');
  }, []);

  const handleDiagnosis = useCallback(async () => {
    if (!sessionId) return;
    setDiagnosing(true);
    try {
      const resp = await generateConsultationDiagnosis(sessionId, language);
      if (!resp.success || !resp.data) throw new Error('Tashxis xatosi');
      onDiagnosis(resp.data);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setDiagnosing(false);
    }
  }, [sessionId, language, onDiagnosis, onError]);

  const clearTranscript = () => {
    setTranscript([]);
    setDuration(0);
  };

  const formatDuration = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : 'bg-slate-500'}`} />
            Konsultatsiya Monitoringi
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Suhbatni real-vaqtda matnlashtirish
          </p>
        </div>
        <span className="text-sky-400 font-mono text-sm">
          {isListening ? `рџ”ґ ${formatDuration(duration)}` : formatDuration(duration)}
        </span>
      </div>

      {/* Critical Alert */}
      {alertMsg && (
        <div className="rounded-2xl bg-red-950/60 border border-red-500 p-3 flex items-center gap-2 animate-pulse">
          <span className="text-2xl">рџљЁ</span>
          <p className="text-red-200 text-sm font-medium">{alertMsg}</p>
        </div>
      )}

      {/* Waveform */}
      <div className={`rounded-2xl p-3 border transition-colors ${
        isListening ? 'border-sky-500/50 bg-sky-950/20' : 'border-slate-700/30 bg-slate-800/40'
      }`}>
        <WaveformComponent
          analyser={analyser}
          isActive={isListening}
          color={isListening ? '#38bdf8' : '#64748b'}
          height={56}
        />
      </div>

      {/* Speaker toggle */}
      <div className="flex gap-2">
        {(['doctor', 'patient'] as const).map(sp => (
          <button
            key={sp}
            onClick={() => setSpeaker(sp)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
              currentSpeaker === sp
                ? (sp === 'doctor' ? 'bg-sky-600 text-white' : 'bg-violet-600 text-white')
                : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700/60'
            }`}
          >
            {labels[sp]}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        <button
          onClick={isListening ? stopListening : startListening}
          className={`flex-1 py-3 rounded-2xl font-semibold text-sm transition-all active:scale-95 ${
            isListening
              ? 'bg-red-600 hover:bg-red-500 text-white'
              : 'bg-sky-600 hover:bg-sky-500 text-white'
          }`}
        >
          {isListening ? 'вЏ№ Tinglashni To\'xtatish' : 'рџЋ™ Tinglashni Boshlash'}
        </button>
        {!isListening && transcript.length > 0 && (
          <button
            onClick={clearTranscript}
            className="px-4 py-3 rounded-2xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm"
          >
            рџ—‘
          </button>
        )}
      </div>

      {/* Transcript */}
      {(transcript.length > 0 || interim) && (
        <div
          ref={scrollRef}
          className="max-h-60 overflow-y-auto rounded-2xl bg-slate-900/60 border border-slate-700/30 p-3 space-y-2"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 font-mono">
              {wordCount} so'z В· {transcript.length} gap
            </span>
          </div>
          {transcript.map(line => (
            <div key={line.id} className="flex gap-2 text-sm">
              <span className={`shrink-0 text-xs font-medium mt-0.5 ${
                line.speaker === 'doctor' ? 'text-sky-400' : 'text-violet-400'
              }`}>
                {labels[line.speaker]}
              </span>
              <div className="flex-1">
                <span className="text-slate-200">{line.text}</span>
                <span className="ml-2 text-xs text-slate-600">{line.time}</span>
              </div>
            </div>
          ))}
          {interim && (
            <div className="flex gap-2 text-sm opacity-60">
              <span className={`shrink-0 text-xs font-medium mt-0.5 ${
                currentSpeaker === 'doctor' ? 'text-sky-400' : 'text-violet-400'
              }`}>
                {labels[currentSpeaker]}
              </span>
              <span className="text-slate-400 italic">{interim}в–‹</span>
            </div>
          )}
        </div>
      )}

      {/* Diagnosis button */}
      {!isListening && transcript.length > 3 && (
        <button
          onClick={handleDiagnosis}
          disabled={diagnosing}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-sky-600
                     text-white font-semibold hover:opacity-90 active:scale-95
                     transition-all disabled:opacity-50"
        >
          {diagnosing ? 'вџі Tashxis yaratilmoqda...' : 'рџ§  Tashxis Qo\'yish (AI Tahlil)'}
        </button>
      )}
    </div>
  );
};

export default ConsultationMonitor;