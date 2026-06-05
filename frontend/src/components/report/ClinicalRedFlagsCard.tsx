import React from 'react';
import type { ClinicalRedFlag } from '../../types';
import AlertTriangleIcon from '../icons/AlertTriangleIcon';
import { useTranslation } from '../../hooks/useTranslation';

interface ClinicalRedFlagsCardProps {
  flags: ClinicalRedFlag[];
}

const severityClass = (severity: string) => {
  const s = severity.toLowerCase();
  if (s === 'critical') return 'border-red-300 bg-red-50 text-red-900';
  if (s === 'warning') return 'border-amber-300 bg-amber-50 text-amber-900';
  return 'border-slate-300 bg-slate-50 text-slate-800';
};

const ClinicalRedFlagsCard: React.FC<ClinicalRedFlagsCardProps> = ({ flags }) => {
  const { t } = useTranslation();
  if (!flags.length) return null;

  return (
    <div className="rounded-xl border-2 border-red-300 bg-red-50/80 overflow-hidden shadow-sm">
      <div className="px-4 py-3 bg-red-100 border-b border-red-200 flex items-center gap-3">
        <AlertTriangleIcon className="w-6 h-6 text-red-600 shrink-0" />
        <h3 className="text-base font-bold text-red-900">{t('clinical_red_flags_title')}</h3>
      </div>
      <ul className="p-4 space-y-3">
        {flags.map((flag, i) => (
          <li
            key={`${flag.code}-${i}`}
            className={`p-3 rounded-lg border ${severityClass(flag.severity)}`}
          >
            <p className="font-semibold">{flag.message}</p>
            {flag.action && (
              <p className="text-sm mt-1">
                <span className="font-semibold">{t('clinical_red_flags_action')}: </span>
                {flag.action}
              </p>
            )}
            {flag.code && (
              <p className="text-xs opacity-70 mt-1 font-mono">{flag.code}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ClinicalRedFlagsCard;
