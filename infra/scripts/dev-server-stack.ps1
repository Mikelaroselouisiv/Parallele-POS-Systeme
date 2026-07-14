#Requires -Version 5.1
<#
.SYNOPSIS
  Stack Server sur PC de dev (sans installer Docker Desktop via winget).

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File infra/scripts/dev-server-stack.ps1
#>
param(
  [string] $MonorepoRoot = '',
  [switch] $SkipSyncAgent
)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = if ($MonorepoRoot) {
  (Resolve-Path -LiteralPath $MonorepoRoot).Path
} else {
  (Resolve-Path -LiteralPath (Join-Path $ScriptDir '..\..')).Path
}

$DockerDir = Join-Path $RepoRoot 'infra\docker'
$EnvExample = Join-Path $DockerDir '.env.server.example'
$EnvFile = Join-Path $DockerDir '.env.server'
$ComposeFile = Join-Path $DockerDir 'docker-compose.server.yml'

if (-not (Test-Path $EnvFile)) {
  Copy-Item $EnvExample $EnvFile
  Write-Host 'Créé .env.server — éditez POSTGRES_PASSWORD / SYNC_API_KEY si besoin.'
}

& docker info 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw 'Docker requis. Démarrez Docker Desktop puis relancez.'
}

Push-Location $DockerDir
try {
  $services = if ($SkipSyncAgent) { @('postgres', 'backend') } else { @() }
  if ($services.Count -gt 0) {
    docker compose -f $ComposeFile --env-file $EnvFile up -d --build $services
  } else {
    docker compose -f $ComposeFile --env-file $EnvFile up -d --build
  }
  docker compose -f $ComposeFile ps
} finally {
  Pop-Location
}

Write-Host 'API : http://localhost:3000'
Write-Host 'Desktop Server : cd apps/desktop && npm run dist:win:server'
