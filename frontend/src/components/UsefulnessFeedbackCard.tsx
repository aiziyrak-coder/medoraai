import React, { useState } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { submitUsefulnessFeedback } from '../services/apiAnalysisService';

interface UsefulnessFeedbackCardProps {
  analysisId: number;
  onSubmitted?: () => void;
  compact?: boolean;
}

const UsefulnessFeedbackCard: React.FC<UsefulnessFeedbackCardProps> = ({ analysisId, onSubmitted, compact }) => {
  const { t } = useTranslation();
  const [useful, setUseful] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (useful === null) return;
    setSending(true);
    try {
      const res = await submitUsefulnessFeedback(analysisId, useful, comment.trim() || undefined);
      if (res.success) {
        setSent(true);
        onSubmitted?.();
      }
    } finally {
      setSending(false);
    }
  };

  const handlePick = async (value: boolean) => {
    setUseful(value);
    if (compact && !comment.trim()) {
      setSending(true);
      try {
        const res = await submitUsefulnessFeedback(analysisId, value);
        if (res.success) {
          setSent(true);
          onSubmitted?.();
        }
      } finally {
        setSending(false);
      }
    }
  };

  if (sent) {
    return (
      <div className={compact ? 'text-xs text-emerald-700 font-medium' : 'p-4 bg-emerald-50 rounded-xl border border-emerald-200'}>
        <p className={compact ? '' : 'text-sm font-medium text-emerald-800'}>
          {t('usefulness_feedback_thanks')}
        </p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-700 shrink-0">{t('usefulness_feedback_title')}</span>
          <button
            type="button"
            onClick={() => void handlePick(true)}
            disabled={sending}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${
              useful === true ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-300 hover:border-emerald-400'
            }`}
          >
            {t('usefulness_feedback_yes')}
          </button>
          <button
            type="button"
            onClick={() => void handlePick(false)}
            disabled={sending}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${
              useful === false ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-700 border-slate-300 hover:border-rose-400'
            }`}
          >
            {t('usefulness_feedback_no')}
          </button>
        </div>
        {(useful !== null || comment) && (
          <div className="flex gap-2">
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('usefulness_feedback_comment_placeholder')}
              className="flex-1 min-w-0 rounded-md border border-slate-300 bg-white text-slate-900 text-xs px-2 py-1.5 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
              maxLength={500}
            />
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={useful === null || sending}
              className="shrink-0 px-2.5 py-1.5 rounded-md text-xs font-semibold text-white bg-slate-700 hover:bg-slate-800 disabled:opacity-50"
            >
              {sending ? '…' : t('usefulness_feedback_submit')}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
      <h4 className="font-bold text-slate-900 mb-1">{t('usefulness_feedback_title')}</h4>
      <p className="text-xs text-slate-600 mb-4">{t('usefulness_feedback_subtitle')}</p>
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => setUseful(true)}
          className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition-colors border-2 ${
            useful === true
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'bg-white text-slate-800 border-slate-300 hover:border-emerald-400 hover:bg-emerald-50'
          }`}
        >
          {t('usefulness_feedback_yes')}
        </button>
        <button
          type="button"
          onClick={() => setUseful(false)}
          className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition-colors border-2 ${
            useful === false
              ? 'bg-rose-600 text-white border-rose-600'
              : 'bg-white text-slate-800 border-slate-300 hover:border-rose-400 hover:bg-rose-50'
          }`}
        >
          {t('usefulness_feedback_no')}
        </button>
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={t('usefulness_feedback_comment_placeholder')}
        className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 text-sm px-3 py-2 mb-3 min-h-[72px] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500"
        maxLength={2000}
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={useful === null || sending}
        className="w-full py-2.5 px-3 rounded-lg text-sm font-bold text-white animated-gradient-button disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        {sending ? t('usefulness_feedback_sending') : t('usefulness_feedback_submit')}
      </button>
    </div>
  );
};

export default UsefulnessFeedbackCard;
