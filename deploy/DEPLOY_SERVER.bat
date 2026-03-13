@echo off
REM ============================================
REM MedoraAI Server Deployment Script
REM ============================================
REM Server: root@medora.cdcgroup.uz
REM Password: Ziyrak2025Ai
REM ============================================

echo.
echo ========================================
echo  MedoraAI Server Deployment
echo ========================================
echo.
echo Server: root@medora.cdcgroup.uz
echo GitHub Repo: github.com/aiziyrak-coder/medoraai
echo.
echo DEPLOYMENT STEPS:
echo.
echo 1. Connect to server via SSH:
echo    ssh root@medora.cdcgroup.uz
echo    Password: Ziyrak2025Ai
echo.
echo 2. Navigate to project directory:
echo    cd /root/medoraai
echo.
echo 3. Pull latest changes from GitHub:
echo    git pull origin main
echo.
echo 4. Restart backend service:
echo    sudo systemctl restart medoraai-backend-8001.service
echo.
echo 5. Check service status:
echo    sudo systemctl status medoraai-backend-8001.service
echo.
echo 6. View logs:
echo    sudo journalctl -u medoraai-backend-8001.service -f --no-pager
echo.
echo ========================================
echo  QUICK ONE-LINER COMMAND:
echo ========================================
echo.
echo ssh root@medora.cdcgroup.uz "cd /root/medoraai ^&^& git pull origin main ^&^& sudo systemctl restart medoraai-backend-8001.service ^&^& echo DONE"
echo.
echo ========================================

pause
