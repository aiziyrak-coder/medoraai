# MedoraAI server deploy via SSH (167.71.53.238)
# Birinchi marta: kalit yaratiladi, siz serverda public key ni qo'shasiz. Keyin skriptni qayta ishga tushiring.
$ErrorActionPreference = "Stop"
$Server = "167.71.53.238"
$User = "root"
$KeyPath = Join-Path $PSScriptRoot "deploy_key"
$KeyPathPub = "$KeyPath.pub"

# 1) SSH kalit yo'q bo'lsa yaratish
if (-not (Test-Path $KeyPath)) {
    Write-Host "SSH kalit yaratilmoqda (bir marta)..." -ForegroundColor Yellow
    ssh-keygen -t ed25519 -f $KeyPath -N '""' -q
    $pub = Get-Content $KeyPathPub -Raw
    Write-Host ""
    Write-Host "=== Serverda quyidagilarni bajaring (parol: Ziyrak2025Ai) ===" -ForegroundColor Cyan
    Write-Host "  ssh root@$Server"
    Write-Host "  (parolni kiriting)"
    Write-Host "  mkdir -p ~/.ssh"
    Write-Host "  echo '$($pub.Trim())' >> ~/.ssh/authorized_keys"
    Write-Host "  chmod 700 ~/.ssh; chmod 600 ~/.ssh/authorized_keys"
    Write-Host "  exit"
    Write-Host ""
    Write-Host "Keyin bu skriptni qayta ishga tushiring: .\deploy\deploy-ssh.ps1" -ForegroundColor Green
    exit 0
}

# 2) Serverda deploy buyruqlarini bajarish
$RemoteCmd = "cd /root/medoraai && git pull origin main && sudo bash deploy/server-deploy.sh"
Write-Host "Serverga ulanmoqda ($User@$Server)..." -ForegroundColor Yellow
& ssh -i $KeyPath -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=15 "${User}@${Server}" $RemoteCmd
if ($LASTEXITCODE -ne 0) {
    Write-Host "Xato: SSH yoki serverdagi buyruq muvaffaqiyatsiz. Kalitni serverga qo'shganingizni tekshiring." -ForegroundColor Red
    exit $LASTEXITCODE
}
Write-Host "Deploy tugadi. http://${Server}" -ForegroundColor Green
