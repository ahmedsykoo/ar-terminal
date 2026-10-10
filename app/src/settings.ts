import * as fs from 'node:fs';
import * as path from 'node:path';

export interface Settings {
  fontSize: number;
  fontFamily: string;
  shellId: string;
}

export const DEFAULT_SETTINGS: Settings = {
  fontSize: 14,
  fontFamily: "'Cascadia Mono', 'Cascadia Code', 'Consolas', 'Menlo', 'DejaVu Sans Mono', 'Courier New', monospace",
  shellId: '',
};

export class SettingsStore {
  private data: Settings = { ...DEFAULT_SETTINGS };
  constructor(private file: string) {
    try {
      const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
      this.data = { ...DEFAULT_SETTINGS, ...raw };
    } catch {
      /* first run or corrupt file: use defaults */
    }
  }
  get(): Settings {
    return { ...this.data };
  }
  set(patch: Partial<Settings>): Settings {
    this.data = { ...this.data, ...patch };
    this.data.fontSize = Math.min(40, Math.max(8, Math.round(this.data.fontSize)));
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
    } catch {
      /* non-fatal */
    }
    return this.get();
  }
}
