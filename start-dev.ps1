# Start RouteMaster locally (Windows): DB optional if Postgres already running,
# then API :8000 + UI :5180
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host "== RouteMaster local start ==" -ForegroundColor Cyan

# DB (docker) if available
if (Get-Command docker -ErrorAction SilentlyContinue) {
  Write-Host "Starting Postgres via docker compose..." -ForegroundColor DarkCyan
  docker compose up -d db
} else {
  Write-Host "Docker not found — assuming local Postgres on :5432" -ForegroundColor Yellow
}

# Backend
$py = Join-Path $root "backend\.venv\Scripts\python.exe"
if (-not (Test-Path $py)) {
  Write-Host "Creating venv + installing backend deps..." -ForegroundColor DarkCyan
  Set-Location (Join-Path $root "backend")
  python -m venv .venv
  .\.venv\Scripts\pip.exe install -r requirements.txt
  Set-Location $root
}

Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$root\backend'; .\.venv\Scripts\python.exe -m alembic upgrade head; .\.venv\Scripts\python.exe -m src.seed; .\.venv\Scripts\python.exe -m uvicorn src.main:app --reload --host 127.0.0.1 --port 8000"
)

# Frontend
Set-Location (Join-Path $root "frontend")
if (-not (Test-Path "node_modules")) {
  npm install
}
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$root\frontend'; npm run dev"
)

Write-Host ""
Write-Host "API:  http://127.0.0.1:8000/api/health" -ForegroundColor Green
Write-Host "App:  http://127.0.0.1:5180/app/plan" -ForegroundColor Green
Write-Host "Login seed: leader / Brinks2026!  (or Bearer demo)" -ForegroundColor Green
