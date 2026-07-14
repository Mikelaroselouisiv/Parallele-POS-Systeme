#Requires -Version 5.1
<#
.SYNOPSIS
  Démarre la stack Server (Postgres + API) via Docker Compose.
  Utilisé par la tâche planifiée Windows et après bootstrap-server.ps1.
#>
param(
  [string] $MonorepoRoot = ''
)

$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = if ($MonorepoRoot) {
  (Resolve-Path -LiteralPath $MonorepoRoot).Path
} else {
  (Resolve-Path -LiteralPath (Join-Path $ScriptDir '..\..')).Path
}

$DockerDir = Join-Path $RepoRoot 'infra\docker'
$ComposeFile = Join-Path $DockerDir 'docker-compose.server.yml'
$EnvFile = Join-Path $DockerDir '.env.server'

function Wait-DockerReady {
  param([int] $MaxSeconds = 180)
  $deadline = (Get-Date).AddSeconds($MaxSeconds)
  while ((Get-Date) -lt $deadline) {
    & docker info 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { return $true }
    Start-Sleep -Seconds 3
  }
  return $false
}

if (-not (Test-Path -LiteralPath $EnvFile)) {
  Write-Error "Fichier manquant: $EnvFile — exécutez infra/scripts/bootstrap-server.ps1 d'abord."
}

if (-not (Wait-DockerReady)) {
  Write-Error 'Docker indisponible (délai dépassé). Vérifiez que Docker Desktop est démarré.'
}

Push-Location $DockerDir
try {
  & docker compose -f $ComposeFile --env-file $EnvFile up -d --build
  if ($LASTEXITCODE -ne 0) {
    throw "docker compose up a échoué (code $LASTEXITCODE)."
  }
  Write-Host 'Stack Server démarrée (Postgres :5432, API :3000).'
} finally {
  Pop-Location
}
