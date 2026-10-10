import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ShellInfo {
  id: string;
  label: string;
  file: string;
  args: string[];
}

// Make PowerShell/CMD emit UTF-8 so Arabic output arrives intact.
const PS_UTF8 =
  '[Console]::OutputEncoding=[Text.Encoding]::UTF8;[Console]::InputEncoding=[Text.Encoding]::UTF8;$OutputEncoding=[Text.Encoding]::UTF8';

function findOnPath(exe: string): string | undefined {
  const dirs = (process.env.PATH || '').split(path.delimiter);
  for (const d of dirs) {
    const p = path.join(d, exe);
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

export function detectShells(platform: NodeJS.Platform = process.platform): ShellInfo[] {
  const shells: ShellInfo[] = [];
  if (platform === 'win32') {
    const pwsh = findOnPath('pwsh.exe');
    if (pwsh) {
      shells.push({ id: 'pwsh', label: 'PowerShell 7', file: pwsh, args: ['-NoLogo', '-NoExit', '-Command', PS_UTF8] });
    }
    const sysRoot = process.env.SystemRoot || 'C:\\Windows';
    const winPs = path.join(sysRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    shells.push({
      id: 'powershell',
      label: 'Windows PowerShell',
      file: fs.existsSync(winPs) ? winPs : 'powershell.exe',
      args: ['-NoLogo', '-NoExit', '-Command', PS_UTF8],
    });
    shells.push({
      id: 'cmd',
      label: 'Command Prompt',
      file: process.env.ComSpec || 'cmd.exe',
      args: ['/K', 'chcp 65001 >nul'],
    });
    const wsl = findOnPath('wsl.exe');
    if (wsl) shells.push({ id: 'wsl', label: 'WSL', file: wsl, args: [] });
    const gitBash = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs')]
      .filter((x): x is string => !!x)
      .map((d) => path.join(d, 'Git', 'bin', 'bash.exe'))
      .find((p) => fs.existsSync(p));
    if (gitBash) shells.push({ id: 'gitbash', label: 'Git Bash', file: gitBash, args: ['--login', '-i'] });
  } else {
    const envShell = process.env.SHELL;
    if (envShell) shells.push({ id: 'default', label: path.basename(envShell), file: envShell, args: [] });
    for (const name of ['bash', 'zsh', 'fish', 'pwsh']) {
      const p = findOnPath(name);
      if (p && !shells.some((s) => s.file === p)) shells.push({ id: name, label: name, file: p, args: [] });
    }
    if (shells.length === 0) shells.push({ id: 'sh', label: 'sh', file: '/bin/sh', args: [] });
  }
  return shells;
}
