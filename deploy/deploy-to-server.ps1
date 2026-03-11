#!/usr/bin/env pwsh

# Server deployment script for MedoraAI
$serverUser = "root"
$serverHost = "medora.cdcgroup.uz"
$serverPassword = "Ziyrak2025Ai"
$remoteDir = "/root/medoraai"

Write-Host "=== MedoraAI Server Deployment ===" -ForegroundColor Cyan
Write-Host "Server: $serverUser@$serverHost" -ForegroundColor Yellow
Write-Host ""

# Step 1: Pull latest changes from GitHub
Write-Host "[1/4] Pulling latest changes from GitHub..." -ForegroundColor Green
$pullCmd = "cd $remoteDir && git pull origin main"
Write-Host "Command: $pullCmd" -ForegroundColor Gray

# Step 2: Install dependencies (if needed)
Write-Host ""
Write-Host "[2/4] Checking Python dependencies..." -ForegroundColor Green
$depsCmd = "cd $remoteDir/backend && pip install -r requirements.txt --quiet"

# Step 3: Restart backend service
Write-Host ""
Write-Host "[3/4] Restarting backend service..." -ForegroundColor Green
$restartCmd = "sudo systemctl restart medoraai-backend-8001.service"

# Step 4: Check service status
Write-Host ""
Write-Host "[4/4] Checking service status..." -ForegroundColor Green
$statusCmd = "sudo systemctl status medoraai-backend-8001.service --no-pager -l"

# Create SSH command with password
$sshCmds = @(
    $pullCmd,
    "echo 'Pull completed'",
    $depsCmd,
    "echo 'Dependencies checked'",
    $restartCmd,
    "echo 'Service restarted'",
    $statusCmd
) -join " && "

Write-Host ""
Write-Host "Executing remote commands..." -ForegroundColor Cyan
Write-Host ""

# Use ssh with password authentication
$env:SSHPASS = $serverPassword
$sshCommand = "sshpass -e ssh -o StrictHostKeyChecking=no $serverUser@$serverHost `"$sshCmds`""

try {
    $output = Invoke-Expression $sshCommand
    Write-Host $output
    Write-Host ""
    Write-Host "✅ Deployment completed successfully!" -ForegroundColor Green
} catch {
    Write-Host "❌ Error during deployment: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Trying alternative method..." -ForegroundColor Yellow
    
    # Alternative: Just show manual instructions
    Write-Host ""
    Write-Host "=== MANUAL DEPLOYMENT INSTRUCTIONS ===" -ForegroundColor Yellow
    Write-Host "1. Connect to server:" -ForegroundColor White
    Write-Host "   ssh root@medora.cdcgroup.uz" -ForegroundColor Cyan
    Write-Host "   Password: Ziyrak2025Ai" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "2. Pull changes:" -ForegroundColor White
    Write-Host "   cd /root/medoraai" -ForegroundColor Cyan
    Write-Host "   git pull origin main" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "3. Restart service:" -ForegroundColor White
    Write-Host "   sudo systemctl restart medoraai-backend-8001.service" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "4. Check logs:" -ForegroundColor White
    Write-Host "   sudo journalctl -u medoraai-backend-8001.service -f --no-pager" -ForegroundColor Cyan
} finally {
    Remove-Item Env:SSHPASS -ErrorAction SilentlyContinue
}
