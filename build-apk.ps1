$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$androidDir = Join-Path $root 'android'

if (-not (Get-Command gradle -ErrorAction SilentlyContinue)) {
  Write-Host 'Gradle is not installed locally. Push to GitHub to build automatically via GitHub Actions (.github/workflows/build-android-apk.yml), or install Android Studio / Gradle + Android SDK.' -ForegroundColor Yellow
  exit 1
}

Push-Location $androidDir
try {
  gradle assembleRelease --no-daemon
  $ver = (node -p "require('../package.json').version").Trim()
  $src = Join-Path $androidDir 'app\build\outputs\apk\release\app-release.apk'
  $dst = Join-Path $root "HushRP-v$ver-android.apk"
  Copy-Item $src $dst -Force
  Write-Host "Built APK successfully: $dst" -ForegroundColor Green
} finally {
  Pop-Location
}
