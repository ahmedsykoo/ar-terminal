import { contextBridge, ipcRenderer } from 'electron';

type Cb<T extends unknown[]> = (...args: T) => void;

function on<T extends unknown[]>(channel: string, cb: Cb<T>): void {
  ipcRenderer.on(channel, (_e, ...args) => cb(...(args as T)));
}

contextBridge.exposeInMainWorld('arTerminal', {
  listShells: () => ipcRenderer.invoke('shells:list'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch: unknown) => ipcRenderer.invoke('settings:set', patch),
  createTab: (id: string, shellId: string | undefined, cols: number, rows: number) =>
    ipcRenderer.send('tab:create', id, shellId, cols, rows),
  input: (id: string, data: string) => ipcRenderer.send('tab:input', id, data),
  resize: (id: string, cols: number, rows: number) => ipcRenderer.send('tab:resize', id, cols, rows),
  closeTab: (id: string) => ipcRenderer.send('tab:close', id),
  onData: (cb: Cb<[string, string]>) => on('tab:data', cb),
  onExit: (cb: Cb<[string, number]>) => on('tab:exit', cb),
  onTitle: (cb: Cb<[string, string]>) => on('tab:title', cb),
  onCommand: (cb: Cb<[string]>) => on('cmd', cb),
});
