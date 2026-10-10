import { renderTerminalHtml } from '../../src/ui/terminal-ui';

interface Api {
  listShells(): Promise<{ id: string; label: string }[]>;
  getSettings(): Promise<{ fontSize: number; fontFamily: string; shellId: string }>;
  setSettings(patch: Record<string, unknown>): Promise<{ fontSize: number; fontFamily: string; shellId: string }>;
  createTab(id: string, shellId: string | undefined, cols: number, rows: number): void;
  input(id: string, data: string): void;
  resize(id: string, cols: number, rows: number): void;
  closeTab(id: string): void;
  onData(cb: (id: string, data: string) => void): void;
  onExit(cb: (id: string, code: number) => void): void;
  onTitle(cb: (id: string, title: string) => void): void;
  onCommand(cb: (cmd: string) => void): void;
}
const api = (window as unknown as { arTerminal: Api }).arTerminal;

interface Tab {
  id: string;
  el: HTMLElement;
  titleEl: HTMLElement;
  frame: HTMLIFrameElement;
}

const tabsEl = document.getElementById('tabs')!;
const viewsEl = document.getElementById('views')!;
const shellSelect = document.getElementById('shell-select') as HTMLSelectElement;
const tabs: Tab[] = [];
let active: Tab | undefined;
let seq = 0;
let settings = { fontSize: 14, fontFamily: 'monospace', shellId: '' };

function assetUrl(rel: string): string {
  return new URL(rel, location.href).href;
}

// Terminal iframes are same-origin (srcdoc), so they reach the bridge through the parent.
(window as unknown as { __arHost: unknown }).__arHost = {
  attach(id: string) {
    return {
      postMessage(msg: { type: string; data?: string; cols?: number; rows?: number }) {
        if (msg.type === 'ready') api.createTab(id, shellSelect.value || undefined, 120, 30);
        else if (msg.type === 'input') api.input(id, msg.data!);
        else if (msg.type === 'resize') api.resize(id, msg.cols!, msg.rows!);
      },
    };
  },
};

function post(tab: Tab, msg: unknown): void {
  tab.frame.contentWindow?.postMessage(msg, '*');
}

function activate(tab: Tab): void {
  active = tab;
  for (const t of tabs) {
    t.el.classList.toggle('active', t === tab);
    t.frame.classList.toggle('active', t === tab);
  }
  document.title = tab.titleEl.textContent || 'AR Terminal';
  post(tab, { type: 'focus' });
}

function newTab(): void {
  const id = 't' + ++seq;
  const frame = document.createElement('iframe');
  frame.srcdoc = renderTerminalHtml({
    xtermCss: assetUrl('media/xterm/xterm.css'),
    xtermJs: assetUrl('media/xterm/xterm.js'),
    fitJs: assetUrl('media/xterm/addon-fit.js'),
    webLinksJs: assetUrl('media/xterm/addon-web-links.js'),
    searchJs: assetUrl('media/xterm/addon-search.js'),
    nerdFontUri: assetUrl('media/SymbolsNerdFontMono-Regular.ttf'),
    fontSize: settings.fontSize,
    fontFamily: settings.fontFamily,
    xtermFontFamily: settings.fontFamily,
    hostInit: `window.parent.__arHost.attach(${JSON.stringify(id)})`,
  });
  viewsEl.appendChild(frame);

  const el = document.createElement('div');
  el.className = 'tab';
  const titleEl = document.createElement('span');
  titleEl.className = 'title';
  titleEl.textContent = 'Terminal';
  const x = document.createElement('span');
  x.className = 'x';
  x.textContent = '×';
  el.append(titleEl, x);
  tabsEl.appendChild(el);

  const tab: Tab = { id, el, titleEl, frame };
  tabs.push(tab);
  el.addEventListener('click', () => activate(tab));
  x.addEventListener('click', (e) => {
    e.stopPropagation();
    closeTab(tab);
  });
  activate(tab);
}

function closeTab(tab: Tab): void {
  api.closeTab(tab.id);
  const i = tabs.indexOf(tab);
  tabs.splice(i, 1);
  tab.el.remove();
  tab.frame.remove();
  if (tabs.length === 0) {
    window.close();
    return;
  }
  if (active === tab) activate(tabs[Math.min(i, tabs.length - 1)]);
}

function cycle(delta: number): void {
  if (!active || tabs.length < 2) return;
  activate(tabs[(tabs.indexOf(active) + delta + tabs.length) % tabs.length]);
}

function setFontSize(size: number): void {
  void api.setSettings({ fontSize: size }).then((s) => {
    settings = s;
    for (const t of tabs) post(t, { type: 'setFontSize', size: s.fontSize });
  });
}

const byId = (id: string) => tabs.find((t) => t.id === id);
api.onData((id, data) => {
  const t = byId(id);
  if (t) post(t, { type: 'output', data });
});
api.onExit((id) => {
  const t = byId(id);
  if (t) post(t, { type: 'exit' });
});
api.onTitle((id, title) => {
  const t = byId(id);
  if (!t) return;
  t.titleEl.textContent = title;
  if (t === active) document.title = title;
});
api.onCommand((cmd) => {
  switch (cmd) {
    case 'newTab': return newTab();
    case 'closeTab': return active && closeTab(active);
    case 'nextTab': return cycle(1);
    case 'prevTab': return cycle(-1);
    case 'zoomIn': return setFontSize(settings.fontSize + 1);
    case 'zoomOut': return setFontSize(settings.fontSize - 1);
    case 'zoomReset': return setFontSize(14);
    case 'search': return active && post(active, { type: 'search' });
  }
});

document.getElementById('new-tab')!.addEventListener('click', newTab);
shellSelect.addEventListener('change', () => void api.setSettings({ shellId: shellSelect.value }));

void (async () => {
  settings = await api.getSettings();
  const shells = await api.listShells();
  for (const s of shells) {
    const o = document.createElement('option');
    o.value = s.id;
    o.textContent = s.label;
    shellSelect.appendChild(o);
  }
  if (settings.shellId) shellSelect.value = settings.shellId;
  newTab();
})();
