/**
 * DoctorSupportView вЂ“ Doktorlar uchun Tezkor Yordamchi
 * GPT-4o + O'zbekiston SSV protokollari + real-time SSE streaming
 */
import React, { useState, useRef, useCallback } from 'react';
import type { PatientData } from '../types';
import {
  runDoctorSupport,
  runDoctorSupportStream,
  type DoctorSupportResult,
  type DoctorTaskType,
  TASK_QUICK_CONSULT,
  TASK_DIAGNOSIS,
  TASK_TREATMENT,
  TASK_DRUG_CHECK,
  TASK_LAB_INTERPRET,
  TASK_FOLLOW_UP,
} from '../services/apiAiService';
import { runDoctorSupportViaGemini } from '../services/aiCouncilService';
import { isApiConfigured } from '../config/api';

interface Props {
  patientData: PatientData;
  language:    string;
  onError:     (msg: string) => void;
}

const TASK_OPTIONS: Array<{ value: DoctorTaskType; label: string; icon: string; desc: string }> = [
  { value: TASK_QUICK_CONSULT,  icon: 'вљЎ', label: 'Tezkor Maslahat',    desc: 'Tez tashxis va choralar' },
  { value: TASK_DIAGNOSIS,      icon: 'рџ”Ќ', label: 'Differensial Tashxis', desc: '3вЂ“5 ta tashxis + ehtimollik' },
  { value: TASK_TREATMENT,      icon: 'рџ’Љ', label: 'Davolash Rejasi',     desc: 'To\'liq SSV protokol rejasi' },
  { value: TASK_DRUG_CHECK,     icon: 'вљ—',  label: 'Dori Tekshiruvi',     desc: 'O\'zaro ta\'sir + xavfsizlik' },
  { value: TASK_LAB_INTERPRET,  icon: 'рџ§Є', label: 'Lab Tahlili',         desc: 'Laboratoriya natijalarini izohlash' },
  { value: TASK_FOLLOW_UP,      icon: 'рџ“…', label: 'Kuzatuv Rejasi',      desc: 'Keyingi qabul va ogohlantirishlar' },
];

function ResultCard({ result }: { result: DoctorSupportResult }) {
  const task = result._task_type;

  if (result.error) {
    return (
      <div className="rounded-2xl bg-red-950/40 border border-red-500/40 p-4 text-red-300 text-sm">
        вљ  {result.error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Critical Alert */}
      {result.critical_alert?.present && (
        <div className="rounded-2xl bg-red-950/50 border border-red-500/60 p-4">
          <p className="font-bold text-red-300 mb-1">рџљЁ Shoshilinch Holat</p>
          <p className="text-red-200 text-sm">{result.critical_alert.message}</p>
        </div>
      )}

      {/* Quick Consult */}
      {task === TASK_QUICK_CONSULT && (
        <>
          {result.summary && (
            <div className="rounded-2xl bg-slate-800/60 border border-slate-600/30 p-4">
              <h4 className="font-semibold text-sky-300 mb-2">рџ“‹ Xulosa</h4>
              <p className="text-slate-200 text-sm">{result.summary}</p>
              {result.primary_diagnosis && (
                <p className="mt-2 text-white font-medium">
                  Tashxis: {result.primary_diagnosis}
                  <span className="ml-2 text-emerald-400 text-sm">{result.probability}%</span>
                </p>
              )}
            </div>
          )}
          {result.immediate_actions && result.immediate_actions.length > 0 && (
            <div className="rounded-2xl bg-slate-800/60 border border-slate-600/30 p-4">
              <h4 className="font-semibold text-amber-300 mb-2">вљЎ Darhol Choralar</h4>
              <ol className="space-y-1">
                {result.immediate_actions.map((a, i) => (
                  <li key={i} className="text-slate-200 text-sm flex gap-2">
                    <span className="text-amber-400 font-mono">{i + 1}.</span> {a}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}

      {/* Diagnosis */}
      {task === TASK_DIAGNOSIS && result.diagnoses && (
        <div className="rounded-2xl bg-slate-800/60 border border-slate-600/30 p-4">
          <h4 className="font-semibold text-sky-300 mb-3">рџ”Ќ Differensial Tashxislar</h4>
          <div className="space-y-3">
            {result.diagnoses.map((d, i) => (
              <div key={i} className="p-3 rounded-xl bg-slate-700/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white font-medium text-sm">{d.name}</span>
                  <span className="text-emerald-400 text-sm font-mono">{d.probability}%</span>
                </div>
                <p className="text-slate-400 text-xs">{d.justification}</p>
                {d.uzbek_protocol && (
                  <p className="text-sky-500 text-xs mt-1">рџ“Њ {d.uzbek_protocol}</p>
                )}
              </div>
            ))}
          </div>
          {result.red_flags && result.red_flags.length > 0 && (
            <div className="mt-3 p-2 rounded-xl bg-red-950/40 border border-red-500/30">
              <p className="text-red-300 text-xs font-semibold">рџљ© Qizil Bayroqlar:</p>
              {result.red_flags.map((f, i) => <p key={i} className="text-red-200 text-xs">· {f}</p>)}
            </div>
          )}
        </div>
      )}

      {/* Treatment */}
      {task === TASK_TREATMENT && (
        <>
          {result.treatment_plan && result.treatment_plan.length > 0 && (
            <div className="rounded-2xl bg-slate-800/60 border border-slate-600/30 p-4">
              <h4 className="font-semibold text-emerald-300 mb-2">рџ“‹ Davolash Rejasi</h4>
              <ol className="space-y-1">
                {result.treatment_plan.map((step, i) => (
                  <li key={i} className="text-slate-200 text-sm flex gap-2">
                    <span className="text-emerald-400 font-mono shrink-0">{i + 1}.</span> {step}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {result.uzbek_protocol_ref && (
            <p className="text-sky-500 text-xs px-1">рџ“Њ {result.uzbek_protocol_ref}</p>
          )}
        </>
      )}

      {/* Drug Check */}
      {task === TASK_DRUG_CHECK && (
        <>
          {result.overall_safety && (
            <div className={`rounded-2xl p-3 text-sm font-semibold ${
              result.overall_safety === 'SAFE'      ? 'bg-emerald-950/40 border border-emerald-500/40 text-emerald-300' :
              result.overall_safety === 'CAUTION'   ? 'bg-amber-950/40 border border-amber-500/40 text-amber-300' :
                                                      'bg-red-950/40 border border-red-500/40 text-red-300'
            }`}>
              {result.overall_safety === 'SAFE' ? 'вњ…' : result.overall_safety === 'CAUTION' ? 'вљ ' : 'рџљ«'}{' '}
              Umumiy xavfsizlik: {result.overall_safety}
            </div>
          )}
          {result.interactions && result.interactions.length > 0 && (
            <div className="rounded-2xl bg-slate-800/60 border border-slate-600/30 p-4">
              <h4 className="font-semibold text-amber-300 mb-2">вљ— O'zaro Ta'sirlar</h4>
              {result.interactions.map((it, i) => (
                <div key={i} className="mb-2 p-2 rounded-lg bg-slate-700/50">
                  <p className="text-white text-xs font-medium">{it.drugs.join(' + ')}</p>
                  <p className="text-slate-400 text-xs">{it.description}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    it.severity === 'HIGH' ? 'bg-red-700 text-white' :
                    it.severity === 'MEDIUM' ? 'bg-amber-700 text-white' :
                    'bg-slate-600 text-slate-200'
                  }`}>{it.severity}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Medications (shared) */}
      {result.medications && result.medications.length > 0 && (
        <div className="rounded-2xl bg-slate-800/60 border border-slate-600/30 p-4">
          <h4 className="font-semibold text-white mb-2">рџ’Љ Dori-darmonlar</h4>
          <div className="space-y-2">
            {result.medications.map((med, i) => (
              <div key={i} className="p-2 rounded-lg bg-slate-700/50">
                <p className="text-white text-sm font-medium">{med.name} вЂ” {med.dosage}</p>
                <p className="text-slate-400 text-xs">{med.frequency}, {med.duration}</p>
                {med.instructions && <p className="text-slate-400 text-xs italic">{med.instructions}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended tests */}
      {result.recommended_tests && result.recommended_tests.length > 0 && (
        <div className="rounded-2xl bg-slate-800/60 border border-slate-600/30 p-4">
          <h4 className="font-semibold text-sky-300 mb-2">рџ§Є Tavsiya Etilgan Tekshiruvlar</h4>
          {result.recommended_tests.map((t, i) => (
            <p key={i} className="text-slate-300 text-sm">· {t}</p>
          ))}
        </div>
      )}

      {/* Follow-up */}
      {result.follow_up && (
        <div className="rounded-2xl bg-slate-800/60 border border-slate-600/30 p-4">
          <h4 className="font-semibold text-slate-300 mb-1">рџ“… Kuzatuv</h4>
          <p className="text-slate-400 text-sm">{result.follow_up}</p>
        </div>
      )}
    </div>
  );
}

export const DoctorSupportView: React.FC<Props> = ({ patientData, language, onError }) => {
  const [taskType,    setTaskType]    = useState<DoctorTaskType>(TASK_QUICK_CONSULT);
  const [query,       setQuery]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [streaming,   setStreaming]   = useState(false);
  const [streamText,  setStreamText]  = useState('');
  const [result,      setResult]      = useState<DoctorSupportResult | null>(null);
  const cancelStreamRef = useRef<(() => void) | null>(null);

  const handleSync = useCallback(async () => {
    setLoading(true);
    setResult(null);
    setStreamText('');
    try {
      if (isApiConfigured()) {
        const resp = await runDoctorSupport(patientData, { query, taskType, language });
        if (resp.success && resp.data) {
          setResult(resp.data);
          return;
        }
      }
      const geminiResult = await runDoctorSupportViaGemini(patientData, { query, taskType, language });
      setResult(geminiResult as DoctorSupportResult);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [patientData, query, taskType, language, onError]);

  const handleStream = useCallback(() => {
    setStreaming(true);
    setResult(null);
    setStreamText('');

    if (isApiConfigured()) {
      const cancel = runDoctorSupportStream(
        patientData,
        { query, taskType, language },
        (text)  => setStreamText(text),
        (full) => {
          setStreaming(false);
          try {
            const cleaned = full.replace(/^```json\s*|```\s*$/g, '').trim();
            const parsed  = JSON.parse(cleaned) as DoctorSupportResult;
            setResult(parsed);
            setStreamText('');
          } catch {
            setResult({ _task_type: taskType, _language: language, error: 'JSON parse xatosi' });
          }
        },
        (err) => {
          setStreaming(false);
          runDoctorSupportViaGemini(patientData, { query, taskType, language })
            .then((geminiResult) => {
              setResult(geminiResult as DoctorSupportResult);
            })
            .catch(() => onError(err));
        },
      );
      cancelStreamRef.current = cancel;
      return;
    }

    runDoctorSupportViaGemini(patientData, { query, taskType, language })
      .then((geminiResult) => {
        setStreaming(false);
        setResult(geminiResult as DoctorSupportResult);
      })
      .catch((err) => {
        setStreaming(false);
        onError(err instanceof Error ? err.message : String(err));
      });
    cancelStreamRef.current = () => { setStreaming(false); };
  }, [patientData, query, taskType, language, onError]);

  const handleStop = () => {
    cancelStreamRef.current?.();
    setStreaming(false);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">вљЎ Doktor Yordamchi</h2>
        <p className="text-sm text-slate-400 mt-0.5">
          Gemini · O'zbekiston SSV Protokollari · Tezkor tahlil
        </p>
      </div>

      {/* Task selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {TASK_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setTaskType(opt.value)}
            className={`rounded-xl p-3 text-left transition-all
              ${taskType === opt.value
                ? 'bg-sky-600 border border-sky-400 text-white'
                : 'bg-slate-800/60 border border-slate-600/30 text-slate-300 hover:border-sky-600/50'}`}
          >
            <span className="text-lg">{opt.icon}</span>
            <p className="text-sm font-medium mt-1 leading-tight">{opt.label}</p>
            <p className="text-xs text-slate-400 leading-tight hidden sm:block">{opt.desc}</p>
          </button>
        ))}
      </div>

      {/* Additional query */}
      <textarea
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Qo'shimcha so'rov yoki savolingiz (ixtiyoriy)..."
        className="w-full rounded-xl bg-slate-800/60 border border-slate-600/30 text-slate-200
                   placeholder-slate-500 p-3 text-sm resize-none focus:outline-none focus:border-sky-500
                   h-20"
      />

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleStream}
          disabled={loading || streaming}
          className="flex-1 py-3 rounded-2xl bg-sky-600 hover:bg-sky-500
                     text-white font-semibold transition-all active:scale-95 disabled:opacity-50"
        >
          {streaming ? 'вџі Javob kelmoqda...' : 'в–¶ Streaming Tahlil'}
        </button>
        <button
          onClick={handleSync}
          disabled={loading || streaming}
          className="px-4 py-3 rounded-2xl bg-slate-700 hover:bg-slate-600
                     text-white font-medium transition-all active:scale-95 disabled:opacity-50"
        >
          {loading ? 'вџі' : 'рџ“Ґ'}
        </button>
        {streaming && (
          <button
            onClick={handleStop}
            className="px-4 py-3 rounded-2xl bg-red-700 hover:bg-red-600 text-white transition-all"
          >
            в– 
          </button>
        )}
      </div>

      {/* Streaming text output */}
      {streamText && (
        <div className="rounded-2xl bg-slate-900/80 border border-slate-600/30 p-4 max-h-64 overflow-y-auto">
          <p className="text-xs text-slate-500 mb-2 font-mono">в—Џ Javob kelmoqda...</p>
          <pre className="text-slate-300 text-xs whitespace-pre-wrap font-mono leading-relaxed">
            {streamText}
          </pre>
        </div>
      )}

      {/* Parsed result */}
      {result && <ResultCard result={result} />}
    </div>
  );
};

export default DoctorSupportView;