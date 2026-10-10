#!/usr/bin/env bash
# Regenerates termux/web/ (terminal page + xterm assets) from the shared UI in src/ui.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p termux/web/xterm
npx esbuild termux/gen-web.ts --bundle --platform=node --outfile=termux/.gen.cjs --log-level=error
node termux/.gen.cjs
cp media/xterm/* termux/web/xterm/
cp media/SymbolsNerdFontMono-Regular.ttf termux/web/
rm -f termux/.gen.cjs
