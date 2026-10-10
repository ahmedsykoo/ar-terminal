import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, copyFileSync } from 'node:fs';

const production = process.argv.includes('--production');
const common = { bundle: true, sourcemap: !production, minify: production, logLevel: 'info' };

mkdirSync('dist', { recursive: true });
await Promise.all([
  esbuild.build({ ...common, entryPoints: ['src/main.ts'], platform: 'node', format: 'cjs', outfile: 'dist/main.js', external: ['electron', 'node-pty'] }),
  esbuild.build({ ...common, entryPoints: ['src/preload.ts'], platform: 'node', format: 'cjs', outfile: 'dist/preload.js', external: ['electron'] }),
  esbuild.build({ ...common, entryPoints: ['renderer/renderer.ts'], platform: 'browser', format: 'iife', outfile: 'dist/renderer.js' }),
]);
copyFileSync('renderer/index.html', 'dist/index.html');
cpSync('../media/xterm', 'dist/media/xterm', { recursive: true });
copyFileSync('../media/SymbolsNerdFontMono-Regular.ttf', 'dist/media/SymbolsNerdFontMono-Regular.ttf');
