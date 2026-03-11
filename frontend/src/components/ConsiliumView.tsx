/**
 * ConsiliumView вЂ“ Multi-Agent Medical Consilium
 * Vizual ko'rsatish: 3 faza progress + professorlar bahsi + yakuniy xulosa
 */
import React, { useState, useRef, useEffect } from 'react';
import type { PatientData, FinalReport } from '../types';
import { runConsilium, type ConsiliumResult, type DebateMessage } from '../services/apiAiService';
import { useTranslation } from '../i18n/LanguageContext';

interface Props {
  patientData: PatientData;
  language:    string;
  onReport:    (report: FinalReport) => void;
  onError:     (msg: string) => void;
}

type PhaseStatus = 'waiting' | 'running' | 'done' | 'error';

interface PhaseState {
  independent: PhaseStatus;
  debate:      PhaseStatus;
  consensus:   PhaseStatus;
}

const PHASE_LABELS: Record<string, Record<string, string>> = {
  'uz-L': {
    independent: '1-Faza: Mustaqil Tahlil',
    debate:      '2-Faza: Bahslar (Cross-Examination)',
    consensus:   '3-Faza: Konsensus Xulosasi',
  },
  ru: {
    independent: 'Р¤Р°Р·Р° 1: РќРµР·Р°РІРёСЃРёРјС‹Р№ Р°РЅР°Р»РёР·',
    debate:      'Р¤Р°Р·Р° 2: Р”РµР±Р°С‚С‹',
    consensus:   'Р¤Р°Р·Р° 3: РљРѕРЅСЃРµРЅСЃСѓСЃ',
  },
  en: {
    independent: 'Phase 1: Independent Analysis',
    debate:      'Phase 2: Cross-Examination',
    consensus:   'Phase 3: Consensus',
  },
};

function getPhaseLabels(lang: string) {
  return PHASE_LABELS[lang] || PHASE_LABELS['uz-L'];
}

const PROFESSOR_COLORS: Record<string, string> = {
  deepseek: 'bg-violet-600',
  llama:    'bg-emerald-600',
  mistral:  'bg-amber-600',
  mini:     'bg-rose-600',
  gpt4o:    'bg-sky-600',
};

const PROFESSOR_ICONS: Record<string, string> = {
  deepseek: 'рџ§ ',
  llama:    'рџ“љ',
  mistral:  'вљ•пёЏ',
  mini:     'рџ’Љ',
  gpt4o:    'рџЋ“',
};

function PhaseIndicator({
  label, status,
}: { label: string; status: PhaseStatus }) {
  const colors: Record<PhaseStatus, string> = {
    waiting: 'bg-slate-700 text-slate-400',
    running: 'bg-blue-600 text-white animate-pulse',
    done:    'bg-emerald-600 text-white',
    error:   'bg-red-600 text-white',
  };
  const icons: Record<PhaseStatus, string> = {
    waiting: 'в—‹',
    running: 'вџі',
    done:    'вњ“',
    error:   'вњ—',
  };
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${colors[status]}`}>
      <span>{icons[status]}</span>
      <span>{label}</span>
    </div>
  );
}

function DebateCard({ msg }: { msg: DebateMessage }) {
  const agentId = msg.id.split('-')[0];
  const colorClass = PROFESSOR_COLORS[agentId] || 'bg-slate-600';
  const icon       = PROFESSOR_ICONS[agentId]  || 'рџ©є';
  const isDebate   = msg.phase === 'debate';

  return (
    <div className={`rounded-2xl p-4 mb-3 border ${isDebate ? 'border-amber-500/40 bg-amber-950/20' : 'border-slate-600/40 bg-slate-800/40'}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm ${colorClass}`}>
          {icon}
        </span>
        <div>
          <p className="text-sm font-semibold text-white leading-none">{msg.author}</p>
          <p className="text-xs text-slate-400">{msg.authorTitle}</p>
        </div>
        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${isDebate ? 'bg-amber-600 text-white' : 'bg-slate-600 text-slate-200'}`}>
          {isDebate ? 'вљ” Bahslar' : 'рџ“‹ Mustaqil'}
        </span>
      </div>
      <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
        {msg.content}
      </div>
    </div>
  );
}

export const ConsiliumView: React.FC<Props> = ({ patientData, language, onReport, onError }) => {
  const { t } = useTranslation();

  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState<ConsiliumResult | null>(null);
  const [phases,    setPhases]    = useState<PhaseState>({ independent: 'waiting', debate: 'waiting', consensus: 'waiting' });
  const [activeTab, setActiveTab] = useState<'debate' | 'report'>('debate');
  const [elapsed,   setElapsed]   = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const debateRef = useRef<HTMLDivElement>(null);
  const labels = getPhaseLabels(language);

  const start = async () => {
    setLoading(true);
    setResult(null);
    setPhases({ independent: 'running', debate: 'waiting', consensus: 'waiting' });
    setElapsed(0);

    timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000);

    try {
      // Simulate phase transitions while waiting for response
      const p1Timeout = setTimeout(() =>
        setPhases(p => ({ ...p, independent: 'done', debate: 'running' })), 8000);
      const p2Timeout = setTimeout(() =>
        setPhases(p => ({ ...p, debate: 'done', consensus: 'running' })), 20000);

      const resp = await runConsilium(patientData, language);

      clearTimeout(p1Timeout);
      clearTimeout(p2Timeout);

      if (!resp.success || !resp.data) {
        throw new Error((resp as { error?: { message?: string } }).error?.message || 'Konsilium xatosi');
      }

      setPhases({ independent: 'done', debate: 'done', consensus: 'done' });
      setResult(resp.data);

      // Convert to FinalReport format for parent
      const fr = resp.data.final_report;
      onReport({
        consensusDiagnosis:        fr.consensusDiagnosis,
        rejectedHypotheses:        fr.rejectedHypotheses,
        treatmentPlan:             fr.treatmentPlan,
        medicationRecommendations: fr.medicationRecommendations as FinalReport['medicationRecommendations'],
        recommendedTests:          fr.recommendedTests,
        unexpectedFindings:        fr.unexpectedFindings,
        uzbekistanLegislativeNote: fr.uzbekistanLegislativeNote,
        criticalFinding:           fr.criticalFinding,
      } as FinalReport);
    } catch (err) {
      setPhases(p => ({
        ...p,
        [p.independent === 'running' ? 'independent' : p.debate === 'running' ? 'debate' : 'consensus']: 'error',
      }));
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  // Auto-scroll debate list
  useEffect(() => {
    if (debateRef.current) {
      debateRef.current.scrollTop = debateRef.current.scrollHeight;
    }
  }, [result]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">рџЏ› Tibbiy Konsilium</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            5 ta mustaqil AI professor вЂ” Bahslar вЂ” Konsensus
          </p>
        </div>
        {loading && (
          <span className="text-sky-400 text-sm font-mono animate-pulse">{formatTime(elapsed)}</span>
        )}
      </div>

      {/* Phase progress */}
      <div className="flex flex-wrap gap-2">
        <PhaseIndicator label={labels.independent} status={phases.independent} />
        <PhaseIndicator label={labels.debate}      status={phases.debate}      />
        <PhaseIndicator label={labels.consensus}   status={phases.consensus}   />
      </div>

      {/* Start button */}
      {!loading && !result && (
        <button
          onClick={start}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-sky-600 to-violet-600
                     text-white font-semibold text-base hover:opacity-90 active:scale-95 transition-all"
        >
          рџљЂ Konsiliumni Boshlash
        </button>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="rounded-2xl border border-slate-600/40 bg-slate-800/40 p-6 text-center">
          <div className="animate-spin text-4xl mb-3">вџі</div>
          <p className="text-slate-300">Professorlar mustaqil tahlil qilmoqda...</p>
          <p className="text-slate-500 text-sm mt-1">Bu jarayon 30вЂ“90 soniya davom etishi mumkin</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Tabs */}
          <div className="flex gap-2 border-b border-slate-700 pb-0">
            {(['debate', 'report'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors
                  ${activeTab === tab
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-white'}`}
              >
                {tab === 'debate' ? 'вљ” Bahslar' : 'рџ“‹ Xulosa Hisobot'}
              </button>
            ))}
          </div>

          {activeTab === 'debate' && (
            <div ref={debateRef} className="max-h-[60vh] overflow-y-auto pr-1 space-y-1">
              {/* Professor summary */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                {result.professors.filter(p => p.id !== 'gpt4o').map(prof => (
                  <div key={prof.id}
                       className={`rounded-xl p-3 text-xs ${PROFESSOR_COLORS[prof.id] || 'bg-slate-600'} bg-opacity-20 border border-slate-600/30`}>
                    <p className="font-semibold text-white">{PROFESSOR_ICONS[prof.id]} {prof.name}</p>
                    <p className="text-slate-300 truncate">{prof.title}</p>
                  </div>
                ))}
              </div>

              {result.final_report.debateHistory.map(msg => (
                <DebateCard key={msg.id} msg={msg} />
              ))}

              {result.final_report.dissentingOpinions?.length > 0 && (
                <div className="rounded-xl p-3 bg-amber-950/30 border border-amber-500/30 text-sm text-amber-200">
                  <p className="font-semibold mb-1">вљ  Farqli fikrlar:</p>
                  {result.final_report.dissentingOpinions.map((op, i) => (
                    <p key={i}>вЂў {op}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'report' && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {/* Consensus Diagnosis */}
              <div className="rounded-2xl bg-emerald-950/30 border border-emerald-500/30 p-4">
                <h3 className="font-bold text-emerald-300 mb-2">вњ… Konsensus Tashxis</h3>
                {result.final_report.consensusDiagnosis.slice(0, 3).map((d, i) => (
                  <div key={i} className="mb-2">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-medium">{d.name}</span>
                      <span className="text-emerald-400 text-sm font-mono">{d.probability}%</span>
                    </div>
                    <p className="text-slate-400 text-xs mt-0.5">{d.justification}</p>
                  </div>
                ))}
              </div>

              {/* Critical Finding */}
              {result.final_report.criticalFinding && (
                <div className="rounded-2xl bg-red-950/40 border border-red-500/50 p-4">
                  <h3 className="font-bold text-red-300 mb-1">рџљЁ Kritik Topilma</h3>
                  <p className="text-red-200 text-sm">{result.final_report.criticalFinding.finding}</p>
                  <p className="text-red-300 text-xs mt-1">{result.final_report.criticalFinding.implication}</p>
                </div>
              )}

              {/* Medications */}
              {result.final_report.medicationRecommendations.length > 0 && (
                <div className="rounded-2xl bg-slate-800/60 border border-slate-600/30 p-4">
                  <h3 className="font-bold text-white mb-2">рџ’Љ Dori-darmonlar</h3>
                  {result.final_report.pharmacologyWarnings?.length > 0 && (
                    <div className="mb-2 p-2 rounded-lg bg-amber-900/40 border border-amber-500/30">
                      <p className="text-amber-300 text-xs font-semibold">вљ  Farmakolog ogohlantirishlari:</p>
                      {result.final_report.pharmacologyWarnings.map((w, i) => (
                        <p key={i} className="text-amber-200 text-xs">вЂў {w}</p>
                      ))}
                    </div>
                  )}
                  <div className="space-y-2">
                    {result.final_report.medicationRecommendations.map((med, i) => (
                      <div key={i} className="p-2 rounded-lg bg-slate-700/50">
                        <p className="text-white text-sm font-medium">{med.name} вЂ” {med.dosage}</p>
                        <p className="text-slate-400 text-xs">{med.frequency}, {med.duration}</p>
                        {med.instructions && <p className="text-slate-400 text-xs italic">{med.instructions}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Follow-up */}
              {result.final_report.followUpPlan && (
                <div className="rounded-2xl bg-slate-800/60 border border-slate-600/30 p-4">
                  <h3 className="font-bold text-white mb-1">рџ“… Kuzatuv Rejasi</h3>
                  <p className="text-slate-300 text-sm">{result.final_report.followUpPlan}</p>
                </div>
              )}

              <p className="text-xs text-slate-600 text-center">{result.final_report.uzbekistanLegislativeNote}</p>
            </div>
          )}

          {/* Re-run button */}
          <button
            onClick={start}
            disabled={loading}
            className="w-full py-2 rounded-xl border border-slate-600 text-slate-400 text-sm
                       hover:border-sky-500 hover:text-sky-400 transition-colors"
          >
            рџ”„ Qayta O'tkazish
          </button>
        </>
      )}
    </div>
  );
};

export default ConsiliumView;