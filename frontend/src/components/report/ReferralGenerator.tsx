import React, { useState } from 'react';
import { Referral, PatientData } from '../../types';
import DocumentTextIcon from '../icons/DocumentTextIcon';

interface ReferralGeneratorProps {
    referrals: Referral[];
    patientData: Partial<PatientData>;
}

const ReferralGenerator: React.FC<ReferralGeneratorProps> = ({ referrals, patientData }) => {
    const [generatedText, setGeneratedText] = useState('');

    const generateText = (referral: Referral) => {
        const text = `
--------------------------------------------------
YO'LLANMA (FORMA 027/H)
--------------------------------------------------

Konsultantga: ${referral.specialty}

Bemor: ${patientData.lastName} ${patientData.firstName}
Yoshi: ${patientData.age}

Asosiy Tashxis (taxminiy):
${referral.reason}

Konsultatsiya Maqsadi:
Tashxisni aniqlashtirish va davolash taktikasini belgilash.

Shoshilinchlik: ${referral.urgency === 'Urgent' ? 'SHOSHILINCH' : 'Rejali'}

Hurmat bilan,
KONSILIUM Tizimi / Davolovchi Shifokor
        `;
        setGeneratedText(text.trim());
    };
    
    return (
        <div className="p-4 bg-slate-100 rounded-lg border border-border-color">
            <h4 className="font-bold text-text-primary mb-3 flex items-center gap-2"><DocumentTextIcon className="w-5 h-5" /> Mutaxassis Konsultatsiyasi</h4>
            {referrals.map((ref, i) => (
                <button key={i} onClick={() => generateText(ref)} className="w-full text-left p-2 bg-white rounded-md mb-2 hover:bg-blue-50">
                    <span className="font-semibold">{ref.specialty}ga</span> yo'llanma ({ref.urgency})
                </button>
            ))}
            {generatedText && (
                <textarea 
                    readOnly
                    value={generatedText}
                    rows={10}
                    className="w-full common-input mt-2 bg-slate-200"
                />
            )}
        </div>
    );
};

export default ReferralGenerator;
