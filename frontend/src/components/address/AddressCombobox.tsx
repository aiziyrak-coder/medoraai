import React, { useEffect, useRef, useState } from 'react';
import { searchDistricts, type DistrictSearchHit } from '../../services/apiPatientService';
import { useTranslation } from '../../hooks/useTranslation';

interface AddressComboboxProps {
    regionId: string;
    districtId: string;
    onChange: (regionId: string, districtId: string, label: string) => void;
    disabled?: boolean;
    className?: string;
}

const AddressCombobox: React.FC<AddressComboboxProps> = ({
    regionId,
    districtId,
    onChange,
    disabled,
    className = '',
}) => {
    const { t, language } = useTranslation();
    const [query, setQuery] = useState('');
    const [hits, setHits] = useState<DistrictSearchHit[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const wrapRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onDoc = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    useEffect(() => {
        if (regionId && districtId && !query) {
            searchDistricts('').then(() => { /* label set externally */ });
        }
    }, [regionId, districtId, query]);

    useEffect(() => {
        const q = query.trim();
        if (q.length < 2) {
            setHits([]);
            return;
        }
        if (debounceRef.current) clearTimeout(debounceRef.current);
        setLoading(true);
        debounceRef.current = setTimeout(() => {
            searchDistricts(q)
                .then((res) => setHits(res.success && res.data ? res.data : []))
                .catch(() => setHits([]))
                .finally(() => setLoading(false));
        }, 280);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [query]);

    const pick = (hit: DistrictSearchHit) => {
        const regionName = language === 'ru' ? hit.region_name_ru : hit.region_name_uz;
        const districtName = language === 'ru' ? hit.district_name_ru : hit.district_name_uz;
        onChange(hit.region_id, hit.district_id, `${regionName}, ${districtName}`);
        setQuery(`${districtName}, ${regionName}`);
        setOpen(false);
        setHits([]);
    };

    return (
        <div ref={wrapRef} className={`relative ${className}`}>
            <label className="text-[9px] font-bold text-slate-700 uppercase tracking-wide ml-0.5 mb-0.5 block">
                {t('address_region_district_label')}
            </label>
            <input
                type="text"
                value={query}
                disabled={disabled}
                placeholder={t('address_search_placeholder')}
                onChange={(e) => {
                    setQuery(e.target.value);
                    setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                className="block w-full text-[11px] text-slate-800 common-input py-1 px-1.5 bg-white/80 focus:bg-white placeholder-slate-500 border border-slate-200 rounded shadow-sm focus:ring-1 focus:ring-blue-400"
            />
            {open && (loading || hits.length > 0) && (
                <ul className="absolute z-30 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg text-[11px]">
                    {loading && (
                        <li className="px-3 py-2 text-slate-400">{t('dashboard_stats_loading')}</li>
                    )}
                    {!loading &&
                        hits.map((h) => (
                            <li key={`${h.region_id}-${h.district_id}`}>
                                <button
                                    type="button"
                                    className="w-full text-left px-3 py-2 hover:bg-sky-50 text-slate-800"
                                    onClick={() => pick(h)}
                                >
                                    <span className="font-semibold">
                                        {language === 'ru' ? h.district_name_ru : h.district_name_uz}
                                    </span>
                                    <span className="text-slate-500 ml-1">
                                        — {language === 'ru' ? h.region_name_ru : h.region_name_uz}
                                    </span>
                                </button>
                            </li>
                        ))}
                </ul>
            )}
            {regionId && districtId && !query && (
                <p className="text-[9px] text-slate-500 mt-0.5">{t('address_selected_hint')}</p>
            )}
        </div>
    );
};

export default AddressCombobox;
