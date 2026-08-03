/**
 * Obyektiv ko'rsatkichlarni matn o'rniga alohida chiroyli kartochkalarda ko'rsatadi.
 * Saqlangan matn tilidan qat'i nazar — UI yorliqlari joriy platforma tilida.
 */
import React, { useMemo } from 'react';
import { useTranslation } from '../../hooks/useTranslation';

export interface ParsedVitals {
  weight?: string;
  height?: string;
  bmi?: string;
  bp?: string;
  pulse?: string;
  temp?: string;
  spo2?: string;
  respiration?: string;
  raw?: string;
}

/** Forma saqlash uchun tilga bog'liq bo'lmagan kalitlar */
export const VITAL_STORAGE_KEYS = {
  weight: 'WT',
  height: 'HT',
  bmi: 'BMI',
  bp: 'BP',
  pulse: 'HR',
  temp: 'TEMP',
  spo2: 'SpO2',
  respiration: 'RR',
} as const;

const LABEL_PATTERNS: Record<keyof Omit<ParsedVitals, 'raw'>, RegExp> = {
  weight: /^(wt|weight|tana\s*vazni|vazn|масса\s*тела|вес|salmaǧ|body\s*weight)\b/i,
  height: /^(ht|height|bo['’`]?y|рост|boy)\b/i,
  bmi: /^(bmi|tmi|imt|tana\s*massasi|индекс\s*массы|body\s*mass)\b/i,
  bp: /^(bp|а[дd]\b|arterial|қон\s*босим|qon\s*bosim|давлен|blood\s*pressure|bosim)\b/i,
  pulse: /^(hr|pulse|puls|yurak|юрак|сердцебиен|heart\s*rate|chss)\b/i,
  temp: /^(temp|t\b|harorat|ҳарорат|температур|temperature)\b/i,
  spo2: /^(spo2|spo₂|satura|сатурац|кислород|o2|o₂)\b/i,
  respiration: /^(rr|resp|nafas|нафас|дыхани|chdd|respiration)\b/i,
};

function splitLabelValue(line: string): { label: string; value: string } {
  const m = line.match(/^([^:：—\-–]+)[:：—\-–]\s*(.+)$/);
  if (m) return { label: m[1].trim(), value: m[2].trim() };
  return { label: '', value: line.trim() };
}

function classifyLine(label: string, value: string): keyof Omit<ParsedVitals, 'raw'> | null {
  const keyProbe = label || value;
  for (const [key, re] of Object.entries(LABEL_PATTERNS) as [keyof Omit<ParsedVitals, 'raw'>, RegExp][]) {
    if (re.test(keyProbe)) return key;
  }
  // Machine keys at start of line (BP: …)
  const machine = value.match(/^(WT|HT|BMI|BP|HR|TEMP|SpO2|RR)\b/i) ? value : label;
  const up = machine.toUpperCase();
  if (up === 'WT' || up.startsWith('WT ')) return 'weight';
  if (up === 'HT' || up.startsWith('HT ')) return 'height';
  if (up === 'BMI' || up.startsWith('BMI ')) return 'bmi';
  if (up === 'BP' || up.startsWith('BP ')) return 'bp';
  if (up === 'HR' || up.startsWith('HR ')) return 'pulse';
  if (up === 'TEMP' || up.startsWith('TEMP ')) return 'temp';
  if (up === 'SPO2' || up.startsWith('SPO2')) return 'spo2';
  if (up === 'RR' || up.startsWith('RR ')) return 'respiration';
  // Value heuristics
  if (/^\d{2,3}\s*\/\s*\d{2,3}/.test(value)) return 'bp';
  if (/%\s*$/.test(value) || /^9\d(\.\d+)?$/.test(value)) return 'spo2';
  if (/°\s*c|℃/i.test(value) || /^3[5-9]([.,]\d+)?$/.test(value)) return 'temp';
  if (/\bbpm\b/i.test(value)) return 'pulse';
  if (/\b\/\s*min\b/i.test(value)) return 'respiration';
  if (/\bkg\b/i.test(value)) return 'weight';
  if (/\bcm\b/i.test(value)) return 'height';
  return null;
}

export function parseObjectiveData(text: string | undefined): ParsedVitals {
  const out: ParsedVitals = {};
  if (!text || !text.trim()) return out;
  const lines = text.trim().split(/\n+/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const { label, value } = splitLabelValue(line);
    const kind = classifyLine(label, value);
    if (kind && !out[kind]) {
      // Agar qiymat ichida yana "BP: 120/80" bo'lsa — faqat qiymatni ol
      const cleaned = value.replace(/^(WT|HT|BMI|BP|HR|TEMP|SpO2|RR)\s*[:：]?\s*/i, '').trim() || value;
      out[kind] = cleaned;
    }
  }
  const hasAny = out.bp || out.pulse || out.temp || out.spo2 || out.respiration || out.weight || out.height || out.bmi;
  if (!hasAny) out.raw = text;
  return out;
}

const VitalCard: React.FC<{
  label: string;
  value: string;
  unit?: string;
  icon: React.ReactNode;
  color: string;
}> = ({ label, value, unit, icon, color }) => (
  <div className={`rounded-md border px-1.5 py-1 min-w-0 flex-shrink-0 ${color} bg-white/60 backdrop-blur-sm shadow`}>
    <div className="flex items-center gap-0.5 mb-0.5">
      <span className="text-slate-600 flex-shrink-0 text-[11px]">{icon}</span>
      <span className="text-[8px] font-semibold uppercase tracking-wide text-slate-600 truncate">{label}</span>
    </div>
    <p className="text-[10px] font-semibold text-slate-800 tabular-nums truncate leading-tight">
      {value}
      {unit && <span className="text-[8px] font-normal text-slate-600 ml-0.5">{unit}</span>}
    </p>
  </div>
);

export const ObjectiveVitalsCards: React.FC<{ objectiveData?: string }> = ({ objectiveData }) => {
  const { t } = useTranslation();
  const vitals = useMemo(() => parseObjectiveData(objectiveData), [objectiveData]);

  if (vitals.raw) {
    return (
      <div>
        <strong className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">
          {t('analysis_objective_title')}
        </strong>
        <div className="p-2 rounded-lg border border-slate-200/80 bg-white/60 backdrop-blur-sm shadow min-w-0">
          <p className="text-xs text-text-primary whitespace-pre-wrap break-words overflow-hidden">{vitals.raw}</p>
        </div>
      </div>
    );
  }

  const items = [
    { key: 'bp' as const, label: t('data_form_vitals_summary_bp'), value: vitals.bp, unit: 'mm.Hg', color: 'border-red-200 bg-red-50/80', icon: <span className="text-red-500 font-black text-sm">BP</span> },
    { key: 'pulse' as const, label: t('data_form_vitals_summary_pulse'), value: vitals.pulse, unit: 'bpm', color: 'border-rose-200 bg-rose-50/80', icon: <span className="text-rose-500 font-bold">P</span> },
    { key: 'temp' as const, label: t('data_form_vitals_summary_temp'), value: vitals.temp, unit: '°C', color: 'border-amber-200 bg-amber-50/80', icon: <span className="text-amber-600 font-bold">T</span> },
    { key: 'spo2' as const, label: t('data_form_vitals_summary_spo2'), value: vitals.spo2, unit: '%', color: 'border-cyan-200 bg-cyan-50/80', icon: <span className="text-cyan-600 font-bold">O₂</span> },
    { key: 'respiration' as const, label: t('data_form_vitals_summary_resp'), value: vitals.respiration, unit: '/min', color: 'border-blue-200 bg-blue-50/80', icon: <span className="text-blue-600 font-bold">R</span> },
    { key: 'weight' as const, label: t('data_form_vitals_summary_weight'), value: vitals.weight, unit: 'kg', color: 'border-emerald-200 bg-emerald-50/80', icon: <span className="text-emerald-600 font-bold">W</span> },
    { key: 'height' as const, label: t('data_form_vitals_summary_height'), value: vitals.height, unit: 'cm', color: 'border-teal-200 bg-teal-50/80', icon: <span className="text-teal-600 font-bold">H</span> },
    { key: 'bmi' as const, label: t('data_form_vitals_summary_bmi'), value: vitals.bmi, unit: '', color: 'border-violet-200 bg-violet-50/80', icon: <span className="text-violet-600 font-bold">BMI</span> },
  ].filter((i) => vitals[i.key]);

  if (!items.length) return null;

  return (
    <div>
      <strong className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1.5">
        {t('analysis_objective_vitals_title')}
      </strong>
      <div className="flex flex-wrap gap-2">
        {items.map(({ key, label, value, unit, color, icon }) => (
          <VitalCard key={key} label={label} value={value || '-'} unit={unit || undefined} color={color} icon={icon} />
        ))}
      </div>
    </div>
  );
};

export default ObjectiveVitalsCards;
