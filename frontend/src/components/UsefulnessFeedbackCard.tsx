import React, { useState } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { submitUsefulnessFeedback } from '../services/apiAnalysisService';

interface UsefulnessFeedbackCardProps {
  analysisId: number;
  onSubmitted?: () => void;
}

const UsefulnessFeedbackCard: React.FC<UsefulnessFeedbackCardProps> = ({ analysisId, onSubmitted }) => {
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

  if (sent) {
    return (
      <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
        <p className="text-sm font-medium text-green-800 dark:text-green-200">
          {t('usefulness_feedback_thanks')}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
      <h4 className="font-bold text-text-primary mb-2">{t('usefulness_feedback_title')}</h4>
      <p className="text-xs text-text-secondary mb-3">{t('usefulness_feedback_subtitle')}</p>
      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => setUseful(true)}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
            useful === true
              ? 'bg-green-600 text-white'
              : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-text-primary hover:bg-slate-50 dark:hover:bg-slate-600'
          }`}
        >
          {t('usefulness_feedback_yes')}
        </button>
        <button
          type="button"
          onClick={() => setUseful(false)}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
            useful === false
              ? 'bg-red-600 text-white'
              : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-text-primary hover:bg-slate-50 dark:hover:bg-slate-600'
          }`}
        >
          {t('usefulness_feedback_no')}
        </button>
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={t('usefulness_feedback_comment_placeholder')}
        className="w-full common-input text-sm mb-3 min-h-[60px]"
        maxLength={2000}
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={useful === null || sending}
        className="w-full py-2 px-3 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {sending ? t('usefulness_feedback_sending') : t('usefulness_feedback_submit')}
      </button>
    </div>
  );
};

export default UsefulnessFeedbackCard;
