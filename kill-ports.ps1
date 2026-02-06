# Kill processes on ports 8000 and 3000 (run before restart after changes)
$ErrorActionPreference = 'SilentlyContinue'
Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
Write-Host "Ports 8000 and 3000 cleared. You can run run-all.ps1 again."
