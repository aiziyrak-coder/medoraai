"""
Send parsed vitals to Django backend and broadcast via WebSocket.
"""
import logging
from typing import Dict, Any, Set, List
import httpx
from fastapi import WebSocket

from .config import get_backend_url, get_ingest_api_key, MonitorConfig

logger = logging.getLogger(__name__)

# WebSocket subscribers (broadcast vitals to dashboard)
_ws_subscribers: Set[WebSocket] = set()


def add_ws_subscriber(ws: WebSocket) -> None:
    _ws_subscribers.add(ws)


def remove_ws_subscriber(ws: WebSocket) -> None:
    _ws_subscribers.discard(ws)


async def broadcast_vitals(payload: Dict[str, Any]) -> None:
    import json
    dead = set()
    msg = json.dumps(payload)
    for ws in _ws_subscribers:
        try:
            await ws.send_text(msg)
        except Exception:
            dead.add(ws)
    for ws in dead:
        _ws_subscribers.discard(ws)


async def fetch_gateway_monitors() -> List[MonitorConfig]:
    """GET /api/monitoring/gateway-monitors/ – backend da IP/port kiritilgan qurilmalar ro'yxati."""
    base = get_backend_url()
    url = f"{base}/monitoring/gateway-monitors/"
    api_key = get_ingest_api_key()
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(
                url,
                headers={"X-API-Key": api_key, "Content-Type": "application/json"},
            )
            if r.status_code == 200:
                data = r.json()
                if data.get("success") and isinstance(data.get("monitors"), list):
                    return [MonitorConfig(**m) for m in data["monitors"]]
    except Exception as e:
        logger.debug("Fetch gateway monitors: %s", e)
    return []


async def send_to_backend(device_id: str, payload: Dict[str, Any]) -> bool:
    """POST to Django /api/monitoring/ingest/. Returns True if success."""
    base = get_backend_url()
    url = f"{base}/monitoring/ingest/"
    api_key = get_ingest_api_key()
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.post(
                url,
                json=payload,
                headers={"X-API-Key": api_key, "Content-Type": "application/json"},
            )
            if r.status_code in (200, 201):
                return True
            logger.warning("Backend ingest %s: %s %s", device_id, r.status_code, r.text)
            return False
    except Exception as e:
        logger.warning("Backend ingest failed %s: %s", device_id, e)
        return False
