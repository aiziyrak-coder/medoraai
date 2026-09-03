"""
Gunicorn Production Config
Farg'ona JSTI | aidoktor.uz
2 vCPU Azure Standard B2s  -  4 worker (2*CPU+1)
"""

import multiprocessing
import os

# Project log dir (no sudo required)
_BASE = os.path.dirname(os.path.abspath(__file__))
_LOGDIR = os.path.join(_BASE, "logs")
os.makedirs(_LOGDIR, exist_ok=True)

# --- Bind ---
# Muhit o'zgaruvchisidan. Port serverga qarab farq qiladi (aishifokor 8100
# da ishlaydi). Qotirib qo'yilsa, deploy paytida bu fayl almashtirilganda
# xizmat boshqa portda ko'tariladi va nginx uni topolmay qoladi.
bind             = os.environ.get("GUNICORN_BIND", "127.0.0.1:8000")
backlog          = 2048

# --- Workers ---
# 2*CPU+1, lekin 16 tadan oshmasin: umumiy serverda 32 yadro bo'lganda
# 65 ta worker ko'tariladi va har biri Django'ni preload qilib xotirani yeydi.
_default_workers = min(multiprocessing.cpu_count() * 2 + 1, 16)
workers          = int(os.environ.get("GUNICORN_WORKERS", _default_workers))
worker_class     = os.environ.get("GUNICORN_WORKER_CLASS", "gthread")
threads          = int(os.environ.get("GUNICORN_THREADS", 4))
worker_connections = 1000

# --- Timeout ---
# AI Consilium so'rovlari 60-120s ga etadi; shuning uchun 180s
timeout          = int(os.environ.get("GUNICORN_TIMEOUT", 180))
graceful_timeout = 30
keepalive        = 5

# --- Requests ---
max_requests         = 1000
max_requests_jitter  = 100

# --- Logging ---
accesslog    = os.path.join(_LOGDIR, "gunicorn_access.log")
errorlog     = os.path.join(_LOGDIR, "gunicorn_error.log")
loglevel     = "info"
access_log_format = (
    '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'
)

# --- Process ---
preload_app   = True                          # Xotira tejash
daemon        = False                         # systemd boshqaradi
pidfile       = os.path.join(_LOGDIR, "FJSTI.pid")
# user/group: leave unset when running as cdcgroup (systemd User=cdcgroup)

# WSGI
wsgi_app      = "medoraai_backend.wsgi:application"

# --- Worker lifecycle hooks ---
def on_starting(server):
    server.log.info("Farg'ona JSTI backend starting")

def worker_exit(server, worker):
    server.log.info("Worker %s exited", worker.pid)
