# Serverda to'liq deploy (SSH). Loyihada deploy/deploy_key bo'lsa, avtomatik ishlatiladi (gitignore).
#
# Ixtiyoriy muhit:
#   $env:DEPLOY_HOST = "medora.cdcgroup.uz"   # default shu
#   $env:DEPLOY_USER = "root"
#   $env:DEPLOY_SSH_KEY = "C:\path\to\private_key"
#   $env:DEPLOY_APP = "/root/medoraai"
#
# Ishlatish:  cd repo   .\deploy\remote-deploy.ps1

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$DefaultKey = Join-Path $RepoRoot "deploy\deploy_key"

if (-not $env:DEPLOY_SSH_KEY -and (Test-Path $DefaultKey)) {
    $env:DEPLOY_SSH_KEY = $DefaultKey
    Write-Host "SSH kalit: deploy\deploy_key" -ForegroundColor DarkGray
}
if (-not $env:DEPLOY_HOST) {
    $env:DEPLOY_HOST = "medora.cdcgroup.uz"
}
$user = if ($env:DEPLOY_USER) { $env:DEPLOY_USER } else { "root" }
$app = if ($env:DEPLOY_APP) { $env:DEPLOY_APP } else { "/root/medoraai" }
$target = "${user}@$($env:DEPLOY_HOST)"

if (-not $env:DEPLOY_SSH_KEY -or -not (Test-Path $env:DEPLOY_SSH_KEY)) {
    Write-Host "SSH private kalit topilmadi. deploy\deploy_key qo'ying yoki:" -ForegroundColor Yellow
    Write-Host '  $env:DEPLOY_SSH_KEY="C:\path\to\key"; $env:DEPLOY_HOST="server"; .\deploy\remote-deploy.ps1' -ForegroundColor Gray
    exit 1
}

$sshArgs = @("-i", $env:DEPLOY_SSH_KEY, "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new")
$remoteCmd = "cd $app && git fetch origin main && git reset --hard origin/main && sudo bash deploy/server-deploy.sh"
Write-Host "SSH $target -> $app" -ForegroundColor Cyan
& ssh @sshArgs $target $remoteCmd
