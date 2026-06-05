import React, { useState } from 'react';
import type { CheckUpRecommendation } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import SpinnerIcon from './icons/SpinnerIcon';

const CheckUpModule: React.FC = () => {
  const { t, language } = useTranslation();
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [conditions, setConditions] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<CheckUpRecommendation[]>([]);
  const [preventionNotes, setPreventionNotes] = useState<string[]>([]);
  const [followUp, setFollowUp] = useState('');

  const handleGenerate = async () => {
    if (!age.trim()) {
      setError(t('checkup_age_required'));
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { generateCheckUpPlan } = await import('../services/aiCouncilService');
      const result = await generateCheckUpPlan({ age, gender, conditions }, language);
      setPlan(result.recommendations);
      setPreventionNotes(result.preventionMeasures);
      setFollowUp(result.followUpTimeline || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('checkup_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <p className="text-sm text-slate-600">{t('checkup_intro')}</p>
      <div className="glass-panel p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="font-semibold text-slate-700">{t('pdf_age')}</span>
            <input
              type="text"
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
          className="px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-cyan-600 to-emerald-600 disabled:opacity-60"
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

      {plan.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-800">{t('checkup_screenings_title')}</h3>
          <ul className="space-y-3">
            {plan.map((item, i) => (
              <li key={i} className="p-4 rounded-xl border border-sky-200 bg-sky-50/50">
                <p className="font-bold text-slate-900">{item.screeningName}</p>
                {item.frequency && (
                  <p className="text-sm text-slate-600 mt-1">
                    {t('checkup_frequency')}: {item.frequency}
                  </p>
                )}
                {item.reason && <p className="text-sm mt-1">{item.reason}</p>}
              </li>
            ))}
          </ul>
          {preventionNotes.length > 0 && (
            <div>
              <h4 className="font-bold text-slate-800 mb-2">{t('checkup_prevention_title')}</h4>
              <ul className="list-disc list-inside text-sm text-slate-700 space-y-1">
                {preventionNotes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          )}
          {followUp && (
            <p className="text-sm p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <span className="font-semibold">{t('checkup_followup')}:</span> {followUp}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default CheckUpModule;
