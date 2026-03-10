"""
Gateway config: list of monitors (TCP) and backend API URL.
Load from env or config file. Example .env:
  GATEWAY_BACKEND_URL=http://localhost:8000/api
  GATEWAY_INGEST_API_KEY=monitoring-ingest-secret-change-in-production
  GATEWAY_MONITORS=monitor_12:127.0.0.1:5000,monitor_13:192.168.1.11:5000
"""
import os
from typing import List
from pydantic import BaseModel


class MonitorConfig(BaseModel):
    device_id: str
    host: str
    port: int


def get_backend_url() -> str:
    return os.getenv("GATEWAY_BACKEND_URL", "http://localhost:8000/api").rstrip("/")


def get_ingest_api_key() -> str:
    return os.getenv("GATEWAY_INGEST_API_KEY", "monitoring-ingest-secret-change-in-production")


def get_hl7_default_device_id() -> str:
    """Default device_id for HL7 (K12) when not in MSH. Must match Device.serial_number in backend."""
    return os.getenv("GATEWAY_HL7_DEFAULT_DEVICE_ID", "K12_01")


def get_monitors() -> List[MonitorConfig]:
    """
    GATEWAY_MONITORS format: device_id:host:port,device_id2:host2:port2
    Example: monitor_12:192.168.1.10:5000,monitor_13:192.168.1.11:5000
    """
    raw = os.getenv("GATEWAY_MONITORS", "monitor_12:127.0.0.1:5000")
    monitors: List[MonitorConfig] = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        tokens = part.split(":")
        if len(tokens) >= 3:
            try:
                device_id = tokens[0]
                host = tokens[1]
                port = int(tokens[2])
                monitors.append(MonitorConfig(device_id=device_id, host=host, port=port))
            except ValueError:
                continue
        elif len(tokens) == 2:
            try:
                monitors.append(MonitorConfig(device_id=tokens[0], host=tokens[1], port=5000))
            except Exception:
                continue
    return monitors
