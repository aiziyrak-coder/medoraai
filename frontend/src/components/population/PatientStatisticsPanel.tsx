import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AddressCombobox from '../address/AddressCombobox';
import { useTranslation } from '../../hooks/useTranslation';
import {
  exportPopulationStatisticsExcel,
  fetchPopulationStatistics,
  type PopulationStatistics,
  type PopulationStatisticsFilters,
} from '../../services/apiPatientStatisticsService';
import { HEALTH_GROUPS } from '../../services/apiPrimaryCareService';

const inputCls = 'rounded-lg border border-slate-200 px-2.5 py-2 text-sm w-full';
const SOX_REGION = '12';
const SOX_DISTRICT = '180';

interface PatientStatisticsPanelProps {
  hubEmbedded?: boolean;
  brigadeFilter?: number;
}

const PatientStatisticsPanel: React.FC<PatientStatisticsPanelProps> = ({ brigadeFilter }) => {
  const { t, language } = useTranslation();
  const [stats, setStats] = useState<PopulationStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [regionId, setRegionId] = useState(SOX_REGION);
  const [districtId, setDistrictId] = useState(SOX_DISTRICT);
  const [diseaseChapter, setDiseaseChapter] = useState('');
  const [icdCode, setIcdCode] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [ageMin, setAgeMin] = useState('');
  const [ageMax, setAgeMax] = useState('');
  const [disability, setDisability] = useState<'' | 'yes' | 'no'>('');
  const [disabilityGroup, setDisabilityGroup] = useState('');
  const [dispensary, setDispensary] = useState<'' | 'yes' | 'no'>('');
  const [healthGroup, setHealthGroup] = useState('');
  const [gender, setGender] = useState('');
  const [search, setSearch] = useState('');

  const filters: PopulationStatisticsFilters = useMemo(() => ({
    region_id: regionId || undefined,
    district_id: districtId || undefined,
    brigade_id: brigadeFilter,
    disease_chapter: diseaseChapter || undefined,
    icd_code: icdCode.trim() || undefined,
    age_group: ageGroup || undefined,
    age_min: ageMin || undefined,
    age_max: ageMax || undefined,
    disability: disability || undefined,
    disability_group: disabilityGroup || undefined,
    dispensary: dispensary || undefined,
    health_group: healthGroup || undefined,
    gender: gender || undefined,
    q: search.trim() || undefined,
    lang: language?.startsWith('ru') ? 'ru' : 'uz',
  }), [
    regionId, districtId, brigadeFilter, diseaseChapter, icdCode, ageGroup, ageMin, ageMax,
    disability, disabilityGroup, dispensary, healthGroup, gender, search, language,
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPopulationStatistics(filters);
      if (res.success && res.data) {
        setStats(res.data);
      } else {
        setStats(null);
        setError(res.error?.message || t('pc_load_error'));
      }
    } finally {
      setLoading(false);
    }
  }, [filters, t]);

  useEffect(() => { load(); }, [load]);

  const resetFilters = () => {
    setRegionId(SOX_REGION);
    setDistrictId(SOX_DISTRICT);
    setDiseaseChapter('');
    setIcdCode('');
    setAgeGroup('');
    setAgeMin('');
    setAgeMax('');
    setDisability('');
    setDisabilityGroup('');
    setDispensary('');
    setHealthGroup('');
    setGender('');
    setSearch('');
  };

  const onExport = async () => {
    setExporting(true);
    try {
      await exportPopulationStatisticsExcel(filters);
    } catch {
      setError(t('pc_stats_export_error'));
    } finally {
      setExporting(false);
    }
  };

  const renderTable = (title: string, rows: Array<{ label: string; count: number }>) => (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="font-bold text-sm mb-3">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-500">{t('pc_stats_no_data')}</p>
      ) : (
        <ul className="space-y-1 max-h-48 overflow-y-auto text-sm">
          {rows.map((row) => (
            <li key={row.label} className="flex justify-between gap-2 border-b border-slate-50 pb-1">
              <span className="text-slate-700 truncate">{row.label}</span>
              <span className="font-semibold tabular-nums shrink-0">{row.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
        <h2 className="font-bold text-emerald-900">{t('pc_stats_title')}</h2>
        <p className="text-xs text-emerald-800 mt-1">{t('pc_stats_subtitle')}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <h3 className="font-bold text-sm">{t('pc_stats_filters')}</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          <AddressCombobox
            regionId={regionId}
            districtId={districtId}
            onChange={(r, d) => {
              setRegionId(r);
              setDistrictId(d);
            }}
          />
          <select className={inputCls} value={diseaseChapter} onChange={(e) => setDiseaseChapter(e.target.value)}>
            <option value="">{t('pc_stats_all_diseases')}</option>
            {(stats?.icd_chapters || []).map((ch) => (
              <option key={ch.code} value={ch.code}>{ch.range} — {ch.label}</option>
            ))}
          </select>
          <input className={inputCls} placeholder={t('pc_stats_icd_code')} value={icdCode} onChange={(e) => setIcdCode(e.target.value)} />
          <select className={inputCls} value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)}>
            <option value="">{t('pc_stats_all_ages')}</option>
            {(stats?.age_buckets || ['0-1', '2-17', '18-29', '30-44', '45-59', '60-74', '75+']).map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <input type="number" min={0} max={120} className={inputCls} placeholder={t('pc_stats_age_from')} value={ageMin} onChange={(e) => setAgeMin(e.target.value)} />
            <input type="number" min={0} max={120} className={inputCls} placeholder={t('pc_stats_age_to')} value={ageMax} onChange={(e) => setAgeMax(e.target.value)} />
          </div>
          <select className={inputCls} value={disability} onChange={(e) => setDisability(e.target.value as '' | 'yes' | 'no')}>
            <option value="">{t('pc_stats_disability_any')}</option>
            <option value="yes">{t('pc_stats_disability_yes')}</option>
            <option value="no">{t('pc_stats_disability_no')}</option>
          </select>
          <select className={inputCls} value={disabilityGroup} onChange={(e) => setDisabilityGroup(e.target.value)}>
            <option value="">{t('pc_stats_disability_group_any')}</option>
            <option value="I">I</option>
            <option value="II">II</option>
            <option value="III">III</option>
            <option value="childhood">{t('pc_stats_disability_childhood')}</option>
          </select>
          <select className={inputCls} value={dispensary} onChange={(e) => setDispensary(e.target.value as '' | 'yes' | 'no')}>
            <option value="">{t('pc_stats_dispensary_any')}</option>
            <option value="yes">{t('pc_stats_dispensary_yes')}</option>
            <option value="no">{t('pc_stats_dispensary_no')}</option>
          </select>
          <select className={inputCls} value={healthGroup} onChange={(e) => setHealthGroup(e.target.value)}>
            <option value="">{t('pc_stats_health_any')}</option>
            {HEALTH_GROUPS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
          <select className={inputCls} value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="">{t('pc_stats_gender_any')}</option>
            <option value="male">{t('gender_male')}</option>
            <option value="female">{t('gender_female')}</option>
          </select>
          <input className={inputCls} placeholder={t('pc_stats_search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-bold hover:bg-emerald-700 disabled:opacity-60" onClick={load} disabled={loading}>
            {loading ? t('pc_stats_loading') : t('pc_stats_apply')}
          </button>
          <button type="button" className="rounded-lg border border-slate-200 px-4 py-2 text-sm" onClick={resetFilters}>{t('pc_stats_reset')}</button>
          <button type="button" className="rounded-lg border border-emerald-200 text-emerald-800 px-4 py-2 text-sm font-semibold disabled:opacity-60" onClick={onExport} disabled={exporting || !stats?.total}>
            {exporting ? t('pc_stats_exporting') : t('pc_stats_export')}
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</div>}

      {stats && (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <div className="text-2xl font-bold text-emerald-700 tabular-nums">{stats.total}</div>
              <div className="text-xs text-slate-500 mt-1">{t('pc_stats_total')}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <div className="text-2xl font-bold text-amber-700 tabular-nums">{stats.dispensary_total}</div>
              <div className="text-xs text-slate-500 mt-1">{t('pc_stats_dispensary_total')}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
              <div className="text-2xl font-bold text-violet-700 tabular-nums">{stats.disabled_total}</div>
              <div className="text-xs text-slate-500 mt-1">{t('pc_stats_disabled_total')}</div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {renderTable(t('pc_stats_by_district'), stats.by_district)}
            {renderTable(t('pc_stats_by_age'), stats.by_age_group)}
            {renderTable(t('pc_stats_by_disease'), stats.by_disease_chapter)}
            {renderTable(t('pc_stats_by_health'), stats.by_health_group)}
            {renderTable(t('pc_stats_by_disability'), stats.by_disability_group)}
            {renderTable(t('pc_stats_top_icd'), stats.top_icd_codes.map((r) => ({ label: r.code, count: r.count })))}
          </div>
        </>
      )}
    </div>
  );
};

export default PatientStatisticsPanel;
