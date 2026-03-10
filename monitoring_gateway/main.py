"""
Monitoring Gateway – TCP monitors -> parse -> Django API + WebSocket.
Run: uvicorn monitoring_gateway.main:app --host 0.0.0.0 --port 9000
"""
import asyncio
import json
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from .config import get_monitors
from .tcp_client import run_monitor_client
from .ingest import send_to_backend, broadcast_vitals, add_ws_subscriber, remove_ws_subscriber, fetch_gateway_monitors
from .hl7_server import run_hl7_server
from .config import get_hl7_default_device_id

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_monitor_tasks: list = []
_hl7_server = None


async def on_vitals(device_id: str, payload: dict) -> None:
    """Called for each parsed vitals update: send to Django and broadcast to WebSocket clients."""
    await send_to_backend(device_id, payload)
    await broadcast_vitals(payload)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start TCP client tasks for configured monitors and HL7 server (K12)."""
    global _hl7_server
    monitors = await fetch_gateway_monitors()
    if not monitors:
        monitors = get_monitors()
        if not monitors:
            logger.warning("No TCP monitors. Qurilmalar formasida IP/Port kiriting yoki GATEWAY_MONITORS env sozlang.")
    for m in monitors:
        t = asyncio.create_task(run_monitor_client(m, on_vitals))
        _monitor_tasks.append(t)
    # HL7 MLLP server: K12 connects TO us (Server IP 192.168.168.254, Port 6006)
    _hl7_server = await run_hl7_server(on_vitals, default_device_id=get_hl7_default_device_id())
    yield
    if _hl7_server:
        _hl7_server.close()
        await _hl7_server.wait_closed()
    for t in _monitor_tasks:
        t.cancel()
    await asyncio.gather(*_monitor_tasks, return_exceptions=True)


app = FastAPI(title="Monitoring Gateway", version="1.0.0", lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "monitoring-gateway"}


@app.get("/monitors")
async def list_monitors():
    """List configured monitors (device_id, host, port)."""
    return {"monitors": [{"device_id": m.device_id, "host": m.host, "port": m.port} for m in get_monitors()]}


@app.websocket("/ws/vitals")
async def websocket_vitals(websocket: WebSocket):
    """
    Real-time vitals stream. Client receives JSON messages:
    {"device_id":"monitor_12","heart_rate":78,"spo2":97,...,"timestamp":"..."}
    """
    await websocket.accept()
    add_ws_subscriber(websocket)
    try:
        while True:
            # Keep connection alive; client can send ping or we just wait for server msgs
            data = await websocket.receive_text()
            # Optional: client can send {"subscribe": "monitor_12"} to filter (future)
            try:
                obj = json.loads(data)
                if obj.get("ping") == 1:
                    await websocket.send_text(json.dumps({"pong": 1}))
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        pass
    finally:
        remove_ws_subscriber(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("monitoring_gateway.main:app", host="0.0.0.0", port=9000, reload=True)
