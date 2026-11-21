#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
if ! command -v gradle >/dev/null 2>&1; then
  echo "Gradle is not installed locally. Push to GitHub to build via GitHub Actions (.github/workflows/build-android-apk.yml), or install Gradle + Android SDK."
  exit 1
fi
cd "$ROOT/android"
gradle assembleRelease --no-daemon
VER="$(node -p "require('../package.json').version")"
cp "app/build/outputs/apk/release/app-release.apk" "$ROOT/HushRP-v${VER}-android.apk"
echo "Built APK successfully: $ROOT/HushRP-v${VER}-android.apk"
