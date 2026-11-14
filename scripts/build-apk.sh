#!/usr/bin/env bash
# Build a debug APK for ぼくだけのてつどううんてんシミュレーター.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SDK_DIR="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [[ -z "$SDK_DIR" ]]; then
  echo "ANDROID_HOME or ANDROID_SDK_ROOT must be set" >&2
  exit 1
fi
printf 'sdk.dir=%s\n' "$SDK_DIR" > android/local.properties

if [[ ! -d node_modules ]]; then
  npm ci
fi

npm run build
npx cap sync android

cd android
./gradlew assembleDebug --no-daemon

mkdir -p "$ROOT/release"
cp -f app/build/outputs/apk/debug/app-debug.apk "$ROOT/release/bokudake-tetsudou-debug.apk"

echo
echo "APK: $ROOT/release/bokudake-tetsudou-debug.apk"
ls -lh "$ROOT/release/bokudake-tetsudou-debug.apk"
