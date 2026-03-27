#!/bin/bash
# AiDoktor - Full Automated Deployment Script
# Pushes to GitHub, then SSH to server and deploy automatically

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SERVER_USER="root"
SERVER_HOST="167.71.53.238"
SERVER_PASSWORD="Ziyrak2025Ai"
PROJECT_DIR="/root/AiDoktorai"
BACKEND_DIR="${PROJECT_DIR}/backend"

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}🚀 AiDoktor - Full Automated Deployment${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Step 1: Push to GitHub
echo -e "${YELLOW}Step 1: Pushing to GitHub...${NC}"
git add .
git commit -m "Auto-deploy: $(date '+%Y-%m-%d %H:%M:%S')" || echo "No changes to commit"
git push origin main
echo -e "${GREEN}✅ GitHub push completed${NC}"
echo ""

# Step 2: Create deployment commands file
echo -e "${YELLOW}Creating deployment script for server...${NC}"

cat > /tmp/deploy_commands.sh << 'DEPLOY_SCRIPT'
#!/bin/bash
set -e

echo ""
echo "========================================"
echo "📦 Pulling latest changes from GitHub..."
echo "========================================"
cd /root/AiDoktorai
git pull origin main

echo ""
echo "========================================"
echo "🔧 Creating .env file..."
echo "========================================"
cd /root/AiDoktorai/backend

cat > .env << 'EOF'
SECRET_KEY=django-insecure-AiDoktorai-dev-key-change-in-production
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1,AiDoktorapi.fargana.uz,AiDoktor.fargana.uz,AiDoktor.ziyrak.org,AiDoktorapi.ziyrak.org,20.82.115.71,167.71.53.238

CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173,https://AiDoktor.fargana.uz,https://AiDoktorapi.fargana.uz

DB_ENGINE=django.db.backends.sqlite3
DB_NAME=/root/AiDoktorai/backend/db.sqlite3

GEMINI_API_KEY=AIzaSyCn4G1ZYDW_WZ9zCoP39EycFHkfrJAEGZA
AI_MODEL_DEFAULT=gemini-3-pro-preview

TELEGRAM_BOT_TOKEN=8345119740:AAETf0ZTo8zh2A3S5TKIkm7nWQnhO74yBAo
TELEGRAM_PAYMENT_GROUP_ID=-5041567370
EOF

echo ".env file created!"

echo ""
echo "========================================"
echo "📦 Installing dependencies..."
echo "========================================"
source venv/bin/activate
pip install -r requirements.txt --quiet
echo "Dependencies installed!"

echo ""
echo "========================================"
echo "🗄️  Running migrations..."
echo "========================================"
python manage.py migrate --noinput
echo "Migrations completed!"

echo ""
echo "========================================"
echo "🔄 Restarting Gunicorn..."
echo "========================================"
pkill -f gunicorn || true
sleep 2

cd /root/AiDoktorai/backend
source venv/bin/activate
nohup gunicorn AiDoktorai_backend.wsgi:application \
    --bind 127.0.0.1:8001 \
    --workers 3 \
    --threads 2 \
    --timeout 120 \
    --access-logfile logs/access.log \
    --error-logfile logs/error.log \
    >> logs/gunicorn.log 2>&1 &

sleep 3
echo "Gunicorn started!"

echo ""
echo "========================================"
echo "🌐 Reloading Nginx..."
echo "========================================"
sudo nginx -t
sudo systemctl reload nginx
echo "Nginx reloaded!"

echo ""
echo "========================================"
echo "🏥 Running health checks..."
echo "========================================"
sleep 3

echo "Testing local health endpoint..."
curl -s http://127.0.0.1:8001/health/ && echo " ✅ Health check passed!"

echo ""
echo "Testing root endpoint..."
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://127.0.0.1:8001/

echo ""
echo "Testing admin endpoint..."
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://127.0.0.1:8001/admin/

echo ""
echo "========================================"
echo "🎉 Deployment Completed Successfully!"
echo "========================================"
echo ""
echo "📝 Test URLs:"
echo "   - https://AiDoktorapi.fargana.uz/"
echo "   - https://AiDoktorapi.fargana.uz/admin/"
echo "   - https://AiDoktor.fargana.uz/"
echo ""
echo "📊 Monitor logs:"
echo "  tail -f /root/AiDoktorai/backend/logs/django.log"
echo "  tail -f /var/log/nginx/error.log"
echo ""

DEPLOY_SCRIPT

chmod +x /tmp/deploy_commands.sh
echo -e "${GREEN}✅ Deployment script created${NC}"
echo ""

# Step 3: Upload script to server and execute
echo -e "${YELLOW}Connecting to server ${SERVER_USER}@${SERVER_HOST}...${NC}"

# Use sshpass if available, otherwise use manual SSH
if command -v sshpass &> /dev/null; then
   echo "Using sshpass for automated deployment..."
   sshpass -p "${SERVER_PASSWORD}" scp /tmp/deploy_commands.sh ${SERVER_USER}@${SERVER_HOST}:/tmp/deploy_commands.sh
   sshpass -p "${SERVER_PASSWORD}" ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "bash/tmp/deploy_commands.sh"
else
   echo "sshpass not found. Please install it or use manual SSH:"
   echo ""
   echo "Install sshpass:"
   echo "  Windows: Not directly available, use WSL or manual SSH"
   echo "  Linux: sudo apt-get install sshpass"
   echo "  Mac: brew install hudochenkov/sshpass/sshpass"
   echo ""
   echo "Manual deployment commands:"
   echo "1. Upload script to server:"
   echo "   scp /tmp/deploy_commands.sh root@167.71.53.238:/tmp/deploy_commands.sh"
   echo ""
   echo "2. SSH to server and run:"
   echo "  ssh root@167.71.53.238"
   echo "   bash /tmp/deploy_commands.sh"
   echo ""
    
    # Ask user if they want to proceed with manual SSH
   read -p "Do you want to open SSH connection now? (y/n): "choice
    if [[ $choice == "y" || $choice == "Y" ]]; then
       echo "Opening SSH connection..."
       echo "Password: ${SERVER_PASSWORD}"
       ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} "bash /tmp/deploy_commands.sh"
   fi
fi

echo ""
echo -e "${GREEN}✅ Deployment process completed!${NC}"
-NoNewline
