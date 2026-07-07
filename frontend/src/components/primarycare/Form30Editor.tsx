import React from 'react';
import { useTranslation } from '../../hooks/useTranslation';

export type Form30Data = Record<string, string | number | string[]>;

const inputCls = 'rounded-lg border border-slate-200 px-2.5 py-2 text-sm w-full';

interface Props {
  value: Form30Data;
  onChange: (next: Form30Data) => void;
  disabled?: boolean;
}

const TEXT_FIELDS = [
  'registration_number', 'workplace', 'disability_group', 'main_diagnosis',
  'comorbidities', 'diet_recommendations', 'physical_activity',
  'smoking_status', 'alcohol_status', 'last_hospitalization', 'sanatorium_treatment',
] as const;

const TEXTAREA_FIELDS = ['treatment_plan', 'notes'] as const;

const LIST_FIELDS = ['examinations_done', 'consultations_done'] as const;

const Form30Editor: React.FC<Props> = ({ value, onChange, disabled }) => {
  const { t } = useTranslation();

  const set = (key: string, v: string | number) => onChange({ ...value, [key]: v });

  const setList = (key: string, raw: string) => {
    onChange({
      ...value,
      [key]: raw.split('\n').map((s) => s.trim()).filter(Boolean),
    });
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 font-medium">{t('pc_form30_title')}</p>
      <div className="grid sm:grid-cols-2 gap-2">
        {TEXT_FIELDS.map((key) => (
          <input
            key={key}
            className={inputCls}
            disabled={disabled}
            placeholder={t(`pc_form30_${key}` as never)}
            value={String(value[key] ?? '')}
            onChange={(e) => set(key, e.target.value)}
          />
        ))}
        <input
          type="number"
          min={0}
          className={inputCls}
          disabled={disabled}
          placeholder={t('pc_form30_emergency_calls_count')}
          value={String(value.emergency_calls_count ?? '')}
          onChange={(e) => set('emergency_calls_count', Number(e.target.value) || 0)}
        />
      </div>
      {TEXTAREA_FIELDS.map((key) => (
        <textarea
          key={key}
          className={inputCls}
          rows={2}
          disabled={disabled}
          placeholder={t(`pc_form30_${key}` as never)}
          value={String(value[key] ?? '')}
          onChange={(e) => set(key, e.target.value)}
        />
      ))}
      {LIST_FIELDS.map((key) => (
        <textarea
          key={key}
          className={inputCls}
          rows={2}
          disabled={disabled}
          placeholder={t(`pc_form30_${key}` as never)}
          value={Array.isArray(value[key]) ? (value[key] as string[]).join('\n') : String(value[key] ?? '')}
          onChange={(e) => setList(key, e.target.value)}
        />
      ))}
    </div>
  );
};

export const emptyForm30 = (): Form30Data => ({
  registration_number: '',
  workplace: '',
  disability_group: '',
  main_diagnosis: '',
  comorbidities: '',
  treatment_plan: '',
  diet_recommendations: '',
  physical_activity: '',
  smoking_status: '',
  alcohol_status: '',
  last_hospitalization: '',
  emergency_calls_count: 0,
  examinations_done: [],
  consultations_done: [],
  sanatorium_treatment: '',
  notes: '',
});

export default Form30Editor;
