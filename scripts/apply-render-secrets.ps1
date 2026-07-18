# Apply FLOFER BRINKS secrets to a Render web service via API.
# Usage:
#   $env:RENDER_API_KEY = "rnd_..."
#   .\scripts\apply-render-secrets.ps1 -ServiceId "srv-xxxxx"
# Reads keys from backend\.env (never committed).

param(
  [Parameter(Mandatory = $true)][string]$ServiceId
)

$ErrorActionPreference = "Stop"
if (-not $env:RENDER_API_KEY) {
  throw "Set RENDER_API_KEY first (Dashboard → Account Settings → API Keys)."
}

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$envFile = Join-Path $root "backend\.env"
if (-not (Test-Path $envFile)) { throw "Missing $envFile" }

$vars = @{}
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
  $k, $v = $_.Split('=', 2)
  $vars[$k.Trim()] = $v.Trim()
}

$needed = @(
  "GOOGLE_MAPS_SERVER_KEY",
  "GOOGLE_MAPS_BROWSER_KEY",
  "ANTHROPIC_API_KEY"
)

$payload = @()
foreach ($k in $needed) {
  if (-not $vars.ContainsKey($k) -or [string]::IsNullOrWhiteSpace($vars[$k])) {
    throw "Missing $k in backend\.env"
  }
  $payload += @{ key = $k; value = $vars[$k] }
}

$payload += @{ key = "DEMO_AUTH"; value = "false" }
$payload += @{ key = "SERVE_FRONTEND"; value = "true" }
$payload += @{ key = "FRONTEND_DIST"; value = "/app/frontend/dist" }
$payload += @{ key = "CORS_ORIGINS"; value = "*" }
$payload += @{ key = "PYTHONPATH"; value = "/app" }
$payload += @{ key = "APP_PUBLIC_URL"; value = "https://flofer-brinks.onrender.com" }

$uri = "https://api.render.com/v1/services/$ServiceId/env-vars"
$headers = @{
  Authorization = "Bearer $($env:RENDER_API_KEY)"
  Accept        = "application/json"
  "Content-Type" = "application/json"
}

Invoke-RestMethod -Uri $uri -Headers $headers -Method Put -Body ($payload | ConvertTo-Json -Depth 5)
Write-Host "Updated $($payload.Count) env vars on $ServiceId"
Write-Host "Trigger a manual deploy in Render if auto-deploy does not run."
