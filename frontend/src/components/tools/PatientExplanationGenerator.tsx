import React, { useState } from 'react';
import { generatePatientExplanation } from '../../services/aiCouncilService';
import SpinnerIcon from '../icons/SpinnerIcon';
import { useTranslation } from '../../hooks/useTranslation';

const PatientExplanationGenerator: React.FC = () => {
    const { language } = useTranslation();
    const [clinicalText, setClinicalText] = useState(
        "Tashxis: Nostabil stenokardiya. Koronar angiografiya natijalariga ko'ra, chap oldingi tushuvchi arteriyaning proksimal qismida 75% gemodinamik ahamiyatga ega stenozi aniqlandi. EKGda V2-V4 tarmoqlarida ST segmenti depressiyasi kuzatiladi. Troponin I darajasi me'yorida. Ikki tomonlama antiagregant terapiya (Aspirin, Klopidogrel) va statinlar bilan davolash tavsiya etiladi."
    );
    const [patientText, setPatientText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!clinicalText.trim()) {
            setError("Iltimos, bemorga tushuntirish uchun tibbiy matnni kiriting.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setPatientText('');
        try {
            // FIX: Added missing 'language' argument.
            const result = await generatePatientExplanation(clinicalText, language);
            setPatientText(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Tushuntirish yaratishda xatolik yuz berdi.");
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="glass-panel p-6 md:p-8">
            <h3 className="text-xl font-bold text-text-primary">Bemor uchun Tushuntirish Generatori</h3>
            <p className="text-sm text-text-secondary mt-1 mb-6">
                Murakkab tibbiy xulosani chap tomonga kiriting va o'ng tomonda bemor uchun soddalashtirilgan tushuntirishni oling.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div>
                     <label htmlFor="clinicalText" className="block text-sm font-medium text-text-secondary mb-2">
                        Klinik Matn
                    </label>
                    <textarea
                        id="clinicalText"
                        value={clinicalText}
                        onChange={(e) => setClinicalText(e.target.value)}
                        rows={10}
                        className="block w-full sm:text-sm common-input focus:border-accent-color-blue focus:ring focus:ring-blue-500/30 placeholder-zinc-500 transition shadow-sm px-3 py-2"
                        placeholder="Tibbiy xulosani shu yerga kiriting..."
                    />
                </div>
                <div>
                     <label htmlFor="patientText" className="block text-sm font-medium text-text-secondary mb-2">
                        Bemor uchun Soddalashtirilgan Tushuntirish
                    </label>
                    <div className="h-full min-h-[240px] p-4 bg-slate-50 rounded-lg border border-border-color prose prose-sm max-w-none prose-p:my-2 prose-p:text-text-primary">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-full text-text-secondary">
                                <SpinnerIcon className="w-6 h-6 mr-2" />
                                <span>Yaratilmoqda...</span>
                            </div>
                        ) : patientText ? (
                            <div className="whitespace-pre-wrap">{patientText}</div>
                        ) : (
                            <p className="text-text-secondary">Natija shu yerda ko'rsatiladi.</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-6">
                 <button
                    onClick={handleGenerate}
                    disabled={isLoading}
                    className="w-full flex justify-center items-center gap-3 py-3 px-4 shadow-lg text-base font-bold animated-gradient-button focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-color focus:ring-accent-color-blue disabled:opacity-70 transition-all"
                >
                    {isLoading ? (
                        <>
                            <SpinnerIcon className="w-5 h-5" />
                            Soddalashtirilmoqda...
                        </>
                    ) : "Tushuntirishni Yaratish"}
                </button>
                {error && <p className="text-red-500 text-sm text-center mt-4">{error}</p>}
            </div>
        </div>
    );
};

export default PatientExplanationGenerator;