import React, { useState } from 'react';
import { calculateRiskScore } from '../../services/aiCouncilService';
import type { RiskScore } from '../../types';
import SpinnerIcon from '../icons/SpinnerIcon';
import { useTranslation } from '../../hooks/useTranslation';
import {
    calculateChadsVasc,
    calculateHeart,
    calculateAscvdSimplified,
    interpretChadsVasc,
    interpretHeart,
    interpretAscvd,
    type ChadsVascInput,
    type HeartScoreInput,
    type AscvdInput,
} from '../../utils/riskScores';

const RiskScoringTool: React.FC = () => {
    const { t, language } = useTranslation();
    const [scoreType, setScoreType] = useState('CHADS-VASc');
    const [result, setResult] = useState<RiskScore | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [age, setAge] = useState(68);
    const [female, setFemale] = useState(false);
    const [chf, setChf] = useState(false);
    const [hypertension, setHypertension] = useState(true);
    const [diabetes, setDiabetes] = useState(false);
    const [strokeTia, setStrokeTia] = useState(false);
    const [vascular, setVascular] = useState(false);

    const [heartHistory, setHeartHistory] = useState<HeartScoreInput['history']>('moderate');
    const [heartEcg, setHeartEcg] = useState<HeartScoreInput['ecg']>('nonspecific');
    const [heartRiskFactors, setHeartRiskFactors] = useState(2);
    const [heartTroponin, setHeartTroponin] = useState<HeartScoreInput['troponin']>('normal');

    const [smoker, setSmoker] = useState(false);
    const [systolicBp, setSystolicBp] = useState(140);
    const [onBpMeds, setOnBpMeds] = useState(true);
    const [totalChol, setTotalChol] = useState(220);
    const [hdl, setHdl] = useState(45);

    const handleCalculate = async () => {
        setIsLoading(true);
        setError(null);
        setResult(null);
        try {
            let score = 0;
            let localInterpretation = '';
            let factors: Record<string, unknown> = { age, female };

            if (scoreType === 'CHADS-VASc') {
                const input: ChadsVascInput = {
                    chf,
                    hypertension,
                    age,
                    diabetes,
                    strokeTia,
                    vascularDisease: vascular,
                    female,
                };
                score = calculateChadsVasc(input);
                factors = { ...input };
                localInterpretation = interpretChadsVasc(score, language);
            } else if (scoreType === 'HEART') {
                const input: HeartScoreInput = {
                    history: heartHistory,
                    ecg: heartEcg,
                    age,
                    riskFactors: heartRiskFactors,
                    troponin: heartTroponin,
                };
                score = calculateHeart(input);
                factors = { ...input };
                localInterpretation = interpretHeart(score, language);
            } else {
                const input: AscvdInput = {
                    age,
                    male: !female,
                    smoker,
                    diabetes,
                    systolicBp,
                    onHypertensionTreatment: onBpMeds,
                    totalCholesterol: totalChol,
                    hdl,
                };
                score = calculateAscvdSimplified(input);
                factors = { ...input };
                localInterpretation = interpretAscvd(score, language);
            }

            const scoreResult = await calculateRiskScore(
                scoreType,
                { firstName: '', lastName: '', age: String(age), gender: female ? 'female' : 'male', complaints: '' },
                language,
                { score, factors, localInterpretation },
            );
            setResult(scoreResult);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Xavfni hisoblashda xatolik yuz berdi.");
        } finally {
            setIsLoading(false);
        }
    };

    const CheckRow: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }> = ({
        label,
        checked,
        onChange,
    }) => (
        <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="rounded" />
            {label}
        </label>
    );

    return (
        <div className="glass-panel p-6 md:p-8">
            <h3 className="text-xl font-bold text-text-primary">{t('tools_risk_scoring_title')}</h3>
            <p className="text-sm text-text-secondary mt-1 mb-6">{t('tools_risk_scoring_desc')}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">{t('tool_risk_score_label')}</label>
                    <select
                        value={scoreType}
                        onChange={(e) => setScoreType(e.target.value)}
                        className="w-full common-input custom-select"
                    >
                        <option value="CHADS-VASc">CHADS-VASc (Insult xavfi)</option>
                        <option value="HEART">HEART Score (Ko'krak og'rig'i)</option>
                        <option value="ASCVD">ASCVD (Yurak-qon tomir xavfi)</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Yosh</label>
                    <input
                        type="number"
                        min={1}
                        max={120}
                        value={age}
                        onChange={(e) => setAge(Number(e.target.value))}
                        className="w-full common-input"
                    />
                </div>
            </div>

            {scoreType === 'CHADS-VASc' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4 p-3 bg-slate-50 rounded-lg border">
                    <CheckRow label="Yurak yetishmovchiligi (CHF)" checked={chf} onChange={setChf} />
                    <CheckRow label="Arterial gipertenziya" checked={hypertension} onChange={setHypertension} />
                    <CheckRow label="Qandli diabet" checked={diabetes} onChange={setDiabetes} />
                    <CheckRow label="Insult/TIA anamnezi" checked={strokeTia} onChange={setStrokeTia} />
                    <CheckRow label="Qon tomir kasalligi" checked={vascular} onChange={setVascular} />
                    <CheckRow label="Ayol jins" checked={female} onChange={setFemale} />
                </div>
            )}

            {scoreType === 'HEART' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 p-3 bg-slate-50 rounded-lg border text-sm">
                    <div>
                        <label className="block text-text-secondary mb-1">Anamnez</label>
                        <select value={heartHistory} onChange={(e) => setHeartHistory(e.target.value as HeartScoreInput['history'])} className="w-full common-input custom-select">
                            <option value="highly">Juda shubhali</option>
                            <option value="moderate">O'rtacha shubhali</option>
                            <option value="slightly">Biroz shubhali</option>
                            <option value="none">Shubhasiz</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-text-secondary mb-1">EKG</label>
                        <select value={heartEcg} onChange={(e) => setHeartEcg(e.target.value as HeartScoreInput['ecg'])} className="w-full common-input custom-select">
                            <option value="significant">Muhim o'zgarish</option>
                            <option value="nonspecific">Nospecific</option>
                            <option value="normal">Normal</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-text-secondary mb-1">Xavf omillari (soni)</label>
                        <input type="number" min={0} max={5} value={heartRiskFactors} onChange={(e) => setHeartRiskFactors(Number(e.target.value))} className="w-full common-input" />
                    </div>
                    <div>
                        <label className="block text-text-secondary mb-1">Troponin</label>
                        <select value={heartTroponin} onChange={(e) => setHeartTroponin(e.target.value as HeartScoreInput['troponin'])} className="w-full common-input custom-select">
                            <option value="elevated">Oshgan</option>
                            <option value="normal">Normal</option>
                        </select>
                    </div>
                </div>
            )}

            {scoreType === 'ASCVD' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 p-3 bg-slate-50 rounded-lg border text-sm">
                    <CheckRow label="Erkak" checked={!female} onChange={(v) => setFemale(!v)} />
                    <CheckRow label="Chekuvchi" checked={smoker} onChange={setSmoker} />
                    <CheckRow label="Qandli diabet" checked={diabetes} onChange={setDiabetes} />
                    <CheckRow label="Gipertenziya dori qabul qiladi" checked={onBpMeds} onChange={setOnBpMeds} />
                    <div>
                        <label className="block text-text-secondary mb-1">Sistolik BP (mmHg)</label>
                        <input type="number" value={systolicBp} onChange={(e) => setSystolicBp(Number(e.target.value))} className="w-full common-input" />
                    </div>
                    <div>
                        <label className="block text-text-secondary mb-1">Umumiy xolesterin (mg/dL)</label>
                        <input type="number" value={totalChol} onChange={(e) => setTotalChol(Number(e.target.value))} className="w-full common-input" />
                    </div>
                    <div>
                        <label className="block text-text-secondary mb-1">HDL (mg/dL)</label>
                        <input type="number" value={hdl} onChange={(e) => setHdl(Number(e.target.value))} className="w-full common-input" />
                    </div>
                </div>
            )}

            <button
                onClick={handleCalculate}
                disabled={isLoading}
                className="w-full sm:w-auto flex justify-center items-center gap-2 py-2.5 px-6 shadow-md text-sm font-bold animated-gradient-button disabled:opacity-70"
            >
                {isLoading ? <><SpinnerIcon className="w-4 h-4" /> Hisoblanmoqda...</> : 'Hisoblash'}
            </button>

            {error && <p className="text-red-500 text-sm text-center mt-4">{error}</p>}

            {result && (
                <div className="mt-8 animate-fade-in-up p-4 bg-slate-50 rounded-lg border border-border-color">
                    <h4 className="text-lg font-bold text-text-primary">{result.name} — {result.score} ball</h4>
                    <p className="text-sm text-text-secondary mt-2 whitespace-pre-wrap">{result.interpretation}</p>
                </div>
            )}
        </div>
    );
};

export default RiskScoringTool;
