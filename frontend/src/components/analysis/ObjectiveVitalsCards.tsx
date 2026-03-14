/**
 * Obyektiv ko'rsatkichlarni matn o'rniga alohida chiroyli kartochkalarda ko'rsatadi.
 * objectiveData dan BP, Puls, Harorat, SpO2, Nafas sonini ajratib chiqadi.
 */
import React from 'react';
import { useTranslation } from '../../i18n/LanguageContext';

export interface ParsedVitals {
  bp?: string;
  pulse?: string;
  temp?: string;
  spo2?: string;
  respiration?: string;
  raw?: string;
}

function parseObjectiveData(text: string | undefined): ParsedVitals {
  const out: ParsedVitals = {};
  if (!text || !text.trim()) return out;
  const lines = text.trim().split(/\n+/).map(l => l.replace(/^[^:]*:\s*/, '').trim());
  if (lines.length >= 1 && lines[0]) out.bp = lines[0];
  if (lines.length >= 2 && lines[1]) out.pulse = lines[1];
  if (lines.length >= 3 && lines[2]) out.temp = lines[2];
  if (lines.length >= 4 && lines[3]) out.spo2 = lines[3];
  if (lines.length >= 5 && lines[4]) out.respiration = lines[4];
  if (!out.bp && !out.pulse && !out.temp && !out.spo2 && !out.respiration) out.raw = text;
  return out;
}

const VitalCard: React.FC<{
  label: string;
  value: string;
  unit?: string;
  icon: React.ReactNode;
  color: string;
}> = ({ label, value, unit, icon, color }) => (
  <div className={`rounded-2xl border-2 p-4 ${color} bg-white/60 backdrop-blur-sm shadow-lg`}>
    <div className="flex items-center gap-2 mb-1">
      <span className="text-slate-600">{icon}</span>
      <span className="text-xs font-bold uppercase tracking-wider text-slate-600">{label}</span>
    </div>
    <p className="text-xl font-bold text-slate-800 tabular-nums">
      {value}
      {unit && <span className="text-sm font-normal text-slate-600 ml-0.5">{unit}</span>}
    </p>
  </div>
);

export const ObjectiveVitalsCards: React.FC<{ objectiveData?: string }> = ({ objectiveData }) => {
  const { t } = useTranslation();
  const vitals = parseObjectiveData(objectiveData);

  if (vitals.raw) {
    return (
      <div>
        <strong className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Obyektiv</strong>
        <div className="p-4 rounded-2xl border-2 border-slate-200/80 bg-white/60 backdrop-blur-sm shadow-lg">
          <p className="text-sm text-text-primary whitespace-pre-wrap">{vitals.raw}</p>
        </div>
      </div>
    );
  }

  const hasAny = vitals.bp || vitals.pulse || vitals.temp || vitals.spo2 || vitals.respiration;
  if (!hasAny) return null;

  const items = [
    { key: 'bp' as const, label: t('data_form_vitals_summary_bp'), value: vitals.bp, unit: 'mm.Hg', color: 'border-red-200 bg-red-50/80', icon: <span className="text-red-500 font-black text-sm">BP</span> },
    { key: 'pulse' as const, label: t('data_form_vitals_summary_pulse'), value: vitals.pulse, unit: 'bpm', color: 'border-rose-200 bg-rose-50/80', icon: <span className="text-rose-500 font-bold">P</span> },
    { key: 'temp' as const, label: t('data_form_vitals_summary_temp'), value: vitals.temp, unit: '°C', color: 'border-amber-200 bg-amber-50/80', icon: <span className="text-amber-600 font-bold">T</span> },
    { key: 'spo2' as const, label: t('data_form_vitals_summary_spo2'), value: vitals.spo2, unit: '%', color: 'border-cyan-200 bg-cyan-50/80', icon: <span className="text-cyan-600 font-bold">O₂</span> },
    { key: 'respiration' as const, label: t('data_form_vitals_summary_resp'), value: vitals.respiration, unit: '/min', color: 'border-blue-200 bg-blue-50/80', icon: <span className="text-blue-600 font-bold">R</span> },
  ].filter(i => vitals[i.key]);

  return (
    <div>
      <strong className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">Obyektiv ko'rsatkichlar</strong>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {items.map(({ key, label, value, unit, color, icon }) => (
          <VitalCard key={key} label={label} value={value || '-'} unit={unit} color={color} icon={icon} />
        ))}
      </div>
    </div>
  );
};

export default ObjectiveVitalsCards;
