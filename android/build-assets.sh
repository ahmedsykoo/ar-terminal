#!/usr/bin/env bash
# Generates the WebView page + copies xterm assets into the APK's assets/.
set -euo pipefail
cd "$(dirname "$0")/.."
A=android/app/src/main/assets
mkdir -p "$A/xterm"
npx esbuild android/gen-html.ts --bundle --platform=node --outfile=android/.gen.cjs --log-level=error
node android/.gen.cjs
cp media/xterm/* "$A/xterm/"
cp media/SymbolsNerdFontMono-Regular.ttf "$A/"
