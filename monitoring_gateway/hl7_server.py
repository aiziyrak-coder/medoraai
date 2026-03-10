"""
HL7 MLLP TCP server: monitor (K12) connects to us and sends HL7 messages.
Listen on configurable host:port (default 0.0.0.0:6006). MLLP: 0x0B + message + 0x1C 0x0D.
"""
import asyncio
import logging
from typing import Callable, Awaitable, Dict, Any

from .parser_hl7 import parse_hl7_message, device_id_from_hl7
from .config import get_ingest_api_key

logger = logging.getLogger(__name__)

MLLP_START = 0x0B
MLLP_END_1 = 0x1C
MLLP_END_2 = 0x0D


def get_hl7_listen_port() -> int:
    """Port for HL7 server (K12 "Server port"). Default 6006."""
    import os
    return int(os.getenv("GATEWAY_HL7_PORT", "6006"))


def get_hl7_listen_host() -> str:
    """Host to bind HL7 server. Default 0.0.0.0 (all interfaces)."""
    import os
    return os.getenv("GATEWAY_HL7_HOST", "0.0.0.0")


async def _read_mllp_message(reader: asyncio.StreamReader) -> str | None:
    """Read one MLLP-framed message: 0x0B ... 0x1C 0x0D. Returns message content as string."""
    buf = b""
    try:
        while True:
            chunk = await reader.read(4096)
            if not chunk:
                return None
            buf += chunk
            start = buf.find(bytes([MLLP_START]))
            if start == -1:
                if len(buf) > 8192:
                    buf = buf[-1024:]
                continue
            rest = buf[start + 1:]
            end = rest.find(bytes([MLLP_END_1]))
            if end == -1:
                if len(buf) > 16384:
                    buf = buf[start:]
                continue
            if end + 2 <= len(rest) and rest[end + 1] == MLLP_END_2:
                return rest[:end].decode("utf-8", errors="replace")
            buf = buf[start:]
    except asyncio.CancelledError:
        raise
    except Exception as e:
        logger.debug("MLLP read error: %s", e)
    return None


async def _handle_hl7_client(
    reader: asyncio.StreamReader,
    writer: asyncio.StreamWriter,
    on_vitals: Callable[[str, Dict[str, Any]], Awaitable[None]],
    default_device_id: str,
) -> None:
    """One client connection: read MLLP messages, parse HL7, call on_vitals."""
    peername = writer.get_extra_info("peername", ("?", 0))
    device_id = default_device_id
    logger.info("HL7 client connected from %s", peername)
    try:
        while True:
            raw = await _read_mllp_message(reader)
            if raw is None:
                break
            did = device_id_from_hl7(raw)
            if did:
                device_id = did
            payload = parse_hl7_message(raw)
            if payload:
                payload["device_id"] = device_id
                await on_vitals(device_id, payload)
    except asyncio.CancelledError:
        pass
    except Exception as e:
        logger.warning("HL7 client %s error: %s", peername, e)
    finally:
        try:
            writer.close()
            await writer.wait_closed()
        except Exception:
            pass
        logger.info("HL7 client disconnected %s", peername)


async def run_hl7_server(
    on_vitals: Callable[[str, Dict[str, Any]], Awaitable[None]],
    default_device_id: str = "K12_01",
) -> asyncio.Server:
    """Start HL7 MLLP TCP server. Returns the server object."""
    host = get_hl7_listen_host()
    port = get_hl7_listen_port()

    async def handler(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        await _handle_hl7_client(reader, writer, on_vitals, default_device_id)

    server = await asyncio.start_server(handler, host, port)
    addrs = ", ".join(str(s.getsockname()) for s in server.sockets)
    logger.info("HL7 MLLP server listening on %s (K12 Server IP/Port)", addrs)
    return server
