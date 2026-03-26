# Premier envoi du monorepo vers GitHub (branche main).
# Prérequis : Git installé (https://git-scm.com/download/win) et authentification GitHub (HTTPS ou SSH).
# Usage : depuis la racine du monorepo :
#   powershell -ExecutionPolicy Bypass -File .\scripts\push-to-github.ps1

$ErrorActionPreference = "Stop"
# Racine du monorepo = parent du dossier scripts/
$RepoRoot = Split-Path -Parent $PSScriptRoot

$RemoteUrl = "https://github.com/Mikelaroselouisiv/Parallele-POS-Systeme.git"

function Find-Git {
  $cmd = Get-Command git -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  foreach ($p in @(
    "${env:ProgramFiles}\Git\cmd\git.exe",
    "${env:ProgramFiles}\Git\bin\git.exe",
    "${env:LocalAppData}\Programs\Git\cmd\git.exe"
  )) {
    if (Test-Path $p) { return $p }
  }
  return $null
}

$git = Find-Git
if (-not $git) {
  Write-Error "Git est introuvable. Installez Git pour Windows : https://git-scm.com/download/win puis rouvrez le terminal."
}

if (-not (Test-Path (Join-Path $RepoRoot "apps"))) {
  Write-Error "Répertoire monorepo invalide : $RepoRoot (dossier apps/ introuvable)."
}

Set-Location $RepoRoot
Write-Host "Dépôt : $RepoRoot" -ForegroundColor Cyan

if (-not (Test-Path ".git")) {
  & $git init
  & $git branch -M main
}

& $git add -A
$status = & $git status --porcelain
if (-not $status) {
  Write-Host "Rien à committer (déjà à jour)." -ForegroundColor Yellow
} else {
  & $git commit -m "Initial commit: monorepo POS (backend, desktop, infra)"
}

$remotes = & $git remote
if ($remotes -contains "origin") {
  & $git remote set-url origin $RemoteUrl
} else {
  & $git remote add origin $RemoteUrl
}

Write-Host "Poussée vers origin/main…" -ForegroundColor Cyan
& $git push -u origin main

Write-Host "Terminé. Dépôt : $RemoteUrl" -ForegroundColor Green
