$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$androidDir = Join-Path $root 'android'

$tools = Join-Path $env:LOCALAPPDATA 'HushBuildTools'
if (-not $env:ANDROID_HOME -and (Test-Path (Join-Path $env:LOCALAPPDATA 'Android\Sdk'))) {
  $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
  $env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
}
$jdk17 = Get-ChildItem $tools -Directory -Filter 'jdk-17*' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($jdk17) {
  $env:JAVA_HOME = $jdk17.FullName
  $env:Path = "$($jdk17.FullName)\bin;$env:Path"
}
$localGradleBin = Join-Path $tools 'gradle-8.11.1\bin'
if (Test-Path (Join-Path $localGradleBin 'gradle.bat')) {
  $env:Path = "$localGradleBin;$env:Path"
}

$gradleCmd = Get-Command gradle.bat,gradle -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $gradleCmd) {
  Write-Host 'Gradle is not installed locally. Push to GitHub to build automatically via GitHub Actions (.github/workflows/build-android-apk.yml), or install Android Studio / Gradle + Android SDK.' -ForegroundColor Yellow
  exit 1
}

Push-Location $androidDir
try {
  & $gradleCmd.Source assembleRelease --no-daemon
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  $ver = (node -p "require('../package.json').version").Trim()
  $src = Join-Path $androidDir 'app\build\outputs\apk\release\app-release.apk'
  $dst = Join-Path $root "HushRP-v$ver-android.apk"
  Copy-Item $src $dst -Force
  Write-Host "Built APK successfully: $dst" -ForegroundColor Green
} finally {
  Pop-Location
}
