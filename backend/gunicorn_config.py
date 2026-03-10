"""
Gunicorn Production Config
Azure VM: 20.82.115.71  |  medora.ziyrak.org
2 vCPU Azure Standard B2s — 4 worker (2*CPU+1)
"""

import multiprocessing
import os

# Project log dir (no sudo required)
_BASE = os.path.dirname(os.path.abspath(__file__))
_LOGDIR = os.path.join(_BASE, "logs")
os.makedirs(_LOGDIR, exist_ok=True)

# ── Bind ────────────────────────────────────────────────────────────────────
bind             = "127.0.0.1:8000"          # Nginx orqali proxy
backlog          = 2048

# ── Workers ─────────────────────────────────────────────────────────────────
# Azure B2s = 2 vCPU → 2*2+1 = 5 worker; lekin AI zakodirovka uchun 4 qoldiring
workers          = multiprocessing.cpu_count() * 2 + 1
worker_class     = "gthread"                  # AI streaming uchun threaded
threads          = 4                           # Har bir worker uchun thread soni
worker_connections = 1000

# ── Timeout ─────────────────────────────────────────────────────────────────
# AI Consilium so'rovlari 60-120s ga etadi; shuning uchun 180s
timeout          = 180
graceful_timeout = 30
keepalive        = 5

# ── Requests ────────────────────────────────────────────────────────────────
max_requests         = 1000
max_requests_jitter  = 100

# ── Logging ─────────────────────────────────────────────────────────────────
accesslog    = os.path.join(_LOGDIR, "gunicorn_access.log")
errorlog     = os.path.join(_LOGDIR, "gunicorn_error.log")
loglevel     = "info"
access_log_format = (
    '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'
)

# ── Process ─────────────────────────────────────────────────────────────────
preload_app   = True                          # Xotira tejash
daemon        = False                         # systemd boshqaradi
pidfile       = os.path.join(_LOGDIR, "medora.pid")
# user/group: leave unset when running as cdcgroup (systemd User=cdcgroup)

# ── WSGI ────────────────────────────────────────────────────────────────────
wsgi_app      = "medoraai_backend.wsgi:application"

# ── Worker lifecycle hooks ───────────────────────────────────────────────────
def on_starting(server):
    server.log.info("Medora AI backend starting on Azure VM 20.82.115.71")

def worker_exit(server, worker):
    server.log.info("Worker %s exited", worker.pid)
