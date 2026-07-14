#Requires -Version 5.1
param(
  [string] $ApiUrl = "http://localhost:3000",
  [string] $SyncKey = "",
  [string] $EnvServer = ""
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path
$EnvPath = if ($EnvServer) { $EnvServer } else { Join-Path $RepoRoot "infra\docker\.env.server" }

function Test-Step {
  param([string] $Name, [scriptblock] $Action)
  Write-Host "  $Name..." -NoNewline
  try {
    & $Action
    Write-Host " OK" -ForegroundColor Green
    return $true
  } catch {
    Write-Host " FAIL: $($_.Exception.Message)" -ForegroundColor Red
    return $false
  }
}

$passed = 0
$failed = 0

Write-Host ""
Write-Host "==> Smoke E2E - $ApiUrl" -ForegroundColor Cyan

if (Test-Step "GET /auth/setup-status" {
    $r = Invoke-RestMethod -Uri "$ApiUrl/auth/setup-status" -TimeoutSec 10
    if ($null -eq $r.needsFirstUser) { throw "invalid response" }
  }) { $passed++ } else { $failed++ }

if (-not $SyncKey -and (Test-Path $EnvPath)) {
  $line = Get-Content $EnvPath | Where-Object { $_ -match "^\s*SYNC_API_KEY=" } | Select-Object -First 1
  if ($line) { $SyncKey = ($line -split "=", 2)[1].Trim().Trim('"') }
}

if ($SyncKey) {
  if (Test-Step "GET /sync/entities" {
      $h = @{ "X-Sync-Key" = $SyncKey }
      $r = Invoke-RestMethod -Uri "$ApiUrl/sync/entities" -Headers $h -TimeoutSec 10
      if (-not $r.entities) { throw "empty entities" }
    }) { $passed++ } else { $failed++ }
} else {
  Write-Host "  GET /sync/entities... SKIP" -ForegroundColor Yellow
}

$desktopDir = Join-Path $RepoRoot "apps\desktop"
if (Test-Path $desktopDir) {
  if (Test-Step "desktop npm run build" {
      Push-Location $desktopDir
      try { npm run build 2>&1 | Out-Null } finally { Pop-Location }
    }) { $passed++ } else { $failed++ }
}

$color = "Green"
if ($failed -gt 0) { $color = "Red" }
Write-Host ""
Write-Host "Result: $passed OK, $failed failed" -ForegroundColor $color
if ($failed -gt 0) { exit 1 }
