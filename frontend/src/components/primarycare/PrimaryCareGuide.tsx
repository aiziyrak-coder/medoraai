import React from 'react';
import { useTranslation } from '../../hooks/useTranslation';

const MODULES = [
  { icon: '👥', titleKey: 'pc_guide_mod_population', descKey: 'pc_guide_mod_population_desc' },
  { icon: '🏥', titleKey: 'pc_guide_mod_brigade', descKey: 'pc_guide_mod_brigade_desc' },
  { icon: '🩺', titleKey: 'pc_guide_mod_checkup', descKey: 'pc_guide_mod_checkup_desc' },
  { icon: '🔬', titleKey: 'pc_guide_mod_screening', descKey: 'pc_guide_mod_screening_desc' },
  { icon: '🏠', titleKey: 'pc_guide_mod_patronage', descKey: 'pc_guide_mod_patronage_desc' },
  { icon: '📋', titleKey: 'pc_guide_mod_dispensary', descKey: 'pc_guide_mod_dispensary_desc' },
  { icon: '📊', titleKey: 'pc_guide_mod_plan', descKey: 'pc_guide_mod_plan_desc' },
];

interface WorkflowStep {
  step: number;
  title: string;
  description: string;
  action: string;
}

interface Props {
  workflow?: WorkflowStep[];
  onGoTo?: (action: string) => void;
  onSetup?: () => void;
  settingUp?: boolean;
  needsSetup?: boolean;
}

const PrimaryCareGuide: React.FC<Props> = ({ workflow, onGoTo, onSetup, settingUp, needsSetup }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-sky-600 mb-1">
          SSV 210-son buyruq · 27.07.2022
        </p>
        <h3 className="text-lg font-black text-slate-800">{t('pc_guide_title')}</h3>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed">{t('pc_guide_intro')}</p>
        {needsSetup && onSetup && (
          <button
            type="button"
            disabled={settingUp}
            onClick={onSetup}
            className="mt-4 w-full sm:w-auto rounded-xl bg-emerald-600 text-white px-5 py-3 text-sm font-bold hover:bg-emerald-700 disabled:opacity-60"
          >
            {settingUp ? t('pc_setup_running') : t('pc_setup_button')}
          </button>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {MODULES.map((m) => (
          <div key={m.titleKey} className="rounded-xl border border-slate-200 bg-white p-4">
            <span className="text-2xl">{m.icon}</span>
            <h4 className="font-bold text-slate-800 text-sm mt-2">{t(m.titleKey)}</h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{t(m.descKey)}</p>
          </div>
        ))}
      </div>

      {workflow && workflow.length > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
          <h4 className="font-bold text-emerald-900 text-sm mb-3">{t('pc_workflow_title')}</h4>
          <ol className="space-y-3">
            {workflow.map((w) => (
              <li key={w.step} className="flex gap-3 items-start">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">
                  {w.step}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-slate-800">{w.title}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{w.description}</p>
                  {onGoTo && (
                    <button
                      type="button"
                      onClick={() => onGoTo(w.action)}
                      className="text-xs text-emerald-700 font-bold mt-1 hover:underline"
                    >
                      {t('pc_go_step')} →
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-xs text-amber-900">
        <p className="font-bold mb-1">{t('pc_guide_screening_title')}</p>
        <ul className="list-disc ml-4 space-y-0.5 text-amber-800">
          <li>{t('pc_guide_screen_1')}</li>
          <li>{t('pc_guide_screen_2')}</li>
          <li>{t('pc_guide_screen_3')}</li>
          <li>{t('pc_guide_screen_4')}</li>
          <li>{t('pc_guide_screen_5')}</li>
        </ul>
      </div>
    </div>
  );
};

export default PrimaryCareGuide;
