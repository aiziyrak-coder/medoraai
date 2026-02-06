@echo off
cd /d "%~dp0"
echo Checking Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo [XATO] Node.js topilmadi.
    echo Iltimos, Node.js o'rnating: https://nodejs.org/
    echo O'rnatgach terminalni yopib qayta oching.
    pause
    exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
    echo [XATO] npm topilmadi. Node.js to'liq o'rnatilmagan bo'lishi mumkin.
    pause
    exit /b 1
)
if not exist "node_modules" (
    echo node_modules yo'q. npm install bajarilmoqda...
    call npm install
    if errorlevel 1 (
        echo npm install xato bilan tugadi.
        pause
        exit /b 1
    )
)
echo Frontend ishga tushyapti: http://localhost:3000
call npm run dev
pause
