import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  exportPatientStatisticsExcel,
  getPatientStatistics,
  type PatientStatistics,
  type PatientStatisticsFilters,
} from '../../services/apiPatientStatisticsService';
import AddressCombobox from '../address/AddressCombobox';
import { useTranslation } from '../../hooks/useTranslation';

const emptyFilters = (): PatientStatisticsFilters => ({
  region_id: '',
  district_id: '',
  icd_chapter: '',
  icd_code: '',
  age_min: '',
  age_max: '',
  age_group: '',
  disability: '',
  disability_group: '',
  dispensary: '',
  health_group: '',
  gender: '',
  search: '',
});

const selectCls =
  'block w-full text-xs text-slate-800 py-2 px-2.5 bg-white border border-slate-200 rounded-lg shadow-sm focus:ring-1 focus:ring-emerald-400 focus:border-emerald-400';
const labelCls = 'block text-[11px] font-semibold text-slate-500 mb-1';

const SummaryCard: React.FC<{ title: string; value: number; tone: string }> = ({ title, value, tone }) => (
  <div className={`rounded-2xl border p-4 ${tone}`}>
    <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{title}</p>
    <p className="mt-1 text-2xl font-black tabular-nums">{value.toLocaleString()}</p>
  </div>
);

const BarRow: React.FC<{ label: string; sub?: string; count: number; max: number; color: string }> = ({
  label, sub, count, max, color,
}) => (
  <div className="flex items-center gap-2 text-xs py-0.5">
    <div className="w-40 sm:w-56 shrink-0 min-w-0">
      <span className="block truncate text-slate-700 font-medium" title={label}>{label}</span>
      {sub ? <span className="block truncate text-[10px] text-slate-400" title={sub}>{sub}</span> : null}
    </div>
    <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
      <div
        className={`h-full rounded-full ${color}`}
        style={{ width: `${count > 0 ? Math.max(6, (count / max) * 100) : 0}%` }}
      />
    </div>
    <span className="font-mono font-bold text-slate-700 w-12 text-right tabular-nums">
      {count.toLocaleString()}
    </span>
  </div>
);

const Section: React.FC<{
  title: string;
  rows: Array<{ key: string; label: string; sub?: string; count: number }>;
  color: string;
  emptyText: string;
}> = ({ title, rows, color, emptyText }) => {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-slate-800 mb-3">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-400">{emptyText}</p>
      ) : (
        <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
          {rows.map((r) => (
            <BarRow key={r.key} label={r.label} sub={r.sub} count={r.count} max={max} color={color} />
          ))}
        </div>
      )}
    </div>
  );
};

const PatientStatisticsPanel: React.FC = () => {
  const { t, language } = useTranslation();
  const [filters, setFilters] = useState<PatientStatisticsFilters>(emptyFilters());
  const [stats, setStats] = useState<PatientStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (active: PatientStatisticsFilters) => {
    setLoading(true);
    setError(null);
    const res = await getPatientStatistics(active, language);
    if (res.success && res.data) {
      setStats(res.data);
    } else {
      setError(res.error?.message || t('stats_error'));
    }
    setLoading(false);
  }, [language, t]);

  useEffect(() => {
    const timer = setTimeout(() => { load(filters); }, 250);
    return () => clearTimeout(timer);
  }, [filters, load]);

  const set = (patch: Partial<PatientStatisticsFilters>) =>
    setFilters((prev) => ({ ...prev, ...patch }));

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportPatientStatisticsExcel(filters, language);
    } catch {
      setError(t('stats_export_error'));
    }
    setExporting(false);
  };

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter((v) => ((v as string | undefined) ?? '').trim() !== '').length,
    [filters],
  );

  const diseaseCatalog = stats?.catalogs.diseases ?? [];
  const ageCatalog = stats?.catalogs.age_groups ?? [];
  const disabilityCatalog = stats?.catalogs.disability_groups ?? [];
  const healthCatalog = stats?.catalogs.health_groups ?? [];
  const emptyText = t('stats_empty');

  return (
    <div className="max-w-6xl mx-auto page-px py-4 sm:py-6 space-y-4">
      <div className="rounded-2xl border border-emerald-100 bg-white/90 shadow-sm p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-black text-slate-800">{t('patient_stats_title')}</h2>
            <p className="text-xs text-slate-500 mt-1">{t('patient_stats_subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFilters(emptyFilters())}
              disabled={activeFilterCount === 0}
              className="text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              {t('stats_reset')}
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || !stats}
              className="text-xs font-semibold px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {exporting ? t('stats_loading') : t('stats_export')}
            </button>
          </div>
        </div>

        {/* Filtrlar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <span className={labelCls}>{t('stats_filter_region')}</span>
            <AddressCombobox
              regionId={filters.region_id || ''}
              districtId={filters.district_id || ''}
              onChange={(regionId, districtId) => set({ region_id: regionId, district_id: districtId })}
            />
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="stats-disease">{t('stats_filter_disease')}</label>
            <select
              id="stats-disease"
              className={selectCls}
              value={filters.icd_chapter || ''}
              onChange={(e) => set({ icd_chapter: e.target.value })}
            >
              <option value="">{t('stats_all')}</option>
              {diseaseCatalog.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.range ? `${d.range} — ${d.label}` : d.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls} htmlFor="stats-age-group">{t('stats_filter_age_group')}</label>
            <select
              id="stats-age-group"
              className={selectCls}
              value={filters.age_group || ''}
              onChange={(e) => set({ age_group: e.target.value, age_min: '', age_max: '' })}
            >
              <option value="">{t('stats_all')}</option>
              {ageCatalog.map((a) => (
                <option key={a.key} value={a.key}>{a.label}</option>
              ))}
            </select>
          </div>

          <div>
            <span className={labelCls}>{t('stats_filter_age_range')}</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={130}
                inputMode="numeric"
                placeholder={t('stats_filter_age_from')}
                className={selectCls}
                value={filters.age_min || ''}
                onChange={(e) => set({ age_min: e.target.value, age_group: '' })}
              />
              <span className="text-slate-400 text-xs">—</span>
              <input
                type="number"
                min={0}
                max={130}
                inputMode="numeric"
                placeholder={t('stats_filter_age_to')}
                className={selectCls}
                value={filters.age_max || ''}
                onChange={(e) => set({ age_max: e.target.value, age_group: '' })}
              />
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="stats-disability">{t('stats_filter_disability')}</label>
            <select
              id="stats-disability"
              className={selectCls}
              value={filters.disability || ''}
              onChange={(e) => set({
                disability: e.target.value,
                disability_group: e.target.value === 'no' ? '' : filters.disability_group,
              })}
            >
              <option value="">{t('stats_all')}</option>
              <option value="yes">{t('stats_yes')}</option>
              <option value="no">{t('stats_no')}</option>
            </select>
          </div>

          <div>
            <label className={labelCls} htmlFor="stats-disability-group">
              {t('stats_filter_disability_group')}
            </label>
            <select
              id="stats-disability-group"
              className={selectCls}
              value={filters.disability_group || ''}
              disabled={filters.disability === 'no'}
              onChange={(e) => set({ disability_group: e.target.value })}
            >
              <option value="">{t('stats_all')}</option>
              {disabilityCatalog.map((d) => (
                <option key={d.key} value={d.key}>{d.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls} htmlFor="stats-dispensary">{t('stats_filter_dispensary')}</label>
            <select
              id="stats-dispensary"
              className={selectCls}
              value={filters.dispensary || ''}
              onChange={(e) => set({ dispensary: e.target.value })}
            >
              <option value="">{t('stats_all')}</option>
              <option value="yes">{t('stats_yes')}</option>
              <option value="no">{t('stats_no')}</option>
            </select>
          </div>

          <div>
            <label className={labelCls} htmlFor="stats-code">{t('stats_filter_code')}</label>
            <input
              id="stats-code"
              type="text"
              placeholder="I10, E11, B65-B83"
              className={selectCls}
              value={filters.icd_code || ''}
              onChange={(e) => set({ icd_code: e.target.value })}
            />
          </div>

          <div>
            <label className={labelCls} htmlFor="stats-health-group">{t('stats_filter_health_group')}</label>
            <select
              id="stats-health-group"
              className={selectCls}
              value={filters.health_group || ''}
              onChange={(e) => set({ health_group: e.target.value })}
            >
              <option value="">{t('stats_all')}</option>
              {healthCatalog.map((h) => (
                <option key={h.key} value={h.key}>{h.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls} htmlFor="stats-gender">{t('stats_filter_gender')}</label>
            <select
              id="stats-gender"
              className={selectCls}
              value={filters.gender || ''}
              onChange={(e) => set({ gender: e.target.value })}
            >
              <option value="">{t('stats_all')}</option>
              <option value="male">{t('gender_male')}</option>
              <option value="female">{t('gender_female')}</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="stats-search">{t('stats_filter_search')}</label>
            <input
              id="stats-search"
              type="text"
              className={selectCls}
              value={filters.search || ''}
              onChange={(e) => set({ search: e.target.value })}
            />
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs px-4 py-3">{error}</div>
      ) : null}

      {stats ? (
        <>
          <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 ${loading ? 'opacity-50' : ''}`}>
            <SummaryCard
              title={t('stats_total')}
              value={stats.summary.total}
              tone="border-emerald-200 bg-emerald-50 text-emerald-900"
            />
            <SummaryCard
              title={t('stats_disabled')}
              value={stats.summary.disabled}
              tone="border-amber-200 bg-amber-50 text-amber-900"
            />
            <SummaryCard
              title={t('stats_dispensary')}
              value={stats.summary.dispensary}
              tone="border-sky-200 bg-sky-50 text-sky-900"
            />
            <SummaryCard
              title={t('stats_no_dispensary')}
              value={stats.summary.no_dispensary}
              tone="border-slate-200 bg-slate-50 text-slate-800"
            />
          </div>

          <div className={`grid grid-cols-1 lg:grid-cols-2 gap-3 ${loading ? 'opacity-50' : ''}`}>
            <Section
              title={t('stats_by_district')}
              color="bg-emerald-500"
              emptyText={emptyText}
              rows={stats.districts.map((d) => ({
                key: d.district_id || 'none',
                label: d.district_name,
                sub: d.region_name,
                count: d.count,
              }))}
            />
            <Section
              title={t('stats_by_disease')}
              color="bg-rose-500"
              emptyText={emptyText}
              rows={stats.diseases.map((d) => ({ key: d.key, label: d.label, sub: d.key === 'unknown' ? '' : d.key, count: d.count }))}
            />
            <Section
              title={t('stats_by_age')}
              color="bg-indigo-500"
              emptyText={emptyText}
              rows={stats.age_groups.map((a) => ({ key: a.key, label: a.label, count: a.count }))}
            />
            <Section
              title={t('stats_by_disability')}
              color="bg-amber-500"
              emptyText={emptyText}
              rows={stats.disability_groups.map((d) => ({ key: d.key, label: d.label, count: d.count }))}
            />
            <Section
              title={t('stats_by_code')}
              color="bg-sky-500"
              emptyText={emptyText}
              rows={stats.top_codes.map((c) => ({
                key: c.code,
                label: c.code,
                sub: c.chapter_label,
                count: c.count,
              }))}
            />
            <Section
              title={t('stats_by_health_group')}
              color="bg-teal-500"
              emptyText={emptyText}
              rows={stats.health_groups.map((h) => ({ key: h.key || 'none', label: h.label, count: h.count }))}
            />
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-400">
          {loading ? t('stats_loading') : emptyText}
        </div>
      )}
    </div>
  );
};

export default PatientStatisticsPanel;
