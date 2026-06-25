import React, { useState } from 'react';
import ShieldCheckIcon from '../icons/ShieldCheckIcon';
import { useTranslation } from '../../hooks/useTranslation';
import { isApiConfigured } from '../../config/api';
import { physicianSignAnalysis } from '../../services/apiAnalysisService';

interface PhysicianSignOffCardProps {
  analysisId: number;
  compact?: boolean;
}

const PhysicianSignOffCard: React.FC<PhysicianSignOffCardProps> = ({ analysisId, compact }) => {
  const { t } = useTranslation();
  const [note, setNote] = useState('');
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [signedBy, setSignedBy] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isApiConfigured()) return null;

  const handleSign = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await physicianSignAnalysis(analysisId, note);
      if (res.success && res.data) {
        setSignedAt(res.data.signed_at);
        setSignedBy(res.data.signed_by);
      } else {
        setError(res.error?.message || t('physician_sign_error'));
      }
    } catch {
      setError(t('physician_sign_error'));
    } finally {
      setLoading(false);
    }
  };

  if (signedAt) {
    const inner = (
      <>
        <div className={`flex items-center gap-1.5 font-semibold text-emerald-800 ${compact ? 'text-xs' : ''}`}>
          <ShieldCheckIcon className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
          {t('physician_sign_success')}
        </div>
        <p className={`text-emerald-700 mt-0.5 ${compact ? 'text-[11px]' : 'text-sm'}`}>
          {signedBy && <span>{signedBy} · </span>}
          {new Date(signedAt).toLocaleString()}
        </p>
        {note && <p className={`text-emerald-600 mt-1 italic ${compact ? 'text-[11px]' : 'text-sm'}`}>{note}</p>}
      </>
    );
    return compact ? (
      <div>{inner}</div>
    ) : (
      <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50">{inner}</div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
          <ShieldCheckIcon className="w-3.5 h-3.5 text-emerald-600" />
          {t('physician_sign_title')}
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('physician_sign_note_placeholder')}
            className="flex-1 min-w-0 rounded-md border border-slate-300 bg-white text-xs px-2 py-1.5 common-input"
          />
          <button
            type="button"
            onClick={handleSign}
            disabled={loading}
            className="shrink-0 px-2.5 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading ? '…' : t('physician_sign_btn')}
          </button>
        </div>
        {error && <p className="text-[11px] text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
      <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
        <ShieldCheckIcon className="w-5 h-5 text-emerald-600" />
        {t('physician_sign_title')}
      </h4>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t('physician_sign_note_placeholder')}
        rows={2}
        className="w-full common-input text-sm mb-3"
      />
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <button
        type="button"
        onClick={handleSign}
        disabled={loading}
        className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {loading ? t('loading_text') : t('physician_sign_btn')}
      </button>
    </div>
  );
};

export default PhysicianSignOffCard;
