# AR Termux — Termux with built-in Arabic/RTL rendering (Android)

This is **Termux itself** (all packages, `pkg`, bootstrap, add-ons) with one change in its terminal renderer:
Arabic/Hebrew/Persian/Urdu text is drawn as a shaped right-to-left run — connected letters and the right
direction — instead of one disconnected glyph per cell.

How it is built: CI clones `termux/termux-app` at the commit in `BASE_COMMIT`, applies
`patches/*.patch`, and builds the APK (workflow `Build AR Termux`). The patch touches only
`terminal-view/.../TerminalRenderer.java`.

**Important:** it keeps Termux's package name (`com.termux`) because Termux's packages are built for the path
`/data/data/com.termux/files/usr`. So it **replaces** the original Termux; it can't be installed next to it.
Uninstall Termux first (back up `~` first: `termux-setup-storage; cp -r ~ ~/storage/shared/termux-backup`).

Termux is GPLv3 (terminal-view/terminal-emulator: Apache-2.0); the patch is under the same licenses.
