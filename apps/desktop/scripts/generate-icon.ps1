#Requires -Version 5.1
# Synchronise le logo depuis assets/icons/icon.png (ne jamais écraser la source).
$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DesktopRoot = Split-Path $ScriptDir -Parent
Push-Location $DesktopRoot
try {
  node (Join-Path $ScriptDir 'sync-icons.mjs')
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Pop-Location
}
