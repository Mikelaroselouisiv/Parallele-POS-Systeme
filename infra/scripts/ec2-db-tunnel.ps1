# Tunnel SSH vers Postgres sur EC2 (ecoute sur 127.0.0.1:5432 dans le conteneur/hote).
# Garde cette fenetre ouverte. Dans apps/backend/.env utilise le port local (ex. 15432).
#
# Exemple :
#   .\infra\scripts\ec2-db-tunnel.ps1 -PemPath "apps\freresbazilepos.pem" -Ec2Host "3.x.x.x"
#
param(
  [Parameter(Mandatory = $true)]
  [string] $PemPath,
  [Parameter(Mandatory = $true)]
  [string] $Ec2Host,
  [string] $Ec2User = "ec2-user",
  [int] $LocalPort = 15432
)

$resolvedPem = Resolve-Path -LiteralPath $PemPath -ErrorAction Stop
Write-Host "Tunnel: 127.0.0.1:$LocalPort -> ${Ec2Host}:5432 (via $Ec2User). Ctrl+C pour arreter."
ssh -i $resolvedPem -N -L "${LocalPort}:127.0.0.1:5432" "${Ec2User}@${Ec2Host}"
