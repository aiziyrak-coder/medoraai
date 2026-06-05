import React, { useMemo, useRef, useState } from 'react';
import type { CheckUpCategory, CheckUpPlanResult, CheckUpRecommendation } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import SpinnerIcon from './icons/SpinnerIcon';
import LinkifiedText from './common/LinkifiedText';

const RISK_FACTORS = [
  { key: 'smoking' as const, labelKey: 'checkup_smoking' },
  { key: 'diabetes' as const, labelKey: 'checkup_diabetes' },
  { key: 'hypertension' as const, labelKey: 'checkup_hypertension' },
  { key: 'obesity' as const, labelKey: 'checkup_obesity' },
  { key: 'familyHistoryCancer' as const, labelKey: 'checkup_family_cancer' },
];

const CATEGORY_ORDER: CheckUpCategory[] = [
  'cardiovascular',
  'metabolic',
  'cancer',
  'infectious',
  'vaccination',
  'dental',
  'mental',
  'general',
];

const priorityBadge = (p?: string) => {
  if (p === 'high') return 'bg-red-100 text-red-800 border-red-200';
  if (p === 'low') return 'bg-slate-100 text-slate-600 border-slate-200';
  return 'bg-amber-100 text-amber-800 border-amber-200';
};

const riskBadge = (level: CheckUpPlanResult['riskLevel']) => {
  if (level === 'high') return 'bg-red-600 text-white';
  if (level === 'low') return 'bg-emerald-600 text-white';
  return 'bg-amber-500 text-white';
};

const ScreeningCard: React.FC<{
  item: CheckUpRecommendation;
  t: (k: string) => string;
}> = ({ item, t }) => (
  <li className="p-4 rounded-xl border border-sky-200/80 bg-white shadow-sm hover:shadow-md transition-shadow">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <p className="font-bold text-slate-900 leading-snug">{item.screeningName}</p>
      {item.priority && (
        <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border font-semibold ${priorityBadge(item.priority)}`}>
          {t(`checkup_priority_${item.priority}`)}
        </span>
      )}
    </div>
    {item.frequency && (
      <p className="text-sm text-cyan-800 mt-2 font-medium">
        {t('checkup_frequency')}: {item.frequency}
      </p>
    )}
    {item.reason && <p className="text-sm text-slate-700 mt-1.5 leading-relaxed">{item.reason}</p>}
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
      {item.guidelineSource && (
        <span>
          {t('checkup_guideline_source')}: <span className="text-slate-700">{item.guidelineSource}</span>
        </span>
      )}
      {item.evidenceLevel && (
        <span>
          {t('checkup_evidence_level')}: <span className="font-semibold text-slate-700">{item.evidenceLevel}</span>
        </span>
      )}
      {item.nextSuggested && (
        <span>
          {t('checkup_next_suggested')}: <span className="text-emerald-700 font-medium">{item.nextSuggested}</span>
        </span>
      )}
    </div>
    {item.sourceUrl && (
      <p className="mt-2 text-xs">
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline hover:text-blue-800 break-all"
        >
          {t('checkup_view_source')}
        </a>
      </p>
    )}
  </li>
);

const CheckUpModule: React.FC = () => {
  const { t, language } = useTranslation();
  const printRef = useRef<HTMLDivElement>(null);
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [conditions, setConditions] = useState('');
  const [riskFlags, setRiskFlags] = useState({
    smoking: false,
    diabetes: false,
    hypertension: false,
    obesity: false,
    familyHistoryCancer: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<CheckUpPlanResult | null>(null);

  const groupedScreenings = useMemo(() => {
    if (!plan?.recommendations.length) return [];
    const map = new Map<string, CheckUpRecommendation[]>();
    for (const rec of plan.recommendations) {
      const cat = (rec.category || 'general').toLowerCase();
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(rec);
    }
    const ordered = CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({
      category: c,
      items: map.get(c)!,
    }));
    for (const [cat, items] of map.entries()) {
      if (!CATEGORY_ORDER.includes(cat as CheckUpCategory)) {
        ordered.push({ category: cat, items });
      }
    }
    return ordered;
  }, [plan]);

  const toggleRisk = (key: keyof typeof riskFlags) => {
    setRiskFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGenerate = async () => {
    if (!age.trim()) {
      setError(t('checkup_age_required'));
      return;
    }
    setError(null);
    setLoading(true);
    setPlan(null);
    try {
      const { generateCheckUpPlan } = await import('../services/aiCouncilService');
      const result = await generateCheckUpPlan(
        { age, gender, conditions, ...riskFlags },
        language,
      );
      setPlan(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('checkup_error'));
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <p className="text-sm text-slate-600 leading-relaxed">{t('checkup_intro')}</p>

      <div className="glass-panel p-5 space-y-5 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="font-semibold text-slate-700">{t('pdf_age')}</span>
            <input
              type="number"
              min={0}
              max={120}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="mt-1 w-full common-input"
              placeholder="45"
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-slate-700">{t('pdf_gender')}</span>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as 'male' | 'female' | '')}
              className="mt-1 w-full common-input"
            >
              <option value="">{t('checkup_gender_select')}</option>
              <option value="male">{t('pdf_gender_male')}</option>
              <option value="female">{t('pdf_gender_female')}</option>
            </select>
          </label>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-700 mb-2">{t('checkup_risk_factors_title')}</p>
          <div className="flex flex-wrap gap-2">
            {RISK_FACTORS.map(({ key, labelKey }) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleRisk(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  riskFlags[key]
                    ? 'bg-cyan-600 text-white border-cyan-600'
                    : 'bg-white text-slate-600 border-slate-300 hover:border-cyan-400'
                }`}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
        </div>

        <label className="block text-sm">
          <span className="font-semibold text-slate-700">{t('checkup_conditions_label')}</span>
          <textarea
            value={conditions}
            onChange={(e) => setConditions(e.target.value)}
            className="mt-1 w-full common-input min-h-[80px]"
            placeholder={t('checkup_conditions_placeholder')}
          />
        </label>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-cyan-600 to-emerald-600 disabled:opacity-60 hover:shadow-lg transition-shadow"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <SpinnerIcon className="w-4 h-4 animate-spin" /> {t('checkup_generating')}
            </span>
          ) : (
            t('checkup_generate_btn')
          )}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      {plan && (
        <div ref={printRef} className="space-y-5 animate-in fade-in duration-300">
          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <h2 className="text-xl font-bold text-slate-800">{t('checkup_results_title')}</h2>
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
            >
              {t('checkup_print_btn')}
            </button>
          </div>

          <div className="p-5 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-cyan-50/50">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1 min-w-[200px]">
                <h3 className="text-sm font-semibold text-emerald-800 uppercase tracking-wide">
                  {t('checkup_summary_title')}
                </h3>
                <p className="mt-2 text-slate-800 leading-relaxed">
                  <LinkifiedText text={plan.summary} />
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-1">{t('checkup_risk_level')}</p>
                <span className={`inline-block px-4 py-1.5 rounded-full text-sm font-bold uppercase ${riskBadge(plan.riskLevel)}`}>
                  {t(`checkup_risk_${plan.riskLevel}`)}
                </span>
              </div>
            </div>
            {plan.riskFactors.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {plan.riskFactors.map((f, i) => (
                  <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-white/80 border border-amber-200 text-amber-900">
                    {f}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-500">{t('checkup_no_risk_factors')}</p>
            )}
          </div>

          {plan.urgentNotes && plan.urgentNotes.length > 0 && (
            <div className="p-4 rounded-xl border-2 border-red-300 bg-red-50">
              <h4 className="font-bold text-red-800 flex items-center gap-2">
                <span aria-hidden>⚠</span> {t('checkup_urgent_title')}
              </h4>
              <ul className="mt-2 space-y-1 text-sm text-red-900 list-disc list-inside">
                {plan.urgentNotes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          )}

          {groupedScreenings.map(({ category, items }) => (
            <section key={category}>
              <h3 className="text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-5 rounded-full bg-cyan-500" />
                {t(`checkup_category_${category}`) || category}
                <span className="text-xs font-normal text-slate-400">({items.length})</span>
              </h3>
              <ul className="space-y-3">
                {items.map((item, i) => (
                  <ScreeningCard key={`${category}-${i}`} item={item} t={t} />
                ))}
              </ul>
            </section>
          ))}

          {plan.labPanel.length > 0 && (
            <section className="p-4 rounded-xl border border-violet-200 bg-violet-50/40">
              <h4 className="font-bold text-violet-900">{t('checkup_lab_panel_title')}</h4>
              <ul className="mt-2 grid sm:grid-cols-2 gap-2 text-sm text-slate-700">
                {plan.labPanel.map((lab, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-violet-500 mt-0.5">•</span>
                    {lab}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {plan.vaccinations.length > 0 && (
            <section>
              <h4 className="font-bold text-slate-800 mb-3">{t('checkup_vaccinations_title')}</h4>
              <div className="grid sm:grid-cols-2 gap-3">
                {plan.vaccinations.map((v, i) => (
                  <div key={i} className="p-3 rounded-lg border border-teal-200 bg-teal-50/50 text-sm">
                    <p className="font-bold text-teal-900">{v.vaccine}</p>
                    {v.schedule && (
                      <p className="text-slate-600 mt-1">
                        {t('checkup_frequency')}: {v.schedule}
                      </p>
                    )}
                    {v.reason && <p className="text-slate-700 mt-1">{v.reason}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {plan.preventionMeasures.length > 0 && (
            <section>
              <h4 className="font-bold text-slate-800 mb-2">{t('checkup_prevention_title')}</h4>
              <ul className="space-y-1.5 text-sm text-slate-700">
                {plan.preventionMeasures.map((n, i) => (
                  <li key={i} className="flex items-start gap-2 p-2 rounded-lg bg-slate-50">
                    <span className="text-emerald-600 font-bold">✓</span>
                    {n}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {plan.lifestylePlan.length > 0 && (
            <section>
              <h4 className="font-bold text-slate-800 mb-2">{t('checkup_lifestyle_title')}</h4>
              <ul className="space-y-1.5 text-sm text-slate-700">
                {plan.lifestylePlan.map((n, i) => (
                  <li key={i} className="flex items-start gap-2 p-2 rounded-lg bg-cyan-50/60 border border-cyan-100">
                    <span className="text-cyan-600">→</span>
                    {n}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {plan.followUpTimeline && (
            <p className="text-sm p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
              <span className="font-bold text-emerald-800">{t('checkup_followup')}:</span>{' '}
              {plan.followUpTimeline}
            </p>
          )}

          {plan.sources.length > 0 && (
            <section className="p-4 rounded-xl border border-slate-200 bg-slate-50/80">
              <h4 className="font-bold text-slate-700 mb-2">{t('checkup_sources_title')}</h4>
              <ul className="space-y-1 text-sm">
                {plan.sources.map((s, i) => (
                  <li key={i}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline hover:text-blue-800"
                    >
                      {s.title || s.url}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="text-[11px] text-slate-400 italic print:mt-8">{t('checkup_disclaimer')}</p>
        </div>
      )}
    </div>
  );
};

export default CheckUpModule;
