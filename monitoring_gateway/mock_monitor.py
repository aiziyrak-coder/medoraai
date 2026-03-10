"""
Simple TCP server that emulates a patient monitor sending vital sign stream.
Run: python -m monitoring_gateway.mock_monitor
Then in another terminal run the gateway with GATEWAY_MONITORS=monitor_12:127.0.0.1:5000
"""
import asyncio
import random


async def handle_client(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
    addr = writer.get_extra_info("peername")
    print(f"Monitor client connected from {addr}")
    try:
        while True:
            hr = random.randint(60, 100)
            spo2 = random.randint(92, 100)
            sys_bp = random.randint(110, 130)
            dia_bp = random.randint(70, 85)
            resp = random.randint(12, 20)
            temp = round(36.0 + random.random() * 1.5, 1)
            lines = [
                f"HR:{hr}",
                f"SPO2:{spo2}",
                f"NIBP:{sys_bp}/{dia_bp}",
                f"RESP:{resp}",
                f"TEMP:{temp}",
            ]
            for line in lines:
                writer.write((line + "\n").encode("utf-8"))
                await writer.drain()
            await asyncio.sleep(2.0)
    except (ConnectionResetError, BrokenPipeError):
        pass
    finally:
        writer.close()
        await writer.wait_closed()
        print(f"Client {addr} disconnected")


async def main() -> None:
    server = await asyncio.start_server(handle_client, "0.0.0.0", 5000)
    print("Mock monitor listening on 0.0.0.0:5000 (send HR, SPO2, NIBP, RESP, TEMP)")
    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    asyncio.run(main())
