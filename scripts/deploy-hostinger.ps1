param(
  [string]$HostName = "187.77.55.45",
  [string]$User = "root",
  [string]$KeyPath = "$env:USERPROFILE\.ssh\rc_molina_vps",
  [string]$AppPath = "/var/www/rc-molina"
)

$ErrorActionPreference = "Stop"

$archivePath = Join-Path $env:TEMP "rc-molina-app.tgz"
$remoteDeployPath = "/tmp/rc-molina-deploy"
$sshTarget = "$User@$HostName"

Write-Host "Building local package..."
tar -czf $archivePath `
  --exclude=.git `
  --exclude=node_modules `
  --exclude=dist `
  --exclude=.vercel `
  --exclude=.env `
  --exclude=.env.local `
  --exclude=.env.vercel.local `
  --exclude=.env.example `
  .

Write-Host "Uploading package to $sshTarget..."
ssh -i $KeyPath $sshTarget "mkdir -p $remoteDeployPath $AppPath/releases $AppPath/shared"
scp -i $KeyPath $archivePath "${sshTarget}:$remoteDeployPath/app.tgz"

Write-Host "Installing release on VPS..."
$remoteScript = @"
set -e
release=$AppPath/releases/`$(date +%Y%m%d%H%M%S)
mkdir -p "`$release"
tar -xzf $remoteDeployPath/app.tgz -C "`$release"
if [ -f "$AppPath/shared/.env.local" ]; then
  cp "$AppPath/shared/.env.local" "`$release/.env.local"
fi
cd "`$release"
npm ci
npm run build
ln -sfn "`$release" "$AppPath/current"
pm2 delete rc-molina >/dev/null 2>&1 || true
cd "$AppPath/current"
pm2 start npm --name rc-molina -- run start:prod
pm2 save
nginx -t
systemctl reload nginx
"@

ssh -i $KeyPath $sshTarget $remoteScript

Remove-Item -LiteralPath $archivePath -Force -ErrorAction SilentlyContinue
Write-Host "Deploy finished: https://srv1640658.hstgr.cloud"
