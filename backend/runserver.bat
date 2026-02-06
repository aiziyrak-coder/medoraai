@echo off
echo Starting Django Development Server on port 8000...
if exist venv\Scripts\activate.bat (call venv\Scripts\activate.bat)
python manage.py runserver 8000
