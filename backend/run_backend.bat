@echo off
REM MedoraAI backend - 8000 portda.
set DJANGO_SETTINGS_MODULE=medoraai_backend.settings
cd /d "%~dp0"
python manage.py runserver 0.0.0.0:8000
