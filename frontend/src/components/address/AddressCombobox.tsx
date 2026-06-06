import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    getAddressCatalog,
    searchDistricts,
    type AddressRegionOption,
    type DistrictSearchHit,
} from '../../services/apiPatientService';
import { useTranslation } from '../../hooks/useTranslation';

interface AddressComboboxProps {
    regionId: string;
    districtId: string;
    onChange: (regionId: string, districtId: string, label: string) => void;
    disabled?: boolean;
    className?: string;
}

const selectCls =
    'block w-full text-[11px] text-slate-800 common-input py-1 px-1.5 bg-white/80 focus:bg-white border border-slate-200 rounded shadow-sm focus:ring-1 focus:ring-blue-400';

const AddressCombobox: React.FC<AddressComboboxProps> = ({
    regionId,
    districtId,
    onChange,
    disabled,
    className = '',
}) => {
    const { t, language } = useTranslation();
    const [catalog, setCatalog] = useState<AddressRegionOption[]>([]);
    const [catalogLoading, setCatalogLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [hits, setHits] = useState<DistrictSearchHit[]>([]);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const wrapRef = useRef<HTMLDivElement>(null);

    const regionName = (r: AddressRegionOption) => (language === 'ru' ? r.name_ru : r.name_uz);
    const districtName = (d: { name_uz: string; name_ru: string }) =>
        language === 'ru' ? d.name_ru : d.name_uz;

    useEffect(() => {
        getAddressCatalog()
            .then((res) => {
                if (res.success && res.data) setCatalog(res.data);
            })
            .catch(() => setCatalog([]))
            .finally(() => setCatalogLoading(false));
    }, []);

    useEffect(() => {
        const onDoc = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setSearchOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    const selectedRegion = useMemo(
        () => catalog.find((r) => r.id === regionId) ?? null,
        [catalog, regionId],
    );

    const districts = selectedRegion?.districts ?? [];

    const selectedLabel = useMemo(() => {
        if (!selectedRegion || !districtId) return '';
        const d = districts.find((x) => x.id === districtId);
        if (!d) return '';
        return `${districtName(d)}, ${regionName(selectedRegion)}`;
    }, [selectedRegion, districtId, districts, language]);

    useEffect(() => {
        if (selectedLabel) setQuery(selectedLabel);
    }, [selectedLabel]);

    useEffect(() => {
        const q = query.trim();
        if (q.length < 2 || q === selectedLabel) {
            setHits([]);
            return;
        }
        if (debounceRef.current) clearTimeout(debounceRef.current);
        setSearchLoading(true);
        debounceRef.current = setTimeout(() => {
            searchDistricts(q)
                .then((res) => setHits(res.success && res.data ? res.data : []))
                .catch(() => setHits([]))
                .finally(() => setSearchLoading(false));
        }, 220);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [query, selectedLabel]);

    const applySelection = (rId: string, dId: string) => {
        const region = catalog.find((r) => r.id === rId);
        const district = region?.districts.find((d) => d.id === dId);
        if (!region || !district) return;
        const label = `${districtName(district)}, ${regionName(region)}`;
        onChange(rId, dId, label);
        setQuery(label);
        setSearchOpen(false);
        setHits([]);
    };

    const pickSearchHit = (hit: DistrictSearchHit) => {
        const label = `${language === 'ru' ? hit.district_name_ru : hit.district_name_uz}, ${language === 'ru' ? hit.region_name_ru : hit.region_name_uz}`;
        onChange(hit.region_id, hit.district_id, label);
        setQuery(label);
        setSearchOpen(false);
        setHits([]);
    };

    return (
        <div ref={wrapRef} className={`space-y-1.5 ${className}`}>
            <p className="text-[9px] font-bold text-slate-700 uppercase tracking-wide ml-0.5">
                {t('address_region_district_label')}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                <div>
                    <label className="text-[8px] font-semibold text-slate-500 uppercase ml-0.5">
                        {t('address_select_region')}
                    </label>
                    <select
                        disabled={disabled || catalogLoading}
                        value={regionId}
                        onChange={(e) => {
                            const rId = e.target.value;
                            if (!rId) {
                                onChange('', '', '');
                                setQuery('');
                                return;
                            }
                            onChange(rId, '', '');
                            setQuery('');
                            setHits([]);
                        }}
                        className={selectCls}
                    >
                        <option value="">{catalogLoading ? t('dashboard_stats_loading') : t('address_select_region')}</option>
                        {catalog.map((r) => (
                            <option key={r.id} value={r.id}>
                                {regionName(r)}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="text-[8px] font-semibold text-slate-500 uppercase ml-0.5">
                        {t('address_select_district')}
                    </label>
                    <select
                        disabled={disabled || !regionId || districts.length === 0}
                        value={districtId}
                        onChange={(e) => {
                            const dId = e.target.value;
                            if (regionId && dId) applySelection(regionId, dId);
                        }}
                        className={selectCls}
                    >
                        <option value="">{t('address_select_district')}</option>
                        {districts.map((d) => (
                            <option key={d.id} value={d.id}>
                                {districtName(d)}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="relative">
                <label className="text-[8px] font-semibold text-slate-500 uppercase ml-0.5">
                    {t('address_search_label')}
                </label>
                <input
                    type="text"
                    value={query}
                    disabled={disabled}
                    placeholder={t('address_search_placeholder')}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setSearchOpen(true);
                    }}
                    onFocus={() => setSearchOpen(true)}
                    className={selectCls}
                />
                {searchOpen && query.trim().length >= 2 && query !== selectedLabel && (searchLoading || hits.length > 0) && (
                    <ul className="absolute z-30 left-0 right-0 mt-1 max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg text-[11px]">
                        {searchLoading && (
                            <li className="px-3 py-2 text-slate-400">{t('dashboard_stats_loading')}</li>
                        )}
                        {!searchLoading && hits.length === 0 && (
                            <li className="px-3 py-2 text-slate-400">{t('address_search_empty')}</li>
                        )}
                        {!searchLoading &&
                            hits.map((h) => (
                                <li key={`${h.region_id}-${h.district_id}`}>
                                    <button
                                        type="button"
                                        className="w-full text-left px-3 py-2 hover:bg-sky-50 text-slate-800 border-b border-slate-50 last:border-0"
                                        onClick={() => pickSearchHit(h)}
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
            </div>

            {regionId && districtId && (
                <p className="text-[9px] text-emerald-700 bg-emerald-50/80 rounded px-2 py-1 border border-emerald-100">
                    {t('address_selected_hint')}: {selectedLabel}
                </p>
            )}
        </div>
    );
};

export default AddressCombobox;
