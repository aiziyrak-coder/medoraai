# Kill process on port 3000, then start Vite frontend
$ErrorActionPreference = 'SilentlyContinue'
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
Start-Sleep -Seconds 1
Set-Location $PSScriptRoot\frontend
Write-Host "Frontend starting on http://localhost:3000"
npm run dev
