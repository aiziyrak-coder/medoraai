# 🧪 Lokal Test Script - Deploy Oldidan
# PowerShell script - barcha testlarni avtomatik bajaradi

$ErrorActionPreference = "Continue"

Write-Host "`n🧪 MEDORA AI - Lokal Test Boshlanmoqda...`n" -ForegroundColor Cyan

$root = $PSScriptRoot
$allTestsPassed = $true

# 1. Backend Health Check
Write-Host "1️⃣ Backend Health Check..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:8000/health/" -Method Get -ErrorAction Stop
    if ($health.status -eq "healthy") {
        Write-Host "   ✅ Backend healthy" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Backend unhealthy: $($health.status)" -ForegroundColor Red
        $allTestsPassed = $false
    }
} catch {
    Write-Host "   ❌ Backend ishlamayapti yoki port 8000 ochiq emas" -ForegroundColor Red
    Write-Host "   💡 Backend'ni ishga tushiring: cd backend && python manage.py runserver 8000" -ForegroundColor Yellow
    $allTestsPassed = $false
}

# 2. Backend Detailed Health Check
Write-Host "`n2️⃣ Backend Detailed Health Check..." -ForegroundColor Yellow
try {
    $detailed = Invoke-RestMethod -Uri "http://localhost:8000/health/detailed/" -Method Get -ErrorAction Stop
    if ($detailed.status -eq "healthy") {
        Write-Host "   ✅ Database: $($detailed.checks.database)" -ForegroundColor Green
        Write-Host "   ✅ Cache: $($detailed.checks.cache)" -ForegroundColor Green
        Write-Host "   ✅ Debug: $($detailed.checks.debug)" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Detailed check failed" -ForegroundColor Red
        $allTestsPassed = $false
    }
} catch {
    Write-Host "   ⚠️  Detailed check mavjud emas (xatolik emas)" -ForegroundColor Yellow
}

# 3. Frontend Build Test
Write-Host "`n3️⃣ Frontend Build Test..." -ForegroundColor Yellow
$frontendPath = Join-Path $root "frontend"
if (Test-Path $frontendPath) {
    Push-Location $frontendPath
    try {
        Write-Host "   📦 npm run build..." -ForegroundColor Gray
        $buildOutput = npm run build 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "   ✅ Frontend build muvaffaqiyatli" -ForegroundColor Green
            $distPath = Join-Path $root "dist"
            if (Test-Path $distPath) {
                $distSize = (Get-ChildItem $distPath -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB
                Write-Host "   📊 Build size: $([math]::Round($distSize, 2)) MB" -ForegroundColor Gray
            }
        } else {
            Write-Host "   ❌ Frontend build xatolik" -ForegroundColor Red
            Write-Host $buildOutput -ForegroundColor Red
            $allTestsPassed = $false
        }
    } catch {
        Write-Host "   ❌ Frontend build xatolik: $_" -ForegroundColor Red
        $allTestsPassed = $false
    } finally {
        Pop-Location
    }
} else {
    Write-Host "   ⚠️  Frontend papkasi topilmadi" -ForegroundColor Yellow
}

# 4. Environment Variables Check
Write-Host "`n4️⃣ Environment Variables Check..." -ForegroundColor Yellow
$backendEnv = Join-Path $root "backend\.env"
$frontendEnv = Join-Path $root "frontend\.env.local"

if (Test-Path $backendEnv) {
    Write-Host "   ✅ Backend .env mavjud" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Backend .env mavjud emas (backend\.env.example dan nusxa oling)" -ForegroundColor Yellow
}

if (Test-Path $frontendEnv) {
    Write-Host "   ✅ Frontend .env.local mavjud" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Frontend .env.local mavjud emas (frontend\.env.example dan nusxa oling)" -ForegroundColor Yellow
}

# 5. Database Migrations Check
Write-Host "`n5️⃣ Database Migrations Check..." -ForegroundColor Yellow
$backendPath = Join-Path $root "backend"
if (Test-Path $backendPath) {
    Push-Location $backendPath
    try {
        $migrations = python manage.py showmigrations 2>&1
        if ($LASTEXITCODE -eq 0) {
            $unapplied = $migrations | Select-String "\[ \]"
            if ($unapplied) {
                Write-Host "   ⚠️  Qo'llanmagan migrations mavjud" -ForegroundColor Yellow
                Write-Host "   💡 Quyidagi buyruqni bajaring: python manage.py migrate" -ForegroundColor Gray
            } else {
                Write-Host "   ✅ Barcha migrations qo'llangan" -ForegroundColor Green
            }
        } else {
            Write-Host "   ⚠️  Migrations tekshirib bo'lmadi" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "   ⚠️  Migrations tekshirib bo'lmadi: $_" -ForegroundColor Yellow
    } finally {
        Pop-Location
    }
}

# 6. Static Files Check
Write-Host "`n6️⃣ Static Files Check..." -ForegroundColor Yellow
$staticPath = Join-Path $root "backend\staticfiles"
if (Test-Path $staticPath) {
    Write-Host "   ✅ Static files papkasi mavjud" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Static files yig'ilmagan" -ForegroundColor Yellow
    Write-Host "   💡 Quyidagi buyruqni bajaring: cd backend && python manage.py collectstatic --noinput" -ForegroundColor Gray
}

# 7. Port Check
Write-Host "`n7️⃣ Port Check..." -ForegroundColor Yellow
$port8000 = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
$port3000 = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue

if ($port8000) {
    Write-Host "   ✅ Port 8000 (Backend) ishlatilmoqda" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Port 8000 (Backend) ochiq emas" -ForegroundColor Yellow
}

if ($port3000) {
    Write-Host "   ✅ Port 3000 (Frontend) ishlatilmoqda" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Port 3000 (Frontend) ochiq emas" -ForegroundColor Yellow
}

# Summary
Write-Host "`n" + ("="*60) -ForegroundColor Cyan
if ($allTestsPassed) {
    Write-Host "✅ Barcha asosiy testlar muvaffaqiyatli!" -ForegroundColor Green
    Write-Host "`n📋 Keyingi qadamlar:" -ForegroundColor Yellow
    Write-Host "   1. Browser'da http://localhost:3000 ochib manual test qiling" -ForegroundColor Gray
    Write-Host "   2. DEPLOYMENT_CHECKLIST.md ni ko'ring" -ForegroundColor Gray
    Write-Host "   3. Production environment'ga deploy qiling" -ForegroundColor Gray
} else {
    Write-Host "❌ Ba'zi testlar muvaffaqiyatsiz!" -ForegroundColor Red
    Write-Host "`n💡 Xatoliklarni tuzatib, qayta test qiling" -ForegroundColor Yellow
}
Write-Host ("="*60) + "`n" -ForegroundColor Cyan

if ($allTestsPassed) {
    exit 0
} else {
    exit 1
}
