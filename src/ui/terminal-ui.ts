/**
 * Shared terminal UI (xterm.js + Arabic DOM overlay).
 *
 * Host-agnostic: the VS Code extension and the standalone desktop app both
 * render this page. `hostInit` is a JS expression evaluated inside the page
 * that must return an object with `postMessage(msg)`; incoming messages are
 * delivered as `message` events on `window` (event.data = msg).
 */
export interface TerminalUiOptions {
  xtermCss: string;
  xtermJs: string;
  fitJs: string;
  webLinksJs: string;
  searchJs: string;
  nerdFontUri: string;
  fontSize: number;
  fontFamily: string;
  xtermFontFamily: string;
  hostInit: string;
  extraCss?: string;
}

export function renderTerminalHtml(o: TerminalUiOptions): string {
  const { xtermCss, xtermJs, fitJs, webLinksJs, searchJs, nerdFontUri, fontSize, fontFamily, xtermFontFamily, hostInit } = o;
  const extraCss = o.extraCss ?? '';
  
      return /* html */ `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link rel="stylesheet" href="${xtermCss}">
<style>
  /* Bundled Nerd Font symbols — covers Powerline, Devicons, Font Awesome, etc. */
  @font-face {
    font-family: 'TerminalIcons';
    src: url('${nerdFontUri}') format('truetype');
    unicode-range: U+E0A0-E0D4, U+E200-E2A9, U+E0B0-E0BF, U+E5FA-E6AC,
                   U+F000-F2E0, U+F300-F372, U+F400-F532, U+F500-FD46,
                   U+E700-E7C5, U+F0001-F1AF0, U+E6B2-E6B5, U+23FB-23FE, U+2665, U+26A1,
                   U+2630, U+E0CA, U+E0CC, U+E0CE, U+E0CF, U+E0D0, U+E0D1, U+E0D2, U+E0D4;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: var(--vscode-terminal-background, #1e1e1e);
    height: 100vh;
    overflow: hidden;
  }
  #terminal-container {
    width: 100%;
    height: 100%;
    position: relative;
  }
  /* Arabic overlay sits on top of xterm.js canvas */
  #arabic-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
    z-index: 10;
    overflow: hidden;
  }
  .arabic-line {
    position: absolute;
    left: 0;
    right: 0;
    white-space: pre;
    unicode-bidi: normal;
    direction: ltr;
    text-align: left;
    font-family: ${fontFamily}, TerminalIcons, monospace;
    background: var(--vscode-terminal-background, #1e1e1e);
  }
  /* Overlay cursor */
  .overlay-cursor {
    display: inline-block;
    width: 2px;
    height: 1.2em;
    background: #d4d4d4;
    animation: blink 1s step-end infinite;
    vertical-align: text-bottom;
    position: absolute;
  }
  @keyframes blink { 50% { opacity: 0; } }
  /* Selection highlight */
  .overlay-selected {
    background: rgba(38, 79, 120, 0.6);
  }
  .c-default { color: #d4d4d4; }
  .c-0 { color: #000; } .c-1 { color: #cd3131; } .c-2 { color: #0dbc79; }
  .c-3 { color: #e5e510; } .c-4 { color: #2472c8; } .c-5 { color: #bc3fbc; }
  .c-6 { color: #11a8cd; } .c-7 { color: #e5e5e5; }
  .c-8 { color: #666; } .c-9 { color: #f14c4c; } .c-10 { color: #23d18b; }
  .c-11 { color: #f5f543; } .c-12 { color: #3b8eea; } .c-13 { color: #d670d6; }
  .c-14 { color: #29b8db; } .c-15 { color: #fff; }
  .c-bold { font-weight: bold; }
  /* Search bar */
  #search-bar {
    display: none;
    position: absolute;
    top: 4px;
    right: 16px;
    z-index: 20;
    background: var(--vscode-input-background, #3c3c3c);
    border: 1px solid var(--vscode-input-border, #555);
    border-radius: 4px;
    padding: 4px 8px;
    gap: 6px;
    align-items: center;
  }
  #search-bar.visible { display: flex; }
  #search-input {
    background: transparent;
    border: none;
    color: var(--vscode-input-foreground, #ccc);
    font-size: 13px;
    font-family: inherit;
    outline: none;
    width: 200px;
  }
  #search-bar button {
    background: transparent;
    border: none;
    color: var(--vscode-input-foreground, #ccc);
    cursor: pointer;
    font-size: 14px;
    padding: 2px 6px;
  }
  #search-bar button:hover { background: rgba(255,255,255,0.1); border-radius: 3px; }
  #search-count { color: var(--vscode-descriptionForeground, #999); font-size: 12px; white-space: nowrap; }
  /* Custom context menu */
  #ctx-menu {
    display: none;
    position: fixed;
    z-index: 50;
    background: var(--vscode-menu-background, #252526);
    border: 1px solid var(--vscode-menu-border, #454545);
    border-radius: 5px;
    padding: 4px 0;
    min-width: 140px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  }
  #ctx-menu.visible { display: block; }
  #ctx-menu button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    background: transparent;
    border: none;
    color: var(--vscode-menu-foreground, #ccc);
    font-size: 13px;
    font-family: inherit;
    padding: 4px 20px;
    cursor: pointer;
    text-align: left;
  }
  #ctx-menu button:hover {
    background: var(--vscode-menu-selectionBackground, #094771);
    color: var(--vscode-menu-selectionForeground, #fff);
  }
  #ctx-menu .shortcut { font-size: 11px; opacity: 0.7; margin-left: 24px; }
  #ctx-menu hr { border: none; border-top: 1px solid var(--vscode-menu-separatorBackground, #454545); margin: 4px 0; }
${extraCss}
</style>
</head>
<body>
<div id="terminal-container">
  <div id="search-bar">
    <input id="search-input" type="text" placeholder="Search..." />
    <span id="search-count"></span>
    <button id="search-prev" title="Previous">&#9650;</button>
    <button id="search-next" title="Next">&#9660;</button>
    <button id="search-close" title="Close">&#10005;</button>
  </div>
  <div id="arabic-overlay"></div>
  <div id="ctx-menu">
    <button data-action="copy">Copy<span class="shortcut">⌘C</span></button>
    <button data-action="paste">Paste<span class="shortcut">⌘V</span></button>
    <hr/>
    <button data-action="clear">Clear<span class="shortcut">⌘K</span></button>
    <button data-action="selectAll">Select All<span class="shortcut">⌘A</span></button>
  </div>
</div>
<script src="${xtermJs}"></script>
<script src="${fitJs}"></script>
<script src="${webLinksJs}"></script>
<script src="${searchJs}"></script>
<script>
(function() {
  const vscode = ${hostInit};
  const overlay = document.getElementById('arabic-overlay');

  function isRTLChar(cp) {
    return (cp >= 0x0590 && cp <= 0x05FF) || (cp >= 0x0600 && cp <= 0x06FF) ||
           (cp >= 0x0700 && cp <= 0x074F) || (cp >= 0x0750 && cp <= 0x077F) ||
           (cp >= 0x08A0 && cp <= 0x08FF) || (cp >= 0xFB1D && cp <= 0xFB4F) ||
           (cp >= 0xFB50 && cp <= 0xFDFF) || (cp >= 0xFE70 && cp <= 0xFEFF);
  }
  // Nerd Font Private Use Area glyphs (Powerline, Devicons, FA, etc.)
  function isNerdFontChar(cp) {
    return (cp >= 0xE0A0 && cp <= 0xE0D4) || (cp >= 0xE0B0 && cp <= 0xE0CF) ||
           (cp >= 0xE200 && cp <= 0xE2A9) || (cp >= 0xE5FA && cp <= 0xE6B5) ||
           (cp >= 0xE700 && cp <= 0xE7C5) || (cp >= 0xEA60 && cp <= 0xEBEB) ||
           (cp >= 0xF000 && cp <= 0xFD46) || (cp >= 0xF0001 && cp <= 0xF1AF0) ||
           (cp >= 0x23FB && cp <= 0x23FE) || cp === 0x2665 || cp === 0x26A1;
  }
  function needsOverlay(cp) {
    return isRTLChar(cp) || isNerdFontChar(cp);
  }
  function containsRTL(text) {
    for (const ch of text) {
      if (isRTLChar(ch.codePointAt(0))) return true;
    }
    return false;
  }

  const term = new Terminal({
    cursorBlink: true,
    fontSize: ${fontSize},
    fontFamily: "${xtermFontFamily}",
    customGlyphs: true,
    letterSpacing: 0,
    theme: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#d4d4d4',
      selectionBackground: '#264f78',
    },
    allowProposedApi: true,
    scrollback: 10000,
    convertEol: false,
  });

  const fitAddon = new FitAddon.FitAddon();
  let searchAddon = null;
  term.loadAddon(fitAddon);
  try {
    if (typeof SearchAddon !== 'undefined') {
      searchAddon = new SearchAddon.SearchAddon();
      term.loadAddon(searchAddon);
    }
  } catch(e) { console.warn('[RTL Terminal] Search addon failed:', e); }
  try { term.loadAddon(new WebLinksAddon.WebLinksAddon()); } catch(e) {}

  const container = document.getElementById('terminal-container');
  term.open(container);
  fitAddon.fit();

  // Get xterm cell dimensions for overlay positioning
  function getCellDims() {
    const core = term._core;
    if (core && core._renderService) {
      const d = core._renderService.dimensions;
      return {
        cellW: d.css.cell.width,
        cellH: d.css.cell.height,
        canvasTop: d.css.canvas.top || 0,
        canvasLeft: d.css.canvas.left || 0,
      };
    }
    return { cellW: 7.8, cellH: 17, canvasTop: 0, canvasLeft: 0 };
  }

  // ANSI 16-color palette
  const palette16 = [
    '#000','#cd3131','#0dbc79','#e5e510','#2472c8','#bc3fbc','#11a8cd','#e5e5e5',
    '#666','#f14c4c','#23d18b','#f5f543','#3b8eea','#d670d6','#29b8db','#fff'
  ];
  function palette256(idx) {
    if (idx < 16) return palette16[idx];
    if (idx < 232) {
      const i = idx - 16;
      return 'rgb(' + Math.floor(i/36)*51 + ',' + Math.floor((i%36)/6)*51 + ',' + (i%6)*51 + ')';
    }
    const g = (idx - 232) * 10 + 8;
    return 'rgb(' + g + ',' + g + ',' + g + ')';
  }
  function getCellColor(cell) {
    const defaultFg = term.options.theme?.foreground || '#d4d4d4';
    try {
      if (cell.isFgPalette && cell.isFgPalette()) {
        const idx = cell.getFgColor();
        return idx < 16 ? palette16[idx] : palette256(idx);
      } else if (cell.isFgRGB && cell.isFgRGB()) {
        const rgb = cell.getFgColor();
        return 'rgb(' + ((rgb>>16)&0xFF) + ',' + ((rgb>>8)&0xFF) + ',' + (rgb&0xFF) + ')';
      }
    } catch(e) {}
    return defaultFg;
  }

  // A line gets an RTL base direction when its first strong character is RTL
  // (Unicode bidi rule P2/P3). Digits, punctuation and box-drawing are neutral.
  function lineIsRtlBase(text) {
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      if (isRTLChar(cp)) return true;
      if ((cp >= 0x41 && cp <= 0x5A) || (cp >= 0x61 && cp <= 0x7A) || (cp >= 0xC0 && cp <= 0x24F) ||
          (cp >= 0x370 && cp <= 0x58F) || (cp >= 0x900 && cp <= 0x1FFF) || (cp >= 0x3040 && cp <= 0xD7FF)) return false;
    }
    return false;
  }

  // Pixel x of the caret at logical character index idx inside an RTL block.
  function caretLeft(inner, idx, cells, cellW) {
    const walker = document.createTreeWalker(inner, NodeFilter.SHOW_TEXT);
    let node = null, remaining = idx, last = null;
    while ((node = walker.nextNode())) {
      last = node;
      if (remaining <= node.length) {
        if (remaining < node.length || !walker.nextNode()) break;
        walker.previousNode();
      }
      remaining -= node.length;
    }
    if (!last) return idx * cellW;
    const target = node || last;
    const off = node ? Math.min(remaining, node.length) : last.length;
    const range = document.createRange();
    range.setStart(target, off);
    range.collapse(true);
    const r = range.getBoundingClientRect();
    const o = overlay.getBoundingClientRect();
    const extra = idx > cells ? (idx - cells) * cellW : 0;
    return r.left - o.left - extra;
  }

  // Scan visible rows, overlay lines that contain Arabic text
  function updateArabicOverlay() {
    while (overlay.firstChild) overlay.removeChild(overlay.firstChild);

    const buf = term.buffer.active;
    const dims = getCellDims();
    const viewportY = buf.viewportY;

    for (let y = 0; y < term.rows; y++) {
      const bufLine = buf.getLine(viewportY + y);
      if (!bufLine) continue;

      // Check if line has RTL text or Nerd Font icons
      let lineNeedsOverlay = false;
      for (let x = 0; x < bufLine.length; x++) {
        const cell = bufLine.getCell(x);
        if (!cell) continue;
        const ch = cell.getChars();
        if (ch && needsOverlay(ch.codePointAt(0))) { lineNeedsOverlay = true; break; }
      }
      if (!lineNeedsOverlay) continue;

      // Create full-line overlay
      const lineDiv = document.createElement('div');
      lineDiv.className = 'arabic-line';
      lineDiv.style.top = (dims.canvasTop + y * dims.cellH) + 'px';
      lineDiv.style.height = dims.cellH + 'px';
      lineDiv.style.lineHeight = dims.cellH + 'px';
      lineDiv.style.fontSize = term.options.fontSize + 'px';

      let currentSpan = null;
      let currentKey = '';

      for (let x = 0; x < bufLine.length; x++) {
        const cell = bufLine.getCell(x);
        if (!cell) continue;
        const ch = cell.getChars();
        if (!ch && x > 0) continue;

        const fgColor = getCellColor(cell);
        let bold = false, dim = false, italic = false;
        try {
          bold = cell.isBold && cell.isBold();
          dim = cell.isDim && cell.isDim();
          italic = cell.isItalic && cell.isItalic();
        } catch(e) {}

        const key = fgColor + (bold?'b':'') + (dim?'d':'') + (italic?'i':'');
        if (key !== currentKey || !currentSpan) {
          currentSpan = document.createElement('span');
          currentSpan.style.color = fgColor;
          if (bold) currentSpan.style.fontWeight = 'bold';
          if (dim) currentSpan.style.opacity = '0.5';
          if (italic) currentSpan.style.fontStyle = 'italic';
          lineDiv.appendChild(currentSpan);
          currentKey = key;
        }
        currentSpan.textContent += ch || ' ';
      }

      const rtlBase = lineIsRtlBase(lineDiv.textContent || '');
      if (rtlBase) {
        // Arabic-dominant line: lay out with an RTL base direction so the order of
        // Arabic and Latin runs reads naturally. The block stays anchored at column 0
        // and spans the same number of cells the line uses in the terminal grid.
        const inner = document.createElement('div');
        inner.style.cssText = 'position:absolute;top:0;left:0;white-space:pre;direction:rtl;width:max-content;';
        while (lineDiv.firstChild) inner.appendChild(lineDiv.firstChild);
        // Trim trailing blanks so they do not push the text to the far right.
        let trimmed = 0;
        for (let n = inner.lastChild; n; n = inner.lastChild) {
          const t = n.textContent || '';
          const r = t.replace(/ +$/, '');
          trimmed += t.length - r.length;
          if (r.length === 0) { inner.removeChild(n); continue; }
          n.textContent = r;
          break;
        }
        const cells = (inner.textContent || '').length;
        inner.style.minWidth = (cells * dims.cellW) + 'px';
        lineDiv.appendChild(inner);
        lineDiv.dataset.rtl = '1';
        overlay.appendChild(lineDiv);

        if (y === buf.cursorY) {
          const cursorEl = document.createElement('span');
          cursorEl.className = 'overlay-cursor';
          cursorEl.style.height = dims.cellH + 'px';
          const x = caretLeft(inner, buf.cursorX, cells, dims.cellW);
          cursorEl.style.left = x + 'px';
          lineDiv.appendChild(cursorEl);
        }
        continue;
      }

      // Cursor on this line
      if (y === buf.cursorY) {
        const cursorEl = document.createElement('span');
        cursorEl.className = 'overlay-cursor';
        cursorEl.style.left = (dims.canvasLeft + buf.cursorX * dims.cellW) + 'px';
        cursorEl.style.height = dims.cellH + 'px';
        lineDiv.appendChild(cursorEl);
      }

      overlay.appendChild(lineDiv);
    }

    applySelectionHighlight();
  }

  // Highlight selected text on overlay lines (character-accurate)
  function applySelectionHighlight() {
    const sel = term.getSelectionPosition();
    if (!sel) return;

    const buf = term.buffer.active;
    const viewportY = buf.viewportY;
    const dims = getCellDims();
    const overlayLines = overlay.querySelectorAll('.arabic-line');

    overlayLines.forEach((lineDiv) => {
      const topPx = parseFloat(lineDiv.style.top);
      const rowIndex = Math.round((topPx - dims.canvasTop) / dims.cellH);
      const absY = viewportY + rowIndex;

      if (absY < sel.start.y || absY > sel.end.y) return;

      // Determine selection columns for this line
      let startX = 0;
      let endX = Infinity;
      if (absY === sel.start.y) startX = sel.start.x;
      if (absY === sel.end.y) endX = sel.end.x;

      // Walk through spans, tracking character position
      let charPos = 0;
      const spans = lineDiv.querySelectorAll('span:not(.overlay-cursor)');
      spans.forEach((span) => {
        const text = span.textContent || '';
        const spanStart = charPos;
        const spanEnd = charPos + text.length;
        charPos = spanEnd;

        if (spanEnd <= startX || spanStart >= endX) {
          // Entirely outside selection
          return;
        }

        if (spanStart >= startX && spanEnd <= endX) {
          // Entirely inside selection
          span.classList.add('overlay-selected');
        } else {
          // Partially selected — split the span
          const selFrom = Math.max(0, startX - spanStart);
          const selTo = Math.min(text.length, endX - spanStart);

          // Clear original text
          const parent = span.parentNode;
          const color = span.style.color;
          const fw = span.style.fontWeight;
          const op = span.style.opacity;

          // Before selection
          if (selFrom > 0) {
            const before = document.createElement('span');
            before.style.color = color;
            if (fw) before.style.fontWeight = fw;
            if (op) before.style.opacity = op;
            before.textContent = text.slice(0, selFrom);
            parent.insertBefore(before, span);
          }
          // Selected portion
          const mid = document.createElement('span');
          mid.style.color = color;
          if (fw) mid.style.fontWeight = fw;
          if (op) mid.style.opacity = op;
          mid.classList.add('overlay-selected');
          mid.textContent = text.slice(selFrom, selTo);
          parent.insertBefore(mid, span);
          // After selection
          if (selTo < text.length) {
            const after = document.createElement('span');
            after.style.color = color;
            if (fw) after.style.fontWeight = fw;
            if (op) after.style.opacity = op;
            after.textContent = text.slice(selTo);
            parent.insertBefore(after, span);
          }
          parent.removeChild(span);
        }
      });
    });
  }

  // Schedule overlay update (debounced)
  let overlayTimer = null;
  function scheduleOverlay() {
    if (overlayTimer) clearTimeout(overlayTimer);
    overlayTimer = setTimeout(updateArabicOverlay, 16); // reduced to 16ms (1 frame)
  }

  term.onWriteParsed(scheduleOverlay);
  term.onScroll(scheduleOverlay);
  term.onResize(scheduleOverlay);
  term.onSelectionChange(scheduleOverlay);

  term.onData((data) => {
    vscode.postMessage({ type: 'input', data });
  });

  term.onResize(({ cols, rows }) => {
    vscode.postMessage({ type: 'resize', cols, rows });
  });

  // Auto-focus xterm when webview panel is activated (fixes first-click-to-type)
  window.addEventListener('focus', () => {
    if (!searchBar.classList.contains('visible')) term.focus();
  });
  document.addEventListener('click', (e) => {
    if (!searchBar.contains(e.target)) term.focus();
  });

  const resizeObserver = new ResizeObserver(() => {
    fitAddon.fit();
    scheduleOverlay();
  });
  resizeObserver.observe(container);

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg.type === 'output') {
      term.write(msg.data);
    } else if (msg.type === 'exit') {
      term.write('\\r\\n[Process exited]');
    } else if (msg.type === 'setFontSize') {
      term.options.fontSize = msg.size;
      fitAddon.fit();
      scheduleOverlay();
    } else if (msg.type === 'focus') {
      term.focus();
    } else if (msg.type === 'search') {
      openSearch();
    }
  });

  // Search bar (Cmd+F / Ctrl+F)
  const searchBar = document.getElementById('search-bar');
  const searchInput = document.getElementById('search-input');
  const searchCount = document.getElementById('search-count');

  function openSearch() {
    searchBar.classList.add('visible');
    searchInput.focus();
    searchInput.select();
  }
  function closeSearch() {
    searchBar.classList.remove('visible');
    if (searchAddon) searchAddon.clearDecorations();
    searchCount.textContent = '';
    term.focus();
  }

  document.getElementById('search-close').addEventListener('click', closeSearch);
  document.getElementById('search-next').addEventListener('click', () => {
    searchAddon.findNext(searchInput.value);
  });
  document.getElementById('search-prev').addEventListener('click', () => {
    searchAddon.findPrevious(searchInput.value);
  });

  searchInput.addEventListener('input', () => {
    if (!searchAddon) return;
    if (searchInput.value) {
      searchAddon.findNext(searchInput.value);
    } else {
      searchAddon.clearDecorations();
      searchCount.textContent = '';
    }
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && searchAddon) {
      e.shiftKey ? searchAddon.findPrevious(searchInput.value) : searchAddon.findNext(searchInput.value);
    } else if (e.key === 'Escape') {
      closeSearch();
    }
  });

  // Intercept Cmd+F / Ctrl+F
  term.attachCustomKeyEventHandler((e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'f' && e.type === 'keydown') {
      openSearch();
      return false; // prevent default
    }
    if (e.key === 'Escape' && searchBar.classList.contains('visible')) {
      closeSearch();
      return false;
    }
    return true;
  });

  // Custom context menu (right-click)
  const ctxMenu = document.getElementById('ctx-menu');
  function hideCtxMenu() { ctxMenu.classList.remove('visible'); }

  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    // Position at mouse, clamped to viewport
    const x = Math.min(e.clientX, window.innerWidth - 160);
    const y = Math.min(e.clientY, window.innerHeight - 140);
    ctxMenu.style.left = x + 'px';
    ctxMenu.style.top = y + 'px';
    ctxMenu.classList.add('visible');
  });

  document.addEventListener('click', (e) => {
    if (!ctxMenu.contains(e.target)) hideCtxMenu();
  });

  ctxMenu.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    hideCtxMenu();
    const action = btn.dataset.action;
    if (action === 'copy') {
      document.execCommand('copy');
    } else if (action === 'paste') {
      navigator.clipboard.readText().then((text) => {
        vscode.postMessage({ type: 'input', data: text });
      }).catch(() => {});
    } else if (action === 'clear') {
      term.clear();
    } else if (action === 'selectAll') {
      term.selectAll();
    }
    term.focus();
  });

  // Copy connected Arabic from overlay
  document.addEventListener('copy', (e) => {
    const overlayLines = overlay.querySelectorAll('.arabic-line');
    if (overlayLines.length === 0) return; // no overlay, use default

    const sel = term.getSelectionPosition();
    if (!sel) return;

    // Build text from overlay spans (connected Arabic)
    const buf = term.buffer.active;
    const viewportY = buf.viewportY;
    const dims = getCellDims();
    let copiedText = '';

    for (let absY = sel.start.y; absY <= sel.end.y; absY++) {
      const rowIdx = absY - viewportY;
      // Find overlay line for this row
      let overlayLine = null;
      overlayLines.forEach((ld) => {
        const top = parseFloat(ld.style.top);
        const r = Math.round((top - dims.canvasTop) / dims.cellH);
        if (r === rowIdx) overlayLine = ld;
      });

      let lineText = '';
      if (overlayLine) {
        // Get text from overlay (connected Arabic)
        const spans = overlayLine.querySelectorAll('span:not(.overlay-cursor)');
        spans.forEach((s) => { lineText += s.textContent || ''; });
      } else {
        // Get text from xterm buffer
        const bufLine = buf.getLine(absY);
        if (bufLine) {
          for (let x = 0; x < bufLine.length; x++) {
            const cell = bufLine.getCell(x);
            if (cell) lineText += cell.getChars() || ' ';
          }
        }
      }

      // Trim to selection columns
      const startX = (absY === sel.start.y) ? sel.start.x : 0;
      const endX = (absY === sel.end.y) ? sel.end.x : lineText.length;
      copiedText += lineText.substring(startX, endX);
      if (absY < sel.end.y) copiedText += '\\n';
    }

    if (copiedText) {
      e.preventDefault();
      e.clipboardData.setData('text/plain', copiedText.trimEnd());
    }
  });

  // Re-render overlay once bundled Nerd Font is loaded
  document.fonts.ready.then(() => scheduleOverlay());

  vscode.postMessage({ type: 'ready' });
})();
</script>
</body>
</html>`;
}
