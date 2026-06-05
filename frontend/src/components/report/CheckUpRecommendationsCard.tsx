import React from 'react';
import type { CheckUpRecommendation } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';

const CheckUpRecommendationsCard: React.FC<{ items?: CheckUpRecommendation[] }> = ({ items }) => {
  const { t } = useTranslation();
  if (!items?.length) return null;

  const priorityClass = (p?: string) => {
    if (p === 'high') return 'border-red-300 bg-red-50';
    if (p === 'low') return 'border-slate-200 bg-slate-50';
    return 'border-sky-200 bg-sky-50/60';
  };

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 overflow-hidden">
      <div className="px-4 py-3 bg-emerald-100/80 border-b border-emerald-200">
        <h3 className="text-base font-bold text-emerald-900">{t('final_report_checkup_title')}</h3>
      </div>
      <ul className="p-4 space-y-3 text-sm">
        {items.map((item, i) => (
          <li key={i} className={`p-3 rounded-lg border ${priorityClass(item.priority)}`}>
            <p className="font-bold text-slate-900">{item.screeningName}</p>
            {item.frequency && (
              <p className="text-slate-600 mt-1">
                {t('checkup_frequency')}: {item.frequency}
              </p>
            )}
            {item.reason && <p className="mt-1 text-slate-700">{item.reason}</p>}
            {item.priority && (
              <p className="text-xs text-slate-500 mt-1 capitalize">{item.priority}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CheckUpRecommendationsCard;
