import React from 'react';
import { PrognosisReport } from '../../types';
import SpinnerIcon from '../icons/SpinnerIcon';
import ChartBarIcon from '../icons/ChartBarIcon';

interface PrognosisCardProps {
    prognosis: PrognosisReport | null;
    isLoading: boolean;
}

const PrognosisCard: React.FC<PrognosisCardProps> = ({ prognosis, isLoading }) => {
    return (
        <div className="p-4 bg-slate-100 rounded-lg border border-border-color">
            <h4 className="font-bold text-text-primary mb-2 flex items-center gap-2"><ChartBarIcon className="w-5 h-5 text-rose-600" /> Kasallik Prognozi</h4>
            {isLoading && <div className="text-center p-4"><SpinnerIcon /></div>}
            {prognosis && !isLoading && (
                <div className="space-y-3 text-sm">
                    <div>
                        <h5 className="font-semibold text-text-secondary">Qisqa muddatli (1-3 oy):</h5>
                        <p>{prognosis.shortTermPrognosis}</p>
                    </div>
                     <div>
                        <h5 className="font-semibold text-text-secondary">Uzoq muddatli (1-5 yil):</h5>
                        <p>{prognosis.longTermPrognosis}</p>
                    </div>
                     <div>
                        <h5 className="font-semibold text-text-secondary">Prognozga ta'sir etuvchi asosiy omillar:</h5>
                        <ul className="list-disc list-inside">
                            {prognosis.keyFactors.map((factor, i) => <li key={i}>{factor}</li>)}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PrognosisCard;
