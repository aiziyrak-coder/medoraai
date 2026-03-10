"""
Monitoring AI – vitals/alarms/notes asosida Gemini orqali tahlil.
8 ta funksiya: risk_score, explain_alarm, daily_summary, draft_note,
trend_prediction, sepsis_early_warning, suggest_thresholds, mortality_prediction.
"""
import json
import logging
from datetime import timedelta
from typing import Any, Dict, List, Optional

from django.utils import timezone

from .gemini_utils import _call_gemini, GEMINI_FLASH, GEMINI_PRO

logger = logging.getLogger(__name__)


def _get_monitoring_models():
    """Lazy import to avoid circular imports."""
    from monitoring.models import (
        Alarm,
        AlarmThreshold,
        MonitoringNote,
        PatientMonitor,
        VitalReading,
    )
    return VitalReading, Alarm, PatientMonitor, AlarmThreshold, MonitoringNote


def _vitals_context(vitals: List[Any], limit: int = 100) -> str:
    """Vitals list to text for prompt (timestamp, HR, SpO2, NIBP, resp, temp)."""
    lines = []
    for v in vitals[:limit]:
        ts = v.timestamp.strftime("%Y-%m-%d %H:%M") if getattr(v, "timestamp", None) else ""
        hr = getattr(v, "heart_rate", None)
        spo2 = getattr(v, "spo2", None)
        sys_ = getattr(v, "nibp_systolic", None)
        dia = getattr(v, "nibp_diastolic", None)
        resp = getattr(v, "respiration_rate", None)
        temp = getattr(v, "temperature", None)
        lines.append(f"{ts} | HR={hr} SpO2={spo2} NIBP={sys_}/{dia} RR={resp} T={temp}")
    return "\n".join(lines) if lines else "Ma'lumot yo'q"


def get_risk_score(patient_monitor_id: int, from_ts: Optional[str] = None, to_ts: Optional[str] = None) -> Dict[str, Any]:
    """
    Bemor holatining yomonlashuvi xavfi (0–100 ball, past/o'rta/yuqori).
    Returns: { "risk_level": "past"|"o'rta"|"yuqori", "score": 0-100, "reason": "..." }
    """
    VitalReading, _, PatientMonitor, _, _ = _get_monitoring_models()
    try:
        pm = PatientMonitor.objects.get(pk=patient_monitor_id, is_active=True)
    except PatientMonitor.DoesNotExist:
        return {"error": "Bemor topilmadi", "risk_level": None, "score": None, "reason": None}

    qs = VitalReading.objects.filter(patient_monitor=pm).order_by("-timestamp")[:200]
    if from_ts:
        qs = qs.filter(timestamp__gte=from_ts)
    if to_ts:
        qs = qs.filter(timestamp__lte=to_ts)
    vitals = list(qs)
    if not vitals:
        return {"risk_level": "noma'lum", "score": None, "reason": "Vital ma'lumot yo'q"}

    text = _vitals_context(vitals)
    prompt = f"""Quyidagi bemor vital belgilar vaqt ketma-ketligi berilgan. Tibbiy nuqtai nazardan bemor holatining yomonlashuvi (deterioration) xavfini baholang.
Bemor: {pm.patient_name or pm.bed_label or f'#{pm.id}'}, yosh: {pm.age or 'noma\'lum'}, jins: {pm.gender or 'noma\'lum'}.

Vitals (oxirgi qator eng yangi):
{text}

Javobni STRICT JSON da qaytaring, faqat quyidagi formatda (boshqa matn yozmang):
{{"risk_level": "past" yoki "o'rta" yoki "yuqori", "score": 0-100 son, "reason": "1-2 jumla qisqa asos (o'zbek tilida)"}}
O'zbek tilida reason."""

    try:
        raw = _call_gemini(prompt, GEMINI_FLASH, response_mime_type="application/json")
        data = json.loads(raw)
        return {
            "risk_level": data.get("risk_level") or "noma'lum",
            "score": data.get("score"),
            "reason": data.get("reason") or "",
        }
    except Exception as e:
        logger.exception("get_risk_score Gemini error: %s", e)
        return {"risk_level": "xato", "score": None, "reason": str(e)}


def explain_alarm(alarm_id: Optional[int] = None, patient_monitor_id: Optional[int] = None, param: Optional[str] = None, value: Optional[float] = None, message: Optional[str] = None) -> Dict[str, Any]:
    """
    Alarm uchun qisqa tushuntirish (2–3 jumla).
    Either alarm_id or (patient_monitor_id + param + value + message).
    Returns: { "explanation": "..." }
    """
    Alarm, _, PatientMonitor, _, _ = _get_monitoring_models()
    if alarm_id:
        try:
            alarm = Alarm.objects.select_related("patient_monitor").get(pk=alarm_id)
            patient_monitor_id = alarm.patient_monitor_id
            param = alarm.param
            value = alarm.value
            message = alarm.message or ""
        except Alarm.DoesNotExist:
            return {"explanation": "Alarm topilmadi."}

    prompt = f"""Tibbiy monitoring alarmi: parametr="{param}", qiymat={value}. Xabar: {message or 'yo\'q'}.
Bemor monitor ID: {patient_monitor_id}.
2-3 jumla bilan tushuntiring: nima uchun bu alarm muhim, qanday harakat qilish mumkin. O'zbek tilida (Lotin). Javobni faqat JSON da: {{"explanation": "..."}}"""

    try:
        raw = _call_gemini(prompt, GEMINI_FLASH, response_mime_type="application/json")
        data = json.loads(raw)
        return {"explanation": data.get("explanation", "").strip() or "Tushuntirish olinmadi."}
    except Exception as e:
        logger.exception("explain_alarm Gemini error: %s", e)
        return {"explanation": f"Xato: {e}"}


def get_daily_summary(patient_monitor_id: int, date_str: Optional[str] = None) -> Dict[str, Any]:
    """
    Oxirgi 24 soat (yoki berilgan kun) vitals + alarmlar asosida 3–5 jumlali xulosa.
    Returns: { "summary": "..." }
    """
    VitalReading, Alarm, PatientMonitor, _, _ = _get_monitoring_models()
    try:
        pm = PatientMonitor.objects.get(pk=patient_monitor_id, is_active=True)
    except PatientMonitor.DoesNotExist:
        return {"summary": "Bemor topilmadi."}

    now = timezone.now()
    if date_str:
        try:
            from datetime import datetime
            day = datetime.strptime(date_str[:10], "%Y-%m-%d").date()
            start = timezone.make_aware(timezone.datetime.combine(day, timezone.datetime.min.time()))
            end = start + timedelta(days=1)
        except Exception:
            start = now - timedelta(hours=24)
            end = now
    else:
        start = now - timedelta(hours=24)
        end = now

    vitals = list(VitalReading.objects.filter(patient_monitor=pm, timestamp__gte=start, timestamp__lte=end).order_by("timestamp")[:500])
    alarms = list(Alarm.objects.filter(patient_monitor=pm, created_at__gte=start, created_at__lte=end).order_by("created_at")[:50])

    text = _vitals_context(vitals)
    alarm_lines = [f"{a.created_at.strftime('%H:%M')} {a.param}={a.value} ({a.severity})" for a in alarms]
    alarm_text = "\n".join(alarm_lines) if alarm_lines else "Alarmlar yo'q"

    prompt = f"""Bemor: {pm.patient_name or pm.bed_label or f'#{pm.id}'}. Oxirgi 24 soat (yoki berilgan kun) uchun vital va alarmlar:
Vitals:
{text}

Alarmlar:
{alarm_text}

3-5 jumla bilan "bugun nima bo'ldi" xulosasi yozing (o'zbek tilida). Javobni faqat JSON: {{"summary": "..."}}"""

    try:
        raw = _call_gemini(prompt, GEMINI_FLASH, response_mime_type="application/json")
        data = json.loads(raw)
        return {"summary": data.get("summary", "").strip() or "Xulosa olinmadi."}
    except Exception as e:
        logger.exception("get_daily_summary Gemini error: %s", e)
        return {"summary": str(e)}


def get_draft_note(patient_monitor_id: int, note_type: str = "handover") -> Dict[str, Any]:
    """
    Eslatma qoralamasi: handover yoki progress_note.
    Returns: { "draft": "..." }
    """
    VitalReading, Alarm, PatientMonitor, _, MonitoringNote = _get_monitoring_models()
    try:
        pm = PatientMonitor.objects.get(pk=patient_monitor_id, is_active=True)
    except PatientMonitor.DoesNotExist:
        return {"draft": "Bemor topilmadi."}

    now = timezone.now()
    start = now - timedelta(hours=12)
    vitals = list(VitalReading.objects.filter(patient_monitor=pm, timestamp__gte=start).order_by("-timestamp")[:100])
    alarms = list(Alarm.objects.filter(patient_monitor=pm, created_at__gte=start).order_by("-created_at")[:20])
    notes = list(MonitoringNote.objects.filter(patient_monitor=pm).order_by("-created_at")[:10])

    text = _vitals_context(vitals)
    alarm_lines = [f"{a.param}={a.value} ({a.severity})" for a in alarms]
    note_lines = [n.note[:200] for n in notes]

    prompt = f"""Bemor: {pm.patient_name or pm.bed_label or f'#{pm.id}'}. So'nggi 12 soat vitals va alarmlar, eslatmalar asosida tibbiy eslatma qoralamasi yozing.
Vitals (oxirgi birinchi):
{text}
Alarmlar: {', '.join(alarm_lines) if alarm_lines else 'yo\'q'}
Oldingi eslatmalar: {'; '.join(note_lines) if note_lines else 'yo\'q'}

Tip: {note_type}. Kechki shift handover bo'lsa 2-4 jumla; progress_note bo'lsa 3-5 jumla. O'zbek tilida. Javobni faqat JSON: {{"draft": "..."}}"""

    try:
        raw = _call_gemini(prompt, GEMINI_FLASH, response_mime_type="application/json")
        data = json.loads(raw)
        return {"draft": data.get("draft", "").strip() or "Qoralamani yaratib bo'lmadi."}
    except Exception as e:
        logger.exception("get_draft_note Gemini error: %s", e)
        return {"draft": str(e)}


def get_trend_prediction(patient_monitor_id: int, metric: str = "spo2", horizon_minutes: int = 60) -> Dict[str, Any]:
    """
    Trend bashorat: keyingi soatda SpO2/nafas tushishi ehtimoli.
    Returns: { "deterioration_risk": "past"|"o'rta"|"yuqori", "reason": "..." }
    """
    VitalReading, _, PatientMonitor, _, _ = _get_monitoring_models()
    try:
        pm = PatientMonitor.objects.get(pk=patient_monitor_id, is_active=True)
    except PatientMonitor.DoesNotExist:
        return {"deterioration_risk": "noma'lum", "reason": "Bemor topilmadi."}

    start = timezone.now() - timedelta(hours=2)
    vitals = list(VitalReading.objects.filter(patient_monitor=pm, timestamp__gte=start).order_by("timestamp")[:120])
    if not vitals:
        return {"deterioration_risk": "noma'lum", "reason": "Vital ma'lumot yo'q."}

    text = _vitals_context(vitals)
    prompt = f"""Vital vaqt qatori (oxirgi 2 soat). Bemor: {pm.patient_name or pm.bed_label or f'#{pm.id}'}.
{text}

Parametr: {metric}. Keyingi {horizon_minutes} daqiqada bu parametr yomonlashishi (masalan SpO2 tushishi) ehtimolini baholang: past / o'rta / yuqori.
Javobni JSON: {{"deterioration_risk": "past" yoki "o'rta" yoki "yuqori", "reason": "1-2 jumla (o'zbek)"}}"""

    try:
        raw = _call_gemini(prompt, GEMINI_FLASH, response_mime_type="application/json")
        data = json.loads(raw)
        return {
            "deterioration_risk": data.get("deterioration_risk") or "noma'lum",
            "reason": data.get("reason", "").strip(),
        }
    except Exception as e:
        logger.exception("get_trend_prediction Gemini error: %s", e)
        return {"deterioration_risk": "xato", "reason": str(e)}


def get_sepsis_early_warning(patient_monitor_id: int, from_ts: Optional[str] = None, to_ts: Optional[str] = None) -> Dict[str, Any]:
    """
    Sepsis / jiddiy infektsiya uchun erta ogohlantirish (e'tiborni tortish; tashxis emas).
    Returns: { "concern_level": "past"|"o'rta"|"yuqori", "suggested_actions": "...", "disclaimer": "..." }
    """
    VitalReading, Alarm, PatientMonitor, _, _ = _get_monitoring_models()
    try:
        pm = PatientMonitor.objects.get(pk=patient_monitor_id, is_active=True)
    except PatientMonitor.DoesNotExist:
        return {"concern_level": "noma'lum", "suggested_actions": "", "disclaimer": "Tibbiy tashxis emas."}

    qs = VitalReading.objects.filter(patient_monitor=pm).order_by("-timestamp")[:150]
    if from_ts:
        qs = qs.filter(timestamp__gte=from_ts)
    if to_ts:
        qs = qs.filter(timestamp__lte=to_ts)
    vitals = list(qs)
    if not vitals:
        return {"concern_level": "noma'lum", "suggested_actions": "Ma'lumot yetarli emas.", "disclaimer": "Tibbiy tashxis emas."}

    text = _vitals_context(vitals)
    prompt = f"""Bemor: {pm.patient_name or pm.bed_label or f'#{pm.id}'}, yosh: {pm.age}, jins: {pm.gender}. Vital vaqt qatori:
{text}

Sepsis yoki jiddiy infektsiya uchun erta belgilar (HR, harorat, nafas, SpO2, AQB) nuqtai nazaridan xavf darajasini baholang: past / o'rta / yuqori.
Tavsiya: qisqa "suggested_actions" (1-2 jumla, masalan reanimatolog/infeksionistga murojaat). Bu TASHXIS EMAS, faqat qo'llab-quvvatlash.
Javobni JSON: {{"concern_level": "past"|"o'rta"|"yuqori", "suggested_actions": "...", "disclaimer": "Tibbiy tashxis emas, faqat yordamchi."}}
O'zbek tilida."""

    try:
        raw = _call_gemini(prompt, GEMINI_PRO, response_mime_type="application/json")
        data = json.loads(raw)
        return {
            "concern_level": data.get("concern_level") or "noma'lum",
            "suggested_actions": (data.get("suggested_actions") or "").strip(),
            "disclaimer": (data.get("disclaimer") or "Tibbiy tashxis emas.").strip(),
        }
    except Exception as e:
        logger.exception("get_sepsis_early_warning Gemini error: %s", e)
        return {"concern_level": "xato", "suggested_actions": "", "disclaimer": "Tibbiy tashxis emas."}


def get_suggested_thresholds(patient_monitor_id: int) -> Dict[str, Any]:
    """
    Oxirgi 7 kun vitals statistikasiga qarab alarm chegaralari taklifi.
    Returns: { "suggested": [ { "param": "heart_rate", "min_value": 40, "max_value": 120, "reason": "..." }, ... ], "disclaimer": "..." }
    """
    VitalReading, _, PatientMonitor, AlarmThreshold, _ = _get_monitoring_models()
    try:
        pm = PatientMonitor.objects.get(pk=patient_monitor_id, is_active=True)
    except PatientMonitor.DoesNotExist:
        return {"suggested": [], "disclaimer": "Bemor topilmadi."}

    start = timezone.now() - timedelta(days=7)
    vitals = list(VitalReading.objects.filter(patient_monitor=pm, timestamp__gte=start).order_by("timestamp"))
    current = list(AlarmThreshold.objects.filter(patient_monitor=pm, is_active=True).values("param", "min_value", "max_value"))

    if not vitals:
        return {"suggested": [], "disclaimer": "7 kunlik ma'lumot yo'q."}

    # Build simple stats per param
    from django.db.models import Min, Max, Avg
    agg = VitalReading.objects.filter(patient_monitor=pm, timestamp__gte=start).aggregate(
        hr_min=Min("heart_rate"), hr_max=Max("heart_rate"), hr_avg=Avg("heart_rate"),
        spo2_min=Min("spo2"), spo2_max=Max("spo2"), spo2_avg=Avg("spo2"),
        nibp_sys_min=Min("nibp_systolic"), nibp_sys_max=Max("nibp_systolic"),
        nibp_dia_min=Min("nibp_diastolic"), nibp_dia_max=Max("nibp_diastolic"),
        rr_min=Min("respiration_rate"), rr_max=Max("respiration_rate"), rr_avg=Avg("respiration_rate"),
    )
    stats_text = json.dumps({k: (round(v, 1) if v is not None else None) for k, v in agg.items()}, ensure_ascii=False)
    current_text = json.dumps(current, ensure_ascii=False)

    prompt = f"""Bemor: {pm.patient_name or pm.bed_label or f'#{pm.id}'}. Oxirgi 7 kun vital statistikasi: {stats_text}
Hozirgi alarm chegaralari: {current_text}

Har bir parametr (heart_rate, spo2, nibp_systolic, nibp_diastolic, respiration_rate) uchun tibbiy jihatdan mantiqiy min/max chegaralar taklif qiling. Bemor trendiga mos.
Javobni STRICT JSON: {{"suggested": [{{"param": "heart_rate", "min_value": 40, "max_value": 120, "reason": "qisqa asos"}}, ...], "disclaimer": "Taklif; qabul qilish shifokor/hamshira qarori."}}
O'zbek tilida reason va disclaimer."""

    try:
        raw = _call_gemini(prompt, GEMINI_FLASH, response_mime_type="application/json")
        data = json.loads(raw)
        return {
            "suggested": data.get("suggested") or [],
            "disclaimer": (data.get("disclaimer") or "Taklif; qaror mutaxassis qarori.").strip(),
        }
    except Exception as e:
        logger.exception("get_suggested_thresholds Gemini error: %s", e)
        return {"suggested": [], "disclaimer": str(e)}


def get_mortality_prediction(patient_monitor_id: int, from_ts: Optional[str] = None, to_ts: Optional[str] = None) -> Dict[str, Any]:
    """
    O'lim xavfi bashorati (ehtimoliy xavf balli) – faqat qo'llab-quvvatlash, tashxis emas.
    Returns: { "risk_level": "past"|"o'rta"|"yuqori"|"juda yuqori", "score": 0-100, "reason": "...", "disclaimer": "..." }
    """
    VitalReading, Alarm, PatientMonitor, _, _ = _get_monitoring_models()
    try:
        pm = PatientMonitor.objects.get(pk=patient_monitor_id, is_active=True)
    except PatientMonitor.DoesNotExist:
        return {"risk_level": "noma'lum", "score": None, "reason": "Bemor topilmadi.", "disclaimer": "Tibbiy tashxis emas."}

    qs = VitalReading.objects.filter(patient_monitor=pm).order_by("-timestamp")[:300]
    if from_ts:
        qs = qs.filter(timestamp__gte=from_ts)
    if to_ts:
        qs = qs.filter(timestamp__lte=to_ts)
    vitals = list(qs)
    alarms = list(Alarm.objects.filter(patient_monitor=pm).order_by("-created_at")[:50])

    if not vitals:
        return {"risk_level": "noma'lum", "score": None, "reason": "Vital ma'lumot yo'q.", "disclaimer": "Bu tashxis emas."}

    text = _vitals_context(vitals)
    alarm_summary = f"Alarmlar: {len(alarms)} ta (oxirgi 50)" if alarms else "Alarmlar yo'q"

    prompt = f"""Tibbiy yordamchi AI: Quyidagi bemorning vital vaqt qatori va alarmlar asosida O'LIM XAVFI (mortality risk) ni baholang. Bu TASHXIS EMAS – faqat ehtiyotkorlik va e'tibor uchun yordamchi ko'rsatkich.
Bemor: {pm.patient_name or pm.bed_label or f'#{pm.id}'}, yosh: {pm.age}, jins: {pm.gender}.
{alarm_summary}

Vitals (oxirgi qator eng yangi):
{text}

risk_level: "past" | "o'rta" | "yuqori" | "juda yuqori"
score: 0-100 (0 = eng past xavf, 100 = eng yuqori)
reason: 2-4 jumla qisqa asos (o'zbek tilida)
disclaimer: "Bu tibbiy tashxis emas. Bemor holatini har doim shifokor baholaydi."

Javobni faqat JSON da qaytaring: {{"risk_level": "...", "score": 0-100, "reason": "...", "disclaimer": "..."}}"""

    try:
        raw = _call_gemini(prompt, GEMINI_PRO, response_mime_type="application/json")
        data = json.loads(raw)
        return {
            "risk_level": data.get("risk_level") or "noma'lum",
            "score": data.get("score"),
            "reason": (data.get("reason") or "").strip(),
            "disclaimer": (data.get("disclaimer") or "Bu tibbiy tashxis emas.").strip(),
        }
    except Exception as e:
        logger.exception("get_mortality_prediction Gemini error: %s", e)
        return {"risk_level": "xato", "score": None, "reason": str(e), "disclaimer": "Bu tibbiy tashxis emas."}
