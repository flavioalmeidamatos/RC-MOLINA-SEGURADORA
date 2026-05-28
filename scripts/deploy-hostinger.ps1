param(
  [string]$HostName = "187.77.55.45",
  [string]$User = "root",
  [string]$KeyPath = "$env:USERPROFILE\.ssh\rc_molina_vps",
  [string]$AppPath = "/var/www/rc-molina",
  [string]$DomainName = "rcmolinaseguros.resolveplanilhas.com.br"
)

$ErrorActionPreference = "Stop"

$archivePath = Join-Path $env:TEMP "rc-molina-app.tgz"
$remoteDeployPath = "/tmp/rc-molina-deploy"
$sshTarget = "$User@$HostName"

# Bump version in package.json and src/version.ts, and auto-commit
Write-Host "Incrementing version..."
$versionFile = "src/version.ts"
$packageFile = "package.json"

if (Test-Path $versionFile) {
    $content = Get-Content $versionFile -Raw
    if ($content -match 'export const APP_VERSION = "(\d+)\.(\d+)\.(\d+)"') {
        $major = [int]$Matches[1]
        $minor = [int]$Matches[2]
        $patch = [int]$Matches[3]
        $patch++
        $newVersion = "$major.$minor.$patch"
        
        # Write back to version.ts
        Set-Content -Path $versionFile -Value "export const APP_VERSION = `"$newVersion`";`r`n" -NoNewline
        Write-Host "Bumped version to $newVersion in $versionFile"

        # Write back to package.json
        if (Test-Path $packageFile) {
            $pkgContent = Get-Content $packageFile -Raw
            $pkgContent = $pkgContent -replace '"version":\s*"[^"]+"', ('"version": "' + $newVersion + '"')
            Set-Content -Path $packageFile -Value $pkgContent -NoNewline
            Write-Host "Updated version in $packageFile"
        }
        
        # Auto-commit the version bump and modifications
        Write-Host "Committing changes to Git..."
        git add -A
        git commit -m "chore: bump version to $newVersion and update layout"
        git push origin main
    }
}

Write-Host "Building local package..."
tar -czf $archivePath `
  --exclude=.git `
  --exclude=node_modules `
  --exclude=dist `
  --exclude=.env `
  --exclude=.env.local `
  --exclude=.env.*.local `
  --exclude=.v* `
  --exclude=.env.example `
  .

Write-Host "Uploading package to $sshTarget..."
ssh -i $KeyPath $sshTarget "mkdir -p $remoteDeployPath $AppPath/releases $AppPath/shared"
scp -i $KeyPath $archivePath "${sshTarget}:$remoteDeployPath/app.tgz"
scp -i $KeyPath "scripts/nginx-rc-molina-domain.conf" "${sshTarget}:/etc/nginx/sites-available/rc-molina-domain"

# Save remote script to a local temp file first
$localScriptPath = Join-Path $env:TEMP "deploy_script.sh"
$remoteScriptPath = "$remoteDeployPath/execute_deploy.sh"

$remoteScript = @"
#!/bin/bash
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
ln -sfn /etc/nginx/sites-available/rc-molina-domain /etc/nginx/sites-enabled/rc-molina-domain
pm2 delete rc-molina >/dev/null 2>&1 || true
cd "$AppPath/current"
pm2 start npm --name rc-molina -- run start:prod
pm2 save
# Limpar releases antigas mantendo apenas as 5 mais recentes
cd "$AppPath/releases" && ls -1t | tail -n +6 | xargs -r rm -rf || true
nginx -t
systemctl reload nginx
"@

[System.IO.File]::WriteAllText($localScriptPath, $remoteScript.Replace("`r`n", "`n"))

Write-Host "Installing release on VPS..."
scp -i $KeyPath $localScriptPath "${sshTarget}:$remoteScriptPath"
ssh -i $KeyPath $sshTarget "bash $remoteScriptPath"

Remove-Item -LiteralPath $archivePath -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $localScriptPath -Force -ErrorAction SilentlyContinue
Write-Host "Deploy finished: http://$DomainName"
Write-Host "Production URL: https://$DomainName"
