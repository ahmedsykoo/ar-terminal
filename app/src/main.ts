import { app, BrowserWindow, ipcMain, Menu, shell as electronShell } from 'electron';
import * as os from 'node:os';
import * as path from 'node:path';
import { PtyManager } from '../../src/pty-manager';
import { detectShells } from './shells';
import { SettingsStore } from './settings';

const tabs = new Map<string, PtyManager>();
let win: BrowserWindow | undefined;
let store: SettingsStore;

const OSC_TITLE = /\x1b\](?:0|2);([^\x07\x1b]*?)(?:\x07|\x1b\\)/g;

function send(channel: string, ...args: unknown[]): void {
  if (win && !win.isDestroyed()) win.webContents.send(channel, ...args);
}

function createTab(id: string, shellId: string | undefined, cols: number, rows: number): void {
  const shells = detectShells();
  const wanted = shellId || store.get().shellId;
  const sh = shells.find((s) => s.id === wanted) || shells[0];
  const pty = new PtyManager();
  pty.onData((data) => {
    let title: string | undefined;
    const clean = data.replace(OSC_TITLE, (_m, t: string) => {
      if (t.trim()) title = t.trim();
      return '';
    });
    if (title) send('tab:title', id, title);
    if (clean) send('tab:data', id, clean);
  });
  pty.onExit((code) => {
    tabs.delete(id);
    send('tab:exit', id, code);
  });
  pty.start({ shell: sh.file, shellArgs: sh.args, cols, rows, cwd: os.homedir() });
  tabs.set(id, pty);
}

function menuCommand(cmd: string): void {
  send('cmd', cmd);
}

function buildMenu(): void {
  const item = (label: string, accelerator: string, cmd: string): Electron.MenuItemConstructorOptions => ({
    label,
    accelerator,
    click: () => menuCommand(cmd),
  });
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'Terminal',
        submenu: [
          item('New Tab', 'CmdOrCtrl+Shift+T', 'newTab'),
          item('Close Tab', 'CmdOrCtrl+Shift+W', 'closeTab'),
          item('Next Tab', 'Ctrl+Tab', 'nextTab'),
          item('Previous Tab', 'Ctrl+Shift+Tab', 'prevTab'),
          { type: 'separator' },
          item('Find', 'CmdOrCtrl+Shift+F', 'search'),
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      {
        label: 'Edit',
        submenu: [
          { label: 'Copy', accelerator: 'CmdOrCtrl+Shift+C', click: () => win?.webContents.copy() },
          { label: 'Paste', accelerator: 'CmdOrCtrl+Shift+V', click: () => win?.webContents.paste() },
        ],
      },
      {
        label: 'View',
        submenu: [
          item('Zoom In', 'CmdOrCtrl+=', 'zoomIn'),
          item('Zoom Out', 'CmdOrCtrl+-', 'zoomOut'),
          item('Reset Zoom', 'CmdOrCtrl+0', 'zoomReset'),
          { role: 'togglefullscreen' },
          { role: 'toggleDevTools' },
        ],
      },
    ])
  );
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1100,
    height: 700,
    backgroundColor: '#1e1e1e',
    title: 'AR Terminal',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void electronShell.openExternal(url);
    return { action: 'deny' };
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.on('closed', () => {
    win = undefined;
  });
}

app.whenReady().then(() => {
  store = new SettingsStore(path.join(app.getPath('userData'), 'settings.json'));
  buildMenu();

  ipcMain.handle('shells:list', () => detectShells().map(({ id, label }) => ({ id, label })));
  ipcMain.handle('settings:get', () => store.get());
  ipcMain.handle('settings:set', (_e, patch) => store.set(patch));
  ipcMain.on('tab:create', (_e, id: string, shellId: string | undefined, cols: number, rows: number) =>
    createTab(id, shellId, cols, rows)
  );
  ipcMain.on('tab:input', (_e, id: string, data: string) => tabs.get(id)?.write(data));
  ipcMain.on('tab:resize', (_e, id: string, cols: number, rows: number) => tabs.get(id)?.resize(cols, rows));
  ipcMain.on('tab:close', (_e, id: string) => {
    tabs.get(id)?.kill();
    tabs.delete(id);
  });

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  for (const t of tabs.values()) t.kill();
  tabs.clear();
  app.quit();
});
