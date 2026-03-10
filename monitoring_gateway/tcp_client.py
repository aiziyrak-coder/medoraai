"""
Async TCP client: connect to monitor, read stream, parse, call on_vitals callback.
Auto-reconnect with exponential backoff.
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Callable, Awaitable, Dict, Any

from .config import MonitorConfig, get_backend_url, get_ingest_api_key
from .parser import parse_line, build_vitals_json

logger = logging.getLogger(__name__)

RECONNECT_MIN_DELAY = 2.0
RECONNECT_MAX_DELAY = 60.0


async def run_monitor_client(
    monitor: MonitorConfig,
    on_vitals: Callable[[str, Dict[str, Any]], Awaitable[None]],
) -> None:
    """
    Connect to monitor at host:port, read lines, parse vitals, call on_vitals(device_id, json_payload).
    Reconnects automatically on disconnect.
    """
    device_id = monitor.device_id
    host = monitor.host
    port = monitor.port
    state: Dict[str, Any] = {}
    delay = RECONNECT_MIN_DELAY

    while True:
        try:
            logger.info("Connecting to %s at %s:%s", device_id, host, port)
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(host, port),
                timeout=10.0,
            )
            delay = RECONNECT_MIN_DELAY
            logger.info("Connected to %s", device_id)

            while True:
                line = await asyncio.wait_for(reader.readline(), timeout=300.0)
                if not line:
                    break
                try:
                    decoded = line.decode("utf-8", errors="replace")
                except Exception:
                    continue
                parsed = parse_line(decoded)
                if parsed:
                    key, value = parsed
                    state[key] = value
                    payload = build_vitals_json(device_id, state, datetime.now(timezone.utc))
                    await on_vitals(device_id, payload)

        except asyncio.TimeoutError:
            logger.warning("Timeout reading from %s", device_id)
        except ConnectionRefusedError:
            logger.warning("Connection refused %s:%s (%s)", host, port, device_id)
        except ConnectionResetError:
            logger.warning("Connection reset %s", device_id)
        except OSError as e:
            logger.warning("OS error %s: %s", device_id, e)
        except Exception as e:
            logger.exception("Error in monitor client %s: %s", device_id, e)

        try:
            writer.close()
            await writer.wait_closed()
        except Exception:
            pass

        logger.info("Reconnecting to %s in %.1fs", device_id, delay)
        await asyncio.sleep(delay)
        delay = min(delay * 1.5, RECONNECT_MAX_DELAY)
