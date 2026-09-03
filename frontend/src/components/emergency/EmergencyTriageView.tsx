/**
 * 103 — Tezkor triaj ekrani.
 *
 * Loyihaning boshqa ekranlaridan farqi: bu yerda tezlik hamma narsadan ustun.
 * Feldsher qo'lqopda, ko'chada, telefon ekranida ishlaydi — shuning uchun:
 *   - katta tugmalar, yozish majburiy emas
 *   - eng xavfli shikoyatlar tepada
 *   - natijada avval QIZIL BAYROQ, keyin qaror, keyin qolgani
 */
import React, { useCallback, useMemo, useState } from 'react';

import {
  EMERGENCY_COMPLAINT_GROUPS,
  CRITICAL_COMPLAINTS,
  YOSH_GURUHLARI,
  complaintLabel,
  type AgeBandId,
  type EmergencyComplaint,
} from '../../constants/emergencyComplaints';
import {
  runEmergencyTriage,
  type EmergencyTriageResult,
  type Disposition,
} from '../../services/apiEmergencyService';

interface Props {
  language?: string;
  onBack?: () => void;
}

const DISPOSITION_UI: Record<Disposition, { uz: string; ru: string; cls: string; icon: string }> = {
  reanimatsiya: {
    uz: 'REANIMATSIYA — darhol', ru: 'РЕАНИМАЦИЯ — немедленно',
    cls: 'bg-red-600 text-white border-red-700', icon: '🚨',
  },
  statsionar: {
    uz: 'STATSIONARGA olib ketish', ru: 'ГОСПИТАЛИЗАЦИЯ',
    cls: 'bg-orange-500 text-white border-orange-600', icon: '🏥',
  },
  kuzatuv: {
    uz: 'Joyida yordam + KUZATUV', ru: 'Помощь на месте + НАБЛЮДЕНИЕ',
    cls: 'bg-amber-400 text-slate-900 border-amber-500', icon: '👁️',
  },
  uyda_qoldirish: {
    uz: 'Uyda qoldirish mumkin', ru: 'Можно оставить дома',
    cls: 'bg-emerald-600 text-white border-emerald-700', icon: '🏠',
  },
};

const EmergencyTriageView: React.FC<Props> = ({ language = 'uz-L', onBack }) => {
  const ru = language === 'ru';
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [ageBand, setAgeBand] = useState<AgeBandId | ''>('');
  const [sex, setSex] = useState<'male' | 'female' | ''>('');
  const [openGroup, setOpenGroup] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EmergencyTriageResult | null>(null);
  const [error, setError] = useState('');

  const label = useCallback(
    (c: EmergencyComplaint) => complaintLabel(c, ru ? 'ru' : 'uz'),
    [ru],
  );

  const toggle = useCallback((c: EmergencyComplaint) => {
    setSelected(prev => {
      const next = new Set(prev);
      const key = label(c);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, [label]);

  const selectedList = useMemo(() => Array.from(selected), [selected]);
  const canSubmit = (selectedList.length > 0 || note.trim().length > 0) && !loading;

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    setResult(null);
    const resp = await runEmergencyTriage({
      complaints: selectedList,
      note: note.trim(),
      ageBand,
      sex,
      language,
    });
    setLoading(false);
    if (resp.success && resp.data) setResult(resp.data);
    else setError(resp.error?.message || (ru ? 'Служба недоступна' : 'Xizmat ishlamayapti'));
  }, [canSubmit, selectedList, note, ageBand, sex, language, ru]);

  const reset = useCallback(() => {
    setSelected(new Set());
    setNote('');
    setResult(null);
    setError('');
  }, []);

  // ---------------------------------------------------------------- natija
  if (result) {
    const d = DISPOSITION_UI[result.disposition];
    return (
      <div className="max-w-3xl mx-auto p-3 sm:p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-800">
            {ru ? 'Результат триажа' : 'Triaj natijasi'}
          </h1>
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-slate-200 text-slate-800 font-semibold active:scale-95"
          >
            {ru ? 'Новый вызов' : 'Yangi chaqiruv'}
          </button>
        </div>

        {/* 1. Qizil bayroqlar — eng tepada */}
        {result.red_flags.length > 0 && (
          <div className="rounded-xl border-2 border-red-600 bg-red-50 p-3">
            <div className="font-bold text-red-800 mb-1">
              🚩 {ru ? 'ТРЕВОЖНЫЕ ПРИЗНАКИ' : 'XAVF BELGILARI'}
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-red-900 font-medium">
              {result.red_flags.map((f, i) => <li key={i}>{f}</li>)}
            </ul>
          </div>
        )}

        {/* 2. Qaror */}
        <div className={`rounded-xl border-2 p-4 ${d.cls}`}>
          <div className="text-lg font-extrabold">{d.icon} {ru ? d.ru : d.uz}</div>
          {result.disposition_reason && (
            <div className="mt-1 text-sm opacity-95">{result.disposition_reason}</div>
          )}
          {result.time_critical && (
            <div className="mt-2 text-sm font-bold">
              ⏱ {ru ? 'ВРЕМЯ КРИТИЧНО' : 'VAQT TIG‘IZ'}
            </div>
          )}
        </div>

        {/* 3. Hozir nima qilish */}
        {result.immediate_actions.length > 0 && (
          <div className="rounded-xl border border-slate-300 bg-white p-3">
            <div className="font-bold text-slate-800 mb-2">
              💉 {ru ? 'ЧТО ДЕЛАТЬ СЕЙЧАС' : 'HOZIR NIMA QILISH'}
            </div>
            <div className="space-y-2">
              {result.immediate_actions.map((a, i) => (
                <div key={i} className="rounded-lg bg-slate-50 border border-slate-200 p-2.5">
                  {a.action && <div className="font-semibold text-slate-900">{a.action}</div>}
                  {a.drug && (
                    <div className="mt-1 text-slate-800">
                      <span className="font-bold">{a.drug}</span>
                      {a.dose && <span className="ml-2 px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-semibold">{a.dose}</span>}
                      {a.route && <span className="ml-2 px-2 py-0.5 rounded bg-slate-200 text-slate-800">{a.route}</span>}
                    </div>
                  )}
                  {a.caution && (
                    <div className="mt-1 text-sm text-amber-800">⚠️ {a.caution}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Qilmaslik kerak */}
        {result.do_not.length > 0 && (
          <div className="rounded-xl border border-amber-400 bg-amber-50 p-3">
            <div className="font-bold text-amber-900 mb-1">
              ⛔ {ru ? 'НЕЛЬЗЯ' : 'QILMANG'}
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-amber-900">
              {result.do_not.map((x, i) => <li key={i}>{x}</li>)}
            </ul>
          </div>
        )}

        {/* 5. Ehtimoliy holat */}
        {result.probable_conditions.length > 0 && (
          <div className="rounded-xl border border-slate-300 bg-white p-3">
            <div className="font-bold text-slate-800 mb-2">
              🔍 {ru ? 'ВЕРОЯТНЫЕ СОСТОЯНИЯ' : 'EHTIMOLIY HOLATLAR'}
            </div>
            {result.probable_conditions.map((c, i) => (
              <div key={i} className="py-1.5 border-b border-slate-100 last:border-0">
                <span className="font-semibold text-slate-900">{c.name}</span>
                {c.likelihood && (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                    {c.likelihood}
                  </span>
                )}
                {c.why && <div className="text-sm text-slate-600">{c.why}</div>}
              </div>
            ))}
          </div>
        )}

        {/* 6. Aniqlashtiruvchi savollar */}
        {result.clarify.length > 0 && (
          <div className="rounded-xl border border-blue-300 bg-blue-50 p-3">
            <div className="font-bold text-blue-900 mb-1">
              ❓ {ru ? 'УТОЧНИТЕ' : 'ANIQLANG'}
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-blue-900">
              {result.clarify.map((q, i) => <li key={i}>{q}</li>)}
            </ul>
          </div>
        )}

        <div className="text-xs text-slate-500 border-t border-slate-200 pt-2">
          {result.advisory}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- kirish
  return (
    <div className="max-w-3xl mx-auto p-3 sm:p-4 space-y-3 pb-28">
      <div className="flex items-center gap-2">
        {onBack && (
          <button onClick={onBack} className="px-3 py-2 rounded-lg bg-slate-200 text-slate-700">←</button>
        )}
        <h1 className="text-xl font-bold text-slate-800">
          🚑 103 — {ru ? 'Быстрый триаж' : 'Tezkor triaj'}
        </h1>
      </div>

      {/* Yosh + jins: 2 ta bosish, yozish yo'q */}
      <div className="rounded-xl border border-slate-300 bg-white p-3">
        <div className="text-sm font-semibold text-slate-700 mb-1.5">
          {ru ? 'Возраст' : 'Yosh'} <span className="text-red-600">*</span>
          <span className="ml-2 font-normal text-slate-500">
            {ru ? '(доза зависит от возраста)' : '(doza yoshga bog‘liq)'}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {YOSH_GURUHLARI.map(a => (
            <button
              key={a.id}
              onClick={() => setAgeBand(prev => (prev === a.id ? '' : a.id))}
              className={`px-3 py-2 rounded-lg border-2 font-semibold text-sm active:scale-95 ${
                ageBand === a.id
                  ? 'bg-blue-600 text-white border-blue-700'
                  : 'bg-white text-slate-700 border-slate-300'
              }`}
            >
              {ru ? a.ru : a.uz} <span className="opacity-70 text-xs">{a.hint}</span>
            </button>
          ))}
        </div>

        <div className="text-sm font-semibold text-slate-700 mt-3 mb-1.5">{ru ? 'Пол' : 'Jins'}</div>
        <div className="flex gap-1.5">
          {(['male', 'female'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSex(prev => (prev === s ? '' : s))}
              className={`px-4 py-2 rounded-lg border-2 font-semibold text-sm active:scale-95 ${
                sex === s
                  ? 'bg-blue-600 text-white border-blue-700'
                  : 'bg-white text-slate-700 border-slate-300'
              }`}
            >
              {s === 'male' ? (ru ? 'Мужской' : 'Erkak') : (ru ? 'Женский' : 'Ayol')}
            </button>
          ))}
        </div>
      </div>

      {/* Eng xavfli shikoyatlar — tepada */}
      <div className="rounded-xl border-2 border-red-300 bg-red-50 p-3">
        <div className="text-sm font-bold text-red-800 mb-2">
          🚩 {ru ? 'ОПАСНЫЕ ЖАЛОБЫ' : 'XAVFLI SHIKOYATLAR'}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CRITICAL_COMPLAINTS.slice(0, 14).map(c => {
            const on = selected.has(label(c));
            return (
              <button
                key={c.id}
                onClick={() => toggle(c)}
                className={`px-3 py-2 rounded-lg border-2 text-sm font-medium active:scale-95 ${
                  on ? 'bg-red-600 text-white border-red-700' : 'bg-white text-red-800 border-red-300'
                }`}
              >
                {label(c)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Kategoriyalar */}
      <div className="space-y-1.5">
        {EMERGENCY_COMPLAINT_GROUPS.map(g => {
          const open = openGroup === g.id;
          const count = g.items.filter(i => selected.has(label(i))).length;
          return (
            <div key={g.id} className="rounded-xl border border-slate-300 bg-white overflow-hidden">
              <button
                onClick={() => setOpenGroup(open ? '' : g.id)}
                className="w-full flex items-center justify-between px-3 py-3 active:bg-slate-50"
              >
                <span className="font-semibold text-slate-800">
                  {g.icon} {ru ? g.ru : g.uz}
                </span>
                <span className="flex items-center gap-2">
                  {count > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-xs font-bold">
                      {count}
                    </span>
                  )}
                  <span className="text-slate-400">{open ? '▲' : '▼'}</span>
                </span>
              </button>
              {open && (
                <div className="px-3 pb-3 flex flex-wrap gap-1.5">
                  {g.items.map(c => {
                    const on = selected.has(label(c));
                    return (
                      <button
                        key={c.id}
                        onClick={() => toggle(c)}
                        className={`px-3 py-2 rounded-lg border-2 text-sm active:scale-95 ${
                          on
                            ? 'bg-blue-600 text-white border-blue-700 font-semibold'
                            : c.critical
                              ? 'bg-white text-red-800 border-red-300'
                              : 'bg-white text-slate-700 border-slate-300'
                        }`}
                      >
                        {label(c)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Qo'shimcha matn — ixtiyoriy */}
      <div className="rounded-xl border border-slate-300 bg-white p-3">
        <div className="text-sm font-semibold text-slate-700 mb-1.5">
          {ru ? 'Дополнительно (необязательно)' : 'Qo‘shimcha (ixtiyoriy)'}
        </div>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
          maxLength={1000}
          placeholder={ru ? 'Что видите на месте…' : 'Joyida nima ko‘ryapsiz…'}
          className="w-full rounded-lg border border-slate-300 p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && (
        <div className="rounded-xl border-2 border-red-500 bg-red-50 p-3 text-red-900 font-semibold">
          ⚠️ {error}
          <div className="mt-1 text-sm font-normal">
            {ru
              ? 'Действуйте по своему протоколу.'
              : 'O‘z protokolingiz bo‘yicha harakat qiling.'}
          </div>
        </div>
      )}

      {/* Pastdagi qat'iy tugma */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur border-t border-slate-300">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <div className="text-sm text-slate-600 shrink-0">
            {selectedList.length > 0
              ? `${selectedList.length} ${ru ? 'выбрано' : 'ta tanlandi'}`
              : (ru ? 'Ничего не выбрано' : 'Tanlanmadi')}
          </div>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className={`flex-1 py-3.5 rounded-xl font-bold text-lg active:scale-[0.99] ${
              canSubmit ? 'bg-red-600 text-white' : 'bg-slate-300 text-slate-500'
            }`}
          >
            {loading
              ? (ru ? 'Анализ…' : 'Tahlil…')
              : (ru ? 'ТРИАЖ' : 'TRIAJ')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmergencyTriageView;
