"""
Parse monitor text stream into structured vitals.
Example stream:
  HR:78
  SPO2:97
  NIBP:120/80
  RESP:16
  TEMP:36.7
"""
import re
from typing import Dict, Any, Optional, Tuple
from datetime import datetime, timezone


def parse_line(line: str) -> Optional[Tuple[str, Any]]:
    """Parse a single line like 'HR:78' or 'NIBP:120/80'. Returns (key, value) or None."""
    line = line.strip()
    if not line or ":" not in line:
        return None
    key, _, rest = line.partition(":")
    key = key.strip().upper()
    value = rest.strip()
    if not key or value is None:
        return None

    if key == "HR":
        try:
            return ("heart_rate", int(value))
        except ValueError:
            return None
    if key == "SPO2":
        try:
            return ("spo2", int(value))
        except ValueError:
            return None
    if key == "NIBP":
        # 120/80
        m = re.match(r"(\d+)\s*/\s*(\d+)", value)
        if m:
            return ("nibp", (int(m.group(1)), int(m.group(2))))
        return None
    if key == "RESP":
        try:
            return ("respiration", int(value))
        except ValueError:
            return None
    if key == "TEMP":
        try:
            return ("temperature", float(value))
        except ValueError:
            return None
    return None


def build_vitals_json(device_id: str, state: Dict[str, Any], timestamp: Optional[datetime] = None) -> Dict[str, Any]:
    """Build JSON payload for backend/WebSocket from accumulated state."""
    ts = timestamp or datetime.now(timezone.utc)
    payload: Dict[str, Any] = {
        "device_id": device_id,
        "timestamp": ts.isoformat().replace("+00:00", "Z"),
    }
    if "heart_rate" in state:
        payload["heart_rate"] = state["heart_rate"]
    if "spo2" in state:
        payload["spo2"] = state["spo2"]
    if "nibp" in state:
        sys_val, dia_val = state["nibp"]
        payload["bp_sys"] = sys_val
        payload["bp_dia"] = dia_val
        payload["nibp_systolic"] = sys_val
        payload["nibp_diastolic"] = dia_val
    if "respiration" in state:
        payload["respiration"] = state["respiration"]
    if "temperature" in state:
        payload["temperature"] = state["temperature"]
    return payload
