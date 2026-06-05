import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { ChatMessage as ChatMessageType, ResearchReport, ResearchProgressUpdate } from '../types';
import { runResearchCouncilDebate, type ResearchFocus } from '../services/aiCouncilService';
import SpinnerIcon from './icons/SpinnerIcon';
import ChatMessage from './ChatMessage';
import ResearchReportCard from './ResearchReportCard';
import LightBulbIcon from './icons/LightBulbIcon';
import RestartIcon from './icons/RestartIcon';
import { useTranslation } from '../hooks/useTranslation';

const QUICK_DISEASES = [
  'Glioblastoma multiforme',
  'Pankreatik saraton',
  'Miyelofibroz',
  'Sistin fibrozi',
  'Amyotrofik lateral skleroz',
  'Idiopatik pulmon fibrozi',
];

const FOCUS_OPTIONS: { key: ResearchFocus; labelKey: string }[] = [
  { key: 'comprehensive', labelKey: 'research_focus_comprehensive' },
  { key: 'innovative', labelKey: 'research_focus_innovative' },
  { key: 'biomarkers', labelKey: 'research_focus_biomarkers' },
  { key: 'trials', labelKey: 'research_focus_trials' },
  { key: 'pharmacogenomics', labelKey: 'research_focus_pharmacogenomics' },
];

type Phase = 'idle' | 'gather' | 'debate' | 'synthesize' | 'report' | 'done';

const ResearchView: React.FC = () => {
  const { t, language } = useTranslation();
  const [diseaseName, setDiseaseName] = useState('');
  const [focus, setFocus] = useState<ResearchFocus>('comprehensive');
  const [stage, setStage] = useState('');
  const [patientContext, setPatientContext] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [debateHistory, setDebateHistory] = useState<ChatMessageType[]>([]);
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resultTab, setResultTab] = useState<'debate' | 'report'>('debate');

  const scrollRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [debateHistory, statusMessage, report]);

  const phases = useMemo(
    () => [
      { key: 'gather' as Phase, label: t('research_phase_gather') },
      { key: 'debate' as Phase, label: t('research_phase_debate') },
      { key: 'synthesize' as Phase, label: t('research_phase_synthesize') },
      { key: 'report' as Phase, label: t('research_phase_report') },
    ],
    [t],
  );

  const resetState = () => {
    setIsSearching(false);
    setPhase('idle');
    setDebateHistory([]);
    setReport(null);
    setStatusMessage('');
    setError(null);
    setResultTab('debate');
  };

  const handleProgress = useCallback((update: ResearchProgressUpdate) => {
    switch (update.type) {
      case 'status':
        setStatusMessage(update.message);
        if (update.message.toLowerCase().includes('yig') || update.message.toLowerCase().includes('gather')) {
          setPhase('gather');
        } else if (update.message.toLowerCase().includes('muhokama') || update.message.toLowerCase().includes('debating')) {
          setPhase('debate');
        }
        break;
      case 'message':
        setPhase('debate');
        setDebateHistory((prev) => {
          const thinkingIndex = prev.findIndex(
            (m) => m.author === update.message.author && m.isThinking,
          );
          if (thinkingIndex > -1) {
            const newHistory = [...prev];
            newHistory[thinkingIndex] = update.message;
            return newHistory;
          }
          return [...prev, update.message];
        });
        break;
      case 'report':
        setPhase('done');
        setReport(update.data);
        setIsSearching(false);
        setStatusMessage('');
        setResultTab('report');
        break;
      case 'error':
        setError(update.message);
        setIsSearching(false);
        setPhase('idle');
        setStatusMessage(t('research_error_ended'));
        break;
    }
  }, [t]);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!diseaseName.trim()) return;

    resetState();
    setIsSearching(true);
    setPhase('gather');
    await runResearchCouncilDebate(
      { diseaseName: diseaseName.trim(), focus, stage: stage.trim(), patientContext: patientContext.trim() },
      handleProgress,
      language,
    );
  };

  const handlePrint = () => window.print();

  if (isSearching || report) {
    const phaseIndex = phases.findIndex((p) => p.key === phase || (phase === 'done' && p.key === 'report'));

    return (
      <div className="space-y-4" ref={printRef}>
        <div className="glass-panel p-5 print:hidden">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {t('research_debate_title')} &quot;{report?.diseaseName || diseaseName}&quot;
              </h2>
              <p className="text-sm text-slate-500 mt-1">{t('research_view_subtitle')}</p>
            </div>
            {report && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3 py-2 text-sm font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
                >
                  {t('research_print_btn')}
                </button>
                <button
                  type="button"
                  onClick={resetState}
                  className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
                >
                  <RestartIcon className="w-4 h-4" />
                  {t('research_new_research')}
                </button>
              </div>
            )}
          </div>

          {isSearching && (
            <div className="mt-5 flex flex-wrap gap-2">
              {phases.map((p, i) => {
                const active = i <= Math.max(phaseIndex, 0);
                const current = p.key === phase || (phase === 'done' && p.key === 'report');
                return (
                  <div
                    key={p.key}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                      current
                        ? 'bg-cyan-600 text-white border-cyan-600'
                        : active
                          ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                          : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}
                  >
                    {current && isSearching && <SpinnerIcon className="w-3 h-3 animate-spin" />}
                    <span>{i + 1}.</span> {p.label}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {report && (
          <div className="flex gap-2 print:hidden">
            <button
              type="button"
              onClick={() => setResultTab('debate')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                resultTab === 'debate' ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {t('research_tab_debate')} ({debateHistory.length})
            </button>
            <button
              type="button"
              onClick={() => setResultTab('report')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                resultTab === 'report' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {t('research_tab_report')}
            </button>
          </div>
        )}

        <div className="glass-panel p-5 md:p-6 flex flex-col min-h-[420px] max-h-[calc(100vh-14rem)]">
          <div ref={scrollRef} className="overflow-y-auto flex-grow pr-2 space-y-3">
            {(resultTab === 'debate' || isSearching) && (
              <>
                {debateHistory.map((msg) => (
                  <ChatMessage key={msg.id} message={msg} onExplainRationale={() => {}} />
                ))}
                {statusMessage && !report && !error && (
                  <div className="text-center py-6 text-cyan-700 font-semibold animate-pulse flex items-center justify-center gap-2">
                    <SpinnerIcon className="w-5 h-5 animate-spin" />
                    {statusMessage}
                  </div>
                )}
              </>
            )}

            {error && (
              <div className="p-4 text-sm text-red-700 rounded-xl bg-red-50 border border-red-200" role="alert">
                <span className="font-bold">{t('research_error_label')}</span> {error}
              </div>
            )}

            {report && resultTab === 'report' && <ResearchReportCard report={report} />}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white">
          <p className="text-2xl">🧬</p>
          <p className="font-bold text-slate-800 text-sm mt-2">{t('research_card_biomarkers_title')}</p>
          <p className="text-xs text-slate-500 mt-1">{t('research_card_biomarkers_desc')}</p>
        </div>
        <div className="p-4 rounded-xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-white">
          <p className="text-2xl">💊</p>
          <p className="font-bold text-slate-800 text-sm mt-2">{t('research_card_strategies_title')}</p>
          <p className="text-xs text-slate-500 mt-1">{t('research_card_strategies_desc')}</p>
        </div>
        <div className="p-4 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
          <p className="text-2xl">🔬</p>
          <p className="font-bold text-slate-800 text-sm mt-2">{t('research_card_trials_title')}</p>
          <p className="text-xs text-slate-500 mt-1">{t('research_card_trials_desc')}</p>
        </div>
      </div>

      <div className="glass-panel p-6 md:p-8">
        <div className="flex items-start gap-4 mb-6">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center">
            <LightBulbIcon className="h-7 w-7 text-violet-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">{t('research_center_title')}</h3>
            <p className="mt-1 text-sm text-slate-600 max-w-2xl leading-relaxed">{t('research_placeholder')}</p>
          </div>
        </div>

        <form onSubmit={(e) => void handleSearch(e)} className="space-y-5 max-w-2xl">
          <label className="block text-sm">
            <span className="font-semibold text-slate-700">{t('research_disease_label')}</span>
            <input
              type="text"
              value={diseaseName}
              onChange={(e) => setDiseaseName(e.target.value)}
              className="mt-1 w-full common-input px-4 py-3"
              placeholder={t('research_placeholder_disease')}
            />
          </label>

          <div>
            <p className="text-xs font-semibold text-slate-500 mb-2">{t('research_quick_picks')}</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_DISEASES.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDiseaseName(d)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    diseaseName === d
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-violet-400'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">{t('research_focus_label')}</p>
            <div className="flex flex-wrap gap-2">
              {FOCUS_OPTIONS.map(({ key, labelKey }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFocus(key)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border ${
                    focus === key
                      ? 'bg-cyan-600 text-white border-cyan-600'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-cyan-400'
                  }`}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block text-sm">
              <span className="font-semibold text-slate-700">{t('research_stage_label')}</span>
              <input
                type="text"
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className="mt-1 w-full common-input"
                placeholder={t('research_stage_placeholder')}
              />
            </label>
            <label className="block text-sm sm:col-span-1">
              <span className="font-semibold text-slate-700">{t('research_context_label')}</span>
              <input
                type="text"
                value={patientContext}
                onChange={(e) => setPatientContext(e.target.value)}
                className="mt-1 w-full common-input"
                placeholder={t('research_context_placeholder')}
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={isSearching || !diseaseName.trim()}
            className="w-full flex justify-center items-center gap-3 py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-violet-600 to-cyan-600 disabled:opacity-60 shadow-lg hover:shadow-xl transition-shadow"
          >
            {isSearching ? (
              <>
                <SpinnerIcon className="w-5 h-5 animate-spin" />
                {t('research_searching')}
              </>
            ) : (
              t('research_start_btn')
            )}
          </button>
        </form>

        <p className="mt-4 text-[11px] text-slate-400 italic max-w-2xl">{t('research_disclaimer')}</p>
      </div>
    </div>
  );
};

export default ResearchView;
