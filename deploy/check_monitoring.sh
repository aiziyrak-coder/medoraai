#!/bin/bash
# Serverda monitoring tizimini tekshirish: bash deploy/check_monitoring.sh
APP_DIR="${APP_DIR:-/root/medoraai}"
cd "$APP_DIR" || exit 1

echo "========================================"
echo "🏥 MONITORING SYSTEM CHECK"
echo "========================================"
echo ""

echo "1️⃣  Backend (Gunicorn):"
if pgrep -f "gunicorn.*medoraai_backend" > /dev/null; then
  echo "✅ Running"
  ps aux | grep "gunicorn.*medoraai" | grep -v grep | head -2
else
  echo "❌ NOT RUNNING"
fi
echo ""

echo "2️⃣  Gateway (Port 9000):"
if pgrep -f "uvicorn.*monitoring_gateway" > /dev/null; then
  echo "✅ Running"
  ps aux | grep "uvicorn.*monitoring_gateway" | grep -v grep
else
  echo "❌ NOT RUNNING"
fi
echo ""

echo "3️⃣  Ports:"
if command -v ss >/dev/null 2>&1; then
  ss -tulpn 2>/dev/null | grep -E ':8001|:9000' || echo "  Ports 8001/9000 not listening"
elif command -v netstat >/dev/null 2>&1; then
  netstat -tulpn 2>/dev/null | grep -E '8001|9000' || echo "  Ports 8001/9000 not listening"
else
  echo "  ss/netstat yo'q"
fi
echo ""

echo "4️⃣  Devices in Database:"
cd "$APP_DIR/backend" && source venv/bin/activate
python << 'PYEOF'
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'medoraai_backend.settings')
django.setup()
from monitoring.models import Device
devices = Device.objects.all()
if devices.exists():
    for d in devices:
        print(f"  {d.serial_number} | {d.host or '(bo\'sh)'}:{d.port or '-'} | {d.status}")
else:
    print("  ❌ No devices found")
PYEOF
echo ""

echo "5️⃣  Patient Monitors:"
python << 'PYEOF'
from monitoring.models import PatientMonitor
monitors = PatientMonitor.objects.all()
if monitors.exists():
    for m in monitors:
        print(f"  {m.name} | Bed: {m.bed_label} | Device: {m.device_id}")
else:
    print("  ❌ No patient monitors")
PYEOF
deactivate 2>/dev/null
echo ""

echo "6️⃣  Gateway Health:"
curl -s --connect-timeout 2 http://127.0.0.1:9000/health 2>/dev/null || echo "❌ Gateway not responding"
echo ""

echo "7️⃣  Backend Health:"
curl -s --connect-timeout 2 http://127.0.0.1:8001/health/ 2>/dev/null | head -c 120 || echo "❌ Backend not responding"
echo ""

echo "========================================"
echo "CHECK COMPLETE"
echo "========================================"
