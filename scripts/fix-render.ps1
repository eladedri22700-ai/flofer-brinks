# Fix FLOFER BRINKS on Render when free Postgres expired / web service hung.
# Usage:
#   $env:RENDER_API_KEY = "rnd_..."   # Dashboard → Account Settings → API Keys
#   .\scripts\fix-render.ps1
#
# Optional:
#   .\scripts\fix-render.ps1 -ServiceId "srv-..." -OwnerId "tea-..."

param(
  [string]$ServiceId = "",
  [string]$OwnerId = "",
  [string]$DbName = "flofer-brinks-db-v2"
)

$ErrorActionPreference = "Stop"
if (-not $env:RENDER_API_KEY) {
  Start-Process "https://dashboard.render.com/u/settings#api-keys"
  throw "Set `$env:RENDER_API_KEY first (page opened). Create a key, paste it, re-run."
}

$headers = @{
  Authorization = "Bearer $($env:RENDER_API_KEY)"
  Accept        = "application/json"
  "Content-Type" = "application/json"
}

function Invoke-Render([string]$Method, [string]$Path, $Body = $null) {
  $uri = "https://api.render.com/v1$Path"
  if ($null -eq $Body) {
    return Invoke-RestMethod -Uri $uri -Headers $headers -Method $Method
  }
  $json = if ($Body -is [string]) { $Body } else { $Body | ConvertTo-Json -Depth 8 -Compress }
  return Invoke-RestMethod -Uri $uri -Headers $headers -Method $Method -Body $json
}

Write-Host "== Render workspaces ==" -ForegroundColor Cyan
$workspaces = Invoke-Render GET "/owners?limit=20"
$owners = @($workspaces | ForEach-Object { $_.owner })
if (-not $OwnerId) {
  $OwnerId = $owners[0].id
}
Write-Host "Using owner: $OwnerId ($($owners[0].name))"

Write-Host "== Services ==" -ForegroundColor Cyan
$services = @(Invoke-Render GET "/services?limit=50&ownerId=$OwnerId")
$web = $null
foreach ($row in $services) {
  $s = $row.service
  if (-not $s) { $s = $row }
  Write-Host ("  {0}  {1}  {2}" -f $s.id, $s.name, $s.type)
  if ($ServiceId -and $s.id -eq $ServiceId) { $web = $s }
  elseif (-not $ServiceId -and $s.name -eq "flofer-brinks" -and $s.type -eq "web_service") { $web = $s }
}
if (-not $web) { throw "Web service flofer-brinks not found. Pass -ServiceId." }
$ServiceId = $web.id
Write-Host "Web service: $ServiceId" -ForegroundColor Green

Write-Host "== Postgres ==" -ForegroundColor Cyan
$pgRows = @(Invoke-Render GET "/postgres?limit=50&ownerId=$OwnerId")
$targetDb = $null
foreach ($row in $pgRows) {
  $db = if ($row.postgres) { $row.postgres } else { $row }
  $status = $db.status
  Write-Host ("  {0}  {1}  status={2}  plan={3}" -f $db.id, $db.name, $status, $db.plan)
  if ($db.name -eq $DbName) { $targetDb = $db }
  # Expired free DBs block a healthy start — delete if expired/unavailable.
  if ($status -match "expired|unavailable|suspended" -or $db.expiresAt) {
    $exp = $db.expiresAt
    if ($exp) {
      try {
        $expDt = [DateTime]::Parse($exp).ToUniversalTime()
        if ($expDt -lt [DateTime]::UtcNow -and $db.name -ne $DbName) {
          Write-Host "  Deleting expired DB $($db.name) ($($db.id))..." -ForegroundColor Yellow
          try { Invoke-Render DELETE "/postgres/$($db.id)" | Out-Null } catch {
            Write-Host "  Delete failed (may need dashboard): $($_.Exception.Message)" -ForegroundColor DarkYellow
          }
        }
      } catch { }
    }
  }
}

if (-not $targetDb -or ($targetDb.status -match "expired|unavailable|suspended")) {
  Write-Host "Creating free Postgres '$DbName'..." -ForegroundColor Cyan
  $createBody = @{
    name           = $DbName
    ownerId        = $OwnerId
    plan           = "free"
    region         = "frankfurt"
    databaseName   = "flofer_brinks"
    databaseUser   = "flofer"
    version        = "16"
  }
  $created = Invoke-Render POST "/postgres" $createBody
  $targetDb = if ($created.postgres) { $created.postgres } else { $created }
  Write-Host "Created DB $($targetDb.id)" -ForegroundColor Green
  Start-Sleep -Seconds 8
}

Write-Host "Fetching connection info..." -ForegroundColor Cyan
$conn = Invoke-Render GET "/postgres/$($targetDb.id)/connection-info"
$internal = $conn.internalConnectionString
if (-not $internal) { $internal = $conn.connectionString }
if (-not $internal) { throw "No connection string from Render for $($targetDb.id)" }

Write-Host "Updating DATABASE_URL on web service..." -ForegroundColor Cyan
# Merge existing env vars so we don't wipe keys.
$existing = @(Invoke-Render GET "/services/$ServiceId/env-vars")
$payload = @()
$seenDb = $false
foreach ($row in $existing) {
  $ev = if ($row.envVar) { $row.envVar } else { $row }
  if ($ev.key -eq "DATABASE_URL") {
    $payload += @{ key = "DATABASE_URL"; value = $internal }
    $seenDb = $true
  } else {
    $item = @{ key = $ev.key }
    if ($ev.value) { $item.value = $ev.value }
    elseif ($ev.generateValue) { $item.generateValue = $true }
    else { $item.value = "" }
    $payload += $item
  }
}
if (-not $seenDb) {
  $payload += @{ key = "DATABASE_URL"; value = $internal }
}

Invoke-Render PUT "/services/$ServiceId/env-vars" $payload | Out-Null
Write-Host "DATABASE_URL updated." -ForegroundColor Green

Write-Host "Triggering deploy..." -ForegroundColor Cyan
$deploy = Invoke-Render POST "/services/$ServiceId/deploys" @{ clearCache = "clear" }
$deployId = if ($deploy.deploy) { $deploy.deploy.id } else { $deploy.id }
Write-Host "Deploy started: $deployId" -ForegroundColor Green
Write-Host "Watch: https://dashboard.render.com/web/$ServiceId"
Write-Host "When live: https://flofer-brinks.onrender.com/?user=FLOFER&fresh=1"
