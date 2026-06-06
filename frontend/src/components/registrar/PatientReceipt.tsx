import React from 'react';
import type { PatientPassport } from '../../services/apiPatientService';
import { useTranslation } from '../../hooks/useTranslation';

interface PatientReceiptProps {
    patient: PatientPassport;
    clinicName?: string;
    registrarName?: string;
}

const PatientReceipt: React.FC<PatientReceiptProps> = ({ patient, clinicName, registrarName }) => {
    const { t } = useTranslation();
    const now = new Date().toLocaleString();

    const genderLabel =
        patient.gender === 'male'
            ? t('gender_male')
            : patient.gender === 'female'
              ? t('gender_female')
              : patient.gender || '—';

    const addressLine = [patient.region_name, patient.district_name, patient.address]
        .filter(Boolean)
        .join(', ');

    return (
        <div
            id="patient-receipt-print"
            className="bg-white text-slate-900 p-6 rounded-xl border-2 border-dashed border-slate-300 max-w-sm mx-auto font-sans"
        >
            <div className="text-center border-b border-slate-200 pb-3 mb-4">
                <p className="text-[10px] uppercase tracking-widest text-slate-500">{t('receipt_title')}</p>
                <p className="text-lg font-black text-sky-800 mt-1">{clinicName || 'Medora AI'}</p>
            </div>
            <div className="text-center mb-4">
                <p className="text-[10px] text-slate-500 uppercase">{t('receipt_patient_id')}</p>
                <p className="text-4xl font-black tabular-nums text-slate-900 tracking-tight">{patient.id}</p>
            </div>
            <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">{t('last_name_label')}</dt>
                    <dd className="font-bold text-right">{patient.last_name}</dd>
                </div>
                <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">{t('first_name_label')}</dt>
                    <dd className="font-bold text-right">{patient.first_name}</dd>
                </div>
                {patient.father_name && (
                    <div className="flex justify-between gap-2">
                        <dt className="text-slate-500">{t('father_name_label')}</dt>
                        <dd className="font-bold text-right">{patient.father_name}</dd>
                    </div>
                )}
                <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">{t('age_label')}</dt>
                    <dd className="font-bold">{patient.age}</dd>
                </div>
                <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">{t('gender_label')}</dt>
                    <dd className="font-bold">{genderLabel}</dd>
                </div>
                {patient.phone && (
                    <div className="flex justify-between gap-2">
                        <dt className="text-slate-500">{t('phone_label')}</dt>
                        <dd className="font-bold">{patient.phone}</dd>
                    </div>
                )}
                {addressLine && (
                    <div>
                        <dt className="text-slate-500 text-xs">{t('address_label')}</dt>
                        <dd className="font-medium text-xs mt-0.5">{addressLine}</dd>
                    </div>
                )}
            </dl>
            <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] text-slate-400 flex justify-between">
                <span>{now}</span>
                {registrarName && <span>{registrarName}</span>}
            </div>
            <p className="text-[9px] text-center text-slate-400 mt-3">{t('receipt_footer_hint')}</p>
        </div>
    );
};

export function printPatientReceipt() {
    const el = document.getElementById('patient-receipt-print');
    if (!el) return;
    const w = window.open('', '_blank', 'width=400,height=600');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Chek</title>
        <style>body{font-family:system-ui,sans-serif;margin:16px;} @media print{body{margin:0;}}</style>
        </head><body>${el.outerHTML}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
}

export default PatientReceipt;
