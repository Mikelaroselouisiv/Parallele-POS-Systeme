#Requires -Version 5.1
<#
  Prépare server-stack/ avant dist:win:server :
  - exporte images Docker backend + sync-agent (machine vierge = pas de pull GCP)
  - injecte SYNC_API_KEY depuis infra/docker/.env.server si présent
#>
$ErrorActionPreference = 'Stop'

$DesktopRoot = Split-Path $PSScriptRoot -Parent
$RepoRoot = Split-Path (Split-Path $DesktopRoot -Parent) -Parent
$StackDir = Join-Path $DesktopRoot 'server-stack'
$ImagesDir = Join-Path $StackDir 'images'
$DefaultsFile = Join-Path $StackDir 'defaults.env'
$EnvServer = Join-Path $RepoRoot 'infra\docker\.env.server'

$BackendImage = 'northamerica-northeast1-docker.pkg.dev/pos-freres-basiles/pos-backend/backend:latest'
$BackendBundle = 'pos-freres-basiles/backend:bundle'
$SyncAgentBundle = 'pos-freres-basiles/sync-agent:bundle'
$SyncAgentContext = Join-Path $RepoRoot 'apps\sync-agent'

New-Item -ItemType Directory -Path $ImagesDir -Force | Out-Null

# Injecter SYNC_API_KEY connue (alignée GCP) dans defaults.env pour la machine mère
$defaults = @(
  'REMOTE_API_URL=http://34.118.154.220',
  'SYNC_INTERVAL_MS=45000',
  'GCS_ASSETS_URI=gs://pos-freres-basiles-assets/sync-assets'
)
if (Test-Path -LiteralPath $EnvServer) {
  $syncLine = Get-Content $EnvServer | Where-Object { $_ -match '^\s*SYNC_API_KEY=' } | Select-Object -First 1
  if ($syncLine) { $defaults += $syncLine.Trim() }
}
Set-Content -LiteralPath $DefaultsFile -Value ($defaults -join "`n") -Encoding UTF8
Write-Host "defaults.env mis à jour"

docker info 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Warning 'Docker indisponible — images .tar non exportées. Le build Server nécessite Docker sur la machine de build.'
  exit 0
}

Write-Host "Pull backend $BackendImage ..."
docker pull $BackendImage
if ($LASTEXITCODE -ne 0) { throw 'docker pull backend a échoué' }
docker tag $BackendImage $BackendBundle
docker save -o (Join-Path $ImagesDir 'backend.tar') $BackendBundle
Write-Host 'backend.tar exporté'

Write-Host 'Build sync-agent...'
docker build -t $SyncAgentBundle $SyncAgentContext
if ($LASTEXITCODE -ne 0) { throw 'docker build sync-agent a échoué' }
docker save -o (Join-Path $ImagesDir 'sync-agent.tar') $SyncAgentBundle
Write-Host 'sync-agent.tar exporté'

Write-Host 'server-stack prêt pour dist:win:server'
