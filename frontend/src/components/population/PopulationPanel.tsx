import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  listPopulation,
  createPopulation,
  updatePopulation,
  deletePopulation,
  importPopulationExcel,
  exportPopulationExcel,
  exportPopulationTemplate,
  type PopulationRecord,
} from '../../services/apiPopulationService';
import { listBrigades, HEALTH_GROUPS } from '../../services/apiPrimaryCareService';
import AddressCombobox from '../address/AddressCombobox';
import { useTranslation } from '../../hooks/useTranslation';
import { formatPassportSerialInput, isValidPassportSerial, normalizePassportSerial } from '../../utils/passportSerial';

const emptyForm = () => ({
  passportSerial: '',
  firstName: '',
  lastName: '',
  fatherName: '',
  age: '',
  birthDate: '',
  gender: '' as '' | 'male' | 'female' | 'other',
  phone: '',
  address: '',
  regionId: '',
  districtId: '',
  addressLabel: '',
  anamnesis: '',
  healthGroup: '',
  brigadeId: '',
  riskPregnant: false,
  riskDisabled: false,
  riskChronic: false,
  riskSocialVulnerable: false,
  riskLoneElderly: false,
  riskNeedsCare: false,
});

interface PopulationPanelProps {
  onOpenProfile?: (id: number) => void;
}

const PopulationPanel: React.FC<PopulationPanelProps> = ({ onOpenProfile }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState(emptyForm());
  const [search, setSearch] = useState('');
  const [records, setRecords] = useState<PopulationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [brigades, setBrigades] = useState<Array<{ id: number; name: string }>>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadList = useCallback(async (q?: string) => {
    setLoading(true);
    setError(null);
    const res = await listPopulation({ search: q?.trim() || undefined, page_size: 100 });
    if (res.success && res.data) {
      setRecords(res.data);
    } else {
      setRecords([]);
      setError(res.error?.message || t('population_load_error'));
    }
    setLoading(false);
  }, [t]);

  useEffect(() => { loadList(); }, [loadList]);

  useEffect(() => {
    listBrigades().then((res) => {
      if (res.success && res.data) setBrigades(res.data.map((b) => ({ id: b.id, name: b.name })));
    });
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadList(search), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, loadList]);

  const resetForm = () => {
    setForm(emptyForm());
    setEditId(null);
    setError(null);
  };

  const loadFormFromRecord = (r: PopulationRecord) => {
    setEditId(r.id);
    setForm({
      passportSerial: r.registry_number,
      firstName: r.first_name,
      lastName: r.last_name,
      fatherName: r.father_name || '',
      age: r.age || '',
      birthDate: r.birth_date || '',
      gender: (r.gender as '' | 'male' | 'female' | 'other') || '',
      phone: r.phone || '',
      address: r.address || '',
      regionId: r.region_id || '',
      districtId: r.district_id || '',
      addressLabel: [r.region_name, r.district_name].filter(Boolean).join(', '),
      anamnesis: r.anamnesis || '',
      healthGroup: r.health_group || '',
      brigadeId: r.brigade ? String(r.brigade) : '',
      riskPregnant: Boolean(r.risk_pregnant),
      riskDisabled: Boolean(r.risk_disabled),
      riskChronic: Boolean(r.risk_chronic),
      riskSocialVulnerable: Boolean(r.risk_social_vulnerable),
      riskLoneElderly: Boolean(r.risk_lone_elderly),
      riskNeedsCare: Boolean(r.risk_needs_care),
    });
    setSuccess(null);
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    const serial = normalizePassportSerial(form.passportSerial);
    if (!isValidPassportSerial(serial)) {
      setError(t('population_passport_invalid'));
      return;
    }
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError(t('population_name_required'));
      return;
    }
    setSaving(true);
    const payload = {
      registry_number: serial,
      first_name: form.firstName.trim(),
      last_name: form.lastName.trim(),
      father_name: form.fatherName.trim(),
      age: form.age.trim(),
      birth_date: form.birthDate || null,
      gender: form.gender || '',
      phone: form.phone.trim(),
      address: form.address.trim(),
      region_id: form.regionId,
      district_id: form.districtId,
      anamnesis: form.anamnesis.trim(),
      health_group: form.healthGroup || '',
      brigade: form.brigadeId ? Number(form.brigadeId) : null,
      risk_pregnant: form.riskPregnant,
      risk_disabled: form.riskDisabled,
      risk_chronic: form.riskChronic,
      risk_social_vulnerable: form.riskSocialVulnerable,
      risk_lone_elderly: form.riskLoneElderly,
      risk_needs_care: form.riskNeedsCare,
    };
    const res = editId
      ? await updatePopulation(editId, payload)
      : await createPopulation(payload);
    setSaving(false);
    if (res.success) {
      const sync = res.data?.primary_care_sync;
      const syncMsg = sync?.brigade_name
        ? ` · ${t('pc_sync_brigade')}: ${sync.brigade_name}`
        : '';
      setSuccess((editId ? t('population_updated') : t('population_created')) + syncMsg);
      resetForm();
      loadList(search);
    } else {
      setError(res.error?.message || t('population_save_error'));
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm(t('population_delete_confirm'))) return;
    const res = await deletePopulation(id);
    if (res.success) {
      if (editId === id) resetForm();
      loadList(search);
    } else {
      setError(res.error?.message || t('population_delete_error'));
    }
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    setError(null);
    setSuccess(null);
    const res = await importPopulationExcel(file);
    setImporting(false);
    if (res.success && res.data) {
      setSuccess(
        t('population_import_done', {
          created: res.data.created,
          updated: res.data.updated,
          skipped: res.data.skipped,
          errors: res.data.errors,
        }),
      );
      loadList(search);
    } else {
      setError(res.error?.message || t('population_import_error'));
    }
  };

  const genderLabel = (g: string) => {
    if (g === 'male') return t('gender_male');
    if (g === 'female') return t('gender_female');
    if (g === 'other') return t('gender_other');
    return '—';
  };

  return (
    <div className="max-w-6xl mx-auto page-px py-4 sm:py-6 space-y-4">
      <div className="rounded-2xl border border-emerald-100 bg-white/90 shadow-sm p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-black text-slate-800">{t('population_title')}</h2>
            <p className="text-xs text-slate-500 mt-1">{t('population_subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => exportPopulationTemplate().catch(() => setError(t('population_export_error')))}
              className="text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              {t('population_template')}
            </button>
            <button
              type="button"
              onClick={() => exportPopulationExcel().catch(() => setError(t('population_export_error')))}
              className="text-xs font-semibold px-3 py-2 rounded-xl border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            >
              {t('population_export')}
            </button>
            <button
              type="button"
              disabled={importing}
              onClick={() => fileRef.current?.click()}
              className="text-xs font-semibold px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {importing ? t('population_importing') : t('population_import')}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImport(f);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('population_search_placeholder')}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm mb-4"
        />

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        {success && <p className="text-sm text-emerald-700 mb-3">{success}</p>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Form */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {editId ? t('population_edit') : t('population_add')}
            </p>
            <input
              value={form.passportSerial}
              onChange={(e) => setForm((f) => ({ ...f, passportSerial: formatPassportSerialInput(e.target.value) }))}
              placeholder={t('population_passport')}
              disabled={Boolean(editId)}
              className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm font-mono disabled:bg-slate-100"
            />
            <div className="grid grid-cols-2 gap-2">
              <input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} placeholder={t('population_last_name')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              <input value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} placeholder={t('population_first_name')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
            </div>
            <input value={form.fatherName} onChange={(e) => setForm((f) => ({ ...f, fatherName: e.target.value }))} placeholder={t('population_father_name')} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <input value={form.age} onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))} placeholder={t('population_age')} className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
              <input type="date" value={form.birthDate} onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))} className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm" title={t('pc_birth_date')} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value as typeof f.gender }))} className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm">
                <option value="">{t('population_gender')}</option>
                <option value="male">{t('gender_male')}</option>
                <option value="female">{t('gender_female')}</option>
                <option value="other">{t('gender_other')}</option>
              </select>
              <select value={form.healthGroup} onChange={(e) => setForm((f) => ({ ...f, healthGroup: e.target.value }))} className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm">
                <option value="">{t('pc_health_group')}</option>
                {HEALTH_GROUPS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>
            <select value={form.brigadeId} onChange={(e) => setForm((f) => ({ ...f, brigadeId: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm">
              <option value="">{t('pc_brigade_auto')}</option>
              {brigades.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <div className="flex flex-wrap gap-2 text-xs">
              {([
                ['riskPregnant', 'pc_risk_pregnant'],
                ['riskDisabled', 'pc_risk_disabled'],
                ['riskChronic', 'pc_risk_chronic'],
                ['riskLoneElderly', 'pc_risk_elderly'],
                ['riskSocialVulnerable', 'pc_risk_social'],
                ['riskNeedsCare', 'pc_risk_care'],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-1">
                  <input type="checkbox" checked={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))} />
                  {t(label)}
                </label>
              ))}
            </div>
            <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder={t('population_phone')} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm" />
            <AddressCombobox
              regionId={form.regionId}
              districtId={form.districtId}
              label={form.addressLabel}
              onChange={(regionId, districtId, label) => setForm((f) => ({ ...f, regionId, districtId, addressLabel: label }))}
            />
            <textarea value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder={t('population_address_extra')} rows={2} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm resize-none" />
            <textarea value={form.anamnesis} onChange={(e) => setForm((f) => ({ ...f, anamnesis: e.target.value }))} placeholder={t('population_anamnesis')} rows={3} className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm resize-none" />
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={handleSave} disabled={saving} className="flex-1 rounded-xl bg-sky-600 text-white text-sm font-bold py-2.5 hover:bg-sky-700 disabled:opacity-60">
                {saving ? t('saving') : t('save')}
              </button>
              {editId && (
                <button type="button" onClick={resetForm} className="px-4 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-white">
                  {t('cancel')}
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="rounded-xl border border-slate-100 overflow-hidden min-h-[320px] flex flex-col">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 px-3 py-2 bg-slate-50 border-b border-slate-100">
              {t('population_list')} ({records.length})
            </p>
            {loading ? (
              <p className="p-6 text-sm text-slate-400 text-center">{t('dashboard_stats_loading')}</p>
            ) : records.length === 0 ? (
              <p className="p-6 text-sm text-slate-400 text-center">{t('population_empty')}</p>
            ) : (
              <ul className="overflow-y-auto flex-1 max-h-[520px] divide-y divide-slate-50">
                {records.map((r) => (
                  <li key={r.id} className="px-3 py-2.5 hover:bg-sky-50/50 flex items-start justify-between gap-2">
                    <button type="button" className="text-left min-w-0 flex-1" onClick={() => loadFormFromRecord(r)}>
                      <span className="text-sm font-semibold text-slate-800 block truncate">
                        {r.last_name} {r.first_name} {r.father_name}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">{r.registry_number}</span>
                      {(r.phone || r.age || r.brigade_name) && (
                        <span className="text-[10px] text-slate-400 block">
                          {[r.age && `${r.age} yosh`, r.brigade_name, genderLabel(r.gender), r.phone].filter(Boolean).join(' · ')}
                        </span>
                      )}
                      {r.next_checkup_date && (
                        <span className="text-[10px] text-emerald-600 block">{t('pc_next_checkup')}: {r.next_checkup_date}</span>
                      )}
                    </button>
                    <div className="flex flex-col gap-1 shrink-0">
                      {onOpenProfile && (
                        <button type="button" onClick={() => onOpenProfile(r.id)} className="text-[10px] text-emerald-700 font-bold px-2 py-1 rounded bg-emerald-50">
                          {t('pc_open_profile')}
                        </button>
                      )}
                      <button type="button" onClick={() => handleDelete(r.id)} className="text-[10px] text-red-500 hover:text-red-700 px-2 py-1">
                        {t('delete')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PopulationPanel;
