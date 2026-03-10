# MedoraAI backend - 8000 portda. Boshqa loyiha (config) 8000 da ishlamasin.
$env:DJANGO_SETTINGS_MODULE = 'medoraai_backend.settings'
Set-Location $PSScriptRoot
python manage.py runserver 0.0.0.0:8000
