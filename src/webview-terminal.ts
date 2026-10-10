import * as vscode from 'vscode';
import * as os from 'node:os';
import * as path from 'node:path';
import * as pty from 'node-pty';
import { ArabicReshaper } from './arabic-reshaper';
import { BidiEngine } from './bidi-engine';
import { AnsiParser } from './ansi-parser';
import { containsRTL } from './rtl-detector';
import { renderTerminalHtml } from './ui/terminal-ui';

/**
 * WebView terminal using xterm.js for full terminal emulation,
 * with Arabic text preprocessing before rendering.
 *
 * xterm.js handles: cursor, scrollback, ANSI, selection, etc.
 * Our reshaper handles: Arabic letter joining (presentation forms).
 * The browser handles: text rendering with proper glyph shaping.
 */
export class WebviewTerminal {
  private panel: vscode.WebviewPanel;
  private ptyProcess: pty.IPty | undefined;
  private disposables: vscode.Disposable[] = [];
  private reshaper = new ArabicReshaper();
  private bidiEngine = new BidiEngine();
  private ansiParser = new AnsiParser();
  private _onDidFocus = new vscode.EventEmitter<void>();
  readonly onDidFocus = this._onDidFocus.event;
  private _onDidDispose = new vscode.EventEmitter<void>();
  readonly onDidDispose = this._onDidDispose.event;

  constructor(private context: vscode.ExtensionContext) {
    this.panel = vscode.window.createWebviewPanel(
      'rtlTerminal',
      'RTL Terminal',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'media'),
        ],
      }
    );

    // Set tab icon
    this.panel.iconPath = {
      light: vscode.Uri.joinPath(context.extensionUri, 'media', 'sidebar-icon-dark.svg'),
      dark: vscode.Uri.joinPath(context.extensionUri, 'media', 'sidebar-icon-dark.svg'),
    };

    this.panel.webview.html = this.getHtml(this.panel.webview, context.extensionUri);

    this.panel.webview.onDidReceiveMessage(
      (message) => {
        if (message.type === 'input') {
          this.ptyProcess?.write(message.data);
        } else if (message.type === 'resize') {
          this.ptyProcess?.resize(message.cols, message.rows);
        } else if (message.type === 'ready') {
          this.startShell();
        }
      },
      undefined,
      this.disposables
    );

    this.panel.onDidDispose(() => {
      this._onDidDispose.fire();
      this.dispose();
    });

    this.panel.onDidChangeViewState((e) => {
      if (e.webviewPanel.active) this._onDidFocus.fire();
    });
  }

  /** Write data directly to the PTY (used by keybinding passthrough) */
  writeToPty(data: string): void {
    this.ptyProcess?.write(data);
  }

  private getWorkspaceCwd(): string {
    // 1. Workspace folder (most reliable)
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
      return folders[0].uri.fsPath;
    }
    // 2. Active editor's directory
    const activeDoc = vscode.window.activeTextEditor?.document;
    if (activeDoc && !activeDoc.isUntitled) {
      return path.dirname(activeDoc.uri.fsPath);
    }
    // 3. Deprecated rootPath fallback
    if (vscode.workspace.rootPath) {
      return vscode.workspace.rootPath;
    }
    // 4. Home directory
    return os.homedir();
  }

  private startShell(): void {
    const config = vscode.workspace.getConfiguration('rtlTerminal');
    const termConfig = vscode.workspace.getConfiguration('terminal.integrated');
    const shell =
      config.get<string>('shell') ||
      (os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || 'bash');

    const cwd = this.getWorkspaceCwd();

    this.ptyProcess = pty.spawn(shell, config.get<string[]>('shellArgs') || [], {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd,
      env: process.env as Record<string, string>,
    });

    this.ptyProcess.onData((data: string) => {
      // Handle OSC title sequences — prefer version-like titles, skip paths
      const oscTitlePattern = /\x1b\](?:0|1|2);([^\x07\x1b]*?)(?:\x07|\x1b\\)/g;
      data = data.replace(oscTitlePattern, (_match, title: string) => {
        const t = title.trim();
        if (t && !t.includes('/')) {
          // Prefer version numbers (e.g. "2.1.84") — don't overwrite with longer names
          const isVersion = /^\d+\.\d+/.test(t);
          const currentIsVersion = /^\d+\.\d+/.test(this.panel.title);
          if (isVersion || !currentIsVersion) {
            this.panel.title = t;
          }
        }
        return '';
      });

      // Send RAW data to xterm.js — don't reshape!
      // The overlay reads raw Arabic from the buffer and the browser's
      // native text engine connects the letters properly.
      this.panel.webview.postMessage({ type: 'output', data });
    });

    this.ptyProcess.onExit(() => {
      this.panel.webview.postMessage({ type: 'exit' });
    });
  }

  dispose(): void {
    this.ptyProcess?.kill();
    this.disposables.forEach((d) => d.dispose());
    this.panel.dispose();
  }

  /**
   * Reshape Arabic characters in terminal data while preserving
   * all ANSI escape sequences in their exact positions.
   *
   * Uses AnsiParser to strip ALL escape sequences at once,
   * reshape the entire clean text together (so Arabic chars
   * see their neighbors for proper joining), then restore
   * escape sequences at their original positions.
   */
  private reshapeArabicInStream(data: string): string {
    if (!containsRTL(data)) return data;

    // 1. Strip all ANSI escape sequences, preserving positions
    const { cleanText, codes } = this.ansiParser.strip(data);

    // 2. If clean text has no RTL, return as-is
    if (!containsRTL(cleanText)) return data;

    // 3. Reshape the entire clean text at once
    //    This ensures Arabic chars see their neighbors for proper joining
    //    No BiDi reordering — xterm.js is LTR, and reshaping alone makes
    //    Arabic readable with connected letters in the terminal
    const reshaped = this.reshaper.reshape(cleanText);

    // 4. Restore ANSI codes at their original positions
    return this.ansiParser.restore(reshaped, codes);
  }

  private getHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    const mediaUri = vscode.Uri.joinPath(extensionUri, 'media', 'xterm');
    const asUri = (...p: string[]) => webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, ...p)).toString();
    const nerdFontUri = webview
      .asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'SymbolsNerdFontMono-Regular.ttf'))
      .toString();

    // Sync font settings from VS Code terminal config
    const termConfig = vscode.workspace.getConfiguration('terminal.integrated');
    return renderTerminalHtml({
      xtermCss: asUri('xterm.css'),
      xtermJs: asUri('xterm.js'),
      fitJs: asUri('addon-fit.js'),
      webLinksJs: asUri('addon-web-links.js'),
      searchJs: asUri('addon-search.js'),
      nerdFontUri,
      fontSize: termConfig.get<number>('fontSize') || 13,
      fontFamily:
        termConfig.get<string>('fontFamily') ||
        "'MesloLGS NF', 'MesloLGS Nerd Font', 'Hack Nerd Font', 'FiraCode Nerd Font', 'JetBrainsMono Nerd Font', 'Menlo', 'Consolas', 'Courier New', monospace",
      xtermFontFamily: "'Menlo', 'Consolas', 'Courier New', monospace",
      hostInit: 'acquireVsCodeApi()',
    });
  }
}
