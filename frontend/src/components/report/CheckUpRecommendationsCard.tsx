import React from 'react';
import type { CheckUpRecommendation } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';

const priorityClass = (p?: string) => {
  if (p === 'high') return 'border-red-300 bg-red-50';
  if (p === 'low') return 'border-slate-200 bg-slate-50';
  return 'border-sky-200 bg-sky-50/60';
};

const CheckUpRecommendationsCard: React.FC<{ items?: CheckUpRecommendation[] }> = ({ items }) => {
  const { t } = useTranslation();
  if (!items?.length) return null;

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 overflow-hidden">
      <div className="px-4 py-3 bg-emerald-100/80 border-b border-emerald-200">
        <h3 className="text-base font-bold text-emerald-900">{t('final_report_checkup_title')}</h3>
      </div>
      <ul className="p-4 space-y-3 text-sm">
        {items.map((item, i) => (
          <li key={i} className={`p-3 rounded-lg border ${priorityClass(item.priority)}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-bold text-slate-900">{item.screeningName}</p>
              {item.priority && (
                <span className="text-[10px] uppercase font-semibold text-slate-500">
                  {t(`checkup_priority_${item.priority}`)}
                </span>
              )}
            </div>
            {item.frequency && (
              <p className="text-slate-600 mt-1">
                {t('checkup_frequency')}: {item.frequency}
              </p>
            )}
            {item.reason && <p className="mt-1 text-slate-700">{item.reason}</p>}
            {(item.guidelineSource || item.evidenceLevel) && (
              <p className="text-xs text-slate-500 mt-1.5">
                {item.guidelineSource && (
                  <span>
                    {t('checkup_guideline_source')}: {item.guidelineSource}
                  </span>
                )}
                {item.evidenceLevel && (
                  <span className={item.guidelineSource ? ' ml-3' : ''}>
                    {t('checkup_evidence_level')}: {item.evidenceLevel}
                  </span>
                )}
              </p>
            )}
            {item.sourceUrl && (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 underline mt-1 inline-block"
              >
                {t('checkup_view_source')}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CheckUpRecommendationsCard;
