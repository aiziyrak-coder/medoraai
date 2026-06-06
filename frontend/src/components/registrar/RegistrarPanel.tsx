import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    registrySearchPatients,
    registerPatientPassport,
    type PatientPassport,
} from '../../services/apiPatientService';
import AddressCombobox from '../address/AddressCombobox';
import PatientReceipt, { printPatientReceipt } from './PatientReceipt';
import { useTranslation } from '../../hooks/useTranslation';
import type { User } from '../../types';

interface RegistrarPanelProps {
    user: User;
}

const emptyForm = () => ({
    firstName: '',
    lastName: '',
    fatherName: '',
    age: '',
    gender: '' as '' | 'male' | 'female' | 'other',
    phone: '',
    address: '',
    regionId: '',
    districtId: '',
    addressLabel: '',
});

const RegistrarPanel: React.FC<RegistrarPanelProps> = ({ user }) => {
    const { t } = useTranslation();
    const [form, setForm] = useState(emptyForm());
    const [search, setSearch] = useState('');
    const [hits, setHits] = useState<PatientPassport[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [receipt, setReceipt] = useState<PatientPassport | null>(null);
    const [editId, setEditId] = useState<number | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const loadFormFromPassport = useCallback((p: PatientPassport) => {
        setEditId(p.id);
        setForm({
            firstName: p.first_name,
            lastName: p.last_name,
            fatherName: p.father_name || '',
            age: p.age,
            gender: (p.gender as '' | 'male' | 'female' | 'other') || '',
            phone: p.phone || '',
            address: p.address || '',
            regionId: p.region_id || '',
            districtId: p.district_id || '',
            addressLabel: [p.region_name, p.district_name].filter(Boolean).join(', '),
        });
        setReceipt(null);
    }, []);

    useEffect(() => {
        const q = search.trim();
        if (q.length < 1) {
            setHits([]);
            return;
        }
        if (debounceRef.current) clearTimeout(debounceRef.current);
        setSearchLoading(true);
        debounceRef.current = setTimeout(() => {
            registrySearchPatients(q)
                .then((res) => setHits(res.success && res.data ? res.data : []))
                .catch(() => setHits([]))
                .finally(() => setSearchLoading(false));
        }, 300);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [search]);

    const resetNew = () => {
        setForm(emptyForm());
        setEditId(null);
        setReceipt(null);
        setSearch('');
        setHits([]);
        setError(null);
    };

    const handleSave = async () => {
        setError(null);
        if (!form.firstName.trim() || !form.lastName.trim() || !form.age.trim()) {
            setError(t('registrar_validation_required'));
            return;
        }
        setSaving(true);
        try {
            const res = await registerPatientPassport({
                id: editId ?? undefined,
                first_name: form.firstName.trim(),
                last_name: form.lastName.trim(),
                father_name: form.fatherName.trim(),
                age: form.age.trim(),
                gender: form.gender || '',
                phone: form.phone.trim(),
                address: form.address.trim(),
                region_id: form.regionId,
                district_id: form.districtId,
            });
            if (!res.success || !res.data) {
                setError(res.error?.message || t('error_save_generic_failed'));
                return;
            }
            setReceipt(res.data);
            setEditId(res.data.id);
        } catch {
            setError(t('error_save_generic_failed'));
        } finally {
            setSaving(false);
        }
    };

    const glass: React.CSSProperties = {
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.8)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
    };

    return (
        <div className="page-px py-6 max-w-5xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-sky-600">{t('staff_title')}</p>
                    <h1 className="text-2xl font-black text-slate-800">{t('registrar_panel_title')}</h1>
                    <p className="text-sm text-slate-500 mt-1">{t('registrar_panel_subtitle')}</p>
                </div>
                <button
                    type="button"
                    onClick={resetNew}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                    {t('registrar_new_patient')}
                </button>
            </div>

            <div className="rounded-2xl p-4 md:p-5" style={glass}>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                    {t('registrar_search_label')}
                </label>
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('registrar_search_placeholder')}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:ring-2 focus:ring-sky-400 outline-none"
                />
                {searchLoading && <p className="text-xs text-slate-400 mt-2">{t('dashboard_stats_loading')}</p>}
                {hits.length > 0 && (
                    <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
                        {hits.map((h) => (
                            <li key={h.id}>
                                <button
                                    type="button"
                                    className="w-full text-left px-4 py-3 hover:bg-sky-50/80 flex justify-between items-center gap-2"
                                    onClick={() => loadFormFromPassport(h)}
                                >
                                    <span className="font-semibold text-slate-800">
                                        {h.last_name} {h.first_name} {h.father_name}
                                    </span>
                                    <span className="text-xs font-mono font-bold text-sky-700 bg-sky-50 px-2 py-1 rounded-lg">
                                        ID {h.id}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                <div className="rounded-2xl p-4 md:p-5 space-y-3" style={glass}>
                    <h2 className="text-sm font-bold text-slate-800">
                        {editId ? t('registrar_edit_patient', { id: editId }) : t('registrar_register_patient')}
                    </h2>
                    {error && (
                        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">{t('last_name_label')}</label>
                            <input
                                className="w-full mt-0.5 rounded-lg border border-slate-200 px-2 py-2 text-sm"
                                value={form.lastName}
                                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">{t('first_name_label')}</label>
                            <input
                                className="w-full mt-0.5 rounded-lg border border-slate-200 px-2 py-2 text-sm"
                                value={form.firstName}
                                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">{t('father_name_label')}</label>
                            <input
                                className="w-full mt-0.5 rounded-lg border border-slate-200 px-2 py-2 text-sm"
                                value={form.fatherName}
                                onChange={(e) => setForm((f) => ({ ...f, fatherName: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">{t('age_label')}</label>
                            <input
                                className="w-full mt-0.5 rounded-lg border border-slate-200 px-2 py-2 text-sm"
                                value={form.age}
                                onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">{t('gender_label')}</label>
                            <select
                                className="w-full mt-0.5 rounded-lg border border-slate-200 px-2 py-2 text-sm bg-white"
                                value={form.gender}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        gender: e.target.value as '' | 'male' | 'female' | 'other',
                                    }))
                                }
                            >
                                <option value="">{t('gender_select')}</option>
                                <option value="male">{t('gender_male')}</option>
                                <option value="female">{t('gender_female')}</option>
                            </select>
                        </div>
                        <div className="col-span-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">{t('phone_label')}</label>
                            <input
                                className="w-full mt-0.5 rounded-lg border border-slate-200 px-2 py-2 text-sm"
                                value={form.phone}
                                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                            />
                        </div>
                        <div className="col-span-2">
                            <AddressCombobox
                                regionId={form.regionId}
                                districtId={form.districtId}
                                onChange={(regionId, districtId, label) =>
                                    setForm((f) => ({ ...f, regionId, districtId, addressLabel: label }))
                                }
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">{t('address_extra_label')}</label>
                            <input
                                className="w-full mt-0.5 rounded-lg border border-slate-200 px-2 py-2 text-sm"
                                placeholder={t('address_extra_placeholder')}
                                value={form.address}
                                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                            />
                        </div>
                    </div>
                    <button
                        type="button"
                        disabled={saving}
                        onClick={handleSave}
                        className="w-full mt-2 py-3 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-sky-600 to-emerald-600 hover:opacity-95 disabled:opacity-50"
                    >
                        {saving ? t('saving') : editId ? t('registrar_reprint_check') : t('registrar_save_and_print')}
                    </button>
                </div>

                <div className="rounded-2xl p-4 md:p-5" style={glass}>
                    <h2 className="text-sm font-bold text-slate-800 mb-4">{t('receipt_preview')}</h2>
                    {receipt ? (
                        <>
                            <PatientReceipt patient={receipt} registrarName={user.name} />
                            <button
                                type="button"
                                onClick={() => printPatientReceipt()}
                                className="w-full mt-4 py-2.5 rounded-xl font-bold text-sm border-2 border-sky-600 text-sky-700 hover:bg-sky-50"
                            >
                                {t('registrar_print_check')}
                            </button>
                        </>
                    ) : (
                        <p className="text-sm text-slate-400 text-center py-12">{t('receipt_empty_hint')}</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RegistrarPanel;
