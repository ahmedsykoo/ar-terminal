import { renderTerminalHtml } from '../src/ui/terminal-ui';
import { writeFileSync } from 'node:fs';

// Host adapter: talks to ar-terminal-web.py over fetch + Server-Sent Events.
const hostInit = `(function () {
  var q = new URLSearchParams(location.search);
  var tok = q.get('t') || '';
  var sid = Math.random().toString(36).slice(2);
  var suffix = '?t=' + encodeURIComponent(tok) + '&sid=' + sid;
  var queue = Promise.resolve();
  function send(type, body) {
    queue = queue.then(function () {
      return fetch('/' + type + suffix, { method: 'POST', body: JSON.stringify(body) });
    }).catch(function () {});
  }
  function stream() {
    var es = new EventSource('/stream' + suffix);
    es.onmessage = function (e) { window.postMessage(JSON.parse(e.data), '*'); };
  }
  return {
    postMessage: function (m) {
      if (m.type === 'ready') stream();
      else if (m.type === 'input' || m.type === 'resize') send(m.type, m);
    }
  };
})()`;

const mono = "'DejaVu Sans Mono', 'Droid Sans Mono', 'Cascadia Mono', Consolas, Menlo, monospace";
writeFileSync(
  'termux/web/index.html',
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
    hostInit,
  })
);
