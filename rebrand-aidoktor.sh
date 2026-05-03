#!/bin/bash
# AiDoktor (Farg'ona Jamoat Salomatligi Tibbiyot Instituti) - Rebranding Script
# AiDoktor -> AiDoktor

set -e

echo "🏥 AiDoktor Rebranding boshlandi..."
echo ""

# Backend
echo "📦 Backend yangilanmoqda..."
find backend-type f -name "*.py" -exec sed -i 's/AiDoktor/AiDoktor/g' {} \;
find backend -type f -name "*.py" -exec sed-i 's/AiDoktorai/aidoktor/g' {} \;
find backend-type f -name "*.md" -exec sed -i 's/AiDoktor/AiDoktor/g' {} \;
find backend -type f -name "*.md" -exec sed-i 's/Fargana/Farg'\''ona/g' {} \;
echo "✅ Backend yangilandi"

# Frontend  
echo "🎨 Frontend yangilanmoqda..."
find frontend/src -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.css" \) -exec sed-i 's/AiDoktor/AiDoktor/g' {} \;
find frontend/src -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i 's/AiDoktor/aidoktor/g' {} \;
find frontend/src -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i 's/AiDoktor/AiDoktor/g' {} \;
echo "✅ Frontend yangilandi"

# Deploy scripts
echo "🚀 Deploy scripts yangilanmoqda..."
find deploy-type f \( -name "*.sh" -o -name "*.md" -o -name "*.py" \) -exec sed -i 's/AiDoktor/AiDoktor/g' {} \;
find deploy-type f \( -name "*.sh" -o -name "*.md" -o -name "*.py" \) -exec sed -i 's/AiDoktor/aidoktor/g' {} \;
echo "✅ Deploy scripts yangilandi"

# Root docs
echo "📚 Hujjatlar yangilanmoqdi..."
find. -maxdepth 1 -type f -name "*.md" -exec sed -i 's/AiDoktor/AiDoktor/g' {} \;
find . -maxdepth 1-type f -name "*.md" -exec sed -i 's/Fargana/Farg'\''ona/g' {} \;
echo "✅ Hujjatlar yangilandi"

# .env files
echo "⚙️ Environment files yangilanmoqda..."
find . -name ".env*" -type f -exec sed -i 's/AiDoktor/AiDoktor/g' {} \;
find. -name ".env*" -type f -exec sed -i 's/AiDoktor/aidoktor/g' {} \;
echo "✅ Environment files yangilandi"

echo ""
echo "🎉 AiDoktor rebranding yakunlandi!"
echo ""
echo "Keyingi qadam:"
echo "1. git add ."
echo "2. git commit -m \"Rebrand: AiDoktor -> AiDoktor (Farg'ona Jamoat Salomatligi Tibbiyot Instituti)\""
echo "3. git push origin main"
echo "4. Serverga deploy: ssh root@167.71.53.238 va ./deploy/server-deploy.sh"
-NoNewline
