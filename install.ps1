# Installs the latest Diagramator release for Windows.
#
#   irm https://raw.githubusercontent.com/slavita256bit/diagramator/master/install.ps1 | iex
#
# Pass -Silent to run the installer unattended:
#   & ([scriptblock]::Create((irm https://raw.githubusercontent.com/slavita256bit/diagramator/master/install.ps1))) -Silent

param(
  [switch]$Silent
)

$ErrorActionPreference = "Stop"
$repo = "slavita256bit/diagramator"

Write-Host "==> checking latest release"
$release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest"

$asset = $release.assets | Where-Object { $_.name -like "*_x64-setup.exe" } | Select-Object -First 1
if (-not $asset) {
  throw "No Windows installer found in the latest release. Download manually from https://github.com/$repo/releases/latest"
}

$dest = Join-Path $env:TEMP $asset.name
Write-Host "==> downloading $($asset.name)"
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $dest

Write-Host "==> launching installer"
if ($Silent) {
  Start-Process -FilePath $dest -ArgumentList "/S" -Wait
} else {
  Start-Process -FilePath $dest -Wait
}

Write-Host "==> done"
