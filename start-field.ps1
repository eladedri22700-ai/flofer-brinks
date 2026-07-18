# FLOFER BRINKS — field HTTPS deploy (PWA + Cloudflare Tunnel)
# Phone URL: https://*.trycloudflare.com  (GPS + installable PWA)
#
#   .\start-field.ps1
#   .\start-field.ps1 -Detach
param(
  [switch]$Detach
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$toolsDir = Join-Path $root "tools"
$cloudflared = Join-Path $toolsDir "cloudflared.exe"
$py = Join-Path $root "backend\.venv\Scripts\python.exe"
# Prefer 8080 so a leftover :8000 uvicorn does not block field mode
$fieldPort = 8080
$logDir = Join-Path $root "tools\logs"
$apiLog = Join-Path $logDir "field-api.log"
$tunnelLog = Join-Path $logDir "field-tunnel.log"
$tunnelOut = Join-Path $logDir "field-tunnel-out.log"

New-Item -ItemType Directory -Force -Path $toolsDir, $logDir | Out-Null

Write-Host "== FLOFER BRINKS field HTTPS ==" -ForegroundColor Cyan

if (-not (Test-Path $py)) {
  Write-Host "Creating venv + installing backend deps..." -ForegroundColor DarkCyan
  Set-Location (Join-Path $root "backend")
  python -m venv .venv
  .\.venv\Scripts\pip.exe install -r requirements.txt
  Set-Location $root
}

if (-not (Test-Path $cloudflared)) {
  Write-Host "Downloading cloudflared..." -ForegroundColor DarkCyan
  $url = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
  try {
    Invoke-WebRequest -Uri $url -OutFile $cloudflared -UseBasicParsing
  } catch {
    Write-Host "Direct download failed; trying winget..." -ForegroundColor Yellow
    winget install --id Cloudflare.cloudflared -e --accept-package-agreements --accept-source-agreements
    $found = Get-Command cloudflared -ErrorAction SilentlyContinue
    if ($found) {
      $cloudflared = $found.Source
    } else {
      throw "cloudflared install failed. Install manually and re-run."
    }
  }
}

Write-Host "Building PWA (same-origin /api)..." -ForegroundColor DarkCyan
Set-Location (Join-Path $root "frontend")
if (-not (Test-Path "node_modules")) { npm install }
$env:VITE_API_BASE_URL = ""
npm run build
Set-Location $root

$listeners = Get-NetTCPConnection -LocalPort $fieldPort -State Listen -ErrorAction SilentlyContinue
foreach ($l in $listeners) {
  $pidToKill = $l.OwningProcess
  try {
    taskkill /F /PID $pidToKill 2>$null | Out-Null
    Write-Host "Freed port $fieldPort (pid $pidToKill)" -ForegroundColor DarkYellow
  } catch { }
}
Start-Sleep -Seconds 1

Write-Host "Starting API + UI on :$fieldPort ..." -ForegroundColor DarkCyan
$backendDir = Join-Path $root "backend"

# Migrate + seed in-process (Hebrew paths break Start-Process -File)
$env:SERVE_FRONTEND = "true"
$env:DEMO_AUTH = "true"
$env:CORS_ORIGINS = "http://127.0.0.1:$fieldPort,http://localhost:$fieldPort"
Push-Location $backendDir
try {
  & $py -m alembic upgrade head
  & $py -m src.seed
  & $py -c "from src.core.config import reload_settings; s=reload_settings(); assert s.serve_frontend; print('SERVE_FRONTEND ok')"
} finally {
  Pop-Location
}

# Child inherits SERVE_FRONTEND; avoid -File scripts under Hebrew paths
$apiProc = Start-Process -FilePath $py -WorkingDirectory $backendDir -PassThru -WindowStyle Minimized `
  -RedirectStandardOutput $apiLog `
  -RedirectStandardError (Join-Path $logDir "field-api-err.log") `
  -ArgumentList @(
    "-m", "uvicorn", "src.main:app",
    "--host", "127.0.0.1",
    "--port", "$fieldPort",
    "--log-level", "info"
  )

$healthy = $false
for ($i = 0; $i -lt 45; $i++) {
  Start-Sleep -Seconds 1
  try {
    $null = Invoke-RestMethod "http://127.0.0.1:$fieldPort/api/health" -TimeoutSec 2
    $healthy = $true
    break
  } catch { }
}
if (-not $healthy) {
  Write-Host "API failed to start. See: $apiLog" -ForegroundColor Red
  if (Test-Path $apiLog) { Get-Content $apiLog -Tail 40 }
  exit 1
}

Write-Host "Opening Cloudflare HTTPS tunnel..." -ForegroundColor DarkCyan
if (Test-Path $tunnelLog) { Remove-Item $tunnelLog -Force -ErrorAction SilentlyContinue }
if (Test-Path $tunnelOut) { Remove-Item $tunnelOut -Force -ErrorAction SilentlyContinue }
$tunnelProc = Start-Process -FilePath $cloudflared -PassThru -WindowStyle Minimized -ArgumentList @(
  "tunnel", "--url", "http://127.0.0.1:$fieldPort", "--no-autoupdate"
) -RedirectStandardError $tunnelLog -RedirectStandardOutput $tunnelOut

$publicUrl = $null
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Seconds 1
  $txt = ""
  if (Test-Path $tunnelLog) { $txt += (Get-Content $tunnelLog -Raw -ErrorAction SilentlyContinue) }
  if (Test-Path $tunnelOut) { $txt += (Get-Content $tunnelOut -Raw -ErrorAction SilentlyContinue) }
  if ($txt -match "https://[a-z0-9-]+\.trycloudflare\.com") {
    $publicUrl = $Matches[0]
    break
  }
}

if (-not $publicUrl) {
  Write-Host "Tunnel URL not received. Log:" -ForegroundColor Red
  if (Test-Path $tunnelLog) { Get-Content $tunnelLog -Tail 50 }
  if (Test-Path $tunnelOut) { Get-Content $tunnelOut -Tail 50 }
  Write-Host "Local API still up: http://127.0.0.1:$fieldPort/app/dashboard" -ForegroundColor Yellow
  exit 1
}

$fieldEnv = Join-Path $toolsDir "field-url.txt"
Set-Content -Path $fieldEnv -Value $publicUrl -Encoding UTF8

$phoneUrl = "$publicUrl/app/dashboard"
Write-Host ""
Write-Host "====================================================" -ForegroundColor Green
Write-Host "  HTTPS field URL ready" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Open on phone:" -ForegroundColor White
Write-Host "  $phoneUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "Login: leader / Brinks2026!" -ForegroundColor White
Write-Host "Then: Add to Home Screen (PWA)." -ForegroundColor White
Write-Host ""
Write-Host "Google Maps Browser Key referrers (GCP):" -ForegroundColor Yellow
Write-Host "  https://*.trycloudflare.com/*" -ForegroundColor Yellow
Write-Host ""
Write-Host "Saved URL: $fieldEnv" -ForegroundColor DarkGray
Write-Host "Logs: $logDir" -ForegroundColor DarkGray
Write-Host "Stop: Stop-Process -Id $($apiProc.Id),$($tunnelProc.Id)" -ForegroundColor DarkGray
Write-Host ""

if ($Detach) {
  Write-Host "Detach mode: API + tunnel keep running in background." -ForegroundColor DarkCyan
  exit 0
}

Write-Host "Leave this window open as a reminder." -ForegroundColor DarkGray
try {
  while (-not $apiProc.HasExited -and -not $tunnelProc.HasExited) {
    Start-Sleep -Seconds 5
  }
} finally {
  Write-Host "Field processes ended." -ForegroundColor DarkYellow
}
