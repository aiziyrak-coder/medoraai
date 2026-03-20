import React from 'react';
import { PrognosisReport } from '../../types';
import SpinnerIcon from '../icons/SpinnerIcon';
import ChartBarIcon from '../icons/ChartBarIcon';
import { useTranslation } from '../../hooks/useTranslation';

interface PrognosisCardProps {
    prognosis: PrognosisReport | null;
    isLoading: boolean;
}

const PrognosisCard: React.FC<PrognosisCardProps> = ({ prognosis, isLoading }) => {
    const { t } = useTranslation();
    const shortText = (prognosis?.shortTermPrognosis || '').trim();
    const longText = (prognosis?.longTermPrognosis || '').trim();
    const hasShort = shortText.length > 0 && shortText !== '-';
    const hasLong = longText.length > 0 && longText !== '-';

    return (
        <div className="p-4 bg-slate-100 rounded-lg border border-border-color">
            <h4 className="font-bold text-text-primary mb-2 flex items-center gap-2">
                <ChartBarIcon className="w-5 h-5 text-rose-600" /> {t('final_report_prognosis_title')}
            </h4>
            {isLoading && (
                <div className="text-center p-4 space-y-2">
                    <SpinnerIcon />
                    <p className="text-slate-600 text-sm">{t('prognosis_card_loading')}</p>
                </div>
            )}
            {!prognosis && !isLoading && (
                <p className="text-slate-600 text-sm">{t('prognosis_card_pending')}</p>
            )}
            {prognosis && !isLoading && (
                <div className="space-y-3 text-sm">
                    <div>
                        <h5 className="font-semibold text-text-secondary">{t('prognosis_section_short')}</h5>
                        <p className="text-text-primary">{hasShort ? prognosis.shortTermPrognosis : t('prognosis_fallback_line')}</p>
                    </div>
                    <div>
                        <h5 className="font-semibold text-text-secondary">{t('prognosis_section_long')}</h5>
                        <p className="text-text-primary">{hasLong ? prognosis.longTermPrognosis : t('prognosis_fallback_line')}</p>
                    </div>
                    <div>
                        <h5 className="font-semibold text-text-secondary">{t('prognosis_section_factors')}</h5>
                        {(Array.isArray(prognosis.keyFactors) && prognosis.keyFactors.length > 0) ? (
                            <ul className="list-disc list-inside text-text-primary space-y-0.5">
                                {prognosis.keyFactors.map((factor, i) => <li key={i}>{factor}</li>)}
                            </ul>
                        ) : (
                            <p className="text-slate-600 text-sm">{t('prognosis_factors_fallback')}</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PrognosisCard;