"""
HL7 v2.x parser for K12 and other HL7 devices.
MLLP TCP server receives messages; OBX segments mapped to vitals JSON.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)

# Common LOINC / local codes for vitals (OBX-3)
HEART_RATE_CODES = ("8867-4", "HR", "heart rate", "pulse", "chss", "puls")
SPO2_CODES = ("59408-5", "SPO2", "spo2", "SpO2", "sao2", "oxygen")
NIBP_SYS_CODES = ("8480-6", "SYS", "systolic", "sistolik", "sys", "nibp_sys")
NIBP_DIA_CODES = ("8462-4", "DIA", "diastolic", "diastolik", "dia", "nibp_dia")
RESP_CODES = ("9279-1", "RESP", "respiration", "nafas", "rr", "resp")
TEMP_CODES = ("8310-5", "TEMP", "temperature", "harorat", "temp", "t")


def _normalize_obx_id(obx3: str) -> str:
    """OBX-3 is like 8867-4^HR^^^ or just HR – return lower identifier."""
    if not obx3:
        return ""
    part = obx3.split("^")[0].strip().lower()
    return part or obx3.strip().lower()


def _match_codes(normalized: str, *code_sets: tuple[str, ...]) -> bool:
    for code_set in code_sets:
        for c in code_set:
            if c.lower() in normalized or normalized in c.lower():
                return True
    return False


def parse_hl7_message(raw: str | bytes) -> dict[str, Any] | None:
    """
    Parse HL7 v2.x message (pipe-delimited) into standardized vital payload.
    Extracts OBX segments and maps to heart_rate, spo2, bp_sys, bp_dia, respiration, temperature.
    """
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8", errors="replace")
    segments = [s.strip() for s in raw.split("\r") if s.strip()]
    if not segments:
        segments = [s.strip() for s in raw.split("\n") if s.strip()]

    payload: dict[str, Any] = {}
    for seg in segments:
        if not seg.startswith("OBX|"):
            continue
        parts = seg.split("|")
        if len(parts) < 6:
            continue
        obx_id = _normalize_obx_id(parts[3] if len(parts) > 3 else "")
        value_field = (parts[5] if len(parts) > 5 else "").strip()
        if not value_field:
            continue
        try:
            num_val = float(re.sub(r"[^\d.\-]", "", value_field.replace(",", ".")) or "0")
        except ValueError:
            continue

        if _match_codes(obx_id, HEART_RATE_CODES):
            payload["heart_rate"] = int(round(num_val))
        elif _match_codes(obx_id, SPO2_CODES):
            payload["spo2"] = int(round(num_val))
        elif _match_codes(obx_id, NIBP_SYS_CODES):
            payload["bp_sys"] = int(round(num_val))
        elif _match_codes(obx_id, NIBP_DIA_CODES):
            payload["bp_dia"] = int(round(num_val))
        elif _match_codes(obx_id, RESP_CODES):
            payload["respiration"] = int(round(num_val))
        elif _match_codes(obx_id, TEMP_CODES):
            payload["temperature"] = round(num_val, 1)

    if not payload:
        return None
    payload["timestamp"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return payload


def device_id_from_hl7(raw: str | bytes) -> str | None:
    """Extract MSH-3 (Sending Application) or MSH-4 (Sending Facility) as device_id."""
    if isinstance(raw, bytes):
        raw = raw.decode("utf-8", errors="replace")
    for line in raw.split("\r"):
        if line.startswith("MSH|"):
            parts = line.split("|")
            if len(parts) > 4 and parts[3].strip():
                return parts[3].strip()
            if len(parts) > 3 and parts[2].strip():
                return parts[2].strip()
    return None
