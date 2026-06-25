import React from 'react';
import type { AnalysisRecord } from '../../types';
import FollowUpAnalysis from '../FollowUpAnalysis';
import UsefulnessFeedbackCard from '../UsefulnessFeedbackCard';
import PhysicianSignOffCard from './PhysicianSignOffCard';
import DownloadPanel from '../DownloadPanel';
import { useTranslation } from '../../hooks/useTranslation';

interface ReportFooterPanelProps {
  analysisId?: number;
  record: Partial<AnalysisRecord>;
  hasError?: boolean;
  showDownload?: boolean;
  showSignOff?: boolean;
  followUp?: {
    isAnalyzing: boolean;
    onSubmit: (question: string) => void;
    followUpHistory: { question: string; answer: string }[];
    isFinalized: boolean;
    onFinalize: () => void;
    isLive: boolean;
  };
}

/** Yakuniy xulosa ostidagi savol-javob, fikr, tasdiq va yuklab olish — bitta ixcham panel */
const ReportFooterPanel: React.FC<ReportFooterPanelProps> = ({
  analysisId,
  record,
  hasError,
  showDownload = true,
  showSignOff = true,
  followUp,
}) => {
  const { t } = useTranslation();
  const hasAnalysisId = analysisId != null && !isNaN(analysisId) && analysisId > 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
        <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">
          {t('report_footer_panel_title')}
        </p>
      </div>

      <div className="divide-y divide-slate-100">
        {followUp && (
          <div className="px-3 py-2.5">
            <FollowUpAnalysis compact {...followUp} />
          </div>
        )}

        {hasAnalysisId && (
          <div className="px-3 py-2.5">
            <UsefulnessFeedbackCard compact analysisId={analysisId} />
          </div>
        )}

        {hasAnalysisId && showSignOff && (
          <div className="px-3 py-2.5">
            <PhysicianSignOffCard compact analysisId={analysisId} />
          </div>
        )}

        {showDownload && (
          <div className="px-3 py-2.5 bg-slate-50/50">
            <DownloadPanel compact record={record} hasError={hasError} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportFooterPanel;
