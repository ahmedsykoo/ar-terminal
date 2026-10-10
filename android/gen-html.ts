import { renderTerminalHtml } from '../src/ui/terminal-ui';
import { writeFileSync } from 'node:fs';

const mono = "monospace";
writeFileSync(
  'android/app/src/main/assets/terminal.html',
  renderTerminalHtml({
    xtermCss: 'xterm/xterm.css',
    xtermJs: 'xterm/xterm.js',
    fitJs: 'xterm/addon-fit.js',
    webLinksJs: 'xterm/addon-web-links.js',
    searchJs: 'xterm/addon-search.js',
    nerdFontUri: 'SymbolsNerdFontMono-Regular.ttf',
    fontSize: 14,
    fontFamily: mono,
    xtermFontFamily: mono,
    hostInit: '{ postMessage: function (m) { AndroidPty.post(JSON.stringify(m)); } }',
  })
);
